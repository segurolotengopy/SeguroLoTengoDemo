"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AVISO_CAPTURA_PENDIENTE_P8,
  AVISO_ENLACE_ENVIADO_P8,
  AVISO_FIRMA_RECHAZADA_P8,
  AVISO_PLAZO_RESTANTE_P8,
  AVISO_PLAZO_VENCIDO_P8,
  BADGE_DATOS_VERIFICADOS_P8,
  BOTON_DESCARGAR_P8,
  BOTON_ENVIAR_ENLACE_P8,
  BOTON_VER_PDF_P8,
  CANAL_FIRMA_POR_DEFECTO,
  DESCRIPCION_FIPF_P8,
  DESCRIPCION_SOLICITUD_P8,
  ENLACES_ACCESO_PREVIO_P8,
  ESTADO_ESPERANDO_CODE100_P8,
  MARCA_PDF_CERRADO_P8,
  NOMBRE_FIPF_P8,
  NOMBRE_SOLICITUD_P8,
  NOTA_ACEPTACION_REGISTRADA_P8,
  NOTA_ENVIO_ENLACE_P8,
  NOTA_GARANTIA_SIN_DATOS_NUEVOS_P8,
  NOTA_SEGUIMIENTO_Y_VENCIMIENTO_P8,
  NOTA_SIN_MODIFICACION_P8,
  PASOS_PROGRESO_FIRMA_P8,
  ROTULO_CANAL_P8,
  SUBTITULO_BLOQUE_CANAL_P8,
  TEXTO_DECLARACION_FIRMA_P8,
  TEXTO_UN_SOLO_ACTO_P8,
  TITULO_ACCESO_PREVIO_P8,
  TITULO_BLOQUE_CANAL_P8,
  TITULO_BLOQUE_DOCUMENTOS_P8,
  TITULO_BLOQUE_FIRMA_P8,
  TITULO_DECLARACION_FIRMA_P8,
  TITULO_GARANTIA_PAGO_P8,
  TITULO_UN_SOLO_ACTO_P8,
} from "@/domain/textos-p8";
import { TEXTOS_MEDIOS_DE_PAGO_P7 } from "@/domain/textos-p7";
import type { CanalFirma, MedioDePago } from "@/domain/tipos";
import { PanelFirmadorSimulado } from "./PanelFirmadorSimulado";

/**
 * Bloques 1, 2 y 3 de P8 · Revisión y firma final.
 *
 * Lo que esta pantalla **no** hace, y es lo importante: no firma. El botón
 * pide un enlace; la aceptación contractual ocurre del otro lado, en Code100,
 * con el OTP de firma que la persona tipea allá. Por eso acá no hay ningún
 * campo de código: el tercer OTP del flujo no pasa por SeguroLoTengo (regla
 * inviolable #2), y mientras tanto la pantalla solo sondea.
 *
 * El plazo se muestra como cuenta regresiva, pero quien vence el expediente es
 * el servidor: al llegar a cero se le pide que evalúe `plazoFirmaVenceEn`
 * contra su propio reloj. Adelantar la hora del navegador no adelanta nada.
 */

interface DocumentoVisible {
  readonly codigo: string;
  readonly version: number;
  readonly hashSha256: string;
  readonly cerradoEn: string;
}

interface ActoVisible {
  readonly idCode100: string;
  readonly canal: CanalFirma;
  readonly destinoEnmascarado: string;
  readonly enlaceEnviadoEn: string;
  readonly venceEn: string;
}

interface Resumen {
  readonly estado: string;
  readonly numeroPropuesta: string | null;
  readonly solicitud: DocumentoVisible;
  readonly fipf: DocumentoVisible;
  readonly canalWhatsappEnmascarado: string | null;
  readonly canalEmailEnmascarado: string | null;
  readonly garantia: {
    readonly medio: MedioDePago;
    readonly lista: boolean;
    readonly pagoDefinitivo: boolean;
    readonly referenciaBancard: string | null;
  } | null;
  readonly plazoFirmaVenceEn: string | null;
  readonly acto: ActoVisible | null;
  readonly firmadoEn: string | null;
}

