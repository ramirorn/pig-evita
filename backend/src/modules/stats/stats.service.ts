// ===========================================
// Stats Service — participación agregada por localidad
// ===========================================
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InscriptionStatus, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { LocalitiesStatsDto, LocalityStatsDto } from './dto';

/**
 * Nombre legible de una localidad: espacios internos colapsados y sin espacios
 * en los bordes. `[[:space:]]` y no `\s` porque esto viaja dentro de un
 * template literal de JS, donde `\s` se come la barra y queda una `s` suelta.
 *
 * Recibe **sólo** nombres de columna escritos en este archivo (nunca input del
 * usuario), por eso es seguro armarlo con `Prisma.raw`.
 */
const limpio = (columna: string) =>
  Prisma.raw(`btrim(regexp_replace(${columna}, '[[:space:]]+', ' ', 'g'))`);

/**
 * Clave de agrupación a partir de un nombre ya `limpio`: sin tildes y en
 * minúsculas. "Clorinda ", "clorinda" y "CLORINDA" caen en la misma clave; lo
 * mismo "Laguna Blanca" y "Laguna  blanca". Se quitan las tildes de las vocales
 * con `translate` (no hace falta la extensión `unaccent`, que no está instalada)
 * y se dejan las ñ: "Ñeembucú" y "Neembucu" no son el mismo lugar.
 *
 * Las mayúsculas acentuadas se traducen antes de `lower` porque con collation
 * `C` Postgres no pasa a minúscula los caracteres fuera de ASCII.
 */
const clave = (columna: string) =>
  Prisma.raw(`lower(translate(${columna}, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUaeiouu'))`);

/** Fila cruda de la consulta agregada: ya viene con un registro por localidad. */
interface FilaLocalidad {
  locality: string;
  department: string;
  athletes: number;
  delegations: number;
  disciplines: number;
  categories: number;
  first: number;
  second: number;
  third: number;
  wins: number;
}

