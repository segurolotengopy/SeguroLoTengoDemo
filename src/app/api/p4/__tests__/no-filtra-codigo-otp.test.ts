/**
 * Regla de negocio inviolable #2 aplicada a P4, gemelo de
 * `src/app/api/p1/__tests__/no-filtra-codigo-otp.test.ts`.
 *
 * P4 estrena tres Route Handlers nuevos, así que la garantía hay que
 * demostrarla otra vez sobre ellos: el código del OTP de correo no aparece en
 * respuestas, cookies, base, evidencia ni logs. Y la dirección de correo
 * completa tampoco sale: solo la versión enmascarada.
 *
 * Como en P1, se fija el código generado para que la prueba sea determinista;
 * el hasheo, la verificación y todo lo demás corren con el código real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DependenciasP4 } from "@/domain/verificacion-canal-correo";

const CODIGO_INICIAL = "314159";
const CODIGO_REENVIADO = "271828";
const AHORA = new Date("2026-03-15T12:00:00.000Z");
const PEPPER = "pepper-de-prueba";
const CORREO = "monica.gorena@example.com";
const EXPEDIENTE_ID = "EXP-P4-TEST";

const compartido = vi.hoisted(() => ({
  fabricaDependencias: null as null | (() => DependenciasP4),
  codigosPendientes: [] as string[],
}));

vi.mock("@/app/api/p4/_dependencias", () => ({
  dependenciasP4: (): DependenciasP4 => {
    if (!compartido.fabricaDependencias) throw new Error("dependencias no preparadas en el test");
    return compartido.fabricaDependencias();
  },
}));

vi.mock("@/repositories/otp-hash", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/repositories/otp-hash")>();
  return {
    ...original,
    generarCodigoOtp: () => compartido.codigosPendientes.shift() ?? "000000",
  };
});

import { crearOtpProviderMock, limpiarRegistroDemo, obtenerEnvioDemo } from "@/adapters/mock/otp-provider";
import { transicionarExpediente } from "@/domain/expediente";
import { crearExpedienteInicial } from "@/domain/tipos";
import type { EstadoExpediente } from "@/domain/tipos";
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
  readonly evidencias: DependenciasP4["evidencias"];
  readonly salidaCapturada: string[];
}

let entorno: Entorno;

/** Deja el expediente en AUTORIZADO, que es el estado con el que se entra a P4. */
async function prepararEntorno(): Promise<Entorno> {
  const { documentClient, tabla } = crearFakeDynamoDocumentClient();

  const otpRepository = crearOtpRepositoryDynamoDb({
    documentClient,
    nombreTabla: NOMBRE_TABLA,
    obtenerPepper: async () => PEPPER,
  });
  const expedientes = crearExpedienteRepositoryDynamoDb({ documentClient, nombreTabla: NOMBRE_TABLA });
  const evidencias = crearEvidenceStoreDynamoDb({ documentClient, nombreTabla: NOMBRE_TABLA });
  const otpProvider = crearOtpProviderMock({ otpRepository, retenerCodigoParaPanelDemo: true });

  let expediente = crearExpedienteInicial({ id: EXPEDIENTE_ID, ahora: AHORA.toISOString() });
  const camino: EstadoExpediente[] = ["CANAL_WA_VERIFICADO", "PLAN_SELECCIONADO", "AUTORIZADO"];
  for (const estado of camino) {
    const paso = transicionarExpediente(expediente, estado);
    if (!paso.ok) throw new Error(paso.error);
    expediente = paso.expediente;
  }
  await expedientes.crear(expediente);

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

function cookiesDe(respuesta: Response, previas = ""): string {
  const crudas = respuesta.headers.getSetCookie?.() ?? [];
  const nuevas = crudas.map((cookie) => cookie.split(";")[0]).filter((par) => !par.endsWith("="));
  const mapa = new Map<string, string>();
  for (const par of [...previas.split("; ").filter(Boolean), ...nuevas]) {
    const [nombre] = par.split("=");
    mapa.set(nombre, par);
  }
  return [...mapa.values()].join("; ");
}

function peticion(cuerpo: unknown, cookies: string): Request {
  return new Request("https://segurolotengo.test/api/p4/otp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "vitest",
      "x-forwarded-for": "200.10.20.30",
      cookie: cookies,
    },
    body: JSON.stringify(cuerpo),
  });
}

