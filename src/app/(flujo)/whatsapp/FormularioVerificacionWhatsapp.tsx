"use client";

import { useCallback, useEffect, useState } from "react";
import { CamposOtp } from "@/components/shared";
import { rutaSiguienteDe } from "@/domain/rutas-flujo";
import { normalizarCelularRegional, paisPorIso, PAISES_CELULAR } from "@/domain/telefono";
import {
  AVISO_NO_COMPARTIR,
  AVISO_SEGURIDAD_CODIGO,
  BOTON_ENVIAR_CODIGO,
  BOTON_VERIFICAR_WHATSAPP,
  CHIP_INTENTOS,
  CHIP_VENCE,
  ENLACE_EDITAR_NUMERO,
  ENLACE_REENVIAR,
  leyendaCodigoEnviado,
  TEXTO_AUTORIZACION_P1,
  TITULO_CONFIRMA_NUMERO,
  TITULO_INGRESA_CODIGO,
} from "@/domain/textos-p1";

/**
 * Formulario del Paso 2, calcado de la maqueta p.3: dos tarjetas lado a lado
 * (`1. Confirmá el número` / `2. Ingresá el código`), chips de vencimiento e
 * intentos, y **un solo botón** que verifica y continúa.
 *
 * La autorización del envío no lleva casilla: el acto es presionar el botón
 * con el literal a la vista, igual que el consentimiento inicial del paso 3.
 * El servidor la registra versionada como siempre (regla inviolable #10).
 *
 * Reglas del OTP (inviolable #1): 6 dígitos, 5 minutos, 3 intentos, reenvío a
 * los 60 segundos. Los chips las muestran; quien las hace cumplir es el
 * dominio.
 */

const INTENTOS_MAXIMOS = 3;

interface RespuestaApi {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly destinoEnmascarado?: string;
  readonly expiraEn?: string;
  readonly intentosRestantes?: number;
  readonly segundosRestantes?: number;
}

const MENSAJES: Readonly<Record<string, string>> = {
  AUTORIZACION_REQUERIDA: "Necesitamos tu autorización para enviar el código.",
  PROPOSITO_INCORRECTO: "Ese código no sirve para verificar el WhatsApp.",
  // L6 · límite de tasa. Dice qué pasó y qué hacer, no solo que no se puede
  // (mismo criterio que el resto de los mensajes de esta pantalla).
  DEMASIADOS_INTENTOS:
    "Hubo demasiados pedidos desde esta conexión. Esperá un momento y volvé a intentar.",
  ESTADO_INVALIDO: "Ya avanzaste más allá de este paso. Podés seguir desde donde quedaste.",
  SESION_INVALIDA: "Se perdió la sesión. Volvé a ingresar tu número.",
  CODIGO_INCORRECTO: "El código no coincide. Revisalo e intentá de nuevo.",
  EXPIRADO: "El código venció. Pedí uno nuevo con «Reenviar código».",
  INTENTOS_AGOTADOS: "Se agotaron los tres intentos. Pedí un código nuevo con «Reenviar código».",
  YA_UTILIZADO: "Ese código ya se usó. Pedí uno nuevo.",
  NO_ENCONTRADO: "No encontramos un código vigente. Pedí uno nuevo.",
};

async function postear(ruta: string, cuerpo?: unknown): Promise<RespuestaApi> {
  const respuesta = await fetch(ruta, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo ?? {}),
  });
  return (await respuesta.json().catch(() => ({}))) as RespuestaApi;
}

