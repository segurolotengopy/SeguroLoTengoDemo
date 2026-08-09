/**
 * Regla de negocio inviolable #2 (CLAUDE.md): "Solo el hash del OTP se
 * persiste. Nunca el código en claro, ni en base, ni en logs, ni en
 * respuestas de API. En modo demo el código se expone únicamente a través
 * del panel de demo, nunca por la API del flujo."
 *
 * Este test ejercita los TRES Route Handlers reales de P1 (enviar, reenviar,
 * verificar) de punta a punta —repositorio real sobre un DynamoDB en
 * memoria, adaptador mock real, evidencia real— y afirma que el código no
 * aparece en:
 *
 *   1. el cuerpo de ninguna respuesta,
 *   2. las cabeceras de ninguna respuesta (incluidas las cookies),
 *   3. ningún ítem persistido en la tabla,
 *   4. ningún registro de evidencia,
 *   5. nada de lo que se escriba en consola / stdout / stderr.
 *
 * Para que la prueba sea determinista se fija el código generado (en vez de
 * los 6 dígitos aleatorios de `generarCodigoOtp`); el hasheo, la
 * verificación y todo lo demás corren con el código real de producción.
 *
 * El control positivo de la primera aserción es importante: si el canal de
 * demo dejara de devolver el código, el resto del test pasaría sin comprobar
 * nada. Por eso se afirma primero que el código existe y se puede leer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DependenciasP1 } from "@/domain/verificacion-canal-whatsapp";

const CODIGO_INICIAL = "135791";
const CODIGO_REENVIADO = "246802";
const AHORA = new Date("2026-03-15T12:00:00.000Z");
const PEPPER = "pepper-de-prueba";
const NUMERO = "981000123";

// `vi.hoisted` porque las factories de `vi.mock` se elevan por encima de los
// imports: es la forma soportada de compartir estado entre el mock y el test.
const compartido = vi.hoisted(() => ({
  fabricaDependencias: null as null | (() => DependenciasP1),
  codigosPendientes: [] as string[],
}));

vi.mock("@/app/api/p1/_dependencias", () => ({
  dependenciasP1: (): DependenciasP1 => {
    if (!compartido.fabricaDependencias) throw new Error("dependencias no preparadas en el test");
    return compartido.fabricaDependencias();
  },
}));

vi.mock("@/repositories/otp-hash", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/repositories/otp-hash")>();
  return {
    ...original,
    // Solo se fija la generación; el HMAC y la comparación son los reales.
    generarCodigoOtp: () => compartido.codigosPendientes.shift() ?? "000000",
  };
});

import { crearOtpProviderMock, limpiarRegistroDemo, obtenerEnvioDemo } from "@/adapters/mock/otp-provider";
import { crearEvidenceStoreDynamoDb } from "@/repositories/evidencia-repository";
import { crearExpedienteRepositoryDynamoDb } from "@/repositories/expediente-repository";
import { crearOtpRepositoryDynamoDb } from "@/repositories/otp-repository";
import { crearFakeDynamoDocumentClient } from "@/repositories/__tests__/fake-dynamo-document-client";
import { POST as postEnviar } from "../otp/enviar/route";
import { POST as postReenviar } from "../otp/reenviar/route";
import { POST as postVerificar } from "../otp/verificar/route";

const NOMBRE_TABLA = "tabla-de-prueba";

type MetodoConsola = "log" | "info" | "warn" | "error" | "debug" | "trace";
const METODOS_CONSOLA: readonly MetodoConsola[] = ["log", "info", "warn", "error", "debug", "trace"];

interface Entorno {
  readonly tabla: Map<string, Record<string, unknown>>;
  readonly evidencias: DependenciasP1["evidencias"];
  /** Todo lo escrito a consola/stdout/stderr durante el test. */
  readonly salidaCapturada: string[];
}

let entorno: Entorno;

function prepararEntorno(): Entorno {
  const { documentClient, tabla } = crearFakeDynamoDocumentClient();

  const otpRepository = crearOtpRepositoryDynamoDb({
    documentClient,
    nombreTabla: NOMBRE_TABLA,
    obtenerPepper: async () => PEPPER,
  });
  const expedientes = crearExpedienteRepositoryDynamoDb({ documentClient, nombreTabla: NOMBRE_TABLA });
  const evidencias = crearEvidenceStoreDynamoDb({ documentClient, nombreTabla: NOMBRE_TABLA });
  const otpProvider = crearOtpProviderMock({ otpRepository, retenerCodigoParaPanelDemo: true });

  compartido.fabricaDependencias = () => ({
    otpProvider,
    lectorOtp: otpRepository,
    expedientes,
    evidencias,
  });

  const salidaCapturada: string[] = [];
  for (const metodo of METODOS_CONSOLA) {
    vi.spyOn(console, metodo).mockImplementation((...args: unknown[]) => {
      salidaCapturada.push(args.map(String).join(" "));
    });
  }
  for (const flujo of [process.stdout, process.stderr]) {
    vi.spyOn(flujo, "write").mockImplementation((trozo: unknown) => {
      salidaCapturada.push(String(trozo));
      return true;
    });
  }

  return { tabla, evidencias, salidaCapturada };
}

/** Cookies de una respuesta, listas para mandar en la siguiente petición. */
function cookiesDe(respuesta: Response): string {
  const crudas = respuesta.headers.getSetCookie?.() ?? [];
  return crudas
    .map((cookie) => cookie.split(";")[0])
    .filter((par) => !par.endsWith("="))
    .join("; ");
}

