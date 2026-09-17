/**
 * `POST /api/v4/identidad` — botón `VALIDAR Y CONTINUAR` de **03C**.
 *
 * Una de las dos únicas puertas a `IDENTIDAD_VERIFICADA`, y ni siquiera la
 * ejecuta este archivo: la transición la hace el dominio
 * (`verificarIdentidadV4`) a través de `transicionarExpediente`.
 *
 * Del cuerpo se toman **solo** las tres capturas y el correo. Ningún dato de
 * la cédula viaja en la petición: los extrae el proveedor del lado del
 * servidor, así que no hay forma de «corregir» a mano lo que dijo el OCR — que
 * es justamente de lo que cuelgan el corte de edad y el bloqueo por cédula.
 *
 * La autorización biométrica se aceptó en 03B y viaja como confirmación; el
 * dominio la exige igual (D-42, conflicto C-13 cerrado).
 */
import {
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { decodificarImagen, decodificarSelfie } from "@/app/api/p5/_imagenes";
import { dependenciasIdentidadV4 } from "@/app/api/v4/_dependencias";
import { verificarIdentidadV4 } from "@/domain/verificacion-identidad";

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

  const resultado = await verificarIdentidadV4(dependenciasIdentidadV4(), {
    expedienteId,
    imagenes: { frente: frente.imagen, dorso: dorso.imagen, selfie: selfie.captura },
    correo: typeof cuerpo.correo === "string" ? cuerpo.correo : "",
    autorizacionBiometrica: cuerpo.autorizacionBiometrica === true,
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
        ...(resultado.pendientes ? { pendientes: resultado.pendientes } : {}),
        ...(resultado.requisitos ? { requisitos: resultado.requisitos } : {}),
      },
      { status, cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
    );
  }

  return respuestaJson(
    {
      ok: true,
      estado: resultado.estado,
      requisitos: resultado.requisitos,
      // Los datos extraídos alimentan 03D, que los muestra con candado y
      // permite corregir los cuatro que admiten corrección.
      datos: resultado.datos,
      registroSeguridad: resultado.registroSeguridad,
    },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
