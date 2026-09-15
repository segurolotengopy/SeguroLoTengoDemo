/**
 * Puerto del **intercambio documental con la aseguradora** — ítem 36 de
 * `docs/Tabla de Integraciones externas - Tabla.csv`.
 *
 * Mueve PDF entre SeguroLoTengo y Alianza Garantía: les manda un documento
 * para que lo firmen y trae de vuelta lo firmado y los archivos de respuesta.
 * El mecanismo real es el que Alianza propuso el 14-sep-2026 —su servidor SFTP
 * detrás de un firewall por IP— alcanzado desde un conector de AWS Transfer
 * Family con IP de salida estáticas (`infra/alianza-sftp.tf`).
 *
 * ## Qué hace y qué no
 *
 * **Solo transporta.** No transiciona el expediente, no decide qué firma
 * Alianza (eso es configuración: `src/domain/intercambio-aseguradora.ts`) y no
 * verifica la firma. Alianza firma sobre el PDF que le mandamos y devuelve una
 * **revisión incremental**: los bytes enviados quedan intactos como prefijo del
 * archivo devuelto. Reconocerla, verificarla y aplicarla al expediente es
 * trabajo del lote de firma (`docs/plan/DISENO_FIRMA_EN_LOTE.md` §2), que
 * consume este puerto. Es la misma regla transversal que `MessagingProvider`:
 * una integración no controla la secuencia pago → firma → emisión.
 *
 * ## Lo que este puerto hace imposible
 *
 * - **Mandar algo que no es lo emitido.** La solicitud trae la huella junto con
 *   los bytes, y el adaptador la recalcula antes de mover nada
 *   (`HUELLA_NO_COINCIDE`), igual que `DocumentoAdjunto` en la entrega.
 * - **Filtrar datos de la persona por el nombre del archivo.** El nombre remoto
 *   lo deriva el adaptador del código y la versión; quien llama no lo elige.
 *   Los logs del conector y el servidor de Alianza registran rutas (regla #7).
 * - **Mandar dos veces el mismo documento.** Idempotencia por la huella: los
 *   mismos bytes devuelven la misma referencia, salvo que el intento anterior
 *   haya fallado, en cuyo caso se reintenta con una referencia nueva.
 * - **Reescribir la historia de una transferencia.** Cada una tiene una
 *   secuencia de eventos que solo crece (regla inviolable #10). No hay método
 *   para borrar ni editar un evento, ni para borrar un archivo remoto: lo ya
 *   procesado se **mueve** a una subcarpeta, no se elimina.
 *
 * ## Todo es asincrónico
 *
 * En Transfer Family enviar, listar y traer son operaciones que se piden y
 * terminan después. El puerto lo refleja en vez de esconderlo: cada pedido
 * devuelve una referencia, y el estado se consulta con ella.
 */
import type {
  CarpetaRecepcion,
  DocumentoAEnviar,
  MotivoDocumentoInvalido,
} from "../domain/intercambio-aseguradora";

export interface SolicitudEnvioDocumento extends DocumentoAEnviar {
  readonly bytes: Uint8Array;
  /** Huella SHA-256 (hex) del PDF cerrado; el adaptador la recalcula. */
  readonly hashSha256: string;
}

export type ResultadoEnvioDocumento =
  | {
      readonly ok: true;
      readonly referencia: string;
      /** `true` si esta huella ya se había mandado: no se movió nada de nuevo. */
      readonly duplicado: boolean;
      readonly nombreRemoto: string;
    }
  | {
      readonly ok: false;
      readonly motivo:
        | "TIPO_NO_HABILITADO"
        | "HUELLA_NO_COINCIDE"
        | "PROVEEDOR_NO_DISPONIBLE"
        | MotivoDocumentoInvalido;
      readonly detalle?: string;
    };

export type DireccionTransferencia = "ENVIO" | "RECEPCION";

export type EstadoTransferencia = "EN_CURSO" | "COMPLETADA" | "FALLIDA";

/**
 * - `SOLICITADA`: el pedido se hizo al proveedor.
 * - `TRANSFERIDA`: los bytes llegaron (al servidor remoto, o a la bandeja).
 * - `PUBLICADA`: en un envío, el archivo dejó de ser `.tmp` y Alianza ya puede
 *   procesarlo. Es lo que da el envío por completado.
 * - `RECIBIDA`: en una recepción, el archivo está en la bandeja con su huella.
 * - `ARCHIVADA`: el archivo remoto se movió a la subcarpeta de procesados.
 * - `FALLIDA`: terminal para ese intento.
 */
