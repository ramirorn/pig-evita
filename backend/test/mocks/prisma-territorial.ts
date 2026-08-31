import { Prisma } from '@prisma/client';
// ===========================================
// Doble de Prisma con estado real y `where` evaluado (S01)
// ===========================================
/**
 * La red de S01 barre handlers de lectura **y de escritura**. Un doble que
 * devuelve constantes no sirve para eso por dos motivos distintos:
 *
 *  1. si ignora el `where`, el código con recorte territorial y el de antes
 *     producen exactamente la misma respuesta, y el test pasa con el bug puesto;
 *  2. si ignora los `create`/`update`, una escritura que mueve una fila fuera
 *     de la jurisdicción (S03) "no pasa nada" y la respuesta sigue mostrando el
 *     departamento viejo — que es el estado en el que un test se pone verde
 *     mintiendo.
 *
 * Este módulo modela las dos cosas: interpreta el `where` que construye el
 * service y **muta el arreglo de filas** en los `create`/`update`, así el efecto
 * de la escritura se ve en la respuesta y en las lecturas siguientes.
 *
 * La proyección (`select` / `include`) se delega en `prisma-projection`, que ya
 * existía para el barrido de R01.
 */
import { proyectar } from './prisma-projection';

/**
 * Columnas `unique` por modelo, tal como las declara `schema.prisma`.
 *
 * Se modelan en el doble porque la ausencia de la restricción es la diferencia
 * entre un test que prueba algo y uno que sólo confirma que el código corre.
 */
const UNICOS: Record<string, string[]> = {
  participant: ['dni'],
  user: ['email'],
};

export type Where = Record<string, any> | undefined;

/** Comparación de un escalar contra un operador de Prisma. */
function igual(campo: unknown, valor: unknown, mode?: string): boolean {
  if (
    mode === 'insensitive' &&
    typeof campo === 'string' &&
    typeof valor === 'string'
  ) {
    return campo.toLowerCase() === valor.toLowerCase();
  }
  if (campo instanceof Date && valor instanceof Date) {
    return campo.getTime() === valor.getTime();
  }
  return campo === valor;
}

/**
 * ¿La fila satisface el `where`?
 *
 * Soporta lo que los services realmente construyen: `AND`, `OR`, `NOT`,
 * `equals` (con `mode: 'insensitive'`), `in` —incluida la lista vacía, que es
 * como `ScopeService` expresa "no ve nada"—, `contains`, `some` sobre
 * colecciones y las relaciones anidadas (`participant: { ... }`).
 */
export function coincide(fila: any, where: Where): boolean {
  if (!where) return true;

  return Object.entries(where).every(([clave, valor]) => {
    if (valor === undefined) return true;
    if (clave === 'AND')
      return ([] as Where[]).concat(valor as Where[]).every((w) => coincide(fila, w));
    if (clave === 'OR')
      return ([] as Where[]).concat(valor as Where[]).some((w) => coincide(fila, w));
    if (clave === 'NOT') return !coincide(fila, valor as Where);

    const campo = fila?.[clave];

    if (valor !== null && typeof valor === 'object' && !(valor instanceof Date)) {
      if ('equals' in valor) return igual(campo, valor.equals, valor.mode);
      if ('in' in valor)
        return (valor.in as unknown[]).some((v) => igual(campo, v, valor.mode));
      if ('contains' in valor) {
        return String(campo ?? '')
          .toLowerCase()
          .includes(String(valor.contains).toLowerCase());
      }
      if ('some' in valor) {
        return (Array.isArray(campo) ? campo : []).some((f) =>
          coincide(f, valor.some as Where),
        );
      }
      // Clave compuesta de una unique (`participantId_categoryId: { ... }`) o
      // relación anidada: en los dos casos se evalúa contra la propia fila.
      if (clave.includes('_')) return coincide(fila, valor as Where);
      return coincide(campo, valor as Where);
    }

    return igual(campo, valor);
  });
}

