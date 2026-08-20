/**
 * Límite de tasa por identificador (L6 · TRV-06/hardening).
 *
 * ## Qué problema resuelve
 *
 * Los controles del OTP viven en el **código**: cinco minutos de vigencia,
 * tres intentos, sesenta segundos de espera para reenviar. Todos cuelgan del
 * `otpId` que el cliente trae en su cookie, así que quien tira la cookie y
 * vuelve a empezar los esquiva: pide un código nuevo, gasta tres intentos,
 * tira la cookie, y otra vez. Contra un número de celular concreto eso es un
 * ataque de fuerza bruta de seis dígitos, y contra el proveedor de mensajería
 * es una factura.
 *
 * Este módulo pone el límite donde el cliente no lo controla: **la IP**, y en
 * los casos que lo permiten, el destino. No reemplaza a los controles del OTP
 * —que siguen siendo los que la matriz exige— sino que impide repetirlos en
 * masa.
 *
 * ## Por qué es una ventana deslizante y no un contador por minuto
 *
 * Un contador que se reinicia en punto deja pasar el doble del cupo alrededor
 * del corte: doce intentos a las 10:59:59 y doce más a las 11:00:01. La
 * ventana deslizante cuenta los eventos de los últimos N segundos, sin bordes
 * que regalen cupo.
 *
 * ## Módulo puro
 *
 * No conoce el reloj ni dónde se guardan los registros: recibe los dos. Así se
 * prueban los bordes sin esperar, y el mismo criterio sirve para cualquier
 * almacén que se le ponga adelante —hoy, memoria del proceso—.
 */

/** Cuántos eventos se admiten en cuánto tiempo. */
export interface PoliticaLimite {
  /** Nombre corto, para la evidencia y los mensajes de diagnóstico. */
  readonly nombre: string;
  readonly maximo: number;
  readonly ventanaSegundos: number;
}

/**
 * Las tres políticas del OTP de canal.
 *
 * Se limita **por IP**, que es lo que el cliente no elige: el `otpId` y el
 * expediente viajan en cookies que quien ataca puede tirar y renovar, así que
 * contar por ahí sería contar lo que el atacante controla.
 *
 * **Los cupos son altos a propósito, y no es laxitud.** Una IP no es una
 * persona: detrás de la misma dirección hay oficinas, redes de datos móviles
 * con NAT de operador y cualquier lugar con wifi compartido. Un cupo ajustado
 * a "lo que hace una persona" deja afuera a la segunda que entra desde el
 * mismo lugar, y ese es un fallo peor que el que se intenta prevenir: el
 * ataque tiene alternativas, la clienta no.
 *
 * Lo que estos números frenan es el **volumen automatizado** —el guion que
 * pide mil códigos para gastarle el crédito al proveedor de mensajería, o el
 * que tira la cookie para reintentar sin fin—. Lo que frena el abuso *contra
 * un número concreto* son los controles del propio OTP, que siguen intactos:
 * tres intentos por código, sesenta segundos entre reenvíos, cinco minutos de
 * vigencia.
 *
 * **Pendiente declarado:** falta un límite por número de destino, que es el
 * que impide inundar el teléfono de una persona desde muchas IP. No se
 * implementó acá porque exige decidir antes qué pasa con los números
 * compartidos —los de prueba lo son— y porque sin almacén compartido entre
 * instancias sería un límite por instancia, que contra un atacante repartido
 * no sirve. Va con el resto del hardening de red.
 */
export const LIMITE_OTP_ENVIO: PoliticaLimite = {
  nombre: "otp-envio",
  maximo: 30,
  ventanaSegundos: 10 * 60,
};

export const LIMITE_OTP_REENVIO: PoliticaLimite = {
  nombre: "otp-reenvio",
  maximo: 30,
  ventanaSegundos: 30 * 60,
};

/**
 * La verificación admite más eventos que el envío porque es la que la persona
 * tipea, y equivocarse es normal. Sigue siendo la que más importa acotar: es
 * la que adivina.
 */
export const LIMITE_OTP_VERIFICACION: PoliticaLimite = {
  nombre: "otp-verificacion",
  maximo: 60,
  ventanaSegundos: 10 * 60,
};

export type RegistroLimite = readonly number[];

export interface ResultadoLimite {
  readonly permitido: boolean;
  /** Registro nuevo, con este evento adentro si se permitió. */
  readonly registro: RegistroLimite;
  /** Segundos hasta que se libere un cupo. Solo cuando se rechaza. */
  readonly reintentarEnSegundos?: number;
}

/**
 * Evalúa un evento contra la política y devuelve el registro actualizado.
 *
 * Nunca muta el registro recibido: devuelve uno nuevo, igual que las
 * transiciones del expediente. El rechazo **no consume cupo** —si consumiera,
 * insistir extendería el bloqueo para siempre y una persona honesta que
 * refresca la pantalla quedaría encerrada—.
 */
export function evaluarLimite(
  registro: RegistroLimite,
  politica: PoliticaLimite,
  ahoraMs: number,
): ResultadoLimite {
  const desde = ahoraMs - politica.ventanaSegundos * 1000;
  const vigentes = registro.filter((marca) => marca > desde);

  if (vigentes.length >= politica.maximo) {
    // El cupo se libera cuando el más viejo de los vigentes sale de la
    // ventana. Se redondea hacia arriba para no decir "0 segundos" cuando
    // todavía falta una fracción.
    const masViejo = Math.min(...vigentes);
    const reintentarEnSegundos = Math.max(
      1,
      Math.ceil((masViejo + politica.ventanaSegundos * 1000 - ahoraMs) / 1000),
    );
    return { permitido: false, registro: vigentes, reintentarEnSegundos };
  }

  return { permitido: true, registro: [...vigentes, ahoraMs] };
}
