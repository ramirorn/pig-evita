// Punto de entrada para comparar el espejo de permisos del frontend contra el
// backend (R22). Se importa el archivo REAL de constantes del backend: si el
// chequeo comparara contra una copia, no probaría nada.
//
// `common/constants/index.ts` no importa nada (son enums y arrays puros), así
// que se bundlea sin arrastrar Nest ni Prisma.
export { ACCIONES } from '../../backend/src/common/constants';
