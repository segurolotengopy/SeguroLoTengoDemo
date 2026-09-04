/**
 * Verificación pública de un documento por su código (CMP-06).
 *
 * Es la otra mitad del QR: cada PDF que el motor cierra imprime
 * `<URL_BASE>/verificar/<código>`, y esto decide qué se responde de ese lado.
 *
 * ## Qué verifica, y qué no
 *
 * **Autenticidad e integridad**, nada más: que el documento existe, quién lo
 * cerró, cuándo, con qué versión, quiénes lo firmaron y cuál es su SHA-256
 * —para que quien tenga el archivo pueda compararlo—. Eso es exactamente lo
 * que pide CMP-06 (*"verificación de autenticidad del CPC"*).
 *
 * **No informa el estado de la cobertura.** Un certificado emitido sobre un
 * cobro que después se devolvió sigue siendo auténtico: lo que cambió no es el
 * documento sino la relación. Decir "vigente" o "anulado" acá exigiría una
 * regla sobre qué le pasa a la cobertura cuando un cobro se revierte, y esa
 * regla no está decidida en ningún documento fuente. Inventarla en una página
 * pública sería peor que no responderla, así que la página dice explícitamente
 * que el estado de la cobertura se consulta con la aseguradora.
 *
 * ## Por qué no sale ni un dato de la persona
 *
 * El código va impreso en un PDF que se reenvía por WhatsApp y por correo, así
 * que **cualquiera que lo tenga abre esta página**. No hay sesión ni hay forma
 * de saber quién consulta. Por eso la proyección de acá no lleva nombre,
 * cédula, canales, plan, importes ni nada de salud o PEP (regla inviolable #7):
 * lo que devuelve son hechos del documento, no de su titular. Quien tenga el
 * PDF ya ve los datos personales en el PDF; quien solo tenga el código no
 * debería poder deducirlos.
 *
 * El correlativo sí sale, porque es parte del código que la persona tipeó para
 * llegar acá y no identifica a nadie por sí solo — el mismo criterio con el que
 * `qr.ts` decide qué codificar.
 *
 * Libre de `node:*`, como el resto de los módulos de contenido de documentos.
 */
import {
  PREFIJO_CONSTANCIA,
  PREFIJO_FIPF,
  PREFIJO_SOLICITUD,
  codigoFipf,
  codigoSolicitud,
} from "./documentos";
import {
  PREFIJO_CERTIFICADO,
  TITULO_CERTIFICADO,
  formatearInstante,
} from "./certificado-cobertura";
import { PREFIJO_COMPROBANTE } from "./comprobante-pago";
import { NORMA_FIRMA_SIMPLE, TITULO_CONSTANCIA } from "./constancia-firma";
import { firmantesDe } from "./firmantes-documento";
import type { DocumentoFirmable, ModalidadFirma, NivelFirma, RolFirmante } from "./firmantes-documento";
import type { CanalFirma, Expediente } from "./tipos";

// ---------------------------------------------------------------------------
// Interpretación del código
// ---------------------------------------------------------------------------

/**
 * Qué documento nombra un código. `COMPROBANTE` está en la unión aunque no se
 * verifique: quien escanee o tipee un `REC-…` tiene que recibir una
 * explicación, no un "no encontrado" que sugiera que su comprobante es falso.
 */
export type TipoDocumentoCodigo =
  | "PAQUETE"
  | "SECCION_FIPF"
  | "CERTIFICADO"
  | "COMPROBANTE"
  | "CONSTANCIA";

export interface CodigoInterpretado {
  readonly tipo: TipoDocumentoCodigo;
  readonly correlativo: string;
  /** El código normalizado, tal como lo imprime el documento. */
  readonly codigo: string;
}

/** Ocho dígitos: el formato que acuña `generarNumeroPropuesta`. */
const CORRELATIVO = /^\d{8}$/;

