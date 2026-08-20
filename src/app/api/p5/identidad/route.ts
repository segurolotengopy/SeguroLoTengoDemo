/**
 * `POST /api/p5/identidad` — botón `VALIDAR IDENTIDAD Y CONTINUAR →` de P5.
 *
 * Es la única puerta por la que el expediente pasa de CANAL_EMAIL_VERIFICADO a
 * IDENTIDAD_VERIFICADA, y ni siquiera lo hace este archivo: la transición la
 * ejecuta `src/domain/verificacion-identidad.ts` a través de
 * `transicionarExpediente`.
 *
 * Del cuerpo solo se toman los dos campos que la persona completa a mano
 * (país de nacimiento y estado civil), el checkbox de autorización biométrica
 * y las tres capturas. **Ningún dato de la cédula viaja en la petición**: los
 * seis campos bloqueados los vuelve a extraer el proveedor del lado del
 * servidor, así que no hay forma de "corregir" a mano lo que dijo el OCR.
 */
import {
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { decodificarImagen, decodificarSelfie } from "@/app/api/p5/_imagenes";
import { dependenciasP5 } from "@/app/api/p5/_dependencias";
import { confirmarIdentidadP5 } from "@/domain/verificacion-identidad";

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

  const resultado = await confirmarIdentidadP5(dependenciasP5(), {
    expedienteId,
    imagenes: { frente: frente.imagen, dorso: dorso.imagen, selfie: selfie.captura },
    paisNacimiento: typeof cuerpo.paisNacimiento === "string" ? cuerpo.paisNacimiento : "",
    paisResidencia: typeof cuerpo.paisResidencia === "string" ? cuerpo.paisResidencia : "",
    estadoCivil: typeof cuerpo.estadoCivil === "string" ? cuerpo.estadoCivil : "",
    correo: typeof cuerpo.correo === "string" ? cuerpo.correo : "",
    // Solo se leen los cuatro campos corregibles; cualquier otra clave que
    // venga en el cuerpo se ignora en silencio, que es lo que corresponde con
    // un dato que el dominio no admite corregir.
    correcciones: {
      ...(typeof cuerpo.nombres === "string" ? { nombres: cuerpo.nombres } : {}),
      ...(typeof cuerpo.apellidos === "string" ? { apellidos: cuerpo.apellidos } : {}),
      ...(typeof cuerpo.sexo === "string" ? { sexo: cuerpo.sexo } : {}),
      ...(typeof cuerpo.nacionalidad === "string" ? { nacionalidad: cuerpo.nacionalidad } : {}),
    },
    // Bloque económico y laboral: el dominio lo interpreta y valida entero, así
    // que la ruta lo pasa crudo sin mirar campo por campo.
    datosComplementarios:
      typeof cuerpo.datosComplementarios === "object" && cuerpo.datosComplementarios !== null
        ? (cuerpo.datosComplementarios as Readonly<Record<string, unknown>>)
        : {},
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
        ...(resultado.requisitos ? { requisitos: resultado.requisitos } : {}),
        ...(resultado.pendientes ? { pendientes: resultado.pendientes } : {}),
        ...(resultado.datos ? { datos: resultado.datos } : {}),
      },
      { status },
    );
  }

  return respuestaJson(
    {
      ok: true,
      estado: resultado.estado,
      requisitos: resultado.requisitos,
      datos: resultado.datos,
      registroSeguridad: resultado.registroSeguridad,
    },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
