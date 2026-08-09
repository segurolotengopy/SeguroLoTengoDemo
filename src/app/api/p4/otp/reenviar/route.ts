/**
 * `POST /api/p4/otp/reenviar` — enlace `Reenviar código` de P4.
 *
 * Mismas reglas que P1 (regla inviolable #1): bloqueo de 60 segundos desde el
 * último envío, hecho cumplir de forma atómica por el repositorio, no por la
 * UI. Devuelve 429 con `Retry-After` mientras el cooldown esté activo.
 */
import {
  COOKIE_OTP,
  COOKIE_SESION,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasP4 } from "@/app/api/p4/_dependencias";
import { reenviarOtpCorreo } from "@/domain/verificacion-canal-correo";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const { contexto, expedienteId, otpId } = resolverContextoHttp(request);

  if (!expedienteId || !otpId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await reenviarOtpCorreo(dependenciasP4(), { expedienteId, otpId, contexto });

  if (!resultado.ok) {
    const status = resultado.motivo === "REENVIO_BLOQUEADO" ? 429 : 502;
    return respuestaJson(
      {
        ok: false,
        motivo: resultado.motivo,
        ...(resultado.segundosRestantes === undefined
          ? {}
          : { segundosRestantes: resultado.segundosRestantes }),
      },
      {
        status,
        ...(resultado.segundosRestantes === undefined
          ? {}
          : { cabeceras: { "retry-after": String(resultado.segundosRestantes) } }),
      },
    );
  }

  return respuestaJson(
    {
      ok: true,
      destinoEnmascarado: resultado.destinoEnmascarado,
      expiraEn: resultado.expiraEn,
      registroSeguridad: resultado.registroSeguridad,
    },
    {
      cookies: [
        { nombre: COOKIE_SESION, valor: contexto.sesionId },
        { nombre: COOKIE_OTP, valor: resultado.otpId },
      ],
    },
  );
}
