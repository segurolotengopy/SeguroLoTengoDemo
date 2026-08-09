/**
 * Tipos del dominio de SeguroLoTengo: el Expediente y sus sub-objetos.
 *
 * Fuente de verdad de campos, valores y reglas: docs/ESPECIFICACION_PANTALLAS.md
 * y las "Reglas de negocio inviolables" de CLAUDE.md. No se modela ningún
 * campo, paso o valor que no esté en esos documentos.
 */

// ---------------------------------------------------------------------------
// Máquina de estados
// ---------------------------------------------------------------------------

export type EstadoExpediente =
  | "INICIADO"
  | "CANAL_WA_VERIFICADO"
  | "PLAN_SELECCIONADO"
  | "AUTORIZADO"
  | "CANAL_EMAIL_VERIFICADO"
  | "IDENTIDAD_VERIFICADA"
  | "DERIVADO_MANUAL"
  | "DECLARACIONES_OK"
  | "PAGO_CONFIRMADO"
  | "PAQUETE_GENERADO"
  | "VENCIDO"
  | "DEVOLUCION_EN_TRAMITE"
  | "FIRMADO"
  | "EMITIDO";

/**
 * Estados sin ninguna transición legal hacia adelante. DERIVADO_MANUAL es
 * terminal en el flujo digital por regla de negocio #5 (no hay pago, firma
 * ni emisión posible desde ahí); DEVOLUCION_EN_TRAMITE y EMITIDO son el fin
 * natural de sus respectivas ramas del diagrama de CLAUDE.md.
 */
export const ESTADOS_TERMINALES: readonly EstadoExpediente[] = [
  "DERIVADO_MANUAL",
  "DEVOLUCION_EN_TRAMITE",
  "EMITIDO",
];

