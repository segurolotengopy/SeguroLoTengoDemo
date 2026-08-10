/**
 * `GET /api/p9/estado` — sondeo de P9 mientras la póliza dice `EN EMISIÓN`.
 *
 * **No mueve el estado del expediente**: EMITIDO ya se alcanzó al aceptarse la
 * solicitud. Lo único que avanza es el estado de la póliza y el de la factura,
 * que los mueve Alianza (SEBAOT y SIFEN) a su ritmo. La actualización la
 * ejecuta `src/domain/expediente.ts`, nunca este archivo.
 *
 * Idempotente: si nada cambió no escribe ni deja evidencia.
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { dependenciasP9 } from "@/app/api/p9/_dependencias";
import { consultarEmisionP9 } from "@/domain/emision-p9";

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

  return respuestaJson(
    {
      ok: true,
      estadoPoliza: resultado.poliza.estado,
      estadoFactura: resultado.poliza.estadoFactura,
      referenciaFactura: resultado.poliza.referenciaFactura,
      emitidaEn: resultado.poliza.emitidaEn,
    },
    { cookies },
  );
}
