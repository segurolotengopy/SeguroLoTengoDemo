/**
 * Certificado de Cobertura Provisional: vigencia y contenido (D-12, CHG-41/42).
 *
 * Es al CPC lo que `documentos.ts` es al paquete: decide **qué dice** el
 * documento, no cómo se dibuja ni cómo se guarda. Igual que aquel, es
 * deliberadamente libre de `node:*` para poder viajar al navegador — la
 * pantalla de confirmación muestra el inicio de cobertura, y calcularlo en dos
 * lugares distintos sería la forma más fácil de que el PDF y la pantalla
 * dijeran fechas distintas.
 *
 * ## Por qué la vigencia se calcula acá y no en la plantilla
 *
 * El inicio de la cobertura es **el instante del pago acreditado más 24 horas
 * exactas** (CHG-41). No es una redacción de marketing: es la fecha desde la
 * que la aseguradora responde, así que tiene que salir de una sola función,
 * quedar persistida en el expediente y no volver a recalcularse cada vez que
 * alguien abre una pantalla.
 *
 * "Veinticuatro horas exactas" quiere decir 86.400.000 milisegundos sobre el
 * instante del cobro, no "el día siguiente a la misma hora". La diferencia
 * aparece en los bordes —fin de mes, fin de año, y los dos cambios de horario
 * de Paraguay— y en todos ellos la aritmética sobre el instante absoluto da la
 * respuesta correcta, mientras que sumarle uno al día del calendario no.
 *
 * ## Lo que este documento no es
 *
 * No es la póliza (la emite Alianza por SEBAOT y lleva su propio número
 * oficial, CMP-18) y **no es una Nota de Cobertura**, que el producto sigue
 * sin contemplar. Lo dice el propio PDF, en su leyenda de cierre: no hay
 * cobertura anticipada acá, hay un cobro acreditado y una fecha de inicio que
 * cuelga de él.
 *
 * Respaldo normativo del documento (`docs/normativa/matriz 16 08 2026.pdf`
 * §7.5, y `docs/plan/PLAN_DE_CAMBIOS_v2.md` §3.5): CMP-04 (firma cualificada
 * del suscriptor de Alianza), CMP-06 (verificación de autenticidad por QR) y
 * CMP-07 (la secuencia firma → pago → CPC, atómica).
 */
import { PLANES, formatearGuaranies, NOMBRE_PRODUCTO, REGISTRO_PRODUCTO } from "./catalogo";
import { enmascararCorreo } from "./correo";
import { enmascararCelular } from "./telefono";
import {
  URL_BASE_VERIFICACION_POR_DEFECTO,
  codigoSolicitud,
  formatearFecha,
  urlDeVerificacion,
} from "./documentos";
import type { CampoDocumento, EncabezadoDocumento } from "./documentos";
import { firmantesDe } from "./firmantes-documento";
import type { Expediente, MedioDePago } from "./tipos";

// ---------------------------------------------------------------------------
// Identidad del documento
// ---------------------------------------------------------------------------

export const PREFIJO_CERTIFICADO = "CPC";

/** `00018425` → `CPC-00018425`. Un correlativo, tres códigos internos. */
export function codigoCertificado(correlativo: string): string {
  return `${PREFIJO_CERTIFICADO}-${correlativo}`;
}

/** Versión con la que nace un certificado. Reemitirlo exigiría subirla (regla #4). */
export const VERSION_INICIAL_CERTIFICADO = 1;

export const TITULO_CERTIFICADO = "Certificado de Cobertura Provisional";

// ---------------------------------------------------------------------------
// Vigencia
// ---------------------------------------------------------------------------

/**
 * Las 24 horas que separan el pago acreditado del inicio de la cobertura.
 *
 * Sale de la especificación del producto (`docs/ESPECIFICACION_PANTALLAS.md`,
 * P1: *"cobertura 24 horas después del pago, una vez completada la
 * contratación"*) y de la declaración 4 de P6, que la persona firma. Es el
 * mismo número que las 24 horas de D-10 y **no es el mismo plazo**: aquel mide
 * el tiempo para pagar algo ya firmado y termina en `VENCIDO`; este empieza a
 * contar cuando aquel se apagó.
 */
export const HORAS_HASTA_INICIO_COBERTURA = 24;

const MS_POR_HORA = 3_600_000;

/**
 * Instante del pago + 24 horas exactas.
 *
 * Aritmética sobre el instante absoluto, a propósito: es lo único que da la
 * respuesta correcta en los bordes de mes y de año, y lo único inmune a los
 * cambios de horario de Paraguay. Un pago acreditado el 31-oct a las 23:30
 * inicia el 1-nov a las 23:30, sin que nadie tenga que acordarse de cuántos
 * días tiene octubre.
 */
