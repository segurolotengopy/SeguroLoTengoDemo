import type { Metadata } from "next";
import Link from "next/link";
import { BarraPlanDelExpediente, HeaderInstitucional, StepperPasos } from "@/components/shared";
import {
  ADVERTENCIA_P7,
  ADVERTENCIA_PAGO_NO_ES_FIRMA_P7,
  LEYENDA_PROCESADOR_P7,
  SEGURIDAD_P7,
  SUBTITULO_P7,
  TITULO_P7,
  TITULO_SEGURIDAD_P7,
} from "@/domain/textos-p7";
import { FormularioPagoP7 } from "./FormularioPagoP7";

/**
 * P7 · Paso 7 de 9 — Facturación y garantía de pago.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P7 · Paso 7 de 9 —
 * Facturación y garantía de pago". Respaldo normativo del conjunto: filas 16,
 * 23, 24, 25, 26, 27, 28, 30, 31 y 32 de la matriz de cumplimiento (Res.
 * SEPRELAD 71/19, art. 26(1)(a-j); Res. BCP 25/21, arts. 5-6 y 8; Ley 4868/13,
 * arts. 7(f, l, m, p, q), 17 y 30(b-c); Ley 6822/21, arts. 42(5), 66 y 68(1);
 * Código Civil, arts. 1348 y 1373-1374).
 *
 * **Divergencia declarada:** la especificación presenta dos medios de pago;
 * esta pantalla muestra tres, porque el débito cobra al confirmarse y no
 * reserva —la preautorización es exclusiva del crédito, confirmado por
 * Bancard—. La justificación completa está en `MedioDePago`
 * (`src/domain/tipos.ts`).
 *
 * Todo lo estático se renderiza en el servidor; lo único que baja como
 * componente de cliente son el formulario de pago y la barra de plan.
 */

export const metadata: Metadata = {
  title: "Facturación y garantía de pago · SeguroLoTengo",
  description:
    "Paso 7 de 9: datos para la factura, declaración de origen lícito de fondos y elección del medio de pago.",
};

export default function PantallaP7Pago() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos pasoActual={7} />} />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <BarraPlanDelExpediente
          enlaceTexto="Cambiar plan"
          enlaceHref="/p2-plan"
          formatoPremio="premio-anual"
        />

        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-titulo sm:text-3xl">{TITULO_P7}</h1>
          <p className="text-base text-azul-700 dark:text-azul-200">{SUBTITULO_P7}</p>
          <p className="text-sm font-semibold text-naranja-700 dark:text-naranja-300">
            {ADVERTENCIA_P7}
          </p>
          <p className="text-sm text-cuerpo">{LEYENDA_PROCESADOR_P7}</p>
        </header>

        <FormularioPagoP7 />

        <section
          aria-labelledby="p7-seguridad"
          className="flex flex-col gap-3 rounded-xl border border-verde-300 bg-verde-50 p-4 dark:border-verde-700 dark:bg-verde-950"
        >
          <h2
            id="p7-seguridad"
            className="text-xs font-bold uppercase tracking-wide text-verde-800 dark:text-verde-200"
          >
            {TITULO_SEGURIDAD_P7}
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-verde-900 dark:text-verde-100">
            {SEGURIDAD_P7.map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </ul>
          <p className="text-sm font-semibold text-verde-900 dark:text-verde-100">
            {ADVERTENCIA_PAGO_NO_ES_FIRMA_P7}
          </p>
        </section>

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-4">
          <Link
            href="/p6-declaraciones"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a datos y declaraciones
          </Link>
        </footer>
      </main>
    </div>
  );
}
