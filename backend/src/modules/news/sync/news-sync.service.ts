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
  idMasRecienteDePortada,
  parsearNota,
  slugDeNotaExterna,
  urlDeNota,
  type MotivoDescarte,
  type NotaDelPortal,
} from './formosa-news.parser';

/** Clave de la fila de `sync_state` que lleva el cursor de este sincronizador. */
export const CLAVE_SYNC_NOTICIAS = 'formosa-news';

export type MotivoCorrida = 'manual' | 'programada';

/**
 * Cómo se eligió qué IDs mirar.
 *
 *   · `portada`: se leyó en la portada del portal cuál es la nota más nueva y se
 *     recorrió de ahí hacia atrás. Es el modo normal.
 *   · `secuencial`: la portada no se pudo leer (o dio un ID absurdo) y se cayó
 *     al recorrido anterior: hacia adelante desde el frente, cortando tras
 *     varios IDs inexistentes seguidos.
 */
export type ModoRecorrido = 'portada' | 'secuencial';

/** Un rango cerrado de IDs del portal. */
export interface RangoIds {
  desdeId: number;
  hastaId: number;
}

export interface ReporteSync {
  /** `alerta` = terminó, pero hay algo que mirar. Se loguea como error. */
  estado: 'ok' | 'alerta';
  motivo: MotivoCorrida;
  modo: ModoRecorrido;
  /** ID más alto enlazado desde la portada del portal; `null` si no se pudo leer. */
  idMasRecientePortal: number | null;
  /**
   * ID más bajo y más alto que se pidieron en esta corrida (`null` si no se
   * pidió ninguno). Como el recorrido va de lo más nuevo hacia atrás y puede
   * retomar un tramo pendiente, no todos los IDs del medio se miraron
   * necesariamente: el número exacto es `idsRevisados`.
   */
  desdeId: number | null;
  hastaId: number | null;
  /** IDs pedidos al portal en esta corrida (sin contar el canario ni la portada). */
  idsRevisados: number;
  /**
   * Tramo que quedó sin revisar al terminar —por tope de IDs por corrida o por
   * errores de red— y que completan las corridas siguientes. `null` = todo lo
   * publicado hasta `idMasRecientePortal` está cubierto.
   */
  pendiente: RangoIds | null;
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
 * Qué parte del portal ya está revisada. Ver el modelo `SyncState`.
 *
 *   (-inf, piso]                 cubierto
 *   (piso, techoPendiente]       pendiente (vacío si techoPendiente === piso)
 *   (techoPendiente, frente]     cubierto
 */
interface Cobertura {
  piso: number;
  techoPendiente: number;
  frente: number;
}

/** Resultado de mirar un ID. `red` = no se pudo leer: el ID sigue pendiente. */
type ResultadoId = 'red' | 'inexistente' | 'otra-seccion' | 'juegos-evita';

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
 * ## En qué orden: lo más nuevo primero
 *
 * Al empezar, se baja la portada del portal y se toma el ID más alto que enlaza
 * (`/noticia/<id>`): hasta ahí llega hoy el portal. Se recorre **de ese ID hacia
 * abajo** hasta el frente ya cubierto y, si queda presupuesto, se sigue con el
 * tramo pendiente de corridas anteriores, también de arriba hacia abajo. Así la
 * nota publicada ayer entra en la primera corrida aunque haya cientos de IDs
 * viejos sin revisar.
 *
 * El tope por corrida (`NEWS_SYNC_MAX_IDS`) se respeta igual: lo que no entra
 * queda guardado como tramo pendiente en `sync_state` y lo completan las
 * corridas siguientes. **Ningún ID se da por visto sin haberse leído**: ni por
 * presupuesto ni por un error de red. A lo sumo, un ID ya leído vuelve a
 * leerse (el `upsert` por `sourceUrl` lo hace inocuo).
 *
 * Si la portada no se puede leer, se cae al recorrido anterior: hacia adelante
 * desde el frente, cortando tras `NEWS_SYNC_MAX_FALLOS` IDs inexistentes
 * seguidos.
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

  /** Salto máximo creíble entre el frente y la nota más nueva de la portada. */
  private get maxSalto(): number {
    return this.num('NEWS_SYNC_MAX_SALTO', 5000);
  }

