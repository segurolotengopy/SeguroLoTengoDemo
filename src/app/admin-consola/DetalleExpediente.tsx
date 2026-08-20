"use client";

import { useState } from "react";
import { VisorEvidencia } from "@/components/shared";
import type { IntegracionEvidencia } from "@/domain/evidencia";
import { formatearGuaranies, PLANES } from "@/domain/catalogo";
import { TEXTOS_DECLARACIONES_P6 } from "@/domain/textos-p6";
import { DECLARACIONES_P6 } from "@/domain/elegibilidad";
import {
  ROTULO_MOTIVO_DEVOLUCION,
  ROTULO_SOLICITANTE_DEVOLUCION,
  leerSeguimientoDevolucion,
} from "@/domain/textos-devolucion";
import type { MotivoDevolucion, SolicitanteDevolucion } from "@/domain/tipos";
import type { DetalleRespuesta, OpcionJustificativo } from "./Consola";

/**
 * Vista de detalle de un expediente (`docs/CONSOLA_ADMINISTRATIVA.md` §4):
 * datos, declaraciones, estado terminal, registro de evidencia y el reinicio
 * con justificativo.
 *
 * ## Por qué acá sí se muestran salud y PEP
 *
 * La regla inviolable #7 prohíbe que las respuestas médicas y la condición PEP
 * salgan hacia **analítica, CRM, monitoreo de errores o servicios de IA**. Esta
 * consola no es ninguno de esos destinos: es la herramienta de cumplimiento
 * interno de AAB1 / Interseguros / Alianza, y necesita ver lo que se declaró
 * para poder auditar por qué el sistema derivó un caso. El documento de la
 * consola lo pide de forma expresa y pide dejarlo escrito en el código, que es
 * lo que hace este comentario. **No copiar este criterio a ninguna otra
 * pantalla ni endpoint.**
 *
 * Todo es de solo lectura: no hay ningún control que edite el expediente.
 */

const CLASE_CAMPO =
  "h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500";

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-5">
      <h3 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string | number | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-etiqueta">{rotulo}</dt>
      <dd className="text-sm break-words text-titulo">{valor === null || valor === undefined || valor === "" ? "—" : String(valor)}</dd>
    </div>
  );
}

/**
 * Cada motivo dice qué hacer, no solo qué pasó: quien opera la consola tiene
 * que poder resolverlo sin preguntarle a nadie.
 */
const MENSAJES_DEVOLUCION: Readonly<Record<string, string>> = {
  SIN_COBRO_ACREDITADO:
    "Este expediente no tiene un cobro acreditado: no hay nada que devolver.",
  ESTADO_INVALIDO:
    "Solo se abre una devolución sobre un expediente con el cobro confirmado o ya emitido, y solo se acredita sobre uno en trámite.",
  SIN_TRAMITE_ABIERTO: "No hay ningún trámite de devolución abierto para acreditar.",
  REFERENCIA_REQUERIDA:
    "Para cerrar el trámite hace falta la referencia del reintegro: es lo que lo vuelve auditable.",
  MOTIVO_INVALIDO: "Elegí un motivo de la lista.",
  SOLICITANTE_INVALIDO: "Elegí quién pide la devolución.",
  EXPEDIENTE_NO_ENCONTRADO: "No encontramos el expediente. Volvé a buscarlo.",
};

