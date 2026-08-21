import Link from "next/link";
import type { DestinoDelExpediente } from "@/domain/rutas-flujo";
import {
  AYUDA_DEMO_TRAMITE_EN_OTRO_PASO,
  DETALLE_TRAMITE_CERRADO,
  DETALLE_TRAMITE_EN_OTRO_PASO,
  TITULO_TRAMITE_EN_OTRO_PASO,
} from "@/domain/textos-plan";

/**
 * Lo que se dibuja en lugar del selector cuando quien vuelve a `/plan` trae un
 * expediente que ya pasó ese paso.
 *
 * Antes esto no existía: la pantalla dejaba elegir un plan y recién al enviar
 * el formulario contestaba *"Este proceso ya no está en el paso de selección
 * de plan"* —cierto, pero sin salida—. La regla de la máquina de estados no
 * cambió (`INICIADO`/`PLAN_SELECCIONADO` son los únicos orígenes legales); lo
 * que cambió es cuándo se pregunta: antes de dibujar, no después de elegir.
 *
 * A dónde va el botón y qué dice lo decide `destinoDelExpediente`, no esta
 * pantalla: el rótulo depende de si el trámite se retoma o si se cerró, y esa
 * decisión es la misma que la de la ruta.
 *
 * Server component, sin estado ni JavaScript propio.
 */
export function TramiteEnOtroPaso({
  destino,
  modoDemo,
}: {
  destino: DestinoDelExpediente;
  /** `DEMO_MODE=true`: se agrega el camino para arrancar un trámite nuevo. */
  modoDemo: boolean;
}) {
  return (
    <section
      aria-labelledby="plan-tramite-en-curso"
      className="flex flex-col gap-3 rounded-xl border-2 border-naranja-400 bg-naranja-50 p-5 dark:border-naranja-600 dark:bg-naranja-950"
    >
      <h2
        id="plan-tramite-en-curso"
        className="text-base font-bold text-naranja-800 dark:text-naranja-200"
      >
        {TITULO_TRAMITE_EN_OTRO_PASO}
      </h2>

      <p className="max-w-3xl text-sm leading-relaxed text-cuerpo">
        {destino.terminal ? DETALLE_TRAMITE_CERRADO : DETALLE_TRAMITE_EN_OTRO_PASO}
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
