/**
 * El firmador simulado de P8.
 *
 * Este endpoint hace lo mismo que `/api/demo-panel/firma` pero **sin la clave
 * del panel**, así que lo único que lo protege es de dónde saca el acto de
 * firma. Eso es lo que se prueba acá, junto con la puerta de `DEMO_MODE` y la
 * regla inviolable #2 (el código nunca vuelve por la API).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ACTO = {
  idCode100: "C100-DEL-EXPEDIENTE",
  canal: "WHATSAPP" as const,
  destinoEnmascarado: "+595 9•• ••• 336",
  enlaceEnviadoEn: "2026-08-16T12:00:00.000Z",
  venceEn: "2026-08-17T12:00:00.000Z",
};

const abrir = vi.fn();
const firmar = vi.fn();
const obtenerPorId = vi.fn();

vi.mock("@/adapters/mock/signature-provider", () => ({
  abrirEnlaceDeFirmaMock: (...args: unknown[]) => abrir(...args),
  firmarEnCode100Mock: (...args: unknown[]) => firmar(...args),
}));

vi.mock("@/adapters/registro", () => ({
  obtenerOtpFirmaRemoto: () => null,
}));

vi.mock("@/repositories", () => ({
  crearExpedienteRepository: () => ({ obtenerPorId: (id: string) => obtenerPorId(id) }),
}));

import { POST } from "@/app/api/p8/firmador-simulado/route.demo";

/** Petición con las cookies del flujo: la que ata al expediente es `slt_expediente`. */
function peticion(cuerpo: unknown): Request {
  return new Request("https://segurolotengo.test/api/p8/firmador-simulado", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "slt_sesion=sesion-de-prueba; slt_expediente=exp-de-prueba",
    },
    body: JSON.stringify(cuerpo),
  });
}

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  abrir.mockReset().mockResolvedValue({ ok: true, expiraEn: "2026-08-16T12:05:00.000Z" });
  firmar.mockReset().mockResolvedValue({
    ok: true,
    firma: {
      firmadoEn: "2026-08-16T12:01:00.000Z",
      hashSolicitudFirmada: "a".repeat(64),
      hashFipfFirmado: "b".repeat(64),
    },
  });
  obtenerPorId.mockReset().mockResolvedValue({ actoDeFirma: ACTO });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("puerta de DEMO_MODE", () => {
  it("responde 404 con el flag apagado", async () => {
    vi.stubEnv("DEMO_MODE", "false");

    const respuesta = await POST(peticion({ accion: "ABRIR" }));

    expect(respuesta.status).toBe(404);
    expect(abrir).not.toHaveBeenCalled();
  });
});

describe("de dónde sale el acto de firma", () => {
  it("usa el del expediente de la sesión, no el que manda el cliente", async () => {
    // Es la propiedad que reemplaza a la clave del panel: un pedido solo
    // puede afectar al expediente de quien lo manda.
    await POST(peticion({ accion: "ABRIR", idCode100: "C100-DE-OTRA-PERSONA" }));

    expect(abrir).toHaveBeenCalledWith(ACTO.idCode100, expect.anything());
  });

  it("no firma el acto de otro aunque lo pidan explícitamente", async () => {
    await POST(peticion({ accion: "FIRMAR", codigo: "123456", idCode100: "C100-DE-OTRA-PERSONA" }));

    expect(firmar).toHaveBeenCalledWith(ACTO.idCode100, "123456", expect.anything());
  });

  it("rechaza si no hay cookie de sesión", async () => {
    const sinCookie = new Request("https://segurolotengo.test/api/p8/firmador-simulado", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accion: "ABRIR" }),
    });

    const respuesta = await POST(sinCookie);
    const cuerpo = (await respuesta.json()) as { motivo?: string };

    expect(respuesta.status).toBe(400);
    expect(cuerpo.motivo).toBe("SESION_INVALIDA");
    expect(abrir).not.toHaveBeenCalled();
  });

  it("rechaza si el expediente todavía no tiene acto de firma", async () => {
    obtenerPorId.mockResolvedValue({ actoDeFirma: null });

    const respuesta = await POST(peticion({ accion: "ABRIR" }));
    const cuerpo = (await respuesta.json()) as { motivo?: string };

    expect(respuesta.status).toBe(409);
    expect(cuerpo.motivo).toBe("FIRMA_NO_INICIADA");
  });
});

describe("regla inviolable #2", () => {
  it("ninguna respuesta trae el código del OTP", async () => {
    const abierta = await POST(peticion({ accion: "ABRIR" }));
    const firmada = await POST(peticion({ accion: "FIRMAR", codigo: "123456" }));

    for (const respuesta of [abierta, firmada]) {
      const texto = await respuesta.text();
      expect(texto).not.toContain("codigo");
      expect(texto).not.toContain("123456");
    }
  });

  it("exige un código para firmar, en vez de aprobar por omisión", async () => {
    const respuesta = await POST(peticion({ accion: "FIRMAR" }));

    expect(respuesta.status).toBe(400);
    expect(firmar).not.toHaveBeenCalled();
  });
});

describe("acciones admitidas", () => {
  it("no expone RECHAZAR, que es una palanca del panel de demo", async () => {
    // Rechazar la firma es una demostración de falla y vive en el panel. Acá
    // la ventana solo hace lo que haría la persona: abrir y firmar.
    const respuesta = await POST(peticion({ accion: "RECHAZAR" }));

    expect(respuesta.status).toBe(400);
  });

  it("devuelve las dos huellas juntas al firmar (regla inviolable #3)", async () => {
    const respuesta = await POST(peticion({ accion: "FIRMAR", codigo: "123456" }));
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;

    expect(cuerpo.hashSolicitudFirmada).toBeTruthy();
    expect(cuerpo.hashFipfFirmado).toBeTruthy();
  });

  it("propaga los intentos restantes de un código incorrecto", async () => {
    firmar.mockResolvedValue({ ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes: 2 });

    const respuesta = await POST(peticion({ accion: "FIRMAR", codigo: "000000" }));
    const cuerpo = (await respuesta.json()) as { motivo?: string; intentosRestantes?: number };

    expect(respuesta.status).toBe(409);
    expect(cuerpo.motivo).toBe("CODIGO_INCORRECTO");
    expect(cuerpo.intentosRestantes).toBe(2);
  });
});
