import type { ReactNode } from "react";
import { ALIANZA, INTERSEGUROS, type Entidad } from "@/domain/entidades";
import { IsologoAlianza, IsologoInterseguros } from "./marcas";
import { ToggleTema } from "./ToggleTema";

/**
 * Cabecera fija de las tres pantallas del flujo (ver
 * docs/ESPECIFICACION_PANTALLAS.md → "Elementos comunes a todas las
 * pantallas"): bloque aseguradora a la izquierda, bloque intermediario al
 * centro y un slot a la derecha para el indicador de paso de cada pantalla
 * (ver `StepperPasos`).
 *
 * A la derecha del indicador va el botón de día/noche (`ToggleTema`): al vivir
 * acá aparece igual en todas las pantallas, sin que ninguna lo repita.
 *
 * Puramente presentacional: no decide qué mostrar en el slot ni conoce el
 * estado del expediente.
 */
export interface HeaderInstitucionalProps {
  /** Indicador de paso de la pantalla actual (`<StepperPasos />` u otro contenido). */
  indicador?: ReactNode;
  className?: string;
}

/**
 * Bloque de una entidad: isologo y nombre, ambos enlazados a su sitio oficial
 * (TRV-04). El enlace es lo que le permite a la persona comprobar que la
 * empresa existe y es quien dice ser, así que abre en pestaña nueva: sacarla
 * del trámite a mitad de camino le costaría el progreso del expediente.
 */
/**
 * Línea de registro de una entidad, debajo de su nombre — donde la maqueta la
 * dibuja ("Matrícula y Resolución" bajo cada entidad; la reunión, 00:03: la
 * resolución "tiene que ser lo mismo… la aseguradora, el intermediario").
 *
 * Es la identificación de la Circular SS.SG. N° 011/2025 (CMP-01), repartida
 * por entidad en vez de una franja única. Lo que D-19 todavía no trajo —la
 * matrícula de Alianza— se omite, no se inventa.
 */
function lineaRegistro(entidad: Entidad): string {
  return entidad.matriculaSis
    ? `${entidad.actividad} · Matrícula SIS N° ${entidad.matriculaSis}`
    : entidad.actividad;
}

function MarcaEntidad({
  entidad,
  rotulo,
  isologo,
}: {
  entidad: Entidad;
  rotulo: string;
  isologo: ReactNode;
}) {
  return (
    <a
      href={entidad.sitioWeb}
      target="_blank"
      rel="noreferrer noopener"
      className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul-600"
    >
      {isologo}
      <div className="min-w-0 leading-tight">
        <p className="text-[10px] font-semibold tracking-wide text-azul-700 uppercase dark:text-azul-300">
          {rotulo}
        </p>
        <p className="truncate text-sm font-semibold text-titulo underline decoration-borde-sutil underline-offset-2">
          {entidad.razonSocial}
        </p>
        <p className="truncate text-[10px] text-etiqueta">{lineaRegistro(entidad)}</p>
      </div>
    </a>
  );
}

export function HeaderInstitucional({
  indicador,
  className = "",
}: HeaderInstitucionalProps) {
  return (
    <header
      className={`w-full border-b border-borde-tenue bg-fondo ${className}`}
    >
      <div className="mx-auto flex w-full max-w-pantalla flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        {/* `min-w-0` para que el truncado de los nombres largos pueda actuar
            y el bloque no empuje al indicador fuera de la pantalla. */}
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <MarcaEntidad
            entidad={ALIANZA}
            rotulo="Aseguradora"
            isologo={<IsologoAlianza tamano={36} className="shrink-0" />}
          />
          <span
            aria-hidden="true"
            className="hidden h-8 w-px bg-borde-sutil sm:block"
          />
          <MarcaEntidad
            entidad={INTERSEGUROS}
            rotulo="Intermediario"
            isologo={<IsologoInterseguros tamano={36} className="shrink-0" />}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
          {indicador}
          <ToggleTema />
        </div>
      </div>

      {/* La identificación regulatoria permanente (CMP-01 · Res. SS.SG.
          N° 190/2025, formato Circular 011/2025) vive ahora en la línea de
          registro de cada entidad, que es donde la maqueta la dibuja. Sigue
          visible, legible y permanente en todas las pantallas. */}
    </header>
  );
}
