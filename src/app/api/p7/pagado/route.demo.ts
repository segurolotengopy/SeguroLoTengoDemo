/**
 * `POST /api/p7/pagado` — el botón *Pagado* del paso 7, en la demostración.
 *
 * ## Qué simula
 *
 * Lo que en la realidad ocurre en el celular de la persona: escanea el QR con
 * la app de su banco y paga. Bancard notifica al comercio por callback y el
 * sondeo de la pantalla ve la operación acreditada.
 *
 * Antes eso lo hacía un reloj: el mock acreditaba solo a los seis segundos. Se
 * cambió por una acción explícita por pedido de Andres (21-ago-2026), y de paso
 * arregla algo peor — el reloj vivía en la memoria de una instancia de cómputo,
 * y Amplify puede atender el sondeo con otra que nunca vio la operación,
 * dejando la pantalla esperando para siempre.
 *
 * ## Lo que no hace
 *
 * **No transiciona el expediente.** Solo marca la operación como acreditada del
 * lado del proveedor simulado; quien mueve el expediente a `PAGO_CONFIRMADO`
 * sigue siendo `confirmarPagoP7`, con sus validaciones y emitiendo el
 * Certificado de Cobertura Provisional en la misma escritura (D-12). El sondeo
 * de la pantalla lo llama como siempre: este endpoint no le ahorra un solo
 * control al flujo.
 *
 * **No acepta ningún identificador del cliente.** La referencia sale del `Pago`
 * persistido del expediente de la sesión, igual que hace el firmador simulado
 * de P8: un pedido solo puede afectar al expediente de quien lo manda, y esa es
 * la propiedad que hace innecesaria la clave del panel de demo acá.
 *
 * **No existe fuera de `DEMO_MODE`.** Extensión `route.demo.ts`: con el flag
 * apagado App Router ni siquiera compila la ruta (ver `next.config.ts`), y
 * además hay guarda de runtime.
 */
import { resolverContextoHttp, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import { acreditarPagoMock } from "@/adapters/mock/payment-provider";
import { crearExpedienteRepository } from "@/repositories";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!esModoDemo()) {
    return respuestaJson({ ok: false, motivo: "NO_DISPONIBLE" }, { status: 404 });
  }

  const contexto = resolverContextoHttp(request);
  if (!contexto.expedienteId) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 400 });
  }

  const expediente = await crearExpedienteRepository().obtenerPorId(contexto.expedienteId);
  if (!expediente) {
    return respuestaJson({ ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" }, { status: 404 });
  }

  const pago = expediente.pago;
  // Sin referencia no hay operación abierta del otro lado: la persona todavía
  // no generó el QR, así que no hay nada que acreditar.
  if (!pago?.referenciaBancard) {
    return respuestaJson({ ok: false, motivo: "PAGO_NO_INICIADO" }, { status: 409 });
  }

  const estado = acreditarPagoMock(pago.referenciaBancard, {
    medio: pago.medio,
    montoGs: pago.montoGs,
    ahora: new Date().toISOString(),
  });

  // Se devuelve el estado del proveedor, no el del expediente: el que mueve el
  // expediente es el sondeo, y confundir los dos es lo que llevaría a alguien a
  // creer que este endpoint cobra.
  return respuestaJson({ ok: true, estadoProveedor: estado.estado });
}