export interface EntradaHistorialEstado {
  readonly estado: EstadoExpediente;
  readonly en: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Canal verificado (P1 WhatsApp / P4 correo), plan (P2) y autorización (P3)
// ---------------------------------------------------------------------------

export interface CanalVerificado {
  readonly valor: string; // número o correo, ya verificado
  readonly verificadoEn: string;
}

export type PlanId = "CONFIO" | "CONFIO_PLUS" | "CONFIO_TOTAL";

export interface PlanSeleccionado {
  readonly planId: PlanId;
  readonly premioAnualGs: number;
  readonly idVersionOferta: string;
  readonly hashOfertaSha256: string;
  readonly seleccionadoEn: string;
}

/**
 * Consentimiento inicial de P3 (botón `TENGO TODO LISTO`).
 *
 * Respaldo normativo: fila 11 de `docs/Tabla Cumplimiento SeguroLo Tengo -
 * Tabla.csv` — categoría "R2 - CONSENTIMIENTO, IDENTIFICACIÓN Y REPUDIO",
 * "Obtener consentimiento inicial para la contratación y el tratamiento de
 * datos", Ley 4868/13, arts. 6(c) y 7(r); Constitución Nacional, arts. 33 y 36.
 *
 * Guarda el **texto completo** además de la versión: si el repositorio de
 * código se pierde o alguien edita el literal sin subir la versión, el
 * expediente sigue conteniendo, palabra por palabra, lo que la persona
 * aceptó. La versión sola sería un puntero a algo que puede cambiar.
 *
 * Se escribe una sola vez: la transición PLAN_SELECCIONADO → AUTORIZADO no
 * tiene autobucle, así que no hay forma de pisar este objeto sin agregar una
 * transición nueva a `expediente.ts`.
 */
export interface AutorizacionInicial {
  readonly aceptadaEn: string; // ISO 8601: fecha y hora
  readonly ip: string;
  readonly dispositivo: string;
  readonly sesionId: string;
  readonly versionAviso: string;
  /** Literal íntegro que la persona tuvo a la vista al presionar el botón. */
  readonly textoAceptado: string;
}

// ---------------------------------------------------------------------------
// Identidad (P5)
// ---------------------------------------------------------------------------

export interface CapturaBiometrica {
  readonly hashFrenteCedula: string;
  readonly hashDorsoCedula: string;
  readonly hashSelfie: string;
  readonly pruebaDeVidaAprobada: boolean;
  readonly coincidenciaFacialAprobada: boolean;
}

export interface Identidad {
  readonly numeroCedula: string;
  readonly nombres: string;
  readonly apellidos: string;
  /**
   * Extraída por OCR de la cédula (bloqueada, no editable en P5). Es la
   * única fuente válida para calcular la edad — regla de negocio #8: la
   * edad se verifica contra este campo, nunca contra uno declarado.
   */
  readonly fechaNacimiento: string; // ISO 8601 (YYYY-MM-DD)
  readonly sexo: string;
  readonly nacionalidad: string;
  readonly paisNacimiento: string;
  readonly estadoCivil: string;
  readonly captura: CapturaBiometrica;
}

export const EDAD_MINIMA_PERMITIDA = 18;
export const EDAD_MAXIMA_PERMITIDA = 64;

/** Edad exacta a la fecha de referencia (hoy, por defecto), en años cumplidos. */
export function calcularEdadDesde(fechaNacimientoIso: string, fechaReferencia: Date = new Date()): number {
  const nacimiento = new Date(fechaNacimientoIso);
  let edad = fechaReferencia.getFullYear() - nacimiento.getFullYear();
  const aunNoCumplioEsteAnio =
    fechaReferencia.getMonth() < nacimiento.getMonth() ||
    (fechaReferencia.getMonth() === nacimiento.getMonth() && fechaReferencia.getDate() < nacimiento.getDate());
  if (aunNoCumplioEsteAnio) edad -= 1;
  return edad;
}

/** Regla de negocio #8: edad permitida 18-64 años, verificada contra la cédula. */
export function edadEnRangoPermitido(fechaNacimientoIso: string, fechaReferencia: Date = new Date()): boolean {
  const edad = calcularEdadDesde(fechaNacimientoIso, fechaReferencia);
  return edad >= EDAD_MINIMA_PERMITIDA && edad <= EDAD_MAXIMA_PERMITIDA;
}

// ---------------------------------------------------------------------------
// Declaraciones (P6, bloque 2) — insumo del motor de elegibilidad
// ---------------------------------------------------------------------------

export type RespuestaDeclaracion = "SI" | "NO";

export interface Declaraciones {
  readonly estadoDeSalud: RespuestaDeclaracion; // #1 — habilita SI
  readonly antecedentesDeContratacion: RespuestaDeclaracion; // #2 — habilita NO
  readonly enfermedadesDiagnosticadas: RespuestaDeclaracion; // #3 — habilita NO
  readonly vigenciaYCarencias: RespuestaDeclaracion; // #4 — habilita SI
  readonly veracidad: RespuestaDeclaracion; // #5 — habilita SI
  readonly entregaDigital: RespuestaDeclaracion; // #6 — habilita SI
  readonly corredorDeLaPoliza: RespuestaDeclaracion; // #7 — habilita SI
  readonly condicionPep: RespuestaDeclaracion; // #8 — habilita NO
}

export type BeneficiarioTipo = "HEREDEROS_LEGALES" | "PERSONA_DESIGNADA";

export interface Beneficiario {
  readonly tipo: BeneficiarioTipo;
  readonly nombreCompleto: string | null; // requerido solo si PERSONA_DESIGNADA
  readonly parentesco: string | null;
  readonly domicilio: string | null;
}

export interface DatosComplementariosP6 {
  readonly domicilio: string;
  readonly ciudad: string;
  readonly situacionLaboral: string;
  readonly actividad: string;
  readonly profesion: string;
  readonly empresa: string | null;
  readonly ingresoMensualDeclaradoGs: number;
  readonly beneficiario: Beneficiario;
}

// ---------------------------------------------------------------------------
// Pago (P7)
// ---------------------------------------------------------------------------

export type MedioDePago = "QR_BANCARD" | "TARJETA";

export type EstadoPago =
  | "PENDIENTE"
  | "CONFIRMADO" // QR pagado: definitivo, antes de la firma
  | "PREAUTORIZADO" // tarjeta: importe reservado, no cobrado
  | "CAPTURADO" // tarjeta: cobro ordenado por la firma del cliente
  | "CANCELADO";

export interface Pago {
  readonly medio: MedioDePago;
  readonly estado: EstadoPago;
  readonly montoGs: number;
  readonly referenciaBancard: string | null;
  readonly confirmadoEn: string | null;
}

// ---------------------------------------------------------------------------
// Paquete documental (Solicitud + FIPF) y firma — reglas #3 y #4
// ---------------------------------------------------------------------------

export interface DocumentoCerrado {
  readonly codigo: string; // p.ej. PROP-00018425
  readonly version: number;
  /** Regla #4: se calcula al cerrar el PDF, antes de habilitar la firma. */
  readonly hashSha256: string;
  readonly cerradoEn: string;
}

export interface PaqueteDocumental {
  readonly solicitud: DocumentoCerrado;
  readonly fipf: DocumentoCerrado;
}

export type CanalFirma = "WHATSAPP" | "EMAIL";

/**
 * Regla #3 (atómica de firma): este tipo solo puede existir si AMBOS
 * documentos quedaron firmados en el mismo acto. No hay forma de
 * representar "uno firmado, el otro no" — no hay campos opcionales.
 */
export interface Firma {
  readonly canal: CanalFirma;
  readonly idCode100: string;
  readonly firmadoEn: string;
  readonly hashSolicitudFirmada: string;
  readonly hashFipfFirmado: string;
}

// ---------------------------------------------------------------------------
// Evidencia (regla #10 — append-only)
// ---------------------------------------------------------------------------

export interface RegistroEvidencia {
  readonly id: string;
  readonly expedienteId: string;
  readonly paso: string; // p.ej. "P1_OTP_WHATSAPP", "P6_DECLARACIONES", "P8_FIRMA"
  readonly fecha: string; // ISO 8601
  readonly ip: string;
  readonly dispositivo: string;
  readonly sesionId: string;
  readonly versionTextoAceptado: string | null;
  /**
   * Literal íntegro aceptado en el paso, cuando el paso implica aceptar algo
   * (P3 y, más adelante, P8). `null` en los pasos que no piden aceptación:
   * ahí `versionTextoAceptado` alcanza porque no hay nada que la persona
   * haya consentido con este registro.
   *
   * Nunca se guarda acá un dato de salud, PEP, cédula ni tarjeta: es texto
   * institucional, el mismo para todo el mundo (regla inviolable #7).
   */
  readonly textoAceptado: string | null;
  readonly resultado: "EXITOSO" | "FALLIDO";
  readonly detalle: string | null;
}

// ---------------------------------------------------------------------------
// Expediente
// ---------------------------------------------------------------------------

export interface Expediente {
  readonly id: string;
  readonly estado: EstadoExpediente;
  /** Append-only: cada transición agrega una entrada, ninguna se borra ni se sobrescribe. */
  readonly historial: readonly EntradaHistorialEstado[];

