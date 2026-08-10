/**
 * `GET /api/pantalla-b/caso` — alimenta la Pantalla B · QR pagado, firma no
 * completada.
 *
 * Hace una cosa además de leer: **abre el trámite de devolución** si el
 * expediente venció con un pago que efectivamente se cobró (QR o débito). Es lo
 * que hace verdadero el encabezado de la pantalla —*"se inició el procedimiento
 * de devolución"*— en el mismo momento en que la persona lo lee, y no antes.
 * Con tarjeta de crédito no abre nada: la reserva ya se liberó en P8 y no hay
 * premio que devolver.
 *
 * Es idempotente: recargar la pantalla no vuelve a transicionar ni a duplicar
 * evidencia.
 *
 * **Qué devuelve y qué no** (reglas inviolables #6 y #7): propuesta, referencia
 * de Bancard, premio, nombre, y la cédula y los dos canales **enmascarados**.
 * Nunca un dato de tarjeta, ni una respuesta médica, ni la condición PEP, ni el
 * valor completo de un canal.
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { iniciarDevolucionPantallaB, leerCasoVencido } from "@/domain/devolucion-pantalla-b";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const cookies = [{ nombre: COOKIE_SESION, valor: contexto.sesionId }];

  const apertura = await iniciarDevolucionPantallaB(
    { expedientes: crearExpedienteRepository(), evidencias: crearEvidenceStore() },
    { expedienteId, contexto },
  );
  if (!apertura.ok && apertura.motivo === "EXPEDIENTE_NO_ENCONTRADO") {
    return respuestaJson({ ok: false, motivo: apertura.motivo }, { status: 404, cookies });
  }

  const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
  if (!expediente) {
    return respuestaJson({ ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" }, { status: 404, cookies });
  }

  const caso = leerCasoVencido(expediente);
  if (!caso) {
    return respuestaJson({ ok: false, motivo: "EXPEDIENTE_NO_VENCIDO" }, { status: 409, cookies });
  }

  return respuestaJson({ ok: true, caso }, { cookies });
}
