import { nombrePortal } from "@/domain/entidades";
import { TOTAL_ETAPAS, etapaDePaso } from "@/domain/rutas-flujo";

/**
 * Indicador de macroetapa que va en el slot `indicador` de `HeaderInstitucional`,
 * debajo de la línea roja, a todo el ancho (D-36; `PANTALLA_02_…` y
 * `PANTALLA_03A_…APROBADA_FINAL.png`).
 *
 * **v4 cambió qué cuenta el stepper.** Antes era "Paso N de {TOTAL_PASOS}"
 * (8 pantallas). El handoff de pantallas v4 dibuja cinco puntos con "N de 5":
 * las cinco macroetapas del manual funcional — Plan · Verificación ·
 * Actividad e ingresos · Declaraciones y firma · Pago y confirmación — no las
 * ocho pantallas del flujo vigente. Varias pantallas comparten etapa (ver
 * `PasoDelFlujo.etapa` en `rutas-flujo.ts`), así que el número que se ve acá
 * puede repetirse entre dos pantallas consecutivas — es correcto, no un bug:
 * `/whatsapp` y `/preparacion` son las dos "2 de 5".
 *
 * **El número no se pasa a mano: se pasa el slug.** Cada pantalla dice cuál
 * es —`/pago`, `/firma`— y la etapa sale de `PASOS_FLUJO` (`rutas-flujo.ts`),
 * que es donde vive el orden. Antes cada pantalla llevaba su número escrito,
 * y por eso la de firma llegó a anunciar "Paso 7 de 7" cuando le
 * correspondía el 6 (CHG-02): dos fuentes para el mismo dato terminan
 * contradiciéndose.
 *
 * Puramente presentacional: no sabe en qué expediente ni estado está el
 * usuario, solo dibuja lo que se le indica por props.
 */

type StepperPasosProps =
  | { variante?: "flujo"; slug: string; className?: string }
  | { variante: "p0"; className?: string }
  | { variante: "pantalla-a"; className?: string }
  | { variante: "pantalla-b"; className?: string };

export function StepperPasos(props: StepperPasosProps) {
  const { className = "" } = props;

  if (props.variante === "p0") {
    return (
      <div className={`text-right leading-tight ${className}`}>
        <p className="text-sm font-bold text-titulo">INFORMACIÓN</p>
        <p className="text-[11px] font-semibold tracking-wide text-etiqueta uppercase">
          Fuera del contador de {TOTAL_ETAPAS} etapas
        </p>
      </div>
    );
  }

  if (props.variante === "pantalla-a") {
    return (
      <div className={`text-right leading-tight ${className}`}>
        <p className="text-sm font-bold text-v4-rojo">DERIVACIÓN A REVISIÓN MANUAL</p>
        <p className="text-[11px] font-semibold tracking-wide text-v4-rojo uppercase">
          {nombrePortal()} · Emisión no automática
        </p>
      </div>
    );
  }

  if (props.variante === "pantalla-b") {
    return (
      <div className={`text-right leading-tight ${className}`}>
        <p className="text-sm font-bold text-v4-rojo">SOLICITUD VENCIDA</p>
        {/* D-32 · lo que caduca ahora es un expediente firmado que no pagó
            dentro de los 10 minutos. */}
        <p className="text-[11px] font-semibold tracking-wide text-v4-rojo uppercase">
          Firmada · Pago no completado
        </p>
      </div>
    );
  }

  // Si el slug no está en la lista, no se dibuja nada: es preferible una
  // cabecera sin indicador que una que invente un número.
  const etapaActual = etapaDePaso(props.slug);
  if (etapaActual === null) return null;

  const etapas = Array.from({ length: TOTAL_ETAPAS }, (_, indice) => indice + 1);

  return (
    <div className={`flex w-full items-center gap-4 ${className}`}>
      <ol className="flex flex-1 items-center" aria-hidden="true">
        {etapas.map((etapa, indice) => (
          <li key={etapa} className="flex flex-1 items-center last:flex-none">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                etapa <= etapaActual ? "bg-v4-rojo" : "bg-hueso-300"
              }`}
            />
            {indice < etapas.length - 1 ? (
              <span
                className={`h-0.5 flex-1 ${etapa < etapaActual ? "bg-v4-rojo" : "bg-hueso-200"}`}
              />
            ) : null}
          </li>
        ))}
      </ol>
      <p className="shrink-0 text-sm font-semibold text-cuerpo">
        {etapaActual} de {TOTAL_ETAPAS}
      </p>
    </div>
  );
}
