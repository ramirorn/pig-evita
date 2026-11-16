// ===========================================
// Demo de métricas: respuestas de encuesta de prueba
// ===========================================
//
// Uso:  npm run db:seed:encuesta -- --cantidad 300 [--publicar]
//
// Deja una campaña lista para mostrar el panel de Métricas:
//   1. toma la campaña ACTIVA (o, si no hay, el borrador más reciente);
//   2. le agrega las preguntas de salud y educación si le faltan;
//   3. crea los KPIs reutilizables si no existen;
//   4. genera N respuestas anónimas, respetando audiencia y UNICA/MULTIPLE;
//   5. con `--publicar`, pasa un borrador a ACTIVA para poder contestarla
//      desde /encuesta y ver el panel actualizarse en vivo.
//
// Las respuestas están sesgadas a propósito (el interior reporta menos
// atención médica y menos intención de seguir estudiando) para que los
// gráficos cuenten algo. SON DATOS INVENTADOS: nunca en producción.
import {
  CompetitionStage,
  DisciplineType,
  Prisma,
  PrismaClient,
  Sex,
  SurveyAudience,
  SurveyCampaignStatus,
  SurveyQuestionKind,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import Redis from 'ioredis';
import 'dotenv/config';
import {
  KPIS_SEMILLA,
  PREGUNTAS_SALUD_Y_EDUCACION,
  VALORES,
} from './survey-seed-data';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DIAS_HACIA_ATRAS = 10;
const TAMANIO_LOTE = 25;

function leerArgumentos() {
  const args = process.argv.slice(2);
  const indice = args.indexOf('--cantidad');
  const cantidad = indice >= 0 ? Number(args[indice + 1]) : 300;
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 5000) {
    throw new Error('--cantidad debe ser un entero entre 1 y 5000');
  }
  return { cantidad, publicar: args.includes('--publicar') };
}

const azar = <T>(lista: readonly T[]): T =>
  lista[Math.floor(Math.random() * lista.length)];

/** Elige una clave según pesos relativos. */
function elegirConPeso<T>(opciones: { item: T; peso: number }[]): T {
  const total = opciones.reduce((s, o) => s + o.peso, 0);
  let r = Math.random() * total;
  for (const o of opciones) {
    r -= o.peso;
    if (r <= 0) return o.item;
  }
  return opciones[opciones.length - 1].item;
}

/**
 * Peso de una opción según la zona de quien responde. Sólo sesga las
 * preguntas de salud y educación; el resto queda parejo.
 */
function pesoDe(valor: string, esInterior: boolean): number {
  const pesos: Record<string, [capital: number, interior: number]> = {
    [VALORES.NO_ME_LESIONE]: [78, 70],
    [VALORES.LESION_ATENDIDO_EN_SEDE]: [12, 7],
    [VALORES.LESION_DERIVADO]: [7, 8],
    [VALORES.LESION_SIN_ATENCION]: [3, 15],
    [VALORES.HABIA_ATENCION_MEDICA]: [75, 35],
    [VALORES.NO_HABIA_ATENCION_MEDICA]: [10, 45],
    [VALORES.NO_SE_ATENCION_MEDICA]: [15, 20],
    [VALORES.SEGUIR_ESTUDIANDO]: [50, 25],
    [VALORES.ESTUDIAR_Y_TRABAJAR]: [25, 22],
    [VALORES.SOLO_TRABAJAR]: [10, 30],
    [VALORES.NO_SE_ESTUDIOS]: [15, 23],
  };
  const par = pesos[valor];
  return par ? par[esInterior ? 1 : 0] : 1;
}

async function asegurarPreguntas(campaignId: string) {
  const existentes = await prisma.surveyOption.findMany({
    where: { question: { campaignId } },
    select: { valor: true },
  });
  const valores = new Set(existentes.map((o) => o.valor));
  let agregadas = 0;

  for (const pregunta of PREGUNTAS_SALUD_Y_EDUCACION) {
    // Si ya está alguna de sus opciones, la pregunta existe (aunque la hayan
    // reescrito desde el panel): no se duplica.
    if (pregunta.opciones.some((o) => valores.has(o.valor))) continue;
    await prisma.surveyQuestion.create({
      data: {
        campaignId,
        orden: pregunta.orden,
        texto: pregunta.texto,
        kind: pregunta.kind,
        audiencia: pregunta.audiencia,
        obligatoria: true,
        activa: true,
        options: {
          create: pregunta.opciones.map((o, indice) => ({
            orden: indice,
            texto: o.texto,
            valor: o.valor,
          })),
        },
      },
    });
    agregadas += 1;
  }
  return agregadas;
}

async function asegurarKpis() {
  let creados = 0;
  for (const kpi of KPIS_SEMILLA) {
    const existe = await prisma.surveyKpi.findFirst({
      where: { nombre: kpi.nombre, campaignId: null },
      select: { id: true },
    });
    if (existe) continue;
    await prisma.surveyKpi.create({
      data: {
        nombre: kpi.nombre,
        descripcion: kpi.descripcion,
        orden: kpi.orden,
        definicion: kpi.definicion as unknown as Prisma.InputJsonValue,
      },
    });
    creados += 1;
  }
  return creados;
}

