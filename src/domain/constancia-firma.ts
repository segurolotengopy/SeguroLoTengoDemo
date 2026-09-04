/**
 * Constancia del acto de firma del cliente — la evidencia mostrada a la
 * persona que firmó.
 *
 * **Por qué existe.** La firma del cliente es una firma electrónica **no
 * cualificada generada por el propio portal** (D1, ratificada el 30-ago-2026):
 * no hay certificado de un prestador que alguien pueda abrir para ver quién
 * firmó y con qué. Lo que prueba esa firma es el registro de evidencia
 * (`firma-cliente.ts`), y ese registro vivía solo en la consola interna. Quien
 * firmó no tenía forma de ver lo que respalda su propia firma.
 *
 * **Qué muestra, y por qué esos campos.** La Res. SS.SG. 210/2025 art. 4 pide
 * tres cosas de una firma simple respaldada por OTP —identificación del
 * firmante, integridad del documento y trazabilidad de la operación— y su
 * art. 9 enumera lo que hay que conservar: metadatos, dirección IP, fecha y
 * hora y códigos de validación. La constancia se arma sobre esos dos
 * artículos, agrupando la evidencia por el requisito que satisface, porque una
 * lista plana de registros no le dice a nadie qué prueba cada uno.
 *
 * **Qué NO muestra.** Ningún dato de salud ni la condición PEP (regla
 * inviolable #7) y ningún código de OTP (regla inviolable #2): del OTP viaja
 * su identificador, que es lo que cita la evidencia, nunca el código. El
 * canal se muestra enmascarado, tal como quedó asentado.
 *
 * Es una proyección pura del Expediente y de sus registros de evidencia: no
 * lee repositorios, no formatea para pantalla y no decide nada. La firma
 * institucional se lista aparte porque es de otra naturaleza —cualificada, con
 * certificado— y confundirlas sería sugerir que el cliente firmó con un
 * certificado que no tiene.
 */
import { PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE, PASO_EVIDENCIA_OTP_FIRMA_ENVIO } from "./firma-cliente";
import type { ActoDeFirmaCliente } from "./firma-cliente";
import { PASO_EVIDENCIA_VERIFICACION_P5 } from "./verificacion-identidad";
import { formatearInstante } from "./certificado-cobertura";
import {
  URL_BASE_VERIFICACION_POR_DEFECTO,
  codigoConstancia,
  urlDeVerificacion,
} from "./documentos";
import type { CampoDocumento, EncabezadoDocumento } from "./documentos";
import type { CanalFirma, Expediente, RegistroEvidencia } from "./tipos";

// ---------------------------------------------------------------------------
// Identidad del documento (D-27)
// ---------------------------------------------------------------------------

/** Versión con la que nace una constancia. Reemitirla exigiría subirla (regla #4). */
export const VERSION_INICIAL_CONSTANCIA = 1;

export const TITULO_CONSTANCIA = "Constancia del acto de firma electrónica";

export { codigoConstancia };

/** Un hecho probatorio, con la fuente de la que se lee. */
export interface HechoDeLaConstancia {
  readonly etiqueta: string;
  readonly valor: string;
}

/** Un requisito del art. 4, con los hechos que lo satisfacen. */
export interface PilarDeLaConstancia {
  readonly requisito: "IDENTIFICACION" | "INTEGRIDAD" | "TRAZABILIDAD";
  readonly titulo: string;
  readonly explicacion: string;
  readonly hechos: readonly HechoDeLaConstancia[];
}

export interface FirmaInstitucionalDeLaConstancia {
  readonly rol: string;
  readonly nivel: string;
  readonly modalidad: string;
  readonly certificado: string;
  readonly aplicadaEn: string;
}

