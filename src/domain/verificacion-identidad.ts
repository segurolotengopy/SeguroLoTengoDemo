/**
 * Caso de uso de P5 · Verificación de identidad
 * (docs/ESPECIFICACION_PANTALLAS.md → "P5 · Paso 5 de 9 — Verificación de
 * identidad").
 *
 * Respaldo normativo: fila 14 de `docs/Tabla Cumplimiento SeguroLo Tengo -
 * Tabla.csv` — categoría "R2 - CONSENTIMIENTO, IDENTIFICACIÓN Y REPUDIO",
 * *"Verificar identidad con cédula, frente y dorso, selfie en vivo y prueba de
 * vida"*, Res. SEPRELAD 71/19, arts. 25(a-c), 26(1)(a-b) y 29(b). El cálculo
 * automático de la edad tiene su propia fila (17, Res. SEPRELAD 71/19, art.
 * 26(1)(b-c)), y la vinculación de cédula, selfie, OTP y declaraciones al
 * mismo expediente, la fila 22.
 *
 * Tres operaciones, en este orden:
 *
 * 1. `registrarCapturaP5` — una foto por vez (frente, dorso, selfie). Devuelve
 *    el resultado de calidad/autenticidad/prueba de vida de **esa** captura,
 *    que es lo que la pantalla necesita para marcar la tarjeta como aprobada o
 *    para ofrecer repetirla. No transiciona nada.
 * 2. `analizarIdentidadP5` — con las tres imágenes ya tomadas: OCR de la
 *    cédula y comparación facial. Devuelve los datos extraídos (que la
 *    pantalla muestra bloqueados) y el estado de los cinco requisitos. Tampoco
 *    transiciona: es lo que se ve antes de apretar el botón.
 * 3. `confirmarIdentidadP5` — botón `VALIDAR IDENTIDAD Y CONTINUAR →`. Repite
 *    la verificación completa del lado del servidor y, solo si todo aprueba,
 *    transiciona CANAL_EMAIL_VERIFICADO → IDENTIDAD_VERIFICADA guardando la
 *    `Identidad` y la `CapturaBiometrica`.
 *
 * **Por qué la confirmación recibe otra vez las imágenes y repite todo:** los
 * cinco requisitos no pueden decidirse con valores que reporte el navegador.
 * Si la confirmación confiara en el "ya me aprobaste la prueba de vida" del
 * cliente, cualquiera pasaría P5 con una petición armada a mano. Cada llamada
 * es autosuficiente y su resultado sale entero del `IdentityProvider`.
 * (Nota para el adaptador oficial: Entrust/Onfido cobran por verificación, así
 * que ahí conviene que `analizar` y `confirmar` compartan una única sesión del
 * proveedor y que la confirmación relea el resultado por `session_id` en vez
 * de volver a enviar los archivos. El mock es local y sin costo.)
 *
 * **Los campos extraídos por OCR no se editan a mano** (regla de P5 y del
 * puerto): ninguna función de este módulo acepta un dato de la cédula como
 * entrada. La `Identidad` que se persiste toma esos seis campos del proveedor
 * y solo el país de nacimiento y el estado civil de lo que la persona eligió.
 * Ante una discrepancia el único camino es repetir la captura.
 *
 * **Regla inviolable #8:** la edad se calcula desde la fecha de nacimiento que
 * devuelve el OCR (`edadEnRangoPermitido`), nunca desde un campo declarado. No
 * hay ninguna entrada por la que pueda llegar una fecha de nacimiento distinta.
 */
import { randomInt, randomUUID } from "node:crypto";
import type { EvidenceStore } from "../ports/evidence-store";
import type {
  CapturaSelfie,
  IdentityProvider,
  ImagenCapturada,
  MediaCapturada,
} from "../ports/identity-provider";
import { evaluarBloqueoPorCedula } from "./consola-administrativa";
import type { LectorExpedientesPorCedula } from "./consola-administrativa";
import { normalizarCorreo } from "./correo";
import { cotejarCorreccion } from "./cotejo-ocr";
import type { CorreccionesOcr } from "./cotejo-ocr";
import { esEstadoCivil, esPaisNacimiento, requisitosPendientes } from "./catalogo-identidad";
import type { IdRequisitoP5, RequisitosP5, TipoCapturaP5 } from "./catalogo-identidad";
import { transicionarExpediente } from "./expediente";
import { calcularEdadDesde, edadEnRangoPermitido } from "./tipos";
import type { OrigenCaptura } from "./identidad-parametros";
import type {
  CapturaBiometrica,
  EstadoExpediente,
  Expediente,
  Identidad,
  RegistroEvidencia,
} from "./tipos";
import type {
  RegistroCivilProvider,
  ResultadoConsultaRegistroCivil,
} from "../ports/registro-civil";
import type { ContextoPeticion, RepositorioExpediente } from "./verificacion-canal";

// ---------------------------------------------------------------------------
// Dependencias y constantes
// ---------------------------------------------------------------------------

