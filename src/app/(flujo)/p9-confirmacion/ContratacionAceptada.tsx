"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AVISOS_IMPORTANTE_P9,
  BADGE_EMITIDA,
  BADGE_EN_EMISION,
  BOTON_DESCARGAR_P9,
  DETALLE_FIRMANTES_P9,
  DOCUMENTOS_POR_RECIBIR,
  HITOS_CONTRATACION,
  LEYENDA_SIN_NOTA_DE_COBERTURA,
  NOMBRE_FIPF_P9,
  NOMBRE_SOLICITUD_P9,
  ROTULO_ASEGURADO_P9,
  ROTULO_DOCUMENTO_P9,
  ROTULO_ESTADO_POLIZA,
  ROTULO_ESTADO_POLIZA_P9,
  ROTULO_ESTADO_SOLICITUD_P9,
  ROTULO_MEDIO_DE_PAGO_P9,
  ROTULO_NUMERO_PROPUESTA_P9,
  ROTULO_REFERENCIA_BANCARD_P9,
  TITULO_DOCUMENTOS_PARA_DESCARGAR,
  TITULO_DOCUMENTOS_QUE_RECIBIRAS,
  TITULO_ESTADO_CONTRATACION,
  TITULO_IMPORTANTE_P9,
  TEXTO_COMUNICACIONES_COMERCIALES,
  TITULO_COMUNICACIONES_COMERCIALES,
  TITULO_RESUMEN_CONTRATACION,
  VALOR_ESTADO_SOLICITUD_ACEPTADA,
} from "@/domain/textos-p9";
import { TEXTOS_MEDIOS_DE_PAGO_P7 } from "@/domain/textos-p7";

/**
 * Los bloques de P9 que dependen del expediente: los cuatro hitos, el resumen
 * de la contratación, los documentos y el sondeo de la emisión.
 *
 * Dos cosas que esta pantalla **no** hace, y son las que más importan:
 *
 * - **No entrega la póliza ni la factura.** Las emite y las envía Alianza
 *   (SEBAOT y SIFEN) a los canales verificados; acá solo se muestra su estado.
 *   Los únicos archivos que se descargan del portal son la Solicitud y el FIPF
 *   firmados.
 * - **No genera Nota de Cobertura.** El producto no la contempla, y la leyenda
 *   está a la vista.
 */

interface DocumentoDescargable {
  readonly codigo: string;
  readonly version: number;
  readonly hashFirmado: string;
}

interface Resumen {
  readonly numeroPropuesta: string;
  readonly numeroPoliza: string;
  readonly estadoPoliza: string;
  readonly estadoFactura: string;
  readonly referenciaFactura: string | null;
  readonly polizaEmitidaEn: string | null;
  readonly referenciaBancard: string | null;
  readonly medio: string | null;
  readonly nombreAsegurado: string | null;
  readonly documentoEnmascarado: string | null;
  readonly whatsappEnmascarado: string | null;
  readonly correoEnmascarado: string | null;
  readonly firmadoEn: string | null;
  readonly pagoConfirmadoEn: string | null;
  readonly solicitudAceptadaEn: string;
  readonly solicitud: DocumentoDescargable;
  readonly fipf: DocumentoDescargable;
}

const MENSAJES: Readonly<Record<string, string>> = {
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  ESTADO_INVALIDO: "Este expediente todavía no llegó a la contratación aceptada.",
  SIN_FIRMA: "Todavía falta firmar la Solicitud y el FIPF.",
  COBRO_NO_CONFIRMADO:
    "Todavía estamos confirmando el cobro con Bancard. La emisión se solicita recién cuando el pago está confirmado.",
  EXPEDIENTE_INCOMPLETO: "Faltan datos del expediente para remitirlo a Alianza.",
  SEBAOT_NO_DISPONIBLE: "Alianza no respondió. Volvé a intentar en unos segundos.",
};

/** Cada cuánto se le pregunta a Alianza si la póliza ya se emitió. */
const INTERVALO_SONDEO_MS = 2_000;

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

