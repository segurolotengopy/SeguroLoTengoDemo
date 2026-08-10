/**
 * Servicio de generación de documentos: cierra la Solicitud y el FIPF, los
 * hashea y los guarda, antes de habilitar la firma.
 *
 * Es el paso que separa P7 de P8. Cuando termina, el expediente está en
 * PAQUETE_GENERADO con dos `DocumentoCerrado` —`PROP-…` y `FIPF-…`, mismo
 * correlativo, mismos versión y hash calculados sobre los bytes definitivos— y
 * recién ahí `SignatureProvider.iniciarFirma` tiene algo válido que mandar a
 * Code100.
 *
 * ## Regla de negocio inviolable #4
 *
 * *"Los PDF se cierran y se hashean (SHA-256) antes de habilitar la firma.
 * Cualquier modificación posterior invalida el paquete: hay que regenerar
 * versión y hashes."*
 *
 * Acá eso se cumple en un orden que no admite atajos: se arma el contenido, se
 * renderizan los bytes, se calcula el SHA-256 **sobre esos bytes**, se guardan
 * en S3 y solo entonces se transiciona el expediente. Si algo falla en el
 * medio, el expediente se queda en PAGO_CONFIRMADO y no hay paquete a medio
 * cerrar: `registrarPaqueteDocumental` es una sola escritura con los dos
 * documentos adentro.
 *
 * El hash se calcula acá y **además** lo devuelve el repositorio al guardar;
 * los dos se comparan. Si difirieran, algo alteró el contenido entre el
 * render y el almacenamiento, y eso invalida el paquete: se corta antes de
 * transicionar, en vez de registrar una huella que no corresponde al archivo.
 *
 * Respaldo normativo (`docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`):
 * fila 35, *"Cerrar los documentos antes de firmar y conservar sus huellas
 * digitales"* (Ley 6822/21, arts. 42(5), 61 y 66); fila 77, *"Generar un hash
 * individual para Solicitud, FIPF y póliza"* (Ley 6822/21, arts. 42(5), 44 y
 * 66); fila 47, *"Vincular póliza, Solicitud, FIPF, pago y firmas mediante
 * correlativos o hashes"* (Res. SS SG. 215/15, punto 14).
 *
 * ## Idempotencia
 *
 * Llamarlo con el expediente ya en PAQUETE_GENERADO devuelve el paquete
 * persistido sin volver a renderizar, guardar ni transicionar. Importa porque
 * P8 puede recargarse, y porque regenerar un documento ya cerrado exigiría
 * versión y huellas nuevas (regla #4) — que es justamente lo que no se quiere
 * que pase por recargar una pantalla.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  VERSION_INICIAL_PAQUETE,
  armarContenidoPaquete,
  codigoFipf,
  codigoSolicitud,
} from "../domain/documentos";
import type { CampoFaltante, ContenidoPaquete } from "../domain/documentos";
import { registrarPaqueteDocumental } from "../domain/expediente";
import type { DocumentoCerrado, Expediente, PaqueteDocumental, RegistroEvidencia } from "../domain/tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../domain/verificacion-canal";
import type { EvidenceStore } from "../ports/evidence-store";
import type { SignatureProvider } from "../ports/signature-provider";
import { renderizarFipf, renderizarSolicitud } from "./plantillas";

// ---------------------------------------------------------------------------
// Dependencias
// ---------------------------------------------------------------------------

/**
 * Subconjunto de `ArchivoRepository` que este servicio usa. Se declara como
 * interfaz estructural mínima —igual que `RepositorioExpediente` en
 * `verificacion-canal.ts`— para no arrastrar infraestructura y para que los
 * tests puedan pasar un doble en memoria.
 */
export interface RepositorioArchivos {
  guardarArchivo(
    clave: string,
    contenido: Uint8Array,
    contentType: string,
  ): Promise<{ readonly clave: string; readonly hashSha256: string }>;
}

