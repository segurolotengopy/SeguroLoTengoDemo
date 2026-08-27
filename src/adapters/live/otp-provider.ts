/**
 * Adaptador vivo de `OtpProvider` sobre WhatsApp-Modular (ítem 3 de la tabla
 * de integraciones). Se activa con `INTEGRATION_OTP=live`.
 *
 * Reparto de responsabilidades:
 *   - El OTP de P1 (VERIFICACION_CELULAR · WhatsApp) lo genera, envía y
 *     verifica el `otp-service` de WhatsApp-Modular con propósito
 *     `PHONE_VERIFICATION`. La política es la misma que la regla inviolable
 *     #1 (6 dígitos, 5 min, 3 intentos, cooldown 60 s), aplicada por él.
 *   - El OTP de P4 (VERIFICACION_CORREO) se delega al adaptador de correo que
 *     se reciba (hoy, el mock): WhatsApp-Modular no envía correo.
 *
 * ## Metadata local del OTP remoto
 *
 * El motor de canal (`src/domain/verificacion-canal.ts`) necesita saber a qué
 * expediente, propósito y destino pertenece un `otpId` (`LectorMetadataOtp`)
 * — cosa que la API de WhatsApp-Modular no expone a propósito (su caso 17,
 * anti-enumeración). Este adaptador guarda esa metadata al enviar, en memoria
 * del proceso, y la publica vía `lectorConMetadataWhatsAppModular`.
 *
 * Límite conocido (aceptable en el demo, igual que el registro del panel):
 * con varias instancias de cómputo cada una ve solo sus envíos. Un adaptador
 * de producción persistiría esta metadata en DynamoDB junto a los OTP locales.
 *
 * Regla inviolable #2 intacta: acá nunca existe el código en claro — lo tiene
 * WhatsApp-Modular (hasheado) y la persona en su WhatsApp. Por lo mismo, en
 * modo live el panel de demo NO puede mostrar el código de P1: el circuito se
 * demuestra con el mensaje real (riel de Meta configurado) o con el camino de
 * código incorrecto.
 *
 * ## Reenvío
 *
 * `otp-service` no tiene endpoint de reenvío: reenviar es pedir un OTP nuevo
 * para el mismo destino y propósito, y su rate limiter aplica el cooldown de
 * 60 s. El `otpId` resultante es NUEVO y es el que vuelve al motor (que ya
 * propaga `envio.otpId` a la pantalla). El OTP anterior queda huérfano dentro
 * de WhatsApp-Modular hasta vencer: ninguna pantalla conserva su `otpId`, así
 * que no hay camino para verificarlo.
 */
import { randomUUID } from "node:crypto";
import { canalCoherenteConProposito } from "../../ports/otp-provider";
import type {
  OtpProvider,
  PropositoOtp,
  ResultadoEnvioOtp,
  ResultadoVerificacionOtp,
  SolicitudEnvioOtp,
  SolicitudVerificacionOtp,
} from "../../ports/otp-provider";
import type { LectorMetadataOtp, RegistroOtpMinimo } from "../../domain/verificacion-canal";
// El anclaje en `globalThis` no es cosa del modo demo: en `next dev` cada
// Route Handler puede recibir su propia instancia del módulo, y esta metadata
// tiene que ser una sola por proceso (mismo problema documentado en
// `mock/estado-compartido.ts`, misma solución).
import { estadoCompartidoDemo } from "../mock/estado-compartido";
import type { OtpFirmaRemoto } from "../mock/signature-provider";
import type { ClienteWhatsAppModular, PropositoWhatsAppModular } from "./whatsapp-modular";

interface MetadataOtpWm {
  readonly otpId: string;
  readonly expedienteId: string;
  readonly destino: string;
  /** Se guarda para que el reenvío repita el mismo acto y el lector no mienta. */
  readonly proposito: PropositoOtp;
  ultimoEnvioEn: string;
  consumidoEn: string | null;
}

/**
 * WhatsApp-Modular exige un propósito propio por política de su servicio (su
 * T9), que es la regla inviolable #1 vista desde el otro lado: el código que
 * verifica el número y el que firma no pueden compartir plantilla.
 */
function propositoWhatsAppDe(proposito: PropositoOtp): PropositoWhatsAppModular | null {
  switch (proposito) {
    case "VERIFICACION_CELULAR":
      return "PHONE_VERIFICATION";
    case "FIRMA":
      return "SIGNATURE_P7A";
    case "VERIFICACION_CORREO":
      return null;
  }
}

const metadataPorOtpId = estadoCompartidoDemo(
  "otp-wm.metadata",
  () => new Map<string, MetadataOtpWm>(),
);

