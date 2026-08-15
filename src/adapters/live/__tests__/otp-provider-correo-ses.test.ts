/**
 * Adaptador vivo del OTP de correo por Amazon SES. Sin red ni AWS: el
 * repositorio y el enviador se doblan en memoria. Lo que se prueba acá es el
 * reparto de responsabilidades — el ciclo de vida del código sigue siendo del
 * repositorio (hash, vigencia, intentos, cooldown) y el adaptador solo
 * entrega — y que el código en claro viaja únicamente hacia el enviador.
 */
import { describe, expect, it } from "vitest";
import type {
  CrearOtpInput,
  OtpCreado,
  OtpRepository,
  RegistroOtp,
  ResultadoReenvioOtpRepo,
} from "../../../repositories/otp-repository";
import type { ResultadoVerificacionOtp } from "../../../ports/otp-provider";
import type { CorreoOtpAEnviar, EnviadorCorreoOtp } from "../otp-provider-correo-ses";
import { crearOtpProviderCorreoSes, dividirOtpPorCanal } from "../otp-provider-correo-ses";

/**
 * Doble en memoria de `OtpRepository`. Guarda el código en claro porque es un
 * doble de test — el real persiste solo el hash; el contrato que este doble
 * imita es el de las firmas, no el de almacenamiento.
 */
function repoDoble(): OtpRepository & { codigos: Map<string, string> } {
  interface Interno {
    registro: RegistroOtp;
    codigo: string;
  }
  const items = new Map<string, Interno>();
  const codigos = new Map<string, string>();
  let secuencia = 0;

  return {
    codigos,
    async crear(input: CrearOtpInput): Promise<OtpCreado> {
      secuencia += 1;
      const otpId = `otp-local-${secuencia}`;
      const codigo = String(secuencia).padStart(6, "7");
      const creadoEn = input.ahora ?? "2026-08-14T12:00:00.000Z";
      const expiraEn = "2026-08-14T12:05:00.000Z";
      items.set(otpId, {
        codigo,
        registro: {
          otpId,
          expedienteId: input.expedienteId,
          proposito: input.proposito,
          canal: input.canal,
          destino: input.destino,
          creadoEn,
          expiraEn,
          ultimoEnvioEn: creadoEn,
          intentos: 0,
          consumidoEn: null,
        },
      });
      codigos.set(otpId, codigo);
      return { otpId, codigo, expiraEn };
    },
    async obtener(otpId: string): Promise<RegistroOtp | null> {
      return items.get(otpId)?.registro ?? null;
    },
    async verificarCodigo(otpId: string, codigoIngresado: string): Promise<ResultadoVerificacionOtp> {
      const item = items.get(otpId);
      if (!item) return { ok: false, motivo: "NO_ENCONTRADO" };
      if (item.codigo !== codigoIngresado) {
        return { ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes: 2 };
      }
      return { ok: true };
    },
    async registrarReenvio(otpId: string): Promise<ResultadoReenvioOtpRepo> {
      const item = items.get(otpId);
      if (!item) return { ok: false, motivo: "NO_ENCONTRADO" };
      const codigo = "999888";
      item.codigo = codigo;
      codigos.set(otpId, codigo);
      return { ok: true, codigo, expiraEn: "2026-08-14T12:10:00.000Z" };
    },
  };
}

function enviadorDoble(fallar = false): EnviadorCorreoOtp & { enviados: CorreoOtpAEnviar[] } {
  const enviados: CorreoOtpAEnviar[] = [];
  return {
    enviados,
    async enviar(correo: CorreoOtpAEnviar) {
      if (fallar) return { ok: false as const, detalle: "SES: MessageRejected" };
      enviados.push(correo);
      return { ok: true as const, referencia: `SES-msg-${enviados.length}` };
    },
  };
}

const SOLICITUD_P4 = {
  expedienteId: "exp-1",
  proposito: "VERIFICACION_CORREO" as const,
  destino: { canal: "EMAIL" as const, valor: "monica@example.com" },
};

