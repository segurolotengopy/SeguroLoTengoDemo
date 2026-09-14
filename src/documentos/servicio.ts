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
 * correlativos o hashes"* (Res. SS SG. 215/17, punto 14).
 *
 * ## Idempotencia
 *
 * Llamarlo con el expediente ya en PAQUETE_GENERADO devuelve el paquete
 * persistido sin volver a renderizar, guardar ni transicionar. Importa porque
 * P8 puede recargarse, y porque regenerar un documento ya cerrado exigiría
 * versión y huellas nuevas (regla #4) — que es justamente lo que no se quiere
 * que pase por recargar una pantalla.
 */
import { createHash, randomInt, randomUUID } from "node:crypto";
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
import {
  renderizarCertificado,
  renderizarComprobante,
  renderizarConstancia,
  renderizarPaquete,
} from "./plantillas";
import {
  VERSION_INICIAL_CONSTANCIA,
  actoParaConstancia,
  armarContenidoConstancia,
  codigoConstancia,
} from "../domain/constancia-firma";
import type { CampoFaltanteConstancia } from "../domain/constancia-firma";
import type { ActoDeFirmaCliente } from "../domain/firma-cliente";
import { armarContenidoComprobante } from "../domain/comprobante-pago";
import type { CampoFaltanteComprobante } from "../domain/comprobante-pago";
import {
  VERSION_INICIAL_CERTIFICADO,
  armarContenidoCertificado,
  codigoCertificado,
  finCoberturaDesde,
  inicioCoberturaDesde,
} from "../domain/certificado-cobertura";
import type { CampoFaltanteCertificado } from "../domain/certificado-cobertura";
import { firmantesDe } from "../domain/firmantes-documento";
import type { CertificadoCobertura, ConstanciaFirmaEmitida, FirmaInstitucional } from "../domain/tipos";

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
  /** Inyectable solo para que los tests puedan fijar el correlativo. */
  readonly nuevoNumeroPropuesta?: () => string;
  /** Base del enlace que codifica el QR de verificación impreso en cada PDF. */
  readonly urlBaseVerificacion?: string;
}

/**
 * Único estado desde el que se puede cerrar el paquete.
 *
 * Era `PAGO_CONFIRMADO` mientras se cobraba antes de firmar. Con el orden
 * invertido (D-08) los documentos se cierran para poder firmarlos, así que se
 * cierran apenas las declaraciones resultan compatibles y **antes** de que
 * exista ninguna operación de pago.
 */
export const ESTADO_REQUERIDO_DOCUMENTOS = "DECLARACIONES_OK";

export const LARGO_NUMERO_PROPUESTA = 8;

/**
 * Acuña el correlativo de la propuesta / futura póliza: `00018425` en la
 * especificación. `codigoSolicitud` y `codigoFipf` le ponen los prefijos —
 * **un solo correlativo, dos prefijos**.
 *
 * **Lo acuña el cierre del paquete, no el pago** (D-08). Mientras se cobraba
 * primero, el número nacía al abrir la operación en Bancard y los documentos
 * lo heredaban; invertido el orden, los documentos se cierran antes de que
 * exista ninguna operación de pago, así que el número tiene que nacer con
 * ellos y el pago pasa a ser uno más de los que lo citan.
 *
 * Vive acá y no en `src/domain/documentos.ts` porque necesita `node:crypto` y
 * ese módulo es deliberadamente libre de `node:*` para poder viajar al
 * navegador.
 *
 * Mismo criterio que `generarNumeroCaso` en `declaraciones-p6.ts`: ocho
 * dígitos de `randomInt` (CSPRNG) y no un contador, porque en el demo no hay
 * secuencia central y un correlativo adivinable expondría cuántas propuestas
 * existen. El formato es decisión de producto: no tiene fila en la matriz de
 * cumplimiento.
 */