export interface ConstanciaFirma {
  readonly documento: {
    readonly codigo: string;
    readonly codigoSeccionFipf: string;
    readonly version: number;
    readonly hashSha256: string;
    readonly cerradoEn: string;
  };
  /**
   * Naturaleza de la firma del cliente, dicha sin adornos: es simple / no
   * cualificada y la generó el portal. Decirlo evita que la constancia se lea
   * como un certificado cualificado, que es justamente lo que no es.
   */
  readonly naturaleza: {
    readonly nivel: "SIMPLE_NO_CUALIFICADA";
    readonly emisor: "SEGUROLOTENGO";
    readonly norma: string;
  };
  readonly firmadoEn: string;
  readonly canal: string;
  readonly destinoEnmascarado: string | null;
  readonly pilares: readonly PilarDeLaConstancia[];
  readonly firmasInstitucionales: readonly FirmaInstitucionalDeLaConstancia[];
  /**
   * El PDF cerrado de esta misma constancia (D-27), si el expediente lo
   * registró: código, versión y huella, para descargarlo y cotejarlo. `null`
   * en expedientes firmados antes de D-27.
   */
  readonly pdf: { readonly codigo: string; readonly version: number; readonly hashSha256: string } | null;
  /** Cuántos registros de evidencia respaldan el acto. */
  readonly registrosDeEvidencia: number;
}

export const NORMA_FIRMA_SIMPLE = "Res. SS.SG. N.º 210/2025, arts. 4 y 9";

/**
 * Lo que el acto aporta a la constancia, venga de donde venga.
 *
 * Dos orígenes: al **emitir** el PDF, dentro del propio acto, los datos están
 * en memoria (`ActoDeFirmaCliente`) y el registro de evidencia del acto
 * todavía no existe; al **proyectar** la constancia después, salen del
 * registro. Una sola función arma el contenido para los dos, así el PDF y el
 * panel no pueden decir cosas distintas.
 */
export interface ActoParaConstancia {
  readonly firmadoEn: string;
  readonly referenciaActo: string;
  readonly canal: CanalFirma;
  readonly destinoEnmascarado: string | null;
  readonly ip: string | null;
  readonly dispositivo: string | null;
  readonly sesionId: string | null;
  readonly versionTextoAceptado: string | null;
}

export function actoParaConstancia(acto: ActoDeFirmaCliente): ActoParaConstancia {
  return {
    firmadoEn: acto.firmadoEn,
    referenciaActo: acto.otpId,
    canal: acto.canal,
    destinoEnmascarado: acto.destinoEnmascarado,
    ip: acto.ip,
    dispositivo: acto.dispositivo,
    sesionId: acto.sesionId,
    versionTextoAceptado: acto.versionTextoAceptado,
  };
}

function ultimoExitoso(
  historial: readonly RegistroEvidencia[],
  paso: string,
): RegistroEvidencia | null {
  const candidatos = historial.filter((r) => r.paso === paso && r.resultado === "EXITOSO");
  return candidatos.length > 0 ? (candidatos[candidatos.length - 1] ?? null) : null;
}

/** Lee `clave=valor` del detalle serializado de un registro. */
function delDetalle(registro: RegistroEvidencia | null, clave: string): string | null {
  if (!registro?.detalle) return null;
  for (const parte of registro.detalle.split(" · ")) {
    const separador = parte.indexOf("=");
    if (separador > 0 && parte.slice(0, separador).trim() === clave) {
      return parte.slice(separador + 1).trim();
    }
  }
  return null;
}

function hecho(etiqueta: string, valor: string | null): readonly HechoDeLaConstancia[] {
  return valor ? [{ etiqueta, valor }] : [];
}

/**
 * Proyecta la constancia, o `null` si el expediente todavía no tiene firma del
 * cliente o no tiene paquete cerrado — sin esas dos cosas no hay nada que
 * constatar.
 *
 * Solo constata la firma **interna**: si el acto lo produjo un proveedor, la
 * evidencia que respalda es otra y la constancia mentiría al citar los
 * artículos de la firma simple.
 */
