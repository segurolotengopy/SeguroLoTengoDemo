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
 * hace cumplir por construcción — `iniciarPagoTarjetaCredito` es lo único
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
  IniciarPagoTarjetaCreditoInput,
  PagoQrIniciado,
  PagoTarjetaDebitoIniciado,
  PaymentProvider,
  PagoTarjetaCreditoIniciado,
} from "../../ports/payment-provider";
import {
  CODIGOS_RESPUESTA_BANCARD,
  CODIGO_RESPUESTA_APROBADA,
  ErrorBancard,
} from "../../ports/payment-provider";
import { construirQrEmvco, generarHookAlias } from "./bancard-emvco";
import type { EstadoPago, MedioDePago } from "../../domain/tipos";
import { estadoCompartidoDemo } from "./estado-compartido";

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
 * Plazo de acreditación que usa la demostración para que el reloj **no**
 * acredite nunca: la acreditación la dispara el botón *Pagado* del paso 7.
 *
 * Es un año. No es `Infinity` porque el valor se suma a un instante para
 * calcular `acreditableDesde`, y `fecha + Infinity` da `Invalid Date`, que
 * compara como falso contra cualquier cosa y produciría un pendiente eterno
 * por accidente en vez de por decisión.
 */
export const DEMORA_ACREDITACION_SOLO_POR_BOTON_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Últimos 4 dígitos simulados. Fijo y evidentemente de prueba: no sale de
 * ninguna tarjeta porque en el demo no hay ninguna. Es el único dato de
 * tarjeta que el puerto admite (enmascarado) y no se persiste en el
 * expediente.
 */
const ULTIMOS_4_SIMULADOS = "0042";

/** Falla que el panel de demo puede forzar sobre la próxima operación. */
export type FallaBancardDemo = "TIMEOUT" | "RECHAZADA";

/**
 * Con qué `response_code` rechaza la palanca `BANCARD_TIMEOUT`/`RECHAZADA` del
 * panel.
 *
 * `51` (fondos insuficientes) porque es el que usa el propio documento de
 * Bancard QR en su ejemplo de pago rechazado, y porque es el rechazo que más se
 * ve en producción: la demostración muestra el caso frecuente, no uno exótico.
 */
export const CODIGO_RECHAZO_SIMULADO = "51";

/**
 * Falla de la **captura** de una preautorización, que es un momento distinto de
 * la apertura de la operación: la ordena la firma del cliente en P8. Existe para
 * poder demostrar la fila 44 de la matriz de cumplimiento (*"Si falla el cobro,
 * no solicitar la emisión automática"*).
 */
export type FallaCapturaDemo = "CAPTURA_FALLIDA";

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
  /**
   * `hook_alias` de Bancard QR: el alias con el que después llega la
   * confirmación por callback. `null` en los medios que no son QR, que se
   * identifican por `shop_process_id`.
   */
  readonly hookAlias: string | null;
  readonly expiraEn: string | null;
  readonly urlFormularioSeguro: string | null;
  estado: EstadoPago;
  /** `response_code` de Bancard; `null` mientras no contestó nada. */
  codigoRespuesta: string | null;
  actualizadoEn: string;
}

/**
 * Módulo-level a propósito: `POST /api/p7/pago` crea la operación y
 * `GET /api/p7/estado` la consulta desde otro handler, en otro adaptador, del
 * mismo proceso.
 */
const operaciones = estadoCompartidoDemo("pagos.operaciones", () => new Map<string, OperacionMock>());
/** `idempotencyKey` → `referenciaBancard`. Es lo que impide el cobro duplicado. */
const porClaveDeIdempotencia = estadoCompartidoDemo("pagos.idempotencia", () => new Map<string, string>());