export function inicioCoberturaDesde(pagoConfirmadoEn: string): string {
  const pago = new Date(pagoConfirmadoEn);
  if (Number.isNaN(pago.getTime())) {
    throw new Error(`Fecha de pago inválida para calcular el inicio de cobertura: ${pagoConfirmadoEn}.`);
  }
  return new Date(pago.getTime() + HORAS_HASTA_INICIO_COBERTURA * MS_POR_HORA).toISOString();
}

/**
 * Fin de la vigencia anual contratada: el mismo día y hora, un año después.
 *
 * Acá **sí** se cuenta por calendario y no por milisegundos, y es la decisión
 * contraria a la del inicio por una razón: un año de vigencia es un año
 * calendario, y sumar 365 días dejaría los contratos que cruzan un bisiesto
 * terminando un día antes de su aniversario. El 29 de febrero es el único caso
 * sin aniversario exacto y se resuelve al 28 —`Date` lo llevaría al 1 de
 * marzo, que extendería la cobertura un día por encima de lo contratado.
 */
export function finCoberturaDesde(inicioCobertura: string): string {
  const inicio = new Date(inicioCobertura);
  if (Number.isNaN(inicio.getTime())) {
    throw new Error(`Fecha de inicio inválida para calcular el fin de cobertura: ${inicioCobertura}.`);
  }

  const fin = new Date(inicio.getTime());
  const dia = fin.getUTCDate();
  fin.setUTCFullYear(fin.getUTCFullYear() + 1);
  // Si el día se desbordó (29-feb → 1-mar), se retrocede al último día del mes
  // que corresponde: la vigencia termina en su aniversario, nunca después.
  if (fin.getUTCDate() !== dia) fin.setUTCDate(0);
  return fin.toISOString();
}

/** `2026-08-21T14:05:00.000Z` → `21/08/2026 14:05 UTC`, como lo imprime el PDF. */
export function formatearInstante(iso: string): string {
  const fecha = formatearFecha(iso);
  const hora = iso.slice(11, 16);
  return `${fecha} ${hora} UTC`;
}

// ---------------------------------------------------------------------------
// Modelo de contenido
// ---------------------------------------------------------------------------

export interface CoberturaCertificado {
  readonly rotulo: string;
  readonly sumaAsegurada: string;
  /** Carencia aplicable a esa cobertura, tal como la declara la Solicitud. */
  readonly carencia: string;
}

export interface ContenidoCertificado {
  readonly encabezado: EncabezadoDocumento;
  readonly correlativo: string;
  readonly version: number;
  readonly emitidoEn: string;
  /** Bloque 1 — Asegurado. */
  readonly asegurado: readonly CampoDocumento[];
  /** Bloque 2 — Vigencia de la cobertura provisional. */
  readonly vigencia: readonly CampoDocumento[];
  readonly leyendaInicioCobertura: string;
  /** Bloque 3 — Coberturas y carencias del plan contratado. */
  readonly plan: string;
  readonly coberturas: readonly CoberturaCertificado[];
  /** Bloque 4 — Pago acreditado. */
  readonly pago: readonly CampoDocumento[];
  /** Bloque 5 — Documento firmado del que cuelga este certificado. */
  readonly respaldo: readonly CampoDocumento[];
  /**
   * La huella del documento firmado, aparte del resto del bloque.
   *
   * Va sola porque son 64 caracteres y en media columna se recorta, y **un
   * hash recortado no sirve para nada**: es justamente el valor que alguien
   * va a comparar contra el archivo que tenga en la mano (fila 47).
   */
  readonly huellaDocumentoFirmado: CampoDocumento;
  /** Bloque de firmas: solo Alianza, prefirmado (D-13). */
  readonly firmantes: readonly CampoDocumento[];
  readonly leyendaFirma: string;
  /** Rótulo de modelo provisional (compuerta de producción §8.E.3). */
  readonly leyendaProvisional: string;
  readonly leyendaNoEsPoliza: string;
  readonly leyendaVerificacion: string;
}

export type CampoFaltanteCertificado =
  | "numeroPropuesta"
  | "plan"
  | "identidad"
  | "canalWhatsapp"
  | "canalEmail"
  | "paqueteDocumental"
  | "firma"
  | "pagoConfirmado";

