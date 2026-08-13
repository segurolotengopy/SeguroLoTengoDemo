/**
 * Isologos de las dos entidades, como SVG inline para que no dependan de una
 * petición de red ni parpadeen al cargar. Misma geometría y colores que los
 * archivos de `public/marca/` (que quedan para usos fuera de la app: correos,
 * documentos, material del demo). Los colores son de marca y no cambian con
 * el tema (ver docs/GUIA_DE_ESTILOS.md → "Logos e isologos").
 */

export interface IsologoProps {
  /** Lado del cuadrado, en píxeles. */
  readonly tamano?: number;
  readonly className?: string;
}

/**
 * Isologo de Interseguros: cápsula naranja con la "I" calada (transparente) y
 * la esquina inferior derecha de radio mayor. Identificador base de
 * SeguroLoTengo. Al ser calada, la "I" toma el color del fondo en ambos temas.
 */
export function IsologoInterseguros({ tamano = 36, className }: IsologoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={tamano}
      height={tamano}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fillRule="evenodd"
        d="M 19 4 H 81 A 15 15 0 0 1 96 19 V 54 A 42 42 0 0 1 54 96 H 19 A 15 15 0 0 1 4 81 V 19 A 15 15 0 0 1 19 4 Z
           M 46 20 H 54 A 6 6 0 0 1 60 26 V 74 A 6 6 0 0 1 54 80 H 46 A 6 6 0 0 1 40 74 V 26 A 6 6 0 0 1 46 20 Z"
        fill="#e2660f"
      />
    </svg>
  );
}

/** Isologo de Alianza Garantía: chevrón azul con triángulo verde. */
export function IsologoAlianza({ tamano = 36, className }: IsologoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={tamano}
      height={tamano}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 12 82 L 50 18 L 88 82"
        fill="none"
        stroke="#2b5a9e"
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 50 48 L 30 83 L 70 83 Z"
        fill="#8dc63f"
        stroke="#8dc63f"
        strokeWidth="7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
