/**
 * `POST /api/p8/firma-interna/verificar` — el código de firma tipeado cierra
 * el acto interno del cliente: `PAQUETE_GENERADO → FIRMADO_CLIENTE`.
 *
 * El texto y la versión que quedan firmados los pone el servidor
 * (`textos-pago-firma.ts`): el navegador solo manda el código. Las firmas
 * institucionales las aplica después el sondeo de siempre
 * (`GET /api/p8/estado`), igual que cuando el cliente firmaba en Code100 —
 * el tramo cualificado no distingue quién ejecutó la del cliente.
 */
import {
  COOKIE_EXPEDIENTE,
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasP1 } from "@/app/api/p1/_dependencias";
import { emisorConstanciaFirma } from "@/app/api/p8/_dependencias";
import { registrarActoDeFirmaCliente } from "@/domain/firma-cliente";
import { esCanalFirma } from "@/domain/firma-p8";
import { flujoV3Activo } from "@/domain/flujo-vigente";
import {
  TEXTO_ACEPTACION_FIRMA,
  VERSION_ACEPTACION_FIRMA,
} from "@/domain/textos-pago-firma";

export const dynamic = "force-dynamic";

const STATUS_POR_MOTIVO: Readonly<Record<string, number>> = {
  EXPEDIENTE_NO_ENCONTRADO: 404,
  ESTADO_INVALIDO: 409,
  PAQUETE_NO_CERRADO: 409,
  CANAL_NO_VERIFICADO: 400,
  OTP_AJENO_AL_ACTO: 400,
  OTP_NO_ENCONTRADO: 404,
  CONFLICTO_CONCURRENCIA: 409,
  // La constancia no se pudo guardar: es del almacenamiento, no de la persona.
  CONSTANCIA_NO_EMITIDA: 503,
};

export async function POST(request: Request): Promise<Response> {
  if (!flujoV3Activo()) {
    return respuestaJson({ ok: false, motivo: "FLUJO_NO_DISPONIBLE" }, { status: 404 });
  }

  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }
  if (!esCanalFirma(cuerpo.canal)) {
    return respuestaJson({ ok: false, motivo: "CANAL_INVALIDO" }, { status: 400 });
  }
  if (typeof cuerpo.otpId !== "string" || typeof cuerpo.codigo !== "string") {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await registrarActoDeFirmaCliente(
    { ...dependenciasP1(), emitirConstancia: emisorConstanciaFirma(request) },
    {
    expedienteId,
    canal: cuerpo.canal,
    otpId: cuerpo.otpId,
    codigoIngresado: cuerpo.codigo,
    textoAceptado: TEXTO_ACEPTACION_FIRMA,
    versionTextoAceptado: VERSION_ACEPTACION_FIRMA,
    contexto,
    },
  );

  if (!resultado.ok) {
    return respuestaJson(
      {
        ok: false,
        motivo: resultado.motivo,
        ...(resultado.intentosRestantes !== undefined
          ? { intentosRestantes: resultado.intentosRestantes }
          : {}),
      },
      { status: STATUS_POR_MOTIVO[resultado.motivo] ?? 400 },
    );
  }

  return respuestaJson(
    {
      ok: true,
      // Acuse del acto, sin el código ni el literal completo: la evidencia
      // probatoria vive en el servidor.
      firmadoEn: resultado.acto.firmadoEn,
      canal: resultado.acto.canal,
      destinoEnmascarado: resultado.acto.destinoEnmascarado,
    },
    {
      cookies: [
        { nombre: COOKIE_SESION, valor: contexto.sesionId },
        { nombre: COOKIE_EXPEDIENTE, valor: expedienteId },
      ],
    },
  );
}
