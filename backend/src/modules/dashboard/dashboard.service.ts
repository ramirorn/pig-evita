// ===========================================
// Dashboard Service
// ===========================================
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import Redis from 'ioredis';

@Injectable()
export class DashboardService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DashboardService.name);
  private redisClient: Redis | null = null;
  private readonly CACHE_KEY = 'dashboard:stats';
  private readonly CACHE_TTL_SECONDS = 300; // 5 minutos

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
        this.logger.warn(`Redis connection error: ${err.message}. Dashboard will fallback to direct DB queries without cache.`);
      });
      
      // Intentar conectar en background, ignorar fallos para no romper la app si Redis no está
      this.redisClient.connect().catch(() => {});
    } catch (e) {
      this.logger.warn('Failed to initialize Redis client for Dashboard. Using DB fallback.');
    }
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }

  async getGlobalStats() {
    // 1. Intentar obtener de caché
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const cached = await this.redisClient.get(this.CACHE_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (e) {
        this.logger.error(`Error reading from Redis cache: ${e.message}`);
      }
    }

    // 2. Si no hay caché, calcular desde BD
    this.logger.debug('Calculating global stats from DB...');
    const [
      totalParticipants,
      totalTeams,
      totalInscriptions,
      totalCompetitions,
      participantsBySex,
    ] = await Promise.all([
      this.prisma.participant.count(),
      this.prisma.team.count(),
      this.prisma.inscription.count(),
      this.prisma.competition.count(),
      this.prisma.participant.groupBy({
        by: ['sex'],
        _count: { sex: true },
      }),
    ]);

    const stats = {
      totalParticipants,
      totalTeams,
      totalInscriptions,
      totalCompetitions,
      demographics: participantsBySex.map(p => ({
        sex: p.sex,
        count: p._count.sex
      })),
      lastUpdated: new Date().toISOString(),
    };

    // 3. Guardar en caché
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.setex(this.CACHE_KEY, this.CACHE_TTL_SECONDS, JSON.stringify(stats));
      } catch (e) {
        this.logger.error(`Error writing to Redis cache: ${e.message}`);
      }
    }

    return stats;
  }
}
