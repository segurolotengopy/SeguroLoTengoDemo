/**
 * `GET /api/admin-consola/expediente?id=...` — vista de detalle
 * (`docs/CONSOLA_ADMINISTRATIVA.md` §4).
 *
 * Solo lectura, **nunca editable desde la consola**: no existe un PUT ni un
 * PATCH de expediente en toda la app.
 *
 * ## Excepción explícita a la regla inviolable #7
 *
 * Este endpoint **sí devuelve** las respuestas médicas (declaraciones 1, 2 y 3)
 * y la condición PEP (declaración 8). No contradice la regla #7: esa regla
 * prohíbe que esos datos salgan hacia *analítica, CRM, monitoreo de errores o
 * servicios de IA*, y la consola no es ninguno de esos destinos — es la
 * herramienta de cumplimiento interno de AAB1 / Interseguros / Alianza, que
 * necesita ver exactamente lo que se declaró para poder auditar la decisión.
 * El documento de la consola lo pide de forma expresa (§4) y pide dejarlo
 * escrito acá para que no se confunda con la prohibición.
 *
 * Lo que **no** sale ni siquiera acá, porque no existe en la base:
 * - el código de un OTP en claro (solo se persiste su hash, regla #2),
 * - el PAN completo y el CVV de una tarjeta (regla #6).
 */
import { respuestaJson } from "@/app/api/_http/contexto-peticion";
import { rechazoDeAcceso } from "@/app/api/admin-consola/_guardia";
import {
  estadoBloqueaRegistro,
  expedientesQueBloquean,
  leerCasoDerivadoSiCorresponde,
} from "@/app/api/admin-consola/_detalle";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const rechazo = await rechazoDeAcceso();
  if (rechazo) return rechazo;

  const id = (new URL(request.url).searchParams.get("id") ?? "").trim();
  if (id === "") {
    return respuestaJson({ ok: false, motivo: "ID_REQUERIDO" }, { status: 400 });
  }

  const repositorio = crearExpedienteRepository();
  const expediente = await repositorio.obtenerPorId(id);
  if (!expediente) {
    return respuestaJson({ ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" }, { status: 404 });
  }

  const evidencias = await crearEvidenceStore().obtenerHistorial(id);

  // Quién lo superó, si alguien lo hizo. Sale del índice de sucesión, que es
  // exacto: no depende de que el expediente tenga cédula cargada.
  const sucesores = await repositorio.buscarSucesores(expediente.id);
  const sucesor = sucesores[0] ?? null;

  // La cadena completa de la persona, para el bloque de trazabilidad.
  const cadena = expediente.identidad
    ? await repositorio.buscarPorCedula(expediente.identidad.numeroCedula)
    : [expediente, ...sucesores];
  const bloquean = new Set(
    expedientesQueBloquean([...cadena, ...sucesores]).map((otro) => otro.id),
  );

  return respuestaJson({
    ok: true,
    expediente,
    evidencias,
    caso: leerCasoDerivadoSiCorresponde(expediente),
    bloqueo: {
      estadoBloqueante: estadoBloqueaRegistro(expediente.estado),
      bloqueaHoy: bloquean.has(expediente.id),
      sucesorId: sucesor?.id ?? null,
    },
    cadena: cadena.map((otro) => ({
      id: otro.id,
      estado: otro.estado,
      creadoEn: otro.creadoEn,
      expedienteAnteriorId: otro.expedienteAnteriorId,
    })),
  });
}
