/**
 * `POST /api/p1/otp/reenviar` — enlace `Reenviar código` de P1.
 *
 * Sujeto al bloqueo de 60 segundos desde el último envío (regla inviolable
 * #1). Devuelve 429 con `Retry-After` mientras el cooldown esté activo; el
 * bloqueo lo hace cumplir el repositorio de forma atómica, no la UI.
 */
import { dependenciasP1 } from "@/app/api/p1/_dependencias";
import {
  COOKIE_OTP,
  COOKIE_SESION,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { reenviarOtpWhatsapp } from "@/domain/verificacion-canal-whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const { contexto, expedienteId, otpId } = resolverContextoHttp(request);

  if (!expedienteId || !otpId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await reenviarOtpWhatsapp(dependenciasP1(), {
    expedienteId,
    otpId,
    contexto,
  });

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
      numeroEnmascarado: resultado.numeroEnmascarado,
      expiraEn: resultado.expiraEn,
      registroSeguridad: resultado.registroSeguridad,
    },
    {
      cookies: [
        { nombre: COOKIE_SESION, valor: contexto.sesionId },
        // El reenvío rota el código dentro del mismo otpId, pero se reescribe
        // la cookie para refrescar su vida útil junto con la sesión.
        { nombre: COOKIE_OTP, valor: resultado.otpId },
      ],
    },
  );
}
