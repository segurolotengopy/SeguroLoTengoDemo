/**
 * Adaptador vivo del OTP de correo (P4) sobre Amazon SES (ítem 4 de
 * `docs/Tabla de Integraciones externas - Tabla.csv`: SES como plataforma,
 * Infobip 2FA Email como backup — decisión del dueño, 2026-08-14). Se activa
 * con `INTEGRATION_OTP_EMAIL=live` + `OTP_EMAIL_FROM`.
 *
 * A diferencia del OTP de WhatsApp (que WhatsApp-Modular genera y verifica),
 * acá el ciclo de vida completo sigue siendo nuestro: `OtpRepository` genera
 * el código, persiste **solo el hash** (regla inviolable #2) y aplica
 * vigencia, intentos, uso único y cooldown contra DynamoDB — exactamente igual
 * que el mock. Lo único que cambia es la entrega: el código viaja en un correo
 * real en vez de quedar retenido para el panel de demo. Por eso el código en
 * claro existe únicamente entre `crear()` y `enviar()`, nunca se retiene (ni
 * siquiera con `DEMO_MODE=true`) y jamás se loguea.
 *
 * El envío en sí pasa por `EnviadorCorreoOtp`, una interfaz mínima que en
 * producción implementa SES y en tests un doble en memoria — mismo criterio
 * que el `fetchFn` inyectable del cliente de WhatsApp-Modular.
 */
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { canalCoherenteConProposito } from "../../ports/otp-provider";
import type {
  OtpProvider,
  PropositoOtp,
  ResultadoEnvioOtp,
  ResultadoVerificacionOtp,
  SolicitudEnvioOtp,
  SolicitudVerificacionOtp,
} from "../../ports/otp-provider";
import type { OtpRepository } from "../../repositories/otp-repository";

export interface CorreoOtpAEnviar {
  readonly para: string;
  readonly asunto: string;
  readonly texto: string;
}

export type ResultadoEnvioCorreo =
  | { readonly ok: true; readonly referencia: string }
  | { readonly ok: false; readonly detalle: string };

export interface EnviadorCorreoOtp {
  enviar(correo: CorreoOtpAEnviar): Promise<ResultadoEnvioCorreo>;
}

/**
 * Implementación SES del enviador. El detalle de un fallo nunca incluye el
 * cuerpo del correo (que contiene el código): solo el nombre del error.
 */
export function crearEnviadorSes(opciones: {
  readonly cliente: SESv2Client;
  readonly remitente: string;
}): EnviadorCorreoOtp {
  return {
    async enviar(correo: CorreoOtpAEnviar): Promise<ResultadoEnvioCorreo> {
      try {
        const salida = await opciones.cliente.send(
          new SendEmailCommand({
            FromEmailAddress: opciones.remitente,
            Destination: { ToAddresses: [correo.para] },
            Content: {
              Simple: {
                Subject: { Data: correo.asunto, Charset: "UTF-8" },
                Body: { Text: { Data: correo.texto, Charset: "UTF-8" } },
              },
            },
          }),
        );
        return { ok: true, referencia: `SES-${salida.MessageId ?? "SIN-MESSAGE-ID"}` };
      } catch (error) {
        const nombre = error instanceof Error ? error.name : "ERROR_DESCONOCIDO";
        return { ok: false, detalle: `SES: ${nombre}` };
      }
    },
  };
}

/**
 * Texto del correo. Sin HTML, sin enlaces, sin marketing: el mismo criterio
 * que la plantilla AUTHENTICATION de WhatsApp. El literal de P4 en pantalla
 * es el de la especificación; esto es el mensaje del canal.
 */
/**
 * El texto cambia con el propósito, y no por prolijidad: un código que firma
 * un contrato de seguro de vida no puede anunciarse como "verificación de
 * correo". La persona tiene que saber qué está por hacer con ese código
 * antes de tipearlo (Res. SS.SG. 210/2025, art. 6 — consentimiento
 * informado, y regla inviolable #1: son actos distintos).
 */
function redactarCorreo(
  destino: string,
  codigo: string,
  proposito: PropositoOtp,
): CorreoOtpAEnviar {
  const cierre =
    "Si no lo pediste, ignorá este mensaje. Nunca te vamos a pedir este " +
    "código por teléfono ni por WhatsApp.\n\n" +
    "SeguroLoTengo — Interseguros S.A. · Alianza Garantía Seguros y Reaseguros S.A.";

  if (proposito === "FIRMA") {
    return {
      para: destino,
      asunto: "Tu código para firmar — SeguroLoTengo",
      texto:
        `Tu código para firmar es: ${codigo}\n\n` +
        "Con este código vas a firmar electrónicamente tu Solicitud de Seguro " +
        "y el Formulario de Identificación de Persona Física. Revisá los " +
        "documentos antes de usarlo.\n\n" +
        "Vence en 5 minutos y solo se puede usar una vez.\n\n" +
        cierre,
    };
  }

  return {
    para: destino,
    asunto: "Tu código de verificación de correo — SeguroLoTengo",
    texto:
      `Tu código de verificación es: ${codigo}\n\n` +
      "Vence en 5 minutos y solo se puede usar una vez. Ingresalo en la " +
      "pantalla de verificación de correo de SeguroLoTengo.\n\n" +
      cierre,
  };
}

