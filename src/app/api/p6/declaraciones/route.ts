/**
 * `POST /api/p6/declaraciones` — botón `GUARDAR Y CONTINUAR →` de P6.
 *
 * Es la única puerta por la que el expediente sale de IDENTIDAD_VERIFICADA, y
 * ni siquiera lo hace este archivo: la decisión y la transición las ejecuta
 * `src/domain/declaraciones-p6.ts` a través de `registrarDeclaracionesP6`.
 *
 * El handler no mira ni una respuesta: pasa los dos bloques crudos al dominio,
 * que los interpreta, valida y evalúa. Acá no hay ninguna rama que dependa de
 * un dato de salud o de la condición PEP, y la respuesta HTTP tampoco los
 * devuelve — `ResultadoP6` no tiene dónde ponerlos (regla inviolable #7).
 *
 * **Nada de este handler se registra en un log plano.** La única traza del
 * paso es el `RegistroEvidencia` que escribe el dominio vía `EvidenceStore`.
 */
import {
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasP6 } from "@/app/api/p6/_dependencias";
import { guardarDatosYDeclaracionesP6 } from "@/domain/declaraciones-p6";

export const dynamic = "force-dynamic";

/** Devuelve el sub-objeto si es un objeto plano; `{}` si no, para que valide el dominio. */
function bloque(cuerpo: Readonly<Record<string, unknown>>, clave: string): Record<string, unknown> {
  const valor = cuerpo[clave];
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return {};
  return valor as Record<string, unknown>;
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

  const resultado = await guardarDatosYDeclaracionesP6(dependenciasP6(), {
    expedienteId,
    beneficiario: bloque(cuerpo, "beneficiario"),
    declaraciones: bloque(cuerpo, "declaraciones"),
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
        ...(resultado.declaracionesSinResponder
          ? { declaracionesSinResponder: resultado.declaracionesSinResponder }
          : {}),
      },
      { status },
    );
  }

  return respuestaJson(
    resultado.elegibleParaEmisionAutomatica
      ? {
          ok: true,
          estado: resultado.estado,
          elegibleParaEmisionAutomatica: true,
          siguientePantalla: resultado.siguientePantalla,
        }
      : {
          ok: true,
          estado: resultado.estado,
          elegibleParaEmisionAutomatica: false,
          numeroCaso: resultado.numeroCaso,
          motivoDerivacion: resultado.motivoDerivacion,
          siguientePantalla: resultado.siguientePantalla,
        },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