export function proyectarConstanciaFirma(
  expediente: Expediente,
  historial: readonly RegistroEvidencia[],
): ConstanciaFirma | null {
  const { firma, paqueteDocumental } = expediente;
  if (!firma || !paqueteDocumental) return null;
  if (firma.origen !== "INTERNA") return null;

  const registro = ultimoExitoso(historial, PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE);
  const acto: ActoParaConstancia = {
    firmadoEn: firma.firmadoEn,
    referenciaActo: firma.referenciaActo,
    canal: firma.canal,
    destinoEnmascarado: delDetalle(registro, "destino"),
    ip: registro?.ip ?? null,
    dispositivo: registro?.dispositivo ?? null,
    sesionId: registro?.sesionId ?? null,
    versionTextoAceptado: registro?.versionTextoAceptado ?? null,
  };

  return {
    ...armarNucleo(expediente, acto, historial),
    firmasInstitucionales: expediente.firmasInstitucionales.map((f) => ({
      rol: f.rol,
      nivel: f.nivel,
      modalidad: f.modalidad,
      certificado: f.certificado,
      aplicadaEn: f.aplicadaEn,
    })),
    pdf: expediente.constanciaFirma
      ? {
          codigo: expediente.constanciaFirma.codigo,
          version: expediente.constanciaFirma.version,
          hashSha256: expediente.constanciaFirma.hashSha256,
        }
      : null,
    registrosDeEvidencia: historial.filter((r) => r.paso.startsWith("FIRMA_CLIENTE_")).length,
  };
}

/** Lo común al panel y al PDF: documento, naturaleza y los tres pilares. */
function armarNucleo(
  expediente: Expediente,
  acto: ActoParaConstancia,
  historial: readonly RegistroEvidencia[],
): Omit<ConstanciaFirma, "firmasInstitucionales" | "pdf" | "registrosDeEvidencia"> {
  const paqueteDocumental = expediente.paqueteDocumental!;
  const envioOtp = ultimoExitoso(historial, PASO_EVIDENCIA_OTP_FIRMA_ENVIO);
  const identidad = ultimoExitoso(historial, PASO_EVIDENCIA_VERIFICACION_P5);
  const destino = acto.destinoEnmascarado;
  const biometria = expediente.identidad?.captura ?? {
    hashFrenteCedula: "",
    hashDorsoCedula: "",
    hashSelfie: "",
    pruebaDeVidaAprobada: false,
    coincidenciaFacialAprobada: false,
  };

  const pilares: readonly PilarDeLaConstancia[] = [
    {
      requisito: "IDENTIFICACION",
      titulo: "Quién firmó",
      explicacion:
        "Tu identidad se verificó antes de firmar, y el código de un solo uso se envió al canal que ya habías verificado.",
      hechos: [
        // Quién es la persona, con lo que quedó en el expediente. Es su propia
        // constancia: sin el nombre, la cédula y la fecha de nacimiento, el
        // panel prueba que *alguien* firmó, no que firmó ella (pedido de
        // Andres, 01-sep).
        ...hecho(
          "Titular",
          expediente.identidad
            ? `${expediente.identidad.nombres} ${expediente.identidad.apellidos}`.trim()
            : null,
        ),
        ...hecho("Cédula de identidad", expediente.identidad?.numeroCedula ?? null),
        ...hecho("Fecha de nacimiento", expediente.identidad?.fechaNacimiento ?? null),
        ...hecho("Identidad verificada el", identidad?.fecha ?? null),
        ...hecho("IP de la verificación de identidad", identidad?.ip ?? null),
        // La biometría, por su resultado y por la huella de cada captura: las
        // imágenes no se guardan (solo su SHA-256 y la referencia del
        // proveedor), así que esto es lo que hay para probarla.
        ...hecho(
          "Prueba de vida",
          expediente.identidad ? (biometria.pruebaDeVidaAprobada ? "Aprobada" : "No aprobada") : null,
        ),
        ...hecho(
          "Coincidencia facial con la cédula",
          expediente.identidad
            ? biometria.coincidenciaFacialAprobada
              ? "Aprobada"
              : "No aprobada"
            : null,
        ),
        ...hecho("Huella de la foto del frente", biometria.hashFrenteCedula),
        ...hecho("Huella de la foto del dorso", biometria.hashDorsoCedula),
        ...hecho("Huella de la selfie", biometria.hashSelfie),
        ...hecho("Canal del código", destino ?? null),
        ...hecho("Código de validación (referencia)", acto.referenciaActo),
        ...hecho("Código enviado el", envioOtp?.fecha ?? null),
      ],
    },
    {
      requisito: "INTEGRIDAD",
      titulo: "Qué firmaste",
      explicacion:
        "El documento se cerró y se le calculó una huella SHA-256 antes de habilitar la firma. Cualquier cambio posterior da una huella distinta.",
      hechos: [
        {
          etiqueta: "Documento",
          valor: `${paqueteDocumental.codigo} v${paqueteDocumental.version}`,
        },
        {
          etiqueta: "Sección FIPF",
          valor: paqueteDocumental.codigoSeccionFipf,
        },
        { etiqueta: "Huella SHA-256", valor: paqueteDocumental.hashSha256 },
        { etiqueta: "Cerrado el", valor: paqueteDocumental.cerradoEn },
      ],
    },
    {
      requisito: "TRAZABILIDAD",
      titulo: "Desde dónde y cuándo",
      explicacion:
        "El acto quedó asentado con su fecha, su dirección IP y su dispositivo, en un registro que no se sobrescribe ni se borra.",
      hechos: [
        { etiqueta: "Firmado el", valor: acto.firmadoEn },
        ...hecho("Dirección IP", acto.ip),
        ...hecho("Dispositivo", acto.dispositivo),
        ...hecho("Sesión", acto.sesionId),
        ...hecho("Versión del texto aceptado", acto.versionTextoAceptado),
      ],
    },
  ];

  return {
    documento: {
      codigo: paqueteDocumental.codigo,
      codigoSeccionFipf: paqueteDocumental.codigoSeccionFipf,
      version: paqueteDocumental.version,
      hashSha256: paqueteDocumental.hashSha256,
      cerradoEn: paqueteDocumental.cerradoEn,
    },
    naturaleza: {
      nivel: "SIMPLE_NO_CUALIFICADA",
      emisor: "SEGUROLOTENGO",
      norma: NORMA_FIRMA_SIMPLE,
    },
    firmadoEn: acto.firmadoEn,
    canal: acto.canal,
    destinoEnmascarado: destino,
    pilares,
  };
}

