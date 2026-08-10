/**
 * Adaptador mock de `PaymentProvider` (P7 · Facturación y garantía de pago).
 *
 * Simula a Bancard (`docs/Tabla de Integraciones externas - Tabla.csv`, filas
 * 14 "Pago con tarjeta" y 15 "Pago por QR") sin salir a la red: no hay
 * `fetch`, no hay credenciales, no hay dinero. Reproduce las tres modalidades
 * con los momentos de movimiento de dinero que documenta el proveedor:
 *
 *   - **QR Bancard** — se genera el QR (con demora, como la llamada real), la
 *     persona lo paga y el importe se acredita: `PENDIENTE` → `CONFIRMADO`.
 *   - **Tarjeta de débito** — compra simple de vPOS
 *     (`docs/Integraciones/eCommerce_bancard_compra_simple_version_1.23.1
 *     (1).pdf`): `PENDIENTE` → `CONFIRMADO`, con cobro efectivo.
 *   - **Tarjeta de crédito** — preautorización
 *     (`docs/Integraciones/Preaut y promociones 14.pdf`): `PENDIENTE` →
 *     `PREAUTORIZADO`, sin cobro; la captura la ordena la firma en P8.
 *
 * La preautorización es exclusiva del crédito, confirmado por Bancard: acá se
 * hace cumplir por construcción — `iniciarPreautorizacionTarjeta` es lo único
 * que crea operaciones `TARJETA_CREDITO`, y `capturarPreautorizacion` lanza
 * sobre cualquier otro medio, porque el QR y el débito ya cobraron en P7.
 *
 * ## Regla inviolable #6 — ningún dato de tarjeta, en ninguna capa
 *
 * Este adaptador **nunca recibe ni retiene** número de tarjeta, CVV, fecha de
 * vencimiento ni titular. No podría: los tipos del puerto no tienen dónde
 * ponerlos. Lo que devuelve para tarjeta es una `urlFormularioSeguro`, que es
 * exactamente el rol del iframe de Bancard — la persona tipea los datos allá,
 * en el dominio del procesador, y de vuelta solo llega un estado y una
 * referencia. `ultimos4Digitos` es un valor simulado fijo y enmascarado, el
 * único dato de tarjeta que el puerto admite; el expediente ni siquiera lo
 * guarda. Ver `__tests__/no-persiste-datos-de-tarjeta.test.ts`.
 *
 * ## Cómo simula el paso del tiempo
 *
 * La acreditación no usa `setTimeout`: cada Route Handler construye su propio
 * adaptador por request, así que un temporizador se perdería entre llamadas.
 * En su lugar cada operación guarda un `acreditableDesde`, y
 * `consultarEstadoPago` avanza el estado cuando el reloj lo pasó. Así el
 * polling de la pantalla ve `PENDIENTE` unos segundos y después la
 * confirmación, igual que con Bancard de verdad, y los tests pueden fijar el
 * reloj en vez de esperar.
 *
 * La demora de **generación** sí es una espera real (`await`), porque simula
 * el ida y vuelta HTTP con Bancard: es lo que hace que la pantalla tenga que
 * mostrar un estado de "generando QR". Los tests la pasan en 0.
 *
 * El estado de las operaciones vive en memoria del proceso, igual que las
 * sesiones de `identity-provider.ts`: es una ayuda de demostración, no la
 * evidencia probatoria, que va por `EvidenceStore`.
 */
import { randomUUID } from "node:crypto";
import type {
  EstadoConsultaPago,
  IniciarPagoQrInput,
  IniciarPagoTarjetaDebitoInput,
  IniciarPreautorizacionTarjetaInput,
  PagoQrIniciado,
  PagoTarjetaDebitoIniciado,
  PaymentProvider,
  PreautorizacionTarjetaIniciada,
} from "../../ports/payment-provider";
import { ErrorBancard } from "../../ports/payment-provider";
import type { EstadoPago, MedioDePago } from "../../domain/tipos";

/**
 * Vigencia del QR generado. **Decisión de producto, no obligación legal**: no
 * hay fila en `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` que fije un
 * plazo, y la especificación de pantallas tampoco lo dice. Quince minutos es
 * lo habitual en un QR de comercio y deja margen para pagar desde otra app.
 */