describe("enviarOtp", () => {
  it("crea el OTP en el repositorio y manda el código por correo al destino", async () => {
    const repo = repoDoble();
    const enviador = enviadorDoble();
    const provider = crearOtpProviderCorreoSes({ otpRepository: repo, enviador });

    const resultado = await provider.enviarOtp(SOLICITUD_P4);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.otpId).toBe("otp-local-1");
    expect(resultado.referenciaEnvio).toBe("SES-msg-1");

    expect(enviador.enviados).toHaveLength(1);
    expect(enviador.enviados[0].para).toBe("monica@example.com");
    expect(enviador.enviados[0].asunto).toContain("SeguroLoTengo");
    // El código real viaja en el cuerpo — es la entrega, no una filtración.
    expect(enviador.enviados[0].texto).toContain(repo.codigos.get("otp-local-1") ?? "NUNCA");
  });

  it("si SES rechaza el envío, informa ERROR_ENVIO sin exponer el cuerpo del correo", async () => {
    const provider = crearOtpProviderCorreoSes({
      otpRepository: repoDoble(),
      enviador: enviadorDoble(true),
    });

    const resultado = await provider.enviarOtp(SOLICITUD_P4);
    expect(resultado).toEqual({ ok: false, motivo: "ERROR_ENVIO", detalle: "SES: MessageRejected" });
  });

  it("rechaza cualquier propósito que no sea el OTP de correo", async () => {
    const provider = crearOtpProviderCorreoSes({
      otpRepository: repoDoble(),
      enviador: enviadorDoble(),
    });

    const resultado = await provider.enviarOtp({
      expedienteId: "exp-1",
      proposito: "VERIFICACION_CELULAR",
      destino: { canal: "WHATSAPP", valor: "+595981123456" },
    });
    expect(resultado.ok).toBe(false);
  });
});

describe("verificarOtp y reenviarOtp", () => {
  it("la verificación es la del repositorio: mismo hash, mismos intentos que el mock", async () => {
    const repo = repoDoble();
    const enviador = enviadorDoble();
    const provider = crearOtpProviderCorreoSes({ otpRepository: repo, enviador });
    await provider.enviarOtp(SOLICITUD_P4);
    const codigo = repo.codigos.get("otp-local-1") ?? "";

    expect(await provider.verificarOtp({ otpId: "otp-local-1", codigoIngresado: "000000" })).toEqual({
      ok: false,
      motivo: "CODIGO_INCORRECTO",
      intentosRestantes: 2,
    });
    expect(await provider.verificarOtp({ otpId: "otp-local-1", codigoIngresado: codigo })).toEqual({
      ok: true,
    });
  });

  it("el reenvío rota el código en el repositorio y manda el NUEVO código al destino persistido", async () => {
    const repo = repoDoble();
    const enviador = enviadorDoble();
    const provider = crearOtpProviderCorreoSes({ otpRepository: repo, enviador });
    await provider.enviarOtp(SOLICITUD_P4);

    const reenvio = await provider.reenviarOtp("otp-local-1");
    expect(reenvio.ok).toBe(true);
    expect(enviador.enviados).toHaveLength(2);
    expect(enviador.enviados[1].para).toBe("monica@example.com");
    expect(enviador.enviados[1].texto).toContain("999888");
  });
});

describe("dividirOtpPorCanal", () => {
  function providerMarcado(marca: string): { provider: import("../../../ports/otp-provider").OtpProvider; llamadas: string[] } {
    const llamadas: string[] = [];
    return {
      llamadas,
      provider: {
        async enviarOtp() {
          llamadas.push(`${marca}:enviar`);
          return { ok: false as const, motivo: "ERROR_ENVIO" as const, detalle: marca };
        },
        async verificarOtp() {
          llamadas.push(`${marca}:verificar`);
          return { ok: false as const, motivo: "NO_ENCONTRADO" as const };
        },
        async reenviarOtp() {
          llamadas.push(`${marca}:reenviar`);
          return { ok: false as const, motivo: "ERROR_ENVIO" as const, detalle: marca };
        },
      },
    };
  }

  it("enruta el envío por propósito, y verificación/reenvío por el canal persistido del OTP", async () => {
    const repo = repoDoble();
    // Un OTP de correo real en el repositorio, para que el canal decida.
    await repo.crear({
      expedienteId: "exp-1",
      proposito: "VERIFICACION_CORREO",
      canal: "EMAIL",
      destino: "monica@example.com",
    });

    const celular = providerMarcado("celular");
    const correo = providerMarcado("correo");
    const dividido = dividirOtpPorCanal({
      celular: celular.provider,
      correo: correo.provider,
      otpRepository: repo,
    });

    await dividido.enviarOtp(SOLICITUD_P4);
    await dividido.enviarOtp({
      expedienteId: "exp-1",
      proposito: "VERIFICACION_CELULAR",
      destino: { canal: "WHATSAPP", valor: "+595981123456" },
    });
    await dividido.verificarOtp({ otpId: "otp-local-1", codigoIngresado: "123456" });
    await dividido.reenviarOtp("otp-local-1");
    // Un otpId desconocido cae al proveedor de celular, que sabe decir que no.
    await dividido.verificarOtp({ otpId: "otp-inexistente", codigoIngresado: "123456" });

    expect(correo.llamadas).toEqual(["correo:enviar", "correo:verificar", "correo:reenviar"]);
    expect(celular.llamadas).toEqual(["celular:enviar", "celular:verificar"]);
  });
});