export type TipoEventoTransferencia =
  | "SOLICITADA"
  | "TRANSFERIDA"
  | "PUBLICADA"
  | "RECIBIDA"
  | "ARCHIVADA"
  | "FALLIDA";

export interface EventoTransferencia {
  readonly tipo: TipoEventoTransferencia;
  readonly instante: string; // ISO 8601
  /** Referencias técnicas o el nombre de un error. Nunca contenido de archivo. */
  readonly detalle?: string;
}

export interface EstadoDeTransferencia {
  readonly referencia: string;
  readonly direccion: DireccionTransferencia;
  readonly estado: EstadoTransferencia;
  readonly nombreArchivo: string;
  /** Huella del archivo: la del enviado, o la del recibido una vez en la bandeja. */
  readonly hashSha256: string | null;
  /** En orden; una consulta posterior siempre empieza con los eventos de una anterior. */
  readonly eventos: readonly EventoTransferencia[];
}

/**
 * El estado se **deriva** de los eventos, no se guarda aparte: así no puede
 * contradecirlos. Un `FALLIDA` gana siempre; un envío termina al publicarse y
 * una recepción al quedar en la bandeja.
 */
export function estadoSegunEventos(
  direccion: DireccionTransferencia,
  eventos: readonly EventoTransferencia[],
): EstadoTransferencia {
  if (eventos.some((evento) => evento.tipo === "FALLIDA")) return "FALLIDA";
  const final = direccion === "ENVIO" ? "PUBLICADA" : "RECIBIDA";
  return eventos.some((evento) => evento.tipo === final) ? "COMPLETADA" : "EN_CURSO";
}

/** Un archivo del directorio remoto, tal como lo informa el listado. */
export interface ArchivoRemoto {
  readonly nombre: string;
  readonly tamanoBytes: number | null;
  readonly modificadoEn: string | null;
}

export type ResultadoPedido =
  | { readonly ok: true; readonly referencia: string; readonly duplicado: boolean }
  | {
      readonly ok: false;
      readonly motivo: "NOMBRE_INVALIDO" | "PROVEEDOR_NO_DISPONIBLE";
      readonly detalle?: string;
    };

export type ResultadoListado =
  | { readonly estado: "EN_CURSO" }
  | {
      readonly estado: "COMPLETADO";
      /** Sin los `.tmp`: lo que todavía se está escribiendo no se lista. */
      readonly archivos: readonly ArchivoRemoto[];
      /** El servidor tenía más archivos que los listados. */
      readonly truncado: boolean;
    }
  | { readonly estado: "FALLIDO"; readonly detalle?: string };

export type ResultadoRecibido =
  | { readonly estado: "EN_CURSO" }
  | {
      readonly estado: "COMPLETADA";
      readonly nombreArchivo: string;
      readonly bytes: Uint8Array;
      readonly hashSha256: string;
    }
  | { readonly estado: "FALLIDA"; readonly detalle?: string };

export type ResultadoArchivado =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly motivo: "NO_ENCONTRADA" | "RECEPCION_NO_COMPLETADA" | "PROVEEDOR_NO_DISPONIBLE";
      readonly detalle?: string;
    };

export interface IntercambioAseguradora {
  /** Deposita un documento para que la aseguradora lo firme. Idempotente por huella. */
  enviarDocumento(solicitud: SolicitudEnvioDocumento): Promise<ResultadoEnvioDocumento>;

  /** Pide el listado de una carpeta de recepción. */
  solicitarListado(carpeta: CarpetaRecepcion): Promise<ResultadoPedido>;
  /** `null` si la referencia no existe. */
  obtenerListado(referencia: string): Promise<ResultadoListado | null>;

  /**
   * Pide traer un archivo listado. Idempotente por la entrada del listado
   * (nombre, tamaño y fecha): si Alianza reemplaza el archivo, es otro pedido.
   */
  solicitarRecepcion(carpeta: CarpetaRecepcion, archivo: ArchivoRemoto): Promise<ResultadoPedido>;
  /** `null` si la referencia no existe o no es una recepción. */
  obtenerRecibido(referencia: string): Promise<ResultadoRecibido | null>;

  /** Mueve el archivo remoto ya recibido a la subcarpeta de procesados. Idempotente. */
  archivarRecibido(referencia: string): Promise<ResultadoArchivado>;

  /** Estado y eventos de un envío o una recepción. `null` si no existe. */
  consultarTransferencia(referencia: string): Promise<EstadoDeTransferencia | null>;
}
