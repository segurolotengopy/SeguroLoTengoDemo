/**
 * `GET /api/expediente/plan` — alimenta la barra de plan seleccionado, que la
 * especificación pide presente de P3 a P8 (docs/ESPECIFICACION_PANTALLAS.md →
 * "Elementos comunes a todas las pantallas").
 *
 * Es de solo lectura y no toca el estado: no hay transición, no hay
 * evidencia. Devuelve el plan **tal como quedó persistido en el expediente**,
 * no el que figura hoy en el catálogo: si mañana sube el tarifario, la
 * persona tiene que seguir viendo el importe que eligió, con el
 * `idVersionOferta` que lo respalda.
 *
 * Vive fuera de `api/pN/` a propósito: lo van a consumir seis pantallas.
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
  if (!expediente) {
    return respuestaJson({ ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" }, { status: 404 });
  }
  if (!expediente.plan) {
    return respuestaJson({ ok: false, motivo: "PLAN_NO_SELECCIONADO" }, { status: 409 });
  }

  return respuestaJson(
    {
      ok: true,
      plan: {
        planId: expediente.plan.planId,
        premioAnualGs: expediente.plan.premioAnualGs,
        idVersionOferta: expediente.plan.idVersionOferta,
      },
    },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
