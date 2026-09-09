// ===========================================
// gridVolumen — el reparto de columnas según cuántas tarjetas haya
// ===========================================

/**
 * Vive en `lib/` y no al lado de una página por la misma razón que
 * `newsLayout.ts`: un módulo que exporta componentes **y** funciones sueltas
 * rompe el fast refresh de Vite y el lint del proyecto lo marca. Además así la
 * función se ejercita sin montar ninguna página, que es lo que hace
 * `scripts/check-public-cards.mjs`.
 */

/**
 * Devuelve las clases de columnas de la grilla en función de **cuántos ítems
 * hay que repartir**.
 *
 * Es el mismo principio que `repartir()` en noticias: el layout es función del
 * volumen, para que la pantalla se vea deliberada hoy con 3 filas y siga
 * viéndose bien cuando haya 60, sin que nadie vuelva a tocar la grilla a mano.
 *
 * ## Tabla de cortes (la misma de §3.3 del plan, acá para que no haya que ir a
 * buscarla al documento)
 *
 * | Cantidad | Columnas                                            | Por qué |
 * |----------|-----------------------------------------------------|---------|
 * | 0        | `grid-cols-1`                                       | No se pinta nada; el valor da igual pero tiene que ser válido |
 * | 1        | `grid-cols-1 max-w-xl`                              | Una tarjeta sola en una grilla de 3 es una tarjeta perdida en la esquina con dos tercios de fila vacíos. Acotar el ancho la convierte en una pieza deliberada. **Es el caso de Rankings hoy** |
 * | 2        | `sm:grid-cols-2`                                    | Fila exacta desde SM; una tercera columna dejaría un hueco fijo |
 * | 3        | `sm:grid-cols-2 lg:grid-cols-3`                     | Fila exacta en LG. **Es el caso de Sedes hoy** |
 * | 4        | `sm:grid-cols-2 lg:grid-cols-4`                     | Fila exacta en LG, y 2+2 en SM |
 * | 5 a 8    | `sm:grid-cols-2 lg:grid-cols-3`                     | **Nunca 4 columnas acá:** 5 en 4 columnas deja una huérfana; 5 en 3 deja 3+2, que se lee como bloque. **Es el caso de Disciplinas hoy** |
 * | 9 o más  | `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`      | Recién con volumen la cuarta columna se llena |
 *
 * ## Las clases van literales, nunca interpoladas
 *
 * Tailwind escanea el fuente buscando clases **escritas tal cual**. Una clase
 * armada con un template string (`` `lg:grid-cols-${n}` ``) no aparece escrita
 * en ningún lado, así que no se genera y la regla no existe en el CSS emitido.
 * Ese fue exactamente el bug D1 de `DisciplinesPage`, donde el degradé de hover
 * nunca llegó a existir y dejaba el icono en blanco sobre `primary-100`
 * (1.29:1). Por eso acá cada rama devuelve un string completo y constante.
 */
export function columnasSegunVolumen(cantidad: number): string {
  if (cantidad <= 1) return 'grid grid-cols-1 gap-6 max-w-xl';
  if (cantidad === 2) return 'grid grid-cols-1 sm:grid-cols-2 gap-6';
  if (cantidad === 3) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
  if (cantidad === 4) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6';
  if (cantidad <= 8) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
  return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';
}

/**
 * Delay del escalonado de entrada de las tarjetas, en segundos.
 *
 * Un único valor para las cuatro páginas (U11): venían con 0.05 en Disciplinas
 * y Calendario y 0.06 en Sedes y Rankings, lo que hacía que navegar entre
 * secciones se sintiera apenas distinto sin que nadie supiera por qué.
 */
export const DELAY_ESCALONADO = 0.05;

/**
 * Tope de tarjetas que se animan escalonadas.
 *
 * Sin tope, la tarjeta 60 entra tres segundos tarde y quien llegó a la página
 * ve el contenido apareciendo de a poco mucho después de que la carga terminó.
 */
const MAX_ESCALONADAS = 12;

/** El `animationDelay` que le toca a la tarjeta en la posición `indice`. */
export function retrasoDeEntrada(indice: number): string {
  return `${Math.min(indice, MAX_ESCALONADAS) * DELAY_ESCALONADO}s`;
}
