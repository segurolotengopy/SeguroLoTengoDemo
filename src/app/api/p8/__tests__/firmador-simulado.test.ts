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
const cerrarSinFirmar = vi.fn();
const obtenerPorId = vi.fn();

vi.mock("@/adapters/mock/signature-provider", () => ({
  abrirEnlaceDeFirmaMock: (...args: unknown[]) => abrir(...args),
  firmarEnCode100Mock: (...args: unknown[]) => firmar(...args),
  cerrarSinFirmarMock: (...args: unknown[]) => cerrarSinFirmar(...args),
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
      hashDocumentoFirmado: "a".repeat(64),
    },
  });
  cerrarSinFirmar.mockReset().mockReturnValue(true);
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
  it("rechaza la firma sobre el acto del expediente de la sesión", async () => {
    const respuesta = await POST(peticion({ accion: "RECHAZAR", idCode100: "C100-DE-OTRA-PERSONA" }));

    expect(respuesta.status).toBe(200);
    expect(cerrarSinFirmar).toHaveBeenCalledWith(ACTO.idCode100, "RECHAZADA", expect.any(String));
    // El rechazo no firma nada: son caminos excluyentes.
    expect(firmar).not.toHaveBeenCalled();
  });

  it("informa el conflicto si el acto ya estaba cerrado", async () => {
    cerrarSinFirmar.mockReturnValue(false);

    const respuesta = await POST(peticion({ accion: "RECHAZAR" }));
    const cuerpo = (await respuesta.json()) as { motivo?: string };

    expect(respuesta.status).toBe(409);
    expect(cuerpo.motivo).toBe("YA_CERRADA");
  });

  it("ignora acciones que no existen", async () => {
    const respuesta = await POST(peticion({ accion: "BORRAR_TODO" }));

    expect(respuesta.status).toBe(400);
    expect(cerrarSinFirmar).not.toHaveBeenCalled();
    expect(firmar).not.toHaveBeenCalled();
  });

  /**
   * Los dos tests que había acá cuidaban la palanca de "cortar el sellado a la
   * mitad": que se pasara solo cuando se pedía y solo con el booleano exacto,
   * para que una cadena colada en el JSON no pudiera inyectar una falla. La
   * palanca desapareció con el documento único (D-11): no hay dos archivos que
   * puedan quedar a medias, así que el modal ya no la ofrece.
   */
  it("firma sin ninguna palanca de falla: el modal ya no tiene qué cortar", async () => {
    await POST(peticion({ accion: "FIRMAR", codigo: "123456" }));

    expect(firmar).toHaveBeenCalledWith(ACTO.idCode100, "123456", expect.any(Object));
    const opciones = firmar.mock.calls[0][2] as Record<string, unknown>;
    expect(opciones).not.toHaveProperty("fallarAMitadDelSellado");
  });

  it("devuelve la huella del documento firmado (D-11)", async () => {
    const respuesta = await POST(peticion({ accion: "FIRMAR", codigo: "123456" }));
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;

    expect(cuerpo.hashDocumentoFirmado).toBeTruthy();
    // Ya no hay una segunda huella que devolver: es un solo archivo.
    expect(cuerpo.hashFipfFirmado).toBeUndefined();
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