export interface DependenciasDocumentos {
  readonly expedientes: RepositorioExpediente;
  readonly archivos: RepositorioArchivos;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
  /** Base del enlace que codifica el QR de verificación impreso en cada PDF. */
  readonly urlBaseVerificacion?: string;
}

/** Único estado desde el que se puede cerrar el paquete. */
export const ESTADO_REQUERIDO_DOCUMENTOS = "PAGO_CONFIRMADO";

export const PASO_EVIDENCIA_DOCUMENTOS = "P8_PAQUETE_DOCUMENTAL";

export const CONTENT_TYPE_PDF = "application/pdf";

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export type MotivoRechazoDocumentos =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "EXPEDIENTE_INCOMPLETO"
  | "ALMACENAMIENTO_INCONSISTENTE"
  | "TRANSICION_INVALIDA";

export interface DocumentoGenerado {
  readonly codigo: string;
  readonly version: number;
  readonly hashSha256: string;
  /** Ruta del PDF en el bucket de evidencias. */
  readonly clave: string;
  /**
   * Tamaño del PDF en bytes, o `null` si el paquete ya estaba cerrado y se
   * respondió con lo persistido: no se vuelve a bajar el archivo de S3 solo
   * para informar su tamaño.
   */
  readonly bytes: number | null;
}

export type ResultadoGenerarPaquete =
  | {
      readonly ok: true;
      /** `false` cuando el paquete ya existía y se devolvió el persistido. */
      readonly generado: boolean;
      readonly correlativo: string;
      readonly paquete: PaqueteDocumental;
      readonly solicitud: DocumentoGenerado;
      readonly fipf: DocumentoGenerado;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoDocumentos;
      readonly detalle?: string;
      readonly faltantes?: readonly CampoFaltante[];
    };

// ---------------------------------------------------------------------------
// Claves de S3
// ---------------------------------------------------------------------------

/**
 * Ruta del PDF en el bucket de evidencias. Incluye la versión: cerrar una
 * versión nueva del mismo documento nunca puede sobrescribir la anterior, que
 * es la que quedó hasheada y (eventualmente) firmada.
 */
export function claveDocumento(expedienteId: string, codigo: string, version: number): string {
  return `expedientes/${expedienteId}/documentos/${codigo}-v${version}.pdf`;
}

/**
 * Ruta del PDF **firmado** que devolvió Code100. Va aparte del cerrado y nunca
 * lo pisa: los dos son evidencia, y el cerrado es el que se hasheó antes de
 * firmar (regla inviolable #4). Es el archivo que P9 pone a descargar.
 */
export function claveDocumentoFirmado(expedienteId: string, codigo: string, version: number): string {
  return `expedientes/${expedienteId}/documentos/${codigo}-v${version}-firmado.pdf`;
}

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

function sha256Hex(contenido: Uint8Array): string {
  return createHash("sha256").update(contenido).digest("hex");
}

interface Reloj {
  readonly ahora: () => string;
  readonly nuevoId: () => string;
}

function resolverReloj(deps: DependenciasDocumentos): Reloj {
  return {
    ahora: deps.ahora ?? (() => new Date().toISOString()),
    nuevoId: deps.nuevoId ?? (() => randomUUID()),
  };
}

async function registrarEvidencia(
  deps: DependenciasDocumentos,
  reloj: Reloj,
  entrada: {
    readonly expedienteId: string;
    readonly fecha: string;
    readonly contexto: ContextoPeticion;
    readonly resultado: "EXITOSO" | "FALLIDO";
    readonly detalle: Readonly<Record<string, string | number>>;
    readonly versionTextos?: string;
  },
): Promise<void> {
  const registro: RegistroEvidencia = {
    id: reloj.nuevoId(),
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_DOCUMENTOS,
    fecha: entrada.fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: entrada.versionTextos ?? null,
    // Este paso no pide aceptar nada: la aceptación ocurre al firmar en
    // Code100, no al generar el documento.
    textoAceptado: null,
    resultado: entrada.resultado,
    detalle: Object.entries(entrada.detalle)
      .map(([clave, valor]) => `${clave}=${valor}`)
      .join(" · "),
  };
  await deps.evidencias.guardar(registro);
}

