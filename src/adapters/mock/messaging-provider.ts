/**
 * Adaptador simulado de la entrega de documentos (CHG-44, CMP-05).
 *
 * Simula lo que hace un proveedor de mensajería de verdad y **no simula que
 * todo sale bien**: acepta el envío, lo deja `EN_TRANSITO` un rato y recién
 * después lo da por `ENTREGADO`. Esa demora es el punto. Sin ella, la pantalla
 * mostraría el acuse en el mismo instante del envío y no habría forma de
 * enseñar el estado intermedio que CMP-05 obliga a registrar.
 *
 * Igual que el resto de los mocks, el estado vive en memoria del proceso
 * (`estado-compartido.ts`, por el problema de las instancias múltiples de
 * módulo en `next dev`). Lo que pertenece al flujo real —el registro de
 * entrega del expediente— vive en DynamoDB, no acá: esto es solo el "otro
 * lado" del proveedor.
 *
 * ## Lo que no hace
 *
 * **No manda nada.** No hay red, no hay WhatsApp, no hay correo. Los bytes de
 * los adjuntos llegan y se descartan: guardarlos sería duplicar en memoria
 * unos PDF que ya están en S3.
 *
 * **No inventa el contrato de nadie.** WhatsApp-Modular expone hoy un
 * `otp-service` y ningún endpoint de documentos, así que este mock implementa
 * el puerto que necesitamos, no una API que exista. Ver la cabecera de
 * `src/ports/messaging-provider.ts`.
 */
import { randomUUID } from "node:crypto";
import type {
  ConsultaEntrega,
  MessagingProvider,
  ResultadoEntrega,
  SolicitudEntrega,
} from "../../ports/messaging-provider";
import { consumirFallaDemo } from "./fallas-demo";
import { estadoCompartidoDemo } from "./estado-compartido";

/** Cuánto tarda el proveedor simulado en confirmar la entrega. */
export const DEMORA_ACUSE_MS = 4_000;

interface EnvioSimulado {
  readonly aceptadoEn: number;
  /** Se marca cuando la falla forzada del panel decidió que este envío no llega. */
  readonly nuncaLlega: boolean;
}

interface AlmacenEnvios {
  /** Por referencia de envío. */
  readonly porReferencia: Map<string, EnvioSimulado>;
  /** Por clave de idempotencia, para que un reintento no duplique el mensaje. */
  readonly porIdempotencia: Map<string, string>;
}

function almacen(): AlmacenEnvios {
  return estadoCompartidoDemo("messaging-provider", () => ({
    porReferencia: new Map<string, EnvioSimulado>(),
    porIdempotencia: new Map<string, string>(),
  }));
}

export function limpiarEnviosMock(): void {
  const { porReferencia, porIdempotencia } = almacen();
  porReferencia.clear();
  porIdempotencia.clear();
}

export interface OpcionesMessagingMock {
  readonly ahora?: () => number;
  readonly demoraAcuseMs?: number;
  readonly nuevaReferencia?: () => string;
}

export function crearMessagingProviderMock(
  opciones: OpcionesMessagingMock = {},
): MessagingProvider {
  const ahora = opciones.ahora ?? (() => Date.now());
  const demora = opciones.demoraAcuseMs ?? DEMORA_ACUSE_MS;
  const nuevaReferencia =
    opciones.nuevaReferencia ?? (() => `MOCK-ENTREGA-${randomUUID().slice(0, 8).toUpperCase()}`);

  return {
    async entregarDocumentos(solicitud: SolicitudEntrega): Promise<ResultadoEntrega> {
      const { porReferencia, porIdempotencia } = almacen();

      // Idempotencia por intento: el mismo `idempotencyKey` devuelve la misma
      // referencia sin volver a "mandar" nada.
      const yaEnviado = porIdempotencia.get(solicitud.idempotencyKey);
      if (yaEnviado) return { ok: true, referenciaEnvio: yaEnviado };

      if (solicitud.adjuntos.length === 0) {
        return { ok: false, motivo: "RECHAZADO", detalle: "Sin documentos que entregar." };
      }
      if (!destinoPlausible(solicitud)) {
        return { ok: false, motivo: "DESTINO_INVALIDO", detalle: "El destino no tiene el formato del canal." };
      }

      // Palanca del panel: el proveedor no está disponible. Es transitoria, así
      // que el despachador va a programar otro intento — que es exactamente el
      // comportamiento que CMP-05 pide mostrar.
      if (consumirFallaDemo("ENTREGA_NO_DISPONIBLE")) {
        return {
          ok: false,
          motivo: "PROVEEDOR_NO_DISPONIBLE",
          detalle: "Falla forzada desde el panel de demo.",
        };
      }

      // Palanca del panel: el proveedor **acepta** el envío y después no lo
      // entrega. Es el caso feo, el que distingue "enviado" de "acusado": sin
      // esto, `ENVIADO` y `ACUSADO` serían el mismo instante para siempre.
      const nuncaLlega = consumirFallaDemo("ENTREGA_SIN_ACUSE");

      const referenciaEnvio = nuevaReferencia();
      porReferencia.set(referenciaEnvio, { aceptadoEn: ahora(), nuncaLlega });
      porIdempotencia.set(solicitud.idempotencyKey, referenciaEnvio);

      return { ok: true, referenciaEnvio };
    },

    async consultarEntrega(referenciaEnvio: string): Promise<ConsultaEntrega | null> {
      const envio = almacen().porReferencia.get(referenciaEnvio);
      if (!envio) return null;

      const transcurrido = ahora() - envio.aceptadoEn;
      if (envio.nuncaLlega) {
        return {
          estado: transcurrido >= demora ? "FALLIDO" : "EN_TRANSITO",
          actualizadoEn: new Date(ahora()).toISOString(),
          detalle: transcurrido >= demora ? "El destino no confirmó la recepción." : undefined,
        };
      }

      return {
        estado: transcurrido >= demora ? "ENTREGADO" : "EN_TRANSITO",
        actualizadoEn: new Date(ahora()).toISOString(),
      };
    },
  };
}

/**
 * Validación mínima del destino según el canal. No pretende ser una
 * validación de direcciones —eso ya ocurrió al verificar el canal— sino
 * atrapar el error de programación de mandar un correo al canal de WhatsApp.
 */
function destinoPlausible(solicitud: SolicitudEntrega): boolean {
  return solicitud.canal === "WHATSAPP"
    ? /^\+\d{8,15}$/.test(solicitud.destino)
    : solicitud.destino.includes("@");
}
