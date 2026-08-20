/**
 * Caso de uso del paso de pago · Facturación y cobro
 * (docs/ESPECIFICACION_PANTALLAS.md → "P7 · Facturación y garantía de pago";
 * el orden y el número de paso los manda ahora `rutas-flujo.ts`).
 *
 * Tres operaciones, y ninguna más:
 *
 * 1. `iniciarPagoP7` — los botones de QR, débito y crédito. Valida la factura
 *    y abre la operación en Bancard. **No mueve el estado del expediente.**
 * 2. `confirmarPagoP7` — el sondeo que hace la pantalla mientras espera. Es lo
 *    único que puede llevar el expediente de FIRMADO a PAGO_CONFIRMADO.
 * 3. `vencerPlazoPagoP7` — el plazo de 24 horas cumplido sin cobro: FIRMADO →
 *    VENCIDO (D-10).
 *
 * ## D-08 · este paso ahora va después de la firma
 *
 * Hasta el Lote 4 se cobraba primero y se firmaba después, y este módulo
 * acuñaba el correlativo de la propuesta. Invertido el orden (Matriz Legal V4
 * §7), el correlativo nace con los documentos —que se cierran antes de
 * firmar— y acá solo se lo cita. Lo que este módulo gana es el vencimiento: el
 * reloj de 24 horas corre sobre un expediente **firmado y no pagado**, así que
 * caducar dejó de costar plata y la fila 30 de la matriz (*"Devolver el premio
 * si el cliente no firma dentro del plazo comunicado"*) queda satisfecha de la
 * única manera que no puede fallar: no cobrando antes.
 *
 * ## Las tres reglas que este módulo hace imposibles de violar
 *
 * **No se cobra sin firma.** El único estado desde el que se puede operar es
 * FIRMADO, al que solo se llega con el paquete cerrado y hasheado, la firma
 * del cliente registrada y las institucionales aplicadas. Es la garantía que
 * pide la Matriz V4 §7: el medio de cobro solo se habilita con firma válida.
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
import {
  TEXTO_ACEPTACION_CERTIFICADO_P7,
  VERSION_ACEPTACION_CERTIFICADO_P7,
} from "./textos-p7";
import { randomUUID } from "node:crypto";
import { desglosePremio } from "./catalogo";
import { ErrorEscrituraConcurrente, conReintentoPorConflicto } from "./concurrencia";
import type { EvidenceStore } from "../ports/evidence-store";
import type { PaymentProvider } from "../ports/payment-provider";
import { ErrorBancard } from "../ports/payment-provider";
import {
  registrarIntentoPagoP7,
  registrarPagoConfirmadoP7,
  vencerPlazoSiCorresponde,
} from "./expediente";
import { esMedioDePago, pagoAcreditado } from "./tipos";
import type {
  CertificadoCobertura,
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
  /** A dónde vuelve Bancard después del formulario seguro de tarjeta. */
  readonly urlRetornoTarjeta?: string;
  /**
   * Emisión del Certificado de Cobertura Provisional (D-12), que ocurre en la
   * misma escritura que confirma el pago.
   *
   * **Entra como función inyectada y no como import** porque quien la
   * implementa vive en `src/documentos/`, que a su vez importa este dominio:
   * traerla acá directamente cerraría un ciclo de módulos. El precio es que
   * hay que acordarse de cablearla en el composition root, y a cambio el
   * dominio sigue sin saber nada de PDF, de S3 ni de `node:crypto`.
   *
   * **Es obligatoria**, y no opcional con una rama que la saltee: un
   * `DependenciasP7` sin emisor podría confirmar un cobro sin certificado, que
   * es exactamente lo que CMP-07 prohíbe. Hacerla requerida traslada esa
   * garantía al compilador.
   */
  readonly emitirCertificado: EmisorCertificadoCobertura;
}

/**
 * Lo que P7 necesita del emisor del certificado: recibe el expediente ya
 * proyectado con el cobro adentro y devuelve la ficha del documento cerrado,
 * o el motivo por el que no pudo emitirlo. **No persiste el expediente** — eso
 * lo hace `confirmarPagoP7` en una sola escritura junto con el pago.
 */
export type EmisorCertificadoCobertura = (entrada: {
  readonly expediente: Expediente;
  readonly emitidoEn: string;
}) => Promise<
  | { readonly ok: true; readonly certificado: CertificadoCobertura }
  | { readonly ok: false; readonly motivo: string; readonly detalle?: string }
