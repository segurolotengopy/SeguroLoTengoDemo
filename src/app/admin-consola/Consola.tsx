"use client";

import { useState } from "react";
import { ESTADOS_EXPEDIENTE } from "@/domain/tipos";
import type { Expediente, RegistroEvidencia } from "@/domain/tipos";
import { DetalleExpediente } from "./DetalleExpediente";
import type { IntegracionEvidencia } from "@/domain/evidencia";

/**
 * Búsqueda y listado de la consola administrativa
 * (`docs/CONSOLA_ADMINISTRATIVA.md` §3).
 *
 * Layout pensado para pantalla ancha: panel de búsqueda a la izquierda,
 * resultados ocupando el resto. En pantalla angosta el panel pasa arriba.
 *
 * El listado identifica los expedientes por datos de referencia —cédula,
 * titular, WhatsApp, correo y estado, todos enmascarados— en vez del id
 * interno, que solo aparece dentro del detalle. El detalle se abre como
 * pantalla sobrepuesta (overlay) para no perder la búsqueda de atrás.
 *
 * Es un componente de cliente que solo orquesta llamadas a
 * `/api/admin-consola/*`: ninguna regla de negocio vive acá. Los criterios que
 * ofrece son los tres que la tabla puede resolver con un índice —cédula,
 * número de caso, y estado + rango de fechas— más el filtro por nombre, que el
 * servidor aplica en memoria sobre el resultado (limitación documentada en
 * `src/domain/consola-administrativa.ts`).
 */

export interface OpcionJustificativo {
  readonly id: string;
  readonly rotulo: string;
}

interface FilaResultado {
  readonly id: string;
  readonly estado: string;
  readonly titularEnmascarado: string | null;
  readonly documentoEnmascarado: string | null;
  readonly whatsappEnmascarado: string | null;
  readonly correoEnmascarado: string | null;
  readonly actualizadoEn: string;
  readonly numeroCasoDerivacion: string | null;
  readonly numeroCasoAsistenciaIdentidad: string | null;
  readonly bloqueaRegistro: boolean;
  readonly expedienteAnteriorId: string | null;
}

export interface DetalleRespuesta {
  readonly ok?: boolean;
  readonly expediente?: Expediente;
  readonly evidencias?: readonly RegistroEvidencia[];
  readonly caso?: { readonly numeroCaso: string; readonly motivo: string; readonly derivadoEn: string } | null;
  readonly bloqueo?: {
    readonly estadoBloqueante: boolean;
    readonly bloqueaHoy: boolean;
    readonly sucesorId: string | null;
  };
  readonly cadena?: readonly {
    readonly id: string;
    readonly estado: string;
    readonly creadoEn: string;
    readonly expedienteAnteriorId: string | null;
  }[];
}

const CRITERIOS = [
  { id: "cedula", rotulo: "Cédula", ayuda: "Ej.: 9.323.336" },
  // Celular y correo van primero después de la cédula porque son los únicos
  // datos que existen antes de P5: quien llama trabado en los primeros pasos
  // todavía no tiene cédula cargada.
  { id: "celular", rotulo: "Celular", ayuda: "Ej.: +595 981 000 123 o 0981000123" },
  { id: "correo", rotulo: "Correo", ayuda: "Ej.: persona@correo.com" },
  { id: "caso", rotulo: "Número de caso", ayuda: "Ej.: CASO-2026-418302" },
  { id: "estado", rotulo: "Estado", ayuda: "Ej.: DERIVADO_MANUAL" },
] as const;

/**
 * Estados del selector, **derivados del dominio**. Antes eran una copia a mano
 * y se desactualizó al agregar `ASISTENCIA_IDENTIDAD`: había expedientes en
 * ese estado y la consola no ofrecía filtrarlos.
 */
const ESTADOS = ESTADOS_EXPEDIENTE;

/** Estados terminales sin póliza: los que la especificación pide badgear. */
const ESTADOS_BADGE = new Set([
  "DERIVADO_MANUAL",
  "ASISTENCIA_IDENTIDAD",
  "VENCIDO",
  "DEVOLUCION_EN_TRAMITE",
  "DEVUELTO",
]);

