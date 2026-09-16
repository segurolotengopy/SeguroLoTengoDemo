/**
 * Las ilustraciones y los íconos de línea del handoff v4.
 *
 * Todas comparten la misma gramática, que es lo que hace que el conjunto se
 * lea como un sistema y no como una colección: **trazo navy de 2 px, sin
 * relleno, con acentos rojos y dos o tres destellos**, sobre una mancha ovalada
 * azul clarísima. Se dibujan acá y no se importan como archivo por lo mismo
 * que las marcas: sin petición de red y con el color de marca garantizado.
 *
 * Son una reconstrucción vectorial de los artes, no los archivos originales —
 * el handoff entregó PNG, no SVG. Si Interseguros manda los vectores, se
 * reemplaza este archivo y ninguna pantalla se entera.
 */

const NAVY = "#071F78";
const ROJO = "#FF1721";

export interface IlustracionProps {
  readonly tamano?: number;
  readonly className?: string;
}

/** La mancha ovalada azul clarísima sobre la que se apoya cada ilustración. */
function Mancha({ redonda = false }: { readonly redonda?: boolean }) {
  return redonda ? (
    <circle cx="60" cy="58" r="47" fill="#EAF2FD" />
  ) : (
    <ellipse cx="60" cy="58" rx="55" ry="45" fill="#EAF2FD" />
  );
}

/** Los destellos rojos que acompañan a todas las ilustraciones. */
function Destellos({ x = 88, y = 16 }: { readonly x?: number; readonly y?: number }) {
  return (
    <g stroke={ROJO} strokeWidth="3" strokeLinecap="round">
      <path d={`M${x} ${y} l6 -9`} />
      <path d={`M${x + 11} ${y + 3} l7 -7`} />
    </g>
  );
}

function Lienzo({
  tamano = 120,
  className,
  etiqueta,
  redonda = false,
  children,
}: IlustracionProps & { readonly etiqueta: string; readonly redonda?: boolean; readonly children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 120 110" width={tamano} height={Math.round((tamano * 110) / 120)} className={className} role="img" aria-label={etiqueta}>
      <Mancha redonda={redonda} />
      {children}
    </svg>
  );
}

