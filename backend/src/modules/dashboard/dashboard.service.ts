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
import { PrismaService } from '../../database/prisma.service';
import { PARTICIPANT_NAME, CATEGORY_NAME } from '../../common/prisma-selects';
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
   * Clave única y global: el payload no depende del usuario ni de su rol.
   *
   * Hoy ningún service filtra inscripciones/participantes por `department` o
   * `zone` del usuario, así que un ADMIN_ZONAL ve exactamente los mismos
   * números que un SUPER_ADMIN. Si algún día se implementa ese recorte, esta
   * clave tiene que pasar a incluir el scope (p. ej. `dashboard:stats:zona:X`),
   * porque si no el primero que pida el dashboard le deja su vista cacheada a
   * todos los demás.
   */
  private readonly CACHE_KEY = 'dashboard:stats';

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
  ) {}

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

  async getGlobalStats(): Promise<DashboardStatsDto> {
    // 1. Intentar obtener de caché
    const cacheado = await this.leerCache();
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
      this.prisma.participant.count(),
      this.prisma.team.count(),
      this.prisma.inscription.count(),
      this.prisma.competition.count(),
      this.prisma.participant.groupBy({
        by: ['sex'],
        _count: { sex: true },
      }),
      this.prisma.inscription.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.inscription.findMany({
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

    // 3. Guardar en caché
    await this.escribirCache(stats);

    return stats;
  }

  /**
   * Lee del cache. Cualquier problema con Redis (caído, timeout, JSON corrupto)
   * se degrada a "no hay cache": el dashboard es una lectura, no vale la pena
   * devolver un 500 porque un cache opcional no responde.
   */
  private async leerCache(): Promise<DashboardStatsDto | null> {
    if (!this.redisClient || this.redisClient.status !== 'ready') {
      return null;
    }
    try {
      const cached = await this.redisClient.get(this.CACHE_KEY);
      return cached ? (JSON.parse(cached) as DashboardStatsDto) : null;
    } catch (e) {
      this.logger.error(
        `Error reading from Redis cache: ${(e as Error).message}`,
      );
      return null;
    }
  }

  private async escribirCache(stats: DashboardStatsDto): Promise<void> {
    if (!this.redisClient || this.redisClient.status !== 'ready') {
      return;
    }
    try {
      await this.redisClient.setex(
        this.CACHE_KEY,
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