/** Cola de asistencia de identidad: el atajo de un clic al filtro por estado. */
const ESTADO_ASISTENCIA = "ASISTENCIA_IDENTIDAD";

const CLASE_CAMPO =
  "h-10 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-sm text-titulo placeholder:text-etiqueta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500";

const CLASE_ACCION =
  "text-xs font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 disabled:opacity-40 dark:text-azul-200 dark:decoration-azul-500";

export function Consola({
  justificativos,
  descripcionIntegraciones,
}: {
  justificativos: readonly OpcionJustificativo[];
  /** Resuelto en el servidor; solo se transporta hasta VisorEvidencia. */
  descripcionIntegraciones: Record<IntegracionEvidencia, string>;
}) {
  const [criterio, setCriterio] = useState<(typeof CRITERIOS)[number]["id"]>("cedula");
  const [valor, setValor] = useState("");
  const [nombre, setNombre] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  /** Atajo: fija el filtro por estado y busca la cola en un solo clic. */
  async function abrirColaDeAsistencia() {
    setCriterio("estado");
    setValor(ESTADO_ASISTENCIA);
    setDesde("");
    setHasta("");
    await buscar({ criterio: "estado", valor: ESTADO_ASISTENCIA });
  }

  const [resultados, setResultados] = useState<readonly FilaResultado[] | null>(null);
  const [detalle, setDetalle] = useState<DetalleRespuesta | null>(null);
  const [filaFinalizar, setFilaFinalizar] = useState<FilaResultado | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /**
   * `sobrescritos` permite disparar una búsqueda con valores que todavía no
   * pasaron por `setState` — es lo que necesita el atajo de la cola de
   * asistencia, que fija criterio y valor y busca en el mismo clic.
   */
  async function buscar(sobrescritos?: { criterio: typeof criterio; valor: string }) {
    const criterioActivo = sobrescritos?.criterio ?? criterio;
    const valorActivo = sobrescritos?.valor ?? valor;

    setBuscando(true);
    setError(null);
    setAviso(null);
    try {
      const parametros = new URLSearchParams({ criterio: criterioActivo, valor: valorActivo });
      if (nombre.trim()) parametros.set("nombre", nombre.trim());
      if (criterioActivo === "estado") {
        if (desde) parametros.set("desde", desde);
        if (hasta) parametros.set("hasta", `${hasta}T23:59:59.999Z`);
      }

      const respuesta = await fetch(`/api/admin-consola/buscar?${parametros.toString()}`);
      const cuerpo = (await respuesta.json().catch(() => ({}))) as {
        ok?: boolean;
        resultados?: readonly FilaResultado[];
        motivo?: string;
      };

      if (!cuerpo.ok) {
        setResultados(null);
        setError(
          cuerpo.motivo === "VALOR_REQUERIDO"
            ? "Ingresá un valor para buscar."
            : respuesta.status === 401
              ? "Se venció la sesión. Volvé a ingresar la clave."
              : "No pudimos buscar.",
        );
        return;
      }
      setResultados(cuerpo.resultados ?? []);
    } catch {
      setError("No pudimos conectarnos.");
    } finally {
      setBuscando(false);
    }
  }

  async function abrirDetalle(id: string) {
    setError(null);
    setAccionEnCurso(`detalle-${id}`);
    try {
      const respuesta = await fetch(`/api/admin-consola/expediente?id=${encodeURIComponent(id)}`);
      const cuerpo = (await respuesta.json().catch(() => ({}))) as DetalleRespuesta;
      if (!cuerpo.ok) {
        setError("No pudimos abrir el expediente.");
        return;
      }
      setDetalle(cuerpo);
    } catch {
      setError("No pudimos conectarnos.");
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function enviarAAlianza(fila: FilaResultado) {
    setError(null);
    setAviso(null);
    setAccionEnCurso(`alianza-${fila.id}`);
    try {
      const respuesta = await fetch("/api/admin-consola/enviar-alianza", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expedienteId: fila.id }),
      });
      const cuerpo = (await respuesta.json().catch(() => ({}))) as {
        ok?: boolean;
        destinatario?: string;
        asunto?: string;
      };
      if (!cuerpo.ok) {
        setError("No pudimos remitir el caso a Alianza.");
        return;
      }
      setAviso(
        `Caso remitido (simulado) a ${cuerpo.destinatario} — asunto: «${cuerpo.asunto}». Quedó asentado en la evidencia del expediente.`,
      );
    } catch {
      setError("No pudimos conectarnos.");
    } finally {
      setAccionEnCurso(null);
    }
  }

  const criterioActual = CRITERIOS.find((opcion) => opcion.id === criterio);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(17rem,21rem)_1fr] lg:items-start">
      {/* ------------------------------------------------------------------ */}
      {/* Panel izquierdo — búsqueda y acciones                               */}
      {/* ------------------------------------------------------------------ */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
        <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Buscar expedientes
          </h2>

          <div className="flex flex-col gap-1">
            <label htmlFor="ac-criterio" className="text-xs font-semibold text-etiqueta">
              Criterio
            </label>
            <select
              id="ac-criterio"
              value={criterio}
              onChange={(e) => {
                setCriterio(e.target.value as typeof criterio);
                setValor("");
              }}
              className={CLASE_CAMPO}
            >
              {CRITERIOS.map((opcion) => (
                <option key={opcion.id} value={opcion.id}>
                  {opcion.rotulo}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="ac-valor" className="text-xs font-semibold text-etiqueta">
              {criterioActual?.rotulo}
            </label>
            {criterio === "estado" ? (
              <select
                id="ac-valor"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={CLASE_CAMPO}
              >
                <option value="">Elegí un estado</option>
                {ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="ac-valor"
                type="text"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={criterioActual?.ayuda}
                className={CLASE_CAMPO}
              />
            )}
          </div>

          {criterio === "estado" ? (
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="ac-desde" className="text-xs font-semibold text-etiqueta">
                  Desde
                </label>
                <input
                  id="ac-desde"
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className={CLASE_CAMPO}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="ac-hasta" className="text-xs font-semibold text-etiqueta">
                  Hasta
                </label>
                <input
                  id="ac-hasta"
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className={CLASE_CAMPO}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <label htmlFor="ac-nombre" className="text-xs font-semibold text-etiqueta">
              Nombre del titular (filtro)
            </label>
            <input
              id="ac-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Opcional"
              className={CLASE_CAMPO}
            />
          </div>

          <button
            type="button"
            onClick={() => void buscar()}
            disabled={buscando || valor.trim() === ""}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:opacity-40"
          >
            {buscando ? "Buscando…" : "Buscar"}
          </button>

          {/*
            Cola de asistencia de identidad: es un filtro por estado, pero
            merece un atajo porque es una **cola de trabajo** —casos esperando
            que alguien los atienda— y no una consulta puntual. Distinta de la
            derivación de Pantalla A: acá no hay riesgo que analizar, hay una
            captura que resolver, y la persona no está bloqueada.
          */}
          <button
            type="button"
            onClick={() => void abrirColaDeAsistencia()}
            disabled={buscando}
            className="inline-flex h-10 items-center justify-center rounded-lg border-2 border-naranja-500 px-4 text-xs font-bold tracking-wide text-naranja-700 uppercase transition-colors hover:bg-naranja-50 disabled:opacity-40 dark:text-naranja-300 dark:hover:bg-naranja-950"
          >
            Cola de asistencia de identidad
          </button>
        </section>

        <section className="flex flex-col gap-1.5 rounded-lg border border-borde-sutil bg-superficie-suave p-3">
          <h2 className="text-[11px] font-bold tracking-wide text-etiqueta uppercase">
            Acciones por expediente
          </h2>
          <p className="text-xs text-cuerpo">
            <span className="font-semibold text-titulo">Ver detalle:</span> abre el expediente
            completo en una pantalla sobrepuesta.
          </p>
          <p className="text-xs text-cuerpo">
            <span className="font-semibold text-titulo">Finalizar:</span> crea un expediente nuevo
            enlazado al terminal y habilita un registro nuevo con esa cédula. El original no se
            modifica.
          </p>
          <p className="text-xs text-cuerpo">
            <span className="font-semibold text-titulo">Enviar a Alianza:</span> remite el caso por
            correo (simulado en el demo), pensado para expedientes de Pantalla A o B.
          </p>
        </section>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Resultados — ocupan el resto del ancho                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          Resultados{resultados ? ` (${resultados.length})` : ""}
        </h2>

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

        {resultados === null ? (
          <p className="text-sm text-cuerpo">
            Usá el panel de búsqueda para traer expedientes por cédula, número de caso o estado.
          </p>
        ) : resultados.length === 0 ? (
          <p className="text-sm text-cuerpo">Ningún expediente coincide con esa búsqueda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="text-[11px] tracking-wide text-etiqueta uppercase">
                  <th className="py-2 pr-3 font-semibold">Cédula</th>
                  <th className="py-2 pr-3 font-semibold">Titular</th>
                  <th className="py-2 pr-3 font-semibold">WhatsApp</th>
                  <th className="py-2 pr-3 font-semibold">Correo</th>
                  <th className="py-2 pr-3 font-semibold">Estado</th>
                  <th className="py-2 pr-3 font-semibold">Última actividad</th>
                  <th className="py-2 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((fila) => (
                  <tr key={fila.id} className="border-t border-borde-tenue align-top">
                    <td className="py-2 pr-3 text-cuerpo tabular-nums">
                      {fila.documentoEnmascarado ?? "—"}
                      {fila.numeroCasoDerivacion ? (
                        <span className="block font-mono text-[11px] text-etiqueta">
                          {fila.numeroCasoDerivacion}
                        </span>
                      ) : null}
                      {fila.numeroCasoAsistenciaIdentidad ? (
                        <span className="block font-mono text-[11px] text-naranja-700 dark:text-naranja-300">
                          {fila.numeroCasoAsistenciaIdentidad}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-cuerpo">{fila.titularEnmascarado ?? "—"}</td>
                    <td className="py-2 pr-3 text-cuerpo tabular-nums">
                      {fila.whatsappEnmascarado ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-cuerpo">{fila.correoEnmascarado ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="font-semibold text-titulo">{fila.estado}</span>
                      {ESTADOS_BADGE.has(fila.estado) ? (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                            fila.bloqueaRegistro
                              ? "bg-rojo-600 text-white dark:bg-rojo-500"
                              : "border border-borde-sutil text-etiqueta"
                          }`}
                        >
                          {fila.bloqueaRegistro ? "Bloquea" : "Superado"}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-cuerpo tabular-nums">
                      {new Date(fila.actualizadoEn).toLocaleString("es-PY")}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-col items-start gap-1">
                        <button
                          type="button"
                          onClick={() => void abrirDetalle(fila.id)}
                          disabled={accionEnCurso !== null}
                          className={CLASE_ACCION}
                        >
                          {accionEnCurso === `detalle-${fila.id}` ? "Abriendo…" : "Ver detalle"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilaFinalizar(fila)}
                          disabled={accionEnCurso !== null || !fila.bloqueaRegistro}
                          title={
                            fila.bloqueaRegistro
                              ? "Crear un expediente nuevo y habilitar el registro"
                              : "Solo aplica a expedientes terminales que bloquean el registro"
                          }
                          className={CLASE_ACCION}
                        >
                          Finalizar
                        </button>
                        <button
                          type="button"
                          onClick={() => void enviarAAlianza(fila)}
                          disabled={accionEnCurso !== null}
                          className={CLASE_ACCION}
                        >
                          {accionEnCurso === `alianza-${fila.id}`
                            ? "Enviando…"
                            : "Enviar a Alianza"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Detalle — pantalla sobrepuesta                                      */}
      {/* ------------------------------------------------------------------ */}
      {detalle?.expediente ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Detalle del expediente"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
        >
          <div
            aria-hidden="true"
            onClick={() => setDetalle(null)}
            className="fixed inset-0 bg-azul-950/60"
          />
          <div className="relative flex w-full max-w-5xl flex-col gap-3 rounded-xl border border-borde-sutil bg-fondo p-4 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                Detalle del expediente
              </h2>
              <button
                type="button"
                onClick={() => setDetalle(null)}
                aria-label="Cerrar detalle"
                className="rounded-lg border border-borde-sutil px-2.5 py-1 text-sm font-bold text-cuerpo hover:bg-superficie-suave"
              >
                ✕
              </button>
            </div>
            <DetalleExpediente
              detalle={detalle}
              justificativos={justificativos}
              descripcionIntegraciones={descripcionIntegraciones}
              onReiniciado={() => {
                void abrirDetalle(detalle.expediente!.id);
                void buscar();
              }}
            />
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Finalizar — reinicio con justificativo, sobrepuesto                 */}
      {/* ------------------------------------------------------------------ */}
      {filaFinalizar ? (
        <ModalFinalizar
          fila={filaFinalizar}
          justificativos={justificativos}
          onCerrar={() => setFilaFinalizar(null)}
          onFinalizado={(mensaje) => {
            setFilaFinalizar(null);
            setAviso(mensaje);
            void buscar();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * "Finalizar" = el reinicio con justificativo de la consola: crea un
 * expediente nuevo enlazado al terminal (nunca reactiva el original, regla
 * inviolable #5) y con eso habilita un registro nuevo para esa cédula.
 */
function ModalFinalizar({
  fila,
  justificativos,
  onCerrar,
  onFinalizado,
}: {
  fila: { readonly id: string; readonly estado: string; readonly documentoEnmascarado: string | null };
  justificativos: readonly OpcionJustificativo[];
  onCerrar: () => void;
  onFinalizado: (mensaje: string) => void;
}) {
  const [justificativo, setJustificativo] = useState("");
  const [detalleLibre, setDetalleLibre] = useState("");
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiereDetalle = justificativo === "OTRO";
  const puedeConfirmar =
    justificativo !== "" && (!requiereDetalle || detalleLibre.trim() !== "") && !enProceso;

  async function confirmar() {
    setEnProceso(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/admin-consola/reinicio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expedienteId: fila.id,
          justificativo,
          detalleLibre: detalleLibre.trim() || undefined,
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => ({}))) as {
        ok?: boolean;
        motivo?: string;
        expedienteNuevoId?: string;
      };

      if (!cuerpo.ok) {
        setError(
          cuerpo.motivo === "YA_REINICIADO"
            ? "Este expediente ya fue finalizado antes."
            : cuerpo.motivo === "ESTADO_NO_REINICIABLE"
              ? "Solo se finalizan expedientes derivados o vencidos."
              : cuerpo.motivo === "DETALLE_REQUERIDO"
                ? "El justificativo «Otro» necesita una explicación."
                : "No pudimos finalizar el expediente.",
        );
        return;
      }

      onFinalizado(
        `Expediente finalizado: se creó ${cuerpo.expedienteNuevoId ?? "un expediente nuevo"} enlazado al anterior y la cédula queda habilitada para un registro nuevo.`,
      );
    } catch {
      setError("No pudimos conectarnos.");
    } finally {
      setEnProceso(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Finalizar expediente"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div aria-hidden="true" onClick={onCerrar} className="absolute inset-0 bg-azul-950/60" />
      <div className="relative flex w-full max-w-md flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-4 shadow-xl">
        <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          Finalizar expediente
        </h2>
        <p className="text-xs text-cuerpo">
          Cédula {fila.documentoEnmascarado ?? "—"} · estado {fila.estado}. Se crea un expediente
          nuevo enlazado al terminal; el original no se modifica y el bloqueo por cédula queda
          levantado.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor="fin-justificativo" className="text-xs font-semibold text-etiqueta">
            Justificativo *
          </label>
          <select
            id="fin-justificativo"
            value={justificativo}
            onChange={(e) => setJustificativo(e.target.value)}
            className="h-10 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-sm text-titulo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500"
          >
            <option value="">Elegí un justificativo</option>
            {justificativos.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="fin-detalle" className="text-xs font-semibold text-etiqueta">
            Detalle {requiereDetalle ? "*" : "(opcional)"}
          </label>
          <input
            id="fin-detalle"
            type="text"
            value={detalleLibre}
            onChange={(e) => setDetalleLibre(e.target.value)}
            maxLength={500}
            className="h-10 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-sm text-titulo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-borde-sutil px-4 text-xs font-bold tracking-wide text-cuerpo uppercase hover:bg-superficie-suave"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirmar()}
            disabled={!puedeConfirmar}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-naranja-500 px-4 text-xs font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:opacity-40"
          >
            {enProceso ? "Finalizando…" : "Finalizar y habilitar registro"}
          </button>
        </div>
      </div>
    </div>
  );
}