export function DetalleExpediente({
  detalle,
  justificativos,
  onReiniciado,
  descripcionIntegraciones,
}: {
  detalle: DetalleRespuesta;
  justificativos: readonly OpcionJustificativo[];
  onReiniciado: () => void;
  /** Viene del servidor por la cadena page → Consola → acá; ver VisorEvidencia. */
  descripcionIntegraciones: Record<IntegracionEvidencia, string>;
}) {
  const expediente = detalle.expediente;
  const [justificativo, setJustificativo] = useState("");
  const [detalleLibre, setDetalleLibre] = useState("");
  const [enProceso, setEnProceso] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [solicitante, setSolicitante] = useState<SolicitanteDevolucion>("TITULAR");
  const [motivoDevolucion, setMotivoDevolucion] = useState<MotivoDevolucion>("PEDIDO_DEL_TITULAR");
  const [referenciaReintegro, setReferenciaReintegro] = useState("");

  if (!expediente) return null;

  const bloqueo = detalle.bloqueo;
  const puedeReiniciar = bloqueo?.estadoBloqueante === true && bloqueo.sucesorId === null;
  const requiereDetalle = justificativo === "OTRO";

  async function reiniciar() {
    if (!expediente) return;
    setEnProceso(true);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch("/api/admin-consola/reinicio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expedienteId: expediente.id,
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
            ? "Este expediente ya fue reiniciado antes."
            : cuerpo.motivo === "ESTADO_NO_REINICIABLE"
              ? "Solo se reinician expedientes derivados o vencidos."
              : cuerpo.motivo === "DETALLE_REQUERIDO"
                ? "El justificativo «Otro» necesita una explicación."
                : "No pudimos reiniciar el expediente.",
        );
        return;
      }

      setMensaje(`Se creó el expediente ${cuerpo.expedienteNuevoId}, enlazado a este.`);
      setJustificativo("");
      setDetalleLibre("");
      onReiniciado();
    } catch {
      setError("No pudimos conectarnos.");
    } finally {
      setEnProceso(false);
    }
  }

  /**
   * Abre o cierra el trámite de devolución (D-02). La consola **asienta** el
   * trámite: la devolución la hacen Bancard y Alianza fuera del flujo digital.
   */
  async function moverDevolucion(accion: "SOLICITAR" | "ACREDITAR") {
    if (!expediente) return;
    setEnProceso(true);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch("/api/admin-consola/devolucion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expedienteId: expediente.id,
          accion,
          solicitante,
          motivo: motivoDevolucion,
          referenciaReintegro: referenciaReintegro.trim(),
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => ({}))) as {
        ok?: boolean;
        motivo?: string;
      };

      if (!cuerpo.ok) {
        setError(MENSAJES_DEVOLUCION[cuerpo.motivo ?? ""] ?? "No pudimos mover el trámite.");
        return;
      }

      setMensaje(
        accion === "SOLICITAR"
          ? "Trámite de devolución abierto. El expediente quedó en DEVOLUCION_EN_TRAMITE."
          : "Devolución acreditada. El expediente quedó en DEVUELTO.",
      );
      setReferenciaReintegro("");
      onReiniciado();
    } catch {
      setError("No pudimos conectarnos.");
    } finally {
      setEnProceso(false);
    }
  }

  const seguimiento = leerSeguimientoDevolucion(expediente);
  const puedeSolicitarDevolucion =
    seguimiento === null && ["PAGO_CONFIRMADO", "EMITIDO"].includes(expediente.estado);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-titulo">
        Expediente <span className="font-mono text-base">{expediente.id}</span>
      </h2>

      {/* Estado terminal visible (§4) */}
      {bloqueo?.estadoBloqueante ? (
        <div className="flex flex-col gap-1 rounded-xl border border-rojo-300 bg-rojo-50 p-4 dark:border-rojo-700 dark:bg-rojo-950">
          <p className="text-[11px] font-bold tracking-wide text-rojo-800 uppercase dark:text-rojo-200">
            Estado terminal sin póliza · {expediente.estado}
          </p>
          {detalle.caso ? (
            <p className="text-sm text-rojo-900 dark:text-rojo-100">
              Caso <span className="font-mono font-bold">{detalle.caso.numeroCaso}</span> · motivo{" "}
              {detalle.caso.motivo} · derivado el{" "}
              {new Date(detalle.caso.derivadoEn).toLocaleString("es-PY")}
            </p>
          ) : ["VENCIDO", "DEVOLUCION_EN_TRAMITE", "DEVUELTO"].includes(expediente.estado) ? (
            // La rama del vencimiento (§4 pide motivo y fecha para las dos
            // ramas por igual, no solo para DERIVADO_MANUAL).
            <p className="text-sm text-rojo-900 dark:text-rojo-100">
              Motivo: no se pagó dentro del plazo
              {expediente.plazoPagoVenceEn
                ? ` · venció el ${new Date(expediente.plazoPagoVenceEn).toLocaleString("es-PY")}`
                : ""}
            </p>
          ) : null}
          <p className="text-sm text-rojo-900 dark:text-rojo-100">
            {bloqueo.bloqueaHoy
              ? "Bloquea un registro nuevo con esta cédula."
              : `Ya fue superado por el expediente ${bloqueo.sucesorId ?? "—"}: no bloquea.`}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloque titulo="Meta">
          <dl className="grid grid-cols-2 gap-3">
            <Dato rotulo="Estado" valor={expediente.estado} />
            <Dato rotulo="Creado" valor={new Date(expediente.creadoEn).toLocaleString("es-PY")} />
            <Dato
              rotulo="Última actividad"
              valor={new Date(expediente.actualizadoEn).toLocaleString("es-PY")}
            />
            <Dato rotulo="Expediente anterior" valor={expediente.expedienteAnteriorId} />
            <Dato rotulo="Número de caso" valor={expediente.numeroCasoDerivacion} />
            <Dato
              rotulo="Canal WhatsApp"
              valor={expediente.canalWhatsapp ? "verificado" : null}
            />
            <Dato rotulo="Canal correo" valor={expediente.canalEmail ? "verificado" : null} />
            <Dato
              rotulo="Plan"
              valor={
                expediente.plan
                  ? `${PLANES[expediente.plan.planId].nombre} · ${formatearGuaranies(expediente.plan.premioAnualGs)}`
                  : null
              }
            />
          </dl>
        </Bloque>

        <Bloque titulo="Identidad">
          {expediente.identidad ? (
            <dl className="grid grid-cols-2 gap-3">
              <Dato rotulo="Cédula" valor={expediente.identidad.numeroCedula} />
              <Dato rotulo="Nombres" valor={expediente.identidad.nombres} />
              <Dato rotulo="Apellidos" valor={expediente.identidad.apellidos} />
              <Dato rotulo="Nacimiento" valor={expediente.identidad.fechaNacimiento} />
              <Dato rotulo="Sexo" valor={expediente.identidad.sexo} />
              <Dato rotulo="Nacionalidad" valor={expediente.identidad.nacionalidad} />
              <Dato rotulo="País de nacimiento" valor={expediente.identidad.paisNacimiento} />
              <Dato rotulo="Estado civil" valor={expediente.identidad.estadoCivil} />
              <Dato
                rotulo="Prueba de vida"
                valor={expediente.identidad.captura.pruebaDeVidaAprobada ? "aprobada" : "no aprobada"}
              />
              <Dato
                rotulo="Coincidencia facial"
                valor={
                  expediente.identidad.captura.coincidenciaFacialAprobada ? "aprobada" : "no aprobada"
                }
              />
            </dl>
          ) : (
            <p className="text-sm text-cuerpo">Sin identidad verificada todavía.</p>
          )}
        </Bloque>

        <Bloque titulo="Datos complementarios (FIPF)">
          {expediente.datosComplementarios ? (
            <dl className="grid grid-cols-2 gap-3">
              <Dato rotulo="Domicilio" valor={expediente.datosComplementarios.domicilio} />
              <Dato rotulo="Ciudad" valor={expediente.datosComplementarios.ciudad} />
              <Dato
                rotulo="Situación laboral"
                valor={expediente.datosComplementarios.situacionLaboral}
              />
              <Dato rotulo="Actividad" valor={expediente.datosComplementarios.actividad} />
              <Dato rotulo="Profesión" valor={expediente.datosComplementarios.profesion} />
              <Dato rotulo="Empresa" valor={expediente.datosComplementarios.empresa} />
              <Dato
                rotulo="Ingreso mensual"
                valor={formatearGuaranies(expediente.datosComplementarios.ingresoMensualDeclaradoGs)}
              />
              <Dato
                rotulo="Beneficiario"
                valor={
                  expediente.beneficiario?.tipo === "HEREDEROS_LEGALES"
                    ? "Herederos legales — 100%"
                    : `${expediente.beneficiario?.nombreCompleto} (${expediente.beneficiario?.parentesco})`
                }
              />
            </dl>
          ) : (
            <p className="text-sm text-cuerpo">Todavía sin datos complementarios.</p>
          )}
        </Bloque>

        <Bloque titulo="Declaraciones · dato sensible de cumplimiento">
          {expediente.declaraciones ? (
            <>
              <p className="rounded-lg border border-naranja-200 bg-naranja-50 px-3 py-2 text-xs text-naranja-900 dark:border-naranja-800 dark:bg-naranja-950 dark:text-naranja-200">
                Respuestas médicas y condición PEP. Visibles solo en esta consola de cumplimiento
                interno: no salen hacia analítica, CRM, monitoreo ni servicios de IA (regla
                inviolable #7).
              </p>
              <ol className="flex flex-col gap-1.5">
                {TEXTOS_DECLARACIONES_P6.map((texto) => {
                  const definicion = DECLARACIONES_P6.find((d) => d.numero === texto.numero);
                  if (!definicion || !expediente.declaraciones) return null;
                  const respuesta = expediente.declaraciones[definicion.clave];
                  const compatible = respuesta === definicion.respuestaHabilitante;

                  return (
                    <li key={texto.numero} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-cuerpo">
                        {texto.numero}. {texto.titulo}
                      </span>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${
                          compatible
                            ? "bg-verde-100 text-verde-800 dark:bg-verde-950 dark:text-verde-200"
                            : "bg-rojo-600 text-white dark:bg-rojo-500"
                        }`}
                      >
                        {respuesta === "SI" ? "Sí" : "No"}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {expediente.motivoDerivacionManual ? (
                <p className="text-xs font-semibold text-rojo-700 dark:text-rojo-300">
                  Declaraciones que bloquearon: {expediente.motivoDerivacionManual.join(", ")}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-cuerpo">Todavía sin declaraciones.</p>
          )}
        </Bloque>

        <Bloque titulo="Pago y paquete documental">
          <dl className="grid grid-cols-2 gap-3">
            <Dato rotulo="Medio de pago" valor={expediente.pago?.medio} />
            <Dato rotulo="Estado del pago" valor={expediente.pago?.estado} />
            <Dato rotulo="Referencia Bancard" valor={expediente.pago?.referenciaBancard} />
            <Dato rotulo="Documento" valor={expediente.paqueteDocumental?.codigo} />
            <Dato rotulo="Sección FIPF" valor={expediente.paqueteDocumental?.codigoSeccionFipf} />
            <Dato rotulo="Firma (Code100)" valor={expediente.firma?.idCode100} />
          </dl>

          {/* D-13 · quién firmó, con qué nivel y en qué modalidad. La consola
              es el único lugar donde esto se puede ver, y sin ello un
              expediente FIRMADO no dice quién lo firmó. */}
          {expediente.firmasInstitucionales.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {expediente.firmasInstitucionales.map((firma) => (
                <li key={firma.rol} className="text-xs text-cuerpo">
                  <span className="font-semibold">{firma.rol}</span> · {firma.nivel} ·{" "}
                  {firma.modalidad} · <code className="font-mono">{firma.certificado}</code> ·{" "}
                  <span className="tabular-nums">
                    {new Date(firma.aplicadaEn).toLocaleString("es-PY")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-etiqueta">Sin firmas institucionales aplicadas todavía.</p>
          )}
          <p className="text-xs text-etiqueta">
            Nunca se almacena el número completo de tarjeta ni el CVV (regla inviolable #6), ni el
            código de un OTP en claro (regla #2).
          </p>
        </Bloque>

        <Bloque titulo="Póliza y factura (las emite Alianza)">
          {expediente.poliza ? (
            <dl className="grid grid-cols-2 gap-3">
              <Dato rotulo="Número de póliza" valor={expediente.poliza.numeroPoliza} />
              <Dato rotulo="Estado" valor={expediente.poliza.estado} />
              <Dato
                rotulo="Remitida a Alianza"
                valor={new Date(expediente.poliza.solicitadaEn).toLocaleString("es-PY")}
              />
              <Dato
                rotulo="Emitida"
                valor={
                  expediente.poliza.emitidaEn
                    ? new Date(expediente.poliza.emitidaEn).toLocaleString("es-PY")
                    : null
                }
              />
              <Dato rotulo="Factura" valor={expediente.poliza.estadoFactura} />
              <Dato rotulo="Referencia de factura" valor={expediente.poliza.referenciaFactura} />
            </dl>
          ) : (
            <p className="text-sm text-cuerpo">
              Sin emisión ordenada todavía: la póliza recién se remite a Alianza con el expediente
              en <code className="font-mono">EMITIDO</code>.
            </p>
          )}
          <p className="text-xs text-etiqueta">
            El número de póliza conserva el correlativo de la propuesta: SEBAOT no acuña uno nuevo.
          </p>
        </Bloque>

        <Bloque titulo="Cadena de expedientes">
          <ol className="flex flex-col gap-1 text-sm">
            {(detalle.cadena ?? []).map((eslabon) => (
              <li key={eslabon.id} className="flex flex-wrap items-baseline gap-2">
                <code className="font-mono text-xs break-all">{eslabon.id}</code>
                <span className="text-xs font-semibold text-titulo">{eslabon.estado}</span>
                {eslabon.expedienteAnteriorId ? (
                  <span className="text-xs text-etiqueta">
                    ← {eslabon.expedienteAnteriorId.slice(0, 8)}…
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </Bloque>
      </div>

      {/* Visor de evidencia — mismo componente que el panel de demo (§4) */}
      <Bloque titulo="Visor de evidencia">
        <VisorEvidencia
          descripcionIntegraciones={descripcionIntegraciones}
          expedienteId={expediente.id}
          evidencias={detalle.evidencias ?? []}
          paqueteDocumental={expediente.paqueteDocumental}
          firma={expediente.firma}
        />
      </Bloque>

      {/* ------------------------------------------------------------------ */}
      {/* Devolución del premio (D-02): seguimiento y acciones                 */}
      {/* ------------------------------------------------------------------ */}
      <Bloque titulo="Devolución del premio">
        <p className="rounded-lg border border-azul-200 bg-azul-50 px-3 py-2 text-xs text-azul-900 dark:border-azul-700 dark:bg-azul-950 dark:text-azul-100">
          La consola <strong>asienta y sigue</strong> el trámite; la devolución la ejecutan Bancard
          y Alianza fuera del flujo digital. Siempre va al{" "}
          <strong>medio de origen</strong>: no hay dónde escribir otra cuenta.
        </p>

        {seguimiento ? (
          <div className="flex flex-col gap-2">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Dato
                rotulo="Estado del trámite"
                valor={seguimiento.estado === "ACREDITADA" ? "Acreditada" : "En trámite"}
              />
              <Dato rotulo="Lo pidió" valor={seguimiento.solicitante} />
              <Dato rotulo="Motivo" valor={seguimiento.motivo} />
              <Dato
                rotulo="Solicitada"
                valor={new Date(seguimiento.solicitadaEn).toLocaleString("es-PY")}
              />
              <Dato
                rotulo="Importe"
                valor={`${formatearGuaranies(seguimiento.montoGs)} · ${seguimiento.medio}`}
              />
              <Dato rotulo="Referencia Bancard" valor={seguimiento.referenciaBancard} />
              <Dato
                rotulo="Acreditada"
                valor={
                  seguimiento.acreditadaEn
                    ? new Date(seguimiento.acreditadaEn).toLocaleString("es-PY")
                    : null
                }
              />
              <Dato rotulo="Referencia del reintegro" valor={seguimiento.referenciaReintegro} />
              {/* Cuánto lleva abierto: es lo que hace visible un trámite
                  olvidado, que es el riesgo de un proceso que ocurre afuera. */}
              <Dato
                rotulo={seguimiento.acreditadaEn ? "Duración" : "Abierta hace"}
                valor={seguimiento.horasAbierta !== null ? `${seguimiento.horasAbierta} h` : null}
              />
            </div>

            {seguimiento.estado === "EN_TRAMITE" ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex flex-1 flex-col gap-1">
                  <label htmlFor="ac-reintegro" className="text-xs font-semibold text-etiqueta">
                    Referencia del reintegro *
                  </label>
                  <input
                    id="ac-reintegro"
                    type="text"
                    value={referenciaReintegro}
                    onChange={(e) => setReferenciaReintegro(e.target.value)}
                    className={CLASE_CAMPO}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void moverDevolucion("ACREDITAR")}
                  disabled={enProceso || referenciaReintegro.trim() === ""}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:opacity-40"
                >
                  {enProceso ? "Registrando…" : "Registrar devolución acreditada"}
                </button>
              </div>
            ) : null}
          </div>
        ) : !puedeSolicitarDevolucion ? (
          <p className="text-sm text-cuerpo">
            Solo se abre una devolución sobre un expediente con el cobro confirmado o ya emitido.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="ac-solicitante" className="text-xs font-semibold text-etiqueta">
                  Quién la pide *
                </label>
                <select
                  id="ac-solicitante"
                  value={solicitante}
                  onChange={(e) => setSolicitante(e.target.value as SolicitanteDevolucion)}
                  className={CLASE_CAMPO}
                >
                  {Object.entries(ROTULO_SOLICITANTE_DEVOLUCION).map(([id, rotulo]) => (
                    <option key={id} value={id}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ac-motivo-dev" className="text-xs font-semibold text-etiqueta">
                  Motivo *
                </label>
                <select
                  id="ac-motivo-dev"
                  value={motivoDevolucion}
                  onChange={(e) => setMotivoDevolucion(e.target.value as MotivoDevolucion)}
                  className={CLASE_CAMPO}
                >
                  {/* Categorías cerradas: un campo libre acá terminaría con
                      datos de salud escritos a mano por alguien bienintencionado. */}
                  {Object.entries(ROTULO_MOTIVO_DEVOLUCION)
                    .filter(([id]) => id !== "VENCIMIENTO_LEGADO")
                    .map(([id, rotulo]) => (
                      <option key={id} value={id}>
                        {rotulo}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void moverDevolucion("SOLICITAR")}
              disabled={enProceso}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-naranja-400 px-6 text-sm font-bold tracking-wide text-naranja-800 uppercase transition-colors hover:bg-naranja-50 disabled:opacity-40 sm:self-start dark:text-naranja-200 dark:hover:bg-naranja-950"
            >
              {enProceso ? "Abriendo…" : "Abrir trámite de devolución"}
            </button>
          </div>
        )}
      </Bloque>

      {/* Reinicio con justificativo */}
      <Bloque titulo="Reinicio con justificativo">
        <p className="rounded-lg border border-azul-200 bg-azul-50 px-3 py-2 text-xs text-azul-900 dark:border-azul-700 dark:bg-azul-950 dark:text-azul-100">
          El reinicio <strong>no reactiva</strong> este expediente: crea uno nuevo en{" "}
          <code className="font-mono">INICIADO</code> enlazado a este, y deja evidencia en ambos.
          Este expediente no cambia de estado — <code className="font-mono">DERIVADO_MANUAL</code>{" "}
          sigue siendo terminal también desde la consola.
        </p>

        {!puedeReiniciar ? (
          <p className="text-sm text-cuerpo">
            {bloqueo?.sucesorId
              ? `Ya fue reiniciado: el expediente ${bloqueo.sucesorId} lo supera.`
              : "Solo se reinician expedientes derivados a revisión manual o vencidos sin firma."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="ac-justificativo" className="text-xs font-semibold text-etiqueta">
                  Justificativo *
                </label>
                <select
                  id="ac-justificativo"
                  value={justificativo}
                  onChange={(e) => setJustificativo(e.target.value)}
                  className={CLASE_CAMPO}
                >
                  <option value="">Elegí una opción</option>
                  {justificativos.map((opcion) => (
                    <option key={opcion.id} value={opcion.id}>
                      {opcion.rotulo}
                    </option>
                  ))}
                </select>
              </div>

              {requiereDetalle ? (
                <div className="flex flex-col gap-1">
                  <label htmlFor="ac-detalle" className="text-xs font-semibold text-etiqueta">
                    Explicación *
                  </label>
                  <input
                    id="ac-detalle"
                    type="text"
                    value={detalleLibre}
                    onChange={(e) => setDetalleLibre(e.target.value)}
                    className={CLASE_CAMPO}
                  />
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={reiniciar}
              disabled={
                enProceso || justificativo === "" || (requiereDetalle && detalleLibre.trim() === "")
              }
              className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:opacity-40 sm:self-start"
            >
              {enProceso ? "Creando…" : "Crear expediente nuevo enlazado"}
            </button>
          </div>
        )}

        {mensaje ? (
          <p role="status" className="text-sm font-semibold text-verde-700 dark:text-verde-300">
            {mensaje}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
          </p>
        ) : null}
      </Bloque>
    </div>
  );
}
