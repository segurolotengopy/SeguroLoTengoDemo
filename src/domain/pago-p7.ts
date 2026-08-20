/**
 * Caso de uso de P7 · Facturación y garantía de pago
 * (docs/ESPECIFICACION_PANTALLAS.md → "P7 · Paso 7 de 9 — Facturación y
 * garantía de pago").
 *
 * Dos operaciones, y ninguna más:
 *
 * 1. `iniciarPagoP7` — los botones `GENERAR QR BANCARD`, `PAGAR CON DÉBITO` y
 *    `PREAUTORIZAR TARJETA`. Valida la factura, exige la declaración de origen
 *    lícito, acuña el correlativo de la propuesta y abre la operación en
 *    Bancard. **No mueve el estado del expediente.**
 * 2. `confirmarPagoP7` — el sondeo que hace la pantalla mientras espera. Es lo
 *    único que puede llevar el expediente de DECLARACIONES_OK a
 *    PAGO_CONFIRMADO, y solo con una garantía de pago realmente lista.
 *
 * ## Las tres reglas que este módulo hace imposibles de violar
 *
 * **El importe no lo elige el cliente.** Sale de `expediente.plan.premioAnualGs`
 * —el premio que la persona vio y que quedó hasheado en P2— y no del cuerpo
 * del POST. No hay ninguna rama por la que un monto del navegador llegue a
 * Bancard (fila 25 de `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`:
 * *"El importe enviado a Bancard debe coincidir con el premio informado al
 * cliente"*, Ley 4868/13, art. 7(l); Ley 1334/98, art. 15(a); Res. BCP 25/21,
 * arts. 5-6).
 *
 * **El origen lícito de fondos es bloqueante.** Sin la declaración no se llama
 * a Bancard: el rechazo ocurre antes de tocar el proveedor, no después. Es un
 * dato de origen de fondos del FIPF (fila 16, Res. SEPRELAD 71/19, art.
 * 26(1)(a-j)) y se persiste versionado, con su literal íntegro.
 *
 * **Un intento, un cobro.** La `idempotencyKey` se genera una sola vez por
 * intento, se persiste en el expediente y se reutiliza en cada reintento del
 * mismo intento (doble click, timeout del cliente, retry de red). Solo cambia
 * cuando el intento anterior murió o cuando la persona cambió de medio de
 * pago. Ver `claveDeIdempotencia` (fila 32: *"Implementar idempotencia para
 * impedir cobros o eventos duplicados"*, Ley 6822/21, art. 68(1); Res. BCP
 * 25/21, art. 8).
 *
 * ## Datos de tarjeta (regla inviolable #6)
 *
 * Ni el tipo de entrada ni el de salida de este módulo tienen un campo donde
 * pueda viajar un PAN o un CVV, y tampoco lo tiene el `Pago` que se persiste.
 * Los datos de tarjeta se tipean en el formulario seguro de Bancard, al que la
 * pantalla llega por `urlFormularioSeguro`. De vuelta llegan estado y
 * referencia — nada más. `ultimos4Digitos`, que el puerto sí admite, se
 * descarta acá a propósito: no hace falta para nada del flujo y guardarlo
 * agrandaría la superficie que hay que defender. Ver
 * `src/app/api/p7/__tests__/no-persiste-datos-de-tarjeta.test.ts`.
 */
import { randomInt, randomUUID } from "node:crypto";
import { desglosePremio } from "./catalogo";
import { ErrorEscrituraConcurrente, conReintentoPorConflicto } from "./concurrencia";
import type { EvidenceStore } from "../ports/evidence-store";
import type { PaymentProvider } from "../ports/payment-provider";
import { ErrorBancard } from "../ports/payment-provider";
import { confirmarGarantiaDePagoP7, registrarIntentoPagoP7 } from "./expediente";
import {
  TEXTO_DECLARACION_ORIGEN_LICITO,
  VERSION_DECLARACION_ORIGEN_LICITO,
} from "./textos-p7";
import { esMedioDePago, pagoAcreditado } from "./tipos";
import type {
  DatosFacturacionP7,
  EstadoExpediente,
  Expediente,
  MedioDePago,
  Pago,
  RegistroEvidencia,
} from "./tipos";
import type { ContextoPeticion, RepositorioExpediente } from "./verificacion-canal";