const PREFIJOS: Readonly<Record<string, TipoDocumentoCodigo>> = {
  [PREFIJO_SOLICITUD]: "PAQUETE",
  [PREFIJO_FIPF]: "SECCION_FIPF",
  [PREFIJO_CERTIFICADO]: "CERTIFICADO",
  [PREFIJO_COMPROBANTE]: "COMPROBANTE",
  [PREFIJO_CONSTANCIA]: "CONSTANCIA",
};

/**
 * `cpc-00018425` → `{ tipo: "CERTIFICADO", correlativo: "00018425" }`.
 *
 * Tolera minúsculas y espacios sobrantes porque este código se tipea a mano
 * desde un papel; **no** tolera un correlativo con otra forma, para que la
 * búsqueda nunca salga a preguntar por algo que no puede existir.
 */
export function interpretarCodigo(entrada: string): CodigoInterpretado | null {
  const limpio = entrada.trim().toUpperCase();
  const separador = limpio.indexOf("-");
  if (separador < 0) return null;

  const prefijo = limpio.slice(0, separador);
  const correlativo = limpio.slice(separador + 1);
  const tipo = PREFIJOS[prefijo];
  if (!tipo || !CORRELATIVO.test(correlativo)) return null;

  return { tipo, correlativo, codigo: `${prefijo}-${correlativo}` };
}

// ---------------------------------------------------------------------------
// Proyección verificable
// ---------------------------------------------------------------------------

export interface FirmanteVerificado {
  readonly rol: RolFirmante;
  readonly rotulo: string;
  readonly nivel: NivelFirma;
  readonly modalidad: ModalidadFirma;
  /**
   * Cuándo se aplicó, ya formateado, o `null` si la configuración la declara
   * pero el expediente todavía no la registró. Un bloque de firmas que
   * afirmara una fecha inventada no probaría nada.
   *
   * Formateado acá y en UTC, como el resto de esta proyección: es una página
   * pública que se abre desde cualquier lado, y la hora que imprime el PDF —la
   * que quien consulta tiene delante— también es UTC.
   */
  readonly aplicadaEn: string | null;
  /** Referencia del certificado. `DEMO-…` mientras el proveedor sea un mock. */
  readonly certificado: string | null;
}

/**
 * La firma del proponente, tal como se publica (D-27). Solo cuando la firma la
 * generó el portal: dice qué es, bajo qué norma, y **qué** evidencia la
 * respalda —categorías, nunca valores—, más la huella de la constancia para
 * cotejar el archivo que el titular tiene. Ningún dato personal (regla #7).
 */
export interface FirmaProponenteVerificada {
  readonly nivel: "SIMPLE_NO_CUALIFICADA";
  readonly emisor: "SEGUROLOTENGO";
  readonly norma: string;
  readonly firmadoEn: string;
  readonly canal: CanalFirma;
  readonly respaldos: readonly string[];
  readonly constancia: {
    readonly codigo: string;
    readonly version: number;
    readonly hashSha256: string;
  } | null;
}

export interface DocumentoVerificado {
  readonly codigo: string;
  readonly correlativo: string;
  readonly titulo: string;
  readonly version: number;
  /** SHA-256 del archivo cerrado, para comparar contra el que se tenga. */
  readonly hashSha256: string;
  /** Instante en que el documento quedó cerrado o emitido, ya formateado. */
  readonly selloDeTiempo: string;
  /** Código del otro documento con el que está vinculado. */
  readonly codigoVinculado: string;
  readonly firmantes: readonly FirmanteVerificado[];
  /** Solo el certificado: desde cuándo y hasta cuándo rige la cobertura. */
  readonly vigencia: { readonly inicio: string; readonly fin: string } | null;
  /** D-27: `null` en el certificado, en el comprobante y en firmas de proveedor. */
  readonly firmaDelProponente: FirmaProponenteVerificada | null;
}

