/**
 * Cliente único de Secrets Manager, para leer `slt-demo-app-secrets`
 * (`infra/secrets.tf`): `DEMO_PANEL_KEY` y `OTP_PEPPER`. Mismo criterio que
 * `dynamo-client.ts` / `s3-client.ts` — único archivo que importa
 * `@aws-sdk/client-secrets-manager`.
 *
 * El pepper se cachea en memoria del proceso tras la primera lectura: es un
 * valor de arranque que solo cambia por rotación manual (ver comentario en
 * `infra/secrets.tf`), no vale la pena pagar una llamada a Secrets Manager
 * por cada OTP generado o verificado.
 */
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

export interface SecretosApp {
  readonly DEMO_PANEL_KEY: string;
  readonly OTP_PEPPER: string;
  /**
   * Clave de la consola administrativa (`docs/CONSOLA_ADMINISTRATIVA.md` §2).
   * Es un secreto **distinto** del panel de demo a propósito: son dos
   * herramientas con públicos y poderes distintos —el panel solo mira y olvida
   * la sesión del navegador; la consola crea expedientes y levanta bloqueos—,
   * así que compartir clave haría imposible revocar una sin la otra.
   */
  readonly ADMIN_CONSOLE_KEY: string;
  /**
   * Bearer del `otp-service` de WhatsApp-Modular (`INTEGRATION_OTP=live`).
   *
   * **Opcional**, a diferencia de los otros tres: el despliegue puede correr
   * el OTP de celular en mock, y en desarrollo local el token viene por
   * `WHATSAPP_MODULAR_TOKEN` en `.env.local`. Declararlo obligatorio rompería
   * el arranque de todo entorno que no use WhatsApp real — incluidos los que
   * ya existen, porque `infra/secrets.tf` tiene `ignore_changes` y no puede
   * agregarle esta clave al secret de un despliegue vivo.
   *
   * Está acá y no en las variables de entorno de Amplify porque es una
   * credencial: las variables de la app son visibles para cualquiera con
   * lectura de consola, y terminan escritas en `.env.production` dentro del
   * artefacto de build.
   */
  readonly WHATSAPP_MODULAR_TOKEN?: string;
}

function esSecretosApp(valor: unknown): valor is SecretosApp {
  if (typeof valor !== "object" || valor === null) return false;
  const registro = valor as Record<string, unknown>;
  return (
    typeof registro.DEMO_PANEL_KEY === "string" &&
    typeof registro.OTP_PEPPER === "string" &&
    typeof registro.ADMIN_CONSOLE_KEY === "string" &&
    (registro.WHATSAPP_MODULAR_TOKEN === undefined ||
      typeof registro.WHATSAPP_MODULAR_TOKEN === "string")
  );
}

let clienteSecretsManagerSingleton: SecretsManagerClient | null = null;

function obtenerClienteSecretsManager(): SecretsManagerClient {
  if (!clienteSecretsManagerSingleton) {
    clienteSecretsManagerSingleton = new SecretsManagerClient({ region: process.env.AWS_REGION });
  }
  return clienteSecretsManagerSingleton;
}

let secretosCacheados: Promise<SecretosApp> | null = null;

/**
 * Lee y parsea `slt-demo-app-secrets` desde `APP_SECRETS_ARN`. Cachea la
 * promesa (no solo el resultado) para que llamadas concurrentes durante el
 * arranque no disparen múltiples `GetSecretValue` en paralelo.
 */
export async function obtenerSecretosApp(): Promise<SecretosApp> {
  if (!secretosCacheados) {
    secretosCacheados = (async () => {
      const arn = process.env.APP_SECRETS_ARN;
      if (!arn) {
        throw new Error("Falta la variable de entorno APP_SECRETS_ARN (ARN del secret slt-demo-app-secrets).");
      }

      const respuesta = await obtenerClienteSecretsManager().send(new GetSecretValueCommand({ SecretId: arn }));
      if (!respuesta.SecretString) {
        throw new Error(`El secret ${arn} no tiene SecretString.`);
      }

      const parseado: unknown = JSON.parse(respuesta.SecretString);
      if (!esSecretosApp(parseado)) {
        throw new Error(
          `El secret ${arn} no tiene la forma esperada (DEMO_PANEL_KEY, OTP_PEPPER, ADMIN_CONSOLE_KEY).`,
        );
      }
      return parseado;
    })().catch((error: unknown) => {
      // Si falló, no dejar la promesa rota cacheada — un próximo intento
      // (p.ej. tras resolverse un problema transitorio de red) debe poder
      // volver a intentar en vez de repetir el mismo error para siempre.
      secretosCacheados = null;
      throw error;
    });
  }
  return secretosCacheados;
}

export async function obtenerOtpPepper(): Promise<string> {
  return (await obtenerSecretosApp()).OTP_PEPPER;
}

/** Clave que protege `/demo-panel`. Solo la usa el panel, nunca el flujo. */
export async function obtenerDemoPanelKey(): Promise<string> {
  return (await obtenerSecretosApp()).DEMO_PANEL_KEY;
}

/** Clave que protege `/admin-consola`. Nunca la usa el flujo P0–P9. */
export async function obtenerAdminConsoleKey(): Promise<string> {
  return (await obtenerSecretosApp()).ADMIN_CONSOLE_KEY;
}

/**
 * Bearer del otp-service de WhatsApp-Modular.
 *
 * Tira con un mensaje accionable si la clave no está en el secret: fallar con
 * el nombre exacto de lo que falta es mejor que un 401 del proveedor, que
 * desde el lado del flujo se ve igual que "WhatsApp no anda".
 */
export async function obtenerWhatsAppModularToken(): Promise<string> {
  const token = (await obtenerSecretosApp()).WHATSAPP_MODULAR_TOKEN;
  if (!token) {
    throw new Error(
      "INTEGRATION_OTP=live sin WHATSAPP_MODULAR_TOKEN: agregá esa clave al secret " +
        "slt-demo-app-secrets (Terraform no puede, tiene ignore_changes sobre secret_string) " +
        "o definila como variable de entorno en desarrollo local.",
    );
  }
  return token;
}