// ---------------------------------------------------------------------------
// Dependencias y constantes
// ---------------------------------------------------------------------------

export interface DependenciasP7 {
  readonly pagos: PaymentProvider;
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
  /** Inyectable solo para que los tests puedan fijar el correlativo. */
  readonly nuevoNumeroPropuesta?: () => string;
  /** A dónde vuelve Bancard después del formulario seguro de tarjeta. */
  readonly urlRetornoTarjeta?: string;
  /**
   * Duración del plazo para firmar. 24 horas por especificación; el panel de
   * demo lo comprime a segundos para poder mostrar la Pantalla B sin esperar
   * un día (CLAUDE.md → "Panel de demo").
   */
  readonly plazoFirmaMs?: number;
}

/** Único estado desde el que P7 puede operar. */
export const ESTADO_REQUERIDO_P7: EstadoExpediente = "DECLARACIONES_OK";

export const PASO_EVIDENCIA_INICIO_P7 = "P7_INICIO_PAGO";
export const PASO_EVIDENCIA_CONFIRMACION_P7 = "P7_CONFIRMACION_PAGO";

/** `PLAZO PARA FIRMAR: 24 HORAS` (especificación de P7 y nota inferior de P8). */
export const PLAZO_FIRMA_MS = 24 * 60 * 60 * 1000;

export const URL_RETORNO_TARJETA_POR_DEFECTO = "/pago/retorno";

// ---------------------------------------------------------------------------
// Correlativo de la propuesta
// ---------------------------------------------------------------------------

export const LARGO_NUMERO_PROPUESTA = 8;

/**
 * Genera el correlativo de la propuesta / futura póliza: `00018425` en la
 * especificación. P8 lo prefija como `PROP-` para la Solicitud y `FIPF-` para
 * el FIPF — **un solo correlativo, dos prefijos** (CLAUDE.md → "Reglas
 * transversales de integraciones").
 *
 * Mismo criterio que `generarNumeroCaso` en `declaraciones-p6.ts`: ocho
 * dígitos de `randomInt` (CSPRNG) y no un contador, porque en el demo no hay
 * secuencia central y un correlativo adivinable expondría cuántas propuestas
 * existen. El formato es decisión de producto: no tiene fila en la matriz de
 * cumplimiento.
 */
export function generarNumeroPropuesta(): string {
  return String(randomInt(0, 10 ** LARGO_NUMERO_PROPUESTA)).padStart(LARGO_NUMERO_PROPUESTA, "0");
}

// ---------------------------------------------------------------------------
// Validación del RUC
// ---------------------------------------------------------------------------

/**
 * RUC paraguayo: número de identificación seguido de un dígito verificador
 * separado por guion (p.ej. `80012345-6`). Se acepta también sin guion y se
 * normaliza, porque es un campo manual y opcional.
 *
 * No se valida el dígito verificador: el RUC va a la factura que emite
 * Alianza, que es quien lo valida contra la SET. Rechazar acá un RUC que la
 * SET sí conoce sería peor que dejarlo pasar.
 */
const FORMATO_RUC = /^(\d{5,9})-?(\d)$/;

export function normalizarRuc(entrada: string): string | null {
  const limpio = entrada.trim().replace(/\s+/g, "");
  if (limpio === "") return null;
  const coincidencia = FORMATO_RUC.exec(limpio);
  if (!coincidencia) return null;
  return `${coincidencia[1]}-${coincidencia[2]}`;
}

// ---------------------------------------------------------------------------
// Clave de idempotencia
// ---------------------------------------------------------------------------

/**
 * Decide qué clave de idempotencia usar para este intento.
 *
 * Reutiliza la del `Pago` persistido cuando se trata **del mismo intento**:
 * mismo medio, mismo importe y todavía pendiente. Eso cubre exactamente los
 * casos que el puerto describe —doble click, timeout del cliente, retry de
 * red— y es lo que hace que un reintento no abra una segunda operación en
 * Bancard.
 *
 * Genera una clave nueva cuando el intento anterior ya no sirve: la persona
 * cambió de medio de pago, o el QR anterior se canceló o venció. Son intentos
 * legítimamente distintos y cada uno necesita su propia clave — por eso el
 * puerto advierte que `propuestaId` no alcanza como sustituto.
 */
