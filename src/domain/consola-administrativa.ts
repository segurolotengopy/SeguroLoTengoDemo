/**
 * Reglas de la consola administrativa (`docs/CONSOLA_ADMINISTRATIVA.md` §5):
 * el bloqueo de nuevo registro por cédula y el reinicio con justificativo.
 *
 * La consola **no forma parte de las 12 pantallas** ni del contador de 9
 * pasos: es una herramienta interna para staff de AAB1 / Interseguros /
 * Alianza. Pero las reglas que aplica sí son de negocio, así que viven acá y
 * no en el Route Handler ni en el componente.
 *
 * ## La regla que esto agrega
 *
 * > Mientras una cédula tenga un expediente en `DERIVADO_MANUAL`, `VENCIDO` o
 * > `DEVOLUCION_EN_TRAMITE` sin superar, el flujo digital normal (P0–P9)
 * > bloquea un registro nuevo con esa cédula hasta que la consola lo habilite.
 *
 * Se aplica en P5, que es donde el sistema conoce la cédula por primera vez
 * (sale del OCR, regla inviolable #8). Antes de P5 el expediente se identifica
 * solo por WhatsApp y correo, y la especificación de la consola deja
 * explícitamente abierto si el bloqueo debería llegar tan atrás (§6).
 *
 * ## Cómo se levanta, sin romper la regla inviolable #5
 *
 * El expediente derivado **nunca cambia de estado**. `DERIVADO_MANUAL` sigue
 * siendo terminal, también desde la consola: no hay ninguna función acá que
 * transicione el expediente original, y `expediente.ts` no le define ninguna
 * transición de salida.
 *
 * Lo que hace el reinicio es crear un expediente **nuevo** en `INICIADO`, con
 * `expedienteAnteriorId` apuntando al viejo. El bloqueo se levanta solo porque
 * el viejo queda *superado*: `expedientesQueBloquean` descarta todo expediente
 * al que otro ya apunta. No hay ningún flag de "desbloqueado" que alguien
 * pueda poner a mano — el estado del bloqueo se deriva de la cadena de
 * expedientes, que es append-only por construcción.
 *
 * La autorización queda asentada como evidencia en el expediente **viejo**
 * (append-only, regla inviolable #10): quién autorizó, cuándo, con qué
 * justificativo y hacia qué expediente nuevo.
 */
import { randomUUID } from "node:crypto";
import type { EvidenceStore } from "../ports/evidence-store";
import { crearExpedienteInicial } from "./tipos";
import type { EstadoExpediente, Expediente, RegistroEvidencia } from "./tipos";
import type { ContextoPeticion, RepositorioExpediente } from "./verificacion-canal";

// ---------------------------------------------------------------------------
// Bloqueo por cédula
// ---------------------------------------------------------------------------

/**
 * Estados que bloquean un registro nuevo con la misma cédula. Son los dos
 * finales del flujo digital que **no** terminaron en póliza: la derivación a
 * Pantalla A y el vencimiento del plazo de firma de Pantalla B.
 *
 * `EMITIDO` no está: un expediente emitido es un contrato cerrado con éxito,
 * no un caso pendiente de resolver. Que una persona pueda o no contratar una
 * segunda póliza es una decisión de producto que nadie tomó todavía.
 */
export const ESTADOS_QUE_BLOQUEAN_REGISTRO: readonly EstadoExpediente[] = [
  "DERIVADO_MANUAL",
  "VENCIDO",
  "DEVOLUCION_EN_TRAMITE",
];

export function estadoBloqueaRegistro(estado: EstadoExpediente): boolean {
  return ESTADOS_QUE_BLOQUEAN_REGISTRO.includes(estado);
}

/**
 * De un conjunto de expedientes de la misma persona, los que efectivamente
 * bloquean: están en un estado bloqueante y **ninguno de los otros los
 * supera** (es decir, nadie los declara como `expedienteAnteriorId`).
 *
 * Función pura: recibe la lista ya leída. Así la regla se puede probar sin
 * base y la consola y P5 aplican exactamente el mismo criterio.
 */
