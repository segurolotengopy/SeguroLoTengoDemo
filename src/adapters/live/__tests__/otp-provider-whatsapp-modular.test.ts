/**
 * Adaptador vivo de `OtpProvider` sobre WhatsApp-Modular. El cliente HTTP se
 * dobla en memoria: acá se prueba el reparto celular/correo, la metadata que
 * alimenta al `LectorMetadataOtp`, el uso único y la semántica del reenvío
 * (un OTP nuevo con cooldown aplicado por el servicio).
 */
import { afterEach, describe, expect, it } from "vitest";
import type { OtpProvider } from "../../../ports/otp-provider";
import type {
  ClienteWhatsAppModular,
  RespuestaSolicitudWm,
  RespuestaVerificacionWm,
} from "../whatsapp-modular";
import {
  crearOtpFirmaRemotoWhatsAppModular,
  crearOtpProviderWhatsAppModular,
  lectorConMetadataWhatsAppModular,
  limpiarMetadataWhatsAppModular,
} from "../otp-provider";

afterEach(() => {
  limpiarMetadataWhatsAppModular();
});

interface SolicitudVista {
  telefonoE164: string;
  proposito: string;
  idempotencyKey: string;
}

function clienteDoble(opciones: {
  solicitudes?: RespuestaSolicitudWm[];
  verificaciones?: RespuestaVerificacionWm[];
  vistas?: SolicitudVista[];
  codigosVistos?: string[];
}): ClienteWhatsAppModular {
  const solicitudes = [...(opciones.solicitudes ?? [])];
  const verificaciones = [...(opciones.verificaciones ?? [])];
  return {
    async solicitarOtp(solicitud) {
      opciones.vistas?.push(solicitud);
      const respuesta = solicitudes.shift();
      if (!respuesta) throw new Error("solicitud inesperada en el doble");
      return respuesta;
    },
    async verificarOtp(verificacion) {
      opciones.codigosVistos?.push(verificacion.codigo);
      const respuesta = verificaciones.shift();
      if (!respuesta) throw new Error("verificación inesperada en el doble");
      return respuesta;
    },
  };
}

/** Delegado de correo que registra qué le llegó y responde fijo. */
function correoDoble(registro: string[]): OtpProvider {
  return {
    async enviarOtp(solicitud) {
      registro.push(`enviar:${solicitud.proposito}`);
      return {
        ok: true,
        otpId: "otp-correo-1",
        expiraEn: "2026-08-14T12:05:00.000Z",
        referenciaEnvio: "MOCK-EMAIL-1",
      };
    },
    async verificarOtp(solicitud) {
      registro.push(`verificar:${solicitud.otpId}`);
      return { ok: false, motivo: "NO_ENCONTRADO" };
    },
    async reenviarOtp(otpId) {
      registro.push(`reenviar:${otpId}`);
      return { ok: false, motivo: "ERROR_ENVIO", detalle: "doble" };
    },
  };
}

const ENVIO_OK: RespuestaSolicitudWm = {
  ok: true,
  otpId: "otp-wm-1",
  expiraEn: "2026-08-14T12:05:00.000Z",
  destinoEnmascarado: "+595 981 *** 456",
};

const SOLICITUD_P1 = {
  expedienteId: "exp-1",
  proposito: "VERIFICACION_CELULAR" as const,
  destino: { canal: "WHATSAPP" as const, valor: "+595981123456" },
};