export interface OpcionesOtpProviderWhatsAppModular {
  readonly cliente: ClienteWhatsAppModular;
  /** Adaptador que atiende VERIFICACION_CORREO (P4). Hoy, el mock. */
  readonly correo: OtpProvider;
  readonly ahora?: () => string;
  /** Inyectable en tests; cada envío usa una clave de idempotencia nueva. */
  readonly nuevaClaveIdempotencia?: () => string;
}

export function crearOtpProviderWhatsAppModular(
  opciones: OpcionesOtpProviderWhatsAppModular,
): OtpProvider {
  const { cliente, correo } = opciones;
  const ahora = opciones.ahora ?? (() => new Date().toISOString());
  const nuevaClave = opciones.nuevaClaveIdempotencia ?? (() => randomUUID());

  async function solicitarANumero(
    telefonoE164: string,
    proposito: PropositoWhatsAppModular,
    registrar: (otpId: string, enviadoEn: string) => void,
  ): Promise<ResultadoEnvioOtp> {
    const enviadoEn = ahora();
    const respuesta = await cliente.solicitarOtp({
      telefonoE164,
      proposito,
      idempotencyKey: nuevaClave(),
    });

    if (!respuesta.ok) {
      return respuesta.motivo === "COOLDOWN"
        ? { ok: false, motivo: "REENVIO_BLOQUEADO", segundosRestantes: respuesta.segundosRestantes }
        : { ok: false, motivo: "ERROR_ENVIO", detalle: respuesta.detalle };
    }

    registrar(respuesta.otpId, enviadoEn);
    return {
      ok: true,
      otpId: respuesta.otpId,
      expiraEn: respuesta.expiraEn,
      // No hay `wamid` en la respuesta síncrona (la entrega se confirma por
      // webhook, Fase 1 de WhatsApp-Modular): la referencia trazable del envío
      // es el identificador de la transacción de OTP.
      referenciaEnvio: `WM-OTP-${respuesta.otpId}`,
    };
  }

  return {
    async enviarOtp(solicitud: SolicitudEnvioOtp): Promise<ResultadoEnvioOtp> {
      // La coherencia se valida **antes** de rutear: si se delegara primero,
      // el destinatario tendría que volver a validarla y un doble de pruebas
      // podría dejar pasar un OTP de celular hacia un correo.
      if (!canalCoherenteConProposito(solicitud.proposito, solicitud.destino.canal)) {
        return {
          ok: false,
          motivo: "ERROR_ENVIO",
          detalle: `El canal ${solicitud.destino.canal} no corresponde al propósito ${solicitud.proposito}.`,
        };
      }
      // Después se delega por canal, no por propósito: el OTP de firma
      // también puede ir por correo si la persona eligió ese canal.
      if (solicitud.destino.canal === "EMAIL") {
        return correo.enviarOtp(solicitud);
      }

      const propositoWm = propositoWhatsAppDe(solicitud.proposito);
      if (!propositoWm) {
        return {
          ok: false,
          motivo: "ERROR_ENVIO",
          detalle: `El propósito ${solicitud.proposito} no viaja por WhatsApp.`,
        };
      }

      return solicitarANumero(solicitud.destino.valor, propositoWm, (otpId, enviadoEn) => {
        metadataPorOtpId.set(otpId, {
          otpId,
          expedienteId: solicitud.expedienteId,
          destino: solicitud.destino.valor,
          proposito: solicitud.proposito,
          ultimoEnvioEn: enviadoEn,
          consumidoEn: null,
        });
      });
    },

    async verificarOtp(solicitud: SolicitudVerificacionOtp): Promise<ResultadoVerificacionOtp> {
      const metadata = metadataPorOtpId.get(solicitud.otpId);
      // Un otpId que este adaptador no emitió es de P4 (o no existe): lo
      // resuelve el delegado de correo contra el repositorio local.
      if (!metadata) return correo.verificarOtp(solicitud);

      // Uso único, sin gastar red: un OTP ya consumido acá jamás se re-verifica.
      if (metadata.consumidoEn) return { ok: false, motivo: "YA_UTILIZADO" };

      const respuesta = await cliente.verificarOtp({
        otpId: solicitud.otpId,
        codigo: solicitud.codigoIngresado,
      });

      if (respuesta.ok) {
        metadata.consumidoEn = ahora();
        return { ok: true };
      }
      switch (respuesta.motivo) {
        case "CODIGO_INCORRECTO":
          return {
            ok: false,
            motivo: "CODIGO_INCORRECTO",
            intentosRestantes: respuesta.intentosRestantes,
          };
        case "INTENTOS_AGOTADOS":
          return { ok: false, motivo: "INTENTOS_AGOTADOS" };
        case "EXPIRADO":
          return { ok: false, motivo: "EXPIRADO" };
        case "ERROR":
          // Falla de infraestructura (red, 5xx), no una respuesta del OTP: el
          // puerto no tiene un motivo para esto y castearlo a EXPIRADO
          // mentiría. Se propaga como excepción y el handler responde 500.
          throw new Error(`WhatsApp-Modular no pudo verificar el OTP: ${respuesta.detalle}`);
      }
    },

    async reenviarOtp(otpId: string): Promise<ResultadoEnvioOtp> {
      const metadata = metadataPorOtpId.get(otpId);
      if (!metadata) return correo.reenviarOtp(otpId);
      if (metadata.consumidoEn) {
        return { ok: false, motivo: "ERROR_ENVIO", detalle: "El OTP ya fue utilizado." };
      }

      const propositoWm = propositoWhatsAppDe(metadata.proposito) ?? "PHONE_VERIFICATION";
      return solicitarANumero(metadata.destino, propositoWm, (nuevoOtpId, enviadoEn) => {
        metadata.ultimoEnvioEn = enviadoEn;
        metadataPorOtpId.set(nuevoOtpId, {
          otpId: nuevoOtpId,
          expedienteId: metadata.expedienteId,
          destino: metadata.destino,
          proposito: metadata.proposito,
          ultimoEnvioEn: enviadoEn,
          consumidoEn: null,
        });
      });
    },
  };
}

