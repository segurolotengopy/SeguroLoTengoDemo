/**
 * `POST /api/demo-panel/plazo-firma` — acelerador del plazo para firmar.
 *
 * CLAUDE.md → "Panel de demo": *"acelerar el plazo de firma de 24 h a
 * segundos"*. Sin esto no hay forma de mostrar la Pantalla B en una reunión:
 * habría que pagar el QR y volver al día siguiente.
 *
 * La palanca en sí, con sus candados —solo en modo demo, solo acortando, y sin
 * tocar ningún expediente ya vencido— vive en
 * `src/adapters/mock/plazo-firma-demo.ts`. Acá solo está la puerta.
 *
 * Doble candado, igual que el resto del panel: `DEMO_MODE=true` (si no, 404) y
 * cookie de sesión válida del panel.
 */
import { leerCookies, leerJson, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { COOKIE_PANEL, esModoDemo, sesionValida } from "@/app/demo-panel/_sesion";
import { fijarPlazoFirmaDemo, plazoFirmaMs } from "@/adapters/mock/plazo-firma-demo";

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
  const ms = typeof cuerpo?.plazoMs === "number" ? cuerpo.plazoMs : Number.NaN;

  const resultado = fijarPlazoFirmaDemo(ms);
  if (!resultado.ok) {
    return respuestaJson({ ok: false, motivo: resultado.motivo }, { status: 400 });
  }

  return respuestaJson({ ok: true, plazoMs: plazoFirmaMs() });
}