export const VIGENCIA_QR_MINUTOS = 15;

/** Demora simulada de la llamada a Bancard que crea la operación. */
export const DEMORA_GENERACION_MS = 1_200;

/**
 * Cuánto tarda la operación en acreditarse una vez creada: es el tiempo que
 * la persona tarda en escanear y pagar, o en completar el formulario seguro.
 * Con `DEMO_MODE` la pantalla alcanza a mostrar el QR y el polling.
 */
export const DEMORA_ACREDITACION_MS = 6_000;

/**
 * Últimos 4 dígitos simulados. Fijo y evidentemente de prueba: no sale de
 * ninguna tarjeta porque en el demo no hay ninguna. Es el único dato de
 * tarjeta que el puerto admite (enmascarado) y no se persiste en el
 * expediente.
 */
const ULTIMOS_4_SIMULADOS = "0042";

/** Falla que el panel de demo puede forzar sobre la próxima operación. */
export type FallaBancardDemo = "TIMEOUT" | "RECHAZADA";

export interface OperacionMock {
  readonly referenciaBancard: string;
  readonly expedienteId: string;
  readonly propuestaId: string;
  readonly medio: MedioDePago;
  readonly montoGs: number;
  readonly idempotencyKey: string;
  readonly creadaEn: string;
  /** Instante a partir del cual la operación pasa de PENDIENTE a su estado listo. */
  readonly acreditableDesde: string;
  readonly qrPayload: string | null;
  readonly expiraEn: string | null;
  readonly urlFormularioSeguro: string | null;
  estado: EstadoPago;
  actualizadoEn: string;
}

/**
 * Módulo-level a propósito: `POST /api/p7/pago` crea la operación y
 * `GET /api/p7/estado` la consulta desde otro handler, en otro adaptador, del
 * mismo proceso.
 */
const operaciones = new Map<string, OperacionMock>();
/** `idempotencyKey` → `referenciaBancard`. Es lo que impide el cobro duplicado. */
const porClaveDeIdempotencia = new Map<string, string>();

export interface OpcionesPaymentProviderMock {
  readonly ahora?: () => Date;
  /** Espera real que simula el ida y vuelta con Bancard. Los tests la pasan en 0. */
  readonly demoraGeneracionMs?: number;
  /** Cuánto tarda la operación en acreditarse, en milisegundos de reloj. */
  readonly demoraAcreditacionMs?: number;
  /** Falla a forzar en la próxima operación (palanca del panel de demo). */
  readonly fallaForzada?: () => FallaBancardDemo | null;
}

function referenciaDeBancard(): string {
  // Formato análogo al shop_process_id / código de operación que devolvería
  // Bancard: identifica la operación, no contiene ningún dato personal.
  return `MOCK-BANCARD-${randomUUID().slice(0, 13).toUpperCase()}`;
}

function esperar(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolver) => {
    setTimeout(resolver, ms);
  });
}

/** Estado al que llega la operación una vez acreditada, según el medio. */
function estadoAcreditado(medio: MedioDePago): EstadoPago {
  return medio === "TARJETA_CREDITO" ? "PREAUTORIZADO" : "CONFIRMADO";
}

function proyectar(operacion: OperacionMock): EstadoConsultaPago {
  return {
    referenciaBancard: operacion.referenciaBancard,
    medio: operacion.medio,
    estado: operacion.estado,
    montoGs: operacion.montoGs,
    ultimos4Digitos: operacion.medio === "QR_BANCARD" ? null : ULTIMOS_4_SIMULADOS,
    actualizadoEn: operacion.actualizadoEn,
  };
}

