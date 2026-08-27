/**
 * `POST /api/p1/otp/verificar` — botón `VERIFICAR WHATSAPP` de P1.
 *
 * Es la única puerta por la que el expediente pasa de INICIADO a
 * CANAL_WA_VERIFICADO, y ni siquiera lo hace este archivo: la transición la
 * ejecuta `verificarOtpWhatsapp` a través de `transicionarExpediente`.
 *
 * El número que queda registrado como canal verificado es el que persistió
 * el OTP, no uno que mande el cliente en esta petición: acá solo viaja el
 * código tipeado.
 */
import { dependenciasP1 } from "@/app/api/p1/_dependencias";
import {
  COOKIE_OTP,
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { admitirEvento } from "@/app/api/_http/limitador";
import { LIMITE_OTP_VERIFICACION } from "@/domain/rate-limit";
import { LONGITUD_CODIGO_OTP } from "@/domain/reglas-otp";
import { verificarOtpWhatsapp } from "@/domain/verificacion-canal-whatsapp";

export const dynamic = "force-dynamic";

const FORMATO_CODIGO = new RegExp(`^\\d{${LONGITUD_CODIGO_OTP}}$`);

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  const codigoIngresado = typeof cuerpo.codigo === "string" ? cuerpo.codigo.trim() : "";
  if (!FORMATO_CODIGO.test(codigoIngresado)) {
    // Se rechaza antes de tocar la base: un código con formato inválido no
    // debe gastar uno de los 3 intentos.
    return respuestaJson({ ok: false, motivo: "FORMATO_INVALIDO" }, { status: 400 });
  }

  const { contexto, expedienteId, otpId } = resolverContextoHttp(request);

  // L6 · límite de tasa por IP, antes de tocar el dominio: un pedido rechazado
  // no llega al proveedor de mensajería ni al expediente. Los controles del
  // OTP —vigencia, tres intentos, espera de reenvío— siguen intactos; esto
  // impide repetirlos en masa tirando la cookie.
  const limite = admitirEvento(LIMITE_OTP_VERIFICACION, contexto.ip);
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

  const resultado = await verificarOtpWhatsapp(dependenciasP1(), {
    expedienteId,
    otpId,
    codigoIngresado,
    contexto,
  });

  if (!resultado.ok) {
    const status =
      resultado.motivo === "CODIGO_INCORRECTO"
        ? 400
        : resultado.motivo === "INTENTOS_AGOTADOS"
          ? 429
          : resultado.motivo === "OTP_NO_ENCONTRADO"
            ? 404
            : 409;

    return respuestaJson(
      {
        ok: false,
        motivo: resultado.motivo,
        ...(resultado.intentosRestantes === undefined
          ? {}
          : { intentosRestantes: resultado.intentosRestantes }),
      },
      { status },
    );
  }

  return respuestaJson(
    {
      ok: true,
      estado: resultado.estado,
      destinoEnmascarado: resultado.destinoEnmascarado,
      registroSeguridad: resultado.registroSeguridad,
    },
    {
      cookies: [
        { nombre: COOKIE_SESION, valor: contexto.sesionId },
        // OTP consumido (uso único): se borra la cookie para que no quede a
        // mano un identificador ya inservible.
        { nombre: COOKIE_OTP, valor: "", maxAge: 0 },
      ],
    },
  );
}
