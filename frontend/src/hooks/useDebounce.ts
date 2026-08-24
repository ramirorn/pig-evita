// ===========================================
// useDebounce — amortigua un valor antes de que llegue a la queryKey
// ===========================================
import { useEffect, useState } from 'react';

/** Milisegundos de espera por defecto: lo típico para un buscador. */
export const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Devuelve una copia retrasada de `value`, que sólo se actualiza cuando pasan
 * `delayMs` sin cambios (hallazgo R20).
 *
 * El uso previsto es **el valor que entra al `queryKey`**, nunca el que entra al
 * `<input>`: el input sigue atado al `useState` crudo y responde a cada tecla
 * sin lag, mientras que la request espera a que el usuario deje de escribir.
 * Escribir "Gonzalez" pasa de ocho requests (siete obsoletas apenas salen) a
 * una sola.
 *
 * Cada cambio de `value` reinicia el temporizador anterior en el cleanup del
 * efecto, así que sólo sobrevive la última pulsación de la ráfaga. Limpiar el
 * campo también pasa por el retraso: son 300 ms, y no vale la pena un camino
 * especial que duplique la lógica.
 */
export function useDebounce<T>(value: T, delayMs: number = DEFAULT_DEBOUNCE_MS): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
}
