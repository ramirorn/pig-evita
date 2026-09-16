// ===========================================
// Red del formulario de la encuesta (S20)
//
// Los dos comportamientos que este chequeo fija son los que, si se rompen, no
// se notan hasta que ya se perdió la respuesta de alguien:
//
//   1. **Filtrado por audiencia.** `GET /survey/active` devuelve las preguntas
//      de las tres audiencias juntas. Si el formulario muestra —o peor, manda—
//      las de la rama que no corresponde, el backend revalida y contesta 400
//      con la encuesta entera ya contestada. El caso feo es el que nadie prueba
//      a mano: elegir un deporte individual, contestar, volver atrás y cambiar
//      a uno de equipo.
//   2. **Recuperación del borrador.** Es el requisito de producto de esta
//      tarea: la edición anterior no llegó al 50 % de respuestas por la mala
//      conectividad. Un borrador que no vuelve, que vuelve de otra campaña, o
//      un `localStorage` que tira en modo privado y se lleva puesto el
//      formulario, son las tres formas de incumplirlo.
//
// Se bundlea el **fuente real** con esbuild —igual que `check-nav-roles.mjs` y
// `check-public-cards.mjs`—, así que no hay forma de que pase en verde con la
// lógica vieja puesta. El proyecto no tiene runner de tests y tiene un
// presupuesto explícito de cero dependencias nuevas: este es el molde que ya
// usa para lo mismo.
//
// Corre con: npm run check:survey
// ===========================================
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const SALIDA = path.join(RAIZ, 'node_modules', '.cache', 'check-survey.mjs');

const problemas = [];
const verificaciones = [];

function comprobar(descripcion, condicion, detalle) {
  verificaciones.push(descripcion);
  if (!condicion) problemas.push(`${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

// -------------------------------------------------
// `localStorage` de mentira, instalado ANTES de importar el bundle
// -------------------------------------------------
//
// El módulo lo usa dentro de las funciones, no al importarse, pero se instala
// antes igual para no depender de ese detalle.
function instalarStorage({ rompe = false } = {}) {
  const datos = new Map();
  globalThis.localStorage = {
    getItem(clave) {
      if (rompe) throw new DOMException('acceso denegado');
      return datos.has(clave) ? datos.get(clave) : null;
    },
    setItem(clave, valor) {
      if (rompe) throw new DOMException('cuota excedida');
      datos.set(clave, String(valor));
    },
    removeItem(clave) {
      if (rompe) throw new DOMException('acceso denegado');
      datos.delete(clave);
    },
  };
  return datos;
}

instalarStorage();

execSync(
  [
    'npx esbuild',
    `"${path.join(RAIZ, 'scripts', 'survey.entry.ts')}"`,
    `"--outfile=${SALIDA}"`,
    '--bundle --format=esm --platform=node --log-level=error',
    `"--alias:@=${SRC}"`,
    // `logger.ts` mira `import.meta.env.DEV`, que en Node no existe.
    '"--define:import.meta.env={\\"DEV\\":false}"',
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

const {
  preguntasVisibles,
  podarRespuestas,
  alternarOpcion,
  obligatoriasSinResponder,
  aRespuestasPayload,
  leerBorrador,
  guardarBorrador,
  borrarBorrador,
  leerPendientes,
  encolarEnvio,
  quitarPendiente,
  marcarIntento,
  DisciplineType,
  SurveyAudience,
  SurveyQuestionKind,
  CompetitionStage,
} = await import(pathToFileURL(SALIDA).href);

// -------------------------------------------------
// Cuestionario de prueba: 6 de TODOS + 2 por rama, como el real
// -------------------------------------------------
const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let contadorOpcion = 500;
function opciones(questionId, cantidad) {
  return Array.from({ length: cantidad }, (_, i) => ({
    id: UUID(contadorOpcion++),
    questionId,
    orden: i,
    texto: `Opción ${i + 1}`,
    valor: `opcion_${i + 1}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));
}

