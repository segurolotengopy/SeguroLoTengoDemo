/**
 * `GET /api/p9/resumen` — lo que P9 necesita para dibujarse.
 *
 * Hace dos cosas además de leer, las dos idempotentes:
 *
 * 1. **Remite el expediente a Alianza** (`emitirPolizaP9`): FIRMADO → EMITIDO,
 *    con la póliza `EN PROCESO DE EMISIÓN`. Es el paso 3 de los cuatro hitos —
 *    `Solicitud aceptada ✓`— y ocurre en el momento en que la persona entra.
 * 2. **Archiva los PDF firmados** que devolvió Code100, para que los botones
 *    `DESCARGAR` tengan qué servir. Si ya están guardados no vuelve a pedirlos.
 * 3. **Arranca la entrega** de los documentos a los canales verificados
 *    (CHG-44). El primer intento sale acá, con la persona todavía mirando la
 *    pantalla; los reintentos los avanza el sondeo.
 *
 * Ninguna de las tres rompe la pantalla si falla: el archivado y la entrega se
 * reintentan en la próxima pasada, y el resumen se responde igual con lo que
 * haya.
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import {
  dependenciasArchivadoP9,
  dependenciasEntregaP9,
  dependenciasP9,
} from "@/app/api/p9/_dependencias";
import { despacharEntregas } from "@/domain/entrega-documentos";
import { archivarDocumentosFirmados } from "@/documentos";
import { emitirPolizaP9, leerResumenP9 } from "@/domain/emision-p9";
import type { MotivoRechazoP9 } from "@/domain/emision-p9";
import { crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

function estadoHttp(motivo: MotivoRechazoP9): number {
  switch (motivo) {
    case "EXPEDIENTE_NO_ENCONTRADO":
      return 404;
    case "SEBAOT_NO_DISPONIBLE":
      return 502;
    default:
      return 409;
  }
}

export async function GET(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const cookies = [{ nombre: COOKIE_SESION, valor: contexto.sesionId }];

  const emision = await emitirPolizaP9(dependenciasP9(), { expedienteId, contexto });
  if (!emision.ok) {
    return respuestaJson(
      { ok: false, motivo: emision.motivo },
      { status: estadoHttp(emision.motivo), cookies },
    );
  }

  const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
  if (!expediente) {
    return respuestaJson({ ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" }, { status: 404, cookies });
  }

  // Best-effort: si Code100 no contesta, la pantalla se dibuja igual y los
  // botones de descarga responden 404 hasta la próxima carga.
  const archivado = await archivarDocumentosFirmados(dependenciasArchivadoP9(), expediente);

  const resumen = leerResumenP9(expediente);
  if (!resumen) {
    return respuestaJson({ ok: false, motivo: "ESTADO_INVALIDO" }, { status: 409, cookies });
  }

  // La entrega necesita el paquete firmado ya archivado, así que va después.
  // Best-effort por lo mismo que el archivado: un problema de mensajería no
  // puede impedir que la persona vea su contratación aceptada.
  const entregas = await (async () => {
    try {
      const despacho = await despacharEntregas(dependenciasEntregaP9(), { expediente, contexto });
      return despacho.entregas.map((entrega) => ({
        canal: entrega.canal,
        destinoEnmascarado: entrega.destinoEnmascarado,
        estado: entrega.estado,
        intentos: entrega.intentos,
        proximoIntentoEn: entrega.proximoIntentoEn,
        acusadaEn: entrega.acusadaEn,
      }));
    } catch {
      return [];
    }
  })();

  return respuestaJson(
    { ok: true, resumen, documentosDisponibles: archivado.ok, entregas },
    { cookies },
  );
}
