import { defineConfig, devices } from '@playwright/test';

// Todo corre contra el stack aislado `evita-e2e` (ver docker-compose.e2e.yml).
const BASE = process.env.E2E_BASE ?? 'http://localhost:18081';
// Con E2E_EMPTY=1 el stack arrancó con la base vacía (SEED_ON_START=false): no hay usuarios ni datos.
const VACIO = Boolean(process.env.E2E_EMPTY);

const escritorio = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } };
const celular = { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };

export default defineConfig({
  testDir: './tests',
  globalSetup: VACIO ? undefined : './lib/global-setup.ts',
  globalTeardown: VACIO ? undefined : './lib/global-teardown.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0, // los reintentos se hacen a mano (ver docs) para poder reportar flakes
  reporter: [['list'], ['json', { outputFile: process.env.E2E_JSON ?? 'test-results/results.json' }]],
  use: {
    baseURL: BASE,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Cordoba', // Formosa (UTC-3)
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: VACIO
    ? [
        { name: 'empty-desktop', testMatch: /empty\/.*\.spec\.ts/, use: escritorio },
        { name: 'empty-mobile', testMatch: /empty\/.*\.spec\.ts/, use: celular },
      ]
    : [
        { name: 'api', testMatch: /api\/.*\.spec\.ts/ },
        { name: 'desktop', testMatch: /ui\/.*\.spec\.ts/, use: escritorio },
        { name: 'mobile', testMatch: /ui\/.*\.spec\.ts/, use: celular },
      ],
});