// ---------------------------------------------------------------------------
// Contenido del PDF (D-27)
// ---------------------------------------------------------------------------

export interface PilarDelPdf {
  readonly titulo: string;
  readonly explicacion: string;
  readonly hechos: readonly CampoDocumento[];
}

export interface ContenidoConstancia {
  readonly encabezado: EncabezadoDocumento;
  readonly correlativo: string;
  readonly version: number;
  readonly firmadoEn: string;
  readonly leyendaQueEs: string;
  readonly naturaleza: readonly CampoDocumento[];
  /** Los tres requisitos del art. 4, con sus hechos ya legibles (instantes formateados). */
  readonly pilares: readonly PilarDelPdf[];
  readonly leyendaNorma: string;
  readonly leyendaNoEsCertificado: string;
  readonly leyendaVerificacion: string;
}

export type CampoFaltanteConstancia = "numeroPropuesta" | "paqueteDocumental" | "identidad";

export type ResultadoContenidoConstancia =
  | { readonly ok: true; readonly contenido: ContenidoConstancia }
  | { readonly ok: false; readonly faltantes: readonly CampoFaltanteConstancia[] };

export interface OpcionesConstancia {
  readonly version?: number;
  readonly urlBaseVerificacion?: string;
}

const LEYENDA_QUE_ES =
  "Este documento deja constancia del acto por el cual el proponente firmó electrónicamente la " +
  "Solicitud de Seguro y el FIPF. La firma es electrónica no cualificada, generada por el portal " +
  "SeguroLoTengo.com de Interseguros S.A., y lo que la prueba es la evidencia que acá se enumera.";
const LEYENDA_NORMA =
  "Resolución SS.SG. N.º 210/2025, Anexo I. Art. 4: la propuesta y los documentos precontractuales " +
  "pueden suscribirse con firma electrónica simple respaldada por un mecanismo de autenticación " +
  "previo (OTP u otro medio técnicamente idóneo) que garantice la identificación del firmante, el " +
  "origen e integridad de sus datos y la trazabilidad de la operación. Art. 9: se conservan metadatos, " +
  "dirección IP, fecha y hora y códigos de validación, disponibles para el cliente y la " +
  "Superintendencia de Seguros por un mínimo de dos años desde el vencimiento de la póliza.";
