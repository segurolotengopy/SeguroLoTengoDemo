"use client";

import { useCallback, useEffect, useState } from "react";
import { CamposOtp } from "@/components/shared";
import { COOLDOWN_REENVIO_MS, INTENTOS_MAXIMOS_OTP, LONGITUD_CODIGO_OTP } from "@/domain/reglas-otp";
import { normalizarCelularParaguayo, PREFIJO_PAIS_PARAGUAY } from "@/domain/telefono";
// Desde `textos-p1` y no desde el caso de uso: este es un componente de
// cliente, e importar el caso de uso arrastraría `node:crypto` al bundle.
import { TEXTO_AUTORIZACION_P1 } from "@/domain/textos-p1";

/**
 * Formulario de P1 (docs/ESPECIFICACION_PANTALLAS.md → "P1 · Paso 1 de 9"):
 * paso 1 ingresá tu número, paso 2 ingresá el código recibido.
 *
 * No tiene lógica de negocio: valida el formato del número solo para
 * habilitar el botón (la validación que manda es la del servidor), y todo lo
 * demás —vigencia, intentos, cooldown, transición de estado— lo deciden los
 * Route Handlers de `/api/p1/otp/*`.
 *
 * El código de verificación existe únicamente en el estado local mientras se
 * tipea; ninguna respuesta de la API lo trae, así que no hay forma de
 * mostrarlo ni de rellenarlo automáticamente.
 */

const COOLDOWN_SEGUNDOS = COOLDOWN_REENVIO_MS / 1000;

interface RegistroSeguridad {
  readonly fecha: string;
  readonly ip: string;
  readonly numeroEnmascarado: string;
  readonly referenciaEnvio: string | null;
  readonly resultado: "EXITOSO" | "FALLIDO";
}

interface RespuestaApi {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly numeroEnmascarado?: string;
  readonly expiraEn?: string;
  readonly estado?: string;
  readonly intentosRestantes?: number;
  readonly segundosRestantes?: number;
  readonly registroSeguridad?: RegistroSeguridad;
}

const MENSAJES: Readonly<Record<string, string>> = {
  AUTORIZACION_REQUERIDA: "Necesitás autorizar el uso del número para continuar.",
  NUMERO_INVALIDO: "Revisá el número: tiene que ser un celular paraguayo, por ejemplo 981 000 000.",
  FORMATO_INVALIDO: `El código tiene ${LONGITUD_CODIGO_OTP} dígitos.`,
  CODIGO_INCORRECTO: "El código no es correcto.",
  INTENTOS_AGOTADOS: "Se agotaron los intentos de este código. Pedí uno nuevo.",
  EXPIRADO: "El código dejó de ser válido. Pedí uno nuevo.",
  YA_UTILIZADO: "Ese código ya fue usado. Pedí uno nuevo.",
  OTP_NO_ENCONTRADO: "No encontramos el código. Pedí uno nuevo.",
  OTP_DE_OTRO_EXPEDIENTE: "No encontramos el código. Pedí uno nuevo.",
  PROPOSITO_INCORRECTO: "Ese código no sirve para verificar el WhatsApp.",
  ESTADO_INVALIDO: "Este proceso ya no está en el paso de verificación de WhatsApp.",
  SESION_INVALIDA: "Se perdió la sesión. Volvé a ingresar tu número.",
  ERROR_ENVIO: "No pudimos enviar el código. Intentá de nuevo en un momento.",
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};

function mensajeDe(motivo: string | undefined, porDefecto: string): string {
  if (!motivo) return porDefecto;
  return MENSAJES[motivo] ?? porDefecto;
}

async function postear(ruta: string, cuerpo?: unknown): Promise<{ status: number; datos: RespuestaApi }> {
  const respuesta = await fetch(ruta, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo ?? {}),
  });
  const datos = (await respuesta.json().catch(() => ({}))) as RespuestaApi;
  return { status: respuesta.status, datos };
}

