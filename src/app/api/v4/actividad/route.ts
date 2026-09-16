/**
 * `POST /api/v4/actividad` — botón `CONTINUAR` de **03E**.
 *
 * Es la puerta por la que un expediente puede irse a `DERIVADO_MANUAL` por
 * condición PEP. La decisión y la transición viven en el dominio; acá solo se
 * traduce HTTP.
 */
import {
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasActividadV4 } from "@/app/api/v4/_dependencias";
import { registrarActividad } from "@/domain/v4/actividad";

export const dynamic = "force-dynamic";

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
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

  const resultado = await registrarActividad(dependenciasActividadV4(), {
    expedienteId,
    situacionLaboral: texto(cuerpo.situacionLaboral),
    actividadEconomica: texto(cuerpo.actividadEconomica),
    ocupacion: texto(cuerpo.ocupacion),
    profesion: texto(cuerpo.profesion),
    empresa: texto(cuerpo.empresa),
    ingresoMensualDeclarado: texto(cuerpo.ingresoMensualDeclarado),
    origenIngresos: texto(cuerpo.origenIngresos),
    esPep: typeof cuerpo.esPep === "boolean" ? cuerpo.esPep : null,
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
    {
      ok: true,
      estado: resultado.estado,
      // La pantalla decide con esto si continúa a 04A o si muestra 03E2.
      derivado: Boolean(resultado.numeroCasoDerivacion),
      ...(resultado.numeroCasoDerivacion
        ? { numeroCaso: resultado.numeroCasoDerivacion }
        : {}),
    },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