/**
 * Cierra los dos documentos del expediente, los hashea y los guarda.
 *
 * Es la única función que escribe `expediente.paqueteDocumental`, y lo hace
 * pasando por `registrarPaqueteDocumental` — nunca tocando el estado
 * directamente (CLAUDE.md → "Máquina de estados del expediente").
 */
export async function generarPaqueteDocumental(
  deps: DependenciasDocumentos,
  entrada: { readonly expedienteId: string; readonly contexto: ContextoPeticion },
): Promise<ResultadoGenerarPaquete> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  // Ya cerrado: se responde con lo persistido. No se vuelve a renderizar ni a
  // hashear — el paquete cerrado es inmutable (regla inviolable #4).
  const yaCerrado = paqueteYaCerrado(expediente);
  if (yaCerrado) return yaCerrado;

  if (expediente.estado !== ESTADO_REQUERIDO_DOCUMENTOS) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { motivo: "ESTADO_INVALIDO", estado: expediente.estado },
    });
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  const contenido = armarContenidoPaquete(expediente, {
    cerradoEn: fecha,
    version: VERSION_INICIAL_PAQUETE,
    urlBaseVerificacion: deps.urlBaseVerificacion,
  });
  if (!contenido.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { motivo: "EXPEDIENTE_INCOMPLETO", faltantes: contenido.faltantes.join(",") },
    });
    return { ok: false, motivo: "EXPEDIENTE_INCOMPLETO", faltantes: contenido.faltantes };
  }

  const cerrados = await cerrarDocumentos(deps, expediente.id, contenido.contenido);
  if (!cerrados.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { motivo: "ALMACENAMIENTO_INCONSISTENTE", detalle: cerrados.detalle },
    });
    return { ok: false, motivo: "ALMACENAMIENTO_INCONSISTENTE", detalle: cerrados.detalle };
  }

  const paquete: PaqueteDocumental = {
    solicitud: documentoCerrado(cerrados.solicitud, fecha),
    fipf: documentoCerrado(cerrados.fipf, fecha),
  };

  const transicion = registrarPaqueteDocumental(expediente, paquete, fecha);
  if (!transicion.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { motivo: "TRANSICION_INVALIDA", detalle: transicion.error },
    });
    return { ok: false, motivo: "TRANSICION_INVALIDA", detalle: transicion.error };
  }

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  // Evidencia del cierre: códigos, versión y las dos huellas digitales. Es lo
  // que exigen las filas 35, 47 y 77 de la matriz de cumplimiento, y nada
  // más: acá no viaja ningún dato de salud, PEP, cédula ni tarjeta (regla
  // inviolable #7).
  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    versionTextos: contenido.contenido.versionTextos,
    detalle: {
      correlativo: contenido.contenido.correlativo,
      version: contenido.contenido.version,
      solicitud: cerrados.solicitud.codigo,
      hashSolicitud: cerrados.solicitud.hashSha256,
      fipf: cerrados.fipf.codigo,
      hashFipf: cerrados.fipf.hashSha256,
      claveSolicitud: cerrados.solicitud.clave,
      claveFipf: cerrados.fipf.clave,
    },
  });

  return {
    ok: true,
    generado: true,
    correlativo: contenido.contenido.correlativo,
    paquete,
    solicitud: cerrados.solicitud,
    fipf: cerrados.fipf,
  };
}

function documentoCerrado(generado: DocumentoGenerado, cerradoEn: string): DocumentoCerrado {
  return {
    codigo: generado.codigo,
    version: generado.version,
    hashSha256: generado.hashSha256,
    cerradoEn,
  };
}

