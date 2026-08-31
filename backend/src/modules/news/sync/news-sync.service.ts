// ===========================================
// S19 — Sincronización de las noticias de Juegos Evita desde formosa.gob.ar
// ===========================================
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { FormosaPortalClient } from './formosa-portal.client';
import {
  esDeJuegosEvita,
  parsearNota,
  slugDeNotaExterna,
  urlDeNota,
  type MotivoDescarte,
  type NotaDelPortal,
} from './formosa-news.parser';

/** Clave de la fila de `sync_state` que lleva el cursor de este sincronizador. */
export const CLAVE_SYNC_NOTICIAS = 'formosa-news';

export type MotivoCorrida = 'manual' | 'programada';

export interface ReporteSync {
  /** `alerta` = terminó, pero hay algo que mirar. Se loguea como error. */
  estado: 'ok' | 'alerta';
  motivo: MotivoCorrida;
  desdeId: number;
  hastaId: number;
  /** Páginas efectivamente bajadas del portal. */
  paginasLeidas: number;
  /** Páginas que resultaron ser una nota real (no la plantilla vacía). */
  notasEncontradas: number;
  /** Notas que además son de la sección Juegos Evita. */
  clasificadas: number;
  creadas: number;
  actualizadas: number;
  /** Notas de otras secciones, descartadas a propósito. */
  descartadasPorSeccion: number;
  erroresDeRed: number;
  /** Páginas donde faltaron los tags OG o el bloque "Cargada en". */
  markupInesperado: number;
  /** Todo lo que amerita que alguien mire. Vacío = corrida limpia. */
  alertas: string[];
  duracionMs: number;
}

/**
 * El sync.
 *
 * ## Cómo descubre
 *
 * Recorriendo IDs. No hay otra vía: el sitemap de noticias está congelado en
 * 2019, el número del medio de la URL no es la categoría, el listado por
 * categoría acepta cualquier número inventado y no hay RSS. Lo único
 * determinista que se encontró es que `/noticia/{id}/0/x` devuelve la nota del
 * ID. El detalle de las tres vías descartadas está en S19 de `tasks.md`.
 *
 * ## Por qué no puede terminar "en verde" trayendo cero
 *
 * Es el modo de falla que este proyecto ya cometió tres veces, así que está
 * atacado de frente, con tres mecanismos distintos:
 *
 *   1. **Canario.** Antes de recorrer nada, se baja una nota conocida
 *      (`NEWS_SYNC_CANARY_ID`, la 34709) y se verifica que siga parseando y
 *      clasificando como Juegos Evita. Si el portal cambia el markup o los tags
 *      OG desaparecen, esto falla **aunque no haya ninguna nota nueva**, que es
 *      justo el escenario donde un sync ingenuo informa "0 novedades, todo bien"
 *      para siempre.
 *   2. **Markup inesperado.** Una página que existe pero a la que le faltan los
 *      OG o el bloque "Cargada en" no se ignora: se cuenta, se loguea y, si no
 *      hubo ninguna nota buena en toda la corrida, tira.
 *   3. **Vejez.** Si hace más de `NEWS_SYNC_MAX_DIAS_SIN_NOTAS` que no entra una
 *      nota clasificable, la corrida termina en `alerta` y se loguea como error,
 *      aunque técnicamente no haya fallado nada.
 */
@Injectable()
export class NewsSyncService {
  private readonly logger = new Logger(NewsSyncService.name);

