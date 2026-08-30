/**
 * `POST /api/inicio/terminos` — casilla de T&C del inicio del flujo v3
 * (DI-10; docs/ESPECIFICACION_PANTALLAS.md → "Inicio").
 *
 * Es el endpoint que **crea el expediente**: deja el trámite en `INICIADO`
 * con la evidencia del consentimiento y siembra la cookie con el id que acuñó
 * el dominio (mismo criterio que la creación v2 en `/api/p2/plan`).
 *
 * Handler fino: el cuerpo solo puede decir "acepté"; el texto y la versión
 * los pone el servidor desde `textos-inicio.ts`. El rechazo del flujo v2 vive
 * en el dominio (`FLUJO_NO_DISPONIBLE`), no acá.
 */
import {
  COOKIE_EXPEDIENTE,
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasP3 } from "@/app/api/p3/_dependencias";
import { aceptarTerminosIniciales } from "@/domain/inicio-terminos";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  const aceptada = cuerpo.aceptada === true;

  const { contexto, expedienteId } = resolverContextoHttp(request);

  // Las dependencias son las mismas de P3 (expedientes + evidencias): no vale
  // la pena un módulo de cableado propio para el mismo par de repositorios.
  const resultado = await aceptarTerminosIniciales(dependenciasP3(), {
    expedienteId,
    aceptada,
    contexto,
  });

  if (!resultado.ok) {
    const status =
      resultado.motivo === "ACEPTACION_REQUERIDA"
        ? 400
        : resultado.motivo === "FLUJO_NO_DISPONIBLE"
          ? 404
          : 409;

    return respuestaJson({ ok: false, motivo: resultado.motivo }, { status });
  }

  return respuestaJson(
    {
      ok: true,
      estado: resultado.estado,
      // Acuse, no el literal: la pantalla ya lo tiene a la vista y el registro
      // probatorio vive en el servidor.
      aceptacion: {
        aceptadaEn: resultado.aceptacion.aceptadaEn,
        versionAviso: resultado.aceptacion.versionAviso,
      },
    },
    {
      cookies: [
        { nombre: COOKIE_SESION, valor: contexto.sesionId },
        { nombre: COOKIE_EXPEDIENTE, valor: resultado.expedienteId },
      ],
    },
  );
}