function peticion(cuerpo: unknown, cookies = ""): Request {
  return new Request("https://segurolotengo.test/api/p1/otp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "vitest",
      "x-forwarded-for": "200.10.20.30",
      ...(cookies ? { cookie: cookies } : {}),
    },
    body: JSON.stringify(cuerpo),
  });
}

/** Cuerpo + cabeceras serializados: todo lo que efectivamente sale por HTTP. */
async function superficieHttp(respuesta: Response): Promise<string> {
  const cabeceras = [...respuesta.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
  const cuerpo = await respuesta.clone().text();
  return `${respuesta.status}\n${cabeceras}\n${cuerpo}`;
}

describe("P1 · el código del OTP nunca sale por la API del flujo ni por los logs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    limpiarRegistroDemo();
    compartido.codigosPendientes = [CODIGO_INICIAL, CODIGO_REENVIADO];
    entorno = prepararEntorno();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("no aparece en respuestas, cookies, base, evidencia ni logs en todo el recorrido de P1", async () => {
    // --- 1. Enviar ---------------------------------------------------------
    const respuestaEnvio = await postEnviar(
      peticion({ numero: NUMERO, autorizacionAceptada: true }),
    );
    expect(respuestaEnvio.status).toBe(200);

    const cookies = cookiesDe(respuestaEnvio);
    const otpId = /slt_otp=([^;]+)/.exec(cookies)?.[1];
    expect(otpId).toBeTruthy();

    // Control positivo: el código EXISTE y el test puede verlo por el canal
    // del panel de demo. Sin esto, las aserciones de abajo no probarían nada.
    const envioDemo = obtenerEnvioDemo(otpId!);
    expect(envioDemo?.codigo).toBe(CODIGO_INICIAL);

    const superficieEnvio = await superficieHttp(respuestaEnvio);
    expect(superficieEnvio).not.toContain(CODIGO_INICIAL);
    // Y sí trae lo que la especificación pide mostrar: número enmascarado y
    // referencia del envío.
    expect(superficieEnvio).toContain("+595 ••• ••• 123");
    expect(superficieEnvio).toContain("MOCK-WHATSAPP-");

    // --- 2. Verificar con un código equivocado -----------------------------
    const respuestaFallida = await postVerificar(peticion({ codigo: "000000" }, cookies));
    expect(respuestaFallida.status).toBe(400);
    const superficieFallida = await superficieHttp(respuestaFallida);
    expect(superficieFallida).not.toContain(CODIGO_INICIAL);
    // El error informa intentos restantes, no el código correcto.
    expect(superficieFallida).toContain("CODIGO_INCORRECTO");

    // --- 3. Reenviar (pasado el cooldown de 60s) ---------------------------
    vi.setSystemTime(new Date(AHORA.getTime() + 61_000));
    const respuestaReenvio = await postReenviar(peticion({}, cookies));
    expect(respuestaReenvio.status).toBe(200);

    const superficieReenvio = await superficieHttp(respuestaReenvio);
    expect(superficieReenvio).not.toContain(CODIGO_INICIAL);
    expect(superficieReenvio).not.toContain(CODIGO_REENVIADO);
    expect(obtenerEnvioDemo(otpId!)?.codigo).toBe(CODIGO_REENVIADO);

    // --- 4. Verificar con el código correcto -------------------------------
    const respuestaExito = await postVerificar(peticion({ codigo: CODIGO_REENVIADO }, cookies));
    expect(respuestaExito.status).toBe(200);

    const superficieExito = await superficieHttp(respuestaExito);
    // El código correcto viajó en el REQUEST (es lo que la persona tipea);
    // lo que no puede pasar es que vuelva en la RESPUESTA.
    expect(superficieExito).not.toContain(CODIGO_REENVIADO);
    expect(superficieExito).toContain("CANAL_WA_VERIFICADO");

    // --- 5. Nada persistido contiene el código -----------------------------
    const contenidoTabla = JSON.stringify([...entorno.tabla.values()]);
    expect(contenidoTabla).not.toContain(CODIGO_INICIAL);
    expect(contenidoTabla).not.toContain(CODIGO_REENVIADO);

    // --- 6. Ni la evidencia ------------------------------------------------
    const expedienteId = /slt_expediente=([^;]+)/.exec(cookies)?.[1];
    const historial = await entorno.evidencias.obtenerHistorial(expedienteId!);
    const evidenciaSerializada = JSON.stringify(historial);
    expect(evidenciaSerializada).not.toContain(CODIGO_INICIAL);
    expect(evidenciaSerializada).not.toContain(CODIGO_REENVIADO);
    // Control positivo: la evidencia existe y trae lo que exige la regla #10.
    expect(historial.length).toBeGreaterThanOrEqual(4);
    expect(evidenciaSerializada).toContain("+595 ••• ••• 123");
    expect(evidenciaSerializada).toContain("200.10.20.30");

    // --- 7. Ni los logs ----------------------------------------------------
    const logs = entorno.salidaCapturada.join("\n");
    expect(logs).not.toContain(CODIGO_INICIAL);
    expect(logs).not.toContain(CODIGO_REENVIADO);
  });

  it("el número completo tampoco sale: siempre enmascarado", async () => {
    const respuesta = await postEnviar(peticion({ numero: NUMERO, autorizacionAceptada: true }));
    const superficie = await superficieHttp(respuesta);

    expect(superficie).not.toContain("+595981000123");
    expect(superficie).not.toContain("981000123");
    expect(superficie).toContain("+595 ••• ••• 123");
  });
});
