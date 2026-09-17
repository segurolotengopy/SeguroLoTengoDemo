"use client";

/**
 * El marco de toda pantalla v4: cabecera institucional, stepper de cinco
 * etapas, cuerpo y pie legal.
 *
 * **Ninguna pantalla redibuja estas tres cosas.** Es la misma regla que ya
 * regía en v2 —«Cabecera, stepper y barra de plan son componentes compartidos;
 * no los redefinas por pantalla»— y la que evita que una pantalla vuelva a
 * anunciar una etapa que no es la suya: el stepper recibe el **código de
 * pantalla**, nunca un número, y la etapa sale de `PANTALLAS_V4`.
 *
 * Sin botón de día/noche: v4 sale solo en claro (D-29).
 *
 * ## Único marco del producto (PR B, «encendido de v4», 16-sep-2026)
 *
 * Hasta acá convivían dos implementaciones: esta (`CabeceraV4`/`StepperV4`) y
 * `HeaderInstitucional`/`StepperPasos` de `components/shared` — la segunda con
 * el logo de SeguroLoTengo como PNG recortado del arte, `indicador` como slot
 * de contenido libre, y el stepper resuelto por **slug de ruta** vía
 * `etapaDePaso()` (`domain/rutas-flujo.ts`). Se decidió esta (`CabeceraV4` +
 * `StepperV4`) como la única, por dos motivos, los dos con evidencia:
 *
 * 1. **El logo.** `ANALISIS_VISUAL_PNG.md` §0.2-0.3 describe el logotipo con
 *    precisión vectorial —«las dos O son anteojos rojos unidos por un puente,
 *    con la L adentro», navy `#071F78` exacto, `canal digital` al 40 % del
 *    tamaño con tracking abierto— que un recorte de PNG no puede sostener a
 *    cualquier resolución ni cuando la marca ajuste un color. El propio
 *    `HeaderInstitucional` documentaba su logo como «provisional […]
 *    reemplazar por el SVG oficial en cuanto Interseguros lo mande»: ese
 *    reemplazo es este, dibujado a mano siguiendo la misma descripción del
 *    arte que ya estaba escrita en el análisis visual.
 * 2. **El stepper.** CLAUDE.md exige que el stepper reciba el **código de
 *    pantalla**, nunca un slug ni un número — es literalmente la regla que
 *    `rutas-flujo.ts` cita como el origen del bug «Paso 7 de 7». `StepperV4`
 *    ya cumple eso por diseño (`codigo: CodigoPantallaV4`); el otro dependía
 *    de un mapeo de rutas del flujo de 8 pasos que v4 no tiene.
 *
 * Las páginas del flujo (`components/v4/pantallas/**`) montan `MarcoV4`. Las
 * páginas **fuera** del flujo que no tienen una `CodigoPantallaV4` propia
 * —`/solicitud-vencida`, `/asistencia-identidad`, `/verificar`,
 * `/admin-consola`, `/demo-panel`, `/design-system`, `/privacidad`,
 * `/retracto`— montan `CabeceraV4` y `PieV4` sueltos dentro de `CapaLegalV4`
 * (sin forzar un código de pantalla que no les corresponde) y, si necesitan un
 * indicador propio, usan `IndicadorFueraDeFlujoV4` en vez de inventar un badge
 * por página.
 *
 * `HeaderInstitucional`, `StepperPasos` y `PieLegal` de `components/shared`
 * se borraron con el flujo de 8 pasos el 16-sep-2026: este es el único marco.
 * La identificación regulatoria completa que llevaba `PieLegal` (razón
 * social, actividad, Matrícula SIS N.º 118; CMP-01) vive en la capa
 * «Responsabilidades» de `CapaLegalV4`, accesible desde el menú y desde el pie
 * de todas las pantallas.
 */

import { ETAPAS_V4, TOTAL_ETAPAS_V4, pantallaPorCodigoV4 } from "@/domain/v4/etapas";
import type { CodigoPantallaV4, NumeroEtapaV4 } from "@/domain/v4/etapas";
import { CapaLegalV4, useCapaLegalV4 } from "./CapaLegalV4";
import { LogoSeguroLoTengo, MarcaAlianza, MarcaInterseguros } from "./marcas-v4";

