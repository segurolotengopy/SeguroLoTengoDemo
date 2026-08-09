/**
 * `GET /api/expediente/caso` — alimenta el bloque `CASO DERIVADO PARA ANÁLISIS`
 * de la Pantalla A (docs/ESPECIFICACION_PANTALLAS.md → "Pantalla A · Emisión no
 * automática").
 *
 * Solo lectura: no transiciona nada y no escribe evidencia. Responde 409 si el
 * expediente no está en DERIVADO_MANUAL, así la Pantalla A no puede mostrarse
 * con datos de un expediente que sigue en el flujo normal.
 *
 * **Qué devuelve y qué no** (regla inviolable #7): el número de caso, el motivo
 * *grueso* (`SALUD` / `PEP` / `SALUD_Y_PEP`), el nombre del solicitante y los
 * dos canales verificados **enmascarados**. Nunca una respuesta de las
 * declaraciones, ni los números de las que bloquearon, ni la cédula completa.
 */
import { COOKIE_SESION, resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { leerCasoDerivado } from "@/domain/declaraciones-p6";
import { enmascararCorreo } from "@/domain/correo";
import { enmascararCelular } from "@/domain/telefono";
import { crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

/** `9323336` → `9.3•• •••`: alcanza para reconocer el documento sin exponerlo. */
function enmascararCedula(numero: string): string {
  const visibles = numero.slice(0, 2);
  return `${visibles}${"•".repeat(Math.max(numero.length - 2, 0))}`;
}

export async function GET(request: Request): Promise<Response> {
  const { contexto, expedienteId } = resolverContextoHttp(request);
  if (!expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
  if (!expediente) {
    return respuestaJson({ ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" }, { status: 404 });
  }

  const caso = leerCasoDerivado(expediente);
  if (!caso) {
    return respuestaJson({ ok: false, motivo: "EXPEDIENTE_NO_DERIVADO" }, { status: 409 });
  }

  const identidad = expediente.identidad;

  return respuestaJson(
    {
      ok: true,
      caso,
      solicitante: identidad
        ? {
            nombre: `${identidad.nombres} ${identidad.apellidos}`,
            documento: enmascararCedula(identidad.numeroCedula),
          }
        : null,
      canales: {
        whatsapp: expediente.canalWhatsapp
          ? enmascararCelular(expediente.canalWhatsapp.valor)
          : null,
        correo: expediente.canalEmail ? enmascararCorreo(expediente.canalEmail.valor) : null,
      },
    },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
