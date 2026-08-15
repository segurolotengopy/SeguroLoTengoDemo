/**
 * Cliente HTTP del `otp-service` de WhatsApp-Modular. Sin red real: el
 * `fetch` se inyecta y devuelve respuestas armadas con el contrato del
 * servicio (202 con `RequestOutput`, errores `application/problem+json` con
 * código `WM-xxxx`).
 */
import { describe, expect, it } from "vitest";
import {
  crearClienteWhatsAppModular,
  crearClienteWhatsAppModularDesdeEntorno,
} from "../whatsapp-modular";

interface LlamadaRegistrada {
  url: string;
  init: RequestInit;
}

function fetchDeRespuesta(
  status: number,
  cuerpo: unknown,
  llamadas: LlamadaRegistrada[] = [],
): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {} });
    return new Response(cuerpo === null ? "" : JSON.stringify(cuerpo), { status });
  }) as typeof fetch;
}

const CONFIG_BASE = { baseUrl: "http://wm.local:8080", token: "token-de-test" };

const SOLICITUD = {
  telefonoE164: "+595981123456",
  proposito: "PHONE_VERIFICATION" as const,
  idempotencyKey: "clave-1",
};

describe("solicitarOtp", () => {
  it("mapea el 202 al resultado exitoso, con la URL versionada y los encabezados del contrato", async () => {
    const llamadas: LlamadaRegistrada[] = [];
    const cliente = crearClienteWhatsAppModular({
      ...CONFIG_BASE,
      fetchFn: fetchDeRespuesta(
        202,
        {
          otpId: "otp-abc",
          channel: "WHATSAPP",
          maskedTo: "+595 981 *** 456",
          expiresAt: "2026-08-14T12:05:00.000Z",
          attemptsAllowed: 3,
          resendAfter: "2026-08-14T12:01:00.000Z",
        },
        llamadas,
      ),
    });

    const resultado = await cliente.solicitarOtp(SOLICITUD);

    expect(resultado).toEqual({
      ok: true,
      otpId: "otp-abc",
      expiraEn: "2026-08-14T12:05:00.000Z",
      destinoEnmascarado: "+595 981 *** 456",
    });

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe("http://wm.local:8080/v1/otp/request");
    const encabezados = llamadas[0].init.headers as Record<string, string>;
    expect(encabezados.authorization).toBe("Bearer token-de-test");
    expect(encabezados["idempotency-key"]).toBe("clave-1");
    expect(JSON.parse(String(llamadas[0].init.body))).toEqual({
      phone: "+595981123456",
      purpose: "PHONE_VERIFICATION",
      locale: "es_PY",
      channel: "AUTO",
    });
  });

  it("WM-1020 (cooldown de 60 s) se informa con los segundos restantes", async () => {
    const cliente = crearClienteWhatsAppModular({
      ...CONFIG_BASE,
      fetchFn: fetchDeRespuesta(409, {
        type: "about:blank",
        title: "Reenvío no permitido todavía: faltan 42 s",
        status: 409,
        code: "WM-1020",
        retryInMs: 41_300,
      }),
    });

    const resultado = await cliente.solicitarOtp(SOLICITUD);
    expect(resultado).toEqual({ ok: false, motivo: "COOLDOWN", segundosRestantes: 42 });
  });

  it("cualquier otro problem+json vuelve como ERROR con el código estable en el detalle", async () => {
    const cliente = crearClienteWhatsAppModular({
      ...CONFIG_BASE,
      fetchFn: fetchDeRespuesta(503, {
        title: "Tope diario global de mensajes alcanzado; envío suspendido hasta mañana",
        status: 503,
        code: "WM-2020",
      }),
    });

    const resultado = await cliente.solicitarOtp(SOLICITUD);
    expect(resultado.ok).toBe(false);
    if (resultado.ok || resultado.motivo !== "ERROR") throw new Error("se esperaba ERROR");
    expect(resultado.detalle).toContain("WM-2020");
  });

  it("una falla de red no lanza: vuelve como ERROR sin respuesta", async () => {
    const cliente = crearClienteWhatsAppModular({
      ...CONFIG_BASE,
      fetchFn: (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
    });

    const resultado = await cliente.solicitarOtp(SOLICITUD);
    expect(resultado.ok).toBe(false);
    if (resultado.ok || resultado.motivo !== "ERROR") throw new Error("se esperaba ERROR");
    expect(resultado.detalle).toContain("SIN_RESPUESTA");
  });
});

describe("verificarOtp", () => {
  it("mapea el 200 {verified:true} al resultado exitoso", async () => {
    const cliente = crearClienteWhatsAppModular({
      ...CONFIG_BASE,
      fetchFn: fetchDeRespuesta(200, { verified: true }),
    });

    expect(await cliente.verificarOtp({ otpId: "otp-abc", codigo: "123456" })).toEqual({ ok: true });
  });

  it("WM-1050 vuelve como CODIGO_INCORRECTO con los intentos restantes", async () => {
    const cliente = crearClienteWhatsAppModular({
      ...CONFIG_BASE,
      fetchFn: fetchDeRespuesta(401, {
        title: "Código incorrecto; intentos restantes: 2",
        status: 401,
        code: "WM-1050",
        attemptsLeft: 2,
      }),
    });

    expect(await cliente.verificarOtp({ otpId: "otp-abc", codigo: "000000" })).toEqual({
      ok: false,
      motivo: "CODIGO_INCORRECTO",
      intentosRestantes: 2,
    });
  });

  it("WM-1060 con título de vencimiento vuelve como EXPIRADO", async () => {
    const cliente = crearClienteWhatsAppModular({
      ...CONFIG_BASE,
      fetchFn: fetchDeRespuesta(410, { title: "El OTP venció", status: 410, code: "WM-1060" }),
    });

    expect(await cliente.verificarOtp({ otpId: "otp-abc", codigo: "123456" })).toEqual({
      ok: false,
      motivo: "EXPIRADO",
    });
  });

  it("WM-1060 con título de bloqueo vuelve como INTENTOS_AGOTADOS", async () => {
    const cliente = crearClienteWhatsAppModular({
      ...CONFIG_BASE,
      fetchFn: fetchDeRespuesta(410, {
        title: "El OTP quedó bloqueado por intentos fallidos",
        status: 410,
        code: "WM-1060",
      }),
    });

    expect(await cliente.verificarOtp({ otpId: "otp-abc", codigo: "123456" })).toEqual({
      ok: false,
      motivo: "INTENTOS_AGOTADOS",
    });
  });
});

describe("configuración desde el entorno", () => {
  it("con las dos variables construye el cliente", () => {
    expect(() =>
      crearClienteWhatsAppModularDesdeEntorno({
        WHATSAPP_MODULAR_URL: "http://wm.local:8080",
        WHATSAPP_MODULAR_TOKEN: "token",
      }),
    ).not.toThrow();
  });

  it("nombra la variable faltante sin exponer valores", () => {
    expect(() => crearClienteWhatsAppModularDesdeEntorno({})).toThrow(
      /WHATSAPP_MODULAR_URL, WHATSAPP_MODULAR_TOKEN/,
    );
    expect(() =>
      crearClienteWhatsAppModularDesdeEntorno({ WHATSAPP_MODULAR_URL: "http://wm.local:8080" }),
    ).toThrow(/WHATSAPP_MODULAR_TOKEN/);
  });
});
