// ===========================================
// Presupuesto de consultas sobre los dobles de Prisma
// ===========================================
/**
 * Los dobles de Prisma de los specs exponen cada operación como `jest.fn`. Este
 * módulo suma sus llamadas para fijar cuántas consultas hace un flujo: es la
 * línea base del refactor (odd/tasks/refactor-solid.md, Fase 0). Si un cambio
 * vuelve a meter un N+1, el techo lo corta.
 *
 * `$transaction` no se cuenta: no es una consulta, son las de adentro.
 */

type Doble = Record<string, unknown>;

function esMock(valor: unknown): valor is jest.Mock {
  return typeof valor === 'function' && 'mock' in valor;
}

/** Operaciones (`jest.fn`) de cada modelo del doble. */
function operaciones(prisma: Doble): jest.Mock[] {
  const fns: jest.Mock[] = [];
  for (const [modelo, valor] of Object.entries(prisma)) {
    if (modelo.startsWith('$') || modelo.startsWith('_')) continue;
    if (valor === null || typeof valor !== 'object') continue;
    for (const op of Object.values(valor as Doble)) {
      if (esMock(op)) fns.push(op);
    }
  }
  return fns;
}

/** Total de consultas hechas al doble desde el último `reiniciarConteo`. */
export function contarConsultas(prisma: Doble): number {
  return operaciones(prisma).reduce((n, fn) => n + fn.mock.calls.length, 0);
}

/** Pone el contador en cero sin tocar las implementaciones de los mocks. */
export function reiniciarConteo(prisma: Doble): void {
  for (const fn of operaciones(prisma)) fn.mockClear();
}

/** Corre `flujo` y devuelve cuántas consultas hizo. */
export async function medirConsultas(
  prisma: Doble,
  flujo: () => Promise<unknown>,
): Promise<number> {
  reiniciarConteo(prisma);
  await flujo();
  return contarConsultas(prisma);
}
