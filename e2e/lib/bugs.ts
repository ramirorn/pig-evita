import { test } from '@playwright/test';

/**
 * Marca la prueba como "falla esperada" por un hallazgo documentado
 * (documentacion/auditoria-funcional.md). La prueba sigue afirmando el
 * comportamiento CORRECTO: cuando el defecto se corrija, Playwright la
 * reportará como inesperadamente exitosa y habrá que quitar esta marca.
 *
 * `E2E_SHOW_BUGS=1` desactiva la marca para ver el fallo real de cada hallazgo.
 */
export function knownBug(reason: string) {
  test.info().annotations.push({ type: 'finding', description: reason });
  if (!process.env.E2E_SHOW_BUGS) test.fail(true, reason);
}
