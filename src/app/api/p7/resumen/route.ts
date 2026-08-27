/**
 * `GET /api/p7/resumen` — lo que el paso de pago necesita para dibujar el
 * bloque 1 y su cuenta regresiva.
 *
 * Solo lectura: no transiciona, no llama a Bancard, no deja evidencia. El
 * nombre a facturar sale del OCR de la cédula (regla inviolable #9: la factura
 * es siempre a nombre del asegurado) y el importe del plan persistido, no del
 * catálogo de hoy — si mañana sube el tarifario, la persona tiene que seguir
 * viendo el premio que eligió.
 *
 * No devuelve el RUC de un intento anterior: es un campo del formulario en
 * curso, no estado que la pantalla necesite recuperar. La declaración de
 * origen lícito dejó de ser cosa de este paso: se firma con el FIPF (D-08).
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { leerResumenPagoP7 } from "@/domain/pago-p7";
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

  const resumen = leerResumenPagoP7(expediente);
  if (!resumen) {
    return respuestaJson({ ok: false, motivo: "ESTADO_INVALIDO" }, { status: 409 });
  }

  return respuestaJson(
    { ok: true, resumen },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