export function expedientesQueBloquean(
  expedientes: readonly Expediente[],
): readonly Expediente[] {
  const superados = new Set(
    expedientes
      .map((expediente) => expediente.expedienteAnteriorId)
      .filter((id): id is string => id !== null),
  );

  return expedientes.filter(
    (expediente) => estadoBloqueaRegistro(expediente.estado) && !superados.has(expediente.id),
  );
}

/** Subconjunto de `ConsultaExpedientes` que necesita la regla de bloqueo. */
export interface LectorExpedientesPorCedula {
  buscarPorCedula(numeroCedula: string): Promise<readonly Expediente[]>;
}

export interface ResultadoBloqueo {
  readonly bloqueada: boolean;
  /** Ids y estados de los expedientes que bloquean; vacío si no hay bloqueo. */
  readonly expedientesQueBloquean: readonly {
    readonly id: string;
    readonly estado: EstadoExpediente;
    readonly numeroCasoDerivacion: string | null;
  }[];
}

/**
 * ¿Esta cédula puede empezar un expediente nuevo?
 *
 * Devuelve solo id, estado y número de caso: nunca datos de salud, PEP ni el
 * expediente entero (regla inviolable #7). Lo llama P5, que no tiene por qué
 * ver el contenido de un expediente ajeno para saber si está bloqueado.
 */
export async function evaluarBloqueoPorCedula(
  lector: LectorExpedientesPorCedula,
  numeroCedula: string,
): Promise<ResultadoBloqueo> {
  const expedientes = await lector.buscarPorCedula(numeroCedula);
  const bloquean = expedientesQueBloquean(expedientes);

  return {
    bloqueada: bloquean.length > 0,
    expedientesQueBloquean: bloquean.map((expediente) => ({
      id: expediente.id,
      estado: expediente.estado,
      numeroCasoDerivacion: expediente.numeroCasoDerivacion,
    })),
  };
}

// ---------------------------------------------------------------------------
// Vistas de la consola
// ---------------------------------------------------------------------------

/**
 * Fila del listado de resultados (`docs/CONSOLA_ADMINISTRATIVA.md` §3): *"id,
 * titular (enmascarado salvo que se abra el detalle), estado actual, fecha de
 * última actividad, y badge si está DERIVADO_MANUAL o VENCIDO"*.
 */
export interface FilaResultado {
  readonly id: string;
  readonly estado: EstadoExpediente;
  readonly titularEnmascarado: string | null;
  readonly documentoEnmascarado: string | null;
  readonly actualizadoEn: string;
  readonly numeroCasoDerivacion: string | null;
  /** `true` si este expediente bloquea un registro nuevo con su cédula. */
  readonly bloqueaRegistro: boolean;
  readonly expedienteAnteriorId: string | null;
}

/** `Mónica Mariana Gorena Tapia` → `M••••• G•••••`. */
function enmascararNombre(nombres: string, apellidos: string): string {
  const inicial = (palabra: string): string =>
    palabra.length === 0 ? "" : `${palabra[0]}${"•".repeat(Math.max(palabra.length - 1, 0))}`;
  const primero = nombres.split(" ")[0] ?? "";
  const apellido = apellidos.split(" ")[0] ?? "";
  return [inicial(primero), inicial(apellido)].filter(Boolean).join(" ");
}

/** `9323336` → `93•••••`. */
function enmascararDocumento(numero: string): string {
  return `${numero.slice(0, 2)}${"•".repeat(Math.max(numero.length - 2, 0))}`;
}

/**
 * Arma el listado. Recibe **todos** los expedientes que comparten cédula para
 * poder decidir cuáles bloquean (un expediente superado no bloquea), y devuelve
 * solo los que la búsqueda pidió.
 */
export function armarResultados(
  encontrados: readonly Expediente[],
  contexto: readonly Expediente[] = encontrados,
): readonly FilaResultado[] {
  const bloquean = new Set(expedientesQueBloquean(contexto).map((expediente) => expediente.id));

  return encontrados.map((expediente) => ({
    id: expediente.id,
    estado: expediente.estado,
    titularEnmascarado: expediente.identidad
      ? enmascararNombre(expediente.identidad.nombres, expediente.identidad.apellidos)
      : null,
    documentoEnmascarado: expediente.identidad
      ? enmascararDocumento(expediente.identidad.numeroCedula)
      : null,
    actualizadoEn: expediente.actualizadoEn,
    numeroCasoDerivacion: expediente.numeroCasoDerivacion,
    bloqueaRegistro: bloquean.has(expediente.id),
    expedienteAnteriorId: expediente.expedienteAnteriorId,
  }));
}

