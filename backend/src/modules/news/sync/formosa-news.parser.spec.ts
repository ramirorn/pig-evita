// ===========================================
// S19 — El parseo, contra el HTML REAL del portal
// ===========================================
//
// Los fixtures de `test/fixtures/` son las páginas tal como las devolvió
// formosa.gob.ar el 2026-08-31, bytes incluidos (ISO-8859-1 sin tocar). No hay
// ni un string inventado en este archivo, y es el punto: el día que el portal
// cambie el markup, este test es el que lo dice. Si alguien lo hace pasar
// editando el fixture, borró la única señal que teníamos.
//
// Para volver a bajarlos:
//   curl -A "JuegosEvitaFormosa-SyncBot/1.0" \
//     -o test/fixtures/noticia-34709-juegos-evita.html \
//     https://www.formosa.gob.ar/noticia/34709/0/x
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  decodificarHtml,
  esDeJuegosEvita,
  esPlantillaSinNota,
  leerOpenGraph,
  parsearNota,
  slugDeNotaExterna,
  urlDeNota,
} from './formosa-news.parser';

const FIXTURES = join(__dirname, '../../../../test/fixtures');

function fixture(nombre: string): string {
  return decodificarHtml(readFileSync(join(FIXTURES, nombre)));
}

/** 34709 — "Las chicas de Belgrano, campeonas". SÍ es de Juegos Evita. */
const HTML_JUEGOS_EVITA = fixture('noticia-34709-juegos-evita.html');
/** 33163 — "Día de la Escarapela". NO lo es, aunque comparta el 671 en la URL. */
const HTML_OTRA_SECCION = fixture('noticia-33163-otra-seccion.html');
/** 34710 — un ID que todavía no existe. El portal devuelve 200 igual. */
const HTML_INEXISTENTE = fixture('noticia-inexistente.html');

