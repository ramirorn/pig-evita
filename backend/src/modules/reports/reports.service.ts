// ===========================================
// Reports Service
// ===========================================
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateParticipantsCsv(categoryId?: string): Promise<string> {
    const whereClause = categoryId ? { inscriptions: { some: { categoryId } } } : {};
    
    const participants = await this.prisma.participant.findMany({
      where: whereClause,
      include: {
        inscriptions: { include: { category: { include: { discipline: true } } } }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const header = ['DNI', 'Nombre', 'Apellido', 'Sexo', 'Fecha Nacimiento', 'Departamento', 'Localidad', 'Teléfono', 'Email', 'Categorías'];
    
    const rows = participants.map(p => {
      const categoriesStr = p.inscriptions
        .map(i => `${i.category.discipline.name} - ${i.category.name}`)
        .join(' | ');
        
      return [
        p.dni,
        p.firstName,
        p.lastName,
        p.sex,
        p.birthDate ? p.birthDate.toISOString().split('T')[0] : '',
        p.department,
        p.locality,
        p.phone || '',
        p.email || '',
        categoriesStr
      ];
    });

    return [header, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  async generateInscriptionsCsv(disciplineId?: string, categoryId?: string, status?: string): Promise<string> {
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (disciplineId) {
      where.category = { disciplineId };
    }

    const inscriptions = await this.prisma.inscription.findMany({
      where,
      include: {
        participant: true,
        category: { include: { discipline: true } },
        team: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = [
      'Código QR',
      'DNI Participante',
      'Nombre',
      'Apellido',
      'Sexo',
      'Disciplina',
      'Categoría',
      'Equipo',
      'Departamento',
      'Localidad',
      'Estado',
      'Fecha Inscripción',
    ];

    const rows = inscriptions.map(i => [
      i.qrCode,
      i.participant.dni,
      i.participant.firstName,
      i.participant.lastName,
      i.participant.sex,
      i.category.discipline.name,
      i.category.name,
      i.team?.name || 'Individual',
      i.participant.department,
      i.participant.locality,
      i.status,
      i.createdAt ? i.createdAt.toISOString().split('T')[0] : '',
    ]);

    return [header, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  async generateTeamsCsv(disciplineId?: string): Promise<string> {
    const whereClause = disciplineId ? { category: { disciplineId } } : {};

    const teams = await this.prisma.team.findMany({
      where: whereClause,
      include: {
        category: { include: { discipline: true } },
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    });

    const header = ['ID Equipo', 'Nombre', 'Disciplina', 'Categoría', 'Departamento', 'Localidad', 'Cantidad Miembros'];

    const rows = teams.map(t => [
      t.id,
      t.name,
      t.category.discipline.name,
      t.category.name,
      t.department,
      t.locality,
      t._count.members
    ]);

    return [header, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  async generateResultsCsv(competitionId?: string): Promise<string> {
    const where: any = {};
    if (competitionId) where.competitionId = competitionId;

    const matches = await this.prisma.match.findMany({
      where,
      include: {
        competition: {
          include: { discipline: true, category: true }
        },
        venue: true,
        results: {
          include: { team: true, participant: true }
        },
      },
      orderBy: [
        { competition: { name: 'asc' } },
        { round: 'asc' },
        { matchNumber: 'asc' },
      ],
    });

    const header = [
      'Competencia',
      'Disciplina',
      'Categoría',
      'Etapa',
      'Fecha / Ronda',
      'Partido N°',
      'Estado',
      'Local',
      'Puntaje Local',
      'Visitante',
      'Puntaje Visitante',
      'Ganador',
      'Sede',
    ];

    const rows = matches.map(m => {
      const r1 = m.results[0];
      const r2 = m.results[1];
      const homeName = r1?.team?.name || (r1?.participant ? `${r1.participant.lastName}, ${r1.participant.firstName}` : '-');
      const awayName = r2?.team?.name || (r2?.participant ? `${r2.participant.lastName}, ${r2.participant.firstName}` : '-');
      const homeScore = r1?.scoreData && Object.values(r1.scoreData)[0] !== undefined ? String(Object.values(r1.scoreData)[0]) : '-';
      const awayScore = r2?.scoreData && Object.values(r2.scoreData)[0] !== undefined ? String(Object.values(r2.scoreData)[0]) : '-';
      
      let winnerName = '-';
      if (r1?.isWinner) winnerName = homeName;
      else if (r2?.isWinner) winnerName = awayName;

      return [
        m.competition.name || `${m.competition.discipline.name} - ${m.competition.category.name}`,
        m.competition.discipline.name,
        m.competition.category.name,
        m.competition.stage,
        `Fecha ${m.round}`,
        m.matchNumber,
        m.status,
        homeName,
        homeScore,
        awayName,
        awayScore,
        winnerName,
        m.venue?.name || '-',
      ];
    });

    return [header, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  }
}