/** `05:00`, contando hacia atrás desde `expiraEn`. */
function cuentaRegresiva(expiraEn: string | null, ahora: number): string {
  if (!expiraEn) return "05:00";
  const restanteMs = Math.max(new Date(expiraEn).getTime() - ahora, 0);
  const minutos = Math.floor(restanteMs / 60_000);
  const segundos = Math.floor((restanteMs % 60_000) / 1000);
  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

export function FormularioVerificacionWhatsapp(props: {
  /** Número de pruebas de Meta (fase de pruebas del canal real), o `null`. */
  numeroPruebaWhatsApp?: string | null;
}) {
  const [isoPais, setIsoPais] = useState("PY");
  const pais = paisPorIso(isoPais) ?? PAISES_CELULAR[0];

  const [numero, setNumero] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [destinoEnmascarado, setDestinoEnmascarado] = useState<string | null>(null);
  const [expiraEn, setExpiraEn] = useState<string | null>(null);
  const [intentosUsados, setIntentosUsados] = useState(0);
  const [segundosParaReenvio, setSegundosParaReenvio] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());

  // Un solo reloj mueve el countdown del código y el cooldown del reenvío.
  useEffect(() => {
    if (!enviado) return;
    const temporizador = setInterval(() => {
      setAhora(Date.now());
      setSegundosParaReenvio((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(temporizador);
  }, [enviado]);

  const numeroValido = normalizarCelularRegional(`${pais.prefijo} ${numero}`).ok;

  function aplicarEnvio(datos: RespuestaApi) {
    setDestinoEnmascarado(datos.destinoEnmascarado ?? null);
    setExpiraEn(datos.expiraEn ?? null);
    setIntentosUsados(0);
    setSegundosParaReenvio(60);
    setCodigo("");
    setEnviado(true);
  }

  async function enviarCodigo() {
    setEnProceso(true);
    setError(null);
    try {
      // La autorización es el acto de presionar el botón, con el literal a la
      // vista — el servidor la registra versionada.
      const datos = await postear("/api/p1/otp/enviar", {
        numero: `${pais.prefijo} ${numero}`,
        autorizacionAceptada: true,
      });
      if (!datos.ok) {
        if (datos.motivo === "REENVIO_BLOQUEADO" && datos.segundosRestantes) {
          setSegundosParaReenvio(datos.segundosRestantes);
          setError(`Esperá ${datos.segundosRestantes} segundos para pedir otro código.`);
          return;
        }
        setError(
          datos.motivo === "DESTINO_INVALIDO"
            ? `Revisá el número: tiene que ser un celular válido de ${pais.nombre}, por ejemplo ${pais.ejemplo}.`
            : ((datos.motivo && MENSAJES[datos.motivo]) ?? "No pudimos enviar el código."),
        );
        return;
      }
      aplicarEnvio(datos);
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(false);
    }
  }

  async function reenviarCodigo() {
    if (segundosParaReenvio > 0 || enProceso) return;
    setEnProceso(true);
    setError(null);
    try {
      const datos = await postear("/api/p1/otp/reenviar");
      if (!datos.ok) {
        if (datos.motivo === "REENVIO_BLOQUEADO" && datos.segundosRestantes) {
          setSegundosParaReenvio(datos.segundosRestantes);
        }
        setError((datos.motivo && MENSAJES[datos.motivo]) ?? "No pudimos reenviar el código.");
        return;
      }
      aplicarEnvio(datos);
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(false);
    }
  }

  const verificarYContinuar = useCallback(
    async (codigoIngresado: string) => {
      setEnProceso(true);
      setError(null);
      try {
        const datos = await postear("/api/p1/otp/verificar", { codigo: codigoIngresado });
        if (!datos.ok) {
          setIntentosUsados((usados) =>
            typeof datos.intentosRestantes === "number"
              ? INTENTOS_MAXIMOS - datos.intentosRestantes
              : datos.motivo === "INTENTOS_AGOTADOS"
                ? INTENTOS_MAXIMOS
                : usados,
          );
          setError((datos.motivo && MENSAJES[datos.motivo]) ?? "No pudimos verificar el código.");
          setCodigo("");
          // Se apaga acá y no en un `finally` a propósito: el camino feliz
          // navega a la pantalla siguiente y tiene que dejar los campos
          // deshabilitados mientras tanto. Sin este `false`, un código
          // incorrecto dejaba el formulario trabado para siempre —casillas y
          // botón apagados— y el reintento que el mensaje pide era imposible.
          setEnProceso(false);
          return;
        }
        // Un solo botón: verificado el canal, se continúa (maqueta p.3).
        window.location.assign(rutaSiguienteDe("/whatsapp") ?? "/preparacion");
      } catch {
        setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
        setEnProceso(false);
      }
    },
    [],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Confirmá el número                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-3 rounded-xl border-2 border-borde-sutil bg-superficie p-4">
        <h2 className="text-base font-bold text-titulo">
          <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-naranja-500 text-[11px] font-bold text-azul-950">
            1
          </span>
          {TITULO_CONFIRMA_NUMERO.slice(3)}
        </h2>

        {props.numeroPruebaWhatsApp ? (
          <p className="rounded-lg border border-azul-200 bg-azul-50 p-2.5 text-xs text-azul-900 dark:border-azul-700 dark:bg-azul-950 dark:text-azul-100">
            <span className="font-semibold">Fase de pruebas:</span> antes de pedir el código,
            mandá un «hola» por WhatsApp al número de pruebas{" "}
            <span className="font-bold whitespace-nowrap">{props.numeroPruebaWhatsApp}</span>.
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="p1-pais" className="text-xs font-semibold text-etiqueta">
              País
            </label>
            <select
              id="p1-pais"
              value={isoPais}
              disabled={enviado}
              onChange={(evento) => setIsoPais(evento.target.value)}
              className="h-11 rounded-lg border border-borde-sutil bg-superficie px-2 text-sm font-semibold text-titulo"
            >
              {PAISES_CELULAR.map((opcion) => (
                <option key={opcion.iso} value={opcion.iso}>
                  {opcion.nombre} {opcion.prefijo}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="p1-destino" className="text-xs font-semibold text-etiqueta">
              Número de WhatsApp
            </label>
            <input
              id="p1-destino"
              type="tel"
              autoComplete="tel-national"
              placeholder={`Ej.: ${pais.ejemplo}`}
              value={numero}
              disabled={enviado}
              onChange={(evento) => setNumero(evento.target.value)}
              className="h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-sm font-semibold text-titulo tabular-nums placeholder:font-normal placeholder:text-etiqueta focus:border-azul-500 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Ícono de WhatsApp de la maqueta. Decorativo. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-8 w-8 shrink-0 text-verde-600 dark:text-verde-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 21l-4-1a8.5 8.5 0 113.5 1z" />
            <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.8-2-1.2-1 .8a4.2 4.2 0 01-1.8-1.8l.8-1-1.2-2z" />
          </svg>
          <button
            type="button"
            onClick={enviarCodigo}
            disabled={!numeroValido || enviado || enProceso}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border-2 border-azul-700 px-4 text-xs font-bold tracking-wide text-azul-700 uppercase transition-colors hover:bg-azul-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-azul-300 dark:text-azul-200 dark:hover:bg-azul-950"
          >
            {enviado ? "Código enviado" : BOTON_ENVIAR_CODIGO}
          </button>
        </div>

        {enviado ? (
          <button
            type="button"
            onClick={() => {
              setEnviado(false);
              setCodigo("");
              setError(null);
            }}
            className="self-start text-xs font-semibold text-azul-700 underline underline-offset-2 dark:text-azul-300"
          >
            {ENLACE_EDITAR_NUMERO}
          </button>
        ) : null}

        {/* La autorización, en naranja como la maqueta, con el acto en el botón. */}
        <p className="mt-auto text-xs leading-relaxed font-semibold text-naranja-800 dark:text-naranja-300">
          {TEXTO_AUTORIZACION_P1}
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Ingresá el código                                                */}
      {/* ------------------------------------------------------------------ */}
      <section
        className={`flex flex-col gap-3 rounded-xl border-2 border-borde-sutil bg-superficie p-4 ${
          enviado ? "" : "opacity-50"
        }`}
      >
        <h2 className="text-base font-bold text-titulo">
          <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-naranja-500 text-[11px] font-bold text-azul-950">
            2
          </span>
          {TITULO_INGRESA_CODIGO.slice(3)}
        </h2>

        <p className="text-sm font-semibold text-verde-700 dark:text-verde-300">
          {enviado && destinoEnmascarado
            ? leyendaCodigoEnviado(destinoEnmascarado)
            : "Primero pedí el código en el paso 1."}
        </p>

        {/* `idPrefijo` acuña los ids de las seis casillas (`p1-otp-0`…). Es el
            prefijo que traía el formulario compartido y es contrato con la
            batería E2E: acortarlo a `p1` dejó a los siete escenarios
            esperando un campo que ya no existía. */}
        <CamposOtp
          idPrefijo="p1-otp"
          etiqueta="Código de verificación de WhatsApp"
          valor={codigo}
          onChange={setCodigo}
          deshabilitado={!enviado || enProceso}
        />

        {/* La pantalla **no avanza sola** al completarse la sexta casilla
            (decisión del 20-ago-2026): verificar es un acto de la persona, y
            este botón es el único que lo dispara. `CamposOtp` acepta un
            `onCompleto` justamente para ese atajo; acá no se le pasa. */}
        <button
          type="button"
          onClick={() => void verificarYContinuar(codigo)}
          disabled={!enviado || codigo.length !== 6 || enProceso}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-500 px-4 text-xs font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enProceso ? "Verificando…" : BOTON_VERIFICAR_WHATSAPP}
        </button>

        {/* Chips de la maqueta: vencimiento e intentos. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-naranja-300 bg-naranja-50 px-2.5 py-0.5 text-[11px] font-bold text-naranja-800 tabular-nums dark:border-naranja-700 dark:bg-naranja-950 dark:text-naranja-200">
            {CHIP_VENCE} {cuentaRegresiva(expiraEn, ahora)}
          </span>
          <span className="rounded-full border border-azul-300 bg-azul-50 px-2.5 py-0.5 text-[11px] font-bold text-azul-800 tabular-nums dark:border-azul-700 dark:bg-azul-950 dark:text-azul-200">
            {CHIP_INTENTOS} {Math.min(intentosUsados + 1, INTENTOS_MAXIMOS)}/{INTENTOS_MAXIMOS}
          </span>
          <button
            type="button"
            onClick={reenviarCodigo}
            disabled={!enviado || segundosParaReenvio > 0 || enProceso}
            className="text-xs font-semibold text-azul-700 underline underline-offset-2 disabled:no-underline disabled:opacity-50 dark:text-azul-300"
          >
            {segundosParaReenvio > 0 ? `${ENLACE_REENVIAR} (${segundosParaReenvio}s)` : ENLACE_REENVIAR}
          </button>
        </div>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
          </p>
        ) : null}

        {/* Aviso rojo de la maqueta + CHG-09 compacto. */}
        <div className="mt-auto rounded-lg border border-rojo-300 bg-rojo-50 px-3 py-2 dark:border-rojo-700 dark:bg-rojo-950">
          <p className="text-xs font-bold text-rojo-800 dark:text-rojo-200">{AVISO_NO_COMPARTIR}</p>
          <p className="text-[11px] text-rojo-800 dark:text-rojo-200">{AVISO_SEGURIDAD_CODIGO}</p>
        </div>
      </section>
    </div>
  );
}
