/**
 * `POST /api/admin-consola/sesion` — canjea `ADMIN_CONSOLE_KEY` por una cookie
 * de sesión firmada (`docs/CONSOLA_ADMINISTRATIVA.md` §2).
 *
 * Con `ADMIN_CONSOLE_ENABLED` apagado responde 404: la ruta no existe.
 * La clave viaja en el cuerpo del POST, nunca en la URL.
 */
import { leerJson, respuestaJson } from "@/app/api/_http/contexto-peticion";
import {
  COOKIE_CONSOLA,
  VIDA_SESION_CONSOLA_SEGUNDOS,
  autenticarConsola,
  consolaHabilitada,
} from "@/app/admin-consola/_sesion";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!consolaHabilitada()) {
    return respuestaJson({ ok: false, motivo: "NO_DISPONIBLE" }, { status: 404 });
  }

  const cuerpo = await leerJson(request);
  const clave = typeof cuerpo?.clave === "string" ? cuerpo.clave : "";
  if (!clave) {
    return respuestaJson({ ok: false, motivo: "CLAVE_REQUERIDA" }, { status: 400 });
  }

  const token = await autenticarConsola(clave);
  if (!token) {
    return respuestaJson({ ok: false, motivo: "CLAVE_INCORRECTA" }, { status: 401 });
  }

  return respuestaJson(
    { ok: true },
    { cookies: [{ nombre: COOKIE_CONSOLA, valor: token, maxAge: VIDA_SESION_CONSOLA_SEGUNDOS }] },
  );
}
