"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AVISO_ENLACE_ENVIADO_P8,
  AVISO_FIRMA_RECHAZADA_P8,
  BADGE_DATOS_VERIFICADOS_P8,
  BOTON_ENVIAR_ENLACE_P8,
  BOTON_VER_PDF_P8,
  CANAL_FIRMA_POR_DEFECTO,
  NOTA_SIN_DESCARGA_ANTES_DE_FIRMAR_P8,
  DESCRIPCION_DOCUMENTO_P8,
  ENLACES_ACCESO_PREVIO_P8,
  ESTADO_ESPERANDO_FIRMA_P8,
  MARCA_PDF_CERRADO_P8,
  NOMBRE_DOCUMENTO_P8,
  NOTA_ACEPTACION_REGISTRADA_P8,
  NOTA_ENVIO_ENLACE_P8,
  NOTA_PAGO_DESPUES_DE_FIRMAR_P8,
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
  TITULO_QUE_SIGUE_P8,
  TITULO_UN_SOLO_ACTO_P8,
} from "@/domain/textos-p8";
import type { CanalFirma } from "@/domain/tipos";
import { ModalVisorPdf } from "./ModalVisorPdf";
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
 * **Ya no muestra ninguna cuenta regresiva** (D-08): el plazo de 24 horas
 * arranca cuando el expediente queda firmado y corre en el paso de pago, que
 * ahora viene después. Acá no hay nada que caduque.
 */

interface DocumentoVisible {
  readonly codigo: string;
  readonly codigoSeccionFipf: string;
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
  readonly documento: DocumentoVisible;
  readonly canalWhatsappEnmascarado: string | null;
  readonly canalEmailEnmascarado: string | null;
  readonly acto: ActoVisible | null;
  readonly firmadoEn: string | null;
}

interface RespuestaEstado {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly detalle?: string;
  readonly firmado?: boolean;
  readonly enlaceAbierto?: boolean;
  readonly siguientePantalla?: string;
}

const MENSAJES: Readonly<Record<string, string>> = {
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  ESTADO_INVALIDO: "Este proceso ya no está en el paso de firma.",
  CANAL_INVALIDO: "Elegí uno de los canales verificados.",
  CANAL_NO_VERIFICADO: "Ese canal no está verificado en este expediente.",
  PAQUETE_NO_GENERADO: "Todavía estamos preparando la Solicitud y el FIPF. Recargá en unos segundos.",
  CODE100_NO_DISPONIBLE: "El servicio de firma no respondió. Volvé a intentar en unos segundos.",
  CODE100_RECHAZO: "El servicio de firma rechazó la apertura del acto. Pedí un enlace nuevo.",
  FIRMA_NO_INICIADA: "Todavía no pediste el enlace de firma.",
  FIRMA_NO_COMPLETADA: AVISO_FIRMA_RECHAZADA_P8,
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};

/** Cada cuánto se le pregunta a Code100 si la persona ya firmó. */
const INTERVALO_SONDEO_MS = 2_000;

/**
 * El documento único del expediente, con acceso de **lectura** y sin descarga
 * (CHG-29).
 *
 * El botón `DESCARGAR` que había acá desapareció a propósito: la reunión del
 * 18-ago pidió que antes de firmar el documento se pueda revisar pero no
 * llevarse, y la Matriz §2 lo describe como *"Borrador"* en la pantalla de
 * datos. Un PDF descargado antes de la firma circula como si fuera el
 * instrumento, y no lo es: todavía no lo firmó nadie. Después de pagar, la
 * pantalla de confirmación sí lo ofrece —ahí ya está firmado y es el
 * instrumento de verdad.
 *
 * Lo que **no** cambia es que el archivo se sirve por el mismo endpoint
 * verificado contra su huella: esconder un botón no protege nada por sí solo,
 * y quien arme la petición a mano va a recibir el mismo PDF cerrado que se ve
 * en el visor. La diferencia es de presentación, no de secreto — y por eso el
 * texto lo dice en vez de fingir que el documento es inaccesible.
 */
