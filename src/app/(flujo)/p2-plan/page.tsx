import type { Metadata } from "next";
import Link from "next/link";
import { EnlaceAclaracion, HeaderInstitucional, StepperPasos } from "@/components/shared";
import { REGISTRO_PRODUCTO } from "@/domain/catalogo";
import { SelectorDePlanes } from "./SelectorDePlanes";

/**
 * P2 · Paso 2 de 9 — Selección de plan.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P2 · Paso 2 de 9 —
 * Selección de plan". Textos y bloques informativos salen de ahí; los
 * importes y coberturas de los tres planes NO están acá: viven en la tabla
 * versionada `src/domain/catalogo.ts` y los renderiza `SelectorDePlanes`.
 *
 * Todo lo estático se renderiza en el servidor; lo único que baja como
 * componente de cliente es el selector, que es la parte con estado.
 */

export const metadata: Metadata = {
  title: "Elegí tu plan · SeguroLoTengo",
  description:
    "Paso 2 de 9: selección del plan del Seguro de Vida Oncológico CONFÍO. Todavía no se contrata ni se firma.",
};

const BLOQUES_INFORMATIVOS = [
  {
    titulo: "Carencias",
    detalle: "180 días cáncer · 30 días renta hospitalaria · 1 día demás coberturas.",
  },
  {
    titulo: "Edades",
    detalle:
      "Ingreso de 18 a 64 años; permanencia hasta los 65 años; hasta los 75 con diez años continuos antes de cumplir 65.",
  },
  {
    titulo: "Pago de beneficios",
    detalle:
      "Cáncer: dentro de 5 días hábiles desde la presentación completa del reclamo. Accidente: por reembolso contra facturas y comprobantes, hasta la suma asegurada.",
  },
  {
    titulo: "Hospitalización e inicio",
    detalle:
      "Renta fija por cada 24 horas continuas; 15 días acumulables por año de vigencia; la cobertura empieza 24 horas después del pago, una vez completada la contratación.",
  },
] as const;

function BandaEncabezado() {
  return (
    <div className="w-full border-b border-borde-tenue bg-superficie">
      <div className="mx-auto flex w-full max-w-pantalla flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <p className="text-sm font-bold tracking-wide text-titulo uppercase">
          SeguroLoTengo.com
        </p>
        <p className="text-xs font-semibold text-verde-700 sm:text-right dark:text-verde-300">
          WhatsApp verificado ·{" "}
          <span className="text-cuerpo">Marca y canal digital de Interseguros S.A.</span>
        </p>
      </div>
    </div>
  );
}

export default function PantallaP2Plan() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos pasoActual={2} />} />
      <BandaEncabezado />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        {/* CHG-03 · identificación del producto registrado. La Res. SS.SG.
            215/17 pide el código del plan, su acto administrativo y la URL del
            modelo. Todavía no los tenemos, así que se muestra el marcador con
            su rótulo de pendiente: un código inventado se leería como real. */}
        <p className="text-xs text-etiqueta">
          <span className="font-semibold text-cuerpo">Producto inscrito:</span>{" "}
          <span className="tabular-nums">{REGISTRO_PRODUCTO.codigo}</span> · Res. SS.SG. N.°{" "}
          <span className="tabular-nums">{REGISTRO_PRODUCTO.acto}</span>
          {REGISTRO_PRODUCTO.esProvisional ? (
            <span className="ml-2 rounded-full border border-naranja-300 bg-naranja-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-naranja-800 uppercase dark:border-naranja-700 dark:bg-naranja-950 dark:text-naranja-200">
              Pendiente de Alianza
            </span>
          ) : null}
        </p>

        <SelectorDePlanes />

        {/* Un solo recuadro con los cuatro bloques informativos. */}
        <section className="rounded-lg border border-borde-sutil bg-superficie p-3">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
            {BLOQUES_INFORMATIVOS.map(({ titulo, detalle }) => (
              <div key={titulo} className="flex flex-col gap-0.5">
                <dt className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                  {titulo}
                </dt>
                <dd className="text-xs text-cuerpo">{detalle}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          id="documentacion-precontractual"
          className="flex scroll-mt-4 flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie-suave p-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
              Información precontractual
            </h2>
            <p className="text-sm text-cuerpo">
              El diagnóstico confirmado de cáncer impide la renovación; la póliza continúa hasta
              finalizar la vigencia contratada.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-x-6 gap-y-2 lg:justify-end">
            <EnlaceAclaracion documento="documentacionPrecontractual">
              Ver documentación completa
            </EnlaceAclaracion>
            <EnlaceAclaracion documento="consultasReclamos">Consultas y reclamos</EnlaceAclaracion>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-3">
          <Link
            href="/p1-whatsapp"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a la verificación de WhatsApp
          </Link>
        </footer>
      </main>
    </div>
  );
}
