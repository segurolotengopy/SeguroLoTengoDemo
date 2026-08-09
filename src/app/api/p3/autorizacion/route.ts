/**
 * `POST /api/p3/autorizacion` — botón `TENGO TODO LISTO →` de P3
 * (docs/ESPECIFICACION_PANTALLAS.md → "P3 · Paso 3 de 9").
 *
 * Handler fino: valida la forma del cuerpo, traduce HTTP a
 * `ContextoPeticion` —de donde salen la IP, el dispositivo y la sesión que
 * exige el registro del consentimiento— y delega la lógica en
 * `src/domain/autorizacion-inicial.ts`.
 *
 * El cuerpo solo puede decir "acepté"; el texto y la versión que quedan
 * asentados los pone el servidor desde `textos-p3.ts`. Si el literal viniera
 * del navegador, cualquiera podría hacer constar que aceptó otra cosa.
 */
import {
  COOKIE_EXPEDIENTE,
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasP3 } from "@/app/api/p3/_dependencias";
import { registrarAutorizacionInicial } from "@/domain/autorizacion-inicial";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  const aceptada = cuerpo.aceptada === true;

  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await registrarAutorizacionInicial(dependenciasP3(), {
    expedienteId,
    aceptada,
    contexto,
  });

  if (!resultado.ok) {
    const status =
      resultado.motivo === "AUTORIZACION_REQUERIDA"
        ? 400
        : resultado.motivo === "EXPEDIENTE_NO_ENCONTRADO"
          ? 404
          : 409;

    return respuestaJson({ ok: false, motivo: resultado.motivo }, { status });
  }

  return respuestaJson(
    {
      ok: true,
      estado: resultado.estado,
      // Se devuelve el acuse, no el literal completo: la pantalla ya lo tiene
      // a la vista y el registro probatorio vive en el servidor.
      autorizacion: {
        aceptadaEn: resultado.autorizacion.aceptadaEn,
        ip: resultado.autorizacion.ip,
        versionAviso: resultado.autorizacion.versionAviso,
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