function Badge({ emitido }: { emitido: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase ${
        emitido
          ? "bg-verde-100 text-verde-800 dark:bg-verde-900 dark:text-verde-200"
          : "bg-naranja-100 text-naranja-900 dark:bg-naranja-900 dark:text-naranja-100"
      }`}
    >
      {emitido ? BADGE_EMITIDA : BADGE_EN_EMISION}
    </span>
  );
}

function TarjetaDescarga({
  nombre,
  documento,
  disponible,
}: {
  nombre: string;
  documento: DocumentoDescargable;
  disponible: boolean;
}) {
  const url = `/api/p8/documento?codigo=${encodeURIComponent(documento.codigo)}&firmado=1&descargar=1`;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie-suave p-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-sm font-bold text-titulo">{nombre}</h3>
          <code className="font-mono text-xs font-semibold text-azul-700 dark:text-azul-200">
            {documento.codigo}
          </code>
        </div>
        <p className="text-sm text-cuerpo">{DETALLE_FIRMANTES_P9}</p>
      </div>

      {disponible ? (
        <a
          href={url}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-azul-300 px-4 text-xs font-bold tracking-wide text-azul-800 uppercase transition-colors hover:bg-azul-50 sm:self-start dark:border-azul-600 dark:text-azul-200 dark:hover:bg-azul-950"
        >
          {BOTON_DESCARGAR_P9}
        </a>
      ) : (
        <p className="text-xs text-etiqueta">Preparando el archivo firmado…</p>
      )}

      <p className="font-mono text-[11px] break-all text-etiqueta">
        SHA-256 {documento.hashFirmado}
      </p>
    </article>
  );
}

export function ContratacionAceptada() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [documentosDisponibles, setDocumentosDisponibles] = useState(false);
  const [estadoPoliza, setEstadoPoliza] = useState<string | null>(null);
  const [estadoFactura, setEstadoFactura] = useState<string | null>(null);
  const [referenciaFactura, setReferenciaFactura] = useState<string | null>(null);
  const [comunicaciones, setComunicaciones] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vigente = useRef(true);
  useEffect(() => {
    vigente.current = true;
    return () => {
      vigente.current = false;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const respuesta = await fetch("/api/p9/resumen");
        const datos = (await respuesta.json().catch(() => ({}))) as {
          ok?: boolean;
          motivo?: string;
          resumen?: Resumen;
          documentosDisponibles?: boolean;
        };
        if (!vigente.current) return;
        if (!datos.ok || !datos.resumen) {
          setError(MENSAJES[datos.motivo ?? ""] ?? "No pudimos recuperar la contratación.");
          return;
        }
        setResumen(datos.resumen);
        setDocumentosDisponibles(datos.documentosDisponibles === true);
        setEstadoPoliza(datos.resumen.estadoPoliza);
        setEstadoFactura(datos.resumen.estadoFactura);
        setReferenciaFactura(datos.resumen.referenciaFactura);
      } catch {
        if (vigente.current) setError(MENSAJES.SEBAOT_NO_DISPONIBLE);
      }
    })();
  }, []);

  const sondear = useCallback(async (): Promise<boolean> => {
    const respuesta = await fetch("/api/p9/estado");
    const datos = (await respuesta.json().catch(() => ({}))) as {
      ok?: boolean;
      estadoPoliza?: string;
      estadoFactura?: string;
      referenciaFactura?: string | null;
    };
    if (!datos.ok) return true;

    if (vigente.current) {
      setEstadoPoliza(datos.estadoPoliza ?? null);
      setEstadoFactura(datos.estadoFactura ?? null);
      setReferenciaFactura(datos.referenciaFactura ?? null);
    }
    // Se deja de sondear cuando ya no queda nada por avanzar.
    return datos.estadoPoliza === "EMITIDA" && datos.estadoFactura === "EMITIDA";
  }, []);

  useEffect(() => {
    if (!resumen) return;
    if (estadoPoliza === "EMITIDA" && estadoFactura === "EMITIDA") return;

    let cancelado = false;
    const temporizador = setInterval(() => {
      void (async () => {
        if (cancelado) return;
        try {
          const terminado = await sondear();
          if (terminado) clearInterval(temporizador);
        } catch {
          // Un sondeo perdido no es un error: sigue el próximo.
        }
      })();
    }, INTERVALO_SONDEO_MS);

    return () => {
      cancelado = true;
      clearInterval(temporizador);
    };
  }, [resumen, estadoPoliza, estadoFactura, sondear]);

  async function cambiarComunicaciones(acepta: boolean) {
    // Optimista: es un consentimiento opcional que no condiciona nada. Si el
    // registro falla, el checkbox vuelve a su lugar.
    setComunicaciones(acepta);
    try {
      const respuesta = await fetch("/api/p9/comunicaciones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acepta }),
      });
      if (!respuesta.ok && vigente.current) setComunicaciones(!acepta);
    } catch {
      if (vigente.current) setComunicaciones(!acepta);
    }
  }

  if (error) {
    return (
      <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
        {error}
      </p>
    );
  }

  const textoMedio = TEXTOS_MEDIOS_DE_PAGO_P7.find((opcion) => opcion.medio === resumen?.medio);
  const polizaEmitida = estadoPoliza === "EMITIDA";
  const facturaEmitida = estadoFactura === "EMITIDA";

  // Los tres primeros hitos están cumplidos al llegar acá; el cuarto sigue el
  // estado real de la póliza en Alianza.
  const fechasHito: readonly (string | null)[] = [
    resumen?.firmadoEn ?? null,
    resumen?.pagoConfirmadoEn ?? null,
    resumen?.solicitudAceptadaEn ?? null,
    resumen?.polizaEmitidaEn ?? null,
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------------------------------------------ */}
      {/* ESTADO DE LA CONTRATACIÓN                                           */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-labelledby="p9-estado"
        className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-5"
      >
        <h2
          id="p9-estado"
          className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
        >
          {TITULO_ESTADO_CONTRATACION}
        </h2>
        <ol className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {HITOS_CONTRATACION.map((hito, indice) => {
            const cumplido = indice < 3 ? resumen !== null : polizaEmitida;
            return (
              <li
                key={hito.numero}
                className="flex flex-col gap-1 rounded-lg border border-borde-tenue bg-superficie-suave p-3"
              >
                <span
                  className={`text-sm font-bold ${
                    cumplido
                      ? "text-verde-700 dark:text-verde-300"
                      : "text-naranja-700 dark:text-naranja-300"
                  }`}
                >
                  {cumplido ? "✓" : "⋯"} {hito.titulo}
                </span>
                <span className="text-xs text-cuerpo">{hito.detalle}</span>
                <span className="text-[11px] text-etiqueta tabular-nums">
                  {hora(fechasHito[indice])}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* RESUMEN DE LA CONTRATACIÓN                                          */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-labelledby="p9-resumen"
        className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-5"
      >
        <h2
          id="p9-resumen"
          className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
        >
          {TITULO_RESUMEN_CONTRATACION}
        </h2>

        <div className="flex flex-col divide-y divide-borde-tenue">
          <Fila rotulo={ROTULO_NUMERO_PROPUESTA_P9} valor={resumen?.numeroPropuesta ?? "—"} />
          <Fila
            rotulo={ROTULO_ESTADO_SOLICITUD_P9}
            valor={resumen ? VALOR_ESTADO_SOLICITUD_ACEPTADA : "—"}
          />
          <Fila rotulo={ROTULO_REFERENCIA_BANCARD_P9} valor={resumen?.referenciaBancard ?? "—"} />
          <Fila rotulo={ROTULO_ASEGURADO_P9} valor={resumen?.nombreAsegurado ?? "—"} />
          <Fila rotulo={ROTULO_DOCUMENTO_P9} valor={resumen?.documentoEnmascarado ?? "—"} />
          <Fila rotulo={ROTULO_MEDIO_DE_PAGO_P9} valor={textoMedio?.titulo ?? "—"} />
          <Fila
            rotulo={ROTULO_ESTADO_POLIZA_P9}
            valor={estadoPoliza ? (ROTULO_ESTADO_POLIZA[estadoPoliza] ?? estadoPoliza) : "—"}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-azul-200 bg-azul-50 px-4 py-3 dark:border-azul-700 dark:bg-azul-950">
          <h3 className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_IMPORTANTE_P9}
          </h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-azul-900 dark:text-azul-100">
            {AVISOS_IMPORTANTE_P9.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Documentos                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-labelledby="p9-por-recibir"
        className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-5"
      >
        <h2
          id="p9-por-recibir"
          className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
        >
          {TITULO_DOCUMENTOS_QUE_RECIBIRAS}
        </h2>
        <ul className="flex flex-col gap-2">
          {DOCUMENTOS_POR_RECIBIR.map((documento, indice) => (
            <li
              key={documento.nombre}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-borde-tenue bg-superficie-suave p-3"
            >
              <span className="text-sm font-semibold text-titulo">{documento.nombre}</span>
              <Badge emitido={indice === 0 ? polizaEmitida : facturaEmitida} />
              <span className="w-full text-xs text-cuerpo">{documento.detalle}</span>
              {indice === 1 && referenciaFactura ? (
                <span className="w-full font-mono text-[11px] text-etiqueta">
                  Referencia {referenciaFactura}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="p9-descargar"
        className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-5"
      >
        <h2
          id="p9-descargar"
          className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
        >
          {TITULO_DOCUMENTOS_PARA_DESCARGAR}
        </h2>

        {resumen ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <TarjetaDescarga
              nombre={NOMBRE_SOLICITUD_P9}
              documento={resumen.solicitud}
              disponible={documentosDisponibles}
            />
            <TarjetaDescarga
              nombre={NOMBRE_FIPF_P9}
              documento={resumen.fipf}
              disponible={documentosDisponibles}
            />
          </div>
        ) : (
          <p className="text-sm text-cuerpo">Preparando los documentos firmados…</p>
        )}

        <p className="rounded-lg border border-borde-sutil bg-superficie-suave px-4 py-3 text-sm font-bold text-titulo">
          {LEYENDA_SIN_NOTA_DE_COBERTURA}
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* COMUNICACIONES COMERCIALES · OPCIONAL                               */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-labelledby="p9-comunicaciones"
        className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-5"
      >
        <h2
          id="p9-comunicaciones"
          className="text-xs font-bold tracking-wide text-etiqueta uppercase"
        >
          {TITULO_COMUNICACIONES_COMERCIALES}
        </h2>
        {/*
          Desmarcado por defecto y sin ningún efecto sobre el contrato: es un
          consentimiento de marketing, separado y revocable.
        */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={comunicaciones}
            disabled={resumen === null}
            onChange={(evento) => void cambiarComunicaciones(evento.target.checked)}
            className="mt-0.5 size-4 accent-naranja-500"
          />
          <span className="text-sm text-cuerpo">{TEXTO_COMUNICACIONES_COMERCIALES}</span>
        </label>
      </section>
    </div>
  );
}
