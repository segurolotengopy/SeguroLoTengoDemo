/**
 * Obtiene `DEMO_PANEL_KEY` desde el secret real de Secrets Manager
 * (`slt-demo-app-secrets`) para que el `global-setup` de Playwright pueda
 * autenticarse en `/demo-panel` sin inventar un valor de prueba.
 *
 * Esto vive en `e2e/`, fuera de `src/`, a propósito: la regla dura de
 * CLAUDE.md ("ningún archivo fuera de `src/adapters/` puede importar un SDK
 * de proveedor externo") gobierna el código de la aplicación, no las
 * herramientas de testing — es el mismo criterio con el que la app nunca
 * expone el código de un OTP por su propia API y el panel de demo sí lo hace
 * como herramienta de demostración.
 *
 * La clave se cachea únicamente en memoria del proceso de Playwright y se
 * escribe a un archivo temporal **fuera del repositorio** (`os.tmpdir()`),
 * nunca a un archivo del proyecto ni a stdout/stderr. `npm test` y el resto
 * del código de la app nunca importan este módulo.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

interface SecretosPanel {
  readonly DEMO_PANEL_KEY: string;
  readonly ADMIN_CONSOLE_KEY: string;
}

function esSecretosPanel(valor: unknown): valor is SecretosPanel {
  if (typeof valor !== "object" || valor === null) return false;
  const registro = valor as Record<string, unknown>;
  return (
    typeof registro.DEMO_PANEL_KEY === "string" &&
    typeof registro.ADMIN_CONSOLE_KEY === "string"
  );
}

/**
 * Carpeta temporal fuera del repo (no `/tmp` genérico: un subdirectorio con
 * nombre propio para no chocar con nada más que corra en la máquina).
 */
const DIRECTORIO_TEMPORAL = join(tmpdir(), "slt-e2e-secretos");
const ARCHIVO_CLAVE = join(DIRECTORIO_TEMPORAL, "demo-panel-key.json");

/**
 * `global-setup.ts` llama a esto una sola vez: lee `APP_SECRETS_ARN` /
 * `AWS_REGION` del entorno (los mismos que recibe el `webServer` de
 * Playwright), pide el secret y deja la clave en un archivo temporal con
 * permisos `0600`, legible solo por el usuario que corre los tests.
 */
export async function descargarClaveDelPanel(): Promise<void> {
  const arn = process.env.APP_SECRETS_ARN;
  if (!arn) {
    throw new Error(
      "Falta APP_SECRETS_ARN: el global-setup de Playwright necesita el ARN de " +
        "slt-demo-app-secrets para leer DEMO_PANEL_KEY (igual que src/repositories/secrets-client.ts).",
    );
  }

  const cliente = new SecretsManagerClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  const respuesta = await cliente.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!respuesta.SecretString) {
    throw new Error(`El secret ${arn} no tiene SecretString.`);
  }

  const parseado: unknown = JSON.parse(respuesta.SecretString);
  if (!esSecretosPanel(parseado)) {
    throw new Error(`El secret ${arn} no trae DEMO_PANEL_KEY y ADMIN_CONSOLE_KEY.`);
  }

  await mkdir(DIRECTORIO_TEMPORAL, { recursive: true, mode: 0o700 });
  await writeFile(
    ARCHIVO_CLAVE,
    JSON.stringify({
      DEMO_PANEL_KEY: parseado.DEMO_PANEL_KEY,
      ADMIN_CONSOLE_KEY: parseado.ADMIN_CONSOLE_KEY,
    }),
    { mode: 0o600 },
  );
}

/** `global-teardown.ts` borra el archivo temporal al terminar la corrida. */
export async function borrarClaveDelPanel(): Promise<void> {
  await rm(DIRECTORIO_TEMPORAL, { recursive: true, force: true }).catch(() => undefined);
}

let secretosCacheados: SecretosPanel | null = null;

async function obtenerSecretos(): Promise<SecretosPanel> {
  if (secretosCacheados) return secretosCacheados;
  const contenido = await readFile(ARCHIVO_CLAVE, "utf8").catch(() => {
    throw new Error(
      "No se encontraron las claves del panel/consola. ¿Corrió el global-setup de Playwright " +
        "(descargarClaveDelPanel) antes de este test?",
    );
  });
  const parseado: unknown = JSON.parse(contenido);
  if (!esSecretosPanel(parseado)) {
    throw new Error("El archivo temporal de claves no tiene el formato esperado.");
  }
  secretosCacheados = parseado;
  return secretosCacheados;
}

/** Lo que usan los tests: la clave, ya en memoria, sin volver a tocar AWS. */
export async function obtenerClaveDelPanel(): Promise<string> {
  return (await obtenerSecretos()).DEMO_PANEL_KEY;
}

/** Para el saneo previo de cédulas bloqueadas (`liberar-cedulas.ts`). */
export async function obtenerClaveConsola(): Promise<string> {
  return (await obtenerSecretos()).ADMIN_CONSOLE_KEY;
}
