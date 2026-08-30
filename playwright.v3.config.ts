import { defineConfig, devices } from "@playwright/test";
import { nombreTablaDeLaCorrida } from "./e2e/support/tabla-efimera";

/**
 * Batería E2E del **flujo v3** (`FLUJO_V3=true`), separada de la histórica.
 *
 * Existe como config propia porque la versión del flujo es una propiedad del
 * **despliegue** (se resuelve a import-time, `src/domain/flujo-vigente.ts`):
 * un solo `webServer` no puede servir v2 y v3 a la vez, así que los proyectos
 * de Playwright no alcanzan. Esta config levanta su servidor en el puerto
 * 3101 con el flag encendido y corre solo `e2e/v3/**`; la batería histórica
 * (`playwright.config.ts`, puerto 3100, sin flag) ignora esa carpeta.
 *
 * `reuseExistingServer: false` a propósito: un `next dev` colgado del puerto
 * con el flag contrario haría fallar los tests por el motivo equivocado.
 *
 * Todo lo demás —tabla efímera, credenciales, cámara falsa, workers en 1— es
 * el mismo criterio de la config base; ver los comentarios largos allá.
 */
const TABLA_DE_LA_CORRIDA = process.env.DYNAMODB_TABLE ?? nombreTablaDeLaCorrida();
process.env.DYNAMODB_TABLE = TABLA_DE_LA_CORRIDA;

process.env.AWS_PROFILE ??= "aab1-demo-qa";
process.env.AWS_REGION ??= "us-east-1";
process.env.S3_BUCKET ??= "slt-demo-evidencias-9e0e93f3";
process.env.APP_SECRETS_ARN ??=
  "arn:aws:secretsmanager:us-east-1:120005938663:secret:slt-demo-app-secrets-wX3mDq";

// El global-setup calienta rutas y descarga la clave del panel contra esta base.
process.env.E2E_BASE_URL = "http://127.0.0.1:3101";

export default defineConfig({
  testDir: "./e2e/v3",
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-v3" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
        },
        permissions: ["camera"],
      },
    },
  ],

  webServer: {
    command: "npm run dev -- -p 3101",
    // El chequeo de readiness apunta a la página del paso 1 y no a la raíz:
    // bajo v3 la raíz redirige en cadena hasta `/seguro`, que responde 404
    // hasta el lote F3, y Playwright no daría el servidor por listo nunca.
    url: "http://127.0.0.1:3101/inscripcion",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      FLUJO_V3: "true",
      INTEGRATION_MODE: "mock",
      DEMO_MODE: "true",
      ADMIN_CONSOLE_ENABLED: "true",
      AWS_PROFILE: process.env.AWS_PROFILE!,
      AWS_REGION: process.env.AWS_REGION!,
      DYNAMODB_TABLE: TABLA_DE_LA_CORRIDA,
      S3_BUCKET: process.env.S3_BUCKET!,
      APP_SECRETS_ARN: process.env.APP_SECRETS_ARN!,
    },
  },
});