export interface DependenciasP5 {
  readonly identidad: IdentityProvider;
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  /**
   * Búsqueda de expedientes por cédula, para la regla de bloqueo de nuevo
   * registro (`docs/CONSOLA_ADMINISTRATIVA.md` §5). Es **obligatoria**, no
   * opcional: si fuera opcional, olvidarla en un composition root apagaría la
   * regla en silencio. P5 es el único paso del flujo que la necesita porque es
   * donde el sistema conoce la cédula por primera vez.
   */
  readonly bloqueos: LectorExpedientesPorCedula;
  /**
   * Consulta al registro civil (ítem 33). **Opcional a propósito**: es el
   * único camino por el que una cédula del formato anterior —sin MRZ— puede
   * completar P5, pero un despliegue sin proveedor de registro tiene que
   * seguir funcionando para el formato nuevo, no romperse entero.
   *
   * Sin ella, el formato anterior queda como estaba: sin datos confiables y
   * sin poder continuar.
   */
  readonly registroCivil?: RegistroCivilProvider;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

/** Único estado desde el que P5 puede operar. */
/**
 * Se entra a identidad desde la autorización inicial (D-06).
 *
 * Antes se entraba desde `CANAL_EMAIL_VERIFICADO`, que era el estado que
 * dejaba el paso de correo. Al retirarse ese paso, el correo se declara en
 * esta misma pantalla y el estado previo pasa a ser `AUTORIZADO`.
 */
export const ESTADO_REQUERIDO_P5: EstadoExpediente = "AUTORIZADO";

/**
 * Estado previo de los expedientes que empezaron antes del retiro del OTP de
 * correo. Se acepta además del requerido para que un trámite a medio camino no
 * quede trabado por un cambio de diseño (regla #10: no se los reescribe).
 */
export const ESTADO_LEGADO_P5: EstadoExpediente = "CANAL_EMAIL_VERIFICADO";

export const PASO_EVIDENCIA_CAPTURA_P5 = "P5_CAPTURA_IDENTIDAD";
export const PASO_EVIDENCIA_ANALISIS_P5 = "P5_ANALISIS_IDENTIDAD";
export const PASO_EVIDENCIA_VERIFICACION_P5 = "P5_VERIFICACION_IDENTIDAD";
export const PASO_EVIDENCIA_REGISTRO_CIVIL_P5 = "P5_CONSULTA_REGISTRO_CIVIL";
export const PASO_EVIDENCIA_ASISTENCIA_IDENTIDAD = "P5_DERIVACION_ASISTENCIA_IDENTIDAD";

/**
 * Análisis fallidos de P5 tras los cuales el caso pasa a asistencia humana.
 *
 * **Decisión de producto, sin fila en la matriz de cumplimiento.** La fila 19
 * respalda derivar una respuesta PEP a análisis reforzado, que es otra cosa:
 * no hay norma que exija esta salida. Lo que la justifica es que sin ella una
 * persona con un documento que el sistema no sabe leer queda repitiendo
 * capturas para siempre, y eso no es un rechazo: es un callejón sin salida.
 *
 * Tres, igual que los intentos de OTP de la regla inviolable #1 — un número
 * que el producto ya usa y que la gente ya conoce.
 */
export const INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA = 3;

/** Prefijo del número de caso de asistencia; distinto del de Pantalla A. */
const PREFIJO_CASO_ASISTENCIA = "ASIS";

/**
 * Número de caso de asistencia de identidad.
 *
 * Mismo criterio que `generarNumeroCaso` de P6: CSPRNG y no contador, para no
 * exponer cuántos casos hay. Prefijo propio porque son **tres colas distintas**
 * —propuesta, derivación por elegibilidad y asistencia de identidad— y
 * mezclarlas haría imposible medir cualquiera.
 */
export function generarNumeroCasoAsistencia(ahora: Date = new Date()): string {
  const secuencia = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return `${PREFIJO_CASO_ASISTENCIA}-${ahora.getUTCFullYear()}-${secuencia}`;
}

/**
 * Los cinco requisitos, los tipos de captura y las opciones de país y estado
 * civil viven en `catalogo-identidad.ts` —módulo sin dependencias— para que la
 * pantalla pueda importarlos sin arrastrar `node:crypto` al navegador. Se
 * reexportan acá para que el servidor tenga un solo punto de entrada de P5.
 */
export {
  ESTADOS_CIVILES,
  PAISES_NACIMIENTO,
  REQUISITOS_P5,
  requisitosPendientes,
  todosLosRequisitosCumplidos,
} from "./catalogo-identidad";
export type { IdRequisitoP5, RequisitosP5, TipoCapturaP5 } from "./catalogo-identidad";

// ---------------------------------------------------------------------------
// Datos que la pantalla muestra
// ---------------------------------------------------------------------------

/**
 * Los seis campos que se muestran bloqueados, más la edad calculada. Todo sale
 * del OCR: no hay ningún campo declarado acá.
 */
export interface DatosIdentidadP5 {
  readonly numeroCedula: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly fechaNacimiento: string; // ISO 8601 (YYYY-MM-DD)
  readonly sexo: string;
  readonly nacionalidad: string;
  /** Calculada desde `fechaNacimiento` (regla inviolable #8). */
  readonly edad: number;
  readonly edadEnRango: boolean;
}

/**
 * Bloque `REGISTRO DE SEGURIDAD` de P5: fecha, hora, IP, referencias de
 * captura, hashes de las evidencias, resultado de prueba de vida y
 * coincidencia biométrica.
 */
export interface RegistroSeguridadP5 {
  readonly fecha: string; // ISO 8601: fecha y hora
  readonly ip: string;
  readonly referenciaFrente: string;
  readonly referenciaDorso: string;
  readonly referenciaSelfie: string;
  readonly hashFrenteCedula: string;
  readonly hashDorsoCedula: string;
  readonly hashSelfie: string;
  readonly pruebaDeVidaAprobada: boolean;
  readonly coincidenciaFacialAprobada: boolean;
  readonly puntuacionFacial: number | null;
  readonly resultado: "EXITOSO" | "FALLIDO";
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

interface Reloj {
  readonly ahora: () => string;
  readonly nuevoId: () => string;
}

function resolverReloj(deps: DependenciasP5): Reloj {
  return {
    ahora: deps.ahora ?? (() => new Date().toISOString()),
    nuevoId: deps.nuevoId ?? (() => randomUUID()),
  };
}

function formatearDetalle(datos: Readonly<Record<string, string | number | boolean>>): string {
  return Object.entries(datos)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(" · ");
}

/**
 * Escribe la evidencia del paso (regla inviolable #10). En `detalle` entran
 * solo hashes, referencias, booleanos y motivos: nunca el número de cédula ni
 * el nombre, que viven en el expediente y no tienen por qué duplicarse en el
 * registro probatorio de cada intento.
 */
async function registrarEvidencia(
  deps: DependenciasP5,
  reloj: Reloj,
  entrada: {
    expedienteId: string;
    paso: string;
    fecha: string;
    contexto: ContextoPeticion;
    resultado: "EXITOSO" | "FALLIDO";
    detalle: Readonly<Record<string, string | number | boolean>>;
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
    // P5 no pide aceptar ningún literal: la autorización biométrica es un
    // checkbox de la pantalla, no un texto contractual versionado.
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado: entrada.resultado,
    detalle: formatearDetalle(entrada.detalle),
  };
  await deps.evidencias.guardar(registro);
}

type ResultadoEstado =
  | { readonly ok: true; readonly expediente: Expediente }
  | { readonly ok: false; readonly motivo: "EXPEDIENTE_NO_ENCONTRADO" | "ESTADO_INVALIDO" };

async function exigirExpedienteEnP5(
  deps: DependenciasP5,
  expedienteId: string,
): Promise<ResultadoEstado> {
  const expediente = await deps.expedientes.obtenerPorId(expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };
  if (expediente.estado !== ESTADO_REQUERIDO_P5 && expediente.estado !== ESTADO_LEGADO_P5) {
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }
  return { ok: true, expediente };
}

// ---------------------------------------------------------------------------
// 1. Captura de una foto (frente, dorso o selfie)
// ---------------------------------------------------------------------------

export interface EntradaCapturaP5 {
  readonly expedienteId: string;
  readonly tipo: TipoCapturaP5;
  /**
   * Bytes de la captura para `FRENTE` y `DORSO`. Para `SELFIE` puede ser una
   * `CapturaSelfie`, porque la prueba de vida en vivo no manda bytes al
   * backend (ver `ImagenesP5.selfie`).
   */
  readonly imagen: MediaCapturada | CapturaSelfie;
  /**
   * De dónde salieron los bytes. Por defecto `CAMARA`, que es la regla del
   * proceso (`CAPTURA_SOLO_DESDE_CAMARA`); `ARCHIVO` solo lo admite el modo
   * demostración y solo para el documento — quien llama ya lo validó con
   * `origenCapturaAdmitido`.
   */
  readonly origen?: OrigenCaptura;
  readonly contexto: ContextoPeticion;
}

export type ResultadoCapturaP5 =
  | {
      readonly ok: true;
      readonly tipo: TipoCapturaP5;
      readonly aprobada: boolean;
      readonly calidadAprobada: boolean;
      readonly autenticidadAprobada: boolean;
      /** Solo en la selfie; `null` en frente y dorso. */
      readonly pruebaDeVidaAprobada: boolean | null;
      readonly referencia: string;
      readonly hashSha256: string;
      readonly motivoRechazo: string | null;
    }
  | {
      readonly ok: false;
      readonly motivo: "EXPEDIENTE_NO_ENCONTRADO" | "ESTADO_INVALIDO" | "IMAGEN_VACIA";
    };

/**
 * Botones `TOMAR FOTOGRAFÍA` (frente y dorso) e `INICIAR VERIFICACIÓN`
 * (selfie con prueba de vida). Una captura rechazada por calidad no es un
 * error del paso: devuelve `ok: true` con `aprobada: false` y su motivo, que
 * es lo que la tarjeta muestra junto al enlace para repetirla.
 */
/**
 * Lleva a `CapturaSelfie` lo que haya llegado en el campo de la selfie.
 *
 * Los bytes sueltos se siguen aceptando —es lo que manda el mock del demo— y
 * se envuelven como `VIDEO`. La unión ya armada pasa tal cual. Existe para que
 * el resto del dominio no tenga que preguntarse en qué forma vino.
 */
function normalizarSelfie(valor: MediaCapturada | CapturaSelfie): CapturaSelfie {
  return valor instanceof Uint8Array ? { tipo: "VIDEO", video: valor } : valor;
}

/**
 * `true` si la captura no trae nada utilizable. Para bytes es longitud cero;
 * para una sesión de prueba de vida es una referencia vacía, que es el
 * equivalente exacto: no hay nada que consultarle al proveedor.
 */
function capturaVacia(valor: MediaCapturada | CapturaSelfie): boolean {
  if (valor instanceof Uint8Array) return valor.length === 0;
  return valor.tipo === "VIDEO"
    ? valor.video.length === 0
    : valor.referenciaSesion.trim() === "";
}

export async function registrarCapturaP5(
  deps: DependenciasP5,
  entrada: EntradaCapturaP5,
): Promise<ResultadoCapturaP5> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();

