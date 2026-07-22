// ===========================================
// Prisma Seed - Datos Iniciales
// ===========================================
import { PrismaClient, UserRole, Sex, DisciplineType, ResultType, CompetitionStage, CompetitionFormat, CompetitionStatus, MatchStatus } from '@prisma/client';
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
  'Formosa': ['Formosa', 'Gran Guardia', 'Mariano Boedo', 'Mojón de Fierro', 'San Hilario', 'Villa del Carmen'],
  'Laishí': ['Herradura', 'Tatané', 'Villa Escolar', 'San Francisco de Laishí', 'Colonia Aquino'],
  'Pirané': ['Pirané', 'El Colorado', 'Colonia Campo Villafañe', 'Mayor Vicente Villafañe', 'Palo Santo'],
  'Pilagás': ['Clorinda', 'Laguna Naick Neck', 'Puerto Pilcomayo', 'Siete Palmas', 'Riacho He-Hé'],
  'Bermejo': ['Laguna Yema', 'Los Chiriguanos', 'Pozo de Maza', 'Guadalcázar', 'Lamadrid'],
  'Matacos': ['Ingeniero Juárez', 'General Mosconi'],
  'Ramón Lista': ['General E. Mosconi', 'El Potrillo'],
  'Patiño': ['Comandante Fontana', 'Ibarreta', 'Estanislao del Campo', 'Las Lomitas', 'Pozo del Tigre', 'Subteniente Perín', 'Villa General Güemes'],
  'Pilcomayo': ['Clorinda', 'Laguna Blanca', 'Misión Tacaaglé', 'Buena Vista', 'Palma Sola', 'Riacho He-Hé', 'El Espinillo', 'General Belgrano', 'Tres Lagunas'],
};