export function generarNumeroPropuesta(): string {
  return String(randomInt(0, 10 ** LARGO_NUMERO_PROPUESTA)).padStart(LARGO_NUMERO_PROPUESTA, "0");
}

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
      /** El documento único del expediente (D-11). */
      readonly documento: DocumentoGenerado;
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

  // El correlativo se acuña acá, una sola vez y en memoria: recién se persiste
  // junto con el paquete, en la misma escritura. Si el cierre falla más abajo
  // no queda un número reservado sin documentos que lo lleven.
  const conCorrelativo: Expediente =
    expediente.numeroPropuesta
      ? expediente
      : { ...expediente, numeroPropuesta: (deps.nuevoNumeroPropuesta ?? generarNumeroPropuesta)() };

  const contenido = armarContenidoPaquete(conCorrelativo, {
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

  const cerrado = await cerrarDocumento(deps, conCorrelativo.id, contenido.contenido);
  if (!cerrado.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { motivo: "ALMACENAMIENTO_INCONSISTENTE", detalle: cerrado.detalle },
    });
    return { ok: false, motivo: "ALMACENAMIENTO_INCONSISTENTE", detalle: cerrado.detalle };
  }

  const paquete: PaqueteDocumental = documentoCerrado(
    cerrado.documento,
    fecha,
    codigoFipf(contenido.contenido.correlativo),
  );

  const transicion = registrarPaqueteDocumental(conCorrelativo, paquete, fecha);
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

  // Evidencia del cierre: códigos, versión y la huella digital. Es lo que
  // exigen las filas 35, 47 y 77 de la matriz de cumplimiento, y nada más:
  // acá no viaja ningún dato de salud, PEP, cédula ni tarjeta (regla
  // inviolable #7). Con el documento único hay **una** huella, no dos: la
  // fila 77 exige el hash del instrumento, y el instrumento ahora es uno.
  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    versionTextos: contenido.contenido.versionTextos,
    detalle: {
      correlativo: contenido.contenido.correlativo,
      version: contenido.contenido.version,
      documento: cerrado.documento.codigo,
      seccionFipf: paquete.codigoSeccionFipf,
      hashDocumento: cerrado.documento.hashSha256,
      clave: cerrado.documento.clave,
    },
  });

  return {
    ok: true,
    generado: true,
    correlativo: contenido.contenido.correlativo,
    paquete,
    documento: cerrado.documento,
  };
}

function documentoCerrado(
  generado: DocumentoGenerado,
  cerradoEn: string,
  codigoSeccionFipf: string,
): DocumentoCerrado {
  return {
    codigo: generado.codigo,
    version: generado.version,
    hashSha256: generado.hashSha256,
    cerradoEn,
    codigoSeccionFipf,
  };
}

/** Respuesta idempotente para un expediente que ya tiene el paquete cerrado. */
function paqueteYaCerrado(expediente: Expediente): ResultadoGenerarPaquete | null {
  const paquete = expediente.paqueteDocumental;
  if (!paquete || !expediente.numeroPropuesta) return null;

  return {
    ok: true,
    generado: false,
    correlativo: expediente.numeroPropuesta,
    paquete,
    documento: {
      codigo: paquete.codigo,
      version: paquete.version,
      hashSha256: paquete.hashSha256,
      clave: claveDocumento(expediente.id, paquete.codigo, paquete.version),
      bytes: null,
    },
  };
}

type ResultadoCierre =
  | { readonly ok: true; readonly documento: DocumentoGenerado }
  | { readonly ok: false; readonly detalle: string };

/**
 * Renderiza, hashea y guarda **el** PDF.
 *
 * Era `cerrarDocumentos`, en plural, y su trabajo más delicado era el orden:
 * renderizar y hashear los dos antes de guardar ninguno, para que un fallo a
 * mitad no dejara un archivo solo en S3 esperando a un paquete que nunca se
 * iba a cerrar. Con el documento único (D-11) ese cuidado desapareció junto
 * con el problema: hay un archivo, y o se guarda o no.
 */
