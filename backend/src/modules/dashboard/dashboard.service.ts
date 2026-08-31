// ===========================================
// Dashboard Service
// ===========================================
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InscriptionStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { PARTICIPANT_NAME, CATEGORY_NAME } from '../../common/prisma-selects';
import { Alcance, ScopeService } from '../../common/scope';
import { DashboardStatsDto } from './dto';
import Redis from 'ioredis';

/**
 * Orden fijo de los estados en la respuesta.
 *
 * `groupBy` no devuelve filas para los estados sin registros: al arrancar la
 * jornada `RECHAZADA` simplemente no existe. Si mandáramos el resultado crudo,
 * el frontend tendría que saber cuáles son los 4 estados y completar los que
 * faltan — o sea, duplicar una regla del dominio en la UI. Rellenamos acá.
 */
const ESTADOS_INSCRIPCION: InscriptionStatus[] = [
  InscriptionStatus.PENDIENTE,
  InscriptionStatus.REVISADA,
  InscriptionStatus.APROBADA,
  InscriptionStatus.RECHAZADA,
];

/** Cuántas inscripciones recientes muestra el widget del dashboard. */
const ULTIMAS_INSCRIPCIONES = 5;

@Injectable()
export class DashboardService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DashboardService.name);
  private redisClient: Redis | null = null;

  /**
   * Prefijo de la clave de cache. **Nunca se usa sola** (S02).
   *
   * El comentario que había acá decía que la clave era global "porque hoy
   * ningún service filtra por department o zone" y anticipaba, textual, que
   * cuando ese recorte existiera la clave tendría que incluir el scope "porque
   * si no el primero que pida el dashboard le deja su vista cacheada a todos
   * los demás". El recorte llegó con R05 y el comentario quedó viejo: durante
   * toda esa ventana el dashboard fue el único endpoint sin `where` **y**
   * además repartía la primera respuesta calculada a cualquier rol.
   *
   * Por eso arreglar las queries no alcanzaba. Son dos bugs encadenados y el
   * segundo sobrevive al primero: con las queries recortadas pero la clave
   * global, un COORDINADOR de Pilcomayo que entra después de un SUPER_ADMIN
   * sigue viendo los 110 participantes de la provincia, servidos del cache.
   * La clave la arma `claveDeCache()` a partir del alcance.
   */
  private readonly PREFIJO_CACHE = 'dashboard:stats';

  /**
   * 60s. Antes eran 300s: durante una jornada de competencia, contadores con 5
   * minutos de atraso hacen que el admin no vea el efecto de lo que acaba de
   * aprobar y recargue a mano. Un minuto sigue absorbiendo la ráfaga de
   * requests de un dashboard abierto en varias pantallas.
   */
  private readonly CACHE_TTL_SECONDS = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly scope: ScopeService,
  ) {}

  /**
   * Clave de cache derivada del alcance.
   *
   * Dos usuarios comparten entrada si y sólo si ven exactamente el mismo
   * conjunto de departamentos. La lista se normaliza (trim + minúsculas) y se
   * ordena antes de resumirse: "Pilcomayo,Formosa" y "formosa, pilcomayo" son
   * el mismo alcance y tienen que pegarle a la misma clave, o el cache pierde
   * su razón de ser sin dejar de ser correcto.
   *
   * Se resume con un hash y no se pega la lista entera porque un ADMIN_ZONAL de
   * una zona grande generaría claves de cientos de caracteres. El prefijo
   * conserva el tipo y la cantidad para que la clave siga siendo legible desde
   * `redis-cli KEYS 'dashboard:stats:*'` cuando haya que diagnosticar algo.
   */
  private claveDeCache(alcance: Alcance): string {
    if (alcance.tipo === 'PROVINCIAL') {
      return `${this.PREFIJO_CACHE}:provincial`;
    }
    if (alcance.departamentos.length === 0) {
      // Alcance vacío: ve ceros. Tiene su propia entrada y no comparte con
      // nadie — es justamente el caso que no puede heredar la vista de otro.
      return `${this.PREFIJO_CACHE}:sin-alcance`;
    }

    const canonico = [...alcance.departamentos]
      .map((d) => d.trim().toLowerCase())
      .sort()
      .join('|');
    const huella = createHash('sha1').update(canonico).digest('hex').slice(0, 16);

    return `${this.PREFIJO_CACHE}:deps:${alcance.departamentos.length}:${huella}`;
  }

  onModuleInit() {
    try {
      const host = this.configService.get<string>('redis.host', 'localhost');
      const port = this.configService.get<number>('redis.port', 6379);
      const password = this.configService.get<string>('redis.password');

      this.redisClient = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
      });

      this.redisClient.on('error', (err) => {
        this.logger.warn(
          `Redis connection error: ${err.message}. Dashboard will fallback to direct DB queries without cache.`,
        );
      });

      // Intentar conectar en background, ignorar fallos para no romper la app si Redis no está
      this.redisClient.connect().catch(() => {});
    } catch {
      this.logger.warn(
        'Failed to initialize Redis client for Dashboard. Using DB fallback.',
      );
    }
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }

  async getGlobalStats(alcance: Alcance): Promise<DashboardStatsDto> {
    // Los tres `where` del recorte, calculados una sola vez. Salen de
    // `ScopeService` y no de un `if` local: la regla que decide qué ve cada rol
    // tiene que ser la misma que aplican participants, teams e inscriptions, o
    // el dashboard vuelve a contar distinto que las pantallas que resume.
    const whereParticipant = this.scope.whereParticipant(alcance);
    const whereTeam = this.scope.whereTeam(alcance);
    const whereInscription = this.scope.whereInscription(alcance);

    // 1. Intentar obtener de caché — con la clave del alcance, no la global.
    const clave = this.claveDeCache(alcance);
    const cacheado = await this.leerCache(clave);
    if (cacheado) {
      return cacheado;
    }

    // 2. Si no hay caché, calcular desde BD.
    //    Todo en un solo `Promise.all`: son 7 consultas independientes, y en
    //    serie el endpoint pagaría 7 round-trips en lugar de uno.
    this.logger.debug('Calculating global stats from DB...');
    const [
      totalParticipants,
      totalTeams,
      totalInscriptions,
      totalCompetitions,
      participantsBySex,
      inscriptionsByStatusRaw,
      recentInscriptionsRaw,
    ] = await Promise.all([
      this.prisma.participant.count({ where: whereParticipant }),
      this.prisma.team.count({ where: whereTeam }),
      this.prisma.inscription.count({ where: whereInscription }),
      // Las competencias NO llevan recorte y es una decisión, no un olvido:
      // `Competition` no tiene columna territorial —la disputa es provincial— y
      // el fixture ya se publica por endpoints `@Public()`. Contar todas no
      // agrega ninguna información que el usuario no pueda ver sin loguearse.
      this.prisma.competition.count(),
      this.prisma.participant.groupBy({
        by: ['sex'],
        where: whereParticipant,
        _count: { sex: true },
      }),
      this.prisma.inscription.groupBy({
        by: ['status'],
        where: whereInscription,
        _count: { status: true },
      }),
      this.prisma.inscription.findMany({
        where: whereInscription,
        take: ULTIMAS_INSCRIPCIONES,
        orderBy: { createdAt: 'desc' },
        // `select` explícito, no `include`: el widget muestra nombre, categoría,
        // QR y antigüedad. Nada de DNI, contacto, notas internas ni motivos de
        // rechazo — eso vive en la vista de detalle (criterio de T01/T21).
        select: {
          id: true,
          qrCode: true,
          status: true,
          createdAt: true,
          participant: { select: PARTICIPANT_NAME },
          category: { select: CATEGORY_NAME },
        },
      }),
    ]);

    const conteoPorEstado = new Map(
      inscriptionsByStatusRaw.map((f) => [f.status, f._count.status]),
    );

    const stats: DashboardStatsDto = {
      totalParticipants,
      totalTeams,
      totalInscriptions,
      totalCompetitions,
      inscriptionsByStatus: ESTADOS_INSCRIPCION.map((status) => ({
        status,
        count: conteoPorEstado.get(status) ?? 0,
      })),
      demographics: participantsBySex.map((p) => ({
        sex: p.sex,
        count: p._count.sex,
      })),
      // `createdAt` se normaliza a ISO acá y no se deja como `Date`: al volver
      // de Redis ya es string, y queremos que el tipo sea el mismo haya o no
      // cache hit. Si no, el frontend recibe dos formas para el mismo campo.
      recentInscriptions: recentInscriptionsRaw.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
      })),
      lastUpdated: new Date().toISOString(),
    };

    // 3. Guardar en caché, bajo la clave del alcance
    await this.escribirCache(clave, stats);

    return stats;
  }

  /**
   * Lee del cache. Cualquier problema con Redis (caído, timeout, JSON corrupto)
   * se degrada a "no hay cache": el dashboard es una lectura, no vale la pena
   * devolver un 500 porque un cache opcional no responde.
   */
  private async leerCache(clave: string): Promise<DashboardStatsDto | null> {
    if (!this.redisClient || this.redisClient.status !== 'ready') {
      return null;
    }
    try {
      const cached = await this.redisClient.get(clave);
      return cached ? (JSON.parse(cached) as DashboardStatsDto) : null;
    } catch (e) {
      this.logger.error(
        `Error reading from Redis cache: ${(e as Error).message}`,
      );
      return null;
    }
  }

  private async escribirCache(
    clave: string,
    stats: DashboardStatsDto,
  ): Promise<void> {
    if (!this.redisClient || this.redisClient.status !== 'ready') {
      return;
    }
    try {
      await this.redisClient.setex(
        clave,
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
