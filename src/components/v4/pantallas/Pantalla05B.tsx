"use client";

/**
 * 05B · Contratación confirmada. Etapa 5 de 5, la última del flujo.
 *
 * **05B no tiene arte aprobado.** `ANALISIS_VISUAL_PNG.md` §8 lo dice
 * explícito: *"04E (revisión y firma), 05A (pago) y 05B (confirmación) no
 * tienen arte y por D-41 no se implementan hasta tenerlo"*. Esta pantalla es
 * una excepción deliberada a esa regla, con el mismo encargo del 16-sep-2026
 * que ya destrabó 03E —candidato sin arte aprobado— según registra la
 * cabecera de `textos-actividad.ts`: *"empezá a implementar TODAS las
 * pantallas con el arte aprobado o pendiente"*. Es **provisional**: extrapola
 * el sistema visual de las pantallas ya aprobadas (tarjetas, avisos, hitos de
 * 03E2) y se rehace por completo en cuanto Interseguros mande el arte de 05B.
 *
 * Funcionalmente reproduce, con la piel v4, lo que ya hace
 * `src/app/(flujo)/confirmacion/ContratacionAceptada.tsx` en v2 (borrado el 16-sep-2026): la máquina de
 * estados no cambió con v4 (`CLAUDE.md` → "v4 es la versión del producto"), así
 * que esta pantalla consume los mismos tres endpoints con el mismo contrato:
 *
 * - `GET  /api/p9/resumen` — trae el resumen y, de paso, ordena la emisión
 *   (PAGO_CONFIRMADO → EMITIDO) y archiva los PDF firmados. Idempotente.
 * - `GET  /api/p9/estado` — sondeo del avance de Alianza (SEBAOT/SIFEN).
 * - `POST /api/p9/comunicaciones` — el consentimiento opcional de marketing.
 *
 * Los cuatro descargables posibles son los mismos de siempre y ninguno más
 * (D-05, D-12, D-27; "Reglas transversales de integraciones" del CLAUDE.md):
 * el paquete firmado, el Certificado de Cobertura Provisional, el comprobante
 * de pago y, solo con firma interna, la constancia del acto de firma. Esta
 * pantalla **no entrega la póliza ni la factura** —las emite y las envía
 * Alianza Garantía a los canales verificados— y **no genera Nota de
 * Cobertura**.
 *
 * Sobre D-42 (preliminar, 15-sep-2026): el CPC podría llegar a existir
 * "generado" antes de estar firmado por Alianza. El contrato de hoy no
 * distingue ese matiz —`resumen.certificado` es `null` hasta que el
 * certificado está cerrado y hasheado—, así que esta pantalla trata "sin
 * certificado" como "en preparación", que es lo único que el resumen permite
 * afirmar hoy sin inventar un campo que la API no devuelve.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatearGuaranies } from "@/domain/catalogo";
import { enlaceWhatsapp, whatsappAtencion, whatsappHabilitadoEn } from "@/domain/entidades";
import { TEXTO_COMUNICACIONES_COMERCIALES, mensajeWhatsappP9 } from "@/domain/textos-p9";
import { MENSAJES_05B, TEXTOS_05B } from "@/domain/v4/textos-confirmacion";
import { MarcoV4 } from "../MarcoV4";
import { BarraPlanV4 } from "../BarraPlanV4";
import { AccionesV4, DisposicionV4, EncabezadoV4, RejillaV4 } from "../disposicion";
import {
  AvisoAzulV4,
  BotonSecundarioV4,
  CasillaConsentimientoV4,
  FranjaVerdeV4,
  IconoChevronDerecha,
  IconoReloj,
  IconoTildeDisco,
} from "../piezas";
import { IconoCalendarioReloj, IconoEntregaDigital } from "../ilustraciones";
import { IconoConstanciaFirma, IconoRecibo, IlustracionConfirmacion } from "./ilustracion-05b";

/** Cada cuánto se pregunta si la póliza ya se emitió. */
const INTERVALO_SONDEO_MS = 5_000;