  if (capturaVacia(entrada.imagen)) return { ok: false, motivo: "IMAGEN_VACIA" };

  const estado = await exigirExpedienteEnP5(deps, entrada.expedienteId);
  if (!estado.ok) return { ok: false, motivo: estado.motivo };

  if (entrada.tipo === "SELFIE") {
    const selfie = await deps.identidad.capturarSelfieYPruebaDeVida(
      entrada.expedienteId,
      normalizarSelfie(entrada.imagen),
    );

    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_CAPTURA_P5,
      fecha,
      contexto: entrada.contexto,
      resultado: selfie.pruebaDeVidaAprobada ? "EXITOSO" : "FALLIDO",
      detalle: {
        tipo: "SELFIE",
        referencia: selfie.imagen.referencia,
        hash: selfie.imagen.hashSha256,
        pruebaDeVida: selfie.pruebaDeVidaAprobada,
      },
    });

    return {
      ok: true,
      tipo: "SELFIE",
      aprobada: selfie.pruebaDeVidaAprobada,
      calidadAprobada: selfie.pruebaDeVidaAprobada,
      autenticidadAprobada: selfie.pruebaDeVidaAprobada,
      pruebaDeVidaAprobada: selfie.pruebaDeVidaAprobada,
      referencia: selfie.imagen.referencia,
      hashSha256: selfie.imagen.hashSha256,
      // El proveedor explica el rechazo si sabe por qué (una foto suelta
      // permite decir "no había rostro"); si no, queda el genérico, que es lo
      // que corresponde a una sesión de prueba de vida por streaming.
      motivoRechazo: selfie.pruebaDeVidaAprobada
        ? null
        : (selfie.motivoRechazo ??
          "La prueba de vida no se completó. Seguí los movimientos que indica la pantalla."),
    };
  }

  // Acá `entrada.tipo` ya no puede ser `SELFIE` (se resolvió arriba y
  // retornó), así que el campo trae bytes. La aserción lo hace explícito en
  // vez de propagar la unión a las dos caras del documento, que sí son
  // siempre imágenes.
  const bytesDocumento = entrada.imagen as MediaCapturada;
  const captura =
    entrada.tipo === "FRENTE"
      ? await deps.identidad.capturarFrenteCedula(entrada.expedienteId, bytesDocumento)
      : await deps.identidad.capturarDorsoCedula(entrada.expedienteId, bytesDocumento);

  const aprobada = captura.calidadAprobada && captura.autenticidadAprobada;

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_CAPTURA_P5,
    fecha,
    contexto: entrada.contexto,
    resultado: aprobada ? "EXITOSO" : "FALLIDO",
    detalle: {
      tipo: entrada.tipo,
      referencia: captura.imagen.referencia,
      hash: captura.imagen.hashSha256,
      calidad: captura.calidadAprobada,
      autenticidad: captura.autenticidadAprobada,
      // Un documento subido como archivo no equivale a uno fotografiado en
      // vivo. La evidencia es append-only (regla #10): acá queda para
      // siempre cuál de las dos cosas fue.
      origen: entrada.origen ?? "CAMARA",
      ...(captura.motivoRechazo ? { motivo: captura.motivoRechazo } : {}),
    },
  });

  return {
    ok: true,
    tipo: entrada.tipo,
    aprobada,
    calidadAprobada: captura.calidadAprobada,
    autenticidadAprobada: captura.autenticidadAprobada,
    pruebaDeVidaAprobada: null,
    referencia: captura.imagen.referencia,
    hashSha256: captura.imagen.hashSha256,
    motivoRechazo: captura.motivoRechazo,
  };
}

