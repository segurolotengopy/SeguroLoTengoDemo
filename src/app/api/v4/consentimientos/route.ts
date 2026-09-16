/**
 * `POST /api/v4/consentimientos` — botón `CONTINUAR` de **04D**.
 *
 * Es la **única** puerta a `DECLARACIONES_OK` en v4, y la transición la hace
 * el dominio. El literal aceptado no viene del cuerpo: lo pone el servidor
 * desde `textos-consentimientos.ts`, porque si viniera del navegador
 * cualquiera podría hacer constar que aceptó otro texto.
 */
import {
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasDeclaracionesV4 } from "@/app/api/v4/_dependencias";
import { registrarConsentimientos } from "@/domain/v4/declaraciones";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await registrarConsentimientos(dependenciasDeclaracionesV4(), {
    expedienteId,
    aceptaInicioDeCoberturaYCarencias: cuerpo.inicioCobertura === true,
    aceptaEntregaDigital: cuerpo.entregaDigital === true,
    contexto,
  });

  if (!resultado.ok) {
    const status =
      resultado.motivo === "EXPEDIENTE_NO_ENCONTRADO"
        ? 404
        : resultado.motivo === "ESTADO_INVALIDO" || resultado.motivo === "DECLARACIONES_FALTANTES"
          ? 409
          : 400;
    return respuestaJson(
      { ok: false, motivo: resultado.motivo },
      { status, cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
    );
  }

  return respuestaJson(
    { ok: true, estado: resultado.estado },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
