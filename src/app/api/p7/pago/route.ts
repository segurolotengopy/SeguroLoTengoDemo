/**
 * `POST /api/p7/pago` — botones `GENERAR QR BANCARD`, `PAGAR CON DÉBITO` y
 * `PAGAR CON CRÉDITO` del paso de pago.
 *
 * Abre la operación en Bancard; **no confirma el pago ni mueve el estado del
 * expediente**. Eso lo hace `GET /api/p7/estado` cuando Bancard reporta la
 * acreditación.
 *
 * El handler no decide nada: pasa el cuerpo crudo al dominio, que interpreta
 * el medio, valida el RUC y resuelve la clave de idempotencia. La declaración
 * de origen lícito ya no se acepta acá: se firma con el FIPF, dos pasos antes
 * (D-08). En particular **el importe no se recibe del cliente**
 * — el cuerpo no tiene ningún campo de monto, y si lo tuviera el dominio lo
 * ignoraría: sale del plan persistido en el expediente (fila 25 de la matriz
 * de cumplimiento).
 *
 * Regla inviolable #6: no hay ningún campo de tarjeta en este endpoint, ni de
 * entrada ni de salida. Para débito y crédito lo único que baja es la URL del
 * formulario seguro de Bancard, donde la persona tipea sus datos.
 */
import {
  COOKIE_SESION,
  leerJson,
  resolverContextoHttp,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { dependenciasP7 } from "@/app/api/p7/_dependencias";
import { iniciarPagoP7 } from "@/domain/pago-p7";
import type { MotivoRechazoP7 } from "@/domain/pago-p7";

export const dynamic = "force-dynamic";

function estadoHttp(motivo: MotivoRechazoP7): number {
  switch (motivo) {
    case "EXPEDIENTE_NO_ENCONTRADO":
      return 404;
    case "ESTADO_INVALIDO":
    case "EXPEDIENTE_INCOMPLETO":
    // El expediente firmado caducó sin pagarse (D-10). Terminal: la respuesta
    // trae la pantalla a la que hay que ir, no un reintento.
    case "PLAZO_VENCIDO":
    // Perdió la carrera de escritura contra el sondeo de estado. No se llegó
    // a abrir nada duplicado en Bancard: reintentar el botón reutiliza la
    // `idempotencyKey` persistida.
    case "CONFLICTO_CONCURRENCIA":
      return 409;
    case "BANCARD_NO_DISPONIBLE":
    case "BANCARD_RECHAZO":
      // 502: el problema está aguas arriba, no en lo que mandó la pantalla.
      return 502;
    default:
      return 400;
  }
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

  const resultado = await iniciarPagoP7(dependenciasP7(request), {
    expedienteId,
    medio: cuerpo.medio,
    ruc: cuerpo.ruc,
    aceptaCertificadoYEntrega: cuerpo.aceptaCertificadoYEntrega,
    contexto,
  });

  if (!resultado.ok) {
    return respuestaJson(
      {
        ok: false,
        motivo: resultado.motivo,
        ...(resultado.siguientePantalla ? { siguientePantalla: resultado.siguientePantalla } : {}),
      },
      { status: estadoHttp(resultado.motivo) },
    );
  }

  return respuestaJson(
    {
      ok: true,
      medio: resultado.medio,
      montoGs: resultado.montoGs,
      numeroPropuesta: resultado.numeroPropuesta,
      referenciaBancard: resultado.referenciaBancard,
      instruccion: resultado.instruccion,
    },
    { cookies: [{ nombre: COOKIE_SESION, valor: contexto.sesionId }] },
  );
}
