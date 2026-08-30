import { defineConfig, devices } from "@playwright/test";
import { nombreTablaDeLaCorrida } from "./e2e/support/tabla-efimera";

/**
 * Tabla de DynamoDB propia de esta corrida.
 *
 * Se decide **acá** y no en el `globalSetup` porque Playwright levanta el
 * `webServer` antes de correr el setup: el nombre tiene que estar resuelto
 * cuando se arma el entorno del servidor. El setup la crea y el teardown la
 * borra; ambos la leen de `DYNAMODB_TABLE`, que es la misma variable que usa
 * la app.
 *
 * Respetar `DYNAMODB_TABLE` si ya viene definida permite apuntar la batería a
 * una tabla concreta a mano —para depurar contra datos existentes— sin tocar
 * este archivo.
 */
const TABLA_DE_LA_CORRIDA = process.env.DYNAMODB_TABLE ?? nombreTablaDeLaCorrida();
process.env.DYNAMODB_TABLE = TABLA_DE_LA_CORRIDA;

/**
 * Los mismos valores por defecto de AWS que recibe el `webServer`, pero puestos
 * en **este** proceso.
 *
 * `webServer.env` solo alcanza al servidor de Next. `global-setup.ts` y
 * `global-teardown.ts` corren acá, en el proceso de Playwright, y usaban lo que
 * hubiera en el ambiente: con `AWS_PROFILE` sin definir caían al perfil
 * `default`, que en esta máquina es una sesión de `aws login` que caduca. El
 * síntoma era "Your session has expired. Please reauthenticate" al crear la
 * tabla efímera, y llevaba a pensar que el perfil de QA estaba vencido cuando
 * en realidad ni se lo estaba usando.
 *
 * Se respeta lo que venga del entorno, igual que la tabla: exportar
 * `AWS_PROFILE` sigue mandando.
 */
process.env.AWS_PROFILE ??= "aab1-demo-qa";
process.env.AWS_REGION ??= "us-east-1";
process.env.S3_BUCKET ??= "slt-demo-evidencias-9e0e93f3";
process.env.APP_SECRETS_ARN ??=
  "arn:aws:secretsmanager:us-east-1:120005938663:secret:slt-demo-app-secrets-wX3mDq";

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
  //
  // Subido de 180 a 300 s el 21-ago-2026. El recorrido incorporó dos esperas
  // **deliberadas del producto** —el contador de 5 s antes de habilitar
  // *Pagado*, y el cierre del paquete documental antes de que aparezca el
  // código de firma— y con 180 s el camino feliz empezó a morir **después de
  // llegar al paso 8**: completaba todo el flujo y el reloj lo mataba en la
  // última pantalla. Un test que falla habiendo hecho su trabajo no reporta
  // nada, solo confunde.
  timeout: 300_000,
  /**
   * 30 s por aserción, no 15.
   *
   * Esta batería no corre contra dobles: habla con DynamoDB, S3 y Secrets
   * Manager **reales**. Los pasos que cierran un expediente —confirmar
   * identidad, pagar, firmar— hacen varias idas y vueltas a AWS antes de
   * navegar, y cuando los siete escenarios corren seguidos esas idas y vueltas
   * se encolan. Con 15 s aparecían fallos que cambiaban de escenario en cada
   * corrida y pasaban de a uno en aislamiento: el síntoma clásico de un
   * presupuesto de espera más corto que la operación que se está esperando.
   *
   * El precio es enterarse más tarde de una regresión de verdad. Se paga: un
   * rojo tardío es molesto, uno intermitente entrena a ignorar la batería.
   */
  expect: { timeout: 30_000 },
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
      // Ya resueltos arriba, en este proceso: el servidor hereda exactamente lo
      // mismo que usan el global-setup y el teardown, que era justamente lo que
      // no pasaba.
      AWS_PROFILE: process.env.AWS_PROFILE!,
      AWS_REGION: process.env.AWS_REGION!,
      DYNAMODB_TABLE: TABLA_DE_LA_CORRIDA,
      S3_BUCKET: process.env.S3_BUCKET!,
      APP_SECRETS_ARN: process.env.APP_SECRETS_ARN!,
    },
  },
});
