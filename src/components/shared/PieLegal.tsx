import { EnlaceAclaracion } from "./AclaracionModal";
import { IDENTIFICACION_CANAL } from "@/domain/textos-legales";
import { CORREO_RETRACTO_Y_DATOS } from "@/domain/entidades";

/**
 * Pie permanente con la identificación del canal y los enlaces informativos.
 *
 * **Fila 1 de la matriz** — *"Informar que SeguroLoTengo.com es marca y canal
 * digital de Interseguros, no aseguradora"* (Ley 4868/13, arts. 3, 7(a) y
 * 7(d); Ley 827/96, arts. 70-71; Res. SS SG. 223/17, numeral 9(c)).
 *
 * Va en **todas** las pantallas y no solo en la primera, por el mismo motivo
 * que la identificación regulatoria de la cabecera: la norma la pide visible y
 * permanente, y alguien puede entrar al trámite por cualquier paso.
 *
 * La cabecera ya dice quién es la aseguradora y quién el intermediario; lo que
 * agrega este pie es lo que la fila 1 pide explícitamente y una cabecera con
 * dos logos no alcanza a decir: que **el corredor no es la aseguradora**.
 *
 * Puramente presentacional. El texto vive en `textos-legales.ts` con su
 * versión, y está pendiente de aprobación de Legal
 * (`docs/plan/PROPUESTAS_TEXTOS_LEGALES_L6.md`).
 */
export function PieLegal({
  className = "",
  colapsable = false,
}: {
  className?: string;
  /**
   * Pie **colapsable** del canvas: desde la segunda pantalla el diseño lo
   * esconde detrás de «INFORMACIÓN LEGAL Y REGULATORIA ▾» en vez de dejar
   * cuatro párrafos de letra chica al pie de cada pantalla (observación de
   * Andres, 01-sep). El contenido no cambia: cambia si está abierto.
   */
  colapsable?: boolean;
}) {
  const cuerpo = (
      <div className="mx-auto flex w-full max-w-pantalla flex-col gap-2">
        <p className="text-[11px] leading-relaxed text-etiqueta">{IDENTIFICACION_CANAL}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          {/* Modal, no navegación. Este pie aparece en **todas** las
              pantallas, incluidas las que tienen un formulario a medio llenar:
              un enlace que navega hace que despejar una duda cueste perder lo
              cargado. Las páginas `/retracto` y `/privacidad` se conservan para
              quien llegue por su dirección; lo que cambió es por dónde se entra
              desde acá. */}
          <EnlaceAclaracion
            documento="derechoRetracto"
            className="font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-300 dark:decoration-azul-600"
          >
            Derecho de retracto
          </EnlaceAclaracion>
          <EnlaceAclaracion
            documento="avisoPrivacidad"
            className="font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-300 dark:decoration-azul-600"
          >
            Tus datos y cookies
          </EnlaceAclaracion>
          <a
            href={`mailto:${CORREO_RETRACTO_Y_DATOS}`}
            className="font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-300 dark:decoration-azul-600"
          >
            {CORREO_RETRACTO_Y_DATOS}
          </a>
        </div>
      </div>
  );

  if (!colapsable) {
    return (
      <footer
        className={`border-t border-borde-tenue bg-superficie-suave px-4 py-3 sm:px-6 ${className}`}
      >
        {cuerpo}
      </footer>
    );
  }

  return (
    <footer className={`border-t border-borde-tenue px-4 py-3 sm:px-6 ${className}`}>
      <details className="mx-auto w-full max-w-pantalla">
        <summary className="cursor-pointer list-none text-[11px] font-bold tracking-[0.08em] text-etiqueta uppercase">
          Información legal y regulatoria ▾
        </summary>
        <div className="pt-3">{cuerpo}</div>
      </details>
    </footer>
  );
}
