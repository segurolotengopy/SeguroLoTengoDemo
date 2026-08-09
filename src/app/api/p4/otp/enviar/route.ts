/**
 * `POST /api/p4/otp/enviar` — botón `ENVIAR CÓDIGO` de P4
 * (docs/ESPECIFICACION_PANTALLAS.md → "P4 · Paso 4 de 9").
 *
 * Gemelo del de P1, contra el mismo motor de canal: valida la forma del
 * cuerpo, traduce HTTP a `ContextoPeticion` y delega toda la lógica en
 * `src/domain/verificacion-canal-correo.ts`. No toca el estado del expediente
 * ni conoce a DynamoDB.
 *
 * Regla inviolable #2: la respuesta no tiene ningún campo donde pudiera
 * viajar el código — ni siquiera en modo demo. Verificado en
 * `../../__tests__/no-filtra-codigo-otp.test.ts`.
 */
import {
  COOKIE_EXPEDIENTE,
  COOKIE_OTP,
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasP4 } from "@/app/api/p4/_dependencias";
import { INTENTOS_MAXIMOS_OTP } from "@/domain/reglas-otp";
import { enviarOtpCorreo } from "@/domain/verificacion-canal-correo";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  const correoIngresado = typeof cuerpo.correo === "string" ? cuerpo.correo : "";

  const { contexto, expedienteId, otpId } = resolverContextoHttp(request);
  if (!expedienteId) {
    // P4 nunca crea expediente: sin cookie, el recorrido no pasó por P1.
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await enviarOtpCorreo(dependenciasP4(), {
    expedienteId,
    // El cooldown se aplica contra el OTP previo solo si es del mismo
    // propósito: el otpId de P1 que pueda quedar en la cookie no bloquea el
    // primer envío del correo.
    otpIdPrevio: otpId,
    correoIngresado,
    contexto,
  });

  if (!resultado.ok) {
    const status =
      resultado.motivo === "REENVIO_BLOQUEADO"
        ? 429
        : resultado.motivo === "ESTADO_INVALIDO"
          ? 409
          : resultado.motivo === "ERROR_ENVIO"
            ? 502
            : 400;

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
      intentosMaximos: INTENTOS_MAXIMOS_OTP,
      registroSeguridad: resultado.registroSeguridad,
    },
    {
      cookies: [
        { nombre: COOKIE_SESION, valor: contexto.sesionId },
        { nombre: COOKIE_EXPEDIENTE, valor: resultado.expedienteId },
        { nombre: COOKIE_OTP, valor: resultado.otpId },
      ],
    },
  );
}
