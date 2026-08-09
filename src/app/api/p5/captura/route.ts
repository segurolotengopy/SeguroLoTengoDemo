/**
 * `POST /api/p5/captura` — botones `TOMAR FOTOGRAFÍA` (frente y dorso) e
 * `INICIAR VERIFICACIÓN` (selfie con prueba de vida) de P5.
 *
 * Handler fino: decodifica la imagen, traduce HTTP a `ContextoPeticion` y
 * delega en `src/domain/verificacion-identidad.ts`. No transiciona el
 * expediente —eso pasa recién en `/api/p5/identidad`— y no devuelve ningún
 * dato de la cédula: acá solo se sabe si la captura aprobó calidad,
 * autenticidad o prueba de vida.
 */
import {
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { decodificarImagen } from "@/app/api/p5/_imagenes";
import { dependenciasP5 } from "@/app/api/p5/_dependencias";
import { registrarCapturaP5 } from "@/domain/verificacion-identidad";
import type { TipoCapturaP5 } from "@/domain/verificacion-identidad";

export const dynamic = "force-dynamic";

const TIPOS: readonly TipoCapturaP5[] = ["FRENTE", "DORSO", "SELFIE"];

function esTipoCaptura(valor: unknown): valor is TipoCapturaP5 {
  return TIPOS.some((tipo) => tipo === valor);
}

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  if (!esTipoCaptura(cuerpo.tipo)) {
    return respuestaJson({ ok: false, motivo: "TIPO_INVALIDO" }, { status: 400 });
  }

  const imagen = decodificarImagen(cuerpo.imagen);
  if (!imagen.ok) {
    return respuestaJson({ ok: false, motivo: imagen.motivo }, { status: 400 });
  }

  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await registrarCapturaP5(dependenciasP5(), {
    expedienteId,
    tipo: cuerpo.tipo,
    imagen: imagen.imagen,
    contexto,
  });

  if (!resultado.ok) {
    const status =
      resultado.motivo === "EXPEDIENTE_NO_ENCONTRADO"
        ? 404
        : resultado.motivo === "IMAGEN_VACIA"
          ? 400
          : 409;
    return respuestaJson({ ok: false, motivo: resultado.motivo }, { status });
  }

  return respuestaJson(
    {
      ok: true,
      tipo: resultado.tipo,
      aprobada: resultado.aprobada,
      calidadAprobada: resultado.calidadAprobada,
      autenticidadAprobada: resultado.autenticidadAprobada,
      pruebaDeVidaAprobada: resultado.pruebaDeVidaAprobada,
      referencia: resultado.referencia,
      hashSha256: resultado.hashSha256,
      motivoRechazo: resultado.motivoRechazo,
    },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
