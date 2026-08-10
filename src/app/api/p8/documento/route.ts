/**
 * `GET /api/p8/documento?codigo=PROP-00018425` — botones `VER PDF` y
 * `DESCARGAR` del bloque 1 de P8 (`&descargar=1` para lo segundo), y los
 * `DESCARGAR` de P9 con `&firmado=1`.
 *
 * Los dos archivos son evidencia y conviven: el **cerrado** es el que se hasheó
 * antes de habilitar la firma (regla inviolable #4) y el **firmado** es el que
 * devolvió Code100 con las tres firmas. Ninguno pisa al otro, y cada uno se
 * verifica contra la huella que le corresponde —`paqueteDocumental` para el
 * cerrado, `firma` para el firmado—.
 *
 * Sirve los bytes exactos que se hashearon al cerrar el paquete, y lo
 * comprueba: recalcula el SHA-256 de lo que bajó de S3 y lo compara con la
 * huella registrada en el expediente. Si no coinciden, no entrega el archivo.
 * Un PDF que no es el que se hasheó no es el documento que se va a firmar
 * (regla inviolable #4; fila 35 de la matriz de cumplimiento, Ley 6822/21,
 * arts. 42(5), 61 y 66).
 *
 * El código pedido se valida contra el paquete del expediente de **esta**
 * sesión: no hay forma de bajar la Solicitud de otra persona escribiendo su
 * correlativo, porque el expediente sale de la cookie y el código tiene que
 * derivar de su propio `numeroPropuesta`.
 */
import { createHash } from "node:crypto";
import { resolverContextoHttp } from "@/app/api/_http/contexto-peticion";
import { CONTENT_TYPE_PDF, claveDocumento, claveDocumentoFirmado } from "@/documentos";
import type { DocumentoCerrado } from "@/domain/tipos";
import { crearArchivoRepository, crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

function error(motivo: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, motivo }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const { expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) return error("SESION_INVALIDA", 400);

  const url = new URL(request.url);
  const codigo = url.searchParams.get("codigo")?.trim() ?? "";
  if (!codigo) return error("CODIGO_REQUERIDO", 400);

  const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
  if (!expediente) return error("EXPEDIENTE_NO_ENCONTRADO", 404);

  const paquete = expediente.paqueteDocumental;
  if (!paquete) return error("PAQUETE_NO_GENERADO", 409);

  const esSolicitud = paquete.solicitud.codigo === codigo;
  const documento: DocumentoCerrado | null = esSolicitud
    ? paquete.solicitud
    : paquete.fipf.codigo === codigo
      ? paquete.fipf
      : null;
  if (!documento) return error("DOCUMENTO_NO_ENCONTRADO", 404);

  const firmado = url.searchParams.get("firmado") === "1";
  if (firmado && !expediente.firma) return error("DOCUMENTO_NO_FIRMADO", 409);

  // La huella contra la que se verifica depende de cuál de los dos archivos se
  // pidió: el cerrado tiene la del paquete, el firmado la de la `Firma`.
  const huellaEsperada = firmado
    ? esSolicitud
      ? expediente.firma!.hashSolicitudFirmada
      : expediente.firma!.hashFipfFirmado
    : documento.hashSha256;

  const clave = firmado
    ? claveDocumentoFirmado(expediente.id, documento.codigo, documento.version)
    : claveDocumento(expediente.id, documento.codigo, documento.version);

  const bytes = await crearArchivoRepository().obtenerArchivo(clave);
  if (!bytes) return error("DOCUMENTO_NO_ENCONTRADO", 404);

  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== huellaEsperada) {
    // El archivo almacenado no es el que quedó registrado: no se entrega.
    return error("HUELLA_NO_COINCIDE", 409);
  }

  const descargar = url.searchParams.get("descargar") === "1";
  const nombre = `${documento.codigo}-v${documento.version}${firmado ? "-firmado" : ""}.pdf`;

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": CONTENT_TYPE_PDF,
      "content-disposition": `${descargar ? "attachment" : "inline"}; filename="${nombre}"`,
      "cache-control": "no-store",
      // La huella viaja en la cabecera para que quien descargue pueda
      // verificarla sin depender de la pantalla.
      "x-sha256": huellaEsperada,
    },
  });
}
