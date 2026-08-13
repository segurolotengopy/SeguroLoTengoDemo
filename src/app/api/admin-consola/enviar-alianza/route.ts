/**
 * `POST /api/admin-consola/enviar-alianza` — remisión simulada del caso al
 * equipo de Alianza (`docs/CONSOLA_ADMINISTRATIVA.md`; acción de la consola,
 * pensada sobre todo para expedientes de Pantalla A / Pantalla B).
 *
 * En el demo no sale ningún correo real: la lógica de
 * `src/domain/consola-administrativa.ts` deja evidencia append-only del envío
 * en el expediente y devuelve el destinatario y el asunto simulados. No
 * transiciona ni edita el expediente.
 */
import {
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { rechazoDeAcceso } from "@/app/api/admin-consola/_guardia";
import { enviarCasoAAlianza } from "@/domain/consola-administrativa";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const rechazo = await rechazoDeAcceso();
  if (rechazo) return rechazo;

  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  const expedienteId = typeof cuerpo.expedienteId === "string" ? cuerpo.expedienteId.trim() : "";
  if (expedienteId === "") {
    return respuestaJson({ ok: false, motivo: "ID_REQUERIDO" }, { status: 400 });
  }

  const { contexto } = resolverContextoHttp(request);
  const resultado = await enviarCasoAAlianza(
    { expedientes: crearExpedienteRepository(), evidencias: crearEvidenceStore() },
    { expedienteId, contexto },
  );

  if (!resultado.ok) {
    return respuestaJson({ ok: false, motivo: resultado.motivo }, { status: 404 });
  }

  return respuestaJson({
    ok: true,
    destinatario: resultado.destinatario,
    asunto: resultado.asunto,
    enviadoEn: resultado.enviadoEn,
  });
}
