import { cookies } from "next/headers";
import { COOKIE_EXPEDIENTE } from "@/app/api/_http/contexto-peticion";
import { destinoDelExpediente, perteneceAEstePaso } from "@/domain/rutas-flujo";
import type { DestinoDelExpediente } from "@/domain/rutas-flujo";
import type { EstadoExpediente } from "@/domain/tipos";
import { crearExpedienteRepository } from "@/repositories";

/**
 * ¿El expediente de este navegador todavía pertenece a esta pantalla?
 *
 * Devuelve `null` cuando sí —o cuando no hay trámite— y el destino a donde
 * reencaminar cuando no. Con eso, cada pantalla del flujo dibuja el panel
 * `TramiteEnOtroPaso` en lugar de su formulario, en vez de dejar trabajar a la
 * persona y rechazarla al final con un `ESTADO_INVALIDO` sin salida.
 *
 * Es la generalización de lo que `/plan` hizo primero. Vive acá, en el grupo de
 * rutas del flujo, y no en `src/domain/`: lee cookies y consulta el
 * repositorio, que son cosas de la capa de Next, no de las reglas de negocio.
 * La regla —qué estado pertenece a qué pantalla— sí está en el dominio.
 *
 * ## Tres decisiones que valen para las cinco pantallas
 *
 * **Se pregunta en el servidor y antes de dibujar.** El costo es que la
 * pantalla pasa a renderizarse por pedido —leer la cookie desactiva el render
 * estático—; a cambio no hay una llamada extra desde el celular ni un parpadeo
 * de formulario que después se reemplaza.
 *
 * **Sin cookie no toca la base.** Quien llega sin trámite no paga ninguna
 * lectura.
 *
 * **Si la consulta falla, se sigue de largo y se dibuja el formulario.** Una
 * caída del repositorio no tiene por qué dejar sin entrada al embudo entero, y
 * el Route Handler valida el estado igual: esto adelanta el aviso, no lo
 * reemplaza.
 */
export async function expedienteEnOtroPaso(
  slug: string,
  /**
   * Estados que esta pantalla **sigue mostrando** aunque `PANTALLA_POR_ESTADO`
   * ya apunte a la siguiente.
   *
   * Existe por el pago: al acreditarse, `/pago` no navega sola — se queda
   * mostrando *"Pago acreditado"*, el número de propuesta y el enlace *Ver la
   * confirmación →*, y es la persona la que decide avanzar. Sin esta lista, un
   * refresco en ese momento reemplazaba el comprobante por *"Ya tenés un
   * trámite empezado"*: técnicamente cierto, y le sacaba de la vista la prueba
   * de que su pago entró. Lo encontró el E2E del camino feliz, que recarga
   * justo ahí.
   *
   * Es la excepción, no la regla: las demás pantallas navegan al terminar, así
   * que volver a ellas es siempre volver atrás.
   */
  tambienPropios: readonly EstadoExpediente[] = [],
): Promise<DestinoDelExpediente | null> {
  const expedienteId = (await cookies()).get(COOKIE_EXPEDIENTE)?.value;
  if (!expedienteId) return null;

  try {
    const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
    // Cookie sin expediente detrás (purgado, otro ambiente): no es un trámite
    // en curso, así que la pantalla se comporta como con una visita nueva.
    if (!expediente) return null;
    if (perteneceAEstePaso(slug, expediente.estado)) return null;
    if (tambienPropios.includes(expediente.estado)) return null;
    return destinoDelExpediente(expediente.estado);
  } catch {
    return null;
  }
}
