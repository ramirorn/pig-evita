// ===========================================
// S19 — El sync: clasificación, idempotencia y falla ruidosa
// ===========================================
//
// Los HTML que sirve el portal falso son los **fixtures reales** de
// `test/fixtures/`: si el markup del portal cambia, este test se cae junto con
// el del parser en vez de seguir verde sobre un string inventado.
//
// El doble de Prisma modela el `UNIQUE` de `news.source_url` **de verdad**. Es
// la lección de S01, que costó cara: un doble complaciente que acepta un
// duplicado hace pasar por igual al código idempotente y al que no lo es, así
// que el test de idempotencia no probaría nada.
import { ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NewsSyncService, CLAVE_SYNC_NOTICIAS } from './news-sync.service';
import { decodificarHtml } from './formosa-news.parser';
import type { FormosaPortalClient } from './formosa-portal.client';
import type { PrismaService } from '../../../database/prisma.service';
import type { ConfigService } from '@nestjs/config';

const FIXTURES = join(__dirname, '../../../../test/fixtures');
const leer = (n: string) => decodificarHtml(readFileSync(join(FIXTURES, n)));

const HTML_EVITA = leer('noticia-34709-juegos-evita.html');
const HTML_OTRA_SECCION = leer('noticia-33163-otra-seccion.html');
const HTML_INEXISTENTE = leer('noticia-inexistente.html');

// -------------------------------------------------
// Doble de Prisma con las restricciones que importan
// -------------------------------------------------
interface FilaNoticia {
  id: string;
  slug: string;
  sourceUrl: string | null;
  [clave: string]: unknown;
}

class PrismaFalso {
  filasNoticias: FilaNoticia[] = [];
  filaSyncState: Record<string, unknown> | null = null;
  private secuencia = 0;

