/**
 * `GET /api/expediente/asistencia-identidad` — alimenta el bloque
 * `CASO DE ASISTENCIA` de la pantalla de asistencia de identidad.
 *
 * Solo lectura: no transiciona nada y no escribe evidencia. Responde 409 si el
 * expediente no está en `ASISTENCIA_IDENTIDAD`, para que la pantalla no pueda
 * mostrarse con datos de un expediente que sigue en el flujo normal.
 *
 * **Qué devuelve y qué no.** El número de caso y los dos canales verificados
 * **enmascarados**. No devuelve identidad porque en este camino **no la hay**:
 * el expediente llegó acá justamente porque no se pudo verificar. Tampoco
 * devuelve motivos técnicos del fallo —umbrales, puntuaciones, qué control no
 * pasó—: eso vive en la evidencia, para la consola y el auditor, y no le sirve
 * de nada a la persona.
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { enmascararCorreo } from "@/domain/correo";
import { enmascararCelular } from "@/domain/telefono";
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

  if (expediente.estado !== "ASISTENCIA_IDENTIDAD") {
    return respuestaJson({ ok: false, motivo: "ESTADO_INVALIDO" }, { status: 409 });
  }

  return respuestaJson(
    {
      ok: true,
      numeroCaso: expediente.numeroCasoAsistenciaIdentidad,
      whatsappEnmascarado: expediente.canalWhatsapp
        ? enmascararCelular(expediente.canalWhatsapp.valor)
        : null,
      correoEnmascarado: expediente.canalEmail
        ? enmascararCorreo(expediente.canalEmail.valor)
        : null,
    },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
