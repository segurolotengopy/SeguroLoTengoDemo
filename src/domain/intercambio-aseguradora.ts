/**
 * Reglas del intercambio documental con la aseguradora (Alianza Garantía) —
 * ítem 36 de `docs/Tabla de Integraciones externas - Tabla.csv`.
 *
 * Es el lado de dominio del puerto `IntercambioAseguradora`: qué documentos
 * pueden viajar, cómo se llaman del otro lado y qué configuración rige. No
 * importa `node:*` ni ningún SDK: la huella la calcula el adaptador.
 *
 * ## Qué documentos firma Alianza: configuración, no código
 *
 * Sigue abierto (P1, conflictos C-4 y C-5 del análisis de las pantallas v4). El
 * CPC es seguro; la Solicitud + FIPF está en duda. Por eso la lista vive en
 * `INTERCAMBIO_ASEGURADORA_DOCUMENTOS` y **no tiene valor por defecto**: sin
 * configurarla, ningún documento sale. Este módulo sabe qué tipos *podrían*
 * viajar —los que produce el motor documental— y nada más.
 *
 * ## El nombre del archivo no puede llevar datos de la persona
 *
 * Los logs del conector de Transfer Family registran rutas de archivo, y el
 * servidor de Alianza también. Un nombre con el apellido o la cédula sería
 * una fuga por un canal que nadie revisa (regla inviolable #7). Por eso el
 * nombre remoto **no lo elige quien llama**: se deriva del código y la versión
 * (`CPC-00018425-v1.pdf`), que son los mismos que ya imprime el documento.
 */

/**
 * Tipos de documento que el intercambio sabe mover. Son los prefijos de los
 * códigos del motor documental (`src/documentos/`): `PROP-<correlativo>` es el
 * PDF único de Solicitud + FIPF (D-11) y `CPC-<correlativo>` el Certificado de
 * Cobertura Provisional (D-12). El comprobante de pago y la constancia no
 * figuran: no los firma nadie más.
 */
export const TIPOS_DOCUMENTO_INTERCAMBIO = ["CPC", "PROP"] as const;
export type TipoDocumentoIntercambio = (typeof TIPOS_DOCUMENTO_INTERCAMBIO)[number];

/** Las dos bandejas de las que se recibe: documentos firmados y archivos de respuesta. */
export type CarpetaRecepcion = "DOCUMENTOS_FIRMADOS" | "RESPUESTAS";

export interface CarpetasRemotas {
  /** Dónde se depositan los documentos a firmar (en el servidor de Alianza). */
  readonly envio: string;
  /** Dónde Alianza deja los documentos firmados. */
  readonly documentosFirmados: string;
  /** Dónde Alianza deja los archivos de respuesta (recibido, rechazo, error). */
  readonly respuestas: string;
  /** Subcarpeta, dentro de cada carpeta de recepción, adonde se mueve lo ya procesado. */
  readonly procesados: string;
}

export interface ConfiguracionIntercambioAseguradora {
  /** Tipos que la aseguradora firma y que por eso se le mandan. Vacío = no sale nada. */
  readonly documentosHabilitados: readonly TipoDocumentoIntercambio[];
  readonly carpetas: CarpetasRemotas;
}

/**
 * Carpetas propuestas en el borrador del correo a Alianza (punto 2.5), desde el
 * punto de vista del servidor de Alianza: `entrada/` es lo que le llega,
 * `salida/` lo que devuelve. **No están confirmadas**: se pisan por entorno.
 */
export const CARPETAS_REMOTAS_PROPUESTAS: CarpetasRemotas = {
  envio: "/entrada/documentos",
  documentosFirmados: "/salida/documentos",
  respuestas: "/salida/respuestas",
  procesados: "procesados",
};

type Entorno = Readonly<Record<string, string | undefined>>;

function carpetaAbsoluta(valor: string | undefined, porDefecto: string): string {
  const limpio = (valor ?? "").trim().replace(/\/+$/, "");
  if (limpio === "") return porDefecto;
  return limpio.startsWith("/") ? limpio : `/${limpio}`;
}

/**
 * Lee la configuración del entorno.
 *
 * - `INTERCAMBIO_ASEGURADORA_DOCUMENTOS`: lista separada por comas (`CPC` o
 *   `CPC,PROP`). Un valor que no sea un tipo conocido **tira**: un error de
 *   tipeo no puede dejar de mandar el CPC en silencio.
 * - `ALIANZA_SFTP_CARPETA_ENVIO`, `…_FIRMADOS`, `…_RESPUESTAS`: carpetas remotas.
 */