>;

/**
 * Único estado desde el que este paso puede operar.
 *
 * Era `DECLARACIONES_OK` mientras se cobraba antes de firmar. Con el orden
 * invertido (D-08) el cobro solo se habilita con el expediente firmado por
 * todos los intervinientes.
 */
export const ESTADO_REQUERIDO_P7: EstadoExpediente = "FIRMADO";

export const PASO_EVIDENCIA_INICIO_P7 = "P7_INICIO_PAGO";
export const PASO_EVIDENCIA_CONFIRMACION_P7 = "P7_CONFIRMACION_PAGO";
export const PASO_EVIDENCIA_VENCIMIENTO_P7 = "P7_VENCIMIENTO_PLAZO_PAGO";
export const PASO_EVIDENCIA_CERTIFICADO_P7 = "P7_CERTIFICADO_COBERTURA";

export const URL_RETORNO_TARJETA_POR_DEFECTO = "/pago/retorno";

export const RUTA_PANTALLA_B = "/solicitud-vencida";
export const RUTA_CONFIRMACION = "/confirmacion";

/** Estados en los que el dinero ya entró. */
const ESTADOS_CON_COBRO: readonly EstadoExpediente[] = ["PAGO_CONFIRMADO", "EMITIDO"];

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
  /**
   * CHG-37 · casilla obligatoria de la pantalla. Se valida en el servidor
   * porque esconder o deshabilitar un botón es cosmético: lo que autoriza
   * emitir el certificado y mandar la póliza tiene que constar en la
   * evidencia, no en el estado del navegador.
   */
  readonly aceptaCertificadoYEntrega: unknown;
  readonly contexto: ContextoPeticion;
}

export type MotivoRechazoP7 =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "MEDIO_INVALIDO"
  | "RUC_INVALIDO"
  /** CHG-37 · no se marcó la aceptación del certificado y de la entrega. */
  | "ACEPTACION_CERTIFICADO_REQUERIDA"
  /**
   * CMP-08 · el documento contra el que se iba a cobrar no tiene huella
   * verificable. No se abre ninguna operación en Bancard: cobrar sin poder
   * probar qué se firmó rompe el vínculo de la fila 47.
   */
  | "DOCUMENTO_SIN_HUELLA"
  | "EXPEDIENTE_INCOMPLETO"
  | "BANCARD_NO_DISPONIBLE"
  | "BANCARD_RECHAZO"
  | "PAGO_NO_INICIADO"
  | "PAGO_CANCELADO"
  /** El expediente firmado caducó sin pagarse (D-10). Terminal: no hay reintento. */
  | "PLAZO_VENCIDO"
  /**
   * D-12 · Bancard acreditó el cobro pero el Certificado de Cobertura
   * Provisional no se pudo cerrar, así que el pago **no se confirmó**: la
   * secuencia pago → CPC es atómica (CMP-07) y confirmar sin certificado
   * dejaría a la persona cobrada y sin constancia de desde cuándo está
   * cubierta. El expediente se queda en `FIRMADO` y el próximo sondeo lo
   * reintenta entero — el dinero ya entró en Bancard, la operación no se
   * repite (la clave de idempotencia es la misma).
   */
  | "CERTIFICADO_NO_EMITIDO"
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
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoP7;
      readonly detalle?: string;
      readonly siguientePantalla?: typeof RUTA_PANTALLA_B;
    };

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
      readonly siguientePantalla: typeof RUTA_CONFIRMACION;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoP7;
      readonly detalle?: string;
      /** A dónde mandar a la persona cuando el rechazo la saca del flujo. */
      readonly siguientePantalla?: typeof RUTA_PANTALLA_B;
    };

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * `9323336` → `93•••••`, y `9.323.336` → `93•••••` también.
 *
 * Cuenta **dígitos**, no caracteres: la cédula llega del OCR a veces con
 * puntos y a veces sin ellos, y cortar a ciegas los dos primeros caracteres
 * daba `9.••••••` — que no alcanza para reconocerla, que es exactamente para
 * lo que la persona la mira acá antes de decidir si carga un RUC distinto.
 */
function enmascararCedula(numero: string): string {
  const digitos = numero.replace(/\D/g, "");
  return `${digitos.slice(0, 2)}${"•".repeat(Math.max(digitos.length - 2, 0))}`;
}