/**
 * Filtro por nombre del titular (`docs/CONSOLA_ADMINISTRATIVA.md` §3: *"cédula
 * o nombre del titular"*).
 *
 * **Es un filtro en memoria, no un índice.** DynamoDB no puede buscar por
 * substring sin un motor de texto aparte, así que la consola primero acota por
 * un criterio indexado (estado + fechas, o cédula) y después filtra por nombre
 * sobre ese conjunto. A escala de demo alcanza; con volumen real hay que mover
 * esto a OpenSearch o equivalente. Queda anotado como limitación conocida.
 */
export function filtrarPorNombre(
  expedientes: readonly Expediente[],
  fragmento: string,
): readonly Expediente[] {
  const buscado = fragmento.trim().toLowerCase();
  if (buscado === "") return expedientes;

  return expedientes.filter((expediente) => {
    if (!expediente.identidad) return false;
    const completo = `${expediente.identidad.nombres} ${expediente.identidad.apellidos}`.toLowerCase();
    return completo.includes(buscado);
  });
}

// ---------------------------------------------------------------------------
// Reinicio con justificativo
// ---------------------------------------------------------------------------

/**
 * Catálogo de justificativos de `docs/CONSOLA_ADMINISTRATIVA.md` §5.4. El
 * documento lo da como *"catálogo sugerido, a confirmar tamaño final"*, así
 * que esto es una decisión de producto abierta a revisión, no una obligación
 * normativa: no tiene fila en la matriz de cumplimiento.
 */
export const JUSTIFICATIVOS_REINICIO = [
  { id: "ERROR_INGRESO", rotulo: "Error en el ingreso de información" },
  { id: "ERROR_PROVEEDOR", rotulo: "Error en la respuesta del proveedor" },
  { id: "SOLICITUD_CLIENTE", rotulo: "Solicitud del cliente" },
  { id: "OTRO", rotulo: "Otro" },
] as const;

export type IdJustificativoReinicio = (typeof JUSTIFICATIVOS_REINICIO)[number]["id"];

export function esIdJustificativo(valor: unknown): valor is IdJustificativoReinicio {
  return JUSTIFICATIVOS_REINICIO.some((justificativo) => justificativo.id === valor);
}

export function rotuloJustificativo(id: IdJustificativoReinicio): string {
  return JUSTIFICATIVOS_REINICIO.find((justificativo) => justificativo.id === id)?.rotulo ?? id;
}

export const PASO_EVIDENCIA_REINICIO_ADMIN = "ADMIN_REINICIO_EXPEDIENTE";
export const PASO_EVIDENCIA_ORIGEN_REINICIO = "ADMIN_EXPEDIENTE_CREADO_POR_REINICIO";

/**
 * Búsqueda de sucesores. Es lo que hace exacta la verificación de "este
 * expediente ya fue reiniciado": pregunta por el enlace `expedienteAnteriorId`
 * directamente, sin depender de que el expediente tenga cédula cargada.
 */
export interface LectorSucesores {
  buscarSucesores(expedienteId: string): Promise<readonly Expediente[]>;
}