export type MotivoNoVerificable =
  /** El código no tiene la forma de ninguno de los documentos del producto. */
  | "CODIGO_INVALIDO"
  /** La forma es válida pero no hay ningún documento con ese código. */
  | "NO_ENCONTRADO"
  /** El comprobante de pago no se verifica por sí solo (D-05). */
  | "COMPROBANTE_SIN_VERIFICACION";

export type ResultadoVerificacion =
  | { readonly ok: true; readonly documento: DocumentoVerificado }
  | { readonly ok: false; readonly motivo: MotivoNoVerificable; readonly codigo: string };

/** Firmas de un documento: la configuración de D-13 cruzada con lo aplicado. */
function firmantesVerificados(
  documento: DocumentoFirmable,
  aplicadas: readonly {
    readonly rol: RolFirmante;
    readonly aplicadaEn: string;
    readonly certificado: string;
  }[],
  firmaDelCliente: { readonly firmadoEn: string } | null,
): readonly FirmanteVerificado[] {
  return firmantesDe(documento).map((firmante) => {
    // El cliente no deja `FirmaInstitucional`: su acto vive en `Expediente.firma`.
    if (firmante.rol === "CLIENTE") {
      return {
        rol: firmante.rol,
        rotulo: firmante.rotulo,
        nivel: firmante.nivel,
        modalidad: firmante.modalidad,
        aplicadaEn: firmaDelCliente ? formatearInstante(firmaDelCliente.firmadoEn) : null,
        // La firma del cliente es simple y no lleva certificado propio.
        certificado: null,
      };
    }
    const aplicada = aplicadas.find((entrada) => entrada.rol === firmante.rol);
    return {
      rol: firmante.rol,
      rotulo: firmante.rotulo,
      nivel: firmante.nivel,
      modalidad: firmante.modalidad,
      aplicadaEn: aplicada ? formatearInstante(aplicada.aplicadaEn) : null,
      certificado: aplicada?.certificado ?? null,
    };
  });
}

/**
 * Proyecta el documento que nombra el código sobre lo que se puede publicar.
 *
 * Recibe el expediente ya encontrado por el correlativo — la búsqueda vive en
 * el repositorio, que es quien habla con la base. Devolver `NO_ENCONTRADO` en
 * vez de lanzar es deliberado: un código que no existe es una respuesta
 * legítima de esta página, no un error del sistema.
 */
/**
 * Qué respalda la firma del proponente, en categorías (D-27). Cada frase
 * afirma solo lo que el expediente registró: la biometría entra si la captura
 * la aprobó, el canal es el que la firma nombra, y el resto son propiedades
 * del acto interno que el dominio garantiza por construcción.
 */
function firmaDelProponente(expediente: Expediente): FirmaProponenteVerificada | null {
  const firma = expediente.firma;
  if (!firma || firma.origen !== "INTERNA") return null;
  const captura = expediente.identidad?.captura;
  const respaldos: string[] = [
    "Identidad verificada antes de firmar con la cédula de identidad" +
      (captura?.pruebaDeVidaAprobada ? ", prueba de vida" : "") +
      (captura?.coincidenciaFacialAprobada ? " y coincidencia facial con el documento" : "") +
      ".",
    `Código de un solo uso enviado al ${
      firma.canal === "WHATSAPP" ? "WhatsApp" : "correo electrónico"
    } verificado, exclusivo de este acto (art. 4).`,
    "Documento cerrado y con huella SHA-256 calculada antes de habilitar la firma; la huella publicada arriba es la del archivo firmado.",
    "Fecha y hora, dirección IP, dispositivo y sesión del acto conservados en un registro que no se sobrescribe ni se borra (art. 9).",
    "Texto aceptado al firmar conservado con su versión.",
  ];
  const constancia = expediente.constanciaFirma;
  return {
    nivel: "SIMPLE_NO_CUALIFICADA",
    emisor: "SEGUROLOTENGO",
    norma: NORMA_FIRMA_SIMPLE,
    firmadoEn: formatearInstante(firma.firmadoEn),
    canal: firma.canal,
    respaldos,
    constancia: constancia
      ? { codigo: constancia.codigo, version: constancia.version, hashSha256: constancia.hashSha256 }
      : null,
  };
}