export function claveDeIdempotencia(
  pagoAnterior: Pago | null,
  medio: MedioDePago,
  montoGs: number,
  nuevaClave: () => string,
): string {
  const mismoIntento =
    pagoAnterior !== null &&
    pagoAnterior.estado === "PENDIENTE" &&
    pagoAnterior.medio === medio &&
    pagoAnterior.montoGs === montoGs;

  return mismoIntento ? pagoAnterior.idempotencyKey : nuevaClave();
}

// ---------------------------------------------------------------------------
// Entrada y resultado
// ---------------------------------------------------------------------------

export interface EntradaIniciarPagoP7 {
  readonly expedienteId: string;
  /** Cuerpo crudo del formulario: se interpreta y valida en el dominio. */
  readonly medio: unknown;
  readonly ruc: unknown;
  /** Checkbox obligatorio de origen lícito de fondos. */
  readonly origenLicitoDeFondos: unknown;
  readonly contexto: ContextoPeticion;
}

export type MotivoRechazoP7 =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "MEDIO_INVALIDO"
  | "ORIGEN_FONDOS_NO_DECLARADO"
  | "RUC_INVALIDO"
  | "EXPEDIENTE_INCOMPLETO"
  | "BANCARD_NO_DISPONIBLE"
  | "BANCARD_RECHAZO"
  | "PAGO_NO_INICIADO"
  | "PAGO_CANCELADO"
  /**
   * Otra petición escribió el expediente entre la lectura y el guardado y el
   * conflicto persistió tras los reintentos (`src/domain/concurrencia.ts`).
   * No se perdió nada: el bloqueo optimista impidió pisar la otra escritura.
   * El próximo sondeo ve la versión que ganó.
   */
  | "CONFLICTO_CONCURRENCIA";

/**
 * Instrucciones para la pantalla según el medio. No tiene ninguna variante con
 * campos de tarjeta: para débito y crédito lo único que baja es la URL del
 * formulario seguro de Bancard.
 */
export type InstruccionDePago =
  | { readonly tipo: "QR"; readonly qrPayload: string; readonly expiraEn: string }
  | { readonly tipo: "FORMULARIO_SEGURO"; readonly urlFormularioSeguro: string };

export type ResultadoIniciarPagoP7 =
  | {
      readonly ok: true;
      readonly medio: MedioDePago;
      readonly montoGs: number;
      readonly numeroPropuesta: string;
      readonly referenciaBancard: string;
      readonly instruccion: InstruccionDePago;
    }
  | { readonly ok: false; readonly motivo: MotivoRechazoP7; readonly detalle?: string };

export type ResultadoConfirmarPagoP7 =
  | {
      readonly ok: true;
      /** `false` mientras Bancard siga devolviendo PENDIENTE: la pantalla sigue sondeando. */
      readonly confirmado: false;
      readonly medio: MedioDePago;
      readonly referenciaBancard: string;
    }
  | {
      readonly ok: true;
      readonly confirmado: true;
      readonly estado: EstadoExpediente;
      readonly medio: MedioDePago;
      readonly montoGs: number;
      readonly referenciaBancard: string;
      readonly numeroPropuesta: string;
      readonly plazoFirmaVenceEn: string;
      /** `true` con QR y débito: el dinero ya se movió y una firma que no llega obliga a devolver. */
          readonly siguientePantalla: "/firma";
    }
  | { readonly ok: false; readonly motivo: MotivoRechazoP7; readonly detalle?: string };

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

interface Reloj {
  readonly ahora: () => string;
  readonly nuevoId: () => string;
  readonly nuevoNumeroPropuesta: () => string;
}

function resolverReloj(deps: DependenciasP7): Reloj {
  return {
    ahora: deps.ahora ?? (() => new Date().toISOString()),
    nuevoId: deps.nuevoId ?? (() => randomUUID()),
    nuevoNumeroPropuesta: deps.nuevoNumeroPropuesta ?? generarNumeroPropuesta,
  };
}

/**
 * Única forma en la que información de este paso sale hacia la evidencia.
 *
 * Es exactamente lo que exige la fila 31 de la matriz —*"Conservar ID, estado,
 * fecha, hora, importe y referencia de la operación Bancard"*, Res. BCP 25/21,
 * art. 6(a-e); Ley 6822/21, arts. 42(5) y 66— y nada más. No hay ninguna rama
 * por la que pueda entrar acá un dato de tarjeta: los parámetros son de tipo
 * `MedioDePago`, `EstadoPago`, `number` y `string` de referencia.
 */
