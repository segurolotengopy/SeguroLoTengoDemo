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
}

function esSecretosApp(valor: unknown): valor is SecretosApp {
  if (typeof valor !== "object" || valor === null) return false;
  const registro = valor as Record<string, unknown>;
  return typeof registro.DEMO_PANEL_KEY === "string" && typeof registro.OTP_PEPPER === "string";
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
        throw new Error(`El secret ${arn} no tiene la forma esperada (DEMO_PANEL_KEY, OTP_PEPPER).`);
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
