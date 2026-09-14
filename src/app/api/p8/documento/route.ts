/**
 * `GET /api/p8/documento?codigo=…` — el endpoint de documentos del expediente.
 *
 * Sirve los **tres** documentos del motor, cada uno según lo que es:
 *
 * | Código | Qué se sirve | Cómo se garantiza |
 * | :--- | :--- | :--- |
 * | `PROP-…` / `FIPF-…` | El paquete cerrado (`VER PDF` de la firma) o el firmado (`&firmado=1`, descargas de la confirmación) | Se recalcula el SHA-256 de lo que bajó de S3 y se compara con la huella registrada |
 * | `CPC-…` | El Certificado de Cobertura Provisional | Igual: hash contra `certificadoCobertura.hashSha256` |
 * | `REC-…` | El comprobante de pago | No hay hash que comparar: se **genera** al vuelo y es determinista (D-05) |
 *
 * El nombre de la ruta dice `p8` por dónde nació —el paquete se cierra en el
 * paso de la firma— y se conserva porque hay enlaces vivos que la usan. Lo que
 * resuelve no es un paso del flujo sino *un documento de este expediente*.
 *
 * ## Las dos garantías que no se negocian
 *
 * **Se sirven los bytes exactos que se hashearon.** Para el paquete y el
 * certificado se recalcula el SHA-256 de lo que bajó de S3 y se compara con la
 * huella del expediente; si no coinciden, no se entrega nada. Un PDF que no es
 * el que se hasheó no es el documento que se firmó (regla inviolable #4; fila
 * 35 de la matriz, Ley 6822/21, arts. 42(5), 61 y 66).
 *
 * **El código pedido se valida contra el expediente de esta sesión.** No hay
 * forma de bajar la Solicitud ni el certificado de otra persona escribiendo su
 * correlativo: el expediente sale de la cookie y todos los códigos tienen que
 * derivar de su propio `numeroPropuesta`.
 */
import { createHash } from "node:crypto";
import { resolverContextoHttp } from "@/app/api/_http/contexto-peticion";
import {
  CONTENT_TYPE_PDF,
  claveCertificado,
  claveConstancia,
  claveDocumento,
  claveDocumentoFirmado,
  generarComprobantePago,
} from "@/documentos";
import { codigoComprobante } from "@/domain/comprobante-pago";
import type { Expediente } from "@/domain/tipos";
import { crearArchivoRepository, crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

function error(motivo: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, motivo }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function pdf(bytes: Uint8Array, nombre: string, descargar: boolean, huella: string | null): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": CONTENT_TYPE_PDF,
      "content-disposition": `${descargar ? "attachment" : "inline"}; filename="${nombre}"`,
      "cache-control": "no-store",
      // La huella viaja en la cabecera para que quien descargue pueda
      // verificarla sin depender de la pantalla. El comprobante no tiene:
      // no es un instrumento con huella registrada (D-05).
      ...(huella ? { "x-sha256": huella } : {}),
    },
  });
}

/**
 * Baja un PDF guardado y comprueba que sea el que quedó registrado.
 *
 * Es la misma operación para el paquete y para el certificado, y por eso vive
 * en un solo lugar: son dos documentos distintos con la misma garantía.
 */
async function servirArchivado(
  clave: string,
  huellaEsperada: string,
  nombre: string,
  descargar: boolean,
): Promise<Response> {
  const bytes = await crearArchivoRepository().obtenerArchivo(clave);
  if (!bytes) return error("DOCUMENTO_NO_ENCONTRADO", 404);

  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== huellaEsperada) {
    // El archivo almacenado no es el que quedó registrado: no se entrega.
    return error("HUELLA_NO_COINCIDE", 409);
  }

  return pdf(bytes, nombre, descargar, huellaEsperada);
}

/** El paquete único (D-11), cerrado o firmado. */
async function servirPaquete(
  expediente: Expediente,
  firmado: boolean,
  descargar: boolean,
): Promise<Response> {
  const paquete = expediente.paqueteDocumental;
  if (!paquete) return error("PAQUETE_NO_GENERADO", 409);

  const firma = expediente.firma;
  if (firmado && !firma) return error("DOCUMENTO_NO_FIRMADO", 409);

  // La huella contra la que se verifica: el cerrado tiene la del paquete, el
  // firmado la de la `Firma`.
  const huellaEsperada = firmado ? firma!.hashDocumentoFirmado : paquete.hashSha256;
  const clave = firmado
    ? claveDocumentoFirmado(expediente.id, paquete.codigo, paquete.version)
    : claveDocumento(expediente.id, paquete.codigo, paquete.version);
  const nombre = `${paquete.codigo}-v${paquete.version}${firmado ? "-firmado" : ""}.pdf`;

  return servirArchivado(clave, huellaEsperada, nombre, descargar);
}

export async function GET(request: Request): Promise<Response> {
  const { expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) return error("SESION_INVALIDA", 400);

  const url = new URL(request.url);
  const codigo = url.searchParams.get("codigo")?.trim() ?? "";
  if (!codigo) return error("CODIGO_REQUERIDO", 400);

  const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
  if (!expediente) return error("EXPEDIENTE_NO_ENCONTRADO", 404);

  const descargar = url.searchParams.get("descargar") === "1";

  // --- El certificado de cobertura (D-12) --------------------------------
  const certificado = expediente.certificadoCobertura;
  if (certificado && codigo === certificado.codigo) {
    return servirArchivado(
      // La clave incluye la huella: el archivo que hay en esa ruta solo puede
      // ser el que el expediente registró (ver `claveCertificado`).
      claveCertificado(
        expediente.id,
        certificado.codigo,
        certificado.version,
        certificado.hashSha256,
      ),
      certificado.hashSha256,
      `${certificado.codigo}-v${certificado.version}.pdf`,
      descargar,
    );
  }

  // --- La constancia del acto de firma (D-27) ----------------------------
  const constancia = expediente.constanciaFirma;
  if (constancia && codigo === constancia.codigo) {
    return servirArchivado(
      claveConstancia(expediente.id, constancia.codigo, constancia.version, constancia.hashSha256),
      constancia.hashSha256,
      `${constancia.codigo}-v${constancia.version}.pdf`,
      descargar,
    );
  }

  // --- El comprobante de pago (D-05) -------------------------------------
  // No se busca en S3 porque no está: se genera. Determinista, así que dos
  // descargas dan el mismo archivo.
  if (expediente.numeroPropuesta && codigo === codigoComprobante(expediente.numeroPropuesta)) {
    const comprobante = generarComprobantePago(expediente);
    if (!comprobante.ok) return error("COMPROBANTE_NO_DISPONIBLE", 409);
    return pdf(comprobante.bytes, `${codigo}.pdf`, descargar, null);
  }

  // --- El paquete único (D-11) -------------------------------------------
  const paquete = expediente.paqueteDocumental;
  // Se acepta también el código de la sección FIPF porque hay enlaces vivos
  // que lo usan y porque sigue siendo un código legítimo del expediente:
  // apunta al mismo archivo, que es justamente el punto de haberlos unificado.
  if (paquete && (paquete.codigo === codigo || paquete.codigoSeccionFipf === codigo)) {
    return servirPaquete(expediente, url.searchParams.get("firmado") === "1", descargar);
  }

  return error("DOCUMENTO_NO_ENCONTRADO", 404);
}
