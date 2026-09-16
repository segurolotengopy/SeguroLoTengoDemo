import type { ReactNode } from "react";
import Link from "next/link";
import { ALIANZA, INTERSEGUROS } from "@/domain/entidades";

/**
 * Cabecera v4, en el formato del handoff de pantallas del 14-sep-2026
 * (D-28): tres marcas —SeguroLoTengo, Interseguros, Alianza— separadas por
 * filetes verticales, sobre una franja clara, con una línea roja al pie
 * (manual funcional p. 6, "Línea gráfica congelada"; `PANTALLA_02_…` y
 * `PANTALLA_03A_…APROBADA_FINAL.png`). Debajo de la línea va el slot
 * `indicador` —el stepper de 5 etapas (`StepperPasos`, D-36)— como una banda
 * propia a todo el ancho, tal como lo dibuja el arte.
 *
 * ## Lo que cambió respecto de la cabecera anterior
 *
 * - **Sin botón de día/noche** (D-29): la primera fase de v4 sale solo en
 *   tema claro. `ToggleTema` se conserva como componente para cuando se
 *   retome el oscuro, pero ya no se monta acá.
 * - **Sin la línea de razón social + matrícula por entidad** que llevaba la
 *   cabecera anterior (CMP-01): el arte v4 dibuja solo el isologo y un
 *   rótulo corto ("intermediario", "aseguradora"). La identificación
 *   regulatoria completa (razón social, actividad, Matrícula SIS N° 118) no
 *   desaparece: sigue viviendo en `PieLegal`, que está en **todas** las
 *   pantallas — la norma pide que esté visible y permanente, no que esté en
 *   la cabecera.
 * - **Sin ícono de menú hamburguesa.** El arte lo dibuja a la izquierda del
 *   logo de SeguroLoTengo y abre la pantalla 01B (menú lateral: Inicio,
 *   Responsabilidades, Contacto), que está fuera de este alcance. Un ícono
 *   sin comportamiento detrás es peor que ningún ícono: se omite hasta que
 *   01B se implemente.
 *
 * Puramente presentacional: no decide qué mostrar en el slot ni conoce el
 * estado del expediente.
 */
export interface HeaderInstitucionalProps {
  /** Indicador de paso de la pantalla actual (`<StepperPasos />` u otro contenido). */
  indicador?: ReactNode;
  className?: string;
}

/** Filete vertical entre marcas, como en el arte. Puramente decorativo. */
function Filete({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`h-8 w-px shrink-0 bg-borde-sutil sm:h-9 ${className}`}
    />
  );
}

/**
 * El logo de SeguroLoTengo es un recorte del arte aprobado, **provisional**:
 * reemplazar por `public/marca/seguro-lo-tengo-provisional.png` → el SVG
 * oficial en cuanto Interseguros lo mande (pendiente #4 de
 * `ANALISIS.md` §7, "A Rodrigo"). El archivo ya trae "canal digital" impreso
 * debajo del nombre, así que no lleva rótulo aparte.
 */
function MarcaSeguroLoTengo() {
  return (
    <Link href="/" className="flex shrink-0 items-center" aria-label="SeguroLoTengo — inicio">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo provisional en public/, sin dominio remoto que configurar */}
      <img
        src="/marca/seguro-lo-tengo-provisional.png"
        alt="seguroLOtengo · canal digital"
        width={440}
        height={114}
        className="h-8 w-auto sm:h-9"
      />
    </Link>
  );
}

/**
 * Interseguros o Alianza: isologo/logo de `public/marca/` (SVG) más el
 * rótulo corto del arte ("intermediario", "aseguradora") debajo. Enlaza al
 * sitio oficial de la entidad (TRV-04): es lo que le permite a la persona
 * comprobar que la empresa existe y es quien dice ser.
 */
function MarcaEntidad({
  href,
  src,
  alt,
  rotulo,
  className = "",
}: {
  href: string;
  src: string;
  alt: string;
  rotulo: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={`flex shrink-0 flex-col items-start gap-0.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v4-azul ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- logos locales en public/, sin dominio remoto que configurar */}
      <img src={src} alt={alt} className="h-6 w-auto sm:h-7" />
      <span className="text-[9px] font-bold tracking-wide text-v4-atenuado uppercase sm:text-[10px]">
        {rotulo}
      </span>
    </a>
  );
}

export function HeaderInstitucional({
  indicador,
  className = "",
}: HeaderInstitucionalProps) {
  return (
    <header className={`w-full bg-v4-header-bg ${className}`}>
      <div className="mx-auto flex w-full max-w-pantalla items-center gap-2.5 overflow-x-auto px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
        <MarcaSeguroLoTengo />
        <Filete />
        <MarcaEntidad
          href={INTERSEGUROS.sitioWeb}
          src="/marca/interseguros-logo.svg"
          alt={INTERSEGUROS.razonSocial}
          rotulo="Intermediario"
        />
        <Filete />
        <MarcaEntidad
          href={ALIANZA.sitioWeb}
          src="/marca/alianza-logo.svg"
          alt={ALIANZA.razonSocial}
          rotulo="Aseguradora"
        />
      </div>

      {/* Línea roja al pie de la cabecera (manual v4 p. 6). */}
      <div aria-hidden="true" className="h-[3px] w-full bg-v4-rojo" />

      {indicador ? (
        <div className="w-full bg-fondo">
          <div className="mx-auto w-full max-w-pantalla px-4 py-3 sm:px-6">{indicador}</div>
        </div>
      ) : null}
    </header>
  );
}
