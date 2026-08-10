/**
 * `POST /api/demo-panel/sesion` — canjea la clave del panel por una cookie de
 * sesión firmada.
 *
 * Existe solo con `DEMO_MODE=true`; con el flag apagado devuelve 404, igual
 * que la pantalla del panel.
 *
 * La clave viaja en el cuerpo del POST, nunca en la URL (una query string
 * queda en logs de acceso e historial del navegador).
 */
import { COOKIE_PANEL, autenticar, esModoDemo } from "@/app/demo-panel/_sesion";
import { leerJson, respuestaJson } from "@/app/api/_http/contexto-peticion";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!esModoDemo()) {
    return respuestaJson({ ok: false, motivo: "NO_DISPONIBLE" }, { status: 404 });
  }

  const cuerpo = await leerJson(request);
  const clave = typeof cuerpo?.clave === "string" ? cuerpo.clave : "";
  if (!clave) {
    return respuestaJson({ ok: false, motivo: "CLAVE_REQUERIDA" }, { status: 400 });
  }

  const token = await autenticar(clave);
  if (!token) {
    return respuestaJson({ ok: false, motivo: "CLAVE_INCORRECTA" }, { status: 401 });
  }

  return respuestaJson(
    { ok: true },
    { cookies: [{ nombre: COOKIE_PANEL, valor: token, maxAge: 60 * 60 }] },
  );
}