  readonly canalWhatsapp: CanalVerificado | null;
  readonly plan: PlanSeleccionado | null;
  readonly autorizacionInicial: AutorizacionInicial | null;
  readonly canalEmail: CanalVerificado | null;
  readonly identidad: Identidad | null;
  readonly datosComplementarios: DatosComplementariosP6 | null;
  readonly declaraciones: Declaraciones | null;
  /** Números de declaración (subconjunto de 1, 2, 3, 8) que causaron DERIVADO_MANUAL. */
  readonly motivoDerivacionManual: readonly number[] | null;
  readonly pago: Pago | null;
  readonly paqueteDocumental: PaqueteDocumental | null;
  readonly firma: Firma | null;

  /** Consola administrativa: reinicio que crea un expediente nuevo enlazado al anterior. */
  readonly expedienteAnteriorId: string | null;

  readonly creadoEn: string;
  readonly actualizadoEn: string;
}

export function crearExpedienteInicial(input: {
  id: string;
  ahora: string;
  expedienteAnteriorId?: string;
}): Expediente {
  return {
    id: input.id,
    estado: "INICIADO",
    historial: [{ estado: "INICIADO", en: input.ahora }],
    canalWhatsapp: null,
    plan: null,
    autorizacionInicial: null,
    canalEmail: null,
    identidad: null,
    datosComplementarios: null,
    declaraciones: null,
    motivoDerivacionManual: null,
    pago: null,
    paqueteDocumental: null,
    firma: null,
    expedienteAnteriorId: input.expedienteAnteriorId ?? null,
    creadoEn: input.ahora,
    actualizadoEn: input.ahora,
  };
}
