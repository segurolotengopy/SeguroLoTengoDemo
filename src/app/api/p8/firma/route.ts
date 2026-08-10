/**
 * `POST /api/p8/firma` — botón `ENVIAR ENLACE SEGURO DE FIRMA`.
 *
 * Abre **un** acto de firma en Code100 con la Solicitud y el FIPF adentro y
 * manda el enlace al canal verificado elegido. **No firma nada ni mueve el
 * estado del expediente**: eso lo hace `GET /api/p8/estado` cuando Code100
 * confirma (regla inviolable #3, fila 36 de la matriz de cumplimiento).
 *
 * El handler no decide nada: pasa el canal crudo al dominio, que lo valida y
 * —esto es lo importante— resuelve el **destino** desde el expediente, no
 * desde el cuerpo del POST. No hay ningún campo por el que pueda viajar un
 * número o un correo: un enlace de firma no puede terminar en un canal que
 * nadie verificó (reglas inviolables #1 y #9).
 */
import {
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasP8 } from "@/app/api/p8/_dependencias";
import { iniciarFirmaP8 } from "@/domain/firma-p8";
import type { MotivoRechazoP8 } from "@/domain/firma-p8";

export const dynamic = "force-dynamic";

function estadoHttp(motivo: MotivoRechazoP8): number {
  switch (motivo) {
    case "EXPEDIENTE_NO_ENCONTRADO":
      return 404;
    case "ESTADO_INVALIDO":
    case "PLAZO_VENCIDO":
    case "PAQUETE_NO_GENERADO":
    case "GARANTIA_PAGO_NO_LISTA":
    case "CANAL_NO_VERIFICADO":
    // Perdió la carrera de escritura contra el sondeo de estado. Nada quedó
    // abierto de más: si el acto de firma llegó a registrarse, volver a tocar
    // el botón devuelve ese mismo enlace.
    case "CONFLICTO_CONCURRENCIA":
      return 409;
    case "CODE100_NO_DISPONIBLE":
    case "CODE100_RECHAZO":
      // 502: el problema está aguas arriba, no en lo que mandó la pantalla.
      return 502;
    default:
      return 400;
  }
}

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await iniciarFirmaP8(dependenciasP8(), {
    expedienteId,
    canal: cuerpo.canal,
    contexto,
  });

  const cookies = [{ nombre: COOKIE_SESION, valor: contexto.sesionId }];

  if (!resultado.ok) {
    return respuestaJson(
      {
        ok: false,
        motivo: resultado.motivo,
        ...(resultado.siguientePantalla ? { siguientePantalla: resultado.siguientePantalla } : {}),
      },
      { status: estadoHttp(resultado.motivo), cookies },
    );
  }

  // Baja el identificador de Code100 y el vencimiento del enlace, nunca el OTP
  // de firma: ese lo pide Code100 en su propia pantalla (regla inviolable #2).
  return respuestaJson({ ok: true, acto: resultado.acto }, { cookies });
}
