// ===========================================
// Localities Service — catálogo territorial
// ===========================================
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { zonaDeLocalidad } from '../../common/constants';
import type { DepartmentWithLocalitiesDto } from './dto';

/**
 * Catálogo de departamentos y localidades de la provincia, tal como está
 * cargado en la base (`seed.ts` lo puebla). Es lo que faltaba para que el
 * formulario público de la encuesta pueda pedir la localidad con un selector
 * en vez de un campo libre que produce "Formosa", "formosa" y "Fsa" como tres
 * cortes distintos.
 */
@Injectable()
export class LocalitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<DepartmentWithLocalitiesDto[]> {
    const departamentos = await this.prisma.department.findMany({
      select: {
        id: true,
        name: true,
        localities: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return departamentos.map((d) => ({
      id: d.id,
      name: d.name,
      localities: d.localities.map((l) => ({
        id: l.id,
        name: l.name,
        zona: zonaDeLocalidad(l.name, d.name),
      })),
    }));
  }
}