  news = {
    findUnique: ({ where }: { where: { sourceUrl?: string } }) =>
      Promise.resolve(
        this.filasNoticias.find((f) => f.sourceUrl === where.sourceUrl) ?? null,
      ),
    upsert: ({
      where,
      create,
      update,
    }: {
      where: { sourceUrl: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const existente = this.filasNoticias.find(
        (f) => f.sourceUrl === where.sourceUrl,
      );

      if (existente) {
        Object.assign(existente, update);
        return Promise.resolve(existente);
      }

      // Las dos columnas `unique` del esquema, modeladas: si el código pisara
      // una fila ajena por slug o repitiera el sourceUrl, acá explota igual que
      // en Postgres.
      const slug = String(create.slug);
      if (this.filasNoticias.some((f) => f.slug === slug)) {
        return Promise.reject(
          new Error(`Unique constraint failed on news.slug (${slug})`),
        );
      }

      const fila: FilaNoticia = {
        ...create,
        id: `noticia-${++this.secuencia}`,
        slug,
        sourceUrl: where.sourceUrl,
      };
      this.filasNoticias.push(fila);
      return Promise.resolve(fila);
    },
  };

  syncState = {
    findUnique: ({ where }: { where: { key: string } }) =>
      Promise.resolve(
        this.filaSyncState && this.filaSyncState.key === where.key
          ? this.filaSyncState
          : null,
      ),
    upsert: ({
      create,
      update,
    }: {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      this.filaSyncState = this.filaSyncState
        ? { ...this.filaSyncState, ...update }
        : { ...create };
      return Promise.resolve(this.filaSyncState);
    },
  };
}

// -------------------------------------------------
// Portal falso: sirve fixtures reales por ID
// -------------------------------------------------
class PortalFalso {
  pedidos: number[] = [];
  caidos = new Set<number>();
  /**
   * HTML de la portada. `null` = la portada no responde, que es el escenario
   * del recorrido secuencial (el comportamiento anterior). Los tests del
   * recorrido "lo más nuevo primero" la arman con `portadaQueEnlaza`.
   */
  portada: string | null = null;
  pedidosDePortada = 0;

  constructor(private readonly paginas: Record<number, string>) {}

  esperarEntreRequests() {
    return Promise.resolve();
  }

  traerPortada() {
    this.pedidosDePortada++;
    if (this.portada === null) {
      return Promise.resolve({ ok: false as const, error: 'HTTP 503' });
    }
    return Promise.resolve({ ok: true as const, html: this.portada });
  }

  traerNota(id: number) {
    this.pedidos.push(id);
    if (this.caidos.has(id)) {
      return Promise.resolve({
        ok: false as const,
        error: 'ECONNRESET',
      });
    }
    return Promise.resolve({
      ok: true as const,
      html: this.paginas[id] ?? HTML_INEXISTENTE,
    });
  }
}

function configFalso(overrides: Record<string, number | string> = {}) {
  const valores: Record<string, number | string> = {
    NEWS_SYNC_START_ID: 34708,
    NEWS_SYNC_CANARY_ID: 34709,
    NEWS_SYNC_MAX_IDS: 5,
    NEWS_SYNC_MAX_FALLOS: 5,
    NEWS_SYNC_MAX_DIAS_SIN_NOTAS: 30,
    ...overrides,
  };
  return {
    get: (clave: string, porDefecto: unknown) =>
      clave in valores ? valores[clave] : porDefecto,
  } as unknown as ConfigService;
}

function armar(
  paginas: Record<number, string>,
  overrides?: Record<string, number | string>,
) {
  const prisma = new PrismaFalso();
  const portal = new PortalFalso(paginas);
  const service = new NewsSyncService(
    prisma as unknown as PrismaService,
    portal as unknown as FormosaPortalClient,
    configFalso(overrides),
  );
  return { prisma, portal, service };
}

/** El escenario del DoD: la 34709 entra, la de otra sección se descarta. */
const ESCENARIO_DEL_DOD = {
  34709: HTML_EVITA, // "Las chicas de Belgrano, campeonas" — Juegos Evita
  34710: HTML_OTRA_SECCION, // "Día de la Escarapela" — Información Pública
};

// Salvo en el bloque "recorrido desde la portada", el portal falso no sirve la
// portada: esos tests ejercitan el recorrido secuencial, que es el
// comportamiento anterior y el respaldo cuando la portada no se puede leer.
describe('NewsSyncService', () => {
  describe('clasificación', () => {
    it('trae la 34709 y descarta la nota de otra sección', async () => {
      const { prisma, service } = armar(ESCENARIO_DEL_DOD);

      const reporte = await service.sincronizar('manual');

      expect(reporte.clasificadas).toBe(1);
      expect(reporte.creadas).toBe(1);
      expect(reporte.descartadasPorSeccion).toBe(1);
      expect(prisma.filasNoticias).toHaveLength(1);

      const guardada = prisma.filasNoticias[0];
      expect(guardada.title).toBe('Las chicas de Belgrano, campeonas');
      expect(guardada.sourceUrl).toBe(
        'https://www.formosa.gob.ar/noticia/34709/0/x',
      );
      expect(guardada.isExternal).toBe(true);
      expect(guardada.isPublished).toBe(true);
    });

    it('enlaza, no republica: no guarda el cuerpo del artículo', async () => {
      const { prisma, service } = armar(ESCENARIO_DEL_DOD);
      await service.sincronizar('manual');

      const guardada = JSON.stringify(prisma.filasNoticias[0]);
      // Nombres que están en el cuerpo de la nota y no en los tags OG.
      expect(guardada).not.toContain('Marisol Eguez');
      expect(guardada).not.toContain('<p>');
    });

    it('guarda la fecha del portal, no la de la corrida', async () => {
      const { prisma, service } = armar(ESCENARIO_DEL_DOD);
      await service.sincronizar('manual');

      expect((prisma.filasNoticias[0].publishedAt as Date).toISOString()).toBe(
        '2026-08-29T12:00:00.000Z',
      );
    });
  });

  describe('idempotencia', () => {
    it('correrlo dos veces sobre los mismos IDs no duplica filas', async () => {
      const { prisma, service } = armar(ESCENARIO_DEL_DOD);

      const primera = await service.sincronizar('manual');
      // Se retrocede el cursor a mano para forzar el reprocesamiento: es el
      // escenario que rompería, no el de "no hay nada nuevo", que es trivial.
      prisma.filaSyncState = {
        key: CLAVE_SYNC_NOTICIAS,
        lastScannedId: 34708,
        lastFoundAt: new Date(),
      };
      const segunda = await service.sincronizar('manual');

      expect(primera.creadas).toBe(1);
      expect(segunda.creadas).toBe(0);
      expect(segunda.actualizadas).toBe(1);
      expect(prisma.filasNoticias).toHaveLength(1);
    });

    it('el cursor avanza, así que la corrida siguiente no repite el recorrido', async () => {
      const { prisma, portal, service } = armar(ESCENARIO_DEL_DOD);

      await service.sincronizar('manual');
      const cursor = prisma.filaSyncState?.lastScannedId;
      const pedidosPrimera = portal.pedidos.length;

      await service.sincronizar('manual');

      expect(cursor).toBe(34713); // 34709..34713, cinco IDs de presupuesto
      expect(portal.pedidos.length).toBeGreaterThan(pedidosPrimera);
      expect(portal.pedidos.slice(pedidosPrimera)).not.toContain(34710);
    });
  });

  describe('falla ruidosamente (el modo de falla que ya se cometió tres veces)', () => {
    it('si la nota de control deja de clasificar, aborta en vez de traer cero', async () => {
      // El portal renombró la sección: todo "funciona", pero no entra nada.
      const { prisma, service } = armar({
        34709: HTML_EVITA.replace(/juegos_evita_formosenos/g, 'otro_slug'),
      });

      await expect(service.sincronizar('manual')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(prisma.filasNoticias).toHaveLength(0);
    });

    it('si desaparecen los tags Open Graph, aborta', async () => {
      const { service } = armar({
        34709: HTML_EVITA.replace(/<meta property="og:[^>]*>/g, ''),
      });

      await expect(service.sincronizar('manual')).rejects.toThrow(
        /dejó de parsearse/,
      );
    });

    it('si el portal no responde, aborta (no informa "0 noticias nuevas")', async () => {
      const { portal, service } = armar(ESCENARIO_DEL_DOD);
      portal.caidos.add(34709);

      await expect(service.sincronizar('manual')).rejects.toThrow(
        /no responde/,
      );
    });

    it('hace semanas que no entra una nota: termina en alerta, no en verde', async () => {
      const prisma = new PrismaFalso();
      prisma.filaSyncState = {
        key: CLAVE_SYNC_NOTICIAS,
        lastScannedId: 34709,
        lastFoundAt: new Date(Date.now() - 90 * 86_400_000),
      };
      // La nota de control sigue sana: no es que el portal cambió, es que hace
      // 90 días que no aparece nada. Se informa igual.
      const service2 = new NewsSyncService(
        prisma as unknown as PrismaService,
        new PortalFalso({
          34709: HTML_EVITA,
        }) as unknown as FormosaPortalClient,
        configFalso(),
      );

      const reporte = await service2.sincronizar('programada');

      expect(reporte.clasificadas).toBe(0);
      expect(reporte.estado).toBe('alerta');
      expect(reporte.alertas.join(' ')).toMatch(/no entra una nota/);
    });

    it('un error de red en el medio no avanza el cursor sobre ese ID', async () => {
      const { prisma, portal, service } = armar({
        34709: HTML_EVITA,
        34711: HTML_EVITA,
      });
      portal.caidos.add(34710);

      const reporte = await service.sincronizar('manual');

      expect(reporte.erroresDeRed).toBe(1);
      expect(reporte.estado).toBe('alerta');
      // El cursor frena en 34709: el 34710 no se leyó y hay que volver a él.
      expect(prisma.filaSyncState?.lastScannedId).toBe(34709);
    });

    it('el reporte dice cuántos IDs miró, no sólo cuántas trajo', async () => {
      const { service } = armar(ESCENARIO_DEL_DOD);
      const reporte = await service.sincronizar('manual');

      expect(reporte.desdeId).toBe(34709);
      expect(reporte.hastaId).toBe(34713);
      expect(reporte.paginasLeidas).toBe(5);
      expect(reporte.notasEncontradas).toBe(2);
    });
  });

  // -------------------------------------------------
  // Lo más nuevo primero (la portada dice hasta dónde llega el portal)
  // -------------------------------------------------
  describe('recorrido desde la portada: lo más nuevo primero', () => {
    /** Una portada mínima que enlaza esas notas, como la real (`/noticia/<id>/...`). */
    const portadaQueEnlaza = (...ids: number[]) =>
      ids.map((id) => `<a href="/noticia/${id}/12/titulo">nota</a>`).join('');

    /** Los IDs pedidos en una corrida, sin el canario (que va primero). */
    const recorridoDe = (portal: PortalFalso, desde: number) =>
      portal.pedidos.slice(desde + 1);

    it('arranca por la nota más nueva y baja, aunque el cursor esté atrás', async () => {
      const { prisma, portal, service } = armar({
        34709: HTML_EVITA,
        34720: HTML_EVITA,
        34719: HTML_OTRA_SECCION,
      });
      // Una nota vieja enlazada en un banner no puede ser el techo.
      portal.portada = portadaQueEnlaza(34572, 34720, 34715);

      const reporte = await service.sincronizar('manual');

      // Tope de 5: 34720 → 34716. Lo de abajo queda para la próxima.
      expect(recorridoDe(portal, 0)).toEqual([
        34720, 34719, 34718, 34717, 34716,
      ]);
      expect(reporte.modo).toBe('portada');
      expect(reporte.idMasRecientePortal).toBe(34720);
      expect(reporte.idsRevisados).toBe(5);
      expect(reporte.desdeId).toBe(34716);
      expect(reporte.hastaId).toBe(34720);
      expect(reporte.creadas).toBe(1);
      expect(prisma.filasNoticias[0].sourceUrl).toBe(
        'https://www.formosa.gob.ar/noticia/34720/0/x',
      );
      // Nada se da por visto sin leerse: 34709..34715 quedan pendientes.
      expect(reporte.pendiente).toEqual({ desdeId: 34709, hastaId: 34715 });
      expect(prisma.filaSyncState).toMatchObject({
        lastScannedId: 34708,
        pendingTopId: 34715,
        highestScannedId: 34720,
      });
      expect(reporte.estado).toBe('ok');
    });

    it('un hueco mayor que el tope se completa en corridas sucesivas, primero lo nuevo de cada día', async () => {
      const { prisma, portal, service } = armar({
        34709: HTML_EVITA,
        34714: HTML_EVITA,
        34720: HTML_EVITA,
        34723: HTML_EVITA,
      });

      // Corrida 1: el portal llega a la 34720.
      portal.portada = portadaQueEnlaza(34720);
      await service.sincronizar('programada');
      expect(recorridoDe(portal, 0)).toEqual([
        34720, 34719, 34718, 34717, 34716,
      ]);

      // Corrida 2: se publicaron 3 notas más. Primero esas, después el pendiente.
      portal.portada = portadaQueEnlaza(34723);
      let desde = portal.pedidos.length;
      const segunda = await service.sincronizar('programada');
      expect(recorridoDe(portal, desde)).toEqual([
        34723, 34722, 34721, 34715, 34714,
      ]);
      expect(segunda.pendiente).toEqual({ desdeId: 34709, hastaId: 34713 });

      // Corrida 3: sin novedades en el portal, termina el tramo pendiente.
      desde = portal.pedidos.length;
      const tercera = await service.sincronizar('programada');
      expect(recorridoDe(portal, desde)).toEqual([
        34713, 34712, 34711, 34710, 34709,
      ]);
      expect(tercera.pendiente).toBeNull();

      // Ningún ID perdido, y ninguno leído dos veces.
      const recorridos = portal.pedidos.filter(
        (_, i) => ![0, 6, 12].includes(i), // los tres canarios
      );
      expect([...recorridos].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 15 }, (_, i) => 34709 + i),
      );
      expect(prisma.filasNoticias.map((f) => f.sourceUrl).sort()).toEqual(
        [34709, 34714, 34720, 34723].map(
          (id) => `https://www.formosa.gob.ar/noticia/${id}/0/x`,
        ),
      );
      expect(prisma.filaSyncState).toMatchObject({
        lastScannedId: 34723,
        pendingTopId: null,
        highestScannedId: 34723,
      });

      // Corrida 4: todo cubierto y nada nuevo: no se pide ninguna nota.
      desde = portal.pedidos.length;
      const cuarta = await service.sincronizar('programada');
      expect(recorridoDe(portal, desde)).toEqual([]);
      expect(cuarta.idsRevisados).toBe(0);
      expect(cuarta.desdeId).toBeNull();
    });

    it('si lo nuevo de un día supera el tope, no se pierde nada (a lo sumo se relee)', async () => {
      const { prisma, portal, service } = armar(
        { 34709: HTML_EVITA },
        { NEWS_SYNC_MAX_IDS: 4 },
      );
      let maximo = 34712;
      const vistos = new Set<number>();
      let corridas = 0;

      // Cada "día" el portal publica 6 IDs y el tope es 4: lo nuevo no entra
      // entero en una corrida durante varios días seguidos.
      do {
        portal.portada = portadaQueEnlaza(maximo);
        const desde = portal.pedidos.length;
        await service.sincronizar('programada');
        recorridoDe(portal, desde).forEach((id) => vistos.add(id));
        if (corridas < 3) maximo += 6;
        corridas++;
      } while (
        (prisma.filaSyncState?.pendingTopId !== null ||
          prisma.filaSyncState?.highestScannedId !== maximo) &&
        corridas < 50
      );

      for (let id = 34709; id <= maximo; id++) {
        expect(vistos.has(id)).toBe(true);
      }
      expect(prisma.filaSyncState).toMatchObject({
        lastScannedId: maximo,
        highestScannedId: maximo,
        pendingTopId: null,
      });
    });

    it('un error de red deja el ID pendiente y la corrida siguiente lo relee', async () => {
      const { prisma, portal, service } = armar(
        { 34709: HTML_EVITA, 34711: HTML_EVITA, 34710: HTML_EVITA },
        { NEWS_SYNC_MAX_IDS: 10 },
      );
      portal.portada = portadaQueEnlaza(34712);
      portal.caidos.add(34710);

      const primera = await service.sincronizar('manual');
      expect(recorridoDe(portal, 0)).toEqual([34712, 34711, 34710, 34709]);
      expect(primera.erroresDeRed).toBe(1);
      expect(primera.estado).toBe('alerta');
      expect(primera.pendiente).toEqual({ desdeId: 34710, hastaId: 34710 });

      portal.caidos.clear();
      const desde = portal.pedidos.length;
      const segunda = await service.sincronizar('manual');
      expect(recorridoDe(portal, desde)).toEqual([34710]);
      expect(segunda.pendiente).toBeNull();
      expect(prisma.filasNoticias).toHaveLength(3);
    });

    it('retoma una fila de `sync_state` anterior a esta versión (sólo el cursor)', async () => {
      const { prisma, portal, service } = armar({
        34709: HTML_EVITA,
        34890: HTML_EVITA,
      });
      prisma.filaSyncState = {
        key: CLAVE_SYNC_NOTICIAS,
        lastScannedId: 34888,
        lastFoundAt: new Date(),
      };
      portal.portada = portadaQueEnlaza(34890);

      await service.sincronizar('manual');

      expect(recorridoDe(portal, 0)).toEqual([34890, 34889]);
      expect(prisma.filaSyncState).toMatchObject({
        lastScannedId: 34890,
        highestScannedId: 34890,
      });
    });

    it('portada ilegible: cae al recorrido anterior (hacia adelante) y lo avisa', async () => {
      const { portal, service } = armar(ESCENARIO_DEL_DOD);
      portal.portada = null;

      const reporte = await service.sincronizar('manual');

      expect(recorridoDe(portal, 0)).toEqual([
        34709, 34710, 34711, 34712, 34713,
      ]);
      expect(reporte.modo).toBe('secuencial');
      expect(reporte.idMasRecientePortal).toBeNull();
      expect(reporte.clasificadas).toBe(1);
      expect(reporte.estado).toBe('alerta');
      expect(reporte.alertas.join(' ')).toMatch(/portada/);
    });

    it('portada sin enlaces a notas: también cae al recorrido anterior', async () => {
      const { portal, service } = armar(ESCENARIO_DEL_DOD);
      portal.portada = '<html><body>Sitio en mantenimiento</body></html>';

      const reporte = await service.sincronizar('manual');

      expect(reporte.modo).toBe('secuencial');
      expect(recorridoDe(portal, 0)[0]).toBe(34709);
      expect(reporte.alertas.join(' ')).toMatch(/no enlaza ninguna nota/);
    });

    it('un ID desproporcionado en la portada no se vuelve el techo del recorrido', async () => {
      const { prisma, portal, service } = armar(ESCENARIO_DEL_DOD);
      portal.portada = portadaQueEnlaza(34720, 99_999_999);

      const reporte = await service.sincronizar('manual');

      expect(reporte.modo).toBe('secuencial');
      expect(reporte.alertas.join(' ')).toMatch(/desproporcionado/);
      expect(prisma.filaSyncState?.highestScannedId).toBe(34713);
    });

    it('el canario sigue siendo obligatorio: con la portada sana igual aborta', async () => {
      const { portal, service } = armar({
        34709: HTML_EVITA.replace(/juegos_evita_formosenos/g, 'otro_slug'),
      });
      portal.portada = portadaQueEnlaza(34720);

      await expect(service.sincronizar('manual')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      // Abortó antes de leer la portada o de recorrer nada.
      expect(portal.pedidosDePortada).toBe(0);
      expect(portal.pedidos).toEqual([34709]);
    });

    it('idempotente también en este modo: releer el mismo tramo no duplica', async () => {
      const { prisma, portal, service } = armar({
        34709: HTML_EVITA,
        34712: HTML_EVITA,
      });
      portal.portada = portadaQueEnlaza(34712);

      await service.sincronizar('manual');
      prisma.filaSyncState = {
        key: CLAVE_SYNC_NOTICIAS,
        lastScannedId: 34708,
        lastFoundAt: new Date(),
      };
      const segunda = await service.sincronizar('manual');

      expect(segunda.actualizadas).toBe(2);
      expect(segunda.creadas).toBe(0);
      expect(prisma.filasNoticias).toHaveLength(2);
    });
  });

  describe('respeto por el sitio ajeno', () => {
    it('el recorrido tiene tope: no barre el portal entero', async () => {
      const { portal, service } = armar(ESCENARIO_DEL_DOD, {
        NEWS_SYNC_MAX_IDS: 3,
      });

      await service.sincronizar('manual');

      // 1 request de la nota de control + 3 del recorrido.
      expect(portal.pedidos).toHaveLength(4);
    });

    it('corta cuando encuentra varios IDs inexistentes seguidos', async () => {
      const { portal, service } = armar(ESCENARIO_DEL_DOD, {
        NEWS_SYNC_MAX_IDS: 50,
        NEWS_SYNC_MAX_FALLOS: 2,
      });

      await service.sincronizar('manual');

      // Control + 34709 (nota) + 34710 (nota) + 34711 y 34712 (inexistentes).
      expect(portal.pedidos).toHaveLength(5);
    });
  });
});
