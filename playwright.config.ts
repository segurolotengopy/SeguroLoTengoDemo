import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración de Playwright para los escenarios E2E de SeguroLoTengo.
 *
 * Contexto obligatorio (ver CLAUDE.md y docs/ESPECIFICACION_DEMO.md):
 *
 * - `INTEGRATION_MODE=mock` cubre los 7 puertos externos (OTP, identidad,
 *   pago, firma, emisión…), pero **no** la persistencia: DynamoDB, S3 y
 *   Secrets Manager son siempre reales, con o sin `INTEGRATION_MODE`
 *   (`src/repositories/`, fuera del sistema de puertos/adaptadores). Sin
 *   credenciales de AWS con permisos de plano de datos sobre
 *   `slt-demo-expedientes` / `slt-demo-evidencias-*` / `slt-demo-app-secrets`,
 *   el `webServer` de abajo arranca pero cualquier acción del flujo (P1 en
 *   adelante) devuelve 500 al intentar escribir el primer OTP.
 * - El panel de demo (`/demo-panel`) no tiene puerta de entrada por variable
 *   de entorno: `DEMO_PANEL_KEY` vive únicamente en el secret
 *   `slt-demo-app-secrets`. `global-setup.ts` la descarga una sola vez con el
 *   SDK de Secrets Manager (`e2e/support/secreto-panel.ts`) a un archivo
 *   temporal fuera del repo; nunca se hardcodea acá ni se commitea.
 *
 * **Workers en 1, sin paralelismo.** El panel de demo guarda su estado
 * (persona activa, fallas armadas, plazo de firma) en memoria del **proceso**
 * del servidor Next.js — no por sesión de navegador (`src/adapters/mock/
 * persona-activa.ts`, `fallas-demo.ts`, `plazo-firma-demo.ts`). Con más de un
 * worker, dos escenarios en paralelo pisarían la persona/falla activa del
 * otro. Es una propiedad real del sistema bajo prueba, no una limitación de
 * Playwright: correr esta batería en paralelo directamente daría resultados
 * incorrectos, no solo lentos.
 */
export default defineConfig({
  testDir: "./e2e",
  // 90s quedaba justo para los escenarios de flujo completo: el camino feliz
  // solo ya toma ~80s contra `next dev` + DynamoDB real, y el escenario 7
  // (firma atómica) recorre lo mismo MÁS dos actos de firma con sus
  // verificaciones. El margen es deliberadamente holgado: acá un timeout no
  // detecta bugs, solo mata corridas lentas a medio camino.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        /**
         * Cámara falsa del navegador, obligatoria desde que P5 captura de
         * verdad (`CapturaConCamara`): sin esto `getUserMedia` pide permiso a
         * un usuario que no existe y el visor se queda en "Abriendo la
         * cámara…", con lo que **ningún** escenario pasa de P5.
         *
         * - `use-fake-device-for-media-stream` entrega un video sintético.
         * - `use-fake-ui-for-media-stream` concede el permiso sin diálogo.
         *
         * El cuadro sintético es plano, así que la medición de calidad de
         * `calidad-captura.ts` no lo va a dar por apto y el disparo automático
         * no se adelanta. Los helpers de `e2e/support/flujo.ts` no dependen de
         * eso igual: contemplan las dos posibilidades.
         */
        launchOptions: {
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
        },
        permissions: ["camera"],
      },
    },
  ],

  webServer: {
    command: "npm run dev -- -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      INTEGRATION_MODE: "mock",
      DEMO_MODE: "true",
      // Para el saneo previo de cédulas bloqueadas (`e2e/support/liberar-cedulas.ts`):
      // el global-setup libera por consola administrativa lo que la corrida
      // anterior dejó bloqueante por regla #11.
      ADMIN_CONSOLE_ENABLED: "true",
      AWS_PROFILE: process.env.AWS_PROFILE ?? "aab1-demo-qa",
      AWS_REGION: process.env.AWS_REGION ?? "us-east-1",
      DYNAMODB_TABLE: process.env.DYNAMODB_TABLE ?? "slt-demo-expedientes",
      S3_BUCKET: process.env.S3_BUCKET ?? "slt-demo-evidencias-9e0e93f3",
      APP_SECRETS_ARN:
        process.env.APP_SECRETS_ARN ??
        "arn:aws:secretsmanager:us-east-1:120005938663:secret:slt-demo-app-secrets-wX3mDq",
    },
  },
});
