/**
 * Tipos del dominio de SeguroLoTengo: el Expediente y sus sub-objetos.
 *
 * Fuente de verdad de campos, valores y reglas: docs/ESPECIFICACION_PANTALLAS.md
 * y las "Reglas de negocio inviolables" de CLAUDE.md. No se modela ningún
 * campo, paso o valor que no esté en esos documentos.
 */
import type { ModalidadFirma, NivelFirma, RolFirmante } from "./firmantes-documento";


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
  /**
   * P5 no pudo verificar la identidad después de varios intentos y el caso
   * pasa a asistencia humana.
   *
   * **Es un estado distinto de `DERIVADO_MANUAL` a propósito**, aunque los dos
   * terminen en atención humana. Tres razones:
   *
   * 1. `DERIVADO_MANUAL` significa "la elegibilidad se detuvo por salud o PEP"
   *    (regla inviolable #5) y su pantalla lo dice: el hito 2 es
   *    `Declaraciones recibidas ✓`. Quien falla en P5 nunca llegó a declarar
   *    nada — reusar ese estado haría que la pantalla afirmara algo falso.
   * 2. `DERIVADO_MANUAL` **bloquea la cédula** para un registro nuevo (regla
   *    inviolable #11). Bloquear a alguien porque la cámara del teléfono no
   *    daba sería desproporcionado: no hay ningún indicio en su contra.
   *    `ASISTENCIA_IDENTIDAD` no está en esa lista, y hay un test que lo fija.
   * 3. La consola necesita distinguir las dos colas: una es análisis de riesgo
   *    de Alianza, la otra es soporte de captura.
   */
  | "ASISTENCIA_IDENTIDAD"
  | "DECLARACIONES_OK"
  | "PAQUETE_GENERADO"
  /**
   * El cliente firmó y faltan las firmas institucionales (D-13).
   *
   * Existe como estado propio y no como un campo del expediente porque un
   * fallo a mitad del sellado tiene que ser distinguible de un expediente sin
   * firmar: la regla inviolable #3 exige que Solicitud y FIPF entren juntos o
   * no entre ninguno, y para hacerla cumplir hay que poder nombrar el momento
   * en que la firma del cliente ya existe y el acto todavía no cerró.
   */
  | "FIRMADO_CLIENTE"
  | "PAGO_CONFIRMADO"
  | "VENCIDO"
  | "DEVOLUCION_EN_TRAMITE"
  | "DEVUELTO"
  | "FIRMADO"
  | "EMITIDO";

/**
 * Estados sin ninguna transición legal hacia adelante. DERIVADO_MANUAL es
 * terminal en el flujo digital por regla de negocio #5 (no hay pago, firma
 * ni emisión posible desde ahí); DEVUELTO y EMITIDO son el fin natural de sus
 * respectivas ramas del diagrama de CLAUDE.md.
 *
 * DEVOLUCION_EN_TRAMITE **dejó de ser terminal**: la Pantalla B lo describe
 * como un trámite en curso y su pie declara el estado final del expediente
 * como `VENCIDO · DEVOLUCIÓN EN TRÁMITE / DEVUELTO`. Que el trámite termine
 * —Alianza devolvió el premio al medio de origen— es un hecho que hay que
 * poder asentar, y para eso hace falta un estado al que llegar. Sigue sin
 * haber ningún camino de vuelta al flujo digital: DEVUELTO tampoco tiene
 * salida, y ninguno de los dos llega nunca a póliza.
 */
/**
 * Todos los estados del expediente, en orden de recorrido.
 *
 * **La exhaustividad la garantiza el compilador**, no la disciplina: el
 * `Record<EstadoExpediente, true>` de abajo no compila si falta uno. Existe
 * porque agregar un estado y olvidar actualizar una lista suelta es un error
 * silencioso — pasó al agregar `ASISTENCIA_IDENTIDAD`, que quedó fuera del
 * selector de la consola y por lo tanto invisible para el staff.
 */
