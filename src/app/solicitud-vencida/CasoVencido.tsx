"use client";

import { useEffect, useState } from "react";
import { formatearGuaranies } from "@/domain/catalogo";
import {
  AVISO_DEVOLUCION_SOLO_AL_ORIGEN,
  AVISO_LIBERACION_SIN_COBRO,
  AVISO_SIN_POLIZA_NI_COBERTURA,
  BAJADA_PANTALLA_B,
  BAJADA_PANTALLA_B_CREDITO,
  PASOS_DEVOLUCION,
  PASOS_LIBERACION_RESERVA,
  ROTULO_ASEGURADO_B,
  ROTULO_CORREO_B,
  ROTULO_DOCUMENTO_B,
  ROTULO_ESTADO_FINAL_B,
  ROTULO_ESTADO_PANTALLA_B,
  ROTULO_PAGO_BANCARD_B,
  ROTULO_PREMIO_B,
  ROTULO_PROPUESTA_B,
  ROTULO_WHATSAPP_B,
  TITULO_LIBERACION_RESERVA,
  TITULO_PROCEDIMIENTO_DEVOLUCION,
  TITULO_RESUMEN_CASO,
  TITULO_SEGUIMIENTO_FIRMA,
} from "@/domain/textos-pantalla-b";

/**
 * Los bloques de la Pantalla B que dependen del expediente: la bajada del
 * encabezado, `SEGUIMIENTO DE FIRMA`, `RESUMEN DEL CASO`, el procedimiento y el
 * estado final del pie.
 *
 * Dos variantes, según cómo se pagó (ver la divergencia declarada en
 * `textos-pantalla-b.ts`): con QR o débito hay premio cobrado y por lo tanto
 * devolución; con crédito hubo una reserva que se liberó y no hay nada que
 * devolver. La pantalla no le puede decir a la persona que se inició una
 * devolución de plata que nunca salió de su cuenta.
 */

interface HitoCalculado {
  readonly horas: number;
  readonly rotulo: string;
  readonly detalle: string;
  readonly esVencimiento: boolean;
  readonly en: string | null;
  readonly cumplido: boolean;
}

interface Caso {
  readonly estado: string;
  readonly numeroPropuesta: string | null;
  readonly referenciaBancard: string | null;
  readonly premioGs: number;
  readonly medio: string | null;
  readonly hayPremioQueDevolver: boolean;
  readonly nombreAsegurado: string | null;
  readonly documentoEnmascarado: string | null;
  readonly whatsappEnmascarado: string | null;
  readonly correoEnmascarado: string | null;
  readonly pagoConfirmadoEn: string | null;
  readonly plazoFirmaVenceEn: string | null;
  readonly hitos: readonly HitoCalculado[];
}

const MENSAJES: Readonly<Record<string, string>> = {
  SESION_INVALIDA: "Se perdió la sesión de este expediente.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión de este expediente.",
  EXPEDIENTE_NO_VENCIDO: "Este expediente no está vencido: no hay ningún caso de devolución.",
};

function hora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PY");
}

function Fila({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
      <span className="text-sm text-cuerpo">{rotulo}</span>
      <span className="text-right text-sm font-semibold text-titulo tabular-nums">{valor}</span>
    </div>
  );
}

