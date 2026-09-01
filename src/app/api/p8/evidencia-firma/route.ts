/**
 * `GET /api/p8/evidencia-firma` — la constancia del acto de firma del cliente,
 * para la persona que firmó.
 *
 * La firma del cliente es no cualificada y la genera el portal (D1), así que
 * no hay certificado de un prestador que alguien pueda abrir: lo que la
 * respalda es el registro de evidencia. Este endpoint lo proyecta agrupado por
 * los requisitos de la Res. SS.SG. 210/2025 art. 4, que es lo que hace que la
 * lista signifique algo (`domain/constancia-firma.ts`).
 *
 * **Solo devuelve la constancia del expediente de la sesión.** No recibe
 * identificador: lo saca de la cookie, igual que el resto del flujo. Es de
 * lectura pura — no transiciona, no escribe evidencia. Que una persona mire lo
 * que respalda su propia firma no es un hecho que haya que asentar, y sí sería
 * una escritura por cada apertura del panel.
 */
import {
  COOKIE_SESION,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { proyectarConstanciaFirma } from "@/domain/constancia-firma";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const cookies = [{ nombre: COOKIE_SESION, valor: contexto.sesionId }];

  const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
  if (!expediente) {
    return respuestaJson(
      { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" },
      { status: 404, cookies },
    );
  }

  const historial = await crearEvidenceStore().obtenerHistorial(expedienteId);
  const constancia = proyectarConstanciaFirma(expediente, historial);
  if (!constancia) {
    return respuestaJson({ ok: false, motivo: "SIN_FIRMA_INTERNA" }, { status: 409, cookies });
  }

  return respuestaJson({ ok: true, constancia }, { cookies });
}