export function resumenSeguroP7(entrada: {
  medio: MedioDePago;
  montoGs: number;
  referenciaBancard: string | null;
  estadoPago: string | null;
  numeroPropuesta: string | null;
  idempotencyKey: string | null;
  plazoFirmaVenceEn?: string | null;
}): Readonly<Record<string, string | number | boolean>> {
  return {
    medio: entrada.medio,
    montoGs: entrada.montoGs,
    ...(entrada.estadoPago ? { estadoPago: entrada.estadoPago } : {}),
    ...(entrada.referenciaBancard ? { referenciaBancard: entrada.referenciaBancard } : {}),
    ...(entrada.numeroPropuesta ? { propuesta: entrada.numeroPropuesta } : {}),
    ...(entrada.idempotencyKey ? { idempotencyKey: entrada.idempotencyKey } : {}),
    ...(entrada.plazoFirmaVenceEn ? { plazoFirmaVenceEn: entrada.plazoFirmaVenceEn } : {}),
  };
}

function formatearDetalle(datos: Readonly<Record<string, string | number | boolean>>): string {
  return Object.entries(datos)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(" · ");
}

async function registrarEvidencia(
  deps: DependenciasP7,
  reloj: Reloj,
  entrada: {
    expedienteId: string;
    paso: string;
    fecha: string;
    contexto: ContextoPeticion;
    resultado: "EXITOSO" | "FALLIDO";
    detalle: Readonly<Record<string, string | number | boolean>>;
    /** Solo en el inicio del pago, que es donde se acepta la declaración. */
    aceptacion?: { versionTexto: string; texto: string };
  },
): Promise<void> {
  const registro: RegistroEvidencia = {
    id: reloj.nuevoId(),
    expedienteId: entrada.expedienteId,
    paso: entrada.paso,
    fecha: entrada.fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: entrada.aceptacion?.versionTexto ?? null,
    textoAceptado: entrada.aceptacion?.texto ?? null,
    resultado: entrada.resultado,
    detalle: formatearDetalle(entrada.detalle),
  };
  await deps.evidencias.guardar(registro);
}

// ---------------------------------------------------------------------------
// Operación 1 — abrir la operación en Bancard
// ---------------------------------------------------------------------------

/**
 * Botones `GENERAR QR BANCARD` / `PAGAR CON DÉBITO` / `PREAUTORIZAR TARJETA`.
 *
 * El orden de las validaciones importa: el medio y la declaración de origen
 * lícito se chequean **antes** de leer el expediente y, sobre todo, antes de
 * llamar a Bancard. Una operación abierta que después hay que cancelar por un
 * checkbox sin marcar sería un movimiento innecesario en el vPOS de Alianza.
 */
export async function iniciarPagoP7(
  deps: DependenciasP7,
  entrada: EntradaIniciarPagoP7,
): Promise<ResultadoIniciarPagoP7> {
  try {
    return await intentarIniciarPagoP7(deps, entrada);
  } catch (error) {
    // Sin reintento, a diferencia del sondeo: reintentar podría abrir una
    // segunda operación en Bancard (`src/domain/concurrencia.ts`). Se devuelve
    // el conflicto y la persona puede volver a tocar el botón; el reintento
    // manual reutiliza la `idempotencyKey` persistida (ver `claveDeIdempotencia`).
    if (error instanceof ErrorEscrituraConcurrente) {
      return { ok: false, motivo: "CONFLICTO_CONCURRENCIA" };
    }
    throw error;
  }
}

