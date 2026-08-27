/**
 * `GET /api/p8/estado` — sondeo de P8 mientras muestra `Esperando confirmación
 * verificable de Code100`, y única puerta por la que el expediente pasa de
 * PAQUETE_GENERADO a FIRMADO.
 *
 * Es de lectura desde el punto de vista de la pantalla, pero **puede
 * transicionar el expediente** en dos direcciones: a FIRMADO cuando Code100
 * confirma la firma de los dos documentos, o a VENCIDO cuando se cumplió el
 * plazo. Las dos transiciones las ejecuta `src/domain/expediente.ts`, nunca
 * este archivo.
 *
 * Idempotente por construcción: llamarlo con el expediente ya FIRMADO devuelve
 * lo persistido sin volver a transicionar. Es lo que va a permitir que el
 * callback del adaptador oficial de Code100 entre por acá sin riesgo de doble
 * efecto (CLAUDE.md → "Idempotencia de webhooks").
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
    // Perdió la carrera de escritura contra otra petición y el conflicto
    // persistió tras los reintentos del dominio. No es un error del servidor:
    // el bloqueo optimista hizo su trabajo y el próximo sondeo ve la versión
    // que ganó.
    case "CONFLICTO_CONCURRENCIA":
      return 409;
    case "CODE100_NO_DISPONIBLE":
      return 502;
    default:
      return 400;
  }
}

export async function GET(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await confirmarFirmaP8(dependenciasP8(), { expedienteId, contexto });
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
    return respuestaJson(
      {
        ok: true,
        firmado: false,
        enlaceAbierto: resultado.enlaceAbierto,
        venceEn: resultado.venceEn,
      },
      { cookies },
    );
  }

  return respuestaJson(
    {
      ok: true,
      firmado: true,
      estado: resultado.estado,
      numeroPropuesta: resultado.numeroPropuesta,
      idCode100: resultado.idCode100,
      firmadoEn: resultado.firmadoEn,
      plazoPagoVenceEn: resultado.plazoPagoVenceEn,
      siguientePantalla: resultado.siguientePantalla,
    },
    { cookies },
  );
}
