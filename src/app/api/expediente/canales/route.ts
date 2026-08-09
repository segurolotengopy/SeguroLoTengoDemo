/**
 * `GET /api/expediente/canales` — alimenta la tarjeta verde
 * `✓ WhatsApp verificado · +595 ••• ••• 000` que P4 muestra en su panel
 * izquierdo (docs/ESPECIFICACION_PANTALLAS.md → "P4 · Paso 4 de 9").
 *
 * De solo lectura: no hay transición ni evidencia.
 *
 * **Solo devuelve valores enmascarados.** El número y el correo completos no
 * salen nunca del servidor: esta respuesta se pinta en una pantalla y podría
 * quedar en el caché del navegador o en una captura.
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

  return respuestaJson(
    {
      ok: true,
      whatsapp: expediente.canalWhatsapp
        ? {
            enmascarado: enmascararCelular(expediente.canalWhatsapp.valor),
            verificadoEn: expediente.canalWhatsapp.verificadoEn,
          }
        : null,
      correo: expediente.canalEmail
        ? {
            enmascarado: enmascararCorreo(expediente.canalEmail.valor),
            verificadoEn: expediente.canalEmail.verificadoEn,
          }
        : null,
    },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
