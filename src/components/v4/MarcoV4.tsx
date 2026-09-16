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
        <main className="mx-auto w-full max-w-[38rem] flex-1 px-4 pb-6">{children}</main>
        <div className="mx-auto w-full max-w-[38rem] px-4">
          <PieV4 />
        </div>
      </div>
    </CapaLegalV4>
  );
}
