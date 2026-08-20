"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AVISOS_IMPORTANTE_P9,
  BAJADA_AYUDA_P9,
  BAJADA_ENTREGA_P9,
  BOTON_DESCARGAR_P9,
  BOTON_WHATSAPP_P9,
  BADGE_EMITIDA,
  BADGE_EN_EMISION,
  DETALLE_CERTIFICADO_P9,
  DETALLE_COMPROBANTE_P9,
  DETALLE_FIRMANTES_P9,
  DETALLE_INICIO_COBERTURA_P9,
  DOCUMENTOS_POR_RECIBIR,
  HITOS_CONTRATACION,
  LEYENDA_ENTREGA_FALLIDA_P9,
  LEYENDA_SIN_NOTA_DE_COBERTURA,
  NOMBRE_CERTIFICADO_P9,
  NOMBRE_COMPROBANTE_P9,
  NOMBRE_DOCUMENTO_P9,
  PASOS_QUE_OCURRIRA_P9,
  ROTULO_ASEGURADO_P9,
  ROTULO_CANAL_CORREO_P9,
  ROTULO_CANAL_WHATSAPP_P9,
  ROTULO_DOCUMENTO_P9,
  ROTULO_ESTADO_ENTREGA,
  ROTULO_ESTADO_POLIZA,
  ROTULO_ESTADO_POLIZA_P9,
  ROTULO_ESTADO_SOLICITUD_P9,
  ROTULO_FIN_VIGENCIA_P9,
  ROTULO_MEDIO_DE_PAGO_P9,
  ROTULO_NUMERO_PROPUESTA_P9,
  ROTULO_OPERACION_P9,
  ROTULO_PREMIO_PAGADO_P9,
  ROTULO_REFERENCIA_BANCARD_P9,
  TEXTO_COMUNICACIONES_COMERCIALES,
  TITULO_AYUDA_P9,
  TITULO_COMUNICACIONES_COMERCIALES,
  TITULO_DOCUMENTOS_PARA_DESCARGAR,
  TITULO_DOCUMENTOS_QUE_RECIBIRAS,
  TITULO_ENTREGA_P9,
  TITULO_ESTADO_CONTRATACION,
  TITULO_IMPORTANTE_P9,
  TITULO_INICIO_COBERTURA_P9,
  TITULO_PAGO_CONFIRMADO_P9,
  TITULO_QUE_OCURRIRA_P9,
  TITULO_RESUMEN_CONTRATACION,
  VALOR_ESTADO_SOLICITUD_ACEPTADA,
  mensajeWhatsappP9,
} from "@/domain/textos-p9";
import { TEXTOS_MEDIOS_DE_PAGO_P7 } from "@/domain/textos-p7";
import {
  contactosInstitucionales,
  enlaceWhatsapp,
  whatsappHabilitadoEn,
  whatsappAtencion,
} from "@/domain/entidades";
import { formatearGuaranies } from "@/domain/catalogo";

/**
 * Los bloques de la confirmación que dependen del expediente: los cuatro
 * hitos, la banda del cobro, el inicio de cobertura, el resumen, los tres
 * descargables y el sondeo de la emisión.
 *
 * Dos cosas que esta pantalla **no** hace, y son las que más importan:
 *
 * - **No entrega la póliza ni la factura.** Las emite y las envía Alianza
 *   (SEBAOT y SIFEN) a los canales verificados; acá solo se muestra su estado.
 * - **No genera Nota de Cobertura.** El producto no la contempla, y la leyenda
 *   está a la vista. El Certificado de Cobertura Provisional es otra cosa
 *   (D-12): no compromete cobertura anticipada, constata un cobro ya hecho.
 */

interface DocumentoDescargable {
  readonly codigo: string;
  readonly version: number;
  readonly hashFirmado: string;
}

interface CertificadoDescargable {
  readonly codigo: string;
  readonly version: number;
  readonly hashSha256: string;
  readonly inicioCobertura: string;
  readonly finCobertura: string;
  readonly emitidoEn: string;
}

