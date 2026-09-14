/**
 * GET /api/asistente/agente — nombre, perfiles (uno por producto) y bienvenida.
 * Lo llama el widget al abrirse. Sin sesión, sin datos de la persona.
 */
import { respuestaJson } from "@/app/api/_http/contexto-peticion";
import { dependenciasAsistente } from "@/app/api/asistente/_dependencias";
import { asistenteHabilitado } from "@/app/api/asistente/_habilitado";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!asistenteHabilitado()) return respuestaJson({ ok: false, motivo: "NO_DISPONIBLE" }, { status: 404 });
  const descripcion = await dependenciasAsistente().asistente.describir();
  if (!descripcion) return respuestaJson({ ok: false, motivo: "NO_DISPONIBLE" }, { status: 502 });
  return respuestaJson({ ok: true, ...descripcion });
}