const trazo = { fill: "none", stroke: NAVY, strokeWidth: 2.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** 01 · mano sosteniendo un celular con un escudo y una tilde roja. */
export function IlustracionPortada(props: IlustracionProps) {
  return (
    <Lienzo {...props} etiqueta="Contratación digital">
      <rect x="42" y="18" width="40" height="66" rx="7" {...trazo} />
      <path d="M55 24 h14" {...trazo} />
      <path d="M62 40 l12 5 v9 c0 7 -5 12 -12 15 c-7 -3 -12 -8 -12 -15 v-9 z" {...trazo} />
      <path d="M56 54 l4 4 l8 -9" fill="none" stroke={ROJO} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 70 c-4 6 -2 14 5 17 h30 c6 0 10 -4 11 -9" {...trazo} />
      <Destellos x={26} y={26} />
    </Lienzo>
  );
}

/** 02 · tres escudos: lazo oncológico al centro, corazón y cruz a los lados. */
export function IlustracionPlanes(props: IlustracionProps) {
  return (
    <Lienzo {...props} etiqueta="Planes del seguro">
      <path d="M30 34 l14 5 v12 c0 9 -6 15 -14 18 c-8 -3 -14 -9 -14 -18 v-12 z" {...trazo} />
      <path d="M30 50 c-3 -4 -8 -2 -8 2 c0 4 8 8 8 8 s8 -4 8 -8 c0 -4 -5 -6 -8 -2 z" {...trazo} />
      <path d="M90 34 l14 5 v12 c0 9 -6 15 -14 18 c-8 -3 -14 -9 -14 -18 v-12 z" {...trazo} />
      <path d="M90 44 v14 M83 51 h14" {...trazo} />
      <path d="M60 22 l20 7 v18 c0 13 -8 22 -20 26 c-12 -4 -20 -13 -20 -26 v-18 z" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M60 40 c-6 6 -10 12 -6 16 c3 3 7 0 6 -5 c-1 -5 -5 -9 -10 -11 M60 40 c6 6 10 12 6 16 c-3 3 -7 0 -6 -5 c1 -5 5 -9 10 -11" fill="none" stroke="#0876F9" strokeWidth="2.4" strokeLinecap="round" />
      <Destellos x={92} y={14} />
    </Lienzo>
  );
}

/** 03A · celular con WhatsApp y un escudo con el código. */
export function IlustracionWhatsApp(props: IlustracionProps) {
  return (
    <Lienzo {...props} etiqueta="Verificación por WhatsApp">
      <rect x="14" y="22" width="40" height="64" rx="7" {...trazo} />
      <circle cx="34" cy="52" r="13" fill="#25D366" />
      <path transform="translate(-13,-6)" d="M41 46c.6-.3 1.3 0 1.7.6l1.4 2.4c.3.5.2 1.2-.2 1.6l-.9.8c-.2.4-.4.9 0 1.5.9 1.4 2.3 2.8 3.9 3.6.6.3 1.1.2 1.5-.2l.8-.9c.4-.4 1-.5 1.6-.2l2.4 1.4c.6.3.8 1 .6 1.7-.4 1.4-1.8 2.4-3.5 2.4-5.3 0-11.5-6.2-11.5-11.5 0-1.7 1-3 2.2-3.2z" fill="#FFFFFF" />
      <path d="M84 32 l18 6 v15 c0 11 -7 19 -18 23 c-11 -4 -18 -12 -18 -23 v-15 z" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.6" strokeLinejoin="round" />
      <text x="84" y="60" textAnchor="middle" fill={NAVY} fontFamily="var(--v4-fuente)" fontSize="13" fontWeight="700">
        123456
      </text>
      <Destellos x={20} y={16} />
    </Lienzo>
  );
}

/** 03B · lista con tildes, carnet y celular con tilde. */
export function IlustracionPreparacion(props: IlustracionProps) {
  return (
    <Lienzo {...props} etiqueta="Prepará lo necesario">
      <rect x="16" y="18" width="42" height="54" rx="5" {...trazo} />
      <g stroke={ROJO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M22 30 l3 3 l6 -7" />
        <path d="M22 44 l3 3 l6 -7" />
        <path d="M22 58 l3 3 l6 -7" />
      </g>
      <path d="M36 30 h16 M36 44 h16 M36 58 h16" {...trazo} />
      <rect x="46" y="52" width="46" height="32" rx="4" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <circle cx="58" cy="66" r="6" {...trazo} />
      <path d="M70 60 h16 M70 68 h16" stroke={ROJO} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="94" cy="40" r="13" fill={ROJO} />
      <path d="M88 40 l4 4 l9 -9" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <Destellos x={86} y={12} />
    </Lienzo>
  );
}

/** 03C · cédula y celular con rostro, con la tilde roja. */
export function IlustracionIdentidad(props: IlustracionProps) {
  return (
    <Lienzo {...props} etiqueta="Verificá tu identidad" redonda>
      <g transform="rotate(-8 46 52)">
        <rect x="16" y="34" width="56" height="38" rx="4" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
        <text x="44" y="43" textAnchor="middle" fill={NAVY} fontFamily="var(--v4-fuente)" fontSize="6" fontWeight="700">
          REPÚBLICA DEL PARAGUAY
        </text>
        <circle cx="30" cy="57" r="7" {...trazo} />
        <path d="M43 52 h22" stroke={ROJO} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M43 59 h22 M43 66 h14" {...trazo} />
      </g>
      <rect x="62" y="22" width="40" height="62" rx="6" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <path d="M70 36 v-5 h6 M94 36 v-5 h-6 M70 62 v5 h6 M94 62 v5 h-6" {...trazo} />
      <circle cx="82" cy="46" r="6" {...trazo} />
      <path d="M73 60 c2 -6 5 -8 9 -8 c4 0 7 2 9 8" {...trazo} />
      <circle cx="100" cy="66" r="13" fill={ROJO} />
      <path d="M94 66 l4 4 l9 -9" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <Destellos x={88} y={12} />
    </Lienzo>
  );
}

/** 03D · carnet con la tilde navy: la identidad ya verificada. */
export function IlustracionDatos(props: IlustracionProps) {
  return (
    <Lienzo {...props} etiqueta="Completá tus datos">
      <rect x="20" y="30" width="66" height="46" rx="5" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <circle cx="40" cy="48" r="8" {...trazo} />
      <path d="M33 66 c2 -6 4 -8 7 -8 c3 0 5 2 7 8" {...trazo} />
      <path d="M58 44 h20" stroke={ROJO} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M58 53 h20 M58 62 h13" {...trazo} />
      <circle cx="86" cy="64" r="15" fill={NAVY} />
      <path d="M79 64 l5 5 l10 -11" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <Destellos x={84} y={14} />
    </Lienzo>
  );
}

/** 03E · persona con maletín y monedas. */
export function IlustracionActividad(props: IlustracionProps) {
  return (
    <Lienzo {...props} etiqueta="Actividad e ingresos">
      <circle cx="56" cy="30" r="11" {...trazo} />
      <path d="M36 74 c2 -16 10 -24 20 -24 c10 0 18 8 20 24" {...trazo} />
      <rect x="22" y="56" width="32" height="24" rx="3" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <path d="M32 56 v-5 h12 v5" {...trazo} />
      <g fill="none" stroke={NAVY} strokeWidth="2.4">
        <ellipse cx="82" cy="58" rx="16" ry="6" />
        <path d="M66 58 v9 c0 3 7 6 16 6 c9 0 16 -3 16 -6 v-9" />
        <path d="M66 67 v9 c0 3 7 6 16 6 c9 0 16 -3 16 -6 v-9" />
      </g>
      <circle cx="90" cy="34" r="12" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <path d="M84 34 l4 4 l9 -9" fill="none" stroke={NAVY} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <Destellos x={96} y={12} />
    </Lienzo>
  );
}

/** 04A · persona, corazón con electrocardiograma y planilla con tilde. */
export function IlustracionDeclaraciones(props: IlustracionProps) {
  return (
    <Lienzo {...props} etiqueta="Datos y declaraciones">
      <circle cx="40" cy="26" r="11" {...trazo} />
      <path d="M20 78 c2 -18 10 -28 20 -28 c6 0 11 3 14 9" {...trazo} />
      <path d="M44 52 c-6 -8 -18 -6 -18 4 c0 9 14 17 18 20 c4 -3 18 -11 18 -20 c0 -10 -12 -12 -18 -4 z" {...trazo} />
      <path d="M28 58 h6 l3 -6 l4 12 l4 -8 h7" fill="none" stroke={ROJO} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="64" y="22" width="38" height="52" rx="4" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <path d="M72 34 h22 M72 42 h22" {...trazo} />
      <circle cx="83" cy="58" r="10" {...trazo} />
      <path d="M78 58 l4 4 l8 -8" fill="none" stroke={NAVY} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <Destellos x={88} y={12} />
    </Lienzo>
  );
}

/** 04D · planilla con tres tildes rojas y escudo con tilde. */
export function IlustracionConsentimientos(props: IlustracionProps) {
  return (
    <Lienzo {...props} etiqueta="Consentimientos">
      <rect x="18" y="20" width="52" height="60" rx="5" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <g stroke={ROJO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="30" cy="36" r="6" />
        <path d="M27 36 l2.5 2.5 l4.5 -5" />
        <circle cx="30" cy="52" r="6" />
        <path d="M27 52 l2.5 2.5 l4.5 -5" />
        <circle cx="30" cy="68" r="6" />
        <path d="M27 68 l2.5 2.5 l4.5 -5" />
      </g>
      <path d="M42 36 h20 M42 52 h20 M42 68 h20" {...trazo} />
      <path d="M84 30 l18 6 v16 c0 12 -8 20 -18 24 c-10 -4 -18 -12 -18 -24 v-16 z" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M75 54 l6 6 l13 -14" fill="none" stroke={ROJO} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Destellos x={94} y={12} />
    </Lienzo>
  );
}

/** 03E2 · persona, panel con retrato, lupa y reloj (revisión PEP). */
export function IlustracionRevisionPep(props: IlustracionProps) {
  return (
    <Lienzo {...props} etiqueta="Revisión por condición PEP">
      <rect x="46" y="16" width="56" height="40" rx="4" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <rect x="52" y="22" width="16" height="16" rx="2" {...trazo} />
      <circle cx="60" cy="28" r="3.2" {...trazo} />
      <path d="M56 36 c1 -3 2 -4 4 -4 c2 0 3 1 4 4" {...trazo} />
      <path d="M74 26 h22 M74 34 h22 M74 42 h14" {...trazo} />
      <circle cx="34" cy="44" r="12" {...trazo} />
      <path d="M16 82 c2 -16 9 -24 18 -24 c6 0 11 3 14 9" {...trazo} />
      <circle cx="72" cy="66" r="12" {...trazo} />
      <path d="M81 75 l9 9" {...trazo} />
      <circle cx="94" cy="68" r="14" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <path d="M94 60 v8 l6 4" {...trazo} />
      <Destellos x={92} y={10} />
    </Lienzo>
  );
}

/** 04A1 · planilla y dos relojes (evaluación manual médica). */
export function IlustracionRevisionMedica(props: IlustracionProps) {
  return (
    <Lienzo {...props} etiqueta="Evaluación manual">
      <rect x="20" y="18" width="52" height="60" rx="4" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <path d="M30 32 h20" stroke={ROJO} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M30 42 h32 M30 52 h32 M30 62 h20" {...trazo} />
      <circle cx="74" cy="56" r="18" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.6" />
      <path d="M74 44 v12 l8 5" {...trazo} />
      <circle cx="96" cy="74" r="11" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <path d="M96 67 v7 l5 3" {...trazo} />
      <Destellos x={90} y={12} />
    </Lienzo>
  );
}

// ---------------------------------------------------------------------------
// Íconos del catálogo y de las coberturas
// ---------------------------------------------------------------------------

export interface IconoLineaProps {
  readonly tamano?: number;
  readonly className?: string;
}

function IconoLienzo({ tamano = 30, className, etiqueta, children }: IconoLineaProps & { readonly etiqueta: string; readonly children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 32 32" width={tamano} height={tamano} className={className} role="img" aria-label={etiqueta}>
      {children}
    </svg>
  );
}

const trazoIcono = { fill: "none", stroke: NAVY, strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Lazo oncológico. Encabeza el producto y la cobertura de cáncer. */
export function IconoLazo(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Oncológico">
      <path d="M16 11 c-5 6 -9 12 -5 16 c3 3 7 0 6 -5 c-1 -6 -5 -10 -10 -13" {...trazoIcono} />
      <path d="M16 11 c5 6 9 12 5 16 c-3 3 -7 0 -6 -5 c1 -6 5 -10 10 -13" {...trazoIcono} />
    </IconoLienzo>
  );
}

/** Corazón: producto Vida y cobertura de fallecimiento. */
export function IconoCorazon(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Vida">
      <path d="M16 26 c-6 -4 -11 -9 -11 -14 c0 -4 3 -6 6 -6 c2 0 4 1 5 3 c1 -2 3 -3 5 -3 c3 0 6 2 6 6 c0 5 -5 10 -11 14 z" {...trazoIcono} />
    </IconoLienzo>
  );
}

/** Persona con el brazo vendado: producto Accidentes. */
export function IconoAccidentes(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Accidentes">
      <circle cx="16" cy="8" r="4" {...trazoIcono} />
      <path d="M9 26 c0 -8 3 -12 7 -12 c4 0 7 4 7 12" {...trazoIcono} />
      <path d="M10 17 h12" {...trazoIcono} />
    </IconoLienzo>
  );
}

/** Estetoscopio: producto Salud. */
export function IconoSalud(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Salud">
      <path d="M9 5 v8 a5 5 0 0 0 10 0 v-8" {...trazoIcono} />
      <path d="M14 18 v3 a5 5 0 0 0 10 0 v-3" {...trazoIcono} />
      <circle cx="24" cy="15" r="3" {...trazoIcono} />
    </IconoLienzo>
  );
}

