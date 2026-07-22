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
    });

    const header = ['DNI', 'Nombre', 'Apellido', 'Sexo', 'Fecha Nacimiento', 'Email', 'Categorías'];
    
    const rows = participants.map(p => {
      const categoriesStr = p.inscriptions
        .map(i => `${i.category.discipline.name} - ${i.category.name}`)
        .join(' | ');
        
      return [
        p.dni,
        p.firstName,
        p.lastName,
        p.sex,
        p.birthDate.toISOString().split('T')[0],
        p.email || '',
        categoriesStr
      ];
    });

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
}