interface RespuestaEstado {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly detalle?: string;
  readonly firmado?: boolean;
  readonly enlaceAbierto?: boolean;
  readonly capturaPendiente?: boolean;
  readonly siguientePantalla?: string;
}

const MENSAJES: Readonly<Record<string, string>> = {
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  ESTADO_INVALIDO: "Este proceso ya no está en el paso de firma.",
  PLAZO_VENCIDO: AVISO_PLAZO_VENCIDO_P8,
  CANAL_INVALIDO: "Elegí uno de los canales verificados.",
  CANAL_NO_VERIFICADO: "Ese canal no está verificado en este expediente.",
  PAQUETE_NO_GENERADO: "Todavía estamos preparando la Solicitud y el FIPF. Recargá en unos segundos.",
  GARANTIA_PAGO_NO_LISTA: "Todavía no hay una garantía de pago lista. Volvé al paso de pago.",
  CODE100_NO_DISPONIBLE: "Code100 no respondió. Volvé a intentar en unos segundos.",
  CODE100_RECHAZO: "Code100 rechazó la apertura del acto de firma.",
  FIRMA_NO_INICIADA: "Todavía no pediste el enlace de firma.",
  FIRMA_NO_COMPLETADA: AVISO_FIRMA_RECHAZADA_P8,
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};

/** Cada cuánto se le pregunta a Code100 si la persona ya firmó. */
const INTERVALO_SONDEO_MS = 2_000;

function formatearRestante(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const dosDigitos = (n: number) => n.toString().padStart(2, "0");
  return `${dosDigitos(horas)}:${dosDigitos(minutos)}:${dosDigitos(segundos)}`;
}

function TarjetaDocumento({
  nombre,
  descripcion,
  documento,
}: {
  nombre: string;
  descripcion: string;
  documento: DocumentoVisible;
}) {
  const url = `/api/p8/documento?codigo=${encodeURIComponent(documento.codigo)}`;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie-suave p-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-sm font-bold text-titulo">{nombre}</h3>
          <code className="font-mono text-xs font-semibold text-azul-700 dark:text-azul-200">
            {documento.codigo}
          </code>
        </div>
        <p className="text-sm text-cuerpo">{descripcion}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-azul-300 px-4 text-xs font-bold tracking-wide text-azul-800 uppercase transition-colors hover:bg-azul-50 dark:border-azul-600 dark:text-azul-200 dark:hover:bg-azul-950"
        >
          {BOTON_VER_PDF_P8}
        </a>
        <a
          href={`${url}&descargar=1`}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-borde-sutil px-4 text-xs font-bold tracking-wide text-cuerpo uppercase transition-colors hover:bg-superficie"
        >
          {BOTON_DESCARGAR_P8}
        </a>
      </div>

      <div className="flex flex-col gap-1 border-t border-borde-tenue pt-2">
        <p className="text-xs font-semibold text-verde-700 dark:text-verde-300">
          🔒 {MARCA_PDF_CERRADO_P8} · v{documento.version}
        </p>
        <p className="font-mono text-[11px] break-all text-etiqueta">
          SHA-256 {documento.hashSha256}
        </p>
      </div>
    </article>
  );
}

export interface FirmaP8Props {
  /**
   * `true` si el firmador simulado está disponible (`DEMO_MODE=true`). Lo
   * resuelve el servidor y baja como prop: la pantalla no lee variables de
   * entorno, y con el flag apagado el chunk del modal no se descarga nunca.
   */
  readonly firmadorSimuladoDisponible?: boolean;
}

