/**
 * Puerto de pago (Bancard), P7: QR (pago definitivo antes de la firma) y
 * tarjeta (preautorización antes de la firma; la captura la ordena la firma
 * del cliente en P8).
 *
 * Reutiliza `MedioDePago` y `EstadoPago` de `src/domain/tipos.ts` en vez de
 * duplicarlos.
 *
 * Regla de negocio inviolable #6: ningún tipo de entrada ni de salida de
 * esta interfaz admite PAN completo ni CVV, en ninguna capa. Como mucho se
 * expone `ultimos4Digitos`, enmascarado.
 */
import type { EstadoPago, MedioDePago } from "../domain/tipos";

export interface IniciarPagoQrInput {
  readonly expedienteId: string;
  /** Correlativo de la propuesta (p.ej. PROP-00018425), no genera Nota de Cobertura. */
  readonly propuestaId: string;
  readonly montoGs: number;
  /**
   * Clave de idempotencia del intento de pago. La genera una única vez el
   * caller (route handler) al arrancar el intento de pago del usuario en P7,
   * y la reutiliza en cualquier reintento de ese mismo intento (timeout del
   * cliente, doble click, retry de red). `propuestaId` no sirve como
   * sustituto: una misma propuesta puede tener varios intentos de pago
   * legítimos (p.ej. tras un QR expirado o cancelado), y cada uno necesita
   * su propia `idempotencyKey`.
   *
   * Dos llamadas a `iniciarPagoQr` con la misma `idempotencyKey` deben
   * devolver el mismo `referenciaBancard` (y el mismo `qrPayload`/`expiraEn`
   * del QR ya creado) en vez de generar un QR nuevo.
   */
  readonly idempotencyKey: string;
}

export interface PagoQrIniciado {
  readonly referenciaBancard: string;
  /** Contenido/URL del QR a renderizar; nunca datos de tarjeta. */
  readonly qrPayload: string;
  readonly expiraEn: string; // ISO 8601
}

export interface IniciarPreautorizacionTarjetaInput {
  readonly expedienteId: string;
  readonly propuestaId: string;
  readonly montoGs: number;
  readonly urlRetorno: string;
  /**
   * Clave de idempotencia del intento de preautorización. La genera una
   * única vez el caller (route handler) al arrancar el intento de pago del
   * usuario en P7, y la reutiliza en cualquier reintento de ese mismo
   * intento (timeout del cliente, doble click, retry de red). `propuestaId`
   * no sirve como sustituto: una misma propuesta puede tener varios
   * intentos de pago legítimos, y cada uno necesita su propia
   * `idempotencyKey`.
   *
   * Dos llamadas a `iniciarPreautorizacionTarjeta` con la misma
   * `idempotencyKey` deben devolver el mismo `referenciaBancard` (y la
   * misma `urlFormularioSeguro` de la preautorización ya iniciada) en vez
   * de crear una preautorización nueva.
   */
  readonly idempotencyKey: string;
}

export interface PreautorizacionTarjetaIniciada {
  readonly referenciaBancard: string;
  /** Iframe/redirect al formulario seguro de Bancard; el dato de tarjeta nunca pasa por SeguroLoTengo. */
  readonly urlFormularioSeguro: string;
}

export interface EstadoConsultaPago {
  readonly referenciaBancard: string;
  readonly medio: MedioDePago;
  readonly estado: EstadoPago;
  readonly montoGs: number;
  /** Últimos 4 dígitos enmascarados, o null si no aplica (p.ej. pago por QR). Nunca el PAN completo. */
  readonly ultimos4Digitos: string | null;
  readonly actualizadoEn: string; // ISO 8601
}

export interface PaymentProvider {
  iniciarPagoQr(input: IniciarPagoQrInput): Promise<PagoQrIniciado>;

  iniciarPreautorizacionTarjeta(input: IniciarPreautorizacionTarjetaInput): Promise<PreautorizacionTarjetaIniciada>;

  consultarEstadoPago(referenciaBancard: string): Promise<EstadoConsultaPago>;

  /**
   * Ordena la captura del importe preautorizado. Se invoca cuando el
   * cliente firma (P8), nunca antes.
   *
   * Idempotente por `referenciaBancard`: si se invoca sobre una referencia
   * que ya está en estado `CAPTURADO` (p.ej. por un reintento de red en el
   * momento de la firma), debe devolver el mismo `EstadoConsultaPago` sin
   * volver a capturar ni cobrar el importe una segunda vez.
   */
  capturarPreautorizacion(referenciaBancard: string): Promise<EstadoConsultaPago>;

  /**
   * Cancela un QR pendiente o libera una reserva de tarjeta no capturada
   * (p.ej. vencimiento sin firma → Pantalla B).
   *
   * Idempotente por `referenciaBancard`: si se invoca sobre una referencia
   * que ya está en estado `CANCELADO` (p.ej. por un reintento del proceso
   * de vencimiento), debe devolver el mismo `EstadoConsultaPago` sin error
   * ni efecto adicional.
   */
  cancelarOLiberarReserva(referenciaBancard: string): Promise<EstadoConsultaPago>;
}