export type ResultadoContenidoCertificado =
  | { readonly ok: true; readonly contenido: ContenidoCertificado }
  | { readonly ok: false; readonly faltantes: readonly CampoFaltanteCertificado[] };

export interface OpcionesCertificado {
  /** Instante de emisión: el mismo con el que se confirma el pago. */
  readonly emitidoEn: string;
  readonly version?: number;
  readonly urlBaseVerificacion?: string;
  /**
   * Token público del QR de este certificado. Obligatorio y sin valor por
   * defecto, por el mismo motivo que en `OpcionesContenido`: un QR que cayera
   * en el código visible sería enumerable y nada lo delataría.
   */
  readonly tokenVerificacion: string;
}

const LEYENDA_NO_ES_POLIZA =
  "No es la póliza ni una Nota de Cobertura: la póliza y la factura las emite y envía Alianza Garantía.";

const LEYENDA_PROVISIONAL =
  "Modelo provisional, pendiente del modelo registrado de Alianza Garantía.";

const LEYENDA_FIRMA_CERTIFICADO =
  "Certificado emitido y firmado electrónicamente por el suscriptor autorizado de Alianza " +
  "Garantía. No requiere firma del asegurado: no incorpora obligaciones distintas de las ya " +
  "aceptadas en la Solicitud firmada.";

/**
 * Carencias por cobertura, tal como las declara la Solicitud que la persona
 * firmó. Se repiten acá y no se importan de un solo lugar porque en la
 * Solicitud viajan como una frase única y en el certificado tienen que quedar
 * al lado de cada suma: es el dato que alguien va a buscar con el certificado
 * en la mano.
 */
const CARENCIA_CANCER = "180 días";
const CARENCIA_RENTA = "30 días";
const CARENCIA_GENERAL = "1 día";

// ---------------------------------------------------------------------------
// Armado
// ---------------------------------------------------------------------------

/**
 * Proyecta el expediente ya cobrado sobre el contenido del certificado.
 *
 * Recibe el expediente **con el pago confirmado adentro** —la proyección que
 * `confirmarPagoP7` está por persistir—, no el que todavía espera a Bancard:
 * el certificado se emite en la misma escritura que el cobro, así que el
 * instante de la acreditación ya existe cuando esto corre.
 *
 * Devuelve faltantes en vez de lanzar, igual que `armarContenidoPaquete`: la
 * máquina de estados garantiza que un expediente que llega al cobro los tiene
 * todos, pero el tipo `Expediente` no lo sabe, y un faltante es un error de
 * programación que conviene poder registrar con nombre y apellido.
 */
