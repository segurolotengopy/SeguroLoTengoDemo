/**
 * Puerto de pago (Bancard), P7. Tres modalidades con dos momentos distintos
 * de movimiento de dinero:
 *
 *   - **QR Bancard** (`iniciarPagoQr`) — pago definitivo antes de la firma.
 *   - **Tarjeta de débito** (`iniciarPagoTarjetaDebito`) — también definitivo
 *     antes de la firma, vía compra simple de vPOS.
 *   - **Tarjeta de crédito** (`iniciarPreautorizacionTarjeta`) — reserva sin
 *     cobro; la captura la ordena la firma del cliente en P8.
 *
 * **La preautorización es exclusiva de la tarjeta de crédito** —confirmado
 * por Bancard— y por eso `iniciarPreautorizacionTarjeta` y
 * `capturarPreautorizacion` no aceptan ningún otro medio. El débito va por
 * compra simple porque una preautorización con débito **ya mueve el dinero**
 * ("se acredita el monto preautorizado en la cuenta del comercio",
 * `docs/Integraciones/Preaut y promociones 14.pdf`): llamarla reserva sería
 * mentirle a la persona. Ver la nota extensa en `MedioDePago`
 * (`src/domain/tipos.ts`), que es donde vive la justificación completa.
 *
 * Reutiliza `MedioDePago` y `EstadoPago` de `src/domain/tipos.ts` en vez de
 * duplicarlos.
 *
 * Regla de negocio inviolable #6: ningún tipo de entrada ni de salida de
 * esta interfaz admite PAN completo ni CVV, en ninguna capa. Como mucho se
 * expone `ultimos4Digitos`, enmascarado. Los datos de tarjeta se tipean
 * siempre dentro del formulario seguro de Bancard, al que se llega por
 * `urlFormularioSeguro`: no pasan por SeguroLoTengo ni de ida ni de vuelta.
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

export interface IniciarPagoTarjetaDebitoInput {
  readonly expedienteId: string;
  readonly propuestaId: string;
  readonly montoGs: number;
  readonly urlRetorno: string;
  /**
   * Misma semántica que en `iniciarPagoQr`: dos llamadas con la misma clave
   * devuelven la **misma** `referenciaBancard` y la misma
   * `urlFormularioSeguro`, sin abrir una operación nueva. Acá la garantía
   * pesa más que en ningún otro método del puerto, porque el débito cobra de
   * verdad al confirmarse: un reintento sin idempotencia sería un cobro
   * duplicado real, no una reserva duplicada.
   */
  readonly idempotencyKey: string;
}

export interface PagoTarjetaDebitoIniciado {
  readonly referenciaBancard: string;
  /** Iframe/redirect a la compra simple de vPOS; el dato de tarjeta nunca pasa por SeguroLoTengo. */
  readonly urlFormularioSeguro: string;
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

/**
 * Falla del lado de Bancard (timeout, caída, rechazo). Los métodos de inicio
 * la **lanzan** en vez de devolverla: es exactamente lo que hace un cliente
 * HTTP real ante un timeout, y así el dominio no puede confundir "Bancard no
 * contestó" con "la operación quedó creada".
 *
 * Que sea una clase propia —y no un `Error` pelado— le permite al caso de uso
 * distinguirla de un error de programación sin mirar el mensaje.
 */
export class ErrorBancard extends Error {
  readonly motivo: "TIMEOUT" | "RECHAZADA";

  constructor(motivo: "TIMEOUT" | "RECHAZADA", mensaje: string) {
    super(mensaje);
    this.name = "ErrorBancard";
    this.motivo = motivo;
  }
}

export interface PaymentProvider {
  iniciarPagoQr(input: IniciarPagoQrInput): Promise<PagoQrIniciado>;

  /** Compra simple de vPOS: cobra de verdad al confirmarse, antes de la firma. */
  iniciarPagoTarjetaDebito(input: IniciarPagoTarjetaDebitoInput): Promise<PagoTarjetaDebitoIniciado>;

  /**
   * Reserva sin cobro. **Solo tarjeta de crédito**: Bancard confirmó que la
   * preautorización con débito acredita el dinero al comercio en el acto, así
   * que ese caso va por `iniciarPagoTarjetaDebito`.
   */
  iniciarPreautorizacionTarjeta(input: IniciarPreautorizacionTarjetaInput): Promise<PreautorizacionTarjetaIniciada>;

  /**
   * Estado actual de una operación. `null` si Bancard no conoce la
   * referencia: es un desenlace posible y no un error de programación, así
   * que el dominio tiene que poder distinguirlo de "existe y está pendiente"
   * en vez de recibir un objeto inventado.
   */
  consultarEstadoPago(referenciaBancard: string): Promise<EstadoConsultaPago | null>;

  /**
   * Ordena la captura del importe preautorizado. Se invoca cuando el
   * cliente firma (P8), nunca antes, y **solo sobre una preautorización de
   * crédito**: el QR y el débito ya cobraron en P7 y no tienen nada que
   * capturar.
   *
   * Idempotente por `referenciaBancard`: si se invoca sobre una referencia
   * que ya está en estado `CAPTURADO` (p.ej. por un reintento de red en el
   * momento de la firma), debe devolver el mismo `EstadoConsultaPago` sin
   * volver a capturar ni cobrar el importe una segunda vez.
   *
   * Ante una referencia desconocida o que no sea una preautorización de
   * crédito, lanza: el servidor solo llama a este método con una referencia
   * que él mismo persistió, así que eso es un error de programación y no un
   * desenlace del negocio.
   */
  capturarPreautorizacion(referenciaBancard: string): Promise<EstadoConsultaPago>;

  /**
   * Cancela un QR pendiente o libera una reserva de crédito no capturada
   * (p.ej. vencimiento sin firma → Pantalla B).
   *
   * Con QR o débito ya acreditados esto es una **devolución** al medio de
   * origen, no una liberación: el dinero ya se movió. Con crédito
   * preautorizado alcanza con descongelar el importe.
   *
   * Idempotente por `referenciaBancard`: si se invoca sobre una referencia
   * que ya está en estado `CANCELADO` (p.ej. por un reintento del proceso
   * de vencimiento), debe devolver el mismo `EstadoConsultaPago` sin error
   * ni efecto adicional. Sobre una referencia ya `CAPTURADO` lanza: revertir
   * un cobro que la firma ya ordenó no es parte de este flujo.
   */
  cancelarOLiberarReserva(referenciaBancard: string): Promise<EstadoConsultaPago>;
}