// ---------------------------------------------------------------------------
// Verificación completa (compartida por el análisis y la confirmación)
// ---------------------------------------------------------------------------

export interface ImagenesP5 {
  readonly frente: MediaCapturada;
  readonly dorso: MediaCapturada;
  /**
   * La selfie no son necesariamente bytes: con una prueba de vida por
   * streaming (AWS Rekognition Face Liveness) el video va del navegador
   * directo al proveedor y acá solo llega la referencia de la sesión. Ver
   * `CapturaSelfie` en el puerto.
   */
  readonly selfie: CapturaSelfie;
}

interface VerificacionCompleta {
  /**
   * Resultado de la consulta al registro civil, `null` si no hizo falta (el
   * documento tenía MRZ) o no se pudo (sin número legible o sin proveedor).
   * Lo necesita el llamador para dejar evidencia y para distinguir un
   * "no existe" de un "no contestó".
   */
  readonly registroCivil: ResultadoConsultaRegistroCivil | null;
  readonly requisitos: RequisitosP5;
  readonly datos: DatosIdentidadP5 | null;
  readonly frente: ImagenCapturada;
  readonly dorso: ImagenCapturada;
  readonly selfie: ImagenCapturada;
  readonly pruebaDeVidaAprobada: boolean;
  readonly coincidenciaFacialAprobada: boolean;
  readonly puntuacionFacial: number | null;
  readonly motivoRechazoCaptura: string | null;
}

/**
 * Corre las cinco llamadas del puerto en el orden que exige el propio puerto:
 * frente y dorso antes del OCR, frente y selfie antes de la comparación.
 *
 * `paisYEstadoCivilCompletos` se resuelve afuera: es el único requisito que no
 * depende del proveedor.
 */
/**
 * Consulta al registro civil por el número leído del frente.
 *
 * Devuelve `null` cuando no hay nada que consultar —sin número legible, o sin
 * proveedor configurado—, que es distinto de haber consultado y no encontrar.
 * Esa distinción la usa el llamador para decidir si deriva o si simplemente
 * pide repetir la captura.
 */
