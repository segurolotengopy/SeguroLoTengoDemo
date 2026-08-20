import { nombrePortal } from "@/domain/entidades";
import { PASOS_FLUJO, TOTAL_PASOS, numeroDePaso } from "@/domain/rutas-flujo";

/**
 * Indicador de paso que va en el slot derecho de `HeaderInstitucional`.
 *
 * Indicador de paso, en cuatro variantes: los pasos del flujo, la pantalla de
 * información previa y las dos terminales.
 *
 * **El número no se pasa a mano: se pasa el slug.** Cada pantalla dice cuál es
 * —`/pago`, `/firma`— y el número sale de `PASOS_FLUJO` (`rutas-flujo.ts`),
 * que es donde vive el orden. Antes cada pantalla llevaba su número escrito, y
 * por eso la de firma llegó a anunciar "Paso 7 de 7" cuando le correspondía el
 * 6 (CHG-02): dos fuentes para el mismo dato terminan contradiciéndose. Con el
 * slug no hay forma de que una pantalla se equivoque de número, ni de que el
 * total quede desactualizado cuando el flujo cambie de largo.
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
        <p className="text-sm font-bold text-titulo">P0 · INFORMACIÓN</p>
        <p className="text-[11px] font-semibold tracking-wide text-etiqueta uppercase">
          Fuera del contador 1-9
        </p>
      </div>
    );
  }

  if (props.variante === "pantalla-a") {
    return (
      <div className={`text-right leading-tight ${className}`}>
        <p className="text-sm font-bold text-rojo-700 dark:text-rojo-300">PANTALLA A</p>
        <p className="text-[11px] font-semibold tracking-wide text-rojo-600 uppercase dark:text-rojo-300">
          {nombrePortal()}
        </p>
        <p className="text-[11px] font-semibold tracking-wide text-rojo-600 uppercase dark:text-rojo-300">
          Emisión no automática
        </p>
      </div>
    );
  }

  if (props.variante === "pantalla-b") {
    return (
      <div className={`text-right leading-tight ${className}`}>
        <p className="text-sm font-bold text-rojo-700 dark:text-rojo-300">PANTALLA B</p>
        <p className="text-[11px] font-semibold tracking-wide text-rojo-600 uppercase dark:text-rojo-300">
          QR pagado · Firma no completada
        </p>
      </div>
    );
  }

  // Si el slug no está en la lista, no se dibuja nada: es preferible una
  // cabecera sin indicador que una que invente un número.
  const pasoActual = numeroDePaso(props.slug);
  if (pasoActual === null) return null;

  return (
    <div className={`flex flex-col items-end gap-1.5 ${className}`}>
      <p className="text-[11px] font-semibold tracking-wide text-etiqueta uppercase">
        Paso {pasoActual} de {TOTAL_PASOS}
      </p>
      <div className="flex items-center gap-1.5" role="presentation">
        {PASOS_FLUJO.map((_, indice) => {
          const paso = indice + 1;
          const completado = paso <= pasoActual;
          return (
            <span
              key={paso}
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                completado
                  ? "bg-naranja-500"
                  : "border border-borde-sutil bg-transparent"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