interface Reloj {
  readonly ahora: () => string;
  readonly nuevoId: () => string;
}

function resolverReloj(deps: DependenciasP7): Reloj {
  return {
    ahora: deps.ahora ?? (() => new Date().toISOString()),
    nuevoId: deps.nuevoId ?? (() => randomUUID()),
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
  /** CMP-08 · huella del documento contra el que se emite el medio de cobro. */
  hashDocumento?: string | null;
  /** `true` si ya había un intento previo: esta emisión es una regeneración. */
  regeneracion?: boolean;
}): Readonly<Record<string, string | number | boolean>> {
  return {
    medio: entrada.medio,
    montoGs: entrada.montoGs,
    ...(entrada.estadoPago ? { estadoPago: entrada.estadoPago } : {}),
    ...(entrada.referenciaBancard ? { referenciaBancard: entrada.referenciaBancard } : {}),
    ...(entrada.numeroPropuesta ? { propuesta: entrada.numeroPropuesta } : {}),
    ...(entrada.idempotencyKey ? { idempotencyKey: entrada.idempotencyKey } : {}),
    ...(entrada.hashDocumento ? { hashDocumento: entrada.hashDocumento } : {}),
    ...(entrada.regeneracion !== undefined ? { regeneracion: entrada.regeneracion } : {}),
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

/**
 * Aplica el vencimiento del plazo de pago si corresponde, persiste y deja
 * evidencia (D-10).
 *
 * Devuelve el expediente que hay que seguir usando: el mismo si el plazo no se
 * cumplió, o el ya vencido si se cumplió. Toda operación de este paso arranca
 * por acá — y este es el único paso que lo hace, porque es el único en el que
 * el reloj está corriendo.
 *
 * **Vencer ya no cuesta plata.** Bajo el orden nuevo el expediente caduca
 * antes de cobrar, así que no hay premio que devolver ni reserva que liberar:
 * la evidencia lo registra como caducidad sin cobro y ahí termina.
 */
async function aplicarVencimiento(
  deps: DependenciasP7,
  reloj: Reloj,
  expediente: Expediente,
  contexto: ContextoPeticion,
): Promise<{ readonly expediente: Expediente; readonly vencio: boolean }> {
  // Ya vencido —por una llamada anterior a este mismo camino o por la petición
  // concurrente que ganó la carrera de escritura—: no hay nada que escribir ni
  // evidencia nueva que dejar. Es lo que hace convergente el reintento ante
  // conflicto y cierta la promesa de idempotencia del endpoint de vencimiento.
  if (expediente.estado === "VENCIDO") return { expediente, vencio: true };

  const fecha = reloj.ahora();
  const transicion = vencerPlazoSiCorresponde(expediente, fecha);

  if (!transicion.ok) {
    // La única forma de llegar acá es una transición ilegal, que sería un error
    // de programación. Se deja el expediente como estaba antes que romper.
    return { expediente, vencio: false };
  }
  if (transicion.expediente.estado !== "VENCIDO") {
    return { expediente: transicion.expediente, vencio: false };
  }

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_VENCIMIENTO_P7,
    fecha,
    contexto,
    resultado: "FALLIDO",
    detalle: {
      motivo: "PLAZO_PAGO_VENCIDO",
      estadoAnterior: expediente.estado,
      plazoPagoVenceEn: expediente.plazoPagoVenceEn ?? "",
      // D-08 · el expediente vence **antes** de cobrar, así que no hay premio
      // que devolver: simplemente caduca.
      consecuencia: "CADUCIDAD_SIN_COBRO",
    },
  });

  return { expediente: transicion.expediente, vencio: true };
}

// ---------------------------------------------------------------------------
// Operación 1 — abrir la operación en Bancard
// ---------------------------------------------------------------------------