export function verificarDocumento(
  expediente: Expediente | null,
  interpretado: CodigoInterpretado,
): ResultadoVerificacion {
  const { tipo, correlativo, codigo } = interpretado;

  if (tipo === "COMPROBANTE") {
    return { ok: false, motivo: "COMPROBANTE_SIN_VERIFICACION", codigo };
  }
  if (!expediente || expediente.numeroPropuesta !== correlativo) {
    return { ok: false, motivo: "NO_ENCONTRADO", codigo };
  }

  if (tipo === "CONSTANCIA") {
    const constancia = expediente.constanciaFirma;
    if (!constancia) return { ok: false, motivo: "NO_ENCONTRADO", codigo };

    return {
      ok: true,
      documento: {
        codigo: constancia.codigo,
        correlativo,
        titulo: TITULO_CONSTANCIA,
        version: constancia.version,
        hashSha256: constancia.hashSha256,
        selloDeTiempo: formatearInstante(constancia.emitidaEn),
        codigoVinculado: constancia.codigoPaquete,
        // Nadie firma la constancia: es el registro del acto, no un documento
        // que se suscriba. Lo que la respalda es lo que ella misma enumera.
        firmantes: [],
        vigencia: null,
        firmaDelProponente: firmaDelProponente(expediente),
      },
    };
  }

  if (tipo === "CERTIFICADO") {
    const certificado = expediente.certificadoCobertura;
    if (!certificado) return { ok: false, motivo: "NO_ENCONTRADO", codigo };

    return {
      ok: true,
      documento: {
        codigo: certificado.codigo,
        correlativo,
        titulo: TITULO_CERTIFICADO,
        version: certificado.version,
        hashSha256: certificado.hashSha256,
        selloDeTiempo: formatearInstante(certificado.emitidoEn),
        codigoVinculado: certificado.codigoPaquete,
        firmantes: firmantesVerificados("CPC", certificado.firmas, null),
        vigencia: {
          inicio: formatearInstante(certificado.inicioCobertura),
          fin: formatearInstante(certificado.finCobertura),
        },
        firmaDelProponente: null,
      },
    };
  }

  // `PAQUETE` y `SECCION_FIPF` apuntan al mismo archivo (D-11): la sección FIPF
  // no tiene huella propia porque no tiene archivo propio.
  const paquete = expediente.paqueteDocumental;
  if (!paquete) return { ok: false, motivo: "NO_ENCONTRADO", codigo };

  const firma = expediente.firma;
  return {
    ok: true,
    documento: {
      // Se responde con la identidad del documento, aunque se haya preguntado
      // por el código de la sección: son dos códigos de un solo archivo.
      codigo: paquete.codigo,
      correlativo,
      titulo: "Solicitud de Seguro de Vida Oncológico y FIPF",
      version: paquete.version,
      // La huella que importa es la del archivo **firmado** cuando existe: es
      // el que la persona descargó y el que va a querer comparar. Antes de la
      // firma, la del cerrado.
      hashSha256: firma?.hashDocumentoFirmado ?? paquete.hashSha256,
      selloDeTiempo: formatearInstante(firma?.firmadoEn ?? paquete.cerradoEn),
      codigoVinculado:
        tipo === "SECCION_FIPF" ? codigoSolicitud(correlativo) : codigoFipf(correlativo),
      firmantes: firmantesVerificados(
        "PAQUETE",
        expediente.firmasInstitucionales,
        firma ? { firmadoEn: firma.firmadoEn } : null,
      ),
      vigencia: null,
      firmaDelProponente: firmaDelProponente(expediente),
    },
  };
}
