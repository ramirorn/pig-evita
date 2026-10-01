// ===========================================
// useHeatImage — el calor del mapa como imagen (canvas → blob URL)
// ===========================================
import { useEffect, useState } from 'react';
import {
  buildColorTable,
  colorizeHeatField,
  computeHeatField,
  HEAT_STOPS,
  type HeatPoint,
} from '@/lib/localityMap';

/**
 * Píxeles por unidad del viewBox: 1000 × 1017 → 1500 × 1526. Alcanza para
 * retina a 1× y para un zoom razonable; a 8× se ve algo suave, pero el calor
 * es difuso y no se nota.
 */
const ESCALA = 1.5;

/** Hex de un token del tema, resuelto en el navegador (nada de hex sueltos). */
function hexDelTema(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim();
}

/**
 * Calcula el calor **una vez por conjunto de puntos** (o sea, por métrica y
 * datos) y lo devuelve como URL de una imagen que el mapa pone dentro del grupo
 * que hace zoom. Arrastrar o acercar no recalcula nada: el navegador sólo
 * transforma la imagen.
 *
 * Sin puntos (todo en cero) devuelve `null`: no se pinta calor. La URL vieja se
 * libera al cambiar de métrica y al desmontar.
 */
export function useHeatImage(puntos: readonly HeatPoint[], ancho: number, alto: number): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (puntos.length === 0) {
      setUrl(null);
      return;
    }
    let cancelado = false;
    let creada: string | null = null;

    const { data, width, height } = computeHeatField(puntos, ancho, alto, ESCALA);
    const tabla = buildColorTable(HEAT_STOPS.map((s) => hexDelTema(s.token)));
    const pixeles = colorizeHeatField(data, tabla);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(pixeles, width, height), 0, 0);
    canvas.toBlob((blob) => {
      if (!blob || cancelado) return;
      creada = URL.createObjectURL(blob);
      setUrl(creada);
    });

    return () => {
      cancelado = true;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [puntos, ancho, alto]);

  return url;
}