async function consultarRegistroCivil(
  deps: DependenciasP5,
  numeroCedula: string | null,
): Promise<ResultadoConsultaRegistroCivil | null> {
  if (!deps.registroCivil || !numeroCedula) return null;
  return deps.registroCivil.consultarPorCedula(numeroCedula);
}

/**
 * Deja constancia de la consulta al registro civil, si hubo.
 *
 * Es evidencia obligatoria y no cosmética: cuando los datos de identidad salen
 * del registro y no del documento, **el registro pasa a ser la fuente de la
 * fecha de nacimiento que decide el corte de edad 18–64**. Un auditor tiene
 * que poder ver que esa fecha vino de la fuente oficial, con qué referencia de
 * consulta y cuándo.
 *
 * No se registra ningún dato personal devuelto por el registro: solo el
 * estado, la referencia opaca de la consulta y el motivo si no estuvo
 * disponible. El nombre y la fecha ya quedan en el expediente.
 */
async function registrarConsultaRegistroCivil(
  deps: DependenciasP5,
  reloj: Reloj,
  entrada: {
    readonly expedienteId: string;
    readonly fecha: string;
    readonly contexto: ContextoPeticion;
    readonly consulta: ResultadoConsultaRegistroCivil | null;
  },
): Promise<void> {
  if (!entrada.consulta) return;

  const { consulta } = entrada;
  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_REGISTRO_CIVIL_P5,
    fecha: entrada.fecha,
    contexto: entrada.contexto,
    resultado: consulta.estado === "ENCONTRADO" ? "EXITOSO" : "FALLIDO",
    detalle:
      consulta.estado === "NO_DISPONIBLE"
        ? { estado: consulta.estado, motivo: consulta.motivo }
        : { estado: consulta.estado, referenciaConsulta: consulta.referenciaConsulta },
  });
}

async function verificar(
  deps: DependenciasP5,
  expedienteId: string,
  imagenes: ImagenesP5,
  fechaReferencia: Date,
  paisYEstadoCivilCompletos: boolean,
): Promise<VerificacionCompleta> {
  const frente = await deps.identidad.capturarFrenteCedula(expedienteId, imagenes.frente);
  const dorso = await deps.identidad.capturarDorsoCedula(expedienteId, imagenes.dorso);
  const selfie = await deps.identidad.capturarSelfieYPruebaDeVida(
    expedienteId,
    normalizarSelfie(imagenes.selfie),
  );
  const ocr = await deps.identidad.extraerDatosCedula(expedienteId);
  const comparacion = await deps.identidad.compararRostro(expedienteId);

  // Cédula del formato anterior: el OCR no puede dar nombre ni fecha con
  // garantías, pero sí el número. Se va a buscar la verdad al registro civil.
  const registro = ocr.confiable
    ? null
    : await consultarRegistroCivil(deps, ocr.numeroCedulaSinConfirmar);

  const camposIdentidad = ocr.confiable
    ? ocr.datos
    : registro?.estado === "ENCONTRADO"
      ? { ...registro.datos, nacionalidad: registro.datos.nacionalidad }
      : null;

  const datos: DatosIdentidadP5 | null = camposIdentidad
    ? {
        ...camposIdentidad,
        edad: calcularEdadDesde(camposIdentidad.fechaNacimiento, fechaReferencia),
        edadEnRango: edadEnRangoPermitido(camposIdentidad.fechaNacimiento, fechaReferencia),
      }
    : null;

  return {
    registroCivil: registro,
    requisitos: {
      // "Cédula vigente y legible": el documento aprobó autenticidad en las
      // dos caras y **hay una fuente confiable de datos** — el MRZ, o el
      // registro civil cuando el documento no tiene MRZ.
      cedulaVigenteYLegible:
        frente.autenticidadAprobada &&
        dorso.autenticidadAprobada &&
        (ocr.confiable || registro?.estado === "ENCONTRADO"),
      frenteYDorsoAprobados: frente.calidadAprobada && dorso.calidadAprobada,
      pruebaDeVidaAprobada: selfie.pruebaDeVidaAprobada,
      coincidenciaFacial: comparacion.coincidenciaFacialAprobada,
      paisYEstadoCivilCompletos,
    },
    datos,
    frente: frente.imagen,
    dorso: dorso.imagen,
    selfie: selfie.imagen,
    pruebaDeVidaAprobada: selfie.pruebaDeVidaAprobada,
    coincidenciaFacialAprobada: comparacion.coincidenciaFacialAprobada,
    puntuacionFacial: comparacion.puntuacion,
    motivoRechazoCaptura: frente.motivoRechazo ?? dorso.motivoRechazo,
  };
}

function armarRegistroSeguridad(
  verificacion: VerificacionCompleta,
  fecha: string,
  contexto: ContextoPeticion,
  resultado: "EXITOSO" | "FALLIDO",
): RegistroSeguridadP5 {
  return {
    fecha,
    ip: contexto.ip,
    referenciaFrente: verificacion.frente.referencia,
    referenciaDorso: verificacion.dorso.referencia,
    referenciaSelfie: verificacion.selfie.referencia,
    hashFrenteCedula: verificacion.frente.hashSha256,
    hashDorsoCedula: verificacion.dorso.hashSha256,
    hashSelfie: verificacion.selfie.hashSha256,
    pruebaDeVidaAprobada: verificacion.pruebaDeVidaAprobada,
    coincidenciaFacialAprobada: verificacion.coincidenciaFacialAprobada,
    puntuacionFacial: verificacion.puntuacionFacial,
    resultado,
  };
}

// ---------------------------------------------------------------------------
// 2. Análisis: OCR + comparación facial, sin transicionar
// ---------------------------------------------------------------------------

