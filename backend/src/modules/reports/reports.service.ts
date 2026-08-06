import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import * as ExcelJS from 'exceljs';

export interface ParticipantReportFilters {
  disciplineId?: string;
  categoryId?: string;
  locality?: string;
  department?: string;
}

export interface TeamReportFilters {
  disciplineId?: string;
  categoryId?: string;
  locality?: string;
  department?: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async createStyledWorkbook(
    sheetName: string,
    headers: string[],
    rows: any[][],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Juegos Evita Formosa';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // Add header row
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
        name: 'Calibri',
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F4C81' }, // Primary blue Evita
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0A3560' } },
        left: { style: 'thin', color: { argb: 'FF0A3560' } },
        bottom: { style: 'medium', color: { argb: 'FF041A33' } },
        right: { style: 'thin', color: { argb: 'FF0A3560' } },
      };
    });

    // Add data rows
    rows.forEach((rowValues, idx) => {
      const row = worksheet.addRow(rowValues);
      row.height = 22;
      const isEven = idx % 2 === 1;
      row.eachCell((cell) => {
        cell.font = { size: 10, name: 'Calibri' };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    // Auto-fit column widths
    worksheet.columns.forEach((column) => {
      let maxLength = 10;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const val = cell.value ? String(cell.value) : '';
        if (val.length > maxLength) maxLength = val.length;
      });
      column.width = Math.min(Math.max(maxLength + 4, 12), 40);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ===========================================
  // PARTICIPANTS
  // ===========================================
  private async getParticipantsData(filters?: ParticipantReportFilters) {
    const where: Prisma.ParticipantWhereInput = {};

    if (filters?.department) {
      where.department = { contains: filters.department, mode: 'insensitive' };
    }

    if (filters?.locality) {
      where.locality = { contains: filters.locality, mode: 'insensitive' };
    }

    if (filters?.disciplineId || filters?.categoryId) {
      where.inscriptions = {
        some: {
          ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
          ...(filters.disciplineId
            ? { category: { disciplineId: filters.disciplineId } }
            : {}),
        },
      };
    }

    const participants = await this.prisma.participant.findMany({
      where,
      include: {
        inscriptions: {
          include: { category: { include: { discipline: true } } },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const headers = [
      'DNI',
      'Nombre',
      'Apellido',
      'Sexo',
      'Fecha Nacimiento',
      'Departamento',
      'Localidad',
      'Teléfono',
      'Email',
      'Categorías',
    ];

    const rows = participants.map((p) => {
      const categoriesStr = p.inscriptions
        .map((i) => `${i.category.discipline.name} - ${i.category.name}`)
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
        categoriesStr,
      ];
    });

    return { headers, rows };
  }

  async generateParticipantsCsv(
    filters?: ParticipantReportFilters,
  ): Promise<string> {
    const { headers, rows } = await this.getParticipantsData(filters);
    return [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');
  }

  async generateParticipantsExcel(
    filters?: ParticipantReportFilters,
  ): Promise<Buffer> {
    const { headers, rows } = await this.getParticipantsData(filters);
    return this.createStyledWorkbook('Padrón Participantes', headers, rows);
  }

  // ===========================================
  // INSCRIPTIONS
  // ===========================================
  private async getInscriptionsData(
    disciplineId?: string,
    categoryId?: string,
    status?: string,
  ) {
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

    const headers = [
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

    const rows = inscriptions.map((i) => [
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

    return { headers, rows };
  }

  async generateInscriptionsCsv(
    disciplineId?: string,
    categoryId?: string,
    status?: string,
  ): Promise<string> {
    const { headers, rows } = await this.getInscriptionsData(
      disciplineId,
      categoryId,
      status,
    );
    return [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');
  }

  async generateInscriptionsExcel(
    disciplineId?: string,
    categoryId?: string,
    status?: string,
  ): Promise<Buffer> {
    const { headers, rows } = await this.getInscriptionsData(
      disciplineId,
      categoryId,
      status,
    );
    return this.createStyledWorkbook('Inscripciones', headers, rows);
  }

  // ===========================================
  // TEAMS
  // ===========================================
  private async getTeamsData(filters?: TeamReportFilters) {
    const where: Prisma.TeamWhereInput = {};

    if (filters?.disciplineId) {
      where.disciplineId = filters.disciplineId;
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.department) {
      where.department = { contains: filters.department, mode: 'insensitive' };
    }

    if (filters?.locality) {
      where.locality = { contains: filters.locality, mode: 'insensitive' };
    }

    const teams = await this.prisma.team.findMany({
      where,
      include: {
        category: { include: { discipline: true } },
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    });

    const headers = [
      'ID Equipo',
      'Nombre',
      'Disciplina',
      'Categoría',
      'Departamento',
      'Localidad',
      'Cantidad Miembros',
    ];

    const rows = teams.map((t) => [
      t.id,
      t.name,
      t.category.discipline.name,
      t.category.name,
      t.department,
      t.locality,
      t._count.members,
    ]);

    return { headers, rows };
  }

  async generateTeamsCsv(filters?: TeamReportFilters): Promise<string> {
    const { headers, rows } = await this.getTeamsData(filters);
    return [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');
  }

  async generateTeamsExcel(filters?: TeamReportFilters): Promise<Buffer> {
    const { headers, rows } = await this.getTeamsData(filters);
    return this.createStyledWorkbook('Equipos', headers, rows);
  }

  // ===========================================
  // RESULTS & FIXTURE
  // ===========================================
  private async getResultsData(competitionId?: string) {
    const where: any = {};
    if (competitionId) where.competitionId = competitionId;

    const matches = await this.prisma.match.findMany({
      where,
      include: {
        competition: {
          include: { discipline: true, category: true },
        },
        venue: true,
        results: {
          include: { team: true, participant: true },
        },
      },
      orderBy: [
        { competition: { name: 'asc' } },
        { round: 'asc' },
        { matchNumber: 'asc' },
      ],
    });

    const headers = [
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

    const rows = matches.map((m) => {
      const r1 = m.results[0];
      const r2 = m.results[1];
      const homeName =
        r1?.team?.name ||
        (r1?.participant
          ? `${r1.participant.lastName}, ${r1.participant.firstName}`
          : '-');
      const awayName =
        r2?.team?.name ||
        (r2?.participant
          ? `${r2.participant.lastName}, ${r2.participant.firstName}`
          : '-');
      const homeScore =
        r1?.scoreData && Object.values(r1.scoreData)[0] !== undefined
          ? String(Object.values(r1.scoreData)[0])
          : '-';
      const awayScore =
        r2?.scoreData && Object.values(r2.scoreData)[0] !== undefined
          ? String(Object.values(r2.scoreData)[0])
          : '-';

      let winnerName = '-';
      if (r1?.isWinner) winnerName = homeName;
      else if (r2?.isWinner) winnerName = awayName;

      return [
        m.competition.name ||
          `${m.competition.discipline.name} - ${m.competition.category.name}`,
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

    return { headers, rows };
  }

  async generateResultsCsv(competitionId?: string): Promise<string> {
    const { headers, rows } = await this.getResultsData(competitionId);
    return [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');
  }

  async generateResultsExcel(competitionId?: string): Promise<Buffer> {
    const { headers, rows } = await this.getResultsData(competitionId);
    return this.createStyledWorkbook('Resultados y Partidos', headers, rows);
  }
}
