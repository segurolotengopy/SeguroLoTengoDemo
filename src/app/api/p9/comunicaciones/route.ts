/**
 * `POST /api/p9/comunicaciones` — bloque `COMUNICACIONES COMERCIALES · OPCIONAL`
 * del pie de P9.
 *
 * Es un consentimiento de marketing, y se trata como tal:
 *
 * - **Desmarcado por defecto.** La pantalla no lo premarca y este endpoint no
 *   se llama solo: hace falta un acto de la persona. Un consentimiento
 *   premarcado no es consentimiento (Ley 4868/13, art. 7(r); Ley 1682/01).
 * - **Versionado y con el literal íntegro**, igual que la autorización de P3 y
 *   la declaración de origen lícito de P7: si alguien edita el texto sin subir
 *   la versión, la evidencia sigue conteniendo palabra por palabra lo que se
 *   aceptó.
 * - **Revocable**: mandar `acepta: false` deja otro registro. No se borra ni se
 *   sobrescribe el anterior (regla inviolable #10, append-only), así que queda
 *   la historia completa de qué se autorizó y cuándo.
 * - **No condiciona nada.** El contrato ya está celebrado; esto no toca el
 *   estado del expediente ni la emisión.
 *
 * El handler no escribe la evidencia por su cuenta: la escribe el caso de uso
 * en `src/domain/emision-p9.ts`, que es donde viven el literal y su versión.
 */
import {
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasP9 } from "@/app/api/p9/_dependencias";
import { registrarComunicacionesComercialesP9 } from "@/domain/emision-p9";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerJson(request);
  if (!cuerpo || typeof cuerpo.acepta !== "boolean") {
    return respuestaJson({ ok: false, motivo: "CUERPO_INVALIDO" }, { status: 400 });
  }

  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const resultado = await registrarComunicacionesComercialesP9(dependenciasP9(), {
    expedienteId,
    acepta: cuerpo.acepta,
    contexto,
  });

  if (!resultado.ok) {
    return respuestaJson(
      { ok: false, motivo: resultado.motivo },
      { status: resultado.motivo === "EXPEDIENTE_NO_ENCONTRADO" ? 404 : 409 },
    );
  }

  return respuestaJson(
    { ok: true, acepta: resultado.acepta },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