export interface EntradaAnalisisP5 {
  readonly expedienteId: string;
  readonly imagenes: ImagenesP5;
  readonly contexto: ContextoPeticion;
}

export type ResultadoAnalisisP5 =
  | {
      readonly ok: true;
      readonly requisitos: RequisitosP5;
      /**
       * Número de caso de asistencia si este análisis agotó los intentos y el
       * expediente pasó a `ASISTENCIA_IDENTIDAD`. `null` mientras quede margen
       * para repetir la captura.
       */
      readonly asistenciaIdentidad?: string | null;
      /** `null` si el OCR no fue confiable: hay que repetir la captura. */
      readonly datos: DatosIdentidadP5 | null;
      readonly motivoRechazoCaptura: string | null;
      readonly registroSeguridad: RegistroSeguridadP5;
    }
  | {
      readonly ok: false;
      readonly motivo: "EXPEDIENTE_NO_ENCONTRADO" | "ESTADO_INVALIDO" | "CAPTURAS_INCOMPLETAS";
    };

/**
 * Lo que llena el bloque 2 de la pantalla (campos bloqueados y edad calculada)
 * y marca los cuatro primeros requisitos. No toca el expediente.
 *
 * `paisYEstadoCivilCompletos` se devuelve en `false`: en este punto la persona
 * todavía no eligió, y son los dos campos que sí completa a mano.
 */
export async function analizarIdentidadP5(
  deps: DependenciasP5,
  entrada: EntradaAnalisisP5,
): Promise<ResultadoAnalisisP5> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();

  if (
    entrada.imagenes.frente.length === 0 ||
    entrada.imagenes.dorso.length === 0 ||
    capturaVacia(entrada.imagenes.selfie)
  ) {
    return { ok: false, motivo: "CAPTURAS_INCOMPLETAS" };
  }

  const estado = await exigirExpedienteEnP5(deps, entrada.expedienteId);
  if (!estado.ok) return { ok: false, motivo: estado.motivo };

  const verificacion = await verificar(
    deps,
    entrada.expedienteId,
    entrada.imagenes,
    new Date(fecha),
    false,
  );

  const resultado = verificacion.datos?.edadEnRango && verificacion.coincidenciaFacialAprobada
    ? "EXITOSO"
    : "FALLIDO";

  await registrarConsultaRegistroCivil(deps, reloj, {
    expedienteId: entrada.expedienteId,
    fecha,
    contexto: entrada.contexto,
    consulta: verificacion.registroCivil,
  });

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_ANALISIS_P5,
    fecha,
    contexto: entrada.contexto,
    resultado,
    detalle: {
      hashFrente: verificacion.frente.hashSha256,
      hashDorso: verificacion.dorso.hashSha256,
      hashSelfie: verificacion.selfie.hashSha256,
      ocrConfiable: verificacion.datos !== null,
      pruebaDeVida: verificacion.pruebaDeVidaAprobada,
      coincidenciaFacial: verificacion.coincidenciaFacialAprobada,
      // El número de la cédula y los nombres no entran en la evidencia: ya
      // están en el expediente. Acá alcanza con si la edad habilita o no.
      edadEnRango: verificacion.datos?.edadEnRango ?? false,
    },
  });

  // Un análisis fallido acerca el caso a la asistencia humana. Se cuenta acá
  // y no en `registrarCapturaP5` a propósito: una captura rechazada por
  // borrosa es normal y se repite sin drama; lo que agota a la persona es
  // completar las tres capturas y que el análisis igual no alcance.
  const asistencia =
    resultado === "FALLIDO"
      ? await acumularIntentoFallido(deps, reloj, {
          expedienteId: entrada.expedienteId,
          expediente: estado.expediente,
          fecha,
          contexto: entrada.contexto,
        })
      : null;

  return {
    ok: true,
    requisitos: verificacion.requisitos,
    datos: verificacion.datos,
    motivoRechazoCaptura: verificacion.motivoRechazoCaptura,
    registroSeguridad: armarRegistroSeguridad(verificacion, fecha, entrada.contexto, resultado),
    asistenciaIdentidad: asistencia,
  };
}

/**
 * Suma un intento fallido y, al llegar al tope, deriva el caso a asistencia.
 *
 * Devuelve el número de caso si derivó, `null` si todavía queda margen. La
 * pantalla usa eso para saber si tiene que mandar a la persona a la Pantalla
 * de asistencia o si le ofrece repetir una vez más.
 */
async function acumularIntentoFallido(
  deps: DependenciasP5,
  reloj: Reloj,
  entrada: {
    readonly expedienteId: string;
    readonly expediente: Expediente;
    readonly fecha: string;
    readonly contexto: ContextoPeticion;
  },
): Promise<string | null> {
  const intentos = entrada.expediente.intentosIdentidadFallidos + 1;

  if (intentos < INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA) {
    await deps.expedientes.guardar({
      ...entrada.expediente,
      intentosIdentidadFallidos: intentos,
      actualizadoEn: entrada.fecha,
    });
    return null;
  }

  const numeroCaso = generarNumeroCasoAsistencia(new Date(entrada.fecha));
  const transicion = transicionarExpediente(
    { ...entrada.expediente, intentosIdentidadFallidos: intentos },
    "ASISTENCIA_IDENTIDAD",
    { numeroCasoAsistenciaIdentidad: numeroCaso },
    entrada.fecha,
  );
  // La transición solo puede fallar si el expediente se movió entre la lectura
  // y esta escritura; en ese caso no se deriva y el flujo sigue su curso.
  if (!transicion.ok) return null;

  await deps.expedientes.guardar(transicion.expediente);

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_ASISTENCIA_IDENTIDAD,
    fecha: entrada.fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: {
      numeroCaso,
      intentos,
      // Sin datos de la persona: el caso se identifica por número, y el
      // expediente ya tiene lo demás.
      motivo: "IDENTIDAD_NO_VERIFICABLE",
    },
  });

  return numeroCaso;
}

