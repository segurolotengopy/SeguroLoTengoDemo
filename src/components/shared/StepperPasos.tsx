/**
 * Indicador de paso que va en el slot derecho de `HeaderInstitucional`.
 *
 * Ver docs/ESPECIFICACION_PANTALLAS.md → "Indicador de paso":
 *   - P0: `P0 · INFORMACIÓN` / `FUERA DEL CONTADOR 1-9`
 *   - P1 a P9: `PASO N DE 9` + 9 puntos, los completados en naranja.
 *   - Pantalla A: `PANTALLA A` / `SEGUROLOTENGO` / `EMISIÓN NO AUTOMÁTICA`
 *   - Pantalla B: `PANTALLA B` / `QR PAGADO · FIRMA NO COMPLETADA`
 *
 * Puramente presentacional: no sabe en qué expediente ni estado está el
 * usuario, solo dibuja lo que se le indica por props.
 */

const PASOS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type PasoFlujo = (typeof PASOS)[number];

type StepperPasosProps =
  | { variante?: "flujo"; pasoActual: PasoFlujo; className?: string }
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
          SeguroLoTengo
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

  const pasoActual = props.pasoActual;

  return (
    <div className={`flex flex-col items-end gap-1.5 ${className}`}>
      <p className="text-[11px] font-semibold tracking-wide text-etiqueta uppercase">
        Paso {pasoActual} de 9
      </p>
      <div className="flex items-center gap-1.5" role="presentation">
        {PASOS.map((paso) => {
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
