import { cookies } from "next/headers";
import { COOKIE_EXPEDIENTE } from "@/app/api/_http/contexto-peticion";
import { crearExpedienteRepository } from "@/repositories";
import { sufijoTitulo } from "@/domain/entidades";
import { flujoV3Activo } from "@/domain/flujo-vigente";
import type { Metadata } from "next";
import {
  HeaderInstitucional,
  PieLegal,
  StepperPasos,
  TramiteEnOtroPaso,
} from "@/components/shared";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import { DETALLE_CONFIRMACION_SIN_CONTRATACION } from "@/domain/textos-reencaminado";
import { expedienteEnOtroPaso } from "../_reencaminado";
import {
  BAJADA_P9,
  LEYENDA_CIERRE_P9,
  ROTULO_BOTON_FINALIZAR_P9,
  ROTULO_PRODUCTO_P9,
  TITULO_P9,
} from "@/domain/textos-p9";
import { ContratacionAceptada } from "./ContratacionAceptada";

/**
 * Paso 8 · Contratación aceptada — `/confirmacion`.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "Paso 8 · Contratación
 * aceptada". Se llega desde el pago, con el documento único firmado, el cobro
 * acreditado y el Certificado de Cobertura Provisional ya emitido (D-12).
 *
 * El número de paso no se escribe acá: sale de `PASOS_FLUJO`
 * (`src/domain/rutas-flujo.ts`) a través del stepper.
 *
 * Respaldo normativo del conjunto: filas 39, 40, 43, 47 y 50 de la matriz de
 * cumplimiento (Res. SS SG. 215/17, art. 1, punto 14 y Anexo 1 numeral 6.13.14;
 * Ley 6822/21, arts. 38(2), 43 y 44-46; Ley 4868/13, arts. 31-32; Ley 125/91,
 * art. 85; Código Civil, arts. 1348, 1373 y 1374).
 *
 * **No se genera Nota de Cobertura** y la póliza no se descarga desde acá: la
 * emite y la envía Alianza Garantía a los canales verificados. Del portal
 * salen tres documentos: el paquete firmado, el certificado y el comprobante
 * de pago (D-05).
 *
 * Sin barra de plan seleccionado: la barra va del paso 3 al 7, y acá la
 * contratación ya está cerrada.
 */

export const metadata: Metadata = {
  title: `Contratación aceptada · ${sufijoTitulo()}`,
  description:
    "La solicitud fue aceptada; Alianza Garantía emitirá y enviará la póliza a los canales verificados.",
  // Es el desenlace de un expediente concreto, no una página pública.
  robots: { index: false, follow: false },
};

/**
 * ¿La firma del cliente la generó el portal (D1)? De eso depende que tenga
 * sentido ofrecer la constancia: sobre una firma de proveedor la evidencia que
 * respalda es otra, y el panel citaría los artículos de la firma simple sobre
 * un acto que se produjo de otra manera. Si la consulta falla, no se ofrece:
 * es mejor no mostrar el botón que mostrarlo roto.
 */
async function firmaInternaDelExpediente(): Promise<boolean> {
  const expedienteId = (await cookies()).get(COOKIE_EXPEDIENTE)?.value;
  if (!expedienteId) return false;
  try {
    const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
    return expediente?.firma?.origen === "INTERNA";
  } catch {
    return false;
  }
}

export default async function PantallaP9Confirmacion() {
  // Esta pantalla es dueña de dos estados, no de uno: `PAGO_CONFIRMADO` —el
  // cobro entró y el certificado existe— y `EMITIDO`, que es a donde llega
  // después. Con cualquier otro, el componente se quedaba en un párrafo suelto
  // ("Este expediente todavía no llegó a la contratación aceptada") sin decir
  // qué hacer ni a dónde ir.
  const enOtroPaso = await expedienteEnOtroPaso("/confirmacion", ["PAGO_CONFIRMADO"]);
  const firmaInterna = await firmaInternaDelExpediente();
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/confirmacion" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        {flujoV3Activo() ? (
          /* Encabezado del canvas: kicker, título grande y la bajada a la
             izquierda; la foto al costado, no como banda arriba de todo. */
          <div className="mb-4 flex flex-wrap items-start gap-6 lg:gap-11">
            <div className="min-w-0 flex-[1_1_340px]">
              <p className="text-xs font-semibold tracking-[0.08em] text-naranja-700 uppercase dark:text-naranja-300">
                Contratación aceptada
              </p>
              <h1
                className="mt-2.5 mb-2 font-bold tracking-tight text-titulo"
                style={{ fontSize: "clamp(28px, 4.5vw, 40px)" }}
              >
                {TITULO_P9}
              </h1>
              <p className="max-w-[52ch] text-[15px] leading-relaxed text-cuerpo">{BAJADA_P9}</p>
            </div>
            <div className="min-w-0 flex-[1_1_340px]">
              <div className="overflow-hidden rounded-2xl border border-borde-sutil bg-superficie">
                <img
                  src="/v3/familia-confirmacion.jpg"
                  alt="Familia abrazándose junto a la póliza emitida"
                  className="v3-foto-cierre w-full"
                  style={{ aspectRatio: "16 / 10" }}
                />
              </div>
            </div>
          </div>
        ) : (
          <header className="flex flex-col gap-2 rounded-lg border border-verde-300 bg-verde-50 p-3 sm:flex-row sm:items-baseline sm:justify-between dark:border-verde-700 dark:bg-verde-950">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <h1 className="shrink-0 text-xl font-bold text-verde-900 sm:text-2xl dark:text-verde-100">
                {TITULO_P9}
              </h1>
              <p className="text-sm text-verde-900 dark:text-verde-100">{BAJADA_P9}</p>
            </div>
            <p className="text-left text-sm font-bold text-verde-900 sm:shrink-0 sm:text-right dark:text-verde-100">
              {ROTULO_PRODUCTO_P9}
            </p>
          </header>
        )}
        {enOtroPaso ? (
          <TramiteEnOtroPaso
            destino={enOtroPaso}
            detalle={DETALLE_CONFIRMACION_SIN_CONTRATACION}
            modoDemo={esModoDemo()}
          />
        ) : (
          <ContratacionAceptada evidenciaFirmaDisponible={firmaInterna} />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Pie: botón de cierre y leyenda de asesoramiento (CHG-46)          */}
        {/* ---------------------------------------------------------------- */}
        {/* Maqueta p.8: la leyenda a la izquierda y el botón —chico— a la
            derecha. Con el botón arriba y de ancho completo, el cierre empujaba
            el resto de la pantalla fuera de la vista. */}
        <footer className="flex flex-col gap-3 border-t border-borde-tenue pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="text-sm font-semibold text-azul-800 dark:text-azul-200">
            {LEYENDA_CIERRE_P9}
          </p>

          {/* Cierra el trámite en este navegador antes de volver: si no, la
              selección de plan reconoce el expediente terminado y recibe con
              "Ya tenés un trámite empezado" a quien acaba de terminarlo.
              POST y no enlace porque `next/link` precarga los href. */}
          <form action="/api/flujo/cerrar" method="post" className="shrink-0">
            <button type="submit" className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-naranja-500 px-8 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400">
              {ROTULO_BOTON_FINALIZAR_P9}
            </button>
          </form>
        </footer>
      </main>

      <PieLegal colapsable={flujoV3Activo()} />
    </div>
  );
}