/** Respuesta idempotente para un expediente que ya tiene el paquete cerrado. */
function paqueteYaCerrado(expediente: Expediente): ResultadoGenerarPaquete | null {
  const paquete = expediente.paqueteDocumental;
  if (!paquete || !expediente.numeroPropuesta) return null;

  const describir = (documento: DocumentoCerrado): DocumentoGenerado => ({
    codigo: documento.codigo,
    version: documento.version,
    hashSha256: documento.hashSha256,
    clave: claveDocumento(expediente.id, documento.codigo, documento.version),
    bytes: null,
  });

  return {
    ok: true,
    generado: false,
    correlativo: expediente.numeroPropuesta,
    paquete,
    solicitud: describir(paquete.solicitud),
    fipf: describir(paquete.fipf),
  };
}

type ResultadoCierre =
  | { readonly ok: true; readonly solicitud: DocumentoGenerado; readonly fipf: DocumentoGenerado }
  | { readonly ok: false; readonly detalle: string };

/**
 * Renderiza, hashea y guarda los dos PDF.
 *
 * Los dos se renderizan y hashean **antes** de guardar ninguno: si el segundo
 * documento no se pudiera generar, no queda uno solo escrito en S3 esperando a
 * un paquete que nunca se va a cerrar.
 */
async function cerrarDocumentos(
  deps: DependenciasDocumentos,
  expedienteId: string,
  contenido: ContenidoPaquete,
): Promise<ResultadoCierre> {
  const bytesSolicitud = renderizarSolicitud(contenido.solicitud);
  const bytesFipf = renderizarFipf(contenido.fipf);

  const documentos = [
    { codigo: codigoSolicitud(contenido.correlativo), bytes: bytesSolicitud },
    { codigo: codigoFipf(contenido.correlativo), bytes: bytesFipf },
  ] as const;

  const guardados: DocumentoGenerado[] = [];
  for (const documento of documentos) {
    const hashSha256 = sha256Hex(documento.bytes);
    const clave = claveDocumento(expedienteId, documento.codigo, contenido.version);
    const guardado = await deps.archivos.guardarArchivo(clave, documento.bytes, CONTENT_TYPE_PDF);

    // El repositorio también hashea lo que efectivamente escribió. Si no
    // coincide con lo que se hasheó acá, el archivo guardado no es el que se
    // está por registrar y el paquete no se cierra.
    if (guardado.hashSha256 !== hashSha256) {
      return {
        ok: false,
        detalle:
          `La huella del archivo guardado no coincide con la del documento renderizado (${documento.codigo}): ` +
          `${guardado.hashSha256} ≠ ${hashSha256}.`,
      };
    }

    guardados.push({
      codigo: documento.codigo,
      version: contenido.version,
      hashSha256,
      clave: guardado.clave,
      bytes: documento.bytes.length,
    });
  }

  return { ok: true, solicitud: guardados[0], fipf: guardados[1] };
}

// ---------------------------------------------------------------------------
// Archivado de los documentos firmados (entrada de P9)
// ---------------------------------------------------------------------------

/**
 * Baja de Code100 los dos PDF firmados y los guarda, para que P9 los pueda
 * ofrecer en `DOCUMENTOS DISPONIBLES PARA DESCARGAR`.
 *
 * **Idempotente sin necesidad de estado nuevo**: si los dos archivos ya están
 * guardados no vuelve a pedirlos. Eso lo hace seguro de llamar en cada carga de
 * P9 y hace que un fallo de red se reintente solo la próxima vez, sin tener que
 * marcar en el expediente si el archivado ya ocurrió.
 *
 * **Verifica la huella antes de dar por bueno el archivo.** El SHA-256 de lo
 * que se guardó tiene que coincidir con el que Code100 reportó en la `Firma` y
 * que ya está en el expediente. Si no coincide, el archivo no es el que se
 * firmó y no se registra como tal (fila 47 de la matriz de cumplimiento:
 * vincular Solicitud, FIPF, pago y firmas mediante correlativos o hashes).
 *
 * **Los dos o ninguno** (regla inviolable #3): las dos huellas se verifican
 * **antes** de escribir ningún archivo, con el mismo criterio que usa
 * `cerrarDocumentos` para el paquete sin firmar. Si el FIPF no coincide, la
 * Solicitud tampoco se guarda — si no, `GET /api/p8/documento?firmado=1` podría
 * servir una Solicitud firmada mientras el FIPF nunca llegó a archivarse.
 */
