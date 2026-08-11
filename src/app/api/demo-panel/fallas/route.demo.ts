/**
 * `POST /api/demo-panel/fallas` — arma o desarma uno de los cuatro fallos
 * puntuales de la demostración (CLAUDE.md → "Panel de demo").
 *
 * La palanca en sí, con su lista cerrada de cuatro y su semántica de un solo
 * uso, vive en `src/adapters/mock/fallas-demo.ts`. Acá solo está la puerta.
 *
 * Doble candado, igual que el resto del panel: `DEMO_MODE=true` (si no, 404) y
 * cookie de sesión válida del panel. Nada de esto es alcanzable desde el flujo
 * P0–P9.
 */
import { leerCookies, leerJson, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { COOKIE_PANEL, esModoDemo, sesionValida } from "@/app/demo-panel/_sesion";
import { armarFallaDemo, esFallaDemo, reiniciarFallasDemo, fallasArmadasDemo } from "@/adapters/mock/fallas-demo";

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

  if (cuerpo?.reiniciar === true) {
    reiniciarFallasDemo();
    return respuestaJson({ ok: true, armadas: fallasArmadasDemo() });
  }

  if (!esFallaDemo(cuerpo?.falla) || typeof cuerpo.activa !== "boolean") {
    return respuestaJson({ ok: false, motivo: "PEDIDO_INVALIDO" }, { status: 400 });
  }

  const resultado = armarFallaDemo(cuerpo.falla, cuerpo.activa);
  if (!resultado.ok) {
    return respuestaJson({ ok: false, motivo: resultado.motivo }, { status: 400 });
  }

  return respuestaJson({ ok: true, armadas: resultado.armadas });
}