async function intentarIniciarPagoP7(
  deps: DependenciasP7,
  entrada: EntradaIniciarPagoP7,
): Promise<ResultadoIniciarPagoP7> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();

  if (!esMedioDePago(entrada.medio)) {
    return { ok: false, motivo: "MEDIO_INVALIDO" };
  }
  const medio = entrada.medio;

  // Bloqueante por diseño: sin declaración no hay llamada al proveedor.
  if (entrada.origenLicitoDeFondos !== true) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_INICIO_P7,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { medio, motivo: "ORIGEN_FONDOS_NO_DECLARADO" },
    });
    return { ok: false, motivo: "ORIGEN_FONDOS_NO_DECLARADO" };
  }

  const rucCrudo = typeof entrada.ruc === "string" ? entrada.ruc : "";
  const ruc = rucCrudo.trim() === "" ? null : normalizarRuc(rucCrudo);
  if (rucCrudo.trim() !== "" && ruc === null) {
    return { ok: false, motivo: "RUC_INVALIDO" };
  }

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  if (expediente.estado !== ESTADO_REQUERIDO_P7) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_INICIO_P7,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { medio, motivo: "ESTADO_INVALIDO", estado: expediente.estado },
    });
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  // El plan trae el importe; la identidad, el nombre de la factura. Los dos
  // están garantizados por la máquina de estados, pero el tipo no lo sabe.
  if (!expediente.plan || !expediente.identidad) {
    return { ok: false, motivo: "EXPEDIENTE_INCOMPLETO" };
  }

  const montoGs = expediente.plan.premioAnualGs;
  const numeroPropuesta = expediente.numeroPropuesta ?? reloj.nuevoNumeroPropuesta();
  const idempotencyKey = claveDeIdempotencia(expediente.pago, medio, montoGs, reloj.nuevoId);
  const urlRetorno = deps.urlRetornoTarjeta ?? URL_RETORNO_TARJETA_POR_DEFECTO;

  let referenciaBancard: string;
  let instruccion: InstruccionDePago;
  try {
    if (medio === "QR_BANCARD") {
      const qr = await deps.pagos.iniciarPagoQr({
        expedienteId: expediente.id,
        propuestaId: numeroPropuesta,
        montoGs,
        idempotencyKey,
      });
      referenciaBancard = qr.referenciaBancard;
      instruccion = { tipo: "QR", qrPayload: qr.qrPayload, expiraEn: qr.expiraEn };
    } else if (medio === "TARJETA_DEBITO") {
      const debito = await deps.pagos.iniciarPagoTarjetaDebito({
        expedienteId: expediente.id,
        propuestaId: numeroPropuesta,
        montoGs,
        urlRetorno,
        idempotencyKey,
      });
      referenciaBancard = debito.referenciaBancard;
      instruccion = { tipo: "FORMULARIO_SEGURO", urlFormularioSeguro: debito.urlFormularioSeguro };
    } else {
      const preautorizacion = await deps.pagos.iniciarPagoTarjetaCredito({
        expedienteId: expediente.id,
        propuestaId: numeroPropuesta,
        montoGs,
        urlRetorno,
        idempotencyKey,
      });
      referenciaBancard = preautorizacion.referenciaBancard;
      instruccion = {
        tipo: "FORMULARIO_SEGURO",
        urlFormularioSeguro: preautorizacion.urlFormularioSeguro,
      };
    }
  } catch (error) {
    const esDeBancard = error instanceof ErrorBancard;
    const motivo: MotivoRechazoP7 =
      esDeBancard && error.motivo === "RECHAZADA" ? "BANCARD_RECHAZO" : "BANCARD_NO_DISPONIBLE";

    // La clave se pierde con el intento fallido y eso es correcto: la pantalla
    // vuelve a pedir el pago y el dominio recalcula. Si Bancard hubiera
    // alcanzado a crear la operación, el `Pago` persistido de un intento
    // anterior con la misma configuración devuelve la misma clave.
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_INICIO_P7,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: resumenSeguroP7({
        medio,
        montoGs,
        referenciaBancard: null,
        estadoPago: null,
        numeroPropuesta,
        idempotencyKey,
        plazoFirmaVenceEn: null,
      }),
    });
    return { ok: false, motivo, detalle: esDeBancard ? error.message : undefined };
  }

  const facturacion: DatosFacturacionP7 = {
    // Siempre el nombre del asegurado, tomado del OCR de la cédula: no hay
    // camino por el que la persona escriba otro (regla inviolable #9).
    nombreAFacturar: `${expediente.identidad.nombres} ${expediente.identidad.apellidos}`.trim(),
    ruc,
    declaracionOrigenLicito: {
      aceptadaEn: fecha,
      ip: entrada.contexto.ip,
      dispositivo: entrada.contexto.dispositivo,
      sesionId: entrada.contexto.sesionId,
      versionTexto: VERSION_DECLARACION_ORIGEN_LICITO,
      textoAceptado: TEXTO_DECLARACION_ORIGEN_LICITO,
    },
  };

  const pago: Pago = {
    medio,
    estado: "PENDIENTE",
    montoGs,
    referenciaBancard,
    idempotencyKey,
    iniciadoEn: fecha,
    confirmadoEn: null,
  };

  const registro = registrarIntentoPagoP7(
    expediente,
    { numeroPropuesta, facturacion, pago },
    fecha,
  );
  if (!registro.ok) {
    return { ok: false, motivo: "ESTADO_INVALIDO", detalle: registro.error };
  }

  await deps.expedientes.guardar(registro.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_INICIO_P7,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: resumenSeguroP7({
      medio,
      montoGs,
      referenciaBancard,
      estadoPago: "PENDIENTE",
      numeroPropuesta,
      idempotencyKey,
    }),
    // La declaración de origen lícito se acepta en este acto: se guarda el
    // literal íntegro, no solo la versión, por el mismo motivo que en P3.
    aceptacion: {
      versionTexto: VERSION_DECLARACION_ORIGEN_LICITO,
      texto: TEXTO_DECLARACION_ORIGEN_LICITO,
    },
  });

  return {
    ok: true,
    medio,
    montoGs,
    numeroPropuesta,
    referenciaBancard,
    instruccion,
  };
}