const LEYENDA_NO_ES_CERTIFICADO =
  "No es un certificado de firma electrónica ni un documento de un prestador de servicios de " +
  "confianza: es el registro probatorio del acto, emitido y conservado por el portal. No acredita " +
  "cobertura ni reemplaza a la Solicitud firmada, al certificado de cobertura ni a la póliza.";
const LEYENDA_VERIFICACION =
  "La huella SHA-256 de esta constancia se publica en la página de verificación del documento " +
  "firmado y en la de su propio código, sin ningún dato personal, para que cualquiera pueda " +
  "comprobar que este archivo es el que se emitió.";

/** Un instante ISO 8601 (con hora) se imprime formateado; cualquier otro valor va tal cual. */
function legible(valor: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valor) ? formatearInstante(valor) : valor;
}

function canalLegible(canal: CanalFirma): string {
  return canal === "WHATSAPP" ? "WhatsApp verificado" : "Correo electrónico verificado";
}

/**
 * Arma el contenido del PDF de la constancia a partir de lo que el acto sabe
 * en el momento de firmar. Los tres pilares son los mismos del panel —salen de
 * la misma función—, así que el documento no puede afirmar nada que el panel
 * no muestre, ni al revés.
 */
export function armarContenidoConstancia(
  expediente: Expediente,
  acto: ActoParaConstancia,
  historial: readonly RegistroEvidencia[],
  opciones: OpcionesConstancia = {},
): ResultadoContenidoConstancia {
  const { numeroPropuesta, paqueteDocumental, identidad } = expediente;
  const faltantes: CampoFaltanteConstancia[] = [];
  if (!numeroPropuesta) faltantes.push("numeroPropuesta");
  if (!paqueteDocumental) faltantes.push("paqueteDocumental");
  if (!identidad) faltantes.push("identidad");
  if (!numeroPropuesta || !paqueteDocumental || !identidad) return { ok: false, faltantes };

  const correlativo = numeroPropuesta;
  const version = opciones.version ?? VERSION_INICIAL_CONSTANCIA;
  const codigo = codigoConstancia(correlativo);
  const base = opciones.urlBaseVerificacion ?? URL_BASE_VERIFICACION_POR_DEFECTO;
  const nucleo = armarNucleo(expediente, acto, historial);

  const encabezado: EncabezadoDocumento = {
    codigo,
    // De qué acto es constancia: el paquete que el cliente firmó.
    codigoVinculado: paqueteDocumental.codigo,
    correlativo,
    version,
    cerradoEn: acto.firmadoEn,
    titulo: TITULO_CONSTANCIA,
    urlVerificacion: urlDeVerificacion(codigo, base),
    selloDeTiempo: formatearInstante(acto.firmadoEn),
  };

  return {
    ok: true,
    contenido: {
      encabezado,
      correlativo,
      version,
      firmadoEn: acto.firmadoEn,
      leyendaQueEs: LEYENDA_QUE_ES,
      naturaleza: [
        { etiqueta: "Tipo de firma", valor: "Electrónica no cualificada (firma simple)" },
        { etiqueta: "Generada por", valor: "SeguroLoTengo.com · Interseguros S.A." },
        { etiqueta: "Norma que la admite", valor: NORMA_FIRMA_SIMPLE },
        { etiqueta: "Canal del código de un solo uso", valor: canalLegible(acto.canal) },
        { etiqueta: "Destino del código", valor: acto.destinoEnmascarado ?? "—" },
        { etiqueta: "Referencia del acto", valor: acto.referenciaActo },
      ],
      // Los mismos tres pilares del panel, con los instantes ya formateados: el
      // panel los formatea en pantalla; el PDF no tiene quién lo haga después.
      pilares: nucleo.pilares.map((pilar) => ({
        titulo: pilar.titulo,
        explicacion: pilar.explicacion,
        hechos: pilar.hechos.map((h) => ({ etiqueta: h.etiqueta, valor: legible(h.valor) })),
      })),
      leyendaNorma: LEYENDA_NORMA,
      leyendaNoEsCertificado: LEYENDA_NO_ES_CERTIFICADO,
      leyendaVerificacion: LEYENDA_VERIFICACION,
    },
  };
}