describe('formosa-news.parser (contra HTML real del portal)', () => {
  describe('la nota 34709, que sí es de Juegos Evita', () => {
    const resultado = parsearNota(HTML_JUEGOS_EVITA, 34709);

    it('parsea', () => {
      expect(resultado.ok).toBe(true);
    });

    it('clasifica como Juegos Evita por el slug de "Cargada en"', () => {
      if (!resultado.ok) throw new Error('no parseó');
      expect(resultado.nota.seccionSlug).toBe('juegos_evita_formosenos');
      expect(esDeJuegosEvita(resultado.nota)).toBe(true);
    });

    it('saca título, bajada e imagen de los tags Open Graph', () => {
      if (!resultado.ok) throw new Error('no parseó');
      expect(resultado.nota.titulo).toBe('Las chicas de Belgrano, campeonas');
      expect(resultado.nota.bajada).toContain(
        'Provincial de fútbol femenino sub 18 de los Juegos Evita Formoseños',
      );
      expect(resultado.nota.imagenUrl).toBe(
        'https://archivos.formosa.gob.ar/media/uploads/imagenes_noticias/imagen_noticia_d27f631e8eb8851697cc881a2f9b2ca6-0.jpeg',
      );
    });

    it('decodifica el ISO-8859-1 del portal: los acentos llegan bien', () => {
      if (!resultado.ok) throw new Error('no parseó');
      // Si esto se leyera como UTF-8, acá habría caracteres de reemplazo.
      expect(resultado.nota.bajada).toContain('Ingeniero Juárez');
      expect(resultado.nota.seccionNombre).toBe('Juegos Evita Formoseños');
      expect(resultado.nota.bajada).not.toContain('�');
      expect(resultado.nota.titulo).not.toContain('�');
    });

    it('lee la fecha del pie (29-08-2026, en DD-MM-AAAA)', () => {
      if (!resultado.ok) throw new Error('no parseó');
      expect(resultado.nota.fecha?.toISOString()).toBe(
        '2026-08-29T12:00:00.000Z',
      );
    });

    it('atribuye la fuente que declara el propio portal', () => {
      if (!resultado.ok) throw new Error('no parseó');
      expect(resultado.nota.fuente).toBe(
        'Secretaría de Deportes y Recreación Comunitaria',
      );
    });

    it('guarda el link al original y no el cuerpo del artículo', () => {
      if (!resultado.ok) throw new Error('no parseó');
      expect(resultado.nota.sourceUrl).toBe(
        'https://www.formosa.gob.ar/noticia/34709/0/x',
      );
      // Enlaza, no republica (T11): nada de lo que se guarda puede traer el
      // texto del artículo ni una sola etiqueta HTML ajena.
      const guardado = JSON.stringify(resultado.nota);
      expect(guardado).not.toContain('Marisol Eguez'); // está en el cuerpo
      expect(guardado).not.toContain('<p>');
    });
  });

  describe('la nota 33163, que comparte el 671 en la URL y NO es de Juegos Evita', () => {
    const resultado = parsearNota(HTML_OTRA_SECCION, 33163);

    it('parsea (es una nota real, no una página vacía)', () => {
      expect(resultado.ok).toBe(true);
    });

    it('se descarta: la sección es Información Pública', () => {
      if (!resultado.ok) throw new Error('no parseó');
      expect(resultado.nota.titulo).toBe('DIA DE LA ESCARAPELA');
      expect(resultado.nota.seccionSlug).toBe('informacion_publica');
      expect(esDeJuegosEvita(resultado.nota)).toBe(false);
    });

    it('el 671 del medio de la URL NO alcanza para distinguirlas', () => {
      // Ésta es la contraprueba escrita del camino descartado: las dos notas
      // llevan el mismo número en la URL real del portal
      // (/noticia/33163/671/... y /noticia/34709/671/...) y son de secciones
      // distintas. Cualquier clasificador que mire ese número trae las dos.
      const evita = parsearNota(HTML_JUEGOS_EVITA, 34709);
      if (!resultado.ok || !evita.ok) throw new Error('no parseó');
      expect(resultado.nota.seccionSlug).not.toBe(evita.nota.seccionSlug);
    });
  });

  describe('un ID que no existe', () => {
    it('el portal responde 200 con la plantilla sin rellenar, no 404', () => {
      // El hallazgo que evitaba guardar basura: si esto se decidiera por status
      // code, cada ID inventado entraría como noticia.
      expect(esPlantillaSinNota(HTML_INEXISTENTE)).toBe(true);
      expect(leerOpenGraph(HTML_INEXISTENTE, 'title')).toContain(
        'Portal Oficial del Gobierno de la Provincia de Formosa',
      );
    });

    it('se descarta como "inexistente" y no llega a guardarse', () => {
      const resultado = parsearNota(HTML_INEXISTENTE, 34710);
      expect(resultado).toEqual({ ok: false, motivo: 'inexistente' });
    });

    it('las notas reales no se confunden con la plantilla', () => {
      expect(esPlantillaSinNota(HTML_JUEGOS_EVITA)).toBe(false);
      expect(esPlantillaSinNota(HTML_OTRA_SECCION)).toBe(false);
    });
  });

  describe('detección de cambios de markup', () => {
    it('si desaparecen los tags Open Graph, lo dice (no devuelve nada vacío)', () => {
      const sinOg = HTML_JUEGOS_EVITA.replace(/<meta property="og:[^>]*>/g, '');
      expect(parsearNota(sinOg, 34709)).toEqual({
        ok: false,
        motivo: 'sin-open-graph',
      });
    });

    it('si desaparece el bloque "Cargada en", lo dice', () => {
      const sinSeccion = HTML_JUEGOS_EVITA.replace(
        /Cargada en/g,
        'Publicada en',
      );
      expect(parsearNota(sinSeccion, 34709)).toEqual({
        ok: false,
        motivo: 'sin-seccion',
      });
    });

    it('si la sección cambia de slug, la nota deja de clasificar', () => {
      const otroSlug = HTML_JUEGOS_EVITA.replace(
        /juegos_evita_formosenos/g,
        'deportes_provinciales',
      );
      const resultado = parsearNota(otroSlug, 34709);
      if (!resultado.ok) throw new Error('no parseó');
      expect(esDeJuegosEvita(resultado.nota)).toBe(false);
    });
  });

  describe('utilidades', () => {
    it('la URL de una nota usa sólo el ID: los otros segmentos son cosméticos', () => {
      expect(urlDeNota(34709)).toBe(
        'https://www.formosa.gob.ar/noticia/34709/0/x',
      );
    });

    it('el slug propio lleva el ID del portal, así que nunca colisiona', () => {
      const resultado = parsearNota(HTML_JUEGOS_EVITA, 34709);
      if (!resultado.ok) throw new Error('no parseó');
      expect(slugDeNotaExterna(resultado.nota)).toBe(
        'las-chicas-de-belgrano-campeonas-formosa-34709',
      );
    });

    it('descarta una imagen que no venga por https', () => {
      const http = HTML_JUEGOS_EVITA.replace(
        'content="https://archivos.formosa.gob.ar',
        'content="http://archivos.formosa.gob.ar',
      );
      const resultado = parsearNota(http, 34709);
      if (!resultado.ok) throw new Error('no parseó');
      // `safeImageSrc` del frontend (T17) la rechazaría igual; no la guardamos.
      expect(resultado.nota.imagenUrl).toBeNull();
    });
  });
});