export interface DependenciasArchivadoFirmados {
  readonly archivos: RepositorioArchivos & {
    obtenerArchivo(clave: string): Promise<Uint8Array | null>;
  };
  readonly firmas: SignatureProvider;
}

export type ResultadoArchivadoFirmados =
  | { readonly ok: true; readonly claveSolicitud: string; readonly claveFipf: string }
  | {
      readonly ok: false;
      readonly motivo: "SIN_FIRMA" | "PROVEEDOR_SIN_DOCUMENTOS" | "HUELLA_NO_COINCIDE";
      readonly detalle?: string;
    };

export async function archivarDocumentosFirmados(
  deps: DependenciasArchivadoFirmados,
  expediente: Expediente,
): Promise<ResultadoArchivadoFirmados> {
  const paquete = expediente.paqueteDocumental;
  const firma = expediente.firma;
  if (!paquete || !firma) return { ok: false, motivo: "SIN_FIRMA" };

  const objetivos = [
    { documento: paquete.solicitud, hashFirmado: firma.hashSolicitudFirmada },
    { documento: paquete.fipf, hashFirmado: firma.hashFipfFirmado },
  ] as const;

  const claves = objetivos.map(({ documento }) =>
    claveDocumentoFirmado(expediente.id, documento.codigo, documento.version),
  );

  const yaGuardados = await Promise.all(claves.map((clave) => deps.archivos.obtenerArchivo(clave)));
  if (yaGuardados.every((bytes) => bytes !== null)) {
    return { ok: true, claveSolicitud: claves[0], claveFipf: claves[1] };
  }

  const documentos = await deps.firmas.descargarDocumentosFirmados(firma.idCode100);
  if (!documentos) return { ok: false, motivo: "PROVEEDOR_SIN_DOCUMENTOS" };

  const bytes = [documentos.solicitud, documentos.fipf] as const;

  // Primero se verifican las dos huellas, sin escribir nada. Recién si las dos
  // corresponden se guardan los archivos.
  for (let indice = 0; indice < objetivos.length; indice += 1) {
    const hash = sha256Hex(bytes[indice]);
    if (hash !== objetivos[indice].hashFirmado) {
      return {
        ok: false,
        motivo: "HUELLA_NO_COINCIDE",
        detalle:
          `El PDF firmado de ${objetivos[indice].documento.codigo} no coincide con la huella registrada: ` +
          `${hash} ≠ ${objetivos[indice].hashFirmado}.`,
      };
    }
  }

  for (let indice = 0; indice < objetivos.length; indice += 1) {
    const guardado = await deps.archivos.guardarArchivo(claves[indice], bytes[indice], CONTENT_TYPE_PDF);
    // El repositorio también hashea lo que efectivamente escribió: si difiere,
    // algo alteró el contenido entre la verificación y el almacenamiento.
    if (guardado.hashSha256 !== objetivos[indice].hashFirmado) {
      return {
        ok: false,
        motivo: "HUELLA_NO_COINCIDE",
        detalle:
          `El archivo guardado de ${objetivos[indice].documento.codigo} no coincide con la huella registrada: ` +
          `${guardado.hashSha256} ≠ ${objetivos[indice].hashFirmado}.`,
      };
    }
  }

  return { ok: true, claveSolicitud: claves[0], claveFipf: claves[1] };
}
