/**
 * Guardia compartida por los Route Handlers de la consola administrativa:
 * flag encendido + cookie de sesión válida.
 *
 * Vive en un archivo con guion bajo (App Router no lo enruta) para que los
 * tres endpoints apliquen exactamente el mismo control y no haya uno que se
 * olvide de mirar el flag.
 */
import { cookies } from "next/headers";
import { respuestaJson } from "@/app/api/_http/contexto-peticion";
import { COOKIE_CONSOLA, consolaHabilitada, sesionConsolaValida } from "@/app/admin-consola/_sesion";

/** `null` si está todo bien; si no, la respuesta de error que hay que devolver. */
export async function rechazoDeAcceso(): Promise<Response | null> {
  if (!consolaHabilitada()) {
    return respuestaJson({ ok: false, motivo: "NO_DISPONIBLE" }, { status: 404 });
  }

  const almacen = await cookies();
  if (!(await sesionConsolaValida(almacen.get(COOKIE_CONSOLA)?.value))) {
    return respuestaJson({ ok: false, motivo: "NO_AUTORIZADO" }, { status: 401 });
  }

  return null;
}
