/**
 * `POST /api/p7/vencimiento` — la cuenta regresiva del paso de pago llegó a
 * cero.
 *
 * No es el reloj de la pantalla el que vence el expediente: el que decide es
 * `plazoPagoVenceEn`, comparado contra la hora del servidor dentro de
 * `vencerPlazoSiCorresponde`. Este endpoint solo le da al navegador una forma
 * de pedir esa evaluación en el momento exacto en que su contador llega a
 * cero, en vez de esperar al siguiente sondeo. Adelantar el reloj del cliente
 * no adelanta nada: el servidor vuelve a mirar la hora real y contesta que
 * todavía no.
 *
 * **Vivía en `/api/p8/vencimiento` hasta la inversión de firma y pago**
 * (D-08). Lo que caduca dejó de ser un expediente pagado que no firma y pasó a
 * ser uno firmado que no paga (D-10), así que el reloj corre en este paso.
 *
 * Es idempotente y seguro de llamar de más: sobre un expediente ya vencido, ya
 * pagado o todavía en plazo, no escribe nada.
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { dependenciasP7 } from "@/app/api/p7/_dependencias";
import { RUTA_PANTALLA_B, vencerPlazoPagoP7 } from "@/domain/pago-p7";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await vencerPlazoPagoP7(dependenciasP7(request), { expedienteId, contexto });
  const cookies = [{ nombre: COOKIE_SESION, valor: contexto.sesionId }];

  if (!resultado.ok) {
    // 409 y no 500: perder la carrera de escritura contra el sondeo de
    // `/api/p7/estado` es esperable, y el dominio ya reintentó con lecturas
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
