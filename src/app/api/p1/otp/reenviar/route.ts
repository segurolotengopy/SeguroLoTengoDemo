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
import { admitirEvento } from "@/app/api/_http/limitador";
import { LIMITE_OTP_REENVIO } from "@/domain/rate-limit";
import { reenviarOtpWhatsapp } from "@/domain/verificacion-canal-whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const { contexto, expedienteId, otpId } = resolverContextoHttp(request);

  // L6 · límite de tasa por IP, antes de tocar el dominio: un pedido rechazado
  // no llega al proveedor de mensajería ni al expediente. Los controles del
  // OTP —vigencia, tres intentos, espera de reenvío— siguen intactos; esto
  // impide repetirlos en masa tirando la cookie.
  const limite = admitirEvento(LIMITE_OTP_REENVIO, contexto.ip);
  if (!limite.permitido) {
    return respuestaJson(
      {
        ok: false,
        motivo: "DEMASIADOS_INTENTOS",
        segundosRestantes: limite.reintentarEnSegundos,
      },
      {
        status: 429,
        cabeceras: { "retry-after": String(limite.reintentarEnSegundos) },
      },
    );
  }

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
      destinoEnmascarado: resultado.destinoEnmascarado,
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
