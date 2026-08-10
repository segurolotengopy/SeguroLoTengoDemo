/**
 * `GET /api/p7/estado` — sondeo de P7 mientras espera a Bancard, y única
 * puerta por la que el expediente pasa de DECLARACIONES_OK a PAGO_CONFIRMADO.
 *
 * Es de lectura desde el punto de vista de la pantalla, pero **puede
 * transicionar el expediente**: cuando Bancard reporta el QR o el débito
 * acreditados, o el crédito preautorizado, el dominio confirma la garantía de
 * pago y arranca el plazo de 24 horas para firmar. La transición la ejecuta
 * `confirmarGarantiaDePagoP7` en `src/domain/expediente.ts`, nunca este
 * archivo.
 *
 * Idempotente por construcción: llamarlo con el expediente ya en
 * PAGO_CONFIRMADO devuelve lo persistido sin volver a transicionar ni a
 * consultar a Bancard. Es lo que va a permitir que el callback del adaptador
 * oficial entre por acá sin riesgo de doble efecto (CLAUDE.md →
 * "Idempotencia de webhooks").
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { dependenciasP7 } from "@/app/api/p7/_dependencias";
import { confirmarPagoP7 } from "@/domain/pago-p7";
import type { MotivoRechazoP7 } from "@/domain/pago-p7";

export const dynamic = "force-dynamic";

function estadoHttp(motivo: MotivoRechazoP7): number {
  switch (motivo) {
    case "EXPEDIENTE_NO_ENCONTRADO":
      return 404;
    case "PAGO_NO_INICIADO":
    case "ESTADO_INVALIDO":
    case "PAGO_CANCELADO":
      return 409;
    default:
      return 400;
  }
}

export async function GET(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await confirmarPagoP7(dependenciasP7(request), { expedienteId, contexto });

  if (!resultado.ok) {
    return respuestaJson({ ok: false, motivo: resultado.motivo }, { status: estadoHttp(resultado.motivo) });
  }

  const cookies = [{ nombre: COOKIE_SESION, valor: contexto.sesionId }];

  if (!resultado.confirmado) {
    return respuestaJson(
      { ok: true, confirmado: false, medio: resultado.medio, referenciaBancard: resultado.referenciaBancard },
      { cookies },
    );
  }

  return respuestaJson(
    {
      ok: true,
      confirmado: true,
      estado: resultado.estado,
      medio: resultado.medio,
      montoGs: resultado.montoGs,
      referenciaBancard: resultado.referenciaBancard,
      numeroPropuesta: resultado.numeroPropuesta,
      plazoFirmaVenceEn: resultado.plazoFirmaVenceEn,
      pagoDefinitivo: resultado.pagoDefinitivo,
      siguientePantalla: resultado.siguientePantalla,
    },
    { cookies },
  );
}