const TODOS_LOS_ESTADOS: Readonly<Record<EstadoExpediente, true>> = {
  INICIADO: true,
  PLAN_SELECCIONADO: true,
  CANAL_WA_VERIFICADO: true,
  AUTORIZADO: true,
  CANAL_EMAIL_VERIFICADO: true,
  IDENTIDAD_VERIFICADA: true,
  ASISTENCIA_IDENTIDAD: true,
  DERIVADO_MANUAL: true,
  DECLARACIONES_OK: true,
  PAQUETE_GENERADO: true,
  FIRMADO_CLIENTE: true,
  FIRMADO: true,
  VENCIDO: true,
  PAGO_CONFIRMADO: true,
  EMITIDO: true,
  DEVOLUCION_EN_TRAMITE: true,
  DEVUELTO: true,
};

export const ESTADOS_EXPEDIENTE: readonly EstadoExpediente[] = Object.keys(
  TODOS_LOS_ESTADOS,
) as EstadoExpediente[];

export function esEstadoExpediente(valor: unknown): valor is EstadoExpediente {
  return typeof valor === "string" && valor in TODOS_LOS_ESTADOS;
}

export const ESTADOS_TERMINALES: readonly EstadoExpediente[] = [
  "DERIVADO_MANUAL",
  "ASISTENCIA_IDENTIDAD",
  "DEVUELTO",
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
  readonly valor: string; // número o correo
  readonly verificadoEn: string;
  /**
   * Cómo quedó establecido el canal.
   *
   * `OTP` es el celular, y era también el correo hasta que se retiró su código
   * (D-06). `DOBLE_TIPEO` es el correo desde entonces: la persona lo escribe
   * dos veces y lo declara al firmar, que es el respaldo que reemplaza al
   * código.
   *
   * Opcional porque los expedientes anteriores no lo traen y **no se los
   * reescribe** (regla inviolable #10): ausente significa `OTP`, que es lo que
   * eran todos.
   */
  readonly origen?: "OTP" | "DOBLE_TIPEO";
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
  /**
   * País de residencia. Campo del bloque 1 del FIPF, distinto de la
   * nacionalidad y del país de nacimiento: una cédula paraguaya puede ser de
   * alguien con nacionalidad boliviana que reside en Paraguay, y los tres
   * datos se piden por separado. Lo declara la persona; no sale del documento.
   */
  readonly paisResidencia: string;
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
  /**
   * Cédula del beneficiario designado (CHG-24). **Opcional y no bloqueante.**
   *
   * La Res. SIS 215/2025 (num. 11.4) exige nombre y domicilio cuando se designa
   * expresamente a alguien; la cédula no la pide nadie. Se ofrece porque
   * facilita el cobro el día del siniestro, y se deja vacía sin consecuencia
   * porque quien contrata no siempre tiene a mano el documento de un tercero
   * —y frenarlo ahí sería exigirle más que la norma (CMP-21)—.
   *
   * Si el área de cumplimiento de Alianza llegara a exigirla en algún caso,
   * eso sería una regla de riesgo documentada y no un requisito legal general.
   */
  readonly numeroCedula: string | null;
}

/**
 * Bloque 2 del FIPF: datos laborales, económicos y fiscales.
 *
 * **Se capturan en el paso 4, junto a la identidad**, desde la reformulación
 * de pantallas (maqueta p.4, aprobada el 20-ago-2026). El nombre conserva el
 * sufijo `P6` porque el modelo no cambió de forma —solo cambió qué pantalla lo
 * envía—, y renombrarlo obligaría a tocar la evidencia ya guardada.
 *
 * **El beneficiario no está acá**, y no es un olvido: se declara en el paso 5
 * y vive en `Expediente.beneficiario`. Compartir un solo campo obligaría a que
 * el paso 4 lo escribiera vacío y el paso 5 lo completara por encima, que es
 * justo la clase de escritura a medias que el resto del modelo evita.
 */
