/**
 * `POST /api/demo-panel/devolucion` — Alianza devolvió el premio al medio de
 * origen (DEVOLUCION_EN_TRAMITE → DEVUELTO).
 *
 * Es la última etapa de la Pantalla B, y ocurre **fuera del flujo digital**: la
 * persona se presenta en las oficinas de Alianza con su cédula, firma el
 * formulario presencial y Alianza ejecuta la devolución. SeguroLoTengo no lo
 * hace ni puede observarlo; solo lo asienta.
 *
 * Por eso vive en el panel de demo, junto a las otras cosas que hacen los
 * actores externos (Bancard acreditando, Code100 firmando). **En producción el
 * lugar de esta acción es la consola administrativa**, que es la herramienta de
 * cumplimiento interno; queda pendiente agregarla ahí cuando se amplíe
 * `docs/CONSOLA_ADMINISTRATIVA.md`.
 *
 * Doble candado, igual que el resto del panel: `DEMO_MODE=true` (si no, 404) y
 * cookie de sesión válida del panel. La transición la ejecuta
 * `src/domain/devolucion-pantalla-b.ts`, nunca este archivo.
 */
import {
  COOKIE_EXPEDIENTE,
  leerCookies,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { COOKIE_PANEL, esModoDemo, sesionValida } from "@/app/demo-panel/_sesion";
import { registrarDevolucionEjecutadaPantallaB } from "@/domain/devolucion-pantalla-b";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!esModoDemo()) {
    return respuestaJson({ ok: false, motivo: "NO_DISPONIBLE" }, { status: 404 });
  }

  const cookies = leerCookies(request);
  const autorizado = await sesionValida(cookies[COOKIE_PANEL]);
  if (!autorizado) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 401 });
  }

  const expedienteId = cookies[COOKIE_EXPEDIENTE];
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SIN_EXPEDIENTE" }, { status: 400 });
  }

  const { contexto } = resolverContextoHttp(request);

  const resultado = await registrarDevolucionEjecutadaPantallaB(
    { expedientes: crearExpedienteRepository(), evidencias: crearEvidenceStore() },
    { expedienteId, contexto },
  );

  if (!resultado.ok) {
    return respuestaJson(
      { ok: false, motivo: resultado.motivo },
      { status: resultado.motivo === "EXPEDIENTE_NO_ENCONTRADO" ? 404 : 409 },
    );
  }

  return respuestaJson({ ok: true, estado: resultado.estado });
}