/** Huella de perro: producto Mascotas. */
export function IconoMascotas(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Mascotas">
      <ellipse cx="11" cy="11" rx="2.6" ry="3.4" {...trazoIcono} />
      <ellipse cx="17" cy="9" rx="2.6" ry="3.4" {...trazoIcono} />
      <ellipse cx="23" cy="12" rx="2.6" ry="3.4" {...trazoIcono} />
      <path d="M17 17 c-4 0 -7 3 -7 6 c0 2 2 3 4 3 h6 c2 0 4 -1 4 -3 c0 -3 -3 -6 -7 -6 z" {...trazoIcono} />
    </IconoLienzo>
  );
}

/** Maleta con avión: producto Viaje. */
export function IconoViaje(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Viaje">
      <rect x="6" y="13" width="20" height="13" rx="2" {...trazoIcono} />
      <path d="M12 13 v-3 h8 v3" {...trazoIcono} />
      <path d="M20 6 l6 2 l-3 3 z" {...trazoIcono} />
    </IconoLienzo>
  );
}

/** Cama de internación: renta hospitalaria. */
export function IconoCama(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Renta hospitalaria">
      <path d="M5 12 v13 M5 24 h22 v-6 c0 -3 -2 -4 -5 -4 h-17" {...trazoIcono} />
      <circle cx="11" cy="12" r="3" {...trazoIcono} />
    </IconoLienzo>
  );
}

