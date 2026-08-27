/**
 * `POST /api/p8/retorno` — la persona volvió de la ventana de firma de Code100.
 *
 * Es la **segunda vía** de confirmación de CHG-33, y la única además del
 * sondeo que existe hoy: la documentación de Code100
 * (`docs/Integraciones/Documentacion Firmador - API FLOW.pdf`) no expone
 * ningún callback servidor a servidor —sus endpoints son `auth`,
 * `session-start`, `getSessionId` y `sign-pdf`—, así que el webhook queda como
 * consulta abierta al proveedor (PEN-02) y no se inventa acá. Lo que sí está
 * documentado es el `redirect_uri` del `_authUrl`: el navegador vuelve.
 *
 * **Qué agrega sobre el sondeo.** Nada que el sondeo no termine descubriendo:
 * la diferencia es *cuándo*. Sin esto, quien cierra la ventana de Code100
 * espera hasta dos segundos a que el próximo tick pregunte; con esto, el
 * regreso pregunta de una y el paso de pago se habilita en el acto, que es lo
 * que pide CHG-33 (*"el retorno habilita el paso 7 automáticamente"*).
 *
 * **No confía en el navegador.** No recibe ningún resultado de firma: recibe
 * el aviso de que la persona volvió, y va a preguntarle a Code100. Un cliente
 * manipulado que llame a este endpoint sin haber firmado obtiene exactamente
 * lo mismo que obtendría el sondeo — que todavía no hay firma. La confirmación
 * la da el proveedor, nunca la pantalla.
 *
 * **Cruzarse con el sondeo es lo normal, no un error.** Las dos vías corren a
 * la vez sobre el mismo acto; la que llega primero transiciona y la segunda
 * encuentra el expediente ya firmado, responde lo mismo y se registra como
 * duplicado (`duplicada: true`). La idempotencia es por `session_id`, que es
 * el `idCode100` del acto abierto.
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { dependenciasP8 } from "@/app/api/p8/_dependencias";
import { confirmarFirmaP8 } from "@/domain/firma-p8";
import type { MotivoRechazoP8 } from "@/domain/firma-p8";

export const dynamic = "force-dynamic";

function estadoHttp(motivo: MotivoRechazoP8): number {
  switch (motivo) {
    case "EXPEDIENTE_NO_ENCONTRADO":
      return 404;
    case "ESTADO_INVALIDO":
    case "FIRMA_NO_INICIADA":
    case "FIRMA_NO_COMPLETADA":
    case "FIRMAS_INSTITUCIONALES_PENDIENTES":
    // Perdió la carrera contra el sondeo. No se perdió nada: el próximo tick
    // ve la versión que ganó.
    case "CONFLICTO_CONCURRENCIA":
      return 409;
    case "CODE100_NO_DISPONIBLE":
      return 502;
    default:
      return 400;
  }
}

export async function POST(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await confirmarFirmaP8(dependenciasP8(), {
    expedienteId,
    contexto,
    origen: "RETORNO_NAVEGADOR",
  });

  const cookies = [{ nombre: COOKIE_SESION, valor: contexto.sesionId }];

  if (!resultado.ok) {
    return respuestaJson(
      {
        ok: false,
        motivo: resultado.motivo,
        ...(resultado.detalle ? { detalle: resultado.detalle } : {}),
      },
      { status: estadoHttp(resultado.motivo), cookies },
    );
  }

  if (!resultado.firmado) {
    // Volvió sin haber firmado —cerró la ventana, o Code100 todavía no
    // registró el acto—. No es un error: la pantalla sigue sondeando.
    return respuestaJson(
      { ok: true, firmado: false, enlaceAbierto: resultado.enlaceAbierto },
      { cookies },
    );
  }

  return respuestaJson(
    {
      ok: true,
      firmado: true,
      estado: resultado.estado,
      duplicada: resultado.duplicada,
      siguientePantalla: resultado.siguientePantalla,
    },
    { cookies },
  );
}