@Injectable()
export class StatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StatsService.name);
  private redisClient: Redis | null = null;

  /**
   * Clave única y global, a diferencia de la del dashboard (S02): este endpoint
   * es público y devuelve **lo mismo para todo el mundo** —no hay alcance
   * territorial que recortar—, así que una sola entrada es correcta.
   */
  private readonly CLAVE_CACHE = 'stats:localities';

  /**
   * 60s, el mismo criterio que el dashboard: durante una jornada de
   * competencia los podios cambian partido a partido y el mapa no puede quedar
   * minutos atrasado, pero un minuto alcanza para absorber la ráfaga de un
   * sitio público con mucho tráfico (la consulta recorre inscripciones y
   * resultados de toda la provincia).
   */
  private readonly CACHE_TTL_SECONDS = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    try {
      const host = this.configService.get<string>('redis.host', 'localhost');
      const port = this.configService.get<number>('redis.port', 6379);
      const password = this.configService.get<string>('redis.password');

      this.redisClient = new Redis({ host, port, password, lazyConnect: true });

      this.redisClient.on('error', (err) => {
        this.logger.warn(
          `Redis connection error: ${err.message}. Locality stats will fallback to direct DB queries without cache.`,
        );
      });

      // Conexión en background: si Redis no está, el endpoint sigue andando.
      this.redisClient.connect().catch(() => {});
    } catch {
      this.logger.warn(
        'Failed to initialize Redis client for locality stats. Using DB fallback.',
      );
    }
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }

  /**
   * Participación de cada localidad, para el mapa de calor público.
   *
   * Definiciones (las mismas que publica Swagger):
   *
   * - **Inscripción vigente**: toda la que no está `RECHAZADA` (PENDIENTE,
   *   REVISADA y APROBADA). Ojo: el dashboard (`DashboardService`) no filtra
   *   por estado —cuenta todas las inscripciones y todos los participantes
   *   cargados—, pero en un mapa público una inscripción rechazada no es
   *   participación, así que acá se excluye.
   * - **Atleta**: `Participant` distinto con al menos una inscripción vigente,
   *   atribuido por `Participant.locality`. Un integrante de un equipo de otra
   *   localidad suma en la suya.
   * - **Delegación**: la unidad con la que una localidad se presenta a
   *   competir en una categoría. En las disciplinas de equipo es el `Team`
   *   (activo y con al menos una inscripción vigente), atribuido por
   *   `Team.locality`; dos equipos de la misma localidad en la misma categoría
   *   son dos delegaciones. En las individuales, el conjunto de atletas de la
   *   localidad inscriptos en una misma categoría (que ya implica la
   *   disciplina) es una delegación. El dominio no modela la delegación como
   *   entidad —el rol DELEGADO es "responsable de una delegación" pero no tiene
   *   localidad propia—, así que se define por lo que sí está en la base.
   * - **Disciplinas / categorías**: distintas, contando tanto las inscripciones
   *   de sus atletas como las de sus equipos.
   * - **Podios y victorias**: `Result` atribuido por `participant.locality`
   *   (individuales) o `team.locality` (equipos). No se filtran por estado de
   *   inscripción: un resultado cargado es un hecho del torneo.
   *
   * Todo se agrega en Postgres y vuelve una fila por localidad: nunca se traen
   * inscripciones ni resultados a memoria. Es SQL crudo porque Prisma `groupBy`
   * no agrupa por columnas de una relación ni por expresiones (la clave
   * normalizada).
   */
  async getLocalityStats(): Promise<LocalitiesStatsDto> {
    const cacheado = await this.leerCache();
    if (cacheado) {
      return cacheado;
    }

    this.logger.debug('Calculating locality stats from DB...');
    const filas = await this.prisma.$queryRaw<FilaLocalidad[]>(
      this.consultaPorLocalidad(),
    );

    const localities: LocalityStatsDto[] = filas
      .map((f) => ({
        locality: f.locality,
        department: f.department,
        athletes: Number(f.athletes),
        delegations: Number(f.delegations),
        disciplines: Number(f.disciplines),
        categories: Number(f.categories),
        podiums: {
          first: Number(f.first),
          second: Number(f.second),
          third: Number(f.third),
        },
        wins: Number(f.wins),
      }))
      // Red de seguridad: por construcción la consulta sólo arma localidades a
      // partir de filas que suman en algún conteo, pero el contrato dice que
      // una localidad en cero no se devuelve y no queremos que dependa de eso.
      .filter(
        (l) =>
          l.athletes +
            l.delegations +
            l.disciplines +
            l.categories +
            l.podiums.first +
            l.podiums.second +
            l.podiums.third +
            l.wins >
          0,
      );

    const stats: LocalitiesStatsDto = {
      generatedAt: new Date().toISOString(),
      localities,
    };

    await this.escribirCache(stats);
    return stats;
  }

  /**
   * La consulta agregada. Una sola ida a la base.
   *
   * Estructura: tres CTE "base" (inscripciones vigentes, equipos inscriptos y
   * resultados en podio) con el nombre ya limpio; `aportes` junta las tres
   * para elegir, por clave, la grafía y el departamento más frecuentes; y un
   * CTE por métrica agrupa por la clave normalizada.
   */
  private consultaPorLocalidad(): Prisma.Sql {
    const rechazada = InscriptionStatus.RECHAZADA;

    return Prisma.sql`
      WITH
      insc AS (
        SELECT i.participant_id, i.category_id, i.team_id, c.discipline_id,
               ${limpio('p.locality')} AS nombre,
               ${limpio('p.department')} AS dep
        FROM inscriptions i
        JOIN participants p ON p.id = i.participant_id
        JOIN categories c ON c.id = i.category_id
        WHERE i.status::text <> ${rechazada}
      ),
      equipos AS (
        SELECT t.id, t.category_id, t.discipline_id,
               ${limpio('t.locality')} AS nombre,
               ${limpio('t.department')} AS dep
        FROM teams t
        WHERE t.is_active
          AND EXISTS (
            SELECT 1 FROM inscriptions i
            WHERE i.team_id = t.id AND i.status::text <> ${rechazada}
          )
      ),
      podio AS (
        SELECT ${limpio('COALESCE(p.locality, t.locality)')} AS nombre,
               ${limpio('COALESCE(p.department, t.department)')} AS dep,
               r.ranking, r.is_winner
        FROM results r
        LEFT JOIN participants p ON p.id = r.participant_id
        LEFT JOIN teams t ON t.id = r.team_id
        WHERE COALESCE(p.locality, t.locality) IS NOT NULL
          AND (r.ranking BETWEEN 1 AND 3 OR r.is_winner)
      ),
      aportes AS (
        SELECT nombre, dep FROM insc
        UNION ALL SELECT nombre, dep FROM equipos
        UNION ALL SELECT nombre, dep FROM podio
      ),
      nombres AS (
        -- La grafía más usada; a igualdad, la que tiene mayúsculas
        -- ("Clorinda" antes que "clorinda") y después la alfabética, para que
        -- el resultado sea estable entre requests.
        SELECT DISTINCT ON (clave) clave, nombre
        FROM (
          SELECT ${clave('nombre')} AS clave, nombre, COUNT(*) AS n
          FROM aportes GROUP BY 1, 2
        ) x
        WHERE clave <> ''
        ORDER BY clave, n DESC, (nombre <> lower(nombre)) DESC, nombre
      ),
      deptos AS (
        SELECT DISTINCT ON (clave) clave, dep
        FROM (
          SELECT ${clave('nombre')} AS clave, dep, COUNT(*) AS n
          FROM aportes GROUP BY 1, 2
        ) x
        ORDER BY clave, n DESC, dep
      ),
      atletas AS (
        SELECT ${clave('nombre')} AS clave, COUNT(DISTINCT participant_id)::int AS n
        FROM insc GROUP BY 1
      ),
      delegaciones AS (
        SELECT clave, COUNT(*)::int AS n
        FROM (
          SELECT ${clave('nombre')} AS clave, 'equipo:' || id::text AS unidad
          FROM equipos
          UNION
          SELECT ${clave('nombre')}, 'categoria:' || category_id::text
          FROM insc WHERE team_id IS NULL
        ) d
        GROUP BY clave
      ),
      oferta AS (
        SELECT ${clave('nombre')} AS clave,
               COUNT(DISTINCT discipline_id)::int AS disciplinas,
               COUNT(DISTINCT category_id)::int AS categorias
        FROM (
          SELECT nombre, discipline_id, category_id FROM insc
          UNION ALL
          SELECT nombre, discipline_id, category_id FROM equipos
        ) o
        GROUP BY 1
      ),
      podios AS (
        SELECT ${clave('nombre')} AS clave,
               COUNT(*) FILTER (WHERE ranking = 1)::int AS primeros,
               COUNT(*) FILTER (WHERE ranking = 2)::int AS segundos,
               COUNT(*) FILTER (WHERE ranking = 3)::int AS terceros,
               COUNT(*) FILTER (WHERE is_winner)::int AS victorias
        FROM podio GROUP BY 1
      )
      SELECT n.nombre                    AS locality,
             COALESCE(d.dep, '')         AS department,
             COALESCE(a.n, 0)            AS athletes,
             COALESCE(g.n, 0)            AS delegations,
             COALESCE(o.disciplinas, 0)  AS disciplines,
             COALESCE(o.categorias, 0)   AS categories,
             COALESCE(p.primeros, 0)     AS first,
             COALESCE(p.segundos, 0)     AS second,
             COALESCE(p.terceros, 0)     AS third,
             COALESCE(p.victorias, 0)    AS wins
      FROM nombres n
      LEFT JOIN deptos d USING (clave)
      LEFT JOIN atletas a USING (clave)
      LEFT JOIN delegaciones g USING (clave)
      LEFT JOIN oferta o USING (clave)
      LEFT JOIN podios p USING (clave)
      ORDER BY n.nombre
    `;
  }

  /**
   * Mismo criterio que `DashboardService.leerCache`: cualquier problema con
   * Redis se degrada a "no hay cache". Es una lectura pública; un cache
   * opcional caído no justifica un 500.
   */
  private async leerCache(): Promise<LocalitiesStatsDto | null> {
    if (!this.redisClient || this.redisClient.status !== 'ready') {
      return null;
    }
    try {
      const cached = await this.redisClient.get(this.CLAVE_CACHE);
      return cached ? (JSON.parse(cached) as LocalitiesStatsDto) : null;
    } catch (e) {
      this.logger.error(
        `Error reading from Redis cache: ${(e as Error).message}`,
      );
      return null;
    }
  }

  private async escribirCache(stats: LocalitiesStatsDto): Promise<void> {
    if (!this.redisClient || this.redisClient.status !== 'ready') {
      return;
    }
    try {
      await this.redisClient.setex(
        this.CLAVE_CACHE,
        this.CACHE_TTL_SECONDS,
        JSON.stringify(stats),
      );
    } catch (e) {
      this.logger.error(
        `Error writing to Redis cache: ${(e as Error).message}`,
      );
    }
  }
}