/** Maletín médico: gastos médicos por accidente. */
export function IconoMaletinMedico(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Gastos médicos">
      <rect x="5" y="11" width="22" height="15" rx="2" {...trazoIcono} />
      <path d="M12 11 v-3 h8 v3" {...trazoIcono} />
      <path d="M16 15 v7 M12.5 18.5 h7" {...trazoIcono} />
    </IconoLienzo>
  );
}

/** Escudo con tilde: atributo «confiable» y cobertura de fallecimiento. */
export function IconoEscudo(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Protegido">
      <path d="M16 4 l10 4 v8 c0 6 -4 10 -10 12 c-6 -2 -10 -6 -10 -12 v-8 z" {...trazoIcono} />
      <path d="M11.5 15 l3.5 3.5 l6.5 -7" fill="none" stroke={ROJO} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </IconoLienzo>
  );
}

/** Mano que toca: atributo «digital». */
export function IconoDigital(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Digital">
      <path d="M14 18 v-8 a2 2 0 0 1 4 0 v10" {...trazoIcono} />
      <path d="M18 16 a2 2 0 0 1 4 0 v4 c0 4 -3 7 -7 7 c-4 0 -7 -3 -7 -7 v-3 a2 2 0 0 1 4 0" {...trazoIcono} />
      <g stroke={ROJO} strokeWidth="1.8" strokeLinecap="round">
        <path d="M8 8 l-2 -2" />
        <path d="M16 5 v-3" />
        <path d="M24 8 l2 -2" />
      </g>
    </IconoLienzo>
  );
}

