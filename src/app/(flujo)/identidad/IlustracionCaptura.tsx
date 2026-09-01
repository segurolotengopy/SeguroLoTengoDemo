/**
 * Las tres ilustraciones de captura del canvas: el frente de la cédula con su
 * retrato y sus renglones, el dorso con la banda del MRZ, y el encuadre de la
 * selfie.
 *
 * Están copiadas del diseño (Artifact ce0c8332) trazo por trazo. Antes las
 * tarjetas de captura eran solo texto y por eso no se parecían: quien mira no
 * distingue de un vistazo cuál de las tres fotos le toca (observación de
 * Andres, 01-sep).
 *
 * Heredan el color del texto (`currentColor`), así que siguen el estado de la
 * tarjeta —pendiente, aprobada o rechazada— sin recibir props de color.
 */
import type { TipoCapturaP5 } from "@/domain/catalogo-identidad";

const TRAZOS: Readonly<Record<TipoCapturaP5, { etiqueta: string; d: readonly string[]; extra?: string }>> = {
  FRENTE: {
    etiqueta: "Cédula de frente",
    d: ["M12 40c2-6 14-6 16 0", "M39 17h40M39 27h40M39 37h26"],
    extra: "frente",
  },
  DORSO: {
    etiqueta: "Cédula de dorso",
    d: [
      "M10 13h68M10 21h50",
      "M10 33v13M16 33v13M21 33v13M28 33v13M33 33v13M40 33v13M45 33v13M52 33v13M58 33v13M65 33v13M71 33v13M78 33v13",
    ],
  },
  SELFIE: {
    etiqueta: "Selfie en vivo",
    d: ["M6 16V6h12M82 16V6H70M6 40v10h12M82 40v10H70", "M28 48c3-11 29-11 32 0"],
    extra: "selfie",
  },
};

export function IlustracionCaptura({ tipo }: { readonly tipo: TipoCapturaP5 }) {
  const { etiqueta, d, extra } = TRAZOS[tipo];
  return (
    <svg
      width="88"
      height="56"
      viewBox="0 0 88 56"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-label={etiqueta}
      role="img"
    >
      {tipo === "SELFIE" ? null : <rect x="2" y="2" width="84" height="52" />}
      {extra === "frente" ? (
        <>
          <rect x="9" y="14" width="22" height="28" />
          <circle cx="20" cy="24" r="5" />
        </>
      ) : null}
      {extra === "selfie" ? <circle cx="44" cy="22" r="9" /> : null}
      {d.map((trazo) => (
        <path key={trazo} d={trazo} />
      ))}
    </svg>
  );
}
