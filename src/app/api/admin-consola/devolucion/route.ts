/**
 * `POST /api/admin-consola/devolucion` — abrir o cerrar un trámite de
 * devolución del premio (D-02).
 *
 * Dos acciones sobre el mismo recurso, distinguidas por `accion`:
 *
 * - `SOLICITAR` — PAGO_CONFIRMADO | EMITIDO → DEVOLUCION_EN_TRAMITE, con
 *   solicitante y motivo. Solo sobre un cobro acreditado.
 * - `ACREDITAR` — DEVOLUCION_EN_TRAMITE → DEVUELTO, con la referencia del
 *   reintegro que prueba que el dinero volvió.
 *
 * **La consola asienta el trámite, no lo ejecuta.** La devolución la hacen
 * Bancard y Alianza fuera del flujo digital; acá se registra quién la pidió,
 * por qué, y con qué referencia se cerró. Las transiciones las decide
 * `src/domain/devolucion.ts` y nunca este archivo.
 *
 * No hay ningún campo de cuenta de destino, en el cuerpo ni en el dominio: la
 * devolución va al medio de origen (fila 30 de la matriz).
 */
import { leerJson, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { rechazoDeAcceso } from "@/app/api/admin-consola/_guardia";
import { acreditarDevolucion, solicitarDevolucion } from "@/domain/devolucion";
import type { MotivoRechazoDevolucion } from "@/domain/devolucion";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

function estadoHttp(motivo: MotivoRechazoDevolucion): number {
  switch (motivo) {
    case "EXPEDIENTE_NO_ENCONTRADO":
      return 404;
    // Entradas mal armadas: el llamador puede corregirlas.
    case "MOTIVO_INVALIDO":
    case "SOLICITANTE_INVALIDO":
    case "REFERENCIA_REQUERIDA":
      return 400;
    // El expediente no está donde la acción necesita que esté.
    default:
      return 409;
  }
}

export async function POST(request: Request): Promise<Response> {
  const rechazo = await rechazoDeAcceso();
  if (rechazo) return rechazo;

  const cuerpo = await leerJson(request);
  if (!cuerpo) return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });

  const expedienteId = typeof cuerpo.expedienteId === "string" ? cuerpo.expedienteId.trim() : "";
  if (expedienteId === "") {
    return respuestaJson({ ok: false, motivo: "ID_REQUERIDO" }, { status: 400 });
  }

  const { contexto } = resolverContextoHttp(request);
  const deps = { expedientes: crearExpedienteRepository(), evidencias: crearEvidenceStore() };

  const resultado =
    cuerpo.accion === "ACREDITAR"
      ? await acreditarDevolucion(deps, {
          expedienteId,
          referenciaReintegro:
            typeof cuerpo.referenciaReintegro === "string" ? cuerpo.referenciaReintegro : "",
          contexto,
        })
      : await solicitarDevolucion(deps, {
          expedienteId,
          solicitante: cuerpo.solicitante,
          motivo: cuerpo.motivo,
          contexto,
        });

  if (!resultado.ok) {
    return respuestaJson({ ok: false, motivo: resultado.motivo }, { status: estadoHttp(resultado.motivo) });
  }

  return respuestaJson({
    ok: true,
    cambio: resultado.cambio,
    estado: resultado.estado,
    devolucion: resultado.devolucion,
  });
}
