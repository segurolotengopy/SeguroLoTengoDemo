"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatearGuaranies } from "@/domain/catalogo";
// Desde `textos-p7`, no desde el caso de uso: este es un componente de cliente
// e importar `pago-p7.ts` arrastraría `node:crypto` al bundle.
import {
  ADVERTENCIA_PAGO_NO_ES_FIRMA_P7,
  AVISO_PLAZO_FIRMA_CON_DEVOLUCION_P7,
  AVISO_PLAZO_FIRMA_CON_LIBERACION_P7,
  BOTON_CONTINUAR_P7,
  DEPENDENCIA_BANCARD_P7,
  IDENTIFICADOR_BANCARD_PENDIENTE_P7,
  MEDIO_POR_DEFECTO_P7,
  NOTA_DECLARACION_ORIGEN_LICITO_OBLIGATORIA_P7,
  NOTA_FACTURA_A_NOMBRE_DEL_ASEGURADO_P7,
  NOTA_IDENTIFICADOR_BANCARD_P7,
  NOTA_MOMENTOS_DISTINTOS_P7,
  NOTA_RUC_VACIO_P7,
  ROTULO_IDENTIFICADOR_BANCARD_P7,
  ROTULO_IVA_P7,
  ROTULO_NOMBRE_A_FACTURAR_P7,
  ROTULO_PREMIO_TOTAL_P7,
  ROTULO_PRIMA_NETA_P7,
  ROTULO_PROPUESTA_P7,
  ROTULO_RUC_P7,
  SEGURIDAD_P7,
  TEXTOS_MEDIOS_DE_PAGO_P7,
  TEXTO_DECLARACION_ORIGEN_LICITO,
  TITULO_BLOQUE_FACTURA_P7,
  TITULO_BLOQUE_MEDIOS_P7,
  TITULO_DEPENDENCIA_BANCARD_P7,
  TITULO_DESPUES_DE_ESTA_PANTALLA_P7,
  TITULO_LIQUIDACION_P7,
  TITULO_PLAZO_FIRMA_P7,
  TITULO_REFERENCIAS_P7,
  TITULO_SEGURIDAD_P7,
  VALOR_OFICIAL_DE_ALIANZA_P7,
} from "@/domain/textos-p7";
import { esPagoDefinitivoAntesDeFirma } from "@/domain/tipos";
import type { MedioDePago } from "@/domain/tipos";

/**
 * Bloques interactivos de P7 (docs/ESPECIFICACION_PANTALLAS.md → "P7 · Paso 7
 * de 9 — Facturación y garantía de pago"): datos para la factura, declaración
 * de origen lícito de fondos y elección del medio de pago.
 *
 * **No tiene lógica de negocio.** El importe no se calcula ni se manda: sale
 * del expediente y viaja solo del servidor a la pantalla. La decisión de qué
 * llamada hacerle a Bancard, la clave de idempotencia y la transición del
 * expediente viven en `POST /api/p7/pago` y `GET /api/p7/estado`.
 *
 * **Regla inviolable #6:** este componente no tiene ni un campo de tarjeta.
 * Para débito y crédito lo único que recibe es la URL del formulario seguro de
 * Bancard, que se abre en una pestaña nueva; el número de tarjeta y el CVV se
 * tipean allá y nunca pasan por SeguroLoTengo. Buscá un `input` de tarjeta en
 * este archivo: no existe, y `no-persiste-datos-de-tarjeta.test.ts` falla si
 * alguien agrega uno.
 */

interface Resumen {
  readonly numeroPropuesta: string | null;
  readonly montoGs: number;
  readonly nombreAFacturar: string;
  readonly medio: MedioDePago | null;
  readonly referenciaBancard: string | null;
  readonly garantiaLista: boolean;
}

type Instruccion =
  | { readonly tipo: "QR"; readonly qrPayload: string; readonly expiraEn: string }
  | { readonly tipo: "FORMULARIO_SEGURO"; readonly urlFormularioSeguro: string };

interface RespuestaInicio {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly numeroPropuesta?: string;
  readonly referenciaBancard?: string;
  readonly instruccion?: Instruccion;
}

interface RespuestaEstado {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly confirmado?: boolean;
  readonly plazoFirmaVenceEn?: string;
  readonly pagoDefinitivo?: boolean;
  readonly siguientePantalla?: string;
}

