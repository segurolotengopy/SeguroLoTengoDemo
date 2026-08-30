/**
 * Puerto de pago (Bancard). Tres modalidades, **todas con cobro directo**:
 *
 *   - **QR Bancard** (`iniciarPagoQr`)
 *   - **Tarjeta de débito** (`iniciarPagoTarjetaDebito`)
 *   - **Tarjeta de crédito** (`iniciarPagoTarjetaCredito`)
 *
 * ## Por qué ya no hay preautorización (D-02)
 *
 * La reserva de crédito existía para no cobrar antes de la firma: se
 * congelaba el importe y la firma ordenaba la captura. Con el orden invertido
 * (D-08) el pago ocurre **después** de firmar, así que no hay nada que
 * proteger — cuando se cobra, el contrato ya está firmado. Lo que quedaba era
 * un estado intermedio y una operación de captura que podían fallar por su
 * cuenta, sin ganar nada a cambio.
 *
 * Bancard sigue ofreciendo preautorización y el día que el flujo la necesite
 * está documentada en `docs/Integraciones/Preaut y promociones 14.pdf`. Se
 * quita del puerto y no se deja "por las dudas": un método sin llamador
 * envejece sin que nadie lo note, y su contrato deja de coincidir con el del
 * proveedor sin que ningún test lo diga.
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

export interface IniciarPagoTarjetaCreditoInput {
  readonly expedienteId: string;
  readonly propuestaId: string;
  readonly montoGs: number;
  readonly urlRetorno: string;
  /**
   * Clave de idempotencia del intento de cobro con crédito. La genera una
   * única vez el caller (route handler) al arrancar el intento de pago del
   * usuario en P7, y la reutiliza en cualquier reintento de ese mismo
   * intento (timeout del cliente, doble click, retry de red). `propuestaId`
   * no sirve como sustituto: una misma propuesta puede tener varios
   * intentos de pago legítimos, y cada uno necesita su propia
   * `idempotencyKey`.
   *
   * Dos llamadas a `iniciarPagoTarjetaCredito` con la misma
   * `idempotencyKey` deben devolver el mismo `referenciaBancard` (y la
   * misma `urlFormularioSeguro` de la operación ya iniciada) en vez
   * de crear una preautorización nueva.
   */
  readonly idempotencyKey: string;
}

export interface PagoTarjetaCreditoIniciado {
  readonly referenciaBancard: string;
  /** Iframe/redirect al formulario seguro de Bancard; el dato de tarjeta nunca pasa por SeguroLoTengo. */
  readonly urlFormularioSeguro: string;
}

/**
 * Códigos de respuesta de Bancard, con su descripción tal como la documenta el
 * proveedor.
 *
 * Fuente: `docs/Integraciones/eCommerce_bancard_compra_simple_version_1.23.1
 * (1).pdf`, campo `response_code` (String(2)) y `response_description`
 * (String(40)). El documento de QR (`Qr en API de Comercios v1.2`) usa los
 * mismos códigos en el callback: `"00"` es pago exitoso y *"cualquier otro
 * valor es fallido"*, y su ejemplo de rechazo usa `"51"`.
 *
 * **No se inventan códigos ni descripciones.** Si mañana hace falta uno que no
 * está acá, sale del documento del proveedor o no existe — es el mismo criterio
 * con el que no se inventan endpoints ni parámetros de Code100.
 *
 * Las descripciones son las de Bancard y **no son el texto que ve la persona**:
 * "Tarjeta inhabilitada" describe el rechazo para quien opera o audita. Lo que
 * se le muestra a la persona lo redacta la pantalla, que además tiene que
 * decirle qué hacer.
 */
export const CODIGOS_RESPUESTA_BANCARD: Readonly<Record<string, string>> = {
  "00": "Transacción aprobada.",
  "05": "Tarjeta inhabilitada",
  "12": "Transacción inválida",
  "15": "Tarjeta inválida",
  "51": "Fondos insuficientes",
};

/** El único código que significa que el dinero entró. */
export const CODIGO_RESPUESTA_APROBADA = "00";

