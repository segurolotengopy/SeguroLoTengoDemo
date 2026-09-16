/**
 * Las tres marcas de la cabecera v4, como SVG inline.
 *
 * **El logotipo nuevo de SeguroLoTengo es una de las reglas congeladas del
 * handoff:** «usar el nuevo logotipo respetando exactamente sus proporciones».
 * Por eso cada marca vive en un `viewBox` fijo y se escala por altura: pasarle
 * un ancho y un alto independientes la deformaría, y no hay ninguna prop que
 * lo permita.
 *
 * Inline y no `<img>` por lo mismo que en `marcas.tsx` de v2: sin petición de
 * red, sin parpadeo al cargar y con el color de marca garantizado. Los
 * isologos de v2 no se reutilizan porque v4 los dibuja distinto — Interseguros
 * pasó a cuadrado con la «I» calada en blanco, y Alianza sumó su logotipo.
 */

export interface MarcaProps {
  /** Alto en píxeles. El ancho sale de la proporción del `viewBox`. */
  readonly alto?: number;
  readonly className?: string;
}

const NAVY = "#071F78";
const ROJO = "#FF1721";

/**
 * `segur` + anteojos rojos con la `L` adentro + `tengo`.
 *
 * Las dos «O» del nombre son los aros de unos anteojos: dos anillos rojos
 * unidos por un puente, con la `L` en navy apoyada entre ellos. El resto del
 * texto va en navy, en minúsculas y en negrita.
 */
export function LogoSeguroLoTengo({ alto = 34, className }: MarcaProps) {
  const ancho = Math.round(alto * (340 / 60));
  return (
    <svg
      viewBox="0 0 340 60"
      width={ancho}
      height={alto}
      className={className}
      role="img"
      aria-label="SeguroLoTengo"
    >
      <text
        x="0"
        y="43"
        fill={NAVY}
        fontFamily="var(--v4-fuente)"
        fontSize="44"
        fontWeight="700"
        letterSpacing="-1"
      >
        segur
      </text>
      {/* Anteojos: aro · puente · aro. Trazo grueso, como en el arte. */}
      <g fill="none" stroke={ROJO} strokeWidth="6">
        <circle cx="139" cy="28" r="16" />
        <circle cx="185" cy="28" r="16" />
        <path d="M156 21 h12" strokeLinecap="round" />
      </g>
      {/* La L, en navy, entre los dos aros y apoyada en la línea de base. Va
          dibujada y no como texto: tiene que calzar exactamente en el hueco
          entre los dos aros, y una letra tipografiada cambia de ancho con la
          fuente que termine cargando. */}
      <path
        d="M158 28 V44 H172"
        fill="none"
        stroke={NAVY}
        strokeWidth="7"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      <text
        x="205"
        y="43"
        fill={NAVY}
        fontFamily="var(--v4-fuente)"
        fontSize="44"
        fontWeight="700"
        letterSpacing="-1"
      >
        tengo
      </text>
    </svg>
  );
}

/** Cuadrado naranja de esquinas redondeadas con la «I» calada, y el logotipo. */
export function MarcaInterseguros({ alto = 34, className }: MarcaProps) {
  const ancho = Math.round(alto * (200 / 60));
  return (
    <svg
      viewBox="0 0 200 60"
      width={ancho}
      height={alto}
      className={className}
      role="img"
      aria-label="Interseguros"
    >
      <rect x="82" y="0" width="36" height="36" rx="4" fill="#EC6608" />
      <rect x="96" y="7" width="8" height="22" rx="1.5" fill="#FFFFFF" />
      <text
        x="100"
        y="55"
        fill={NAVY}
        textAnchor="middle"
        fontFamily="var(--v4-fuente)"
        fontSize="17"
        fontWeight="700"
        letterSpacing="0.3"
      >
        INTERSEGUROS
      </text>
    </svg>
  );
}

/** Chevrón azul con el triángulo amarillo, y el logotipo a dos líneas. */
export function MarcaAlianza({ alto = 34, className }: MarcaProps) {
  const ancho = Math.round(alto * (220 / 60));
  return (
    <svg
      viewBox="0 0 220 60"
      width={ancho}
      height={alto}
      className={className}
      role="img"
      aria-label="Alianza Garantía"
    >
      <path d="M8 52 L44 6 L80 52 Z" fill="#1B7FD4" />
      <path d="M30 52 L44 30 L58 52 Z" fill="#F5C518" />
      <text
        x="92"
        y="27"
        fill="#1B7FD4"
        fontFamily="var(--v4-fuente)"
        fontSize="25"
        fontWeight="700"
        letterSpacing="-0.5"
      >
        alianza
      </text>
      <text
        x="92"
        y="50"
        fill="#1B7FD4"
        fontFamily="var(--v4-fuente)"
        fontSize="25"
        fontWeight="700"
        letterSpacing="-0.5"
      >
        garantía
      </text>
      <rect x="92" y="54" width="118" height="3" fill="#7FC4F0" />
    </svg>
  );
}
