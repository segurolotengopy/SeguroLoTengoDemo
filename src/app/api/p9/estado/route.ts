/**
 * `GET /api/p9/estado` — sondeo de la confirmación, que avanza dos cosas
 * independientes: la emisión en Alianza y la **entrega** de los documentos a
 * los canales verificados (CHG-44).
 *
 * **No mueve el estado del expediente**: EMITIDO ya se alcanzó al aceptarse la
 * solicitud. Lo único que avanza es el estado de la póliza y el de la factura,
 * que los mueve Alianza (SEBAOT y SIFEN) a su ritmo. La actualización la
 * ejecuta `src/domain/expediente.ts`, nunca este archivo.
 *
 * **El despachador de entregas se cuelga de este sondeo** y no de un job
 * aparte: el demo no tiene cola y la pantalla ya pregunta cada dos segundos.
 * En producción va detrás de SQS y el dominio no cambia — cambia quién llama a
 * `despacharEntregas`. Que la entrega falle no rompe el sondeo ni el
 * expediente: los documentos siguen descargables y la pantalla informa el
 * estado real de cada canal.
 *
 * Idempotente: si nada cambió no escribe ni deja evidencia.
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { dependenciasEntregaP9, dependenciasP9 } from "@/app/api/p9/_dependencias";
import { consultarEmisionP9 } from "@/domain/emision-p9";
import { despacharEntregas } from "@/domain/entrega-documentos";
import type { EntregaDeDocumentos } from "@/domain/entrega-documentos";
import { crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await consultarEmisionP9(dependenciasP9(), { expedienteId, contexto });
  const cookies = [{ nombre: COOKIE_SESION, valor: contexto.sesionId }];

  if (!resultado.ok) {
    return respuestaJson(
      { ok: false, motivo: resultado.motivo },
      { status: resultado.motivo === "EXPEDIENTE_NO_ENCONTRADO" ? 404 : 409, cookies },
    );
  }

  const entregas = await avanzarEntregas(expedienteId, contexto);

  return respuestaJson(
    {
      ok: true,
      estadoPoliza: resultado.poliza.estado,
      estadoFactura: resultado.poliza.estadoFactura,
      referenciaFactura: resultado.poliza.referenciaFactura,
      emitidaEn: resultado.poliza.emitidaEn,
      entregas,
    },
    { cookies },
  );
}

/** Lo que la pantalla necesita saber de cada canal. Nunca el destino completo. */
interface EntregaParaPantalla {
  readonly canal: string;
  readonly destinoEnmascarado: string;
  readonly estado: string;
  readonly intentos: number;
  readonly proximoIntentoEn: string | null;
  readonly acusadaEn: string | null;
}

function paraPantalla(entrega: EntregaDeDocumentos): EntregaParaPantalla {
  return {
    canal: entrega.canal,
    destinoEnmascarado: entrega.destinoEnmascarado,
    estado: entrega.estado,
    intentos: entrega.intentos,
    proximoIntentoEn: entrega.proximoIntentoEn,
    acusadaEn: entrega.acusadaEn,
  };
}

/**
 * Avanza las entregas y devuelve su estado. **Best-effort**: si la mensajería
 * o la base fallan, el sondeo responde igual con lo de la póliza. La entrega
 * es una consecuencia de la emisión, no una condición suya.
 */
async function avanzarEntregas(
  expedienteId: string,
  contexto: Parameters<typeof despacharEntregas>[1]["contexto"],
): Promise<readonly EntregaParaPantalla[]> {
  try {
    const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
    if (!expediente) return [];
    const despacho = await despacharEntregas(dependenciasEntregaP9(), { expediente, contexto });
    return despacho.entregas.map(paraPantalla);
  } catch {
    return [];
  }
}
