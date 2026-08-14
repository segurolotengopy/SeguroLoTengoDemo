/**
 * `POST /api/p5/liveness-sesion` — abre la sesión de prueba de vida que el
 * componente `FaceLivenessDetector` necesita para empezar a transmitir
 * (botón `INICIAR VERIFICACIÓN` de P5).
 *
 * Existe porque la prueba de vida real no manda bytes al backend: el video va
 * del navegador **directo a Rekognition**, y para eso el navegador necesita un
 * `SessionId` que solo el servidor puede crear (es el que tiene credenciales).
 * El resultado se consulta después, por `/api/p5/captura` con `selfieSesion`.
 *
 * Devuelve la referencia de sesión y la región. **La región es dato público
 * del endpoint, no un secreto**, y el componente la necesita para saber contra
 * qué host abrir el stream; las credenciales nunca salen de acá.
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { obtenerIdentityProvider } from "@/adapters/registro";
import { soportaSesionPruebaDeVida } from "@/ports/identity-provider";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const identidad = obtenerIdentityProvider();

  // El mock del demo no abre sesiones de streaming. Se responde 409 y no 500:
  // no es una falla, es que en modo mock este camino no aplica y la pantalla
  // tiene que usar el de bytes.
  if (!soportaSesionPruebaDeVida(identidad)) {
    return respuestaJson(
      { ok: false, motivo: "PRUEBA_DE_VIDA_EN_VIVO_NO_DISPONIBLE" },
      { status: 409 },
    );
  }

  try {
    const sesion = await identidad.crearSesionPruebaDeVida(expedienteId);

    return respuestaJson(
      {
        ok: true,
        referenciaSesion: sesion.referenciaSesion,
        vigenciaSegundos: sesion.vigenciaSegundos,
        region: process.env.AWS_REGION ?? "us-east-1",
      },
      { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
    );
  } catch {
    // No se filtra el mensaje del proveedor: puede traer detalles de la cuenta
    // o del pedido que no tienen por qué llegar al navegador.
    return respuestaJson({ ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE" }, { status: 502 });
  }
}
