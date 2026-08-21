// ===========================================
// Prisma Configuration (Prisma 7+)
// ===========================================
import path from 'node:path';
import { defineConfig } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrations: {
    // Tiene que ser un **comando**, no una ruta: Prisma lo ejecuta con el shell.
    // Con `'./prisma/seed.ts'` a secas, en Windows el shell no sabe cómo correr
    // un `.ts`, termina sin error y Prisma informa "The seed command has been
    // executed" sin que se haya sembrado nada. El síntoma es silencioso: el seed
    // parece correr y la base queda igual.
    seed: 'npx ts-node prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
