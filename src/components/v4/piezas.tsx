"use client";

/**
 * Las piezas que se repiten en las 15 pantallas de v4.
 *
 * Están acá y no en cada pantalla por la razón que el propio handoff dejó a la
 * vista: la mitad de las inconsistencias del arte —el botón deshabilitado gris
 * en una pantalla y rojo pálido en otra, la casilla marcada navy en 03A y roja
 * en 03B— existen porque se dibujaron dos veces. Un componente por pieza hace
 * que esa divergencia no se pueda volver a escribir.
 *
 * Inventario y procedencia de cada una: `ANALISIS_VISUAL_PNG.md` §10.
 */

import { useId, useState } from "react";

// ---------------------------------------------------------------------------
// Íconos
// ---------------------------------------------------------------------------

/** ⓘ circular. Azul en los avisos informativos; rojo en 04A, 04D y 03E_15. */
export function IconoInfo({ tamano = 26, color = "var(--v4-azul)" }: { readonly tamano?: number; readonly color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke={color} strokeWidth="1.6" />
      <circle cx="12" cy="7.4" r="1.25" fill={color} />
      <path d="M12 10.6 v7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** ❗ circular, rojo. Encabeza todo aviso de error del flujo. */
export function IconoAlerta({ tamano = 26 }: { readonly tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="var(--v4-rojo)" strokeWidth="1.6" />
      <path d="M12 6.5 v7.5" stroke="var(--v4-rojo)" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="17.2" r="1.3" fill="var(--v4-rojo)" />
    </svg>
  );
}

/** ✓ blanco sobre disco pleno. Verde en los éxitos, navy en la identidad de 03D. */
export function IconoTildeDisco({
  tamano = 26,
  color = "var(--v4-verde)",
}: {
  readonly tamano?: number;
  readonly color?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="11" fill={color} />
      <path
        d="M6.8 12.4 L10.4 15.9 L17.2 8.6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** ✕ dentro de un círculo rojo de contorno grueso (03D_13, 03E2B). */
export function IconoCruzGrande({ tamano = 110 }: { readonly tamano?: number }) {
  return (
    <svg viewBox="0 0 120 120" width={tamano} height={tamano} aria-hidden="true">
      <circle cx="60" cy="60" r="52" fill="var(--v4-rojo-fondo)" stroke="var(--v4-rojo)" strokeWidth="4" />
      <path
        d="M40 40 L80 80 M80 40 L40 80"
        stroke="var(--v4-rojo)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Reloj de contorno, para los hitos «En revisión». */
export function IconoReloj({ tamano = 22, color = "var(--v4-navy)" }: { readonly tamano?: number; readonly color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="1.7" />
      <path d="M12 6.8 V12 l3.6 2.2" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Lápiz de edición, pegado al borde derecho de los campos editables. */
export function IconoLapiz({ tamano = 18 }: { readonly tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true">
      <path
        d="M4 20 l4.2-1.1 10-10a2.1 2.1 0 0 0 0-3l-.1-.1a2.1 2.1 0 0 0-3 0l-10 10z"
        fill="var(--v4-navy)"
      />
    </svg>
  );
}

/** Candado cerrado: el tipo de documento de 03D, que no se edita. */
export function IconoCandado({ tamano = 18 }: { readonly tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" fill="none" stroke="var(--v4-navy)" strokeWidth="1.8" />
      <path d="M8 10.5 V7.8 a4 4 0 0 1 8 0 v2.7" fill="none" stroke="var(--v4-navy)" strokeWidth="1.8" />
    </svg>
  );
}

/** Chevrón ⌄ de los selectores. */
export function IconoChevron({ tamano = 20 }: { readonly tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true">
      <path d="M6 9.5 L12 15.5 L18 9.5" fill="none" stroke="var(--v4-navy)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Chevrón › de las filas pulsables. */
export function IconoChevronDerecha({ tamano = 20, color = "var(--v4-gris-texto)" }: { readonly tamano?: number; readonly color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" className="shrink-0">
      <path d="M9.5 6 L15.5 12 L9.5 18" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Lupa del campo de búsqueda de las hojas de selección. */
export function IconoLupa({ tamano = 20 }: { readonly tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" className="shrink-0">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="var(--v4-azul-apagado)" strokeWidth="1.9" />
      <path d="M15.4 15.4 L20 20" stroke="var(--v4-azul-apagado)" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

/** Ícono de WhatsApp de contorno, para el botón de envío del código. */
export function IconoWhatsApp({ tamano = 22 }: { readonly tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" className="shrink-0">
      <path
        d="M12 3.2a8.7 8.7 0 0 0-7.4 13.2L3.4 20.8l4.5-1.2A8.7 8.7 0 1 0 12 3.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.3c.3-.1.6 0 .8.3l.7 1.2c.1.3.1.6-.1.8l-.4.4c-.1.2-.2.4 0 .7.4.7 1.1 1.4 1.9 1.8.3.1.5.1.7-.1l.4-.4c.2-.2.5-.2.8-.1l1.2.7c.3.2.4.5.3.8-.2.7-.9 1.2-1.7 1.2-2.6 0-5.6-3-5.6-5.6 0-.8.5-1.5 1-1.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

export interface AvisoProps {
  /** Título en versalitas. Sin él, el aviso es una sola línea con ícono. */
  readonly titulo?: string;
  /** El ⓘ de 04A, 04D y 03E_15 es **rojo** aunque el aviso sea azul. */
  readonly iconoRojo?: boolean;
  readonly children: React.ReactNode;
  readonly className?: string;
}

export function AvisoAzulV4({ titulo, iconoRojo = false, children, className = "" }: AvisoProps) {
  return (
    <div className={`v4-aviso-azul flex gap-3 p-4 ${className}`}>
      <IconoInfo color={iconoRojo ? "var(--v4-rojo)" : "var(--v4-azul)"} />
      <div className="min-w-0 text-[0.9375rem] leading-snug">
        {titulo ? (
          <p className="mb-1 font-bold uppercase tracking-wide" style={{ color: "var(--v4-navy)" }}>
            {titulo}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function AvisoRojoV4({ titulo, children, className = "" }: Omit<AvisoProps, "iconoRojo">) {
  return (
    <div className={`v4-aviso-rojo flex gap-3 p-4 ${className}`} role="alert">
      <IconoAlerta />
      <div className="min-w-0 text-[0.9375rem] leading-snug">
        {titulo ? (
          <p className="mb-1 font-bold uppercase tracking-wide" style={{ color: "var(--v4-rojo)" }}>
            {titulo}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/** Franja verde de éxito: ✓ en disco pleno y texto en verde negrita (03A). */
export function FranjaVerdeV4({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="v4-aviso-verde flex items-center gap-3 p-4" role="status">
      <IconoTildeDisco />
      <p className="text-[0.9375rem] font-bold leading-snug">{children}</p>
    </div>
  );
}

/**
 * Franja de error de dos líneas, **sin ícono** (03D_10, 03D_11, 03E_16 a 18).
 *
 * Es distinta del `AvisoRojoV4` a propósito: el arte la dibuja sin ícono y con
 * las dos líneas en negrita, y aparece al pie del formulario, no junto al
 * campo. El mensaje del campo va aparte, en `ErrorDeCampoV4`.
 */
export function FranjaErrorV4({
  titulo,
  indicacion,
}: {
  readonly titulo: string;
  readonly indicacion: string;
}) {
  return (
    <div className="v4-aviso-rojo px-4 py-3" role="alert">
      <p className="text-[0.875rem] font-bold uppercase" style={{ color: "var(--v4-rojo)" }}>
        {titulo}
      </p>
      <p className="text-[0.875rem] font-bold" style={{ color: "var(--v4-rojo)" }}>
        {indicacion}
      </p>
    </div>
  );
}

/** Mensaje rojo bajo un campo, con su punto. */
export function ErrorDeCampoV4({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="v4-error-campo" role="alert">
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--v4-rojo)" }} />
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------

export interface BotonV4Props {
  readonly children: React.ReactNode;
  readonly onClick?: () => void;
  readonly type?: "button" | "submit";
  readonly disabled?: boolean;
  /** Muestra el anillo de carga y bloquea el botón. */
  readonly cargando?: boolean;
  /** El anillo va a la izquierda salvo en 03C, donde el arte lo pone a la derecha. */
  readonly anilloALaDerecha?: boolean;
  readonly icono?: React.ReactNode;
  readonly className?: string;
}

export function BotonPrincipalV4({
  children,
  onClick,
  type = "button",
  disabled = false,
  cargando = false,
  anilloALaDerecha = false,
  icono,
  className = "",
}: BotonV4Props) {
  const anillo = cargando ? <span className="v4-anillo" aria-hidden="true" /> : null;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={`v4-boton v4-boton-principal ${className}`}
    >
      {!anilloALaDerecha ? anillo : null}
      {icono && !cargando ? icono : null}
      <span>{children}</span>
      {anilloALaDerecha ? anillo : null}
    </button>
  );
}

export function BotonSecundarioV4({
  children,
  onClick,
  type = "button",
  disabled = false,
  className = "",
}: Omit<BotonV4Props, "cargando" | "anilloALaDerecha" | "icono">) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`v4-boton v4-boton-secundario ${className}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Controles de formulario
// ---------------------------------------------------------------------------

/**
 * Casilla de consentimiento.
 *
 * **Marcada va navy**, en las tres pantallas que la usan. El arte la dibuja
 * navy en 03A y roja en 03B; es una inconsistencia del arte y se resuelve con
 * un solo componente (`ANALISIS_VISUAL_PNG.md` §11, fila 5). Se elige navy
 * porque el rojo del producto es el de la acción principal, y una casilla no
 * es una acción.
 */
export function CasillaConsentimientoV4({
  marcada,
  alCambiar,
  children,
  id,
}: {
  readonly marcada: boolean;
  readonly alCambiar: (valor: boolean) => void;
  readonly children: React.ReactNode;
  readonly id?: string;
}) {
  const generado = useId();
  const idCasilla = id ?? generado;
  return (
    <div className="flex items-start gap-3">
      <input
        id={idCasilla}
        type="checkbox"
        checked={marcada}
        onChange={(evento) => alCambiar(evento.target.checked)}
        className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded-md border"
        style={{
          accentColor: "var(--v4-navy)",
          borderColor: marcada ? "var(--v4-navy)" : "var(--v4-gris-borde)",
        }}
      />
      <label htmlFor={idCasilla} className="cursor-pointer text-[0.9375rem] leading-snug">
        {children}
      </label>
    </div>
  );
}

/**
 * El par SÍ / NO de las declaraciones (04A) y de la condición PEP (03E).
 *
 * Seleccionado, el botón se pinta **navy pleno con texto blanco**: así lo
 * dibuja 03E_14 y 03E_15, que son los únicos artes donde aparece elegido.
 */
export function ParSiNoV4({
  valor,
  alElegir,
  etiquetaAccesible,
}: {
  readonly valor: boolean | null;
  readonly alElegir: (valor: boolean) => void;
  readonly etiquetaAccesible: string;
}) {
  function boton(rotulo: string, esSi: boolean) {
    const elegido = valor === esSi;
    return (
      <button
        type="button"
        onClick={() => alElegir(esSi)}
        aria-pressed={elegido}
        className="min-w-[4.5rem] rounded-lg border px-4 py-3 text-[0.9375rem] font-bold uppercase transition-colors"
        style={{
          background: elegido ? "var(--v4-navy)" : "var(--v4-blanco)",
          borderColor: elegido ? "var(--v4-navy)" : "var(--v4-azul-borde)",
          color: elegido ? "var(--v4-blanco)" : "var(--v4-navy)",
        }}
      >
        {rotulo}
      </button>
    );
  }
  return (
    <div className="flex shrink-0 gap-2" role="group" aria-label={etiquetaAccesible}>
      {boton("SÍ", true)}
      {boton("NO", false)}
    </div>
  );
}

export interface CampoTextoV4Props {
  readonly etiqueta: string;
  readonly valor: string;
  readonly alCambiar?: (valor: string) => void;
  readonly marcador?: string;
  readonly error?: string | null;
  readonly bloqueado?: boolean;
  readonly deshabilitado?: boolean;
  /** Muestra la marca `EDITADO` a la derecha de la etiqueta (03D_09). */
  readonly editado?: boolean;
  readonly inputMode?: "text" | "numeric" | "email" | "tel";
  readonly autoComplete?: string;
  readonly maxLength?: number;
  readonly obligatorioConAsterisco?: boolean;
}

/**
 * Campo de texto con etiqueta arriba y el ícono a la derecha.
 *
 * El ícono dice qué se puede hacer con el campo: **lápiz** si es editable,
 * **candado** si no. Es la convención que v2 ya tenía en P5 y que v4 conserva.
 */
export function CampoTextoV4({
  etiqueta,
  valor,
  alCambiar,
  marcador,
  error = null,
  bloqueado = false,
  deshabilitado = false,
  editado = false,
  inputMode = "text",
  autoComplete,
  maxLength,
  obligatorioConAsterisco = false,
}: CampoTextoV4Props) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="v4-etiqueta">
          {etiqueta}
          {obligatorioConAsterisco ? <span style={{ color: "var(--v4-rojo)" }}>*</span> : null}
        </label>
        {editado ? (
          <span className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: "var(--v4-navy)" }}>
            Editado
          </span>
        ) : null}
      </div>
      <div className="relative">
        <input
          id={id}
          value={valor}
          onChange={(evento) => alCambiar?.(evento.target.value)}
          placeholder={marcador}
          readOnly={bloqueado || !alCambiar}
          disabled={deshabilitado}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          className={`v4-campo ${bloqueado ? "v4-campo-bloqueado" : ""} ${error ? "v4-campo-error" : ""}`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          {bloqueado ? <IconoCandado /> : deshabilitado ? null : <IconoLapiz />}
        </span>
      </div>
      {error ? <ErrorDeCampoV4>{error}</ErrorDeCampoV4> : null}
    </div>
  );
}

/**
 * Selector: muestra el valor elegido y abre una hoja o un desplegable.
 *
 * No usa `<select>` nativo. El arte dibuja dos comportamientos distintos —el
 * panel en línea de 03D_01 y 03D_02, y la hoja inferior con buscador de
 * 03D_03 a 03D_06— y el nativo no puede dar ninguno de los dos: ni el
 * buscador con su contador de opciones, ni el panel que empuja la rejilla.
 */
export function SelectorV4({
  etiqueta,
  valor,
  marcador = "Elegí una opción",
  alAbrir,
  error = null,
  deshabilitado = false,
  obligatorioConAsterisco = false,
  abierto = false,
}: {
  readonly etiqueta: string;
  readonly valor: string | null;
  readonly marcador?: string;
  readonly alAbrir: () => void;
  readonly error?: string | null;
  readonly deshabilitado?: boolean;
  readonly obligatorioConAsterisco?: boolean;
  readonly abierto?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="v4-etiqueta">
        {etiqueta}
        {obligatorioConAsterisco ? <span style={{ color: "var(--v4-rojo)" }}>*</span> : null}
      </label>
      <button
        id={id}
        type="button"
        onClick={alAbrir}
        disabled={deshabilitado}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        // `aria-invalid` no aplica al rol `button`: el error se anuncia por el
        // mensaje de abajo, que va con `role="alert"`.
        data-invalido={error ? "si" : undefined}
        className={`v4-campo flex items-center justify-between ${error ? "v4-campo-error" : ""} ${deshabilitado ? "v4-campo-bloqueado" : ""}`}
        style={{
          paddingRight: "0.75rem",
          color: valor ? "var(--v4-navy)" : "var(--v4-gris-texto)",
          ...(abierto ? { borderColor: "var(--v4-navy)", boxShadow: "0 0 0 1px var(--v4-navy)" } : {}),
        }}
      >
        <span className="truncate">{valor ?? marcador}</span>
        <IconoChevron />
      </button>
      {error ? <ErrorDeCampoV4>{error}</ErrorDeCampoV4> : null}
    </div>
  );
}

/**
 * Lista de opciones de una hoja de selección, con buscador opcional y el
 * contador que el arte imprime al pie (`195 opciones disponibles`).
 */
export function ListaDeOpcionesV4({
  opciones,
  conBuscador,
  marcadorBusqueda,
  alElegir,
}: {
  readonly opciones: readonly string[];
  readonly conBuscador: boolean;
  readonly marcadorBusqueda?: string;
  readonly alElegir: (opcion: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const normalizar = (texto: string) =>
    texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtradas = busqueda.trim()
    ? opciones.filter((opcion) => normalizar(opcion).includes(normalizar(busqueda)))
    : opciones;

  return (
    <div className="flex h-full flex-col">
      {conBuscador ? (
        <div className="relative mb-2">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <IconoLupa />
          </span>
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder={marcadorBusqueda}
            aria-label={marcadorBusqueda}
            className="v4-campo"
            style={{ background: "var(--v4-gris-fondo)", paddingLeft: "2.5rem" }}
          />
        </div>
      ) : null}
      <ul className="flex-1" role="listbox">
        {filtradas.map((opcion) => (
          <li key={opcion}>
            <button
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => alElegir(opcion)}
              className="w-full border-b px-1 py-4 text-left text-[1rem]"
              style={{ borderColor: "var(--v4-gris-borde)", color: "var(--v4-navy)" }}
            >
              {opcion}
            </button>
          </li>
        ))}
        {filtradas.length === 0 ? (
          <li className="px-1 py-4 text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
            No hay opciones que coincidan con la búsqueda.
          </li>
        ) : null}
      </ul>
      <p className="py-4 text-center text-[0.8125rem]" style={{ color: "var(--v4-azul)" }}>
        {opciones.length} opciones disponibles
      </p>
    </div>
  );
}