/** Rótulo bajo cada marca, en versalitas pequeñas. */
function RotuloMarca({ children }: { readonly children: React.ReactNode }) {
  return (
    <span
      className="mt-1 block truncate text-center text-[0.5rem] font-bold tracking-[0.06em]"
      style={{ color: "var(--v4-azul-apagado)" }}
    >
      {children}
    </span>
  );
}

function SeparadorVertical() {
  return <span aria-hidden="true" className="h-10 w-px shrink-0" style={{ background: "var(--v4-gris-borde)" }} />;
}

/**
 * Cabecera institucional, en sus dos variantes.
 *
 * `marcas={2}` en la portada y sus modales; `marcas={3}` desde que empieza la
 * contratación. No es una decisión estética: `screens.json` lo fija como regla
 * de marca (`cover_brands` / `contracting_brands`), y lo que cambia entre una
 * y otra es **quién asume el riesgo de lo que la persona está por hacer**.
 */
export function CabeceraV4({ marcas = 3 }: { readonly marcas?: 2 | 3 }) {
  const { abrir } = useCapaLegalV4();
  return (
    <header>
      <div
        className="flex items-center gap-3 px-4 py-2"
        style={{ background: marcas === 3 ? "#EEF2F8" : "var(--v4-blanco)" }}
      >
        <button
          type="button"
          onClick={() => abrir("menu")}
          aria-label="Abrir el menú"
          className="flex h-10 w-10 shrink-0 items-center justify-center"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M3 6.5 h18 M3 12 h18 M3 17.5 h18" stroke="var(--v4-navy)" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Rejilla y no `justify-around`: las tres marcas tienen anchos muy
            distintos y el reparto automático dejaba el logotipo —que es el más
            ancho— comprimido hasta partir «canal digital» en dos líneas. Las
            fracciones son las proporciones del arte. */}
        <div
          className="grid min-w-0 flex-1 items-center gap-2"
          style={{
            gridTemplateColumns:
              marcas === 3 ? "1.45fr auto 1.15fr auto 1.15fr" : "1.6fr auto 1fr",
          }}
        >
          <div className="min-w-0">
            <LogoSeguroLoTengo alto={22} className="mx-auto block h-auto w-full max-w-[9.5rem]" />
            <RotuloMarca>canal digital</RotuloMarca>
          </div>

          <SeparadorVertical />

          <div className="min-w-0">
            <MarcaInterseguros alto={26} className="mx-auto block h-auto w-full max-w-[6.5rem]" />
            <RotuloMarca>intermediario</RotuloMarca>
          </div>

          {marcas === 3 ? (
            <>
              <SeparadorVertical />
              <div className="min-w-0">
                <MarcaAlianza alto={26} className="mx-auto block h-auto w-full max-w-[7rem]" />
                <RotuloMarca>aseguradora</RotuloMarca>
              </div>
            </>
          ) : null}
        </div>
      </div>
      {/* El filete rojo aparece recién con la contratación: la portada no lo lleva. */}
      {marcas === 3 ? <div className="v4-filete-rojo" /> : null}
    </header>
  );
}

/**
 * Stepper de cinco etapas.
 *
 * Recibe el **código de pantalla**, no un número: así ninguna pantalla puede
 * afirmar una etapa distinta de la que declara `PANTALLAS_V4`. Es literalmente
 * el bug que v2 documenta —«así es como la pantalla de firma llegó a anunciar
 * Paso 7 de 7»— y la razón por la que el arte de 03E2 dice `4 de 5` cuando
 * corresponde `3 de 5`.
 */
