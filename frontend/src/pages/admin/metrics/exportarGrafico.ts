// ===========================================
// exportarGrafico — PNG del gráfico y descarga de CSV
// ===========================================
//
// Sin dependencias: el SVG que dibuja recharts se serializa, se pinta en un
// canvas y se descarga como PNG. Los colores del tema viajan como
// `var(--color-…)`, que fuera de la página no resuelven; por eso antes de
// serializar se copian a cada nodo los valores ya calculados por el navegador.

const PROPIEDADES_COLOR = ['fill', 'stroke', 'color', 'stop-color'] as const;

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV con BOM: así Excel en español abre bien las tildes. */
export function descargarCsv(contenido: string, nombre: string) {
  descargar(new Blob(['﻿', contenido], { type: 'text/csv;charset=utf-8' }), nombre);
}

/** Fija en el clon los colores calculados del original (resuelve las variables CSS). */
function fijarColores(original: Element, clon: Element) {
  const estilo = window.getComputedStyle(original);
  for (const propiedad of PROPIEDADES_COLOR) {
    const valor = estilo.getPropertyValue(propiedad);
    if (valor && valor !== 'none') (clon as SVGElement).style.setProperty(propiedad, valor);
  }
  const hijosOriginal = original.children;
  const hijosClon = clon.children;
  for (let i = 0; i < hijosOriginal.length; i++) {
    const a = hijosOriginal[i];
    const b = hijosClon[i];
    if (a && b) fijarColores(a, b);
  }
}

/**
 * Exporta el primer `<svg>` del contenedor como PNG con fondo blanco y escala
 * 2× (legible al pegarlo en un informe). Devuelve `false` si no hay gráfico.
 */
export async function exportarSvgComoPng(contenedor: HTMLElement, nombre: string): Promise<boolean> {
  const svg = contenedor.querySelector('svg');
  if (!svg) return false;

  const { width, height } = svg.getBoundingClientRect();
  const clon = svg.cloneNode(true) as SVGSVGElement;
  fijarColores(svg, clon);
  clon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clon.setAttribute('width', String(width));
  clon.setAttribute('height', String(height));

  const texto = new XMLSerializer().serializeToString(clon);
  const imagen = new Image();
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    await new Promise<void>((resolver, rechazar) => {
      imagen.onload = () => resolver();
      imagen.onerror = () => rechazar(new Error('No se pudo convertir el gráfico'));
      imagen.src = url;
    });

    const escala = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * escala);
    canvas.height = Math.ceil(height * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(escala, escala);
    ctx.drawImage(imagen, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return false;
    descargar(blob, nombre);
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}