export interface DependenciasConsola {
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  /** Obligatoria: sin esto no se puede impedir un segundo reinicio. */
  readonly sucesores: LectorSucesores;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

export interface EntradaReinicio {
  /** Expediente terminal que se quiere superar. Nunca se modifica. */
  readonly expedienteId: string;
  readonly justificativo: unknown;
  /** Obligatorio si el justificativo es `OTRO`. */
  readonly detalleLibre?: unknown;
  readonly contexto: ContextoPeticion;
}

export type MotivoRechazoReinicio =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_NO_REINICIABLE"
  | "YA_REINICIADO"
  | "JUSTIFICATIVO_INVALIDO"
  | "DETALLE_REQUERIDO";

export type ResultadoReinicio =
  | {
      readonly ok: true;
      readonly expedienteAnteriorId: string;
      readonly expedienteNuevoId: string;
      readonly justificativo: IdJustificativoReinicio;
      readonly creadoEn: string;
    }
  | { readonly ok: false; readonly motivo: MotivoRechazoReinicio };

const LARGO_MAXIMO_DETALLE = 500;

/**
 * Crea un expediente nuevo enlazado al terminal, con justificativo obligatorio.
 *
 * **Lo que NO hace, y no puede hacer:** transicionar, editar o borrar el
 * expediente original. No hay ninguna llamada a `transicionarExpediente` ni a
 * `expedientes.guardar` sobre el viejo en toda esta función — solo un `crear`
 * del nuevo y dos escrituras de evidencia. El viejo queda en la base
 * exactamente como estaba (regla inviolable #5).
 *
 * El bloqueo por cédula se levanta como consecuencia, no como acción: al
 * existir un expediente que declara `expedienteAnteriorId`, el viejo pasa a
 * estar superado y `expedientesQueBloquean` deja de contarlo.
 */
export async function reiniciarExpediente(
  deps: DependenciasConsola,
  entrada: EntradaReinicio,
): Promise<ResultadoReinicio> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const nuevoId = deps.nuevoId ?? (() => randomUUID());
  const fecha = ahora();

  if (!esIdJustificativo(entrada.justificativo)) {
    return { ok: false, motivo: "JUSTIFICATIVO_INVALIDO" };
  }
  const justificativo: IdJustificativoReinicio = entrada.justificativo;

  const detalleLibre =
    typeof entrada.detalleLibre === "string"
      ? entrada.detalleLibre.trim().slice(0, LARGO_MAXIMO_DETALLE)
      : "";
  if (justificativo === "OTRO" && detalleLibre === "") {
    return { ok: false, motivo: "DETALLE_REQUERIDO" };
  }

  const original = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!original) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };
  if (!estadoBloqueaRegistro(original.estado)) {
    // Un expediente en curso no se "reinicia" desde la consola: o sigue su
    // camino, o llega a un estado terminal sin póliza y recién ahí aplica.
    return { ok: false, motivo: "ESTADO_NO_REINICIABLE" };
  }

  // Evita crear dos sucesores del mismo expediente: el segundo no levantaría
  // ningún bloqueo (ya estaba levantado) y dejaría dos cadenas paralelas para
  // la misma persona.
  const sucesores = await deps.sucesores.buscarSucesores(original.id);
  if (sucesores.length > 0) return { ok: false, motivo: "YA_REINICIADO" };

  const expedienteNuevo = crearExpedienteInicial({
    id: nuevoId(),
    ahora: fecha,
    expedienteAnteriorId: original.id,
  });
  await deps.expedientes.crear(expedienteNuevo);

  const detalle = [
    `justificativo=${justificativo}`,
    `expedienteNuevo=${expedienteNuevo.id}`,
    `estadoOriginal=${original.estado}`,
    ...(original.numeroCasoDerivacion ? [`numeroCaso=${original.numeroCasoDerivacion}`] : []),
    ...(detalleLibre ? [`detalle=${detalleLibre}`] : []),
  ].join(" · ");

  const base = {
    fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado: "EXITOSO" as const,
  };

  // Evidencia en el expediente VIEJO: es donde tiene que quedar el rastro de
  // que alguien lo superó, y es append-only — no reemplaza nada de lo anterior.
  const enOriginal: RegistroEvidencia = {
    ...base,
    id: nuevoId(),
    expedienteId: original.id,
    paso: PASO_EVIDENCIA_REINICIO_ADMIN,
    detalle,
  };
  await deps.evidencias.guardar(enOriginal);

  // Y en el nuevo, para que su historia empiece diciendo de dónde viene.
  const enNuevo: RegistroEvidencia = {
    ...base,
    id: nuevoId(),
    expedienteId: expedienteNuevo.id,
    paso: PASO_EVIDENCIA_ORIGEN_REINICIO,
    detalle: `justificativo=${justificativo} · expedienteAnterior=${original.id}`,
  };
  await deps.evidencias.guardar(enNuevo);

  return {
    ok: true,
    expedienteAnteriorId: original.id,
    expedienteNuevoId: expedienteNuevo.id,
    justificativo,
    creadoEn: fecha,
  };
}