/**
 * Tabla en memoria.
 *
 * `filas` se copia: cada test arranca del mismo universo y las escrituras de
 * uno no contaminan al siguiente.
 */
export function tabla<T extends Record<string, any>>(
  modelo: string,
  filasIniciales: T[],
  alCrear?: (datos: any) => T,
) {
  const filas: any[] = filasIniciales.map((f) => ({ ...f }));

  const buscar = (where: Where) => filas.filter((f) => coincide(f, where));

  return {
    /** Acceso crudo, para las aserciones del propio test. */
    _filas: filas,

    findMany: jest.fn((args: any = {}) =>
      Promise.resolve(
        buscar(args.where)
          .slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? filas.length))
          .map((f) => proyectar(f, args, modelo)),
      ),
    ),
    findFirst: jest.fn((args: any = {}) =>
      Promise.resolve(proyectar(buscar(args.where)[0] ?? null, args, modelo)),
    ),
    findUnique: jest.fn((args: any = {}) =>
      Promise.resolve(proyectar(buscar(args.where)[0] ?? null, args, modelo)),
    ),
    count: jest.fn((args: any = {}) => Promise.resolve(buscar(args.where).length)),

    /**
     * `groupBy` real: agrupa sobre las filas que pasan el `where`. Devolver una
     * constante acá haría que el dashboard con recorte y sin recorte se vean
     * iguales, que es justo lo que S02 tiene que distinguir.
     */
    groupBy: jest.fn((args: any = {}) => {
      const campo = (args.by as string[])[0];
      const conteo = new Map<string, number>();
      for (const f of buscar(args.where)) {
        const clave = String(f[campo]);
        conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
      }
      return Promise.resolve(
        [...conteo.entries()].map(([valor, n]) => ({
          [campo]: valor,
          _count: { [campo]: n },
        })),
      );
    }),

    create: jest.fn((args: any = {}) => {
      // Las columnas `unique` del esquema se modelan de verdad: sin esto, el
      // doble acepta un DNI repetido y el service parece funcionar en un
      // escenario que Postgres rechazaría. Es justo el caso de S04 — la
      // búsqueda acotada no encuentra al participante ajeno y cae en la rama de
      // creación, donde la unique tiene que cortar. Un mock complaciente acá
      // haría pasar el test con la fuga puesta.
      for (const campo of UNICOS[modelo] ?? []) {
        const valor = args.data?.[campo];
        if (valor !== undefined && filas.some((f: any) => f[campo] === valor)) {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError(
              `Unique constraint failed on the fields: (\`${campo}\`)`,
              { code: 'P2002', clientVersion: 'test', meta: { target: [campo] } },
            ),
          );
        }
      }

      const nueva = alCrear
        ? alCrear(args.data)
        : { id: `generado-${filas.length + 1}`, ...args.data };
      filas.push(nueva);
      return Promise.resolve(proyectar(nueva, args, modelo));
    }),

    update: jest.fn((args: any = {}) => {
      const fila = buscar(args.where)[0];
      if (!fila) return Promise.reject(new Error('Registro no encontrado'));
      Object.assign(fila, args.data);
      return Promise.resolve(proyectar(fila, args, modelo));
    }),

    updateMany: jest.fn((args: any = {}) => {
      const afectadas = buscar(args.where);
      for (const f of afectadas) Object.assign(f, args.data);
      return Promise.resolve({ count: afectadas.length });
    }),

    deleteMany: jest.fn((args: any = {}) => {
      const afectadas = buscar(args.where);
      for (const f of afectadas) {
        const i = filas.indexOf(f);
        if (i >= 0) filas.splice(i, 1);
      }
      return Promise.resolve({ count: afectadas.length });
    }),

    delete: jest.fn((args: any = {}) => {
      const i = filas.findIndex((f) => coincide(f, args.where));
      if (i < 0) return Promise.reject(new Error('Registro no encontrado'));
      const [fila] = filas.splice(i, 1);
      return Promise.resolve(proyectar(fila, args, modelo));
    }),
  };
}
