/**
 * `GET /api/p8/resumen` — lo que la pantalla de firma necesita para dibujarse.
 *
 * Hace una cosa más que su gemelo del paso de pago: **cierra el paquete
 * documental**. Al entrar a firmar el expediente viene en DECLARACIONES_OK, y
 * la pantalla no puede mostrar `PDF cerrado · hash registrado` sobre
 * documentos que todavía no existen. Así que primero corre
 * `generarPaqueteDocumental` —que acuña el correlativo, renderiza, hashea con
 * SHA-256, guarda en S3 y transiciona a PAQUETE_GENERADO (regla inviolable
 * #4)— y recién después proyecta el resumen.
 *
 * Es idempotente: con el paquete ya cerrado el servicio devuelve el persistido
 * sin volver a renderizar ni rehashear, que es justamente lo que tiene que
 * pasar cuando alguien recarga la pantalla (regenerar exigiría versión y
 * huellas nuevas).
 *
 * **Ya no evalúa ningún plazo** (D-08): el reloj de 24 horas arranca al quedar
 * firmado el expediente y corre en el paso de pago, no acá.
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { dependenciasDocumentosP8 } from "@/app/api/p8/_dependencias";
import { generarPaqueteDocumental } from "@/documentos";
import { leerResumenFirmaP8 } from "@/domain/firma-p8";
import { crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const cookies = [{ nombre: COOKIE_SESION, valor: contexto.sesionId }];

  const generacion = await generarPaqueteDocumental(dependenciasDocumentosP8(), {
    expedienteId,
    contexto,
  });
  if (!generacion.ok && generacion.motivo === "EXPEDIENTE_NO_ENCONTRADO") {
    return respuestaJson({ ok: false, motivo: generacion.motivo }, { status: 404, cookies });
  }

  const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
  if (!expediente) {
    return respuestaJson({ ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" }, { status: 404, cookies });
  }

  const resumen = leerResumenFirmaP8(expediente);
  if (!resumen) {
    return respuestaJson(
      {
        ok: false,
        motivo: generacion.ok ? "ESTADO_INVALIDO" : generacion.motivo,
        ...(generacion.ok ? {} : { detalle: generacion.detalle }),
      },
      { status: 409, cookies },
    );
  }

  return respuestaJson({ ok: true, resumen }, { cookies });
}
