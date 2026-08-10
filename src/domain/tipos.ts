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

/**
 * Los tres medios de pago de P7.
 *
 * **La preautorización aplica únicamente a tarjeta de crédito.** Lo confirmó
 * Bancard para este proyecto, y es coherente con lo que documenta
 * `docs/Integraciones/Preaut y promociones 14.pdf`: en la preautorización con
 * tarjeta de débito *"al enviar la misma ya se realiza el movimiento de
 * dinero, es decir, se acredita el monto preautorizado en la cuenta del
 * comercio"*, mientras que con crédito *"dicho monto se congela en la cuenta
 * del cliente… el comercio aun no recibe el dinero"*.
 *
 * **Divergencia declarada de `docs/ESPECIFICACION_PANTALLAS.md`:** el
 * documento agrupa `TARJETA DE CRÉDITO O DÉBITO` en una sola opción de
 * preautorización. Acá el débito se modela aparte, junto al QR, y va por
 * **compra simple de vPOS**
 * (`docs/Integraciones/eCommerce_bancard_compra_simple_version_1.23.1 (1).pdf`).
 * Presentarlo como "se reserva el importe; todavía no se cobra" sería
 * describirle a la persona algo distinto de lo que efectivamente pasa con su
 * plata (fila 25 de `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` —
 * "R3 - INTEGRACIÓN DE PAGO CON BANCARD", Ley 4868/13, art. 7(l); Ley 1334/98,
 * art. 15(a); Res. BCP 25/21, arts. 5-6).
 *
 * Consecuencia para el código: `PaymentProvider.iniciarPreautorizacionTarjeta`
 * y `capturarPreautorizacion` **solo** se usan con `TARJETA_CREDITO`. No hay
 * ninguna rama de `pago-p7.ts` que llegue a la preautorización con otro medio,
 * y el adaptador rechaza una captura sobre cualquier operación que no sea de
 * crédito.
 */
export type MedioDePago = "QR_BANCARD" | "TARJETA_DEBITO" | "TARJETA_CREDITO";

export const MEDIOS_DE_PAGO: readonly MedioDePago[] = [
  "QR_BANCARD",
  "TARJETA_DEBITO",
  "TARJETA_CREDITO",
];

export function esMedioDePago(valor: unknown): valor is MedioDePago {
  return MEDIOS_DE_PAGO.some((medio) => medio === valor);
}

/**
 * `true` si el dinero sale de la cuenta de la persona **antes** de la firma
 * (QR y débito) y por lo tanto una firma que no llega obliga a devolver el
 * premio; `false` para crédito, donde el importe queda reservado y lo único
 * que hay que hacer es liberar la reserva.
 *
 * Es la distinción que separa las dos secuencias del bloque `DESPUÉS DE ESTA
 * PANTALLA` de P7 y las dos consecuencias del vencimiento (fila 30 de la
 * matriz: *"Devolver el premio si el cliente no firma dentro del plazo
 * comunicado"*, Ley 4868/13, arts. 7(f), 17 y 30(b)).
 */
export function esPagoDefinitivoAntesDeFirma(medio: MedioDePago): boolean {
  return medio === "QR_BANCARD" || medio === "TARJETA_DEBITO";
}

export type EstadoPago =
  | "PENDIENTE"
  | "CONFIRMADO" // QR pagado o débito cobrado: definitivo, antes de la firma
  | "PREAUTORIZADO" // crédito: importe reservado, no cobrado
  | "CAPTURADO" // crédito: cobro ordenado por la firma del cliente
  | "CANCELADO";

/**
 * Estados en los que la garantía de pago de P7 ya está lista y se puede
 * habilitar la firma: el QR o el débito acreditados, o el crédito reservado.
 * Es lo que P8 muestra como `GARANTÍA DE PAGO LISTA`.
 */
export function garantiaDePagoLista(estado: EstadoPago): boolean {
  return estado === "CONFIRMADO" || estado === "PREAUTORIZADO" || estado === "CAPTURADO";
}

export interface Pago {
  readonly medio: MedioDePago;
  readonly estado: EstadoPago;
  readonly montoGs: number;
  readonly referenciaBancard: string | null;
  /**
   * Clave del intento de pago, generada por el dominio y reutilizada en cada
   * reintento del mismo intento (doble click, timeout del cliente, retry de
   * red). Es lo que impide un cobro duplicado — fila 32 de la matriz:
   * *"Implementar idempotencia para impedir cobros o eventos duplicados"*,
   * Ley 6822/21, art. 68(1); Res. BCP 25/21, art. 8.
   *
   * Se persiste porque cada Route Handler es un proceso nuevo: sin guardarla,
   * un reintento después de un timeout generaría una clave distinta y, con
   * ella, un cobro nuevo.
   */
  readonly idempotencyKey: string;
  readonly iniciadoEn: string;
  readonly confirmadoEn: string | null;
}

