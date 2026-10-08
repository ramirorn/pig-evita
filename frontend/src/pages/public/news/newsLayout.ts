// ===========================================
// Reparto de las noticias en la portada editorial de /noticias
// ===========================================
import type { News } from '@/types';

/**
 * Vive aparte de `NewsPage.tsx` por la misma razón que `newsSource.ts`: un
 * módulo que exporta componentes **y** funciones sueltas rompe el fast refresh
 * de Vite y el lint del proyecto lo marca. Además así el reparto se ejercita
 * sin montar la página (`check:cards` lo recorre con 0 a 40 notas).
 */

/** Diapositivas del carrusel destacado: las 4 más recientes. */
export const NOTAS_EN_CARRUSEL = 4;
/** Tarjetas compactas de la tira superior. */
export const NOTAS_EN_TIRA = 4;
/** Piezas del mosaico "No te pierdas": una grande y cuatro chicas en 2×2. */
export const NOTAS_EN_MOSAICO = 5;
/** Renglones de la lista numerada "Más recientes". */
export const NOTAS_EN_LISTA = 5;

/**
 * Cuántas notas consume la portada cuando hay de sobra. Es también el tamaño de
 * página del pedido de la portada y del archivo de abajo: con los dos alineados,
 * "la página 2 del backend" es exactamente "lo que no entró en la portada", sin
 * desfasajes ni notas repetidas entre la portada y el archivo.
 */
export const NOTAS_EN_PORTADA =
  NOTAS_EN_CARRUSEL + NOTAS_EN_TIRA + NOTAS_EN_MOSAICO + NOTAS_EN_LISTA;

/** Mínimo de renglones para que la lista numerada valga la pena. */
const MINIMO_EN_LISTA = 3;

export interface RepartoDePortada {
  carrusel: News[];
  tira: News[];
  /** 0, 3 o 5 piezas: el mosaico sólo se arma con formas que llena. */
  mosaico: News[];
  lista: News[];
  /** Lo que no entró en la portada: va a la grilla de abajo. */
  resto: News[];
}

/**
 * Reparte las notas (ya ordenadas por fecha de publicación, de la más nueva a
 * la más vieja) entre las secciones de la portada, **sin repetir ninguna**.
 *
 * El orden de lectura de la pantalla es el orden de fecha: carrusel → tira →
 * mosaico → lista. Lo que cambia con el volumen es **cuántas** van a cada una:
 *
 * - El carrusel toma hasta 4.
 * - El mosaico sólo se arma con 5 (grande + 2×2) o 3 (grande + 2); con menos
 *   quedaría un hueco con forma de tarjeta.
 * - La lista numerada pide al menos 3 renglones; con uno o dos se ve rota y
 *   esas notas van a la tira, que se acomoda a 1–4 columnas.
 * - Con pocas notas se achica primero la tira y después la lista: el mosaico es
 *   la pieza que más pesa en la composición.
 *
 * Con 18 o más, la portada queda completa (4 + 4 + 5 + 5) y lo demás va a
 * `resto`. Con las ~14 de hoy: carrusel 4, tira 2, mosaico 5, lista 3, y
 * ninguna nota queda fuera de la pantalla.
 */
export function repartirPortada(noticias: readonly News[]): RepartoDePortada {
  const carrusel = noticias.slice(0, NOTAS_EN_CARRUSEL);
  const despues = noticias.slice(carrusel.length);

  const enMosaico =
    despues.length >= NOTAS_EN_MOSAICO ? NOTAS_EN_MOSAICO : despues.length >= 3 ? 3 : 0;
  const libres = despues.length - enMosaico;

  let enTira: number;
  let enLista: number;
  if (libres >= NOTAS_EN_TIRA + NOTAS_EN_LISTA) {
    enTira = NOTAS_EN_TIRA;
    enLista = NOTAS_EN_LISTA;
  } else if (libres >= NOTAS_EN_TIRA + MINIMO_EN_LISTA) {
    enTira = NOTAS_EN_TIRA;
    enLista = libres - NOTAS_EN_TIRA;
  } else if (libres >= MINIMO_EN_LISTA) {
    enLista = MINIMO_EN_LISTA;
    enTira = libres - MINIMO_EN_LISTA;
  } else {
    enLista = 0;
    enTira = libres;
  }

  const tira = despues.slice(0, enTira);
  const mosaico = despues.slice(enTira, enTira + enMosaico);
  const lista = despues.slice(enTira + enMosaico, enTira + enMosaico + enLista);
  const resto = despues.slice(enTira + enMosaico + enLista);

  return { carrusel, tira, mosaico, lista, resto };
}