export function FirmaP8({ firmadorSimuladoDisponible = false }: FirmaP8Props = {}) {
  const router = useRouter();

  const [firmadorAbierto, setFirmadorAbierto] = useState(false);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [canal, setCanal] = useState<CanalFirma>(CANAL_FIRMA_POR_DEFECTO);
  const [acto, setActo] = useState<ActoVisible | null>(null);
  const [enlaceAbierto, setEnlaceAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [firmado, setFirmado] = useState(false);
  const [capturaPendiente, setCapturaPendiente] = useState(false);
  const [restanteMs, setRestanteMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Evita que un sondeo en vuelo escriba estado después de desmontar.
  const vigente = useRef(true);
  useEffect(() => {
    vigente.current = true;
    return () => {
      vigente.current = false;
    };
  }, []);

  const irAPantallaB = useCallback(() => {
    router.push("/solicitud-vencida");
  }, [router]);

  useEffect(() => {
    void (async () => {
      try {
        const respuesta = await fetch("/api/p8/resumen");
        const datos = (await respuesta.json().catch(() => ({}))) as {
          ok?: boolean;
          motivo?: string;
          siguientePantalla?: string;
          resumen?: Resumen;
        };
        if (!vigente.current) return;

        if (!datos.ok) {
          if (datos.siguientePantalla) {
            irAPantallaB();
            return;
          }
          setError(MENSAJES[datos.motivo ?? ""] ?? MENSAJES.CUERPO_INVALIDO);
          return;
        }
        if (!datos.resumen) return;

        setResumen(datos.resumen);
        setActo(datos.resumen.acto);
        if (datos.resumen.acto) setCanal(datos.resumen.acto.canal);
        else if (!datos.resumen.canalWhatsappEnmascarado) setCanal("EMAIL");
        if (datos.resumen.firmadoEn) setFirmado(true);
      } catch {
        if (vigente.current) setError(MENSAJES.CODE100_NO_DISPONIBLE);
      }
    })();
  }, [irAPantallaB]);

  // Cuenta regresiva del plazo para firmar.
  useEffect(() => {
    const vence = resumen?.plazoFirmaVenceEn;
    if (!vence || firmado) return;

    let cancelado = false;
    const recalcular = () => {
      if (cancelado) return;
      setRestanteMs(new Date(vence).getTime() - Date.now());
    };

    recalcular();
    const temporizador = setInterval(recalcular, 1_000);
    return () => {
      cancelado = true;
      clearInterval(temporizador);
    };
  }, [resumen?.plazoFirmaVenceEn, firmado]);

  // La cuenta llegó a cero: se le pide al servidor que evalúe el plazo. El que
  // decide sigue siendo él, contra su propio reloj.
  useEffect(() => {
    if (restanteMs === null || restanteMs > 0 || firmado) return;

    let cancelado = false;
    void (async () => {
      try {
        const respuesta = await fetch("/api/p8/vencimiento", { method: "POST" });
        const datos = (await respuesta.json().catch(() => ({}))) as {
          ok?: boolean;
          vencio?: boolean;
        };
        if (cancelado || !vigente.current) return;
        if (datos.ok && datos.vencio) irAPantallaB();
      } catch {
        // Se reintenta con el próximo tick del contador.
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [restanteMs, firmado, irAPantallaB]);

  const sondear = useCallback(async (): Promise<boolean> => {
    const respuesta = await fetch("/api/p8/estado");
    const datos = (await respuesta.json().catch(() => ({}))) as RespuestaEstado;

    if (!datos.ok) {
      if (datos.siguientePantalla) {
        irAPantallaB();
        return true;
      }
      if (vigente.current) {
        setError(MENSAJES[datos.motivo ?? ""] ?? MENSAJES.CUERPO_INVALIDO);
        // Un acto rechazado o vencido deja de existir: se puede pedir otro.
        if (datos.motivo === "FIRMA_NO_COMPLETADA") setActo(null);
      }
      return true; // deja de sondear: el motivo no se resuelve esperando
    }

    if (!datos.firmado) {
      if (vigente.current) setEnlaceAbierto(datos.enlaceAbierto === true);
      return false;
    }

    // Firmado, pero con la captura de la preautorización todavía sin cerrar:
    // no se pasa a P9. La emisión no se pide sin cobro confirmado (fila 44 de
    // la matriz de cumplimiento), y cada sondeo reintenta la captura, que es
    // idempotente por `referenciaBancard`. `firmado` se deja en `false` a
    // propósito: es lo que mantiene vivo el sondeo.
    if (datos.capturaPendiente === true) {
      if (vigente.current) setCapturaPendiente(true);
      return false;
    }

    if (vigente.current) {
      setCapturaPendiente(false);
      setFirmado(true);
      setError(null);
      router.push(datos.siguientePantalla ?? "/p9-confirmacion");
    }
    return true;
  }, [irAPantallaB, router]);

  // Sondeo mientras hay un acto de firma abierto y sin confirmar.
  useEffect(() => {
    if (!acto || firmado) return;

    let cancelado = false;
    const temporizador = setInterval(() => {
      void (async () => {
        if (cancelado) return;
        try {
          const terminado = await sondear();
          if (terminado) clearInterval(temporizador);
        } catch {
          // Un sondeo perdido no es un error de la pantalla: sigue el próximo.
        }
      })();
    }, INTERVALO_SONDEO_MS);

    return () => {
      cancelado = true;
      clearInterval(temporizador);
    };
  }, [acto, firmado, sondear]);

  async function enviarEnlace() {
    if (enviando || !resumen?.garantia?.lista) return;

    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/p8/firma", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Solo el canal: el destino lo resuelve el servidor desde el
        // expediente, nunca desde acá.
        body: JSON.stringify({ canal }),
      });
      const datos = (await respuesta.json().catch(() => ({}))) as {
        ok?: boolean;
        motivo?: string;
        siguientePantalla?: string;
        acto?: ActoVisible;
      };

      if (!datos.ok) {
        if (datos.siguientePantalla) {
          irAPantallaB();
          return;
        }
        setError(MENSAJES[datos.motivo ?? ""] ?? MENSAJES.CUERPO_INVALIDO);
        return;
      }

      setActo(datos.acto ?? null);
      setEnlaceAbierto(false);
    } catch {
      setError(MENSAJES.CODE100_NO_DISPONIBLE);
    } finally {
      setEnviando(false);
    }
  }

  const canales: readonly { readonly canal: CanalFirma; readonly destino: string }[] = [
    ...(resumen?.canalWhatsappEnmascarado
      ? [{ canal: "WHATSAPP" as const, destino: resumen.canalWhatsappEnmascarado }]
      : []),
    ...(resumen?.canalEmailEnmascarado
      ? [{ canal: "EMAIL" as const, destino: resumen.canalEmailEnmascarado }]
      : []),
  ];

  const textoMedio = TEXTOS_MEDIOS_DE_PAGO_P7.find(
    (opcion) => opcion.medio === resumen?.garantia?.medio,
  );

  // Paso 1 apenas se envía el enlace; paso 2 cuando Code100 informa que la
  // persona lo abrió y le pidió el OTP de firma; paso 3 al confirmarse.
  const pasoActual = firmado ? 3 : acto ? (enlaceAbierto ? 2 : 1) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* En pantallas anchas: documentos y canal a la izquierda, el acto de
          firma de Code100 a la derecha con el botón a la vista. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------------------ */}
      {/* Bloque 1 — Revisá los documentos                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_BLOQUE_DOCUMENTOS_P8}
          </h2>
          <span className="rounded-full bg-verde-100 px-3 py-1 text-[11px] font-bold tracking-wide text-verde-800 uppercase dark:bg-verde-900 dark:text-verde-200">
            {BADGE_DATOS_VERIFICADOS_P8}
          </span>
        </div>

        {resumen ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <TarjetaDocumento
              nombre={NOMBRE_SOLICITUD_P8}
              descripcion={DESCRIPCION_SOLICITUD_P8}
              documento={resumen.solicitud}
            />
            <TarjetaDocumento
              nombre={NOMBRE_FIPF_P8}
              descripcion={DESCRIPCION_FIPF_P8}
              documento={resumen.fipf}
            />
          </div>
        ) : (
          <p className="text-sm text-cuerpo">Preparando la Solicitud y el FIPF…</p>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-azul-200 bg-azul-50 px-4 py-3 dark:border-azul-700 dark:bg-azul-950">
          <h3 className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_ACCESO_PREVIO_P8}
          </h3>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {ENLACES_ACCESO_PREVIO_P8.map((enlace) => (
              <li key={enlace}>
                <a
                  href="/p2-plan"
                  className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
                >
                  {enlace}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-azul-900 dark:text-azul-100">{NOTA_SIN_MODIFICACION_P8}</p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Bloque 2 — Elegí el canal                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_BLOQUE_CANAL_P8}
          </h2>
          <p className="text-xs text-cuerpo">{SUBTITULO_BLOQUE_CANAL_P8}</p>
        </div>

        <fieldset className="flex flex-col gap-2" disabled={acto !== null || firmado}>
          <legend className="sr-only">{TITULO_BLOQUE_CANAL_P8}</legend>
          {canales.map((opcion) => (
            <label
              key={opcion.canal}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                canal === opcion.canal
                  ? "border-naranja-500 bg-naranja-50 dark:bg-naranja-950"
                  : "border-borde-sutil hover:bg-superficie-suave"
              }`}
            >
              <input
                type="radio"
                name="p8-canal"
                value={opcion.canal}
                checked={canal === opcion.canal}
                onChange={() => setCanal(opcion.canal)}
                className="size-4 accent-naranja-500"
              />
              <span className="text-sm font-semibold text-titulo">
                {ROTULO_CANAL_P8[opcion.canal]}{" "}
                <span className="font-normal text-cuerpo tabular-nums">{opcion.destino}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2 rounded-lg border border-verde-300 bg-verde-50 px-4 py-3 dark:border-verde-700 dark:bg-verde-950">
          <h3 className="text-[11px] font-bold tracking-wide text-verde-800 uppercase dark:text-verde-200">
            {TITULO_GARANTIA_PAGO_P8}
          </h3>
          <p className="text-sm text-verde-900 dark:text-verde-100">
            {resumen?.garantia
              ? `${textoMedio?.titulo ?? resumen.garantia.medio} — ${
                  resumen.garantia.pagoDefinitivo ? "pagado" : "preautorizado"
                }.`
              : "Verificando la garantía de pago…"}
          </p>
          <p className="text-xs italic text-verde-900 dark:text-verde-100">
            {NOTA_GARANTIA_SIN_DATOS_NUEVOS_P8}
          </p>
        </div>

        <div className="flex flex-col gap-1 rounded-lg border border-borde-sutil bg-superficie-suave px-3 py-2.5">
          <h3 className="text-[11px] font-bold tracking-wide text-etiqueta uppercase">
            {TITULO_UN_SOLO_ACTO_P8}
          </h3>
          <p className="text-xs text-cuerpo">{TEXTO_UN_SOLO_ACTO_P8}</p>
        </div>
      </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bloque 3 — Firmá mediante Code100 (columna derecha)                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          {TITULO_BLOQUE_FIRMA_P8}
        </h2>

        <div className="flex flex-col gap-2 rounded-lg border border-azul-200 bg-azul-50 px-4 py-3 dark:border-azul-700 dark:bg-azul-950">
          <h3 className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_DECLARACION_FIRMA_P8}
          </h3>
          <p className="text-sm text-azul-900 dark:text-azul-100">{TEXTO_DECLARACION_FIRMA_P8}</p>
          <p className="text-xs font-semibold text-azul-900 dark:text-azul-100">
            {NOTA_ACEPTACION_REGISTRADA_P8}
          </p>
        </div>

        {resumen?.plazoFirmaVenceEn && !firmado ? (
          <p className="text-sm font-semibold text-naranja-700 dark:text-naranja-300">
            {AVISO_PLAZO_RESTANTE_P8}:{" "}
            <span className="tabular-nums">{formatearRestante(restanteMs ?? 0)}</span>
          </p>
        ) : null}

        <button
          type="button"
          onClick={enviarEnlace}
          disabled={enviando || firmado || acto !== null || !resumen?.garantia?.lista}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:opacity-40"
        >
          {enviando ? "Enviando…" : BOTON_ENVIAR_ENLACE_P8}
        </button>
        <p className="text-xs text-etiqueta">{NOTA_ENVIO_ENLACE_P8}</p>

        {acto ? (
          <p role="status" className="text-sm font-semibold text-verde-700 dark:text-verde-300">
            {AVISO_ENLACE_ENVIADO_P8} ({ROTULO_CANAL_P8[acto.canal]} {acto.destinoEnmascarado})
          </p>
        ) : null}

        {/* Progreso de tres pasos */}
        <ol className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie-suave p-4 sm:flex-row sm:items-center sm:gap-4">
          {PASOS_PROGRESO_FIRMA_P8.map((paso, indice) => {
            const numero = indice + 1;
            const cumplido = pasoActual >= numero;
            return (
              <li key={paso} className="flex flex-1 items-center gap-2">
                <span
                  aria-hidden
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    cumplido
                      ? "bg-verde-600 text-white"
                      : "bg-superficie text-etiqueta ring-1 ring-borde-sutil"
                  }`}
                >
                  {numero}
                </span>
                <span
                  className={`text-sm ${cumplido ? "font-semibold text-titulo" : "text-etiqueta"}`}
                >
                  {paso}
                </span>
              </li>
            );
          })}
        </ol>

        {acto && !firmado && !capturaPendiente ? (
          <p aria-live="polite" className="text-sm text-cuerpo">
            ⏳ {ESTADO_ESPERANDO_CODE100_P8}
            <span className="block font-mono text-xs text-etiqueta">ID {acto.idCode100}</span>
          </p>
        ) : null}

        {/* Atajo de demostración: abre la ventana del firmador acá mismo en
            vez de obligar a pasar por el panel de demo. Solo con DEMO_MODE. */}
        {firmadorSimuladoDisponible && acto && !firmado ? (
          <div className="flex flex-col gap-1 rounded-lg border border-dashed border-naranja-400 bg-naranja-50 px-3 py-2.5 dark:border-naranja-600 dark:bg-naranja-950">
            <p className="text-[11px] font-bold tracking-wide text-naranja-900 uppercase dark:text-naranja-200">
              Solo demostración
            </p>
            <p className="text-xs text-naranja-900 dark:text-naranja-100">
              En el servicio real abrís el enlace que te llegó por{" "}
              {ROTULO_CANAL_P8[acto.canal]} y firmás en el sitio de Code100. Acá podés abrir esa
              misma ventana sin salir de la demostración.
            </p>
            <button
              type="button"
              onClick={() => setFirmadorAbierto(true)}
              className="mt-1 inline-flex h-10 items-center justify-center self-start rounded-lg border-2 border-naranja-500 px-4 text-xs font-bold tracking-wide text-naranja-900 uppercase transition-colors hover:bg-naranja-100 dark:text-naranja-200 dark:hover:bg-naranja-900"
            >
              Abrir el firmador de Code100
            </button>
          </div>
        ) : null}

        {firmadorSimuladoDisponible && firmadorAbierto && acto ? (
          <PanelFirmadorSimulado
            idCode100={acto.idCode100}
            destino={`${ROTULO_CANAL_P8[acto.canal]} ${acto.destinoEnmascarado}`}
            alFirmar={() => {
              setFirmadorAbierto(false);
              // No se marca `firmado` acá: quien lo confirma es el sondeo
              // contra el proveedor, igual que con la ventana real. Se le da
              // un empujón para no esperar al próximo tick.
              void sondear().catch(() => undefined);
            }}
            alCerrar={() => setFirmadorAbierto(false)}
          />
        ) : null}

        {capturaPendiente ? (
          <p
            aria-live="polite"
            className="text-sm font-semibold text-naranja-700 dark:text-naranja-300"
          >
            ⏳ {AVISO_CAPTURA_PENDIENTE_P8}
          </p>
        ) : null}

        <p className="text-xs text-etiqueta">{NOTA_SEGUIMIENTO_Y_VENCIMIENTO_P8}</p>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
          </p>
        ) : null}
      </section>
      </div>
    </div>
  );
}
