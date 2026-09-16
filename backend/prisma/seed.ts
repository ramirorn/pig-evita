// ===========================================
// Prisma Seed - Datos Iniciales
// ===========================================
import {
  PrismaClient,
  UserRole,
  Sex,
  DisciplineType,
  ResultType,
  CompetitionStage,
  CompetitionFormat,
  CompetitionStatus,
  MatchStatus,
  SurveyAudience,
  SurveyCampaignStatus,
  SurveyQuestionKind,
  SurveyWindow,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as argon2 from 'argon2';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Catálogo de departamentos y localidades de la Provincia de Formosa.
 */
const FORMOSA_GEOGRAPHY: Record<string, string[]> = {
  Formosa: [
    'Formosa',
    'Gran Guardia',
    'Mariano Boedo',
    'Mojón de Fierro',
    'San Hilario',
    'Villa del Carmen',
  ],
  Laishí: [
    'Herradura',
    'Tatané',
    'Villa Escolar',
    'San Francisco de Laishí',
    'Colonia Aquino',
  ],
  Pirané: [
    'Pirané',
    'El Colorado',
    'Colonia Campo Villafañe',
    'Mayor Vicente Villafañe',
    'Palo Santo',
  ],
  Pilagás: [
    'Clorinda',
    'Laguna Naick Neck',
    'Puerto Pilcomayo',
    'Siete Palmas',
    'Riacho He-Hé',
  ],
  Bermejo: [
    'Laguna Yema',
    'Los Chiriguanos',
    'Pozo de Maza',
    'Guadalcázar',
    'Lamadrid',
  ],
  Matacos: ['Ingeniero Juárez', 'General Mosconi'],
  'Ramón Lista': ['General E. Mosconi', 'El Potrillo'],
  Patiño: [
    'Comandante Fontana',
    'Ibarreta',
    'Estanislao del Campo',
    'Las Lomitas',
    'Pozo del Tigre',
    'Subteniente Perín',
    'Villa General Güemes',
  ],
  Pilcomayo: [
    'Clorinda',
    'Laguna Blanca',
    'Misión Tacaaglé',
    'Buena Vista',
    'Palma Sola',
    'Riacho He-Hé',
    'El Espinillo',
    'General Belgrano',
    'Tres Lagunas',
  ],
};

/**
 * Cuestionario de la encuesta psicológica (S20).
 *
 * ⚠️ ESTO ES UN BORRADOR. El texto de abajo lo redactó el equipo de desarrollo
 * para que la pantalla no arranque vacía: **no es el instrumento final**. Lo
 * escribe y lo corrige la psicóloga desde `/admin/encuesta`, sin deploy, que es
 * la razón de que las preguntas vivan en la base y no acá.
 *
 * Lo único que no se toca a la ligera es el `valor` de cada opción: es la clave
 * con la que se agregan las métricas. El texto se reescribe todas las veces que
 * haga falta; cambiar el valor parte la serie histórica.
 *
 * Los ordinales 7 y 8 se repiten a propósito entre INDIVIDUAL y EQUIPO: son la
 * misma posición del formulario, y cada chico ve sólo el par que le toca según
 * su disciplina.
 */
const ENCUESTA_BORRADOR = {
  titulo: 'Encuesta de bienestar deportivo (borrador)',
  descripcion:
    'Es anónima: no se guarda tu nombre, tu DNI ni nada que permita saber que la contestaste vos. Contestá lo que sentís de verdad.',
  preguntas: [
    {
      orden: 1,
      audiencia: SurveyAudience.TODOS,
      kind: SurveyQuestionKind.UNICA,
      texto:
        '¿Tuviste asistencia profesional acerca de la salud mental antes del torneo?',
      opciones: [
        { texto: 'Sí', valor: 'si' },
        { texto: 'No', valor: 'no' },
        { texto: 'No sé qué es', valor: 'no_se_que_es' },
      ],
    },
    {
      orden: 2,
      audiencia: SurveyAudience.TODOS,
      kind: SurveyQuestionKind.UNICA,
      texto: 'Cuando sentís nervios antes de competir, ¿qué te ayuda más?',
      opciones: [
        { texto: 'Escuchar música', valor: 'escuchar_musica' },
        {
          texto: 'Hablar con amigos o compañeros',
          valor: 'hablar_con_amigos',
        },
        {
          texto: 'Hablar con mi entrenador o profe',
          valor: 'hablar_con_entrenador',
        },
        { texto: 'Estar solo y concentrarme', valor: 'estar_solo' },
        { texto: 'Nada me ayuda', valor: 'nada_me_ayuda' },
        { texto: 'No me pongo nervioso', valor: 'no_me_pongo_nervioso' },
      ],
    },
    {
      orden: 3,
      audiencia: SurveyAudience.TODOS,
      kind: SurveyQuestionKind.UNICA,
      texto:
        'Si este año no te va como esperabas, ¿qué pensás hacer el año que viene?',
      opciones: [
        {
          texto: 'Volver a intentarlo en la misma disciplina',
          valor: 'volver_a_intentar',
        },
        { texto: 'Probar otra disciplina', valor: 'probar_otra_disciplina' },
        { texto: 'Dejar de competir', valor: 'dejar_de_competir' },
        { texto: 'Todavía no lo sé', valor: 'no_lo_se' },
      ],
    },
    {
      orden: 4,
      audiencia: SurveyAudience.TODOS,
      kind: SurveyQuestionKind.UNICA,
      texto: '¿Sentís que tu escuela te apoya para competir?',
      opciones: [
        { texto: 'Sí, mucho', valor: 'si_mucho' },
        { texto: 'Más o menos', valor: 'mas_o_menos' },
        { texto: 'No', valor: 'no' },
        { texto: 'No voy a la escuela ahora', valor: 'no_voy_a_la_escuela' },
      ],
    },
    {
      orden: 5,
      audiencia: SurveyAudience.TODOS,
      kind: SurveyQuestionKind.MULTIPLE,
      texto: '¿Con quién podés hablar cuando algo del deporte te preocupa?',
      opciones: [
        { texto: 'Familia', valor: 'familia' },
        { texto: 'Entrenador o profe', valor: 'entrenador' },
        { texto: 'Compañeros', valor: 'companeros' },
        {
          texto: 'Un psicólogo o profesional',
          valor: 'psicologo_o_profesional',
        },
        { texto: 'Con nadie', valor: 'con_nadie' },
      ],
    },
    {
      orden: 6,
      audiencia: SurveyAudience.TODOS,
      kind: SurveyQuestionKind.UNICA,
      texto:
        '¿Te gustaría seguir compitiendo en un nivel más alto (alto rendimiento)?',
      opciones: [
        { texto: 'Sí, es mi objetivo', valor: 'si_es_mi_objetivo' },
        {
          texto: 'Me gustaría pero no sé cómo',
          valor: 'me_gustaria_pero_no_se_como',
        },
        { texto: 'No, compito por diversión', valor: 'compito_por_diversion' },
        { texto: 'No lo había pensado', valor: 'no_lo_habia_pensado' },
      ],
    },
    {
      orden: 7,
      audiencia: SurveyAudience.INDIVIDUAL,
      kind: SurveyQuestionKind.UNICA,
      texto: 'Cuando competís solo, ¿cómo vivís el momento antes de entrar?',
      opciones: [
        { texto: 'Lo disfruto', valor: 'lo_disfruto' },
        {
          texto: 'Me da nervios pero lo manejo',
          valor: 'nervios_pero_lo_manejo',
        },
        { texto: 'Me cuesta mucho', valor: 'me_cuesta_mucho' },
        { texto: 'Prefiero no pensarlo', valor: 'prefiero_no_pensarlo' },
      ],
    },
    {
      orden: 8,
      audiencia: SurveyAudience.INDIVIDUAL,
      kind: SurveyQuestionKind.UNICA,
      texto: 'Si algo sale mal durante tu prueba, ¿qué hacés?',
      opciones: [
        { texto: 'Me reordeno y sigo', valor: 'me_reordeno_y_sigo' },
        { texto: 'Me cuesta pero termino', valor: 'me_cuesta_pero_termino' },
        { texto: 'Me bloqueo', valor: 'me_bloqueo' },
        { texto: 'Nunca me pasó', valor: 'nunca_me_paso' },
      ],
    },
    {
      orden: 7,
      audiencia: SurveyAudience.EQUIPO,
      kind: SurveyQuestionKind.UNICA,
      texto: 'Cuando el equipo pierde, ¿cómo se hablan entre ustedes?',
      opciones: [
        { texto: 'Nos apoyamos', valor: 'nos_apoyamos' },
        { texto: 'Se arma discusión', valor: 'se_arma_discusion' },
        { texto: 'Cada uno por su lado', valor: 'cada_uno_por_su_lado' },
        { texto: 'Depende del partido', valor: 'depende_del_partido' },
      ],
    },
    {
      orden: 8,
      audiencia: SurveyAudience.EQUIPO,
      kind: SurveyQuestionKind.UNICA,
      texto: 'Si te toca el banco o no entrás a jugar, ¿cómo lo vivís?',
      opciones: [
        {
          texto: 'Lo entiendo y apoyo desde afuera',
          valor: 'lo_entiendo_y_apoyo',
        },
        { texto: 'Me pone mal pero lo acepto', valor: 'me_pone_mal_lo_acepto' },
        { texto: 'Me da mucha bronca', valor: 'me_da_mucha_bronca' },
        { texto: 'No me pasó', valor: 'no_me_paso' },
      ],
    },
  ],
};

async function main() {
  console.log('🌱 Seeding database with comprehensive mock data...');

  // --- 1. Crear Super Admin ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@juegosevita.gob.ar';

  // Sin fallback (hallazgo C-05): un default acá creaba un SUPER_ADMIN con
  // contraseña conocida y publicada en el repo.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error(
      '❌ SEED_ADMIN_PASSWORD no está definida. Generala con: ' +
        `node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))"`,
    );
  }

  const passwordHash = await argon2.hash(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      firstName: 'Super',
      lastName: 'Administrador',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'Super',
      lastName: 'Administrador',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log(
    `  ✅ Super Admin ${admin.email} ${admin.createdAt ? 'confirmado' : 'creado'}: ${adminEmail}`,
  );

  // --- 2. Cargar catálogo geográfico ---
  for (const [deptName, localities] of Object.entries(FORMOSA_GEOGRAPHY)) {
    const department = await prisma.department.upsert({
      where: { name: deptName },
      update: {},
      create: { name: deptName },
    });

    for (const localityName of localities) {
      await prisma.locality.upsert({
        where: {
          name_departmentId: {
            name: localityName,
            departmentId: department.id,
          },
        },
        update: {},
        create: { name: localityName, departmentId: department.id },
      });
    }
  }
  console.log(`  ✅ Catálogo geográfico cargado`);

  // --- 2.b Mapeo zona → departamentos (R05) ---
  //
  // ⚠️⚠️ HUECO A COMPLETAR: acá va la composición real de las zonas de Formosa.
  //
  // La lista está VACÍA a propósito y no con datos inventados. `ADMIN_ZONAL` se
  // acota por `User.zone`, pero ni `Participant` ni `Team` tienen columna de
  // zona: la traducción zona → departamentos es esta tabla. Con la regla de
  // fallar cerrado, mientras esté vacía un ADMIN_ZONAL **no ve ninguna fila**,
  // que es el comportamiento seguro y el que preferimos frente a habilitar un
  // alcance adivinado.
  //
  // Para completarlo: agregar acá los pares { zone, department } —los nombres de
  // departamento tienen que coincidir con las claves de `FORMOSA_GEOGRAPHY`— y
  // volver a correr el seed. También se puede cargar en caliente por
  // `PUT /zones/:zone` (SUPER_ADMIN / ADMIN_PROVINCIAL), sin redeploy.
  //
  //   Ejemplo de la forma esperada (NO son las zonas reales):
  //   { zone: 'Zona 1', department: 'Formosa' },
  const ZONE_DEPARTMENTS: Array<{ zone: string; department: string }> = [];

  for (const { zone, department } of ZONE_DEPARTMENTS) {
    await prisma.zoneDepartment.upsert({
      where: { zone_department: { zone, department } },
      update: {},
      create: { zone, department },
    });
  }
  console.log(
    ZONE_DEPARTMENTS.length > 0
      ? `  ✅ ${ZONE_DEPARTMENTS.length} pares zona → departamento cargados`
      : '  ⚠️  Mapeo zona → departamento VACÍO: ningún ADMIN_ZONAL verá datos hasta cargarlo (ver R05)',
  );

  // --- 3. Mock Disciplines and Categories ---
  const disciplinesData = [
    {
      name: 'Fútbol 11',
      type: DisciplineType.EQUIPO,
      resultType: ResultType.GOLES,
      minPlayers: 11,
      maxPlayers: 16,
      // S21 — composición del plantel que se carga en la inscripción por equipo.
      // No es lo mismo que `minPlayers`/`maxPlayers`: ese par es el reglamento en
      // la cancha (con cuánta gente se puede jugar), este es la planilla que el
      // encargado tiene que completar. Acá coinciden en el total porque en fútbol
      // 11 coinciden; en otras disciplinas no.
      titulares: 11,
      maxSuplentes: 5,
      sortOrder: 1,
    },
    {
      name: 'Atletismo',
      type: DisciplineType.INDIVIDUAL,
      resultType: ResultType.TIEMPO,
      sortOrder: 2,
    },
    {
      name: 'Ajedrez',
      type: DisciplineType.INDIVIDUAL,
      resultType: ResultType.PUNTOS,
      sortOrder: 3,
    },
  ];

  const dbDisciplines = [];
  for (const disc of disciplinesData) {
    const discipline = await prisma.discipline.upsert({
      where: { name: disc.name },
      // S21 — el `update` deja de estar vacío sólo para el plantel. Con
      // `update: {}` una base ya sembrada nunca recibía `titulares` /
      // `maxSuplentes` y `POST /inscriptions/team` respondía "falta configurar
      // el plantel" para siempre. Los demás campos se siguen respetando: si
      // alguien los editó desde el ABM, el seed no los pisa.
      update: {
        titulares: 'titulares' in disc ? disc.titulares : null,
        maxSuplentes: 'maxSuplentes' in disc ? disc.maxSuplentes : null,
      },
      create: disc,
    });
    dbDisciplines.push(discipline);
  }
  console.log(`  ✅ ${dbDisciplines.length} Disciplinas creadas`);

  // Categories for Fútbol 11
  await prisma.category.upsert({
    where: {
      disciplineId_name: {
        disciplineId: dbDisciplines[0].id,
        name: 'Sub-14 Masculino',
      },
    },
    update: {},
    create: {
      disciplineId: dbDisciplines[0].id,
      name: 'Sub-14 Masculino',
      minAge: 12,
      maxAge: 14,
      sex: Sex.MASCULINO,
    },
  });
  await prisma.category.upsert({
    where: {
      disciplineId_name: {
        disciplineId: dbDisciplines[0].id,
        name: 'Sub-16 Femenino',
      },
    },
    update: {},
    create: {
      disciplineId: dbDisciplines[0].id,
      name: 'Sub-16 Femenino',
      minAge: 14,
      maxAge: 16,
      sex: Sex.FEMENINO,
    },
  });

  // Categories for Atletismo
  await prisma.category.upsert({
    where: {
      disciplineId_name: {
        disciplineId: dbDisciplines[1].id,
        name: 'Sub-14 Mixto',
      },
    },
    update: {},
    create: {
      disciplineId: dbDisciplines[1].id,
      name: 'Sub-14 Mixto',
      minAge: 12,
      maxAge: 14,
      sex: Sex.MIXTO,
    },
  });

  // Categories for Ajedrez
  await prisma.category.upsert({
    where: {
      disciplineId_name: {
        disciplineId: dbDisciplines[2].id,
        name: 'Libre Mixto',
      },
    },
    update: {},
    create: {
      disciplineId: dbDisciplines[2].id,
      name: 'Libre Mixto',
      minAge: 10,
      maxAge: 99,
      sex: Sex.MIXTO,
    },
  });
  console.log(`  ✅ Categorías creadas`);

  // --- 4. Mock Venues (Sedes) ---
  const venuesData = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Estadio Cincuentenario',
      address: 'Av. Antártida Argentina',
      department: 'Formosa',
      locality: 'Formosa',
      capacity: 4500,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Polideportivo Policial',
      address: 'B° 2 de Abril',
      department: 'Formosa',
      locality: 'Formosa',
      capacity: 1500,
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Club San Martín',
      address: 'José María Uriburu 1365',
      department: 'Formosa',
      locality: 'Formosa',
      capacity: 3000,
    },
  ];

  for (const v of venuesData) {
    await prisma.venue.upsert({
      where: { id: v.id },
      update: {},
      create: v,
    });
  }
  console.log(`  ✅ ${venuesData.length} Sedes creadas`);

  // --- 5. Mock News (Noticias) ---
  const newsData = [
    {
      title: '¡Comienzan los Juegos Evita 2026 en Formosa!',
      slug: 'comienzan-los-juegos-evita-2026',
      content:
        'El gobierno de la Provincia de Formosa anuncia oficialmente el inicio de la etapa local de los Juegos Evita. Todos los deportistas están invitados a participar. Las inscripciones se encuentran abiertas en todas las localidades.',
      excerpt:
        'Se lanza oficialmente la edición 2026 de los Juegos Evita en toda la provincia.',
      isPublished: true,
      publishedAt: new Date(),
    },
    {
      title: 'El Estadio Cincuentenario será la sede principal del Atletismo',
      slug: 'estadio-cincuentenario-sede-atletismo',
      content:
        'Las remodelaciones recientes en el Estadio Cincuentenario lo convierten en el escenario perfecto para las pruebas de pista y campo de esta edición. Esperamos más de 2000 atletas de todo el interior.',
      excerpt:
        'Conoce los detalles de las instalaciones deportivas preparadas para el certamen provincial.',
      isPublished: true,
      publishedAt: new Date(Date.now() - 86400000), // Ayer
    },
    {
      title: 'Cierre de inscripciones próximo',
      slug: 'cierre-inscripciones-proximo',
      content:
        'Recordamos a todos los delegados que el cierre de la etapa de inscripciones finaliza la próxima semana. Es obligatorio cargar toda la documentación requerida (DNI, Certificados Médicos) en el sistema.',
      excerpt:
        'Últimos días para completar el proceso de inscripción y carga documental.',
      isPublished: true,
      publishedAt: new Date(Date.now() - 172800000), // Hace 2 días
    },
  ];

  for (const n of newsData) {
    await prisma.news.upsert({
      where: { slug: n.slug },
      update: {},
      create: n,
    });
  }
  console.log(`  ✅ ${newsData.length} Noticias creadas`);

  // --- 6. Mock Calendar Events ---
  const eventsData = [
    {
      title: 'Acto de Apertura Zonal Formosa',
      startDate: new Date(Date.now() + 86400000 * 5),
      stage: CompetitionStage.ZONAL,
      isPublished: true,
      venueId: venuesData[0].id,
    },
    {
      title: 'Torneo Relámpago de Ajedrez',
      startDate: new Date(Date.now() + 86400000 * 10),
      isPublished: true,
      disciplineId: dbDisciplines[2].id,
      venueId: venuesData[2].id,
    },
    {
      title: 'Finales Provinciales de Fútbol 11',
      startDate: new Date(Date.now() + 86400000 * 20),
      stage: CompetitionStage.PROVINCIAL,
      isPublished: true,
      disciplineId: dbDisciplines[0].id,
      venueId: venuesData[1].id,
    },
  ];

  // Since title is not unique, we just delete existing calendar events before creating them to avoid duplicates
  await prisma.calendarEvent.deleteMany({});
  for (const ev of eventsData) {
    await prisma.calendarEvent.create({
      data: ev,
    });
  }
  console.log(`  ✅ Eventos del Calendario creados`);

  // --- 7. Mock Participants, Teams, Competition and Fixture data ---

  // Buscar la categoría Sub-14 Masculino de Fútbol 11
  const catFutbolSub14 = await prisma.category.findUnique({
    where: {
      disciplineId_name: {
        disciplineId: dbDisciplines[0].id,
        name: 'Sub-14 Masculino',
      },
    },
  });

  if (!catFutbolSub14) {
    console.error('  ❌ No se encontró la categoría Sub-14 Masculino');
    return;
  }

  // Datos de los 8 equipos con sus jugadores
  const teamsData = [
    {
      name: 'Los Pumas de Formosa',
      department: 'Formosa',
      locality: 'Formosa',
    },
    {
      name: 'Águilas de Clorinda',
      department: 'Pilcomayo',
      locality: 'Clorinda',
    },
    {
      name: 'Tigres del Bermejo',
      department: 'Bermejo',
      locality: 'Laguna Yema',
    },
    { name: 'Halcones de Pirané', department: 'Pirané', locality: 'Pirané' },
    {
      name: 'Leones de El Colorado',
      department: 'Pirané',
      locality: 'El Colorado',
    },
    {
      name: 'Cóndores de Ibarreta',
      department: 'Patiño',
      locality: 'Ibarreta',
    },
    {
      name: 'Jaguares de Las Lomitas',
      department: 'Patiño',
      locality: 'Las Lomitas',
    },
    {
      name: 'Toros de Fontana',
      department: 'Patiño',
      locality: 'Comandante Fontana',
    },
  ];

  // Nombres argentinos realistas para participantes
  const firstNames = [
    'Mateo',
    'Santiago',
    'Thiago',
    'Benjamín',
    'Lucas',
    'Bautista',
    'Lautaro',
    'Valentino',
    'Tomás',
    'Joaquín',
    'Agustín',
    'Facundo',
    'Bruno',
    'Franco',
    'Ramiro',
    'Gonzalo',
    'Nicolás',
    'Martín',
    'Sebastián',
    'Federico',
    'Ignacio',
    'Máximo',
    'Emiliano',
    'Julián',
    'Dante',
    'Gael',
    'Lorenzo',
    'Ciro',
    'Enzo',
    'Ian',
    'Simón',
    'Felipe',
    'Santino',
    'Marcos',
    'Juan',
    'Pedro',
    'Diego',
    'Manuel',
    'Alejandro',
    'Pablo',
    'Cristian',
    'Ezequiel',
    'Damián',
    'Alan',
    'Kevin',
    'Brian',
    'Jonathan',
    'Elías',
    'Máximiliano',
    'Adrián',
    'Gustavo',
    'Hugo',
    'Ricardo',
    'Abel',
    'Omar',
    'Ismael',
    'Samuel',
    'Carlos',
    'Jorge',
    'Roberto',
    'Leonardo',
    'Darío',
    'Leonel',
    'Emilio',
    'Antonio',
    'Rafael',
    'Esteban',
    'Walter',
    'Hernán',
    'Andrés',
    'Daniel',
    'Iván',
    'Rodrigo',
    'Axel',
    'Nahuel',
    'Matías',
    'Gabriel',
    'Fernando',
    'Oscar',
    'Sergio',
    'Leandro',
    'Nelson',
    'Rubén',
    'Ariel',
    'Claudio',
    'Fabián',
    'Marcelo',
    'Patricio',
    'Renzo',
    'Luciano',
    'Norberto',
    'Gerardo',
    'Aldo',
    'Néstor',
    'Alfredo',
    'Ernesto',
  ];
  const lastNames = [
    'González',
    'Rodríguez',
    'López',
    'Martínez',
    'García',
    'Fernández',
    'Pérez',
    'Romero',
    'Sosa',
    'Torres',
    'Díaz',
    'Alvarez',
    'Ruiz',
    'Ramírez',
    'Acosta',
    'Medina',
    'Herrera',
    'Suárez',
    'Aguirre',
    'Molina',
    'Castro',
    'Pereyra',
    'Cabrera',
    'Villalba',
    'Rojas',
    'Giménez',
    'Benítez',
    'Domínguez',
    'Silva',
    'Flores',
    'Morales',
    'Ortiz',
  ];

  let dniCounter = 50000000;
  const createdTeams: { id: string; name: string }[] = [];
  let totalParticipants = 0;

  for (const teamData of teamsData) {
    // Crear o buscar el equipo (unique: name + disciplineId + categoryId)
    const team = await prisma.team.upsert({
      where: {
        name_disciplineId_categoryId: {
          name: teamData.name,
          disciplineId: dbDisciplines[0].id,
          categoryId: catFutbolSub14.id,
        },
      },
      update: {},
      create: {
        name: teamData.name,
        disciplineId: dbDisciplines[0].id,
        categoryId: catFutbolSub14.id,
        locality: teamData.locality,
        department: teamData.department,
      },
    });
    createdTeams.push({ id: team.id, name: team.name });

    // Crear 13 jugadores por equipo (11 titulares + 2 suplentes)
    for (let j = 0; j < 13; j++) {
      const nameIdx = teamsData.indexOf(teamData) * 13 + j;
      const firstName = firstNames[nameIdx % firstNames.length];
      const lastName = lastNames[nameIdx % lastNames.length];
      const dni = String(dniCounter++);
      const birthYear = 2012 + Math.floor(Math.random() * 2); // 12-14 años

      const participant = await prisma.participant.upsert({
        where: { dni },
        update: {},
        create: {
          dni,
          firstName,
          lastName,
          birthDate: new Date(
            `${birthYear}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
          ),
          sex: Sex.MASCULINO,
          locality: teamData.locality,
          department: teamData.department,
        },
      });

      // Agregar como miembro del equipo
      await prisma.teamMember.upsert({
        where: {
          teamId_participantId: {
            teamId: team.id,
            participantId: participant.id,
          },
        },
        update: {},
        create: {
          teamId: team.id,
          participantId: participant.id,
          shirtNumber: j + 1,
          position:
            j === 0
              ? 'Arquero'
              : j <= 4
                ? 'Defensor'
                : j <= 8
                  ? 'Mediocampista'
                  : 'Delantero',
          isCaptain: j === 5, // El mediocampista #6 es capitán
        },
      });

      // Crear inscripción aprobada
      const qrCode = `INS-FUT14-${teamData.department.substring(0, 3).toUpperCase()}-${dni}`;
      await prisma.inscription.upsert({
        where: {
          participantId_categoryId: {
            participantId: participant.id,
            categoryId: catFutbolSub14.id,
          },
        },
        update: {},
        create: {
          participantId: participant.id,
          categoryId: catFutbolSub14.id,
          teamId: team.id,
          status: 'APROBADA',
          qrCode,
        },
      });
      totalParticipants++;
    }
  }
  console.log(
    `  ✅ ${createdTeams.length} Equipos de Fútbol 11 creados con ${totalParticipants} jugadores e inscripciones aprobadas`,
  );

  // Crear competencia en BORRADOR para probar fixture
  const compFutbol = await prisma.competition.upsert({
    where: {
      disciplineId_categoryId_stage: {
        disciplineId: dbDisciplines[0].id,
        categoryId: catFutbolSub14.id,
        stage: CompetitionStage.ZONAL,
      },
    },
    update: {
      status: CompetitionStatus.BORRADOR,
      format: CompetitionFormat.ROUND_ROBIN,
    },
    create: {
      disciplineId: dbDisciplines[0].id,
      categoryId: catFutbolSub14.id,
      stage: CompetitionStage.ZONAL,
      format: CompetitionFormat.ROUND_ROBIN,
      status: CompetitionStatus.BORRADOR,
      name: 'Torneo Zonal Fútbol Sub-14 Masculino',
      startDate: new Date(Date.now() + 86400000 * 7),
    },
  });
  // Limpiar partidos anteriores si re-ejecutamos la seed
  await prisma.result.deleteMany({
    where: { match: { competitionId: compFutbol.id } },
  });
  await prisma.match.deleteMany({ where: { competitionId: compFutbol.id } });
  console.log(
    `  ✅ Competencia "${compFutbol.name}" creada en estado BORRADOR (lista para generar fixture)`,
  );
  console.log(`     ID: ${compFutbol.id}`);
  console.log(
    `     Equipos disponibles: ${createdTeams.map((t) => t.name).join(', ')}`,
  );

  // --- 8. Datos del torneo de Ajedrez (existente) ---
  const participant1 = await prisma.participant.upsert({
    where: { dni: '40111222' },
    update: {},
    create: {
      dni: '40111222',
      firstName: 'Juan',
      lastName: 'Perez',
      birthDate: new Date('2010-05-15'),
      sex: Sex.MASCULINO,
      locality: 'Formosa',
      department: 'Formosa',
    },
  });

  const participant2 = await prisma.participant.upsert({
    where: { dni: '41222333' },
    update: {},
    create: {
      dni: '41222333',
      firstName: 'Carlos',
      lastName: 'Gomez',
      birthDate: new Date('2011-08-20'),
      sex: Sex.MASCULINO,
      locality: 'Clorinda',
      department: 'Pilcomayo',
    },
  });

  const categoryAjedrez = await prisma.category.findUnique({
    where: {
      disciplineId_name: {
        disciplineId: dbDisciplines[2].id,
        name: 'Libre Mixto',
      },
    },
  });

  if (categoryAjedrez) {
    const compAjedrez = await prisma.competition.upsert({
      where: {
        disciplineId_categoryId_stage: {
          disciplineId: dbDisciplines[2].id,
          categoryId: categoryAjedrez.id,
          stage: CompetitionStage.PROVINCIAL,
        },
      },
      update: {},
      create: {
        disciplineId: dbDisciplines[2].id,
        categoryId: categoryAjedrez.id,
        stage: CompetitionStage.PROVINCIAL,
        format: CompetitionFormat.ROUND_ROBIN,
        status: CompetitionStatus.FINALIZADA,
        name: 'Torneo Provincial de Ajedrez',
      },
    });

    await prisma.result.deleteMany({
      where: { match: { competitionId: compAjedrez.id } },
    });
    await prisma.match.deleteMany({ where: { competitionId: compAjedrez.id } });

    const matchAjedrez = await prisma.match.create({
      data: {
        competitionId: compAjedrez.id,
        venueId: venuesData[2].id,
        round: 1,
        matchNumber: 1,
        status: MatchStatus.FINALIZADO,
        scheduledAt: new Date(Date.now() - 86400000),
      },
    });

    await prisma.result.create({
      data: {
        matchId: matchAjedrez.id,
        participantId: participant1.id,
        scoreData: { points: 1 },
        ranking: 1,
        isWinner: true,
      },
    });

    await prisma.result.create({
      data: {
        matchId: matchAjedrez.id,
        participantId: participant2.id,
        scoreData: { points: 0 },
        ranking: 2,
        isWinner: false,
      },
    });
    console.log(`  ✅ Competición de Ajedrez y Resultados creados`);
  }

  // --- 9. Encuesta psicológica: borrador editable (S20) ---
  //
  // Se siembra **una sola vez**. Si ya existe una campaña con este título y año,
  // el seed la deja intacta: volver a correrlo no puede pisar las correcciones
  // que la psicóloga haya hecho desde el panel. Para volver al borrador
  // original hay que eliminar la campaña (sólo se puede si todavía no tiene
  // respuestas) y correr el seed de nuevo.
  const anioEncuesta = new Date().getFullYear();
  const encuestaExistente = await prisma.surveyCampaign.findFirst({
    where: { titulo: ENCUESTA_BORRADOR.titulo, anio: anioEncuesta },
    select: { id: true },
  });

  if (encuestaExistente) {
    console.log(
      '  ↩️  Encuesta de bienestar ya existente: se respeta lo que haya cargado el panel',
    );
  } else {
    const campania = await prisma.surveyCampaign.create({
      data: {
        titulo: ENCUESTA_BORRADOR.titulo,
        descripcion: ENCUESTA_BORRADOR.descripcion,
        anio: anioEncuesta,
        // Nace en BORRADOR: nadie puede contestarla hasta que la psicóloga
        // revise el texto y la publique.
        status: SurveyCampaignStatus.BORRADOR,
        ventana: SurveyWindow.PRE,
        createdById: admin.id,
        questions: {
          create: ENCUESTA_BORRADOR.preguntas.map((pregunta) => ({
            orden: pregunta.orden,
            texto: pregunta.texto,
            kind: pregunta.kind,
            audiencia: pregunta.audiencia,
            obligatoria: true,
            activa: true,
            options: {
              create: pregunta.opciones.map((opcion, indice) => ({
                orden: indice,
                texto: opcion.texto,
                valor: opcion.valor,
              })),
            },
          })),
        },
      },
      include: { questions: true },
    });

    console.log(
      `  ✅ Encuesta de bienestar (BORRADOR) creada con ${campania.questions.length} preguntas`,
    );
    console.log(
      '     ⚠️  El texto es un borrador del equipo de desarrollo: lo reemplaza la psicóloga desde el panel',
    );
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Para probar la generación de fixture:');
  console.log('   1. Ve a /admin/competencias');
  console.log('   2. Entrá en "Torneo Zonal Fútbol Sub-14 Masculino"');
  console.log('   3. Presioná "Generar Fixture Automático"');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