// ---------------------------------------------------------------------------
// 3. Confirmación: única puerta a IDENTIDAD_VERIFICADA
// ---------------------------------------------------------------------------

export interface EntradaConfirmacionP5 {
  readonly expedienteId: string;
  readonly imagenes: ImagenesP5;
  /** Selector obligatorio; se valida contra `catalogo-identidad.ts`. */
  readonly paisNacimiento: string;
  readonly estadoCivil: string;
  /**
   * Correo declarado, escrito dos veces en la pantalla (CHG-14/17, D-06).
   *
   * Llega acá y no en un paso propio porque ya no tiene código que verificar:
   * lo que lo respalda es el doble tipeo más la declaración de veracidad que
   * la persona firma después. Se valida y se normaliza en el dominio; la
   * pantalla solo comprueba que las dos escrituras coincidan.
   */
  readonly correo: string;
  /**
   * Correcciones a lo que el OCR leyó (CHG-15). Solo nombres y apellidos, y
   * cada una se coteja contra la lectura antes de aceptarse: se admite
   * arreglar, no reemplazar. Ver `cotejo-ocr.ts`.
   */
  readonly correcciones?: CorreccionesOcr;
  /** Checkbox de captura y comparación de imagen facial y prueba de vida. */
  readonly autorizacionBiometrica: boolean;
  readonly contexto: ContextoPeticion;
}

export type MotivoRechazoIdentidad =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "AUTORIZACION_BIOMETRICA_REQUERIDA"
  | "PAIS_O_ESTADO_CIVIL_INVALIDO"
  | "CORREO_INVALIDO"
  | "CORRECCION_NO_COINCIDE"
  | "CAPTURAS_INCOMPLETAS"
  | "REQUISITOS_INCOMPLETOS"
  | "EDAD_FUERA_DE_RANGO"
  /** Ya hay un expediente terminal sin póliza con esta cédula, sin superar. */
  | "CEDULA_BLOQUEADA";

export type ResultadoConfirmacionP5 =
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly estado: Expediente["estado"];
      readonly requisitos: RequisitosP5;
      readonly datos: DatosIdentidadP5;
      readonly registroSeguridad: RegistroSeguridadP5;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoIdentidad;
      readonly requisitos?: RequisitosP5;
      readonly pendientes?: readonly IdRequisitoP5[];
      readonly datos?: DatosIdentidadP5 | null;
    };

/**
 * Botón `VALIDAR IDENTIDAD Y CONTINUAR →`.
 *
 * La única transición a IDENTIDAD_VERIFICADA del sistema pasa por acá y la
 * ejecuta `transicionarExpediente`, nunca el Route Handler.
 *
 * Una edad fuera del rango 18-64 **no deriva a Pantalla A**: la derivación a
 * revisión manual es exclusiva de las declaraciones 1, 2, 3 y 8 de P6 (regla
 * inviolable #5). Acá el proceso simplemente no avanza y la pantalla ofrece
 * repetir la captura, que es lo único que la especificación contempla.
 */
