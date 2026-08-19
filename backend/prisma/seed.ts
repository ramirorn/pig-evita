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

  // --- 3. Mock Disciplines and Categories ---
  const disciplinesData = [
    {
      name: 'Fútbol 11',
      type: DisciplineType.EQUIPO,
      resultType: ResultType.GOLES,
      minPlayers: 11,
      maxPlayers: 16,
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
      update: {},
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