export function crearPaymentProviderMock(
  opciones: OpcionesPaymentProviderMock = {},
): PaymentProvider {
  const ahora = opciones.ahora ?? (() => new Date());
  const demoraGeneracionMs = opciones.demoraGeneracionMs ?? DEMORA_GENERACION_MS;
  const demoraAcreditacionMs = opciones.demoraAcreditacionMs ?? DEMORA_ACREDITACION_MS;
  const fallaForzada = opciones.fallaForzada ?? (() => null);

  /**
   * Avanza una operación pendiente cuando el reloj alcanzó su acreditación (la
   * persona pagó el QR o completó el formulario seguro) o su vencimiento.
   *
   * Se aplica en toda lectura y en toda operación posterior, no solo en
   * `consultarEstadoPago`: si solo avanzara al consultar, capturar una
   * preautorización sin haberla consultado antes fallaría por un detalle de la
   * simulación y no por una regla del negocio.
   */
  function avanzarSiCorresponde(operacion: OperacionMock): OperacionMock {
    if (operacion.estado !== "PENDIENTE") return operacion;

    const instante = ahora().toISOString();
    if (instante >= operacion.acreditableDesde) {
      operacion.estado = estadoAcreditado(operacion.medio);
      operacion.actualizadoEn = instante;
    } else if (operacion.expiraEn && instante >= operacion.expiraEn) {
      operacion.estado = "CANCELADO";
      operacion.actualizadoEn = instante;
    }
    return operacion;
  }

  /**
   * Crea la operación o devuelve la que ya existe para esa
   * `idempotencyKey`. Es el corazón de la garantía de idempotencia: la
   * segunda llamada no llega siquiera a generar una referencia nueva.
   */
  async function abrirOperacion(entrada: {
    expedienteId: string;
    propuestaId: string;
    medio: MedioDePago;
    montoGs: number;
    idempotencyKey: string;
  }): Promise<OperacionMock> {
    const yaCreada = porClaveDeIdempotencia.get(entrada.idempotencyKey);
    if (yaCreada) {
      const operacion = operaciones.get(yaCreada);
      // La operación siempre está: nada la borra. El `if` es para el tipo.
      if (operacion) return operacion;
    }

    const falla = fallaForzada();
    if (falla === "TIMEOUT") {
      // Se corta sin registrar nada, que es el caso interesante: un timeout
      // deja al llamador sin saber si Bancard alcanzó a crear la operación.
      // Por eso el reintento tiene que traer la MISMA `idempotencyKey` — si
      // la operación hubiera quedado creada del otro lado, la rama de arriba
      // la devuelve en vez de abrir una segunda y cobrar dos veces.
      await esperar(demoraGeneracionMs);
      throw new ErrorBancard("TIMEOUT", "Bancard no respondió dentro del tiempo previsto (simulado).");
    }

    await esperar(demoraGeneracionMs);

    if (falla === "RECHAZADA") {
      throw new ErrorBancard("RECHAZADA", "Bancard rechazó la operación (simulado).");
    }

    const creadaEn = ahora();
    const referenciaBancard = referenciaDeBancard();
    const esQr = entrada.medio === "QR_BANCARD";

    const operacion: OperacionMock = {
      referenciaBancard,
      expedienteId: entrada.expedienteId,
      propuestaId: entrada.propuestaId,
      medio: entrada.medio,
      montoGs: entrada.montoGs,
      idempotencyKey: entrada.idempotencyKey,
      creadaEn: creadaEn.toISOString(),
      acreditableDesde: new Date(creadaEn.getTime() + demoraAcreditacionMs).toISOString(),
      qrPayload: esQr
        ? // Payload análogo al EMVCo que devolvería Bancard QR: identifica la
          // operación y el importe, nunca un dato de la persona.
          `bancard-qr://pago?ref=${referenciaBancard}&monto=${entrada.montoGs}&moneda=PYG`
        : null,
      expiraEn: esQr
        ? new Date(creadaEn.getTime() + VIGENCIA_QR_MINUTOS * 60_000).toISOString()
        : null,
      urlFormularioSeguro: esQr
        ? null
        : `https://vpos.simulado.bancard.com.py/checkout/${referenciaBancard}`,
      estado: "PENDIENTE",
      actualizadoEn: creadaEn.toISOString(),
    };

    operaciones.set(referenciaBancard, operacion);
    porClaveDeIdempotencia.set(entrada.idempotencyKey, referenciaBancard);
    return operacion;
  }

  return {
    async iniciarPagoQr(input: IniciarPagoQrInput): Promise<PagoQrIniciado> {
      const operacion = await abrirOperacion({ ...input, medio: "QR_BANCARD" });
      return {
        referenciaBancard: operacion.referenciaBancard,
        qrPayload: operacion.qrPayload ?? "",
        expiraEn: operacion.expiraEn ?? operacion.creadaEn,
      };
    },

    async iniciarPagoTarjetaDebito(
      input: IniciarPagoTarjetaDebitoInput,
    ): Promise<PagoTarjetaDebitoIniciado> {
      const operacion = await abrirOperacion({ ...input, medio: "TARJETA_DEBITO" });
      return {
        referenciaBancard: operacion.referenciaBancard,
        urlFormularioSeguro: operacion.urlFormularioSeguro ?? "",
      };
    },

    async iniciarPreautorizacionTarjeta(
      input: IniciarPreautorizacionTarjetaInput,
    ): Promise<PreautorizacionTarjetaIniciada> {
      const operacion = await abrirOperacion({ ...input, medio: "TARJETA_CREDITO" });
      return {
        referenciaBancard: operacion.referenciaBancard,
        urlFormularioSeguro: operacion.urlFormularioSeguro ?? "",
      };
    },

    async consultarEstadoPago(referenciaBancard: string): Promise<EstadoConsultaPago | null> {
      const operacion = operaciones.get(referenciaBancard);
      if (!operacion) return null;
      return proyectar(avanzarSiCorresponde(operacion));
    },

    async capturarPreautorizacion(referenciaBancard: string): Promise<EstadoConsultaPago> {
      const guardada = operaciones.get(referenciaBancard);
      const operacion = guardada ? avanzarSiCorresponde(guardada) : undefined;
      if (!operacion) {
        throw new Error(
          `No existe la operación ${referenciaBancard}. El servidor solo captura referencias que él mismo persistió.`,
        );
      }
      if (operacion.medio !== "TARJETA_CREDITO") {
        throw new Error(
          `La operación ${referenciaBancard} es ${operacion.medio} y ya cobró en P7: no hay nada que capturar.`,
        );
      }

      // Idempotencia: una segunda captura no vuelve a cobrar.
      if (operacion.estado === "CAPTURADO") return proyectar(operacion);

      if (operacion.estado !== "PREAUTORIZADO") {
        throw new Error(
          `No se puede capturar la operación ${referenciaBancard}: está en estado ${operacion.estado}.`,
        );
      }

      operacion.estado = "CAPTURADO";
      operacion.actualizadoEn = ahora().toISOString();
      return proyectar(operacion);
    },

    async cancelarOLiberarReserva(referenciaBancard: string): Promise<EstadoConsultaPago> {
      const guardada = operaciones.get(referenciaBancard);
      const operacion = guardada ? avanzarSiCorresponde(guardada) : undefined;
      if (!operacion) {
        throw new Error(
          `No existe la operación ${referenciaBancard}. El servidor solo cancela referencias que él mismo persistió.`,
        );
      }
      if (operacion.estado === "CAPTURADO") {
        throw new Error(
          `La operación ${referenciaBancard} ya fue capturada por la firma del cliente; revertirla no es parte de este flujo.`,
        );
      }

      // Idempotencia: una segunda cancelación no tiene efecto adicional.
      if (operacion.estado === "CANCELADO") return proyectar(operacion);

      operacion.estado = "CANCELADO";
      operacion.actualizadoEn = ahora().toISOString();
      return proyectar(operacion);
    },
  };
}

/**
 * Canal de lectura EXCLUSIVO del panel de demo y de los tests: deja ver el
 * estado interno de las operaciones simuladas. Ningún Route Handler del flujo
 * P0–P9 debe importar esto — el flujo consulta por el puerto.
 */
export function listarOperacionesMock(): readonly Readonly<OperacionMock>[] {
  return [...operaciones.values()].sort((a, b) => (a.creadaEn < b.creadaEn ? 1 : -1));
}

/** Solo para tests: deja el registro de operaciones simuladas en blanco. */
export function limpiarOperacionesMock(): void {
  operaciones.clear();
  porClaveDeIdempotencia.clear();
}