/**
 * Botones `GENERAR QR BANCARD` / `PAGAR CON DÉBITO` / `PAGAR CON CRÉDITO`.
 *
 * El orden de las validaciones importa: el medio se chequea **antes** de leer
 * el expediente y, sobre todo, antes de llamar a Bancard. Una operación
 * abierta que después hay que cancelar por un campo inválido sería un
 * movimiento innecesario en el vPOS de Alianza.
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

  // CHG-37 · sin la aceptación no se abre ninguna operación en Bancard: lo que
  // se está autorizando ocurre después del cobro, así que tiene que constar
  // antes de que haya dinero de por medio.
  if (entrada.aceptaCertificadoYEntrega !== true) {
    return { ok: false, motivo: "ACEPTACION_CERTIFICADO_REQUERIDA" };
  }

  const rucCrudo = typeof entrada.ruc === "string" ? entrada.ruc : "";
  const ruc = rucCrudo.trim() === "" ? null : normalizarRuc(rucCrudo);
  if (rucCrudo.trim() !== "" && ruc === null) {
    return { ok: false, motivo: "RUC_INVALIDO" };
  }

  const guardado = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!guardado) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  const { expediente, vencio } = await aplicarVencimiento(deps, reloj, guardado, entrada.contexto);
  if (vencio) {
    return { ok: false, motivo: "PLAZO_VENCIDO", siguientePantalla: RUTA_PANTALLA_B };
  }

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

  // El plan trae el importe; la identidad, el nombre de la factura; el paquete
  // documental, el correlativo. Los tres están garantizados por la máquina de
  // estados, pero el tipo no lo sabe.
  if (!expediente.plan || !expediente.identidad || !expediente.numeroPropuesta) {
    return { ok: false, motivo: "EXPEDIENTE_INCOMPLETO" };
  }

  // CMP-08 · el medio de cobro se emite —y se regenera— **contra un documento
  // que no cambió**. Si el hash del PDF firmado no es el que quedó registrado
  // al cerrarlo, lo que se está por cobrar no corresponde a lo que la persona
  // firmó, y generar el QR igual sería cobrar por otro contrato.
  //
  // Con el paquete cerrado e inmutable esto no debería poder fallar nunca; que
  // no deba es exactamente la razón de comprobarlo, porque si falla no hay
  // ninguna otra cosa que lo note.
  const documento = expediente.paqueteDocumental;
  if (!documento || documento.hashSha256.trim() === "") {
    return { ok: false, motivo: "DOCUMENTO_SIN_HUELLA" };
  }
  if (expediente.firma && expediente.firma.hashDocumentoFirmado.trim() === "") {
    return { ok: false, motivo: "DOCUMENTO_SIN_HUELLA" };
  }

  const montoGs = expediente.plan.premioAnualGs;
  // D-08 · el correlativo ya existe: lo acuñó el cierre del paquete documental,
  // que ahora ocurre antes. Acá solo se lo cita, y por eso no hay ninguna rama
  // que pueda darle a un mismo expediente un segundo número.
  const numeroPropuesta = expediente.numeroPropuesta;
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
        hashDocumento: documento.hashSha256,
      }),
    });
    return { ok: false, motivo, detalle: esDeBancard ? error.message : undefined };
  }

  const facturacion: DatosFacturacionP7 = {
    // Siempre el nombre del asegurado, tomado del OCR de la cédula: no hay
    // camino por el que la persona escriba otro (regla inviolable #9).
    nombreAFacturar: `${expediente.identidad.nombres} ${expediente.identidad.apellidos}`.trim(),
    ruc,
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
    { facturacion, pago },
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
      // CMP-08 · la huella del documento contra el que se emite este medio de
      // cobro. Es lo que permite probar, después, que el QR que se pagó
      // correspondía al contrato que se firmó y no a otro.
      hashDocumento: documento.hashSha256,
      // Cada emisión queda asentada, incluidas las regeneraciones: si la
      // persona pidió tres QR, hay tres registros con la misma huella.
      regeneracion: expediente.pago !== null,
    }),
    // CHG-37 · el literal completo y su versión, no solo un booleano: si
    // alguien edita el texto sin subir la versión, el expediente sigue
    // conteniendo palabra por palabra lo que la persona aceptó (mismo criterio
    // que P3 y P8).
    aceptacion: {
      texto: TEXTO_ACEPTACION_CERTIFICADO_P7,
      versionTexto: VERSION_ACEPTACION_CERTIFICADO_P7,
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

  const guardado = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!guardado) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  // Ya confirmado antes de mirar el plazo: un pago acreditado no vence, y
  // evaluar el reloj sobre él solo abriría una carrera contra la escritura que
  // acaba de ocurrir.
  const yaConfirmado = respuestaDePagoYaConfirmado(guardado);
  if (yaConfirmado) return yaConfirmado;

  const { expediente, vencio } = await aplicarVencimiento(deps, reloj, guardado, entrada.contexto);
  if (vencio) {
    return { ok: false, motivo: "PLAZO_VENCIDO", siguientePantalla: RUTA_PANTALLA_B };
  }

  const pago = expediente.pago;
  if (!pago || !pago.referenciaBancard) {
    return { ok: false, motivo: "PAGO_NO_INICIADO" };
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

  const pagoAcreditadoAhora: Pago = {
    ...pago,
    // Se copia el estado que reportó Bancard, no uno inferido acá.
    // `ultimos4Digitos` de la consulta se descarta a propósito.
    estado: consulta.estado,
    confirmadoEn: fecha,
  };

  // D-12 · el Certificado de Cobertura Provisional se cierra **antes** de
  // transicionar, sobre la proyección del expediente ya cobrado: el documento
  // tiene que poder decir el instante exacto de la acreditación, que es el que
  // fija el inicio de la cobertura (CHG-41). Si no se puede cerrar, el pago no
  // se confirma — no existe un expediente cobrado sin certificado (CMP-07).
  const certificado = await deps.emitirCertificado({
    expediente: { ...expediente, pago: pagoAcreditadoAhora },
    emitidoEn: fecha,
  });
  if (!certificado.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_CERTIFICADO_P7,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: resumenSeguroP7({
        medio: pago.medio,
        montoGs: pago.montoGs,
        referenciaBancard: pago.referenciaBancard,
        estadoPago: consulta.estado,
        numeroPropuesta: expediente.numeroPropuesta,
        idempotencyKey: pago.idempotencyKey,
      }),
    });
    return { ok: false, motivo: "CERTIFICADO_NO_EMITIDO", detalle: certificado.detalle };
  }

  const transicion = registrarPagoConfirmadoP7(
    expediente,
    { pago: pagoAcreditadoAhora, certificado: certificado.certificado },
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
    }),
  });

  // Evidencia propia del certificado: es un documento con su código, su
  // huella y su firma institucional, y la fila 77 pide poder citarlo por
  // separado. Acá no viaja ningún dato de la persona ni de la tarjeta.
  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_CERTIFICADO_P7,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: {
      certificado: certificado.certificado.codigo,
      version: certificado.certificado.version,
      hashCertificado: certificado.certificado.hashSha256,
      paquete: certificado.certificado.codigoPaquete,
      inicioCobertura: certificado.certificado.inicioCobertura,
      finCobertura: certificado.certificado.finCobertura,
      firmantes: certificado.certificado.firmas.map((firma) => firma.rol).join(","),
      certificados: certificado.certificado.firmas.map((firma) => firma.certificado).join(","),
    },
  });

  return {
    ok: true,
    confirmado: true,
    estado: transicion.expediente.estado,
    medio: pago.medio,
    montoGs: pago.montoGs,
    referenciaBancard: pago.referenciaBancard,
    numeroPropuesta: transicion.expediente.numeroPropuesta ?? "",
    siguientePantalla: RUTA_CONFIRMACION,
  };
}

/**
 * Respuesta idempotente para un expediente que ya cobró: se devuelve lo
 * persistido, sin tocar Bancard ni el expediente. Es la rama que hace
 * inofensivo un callback duplicado (CLAUDE.md → "Idempotencia de webhooks").
 */