export function armarContenidoCertificado(
  expediente: Expediente,
  opciones: OpcionesCertificado,
): ResultadoContenidoCertificado {
  const { numeroPropuesta, plan, identidad, canalWhatsapp, canalEmail, paqueteDocumental, firma, pago } =
    expediente;

  const faltantes: CampoFaltanteCertificado[] = [];
  if (!numeroPropuesta) faltantes.push("numeroPropuesta");
  if (!plan) faltantes.push("plan");
  if (!identidad) faltantes.push("identidad");
  if (!canalWhatsapp) faltantes.push("canalWhatsapp");
  if (!canalEmail) faltantes.push("canalEmail");
  if (!paqueteDocumental) faltantes.push("paqueteDocumental");
  if (!firma) faltantes.push("firma");
  // El instante del cobro es el dato del que cuelga toda la vigencia: sin él
  // no hay certificado que emitir.
  if (!pago || !pago.confirmadoEn || !pago.referenciaBancard) faltantes.push("pagoConfirmado");

  if (
    !numeroPropuesta ||
    !plan ||
    !identidad ||
    !canalWhatsapp ||
    !canalEmail ||
    !paqueteDocumental ||
    !firma ||
    !pago ||
    !pago.confirmadoEn ||
    !pago.referenciaBancard
  ) {
    return { ok: false, faltantes };
  }

  const correlativo = numeroPropuesta;
  const version = opciones.version ?? VERSION_INICIAL_CERTIFICADO;
  const codigo = codigoCertificado(correlativo);
  const codigoPaquete = codigoSolicitud(correlativo);
  const base = opciones.urlBaseVerificacion ?? URL_BASE_VERIFICACION_POR_DEFECTO;

  const inicioCobertura = inicioCoberturaDesde(pago.confirmadoEn);
  const finCobertura = finCoberturaDesde(inicioCobertura);
  const datosPlan = PLANES[plan.planId];

  const encabezado: EncabezadoDocumento = {
    codigo,
    // Lo que este certificado respalda es el paquete firmado: el vínculo va
    // impreso, que es lo que pide la fila 47 de la matriz de cumplimiento.
    codigoVinculado: codigoPaquete,
    correlativo,
    version,
    cerradoEn: opciones.emitidoEn,
    titulo: TITULO_CERTIFICADO,
    urlVerificacion: urlDeVerificacion(opciones.tokenVerificacion, base),
    selloDeTiempo: formatearInstante(opciones.emitidoEn),
  };

  return {
    ok: true,
    contenido: {
      encabezado,
      correlativo,
      version,
      emitidoEn: opciones.emitidoEn,
      asegurado: [
        { etiqueta: "Nombres y apellidos", valor: `${identidad.nombres} ${identidad.apellidos}`.trim() },
        { etiqueta: "Cédula", valor: identidad.numeroCedula },
        { etiqueta: "Fecha de nacimiento", valor: formatearFecha(identidad.fechaNacimiento) },
        { etiqueta: "WhatsApp verificado", valor: enmascararCelular(canalWhatsapp.valor) },
        { etiqueta: "Correo verificado", valor: enmascararCorreo(canalEmail.valor) },
        { etiqueta: "Producto", valor: NOMBRE_PRODUCTO },
      ],
      vigencia: [
        { etiqueta: "Pago acreditado", valor: formatearInstante(pago.confirmadoEn) },
        { etiqueta: "Inicio de la cobertura", valor: formatearInstante(inicioCobertura) },
        { etiqueta: "Fin de la vigencia", valor: formatearInstante(finCobertura) },
      ],
      leyendaInicioCobertura:
        `La cobertura comienza ${HORAS_HASTA_INICIO_COBERTURA} horas exactas después del pago ` +
        "acreditado y rige por un año.",
      plan: datosPlan.nombre,
      coberturas: [
        {
          rotulo: "Diagnóstico de cáncer",
          sumaAsegurada: formatearGuaranies(datosPlan.indemnizacionCancerGs),
          carencia: CARENCIA_CANCER,
        },
        {
          rotulo: "Fallecimiento por cualquier causa",
          sumaAsegurada: formatearGuaranies(datosPlan.muerteCualquierCausaGs),
          carencia: CARENCIA_GENERAL,
        },
        {
          rotulo: "Renta hospitalaria · máx. 15 días",
          sumaAsegurada: `${formatearGuaranies(datosPlan.rentaHospitalariaTotalGs)} · ${formatearGuaranies(
            datosPlan.rentaHospitalariaPorDiaGs,
          )}/día`,
          carencia: CARENCIA_RENTA,
        },
        {
          rotulo: "Gastos médicos por accidente",
          sumaAsegurada: formatearGuaranies(datosPlan.gastosMedicosAccidenteGs),
          carencia: CARENCIA_GENERAL,
        },
      ],
      pago: [
        { etiqueta: "Premio anual · IVA incluido", valor: formatearGuaranies(pago.montoGs) },
        { etiqueta: "Medio de pago", valor: medioLegible(pago.medio) },
        { etiqueta: "Referencia Bancard", valor: pago.referenciaBancard },
        { etiqueta: "Código del plan registrado", valor: REGISTRO_PRODUCTO.codigo },
      ],
      respaldo: [
        { etiqueta: "Solicitud y FIPF firmados", valor: codigoPaquete },
        { etiqueta: "Acto de firma", valor: firma.idCode100 },
        { etiqueta: "Firmado el", valor: formatearInstante(firma.firmadoEn) },
      ],
      huellaDocumentoFirmado: {
        etiqueta: "Huella SHA-256 del documento firmado",
        valor: firma.hashDocumentoFirmado,
      },
      firmantes: firmantesDe("CPC").map((firmante) => ({
        etiqueta: firmante.rotulo,
        valor: firmante.leyenda,
      })),
      leyendaFirma: LEYENDA_FIRMA_CERTIFICADO,
      leyendaProvisional: LEYENDA_PROVISIONAL,
      leyendaNoEsPoliza: LEYENDA_NO_ES_POLIZA,
      leyendaVerificacion: `Verificá la autenticidad de este certificado en ${encabezado.urlVerificacion}`,
    },
  };
}

/** Cómo se nombra el medio de pago en el documento. Nunca datos de tarjeta (regla #6). */
function medioLegible(medio: MedioDePago): string {
  switch (medio) {
    case "QR_BANCARD":
      return "QR Bancard";
    case "TARJETA_CREDITO":
      return "Tarjeta de crédito (Bancard)";
    case "TARJETA_DEBITO":
      return "Tarjeta de débito (Bancard)";
  }
}
