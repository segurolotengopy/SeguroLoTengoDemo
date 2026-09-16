/**
 * `POST /api/v4/declaraciones` — botón `CONTINUAR` de **04A**.
 *
 * Puede derivar el expediente a `DERIVADO_MANUAL` por evaluación médica. La
 * decisión y la transición viven en el dominio.
 */
import {
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasDeclaracionesV4 } from "@/app/api/v4/_dependencias";
import { registrarDeclaracionesSalud } from "@/domain/v4/declaraciones";

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

  const resultado = await registrarDeclaracionesSalud(dependenciasDeclaracionesV4(), {
    expedienteId,
    respuestas:
      typeof cuerpo.respuestas === "object" && cuerpo.respuestas !== null
        ? (cuerpo.respuestas as Readonly<Record<string, unknown>>)
        : {},
    beneficiario:
      typeof cuerpo.beneficiario === "object" && cuerpo.beneficiario !== null
        ? (cuerpo.beneficiario as Readonly<Record<string, unknown>>)
        : {},
    contexto,
  });

  if (!resultado.ok) {
    const status =
      resultado.motivo === "EXPEDIENTE_NO_ENCONTRADO"
        ? 404
        : resultado.motivo === "ESTADO_INVALIDO"
          ? 409
          : 400;
    return respuestaJson(
      {
        ok: false,
        motivo: resultado.motivo,
        ...(resultado.camposInvalidos ? { camposInvalidos: resultado.camposInvalidos } : {}),
      },
      { status, cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
    );
  }

  return respuestaJson(
    { ok: true, estado: resultado.estado, derivado: resultado.derivado },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