function pregunta({
  n,
  orden,
  audiencia = SurveyAudience.TODOS,
  kind = SurveyQuestionKind.UNICA,
  obligatoria = true,
  activa = true,
}) {
  const id = UUID(n);
  return {
    id,
    campaignId: UUID(1),
    orden,
    texto: `Pregunta ${orden}`,
    ayuda: null,
    kind,
    audiencia,
    obligatoria,
    activa,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    options: opciones(id, 3),
  };
}

const P_TODOS = Array.from({ length: 6 }, (_, i) =>
  pregunta({ n: 10 + i, orden: i + 1 }),
);
const P_INDIVIDUAL = [
  pregunta({ n: 20, orden: 7, audiencia: SurveyAudience.INDIVIDUAL }),
  pregunta({
    n: 21,
    orden: 8,
    audiencia: SurveyAudience.INDIVIDUAL,
    kind: SurveyQuestionKind.MULTIPLE,
    obligatoria: false,
  }),
];
const P_EQUIPO = [
  pregunta({ n: 30, orden: 7, audiencia: SurveyAudience.EQUIPO }),
  pregunta({ n: 31, orden: 8, audiencia: SurveyAudience.EQUIPO }),
];
const P_INACTIVA = pregunta({ n: 40, orden: 9, activa: false });

// Desordenadas a propósito: el orden lo tiene que poner `preguntasVisibles`.
const CUESTIONARIO = [P_INACTIVA, ...P_EQUIPO, ...P_TODOS, ...P_INDIVIDUAL];

// -------------------------------------------------
// 1. Filtrado por audiencia
// -------------------------------------------------
{
  const individuales = preguntasVisibles(CUESTIONARIO, DisciplineType.INDIVIDUAL);
  const deEquipo = preguntasVisibles(CUESTIONARIO, DisciplineType.EQUIPO);
  const sinElegir = preguntasVisibles(CUESTIONARIO, null);

  comprobar(
    'un deporte individual ve las 6 de TODOS + sus 2',
    individuales.length === 8,
    `vio ${individuales.length}`,
  );
  comprobar(
    'un deporte individual NO ve ninguna pregunta de EQUIPO',
    individuales.every((p) => p.audiencia !== SurveyAudience.EQUIPO),
  );
  comprobar(
    'un deporte de equipo ve las 6 de TODOS + sus 2',
    deEquipo.length === 8,
    `vio ${deEquipo.length}`,
  );
  comprobar(
    'un deporte de equipo NO ve ninguna pregunta de INDIVIDUAL',
    deEquipo.every((p) => p.audiencia !== SurveyAudience.INDIVIDUAL),
  );
  comprobar(
    'sin disciplina elegida sólo se muestran las de TODOS',
    sinElegir.length === 6 &&
      sinElegir.every((p) => p.audiencia === SurveyAudience.TODOS),
    `vio ${sinElegir.length}`,
  );
  comprobar(
    'las preguntas inactivas nunca se muestran',
    [...individuales, ...deEquipo, ...sinElegir].every((p) => p.activa),
  );
  comprobar(
    'las preguntas se muestran en el orden que fija el backend',
    individuales.every((p, i) => i === 0 || p.orden >= individuales[i - 1].orden),
    individuales.map((p) => p.orden).join(','),
  );
}

