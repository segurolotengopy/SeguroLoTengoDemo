/**
 * Armado de dependencias de los Route Handlers de P9.
 *
 * El `PolicyIssuer` sale del composition root (`src/adapters/registro.ts`), así
 * que la pantalla no sabe si detrás hay el mock del demo o SEBAOT. Es la única
 * vía por la que P9 llega al proveedor: ningún archivo de `src/app/` importa
 * `src/adapters/mock/policy-issuer.ts`.
 *
 * Archivo con guion bajo: App Router solo enruta `route.ts`.
 */
import { createHash } from "node:crypto";
import {
  obtenerMessagingProvider,
  obtenerPolicyIssuer,
  obtenerSignatureProvider,
} from "@/adapters/registro";
import { CONTENT_TYPE_PDF, claveCertificado, claveDocumentoFirmado } from "@/documentos";
import type { DependenciasArchivadoFirmados } from "@/documentos";
import type { DependenciasP9 } from "@/domain/emision-p9";
import type { DependenciasEntrega, LectorDeAdjuntos } from "@/domain/entrega-documentos";
import type { Expediente } from "@/domain/tipos";
import type { DocumentoAdjunto } from "@/ports/messaging-provider";
import {
  crearArchivoRepository,
  crearEntregaRepository,
  crearEvidenceStore,
  crearExpedienteRepository,
} from "@/repositories";

export function dependenciasP9(): DependenciasP9 {
  return {
    polizas: obtenerPolicyIssuer(),
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
  };
}

/**
 * Dependencias del archivado de los PDF firmados, que P9 corre al entrar: baja
 * de Code100 la Solicitud y el FIPF firmados y los guarda, para poder
 * ofrecerlos en `DOCUMENTOS DISPONIBLES PARA DESCARGAR`.
 */
export function dependenciasArchivadoP9(): DependenciasArchivadoFirmados {
  return { archivos: crearArchivoRepository(), firmas: obtenerSignatureProvider() };
}

/**
 * Los PDF que se adjuntan a la entrega, bajados de S3 y **verificados contra
 * la huella que registró el expediente**.
 *
 * Esa verificación es la razón de que esto no sea un simple `obtenerArchivo`:
 * entregar por WhatsApp un PDF que no sea el emitido rompería el vínculo de la
 * fila 47 y le daría a la persona un documento que su propio certificado no
 * respalda. Si alguno no coincide, no se manda **ninguno**: media entrega es
 * peor que ninguna, porque el mensaje anuncia los dos.
 *
 * El comprobante de pago no va: se genera al pedirlo (D-05) y la persona ya lo
 * tiene en la pantalla. La póliza y la factura tampoco: las envía Alianza.
 */
const lectorDeAdjuntos: LectorDeAdjuntos = async (expediente: Expediente) => {
  const archivos = crearArchivoRepository();
  const adjuntos: DocumentoAdjunto[] = [];

  /** Baja un archivo y **exige** que sea el que el expediente registró. */
  async function adjuntar(
    clave: string,
    codigo: string,
    nombreArchivo: string,
    hashSha256: string,
  ): Promise<string | null> {
    const bytes = await archivos.obtenerArchivo(clave);
    if (!bytes) return `Todavía no está archivado ${codigo}.`;

    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== hashSha256) {
      return `El archivo de ${codigo} no coincide con la huella registrada.`;
    }

    adjuntos.push({ codigo, nombreArchivo, contentType: CONTENT_TYPE_PDF, bytes, hashSha256 });
    return null;
  }

  const certificado = expediente.certificadoCobertura;
  if (certificado) {
    const error = await adjuntar(
      claveCertificado(expediente.id, certificado.codigo, certificado.version, certificado.hashSha256),
      certificado.codigo,
      `${certificado.codigo}.pdf`,
      certificado.hashSha256,
    );
    if (error) return { ok: false, detalle: error };
  }

  const paquete = expediente.paqueteDocumental;
  const firma = expediente.firma;
  if (paquete && firma) {
    const error = await adjuntar(
      claveDocumentoFirmado(expediente.id, paquete.codigo, paquete.version),
      paquete.codigo,
      `${paquete.codigo}-firmado.pdf`,
      firma.hashDocumentoFirmado,
    );
    if (error) return { ok: false, detalle: error };
  }

  if (adjuntos.length === 0) return { ok: false, detalle: "No hay documentos emitidos que entregar." };
  return { ok: true, adjuntos };
};

/**
 * Dependencias del despachador de entregas (CHG-44).
 *
 * Se invoca desde la pantalla de confirmación, que ya sondea: cada pasada
 * avanza lo que esté vencido. No controla nada del negocio — el expediente ya
 * está emitido cuando esto corre.
 */
export function dependenciasEntregaP9(): DependenciasEntrega {
  return {
    mensajeria: obtenerMessagingProvider(),
    entregas: crearEntregaRepository(),
    evidencias: crearEvidenceStore(),
    adjuntos: lectorDeAdjuntos,
  };
}
