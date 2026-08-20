/**
 * Puerto de **entrega de documentos** por los canales verificados (CHG-44,
 * CMP-05).
 *
 * No es el puerto del OTP. `OtpProvider` entrega un código de seis dígitos y
 * se ocupa de su ciclo de vida; esto entrega **archivos ya emitidos** a una
 * persona que ya está identificada. Comparten proveedor real —WhatsApp-Modular
 * para WhatsApp, Amazon SES para correo— y no comparten nada más: distinto
 * contenido, distinto propósito, distinta evidencia.
 *
 * ## Lo que este puerto hace imposible
 *
 * **Entregar algo que no se emitió.** `DocumentoAdjunto` exige `hashSha256`
 * junto con los bytes, y el despachador lo compara contra el que registró el
 * expediente antes de mandar nada. Un adjunto que no sea el documento emitido
 * no sale del sistema (regla inviolable #4, fila 35).
 *
 * **Controlar la secuencia del negocio.** Este puerto solo entrega; no
 * transiciona el expediente, no emite, no cobra. Es la regla transversal de
 * `docs/SeguroLoTengo-integraciones-externas-alta-resolucion.pdf`: *"no usar
 * automatizaciones administrativas para controlar la secuencia crítica pago →
 * firma → emisión"*. El despachador corre **después** de que todo eso ocurrió.
 *
 * ## Acuse de recibo (CMP-05)
 *
 * La matriz pide registrar el medio de recepción **y el acuse**. Acá el acuse
 * es lo que el proveedor confirma —`ENTREGADO`—, no que la persona haya
 * leído: WhatsApp distingue entregado de leído y el leído no siempre llega.
 * La Matriz §9 es explícita en registrar *"puesto a disposición"* y nunca
 * *"leído"*, así que `consultarEntrega` modela solo lo primero.
 *
 * ## Estado de los adaptadores
 *
 * Solo existe el mock. El adaptador oficial de WhatsApp **no se puede escribir
 * todavía**: `WhatsApp-Modular` expone hoy un `otp-service` y nada más, así
 * que no hay contrato publicado para mandar un documento por ese canal, y
 * inventarle uno sería inventar la integración —el mismo criterio con el que
 * el webhook de Code100 quedó sin implementar (PEN-02). El de correo sí es
 * escribible sobre SES (`SendRawEmail` con adjuntos MIME) y queda para cuando
 * la entrega salga del demo.
 */

/** Los dos canales verificados del flujo. */
export type CanalEntrega = "WHATSAPP" | "EMAIL";

export interface DocumentoAdjunto {
  /** Código del documento: `CPC-00018425`, `PROP-00018425`… */
  readonly codigo: string;
  readonly nombreArchivo: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
  /**
   * Huella del archivo que se adjunta. La verifica el despachador **antes** de
   * llamar al proveedor: entregar un PDF que no sea el emitido rompería el
   * vínculo de la fila 47.
   */
  readonly hashSha256: string;
}

export interface SolicitudEntrega {
  readonly expedienteId: string;
  readonly canal: CanalEntrega;
  /** Número en E.164 o dirección de correo, según `canal`. */
  readonly destino: string;
  /** Cuerpo del mensaje que acompaña a los adjuntos (D-18). */
  readonly mensaje: string;
  readonly adjuntos: readonly DocumentoAdjunto[];
  /**
   * Clave del intento. Un reintento del **mismo** intento la repite; un
   * intento nuevo trae una distinta. Es lo que impide que un reenvío por
   * timeout de red duplique el mensaje que la persona recibe.
   */
  readonly idempotencyKey: string;
}

export type ResultadoEntrega =
  | { readonly ok: true; readonly referenciaEnvio: string }
  | {
      readonly ok: false;
      /**
       * `DESTINO_INVALIDO` es definitivo —reintentar no lo arregla— y los
       * otros dos son transitorios. El despachador usa esa diferencia para
       * decidir si programa otro intento o da la entrega por fallida.
       */
      readonly motivo: "DESTINO_INVALIDO" | "PROVEEDOR_NO_DISPONIBLE" | "RECHAZADO";
      readonly detalle?: string;
    };

/**
 * Lo que el proveedor sabe de un envío ya aceptado.
 *
 * `ENTREGADO` es el acuse de CMP-05. No hay `LEIDO` a propósito: ver la
 * cabecera de este módulo.
 */
export type EstadoEntregaProveedor = "EN_TRANSITO" | "ENTREGADO" | "FALLIDO";

export interface ConsultaEntrega {
  readonly estado: EstadoEntregaProveedor;
  readonly actualizadoEn: string; // ISO 8601
  readonly detalle?: string;
}

export interface MessagingProvider {
  /**
   * Entrega los documentos por el canal indicado. Idempotente por
   * `idempotencyKey`: repetir la misma solicitud devuelve la misma referencia
   * sin volver a entregar nada.
   */
  entregarDocumentos(solicitud: SolicitudEntrega): Promise<ResultadoEntrega>;

  /**
   * Estado de un envío aceptado. `null` si la referencia no existe — que es
   * distinto de que el envío haya fallado.
   */
  consultarEntrega(referenciaEnvio: string): Promise<ConsultaEntrega | null>;
}
