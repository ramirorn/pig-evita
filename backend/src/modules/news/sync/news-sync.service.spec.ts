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

  constructor(private readonly paginas: Record<number, string>) {}

  esperarEntreRequests() {
    return Promise.resolve();
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
