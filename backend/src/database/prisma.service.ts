// ===========================================
// Prisma Database Service (Prisma 7+)
// ===========================================
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private pool: pg.Pool;

  constructor(config: ConfigService) {
    // La URL validada al arrancar (namespace `database`), no `process.env`.
    const pool = new pg.Pool({
      connectionString: config.get<string>('database.url'),
    });

    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('✅ Database connected successfully');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Database disconnected');
  }
}