async function main() {
  console.log('🌱 Seeding database with comprehensive mock data...');

  // --- 1. Crear Super Admin ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@juegosevita.gob.ar';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!@#';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const passwordHash = await argon2.hash(adminPassword);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: 'Super',
        lastName: 'Administrador',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    console.log(`  ✅ Super Admin creado: ${adminEmail}`);
  } else {
    console.log(`  ⏭️  Super Admin ya existe: ${adminEmail}`);
  }

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
          name_departmentId: { name: localityName, departmentId: department.id },
        },
        update: {},
        create: { name: localityName, departmentId: department.id },
      });
    }
  }
  console.log(`  ✅ Catálogo geográfico cargado`);

  // --- 3. Mock Disciplines and Categories ---
  const disciplinesData = [
    { name: 'Fútbol 11', type: DisciplineType.EQUIPO, resultType: ResultType.GOLES, minPlayers: 11, maxPlayers: 16, sortOrder: 1 },
    { name: 'Atletismo', type: DisciplineType.INDIVIDUAL, resultType: ResultType.TIEMPO, sortOrder: 2 },
    { name: 'Ajedrez', type: DisciplineType.INDIVIDUAL, resultType: ResultType.PUNTOS, sortOrder: 3 },
  ];

  const dbDisciplines = [];
  for (const disc of disciplinesData) {
    const discipline = await prisma.discipline.upsert({
      where: { name: disc.name },
      update: {},
      create: disc,
    });
    dbDisciplines.push(discipline);
  }
  console.log(`  ✅ ${dbDisciplines.length} Disciplinas creadas`);

  // Categories for Fútbol 11
  await prisma.category.upsert({
    where: { disciplineId_name: { disciplineId: dbDisciplines[0].id, name: 'Sub-14 Masculino' } },
    update: {},
    create: { disciplineId: dbDisciplines[0].id, name: 'Sub-14 Masculino', minAge: 12, maxAge: 14, sex: Sex.MASCULINO },
  });
  await prisma.category.upsert({
    where: { disciplineId_name: { disciplineId: dbDisciplines[0].id, name: 'Sub-16 Femenino' } },
    update: {},
    create: { disciplineId: dbDisciplines[0].id, name: 'Sub-16 Femenino', minAge: 14, maxAge: 16, sex: Sex.FEMENINO },
  });

  // Categories for Atletismo
  await prisma.category.upsert({
    where: { disciplineId_name: { disciplineId: dbDisciplines[1].id, name: 'Sub-14 Mixto' } },
    update: {},
    create: { disciplineId: dbDisciplines[1].id, name: 'Sub-14 Mixto', minAge: 12, maxAge: 14, sex: Sex.MIXTO },
  });

  // Categories for Ajedrez
  await prisma.category.upsert({
    where: { disciplineId_name: { disciplineId: dbDisciplines[2].id, name: 'Libre Mixto' } },
    update: {},
    create: { disciplineId: dbDisciplines[2].id, name: 'Libre Mixto', minAge: 10, maxAge: 99, sex: Sex.MIXTO },
  });
  console.log(`  ✅ Categorías creadas`);

  // --- 4. Mock Venues (Sedes) ---
  const venuesData = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Estadio Cincuentenario', address: 'Av. Antártida Argentina', department: 'Formosa', locality: 'Formosa', capacity: 4500 },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Polideportivo Policial', address: 'B° 2 de Abril', department: 'Formosa', locality: 'Formosa', capacity: 1500 },
    { id: '33333333-3333-3333-3333-333333333333', name: 'Club San Martín', address: 'José María Uriburu 1365', department: 'Formosa', locality: 'Formosa', capacity: 3000 },
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
      content: 'El gobierno de la Provincia de Formosa anuncia oficialmente el inicio de la etapa local de los Juegos Evita. Todos los deportistas están invitados a participar. Las inscripciones se encuentran abiertas en todas las localidades.',
      excerpt: 'Se lanza oficialmente la edición 2026 de los Juegos Evita en toda la provincia.',
      isPublished: true,
      publishedAt: new Date(),
    },
    {
      title: 'El Estadio Cincuentenario será la sede principal del Atletismo',
      slug: 'estadio-cincuentenario-sede-atletismo',
      content: 'Las remodelaciones recientes en el Estadio Cincuentenario lo convierten en el escenario perfecto para las pruebas de pista y campo de esta edición. Esperamos más de 2000 atletas de todo el interior.',
      excerpt: 'Conoce los detalles de las instalaciones deportivas preparadas para el certamen provincial.',
      isPublished: true,
      publishedAt: new Date(Date.now() - 86400000), // Ayer
    },
    {
      title: 'Cierre de inscripciones próximo',
      slug: 'cierre-inscripciones-proximo',
      content: 'Recordamos a todos los delegados que el cierre de la etapa de inscripciones finaliza la próxima semana. Es obligatorio cargar toda la documentación requerida (DNI, Certificados Médicos) en el sistema.',
      excerpt: 'Últimos días para completar el proceso de inscripción y carga documental.',
      isPublished: true,
      publishedAt: new Date(Date.now() - 172800000), // Hace 2 días
    }
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
    { title: 'Acto de Apertura Zonal Formosa', startDate: new Date(Date.now() + 86400000 * 5), stage: CompetitionStage.ZONAL, isPublished: true, venueId: venuesData[0].id },
    { title: 'Torneo Relámpago de Ajedrez', startDate: new Date(Date.now() + 86400000 * 10), isPublished: true, disciplineId: dbDisciplines[2].id, venueId: venuesData[2].id },
    { title: 'Finales Provinciales de Fútbol 11', startDate: new Date(Date.now() + 86400000 * 20), stage: CompetitionStage.PROVINCIAL, isPublished: true, disciplineId: dbDisciplines[0].id, venueId: venuesData[1].id },
  ];

  // Since title is not unique, we just delete existing calendar events before creating them to avoid duplicates
  await prisma.calendarEvent.deleteMany({});
  for (const ev of eventsData) {
    await prisma.calendarEvent.create({
      data: ev,
    });
  }
  console.log(`  ✅ Eventos del Calendario creados`);

  // --- 7. Mock Participants, Teams and Results (Rankings) ---
  const participant1 = await prisma.participant.upsert({
    where: { dni: '40111222' },
    update: {},
    create: { dni: '40111222', firstName: 'Juan', lastName: 'Perez', birthDate: new Date('2010-05-15'), sex: Sex.MASCULINO, locality: 'Formosa', department: 'Formosa' }
  });

  const participant2 = await prisma.participant.upsert({
    where: { dni: '41222333' },
    update: {},
    create: { dni: '41222333', firstName: 'Carlos', lastName: 'Gomez', birthDate: new Date('2011-08-20'), sex: Sex.MASCULINO, locality: 'Clorinda', department: 'Pilcomayo' }
  });

  const categoryAjedrez = await prisma.category.findUnique({ where: { disciplineId_name: { disciplineId: dbDisciplines[2].id, name: 'Libre Mixto' } } });
  
  if (categoryAjedrez) {
    const compAjedrez = await prisma.competition.upsert({
      where: { disciplineId_categoryId_stage: { disciplineId: dbDisciplines[2].id, categoryId: categoryAjedrez.id, stage: CompetitionStage.PROVINCIAL } },
      update: {},
      create: {
        disciplineId: dbDisciplines[2].id,
        categoryId: categoryAjedrez.id,
        stage: CompetitionStage.PROVINCIAL,
        format: CompetitionFormat.ROUND_ROBIN,
        status: CompetitionStatus.FINALIZADA,
        name: 'Torneo Provincial de Ajedrez',
      }
    });

    // We must use findFirst or similar to check if match already exists or clean results
    await prisma.result.deleteMany({ where: { match: { competitionId: compAjedrez.id } } });
    await prisma.match.deleteMany({ where: { competitionId: compAjedrez.id } });

    const matchAjedrez = await prisma.match.create({
      data: {
        competitionId: compAjedrez.id,
        venueId: venuesData[2].id,
        round: 1,
        matchNumber: 1,
        status: MatchStatus.FINALIZADO,
        scheduledAt: new Date(Date.now() - 86400000),
      }
    });

    await prisma.result.create({
      data: {
        matchId: matchAjedrez.id,
        participantId: participant1.id,
        scoreData: { points: 1 },
        ranking: 1,
        isWinner: true,
      }
    });

    await prisma.result.create({
      data: {
        matchId: matchAjedrez.id,
        participantId: participant2.id,
        scoreData: { points: 0 },
        ranking: 2,
        isWinner: false,
      }
    });
    console.log(`  ✅ Competición, Partido y Resultados (Rankings) creados`);
  }

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
