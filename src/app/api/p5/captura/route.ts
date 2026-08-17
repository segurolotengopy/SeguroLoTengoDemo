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
import { decodificarImagen, decodificarSelfie } from "@/app/api/p5/_imagenes";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import { origenCapturaAdmitido } from "@/domain/identidad-parametros";
import type { OrigenCaptura } from "@/domain/identidad-parametros";
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

  // De dónde dice el cliente que salieron los bytes. `CAMARA` por omisión: un
  // cuerpo sin el campo no puede convertirse en una subida silenciosa.
  //
  // **Esta guarda es la que sostiene la regla en producción.** La pantalla
  // esconde el botón de subir archivo fuera del modo demostración, pero eso es
  // cosmético: cualquiera puede armar la petición a mano. Acá se rechaza, así
  // que un despliegue sin `DEMO_MODE` no tiene forma de aceptar un archivo por
  // ninguna vía.
  const origen: OrigenCaptura = cuerpo.origen === "ARCHIVO" ? "ARCHIVO" : "CAMARA";
  if (!origenCapturaAdmitido(cuerpo.tipo, origen, esModoDemo())) {
    return respuestaJson({ ok: false, motivo: "ORIGEN_NO_ADMITIDO" }, { status: 400 });
  }

  // La selfie es el único tipo que puede llegar de dos formas: bytes de la
  // foto, o la referencia de una sesión de prueba de vida en vivo cuyo video
  // nunca pasó por acá (ver `CapturaSelfie` en el puerto). Frente y dorso son
  // siempre bytes.
  const recibida =
    cuerpo.tipo === "SELFIE" ? decodificarSelfie(cuerpo) : decodificarImagen(cuerpo.imagen);
  if (!recibida.ok) {
    return respuestaJson({ ok: false, motivo: recibida.motivo }, { status: 400 });
  }

  // El dominio acepta las dos formas (`MediaCapturada | CapturaSelfie`) y
  // normaliza adentro; acá solo hay que no aplastarlas a una.
  const imagen = "captura" in recibida ? recibida.captura : recibida.imagen;

  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await registrarCapturaP5(dependenciasP5(), {
    expedienteId,
    tipo: cuerpo.tipo,
    imagen,
    origen,
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