/** Cronómetro con líneas de velocidad: atributo «ágil». */
export function IconoAgil(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Ágil">
      <circle cx="18" cy="18" r="9" {...trazoIcono} />
      <path d="M18 13 v5 l3 3" {...trazoIcono} />
      <path d="M15 6 h6" {...trazoIcono} />
      <g stroke={ROJO} strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 13 h5" />
        <path d="M2 18 h4" />
        <path d="M3 23 h5" />
      </g>
    </IconoLienzo>
  );
}

/** Carnet de identidad: la tarjeta de captura del frente. */
export function IconoCarnetFrente(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Frente de la cédula">
      <rect x="3" y="7" width="26" height="18" rx="2.5" {...trazoIcono} />
      <circle cx="11" cy="14" r="3.2" {...trazoIcono} />
      <path d="M7 21 c1 -2.5 2 -3.5 4 -3.5 c2 0 3 1 4 3.5" {...trazoIcono} />
      <path d="M19 13 h7 M19 18 h7" stroke={ROJO} strokeWidth="1.9" strokeLinecap="round" />
    </IconoLienzo>
  );
}

/** Carnet con código de barras: la tarjeta de captura del dorso. */
export function IconoCarnetDorso(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Dorso de la cédula">
      <rect x="3" y="7" width="26" height="18" rx="2.5" {...trazoIcono} />
      <path d="M7 12 h18" {...trazoIcono} />
      <g stroke={NAVY} strokeWidth="1.6" strokeLinecap="round">
        <path d="M7 16 v6 M10 16 v6 M13 16 v6 M16 16 v6 M19 16 v6 M22 16 v6 M25 16 v6" />
      </g>
    </IconoLienzo>
  );
}