interface DocumentoDescargable {
  readonly codigo: string;
  readonly hashFirmado: string;
}

interface CertificadoDescargable {
  readonly codigo: string;
  readonly hashSha256: string;
  readonly inicioCobertura: string;
  readonly finCobertura: string;
}

interface ConstanciaDescargable {
  readonly codigo: string;
  readonly hashSha256: string;
}

interface Resumen {
  readonly numeroPropuesta: string;
  readonly numeroPoliza: string;
  readonly estadoPoliza: string;
  readonly whatsappEnmascarado: string | null;
  readonly correoEnmascarado: string | null;
  readonly firmadoEn: string | null;
  readonly pagoConfirmadoEn: string | null;
  readonly montoGs: number | null;
  readonly referenciaBancard: string | null;
  readonly documento: DocumentoDescargable;
  readonly certificado: CertificadoDescargable | null;
  readonly constancia: ConstanciaDescargable | null;
  readonly codigoComprobante: string;
}

function hora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PY");
}

/** Fila de hito, igual gramática que la lista de `PantallaRevisionManual` (03E2). */
function FilaHito({ concepto, estado, icono }: { readonly concepto: string; readonly estado: string; readonly icono: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
        {concepto}
      </span>
      <span className="flex items-center gap-2 text-[0.9375rem] font-semibold" style={{ color: "var(--v4-navy)" }}>
        {icono}
        {estado}
      </span>
    </div>
  );
}

/** Fila descargable, misma gramática que las tarjetas de producto de 01. */
function FilaDocumento({
  icono,
  nombre,
  detalle,
  href,
  disponible,
  pendiente,
}: {
  readonly icono: React.ReactNode;
  readonly nombre: string;
  readonly detalle: string;
  readonly href: string;
  readonly disponible: boolean;
  readonly pendiente: string;
}) {
  const contenido = (
    <>
      {icono}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-bold leading-tight" style={{ color: "var(--v4-navy)" }}>
          {nombre}
        </span>
        <span className="mt-0.5 block text-[0.8125rem]" style={{ color: "var(--v4-azul-apagado)" }}>
          {detalle}
        </span>
      </span>
    </>
  );

  if (!disponible) {
    return (
      <div
        aria-disabled="true"
        className="flex items-center gap-3 rounded-[10px] border px-3 py-3"
        style={{ background: "var(--v4-blanco)", borderColor: "var(--v4-gris-borde)" }}
      >
        {contenido}
        <span className="flex shrink-0 items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wide" style={{ color: "var(--v4-azul-apagado)" }}>
          <IconoReloj tamano={16} />
          {pendiente}
        </span>
      </div>
    );
  }

  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-[10px] border px-3 py-3"
      style={{ background: "var(--v4-azul-fondo)", borderColor: "var(--v4-azul-borde)" }}
    >
      {contenido}
      <span className="flex shrink-0 items-center gap-1 text-[0.75rem] font-bold uppercase tracking-wide" style={{ color: "var(--v4-azul)" }}>
        {TEXTOS_05B.botonDescargar}
        <IconoChevronDerecha tamano={16} color="var(--v4-azul)" />
      </span>
    </a>
  );
}

