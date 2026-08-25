// ===========================================
// Zones Service — administración del mapeo zona → departamentos (R05)
// ===========================================
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ScopeService } from '../../common/scope';

@Injectable()
export class ZonesService {
  private readonly logger = new Logger(ZonesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  /** Todas las zonas con sus departamentos, ordenadas alfabéticamente. */
  async findAll(): Promise<Array<{ zone: string; departments: string[] }>> {
    const filas = await this.prisma.zoneDepartment.findMany({
      orderBy: [{ zone: 'asc' }, { department: 'asc' }],
      select: { zone: true, department: true },
    });

    const porZona = new Map<string, string[]>();
    for (const fila of filas) {
      const actual = porZona.get(fila.zone) ?? [];
      actual.push(fila.department);
      porZona.set(fila.zone, actual);
    }

    return [...porZona.entries()].map(([zone, departments]) => ({
      zone,
      departments,
    }));
  }

  async findOne(zone: string) {
    const departments = await this.prisma.zoneDepartment.findMany({
      where: { zone },
      orderBy: { department: 'asc' },
      select: { department: true },
    });

    if (departments.length === 0) {
      throw new NotFoundException(
        `La zona "${zone}" no tiene departamentos cargados`,
      );
    }

    return { zone, departments: departments.map((d) => d.department) };
  }

  /**
   * Reemplaza la composición completa de una zona.
   *
   * Es un PUT y no un POST incremental porque "qué departamentos tiene esta
   * zona" es un dato que se decide entero: cargarlo de a uno deja estados
   * intermedios en los que la zona ya existe pero le faltan departamentos, y
   * alguien con ese alcance ve la mitad de lo que debería sin que nada lo
   * indique.
   */
  async replace(zone: string, departments: string[]) {
    const limpios = [
      ...new Set(departments.map((d) => d.trim()).filter(Boolean)),
    ];

    if (limpios.length === 0) {
      throw new BadRequestException(
        'La zona tiene que tener al menos un departamento. ' +
          'Para dejarla sin alcance, borrala con DELETE.',
      );
    }

    // Se valida contra el catálogo `departments` para que un typo no cree una
    // zona que después no matchea ninguna fila: el usuario zonal vería una
    // pantalla vacía y no habría forma de distinguirlo de "no hay datos".
    const existentes = await this.prisma.department.findMany({
      where: { name: { in: limpios } },
      select: { name: true },
    });
    const conocidos = new Set(existentes.map((d) => d.name));
    const desconocidos = limpios.filter((d) => !conocidos.has(d));

    if (desconocidos.length > 0) {
      throw new BadRequestException(
        `Departamentos que no existen en el catálogo: ${desconocidos.join(', ')}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.zoneDepartment.deleteMany({ where: { zone } }),
      this.prisma.zoneDepartment.createMany({
        data: limpios.map((department) => ({ zone, department })),
      }),
    ]);

    // El alcance de los usuarios de esta zona cambió: el cache de 60s no puede
    // seguir devolviendo la composición vieja después de una edición explícita.
    this.scope.invalidarCacheDeZonas();
    this.logger.log(
      `Zona "${zone}" mapeada a ${limpios.length} departamento(s): ${limpios.join(', ')}`,
    );

    return { zone, departments: limpios };
  }

  async remove(zone: string) {
    const { count } = await this.prisma.zoneDepartment.deleteMany({
      where: { zone },
    });

    if (count === 0) {
      throw new NotFoundException(
        `La zona "${zone}" no tiene departamentos cargados`,
      );
    }

    this.scope.invalidarCacheDeZonas();
    this.logger.warn(
      `Zona "${zone}" borrada del mapeo: sus usuarios dejan de ver datos hasta que se recargue`,
    );
    return { message: `Zona "${zone}" eliminada del mapeo`, eliminados: count };
  }
}
