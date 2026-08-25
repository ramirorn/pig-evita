// ===========================================
// Scope Service — el `where` territorial, en un solo lugar (R05)
// ===========================================
//
// Antes no había scoping en ninguna parte: un `DELEGADO` exportaba el padrón
// provincial completo por `/reports/participants` —con las fechas de nacimiento
// de menores adentro— y un `ADMIN_ZONAL` tenía en la práctica el mismo alcance
// que un `ADMIN_PROVINCIAL`. Los campos `zone` y `department` de `User` existían
// y no se consultaban en ninguna query.
//
// Todo el recorte vive acá y no repartido por service. El motivo no es
// estético: son cinco módulos (participants, teams, inscriptions, reports,
// documents) y la regla que decide qué ve cada rol tiene que ser una sola. Un
// `where` copiado en cinco lugares se desincroniza en el primer cambio de
// negocio, y el que quede viejo no rompe ningún test: simplemente muestra de
// más.
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Role } from '../constants';
import type { JwtPayload } from '../../modules/auth/interfaces';
import {
  Alcance,
  ALCANCE_PROVINCIAL,
  ALCANCE_VACIO,
  ROLES_ALCANCE_DEPARTAMENTAL,
  ROLES_ALCANCE_PROVINCIAL,
  ROLES_ALCANCE_ZONAL,
} from './scope.types';

/**
 * Cuánto se cachea el mapeo zona → departamentos.
 *
 * La tabla se toca a mano y muy de vez en cuando (cuando la provincia
 * reorganiza las zonas), pero se consultaría en **cada request** de un
 * `ADMIN_ZONAL`. 60 segundos acota el costo a una query por minuto por zona y
 * deja una ventana de staleness chica y explícita: un departamento agregado
 * recién se ve al minuto. Se prefirió eso a un cache sin vencimiento, que
 * obligaría a reiniciar el proceso después de editar el mapeo.
 */
const TTL_CACHE_ZONAS_MS = 60_000;

@Injectable()
export class ScopeService {
  private readonly logger = new Logger(ScopeService.name);

  /** zona (normalizada) → departamentos + momento de vencimiento. */
  private readonly cacheZonas = new Map<
    string,
    { departamentos: string[]; vence: number }
  >();

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================
  // Derivación del alcance
  // ===========================================

  /**
   * Alcance territorial del usuario del request.
   *
   * `user` es opcional porque hay endpoints alcanzables sin autenticar (el
   * guard opcional de R06) y porque un `@CurrentUser()` mal cableado devolvería
   * `undefined` sin que TypeScript lo note. Sin usuario no hay alcance:
   * `ALCANCE_VACIO`.
   */
  async alcanceDe(user?: JwtPayload | null): Promise<Alcance> {
    if (!user) return ALCANCE_VACIO;

    const role = user.role as Role;

    if (ROLES_ALCANCE_PROVINCIAL.includes(role)) {
      return ALCANCE_PROVINCIAL;
    }

    if (ROLES_ALCANCE_DEPARTAMENTAL.includes(role)) {
      const departamento = normalizar(user.department);
      if (!departamento) {
        // El caso que R05 cierra: `User.department` es nullable, así que un
        // delegado dado de alta sin departamento llegaba acá y —sin esta
        // rama— se llevaba la provincia entera.
        this.logger.warn(
          `Usuario ${user.sub} con rol ${role} no tiene departamento asignado: ` +
            'no ve ninguna fila hasta que se le cargue.',
        );
        return ALCANCE_VACIO;
      }
      return { tipo: 'DEPARTAMENTOS', departamentos: [departamento] };
    }

    if (ROLES_ALCANCE_ZONAL.includes(role)) {
      const zona = normalizar(user.zone);
      if (!zona) {
        this.logger.warn(
          `Usuario ${user.sub} con rol ${role} no tiene zona asignada: ` +
            'no ve ninguna fila hasta que se le cargue.',
        );
        return ALCANCE_VACIO;
      }
      const departamentos = await this.departamentosDeZona(zona);
      if (departamentos.length === 0) {
        this.logger.warn(
          `La zona "${zona}" no tiene departamentos mapeados en zone_departments: ` +
            'el usuario no ve ninguna fila. Cargá el mapeo para habilitarla.',
        );
      }
      return { tipo: 'DEPARTAMENTOS', departamentos };
    }

    // Rol no clasificado (ARBITRO, OPERADOR_MESA, o cualquiera que se agregue
    // mañana). `@Roles(...)` ya les cierra estos endpoints; si alguno se abriera
    // por error, acá no ven nada en vez de verlo todo.
    return ALCANCE_VACIO;
  }

