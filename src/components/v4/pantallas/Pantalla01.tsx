"use client";

/**
 * 01 · Portada y catálogo de productos.
 *
 * Arte: `PANTALLA_01_APROBADA_FINAL.png`. Detalle de cookies: `01A`.
 * Descripción arte por arte en `ANALISIS_VISUAL_PNG.md` §1.1 y §1.2.
 *
 * Es la única pantalla del flujo **sin stepper y con dos marcas**: todavía no
 * hay contratación, así que la aseguradora no aparece (regla de marca de
 * `screens.json`). El catálogo muestra seis productos y solo el oncológico
 * está disponible; los otros cinco no son pulsables y lo dicen con su píldora.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PRODUCTOS_01, TEXTOS_01, TEXTOS_COOKIES } from "@/domain/v4/textos-portada";
import { CabeceraV4, PieV4 } from "../MarcoV4";
import { CapaLegalV4, useCapaLegalV4 } from "../CapaLegalV4";
import { BotonPrincipalV4, BotonSecundarioV4, IconoChevronDerecha } from "../piezas";
import {
  IconoAccidentes,
  IconoAgil,
  IconoCorazon,
  IconoDigital,
  IconoEscudo,
  IconoLazo,
  IconoMascotas,
  IconoSalud,
  IconoViaje,
  IlustracionPortada,
} from "../ilustraciones";

/** Dónde se recuerda que el aviso de cookies ya se leyó. */
const CLAVE_COOKIES = "slt-v4-cookies-leidas";

const ICONOS_PRODUCTO: Record<string, React.ComponentType<{ tamano?: number }>> = {
  oncologico: IconoLazo,
  vida: IconoCorazon,
  accidentes: IconoAccidentes,
  salud: IconoSalud,
  mascotas: IconoMascotas,
  viaje: IconoViaje,
};

const ICONOS_ATRIBUTO = [IconoDigital, IconoAgil, IconoEscudo];

function Atributo({
  Icono,
  rotulo,
  pie,
}: {
  readonly Icono: React.ComponentType<{ tamano?: number }>;
  readonly rotulo: string;
  readonly pie: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 px-1 text-center">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: "#EAF2FD" }}
      >
        <Icono tamano={30} />
      </span>
      <span className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: "var(--v4-navy)" }}>
        {rotulo}
      </span>
      <span className="text-[0.8125rem]" style={{ color: "var(--v4-azul-apagado)" }}>
        {pie}
      </span>
    </div>
  );
}

