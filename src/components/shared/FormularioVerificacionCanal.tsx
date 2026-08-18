"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CamposOtp } from "./CamposOtp";
import { COOLDOWN_REENVIO_MS, INTENTOS_MAXIMOS_OTP, LONGITUD_CODIGO_OTP } from "@/domain/reglas-otp";

/**
 * Formulario de verificación de canal por OTP, compartido por P1 (WhatsApp) y
 * P4 (correo). La especificación describe P4 como *"estructura idéntica a P1
 * pero para correo electrónico"*, así que el widget es uno solo y lo que
 * cambia —textos, rutas, tipo de campo, validación local— entra por props.
 *
 * Es el reflejo en la UI de lo que `src/domain/verificacion-canal.ts` hace en
 * el dominio: una sola mecánica, dos configuraciones.
 *
 * No tiene lógica de negocio: valida el formato del destino solo para
 * habilitar el botón (la validación que manda es la del servidor), y todo lo
 * demás —vigencia, intentos, cooldown, transición de estado— lo deciden los
 * Route Handlers.
 *
 * El código de verificación existe únicamente en el estado local mientras se
 * tipea; ninguna respuesta de la API lo trae, así que no hay forma de
 * mostrarlo ni de rellenarlo automáticamente.
 */

const COOLDOWN_SEGUNDOS = COOLDOWN_REENVIO_MS / 1000;

interface RegistroSeguridad {
  readonly fecha: string;
  readonly ip: string;
  readonly destinoEnmascarado: string;
  readonly referenciaEnvio: string | null;
  readonly resultado: "EXITOSO" | "FALLIDO";
}

interface RespuestaApi {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly destinoEnmascarado?: string;
  readonly expiraEn?: string;
  readonly estado?: string;
  readonly intentosRestantes?: number;
  readonly segundosRestantes?: number;
  readonly registroSeguridad?: RegistroSeguridad;
  /**
   * A dónde puede seguir esta persona cuando su expediente ya no está en este
   * paso. Lo calcula el servidor con `destinoDelExpediente`.
   */
  readonly destino?: { readonly ruta: string; readonly rotulo: string; readonly terminal: boolean };
}

/** Mensajes iguales en las dos pantallas. Cada una agrega los suyos. */
const MENSAJES_COMUNES: Readonly<Record<string, string>> = {
  FORMATO_INVALIDO: `El código tiene ${LONGITUD_CODIGO_OTP} dígitos.`,
  CODIGO_INCORRECTO: "El código no es correcto.",
  INTENTOS_AGOTADOS: "Se agotaron los intentos de este código. Pedí uno nuevo.",
  EXPIRADO: "El código dejó de ser válido. Pedí uno nuevo.",
  YA_UTILIZADO: "Ese código ya fue usado. Pedí uno nuevo.",
  OTP_NO_ENCONTRADO: "No encontramos el código. Pedí uno nuevo.",
  OTP_DE_OTRO_EXPEDIENTE: "No encontramos el código. Pedí uno nuevo.",
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar el proceso.",
  ERROR_ENVIO: "No pudimos enviar el código. Intentá de nuevo en un momento.",
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};

async function postear(ruta: string, cuerpo?: unknown): Promise<{ status: number; datos: RespuestaApi }> {
  const respuesta = await fetch(ruta, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo ?? {}),
  });
  const datos = (await respuesta.json().catch(() => ({}))) as RespuestaApi;
  return { status: respuesta.status, datos };
}

export interface FormularioVerificacionCanalProps {
  /** Prefijo de los `id` de los campos, para que dos formularios no colisionen. */
  idPrefijo: string;
  rutas: { enviar: string; reenviar: string; verificar: string };
  /** Nombre del campo en el cuerpo del POST de envío (`numero` en P1, `correo` en P4). */
  campoDestino: string;

  paso1Titulo: string;
  etiquetaDestino: string;
  placeholderDestino: string;
  tipoCampo: "tel" | "email";
  autoCompleteCampo: string;
  /** Prefijo fijo a la izquierda del campo (el selector de país de P1). */
  prefijoCampo?: ReactNode;
  /**
   * Aviso opcional arriba del campo del paso 1 (P1 lo usa para la
   * instrucción de iniciar la conversación en la fase de pruebas del canal
   * real). No es parte de la especificación: quien lo pasa decide cuándo
   * corresponde mostrarlo.
   */
  avisoPaso1?: ReactNode;
  /** Checkbox obligatorio antes de enviar. Si no se pasa, no hay checkbox. */
  textoAutorizacion?: string;
  botonEnviar: string;