export interface DatosComplementariosP6 {
  readonly domicilio: string;
  readonly ciudad: string;
  readonly situacionLaboral: string;
  readonly actividad: string;
  readonly profesion: string;
  readonly empresa: string | null;
  readonly ingresoMensualDeclaradoGs: number;
  /**
   * Origen principal de los fondos con los que se paga el premio. Campo del
   * FIPF (Res. SEPRELAD 71/19) que hasta la maqueta del paso 4 no existía en
   * el modelo. Su lista de opciones vive en `catalogo-p6.ts` y está **rotulada
   * como propuesta** hasta que cumplimiento de Alianza la cierre.
   */
  readonly origenFondos: string;
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
 * Estados de un pago.
 *
 * **Sin preautorización** (D-02). Los tres medios cobran directo: el importe
 * sale de la cuenta cuando la operación se confirma, y no hay reserva que
 * capturar después. Los estados `PREAUTORIZADO` y `CAPTURADO` desaparecieron
 * con ella.
 *
 * La preautorización tenía sentido cuando se cobraba antes de firmar: reservar
 * en lugar de cobrar evitaba tener que devolver si la firma no llegaba. Con la
 * firma primero (D-08) el problema no existe — cuando se cobra, el contrato ya
 * está firmado— y la reserva solo agregaba un estado intermedio y una
 * operación de captura que podían fallar por su cuenta.
 *
 * `DEVUELTO` es el final del flujo de seguimiento de devoluciones que pidió
 * D-02: la devolución la ejecuta Bancard o Alianza fuera del portal, y el
 * expediente la asienta.
 */
export type EstadoPago =
  | "PENDIENTE"
  | "CONFIRMADO" // el importe entró
  | "CANCELADO"
  | "DEVUELTO";

/**
 * `true` cuando el pago está confirmado y por lo tanto el expediente puede
 * avanzar a la emisión.
 *
 * Reemplaza a `garantiaDePagoLista`, que distinguía entre dinero acreditado y
 * dinero reservado. Sin preautorización esa distinción no existe: o entró o no
 * entró.
 */
export function pagoAcreditado(estado: EstadoPago): boolean {
  return estado === "CONFIRMADO";
}

/**
 * `true` cuando el dinero **efectivamente entró**, no solo cuando quedó
 * garantizado. Es la condición para pedirle a Alianza que emita.
 *
 * La diferencia con `garantiaDePagoLista` es exactamente el crédito: una
 * preautorización habilita la firma (P8) pero **no** la emisión, porque el
 * importe todavía está reservado y no cobrado. La captura la ordena la firma
 * del cliente; si esa captura no se completa, no hay cobro y por lo tanto no
 * hay emisión que pedir — fila 44 de `docs/Tabla Cumplimiento SeguroLo Tengo -
 * Tabla.csv`: *"Si falla el cobro, no solicitar la emisión automática"*
 * (Código Civil, art. 1373; Ley 4868/13, arts. 7(e) y 7(p)), y el orden de la
 * fila 43 (firma → cobro → envío a Alianza → validación → emisión).
 *
 * Con QR y débito no hay distinción posible: cobraron en P7 o no existe la
 * operación.
 */
export function cobroConfirmadoParaEmision(pago: Pago): boolean {
  return pagoAcreditado(pago.estado);
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
 * Bloque 1 de P7 — `Datos para la factura`. La factura es **siempre a nombre
 * del asegurado**: `nombreAFacturar` se deriva de `Identidad` (OCR de la
 * cédula), no de un campo que la persona pueda escribir.
 */
export interface DatosFacturacionP7 {
  readonly nombreAFacturar: string;
  /** Manual y opcional. Si queda vacío, a Alianza se le envían nombre y cédula. */
  readonly ruc: string | null;
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
  /**
   * Código interno de la sección FIPF, impreso dentro del mismo PDF (D-11).
   *
   * El documento es uno solo y su identidad es `codigo` (`PROP-<correlativo>`),
   * pero las dos secciones conservan su código propio porque son dos
   * formularios con vida normativa distinta: la Solicitud responde a la Res.
   * SS SG. 215/2025 y el FIPF a la Res. SEPRELAD 71/19, y un auditor de
   * cualquiera de los dos tiene que poder citar el suyo. Un solo correlativo,
   * dos códigos internos visibles en sus secciones.
   */
  readonly codigoSeccionFipf: string;
}

/**
 * El paquete documental **es un solo documento** desde D-11.
 *
 * Era `{ solicitud, fipf }`: dos PDF, dos huellas, y una regla —la inviolable
 * #3, *los dos o ninguno*— que había que hacer cumplir con validaciones en
 * cada punto por el que pasaban. Ahora la Solicitud y el FIPF son dos
 * secciones de un mismo archivo con un solo SHA-256, así que **no existe la
 * forma de tener uno sin el otro**: la regla dejó de necesitar quien la
 * vigile y pasó a ser una propiedad de la estructura.
 *
 * El alias se conserva porque el nombre "paquete documental" sigue siendo el
 * que usan la especificación, la matriz y las evidencias ya guardadas.
 */
export type PaqueteDocumental = DocumentoCerrado;

export type CanalFirma = "WHATSAPP" | "EMAIL";

/**
 * Acto de firma abierto en Code100 (P8, botón `ENVIAR ENLACE SEGURO DE FIRMA`).
 *
 * **No es una firma**: es el enlace enviado y esperando. Se persiste porque
 * cada Route Handler es un proceso nuevo y el sondeo de P8 —o el callback del
 * adaptador oficial— tiene que poder encontrar el `session_id` después de una
 * recarga de la pantalla. Mismo criterio que la `idempotencyKey` del `Pago`.
 *
 * Se sobrescribe si la persona pide un enlace nuevo (el anterior quedó
 * rechazado o vencido); la traza append-only de cada envío vive en
 * `EvidenceStore` (regla inviolable #10), que es donde no se pisa nada.
 */
export interface ActoDeFirmaEnCurso {
  readonly idCode100: string;
  readonly canal: CanalFirma;
  /** Canal verificado al que Code100 mandó el enlace, enmascarado. */
  readonly destinoEnmascarado: string;
  readonly enlaceEnviadoEn: string; // ISO 8601
  /** Vigencia del enlace informada por el proveedor (24 horas). */
  readonly venceEn: string; // ISO 8601
}

/**
 * Firma del cliente sobre el paquete documental.
 *
 * **Un solo hash** (D-11): el documento es uno, así que la regla inviolable #3
 * ya no se sostiene con dos campos obligatorios sino con la estructura — no
 * hay dos cosas que puedan separarse. Los dos hashes anteriores
 * (`hashSolicitudFirmada` y `hashFipfFirmado`) desaparecen con los dos
 * archivos que describían.
 */
export interface Firma {
  readonly canal: CanalFirma;
  readonly idCode100: string;
  readonly firmadoEn: string;
  /** Huella del PDF único ya firmado por el cliente. */
  readonly hashDocumentoFirmado: string;
}

/**
 * Una firma institucional aplicada sobre el documento (D-13).
 *
 * Se guarda una por firmante, con su modalidad y su certificado, porque la
 * consola administrativa tiene que poder mostrar **quién firmó qué y cómo** —
 * no alcanza con saber que el expediente está `FIRMADO`. El certificado es
 * simulado mientras Code100 sea un mock, y el campo lo dice para que la
 * evidencia no afirme haber verificado algo que nadie verificó.
 */
export interface FirmaInstitucional {
  readonly rol: RolFirmante;
  readonly nivel: NivelFirma;
  readonly modalidad: ModalidadFirma;
  /** Referencia del certificado con el que se firmó. `DEMO-…` mientras sea simulado. */
  readonly certificado: string;
  readonly aplicadaEn: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Devolución del premio (D-02)
// ---------------------------------------------------------------------------

/** Quién pidió la devolución. Es una categoría, no un nombre. */
export type SolicitanteDevolucion = "TITULAR" | "INTERSEGUROS" | "ALIANZA";

/**
 * Por qué se devuelve. Categorías cerradas y no texto libre: el motivo va a la
 * evidencia y a la consola, y un campo abierto ahí terminaría con datos de
 * salud escritos a mano por alguien que quiso ser claro.
 *
 * `VENCIMIENTO_LEGADO` es el único que no nace de un pedido: son los
 * expedientes que vencieron bajo el orden anterior **con el pago hecho**. Bajo
 * el orden nuevo no puede volver a ocurrir —se firma antes de cobrar— pero
 * esos expedientes existen y no se reescriben (regla inviolable #10).
 */
export type MotivoDevolucion =
  | "PEDIDO_DEL_TITULAR"
  | "ERROR_DE_COBRO"
  | "COBRO_DUPLICADO"
  | "VENCIMIENTO_LEGADO";

/**
 * El trámite de devolución, tal como el expediente lo asienta y lo sigue
 * (D-02).
 *
 * **El expediente no ejecuta la devolución**: la hacen Bancard y Alianza fuera
 * del flujo digital. Lo que vive acá es el seguimiento — quién la pidió, por
 * qué, cuánto, sobre qué cobro, y con qué referencia se acreditó el reintegro.
 *
 * No hay ningún campo de cuenta de destino, y es deliberado: la devolución va
 * al medio de origen y a ningún otro lado (fila 30 de la matriz). No existe
 * dónde escribir un tercero.
 */
export interface DevolucionDelExpediente {
  readonly estado: "EN_TRAMITE" | "ACREDITADA";
  readonly solicitante: SolicitanteDevolucion;
  readonly motivo: MotivoDevolucion;
  readonly solicitadaEn: string; // ISO 8601
  /** Importe y medio congelados al abrir el trámite: son los del cobro que se devuelve. */
  readonly montoGs: number;
  readonly medio: MedioDePago;
  readonly referenciaBancard: string | null;
  readonly acreditadaEn: string | null;
  /** Referencia del reintegro. Es lo que hace auditable el cierre del trámite. */
  readonly referenciaReintegro: string | null;
}

// ---------------------------------------------------------------------------
// Certificado de Cobertura Provisional (D-12)
// ---------------------------------------------------------------------------

/**
 * El Certificado de Cobertura Provisional: el documento que le queda a la
 * persona en la mano mientras Alianza emite la póliza (D-12, CHG-42).
 *
 * **No es la póliza y no la reemplaza.** Es lo que el producto sí puede
 * entregar en el acto: la constancia de que el premio se cobró, de cuándo
 * empieza a correr la cobertura y de qué la respalda. La póliza la emite
 * Alianza por SEBAOT a su ritmo (`PolizaDelExpediente`), y este documento no
 * presume su número: el correlativo que lleva es el de la propuesta, y el
 * número oficial de diez dígitos de la SIS solo existe cuando Alianza lo
 * acuña (CMP-18).
 *
 * **Tampoco es una Nota de Cobertura**, que el producto sigue sin contemplar:
 * la Nota de Cobertura es un instrumento de cobertura inmediata que compromete
 * a la aseguradora antes de la emisión, y acá no hay nada de eso — hay un
 * cobro acreditado, una fecha de inicio calculada y una firma de Alianza sobre
 * lo que ya ocurrió.
 *
 * **Solo existe con el pago confirmado**, y no por convención: se emite dentro
 * de la misma escritura que lleva el expediente a `PAGO_CONFIRMADO`
 * (`registrarPagoConfirmadoP7`). No hay camino por el que un expediente tenga
 * certificado sin cobro, ni cobro sin certificado — que es la atomicidad que
 * pide CMP-07.
 *
 * Los expedientes que llegaron a `PAGO_CONFIRMADO` **antes** de D-12 traen
 * este campo en `null` y no se reescriben (regla inviolable #10): quien los
 * lea tiene que contemplar la ausencia, no completarla.
 */
export interface CertificadoCobertura {
  /** Identidad del documento: `CPC-<correlativo>`. */
  readonly codigo: string;
  /** Documento del que cuelga: `PROP-<correlativo>`, el paquete firmado. */
  readonly codigoPaquete: string;
  readonly version: number;
  /** Regla #4: huella del PDF cerrado, calculada sobre los bytes definitivos. */
  readonly hashSha256: string;
  readonly emitidoEn: string; // ISO 8601
  /**
   * Inicio de la cobertura: **el instante del pago acreditado más 24 horas
   * exactas** (CHG-41). Se persiste calculado y no se recalcula al leerlo: es
   * un dato del contrato, no una función del reloj de quien lo consulta.
   */
  readonly inicioCobertura: string; // ISO 8601
  /** Fin de la vigencia anual contratada, un año después del inicio. */
  readonly finCobertura: string; // ISO 8601
  /** Referencia de la operación de Bancard que respalda la cobertura. */
  readonly referenciaBancard: string;
  /**
   * Firmas del documento, según `firmantes-documento.ts` (D-13): solo Alianza,
   * en modalidad `PREFIRMADO`. El cliente no firma el CPC —no se le pide que
   * acepte nada nuevo— y por eso acá no hay ningún acto de Code100.
   */
  readonly firmas: readonly FirmaInstitucional[];
}

// ---------------------------------------------------------------------------
// Emisión de la póliza (P9)
// ---------------------------------------------------------------------------

export type EstadoPolizaExpediente = "EN_PROCESO_DE_EMISION" | "EMITIDA" | "RECHAZADA";
export type EstadoFacturaExpediente = "PENDIENTE" | "EMITIDA" | "RECHAZADA";

/**
 * Lo que SeguroLoTengo sabe de la póliza: **un estado y dos referencias**, no
 * el documento.
 *
 * La póliza y la factura las emite y las envía Alianza (SEBAOT y SIFEN);
 * SeguroLoTengo no las genera, no las almacena y no las entrega — desde el
 * portal solo se descargan la Solicitud y el FIPF firmados (P9,
 * `DOCUMENTOS DISPONIBLES PARA DESCARGAR`; CLAUDE.md → "Reglas transversales de
 * integraciones"). Por eso acá no hay ningún campo de bytes ni de URL de
 * descarga: no habría de dónde sacarlos.
 *
 * `numeroPoliza` es el mismo correlativo de la propuesta: SEBAOT no acuña uno
 * nuevo (fila 47 de la matriz de cumplimiento).
 *
 * **No se genera Nota de Cobertura**: no está modelada porque el producto no la
 * contempla.
 */
export interface PolizaDelExpediente {
  readonly numeroPoliza: string;
  readonly estado: EstadoPolizaExpediente;
  readonly emitidaEn: string | null;
  readonly estadoFactura: EstadoFacturaExpediente;
  readonly referenciaFactura: string | null;
  /** Cuándo SeguroLoTengo remitió el expediente a Alianza. */
  readonly solicitadaEn: string;
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
  /**
   * Aceptación de T&C del inicio del flujo v3 (DI-10): el acto que creó el
   * expediente, con versión y texto del servidor. `null` en todo expediente
   * v2, donde el trámite nace al elegir plan.
   */
  readonly terminosIniciales: AutorizacionInicial | null;
  readonly canalEmail: CanalVerificado | null;
  readonly identidad: Identidad | null;
  readonly datosComplementarios: DatosComplementariosP6 | null;
  /**
   * Beneficiario por fallecimiento. Se declara en el paso 5 y por eso vive
   * aparte de `datosComplementarios`, que se capturan en el 4.
   */
  readonly beneficiario: Beneficiario | null;
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
   * Análisis de P5 que no alcanzaron los cinco requisitos, acumulados.
   * Al llegar a `INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA` el caso pasa a
   * `ASISTENCIA_IDENTIDAD` en vez de dejar a la persona repitiendo capturas
   * que no van a alcanzar.
   */
  readonly intentosIdentidadFallidos: number;
  /**
   * Número de caso de asistencia de identidad. Distinto del correlativo de la
   * propuesta y del `numeroCasoDerivacion` de Pantalla A: son tres colas
   * distintas y confundirlas haría imposible medir cualquiera de ellas.
   */
  readonly numeroCasoAsistenciaIdentidad: string | null;
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
   * Vencimiento del plazo para **pagar**, calculado al quedar el expediente
   * firmado por todos (D-10: 24 horas). Pasada esa hora sin cobro el
   * expediente va a VENCIDO, que bajo este orden es el final del camino: no
   * hubo cobro, así que no hay devolución que tramitar.
   *
   * Se llamaba `plazoFirmaVenceEn` mientras se cobraba antes de firmar, y
   * medía lo contrario: el tiempo que tenía la persona para firmar algo que ya
   * había pagado. Invertido el orden (D-08), vencer dejó de costar plata —no
   * hay premio que devolver— y por eso el nombre cambió con la semántica.
   * Los expedientes anteriores traen la clave vieja y **no se reescriben**
   * (regla inviolable #10): el repositorio la lee y la mapea acá, porque el
   * dato que guardan sigue siendo el instante en que caducaron.
   */
  readonly plazoPagoVenceEn: string | null;
  readonly paqueteDocumental: PaqueteDocumental | null;
  /** Enlace de firma enviado y esperando confirmación de Code100 (P8). */
  readonly actoDeFirma: ActoDeFirmaEnCurso | null;
  readonly firma: Firma | null;
  /** Firmas institucionales aplicadas sobre el paquete, en orden (D-13). */
  readonly firmasInstitucionales: readonly FirmaInstitucional[];
  /**
   * Certificado de Cobertura Provisional (D-12), emitido en la misma escritura
   * que confirma el pago. `null` mientras no haya cobro — y también en los
   * expedientes que cobraron antes de que este documento existiera, que no se
   * reescriben (regla inviolable #10).
   */
  readonly certificadoCobertura: CertificadoCobertura | null;
  /** Estado de la emisión en Alianza (P9). No contiene la póliza, solo su estado. */
  readonly poliza: PolizaDelExpediente | null;
  /**
   * Trámite de devolución del premio (D-02), o `null` mientras no haya ninguno
   * —que es el caso normal—. Lo escriben `solicitarDevolucion` y
   * `acreditarDevolucion`; el expediente lo asienta y lo sigue, no lo ejecuta.
   */
  readonly devolucion: DevolucionDelExpediente | null;

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
    terminosIniciales: null,
    canalEmail: null,
    identidad: null,
    datosComplementarios: null,
    beneficiario: null,
    declaraciones: null,
    motivoDerivacionManual: null,
    numeroCasoDerivacion: null,
    intentosIdentidadFallidos: 0,
    numeroCasoAsistenciaIdentidad: null,
    numeroPropuesta: null,
    facturacion: null,
    pago: null,
    plazoPagoVenceEn: null,
    paqueteDocumental: null,
    actoDeFirma: null,
    firma: null,
    firmasInstitucionales: [],
    certificadoCobertura: null,
    poliza: null,
    devolucion: null,
    expedienteAnteriorId: input.expedienteAnteriorId ?? null,
    creadoEn: input.ahora,
    actualizadoEn: input.ahora,
  };
}