const MENSAJES: Readonly<Record<string, string>> = {
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  ESTADO_INVALIDO: "Este proceso ya no está en el paso de pago.",
  EXPEDIENTE_INCOMPLETO: "Faltan datos del expediente para preparar el pago.",
  MEDIO_INVALIDO: "Elegí uno de los medios de pago disponibles.",
  ORIGEN_FONDOS_NO_DECLARADO:
    "Tenés que declarar que los fondos son de tu propiedad y de origen lícito para continuar.",
  RUC_INVALIDO: "Revisá el RUC: el formato esperado es 80012345-6.",
  BANCARD_NO_DISPONIBLE: "Bancard no respondió. Volvé a intentar en unos segundos.",
  BANCARD_RECHAZO: "Bancard rechazó la operación. Probá con otro medio de pago.",
  PAGO_NO_INICIADO: "Todavía no hay una operación de pago abierta.",
  PAGO_CANCELADO: "La operación se canceló o venció. Generá una nueva.",
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};

/** Cada cuánto se le pregunta a Bancard si la operación ya se acreditó. */
const INTERVALO_SONDEO_MS = 2_000;

/**
 * Motivos que de verdad no se resuelven esperando: con ellos el sondeo se
 * corta y se muestra el error. Cualquier otro fallo (un 5xx puntual, un cuerpo
 * malformado) se trata como transitorio y el próximo sondeo reintenta — antes
 * un solo tropiezo dejaba la pantalla esperando un pago que ya no consultaba.
 */
const MOTIVOS_TERMINALES_SONDEO: ReadonlySet<string> = new Set([
  "SESION_INVALIDA",
  "EXPEDIENTE_NO_ENCONTRADO",
  "ESTADO_INVALIDO",
  "PAGO_CANCELADO",
]);

const CLASE_CAMPO =
  "h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo placeholder:text-etiqueta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500";

function Fila({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-sm text-cuerpo">{rotulo}</span>
      <span className="text-right text-sm font-semibold text-titulo tabular-nums">{valor}</span>
    </div>
  );
}