// -------------------------------------------------
// 2. El bug de la rama equivocada: cambiar de disciplina poda
// -------------------------------------------------
{
  const individuales = preguntasVisibles(CUESTIONARIO, DisciplineType.INDIVIDUAL);
  const deEquipo = preguntasVisibles(CUESTIONARIO, DisciplineType.EQUIPO);

  // Contesta TODO como deportista individual.
  const respuestas = {};
  for (const p of individuales) {
    respuestas[p.id] = [p.options[0].id];
  }

  comprobar(
    'contestó las 8 preguntas de su rama',
    Object.keys(respuestas).length === 8,
  );

  // Vuelve atrás y cambia a un deporte de equipo.
  const podadas = podarRespuestas(respuestas, deEquipo);

  comprobar(
    'al cambiar de rama se descartan las respuestas de la rama vieja',
    P_INDIVIDUAL.every((p) => podadas[p.id] === undefined),
    Object.keys(podadas).length + ' respuestas quedaron',
  );
  comprobar(
    'al cambiar de rama se conservan las respuestas de las preguntas de TODOS',
    P_TODOS.every((p) => podadas[p.id]?.length === 1),
  );
  comprobar(
    'el envío armado después del cambio no incluye preguntas de la otra rama',
    aRespuestasPayload(deEquipo, podadas).every((r) =>
      P_INDIVIDUAL.every((p) => p.id !== r.questionId),
    ),
  );

  // Una opción que ya no existe (el panel editó el cuestionario) también se cae.
  const conOpcionFantasma = podarRespuestas(
    { [P_TODOS[0].id]: [UUID(999)] },
    deEquipo,
  );
  comprobar(
    'una opción que ya no existe en la pregunta se descarta',
    conOpcionFantasma[P_TODOS[0].id] === undefined,
  );

  // Un borrador viejo con dos opciones en una pregunta que hoy es UNICA.
  const unica = P_TODOS[1];
  const conDosEnUnica = podarRespuestas(
    { [unica.id]: [unica.options[0].id, unica.options[1].id] },
    deEquipo,
  );
  comprobar(
    'una UNICA con dos opciones guardadas se queda con una sola',
    conDosEnUnica[unica.id]?.length === 1,
  );
}

// -------------------------------------------------
// 3. Obligatorias y alternancia de opciones
// -------------------------------------------------
{
  const deEquipo = preguntasVisibles(CUESTIONARIO, DisciplineType.EQUIPO);

  comprobar(
    'sin contestar nada, faltan todas las obligatorias visibles',
    obligatoriasSinResponder(deEquipo, {}).length ===
      deEquipo.filter((p) => p.obligatoria).length,
  );
  comprobar(
    'una obligatoria de la rama que no aplica NO bloquea el envío',
    obligatoriasSinResponder(deEquipo, {}).every((p) =>
      P_INDIVIDUAL.every((i) => i.id !== p.id),
    ),
  );

  const multiple = P_INDIVIDUAL[1];
  const a = multiple.options[0].id;
  const b = multiple.options[1].id;

  comprobar(
    'MULTIPLE acumula opciones',
    alternarOpcion([a], b, SurveyQuestionKind.MULTIPLE).length === 2,
  );
  comprobar(
    'MULTIPLE desmarca lo ya elegido',
    alternarOpcion([a, b], a, SurveyQuestionKind.MULTIPLE).join() === b,
  );
  comprobar(
    'UNICA reemplaza en vez de acumular',
    alternarOpcion([a], b, SurveyQuestionKind.UNICA).join() === b,
  );
  comprobar(
    'UNICA desmarca si se vuelve a tocar la misma',
    alternarOpcion([a], a, SurveyQuestionKind.UNICA).length === 0,
  );
}

