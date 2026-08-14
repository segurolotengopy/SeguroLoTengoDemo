/**
 * `POST /api/p5/analisis` — llena el bloque `DATOS DE IDENTIDAD` de P5.
 *
 * Se llama con las tres capturas ya tomadas: devuelve los seis campos que la
 * pantalla muestra **bloqueados** (los extrae el OCR de la cédula), la edad
 * calculada desde la fecha de nacimiento del documento (regla inviolable #8) y
 * el estado de los requisitos.
 *
 * De solo lectura: no transiciona el expediente ni persiste la identidad. Eso
 * ocurre únicamente en `/api/p5/identidad`.
 */
import {
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { decodificarImagen, decodificarSelfie } from "@/app/api/p5/_imagenes";
import { dependenciasP5 } from "@/app/api/p5/_dependencias";
import { analizarIdentidadP5 } from "@/domain/verificacion-identidad";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerJson(request);
  if (!cuerpo) {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  const frente = decodificarImagen(cuerpo.frente);
  const dorso = decodificarImagen(cuerpo.dorso);
  const selfie = decodificarSelfie(cuerpo);
  if (!frente.ok || !dorso.ok || !selfie.ok) {
    return respuestaJson({ ok: false, motivo: "CAPTURAS_INCOMPLETAS" }, { status: 400 });
  }

  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await analizarIdentidadP5(dependenciasP5(), {
    expedienteId,
    imagenes: { frente: frente.imagen, dorso: dorso.imagen, selfie: selfie.captura },
    contexto,
  });

  if (!resultado.ok) {
    const status =
      resultado.motivo === "EXPEDIENTE_NO_ENCONTRADO"
        ? 404
        : resultado.motivo === "CAPTURAS_INCOMPLETAS"
          ? 400
          : 409;
    return respuestaJson({ ok: false, motivo: resultado.motivo }, { status });
  }

  return respuestaJson(
    {
      ok: true,
      requisitos: resultado.requisitos,
      datos: resultado.datos,
      motivoRechazoCaptura: resultado.motivoRechazoCaptura,
      registroSeguridad: resultado.registroSeguridad,
      // Presente solo si este análisis agotó los intentos: la pantalla lo usa
      // para llevar a la persona a la pantalla de asistencia en vez de
      // ofrecerle repetir una captura que ya no puede aprobar.
      asistenciaIdentidad: resultado.asistenciaIdentidad ?? null,
    },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