async function cerrarDocumento(
  deps: DependenciasDocumentos,
  expedienteId: string,
  contenido: ContenidoPaquete,
): Promise<ResultadoCierre> {
  const bytes = renderizarPaquete(contenido);
  const codigo = codigoSolicitud(contenido.correlativo);

  const hashSha256 = sha256Hex(bytes);
  const clave = claveDocumento(expedienteId, codigo, contenido.version);
  const guardado = await deps.archivos.guardarArchivo(clave, bytes, CONTENT_TYPE_PDF);

  // El repositorio también hashea lo que efectivamente escribió. Si no
  // coincide con lo que se hasheó acá, el archivo guardado no es el que se
  // está por registrar y el paquete no se cierra.
  if (guardado.hashSha256 !== hashSha256) {
    return {
      ok: false,
      detalle:
        `La huella del archivo guardado no coincide con la del documento renderizado (${codigo}): ` +
        `${guardado.hashSha256} ≠ ${hashSha256}.`,
    };
  }

  return {
    ok: true,
    documento: {
      codigo,
      version: contenido.version,
      hashSha256,
      clave: guardado.clave,
      bytes: bytes.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Certificado de Cobertura Provisional (D-12, CHG-42)
// ---------------------------------------------------------------------------

/**
 * Ruta del CPC en el bucket de evidencias. **La huella forma parte de la
 * clave**, y no es un adorno: es lo que hace imposible que dos emisiones
 * simultáneas se pisen.
 *
 * El caso concreto: la pantalla de pago sondea en bucle y dos sondeos pueden
 * solaparse. Los dos leen el expediente todavía en `FIRMADO`, los dos emiten
 * un certificado —con instantes distintos, así que con bytes distintos— y los
 * dos escriben en S3; después, el bloqueo optimista deja que solo uno asiente
 * su certificado en el expediente. Con una clave que dependiera únicamente del
 * código y la versión, el perdedor podía escribir último y dejar en S3 un
 * archivo cuya huella no era la registrada: la descarga fallaba con
 * `HUELLA_NO_COINCIDE` sobre un expediente perfectamente sano.
 *
 * Con la huella en la clave, cada emisión escribe en su propio lugar. El
 * archivo del perdedor queda huérfano —no lo referencia ningún expediente, así
 * que no afirma nada de nadie— y el del ganador es, por construcción,
 * exactamente el que su huella dice.
 */
export function claveCertificado(
  expedienteId: string,
  codigo: string,
  version: number,
  hashSha256: string,
): string {
  return `expedientes/${expedienteId}/documentos/${codigo}-v${version}-${hashSha256}.pdf`;
}

export const PASO_EVIDENCIA_CERTIFICADO = "P7_CERTIFICADO_COBERTURA";

export type MotivoRechazoCertificado =
  | "EXPEDIENTE_INCOMPLETO"
  | "ALMACENAMIENTO_INCONSISTENTE";

export type ResultadoEmitirCertificado =
  | {
      readonly ok: true;
      readonly certificado: CertificadoCobertura;
      readonly clave: string;
      readonly bytes: number;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoCertificado;
      readonly detalle?: string;
      readonly faltantes?: readonly CampoFaltanteCertificado[];
    };

export interface DependenciasCertificado {
  readonly archivos: RepositorioArchivos;
  readonly urlBaseVerificacion?: string;
}

/**
 * Renderiza, hashea y guarda el Certificado de Cobertura Provisional, y
 * devuelve su ficha — **sin tocar el expediente**.
 *
 * Que no persista nada es la pieza que hace atómica la secuencia de CMP-07.
 * Quien lo llama es `confirmarPagoP7`, con la proyección del expediente ya
 * cobrado en la mano y antes de guardar: el certificado y el estado
 * `PAGO_CONFIRMADO` entran al repositorio en la **misma** escritura, así que
 * no existe la ventana en la que el expediente cobró y todavía no tiene
 * certificado, ni la contraria. Si el render o el guardado fallan, la
 * confirmación del pago no ocurre y el próximo sondeo la reintenta entera.
 *
 * El archivo sí queda escrito en S3 antes que el expediente, y es la única
 * asimetría posible: un PDF huérfano en el bucket no afirma nada de nadie —no
 * está referenciado por ningún expediente— mientras que un expediente que
 * apuntara a un archivo inexistente sí sería una mentira. Por eso la clave
 * lleva la huella: dos emisiones simultáneas escriben en lugares distintos y
 * ninguna puede pisar a la otra (ver `claveCertificado`).
 *
 * Determinismo (regla del servicio): el instante de emisión entra por
 * parámetro y es el mismo con el que se confirma el pago. Reintentar la
 * confirmación con el mismo instante produce los mismos bytes y el mismo
 * hash.
 */
export async function emitirCertificadoCobertura(
  deps: DependenciasCertificado,
  entrada: { readonly expediente: Expediente; readonly emitidoEn: string },
): Promise<ResultadoEmitirCertificado> {
  const { expediente, emitidoEn } = entrada;

  const contenido = armarContenidoCertificado(expediente, {
    emitidoEn,
    version: VERSION_INICIAL_CERTIFICADO,
    urlBaseVerificacion: deps.urlBaseVerificacion,
  });
  if (!contenido.ok) {
    return { ok: false, motivo: "EXPEDIENTE_INCOMPLETO", faltantes: contenido.faltantes };
  }

  const bytes = renderizarCertificado(contenido.contenido);
  const codigo = codigoCertificado(contenido.contenido.correlativo);
  const hashSha256 = sha256Hex(bytes);
  const clave = claveCertificado(expediente.id, codigo, contenido.contenido.version, hashSha256);

  const guardado = await deps.archivos.guardarArchivo(clave, bytes, CONTENT_TYPE_PDF);
  // Mismo control que en el cierre del paquete: el repositorio hashea lo que
  // efectivamente escribió, y si difiere el certificado no se registra.
  if (guardado.hashSha256 !== hashSha256) {
    return {
      ok: false,
      motivo: "ALMACENAMIENTO_INCONSISTENTE",
      detalle:
        `La huella del certificado guardado no coincide con la del renderizado (${codigo}): ` +
        `${guardado.hashSha256} ≠ ${hashSha256}.`,
    };
  }

  const pagoConfirmadoEn = expediente.pago?.confirmadoEn ?? emitidoEn;
  const inicioCobertura = inicioCoberturaDesde(pagoConfirmadoEn);

  // D-13 · quién firma el CPC sale de la configuración, igual que en el
  // paquete: Alianza, cualificada y prefirmada. El certificado es simulado
  // mientras Code100 sea un mock, y la referencia lo dice.
  const firmas: readonly FirmaInstitucional[] = firmantesDe("CPC").map((firmante) => ({
    rol: firmante.rol,
    nivel: firmante.nivel,
    modalidad: firmante.modalidad,
    certificado: `DEMO-CERT-${firmante.rol}-CPC-${contenido.contenido.correlativo}`,
    aplicadaEn: emitidoEn,
  }));

  return {
    ok: true,
    clave: guardado.clave,
    bytes: bytes.length,
    certificado: {
      codigo,
      codigoPaquete: contenido.contenido.encabezado.codigoVinculado,
      version: contenido.contenido.version,
      hashSha256,
      emitidoEn,
      inicioCobertura,
      finCobertura: finCoberturaDesde(inicioCobertura),
      referenciaBancard: expediente.pago?.referenciaBancard ?? "",
      firmas,
    },
  };
}

// ---------------------------------------------------------------------------
// Constancia del acto de firma del cliente (D-27)
// ---------------------------------------------------------------------------

/**
 * Ruta de la constancia en el bucket, con la huella en la clave por la misma
 * razón que el certificado: cada emisión escribe en su propio lugar, y el
 * archivo que hay en esa ruta solo puede ser el que el expediente registró.
 */
export function claveConstancia(
  expedienteId: string,
  codigo: string,
  version: number,
  hashSha256: string,
): string {
  return `expedientes/${expedienteId}/documentos/${codigo}-v${version}-${hashSha256}.pdf`;
}

export type MotivoRechazoConstancia = "EXPEDIENTE_INCOMPLETO" | "ALMACENAMIENTO_INCONSISTENTE";

export type ResultadoEmitirConstancia =
  | {
      readonly ok: true;
      readonly constancia: ConstanciaFirmaEmitida;
      readonly clave: string;
      readonly bytes: number;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoConstancia;
      readonly detalle?: string;
      readonly faltantes?: readonly CampoFaltanteConstancia[];
    };

/**
 * Cierra, hashea y guarda la constancia del acto de firma del cliente.
 *
 * La llama el dominio **desde adentro del acto** (`registrarActoDeFirmaCliente`),
 * con el acto en memoria y antes de la transición, y el resultado entra en la
 * misma escritura que la firma. Determinista como los otros documentos: mismo
 * acto ⇒ mismos bytes ⇒ misma huella, que es lo que hace cotejable el archivo
 * contra lo que publica `/verificar`.
 */
export async function emitirConstanciaFirma(
  deps: DependenciasCertificado,
  entrada: {
    readonly expediente: Expediente;
    readonly acto: ActoDeFirmaCliente;
    readonly historial: readonly RegistroEvidencia[];
  },
): Promise<ResultadoEmitirConstancia> {
  const { expediente, acto, historial } = entrada;

  const contenido = armarContenidoConstancia(expediente, actoParaConstancia(acto), historial, {
    version: VERSION_INICIAL_CONSTANCIA,
    urlBaseVerificacion: deps.urlBaseVerificacion,
  });
  if (!contenido.ok) {
    return { ok: false, motivo: "EXPEDIENTE_INCOMPLETO", faltantes: contenido.faltantes };
  }

  const bytes = renderizarConstancia(contenido.contenido);
  const codigo = codigoConstancia(contenido.contenido.correlativo);
  const hashSha256 = sha256Hex(bytes);
  const clave = claveConstancia(expediente.id, codigo, contenido.contenido.version, hashSha256);

  const guardado = await deps.archivos.guardarArchivo(clave, bytes, CONTENT_TYPE_PDF);
  if (guardado.hashSha256 !== hashSha256) {
    return {
      ok: false,
      motivo: "ALMACENAMIENTO_INCONSISTENTE",
      detalle:
        `La huella de la constancia guardada no coincide con la del renderizado (${codigo}): ` +
        `${guardado.hashSha256} ≠ ${hashSha256}.`,
    };
  }

  return {
    ok: true,
    clave: guardado.clave,
    bytes: bytes.length,
    constancia: {
      codigo,
      codigoPaquete: contenido.contenido.encabezado.codigoVinculado,
      version: contenido.contenido.version,
      hashSha256,
      emitidaEn: acto.firmadoEn,
    },
  };
}

// ---------------------------------------------------------------------------
// Comprobante de pago (D-05)
// ---------------------------------------------------------------------------

export type ResultadoComprobantePago =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly faltantes: readonly CampoFaltanteComprobante[] };

/**
 * Arma y renderiza el comprobante del pago **al vuelo**, sin guardarlo ni
 * hashearlo.
 *
 * Es la diferencia deliberada con los otros dos documentos del motor. El
 * paquete y el certificado se cierran, se hashean y se guardan porque son
 * instrumentos: uno se firma y el otro constata una cobertura. El comprobante
 * es una proyección de datos que ya están persistidos en el expediente, así
 * que guardarlo sería guardar dos veces lo mismo, y hashearlo sugeriría una
 * inmutabilidad que no le hace falta a nadie.
 *
 * Lo que sí conserva es el **determinismo**: mismo expediente ⇒ mismos bytes.
 * Sin eso, dos descargas del mismo pago darían dos archivos distintos, que es
 * exactamente lo que hace desconfiar de un comprobante.
 */
export function generarComprobantePago(expediente: Expediente): ResultadoComprobantePago {
  const contenido = armarContenidoComprobante(expediente);
  if (!contenido.ok) return { ok: false, faltantes: contenido.faltantes };
  return { ok: true, bytes: renderizarComprobante(contenido.contenido) };
}

// ---------------------------------------------------------------------------
// Archivado de los documentos firmados (entrada de P9)
// ---------------------------------------------------------------------------

/**
 * Baja de Code100 el PDF firmado y lo guarda, para que P9 lo pueda ofrecer en
 * `DOCUMENTOS DISPONIBLES PARA DESCARGAR`.
 *
 * **Idempotente sin necesidad de estado nuevo**: si el archivo ya está
 * guardado no vuelve a pedirlo. Eso lo hace seguro de llamar en cada carga de
 * P9 y hace que un fallo de red se reintente solo la próxima vez, sin tener que
 * marcar en el expediente si el archivado ya ocurrió.
 *
 * **Verifica la huella antes de dar por bueno el archivo.** El SHA-256 de lo
 * que se guardó tiene que coincidir con el que Code100 reportó en la `Firma` y
 * que ya está en el expediente. Si no coincide, el archivo no es el que se
 * firmó y no se registra como tal (fila 47 de la matriz de cumplimiento:
 * vincular documento, pago y firmas mediante correlativos o hashes).
 *
 * **La regla inviolable #3 ya no necesita defensa acá.** Antes esta función
 * verificaba las dos huellas antes de escribir ningún archivo, porque servir
 * una Solicitud firmada con el FIPF sin archivar habría partido el acto. Con
 * el documento único (D-11) hay un archivo y una huella: no queda nada que
 * pueda quedar a medias.
 */
export interface DependenciasArchivadoFirmados {
  readonly archivos: RepositorioArchivos & {
    obtenerArchivo(clave: string): Promise<Uint8Array | null>;
  };
  readonly firmas: SignatureProvider;
}

export type ResultadoArchivadoFirmados =
  | { readonly ok: true; readonly clave: string }
  | {
      readonly ok: false;
      readonly motivo:
        | "SIN_FIRMA"
        | "PROVEEDOR_SIN_DOCUMENTOS"
        /** La firma es interna: el PDF firmado no viene de ningún tercero. */
        | "SIN_DESCARGA_DE_PROVEEDOR"
        | "HUELLA_NO_COINCIDE";
      readonly detalle?: string;
    };

export async function archivarDocumentosFirmados(
  deps: DependenciasArchivadoFirmados,
  expediente: Expediente,
): Promise<ResultadoArchivadoFirmados> {
  const paquete = expediente.paqueteDocumental;
  const firma = expediente.firma;
  if (!paquete || !firma) return { ok: false, motivo: "SIN_FIRMA" };

  const clave = claveDocumentoFirmado(expediente.id, paquete.codigo, paquete.version);

  const yaGuardado = await deps.archivos.obtenerArchivo(clave);
  if (yaGuardado !== null) return { ok: true, clave };

  // Con la firma **interna** (D1) no hay nada que descargarle a nadie: el acto
  // no modifica los bytes del PDF —lo que prueba la firma es el registro de
  // evidencia, no un archivo distinto (`domain/firma-cliente.ts`)—, así que el
  // documento firmado **es** el paquete cerrado. Se archiva bajo la clave de
  // firmado para que P9 tenga qué servir, con la misma verificación de huella
  // que se le exige al proveedor: si el cerrado no coincide con la huella que
  // quedó registrada al firmar, no se guarda nada.
  //
  // Sin esto, en el flujo v3 el paquete firmado **no se podía descargar
  // nunca**: la pantalla de confirmación se quedaba en «Preparando el archivo
  // firmado…» para siempre (reportado por Andres, 01-sep).
  if (firma.origen === "INTERNA") {
    const cerrado = await deps.archivos.obtenerArchivo(
      claveDocumento(expediente.id, paquete.codigo, paquete.version),
    );
    if (!cerrado) return { ok: false, motivo: "PROVEEDOR_SIN_DOCUMENTOS" };
    const huellaCerrado = sha256Hex(cerrado);
    if (huellaCerrado !== firma.hashDocumentoFirmado) {
      return {
        ok: false,
        motivo: "HUELLA_NO_COINCIDE",
        detalle:
          `El paquete cerrado de ${paquete.codigo} no coincide con la huella registrada al ` +
          `firmar: ${huellaCerrado} ≠ ${firma.hashDocumentoFirmado}.`,
      };
    }
    await deps.archivos.guardarArchivo(clave, cerrado, CONTENT_TYPE_PDF);
    return { ok: true, clave };
  }
  if (firma.origen !== "PROVEEDOR") return { ok: false, motivo: "SIN_DESCARGA_DE_PROVEEDOR" };

  const bytes = await deps.firmas.descargarDocumentoFirmado(firma.referenciaActo);
  if (!bytes) return { ok: false, motivo: "PROVEEDOR_SIN_DOCUMENTOS" };

  // Se verifica la huella **antes** de escribir: si el PDF que devolvió el
  // proveedor no es el que quedó registrado como firmado, no se guarda nada
  // (fila 47 de la matriz: vincular documento, pago y firmas por hashes).
  const hash = sha256Hex(bytes);
  if (hash !== firma.hashDocumentoFirmado) {
    return {
      ok: false,
      motivo: "HUELLA_NO_COINCIDE",
      detalle:
        `El PDF firmado de ${paquete.codigo} no coincide con la huella registrada: ` +
        `${hash} ≠ ${firma.hashDocumentoFirmado}.`,
    };
  }

  const guardado = await deps.archivos.guardarArchivo(clave, bytes, CONTENT_TYPE_PDF);
  // El repositorio también hashea lo que efectivamente escribió: si difiere,
  // algo alteró el contenido entre la verificación y el almacenamiento.
  if (guardado.hashSha256 !== firma.hashDocumentoFirmado) {
    return {
      ok: false,
      motivo: "HUELLA_NO_COINCIDE",
      detalle:
        `El archivo guardado de ${paquete.codigo} no coincide con la huella registrada: ` +
        `${guardado.hashSha256} ≠ ${firma.hashDocumentoFirmado}.`,
    };
  }

  return { ok: true, clave };
}