/**
 * Checkbox obligatorio del bloque 1 de P7: *"Declaro que los fondos utilizados
 * para pagar el premio son de mi propiedad y tienen origen lícito."*
 *
 * Se modela como consentimiento versionado —igual que `AutorizacionInicial`—
 * y no como un booleano: es un dato de origen de fondos que integra el FIPF
 * (fila 16 de la matriz — "R2 - CONSENTIMIENTO, IDENTIFICACIÓN Y REPUDIO",
 * *"Generar el FIPF con datos personales, laborales, económicos y origen de
 * fondos"*, Res. SEPRELAD 71/19, art. 26(1)(a-j)), así que tiene que quedar
 * probado qué texto exacto tuvo a la vista la persona y cuándo lo aceptó.
 */
export interface DeclaracionOrigenLicito {
  readonly aceptadaEn: string; // ISO 8601
  readonly ip: string;
  readonly dispositivo: string;
  readonly sesionId: string;
  readonly versionTexto: string;
  /** Literal íntegro que la persona tuvo a la vista al marcar el checkbox. */
  readonly textoAceptado: string;
}

/**
 * Bloque 1 de P7 — `Datos para la factura`. La factura es **siempre a nombre
 * del asegurado**: `nombreAFacturar` se deriva de `Identidad` (OCR de la
 * cédula), no de un campo que la persona pueda escribir.
 */
export interface DatosFacturacionP7 {
  readonly nombreAFacturar: string;
  /** Manual y opcional. Si queda vacío, a Alianza se le envían nombre y cédula. */
  readonly ruc: string | null;
  readonly declaracionOrigenLicito: DeclaracionOrigenLicito;
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
  /**
   * Número de caso de revisión manual, generado al derivar en P6.
   *
   * **Correlativo propio, distinto del de la propuesta** (P6, `REGLA AUTOMÁTICA
   * DE ELEGIBILIDAD`, y Pantalla A: *"El número de caso de revisión es distinto
   * del correlativo de una propuesta o póliza"*). Un expediente derivado nunca
   * llega a tener `PROP-`/`FIPF-`: no hay paquete documental porque no hay
   * pago ni firma posibles desde DERIVADO_MANUAL.
   */
  readonly numeroCasoDerivacion: string | null;
  /**
   * Correlativo de la propuesta / futura póliza (`00018425` en la
   * especificación), acuñado en P7 porque es la primera pantalla que lo
   * muestra (bloque `REFERENCIAS DE LA OPERACIÓN`).
   *
   * **Un solo correlativo para los dos documentos**: P8 lo prefija como
   * `PROP-` para la Solicitud y `FIPF-` para el FIPF (CLAUDE.md → "Reglas
   * transversales de integraciones": *"Solicitud y FIPF: mismo correlativo,
   * prefijos distintos"*). Es distinto de `numeroCasoDerivacion`, que vive en
   * su propio espacio de numeración y nunca coexiste con este.
   */
  readonly numeroPropuesta: string | null;
  readonly facturacion: DatosFacturacionP7 | null;
  readonly pago: Pago | null;
  /**
   * Vencimiento del plazo para firmar, calculado al confirmarse la garantía de
   * pago en P7 (`PLAZO PARA FIRMAR: 24 HORAS`). Pasada esa hora sin firma el
   * expediente va a VENCIDO y de ahí a Pantalla B.
   *
   * La consecuencia depende del medio (`esPagoDefinitivoAntesDeFirma`): con QR
   * o débito hay que devolver el premio; con crédito alcanza con liberar la
   * reserva, porque no se cobró nada.
   */
  readonly plazoFirmaVenceEn: string | null;
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
    numeroCasoDerivacion: null,
    numeroPropuesta: null,
    facturacion: null,
    pago: null,
    plazoFirmaVenceEn: null,
    paqueteDocumental: null,
    firma: null,
    expedienteAnteriorId: input.expedienteAnteriorId ?? null,
    creadoEn: input.ahora,
    actualizadoEn: input.ahora,
  };
}