/** Sube la versión de la campaña para que el panel abierto se refresque. */
async function subirVersion(campaignId: string) {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  redis.on('error', () => {});
  try {
    await redis.connect();
    await redis.incr(`metrics:survey:${campaignId}:version`);
  } catch {
    console.log('  ℹ️  Redis no disponible: el panel se refresca por conteo.');
  } finally {
    redis.disconnect();
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Este script genera respuestas inventadas: no se corre en producción.',
    );
  }
  const { cantidad, publicar } = leerArgumentos();

  const campania =
    (await prisma.surveyCampaign.findFirst({
      where: { status: SurveyCampaignStatus.ACTIVA },
      orderBy: { createdAt: 'desc' },
    })) ??
    (await prisma.surveyCampaign.findFirst({
      where: { status: SurveyCampaignStatus.BORRADOR },
      orderBy: { createdAt: 'desc' },
    }));
  if (!campania) {
    throw new Error(
      'No hay ninguna campaña ACTIVA ni en BORRADOR. Corré primero `npm run db:seed`.',
    );
  }
  console.log(`📊 Campaña: "${campania.titulo}" (${campania.status})`);

  const agregadas = await asegurarPreguntas(campania.id);
  const kpisCreados = await asegurarKpis();
  console.log(
    `  ✅ Preguntas de salud y educación agregadas: ${agregadas} · KPIs creados: ${kpisCreados}`,
  );

  if (publicar && campania.status === SurveyCampaignStatus.BORRADOR) {
    await prisma.surveyCampaign.update({
      where: { id: campania.id },
      data: { status: SurveyCampaignStatus.ACTIVA },
    });
    console.log('  ✅ Campaña publicada (ACTIVA): ya se puede contestar.');
  }

  const [preguntas, localidades, disciplinas, categorias] = await Promise.all([
    prisma.surveyQuestion.findMany({
      where: { campaignId: campania.id, activa: true },
      include: { options: { orderBy: { orden: 'asc' } } },
      orderBy: { orden: 'asc' },
    }),
    prisma.locality.findMany({
      select: { id: true, name: true, department: { select: { name: true } } },
    }),
    prisma.discipline.findMany({ select: { id: true, type: true } }),
    prisma.category.findMany({ select: { id: true, disciplineId: true } }),
  ]);
  if (disciplinas.length === 0 || localidades.length === 0) {
    throw new Error(
      'Faltan disciplinas o localidades. Corré primero `npm run db:seed`.',
    );
  }

  const capital = localidades.find(
    (l) => l.name === 'Formosa' && l.department.name === 'Formosa',
  );
  const interior = localidades.filter((l) => l.id !== capital?.id);

  const ahora = Date.now();
  const datos: Prisma.SurveyResponseCreateInput[] = [];

  for (let i = 0; i < cantidad; i++) {
    // 30 % capital, 62 % interior, 8 % sin localidad cargada.
    const tirada = Math.random();
    const localidad =
      tirada < 0.08
        ? null
        : tirada < 0.38 && capital
          ? capital
          : azar(interior.length ? interior : localidades);
    const esInterior = localidad?.id !== capital?.id;

    const disciplina = azar(disciplinas);
    const categoriasDeDisciplina = categorias.filter(
      (c) => c.disciplineId === disciplina.id,
    );
    const categoria = categoriasDeDisciplina.length
      ? azar(categoriasDeDisciplina)
      : null;

    const respuestas: { questionId: string; optionId: string }[] = [];
    for (const pregunta of preguntas) {
      const compatible =
        pregunta.audiencia === SurveyAudience.TODOS ||
        (pregunta.audiencia === SurveyAudience.INDIVIDUAL
          ? disciplina.type === DisciplineType.INDIVIDUAL
          : disciplina.type === DisciplineType.EQUIPO);
      if (!compatible || pregunta.options.length === 0) continue;

      const conPeso = pregunta.options.map((o) => ({
        item: o,
        peso: pesoDe(o.valor, esInterior),
      }));
      const elegidas = new Set([elegirConPeso(conPeso).id]);
      if (
        pregunta.kind === SurveyQuestionKind.MULTIPLE &&
        Math.random() < 0.5
      ) {
        elegidas.add(elegirConPeso(conPeso).id);
      }
      for (const optionId of elegidas) {
        respuestas.push({ questionId: pregunta.id, optionId });
      }
    }

    datos.push({
      campaign: { connect: { id: campania.id } },
      ventana: campania.ventana,
      etapa:
        campania.etapa ??
        elegirConPeso([
          { item: CompetitionStage.ZONAL, peso: 6 },
          { item: CompetitionStage.DEPARTAMENTAL, peso: 3 },
          { item: CompetitionStage.PROVINCIAL, peso: 1 },
        ]),
      disciplineType: disciplina.type,
      discipline: { connect: { id: disciplina.id } },
      ...(localidad ? { locality: { connect: { id: localidad.id } } } : {}),
      ...(categoria ? { category: { connect: { id: categoria.id } } } : {}),
      sexo: azar([Sex.MASCULINO, Sex.FEMENINO]),
      enviadaEn: new Date(
        ahora - Math.random() * DIAS_HACIA_ATRAS * 24 * 60 * 60 * 1000,
      ),
      answers: { create: respuestas },
    });
  }

  for (let i = 0; i < datos.length; i += TAMANIO_LOTE) {
    await Promise.all(
      datos
        .slice(i, i + TAMANIO_LOTE)
        .map((data) => prisma.surveyResponse.create({ data })),
    );
  }
  await subirVersion(campania.id);

  const total = await prisma.surveyResponse.count({
    where: { campaignId: campania.id },
  });
  console.log(
    `  ✅ ${cantidad} respuestas de prueba generadas (la campaña tiene ${total}).`,
  );
  console.log('\n👉 Abrí /admin/metricas para ver el panel.');
}

main()
  .catch((e) => {
    console.error('❌', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