/**
 * `LectorMetadataOtp` para el modo live: primero la metadata de los OTP
 * emitidos por WhatsApp-Modular, después el repositorio local (P4, y todo lo
 * que siga en mock). Es lo que `_dependencias.ts` de P1/P4 recibe vía
 * `obtenerLectorOtp` del composition root.
 */
export function lectorConMetadataWhatsAppModular(local: LectorMetadataOtp): LectorMetadataOtp {
  return {
    async obtener(otpId: string): Promise<RegistroOtpMinimo | null> {
      const metadata = metadataPorOtpId.get(otpId);
      if (!metadata) return local.obtener(otpId);
      return {
        otpId: metadata.otpId,
        expedienteId: metadata.expedienteId,
        proposito: metadata.proposito,
        destino: metadata.destino,
        ultimoEnvioEn: metadata.ultimoEnvioEn,
        consumidoEn: metadata.consumidoEn,
      };
    },
  };
}

/** Solo para tests: deja la metadata en blanco entre casos. */
export function limpiarMetadataWhatsAppModular(): void {
  metadataPorOtpId.clear();
}

/**
 * `OtpFirmaRemoto` sobre WhatsApp-Modular: el OTP del acto de firma simulado
 * (P8) viaja por WhatsApp con propósito `SIGNATURE_P7A` — independiente del
 * de P1 por política del propio servicio (su T9), que es la regla inviolable
 * #1 vista desde el otro lado.
 *
 * No toca `metadataPorOtpId`: este OTP no pertenece al motor de canal sino a
 * la sesión de firma simulada, que guarda su identificador en `sesion.otp`.
 */
export function crearOtpFirmaRemotoWhatsAppModular(
  cliente: ClienteWhatsAppModular,
  nuevaClaveIdempotencia: () => string = () => randomUUID(),
): OtpFirmaRemoto {
  return {
    async solicitar(destinoE164: string) {
      const respuesta = await cliente.solicitarOtp({
        telefonoE164: destinoE164,
        proposito: "SIGNATURE_P7A",
        idempotencyKey: nuevaClaveIdempotencia(),
      });
      if (!respuesta.ok) {
        return {
          ok: false as const,
          detalle:
            respuesta.motivo === "COOLDOWN"
              ? `Reenvío bloqueado por ${respuesta.segundosRestantes} segundos.`
              : respuesta.detalle,
        };
      }
      return { ok: true as const, otpId: respuesta.otpId, expiraEn: respuesta.expiraEn };
    },

    async verificar(otpId: string, codigo: string) {
      const respuesta = await cliente.verificarOtp({ otpId, codigo });
      if (respuesta.ok) return { ok: true as const };
      switch (respuesta.motivo) {
        case "CODIGO_INCORRECTO":
          return {
            ok: false as const,
            motivo: "CODIGO_INCORRECTO" as const,
            intentosRestantes: respuesta.intentosRestantes,
          };
        case "EXPIRADO":
          return { ok: false as const, motivo: "OTP_EXPIRADO" as const };
        case "INTENTOS_AGOTADOS":
          return { ok: false as const, motivo: "INTENTOS_AGOTADOS" as const };
        case "ERROR":
          return { ok: false as const, motivo: "FALLA_DEL_PROVEEDOR" as const };
      }
    },
  };
}
