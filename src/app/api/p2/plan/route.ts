/**
 * `POST /api/p2/plan` — botón `SELECCIONAR <PLAN> Y CONTINUAR →` de P2
 * (docs/ESPECIFICACION_PANTALLAS.md → "P2 · Paso 2 de 9 — Selección de plan").
 *
 * Handler fino: valida la forma del cuerpo, traduce HTTP a
 * `ContextoPeticion` y delega toda la lógica —incluido el hash de la oferta y
 * la transición a PLAN_SELECCIONADO— en `src/domain/seleccion-plan.ts`.
 *
 * El `expedienteId` sale de la cookie `httpOnly`, nunca del cuerpo: el
 * cliente no puede elegir sobre qué expediente opera.
 */
import {
  COOKIE_EXPEDIENTE,
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasP2 } from "@/app/api/p2/_dependencias";
import { seleccionarPlan } from "@/domain/seleccion-plan";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  const planId = typeof cuerpo.planId === "string" ? cuerpo.planId.trim() : "";

  const { contexto, expedienteId } = resolverContextoHttp(request);

  // Sin cookie de expediente no es un error: elegir plan es el primer paso del
  // flujo (CHG-01) y acá nace el trámite. La respuesta devuelve la cookie con
  // el id que acuñó el dominio.
  const resultado = await seleccionarPlan(dependenciasP2(), {
    expedienteId: expedienteId ?? null,
    planId,
    contexto,
  });

  if (!resultado.ok) {
    const status =
      resultado.motivo === "PLAN_INVALIDO"
        ? 400
        : resultado.motivo === "EXPEDIENTE_NO_ENCONTRADO"
          ? 404
          : 409;

    return respuestaJson({ ok: false, motivo: resultado.motivo }, { status });
  }

  return respuestaJson(
    {
      ok: true,
      estado: resultado.estado,
      plan: resultado.plan,
    },
    {
      cookies: [
        { nombre: COOKIE_SESION, valor: contexto.sesionId },
        { nombre: COOKIE_EXPEDIENTE, valor: resultado.expedienteId },
      ],
    },
  );
}