  /** Departamentos de una zona, con cache corto. */
  private async departamentosDeZona(zona: string): Promise<string[]> {
    const clave = zona.toLowerCase();
    const cacheado = this.cacheZonas.get(clave);
    if (cacheado && cacheado.vence > Date.now()) {
      return cacheado.departamentos;
    }

    const filas = await this.prisma.zoneDepartment.findMany({
      where: { zone: { equals: zona, mode: Prisma.QueryMode.insensitive } },
      select: { department: true },
      orderBy: { department: 'asc' },
    });

    const departamentos = filas.map((f) => f.department);
    this.cacheZonas.set(clave, {
      departamentos,
      vence: Date.now() + TTL_CACHE_ZONAS_MS,
    });
    return departamentos;
  }

  /** Vacía el cache. Lo llama el módulo de zonas al editar el mapeo. */
  invalidarCacheDeZonas(): void {
    this.cacheZonas.clear();
  }

  // ===========================================
  // Fragmentos de `where`
  // ===========================================

  /**
   * Filtro por departamento sobre una entidad que tiene la columna al lado
   * (`Participant`, `Team`).
   *
   * Se compara con `equals` + `mode: 'insensitive'` dentro de un `OR` y no con
   * `{ in: [...] }`: la comparación tiene que ignorar mayúsculas —"Pilcomayo" y
   * "PILCOMAYO" son el mismo departamento y los datos se cargan a mano—, y
   * `mode` aplicado sobre `in` no está garantizado por Prisma.
   *
   * El alcance vacío se expresa como `{ in: [] }`, que Prisma traduce a una
   * condición siempre falsa. No se usa `OR: []` porque un `OR` vacío es un caso
   * borde donde no quiero que la seguridad dependa de una sutileza del
   * generador de SQL.
   */
  private filtroDepartamento(alcance: Alcance): Prisma.ParticipantWhereInput {
    if (alcance.tipo === 'PROVINCIAL') return {};
    if (alcance.departamentos.length === 0) {
      return { department: { in: [] } };
    }
    return {
      OR: alcance.departamentos.map((departamento) => ({
        department: {
          equals: departamento,
          mode: Prisma.QueryMode.insensitive,
        },
      })),
    };
  }

  whereParticipant(alcance: Alcance): Prisma.ParticipantWhereInput {
    return this.filtroDepartamento(alcance);
  }

  whereTeam(alcance: Alcance): Prisma.TeamWhereInput {
    return this.filtroDepartamento(alcance) as Prisma.TeamWhereInput;
  }

  /**
   * Inscripciones: el departamento vive en el participante.
   *
   * Se acota por el participante y no por `createdById` a propósito: dos
   * delegados del mismo departamento tienen que poder trabajar sobre las mismas
   * inscripciones.
   */
  whereInscription(alcance: Alcance): Prisma.InscriptionWhereInput {
    if (alcance.tipo === 'PROVINCIAL') return {};
    return { participant: this.whereParticipant(alcance) };
  }

  /** Documentos: el departamento también vive en el participante. */
  whereDocument(alcance: Alcance): Prisma.DocumentWhereInput {
    if (alcance.tipo === 'PROVINCIAL') return {};
    return { participant: this.whereParticipant(alcance) };
  }

  // ===========================================
  // Chequeo para las escrituras
  // ===========================================

  /**
   * ¿El alcance incluye a este departamento?
   *
   * Se usa en las altas, donde no hay `where` que aplicar: el departamento lo
   * manda el cliente en el body. Acá sí corresponde 403 y no 404 —no se está
   * preguntando por la existencia de ninguna fila, así que no hay nada que
   * filtrar— y además conviene: el delegado tiene que enterarse de por qué no
   * puede cargar al chico, no recibir un error mudo.
   */
  permiteDepartamento(alcance: Alcance, departamento?: string | null): boolean {
    if (alcance.tipo === 'PROVINCIAL') return true;
    const limpio = normalizar(departamento);
    if (!limpio) return false;
    return alcance.departamentos.some(
      (d) => d.toLowerCase() === limpio.toLowerCase(),
    );
  }

  /**
   * Pega el filtro del cliente y el del alcance sin que uno pise al otro.
   *
   * Van juntos bajo `AND` y no fusionados campo a campo porque los dos pueden
   * traer `OR` (el buscador por nombre/DNI de un lado, la lista de
   * departamentos del otro) y un `Object.assign` haría que el último gane. Con
   * `AND` la única forma de que una fila salga es que pase los dos.
   */
  static conAlcance<T extends object>(filtroCliente: T, filtroAlcance: T): T {
    return { AND: [filtroCliente, filtroAlcance] } as T;
  }
}

/** Recorta espacios y descarta cadenas vacías o nulas. */
function normalizar(valor?: string | null): string | null {
  const limpio = (valor ?? '').trim();
  return limpio.length > 0 ? limpio : null;
}
