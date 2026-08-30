import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import Link from "next/link";
import {
  BarraPlanDelExpediente,
  HeaderInstitucional,
  PieLegal,
  StepperPasos,
  TituloDePantalla,
  TramiteEnOtroPaso,
} from "@/components/shared";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import { DETALLE_PAGO_YA_HECHO } from "@/domain/textos-reencaminado";
import { pasoAnteriorDe } from "@/domain/rutas-flujo";
import { expedienteEnOtroPaso } from "../_reencaminado";
import { ADVERTENCIA_P7, LEYENDA_PROCESADOR_P7, TITULO_P7 } from "@/domain/textos-p7";
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
  title: `Facturación y garantía de pago · ${sufijoTitulo()}`,
  description:
    "Paso 7 de 9: datos para la factura, declaración de origen lícito de fondos y elección del medio de pago.",
};

export default async function PantallaP7Pago() {
  // `PAGO_CONFIRMADO` sigue siendo de esta pantalla: al acreditarse se queda
  // acá mostrando el comprobante y el enlace a la confirmación, en vez de
  // navegar sola. Ver `expedienteEnOtroPaso`.
  const enOtroPaso = await expedienteEnOtroPaso("/pago", ["PAGO_CONFIRMADO"]);
  const pasoAnterior = pasoAnteriorDe("/pago");
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/pago" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <BarraPlanDelExpediente
          enlaceTexto="Cambiar plan"
          enlaceHref="/plan"
          formatoPremio="premio-anual"
        />

        <TituloDePantalla titulo={TITULO_P7} subtitulo={ADVERTENCIA_P7} />
        <p className="text-center text-xs text-cuerpo">{LEYENDA_PROCESADOR_P7}</p>

        {enOtroPaso ? (
          <TramiteEnOtroPaso
            destino={enOtroPaso}
            detalle={DETALLE_PAGO_YA_HECHO}
            modoDemo={esModoDemo()}
          />
        ) : (
          <FormularioPagoP7 pagoSimuladoDisponible={esModoDemo()} />
        )}

        {/* El paso anterior sale de PASOS_FLUJO, no escrito a mano: acá decía
            "Volver a datos y declaraciones" y apuntaba a `/declaraciones`, que
            es dos pasos atrás. Quedó de antes de D-08, cuando el pago venía
            justo después de las declaraciones; al meterse la firma en el medio,
            el enlace se quedó viejo. Es el mismo error que ya se había
            corregido en `/firma` de esta misma forma. */}
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
