import { COOKIE_EXPEDIENTE, COOKIE_OTP, respuestaRedireccion } from "@/app/api/_http/contexto-peticion";

/**
 * Cierra el trámite **en este navegador** y devuelve a la selección de plan.
 *
 * Es el destino del botón *Finalizar* de las tres pantallas de cierre: la
 * confirmación (P9), la de revisión manual (A) y la de solicitud vencida (B).
 *
 * ## Qué problema resuelve
 *
 * Hasta ahora ese botón apuntaba a `/`, que redirige a `/plan`; pero la cookie
 * seguía apuntando al expediente terminado, así que `/plan` reconocía un
 * trámite en curso y dibujaba *"Ya tenés un trámite empezado"*. Quien acababa
 * de contratar y volvía al inicio se topaba con un panel diciéndole que
 * retomara algo que ya había terminado.
 *
 * ## Qué NO hace
 *
 * **No toca el expediente.** No lo borra, no lo cierra, no lo cambia de estado:
 * `EMITIDO` es terminal y su evidencia es append-only (regla inviolable #10).
 * Lo único que pasa acá es que este navegador deja de arrastrarlo.
 *
 * **No levanta el bloqueo por cédula** (regla inviolable #11). Ese bloqueo se
 * deriva de la cadena de expedientes y lo aplica P5 sobre la cédula leída, no
 * sobre la cookie: alguien con un expediente en `DERIVADO_MANUAL` que use este
 * botón empieza de nuevo y vuelve a chocar contra el bloqueo en el paso 4, que
 * es exactamente lo que tiene que pasar. Solo la consola administrativa lo
 * levanta.
 *
 * ## Por qué POST y no un enlace
 *
 * Porque `next/link` **precarga** los `href` que aparecen en pantalla: un GET
 * acá haría que la sola presencia del botón borrara la cookie antes de que
 * nadie lo tocara. Un `<form method="post">` no se precarga.
 *
 * Se va también la cookie del OTP en curso: pertenece al trámite que se está
 * cerrando, y dejarla viva no le sirve a nadie.
 */
export function POST(): Response {
  return respuestaRedireccion("/plan", {
    cookies: [
      { nombre: COOKIE_EXPEDIENTE, valor: "", maxAge: 0 },
      { nombre: COOKIE_OTP, valor: "", maxAge: 0 },
    ],
  });
}