export interface OpcionesPaymentProviderMock {
  readonly ahora?: () => Date;
  /** Espera real que simula el ida y vuelta con Bancard. Los tests la pasan en 0. */
  readonly demoraGeneracionMs?: number;
  /** Cuánto tarda la operación en acreditarse, en milisegundos de reloj. */
  readonly demoraAcreditacionMs?: number;
  /** Falla a forzar en la próxima operación (palanca del panel de demo). */
  readonly fallaForzada?: () => FallaBancardDemo | null;
  /** Falla a forzar en la próxima captura de preautorización. */
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

/**
 * Estado al que llega la operación una vez acreditada.
 *
 * Los tres medios terminan igual desde que no hay preautorización (D-02): o el
 * dinero entró, o no entró.
 */
function estadoAcreditado(): EstadoPago {
  return "CONFIRMADO";
}

function proyectar(operacion: OperacionMock): EstadoConsultaPago {
  return {
    referenciaBancard: operacion.referenciaBancard,
    medio: operacion.medio,
    estado: operacion.estado,
    montoGs: operacion.montoGs,
    ultimos4Digitos: operacion.medio === "QR_BANCARD" ? null : ULTIMOS_4_SIMULADOS,
    actualizadoEn: operacion.actualizadoEn,
    codigoRespuesta: operacion.codigoRespuesta,
    // La descripción no se guarda: se deriva del código, que es lo que Bancard
    // documenta como pareja fija. Guardar las dos permitiría que se separaran.
    descripcionRespuesta: operacion.codigoRespuesta
      ? (CODIGOS_RESPUESTA_BANCARD[operacion.codigoRespuesta] ?? null)
      : null,
  };
}

/**
 * Acredita una operación **por acción explícita**, que es lo que hace el botón
 * *Pagado* del paso 7 en la demostración.
 *
 * ## Por qué existe, y por qué no alcanzaba con el reloj
 *
 * El mock acreditaba solo, a los `DEMORA_ACREDITACION_MS`. Eso funciona en los
 * tests, donde el reloj se fija, y falla en una demostración desplegada por una
 * razón conocida: las operaciones viven en memoria del proceso, y Amplify puede
 * atender el sondeo con **otra instancia de cómputo** que nunca vio esta
 * operación. La pantalla quedaba esperando una confirmación que nadie iba a dar.
 *
 * Por eso esta función **crea la operación si no la encuentra**, con los datos
 * que le pasa quien la llama —que los saca del `Pago` persistido del
 * expediente, no de la memoria—. Así la acreditación deja de depender de qué
 * instancia atendió cada pedido: el dato de verdad está en DynamoDB.
 *
 * Es una palanca de demostración, con las mismas reglas que las del panel: solo
 * existe con `DEMO_MODE`, y no inventa un camino paralelo — deja la operación
 * exactamente en el estado `CONFIRMADO` con `response_code` `00` al que habría
 * llegado sola, así que el resto del flujo la valida como siempre.
 */
export function acreditarPagoMock(
  referenciaBancard: string,
  datos: { readonly medio: MedioDePago; readonly montoGs: number; readonly ahora: string },
): EstadoConsultaPago {
  const existente = operaciones.get(referenciaBancard);

  if (existente) {
    // Ya acreditada: idempotente, como el propio proveedor ante un reintento.
    if (existente.estado !== "CONFIRMADO") {
      existente.estado = "CONFIRMADO";
      existente.codigoRespuesta = CODIGO_RESPUESTA_APROBADA;
      existente.actualizadoEn = datos.ahora;
    }
    return proyectar(existente);
  }

  // Esta instancia no conoce la operación. La reconstruye desde lo que el
  // expediente sí persiste, en vez de decir "no existe" sobre un pago real.
  const reconstruida: OperacionMock = {
    referenciaBancard,
    expedienteId: "",
    propuestaId: "",
    medio: datos.medio,
    montoGs: datos.montoGs,
    idempotencyKey: "",
    creadaEn: datos.ahora,
    acreditableDesde: datos.ahora,
    hookAlias: null,
    qrPayload: null,
    expiraEn: null,
    urlFormularioSeguro: null,
    estado: "CONFIRMADO",
    codigoRespuesta: CODIGO_RESPUESTA_APROBADA,
    actualizadoEn: datos.ahora,
  };
  operaciones.set(referenciaBancard, reconstruida);
  return proyectar(reconstruida);
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
      operacion.estado = estadoAcreditado();
      operacion.codigoRespuesta = CODIGO_RESPUESTA_APROBADA;
      operacion.actualizadoEn = instante;
    } else if (operacion.expiraEn && instante >= operacion.expiraEn) {
      operacion.estado = "CANCELADO";
      // Un QR que vence sin pagarse es una transacción que nunca ocurrió: en el
      // vocabulario de Bancard, `12` (transacción inválida). No se inventa un
      // código propio — los que existen son los cinco del documento.
      operacion.codigoRespuesta = "12";
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
      // Sin `response_code`: un timeout es, justamente, no haber recibido
      // respuesta. El documento de QR es explícito en que Bancard aguarda 5
      // segundos y, si no hay respuesta, **reversa la transacción**.
      throw new ErrorBancard("TIMEOUT", "Bancard no respondió dentro del tiempo previsto (simulado).");
    }