// ---------------------------------------------------------------------------
// Operación 2 — confirmar contra Bancard
// ---------------------------------------------------------------------------

/**
 * Sondeo de la pantalla mientras espera a Bancard, y única puerta por la que
 * el expediente pasa a PAGO_CONFIRMADO.
 *
 * Es idempotente de punta a punta: llamarlo con el expediente ya en
 * PAGO_CONFIRMADO devuelve los mismos datos sin volver a transicionar ni a
 * escribir. Eso importa porque la pantalla sondea en bucle y porque el mismo
 * endpoint va a atender el callback de Bancard cuando exista el adaptador
 * oficial (CLAUDE.md → "Idempotencia de webhooks").
 */
export async function confirmarPagoP7(
  deps: DependenciasP7,
  entrada: { expedienteId: string; contexto: ContextoPeticion },
): Promise<ResultadoConfirmarPagoP7> {
  // Perder la carrera de escritura contra otro sondeo (o contra el callback
  // oficial de Bancard, cuando exista) se resuelve releyendo: la operación es
  // convergente —rama idempotente para PAGO_CONFIRMADO— y consultar a Bancard
  // de nuevo no repite ningún efecto.
  return conReintentoPorConflicto(
    () => intentarConfirmarPagoP7(deps, entrada),
    () => ({ ok: false, motivo: "CONFLICTO_CONCURRENCIA" }),
  );
}