async function superficieHttp(respuesta: Response): Promise<string> {
  const cabeceras = [...respuesta.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
  const cuerpo = await respuesta.clone().text();
  return `${respuesta.status}\n${cabeceras}\n${cuerpo}`;
}

describe("P4 · el código del OTP de correo nunca sale por la API del flujo ni por los logs", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    limpiarRegistroDemo();
    compartido.codigosPendientes = [CODIGO_INICIAL, CODIGO_REENVIADO];
    entorno = await prepararEntorno();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("no aparece en respuestas, cookies, base, evidencia ni logs en todo el recorrido de P4", async () => {
    const cookieExpediente = `slt_expediente=${EXPEDIENTE_ID}`;

    // --- 1. Enviar ---------------------------------------------------------
    const respuestaEnvio = await postEnviar(peticion({ correo: CORREO }, cookieExpediente));
    expect(respuestaEnvio.status).toBe(200);

    const cookies = cookiesDe(respuestaEnvio, cookieExpediente);
    const otpId = /slt_otp=([^;]+)/.exec(cookies)?.[1];
    expect(otpId).toBeTruthy();

    // Control positivo: el código existe y el test puede verlo por el canal
    // del panel de demo. Sin esto, las aserciones de abajo no probarían nada.
    expect(obtenerEnvioDemo(otpId!)?.codigo).toBe(CODIGO_INICIAL);

    const superficieEnvio = await superficieHttp(respuestaEnvio);
    expect(superficieEnvio).not.toContain(CODIGO_INICIAL);
    expect(superficieEnvio).toContain("m••••••@example.com");
    expect(superficieEnvio).toContain("MOCK-EMAIL-");

    // --- 2. Verificar con un código equivocado -----------------------------
    const respuestaFallida = await postVerificar(peticion({ codigo: "000000" }, cookies));
    expect(respuestaFallida.status).toBe(400);
    const superficieFallida = await superficieHttp(respuestaFallida);
    expect(superficieFallida).not.toContain(CODIGO_INICIAL);
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
    expect(superficieExito).not.toContain(CODIGO_REENVIADO);
    expect(superficieExito).toContain("CANAL_EMAIL_VERIFICADO");

    // --- 5. Nada persistido contiene el código -----------------------------
    const contenidoTabla = JSON.stringify([...entorno.tabla.values()]);
    expect(contenidoTabla).not.toContain(CODIGO_INICIAL);
    expect(contenidoTabla).not.toContain(CODIGO_REENVIADO);

    // --- 6. Ni la evidencia ------------------------------------------------
    const historial = await entorno.evidencias.obtenerHistorial(EXPEDIENTE_ID);
    const evidenciaSerializada = JSON.stringify(historial);
    expect(evidenciaSerializada).not.toContain(CODIGO_INICIAL);
    expect(evidenciaSerializada).not.toContain(CODIGO_REENVIADO);
    // Control positivo: la evidencia existe y trae lo que exige la regla #10.
    expect(historial.length).toBeGreaterThanOrEqual(4);
    expect(evidenciaSerializada).toContain("m••••••@example.com");
    expect(evidenciaSerializada).toContain("200.10.20.30");

    // --- 7. Ni los logs ----------------------------------------------------
    const logs = entorno.salidaCapturada.join("\n");
    expect(logs).not.toContain(CODIGO_INICIAL);
    expect(logs).not.toContain(CODIGO_REENVIADO);
  });

  it("la dirección completa tampoco sale: siempre enmascarada", async () => {
    const respuesta = await postEnviar(
      peticion({ correo: CORREO }, `slt_expediente=${EXPEDIENTE_ID}`),
    );
    const superficie = await superficieHttp(respuesta);

    expect(superficie).not.toContain(CORREO);
    expect(superficie).not.toContain("monica.gorena");
    expect(superficie).toContain("m••••••@example.com");
  });

  it("sin expediente en la cookie no se manda ningún código", async () => {
    const respuesta = await postEnviar(peticion({ correo: CORREO }, ""));

    expect(respuesta.status).toBe(400);
    expect(await respuesta.clone().text()).toContain("SESION_INVALIDA");
    // Nada llegó a generarse: el código fijado sigue sin consumirse.
    expect(compartido.codigosPendientes[0]).toBe(CODIGO_INICIAL);
  });
});
