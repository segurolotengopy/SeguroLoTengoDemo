import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import Link from "next/link";
import {
  BarraPlanDelExpediente,
  HeaderInstitucional,
  PieLegal,
  StepperPasos,
} from "@/components/shared";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import { TOTAL_PASOS, numeroDePaso, pasoAnteriorDe } from "@/domain/rutas-flujo";
import {
  ADVERTENCIA_ACEPTACION_P8,
  LEYENDAS_FINALES_P8,
  PASOS_POSTERIORES_P8,
  SUBTITULO_P8,
  TITULO_DESPUES_DE_LA_FIRMA_P8,
  TITULO_P8,
} from "@/domain/textos-p8";
import { FirmaP8 } from "./FirmaP8";

/**
 * Revisión y firma final.
 *
 * **El número de paso no se escribe acá.** Sale de `PASOS_FLUJO`
 * (`src/domain/rutas-flujo.ts`), igual que el del stepper: con D-08 la firma
 * pasó a ocurrir antes del pago y esta pantalla se quedó anunciando "Paso 8 de
 * 9" en su descripción, que es exactamente lo que escribir el número a mano
 * produce.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "Revisión y firma
 * final". Respaldo normativo del conjunto: filas 29, 34, 35,
 * 36, 37, 41, 42, 43 y 47 de la matriz de cumplimiento (Ley 6822/21, arts.
 * 38(1), 40, 42(5), 44-46, 61, 66 y 67-69; Res. SS SG. 215/2025, anexo 1,
 * numeral 11.15, y punto 14; Ley 4868/13, arts. 7(f), 7(n) y 7(r); Código
 * Civil, arts. 1348 y 1373-1374).
 *
 * La pantalla no firma: pide un enlace. La aceptación contractual ocurre en el
 * sitio del proveedor de firma, con el OTP del acto de firma, que nunca pasa
 * por acá (reglas inviolables #1, #2 y #3). Es el **segundo** OTP del flujo,
 * no el tercero: el de correo se retiró con D-06.
 *
 * Todo lo estático se renderiza en el servidor; lo único que baja como
 * componente de cliente son los tres bloques operativos y la barra de plan.
 */

export const metadata: Metadata = {
  title: `Revisión y firma final · ${sufijoTitulo()}`,
  description: `Paso ${numeroDePaso("/firma")} de ${TOTAL_PASOS}: revisión de la Solicitud y el FIPF cerrados y firma de ambos en un único acto.`,
};

export default function PantallaP8Firma() {
  const pasoAnterior = pasoAnteriorDe("/firma");

  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/firma" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        {/* "Cambiar plan", como el resto de las pantallas del flujo. Decía
            "Volver al pago" apuntando a /pago, que era correcto cuando se
            pagaba antes de firmar: con D-08 el pago pasó a ser el paso
            siguiente, así que ese enlace mandaba a la persona hacia adelante,
            a un paso que todavía no puede completar. */}
        <BarraPlanDelExpediente
          enlaceTexto="Cambiar plan"
          enlaceHref="/plan"
          formatoPremio="premio-anual"
        />

        <header className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-4">
          <h1 className="shrink-0 text-xl font-bold text-titulo sm:text-2xl">{TITULO_P8}</h1>
          <p className="text-sm text-cuerpo">
            {SUBTITULO_P8}{" "}
            <span className="font-semibold text-naranja-700 dark:text-naranja-300">
              {ADVERTENCIA_ACEPTACION_P8}
            </span>
          </p>
        </header>

        {/* El bloque de abajo entra como `children` para que quede **antes**
            del pie de la pantalla de firma —acceso previo y constancia del PDF
            cerrado—, que a pedido tienen que ser lo último. Sigue siendo
            contenido de servidor: pasar un componente de servidor como
            `children` de uno de cliente no lo empuja al bundle. */}
        <FirmaP8 firmadorSimuladoDisponible={esModoDemo()}>
        <section
          aria-labelledby="p8-despues"
          className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-3"
        >
          <h2
            id="p8-despues"
            className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
          >
            {TITULO_DESPUES_DE_LA_FIRMA_P8}
          </h2>
          <ol className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            {PASOS_POSTERIORES_P8.map((paso, indice) => (
              <li
                key={paso.titulo}
                className="flex flex-col gap-0.5 rounded-lg border border-borde-tenue bg-superficie-suave p-2.5"
              >
                <span className="text-sm font-semibold text-titulo">
                  <span className="text-[11px] font-bold text-etiqueta">{indice + 1} · </span>
                  {paso.titulo}
                </span>
                <span className="text-xs text-cuerpo">{paso.detalle}</span>
              </li>
            ))}
          </ol>
          <ul className="flex list-disc flex-col gap-0.5 pl-5 text-xs text-etiqueta">
            {LEYENDAS_FINALES_P8.map((leyenda) => (
              <li key={leyenda}>{leyenda}</li>
            ))}
          </ul>
        </section>
        </FirmaP8>

        {/* Destino y rótulo derivados de PASOS_FLUJO. Escrito a mano decía
            "Volver a facturación y garantía de pago" hacia /pago, del orden
            anterior a D-08. */}
        {pasoAnterior ? (
          <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-3">
            <Link
              href={pasoAnterior.slug}
              className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
            >
              ← Volver a {pasoAnterior.titulo.toLocaleLowerCase("es-PY")}
            </Link>
          </footer>
        ) : null}
      </main>

      <PieLegal />
    </div>
  );
}