interface EntregaPorCanal {
  readonly canal: string;
  readonly destinoEnmascarado: string;
  readonly estado: string;
  readonly intentos: number;
  readonly proximoIntentoEn: string | null;
  readonly acusadaEn: string | null;
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
  readonly montoGs: number | null;
  readonly nombreAsegurado: string | null;
  readonly documentoEnmascarado: string | null;
  readonly whatsappEnmascarado: string | null;
  readonly correoEnmascarado: string | null;
  readonly firmadoEn: string | null;
  readonly pagoConfirmadoEn: string | null;
  readonly solicitudAceptadaEn: string;
  readonly documento: DocumentoDescargable;
  readonly certificado: CertificadoDescargable | null;
  readonly codigoComprobante: string;
}

const MENSAJES: Readonly<Record<string, string>> = {
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  EXPEDIENTE_NO_ENCONTRADO:
    "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
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

/**
 * Tarjeta de descarga. Los tres documentos entran por el mismo endpoint y se
 * distinguen por su código: el paquete firmado necesita `&firmado=1`, el
 * certificado y el comprobante no.
 *
 * `huella` es `null` en el comprobante, y la tarjeta lo refleja: no es un
 * instrumento con huella registrada, así que mostrar un SHA-256 al lado
 * afirmaría algo que no es (D-05).
 */
function TarjetaDescarga({
  nombre,
  detalle,
  codigo,
  firmado,
  huella,
  disponible,
  pendiente,
}: {
  nombre: string;
  detalle: string;
  codigo: string;
  firmado: boolean;
  huella: string | null;
  disponible: boolean;
  /** Qué decir mientras el archivo todavía no está. El certificado no lo usa:
   *  existe desde antes que la pantalla, porque nació con el cobro (D-12). */
  pendiente?: string;
}) {
  const url = `/api/p8/documento?codigo=${encodeURIComponent(codigo)}${
    firmado ? "&firmado=1" : ""
  }&descargar=1`;

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie-suave p-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-sm font-bold text-titulo">{nombre}</h3>
          <code className="font-mono text-xs font-semibold text-azul-700 dark:text-azul-200">
            {codigo}
          </code>
        </div>
        <p className="text-xs text-cuerpo">{detalle}</p>
      </div>

      {disponible ? (
        <a
          href={url}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-azul-300 px-4 text-xs font-bold tracking-wide text-azul-800 uppercase transition-colors hover:bg-azul-50 sm:self-start dark:border-azul-600 dark:text-azul-200 dark:hover:bg-azul-950"
        >
          {BOTON_DESCARGAR_P9}
        </a>
      ) : (
        <p className="text-xs text-etiqueta">{pendiente ?? "Preparando el archivo…"}</p>
      )}

      {huella ? (
        <p className="font-mono text-[11px] break-all text-etiqueta">SHA-256 {huella}</p>
      ) : null}
    </article>
  );
}

