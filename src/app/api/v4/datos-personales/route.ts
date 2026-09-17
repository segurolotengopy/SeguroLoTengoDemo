/**
 * `POST /api/v4/datos-personales` — botón `CONTINUAR` de **03D**.
 *
 * No cambia el estado del expediente: completa la identidad con lo que la
 * persona declara y guarda su domicilio. La validación de catálogos y el
 * cotejo de las correcciones ocurren en el dominio.
 */
import {
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasDatosPersonalesV4 } from "@/app/api/v4/_dependencias";
import { registrarDatosPersonales } from "@/domain/v4/datos-personales";
import { calcularEdadDesde, edadEnRangoPermitido } from "@/domain/tipos";
import { crearExpedienteRepository } from "@/repositories";

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

  const resultado = await registrarDatosPersonales(dependenciasDatosPersonalesV4(), {
    expedienteId,
    nombres: texto(cuerpo.nombres),
    apellidoPaterno: texto(cuerpo.apellidoPaterno),
    apellidoMaterno: texto(cuerpo.apellidoMaterno),
    numeroCedulaDeclarado: texto(cuerpo.numeroCedula),
    fechaNacimientoDeclarada: texto(cuerpo.fechaNacimiento),
    sexo: texto(cuerpo.sexo),
    estadoCivil: texto(cuerpo.estadoCivil),
    paisNacimiento: texto(cuerpo.paisNacimiento),
    nacionalidad: texto(cuerpo.nacionalidad),
    paisResidencia: texto(cuerpo.paisResidencia),
    domicilio: texto(cuerpo.domicilio),
    ciudad: texto(cuerpo.ciudad),
    barrio: texto(cuerpo.barrio),
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
    { ok: true, hayDatosDeclaradosDistintos: resultado.hayDatosDeclaradosDistintos },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}

/**
 * `GET /api/v4/datos-personales` — lo que 03D necesita para dibujarse.
 *
 * Devuelve **lo que leyó el OCR** —con la edad ya calculada, que es la que
 * decide la elegibilidad (regla inviolable #8)— y lo que la persona haya
 * declarado si vuelve a la pantalla. De solo lectura: no transiciona ni deja
 * evidencia. Mirar los propios datos no es un hecho que haya que asentar.
 */
export async function GET(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
  if (!expediente) {
    return respuestaJson({ ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" }, { status: 404 });
  }
  if (!expediente.identidad) {
    return respuestaJson({ ok: false, motivo: "IDENTIDAD_FALTANTE" }, { status: 409 });
  }

  const identidad = expediente.identidad;
  return respuestaJson(
    {
      ok: true,
      identidad: {
        numeroCedula: identidad.numeroCedula,
        nombres: identidad.nombres,
        apellidos: identidad.apellidos,
        fechaNacimiento: identidad.fechaNacimiento,
        sexo: identidad.sexo,
        nacionalidad: identidad.nacionalidad,
        paisNacimiento: identidad.paisNacimiento,
        paisResidencia: identidad.paisResidencia,
        estadoCivil: identidad.estadoCivil,
      },
      edad: calcularEdadDesde(identidad.fechaNacimiento),
      edadEnRango: edadEnRangoPermitido(identidad.fechaNacimiento),
      datosPersonales: expediente.datosPersonales,
    },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
