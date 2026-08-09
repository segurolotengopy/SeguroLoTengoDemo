/**
 * `POST /api/admin-consola/reinicio` — reinicio con justificativo
 * (`docs/CONSOLA_ADMINISTRATIVA.md` §5).
 *
 * **Este endpoint no puede reactivar un expediente.** Crea uno nuevo en
 * `INICIADO` enlazado al anterior por `expedienteAnteriorId`, y deja evidencia
 * en ambos. El expediente original no se transiciona, no se edita y no se
 * borra: `DERIVADO_MANUAL` sigue siendo terminal también desde acá (regla
 * inviolable #5). La lógica entera vive en `src/domain/consola-administrativa.ts`;
 * este archivo solo traduce HTTP.
 *
 * El bloqueo por cédula se levanta como *consecuencia* de que exista un
 * sucesor, no por un flag que este handler ponga.
 */
import {
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { rechazoDeAcceso } from "@/app/api/admin-consola/_guardia";
import { reiniciarExpediente } from "@/domain/consola-administrativa";
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

  const repositorio = crearExpedienteRepository();
  const { contexto } = resolverContextoHttp(request);

  const resultado = await reiniciarExpediente(
    { expedientes: repositorio, evidencias: crearEvidenceStore(), sucesores: repositorio },
    {
      expedienteId,
      justificativo: cuerpo.justificativo,
      detalleLibre: cuerpo.detalleLibre,
      contexto,
    },
  );

  if (!resultado.ok) {
    const status =
      resultado.motivo === "EXPEDIENTE_NO_ENCONTRADO"
        ? 404
        : resultado.motivo === "ESTADO_NO_REINICIABLE" || resultado.motivo === "YA_REINICIADO"
          ? 409
          : 400;
    return respuestaJson({ ok: false, motivo: resultado.motivo }, { status });
  }

  return respuestaJson({
    ok: true,
    expedienteAnteriorId: resultado.expedienteAnteriorId,
    expedienteNuevoId: resultado.expedienteNuevoId,
    justificativo: resultado.justificativo,
    creadoEn: resultado.creadoEn,
  });
}
