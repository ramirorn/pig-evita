// ===========================================
// S19 — Corrida diaria del sync de noticias
// ===========================================
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsSyncService } from './news-sync.service';

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Dispara el sync una vez por día.
 *
 * Se hace con `setTimeout` + `setInterval` y no con `@nestjs/schedule` a
 * propósito: es **una** tarea, y agregar una dependencia nueva al backend por un
 * cron único va en contra de lo que S15 está tratando de achicar. Si algún día
 * aparecen tres o cuatro tareas programadas, ahí sí conviene el paquete.
 *
 * Decisiones que conviene tener escritas:
 *
 *   · **Apagado por defecto en test.** `NEWS_SYNC_ENABLED` controla el timer;
 *     ningún test tiene que salir a Internet por el solo hecho de levantar el
 *     módulo.
 *   · **`unref()`** en los timers: un proceso que termina no se queda colgado
 *     esperando la próxima corrida.
 *   · **Varias instancias no rompen nada.** Si mañana el backend corre
 *     replicado, las N instancias van a sincronizar en paralelo: el `upsert` por
 *     `sourceUrl` hace que el resultado sea el mismo. Lo único que se pierde es
 *     tráfico contra el portal. El día que eso importe, el candado va en
 *     `sync_state` con una transacción, no acá.
 *   · **Una falla del sync no puede tumbar el proceso.** Se loguea como error
 *     —que es el punto de la tarea: tiene que quedar registrado— y la próxima
 *     corrida vuelve a intentar.
 */
@Injectable()
export class NewsSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsSyncScheduler.name);
  private primerDisparo?: NodeJS.Timeout;
  private diario?: NodeJS.Timeout;

  constructor(
    private readonly sync: NewsSyncService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (String(this.config.get('NEWS_SYNC_ENABLED', 'false')) !== 'true') {
      this.logger.log(
        'Sync de noticias del portal: desactivado (NEWS_SYNC_ENABLED != true). El disparo manual del panel sigue disponible.',
      );
      return;
    }

    const espera = this.msHastaLaHoraElegida();
    this.logger.log(
      `Sync de noticias del portal: activo, primera corrida en ${Math.round(espera / 60000)} minutos y después cada 24 h.`,
    );

    this.primerDisparo = setTimeout(() => {
      void this.correr();
      this.diario = setInterval(() => void this.correr(), UN_DIA_MS);
      this.diario.unref();
    }, espera);
    this.primerDisparo.unref();
  }

  onModuleDestroy(): void {
    if (this.primerDisparo) clearTimeout(this.primerDisparo);
    if (this.diario) clearInterval(this.diario);
  }

  /** Milisegundos hasta la próxima `NEWS_SYNC_HORA` (hora local del server). */
  private msHastaLaHoraElegida(): number {
    const hora = Number(this.config.get('NEWS_SYNC_HORA', 6));
    const ahora = new Date();
    const objetivo = new Date(ahora);
    objetivo.setHours(Number.isFinite(hora) ? hora : 6, 0, 0, 0);
    if (objetivo <= ahora) objetivo.setDate(objetivo.getDate() + 1);
    return objetivo.getTime() - ahora.getTime();
  }

  private async correr(): Promise<void> {
    try {
      await this.sync.sincronizar('programada');
    } catch (error) {
      // Queda registrado como error, que es el requisito: una corrida que no
      // pudo hacer su trabajo no puede pasar por una corrida sin novedades.
      this.logger.error(
        `La sincronización diaria de noticias falló: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
