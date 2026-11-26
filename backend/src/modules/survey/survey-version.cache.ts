// ===========================================
// Caché por versión de campaña (encuesta y métricas)
// ===========================================
import { Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RedisCacheService } from '../../common/cache';
import { claveVersionCampania } from './survey.constants';

/** Agregados cacheados dos minutos; la versión los invalida antes. */
const AGGREGATES_TTL_SECONDS = 120;

/**
 * Única implementación del versionado que comparten la encuesta (que sube la
 * versión al completar una tanda o al cambiar el cuestionario) y las métricas
 * (que la leen para armar las claves y la suben al cambiar un KPI o un
 * destacado). Antes cada servicio tenía su propia versión de estas claves.
 *
 * Redis es opcional, como en el resto del cache: sin él, nada falla; las
 * métricas calculan contra la base y la versión cae al conteo de respuestas.
 */
@Injectable()
export class SurveyVersionCache {
  constructor(@Optional() private readonly cache?: RedisCacheService) {}

  /** `false` cuando no hay cache configurado (specs, entornos sin Redis). */
  get enabled(): boolean {
    return Boolean(this.cache);
  }

  /** Versión guardada en Redis, o `null` si no hay Redis o no existe. */
  async current(campaignId: string): Promise<number | null> {
    return (
      (await this.cache?.getNumero(claveVersionCampania(campaignId))) ?? null
    );
  }

  /**
   * Sube la versión (fire-and-forget: ni espera ni falla). Una definición sin
   * campaña (KPI o destacado reutilizable) no sube ninguna: se refresca al
   * vencer el TTL.
   */
  bump(campaignId: string | null): void {
    if (campaignId) void this.cache?.incr(claveVersionCampania(campaignId));
  }

  /** `metrics:p4:survey:{id}:v{version}:{endpoint}:{sha1(query canónica)}`. */
  key(
    campaignId: string,
    version: number,
    endpoint: string,
    query: object,
  ): string {
    const canonical = JSON.stringify(
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    const fingerprint = createHash('sha1')
      .update(canonical)
      .digest('hex')
      .slice(0, 16);
    // `p4`: formato vigente de respuesta; las claves viejas quedan huérfanas.
    return `metrics:p4:survey:${campaignId}:v${version}:${endpoint}:${fingerprint}`;
  }

  async read<T>(key: string): Promise<T | null> {
    return (await this.cache?.get<T>(key)) ?? null;
  }

  async write(key: string, value: unknown): Promise<void> {
    await this.cache?.setex(key, AGGREGATES_TTL_SECONDS, value);
  }
}