export function ContratacionAceptada() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [documentosDisponibles, setDocumentosDisponibles] = useState(false);
  const [estadoPoliza, setEstadoPoliza] = useState<string | null>(null);
  const [estadoFactura, setEstadoFactura] = useState<string | null>(null);
  const [referenciaFactura, setReferenciaFactura] = useState<string | null>(null);
  const [entregas, setEntregas] = useState<readonly EntregaPorCanal[]>([]);
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
          entregas?: readonly EntregaPorCanal[];
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
        setEntregas(datos.entregas ?? []);
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
      entregas?: readonly EntregaPorCanal[];
    };
    if (!datos.ok) return true;

    if (vigente.current) {
      setEstadoPoliza(datos.estadoPoliza ?? null);
      setEstadoFactura(datos.estadoFactura ?? null);
      setReferenciaFactura(datos.referenciaFactura ?? null);
      setEntregas(datos.entregas ?? []);
    }
    // Se deja de sondear cuando ya no queda nada por avanzar. La entrega cuenta
    // (CHG-44): cortar el sondeo con la póliza emitida dejaría una entrega en
    // cola sin nadie que la empuje, porque en el demo el despachador se cuelga
    // justo de este sondeo.
    const emision = datos.estadoPoliza === "EMITIDA" && datos.estadoFactura === "EMITIDA";
    const entregaTerminada = (datos.entregas ?? []).every(
      (entrega) => entrega.estado === "ACUSADO" || entrega.estado === "FALLIDO",
    );
    return emision && entregaTerminada;
  }, []);

  useEffect(() => {
    if (!resumen) return;
    const entregaTerminada = entregas.every(
      (entrega) => entrega.estado === "ACUSADO" || entrega.estado === "FALLIDO",
    );
    if (estadoPoliza === "EMITIDA" && estadoFactura === "EMITIDA" && entregaTerminada) return;

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
  }, [resumen, estadoPoliza, estadoFactura, entregas, sondear]);

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
  const certificado = resumen?.certificado ?? null;

  // Los tres primeros hitos están cumplidos al llegar acá —firma, cobro y
  // certificado nacen antes que esta pantalla—; el cuarto sigue el estado real
  // de la póliza en Alianza.
  const fechasHito: readonly (string | null)[] = [
    resumen?.firmadoEn ?? null,
    resumen?.pagoConfirmadoEn ?? null,
    certificado?.emitidoEn ?? null,
    resumen?.polizaEmitidaEn ?? null,
  ];

  const numeroWhatsapp = whatsappAtencion();
  const mostrarWhatsapp = whatsappHabilitadoEn("CONFIRMACION") && numeroWhatsapp !== null;

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------------------ */}
      {/* Banda del cobro (CHG-40) — lo primero que la persona quiere leer     */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-labelledby="p9-cobro"
        className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-verde-300 bg-verde-50 px-4 py-3 dark:border-verde-700 dark:bg-verde-950"
      >
        <h2 id="p9-cobro" className="text-sm font-bold text-verde-900 dark:text-verde-100">
          {TITULO_PAGO_CONFIRMADO_P9}
        </h2>
        <p className="text-sm text-verde-900 tabular-nums dark:text-verde-100">
          {ROTULO_PREMIO_PAGADO_P9}:{" "}
          <span className="font-bold">
            {resumen?.montoGs != null ? formatearGuaranies(resumen.montoGs) : "—"}
          </span>
          {" · "}
          {ROTULO_OPERACION_P9}{" "}
          <span className="font-bold">{resumen?.referenciaBancard ?? "—"}</span>
          {" · "}
          {hora(resumen?.pagoConfirmadoEn ?? null)}
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* ESTADO DE LA CONTRATACIÓN — un solo recuadro para los cuatro hitos   */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-labelledby="p9-estado"
        className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-3"
      >
        <h2
          id="p9-estado"
          className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
        >
          {TITULO_ESTADO_CONTRATACION}
        </h2>
        <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {HITOS_CONTRATACION.map((hito, indice) => {
            // El tercero cuelga del certificado y no del resumen: un expediente
            // legado, cobrado antes de D-12, llega acá sin certificado y ese
            // hito tiene que quedar sin tilde en vez de mentir.
            const cumplido =
              indice === 2 ? certificado !== null : indice < 3 ? resumen !== null : polizaEmitida;
            return (
              <li key={hito.numero} className="flex flex-col gap-0.5">
                <span
                  className={`text-xs font-bold ${
                    cumplido
                      ? "text-verde-700 dark:text-verde-300"
                      : "text-naranja-700 dark:text-naranja-300"
                  }`}
                >
                  {cumplido ? "✓" : "⋯"} {hito.titulo}
                </span>
                <span className="text-[11px] text-cuerpo">{hito.detalle}</span>
                <span className="text-[11px] text-etiqueta tabular-nums">
                  {hora(fechasHito[indice])}
                </span>
              </li>
            );
          })}
        </ol>

        {/* ---------------------------------------------------------------- */}
        {/* Inicio de la cobertura (CHG-41) — la fecha, no una promesa        */}
        {/* ---------------------------------------------------------------- */}
        {certificado ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-naranja-300 bg-naranja-50 px-3 py-2 dark:border-naranja-700 dark:bg-naranja-950">
            <h3 className="text-xs font-bold tracking-wide text-naranja-900 uppercase dark:text-naranja-100">
              {TITULO_INICIO_COBERTURA_P9}
            </h3>
            <p className="text-sm font-bold text-naranja-900 tabular-nums dark:text-naranja-100">
              {hora(certificado.inicioCobertura)}
            </p>
            <p className="text-[11px] text-naranja-900 dark:text-naranja-100">
              {DETALLE_INICIO_COBERTURA_P9} {ROTULO_FIN_VIGENCIA_P9}{" "}
              <span className="font-semibold tabular-nums">{hora(certificado.finCobertura)}</span>
            </p>
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Dos columnas: a la izquierda lo que la persona lee, a la derecha lo  */}
      {/* que se lleva. El reparto no es estético: la columna de documentos    */}
      {/* es la más larga, y repartir a ojo dejaba media carilla en blanco     */}
      {/* al lado de ella.                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          {/* ---------------------------------------------------------------- */}
          {/* RESUMEN DE LA CONTRATACIÓN                                        */}
          {/* ---------------------------------------------------------------- */}
          <section
            aria-labelledby="p9-resumen"
            className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4"
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
              <Fila
                rotulo={ROTULO_REFERENCIA_BANCARD_P9}
                valor={resumen?.referenciaBancard ?? "—"}
              />
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

          <section
            aria-labelledby="p9-comunicaciones"
            className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-4"
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

          {/* ---------------------------------------------------------------- */}
          {/* ¿QUÉ OCURRIRÁ AHORA?                                              */}
          {/* ---------------------------------------------------------------- */}
          <section
            aria-labelledby="p9-que-ocurrira"
            className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-4"
          >
            <h2
              id="p9-que-ocurrira"
              className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
            >
              {TITULO_QUE_OCURRIRA_P9}
            </h2>
            <ol className="flex flex-col gap-1">
              {PASOS_QUE_OCURRIRA_P9.map((paso, indice) => (
                <li key={paso} className="text-xs text-cuerpo">
                  <span className="font-bold text-etiqueta">{indice + 1} · </span>
                  {paso}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Documentos (columna derecha)                                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col gap-4">
          <section
            aria-labelledby="p9-descargar"
            className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-4"
          >
            <h2
              id="p9-descargar"
              className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
            >
              {TITULO_DOCUMENTOS_PARA_DESCARGAR}
            </h2>

            {resumen ? (
              <>
                {/* D-12 · el certificado va primero: es el que la persona
                    necesita tener a mano hasta que llegue la póliza. */}
                {certificado ? (
                  <TarjetaDescarga
                    nombre={NOMBRE_CERTIFICADO_P9}
                    detalle={DETALLE_CERTIFICADO_P9}
                    codigo={certificado.codigo}
                    firmado={false}
                    huella={certificado.hashSha256}
                    disponible
                  />
                ) : null}

                <TarjetaDescarga
                  nombre={NOMBRE_DOCUMENTO_P9}
                  detalle={DETALLE_FIRMANTES_P9}
                  codigo={resumen.documento.codigo}
                  firmado
                  huella={resumen.documento.hashFirmado}
                  disponible={documentosDisponibles}
                  pendiente="Preparando el archivo firmado…"
                />

                <TarjetaDescarga
                  nombre={NOMBRE_COMPROBANTE_P9}
                  detalle={DETALLE_COMPROBANTE_P9}
                  codigo={resumen.codigoComprobante}
                  firmado={false}
                  // Sin huella: el comprobante se genera al pedirlo y no es un
                  // instrumento con hash registrado (D-05).
                  huella={null}
                  disponible={certificado !== null}
                  pendiente="Disponible con el certificado de cobertura."
                />
              </>
            ) : (
              <p className="text-sm text-cuerpo">Preparando los documentos…</p>
            )}

            <p className="rounded-lg border border-borde-sutil bg-superficie-suave px-3 py-2 text-sm font-bold text-titulo">
              {LEYENDA_SIN_NOTA_DE_COBERTURA}
            </p>
          </section>

          <section
            aria-labelledby="p9-por-recibir"
            className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-4"
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

            {/* -------------------------------------------------------------- */}
            {/* A qué canales llegan (wireframe p.8)                            */}
            {/* -------------------------------------------------------------- */}
            <div className="flex flex-col gap-1 rounded-lg border border-azul-200 bg-azul-50 px-3 py-2 dark:border-azul-700 dark:bg-azul-950">
              <h3 className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                {TITULO_ENTREGA_P9}
              </h3>
              <p className="text-xs text-azul-900 dark:text-azul-100">{BAJADA_ENTREGA_P9}</p>
              {/* Enmascarados, como en toda la UI del flujo. */}
              <p className="text-xs font-semibold text-azul-900 dark:text-azul-100">
                {ROTULO_CANAL_CORREO_P9}: {resumen?.correoEnmascarado ?? "—"} ·{" "}
                {ROTULO_CANAL_WHATSAPP_P9}: {resumen?.whatsappEnmascarado ?? "—"}
              </p>

              {/* ---------------------------------------------------------- */}
              {/* CHG-44 · el estado real de cada envío, no una promesa       */}
              {/* ---------------------------------------------------------- */}
              {entregas.length > 0 ? (
                <ul className="flex flex-col gap-1 border-t border-azul-200 pt-1.5 dark:border-azul-700">
                  {entregas.map((entrega) => (
                    <li
                      key={entrega.canal}
                      className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-azul-900 dark:text-azul-100"
                    >
                      <span className="font-bold">
                        {entrega.canal === "WHATSAPP"
                          ? ROTULO_CANAL_WHATSAPP_P9
                          : ROTULO_CANAL_CORREO_P9}
                      </span>
                      <span>{entrega.destinoEnmascarado}</span>
                      <span
                        className={
                          entrega.estado === "ACUSADO"
                            ? "font-bold text-verde-700 dark:text-verde-300"
                            : entrega.estado === "FALLIDO"
                              ? "font-bold text-rojo-700 dark:text-rojo-300"
                              : "font-bold text-naranja-700 dark:text-naranja-300"
                        }
                      >
                        {entrega.estado === "ACUSADO" ? "✓ " : "⋯ "}
                        {ROTULO_ESTADO_ENTREGA[entrega.estado] ?? entrega.estado}
                      </span>
                      {/* El número de intento solo aparece cuando hubo más de
                          uno: en el camino normal es ruido. */}
                      {entrega.intentos > 1 && entrega.estado !== "ACUSADO" ? (
                        <span className="text-etiqueta">intento {entrega.intentos}</span>
                      ) : null}
                      {entrega.acusadaEn ? (
                        <span className="text-etiqueta tabular-nums">{hora(entrega.acusadaEn)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* La descarga sigue disponible, así que el aviso dice qué hacer
                  y no solo que algo salió mal. */}
              {entregas.some((entrega) => entrega.estado === "FALLIDO") ? (
                <p className="rounded border border-rojo-300 bg-rojo-50 px-2 py-1 text-[11px] font-semibold text-rojo-900 dark:border-rojo-700 dark:bg-rojo-950 dark:text-rojo-100">
                  {LEYENDA_ENTREGA_FALLIDA_P9}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ¿NECESITÁS AYUDA? — CHG-45, con el botón de WhatsApp de D-17         */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-labelledby="p9-ayuda"
        className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-4"
      >
        <h2
          id="p9-ayuda"
          className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
        >
          {TITULO_AYUDA_P9}
        </h2>
        <p className="text-sm text-cuerpo">{BAJADA_AYUDA_P9}</p>

        {/*
          D-17 · el botón directo a WhatsApp, solo en esta pantalla. Sin número
          configurado (D-19) no se dibuja: no se enlaza un WhatsApp inventado.
        */}
        {mostrarWhatsapp ? (
          <a
            href={enlaceWhatsapp(numeroWhatsapp, mensajeWhatsappP9(resumen?.numeroPropuesta ?? ""))}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-verde-600 px-5 text-xs font-bold tracking-wide text-white uppercase transition-colors hover:bg-verde-500 sm:self-start"
          >
            {BOTON_WHATSAPP_P9}
          </a>
        ) : null}

        <dl className="grid gap-2 lg:grid-cols-2">
          {contactosInstitucionales().map((contacto) => (
            <div
              key={contacto.entidad.razonSocial}
              className="flex flex-col gap-0.5 rounded-lg border border-borde-tenue bg-superficie-suave p-3"
            >
              <dt className="text-sm font-bold text-titulo">{contacto.entidad.razonSocial}</dt>
              <dd className="flex flex-col gap-0.5 text-xs text-cuerpo">
                <span className="font-semibold text-etiqueta">{contacto.rol}</span>
                <span>{contacto.entidad.domicilio}</span>
                {/*
                  Lo que D-19 todavía no cerró simplemente no aparece: un
                  `[dato pendiente]` a la vista de un cliente es peor que la
                  ausencia de la línea.
                */}
                {contacto.telefono ? <span>{contacto.telefono}</span> : null}
                {contacto.correo ? <span>{contacto.correo}</span> : null}
                <a
                  href={contacto.entidad.sitioWeb}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit font-semibold text-azul-700 underline underline-offset-2 dark:text-azul-300"
                >
                  {contacto.entidad.sitioWeb.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
