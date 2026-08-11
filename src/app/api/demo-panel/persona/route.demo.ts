/**
 * `POST /api/demo-panel/persona` — elige la persona de prueba activa y, si se
 * quiere, fuerza un desenlace de la verificación de identidad de P5.
 *
 * CLAUDE.md → "Panel de demo": *"Permite: elegir persona de prueba… forzar
 * fallos puntuales"*. Es la única entrada que escribe esa selección; los
 * adaptadores `mock` solo la leen.
 *
 * Doble candado, igual que el resto del panel: `DEMO_MODE=true` (si no, 404,
 * la ruta no existe) y cookie de sesión válida del panel. Nada de esto es
 * alcanzable desde el flujo P0–P9.
 */
import { leerCookies, respuestaJson, leerJson } from "@/app/api/_http/contexto-peticion";
import { COOKIE_PANEL, esModoDemo, sesionValida } from "@/app/demo-panel/_sesion";
import {
  esEscenarioIdentidadDemo,
  esIdPersonaDemo,
  fijarSeleccionDemo,
} from "@/adapters/mock/persona-activa";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!esModoDemo()) {
    return respuestaJson({ ok: false, motivo: "NO_DISPONIBLE" }, { status: 404 });
  }

  const autorizado = await sesionValida(leerCookies(request)[COOKIE_PANEL]);
  if (!autorizado) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 401 });
  }

  const cuerpo = await leerJson(request);
  if (!cuerpo || !esIdPersonaDemo(cuerpo.personaId)) {
    return respuestaJson({ ok: false, motivo: "PERSONA_INVALIDA" }, { status: 400 });
  }

  // Vacío o ausente = sin forzar: manda el desenlace propio de la persona.
  const forzado = cuerpo.escenarioIdentidadForzado;
  if (forzado !== undefined && forzado !== null && forzado !== "" && !esEscenarioIdentidadDemo(forzado)) {
    return respuestaJson({ ok: false, motivo: "ESCENARIO_INVALIDO" }, { status: 400 });
  }

  fijarSeleccionDemo({
    personaId: cuerpo.personaId,
    escenarioIdentidadForzado: esEscenarioIdentidadDemo(forzado) ? forzado : null,
  });

  return respuestaJson({ ok: true });
}