export function leerConfiguracionIntercambio(entorno: Entorno = process.env): ConfiguracionIntercambioAseguradora {
  const declarados = (entorno.INTERCAMBIO_ASEGURADORA_DOCUMENTOS ?? "")
    .split(",")
    .map((valor) => valor.trim().toUpperCase())
    .filter((valor) => valor !== "");

  const desconocidos = declarados.filter((valor) => !esTipoDocumentoIntercambio(valor));
  if (desconocidos.length > 0) {
    throw new Error(
      `INTERCAMBIO_ASEGURADORA_DOCUMENTOS tiene tipos desconocidos (${desconocidos.join(", ")}). ` +
        `Los admitidos son ${TIPOS_DOCUMENTO_INTERCAMBIO.join(", ")}.`,
    );
  }

  return {
    documentosHabilitados: [...new Set(declarados.filter(esTipoDocumentoIntercambio))],
    carpetas: {
      envio: carpetaAbsoluta(entorno.ALIANZA_SFTP_CARPETA_ENVIO, CARPETAS_REMOTAS_PROPUESTAS.envio),
      documentosFirmados: carpetaAbsoluta(
        entorno.ALIANZA_SFTP_CARPETA_FIRMADOS,
        CARPETAS_REMOTAS_PROPUESTAS.documentosFirmados,
      ),
      respuestas: carpetaAbsoluta(entorno.ALIANZA_SFTP_CARPETA_RESPUESTAS, CARPETAS_REMOTAS_PROPUESTAS.respuestas),
      procesados: CARPETAS_REMOTAS_PROPUESTAS.procesados,
    },
  };
}

export function esTipoDocumentoIntercambio(valor: string): valor is TipoDocumentoIntercambio {
  return (TIPOS_DOCUMENTO_INTERCAMBIO as readonly string[]).includes(valor);
}

export function carpetaRemotaDeRecepcion(carpetas: CarpetasRemotas, carpeta: CarpetaRecepcion): string {
  return carpeta === "DOCUMENTOS_FIRMADOS" ? carpetas.documentosFirmados : carpetas.respuestas;
}

/** Nombre del PDF del otro lado. Solo código y versión: nada de la persona. */
export function nombreArchivoRemoto(codigo: string, version: number): string {
  return `${codigo}-v${version}.pdf`;
}

/** Nombre del metadato que viaja al lado del PDF. */
export function nombreMetadatoRemoto(codigo: string, version: number): string {
  return `${codigo}-v${version}.json`;
}

/**
 * Sufijo con el que se sube y que se quita al terminar (borrador, punto 3.3):
 * un archivo `.tmp` es un archivo que todavía se está escribiendo, y ninguno
 * de los dos lados lo procesa. La recepción los ignora al listar.
 */
export const SUFIJO_EN_CURSO = ".tmp";

/**
 * Un nombre que llega del servidor remoto es dato no confiable: se lo usa como
 * último segmento de una ruta, así que no puede traer separadores ni `..`.
 */
export function nombreRemotoAceptable(nombre: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/.test(nombre) && !nombre.includes("..") && !nombre.endsWith(SUFIJO_EN_CURSO);
}

export interface DocumentoAEnviar {
  readonly tipo: TipoDocumentoIntercambio;
  /** `CPC-00018425`, `PROP-00018425`. */
  readonly codigo: string;
  /** Ocho dígitos, el mismo del código. */
  readonly correlativo: string;
  readonly version: number;
}

export type MotivoDocumentoInvalido =
  | "CODIGO_NO_CORRESPONDE_AL_TIPO"
  | "CORRELATIVO_NO_CORRESPONDE"
  | "VERSION_INVALIDA";

/**
 * Coherencia entre tipo, código, correlativo y versión. Es lo que garantiza
 * que el nombre derivado sea exactamente `<TIPO>-<8 dígitos>-v<n>.pdf`.
 */
export function validarDocumentoAEnviar(documento: DocumentoAEnviar): MotivoDocumentoInvalido | null {
  if (!/^\d{8}$/.test(documento.correlativo) || documento.codigo !== `${documento.tipo}-${documento.correlativo}`) {
    return /^[A-Z]+-\d{8}$/.test(documento.codigo) && documento.codigo.startsWith(`${documento.tipo}-`)
      ? "CORRELATIVO_NO_CORRESPONDE"
      : "CODIGO_NO_CORRESPONDE_AL_TIPO";
  }
  if (!Number.isInteger(documento.version) || documento.version < 1 || documento.version > 999) {
    return "VERSION_INVALIDA";
  }
  return null;
}

/**
 * Metadato que viaja al lado del PDF, en un JSON con el mismo nombre. Le da a
 * Alianza lo necesario para ubicar el documento y comprobar que no se alteró
 * en el camino, y **nada de la persona**: ni nombre, ni cédula, ni plan.
 *
 * `hashSha256` y `tamanoBytes` son también la base del emparejamiento por
 * prefijo con el que el lote de firma reconoce la revisión incremental que
 * devuelve Alianza (`docs/plan/DISENO_FIRMA_EN_LOTE.md` §2).
 *
 * El formato está propuesto, no acordado: ver el borrador del correo.
 */
export interface MetadatoDocumentoEnviado {
  readonly formato: "segurolotengo.intercambio.v1";
  readonly tipo: TipoDocumentoIntercambio;
  readonly codigo: string;
  readonly correlativo: string;
  readonly version: number;
  readonly archivo: string;
  readonly hashSha256: string;
  readonly tamanoBytes: number;
  readonly enviadoEn: string;
}

export function construirMetadatoEnviado(
  documento: DocumentoAEnviar,
  hashSha256: string,
  tamanoBytes: number,
  enviadoEn: string,
): MetadatoDocumentoEnviado {
  return {
    formato: "segurolotengo.intercambio.v1",
    tipo: documento.tipo,
    codigo: documento.codigo,
    correlativo: documento.correlativo,
    version: documento.version,
    archivo: nombreArchivoRemoto(documento.codigo, documento.version),
    hashSha256,
    tamanoBytes,
    enviadoEn,
  };
}
