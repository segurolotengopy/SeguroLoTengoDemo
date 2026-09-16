/**
 * Ilustración de 05B · Contratación confirmada.
 *
 * 05B no tiene arte aprobado (ver la cabecera de `Pantalla05B.tsx`), así que
 * este dibujo es una **extrapolación provisional**: reproduce la misma
 * gramática que `../ilustraciones.tsx` —trazo navy de 2 px sin relleno,
 * acentos rojos, dos o tres destellos, mancha ovalada azul clarísima— para
 * que la pantalla no desentone mientras no llega el arte real. Vive en su
 * propio archivo y no en `ilustraciones.tsx` porque ese archivo es compartido
 * con las pantallas ya aprobadas y esta sesión no lo toca.
 *
 * Motivo: un certificado con sello (la contratación queda por escrito) y, al
 * lado, un disco rojo con la tilde blanca (confirmado). Si Interseguros manda
 * el arte de 05B, este archivo se reemplaza y ninguna otra pantalla se entera.
 */

const NAVY = "#071F78";
const ROJO = "#FF1721";

export interface IlustracionConfirmacionProps {
  readonly tamano?: number;
  readonly className?: string;
}

const trazo = {
  fill: "none",
  stroke: NAVY,
  strokeWidth: 2.4,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};

export function IlustracionConfirmacion({ tamano = 120, className }: IlustracionConfirmacionProps) {
  return (
    <svg
      viewBox="0 0 120 110"
      width={tamano}
      height={Math.round((tamano * 110) / 120)}
      className={className}
      role="img"
      aria-label="Contratación confirmada"
    >
      <ellipse cx="60" cy="58" rx="55" ry="45" fill="#EAF2FD" />

      {/* El certificado: renglones y un sello con tilde. */}
      <rect x="22" y="20" width="50" height="66" rx="5" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <path d="M32 34 h30" stroke={ROJO} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M32 44 h30 M32 54 h22" {...trazo} />
      <circle cx="47" cy="72" r="10" {...trazo} />
      <path d="M42 72 l3.5 3.5 l7 -7" fill="none" stroke={ROJO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M39 80 l-5 9 l8 -2 l4 7 l5 -9" {...trazo} />

      {/* El disco de confirmación. */}
      <circle cx="92" cy="72" r="18" fill={ROJO} />
      <path d="M83 72 l6.5 6.5 l13 -14" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Destellos. */}
      <g stroke={ROJO} strokeWidth="3" strokeLinecap="round">
        <path d="M86 14 l6 -9" />
        <path d="M97 17 l7 -7" />
        <path d="M76 8 l4 -6" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Íconos de línea de los documentos que no tienen equivalente en
// `../ilustraciones.tsx` (el paquete firmado y el certificado sí lo tienen:
// `IconoEntregaDigital` e `IconoCalendarioReloj`, y `Pantalla05B` los reusa).
// Misma gramática que `IconoLienzo` de ese archivo: viewBox 32×32, trazo navy
// de 1.9 px, sin relleno, acentos rojos.
// ---------------------------------------------------------------------------

export interface IconoDocumentoProps {
  readonly tamano?: number;
  readonly className?: string;
}

const trazoIcono = { fill: "none", stroke: NAVY, strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Recibo con renglón rojo: el comprobante de pago (D-05), no la factura. */
export function IconoRecibo({ tamano = 30, className }: IconoDocumentoProps) {
  return (
    <svg viewBox="0 0 32 32" width={tamano} height={tamano} className={className} role="img" aria-label="Comprobante de pago">
      <path d="M8 4 h16 v24 l-3 -2.5 l-3 2.5 l-3 -2.5 l-3 2.5 l-3 -2.5 l-3 2.5 z" {...trazoIcono} />
      <path d="M12 11 h8" stroke={ROJO} strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12 16 h8 M12 21 h5" {...trazoIcono} />
    </svg>
  );
}

/** Documento con firma manuscrita: la constancia del acto de firma (D-27). */
export function IconoConstanciaFirma({ tamano = 30, className }: IconoDocumentoProps) {
  return (
    <svg viewBox="0 0 32 32" width={tamano} height={tamano} className={className} role="img" aria-label="Constancia de firma">
      <path d="M7 4 h13 l6 6 v18 h-19 z" {...trazoIcono} />
      <path d="M20 4 v6 h6" {...trazoIcono} />
      <path
        d="M10 22 c1.5 -3 3 -4 4.5 -2 s2 3 3.5 0 s2.5 -3 4 -1"
        fill="none"
        stroke={ROJO}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