export function FormularioVerificacionWhatsapp() {
  const [numero, setNumero] = useState("");
  const [autorizado, setAutorizado] = useState(false);
  const [codigo, setCodigo] = useState("");

  const [etapa, setEtapa] = useState<"numero" | "codigo" | "verificado">("numero");
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [numeroEnmascarado, setNumeroEnmascarado] = useState<string | null>(null);
  const [intentosRestantes, setIntentosRestantes] = useState(INTENTOS_MAXIMOS_OTP);
  const [segundosParaReenvio, setSegundosParaReenvio] = useState(0);
  const [registro, setRegistro] = useState<RegistroSeguridad | null>(null);

  const numeroValido = normalizarCelularParaguayo(numero).ok;
  const puedeEnviar = numeroValido && autorizado && !enProceso;
  const puedeVerificar = codigo.length === LONGITUD_CODIGO_OTP && !enProceso;

  useEffect(() => {
    if (segundosParaReenvio <= 0) return;
    const temporizador = setTimeout(() => setSegundosParaReenvio((s) => s - 1), 1000);
    return () => clearTimeout(temporizador);
  }, [segundosParaReenvio]);

  function aplicarRespuestaDeEnvio(datos: RespuestaApi) {
    setNumeroEnmascarado(datos.numeroEnmascarado ?? null);
    setRegistro(datos.registroSeguridad ?? null);
    setIntentosRestantes(INTENTOS_MAXIMOS_OTP);
    setSegundosParaReenvio(COOLDOWN_SEGUNDOS);
    setCodigo("");
    setEtapa("codigo");
  }

  async function enviarCodigo() {
    setEnProceso(true);
    setError(null);
    setAviso(null);
    try {
      const { datos } = await postear("/api/p1/otp/enviar", {
        numero,
        autorizacionAceptada: autorizado,
      });

      if (!datos.ok) {
        if (datos.motivo === "REENVIO_BLOQUEADO" && datos.segundosRestantes) {
          setSegundosParaReenvio(datos.segundosRestantes);
          setError(`Esperá ${datos.segundosRestantes} segundos para pedir otro código.`);
          return;
        }
        setError(mensajeDe(datos.motivo, "No pudimos enviar el código."));
        return;
      }

      aplicarRespuestaDeEnvio(datos);
      setAviso("Te enviamos un código por WhatsApp.");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(false);
    }
  }

  async function reenviarCodigo() {
    if (segundosParaReenvio > 0) return;
    setEnProceso(true);
    setError(null);
    setAviso(null);
    try {
      const { datos } = await postear("/api/p1/otp/reenviar");

      if (!datos.ok) {
        if (datos.motivo === "REENVIO_BLOQUEADO" && datos.segundosRestantes) {
          setSegundosParaReenvio(datos.segundosRestantes);
        }
        setError(mensajeDe(datos.motivo, "No pudimos reenviar el código."));
        return;
      }

      aplicarRespuestaDeEnvio(datos);
      setAviso("Te enviamos un código nuevo. El anterior dejó de servir.");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(false);
    }
  }

  const verificarCodigo = useCallback(
    async (codigoIngresado: string) => {
      setEnProceso(true);
      setError(null);
      setAviso(null);
      try {
        const { datos } = await postear("/api/p1/otp/verificar", { codigo: codigoIngresado });

        if (!datos.ok) {
          if (typeof datos.intentosRestantes === "number") {
            setIntentosRestantes(datos.intentosRestantes);
          }
          if (datos.motivo === "INTENTOS_AGOTADOS") setIntentosRestantes(0);
          setError(mensajeDe(datos.motivo, "No pudimos verificar el código."));
          setCodigo("");
          return;
        }

        setRegistro(datos.registroSeguridad ?? null);
        setEtapa("verificado");
        setAviso("WhatsApp verificado.");
      } catch {
        setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
      } finally {
        setEnProceso(false);
      }
    },
    [],
  );

  function editarNumero() {
    setEtapa("numero");
    setCodigo("");
    setError(null);
    setAviso(null);
  }

  const verificado = etapa === "verificado";

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------------------------------------------------------- */}
      {/* Paso 1 — Ingresá tu número                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-4 rounded-xl border border-borde-sutil bg-superficie p-5">
        <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          Paso 1 — Ingresá tu número
        </h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="p1-pais" className="text-xs font-semibold text-etiqueta">
              País
            </label>
            <select
              id="p1-pais"
              // Paraguay es el único país habilitado: la especificación no
              // contempla contratar desde otro prefijo.
              disabled
              value="PY"
              className="h-11 rounded-lg border border-borde-sutil bg-superficie-suave px-3 text-sm font-semibold text-titulo"
            >
              <option value="PY">Paraguay {PREFIJO_PAIS_PARAGUAY}</option>
            </select>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="p1-numero" className="text-xs font-semibold text-etiqueta">
              Número de WhatsApp
            </label>
            <input
              id="p1-numero"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="Ej.: 981 000 000"
              value={numero}
              disabled={etapa !== "numero" || enProceso}
              onChange={(evento) => setNumero(evento.target.value)}
              className="h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo placeholder:text-etiqueta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500 disabled:opacity-60"
            />
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-cuerpo">
          <input
            type="checkbox"
            checked={autorizado}
            disabled={etapa !== "numero" || enProceso}
            onChange={(evento) => setAutorizado(evento.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-naranja-500"
          />
          <span>{TEXTO_AUTORIZACION_P1}</span>
        </label>

        <button
          type="button"
          onClick={enviarCodigo}
          disabled={!puedeEnviar || etapa !== "numero"}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border-2 border-verde-600 px-5 text-sm font-bold tracking-wide text-verde-700 uppercase transition-colors hover:bg-verde-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto dark:border-verde-400 dark:text-verde-300 dark:hover:bg-verde-950"
        >
          {enProceso && etapa === "numero" ? "Enviando…" : "Enviar código"}
        </button>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Paso 2 — Ingresá el código recibido                               */}
      {/* ---------------------------------------------------------------- */}
      <section
        className={`flex flex-col gap-4 rounded-xl border border-borde-sutil bg-superficie p-5 ${
          etapa === "numero" ? "opacity-50" : ""
        }`}
      >
        <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          Paso 2 — Ingresá el código recibido
        </h2>

        {numeroEnmascarado ? (
          <p className="rounded-lg border border-verde-200 bg-verde-50 px-3 py-2 text-sm font-semibold text-verde-800 dark:border-verde-800 dark:bg-verde-950 dark:text-verde-200">
            Código enviado al número {numeroEnmascarado}
          </p>
        ) : null}

        <CamposOtp
          etiqueta="Código de verificación de WhatsApp"
          idPrefijo="p1-otp"
          valor={codigo}
          onChange={setCodigo}
          onCompleto={verificarCodigo}
          deshabilitado={etapa !== "codigo" || enProceso}
          conError={Boolean(error) && etapa === "codigo"}
        />

        {etapa === "codigo" ? (
          <p className="text-xs text-etiqueta">
            Te quedan {intentosRestantes} de {INTENTOS_MAXIMOS_OTP} intentos con este código.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => verificarCodigo(codigo)}
            disabled={!puedeVerificar || etapa !== "codigo"}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-500 px-5 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enProceso && etapa === "codigo" ? "Verificando…" : "Verificar WhatsApp"}
          </button>

          <button
            type="button"
            onClick={reenviarCodigo}
            disabled={etapa !== "codigo" || segundosParaReenvio > 0 || enProceso}
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 disabled:no-underline disabled:opacity-50 dark:text-azul-200 dark:decoration-azul-500"
          >
            {segundosParaReenvio > 0
              ? `Reenviar código (${segundosParaReenvio}s)`
              : "Reenviar código"}
          </button>

          <button
            type="button"
            onClick={editarNumero}
            disabled={etapa === "verificado" || enProceso}
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 disabled:opacity-50 dark:text-azul-200 dark:decoration-azul-500"
          >
            Editar número
          </button>
        </div>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
          </p>
        ) : null}
        {aviso ? (
          <p role="status" className="text-sm font-semibold text-verde-700 dark:text-verde-300">
            {aviso}
          </p>
        ) : null}

        <div className="flex flex-col gap-1 rounded-lg border border-borde-sutil bg-superficie-suave p-3 text-xs text-cuerpo">
          <p className="font-semibold text-titulo">No compartas el código con nadie.</p>
          <p>
            SeguroLoTengo, Interseguros y Alianza nunca te lo van a pedir por llamada. Si el código
            es incorrecto o deja de ser válido, te mostramos el motivo y podés pedir otro.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Registro de seguridad                                             */}
      {/* ---------------------------------------------------------------- */}
      {registro ? (
        <section className="flex flex-col gap-2 rounded-xl border border-borde-sutil bg-superficie p-5">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Registro de seguridad
          </h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-etiqueta">Fecha y hora</dt>
              <dd className="text-titulo tabular-nums">
                {new Date(registro.fecha).toLocaleString("es-PY")}
              </dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-etiqueta">IP</dt>
              <dd className="text-titulo tabular-nums">{registro.ip}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-etiqueta">Número</dt>
              <dd className="text-titulo tabular-nums">{registro.numeroEnmascarado}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-etiqueta">Referencia del envío</dt>
              <dd className="truncate text-titulo">{registro.referenciaEnvio ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-etiqueta">Resultado</dt>
              <dd className="font-semibold text-verde-700 dark:text-verde-300">
                {registro.resultado}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-etiqueta">El código no se conserva visible.</p>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Continuar                                                         */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col gap-2">
        <a
          href="/p2-plan"
          aria-disabled={!verificado}
          tabIndex={verificado ? undefined : -1}
          onClick={(evento) => {
            if (!verificado) evento.preventDefault();
          }}
          className={`inline-flex h-12 w-full items-center justify-center rounded-lg px-6 text-sm font-bold tracking-wide uppercase sm:w-auto sm:self-start ${
            verificado
              ? "bg-naranja-500 text-azul-950 transition-colors hover:bg-naranja-400"
              : "pointer-events-none cursor-not-allowed bg-superficie-suave text-etiqueta opacity-60"
          }`}
        >
          Continuar →
        </a>
        {!verificado ? (
          <p className="text-xs text-etiqueta">
            Se habilita únicamente después de verificar el WhatsApp.
          </p>
        ) : null}
      </div>
    </div>
  );
}