function TarjetaDocumento({
  documento,
  alAbrirVisor,
}: {
  readonly documento: DocumentoVisible;
  readonly alAbrirVisor: () => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie-suave p-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-sm font-bold text-titulo">{NOMBRE_DOCUMENTO_P8}</h3>
          <code className="font-mono text-xs font-semibold text-azul-700 dark:text-azul-200">
            {documento.codigo}
          </code>
        </div>
        <p className="text-sm text-cuerpo">{DESCRIPCION_DOCUMENTO_P8}</p>
        <p className="text-xs text-etiqueta">
          Sección FIPF: <code className="font-mono">{documento.codigoSeccionFipf}</code>
        </p>
      </div>

      {/* Botón y no enlace: el documento se lee en un modal sobre esta misma
          pantalla. Abrirlo en otra pestaña sacaba a la persona del flujo justo
          en el paso donde decide si firma, y le daba la barra del visor del
          navegador entera —descargar e imprimir incluidos—. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={alAbrirVisor}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-azul-300 px-4 text-xs font-bold tracking-wide text-azul-800 uppercase transition-colors hover:bg-azul-50 dark:border-azul-600 dark:text-azul-200 dark:hover:bg-azul-950"
        >
          {BOTON_VER_PDF_P8}
        </button>
      </div>
      <p className="text-xs text-etiqueta">{NOTA_SIN_DESCARGA_ANTES_DE_FIRMAR_P8}</p>
    </article>
  );
}

/**
 * Constancia de que el PDF está cerrado y hasheado (regla inviolable #4), al
 * pie de la pantalla.
 *
 * Vivía dentro de la tarjeta del documento, arriba de todo. Se bajó a pedido:
 * es una prueba técnica —versión y SHA-256— que respalda lo que la persona
 * está por firmar, pero no es lo que necesita leer para decidir. Al pie
 * cumple la misma función probatoria sin competir con el contenido.
 */
function ConstanciaPdfCerrado({ documento }: { readonly documento: DocumentoVisible }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-borde-sutil bg-superficie-suave px-4 py-3">
      <p className="text-xs font-semibold text-verde-700 dark:text-verde-300">
        🔒 {MARCA_PDF_CERRADO_P8} · v{documento.version}
      </p>
      <p className="font-mono text-[11px] break-all text-etiqueta">
        SHA-256 {documento.hashSha256}
      </p>
    </div>
  );
}

/**
 * Enlaces a la información precontractual, al pie de la pantalla.
 *
 * También se bajó a pedido. El orden que queda es el del acto: primero qué se
 * firma y por dónde llega el enlace, después el material de referencia que
 * quien quiera profundizar va a buscar.
 */
function AccesoPrevio() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-azul-200 bg-azul-50 px-4 py-3 dark:border-azul-700 dark:bg-azul-950">
      <h3 className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
        {TITULO_ACCESO_PREVIO_P8}
      </h3>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {ENLACES_ACCESO_PREVIO_P8.map((enlace) => (
          <li key={enlace}>
            <a
              href="/plan"
              className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
            >
              {enlace}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-azul-900 dark:text-azul-100">{NOTA_SIN_MODIFICACION_P8}</p>
    </div>
  );
}

export interface FirmaP8Props {
  /**
   * `true` si el firmador simulado está disponible (`DEMO_MODE=true`). Lo
   * resuelve el servidor y baja como prop: la pantalla no lee variables de
   * entorno, y con el flag apagado el chunk del modal no se descarga nunca.
   */
  readonly firmadorSimuladoDisponible?: boolean;

  /**
   * Contenido que va **entre** el acto de firma y el pie de la pantalla.
   *
   * Lo usa `page.tsx` para meter ahí el bloque "Después de la firma del
   * cliente". Se pasa como `children` en vez de renderizarlo después de este
   * componente porque el acceso previo y la constancia del PDF cerrado tienen
   * que quedar al final de todo, y viven acá adentro: la constancia depende
   * del resumen, que es estado de cliente. Al entrar como `children` desde un
   * componente de servidor, ese bloque se sigue renderizando en el servidor y
   * no engorda el bundle.
   */
  readonly children?: ReactNode;
}

export function FirmaP8({
  firmadorSimuladoDisponible = false,
  children,
}: FirmaP8Props = {}) {
  const router = useRouter();

  const [firmadorAbierto, setFirmadorAbierto] = useState(false);
  const [visorAbierto, setVisorAbierto] = useState(false);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [canal, setCanal] = useState<CanalFirma>(CANAL_FIRMA_POR_DEFECTO);
  const [acto, setActo] = useState<ActoVisible | null>(null);
  const [enlaceAbierto, setEnlaceAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [firmado, setFirmado] = useState(false);
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

        // `firmado` acá significa "no hay nada más que esperar", y eso **no**
        // es lo mismo que "existe una firma": con el expediente en
        // FIRMADO_CLIENTE el cliente ya firmó pero faltan las institucionales
        // (D-13), y quien las retoma es el sondeo. Darlo por terminado al ver
        // `firmadoEn` apagaba el sondeo y dejaba a la persona encallada en
        // esta pantalla — lo encontró el escenario E2E del tramo caído.
        if (datos.resumen.estado === "FIRMADO_CLIENTE") return;

        if (datos.resumen.firmadoEn) {
          setFirmado(true);
          // El acto ya está completo: si alguien recarga esta pantalla con el
          // expediente firmado, lo que corresponde es llevarlo a donde
          // quedó, no dejarlo mirando documentos que ya firmó.
          router.push("/pago");
        }
      } catch {
        if (vigente.current) setError(MENSAJES.CODE100_NO_DISPONIBLE);
      }
    })();
  }, [irAPantallaB, router]);

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

    if (vigente.current) {
      setFirmado(true);
      setError(null);
      // D-08 · firmado el expediente, lo que sigue es pagar.
      router.push(datos.siguientePantalla ?? "/pago");
    }
    return true;
  }, [irAPantallaB, router]);

  /**
   * La persona volvió de la ventana de Code100 (CHG-33).
   *
   * Va por `/api/p8/retorno` y no por el sondeo para que quede registrado
   * **por dónde** llegó la confirmación: son dos vías sobre el mismo acto y la
   * evidencia tiene que poder distinguirlas. Si el sondeo se adelantó, esta
   * llega segunda y el servidor la registra como duplicada sin repetir nada.
   *
   * No manda ningún resultado de firma: avisa que volvió, y el servidor le
   * pregunta a Code100. Un cliente que llame esto sin haber firmado obtiene lo
   * mismo que obtendría el sondeo.
   */
  const confirmarRetorno = useCallback(async (): Promise<void> => {
    try {
      const respuesta = await fetch("/api/p8/retorno", { method: "POST" });
      const datos = (await respuesta.json().catch(() => ({}))) as {
        ok?: boolean;
        firmado?: boolean;
        siguientePantalla?: string;
      };
      if (!vigente.current) return;
      if (datos.ok && datos.firmado) {
        setFirmado(true);
        setError(null);
        router.push(datos.siguientePantalla ?? "/pago");
        return;
      }
      // Volvió sin firma confirmada: el sondeo sigue su curso.
      await sondear().catch(() => undefined);
    } catch {
      // El retorno es un atajo, no la garantía: si falla, el sondeo confirma.
    }
  }, [router, sondear]);

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
    if (enviando || !resumen) return;

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
          <TarjetaDocumento
            documento={resumen.documento}
            alAbrirVisor={() => setVisorAbierto(true)}
          />
        ) : (
          <p className="text-sm text-cuerpo">Preparando la Solicitud y el FIPF…</p>
        )}
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

        {/* D-08 · lo que sigue es pagar: acá todavía no se cobró nada. */}
        <div className="flex flex-col gap-2 rounded-lg border border-naranja-300 bg-naranja-50 px-4 py-3 dark:border-naranja-700 dark:bg-naranja-950">
          <h3 className="text-[11px] font-bold tracking-wide text-naranja-800 uppercase dark:text-naranja-200">
            {TITULO_QUE_SIGUE_P8}
          </h3>
          <p className="text-sm text-naranja-900 dark:text-naranja-100">
            {NOTA_PAGO_DESPUES_DE_FIRMAR_P8}
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

        <button
          type="button"
          onClick={enviarEnlace}
          disabled={enviando || firmado || acto !== null || resumen === null}
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

        {acto && !firmado ? (
          <p aria-live="polite" className="text-sm text-cuerpo">
            ⏳ {ESTADO_ESPERANDO_FIRMA_P8}
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
              {ROTULO_CANAL_P8[acto.canal]} y firmás en el sitio del proveedor de firma. Acá podés
              abrir esa misma ventana sin salir de la demostración.
            </p>
            <button
              type="button"
              onClick={() => setFirmadorAbierto(true)}
              className="mt-1 inline-flex h-10 items-center justify-center self-start rounded-lg border-2 border-naranja-500 px-4 text-xs font-bold tracking-wide text-naranja-900 uppercase transition-colors hover:bg-naranja-100 dark:text-naranja-200 dark:hover:bg-naranja-900"
            >
              Abrir el firmador
            </button>
          </div>
        ) : null}

        {firmadorSimuladoDisponible && firmadorAbierto && acto ? (
          <PanelFirmadorSimulado
            idCode100={acto.idCode100}
            destino={`${ROTULO_CANAL_P8[acto.canal]} ${acto.destinoEnmascarado}`}
            alFirmar={() => {
              setFirmadorAbierto(false);
              // No se marca `firmado` acá: quien lo confirma es el proveedor,
              // igual que con la ventana real. Lo que se hace es avisar que
              // la persona volvió, para no esperar al próximo tick del sondeo.
              void confirmarRetorno();
            }}
            alRechazar={() => {
              setFirmadorAbierto(false);
              // Mismo criterio: el rechazo lo informa el proveedor. El sondeo
              // devuelve FIRMA_NO_COMPLETADA y limpia el acto, que es lo que
              // vuelve a habilitar el botón de pedir enlace.
              void sondear().catch(() => undefined);
            }}
            alCerrar={() => {
              setFirmadorAbierto(false);
              // Cerrar la ventana también es volver: puede haber firmado y
              // cerrado sin usar el botón.
              void confirmarRetorno();
            }}
          />
        ) : null}

        <p className="text-xs text-etiqueta">{NOTA_SEGUIMIENTO_Y_VENCIMIENTO_P8}</p>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
          </p>
        ) : null}
      </section>
      </div>

      {children}

      {/* ------------------------------------------------------------------ */}
      {/* Pie — material de referencia y constancia técnica                   */}
      {/*                                                                     */}
      {/* Los dos bloques que estaban dentro del bloque 1, bajados a pedido.   */}
      {/* Quedan fuera de la grilla de dos columnas para que ocupen el ancho   */}
      {/* completo y se lean como lo que son: pie de pantalla, no parte del    */}
      {/* acto de firma.                                                      */}
      {/* ------------------------------------------------------------------ */}
      <AccesoPrevio />
      {resumen ? <ConstanciaPdfCerrado documento={resumen.documento} /> : null}

      {visorAbierto && resumen ? (
        <ModalVisorPdf
          codigo={resumen.documento.codigo}
          alCerrar={() => setVisorAbierto(false)}
        />
      ) : null}
    </div>
  );
}
