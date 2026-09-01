"use client";

/**
 * Orquestador del paso 3 (lote F4b), patrón de `Inscripcion.tsx`/`Seguro.tsx`.
 *
 * Dos secciones gateadas por el estado del expediente: la firma (activa en
 * `DECLARACIONES_OK`/`PAQUETE_GENERADO`/`FIRMADO_CLIENTE`, colapsa a ✓ con
 * `FIRMADO`) y el pago (bloqueada hasta `FIRMADO` — regla 6-bis: no hay cobro
 * sin firma). Completada la firma, `router.refresh()` re-dibuja con el gating
 * nuevo; el pago no navega al confirmar (muestra el enlace a la confirmación,
 * como en v2).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ModalEvidenciaFirma } from "@/components/shared";
import type { EstadoExpediente } from "@/domain/tipos";
import {
  BLOQUEO_PAGO,
  CONFIRMACION_FIRMADO,
  INTRO_PAGO,
  TITULO_SECCION_FIRMA,
  TITULO_SECCION_PAGO,
} from "@/domain/textos-pago-firma";
import { FormularioPagoP7 } from "../pago/FormularioPagoP7";
import { FirmaInternaV3 } from "./FirmaInternaV3";

export interface PagoYFirmaProps {
  readonly estado: EstadoExpediente;
  readonly nombrePila: string | null;
  readonly pagoSimuladoDisponible: boolean;
}

export function PagoYFirma(props: PagoYFirmaProps) {
  const router = useRouter();
  const [verEvidencia, setVerEvidencia] = useState(false);
  const firmado = props.estado === "FIRMADO";
  const con = (frase: string) =>
    props.nombrePila ? `${props.nombrePila}, ${frase}` : frase.charAt(0).toUpperCase() + frase.slice(1);

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Tu firma"
        className={`flex flex-col gap-3 rounded-xl border bg-superficie p-4 sm:p-5 ${
          firmado ? "border-borde-sutil" : "border-naranja-300"
        }`}
      >
        <header className="flex flex-col gap-0.5">
          <p className="text-[11px] font-semibold tracking-wide text-etiqueta uppercase">
            Primero · La firma
          </p>
          <h2 className="text-lg font-bold text-titulo">{con(TITULO_SECCION_FIRMA)}</h2>
        </header>
        {firmado ? (
          <>
            <p className="text-sm font-semibold text-verde-700 dark:text-verde-300">
              {CONFIRMACION_FIRMADO}
            </p>
            {/* Tu firma es no cualificada y la genera el portal (D1): no hay
                certificado de un prestador que abrir, así que lo que la
                respalda —y lo que esto muestra— es su evidencia. */}
            <button
              type="button"
              onClick={() => setVerEvidencia(true)}
              className="inline-flex h-10 w-fit items-center rounded-lg border border-azul-300 px-4 text-xs font-bold tracking-wide text-azul-800 uppercase transition-colors hover:bg-azul-50 dark:border-azul-600 dark:text-azul-200 dark:hover:bg-azul-950"
            >
              Ver la evidencia de mi firma
            </button>
          </>
        ) : (
          <FirmaInternaV3 onCompletado={() => router.refresh()} />
        )}
      </section>

      <section
        aria-label="El pago"
        className={`flex flex-col gap-3 rounded-xl border bg-superficie p-4 sm:p-5 ${
          firmado ? "border-naranja-300" : "border-borde-sutil"
        }`}
      >
        <header className="flex flex-col gap-0.5">
          <p className="text-[11px] font-semibold tracking-wide text-etiqueta uppercase">
            Después · El pago
          </p>
          <h2 className="text-lg font-bold text-titulo">
            {props.nombrePila ? `${TITULO_SECCION_PAGO}, ${props.nombrePila}` : TITULO_SECCION_PAGO}
          </h2>
        </header>
        {firmado ? (
          <>
            <p className="text-sm text-cuerpo">{INTRO_PAGO}</p>
            <FormularioPagoP7 pagoSimuladoDisponible={props.pagoSimuladoDisponible} />
          </>
        ) : (
          <p className="text-sm text-etiqueta">{BLOQUEO_PAGO}</p>
        )}
      </section>

      {verEvidencia ? <ModalEvidenciaFirma alCerrar={() => setVerEvidencia(false)} /> : null}
    </div>
  );
}