export function StepperV4({ codigo }: { readonly codigo: CodigoPantallaV4 }) {
  const pantalla = pantallaPorCodigoV4(codigo);
  const etapa: NumeroEtapaV4 | null = pantalla?.etapa ?? null;
  if (etapa === null) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <ol className="flex flex-1 items-center" aria-label={`Etapa ${etapa} de ${TOTAL_ETAPAS_V4}`}>
        {ETAPAS_V4.map((unaEtapa, indice) => {
          const alcanzada = unaEtapa.numero <= etapa;
          return (
            <li key={unaEtapa.numero} className="flex flex-1 items-center last:flex-none">
              <span
                aria-current={unaEtapa.numero === etapa ? "step" : undefined}
                title={unaEtapa.titulo}
                className="block shrink-0 rounded-full"
                style={{
                  width: alcanzada ? 13 : 11,
                  height: alcanzada ? 13 : 11,
                  background: alcanzada ? "var(--v4-rojo)" : "#D5DCE8",
                }}
              />
              {indice < ETAPAS_V4.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="h-0.5 flex-1"
                  style={{ background: unaEtapa.numero < etapa ? "var(--v4-rojo)" : "#D5DCE8" }}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <span className="shrink-0 text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
        {etapa} de {TOTAL_ETAPAS_V4}
      </span>
    </div>
  );
}

/**
 * Indicador de las páginas que quedan fuera de las cinco etapas del flujo:
 * no tienen `CodigoPantallaV4` propio porque no son una de las doce pantallas
 * del handoff — `/asistencia-identidad` y `/solicitud-vencida` son decisión de
 * producto (ver sus páginas), sin arte ni fila en la matriz de cumplimiento.
 *
 * No es un componente del arte —los 103 PNG no dibujan una pantalla fuera del
 * flujo—: reproduce, con los tokens de v4 (navy/rojo), el mismo patrón visual
 * con el que la v2 `StepperPasos` resolvía sus variantes `p0` / `pantalla-a` /
 * `pantalla-b` (rótulo corto + detalle en versalitas, alineados a la derecha),
 * para que estas páginas compartan cabecera con el resto sin inventar un
 * elemento nuevo.
 */
export function IndicadorFueraDeFlujoV4({
  titulo,
  detalle,
  tono = "alerta",
}: {
  readonly titulo: string;
  readonly detalle?: string;
  readonly tono?: "alerta" | "neutral";
}) {
  const color = tono === "alerta" ? "var(--v4-rojo)" : "var(--v4-azul-apagado)";
  return (
    <div className="px-4 py-3 text-right leading-tight">
      <p className="text-sm font-bold" style={{ color: tono === "alerta" ? color : "var(--v4-navy)" }}>
        {titulo}
      </p>
      {detalle ? (
        <p className="text-[0.6875rem] font-semibold tracking-wide uppercase" style={{ color }}>
          {detalle}
        </p>
      ) : null}
    </div>
  );
}

/** Enlace `Información legal`, centrado, al pie de todas las pantallas. */
export function PieV4() {
  const { abrir } = useCapaLegalV4();
  return (
    <footer className="py-8 text-center">
      <button type="button" onClick={() => abrir("legal")} className="v4-enlace text-[0.9375rem]">
        Información legal
      </button>
    </footer>
  );
}

export interface MarcoV4Props {
  readonly codigo: CodigoPantallaV4;
  /** La portada va con dos marcas; el resto, con tres. */
  readonly marcas?: 2 | 3;
  readonly children: React.ReactNode;
}

/**
 * Compone el marco entero. Toda pantalla v4 empieza por acá.
 *
 * El ancho máximo es de 38 rem y no del ancho completo: v4 es una web app
 * responsiva (D-30) y en escritorio una columna de formulario a 1.900 px es
 * ilegible. Las pantallas que ponen componentes lado a lado en escritorio lo
 * hacen dentro de este ancho.
 */
export function MarcoV4({ codigo, marcas = 3, children }: MarcoV4Props) {
  return (
    <CapaLegalV4>
      <div className="flex min-h-dvh flex-col" style={{ background: "var(--v4-blanco)" }}>
        <CabeceraV4 marcas={marcas} />
        <StepperV4 codigo={codigo} />
        {/* D-30 · celular: la columna del arte (38 rem). Escritorio (`lg`):
            72 rem, y cada pantalla reparte ese ancho con `DisposicionV4` /
            `RejillaV4` (`disposicion.tsx`) — el marco solo da el lienzo. */}
        <main className="mx-auto w-full max-w-[38rem] flex-1 px-4 pb-6 lg:max-w-[72rem] lg:px-8 lg:pt-4">
          {children}
        </main>
        <div className="mx-auto w-full max-w-[38rem] px-4 lg:max-w-[72rem] lg:px-8">
          <PieV4 />
        </div>
      </div>
    </CapaLegalV4>
  );
}