/** Rostro dentro de un marco de enfoque: la tarjeta de la selfie. */
export function IconoSelfie(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Selfie">
      <path d="M4 11 V6 h5 M28 11 V6 h-5 M4 21 v5 h5 M28 21 v5 h-5" {...trazoIcono} />
      <circle cx="16" cy="14" r="4" {...trazoIcono} />
      <path d="M10 23 c1.5 -4 3.5 -5.5 6 -5.5 c2.5 0 4.5 1.5 6 5.5" {...trazoIcono} />
    </IconoLienzo>
  );
}

/** Documento con flecha de descarga: consentimiento de entrega digital. */
export function IconoEntregaDigital(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Entrega digital">
      <path d="M7 4 h12 l6 6 v18 h-18 z" {...trazoIcono} />
      <path d="M11 11 h7" stroke={ROJO} strokeWidth="1.9" strokeLinecap="round" />
      <path d="M11 16 h10" {...trazoIcono} />
      <circle cx="21" cy="23" r="5" {...trazoIcono} />
      <path d="M21 20 v6 M18.5 23.5 l2.5 2.5 l2.5 -2.5" {...trazoIcono} />
    </IconoLienzo>
  );
}

/** Calendario con reloj: consentimiento de inicio de cobertura y carencias. */
export function IconoCalendarioReloj(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Inicio de cobertura y carencias">
      <rect x="3" y="7" width="20" height="18" rx="2.5" {...trazoIcono} />
      <path d="M3 13 h20 M9 4 v5 M17 4 v5" {...trazoIcono} />
      <circle cx="10" cy="18" r="1.1" fill={NAVY} />
      <circle cx="15" cy="18" r="1.1" fill={NAVY} />
      <circle cx="23" cy="21" r="6.5" {...trazoIcono} fill="#FFFFFF" />
      <path d="M23 17.5 v3.5 l2.5 1.5" {...trazoIcono} />
      <g stroke={ROJO} strokeWidth="1.7" strokeLinecap="round">
        <path d="M26 6 l2 -2" />
        <path d="M29 9 l1.5 -1.5" />
      </g>
    </IconoLienzo>
  );
}

/** Persona con corbata y escudo: el intermediario y su canal de atención. */
export function IconoIntermediario(props: IconoLineaProps) {
  return (
    <IconoLienzo {...props} etiqueta="Intermediario y canal de atención">
      <circle cx="13" cy="8" r="4.5" {...trazoIcono} />
      <path d="M4 27 c0 -8 4 -13 9 -13 c5 0 9 5 9 13" {...trazoIcono} />
      <path d="M13 14 l-2 4 l2 5 l2 -5 z" {...trazoIcono} />
      <path d="M22 13 l7 2.5 v6 c0 4.5 -3 7.5 -7 9 c-4 -1.5 -7 -4.5 -7 -9 v-6 z" fill="#FFFFFF" stroke={NAVY} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M19 21 l2.5 2.5 l4.5 -5" fill="none" stroke={ROJO} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconoLienzo>
  );
}