export interface OpcionesOtpProviderCorreoSes {
  readonly otpRepository: OtpRepository;
  readonly enviador: EnviadorCorreoOtp;
  readonly ahora?: () => string;
}

export function crearOtpProviderCorreoSes(opciones: OpcionesOtpProviderCorreoSes): OtpProvider {
  const { otpRepository, enviador } = opciones;
  const ahora = opciones.ahora ?? (() => new Date().toISOString());

  return {
    async enviarOtp(solicitud: SolicitudEnvioOtp): Promise<ResultadoEnvioOtp> {
      if (
        solicitud.destino.canal !== "EMAIL" ||
        !canalCoherenteConProposito(solicitud.proposito, solicitud.destino.canal)
      ) {
        return {
          ok: false,
          motivo: "ERROR_ENVIO",
          detalle: "Este adaptador solo envía OTP por correo (VERIFICACION_CORREO o FIRMA · EMAIL).",
        };
      }

      const creado = await otpRepository.crear({
        expedienteId: solicitud.expedienteId,
        proposito: solicitud.proposito,
        canal: solicitud.destino.canal,
        destino: solicitud.destino.valor,
        ahora: ahora(),
      });

      const envio = await enviador.enviar(
        redactarCorreo(solicitud.destino.valor, creado.codigo, solicitud.proposito),
      );
      // `creado.codigo` muere acá: si el envío falló, el registro huérfano
      // vence solo (TTL) y el reintento de la pantalla crea un OTP nuevo.
      if (!envio.ok) return { ok: false, motivo: "ERROR_ENVIO", detalle: envio.detalle };

      return { ok: true, otpId: creado.otpId, expiraEn: creado.expiraEn, referenciaEnvio: envio.referencia };
    },

    async verificarOtp(solicitud: SolicitudVerificacionOtp): Promise<ResultadoVerificacionOtp> {
      return otpRepository.verificarCodigo(solicitud.otpId, solicitud.codigoIngresado, ahora());
    },

    async reenviarOtp(otpId: string): Promise<ResultadoEnvioOtp> {
      const instante = ahora();
      const rotado = await otpRepository.registrarReenvio(otpId, instante);

      if (!rotado.ok) {
        if (rotado.motivo === "REENVIO_BLOQUEADO") {
          return { ok: false, motivo: "REENVIO_BLOQUEADO", segundosRestantes: rotado.segundosRestantes };
        }
        return { ok: false, motivo: "ERROR_ENVIO", detalle: "No existe un OTP con ese identificador." };
      }

      const registro = await otpRepository.obtener(otpId);
      if (!registro) {
        return { ok: false, motivo: "ERROR_ENVIO", detalle: "No existe un OTP con ese identificador." };
      }

      const envio = await enviador.enviar(
        redactarCorreo(registro.destino, rotado.codigo, registro.proposito),
      );
      if (!envio.ok) return { ok: false, motivo: "ERROR_ENVIO", detalle: envio.detalle };

      return { ok: true, otpId, expiraEn: rotado.expiraEn, referenciaEnvio: envio.referencia };
    },
  };
}

/**
 * Divide un `OtpProvider` por canal cuando el celular y el correo tienen
 * implementaciones distintas (p. ej. celular en mock y correo por SES). Para
 * verificar y reenviar —que solo reciben `otpId`— resuelve el dueño mirando
 * el `canal` persistido del OTP, que es dato del repositorio y no algo que el
 * cliente pueda declarar.
 */
export function dividirOtpPorCanal(opciones: {
  readonly celular: OtpProvider;
  readonly correo: OtpProvider;
  readonly otpRepository: OtpRepository;
}): OtpProvider {
  const { celular, correo, otpRepository } = opciones;

  async function duenoDe(otpId: string): Promise<OtpProvider> {
    const registro = await otpRepository.obtener(otpId);
    return registro?.canal === "EMAIL" ? correo : celular;
  }

  return {
    async enviarOtp(solicitud: SolicitudEnvioOtp): Promise<ResultadoEnvioOtp> {
      if (!canalCoherenteConProposito(solicitud.proposito, solicitud.destino.canal)) {
        return {
          ok: false,
          motivo: "ERROR_ENVIO",
          detalle: `El canal ${solicitud.destino.canal} no corresponde al propósito ${solicitud.proposito}.`,
        };
      }
      // Se rutea por **canal**, no por propósito: el OTP de firma viaja por
      // cualquiera de los dos, así que el propósito ya no alcanza para saber
      // quién lo envía.
      return solicitud.destino.canal === "EMAIL"
        ? correo.enviarOtp(solicitud)
        : celular.enviarOtp(solicitud);
    },
    async verificarOtp(solicitud: SolicitudVerificacionOtp): Promise<ResultadoVerificacionOtp> {
      return (await duenoDe(solicitud.otpId)).verificarOtp(solicitud);
    },
    async reenviarOtp(otpId: string): Promise<ResultadoEnvioOtp> {
      return (await duenoDe(otpId)).reenviarOtp(otpId);
    },
  };
}