async function intentarConfirmarPagoP7(
  deps: DependenciasP7,
  entrada: { expedienteId: string; contexto: ContextoPeticion },
): Promise<ResultadoConfirmarPagoP7> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();
  const plazoFirmaMs = deps.plazoFirmaMs ?? PLAZO_FIRMA_MS;

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  const pago = expediente.pago;
  if (!pago || !pago.referenciaBancard) {
    return { ok: false, motivo: "PAGO_NO_INICIADO" };
  }

  // Ya confirmado: se responde con lo persistido, sin tocar Bancard ni el
  // expediente. Es la rama que hace inofensivo un callback duplicado.
  if (expediente.estado === "PAGO_CONFIRMADO" && pagoAcreditado(pago.estado)) {
    return {
      ok: true,
      confirmado: true,
      estado: expediente.estado,
      medio: pago.medio,
      montoGs: pago.montoGs,
      referenciaBancard: pago.referenciaBancard,
      numeroPropuesta: expediente.numeroPropuesta ?? "",
      plazoFirmaVenceEn: expediente.plazoFirmaVenceEn ?? "",
      siguientePantalla: "/firma",
    };
  }

  if (expediente.estado !== ESTADO_REQUERIDO_P7) {
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  const consulta = await deps.pagos.consultarEstadoPago(pago.referenciaBancard);
  if (!consulta) {
    return { ok: false, motivo: "PAGO_NO_INICIADO" };
  }

  if (consulta.estado === "CANCELADO") {
    await deps.expedientes.guardar(
      { ...expediente, pago: { ...pago, estado: "CANCELADO" }, actualizadoEn: fecha },
      expediente.actualizadoEn,
    );
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_CONFIRMACION_P7,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: resumenSeguroP7({
        medio: pago.medio,
        montoGs: pago.montoGs,
        referenciaBancard: pago.referenciaBancard,
        estadoPago: "CANCELADO",
        numeroPropuesta: expediente.numeroPropuesta,
        idempotencyKey: pago.idempotencyKey,
      }),
    });
    return { ok: false, motivo: "PAGO_CANCELADO" };
  }

  if (!pagoAcreditado(consulta.estado)) {
    // Sigue pendiente. No se escribe nada: un sondeo cada dos segundos no
    // tiene por qué generar una escritura ni un registro de evidencia.
    return { ok: true, confirmado: false, medio: pago.medio, referenciaBancard: pago.referenciaBancard };
  }

  const plazoFirmaVenceEn = new Date(new Date(fecha).getTime() + plazoFirmaMs).toISOString();

  const transicion = confirmarGarantiaDePagoP7(
    expediente,
    {
      pago: {
        ...pago,
        // Se copia el estado que reportó Bancard, no uno inferido acá:
        // CONFIRMADO para QR y débito, PREAUTORIZADO para crédito.
        // `ultimos4Digitos` de la consulta se descarta a propósito.
        estado: consulta.estado,
        confirmadoEn: fecha,
      },
      plazoFirmaVenceEn,
    },
    fecha,
  );

  if (!transicion.ok) {
    return { ok: false, motivo: "ESTADO_INVALIDO", detalle: transicion.error };
  }

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_CONFIRMACION_P7,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: resumenSeguroP7({
      medio: pago.medio,
      montoGs: pago.montoGs,
      referenciaBancard: pago.referenciaBancard,
      estadoPago: consulta.estado,
      numeroPropuesta: transicion.expediente.numeroPropuesta,
      idempotencyKey: pago.idempotencyKey,
      plazoFirmaVenceEn,
    }),
  });

  return {
    ok: true,
    confirmado: true,
    estado: transicion.expediente.estado,
    medio: pago.medio,
    montoGs: pago.montoGs,
    referenciaBancard: pago.referenciaBancard,
    numeroPropuesta: transicion.expediente.numeroPropuesta ?? "",
    plazoFirmaVenceEn,
    siguientePantalla: "/firma",
  };
}

// ---------------------------------------------------------------------------
// Lectura para la pantalla
// ---------------------------------------------------------------------------

export interface ResumenPagoP7 {
  readonly numeroPropuesta: string | null;
  readonly montoGs: number;
  /** Apertura del premio (CHG-35). Provisional hasta el desglose de Alianza. */
  readonly primaNetaGs: number;
  readonly ivaGs: number;
  readonly desgloseProvisional: boolean;
  readonly nombreAFacturar: string;
  readonly medio: MedioDePago | null;
  readonly referenciaBancard: string | null;
  readonly garantiaLista: boolean;
}

/**
 * Lo que P7 necesita mostrar del expediente al cargar: el nombre de la
 * factura, el premio y —si ya hubo un intento— la referencia de Bancard.
 * Devuelve `null` si el expediente todavía no llegó a P7 o ya lo pasó.
 */
export function leerResumenPagoP7(expediente: Expediente): ResumenPagoP7 | null {
  if (!expediente.plan || !expediente.identidad) return null;
  if (expediente.estado !== ESTADO_REQUERIDO_P7 && expediente.estado !== "PAGO_CONFIRMADO") {
    return null;
  }

  // CHG-35 · el desglose se deriva del plan del expediente, no se recalcula en
  // la pantalla: lo que se muestra tiene que ser lo mismo que se cobra.
  const desglose = desglosePremio(expediente.plan.planId);

  return {
    numeroPropuesta: expediente.numeroPropuesta,
    montoGs: expediente.plan.premioAnualGs,
    primaNetaGs: desglose.primaNetaGs,
    ivaGs: desglose.ivaGs,
    desgloseProvisional: desglose.esProvisional,
    nombreAFacturar: `${expediente.identidad.nombres} ${expediente.identidad.apellidos}`.trim(),
    medio: expediente.pago?.medio ?? null,
    referenciaBancard: expediente.pago?.referenciaBancard ?? null,
    garantiaLista: pagoAcreditado(expediente.pago?.estado ?? "PENDIENTE"),
  };
}