export function CasoVencido() {
  const [caso, setCaso] = useState<Caso | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const respuesta = await fetch("/api/pantalla-b/caso");
        const datos = (await respuesta.json().catch(() => ({}))) as {
          ok?: boolean;
          motivo?: string;
          caso?: Caso;
        };
        if (!vigente) return;
        if (!datos.ok || !datos.caso) {
          setError(MENSAJES[datos.motivo ?? ""] ?? "No pudimos recuperar el caso.");
          return;
        }
        setCaso(datos.caso);
      } catch {
        if (vigente) setError("No pudimos conectarnos.");
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
        {error}
      </p>
    );
  }

  const conDevolucion = caso?.hayPremioQueDevolver !== false;
  const pasos = conDevolucion ? PASOS_DEVOLUCION : PASOS_LIBERACION_RESERVA;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-rojo-900 dark:text-rojo-100">
        {caso === null
          ? BAJADA_PANTALLA_B
          : conDevolucion
            ? BAJADA_PANTALLA_B
            : BAJADA_PANTALLA_B_CREDITO}
      </p>

      {/* En pantallas anchas: seguimiento y resumen lado a lado. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* ------------------------------------------------------------------ */}
      {/* SEGUIMIENTO DE FIRMA                                                */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-labelledby="b-seguimiento"
        className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4"
      >
        <h2
          id="b-seguimiento"
          className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
        >
          {TITULO_SEGUIMIENTO_FIRMA}
        </h2>
        <ol className="flex flex-col gap-2">
          {(caso?.hitos ?? []).map((hito) => (
            <li
              key={hito.horas}
              className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg border p-3 ${
                hito.esVencimiento
                  ? "border-rojo-300 bg-rojo-50 dark:border-rojo-700 dark:bg-rojo-950"
                  : "border-borde-tenue bg-superficie-suave"
              }`}
            >
              <span
                className={`text-xs font-bold tracking-wide uppercase ${
                  hito.esVencimiento
                    ? "text-rojo-800 dark:text-rojo-200"
                    : "text-azul-800 dark:text-azul-200"
                }`}
              >
                {hito.rotulo}
              </span>
              <span className="flex-1 text-sm text-cuerpo">{hito.detalle}</span>
              <span className="text-xs text-etiqueta tabular-nums">{hora(hito.en)}</span>
            </li>
          ))}
          {caso === null ? <li className="text-sm text-cuerpo">Recuperando el seguimiento…</li> : null}
        </ol>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* RESUMEN DEL CASO                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-labelledby="b-resumen"
        className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4"
      >
        <h2
          id="b-resumen"
          className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
        >
          {TITULO_RESUMEN_CASO}
        </h2>

        <div className="flex flex-col divide-y divide-borde-tenue">
          <Fila rotulo={ROTULO_PROPUESTA_B} valor={caso?.numeroPropuesta ?? "—"} />
          <Fila rotulo={ROTULO_PAGO_BANCARD_B} valor={caso?.referenciaBancard ?? "—"} />
          <Fila
            rotulo={ROTULO_PREMIO_B}
            valor={caso ? formatearGuaranies(caso.premioGs) : "—"}
          />
          <Fila rotulo={ROTULO_ASEGURADO_B} valor={caso?.nombreAsegurado ?? "—"} />
          <Fila rotulo={ROTULO_DOCUMENTO_B} valor={caso?.documentoEnmascarado ?? "—"} />
          <Fila rotulo={ROTULO_WHATSAPP_B} valor={caso?.whatsappEnmascarado ?? "—"} />
          <Fila rotulo={ROTULO_CORREO_B} valor={caso?.correoEnmascarado ?? "—"} />
        </div>

        <p className="rounded-lg border border-rojo-300 bg-rojo-50 px-4 py-3 text-sm font-bold text-rojo-900 dark:border-rojo-700 dark:bg-rojo-950 dark:text-rojo-100">
          {AVISO_SIN_POLIZA_NI_COBERTURA}
        </p>
      </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* PROCEDIMIENTO DE DEVOLUCIÓN (o liberación de la reserva)            */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-labelledby="b-procedimiento"
        className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4"
      >
        <h2
          id="b-procedimiento"
          className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
        >
          {conDevolucion ? TITULO_PROCEDIMIENTO_DEVOLUCION : TITULO_LIBERACION_RESERVA}
        </h2>

        <ol className="flex flex-col gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {pasos.map((paso) => (
            <li
              key={paso.numero}
              className="flex flex-col gap-1 rounded-lg border border-borde-tenue bg-superficie-suave p-3"
            >
              <span className="text-[11px] font-bold text-etiqueta">{paso.numero}</span>
              <span className="text-sm font-semibold text-titulo">{paso.titulo}</span>
              <span className="text-xs text-cuerpo">{paso.detalle}</span>
            </li>
          ))}
        </ol>

        <p className="rounded-lg border border-rojo-300 bg-rojo-50 px-4 py-3 text-sm font-bold text-rojo-900 dark:border-rojo-700 dark:bg-rojo-950 dark:text-rojo-100">
          {conDevolucion ? AVISO_DEVOLUCION_SOLO_AL_ORIGEN : AVISO_LIBERACION_SIN_COBRO}
        </p>
      </section>

      {/* Estado final del expediente (pie de la especificación) */}
      <p className="text-sm font-semibold text-titulo">
        {ROTULO_ESTADO_FINAL_B}:{" "}
        <span className="text-rojo-800 dark:text-rojo-200">
          {caso ? (ROTULO_ESTADO_PANTALLA_B[caso.estado] ?? caso.estado) : "—"}
        </span>
      </p>
    </div>
  );
}