// -------------------------------------------------
// 4. Borrador: se guarda, vuelve, y no se mezcla entre campañas
// -------------------------------------------------
{
  instalarStorage();

  const campania = UUID(1);
  const otraCampania = UUID(2);
  // La etapa va en el contexto sólo cuando la campaña no la fija. Se incluye
  // acá porque Zod descarta lo que no esté declarado en el schema: mientras
  // `surveyContextSchema` no la tuvo, el borrador volvía sin etapa y el
  // selector aparecía otra vez en blanco (visto en el navegador, no en teoría).
  const contexto = { disciplineId: UUID(7), etapa: CompetitionStage.PROVINCIAL };
  const respuestas = { [P_TODOS[0].id]: [P_TODOS[0].options[0].id] };

  comprobar('sin nada guardado, no hay borrador', leerBorrador(campania) === null);

  guardarBorrador(campania, contexto, respuestas);
  const recuperado = leerBorrador(campania);

  comprobar('el borrador vuelve después de guardarlo', recuperado !== null);
  comprobar(
    'el borrador conserva el contexto',
    recuperado?.contexto?.disciplineId === contexto.disciplineId,
  );
  comprobar(
    'el borrador conserva la etapa elegida (campaña sin etapa fija)',
    recuperado?.contexto?.etapa === CompetitionStage.PROVINCIAL,
    `volvió: ${recuperado?.contexto?.etapa}`,
  );
  comprobar(
    'el borrador conserva las respuestas',
    recuperado?.respuestas?.[P_TODOS[0].id]?.[0] === P_TODOS[0].options[0].id,
  );
  comprobar(
    'un borrador de OTRA campaña no se restaura',
    leerBorrador(otraCampania) === null,
  );

  borrarBorrador();
  comprobar(
    'al confirmarse el envío el borrador se borra',
    leerBorrador(campania) === null,
  );

  // Texto corrupto o de una versión vieja del formulario: se descarta, no rompe.
  const datos = instalarStorage();
  datos.set('evita_encuesta_borrador_v1', '{ esto no es JSON');
  comprobar('un borrador corrupto no rompe la lectura', leerBorrador(campania) === null);

  datos.set(
    'evita_encuesta_borrador_v1',
    JSON.stringify({ campaignId: campania, respuestas: 'ayer' }),
  );
  comprobar(
    'un borrador con otra forma se descarta en vez de restaurarse a medias',
    leerBorrador(campania) === null,
  );
}

// -------------------------------------------------
// 5. Modo privado: `localStorage` que tira no puede voltear el formulario
// -------------------------------------------------
{
  instalarStorage({ rompe: true });

  let exploto = false;
  try {
    guardarBorrador(UUID(1), {}, {});
    comprobar('leer con localStorage roto devuelve null', leerBorrador(UUID(1)) === null);
    comprobar('leer la cola con localStorage roto devuelve []', leerPendientes().length === 0);
    borrarBorrador();
  } catch {
    exploto = true;
  }

  comprobar(
    'con localStorage inaccesible (modo privado) nada tira una excepción',
    !exploto,
  );
}

// -------------------------------------------------
// 6. Cola de envíos: encolar, reintentar, confirmar
// -------------------------------------------------
{
  instalarStorage();

  const payload = {
    campaignId: UUID(1),
    etapa: CompetitionStage.ZONAL,
    disciplineType: DisciplineType.EQUIPO,
    disciplineId: UUID(7),
    respuestas: [
      { questionId: P_TODOS[0].id, optionIds: [P_TODOS[0].options[0].id] },
    ],
  };

  comprobar('la cola arranca vacía', leerPendientes().length === 0);

  const encolados = encolarEnvio(payload);
  comprobar('un envío sin señal queda en la cola', encolados.length === 1);
  comprobar(
    'el envío encolado conserva las respuestas intactas',
    leerPendientes()[0]?.payload?.respuestas?.[0]?.optionIds?.[0] ===
      P_TODOS[0].options[0].id,
  );

  const id = leerPendientes()[0].id;
  marcarIntento(id);
  comprobar('un reintento fallido queda contado', leerPendientes()[0]?.intentos === 2);

  comprobar(
    'al confirmarse, el envío sale de la cola',
    quitarPendiente(id).length === 0 && leerPendientes().length === 0,
  );

  // Basura en la cola (otra versión del payload): se tira, no se manda.
  const datos = instalarStorage();
  datos.set(
    'evita_encuesta_pendientes_v1',
    JSON.stringify([{ id: 'x', creadoEn: 'ayer', intentos: 1, payload: { hola: 1 } }]),
  );
  comprobar(
    'un envío en cola que no valida contra el DTO se descarta',
    leerPendientes().length === 0,
  );
}

// -------------------------------------------------
// Resultado
// -------------------------------------------------
if (problemas.length > 0) {
  console.error(`\n❌ ${problemas.length} problema(s) en el formulario de la encuesta:\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error('');
  process.exit(1);
}

console.log(`Chequeos ejecutados: ${verificaciones.length}`);
console.log(
  '✅ El filtrado por audiencia y la recuperación del borrador funcionan.',
);
