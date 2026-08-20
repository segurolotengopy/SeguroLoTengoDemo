/**
 * `POST /api/p1/otp/enviar` — botón `ENVIAR CÓDIGO` de P1
 * (docs/ESPECIFICACION_PANTALLAS.md → "P1 · Paso 1 de 9").
 *
 * El handler es fino a propósito: valida la forma del cuerpo, traduce HTTP a
 * `ContextoPeticion` y delega TODA la lógica en
 * `src/domain/verificacion-canal-whatsapp.ts`. No toca el estado del
 * expediente (regla de CLAUDE.md) ni conoce a DynamoDB.
 *
 * Regla inviolable #2: la respuesta no tiene ningún campo donde pudiera
 * viajar el código — ni siquiera en modo demo, donde el código se lee solo
 * desde el panel. Verificado en `../../__tests__/no-filtra-codigo-otp.test.ts`.
 */
import { destinoDelExpediente } from "@/domain/rutas-flujo";
import { dependenciasP1 } from "@/app/api/p1/_dependencias";
import {
  COOKIE_EXPEDIENTE,
  COOKIE_OTP,
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { admitirEvento } from "@/app/api/_http/limitador";
import { LIMITE_OTP_ENVIO } from "@/domain/rate-limit";
import { INTENTOS_MAXIMOS_OTP } from "@/domain/reglas-otp";
import { enviarOtpWhatsapp } from "@/domain/verificacion-canal-whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  const numeroIngresado = typeof cuerpo.numero === "string" ? cuerpo.numero : "";
  const autorizacionAceptada = cuerpo.autorizacionAceptada === true;

  const { contexto, expedienteId, otpId } = resolverContextoHttp(request);

  // L6 · límite de tasa por IP, antes de tocar el dominio: un pedido rechazado
  // no llega al proveedor de mensajería ni al expediente. Los controles del
  // OTP —vigencia, tres intentos, espera de reenvío— siguen intactos; esto
  // impide repetirlos en masa tirando la cookie.
  const limite = admitirEvento(LIMITE_OTP_ENVIO, contexto.ip);
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

  const resultado = await enviarOtpWhatsapp(dependenciasP1(), {
    expedienteId,
    otpIdPrevio: otpId,
    numeroIngresado,
    autorizacionAceptada,
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
        // El expediente quedó en otro paso: se devuelve a dónde ir, para que
        // la pantalla reencamine en vez de solo avisar (`rutas-flujo.ts`).
        ...(resultado.estado ? { destino: destinoDelExpediente(resultado.estado) } : {}),
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
