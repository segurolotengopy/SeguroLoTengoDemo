"use client";

import { useState } from "react";
import type { Expediente, RegistroEvidencia } from "@/domain/tipos";
import { DetalleExpediente } from "./DetalleExpediente";

/**
 * Búsqueda y listado de la consola administrativa
 * (`docs/CONSOLA_ADMINISTRATIVA.md` §3).
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
  readonly actualizadoEn: string;
  readonly numeroCasoDerivacion: string | null;
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
  { id: "caso", rotulo: "Número de caso", ayuda: "Ej.: CASO-2026-418302" },
  { id: "estado", rotulo: "Estado", ayuda: "Ej.: DERIVADO_MANUAL" },
] as const;

const ESTADOS = [
  "INICIADO",
  "CANAL_WA_VERIFICADO",
  "PLAN_SELECCIONADO",
  "AUTORIZADO",
  "CANAL_EMAIL_VERIFICADO",
  "IDENTIDAD_VERIFICADA",
  "DERIVADO_MANUAL",
  "DECLARACIONES_OK",
  "PAGO_CONFIRMADO",
  "PAQUETE_GENERADO",
  "VENCIDO",
  "DEVOLUCION_EN_TRAMITE",
  "FIRMADO",
  "EMITIDO",
];

/** Estados terminales sin póliza: los que la especificación pide badgear. */
const ESTADOS_BADGE = new Set(["DERIVADO_MANUAL", "VENCIDO", "DEVOLUCION_EN_TRAMITE"]);

const CLASE_CAMPO =
  "h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo placeholder:text-etiqueta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500";

export function Consola({ justificativos }: { justificativos: readonly OpcionJustificativo[] }) {
  const [criterio, setCriterio] = useState<(typeof CRITERIOS)[number]["id"]>("cedula");
  const [valor, setValor] = useState("");
  const [nombre, setNombre] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [resultados, setResultados] = useState<readonly FilaResultado[] | null>(null);
  const [detalle, setDetalle] = useState<DetalleRespuesta | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar() {
    setBuscando(true);
    setError(null);
    setDetalle(null);
    try {
      const parametros = new URLSearchParams({ criterio, valor });
      if (nombre.trim()) parametros.set("nombre", nombre.trim());
      if (criterio === "estado") {
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

  async function abrir(id: string) {
    setError(null);
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
    }
  }

  const criterioActual = CRITERIOS.find((opcion) => opcion.id === criterio);

  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------------------------------------------ */}
      {/* Búsqueda                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-4 rounded-xl border border-borde-sutil bg-superficie p-5">
        <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          Buscar expedientes
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>

        <button
          type="button"
          onClick={buscar}
          disabled={buscando || valor.trim() === ""}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:opacity-40 sm:self-start"
        >
          {buscando ? "Buscando…" : "Buscar"}
        </button>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Resultados                                                          */}
      {/* ------------------------------------------------------------------ */}
      {resultados ? (
        <section className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-5">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Resultados ({resultados.length})
          </h2>

          {resultados.length === 0 ? (
            <p className="text-sm text-cuerpo">Ningún expediente coincide con esa búsqueda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead>
                  <tr className="text-[11px] tracking-wide text-etiqueta uppercase">
                    <th className="py-2 pr-4 font-semibold">Expediente</th>
                    <th className="py-2 pr-4 font-semibold">Titular</th>
                    <th className="py-2 pr-4 font-semibold">Documento</th>
                    <th className="py-2 pr-4 font-semibold">Estado</th>
                    <th className="py-2 pr-4 font-semibold">Última actividad</th>
                    <th className="py-2 font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((fila) => (
                    <tr key={fila.id} className="border-t border-borde-tenue align-top">
                      <td className="py-2 pr-4 font-mono text-xs break-all text-cuerpo">
                        {fila.id}
                        {fila.numeroCasoDerivacion ? (
                          <span className="block font-mono text-[11px] text-etiqueta">
                            {fila.numeroCasoDerivacion}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-cuerpo">{fila.titularEnmascarado ?? "—"}</td>
                      <td className="py-2 pr-4 text-cuerpo tabular-nums">
                        {fila.documentoEnmascarado ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
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
                      <td className="py-2 pr-4 text-cuerpo tabular-nums">
                        {new Date(fila.actualizadoEn).toLocaleString("es-PY")}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => abrir(fila.id)}
                          className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Detalle                                                             */}
      {/* ------------------------------------------------------------------ */}
      {detalle?.expediente ? (
        <DetalleExpediente
          detalle={detalle}
          justificativos={justificativos}
          onReiniciado={() => {
            void abrir(detalle.expediente!.id);
            void buscar();
          }}
        />
      ) : null}
    </div>
  );
}