export function FormularioPagoP7() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [ruc, setRuc] = useState("");
  const [origenLicito, setOrigenLicito] = useState(false);
  const [medio, setMedio] = useState<MedioDePago>(MEDIO_POR_DEFECTO_P7);

  const [generando, setGenerando] = useState(false);
  const [instruccion, setInstruccion] = useState<Instruccion | null>(null);
  const [referenciaBancard, setReferenciaBancard] = useState<string | null>(null);
  const [numeroPropuesta, setNumeroPropuesta] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [plazoFirmaVenceEn, setPlazoFirmaVenceEn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Evita que un sondeo en vuelo escriba estado después de desmontar.
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
        const respuesta = await fetch("/api/p7/resumen");
        const datos = (await respuesta.json().catch(() => ({}))) as {
          ok?: boolean;
          resumen?: Resumen;
        };
        if (!vigente.current || !datos.ok || !datos.resumen) return;
        setResumen(datos.resumen);
        setNumeroPropuesta(datos.resumen.numeroPropuesta);
        setReferenciaBancard(datos.resumen.referenciaBancard);
        if (datos.resumen.medio) setMedio(datos.resumen.medio);
        if (datos.resumen.garantiaLista) setConfirmado(true);
      } catch {
        // Sin resumen la pantalla no puede operar; el error se ve al enviar.
      }
    })();
  }, []);

  const sondear = useCallback(async (): Promise<boolean> => {
    const respuesta = await fetch("/api/p7/estado");
    const datos = (await respuesta.json().catch(() => ({}))) as RespuestaEstado;

    if (!datos.ok) {
      const terminal = datos.motivo !== undefined && MOTIVOS_TERMINALES_SONDEO.has(datos.motivo);
      if (terminal && vigente.current) {
        setError(MENSAJES[datos.motivo ?? ""] ?? MENSAJES.CUERPO_INVALIDO);
      }
      return terminal;
    }
    if (!datos.confirmado) return false;

    if (vigente.current) {
      setConfirmado(true);
      setPlazoFirmaVenceEn(datos.plazoFirmaVenceEn ?? null);
      setError(null);
    }
    return true;
  }, []);

  // Sondeo mientras hay una operación abierta y sin confirmar.
  useEffect(() => {
    if (!referenciaBancard || confirmado) return;

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
  }, [referenciaBancard, confirmado, sondear]);

  async function generar() {
    if (!origenLicito || generando) return;

    setGenerando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/p7/pago", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // El monto no viaja: lo pone el servidor desde el plan del expediente.
        body: JSON.stringify({ medio, ruc, origenLicitoDeFondos: origenLicito }),
      });
      const datos = (await respuesta.json().catch(() => ({}))) as RespuestaInicio;

      if (!datos.ok) {
        setError(MENSAJES[datos.motivo ?? ""] ?? MENSAJES.CUERPO_INVALIDO);
        return;
      }

      setInstruccion(datos.instruccion ?? null);
      setReferenciaBancard(datos.referenciaBancard ?? null);
      setNumeroPropuesta(datos.numeroPropuesta ?? null);
    } catch {
      setError(MENSAJES.BANCARD_NO_DISPONIBLE);
    } finally {
      setGenerando(false);
    }
  }

  const textoMedio = TEXTOS_MEDIOS_DE_PAGO_P7.find((opcion) => opcion.medio === medio);
  const definitivo = esPagoDefinitivoAntesDeFirma(medio);
  const importe = resumen ? formatearGuaranies(resumen.montoGs) : "—";

  return (
    <div className="flex flex-col gap-4">
      {/* En pantallas anchas: factura a la izquierda, medio de pago y botón a
          la derecha; plazo, secuencia y seguridad debajo del botón. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* ------------------------------------------------------------------ */}
      {/* Bloque 1 — Datos para la factura                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_BLOQUE_FACTURA_P7}
          </h2>
          <span className="text-xs text-etiqueta">{NOTA_FACTURA_A_NOMBRE_DEL_ASEGURADO_P7}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="p7-nombre" className="text-xs font-semibold text-etiqueta">
              {ROTULO_NOMBRE_A_FACTURAR_P7}
            </label>
            {/*
              Bloqueado por la misma razón que los campos de OCR de P5: la
              factura es siempre a nombre del asegurado (regla inviolable #9).
              El valor que se usa lo toma el servidor de la identidad
              verificada; este input es solo para que la persona lo vea.
            */}
            <div className="flex items-center gap-2">
              <input
                id="p7-nombre"
                type="text"
                value={resumen?.nombreAFacturar ?? ""}
                readOnly
                aria-describedby="p7-nombre-candado"
                className={`${CLASE_CAMPO} bg-superficie-suave text-cuerpo`}
              />
              <span id="p7-nombre-candado" aria-label="Campo bloqueado" title="Campo bloqueado">
                🔒
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="p7-ruc" className="text-xs font-semibold text-etiqueta">
              {ROTULO_RUC_P7}
            </label>
            <input
              id="p7-ruc"
              type="text"
              inputMode="numeric"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              placeholder="Opcional — ej.: 80012345-6"
              aria-describedby="p7-ruc-ayuda"
              className={CLASE_CAMPO}
            />
            <p id="p7-ruc-ayuda" className="text-xs text-etiqueta">
              {NOTA_RUC_VACIO_P7}
            </p>
          </div>
        </div>

        {/* Liquidación del premio */}
        <div className="flex flex-col rounded-lg border border-borde-sutil bg-superficie-suave px-4 py-3">
          <h3 className="pb-1 text-[11px] font-bold tracking-wide text-etiqueta uppercase">
            {TITULO_LIQUIDACION_P7}
          </h3>
          <Fila rotulo={ROTULO_PRIMA_NETA_P7} valor={VALOR_OFICIAL_DE_ALIANZA_P7} />
          <Fila rotulo={ROTULO_IVA_P7} valor={VALOR_OFICIAL_DE_ALIANZA_P7} />
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-borde-tenue pt-2">
            <span className="text-sm font-bold text-titulo">{ROTULO_PREMIO_TOTAL_P7}</span>
            <span className="text-base font-bold text-titulo tabular-nums">{importe}</span>
          </div>
        </div>

        {/* Declaración de origen lícito de fondos — bloqueante */}
        <label
          className={`flex items-start gap-3 rounded-lg border-2 px-4 py-3 ${
            origenLicito
              ? "border-verde-400 bg-verde-50 dark:border-verde-600 dark:bg-verde-950"
              : "border-rojo-300 bg-rojo-50 dark:border-rojo-700 dark:bg-rojo-950"
          }`}
        >
          <input
            type="checkbox"
            checked={origenLicito}
            onChange={(e) => setOrigenLicito(e.target.checked)}
            disabled={confirmado}
            className="mt-0.5 h-4 w-4 shrink-0 accent-naranja-500"
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm text-titulo">{TEXTO_DECLARACION_ORIGEN_LICITO}</span>
            {!origenLicito ? (
              <span className="text-[11px] font-bold tracking-wide text-rojo-700 uppercase dark:text-rojo-300">
                {NOTA_DECLARACION_ORIGEN_LICITO_OBLIGATORIA_P7}
              </span>
            ) : null}
          </span>
        </label>

        {/* Referencias de la operación */}
        <div className="flex flex-col rounded-lg border border-azul-200 bg-azul-50 px-4 py-3 dark:border-azul-700 dark:bg-azul-950">
          <h3 className="pb-1 text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_REFERENCIAS_P7}
          </h3>
          <Fila rotulo={ROTULO_PROPUESTA_P7} valor={numeroPropuesta ?? "—"} />
          <Fila
            rotulo={ROTULO_IDENTIFICADOR_BANCARD_P7}
            valor={referenciaBancard ?? IDENTIFICADOR_BANCARD_PENDIENTE_P7}
          />
          <p className="pt-1 text-xs text-azul-800 dark:text-azul-200">
            {NOTA_IDENTIFICADOR_BANCARD_P7}
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Bloque 2 — Medio de pago (columna derecha)                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_BLOQUE_MEDIOS_P7}
          </h2>
          <p className="text-xs text-etiqueta">{NOTA_MOMENTOS_DISTINTOS_P7}</p>
        </div>

        <fieldset className="flex flex-col gap-2" disabled={confirmado}>
          <legend className="sr-only">{TITULO_BLOQUE_MEDIOS_P7}</legend>
          {TEXTOS_MEDIOS_DE_PAGO_P7.map((opcion) => (
            <label
              key={opcion.medio}
              className={`flex cursor-pointer flex-col gap-1.5 rounded-lg border-2 p-3 ${
                medio === opcion.medio
                  ? "border-naranja-500 bg-naranja-50 dark:bg-naranja-950"
                  : "border-borde-sutil bg-superficie-suave"
              }`}
            >
              <span className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="p7-medio"
                  value={opcion.medio}
                  checked={medio === opcion.medio}
                  onChange={() => {
                    setMedio(opcion.medio);
                    // Cambiar de medio abre un intento distinto: lo que se
                    // había generado para el anterior deja de aplicar.
                    setInstruccion(null);
                    setReferenciaBancard(null);
                    setError(null);
                  }}
                  className="mt-1 h-4 w-4 shrink-0 accent-naranja-500"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-bold tracking-wide text-titulo uppercase">
                    {opcion.titulo}
                  </span>
                  <span className="text-xs font-semibold text-etiqueta">{opcion.momento}</span>
                </span>
              </span>
              <ul className="flex list-disc flex-col gap-1 pl-9 text-sm text-cuerpo">
                {opcion.vinetas.map((vineta) => (
                  <li key={vineta}>{vineta}</li>
                ))}
              </ul>
            </label>
          ))}
        </fieldset>

        {medio === "TARJETA_CREDITO" ? (
          <div className="flex flex-col gap-1 rounded-lg border border-borde-sutil bg-superficie-suave px-3 py-2.5">
            <p className="text-[11px] font-bold tracking-wide text-etiqueta uppercase">
              {TITULO_DEPENDENCIA_BANCARD_P7}
            </p>
            <p className="text-xs text-cuerpo">{DEPENDENCIA_BANCARD_P7}</p>
          </div>
        ) : null}

        {/* Acción: generar el QR / abrir el formulario seguro */}
        {!confirmado ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void generar()}
              disabled={!origenLicito || generando}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:bg-superficie-suave disabled:text-etiqueta disabled:opacity-60 sm:w-auto sm:self-start"
            >
              {generando ? "Comunicando con Bancard…" : (textoMedio?.botón ?? "Continuar")}
            </button>
            {!origenLicito ? (
              <p className="text-xs text-etiqueta">
                Se habilita al declarar el origen lícito de los fondos.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Resultado de Bancard                                                */}
      {/* ------------------------------------------------------------------ */}
      {instruccion && !confirmado ? (
        <section
          aria-live="polite"
          className="flex flex-col items-start gap-3 rounded-lg border border-borde-sutil bg-superficie p-4"
        >
          {instruccion.tipo === "QR" ? (
            <>
              <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                Escaneá el QR con tu app de banco
              </h2>
              {/*
                En el demo el payload es el que devolvería Bancard QR: se
                muestra como texto en vez de dibujar un QR, porque no hay un
                pago real detrás y agregar una librería de códigos QR para
                esto no se justifica.
              */}
              <p className="w-full overflow-x-auto rounded-lg border border-borde-sutil bg-superficie-suave px-4 py-3 font-mono text-xs break-all text-cuerpo">
                {instruccion.qrPayload}
              </p>
              <p className="text-xs text-etiqueta">
                El QR vence el {new Date(instruccion.expiraEn).toLocaleString("es-PY")}.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                Completá el pago en el formulario seguro de Bancard
              </h2>
              <p className="text-sm text-cuerpo">
                Los datos de tu tarjeta se ingresan en Bancard. SeguroLoTengo no los recibe ni los
                guarda.
              </p>
              <a
                href={instruccion.urlFormularioSeguro}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-naranja-500 px-6 text-sm font-bold tracking-wide text-naranja-700 uppercase hover:bg-naranja-50 dark:text-naranja-300 dark:hover:bg-naranja-950"
              >
                Abrir formulario seguro ↗
              </a>
            </>
          )}
          <p className="text-sm font-semibold text-cuerpo">
            Esperando la confirmación de Bancard…
          </p>
        </section>
      ) : null}

      {confirmado ? (
        <section
          aria-live="polite"
          className="flex flex-col gap-3 rounded-lg border border-verde-400 bg-verde-50 p-4 dark:border-verde-600 dark:bg-verde-950"
        >
          <h2 className="text-sm font-bold tracking-wide text-verde-800 uppercase dark:text-verde-200">
            {definitivo ? "Pago acreditado" : "Tarjeta preautorizada"}
          </h2>
          <p className="text-sm text-verde-900 dark:text-verde-100">
            {definitivo
              ? "Bancard acreditó el premio a Alianza Garantía. Ya podés firmar."
              : "Bancard reservó el importe; todavía no se cobró. La captura la ordena tu firma."}
          </p>
          {plazoFirmaVenceEn ? (
            <p className="text-sm font-semibold text-verde-900 dark:text-verde-100">
              Tenés tiempo para firmar hasta el {new Date(plazoFirmaVenceEn).toLocaleString("es-PY")}.
            </p>
          ) : null}
          <a
            href="/p8-firma"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 sm:self-start"
          >
            {BOTON_CONTINUAR_P7}
          </a>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
          {error}
        </p>
      ) : null}
      </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Debajo del botón: plazo, secuencia y seguridad                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        {/* Plazo para firmar */}
        <div className="flex flex-col gap-1 rounded-lg border border-naranja-300 bg-naranja-50 px-3 py-2.5 dark:border-naranja-700 dark:bg-naranja-950">
          <p className="text-[11px] font-bold tracking-wide text-naranja-800 uppercase dark:text-naranja-200">
            {TITULO_PLAZO_FIRMA_P7}
          </p>
          <p className="text-xs text-naranja-900 dark:text-naranja-100">
            {definitivo ? AVISO_PLAZO_FIRMA_CON_DEVOLUCION_P7 : AVISO_PLAZO_FIRMA_CON_LIBERACION_P7}
          </p>
        </div>

        {/* Después de esta pantalla */}
        {textoMedio ? (
          <div className="flex flex-col gap-1 rounded-lg border border-azul-200 bg-azul-50 px-3 py-2.5 dark:border-azul-700 dark:bg-azul-950">
            <p className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
              {TITULO_DESPUES_DE_ESTA_PANTALLA_P7}
            </p>
            <p className="text-xs font-semibold text-azul-900 dark:text-azul-100">
              {textoMedio.secuencia}
            </p>
          </div>
        ) : null}

        {/* Seguridad y trazabilidad */}
        <section
          aria-labelledby="p7-seguridad"
          className="flex flex-col gap-1 rounded-lg border border-verde-300 bg-verde-50 px-3 py-2.5 dark:border-verde-700 dark:bg-verde-950"
        >
          <h2
            id="p7-seguridad"
            className="text-[11px] font-bold uppercase tracking-wide text-verde-800 dark:text-verde-200"
          >
            {TITULO_SEGURIDAD_P7}
          </h2>
          <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-verde-900 dark:text-verde-100">
            {SEGURIDAD_P7.map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </ul>
          <p className="text-xs font-semibold text-verde-900 dark:text-verde-100">
            {ADVERTENCIA_PAGO_NO_ES_FIRMA_P7}
          </p>
        </section>
      </div>
    </div>
  );
}