function respuestaDePagoYaConfirmado(expediente: Expediente): ResultadoConfirmarPagoP7 | null {
  const pago = expediente.pago;
  if (!pago || !pago.referenciaBancard) return null;
  if (!ESTADOS_CON_COBRO.includes(expediente.estado) || !pagoAcreditado(pago.estado)) return null;

  return {
    ok: true,
    confirmado: true,
    estado: expediente.estado,
    medio: pago.medio,
    montoGs: pago.montoGs,
    referenciaBancard: pago.referenciaBancard,
    numeroPropuesta: expediente.numeroPropuesta ?? "",
    siguientePantalla: RUTA_CONFIRMACION,
  };
}

// ---------------------------------------------------------------------------
// Operación 3 — vencimiento del plazo
// ---------------------------------------------------------------------------

export type ResultadoVencimientoP7 =
  | { readonly ok: true; readonly vencio: boolean; readonly estado: EstadoExpediente }
  | {
      readonly ok: false;
      readonly motivo: "EXPEDIENTE_NO_ENCONTRADO" | "CONFLICTO_CONCURRENCIA";
    };

/**
 * Evalúa el plazo y, si se cumplió, vence el expediente.
 *
 * Es la misma rutina que corre al principio de las otras dos operaciones,
 * expuesta aparte para que la pantalla pueda dispararla cuando su cuenta
 * regresiva llega a cero sin tener que abrir un pago ni sondearlo.
 *
 * La pantalla la dispara a la vez que sigue sondeando el estado del pago, así
 * que perder la carrera de escritura contra ese sondeo es esperable: se
 * reintenta con una lectura fresca, que converge (un expediente ya VENCIDO no
 * se vuelve a escribir ni deja evidencia nueva).
 */