describe("enviarOtp", () => {
  it("manda el OTP de celular por WhatsApp-Modular con propósito PHONE_VERIFICATION", async () => {
    const vistas: SolicitudVista[] = [];
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({ solicitudes: [ENVIO_OK], vistas }),
      correo: correoDoble([]),
      ahora: () => "2026-08-14T12:00:00.000Z",
    });

    const resultado = await provider.enviarOtp(SOLICITUD_P1);

    expect(resultado).toEqual({
      ok: true,
      otpId: "otp-wm-1",
      expiraEn: "2026-08-14T12:05:00.000Z",
      referenciaEnvio: "WM-OTP-otp-wm-1",
    });
    expect(vistas).toHaveLength(1);
    expect(vistas[0].telefonoE164).toBe("+595981123456");
    expect(vistas[0].proposito).toBe("PHONE_VERIFICATION");
  });

  it("y deja la metadata que el motor de canal necesita, visible por el lector combinado", async () => {
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({ solicitudes: [ENVIO_OK] }),
      correo: correoDoble([]),
      ahora: () => "2026-08-14T12:00:00.000Z",
    });
    await provider.enviarOtp(SOLICITUD_P1);

    const lector = lectorConMetadataWhatsAppModular({ obtener: async () => null });
    expect(await lector.obtener("otp-wm-1")).toEqual({
      otpId: "otp-wm-1",
      expedienteId: "exp-1",
      proposito: "VERIFICACION_CELULAR",
      destino: "+595981123456",
      ultimoEnvioEn: "2026-08-14T12:00:00.000Z",
      consumidoEn: null,
    });
  });

  it("el cooldown del servicio (WM-1020) vuelve como REENVIO_BLOQUEADO", async () => {
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({
        solicitudes: [{ ok: false, motivo: "COOLDOWN", segundosRestantes: 37 }],
      }),
      correo: correoDoble([]),
    });

    expect(await provider.enviarOtp(SOLICITUD_P1)).toEqual({
      ok: false,
      motivo: "REENVIO_BLOQUEADO",
      segundosRestantes: 37,
    });
  });

  it("el OTP de correo (P4) se delega al adaptador de correo: WhatsApp-Modular no envía correo", async () => {
    const registro: string[] = [];
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({}),
      correo: correoDoble(registro),
    });

    const resultado = await provider.enviarOtp({
      expedienteId: "exp-1",
      proposito: "VERIFICACION_CORREO",
      destino: { canal: "EMAIL", valor: "monica@example.com" },
    });

    expect(resultado.ok).toBe(true);
    expect(registro).toEqual(["enviar:VERIFICACION_CORREO"]);
  });

  it("el OTP de firma viaja con el propósito SIGNATURE_P7A, no con el de verificación", async () => {
    const vistas: SolicitudVista[] = [];
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({
        solicitudes: [
          {
            ok: true,
            otpId: "otp-firma",
            expiraEn: "2026-08-27T10:05:00.000Z",
            destinoEnmascarado: "+595 ••• ••• 000",
          },
        ],
        vistas,
      }),
      correo: correoDoble([]),
    });

    const resultado = await provider.enviarOtp({
      expedienteId: "exp-1",
      proposito: "FIRMA",
      destino: { canal: "WHATSAPP", valor: "+595981000000" },
    });

    expect(resultado.ok).toBe(true);
    // La plantilla del servicio no puede ser la misma que la de P1: el código
    // que firma un contrato no se anuncia como verificación de número.
    expect(vistas.map((v) => v.proposito)).toEqual(["SIGNATURE_P7A"]);
  });

  it("el OTP de firma por correo se delega al adaptador de correo", async () => {
    const registro: string[] = [];
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({}),
      correo: correoDoble(registro),
    });

    const resultado = await provider.enviarOtp({
      expedienteId: "exp-1",
      proposito: "FIRMA",
      destino: { canal: "EMAIL", valor: "monica@example.com" },
    });

    expect(resultado.ok).toBe(true);
    expect(registro).toEqual(["enviar:FIRMA"]);
  });

  it("rechaza un destino que no sea WhatsApp para el propósito de celular", async () => {
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({}),
      correo: correoDoble([]),
    });

    const resultado = await provider.enviarOtp({
      expedienteId: "exp-1",
      proposito: "VERIFICACION_CELULAR",
      destino: { canal: "EMAIL", valor: "monica@example.com" },
    });

    expect(resultado.ok).toBe(false);
  });
});

describe("verificarOtp", () => {
  it("verifica contra el servicio y consume el OTP: la segunda vez es YA_UTILIZADO sin tocar la red", async () => {
    const verificaciones: RespuestaVerificacionWm[] = [{ ok: true }];
    const codigosVistos: string[] = [];
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({ solicitudes: [ENVIO_OK], verificaciones, codigosVistos }),
      correo: correoDoble([]),
    });
    await provider.enviarOtp(SOLICITUD_P1);

    expect(await provider.verificarOtp({ otpId: "otp-wm-1", codigoIngresado: "123456" })).toEqual({
      ok: true,
    });
    expect(await provider.verificarOtp({ otpId: "otp-wm-1", codigoIngresado: "123456" })).toEqual({
      ok: false,
      motivo: "YA_UTILIZADO",
    });
    // Una sola verificación llegó al servicio; la segunda se cortó acá.
    expect(codigosVistos).toEqual(["123456"]);
  });

  it("propaga código incorrecto, vencimiento y agotamiento tal como los informa el servicio", async () => {
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({
        solicitudes: [ENVIO_OK],
        verificaciones: [
          { ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes: 2 },
          { ok: false, motivo: "EXPIRADO" },
          { ok: false, motivo: "INTENTOS_AGOTADOS" },
        ],
      }),
      correo: correoDoble([]),
    });
    await provider.enviarOtp(SOLICITUD_P1);

    expect(await provider.verificarOtp({ otpId: "otp-wm-1", codigoIngresado: "000000" })).toEqual({
      ok: false,
      motivo: "CODIGO_INCORRECTO",
      intentosRestantes: 2,
    });
    expect(await provider.verificarOtp({ otpId: "otp-wm-1", codigoIngresado: "000000" })).toEqual({
      ok: false,
      motivo: "EXPIRADO",
    });
    expect(await provider.verificarOtp({ otpId: "otp-wm-1", codigoIngresado: "000000" })).toEqual({
      ok: false,
      motivo: "INTENTOS_AGOTADOS",
    });
  });

  it("un otpId ajeno se delega al adaptador de correo (P4 o inexistente)", async () => {
    const registro: string[] = [];
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({}),
      correo: correoDoble(registro),
    });

    expect(await provider.verificarOtp({ otpId: "otp-de-p4", codigoIngresado: "123456" })).toEqual({
      ok: false,
      motivo: "NO_ENCONTRADO",
    });
    expect(registro).toEqual(["verificar:otp-de-p4"]);
  });

  it("una falla de infraestructura del servicio se propaga como excepción, nunca como un motivo inventado", async () => {
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({
        solicitudes: [ENVIO_OK],
        verificaciones: [{ ok: false, motivo: "ERROR", detalle: "SIN_RESPUESTA: TimeoutError" }],
      }),
      correo: correoDoble([]),
    });
    await provider.enviarOtp(SOLICITUD_P1);

    await expect(
      provider.verificarOtp({ otpId: "otp-wm-1", codigoIngresado: "123456" }),
    ).rejects.toThrow(/SIN_RESPUESTA/);
  });
});

