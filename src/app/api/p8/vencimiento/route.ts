/**
 * `POST /api/p8/vencimiento` — la cuenta regresiva de P8 llegó a cero.
 *
 * No es el reloj de la pantalla el que vence el expediente: el que decide es
 * `plazoFirmaVenceEn`, comparado contra la hora del servidor dentro de
 * `vencerPlazoFirmaSiCorresponde`. Este endpoint solo le da al navegador una
 * forma de pedir esa evaluación en el momento exacto en que su contador llega a
 * cero, en vez de esperar al siguiente sondeo. Adelantar el reloj del cliente
 * no adelanta nada: el servidor vuelve a mirar la hora real y contesta que
 * todavía no.
 *
 * Es idempotente y seguro de llamar de más: sobre un expediente ya vencido, ya
 * firmado o todavía en plazo, no escribe nada.
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { dependenciasP8 } from "@/app/api/p8/_dependencias";
import { RUTA_PANTALLA_B, vencerPlazoFirmaP8 } from "@/domain/firma-p8";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await vencerPlazoFirmaP8(dependenciasP8(), { expedienteId, contexto });
  const cookies = [{ nombre: COOKIE_SESION, valor: contexto.sesionId }];

  if (!resultado.ok) {
    // 409 y no 500: perder la carrera de escritura contra el sondeo de
    // `/api/p8/estado` es esperable, y el dominio ya reintentó con lecturas
    // frescas. El próximo tick del contador vuelve a preguntar.
    const status = resultado.motivo === "CONFLICTO_CONCURRENCIA" ? 409 : 404;
    return respuestaJson({ ok: false, motivo: resultado.motivo }, { status, cookies });
  }

  return respuestaJson(
    {
      ok: true,
      vencio: resultado.vencio,
      estado: resultado.estado,
      ...(resultado.vencio ? { siguientePantalla: RUTA_PANTALLA_B } : {}),
    },
    { cookies },
  );
}