function TarjetaProducto({
  id,
  nombre,
  disponible,
  alElegir,
}: {
  readonly id: string;
  readonly nombre: string;
  readonly disponible: boolean;
  readonly alElegir: () => void;
}) {
  const Icono = ICONOS_PRODUCTO[id];
  const contenido = (
    <>
      <Icono tamano={26} />
      <span className="min-w-0 flex-1">
        <span
          className="block text-[0.9375rem] font-bold leading-tight"
          style={{ color: disponible ? "var(--v4-navy)" : "var(--v4-azul-apagado)" }}
        >
          {nombre}
        </span>
        <span
          className="mt-1 inline-block rounded-full px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide"
          style={
            disponible
              ? { background: "#DCFAE6", color: "#136C33" }
              : { background: "var(--v4-gris-fondo)", color: "var(--v4-gris-texto)" }
          }
        >
          {disponible ? TEXTOS_01.etiquetaDisponible : TEXTOS_01.etiquetaProximamente}
        </span>
      </span>
      <IconoChevronDerecha tamano={18} color={disponible ? "var(--v4-azul)" : "var(--v4-gris-deshabilitado)"} />
    </>
  );

  const estilo = disponible
    ? { background: "var(--v4-azul-fondo)", borderColor: "var(--v4-azul-borde)" }
    : { background: "var(--v4-blanco)", borderColor: "var(--v4-gris-borde)" };

  if (!disponible) {
    return (
      <div
        aria-disabled="true"
        className="flex items-center gap-2 rounded-[10px] border px-2.5 py-3"
        style={estilo}
      >
        {contenido}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={alElegir}
      className="flex items-center gap-2 rounded-[10px] border px-2.5 py-3 text-left"
      style={estilo}
    >
      {contenido}
    </button>
  );
}

function Contenido() {
  const router = useRouter();
  const { abrir } = useCapaLegalV4();
  const [cookiesLeidas, setCookiesLeidas] = useState(true);

  // Se resuelve después de montar: leer `localStorage` durante el render
  // rompería la hidratación, y el banner aparecería y desaparecería.
  useEffect(() => {
    try {
      setCookiesLeidas(window.localStorage.getItem(CLAVE_COOKIES) === "si");
    } catch {
      setCookiesLeidas(false);
    }
  }, []);

  function marcarCookiesLeidas() {
    setCookiesLeidas(true);
    try {
      window.localStorage.setItem(CLAVE_COOKIES, "si");
    } catch {
      // Navegación privada o almacenamiento bloqueado: el aviso vuelve a
      // aparecer en la próxima visita, que es preferible a romper la pantalla.
    }
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--v4-blanco)" }}>
      <CabeceraV4 marcas={2} />

      <main className="mx-auto w-full max-w-[38rem] flex-1 px-4 pt-4">
        {/* Héroe */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="v4-titular">
              {TEXTOS_01.heroeTitulo}
              <br />
              <em>{TEXTOS_01.heroeTituloAcento}</em>
            </h1>
            <p className="v4-bajada mt-2">{TEXTOS_01.heroeBajada}</p>
          </div>
          <IlustracionPortada tamano={124} className="shrink-0" />
        </div>

        {/* Tres atributos, separados por filetes verticales */}
        <div className="mt-6 flex items-stretch">
          {TEXTOS_01.atributos.map((atributo, indice) => (
            <div key={atributo.rotulo} className="flex flex-1">
              {indice > 0 ? (
                <span aria-hidden="true" className="w-px shrink-0" style={{ background: "var(--v4-gris-borde)" }} />
              ) : null}
              <Atributo Icono={ICONOS_ATRIBUTO[indice]} rotulo={atributo.rotulo} pie={atributo.pie} />
            </div>
          ))}
        </div>

        {/* Onda decorativa que separa el héroe del catálogo */}
        <svg viewBox="0 0 400 24" className="mt-6 h-6 w-full" aria-hidden="true" preserveAspectRatio="none">
          <path d="M0 16 C 60 2, 120 2, 200 12 S 340 26, 400 10 L400 24 L0 24 Z" fill="#EAF2FD" />
        </svg>

        {/* Catálogo */}
        <h2 className="mt-4 text-[1.5rem] font-bold" style={{ color: "var(--v4-navy)" }}>
          {TEXTOS_01.catalogoTitulo}
        </h2>
        <p className="v4-bajada mt-1">{TEXTOS_01.catalogoBajada}</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {PRODUCTOS_01.map((producto) => (
            <TarjetaProducto
              key={producto.id}
              id={producto.id}
              nombre={producto.nombre}
              disponible={producto.disponible}
              alElegir={() => router.push("/plan")}
            />
          ))}
        </div>

        <PieV4 />

        {/* Banner de cookies: va **en el flujo**, al pie de la portada, no
            flotando. Fijo tapaba las tarjetas del catálogo, que es el
            problema que `AvisoCookies` de v2 ya documenta. */}
        {!cookiesLeidas ? (
          <div className="v4-tarjeta-azul mb-6 p-4">
            <p className="text-[0.875rem] leading-snug" style={{ color: "var(--v4-azul-apagado)" }}>
              {TEXTOS_COOKIES.cuerpo}
            </p>
            <div className="mt-3 flex gap-3">
              <BotonSecundarioV4 onClick={() => abrir("cookies")} className="v4-boton-compacto flex-[0.9]">
                {TEXTOS_COOKIES.verDetalle}
              </BotonSecundarioV4>
              <BotonPrincipalV4 onClick={marcarCookiesLeidas} className="v4-boton-compacto flex-1">
                {TEXTOS_COOKIES.aceptar}
              </BotonPrincipalV4>
            </div>
          </div>
        ) : null}
      </main>

    </div>
  );
}

export function Pantalla01() {
  return (
    <CapaLegalV4>
      <Contenido />
    </CapaLegalV4>
  );
}
