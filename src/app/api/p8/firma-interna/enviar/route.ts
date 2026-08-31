/**
 * `POST /api/p8/firma-interna/enviar` — la aceptación agrupada 3 + el envío
 * del código de firma del acto INTERNO del cliente (flujo v3, lote F4b;
 * decisión D1 ratificada el 30-ago-2026).
 *
 * Exige la casilla agrupada marcada (`aceptada: true`) antes de emitir el
 * código: lo que se va a firmar es exactamente ese literal, que el servidor
 * pone desde `textos-pago-firma.ts` — nunca el navegador. El canal solo puede
 * ser uno de los dos verificados (DI-5); el destino sale del expediente.
 *
 * Solo existe en el flujo v3: el acto del cliente en v2 sigue siendo el flujo
 * simulado de Code100 (`/api/p8/firma`). El dominio de la firma interna no
 * distingue versiones a propósito —es el mismo acto legal—, así que la guarda
 * vive acá, en la puerta HTTP del flujo.
 */
import {
  COOKIE_EXPEDIENTE,
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasP1 } from "@/app/api/p1/_dependencias";
import { esCanalFirma } from "@/domain/firma-p8";
import { solicitarOtpDeFirmaCliente } from "@/domain/firma-cliente";
import { flujoV3Activo } from "@/domain/flujo-vigente";

export const dynamic = "force-dynamic";

const STATUS_POR_MOTIVO: Readonly<Record<string, number>> = {
  EXPEDIENTE_NO_ENCONTRADO: 404,
  ESTADO_INVALIDO: 409,
  PAQUETE_NO_CERRADO: 409,
  CANAL_NO_VERIFICADO: 400,
  REENVIO_BLOQUEADO: 429,
};

export async function POST(request: Request): Promise<Response> {
  if (!flujoV3Activo()) {
    return respuestaJson({ ok: false, motivo: "FLUJO_NO_DISPONIBLE" }, { status: 404 });
  }

  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }
  if (cuerpo.aceptada !== true) {
    return respuestaJson({ ok: false, motivo: "ACEPTACION_REQUERIDA" }, { status: 400 });
  }
  if (!esCanalFirma(cuerpo.canal)) {
    return respuestaJson({ ok: false, motivo: "CANAL_INVALIDO" }, { status: 400 });
  }

  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  // Las dependencias son las mismas de P1: OtpProvider + lector de metadata +
  // expedientes + evidencias (`DependenciasFirmaCliente` es estructuralmente
  // idéntica a `DependenciasP1`).
  const resultado = await solicitarOtpDeFirmaCliente(dependenciasP1(), {
    expedienteId,
    canal: cuerpo.canal,
    contexto,
  });

  if (!resultado.ok) {
    return respuestaJson(
      {
        ok: false,
        motivo: resultado.motivo,
        ...(resultado.segundosRestantes !== undefined
          ? { segundosRestantes: resultado.segundosRestantes }
          : {}),
      },
      { status: STATUS_POR_MOTIVO[resultado.motivo] ?? 400 },
    );
  }

  return respuestaJson(
    {
      ok: true,
      otpId: resultado.otpId,
      expiraEn: resultado.expiraEn,
      destinoEnmascarado: resultado.destinoEnmascarado,
    },
    {
      cookies: [
        { nombre: COOKIE_SESION, valor: contexto.sesionId },
        { nombre: COOKIE_EXPEDIENTE, valor: expedienteId },
      ],
    },
  );
}