export function Pantalla05B() {
  const router = useRouter();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [documentosDisponibles, setDocumentosDisponibles] = useState(false);
  const [estadoPoliza, setEstadoPoliza] = useState<string | null>(null);
  const [comunicaciones, setComunicaciones] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vigente = useRef(true);
  useEffect(() => {
    vigente.current = true;
    return () => {
      vigente.current = false;
    };
  }, []);

  // Reintentable a propósito: varios motivos de `GET /api/p9/resumen` son
  // transitorios —`COBRO_NO_CONFIRMADO`, `FIRMA_CORREDOR_PENDIENTE` (D-38/D-42:
  // cobrado, esperando la firma cualificada de Interseguros),
  // `SEBAOT_NO_DISPONIBLE`— y un error sin botón dejaría a la persona
  // recargando a ciegas. El endpoint es idempotente, así que reintentar es
  // gratis.
  const cargarResumen = useCallback(async () => {
    setError(null);
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
        setError(MENSAJES_05B[datos.motivo ?? ""] ?? MENSAJES_05B.ERROR_GENERICO);
        return;
      }
      setResumen(datos.resumen);
      setDocumentosDisponibles(datos.documentosDisponibles === true);
      setEstadoPoliza(datos.resumen.estadoPoliza);
    } catch {
      if (vigente.current) setError(MENSAJES_05B.SEBAOT_NO_DISPONIBLE);
    }
  }, []);

  useEffect(() => {
    void cargarResumen();
  }, [cargarResumen]);

  const sondear = useCallback(async (): Promise<boolean> => {
    const respuesta = await fetch("/api/p9/estado");
    const datos = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; estadoPoliza?: string };
    if (!datos.ok) return true;
    if (vigente.current) setEstadoPoliza(datos.estadoPoliza ?? null);
    return datos.estadoPoliza === "EMITIDA";
  }, []);

  useEffect(() => {
    if (!resumen || estadoPoliza === "EMITIDA") return;
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
  }, [resumen, estadoPoliza, sondear]);

  async function cambiarComunicaciones(acepta: boolean) {
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

  async function finalizar() {
    try {
      await fetch("/api/flujo/cerrar", { method: "POST" });
    } finally {
      router.push("/");
    }
  }

  const numeroWhatsapp = whatsappAtencion();
  const mostrarWhatsapp = whatsappHabilitadoEn("CONFIRMACION") && numeroWhatsapp !== null;
  const certificado = resumen?.certificado ?? null;
  const polizaEmitida = estadoPoliza === "EMITIDA";

  if (error) {
    return (
      <MarcoV4 codigo="05B">
        <div className="lg:max-w-prose">
          <h1 className="v4-titular">
            {TEXTOS_05B.titulo}
            <br />
            <em>{TEXTOS_05B.tituloAcento}</em>
          </h1>
          <div className="mt-4">
            <p className="v4-error-campo" role="alert">
              {error}
            </p>
          </div>
          <div className="mt-4">
            <BotonSecundarioV4 onClick={() => void cargarResumen()}>
              {TEXTOS_05B.botonReintentar}
            </BotonSecundarioV4>
          </div>
        </div>
      </MarcoV4>
    );
  }

  return (
    <MarcoV4 codigo="05B">
      <DisposicionV4
        contexto={
          <>
            <EncabezadoV4
              titulo={TEXTOS_05B.titulo}
              acento={TEXTOS_05B.tituloAcento}
              bajada={TEXTOS_05B.bajada}
              ilustracion={<IlustracionConfirmacion tamano={104} className="shrink-0" />}
            />
            <BarraPlanV4 className="mt-4" />
          </>
        }
      >
        <div className="mt-4">
          <FranjaVerdeV4>
            {TEXTOS_05B.franjaPago}{" "}
            {resumen?.montoGs != null
              ? `${TEXTOS_05B.rotuloPremio}: ${formatearGuaranies(resumen.montoGs)}.`
              : null}
          </FranjaVerdeV4>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* ESTADO DE LA SOLICITUD + TU COBERTURA — lado a lado en escritorio */}
        {/* ------------------------------------------------------------ */}
        <RejillaV4 columnas={2} className="mt-4 items-stretch">
          <section className="v4-tarjeta p-4">
            <h2 className="text-[1.125rem] font-bold uppercase" style={{ color: "var(--v4-navy)" }}>
              {TEXTOS_05B.tituloEstado}
            </h2>
            <div className="mt-2">
              <FilaHito
                concepto={TEXTOS_05B.filas.datos.concepto}
                estado={TEXTOS_05B.filas.datos.estado}
                icono={<IconoTildeDisco tamano={22} />}
              />
              <FilaHito
                concepto={TEXTOS_05B.filas.firma.concepto}
                estado={TEXTOS_05B.filas.firma.estado}
                icono={<IconoTildeDisco tamano={22} />}
              />
              <FilaHito
                concepto={TEXTOS_05B.filas.pago.concepto}
                estado={TEXTOS_05B.filas.pago.estado}
                icono={<IconoTildeDisco tamano={22} />}
              />
              <FilaHito
                concepto={TEXTOS_05B.filas.solicitud.concepto}
                estado={TEXTOS_05B.filas.solicitud.estado}
                icono={<IconoTildeDisco tamano={22} />}
              />
              <FilaHito
                concepto={TEXTOS_05B.filas.polizaConcepto}
                estado={
                  polizaEmitida
                    ? TEXTOS_05B.filas.polizaEmitida(resumen?.numeroPoliza ?? "—")
                    : TEXTOS_05B.filas.polizaEnPreparacion
                }
                icono={polizaEmitida ? <IconoTildeDisco tamano={22} /> : <IconoReloj tamano={22} />}
              />
            </div>
            <div className="mt-3 h-px" style={{ background: "var(--v4-gris-borde)" }} />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                {TEXTOS_05B.etiquetaPropuesta}
              </span>
              <span className="text-[0.9375rem] font-bold" style={{ color: "var(--v4-navy)" }}>
                {resumen?.numeroPropuesta ?? "—"}
              </span>
            </div>
          </section>

          <section className="v4-tarjeta-azul p-4">
            <h2 className="text-[1.125rem] font-bold uppercase" style={{ color: "var(--v4-navy)" }}>
              {TEXTOS_05B.tituloCobertura}
            </h2>
            {certificado ? (
              <>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                    {TEXTOS_05B.etiquetaInicio}
                  </span>
                  <span className="text-[0.9375rem] font-bold tabular-nums" style={{ color: "var(--v4-navy)" }}>
                    {hora(certificado.inicioCobertura)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                    {TEXTOS_05B.etiquetaFin}
                  </span>
                  <span className="text-[0.9375rem] font-bold tabular-nums" style={{ color: "var(--v4-navy)" }}>
                    {hora(certificado.finCobertura)}
                  </span>
                </div>
                <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                  {TEXTOS_05B.detalleInicio}
                </p>
              </>
            ) : (
              <p className="mt-2 flex items-center gap-2 text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                <IconoReloj tamano={18} />
                {TEXTOS_05B.certificadoPendiente}
              </p>
            )}
            {resumen?.whatsappEnmascarado && resumen.correoEnmascarado ? (
              <p className="mt-3 text-[0.8125rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                {TEXTOS_05B.entregaCanales(resumen.whatsappEnmascarado, resumen.correoEnmascarado)}
              </p>
            ) : null}
            <p className="mt-3 text-[0.875rem] font-bold" style={{ color: "var(--v4-navy)" }}>
              {TEXTOS_05B.leyendaSinNotaCobertura}
            </p>
          </section>
        </RejillaV4>

        {/* ------------------------------------------------------------ */}
        {/* TUS DOCUMENTOS — dos columnas en escritorio                    */}
        {/* ------------------------------------------------------------ */}
        <section className="mt-4">
          <h2 className="v4-rotulo">{TEXTOS_05B.tituloDocumentos}</h2>
          {resumen ? (
            <RejillaV4 columnas={2} className="mt-3 items-stretch">
              <FilaDocumento
                icono={<IconoEntregaDigital tamano={30} />}
                nombre={TEXTOS_05B.documentos.paquete.nombre}
                detalle={TEXTOS_05B.documentos.paquete.detalle}
                href={`/api/p8/documento?codigo=${encodeURIComponent(resumen.documento.codigo)}&firmado=1&descargar=1`}
                disponible={documentosDisponibles}
                pendiente={TEXTOS_05B.documentos.paquete.pendiente}
              />
              <FilaDocumento
                icono={<IconoCalendarioReloj tamano={30} />}
                nombre={TEXTOS_05B.documentos.certificado.nombre}
                detalle={TEXTOS_05B.documentos.certificado.detalle}
                href={certificado ? `/api/p8/documento?codigo=${encodeURIComponent(certificado.codigo)}&descargar=1` : "#"}
                disponible={certificado !== null}
                pendiente={TEXTOS_05B.documentos.certificado.pendiente}
              />
              <FilaDocumento
                icono={<IconoRecibo tamano={30} />}
                nombre={TEXTOS_05B.documentos.comprobante.nombre}
                detalle={TEXTOS_05B.documentos.comprobante.detalle}
                href={`/api/p8/documento?codigo=${encodeURIComponent(resumen.codigoComprobante)}&descargar=1`}
                disponible={certificado !== null}
                pendiente={TEXTOS_05B.documentos.comprobante.pendiente}
              />
              {resumen.constancia ? (
                <FilaDocumento
                  icono={<IconoConstanciaFirma tamano={30} />}
                  nombre={TEXTOS_05B.documentos.constancia.nombre}
                  detalle={TEXTOS_05B.documentos.constancia.detalle}
                  href={`/api/p8/documento?codigo=${encodeURIComponent(resumen.constancia.codigo)}&descargar=1`}
                  disponible
                  pendiente=""
                />
              ) : null}
            </RejillaV4>
          ) : (
            <p className="mt-3 text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
              Preparando los documentos…
            </p>
          )}
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Comunicaciones comerciales — opcional, desmarcado por defecto  */}
        {/* ------------------------------------------------------------ */}
        <section className="v4-tarjeta mt-4 p-4">
          <h2 className="v4-rotulo" style={{ fontSize: "0.875rem" }}>
            {TEXTOS_05B.tituloComunicaciones}
          </h2>
          <div className="mt-2">
            <CasillaConsentimientoV4
              marcada={comunicaciones}
              alCambiar={(valor) => void cambiarComunicaciones(valor)}
              id="comunicaciones-comerciales"
            >
              {TEXTO_COMUNICACIONES_COMERCIALES}
            </CasillaConsentimientoV4>
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* ¿Necesitás ayuda? — D-17                                       */}
        {/* ------------------------------------------------------------ */}
        <section className="v4-tarjeta mt-4 p-4">
          <h2 className="v4-rotulo" style={{ fontSize: "0.875rem" }}>
            {TEXTOS_05B.tituloAyuda}
          </h2>
          <p className="mt-1 text-[0.875rem]" style={{ color: "var(--v4-azul-apagado)" }}>
            {TEXTOS_05B.bajadaAyuda}
          </p>
          {mostrarWhatsapp ? (
            <a
              href={enlaceWhatsapp(numeroWhatsapp, mensajeWhatsappP9(resumen?.numeroPropuesta ?? ""))}
              target="_blank"
              rel="noreferrer"
              className="v4-boton mt-3 lg:w-auto lg:min-w-[16rem]"
              style={{ background: "var(--v4-verde)", borderColor: "var(--v4-verde)", color: "var(--v4-blanco)" }}
            >
              {TEXTOS_05B.botonWhatsapp}
            </a>
          ) : null}
        </section>

        <AvisoAzulV4 className="mt-4 lg:max-w-prose">{TEXTOS_05B.leyendaCierre}</AvisoAzulV4>

        <AccionesV4 className="mt-5">
          <BotonSecundarioV4 onClick={() => void finalizar()}>{TEXTOS_05B.botonFinalizar}</BotonSecundarioV4>
        </AccionesV4>
      </DisposicionV4>
    </MarcoV4>
  );
}