  /** Un candado en memoria alcanza: el disparo manual y el diario comparten proceso. */
  private corriendo = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly portal: FormosaPortalClient,
    private readonly config: ConfigService,
  ) {}

  private num(clave: string, porDefecto: number): number {
    const valor = Number(this.config.get(clave, porDefecto));
    return Number.isFinite(valor) ? valor : porDefecto;
  }

  /** Tope de IDs por corrida: el sync no puede barrer el portal entero. */
  private get maxIdsPorCorrida(): number {
    return this.num('NEWS_SYNC_MAX_IDS', 60);
  }

  /** Cuántos IDs inexistentes seguidos alcanzan para asumir que llegamos al final. */
  private get maxFallosSeguidos(): number {
    return this.num('NEWS_SYNC_MAX_FALLOS', 10);
  }

  /** ID desde el que arranca la primera corrida (la 34709 es la siguiente). */
  private get idInicial(): number {
    return this.num('NEWS_SYNC_START_ID', 34708);
  }

  private get idCanario(): number {
    return this.num('NEWS_SYNC_CANARY_ID', 34709);
  }

  private get maxDiasSinNotas(): number {
    return this.num('NEWS_SYNC_MAX_DIAS_SIN_NOTAS', 30);
  }

  /**
   * Corre el sync.
   *
   * @throws ServiceUnavailableException si el portal cambió y lo que se está
   * leyendo dejó de ser interpretable. Es a propósito: el disparo manual
   * devuelve 503 y el usuario ve el problema en vez de un "0 noticias nuevas".
   */
  async sincronizar(motivo: MotivoCorrida): Promise<ReporteSync> {
    if (this.corriendo) {
      throw new ServiceUnavailableException(
        'Ya hay una sincronización en curso. Esperá a que termine.',
      );
    }
    this.corriendo = true;

    const arranque = Date.now();
    try {
      return await this.correr(motivo, arranque);
    } finally {
      this.corriendo = false;
    }
  }

  private async correr(
    motivo: MotivoCorrida,
    arranque: number,
  ): Promise<ReporteSync> {
    await this.verificarCanario();

    const estado = await this.prisma.syncState.findUnique({
      where: { key: CLAVE_SYNC_NOTICIAS },
    });
    const cursor = estado?.lastScannedId ?? this.idInicial;

    const reporte: ReporteSync = {
      estado: 'ok',
      motivo,
      desdeId: cursor + 1,
      hastaId: cursor,
      paginasLeidas: 0,
      notasEncontradas: 0,
      clasificadas: 0,
      creadas: 0,
      actualizadas: 0,
      descartadasPorSeccion: 0,
      erroresDeRed: 0,
      markupInesperado: 0,
      alertas: [],
      duracionMs: 0,
    };

    let cursorNuevo = cursor;
    let fallosSeguidos = 0;
    let ultimaEncontrada: Date | null = null;

    for (let i = 0; i < this.maxIdsPorCorrida; i++) {
      if (fallosSeguidos >= this.maxFallosSeguidos) break;

      const id = cursor + 1 + i;
      reporte.hastaId = id;

      if (i > 0) await this.portal.esperarEntreRequests();

      const respuesta = await this.portal.traerNota(id);

      if (!respuesta.ok) {
        // Un error de red **no** avanza el cursor: si se lo diera por leído, ese
        // ID no se vuelve a mirar nunca y la nota se pierde en silencio.
        reporte.erroresDeRed++;
        fallosSeguidos++;
        continue;
      }

      reporte.paginasLeidas++;
      const resultado = parsearNota(respuesta.html, id);

      // El ID quedó resuelto. El cursor sólo avanza sobre el tramo contiguo
      // resuelto, así que un agujero por error de red frena el avance ahí.
      if (cursorNuevo === id - 1) cursorNuevo = id;

      if (!resultado.ok) {
        fallosSeguidos++;
        this.contarDescarte(reporte, resultado.motivo, id);
        continue;
      }

      fallosSeguidos = 0;
      reporte.notasEncontradas++;

      if (!esDeJuegosEvita(resultado.nota)) {
        // El caso de la 33163: misma forma de URL, otra sección. Se descarta.
        reporte.descartadasPorSeccion++;
        continue;
      }

      reporte.clasificadas++;
      ultimaEncontrada = new Date();

      const { creada } = await this.guardar(resultado.nota);
      if (creada) reporte.creadas++;
      else reporte.actualizadas++;
    }

    await this.guardarCursor(cursorNuevo, ultimaEncontrada);
    this.evaluarSalud(reporte, estado?.lastFoundAt ?? null, ultimaEncontrada);

    reporte.duracionMs = Date.now() - arranque;

    const resumen =
      `sync ${motivo}: IDs ${reporte.desdeId}-${reporte.hastaId} · ` +
      `${reporte.notasEncontradas} notas · ${reporte.clasificadas} de Juegos Evita ` +
      `(${reporte.creadas} nuevas, ${reporte.actualizadas} actualizadas) · ` +
      `${reporte.descartadasPorSeccion} de otras secciones · ` +
      `${reporte.erroresDeRed} errores de red · ${reporte.duracionMs}ms`;

    if (reporte.estado === 'alerta') {
      this.logger.error(`${resumen} — ALERTAS: ${reporte.alertas.join(' | ')}`);
    } else {
      this.logger.log(resumen);
    }

    return reporte;
  }

  /**
   * El canario: una nota conocida que tiene que seguir parseando y clasificando.
   *
   * Es lo que separa "hoy no publicaron nada de Juegos Evita" —normal— de "el
   * portal cambió y dejamos de entender lo que leemos" —hay que enterarse—. Sin
   * esto, las dos situaciones se ven exactamente igual desde acá: cero notas.
   */
  private async verificarCanario(): Promise<void> {
    const id = this.idCanario;
    const respuesta = await this.portal.traerNota(id);

    if (!respuesta.ok) {
      const detalle = `No se pudo leer la nota de control ${urlDeNota(id)}: ${respuesta.error}`;
      this.logger.error(detalle);
      throw new ServiceUnavailableException(
        `${detalle}. El portal no responde: la sincronización se aborta en vez de informar cero noticias.`,
      );
    }

    const resultado = parsearNota(respuesta.html, id);

    if (!resultado.ok) {
      const detalle =
        `La nota de control ${id} dejó de parsearse (motivo: ${resultado.motivo}). ` +
        'El markup del portal cambió: hay que revisar `formosa-news.parser.ts` y ' +
        'volver a bajar los fixtures de `test/fixtures/`.';
      this.logger.error(detalle);
      throw new ServiceUnavailableException(detalle);
    }

    if (!esDeJuegosEvita(resultado.nota)) {
      const detalle =
        `La nota de control ${id} ya no clasifica como Juegos Evita ` +
        `(sección leída: "${resultado.nota.seccionSlug}"). La señal de ` +
        'clasificación cambió: el sync se aborta para no traer cero en silencio.';
      this.logger.error(detalle);
      throw new ServiceUnavailableException(detalle);
    }
  }

  private contarDescarte(
    reporte: ReporteSync,
    motivo: MotivoDescarte,
    id: number,
  ): void {
    if (motivo === 'inexistente') return;

    reporte.markupInesperado++;
    reporte.alertas.push(
      motivo === 'sin-open-graph'
        ? `La nota ${id} existe pero no trae tags Open Graph`
        : `La nota ${id} existe pero no trae el bloque "Cargada en"`,
    );
  }

  /**
   * Guarda la nota. **Enlaza, no republica**: título, bajada, imagen, fecha y el
   * link al original. El cuerpo del artículo no se copia (ver el modelo `News`).
   *
   * El `upsert` por `sourceUrl` —que es UNIQUE— es lo que hace la corrida
   * idempotente: correrla dos veces seguidas actualiza las mismas filas en vez
   * de duplicarlas.
   */
  private async guardar(nota: NotaDelPortal): Promise<{ creada: boolean }> {
    const existente = await this.prisma.news.findUnique({
      where: { sourceUrl: nota.sourceUrl },
      select: { id: true },
    });

    const publicada = nota.fecha ?? new Date();

    const datos = {
      title: nota.titulo,
      // Para una nota externa, `content` es la bajada: es lo que el propio
      // portal publica como resumen. El artículo completo se lee allá.
      content: nota.bajada,
      excerpt: nota.bajada,
      imageKey: nota.imagenUrl,
      isPublished: true,
      publishedAt: publicada,
      sourceUrl: nota.sourceUrl,
      sourceName: nota.fuente ?? 'Portal Oficial de la Provincia de Formosa',
      isExternal: true,
    };

    await this.prisma.news.upsert({
      where: { sourceUrl: nota.sourceUrl },
      create: { ...datos, slug: slugDeNotaExterna(nota) },
      update: datos,
    });

    return { creada: !existente };
  }

  private async guardarCursor(
    lastScannedId: number,
    encontrada: Date | null,
  ): Promise<void> {
    const ahora = new Date();
    await this.prisma.syncState.upsert({
      where: { key: CLAVE_SYNC_NOTICIAS },
      create: {
        key: CLAVE_SYNC_NOTICIAS,
        lastScannedId,
        lastRunAt: ahora,
        lastFoundAt: encontrada,
      },
      update: {
        lastScannedId,
        lastRunAt: ahora,
        ...(encontrada ? { lastFoundAt: encontrada } : {}),
      },
    });
  }

  /** Reglas de "esto terminó bien pero no está bien". */
  private evaluarSalud(
    reporte: ReporteSync,
    ultimaConocida: Date | null,
    encontradaAhora: Date | null,
  ): void {
    // Se leyeron páginas, ninguna resultó una nota, y las que existían tenían el
    // markup roto. No es "no hay nada nuevo": es que dejamos de entender.
    if (reporte.notasEncontradas === 0 && reporte.markupInesperado > 0) {
      const detalle =
        `${reporte.markupInesperado} páginas del portal existen pero no se pudieron ` +
        'interpretar, y no se encontró ninguna nota válida en toda la corrida.';
      this.logger.error(detalle);
      throw new ServiceUnavailableException(detalle);
    }

    // Se intentó leer y **todo** falló por red.
    if (reporte.paginasLeidas === 0 && reporte.erroresDeRed > 0) {
      const detalle = `No se pudo leer ninguna página del portal (${reporte.erroresDeRed} errores de red).`;
      this.logger.error(detalle);
      throw new ServiceUnavailableException(detalle);
    }

    if (reporte.markupInesperado > 0) {
      reporte.estado = 'alerta';
    }

    const ultima = encontradaAhora ?? ultimaConocida;
    if (ultima) {
      const dias = Math.floor((Date.now() - ultima.getTime()) / 86_400_000);
      if (dias > this.maxDiasSinNotas) {
        reporte.estado = 'alerta';
        reporte.alertas.push(
          `Hace ${dias} días que no entra una nota de Juegos Evita. Puede ser ` +
            'temporada baja, o puede ser que la sección haya cambiado de nombre.',
        );
      }
    }

    if (reporte.erroresDeRed > 0) {
      reporte.estado = 'alerta';
      reporte.alertas.push(
        `${reporte.erroresDeRed} IDs no se pudieron leer por errores de red; ` +
          'el cursor no avanzó sobre ellos y se vuelven a intentar.',
      );
    }
  }
}