export async function confirmarIdentidadP5(
  deps: DependenciasP5,
  entrada: EntradaConfirmacionP5,
): Promise<ResultadoConfirmacionP5> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();

  if (!entrada.autorizacionBiometrica) {
    return { ok: false, motivo: "AUTORIZACION_BIOMETRICA_REQUERIDA" };
  }
  if (
    entrada.imagenes.frente.length === 0 ||
    entrada.imagenes.dorso.length === 0 ||
    capturaVacia(entrada.imagenes.selfie)
  ) {
    return { ok: false, motivo: "CAPTURAS_INCOMPLETAS" };
  }

  const paisYEstadoCivilCompletos =
    esPaisNacimiento(entrada.paisNacimiento) && esEstadoCivil(entrada.estadoCivil);
  if (!paisYEstadoCivilCompletos) {
    return { ok: false, motivo: "PAIS_O_ESTADO_CIVIL_INVALIDO" };
  }

  // El correo se valida acá y no solo en la pantalla: sin código que lo
  // verifique, esta es la única barrera entre un correo mal escrito y una
  // póliza que nunca llega a destino.
  const correo = normalizarCorreo(entrada.correo);
  if (!correo.ok) return { ok: false, motivo: "CORREO_INVALIDO" };

  const estado = await exigirExpedienteEnP5(deps, entrada.expedienteId);
  if (!estado.ok) return { ok: false, motivo: estado.motivo };

  const verificacion = await verificar(
    deps,
    entrada.expedienteId,
    entrada.imagenes,
    new Date(fecha),
    paisYEstadoCivilCompletos,
  );

  // La confirmación rehace la verificación entera, así que también rehace la
  // consulta al registro: su evidencia se registra las dos veces, y eso es lo
  // correcto — son dos consultas distintas, con dos referencias distintas, y
  // la evidencia es append-only (regla inviolable #10).
  await registrarConsultaRegistroCivil(deps, reloj, {
    expedienteId: entrada.expedienteId,
    fecha,
    contexto: entrada.contexto,
    consulta: verificacion.registroCivil,
  });

  const pendientes = requisitosPendientes(verificacion.requisitos);
  const edadEnRango = verificacion.datos?.edadEnRango ?? false;

  async function rechazar(motivo: MotivoRechazoIdentidad): Promise<ResultadoConfirmacionP5> {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_VERIFICACION_P5,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: {
        motivo,
        hashFrente: verificacion.frente.hashSha256,
        hashDorso: verificacion.dorso.hashSha256,
        hashSelfie: verificacion.selfie.hashSha256,
        pruebaDeVida: verificacion.pruebaDeVidaAprobada,
        coincidenciaFacial: verificacion.coincidenciaFacialAprobada,
        edadEnRango,
        ...(pendientes.length > 0 ? { pendientes: pendientes.join(",") } : {}),
      },
    });

    return {
      ok: false,
      motivo,
      requisitos: verificacion.requisitos,
      pendientes,
      datos: verificacion.datos,
    };
  }

  if (pendientes.length > 0) return rechazar("REQUISITOS_INCOMPLETOS");
  // Bloqueo por cédula (docs/CONSOLA_ADMINISTRATIVA.md §5). Se evalúa recién
  // acá porque la cédula sale del OCR, no de un campo declarado: antes de
  // tener los requisitos aprobados no hay un número confiable contra el cual
  // consultar. Solo la consola administrativa puede levantarlo, y lo hace
  // creando un expediente nuevo enlazado —nunca reactivando el viejo—.
  if (verificacion.datos) {
    const bloqueo = await evaluarBloqueoPorCedula(deps.bloqueos, verificacion.datos.numeroCedula);
    if (bloqueo.bloqueada) return rechazar("CEDULA_BLOQUEADA");
  }
  // Regla inviolable #8: la edad sale de la fecha de nacimiento extraída de la
  // cédula. `verificacion.datos` no puede ser `null` acá —sin OCR confiable el
  // requisito `cedulaVigenteYLegible` ya habría cortado arriba—, pero el
  // chequeo se hace igual para que la regla no dependa de esa inferencia.
  if (!verificacion.datos || !edadEnRango) return rechazar("EDAD_FUERA_DE_RANGO");

  const captura: CapturaBiometrica = {
    hashFrenteCedula: verificacion.frente.hashSha256,
    hashDorsoCedula: verificacion.dorso.hashSha256,
    hashSelfie: verificacion.selfie.hashSha256,
    pruebaDeVidaAprobada: verificacion.pruebaDeVidaAprobada,
    coincidenciaFacialAprobada: verificacion.coincidenciaFacialAprobada,
  };

  // CHG-15 · las correcciones se cotejan **acá**, en el servidor. La pantalla
  // ya no deja escribir cualquier cosa, pero esconder un campo es cosmético:
  // cualquiera arma la petición a mano, y lo que se guarda termina en un
  // documento firmado.
  const nombres = cotejarCorreccion(
    "nombres",
    verificacion.datos.nombres,
    entrada.correcciones?.nombres,
  );
  if (!nombres.ok) return { ok: false, motivo: "CORRECCION_NO_COINCIDE" };

  const apellidos = cotejarCorreccion(
    "apellidos",
    verificacion.datos.apellidos,
    entrada.correcciones?.apellidos,
  );
  if (!apellidos.ok) return { ok: false, motivo: "CORRECCION_NO_COINCIDE" };

  const sexo = cotejarCorreccion("sexo", verificacion.datos.sexo, entrada.correcciones?.sexo);
  if (!sexo.ok) return { ok: false, motivo: "CORRECCION_NO_COINCIDE" };

  const identidad: Identidad = {
    // Los cuatro campos de los que cuelgan reglas del negocio salen del
    // proveedor y no de la petición: la fecha decide el corte de edad (regla
    // #8) y la cédula es la llave del bloqueo (regla #11).
    numeroCedula: verificacion.datos.numeroCedula,
    nombres: nombres.valor,
    apellidos: apellidos.valor,
    fechaNacimiento: verificacion.datos.fechaNacimiento,
    sexo: sexo.valor,
    nacionalidad: verificacion.datos.nacionalidad,
    // Los dos únicos que completa la persona.
    paisNacimiento: entrada.paisNacimiento,
    estadoCivil: entrada.estadoCivil,
    captura,
  };

  const transicion = transicionarExpediente(
    estado.expediente,
    "IDENTIDAD_VERIFICADA",
    {
      identidad,
      // Declarado, no verificado: el origen queda asentado en el expediente
      // para que después nadie lea este correo como si hubiera pasado por un
      // código (D-06).
      canalEmail: { valor: correo.correo, verificadoEn: fecha, origen: "DOBLE_TIPEO" },
    },
    fecha,
  );

  if (!transicion.ok) return rechazar("ESTADO_INVALIDO");

  await deps.expedientes.guardar(transicion.expediente, estado.expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_VERIFICACION_P5,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: {
      estado: transicion.expediente.estado,
      hashFrente: captura.hashFrenteCedula,
      hashDorso: captura.hashDorsoCedula,
      hashSelfie: captura.hashSelfie,
      pruebaDeVida: captura.pruebaDeVidaAprobada,
      coincidenciaFacial: captura.coincidenciaFacialAprobada,
      edadEnRango: true,
    },
  });

  return {
    ok: true,
    expedienteId: entrada.expedienteId,
    estado: transicion.expediente.estado,
    requisitos: verificacion.requisitos,
    datos: verificacion.datos,
    registroSeguridad: armarRegistroSeguridad(verificacion, fecha, entrada.contexto, "EXITOSO"),
  };
}
