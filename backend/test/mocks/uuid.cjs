// Shim CJS de `uuid` para Jest.
// El paquete `uuid` v14 es ESM puro y Jest corre en CommonJS; delegamos en
// `node:crypto`, que expone la misma generación de UUID v4.
const { randomUUID } = require('node:crypto');

module.exports = {
  v4: () => randomUUID(),
};