describe("reenviarOtp", () => {
  it("reenviar es pedir un OTP nuevo al servicio: vuelve un otpId NUEVO con su propia metadata", async () => {
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({
        solicitudes: [
          ENVIO_OK,
          { ok: true, otpId: "otp-wm-2", expiraEn: "2026-08-14T12:07:00.000Z", destinoEnmascarado: "" },
        ],
      }),
      correo: correoDoble([]),
      ahora: () => "2026-08-14T12:02:00.000Z",
    });
    await provider.enviarOtp(SOLICITUD_P1);

    const reenvio = await provider.reenviarOtp("otp-wm-1");
    expect(reenvio).toEqual({
      ok: true,
      otpId: "otp-wm-2",
      expiraEn: "2026-08-14T12:07:00.000Z",
      referenciaEnvio: "WM-OTP-otp-wm-2",
    });

    const lector = lectorConMetadataWhatsAppModular({ obtener: async () => null });
    const metadata = await lector.obtener("otp-wm-2");
    expect(metadata?.expedienteId).toBe("exp-1");
    expect(metadata?.destino).toBe("+595981123456");
  });

  it("dentro del cooldown el servicio responde WM-1020 y acá vuelve REENVIO_BLOQUEADO", async () => {
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({
        solicitudes: [ENVIO_OK, { ok: false, motivo: "COOLDOWN", segundosRestantes: 58 }],
      }),
      correo: correoDoble([]),
    });
    await provider.enviarOtp(SOLICITUD_P1);

    expect(await provider.reenviarOtp("otp-wm-1")).toEqual({
      ok: false,
      motivo: "REENVIO_BLOQUEADO",
      segundosRestantes: 58,
    });
  });

  it("un otpId ajeno se delega al adaptador de correo", async () => {
    const registro: string[] = [];
    const provider = crearOtpProviderWhatsAppModular({
      cliente: clienteDoble({}),
      correo: correoDoble(registro),
    });

    await provider.reenviarOtp("otp-de-p4");
    expect(registro).toEqual(["reenviar:otp-de-p4"]);
  });
});

describe("OtpFirmaRemoto (OTP del acto de firma simulado)", () => {
  it("solicita con propósito SIGNATURE_P7A — independiente del OTP de P1 (regla inviolable #1)", async () => {
    const vistas: SolicitudVista[] = [];
    const remoto = crearOtpFirmaRemotoWhatsAppModular(
      clienteDoble({
        solicitudes: [
          { ok: true, otpId: "otp-firma-1", expiraEn: "2026-08-14T12:05:00.000Z", destinoEnmascarado: "" },
        ],
        vistas,
      }),
    );

    const resultado = await remoto.solicitar("+595981123456");
    expect(resultado).toEqual({ ok: true, otpId: "otp-firma-1", expiraEn: "2026-08-14T12:05:00.000Z" });
    expect(vistas[0].proposito).toBe("SIGNATURE_P7A");
  });

  it("mapea las respuestas de verificación a los motivos del acto de firma", async () => {
    const remoto = crearOtpFirmaRemotoWhatsAppModular(
      clienteDoble({
        verificaciones: [
          { ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes: 1 },
          { ok: false, motivo: "EXPIRADO" },
          { ok: false, motivo: "INTENTOS_AGOTADOS" },
          { ok: false, motivo: "ERROR", detalle: "500" },
          { ok: true },
        ],
      }),
    );

    expect(await remoto.verificar("otp-firma-1", "000000")).toEqual({
      ok: false,
      motivo: "CODIGO_INCORRECTO",
      intentosRestantes: 1,
    });
    expect(await remoto.verificar("otp-firma-1", "000000")).toEqual({
      ok: false,
      motivo: "OTP_EXPIRADO",
    });
    expect(await remoto.verificar("otp-firma-1", "000000")).toEqual({
      ok: false,
      motivo: "INTENTOS_AGOTADOS",
    });
    expect(await remoto.verificar("otp-firma-1", "000000")).toEqual({
      ok: false,
      motivo: "FALLA_DEL_PROVEEDOR",
    });
    expect(await remoto.verificar("otp-firma-1", "123456")).toEqual({ ok: true });
  });
});
