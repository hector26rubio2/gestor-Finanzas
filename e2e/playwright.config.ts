import { defineConfig } from '@playwright/test';
import { carril, estadoPropietario, webUrl } from './support/entorno';

const ejecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const argumentosDelNavegador = ['--disable-dev-shm-usage'];

export default defineConfig({
  testDir: './tests',
  outputDir: `./${carril.resultados}`,
  globalSetup: './global-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: `./${carril.informe}`, open: 'never' }], ['github']]
    : [['list'], ['html', { outputFolder: `./${carril.informe}`, open: 'never' }]],
  use: {
    baseURL: webUrl,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    storageState: estadoPropietario,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: ejecutable
      ? { executablePath: ejecutable, args: argumentosDelNavegador }
      : { channel: 'chrome', args: argumentosDelNavegador },
  },
  webServer: process.env.E2E_SIN_SERVIDOR_WEB
    ? undefined
    : {
        command: carril.aislado ? `pnpm exec ng serve --port ${carril.webPort}` : 'pnpm start',
        cwd: '..',
        url: `${webUrl}/login`,
        reuseExistingServer: !carril.aislado,
        timeout: 180_000,
      },
});