  paso2Titulo: string;
  etiquetaCodigo: string;
  botonVerificar: string;
  enlaceEditar: string;
  /** Ej.: (destino) => `Código enviado al número ${destino}` */
  leyendaEnviado: (destinoEnmascarado: string) => string;
  avisoEnviado: string;
  avisoReenviado: string;
  avisoVerificado: string;

  /** Bloque de advertencias al pie del paso 2. */
  advertencias: ReactNode;
  /** Mensajes propios de la pantalla; pisan a los comunes. */
  mensajes?: Readonly<Record<string, string>>;

  hrefContinuar: string;
  textoContinuar: string;
  notaContinuar: string;

  /** Validación local, solo para habilitar el botón. */
  validarDestino: (valor: string) => boolean;
  /**
   * Compone el valor que viaja al servidor a partir de lo tipeado (P1 le
   * antepone el prefijo del país seleccionado). Si no se pasa, viaja tal cual.
   */
  componerDestino?: (valor: string) => string;
}

export function FormularioVerificacionCanal({
  idPrefijo,
  rutas,
  campoDestino,
  paso1Titulo,
  etiquetaDestino,
  placeholderDestino,
  tipoCampo,
  autoCompleteCampo,
  prefijoCampo,
  avisoPaso1,
  textoAutorizacion,
  botonEnviar,
  paso2Titulo,
  etiquetaCodigo,
  botonVerificar,
  enlaceEditar,
  leyendaEnviado,
  avisoEnviado,
  avisoReenviado,
  avisoVerificado,
  advertencias,
  mensajes,
  hrefContinuar,
  textoContinuar,
  notaContinuar,
  validarDestino,
  componerDestino,
}: FormularioVerificacionCanalProps) {
  const [destino, setDestino] = useState("");
  const [autorizado, setAutorizado] = useState(false);
  const [codigo, setCodigo] = useState("");

  const [etapa, setEtapa] = useState<"destino" | "codigo" | "verificado">("destino");
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Camino ofrecido cuando el expediente ya no está en este paso. */
  const [reencaminado, setReencaminado] = useState<RespuestaApi["destino"] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [destinoEnmascarado, setDestinoEnmascarado] = useState<string | null>(null);
  const [intentosRestantes, setIntentosRestantes] = useState(INTENTOS_MAXIMOS_OTP);
  const [segundosParaReenvio, setSegundosParaReenvio] = useState(0);
  const [registro, setRegistro] = useState<RegistroSeguridad | null>(null);

  const requiereAutorizacion = textoAutorizacion !== undefined;
  const destinoValido = validarDestino(destino);
  const puedeEnviar = destinoValido && (!requiereAutorizacion || autorizado) && !enProceso;
  const puedeVerificar = codigo.length === LONGITUD_CODIGO_OTP && !enProceso;

  function mensajeDe(motivo: string | undefined, porDefecto: string): string {
    if (!motivo) return porDefecto;
    return mensajes?.[motivo] ?? MENSAJES_COMUNES[motivo] ?? porDefecto;
  }

  useEffect(() => {
    if (segundosParaReenvio <= 0) return;
    const temporizador = setTimeout(() => setSegundosParaReenvio((s) => s - 1), 1000);
    return () => clearTimeout(temporizador);
  }, [segundosParaReenvio]);

  function aplicarRespuestaDeEnvio(datos: RespuestaApi) {
    setDestinoEnmascarado(datos.destinoEnmascarado ?? null);
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
      const { datos } = await postear(rutas.enviar, {
        [campoDestino]: componerDestino ? componerDestino(destino) : destino,
        ...(requiereAutorizacion ? { autorizacionAceptada: autorizado } : {}),
      });

      if (!datos.ok) {
        if (datos.motivo === "REENVIO_BLOQUEADO" && datos.segundosRestantes) {
          setSegundosParaReenvio(datos.segundosRestantes);
          setError(`Esperá ${datos.segundosRestantes} segundos para pedir otro código.`);
          return;
        }
        setError(mensajeDe(datos.motivo, "No pudimos enviar el código."));
        setReencaminado(datos.destino ?? null);
        return;
      }

      aplicarRespuestaDeEnvio(datos);
      setAviso(avisoEnviado);
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
      const { datos } = await postear(rutas.reenviar);

      if (!datos.ok) {
        if (datos.motivo === "REENVIO_BLOQUEADO" && datos.segundosRestantes) {
          setSegundosParaReenvio(datos.segundosRestantes);
        }
        setError(mensajeDe(datos.motivo, "No pudimos reenviar el código."));
        return;
      }

      aplicarRespuestaDeEnvio(datos);
      setAviso(avisoReenviado);
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
        const { datos } = await postear(rutas.verificar, { codigo: codigoIngresado });

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
        setAviso(avisoVerificado);
      } catch {
        setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
      } finally {
        setEnProceso(false);
      }
    },
    // `mensajeDe` y los textos son estables durante la vida de la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rutas.verificar, avisoVerificado],
  );

  function editarDestino() {
    setEtapa("destino");
    setCodigo("");
    setError(null);
    setAviso(null);
  }

  const verificado = etapa === "verificado";

  return (
    <div className="flex flex-col gap-4">
      {/* En pantallas anchas los dos pasos van lado a lado para que el flujo
          completo entre sin scroll; en angostas se apilan. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* ---------------------------------------------------------------- */}
      {/* Paso 1 — Ingresá tu destino                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          {paso1Titulo}
        </h2>

        {avisoPaso1}

        <div className="flex flex-wrap items-end gap-3">
          {prefijoCampo}

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={`${idPrefijo}-destino`} className="text-xs font-semibold text-etiqueta">
              {etiquetaDestino}
            </label>
            <input
              id={`${idPrefijo}-destino`}
              type={tipoCampo}
              {...(tipoCampo === "tel" ? { inputMode: "numeric" as const } : {})}
              autoComplete={autoCompleteCampo}
              placeholder={placeholderDestino}
              value={destino}
              disabled={etapa !== "destino" || enProceso}
              onChange={(evento) => setDestino(evento.target.value)}
              className="h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo placeholder:text-etiqueta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500 disabled:opacity-60"
            />
          </div>
        </div>

        {textoAutorizacion ? (
          <label className="flex items-start gap-2.5 text-sm text-cuerpo">
            <input
              type="checkbox"
              checked={autorizado}
              disabled={etapa !== "destino" || enProceso}
              onChange={(evento) => setAutorizado(evento.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-naranja-500"
            />
            <span>{textoAutorizacion}</span>
          </label>
        ) : null}

        <button
          type="button"
          onClick={enviarCodigo}
          disabled={!puedeEnviar || etapa !== "destino"}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border-2 border-verde-600 px-5 text-sm font-bold tracking-wide text-verde-700 uppercase transition-colors hover:bg-verde-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto dark:border-verde-400 dark:text-verde-300 dark:hover:bg-verde-950"
        >
          {enProceso && etapa === "destino" ? "Enviando…" : botonEnviar}
        </button>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Paso 2 — Ingresá el código recibido                               */}
      {/* ---------------------------------------------------------------- */}
      <section
        className={`flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4 ${
          etapa === "destino" ? "opacity-50" : ""
        }`}
      >
        <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          {paso2Titulo}
        </h2>

        {destinoEnmascarado ? (
          <p className="rounded-lg border border-verde-200 bg-verde-50 px-3 py-2 text-sm font-semibold text-verde-800 dark:border-verde-800 dark:bg-verde-950 dark:text-verde-200">
            {leyendaEnviado(destinoEnmascarado)}
          </p>
        ) : null}

        <CamposOtp
          etiqueta={etiquetaCodigo}
          idPrefijo={`${idPrefijo}-otp`}
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
            {enProceso && etapa === "codigo" ? "Verificando…" : botonVerificar}
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
            onClick={editarDestino}
            disabled={etapa === "verificado" || enProceso}
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 disabled:opacity-50 dark:text-azul-200 dark:decoration-azul-500"
          >
            {enlaceEditar}
          </button>
        </div>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
          </p>
        ) : null}

        {/* Reencaminado: el servidor sabe dónde quedó el trámite, así que en
            vez de dejar a la persona leyendo un aviso se le ofrece el camino.
            Sin esto, la única salida era borrar las cookies del navegador. */}
        {reencaminado ? (
          <a
            href={reencaminado.ruta}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 sm:self-start"
          >
            {reencaminado.rotulo} →
          </a>
        ) : null}
        {aviso ? (
          <p role="status" className="text-sm font-semibold text-verde-700 dark:text-verde-300">
            {aviso}
          </p>
        ) : null}

        <div className="flex flex-col gap-1 rounded-lg border border-borde-sutil bg-superficie-suave p-2.5 text-xs text-cuerpo">
          {advertencias}
        </div>
      </section>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Registro de seguridad                                             */}
      {/* ---------------------------------------------------------------- */}
      {registro ? (
        <section className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-4">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Registro de seguridad
          </h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-5">
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
              <dt className="text-etiqueta">Destino</dt>
              <dd className="text-titulo tabular-nums">{registro.destinoEnmascarado}</dd>
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
          href={hrefContinuar}
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
          {textoContinuar}
        </a>
        {!verificado ? <p className="text-xs text-etiqueta">{notaContinuar}</p> : null}
      </div>
    </div>
  );
}