  private async correr(
    motivo: MotivoCorrida,
    arranque: number,
  ): Promise<ReporteSync> {
    await this.verificarCanario();

    const estado = await this.prisma.syncState.findUnique({
      where: { key: CLAVE_SYNC_NOTICIAS },
    });
    const cobertura = this.coberturaDe(estado);

    const reporte: ReporteSync = {
      estado: 'ok',
      motivo,
      modo: 'secuencial',
      idMasRecientePortal: null,
      desdeId: null,
      hastaId: null,
      idsRevisados: 0,
      pendiente: null,
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

    const masReciente = await this.leerPortada(reporte, cobertura);

    /** IDs que esta corrida dejó resueltos (leídos, existan o no). */
    const resueltos = new Set<number>();
    let ultimaEncontrada: Date | null = null;
    let presupuesto = this.maxIdsPorCorrida;

    const mirar = async (id: number): Promise<ResultadoId> => {
      // La portada ya fue un request: la pausa va antes de cada nota.
      await this.portal.esperarEntreRequests();
      presupuesto--;
      reporte.idsRevisados++;
      reporte.desdeId = Math.min(reporte.desdeId ?? id, id);
      reporte.hastaId = Math.max(reporte.hastaId ?? id, id);

      const resultado = await this.procesarId(id, reporte);
      if (resultado !== 'red') resueltos.add(id);
      if (resultado === 'juegos-evita') ultimaEncontrada ??= new Date();
      return resultado;
    };

    /**
     * Recorre `ids` en orden mientras haya presupuesto. Con `cortarEnInexistentes`
     * (sólo el recorrido hacia adelante, que no sabe dónde termina el portal)
     * también corta tras varios IDs sin nota seguidos; si no, sólo tras varios
     * errores de red seguidos, que es el portal caído.
     */
    const recorrer = async (
      ids: Iterable<number>,
      cortarEnInexistentes: boolean,
    ): Promise<void> => {
      let fallosSeguidos = 0;
      for (const id of ids) {
        if (presupuesto <= 0 || fallosSeguidos >= this.maxFallosSeguidos) {
          return;
        }
        const resultado = await mirar(id);
        const fallo =
          resultado === 'red' ||
          (cortarEnInexistentes && resultado === 'inexistente');
        fallosSeguidos = fallo ? fallosSeguidos + 1 : 0;
      }
    };

    let techo: number;

    if (masReciente !== null) {
      // Lo más nuevo primero: de la nota más reciente hacia el frente cubierto.
      reporte.modo = 'portada';
      techo = Math.max(masReciente, cobertura.frente);
      await recorrer(descendente(techo, cobertura.frente + 1), false);
    } else {
      // Comportamiento anterior: hacia adelante desde el frente. Sólo se da por
      // cubierto el tramo contiguo resuelto, así que un error de red frena el
      // avance ahí y ese ID se vuelve a mirar en la próxima corrida.
      reporte.modo = 'secuencial';
      await recorrer(ascendente(cobertura.frente + 1), true);
      techo = cobertura.frente;
      while (resueltos.has(techo + 1)) techo++;
    }

    // Con lo que sobre de presupuesto, el tramo pendiente de corridas
    // anteriores, también de arriba hacia abajo.
    await recorrer(
      descendente(cobertura.techoPendiente, cobertura.piso + 1),
      false,
    );

    const nueva = this.nuevaCobertura(cobertura, techo, resueltos);
    reporte.pendiente =
      nueva.techoPendiente > nueva.piso
        ? { desdeId: nueva.piso + 1, hastaId: nueva.techoPendiente }
        : null;

    await this.guardarCursor(nueva, ultimaEncontrada);
    this.evaluarSalud(reporte, estado?.lastFoundAt ?? null, ultimaEncontrada);

    reporte.duracionMs = Date.now() - arranque;

    const rango =
      reporte.desdeId === null
        ? 'ningún ID nuevo'
        : `${reporte.idsRevisados} IDs entre ${reporte.desdeId} y ${reporte.hastaId}`;
    const resumen =
      `sync ${motivo} (${reporte.modo}, portada: ${reporte.idMasRecientePortal ?? 'ilegible'}): ` +
      `${rango} · ` +
      `${reporte.notasEncontradas} notas · ${reporte.clasificadas} de Juegos Evita ` +
      `(${reporte.creadas} nuevas, ${reporte.actualizadas} actualizadas) · ` +
      `${reporte.descartadasPorSeccion} de otras secciones · ` +
      `${reporte.erroresDeRed} errores de red · ` +
      (reporte.pendiente
        ? `pendiente ${reporte.pendiente.desdeId}-${reporte.pendiente.hastaId} · `
        : 'sin pendientes · ') +
      `${reporte.duracionMs}ms`;

    if (reporte.estado === 'alerta') {
      this.logger.error(`${resumen} — ALERTAS: ${reporte.alertas.join(' | ')}`);
    } else {
      this.logger.log(resumen);
    }

    return reporte;
  }

  /** Lee la cobertura guardada, tolerando filas de antes del recorrido descendente. */
  private coberturaDe(
    estado: {
      lastScannedId: number;
      highestScannedId?: number | null;
      pendingTopId?: number | null;
    } | null,
  ): Cobertura {
    const piso = estado?.lastScannedId ?? this.idInicial;
    const frente = Math.max(estado?.highestScannedId ?? piso, piso);
    const techoPendiente = Math.min(
      Math.max(estado?.pendingTopId ?? piso, piso),
      frente,
    );
    return { piso, techoPendiente, frente };
  }

  /**
   * ID más nuevo según la portada, o `null` para caer al recorrido anterior.
   *
   * Que la portada no se lea **no** aborta la corrida —el canario ya probó que
   * las notas se leen—, pero queda como alerta: si no, el sync volvería en
   * silencio a traer primero lo más viejo.
   */
  private async leerPortada(
    reporte: ReporteSync,
    cobertura: Cobertura,
  ): Promise<number | null> {
    await this.portal.esperarEntreRequests();
    const respuesta = await this.portal.traerPortada();

    if (!respuesta.ok) {
      reporte.alertas.push(
        `No se pudo leer la portada del portal (${respuesta.error}); se recorrió ` +
          'hacia adelante desde el último ID revisado, como antes.',
      );
      return null;
    }

    const id = idMasRecienteDePortada(respuesta.html);
    if (id === null) {
      reporte.alertas.push(
        'La portada del portal no enlaza ninguna nota (/noticia/<id>): puede ' +
          'haber cambiado el markup. Se recorrió hacia adelante, como antes.',
      );
      return null;
    }

    reporte.idMasRecientePortal = id;

    // Un ID desproporcionado (un enlace roto, un número de otra cosa) no puede
    // convertirse en el techo del recorrido: dejaría miles de IDs "pendientes".
    if (id > cobertura.frente + this.maxSalto) {
      reporte.alertas.push(
        `La portada enlaza la nota ${id}, ${id - cobertura.frente} IDs por encima ` +
          `del último revisado (${cobertura.frente}); se ignoró por desproporcionado ` +
          'y se recorrió hacia adelante, como antes.',
      );
      return null;
    }

    return id;
  }

  /** Lee un ID, lo clasifica y, si es de Juegos Evita, lo guarda. */
  private async procesarId(
    id: number,
    reporte: ReporteSync,
  ): Promise<ResultadoId> {
    const respuesta = await this.portal.traerNota(id);

    if (!respuesta.ok) {
      // Un error de red **no** da el ID por leído: si se lo marcara, ese ID no
      // se vuelve a mirar nunca y la nota se pierde en silencio.
      reporte.erroresDeRed++;
      return 'red';
    }

    reporte.paginasLeidas++;
    const resultado = parsearNota(respuesta.html, id);

    if (!resultado.ok) {
      this.contarDescarte(reporte, resultado.motivo, id);
      return 'inexistente';
    }

    reporte.notasEncontradas++;

    if (!esDeJuegosEvita(resultado.nota)) {
      // El caso de la 33163: misma forma de URL, otra sección. Se descarta.
      reporte.descartadasPorSeccion++;
      return 'otra-seccion';
    }

    reporte.clasificadas++;
    const { creada } = await this.guardar(resultado.nota);
    if (creada) reporte.creadas++;
    else reporte.actualizadas++;
    return 'juegos-evita';
  }

  /**
   * La cobertura después de la corrida.
   *
   * El rango a cubrir es (piso, techo]. Lo cubierto es lo que ya estaba en el
   * frente más lo que esta corrida resolvió; todo lo demás queda pendiente.
   * Si queda más de un hueco (p. ej. un error de red en el medio, o una
   * corrida que no alcanzó a cubrir lo nuevo), el tramo pendiente los abarca a
   * todos: se releen algunos IDs ya vistos, pero no se pierde ninguno.
   */
  private nuevaCobertura(
    anterior: Cobertura,
    techo: number,
    resueltos: ReadonlySet<number>,
  ): Cobertura {
    let primerPendiente: number | null = null;
    let ultimoPendiente: number | null = null;

    for (let id = anterior.piso + 1; id <= techo; id++) {
      const yaCubierto = id > anterior.techoPendiente && id <= anterior.frente;
      if (yaCubierto || resueltos.has(id)) continue;
      primerPendiente ??= id;
      ultimoPendiente = id;
    }

    if (primerPendiente === null || ultimoPendiente === null) {
      return { piso: techo, techoPendiente: techo, frente: techo };
    }
    return {
      piso: primerPendiente - 1,
      techoPendiente: ultimoPendiente,
      frente: techo,
    };
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
    cobertura: Cobertura,
    encontrada: Date | null,
  ): Promise<void> {
    const ahora = new Date();
    const posicion = {
      lastScannedId: cobertura.piso,
      highestScannedId: cobertura.frente,
      pendingTopId:
        cobertura.techoPendiente > cobertura.piso
          ? cobertura.techoPendiente
          : null,
      lastRunAt: ahora,
    };
    await this.prisma.syncState.upsert({
      where: { key: CLAVE_SYNC_NOTICIAS },
      create: {
        key: CLAVE_SYNC_NOTICIAS,
        ...posicion,
        lastFoundAt: encontrada,
      },
      update: {
        ...posicion,
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
          'quedaron pendientes y se vuelven a intentar en la próxima corrida.',
      );
    }

    // Cualquier alerta anotada en el camino (p. ej. la portada ilegible) deja
    // la corrida en `alerta`: un reporte con alertas y estado `ok` se ignora.
    if (reporte.alertas.length > 0) {
      reporte.estado = 'alerta';
    }
  }
}

/** `desde`, `desde - 1`, … `hasta` (vacío si `desde < hasta`). */
function* descendente(desde: number, hasta: number): Generator<number> {
  for (let id = desde; id >= hasta; id--) yield id;
}

/** `desde`, `desde + 1`, … sin fin: lo corta el presupuesto. */
function* ascendente(desde: number): Generator<number> {
  for (let id = desde; ; id++) yield id;
}
