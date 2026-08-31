// ===========================================
// S19 — Disparo manual del sync de noticias
// ===========================================
import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NewsSyncService } from './news-sync.service';
import { Roles } from '../../../common/decorators';
import { ACCIONES } from '../../../common/constants';

/**
 * Vive en un controller aparte de `NewsController` y no como un método más, por
 * una razón concreta: `NewsController` es el controller **público** de noticias
 * y varios e2e lo instancian a mano (`content-drafts`, `public-pii`, el barrido
 * de S01). Sumarle una dependencia lo habría roto en todos ellos, y "arreglar
 * los tests" para meter un endpoint administrativo adentro del controller
 * público es exactamente el tipo de acoplamiento que después nadie deshace.
 *
 * Además queda declarado dónde está la frontera: leer noticias es público;
 * traerlas del portal es una acción administrativa con su propio permiso.
 */
@ApiTags('News')
@Controller('news')
@ApiBearerAuth('access-token')
export class NewsSyncController {
  constructor(private readonly newsSyncService: NewsSyncService) {}

  /**
   * Existe además de la corrida diaria porque la necesidad real es "acaban de
   * publicar la nota de la final y la queremos en el sitio ahora", no
   * "esperemos a mañana".
   *
   * Tres decisiones que no son cosméticas:
   *
   *   · `NEWS_SYNC` y no `NEWS_MANAGE`: esto sale a golpear un sitio ajeno.
   *   · Cupo propio (3 por minuto): el botón no puede convertirse en una forma
   *     de generar tráfico contra formosa.gob.ar apretándolo repetido.
   *   · Devuelve **el reporte entero**. Si la corrida no encontró nada, el panel
   *     tiene que poder decir por qué: cuántos IDs miró, cuántas notas eran de
   *     otra sección, cuántos errores de red hubo. Un "listo" sin números es
   *     justo el modo de falla que esta tarea viene a cerrar.
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @Roles(...ACCIONES.NEWS_SYNC)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sincronizar noticias del portal oficial' })
  @ApiResponse({ status: 200, description: 'Reporte de la corrida' })
  @ApiResponse({
    status: 503,
    description:
      'El portal no responde o cambió el markup: la corrida se aborta en vez de informar cero noticias',
  })
  async sincronizar() {
    return this.newsSyncService.sincronizar('manual');
  }
}