    await esperar(demoraGeneracionMs);

    if (falla === "RECHAZADA") {
      // Con el código y la descripción del proveedor, no con un texto propio:
      // `51` es el que usa el propio ejemplo de rechazo del documento de QR.
      throw new ErrorBancard(
        "RECHAZADA",
        CODIGOS_RESPUESTA_BANCARD[CODIGO_RECHAZO_SIMULADO] ?? "Operación rechazada",
        CODIGO_RECHAZO_SIMULADO,
      );
    }

    const creadaEn = ahora();
    const referenciaBancard = referenciaDeBancard();
    const esQr = entrada.medio === "QR_BANCARD";
    // `hook_alias` solo existe en la API de QR; los otros medios se identifican
    // por `shop_process_id`, que acá es la referencia.
    const hookAlias = esQr ? generarHookAlias(() => randomUUID()) : null;

    const operacion: OperacionMock = {
      referenciaBancard,
      expedienteId: entrada.expedienteId,
      propuestaId: entrada.propuestaId,
      medio: entrada.medio,
      montoGs: entrada.montoGs,
      idempotencyKey: entrada.idempotencyKey,
      creadaEn: creadaEn.toISOString(),
      acreditableDesde: new Date(creadaEn.getTime() + demoraAcreditacionMs).toISOString(),
      hookAlias,
      // `qr_data` en EMVCo, como lo define el documento de Bancard QR. Antes acá
      // había una cadena inventada (`bancard-qr://pago?ref=…`) que ningún lector
      // reconoce: mostraba en la demostración un formato que no es el del
      // producto. Lleva el importe y el alias, nunca un dato de la persona.
      qrPayload: esQr ? construirQrEmvco({ montoGs: entrada.montoGs, hookAlias: hookAlias ?? "" }) : null,
      expiraEn: esQr
        ? new Date(creadaEn.getTime() + VIGENCIA_QR_MINUTOS * 60_000).toISOString()
        : null,
      urlFormularioSeguro: esQr
        ? null
        : `https://vpos.simulado.bancard.com.py/checkout/${referenciaBancard}`,
      estado: "PENDIENTE",
      // Pendiente es, literalmente, que Bancard todavía no respondió nada.
      codigoRespuesta: null,
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

    async iniciarPagoTarjetaCredito(
      input: IniciarPagoTarjetaCreditoInput,
    ): Promise<PagoTarjetaCreditoIniciado> {
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

    async cancelarOLiberarReserva(referenciaBancard: string): Promise<EstadoConsultaPago> {
      const guardada = operaciones.get(referenciaBancard);
      const operacion = guardada ? avanzarSiCorresponde(guardada) : undefined;
      if (!operacion) {
        throw new Error(
          `No existe la operación ${referenciaBancard}. El servidor solo cancela referencias que él mismo persistió.`,
        );
      }
      // Idempotencia: repetir la operación no tiene efecto adicional. Vale
      // para los dos finales posibles, porque el llamador no siempre sabe si
      // la operación ya había cobrado cuando se pidió deshacerla.
      if (operacion.estado === "CANCELADO" || operacion.estado === "DEVUELTO") {
        return proyectar(operacion);
      }

      // Una operación acreditada no se cancela: se devuelve. Son dos hechos
      // distintos y el expediente tiene que poder distinguirlos —cancelar un
      // QR que nunca se pagó no deja rastro contable; devolver un cobro sí.
      operacion.estado = operacion.estado === "CONFIRMADO" ? "DEVUELTO" : "CANCELADO";
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