/**
 * Moneda de la transacción.
 *
 * **Los dos documentos de Bancard no coinciden, y se conserva la diferencia en
 * vez de unificarla:** compra simple declara `currency` como `String (3)` con
 * valor `PYG`, y el callback de QR trae `"currency":"GS"` en sus ejemplos. Son
 * dos APIs distintas del mismo proveedor; elegir una sola por prolijidad sería
 * inventar el contrato de la otra.
 */
export const MONEDA_BANCARD_VPOS = "PYG";
export const MONEDA_BANCARD_QR = "GS";

export interface EstadoConsultaPago {
  readonly referenciaBancard: string;
  readonly medio: MedioDePago;
  readonly estado: EstadoPago;
  readonly montoGs: number;
  /** Últimos 4 dígitos enmascarados, o null si no aplica (p.ej. pago por QR). Nunca el PAN completo. */
  readonly ultimos4Digitos: string | null;
  readonly actualizadoEn: string; // ISO 8601
  /**
   * `response_code` de Bancard: `"00"` es aprobada, cualquier otro es rechazo.
   * `null` mientras la operación sigue pendiente, que es antes de que Bancard
   * haya respondido nada.
   *
   * Viaja en el estado —y no solo en el error— porque un rechazo **es** un
   * desenlace de la consulta, no una excepción: la pantalla necesita poder
   * decir por qué se rechazó, y la evidencia tiene que guardarlo.
   */
  readonly codigoRespuesta: string | null;
  /** `response_description` de Bancard, la del proveedor, sin traducir. */
  readonly descripcionRespuesta: string | null;
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
  /**
   * `response_code` de Bancard cuando el rechazo trae uno.
   *
   * `null` en un timeout, y no es un detalle: un timeout es precisamente el
   * caso en que **no hubo respuesta**, así que inventarle un código sería
   * afirmar que Bancard dijo algo. Es la misma distinción que obliga a
   * reintentar con la misma `idempotencyKey`.
   */
  readonly codigoRespuesta: string | null;

  constructor(motivo: "TIMEOUT" | "RECHAZADA", mensaje: string, codigoRespuesta: string | null = null) {
    super(mensaje);
    this.name = "ErrorBancard";
    this.motivo = motivo;
    this.codigoRespuesta = codigoRespuesta;
  }
}

export interface PaymentProvider {
  iniciarPagoQr(input: IniciarPagoQrInput): Promise<PagoQrIniciado>;

  /** Compra simple de vPOS: cobra al confirmarse la operación. */
  iniciarPagoTarjetaDebito(input: IniciarPagoTarjetaDebitoInput): Promise<PagoTarjetaDebitoIniciado>;

  /** Compra simple de vPOS con crédito: cobro directo, sin reserva previa. */
  iniciarPagoTarjetaCredito(input: IniciarPagoTarjetaCreditoInput): Promise<PagoTarjetaCreditoIniciado>;

  /**
   * Estado actual de una operación. `null` si Bancard no conoce la
   * referencia: es un desenlace posible y no un error de programación, así
   * que el dominio tiene que poder distinguirlo de "existe y está pendiente"
   * en vez de recibir un objeto inventado.
   */
  consultarEstadoPago(referenciaBancard: string): Promise<EstadoConsultaPago | null>;

  /**
   * Cancela una operación que todavía no se cobró (un QR pendiente que venció)
   * o **devuelve** una ya acreditada, a pedido del titular (D-02).
   *
   * Los dos casos comparten método porque para el portal son lo mismo: pedirle
   * al proveedor que deshaga la operación. Quién puede pedir una devolución y
   * con qué condiciones lo define Alianza, y el portal solo asienta el
   * resultado — la devolución se ejecuta fuera del flujo digital.
   *
   * Idempotente por `referenciaBancard`: invocarlo sobre una referencia que ya
   * está `CANCELADO` o `DEVUELTO` devuelve el mismo `EstadoConsultaPago` sin
   * error ni efecto adicional. Los reintentos de red son esperables acá.
   */
  cancelarOLiberarReserva(referenciaBancard: string): Promise<EstadoConsultaPago>;
}
