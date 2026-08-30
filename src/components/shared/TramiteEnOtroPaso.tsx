import Link from "next/link";
import type { DestinoDelExpediente } from "@/domain/rutas-flujo";
import {
  AYUDA_DEMO_TRAMITE_EN_OTRO_PASO,
  DETALLE_TRAMITE_CERRADO,
  TITULO_TRAMITE_EN_OTRO_PASO,
} from "@/domain/textos-plan";

/**
 * Lo que se dibuja en lugar del formulario cuando quien llega a una pantalla
 * del flujo trae un expediente que ya no está en ese paso.
 *
 * ## Por qué
 *
 * Antes cada pantalla se dibujaba entera y el rechazo llegaba al enviar: *"Este
 * proceso ya no está en el paso de verificación de identidad"* —cierto, y sin
 * salida—. Peor en `/identidad`, donde para enterarse había que sacar primero
 * las tres fotografías. La regla de la máquina de estados no cambió; lo que
 * cambió es **cuándo se pregunta**: antes de dibujar, no después de que la
 * persona trabajó.
 *
 * Nació en `/plan` y se generalizó al resto sin volver a escribirlo: el título,
 * el aviso de demostración y el rótulo del botón son los mismos en todas, y lo
 * único propio de cada pantalla es la frase que explica qué paso quedó atrás.
 *
 * A dónde va el botón y qué dice lo decide `destinoDelExpediente`, no esta
 * pantalla: el rótulo cambia según el trámite se retome o se haya cerrado, y esa
 * decisión es la misma que la de la ruta.
 *
 * Server component, sin estado ni JavaScript propio.
 */
export function TramiteEnOtroPaso({
  destino,
  detalle,
  modoDemo,
}: {
  destino: DestinoDelExpediente;
  /**
   * Qué decirle a quien llegó, cuando el trámite sigue en curso. Es lo único
   * que cambia entre pantallas — un texto genérico ("este paso ya pasó") deja a
   * la persona sin saber qué paso ni por qué.
   *
   * Para un trámite ya cerrado se ignora: ahí manda `DETALLE_TRAMITE_CERRADO`,
   * porque lo que importa no es qué paso quedó atrás sino que no hay vuelta.
   */
  detalle: string;
  /** `DEMO_MODE=true`: se agrega el camino para arrancar un trámite nuevo. */
  modoDemo: boolean;
}) {
  return (
    <section
      aria-labelledby="tramite-en-curso"
      className="flex flex-col gap-3 rounded-xl border-2 border-naranja-400 bg-naranja-50 p-5 dark:border-naranja-600 dark:bg-naranja-950"
    >
      <h2
        id="tramite-en-curso"
        className="text-base font-bold text-naranja-800 dark:text-naranja-200"
      >
        {TITULO_TRAMITE_EN_OTRO_PASO}
      </h2>

      <p className="max-w-3xl text-sm leading-relaxed text-cuerpo">
        {destino.terminal ? DETALLE_TRAMITE_CERRADO : detalle}
      </p>

      <Link
        href={destino.ruta}
        className="inline-flex h-12 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 sm:self-start"
      >
        {destino.rotulo} →
      </Link>

      {modoDemo ? (
        <p className="text-xs text-etiqueta">
          {AYUDA_DEMO_TRAMITE_EN_OTRO_PASO}{" "}
          <Link
            href="/demo-panel"
            className="font-semibold text-azul-700 underline underline-offset-2 dark:text-azul-300"
          >
            Abrir el panel de demo
          </Link>
        </p>
      ) : null}
    </section>
  );
}