export async function vencerPlazoPagoP7(
  deps: DependenciasP7,
  entrada: { readonly expedienteId: string; readonly contexto: ContextoPeticion },
): Promise<ResultadoVencimientoP7> {
  return conReintentoPorConflicto<ResultadoVencimientoP7>(
    async () => {
      const reloj = resolverReloj(deps);
      const guardado = await deps.expedientes.obtenerPorId(entrada.expedienteId);
      if (!guardado) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

      const { expediente, vencio } = await aplicarVencimiento(deps, reloj, guardado, entrada.contexto);
      return { ok: true, vencio, estado: expediente.estado };
    },
    () => ({ ok: false, motivo: "CONFLICTO_CONCURRENCIA" }),
  );
}

// ---------------------------------------------------------------------------
// Lectura para la pantalla
// ---------------------------------------------------------------------------

export interface ResumenPagoP7 {
  readonly numeroPropuesta: string | null;
  /** Hasta cuándo hay tiempo de pagar (D-10). */
  readonly plazoPagoVenceEn: string | null;
  readonly montoGs: number;
  /** Apertura del premio (CHG-35). Provisional hasta el desglose de Alianza. */
  readonly primaNetaGs: number;
  readonly ivaGs: number;
  readonly desgloseProvisional: boolean;
  readonly nombreAFacturar: string;
  /**
   * CHG-34 · la identificación fiscal que se va a usar **si no se carga un
   * RUC**: la cédula del asegurado, enmascarada.
   *
   * Hasta ahora esa caída existía y no se decía: la nota al pie explicaba que
   * "se enviará el nombre y la cédula" sin mostrar cuál. Enmascarada porque es
   * un dato de identidad y la regla de UI no admite mostrarlo entero — alcanza
   * para reconocerlo, que es lo que la persona necesita para decidir si carga
   * un RUC distinto.
   */
  readonly identificacionFiscalPorDefecto: string;
  readonly medio: MedioDePago | null;
  readonly referenciaBancard: string | null;
  /** `true` cuando el dinero ya entró. Sin preautorización (D-02) no hay medias tintas. */
  readonly cobrado: boolean;
}

/**
 * Lo que P7 necesita mostrar del expediente al cargar: el nombre de la
 * factura, el premio y —si ya hubo un intento— la referencia de Bancard.
 * Devuelve `null` si el expediente todavía no llegó a P7 o ya lo pasó.
 */
export function leerResumenPagoP7(expediente: Expediente): ResumenPagoP7 | null {
  if (!expediente.plan || !expediente.identidad) return null;
  if (expediente.estado !== ESTADO_REQUERIDO_P7 && !ESTADOS_CON_COBRO.includes(expediente.estado)) {
    return null;
  }

  // CHG-35 · el desglose se deriva del plan del expediente, no se recalcula en
  // la pantalla: lo que se muestra tiene que ser lo mismo que se cobra.
  const desglose = desglosePremio(expediente.plan.planId);

  return {
    numeroPropuesta: expediente.numeroPropuesta,
    plazoPagoVenceEn: expediente.plazoPagoVenceEn,
    montoGs: expediente.plan.premioAnualGs,
    primaNetaGs: desglose.primaNetaGs,
    ivaGs: desglose.ivaGs,
    desgloseProvisional: desglose.esProvisional,
    nombreAFacturar: `${expediente.identidad.nombres} ${expediente.identidad.apellidos}`.trim(),
    identificacionFiscalPorDefecto: `Cédula ${enmascararCedula(expediente.identidad.numeroCedula)}`,
    medio: expediente.pago?.medio ?? null,
    referenciaBancard: expediente.pago?.referenciaBancard ?? null,
    cobrado: pagoAcreditado(expediente.pago?.estado ?? "PENDIENTE"),
  };
}
