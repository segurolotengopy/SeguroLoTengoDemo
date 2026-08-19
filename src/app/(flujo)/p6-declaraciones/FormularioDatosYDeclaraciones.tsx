"use client";

import { Fragment, useMemo, useState } from "react";
// Desde `catalogo-p6` y `textos-p6`, no desde el caso de uso: este es un
// componente de cliente e importar `declaraciones-p6.ts` arrastraría
// `node:crypto` al bundle.
import {
  ACTIVIDADES,
  CIUDADES,
  PARENTESCOS,
  PROFESIONES,
  SITUACIONES_LABORALES,
  interpretarDatosComplementariosP6,
  interpretarMontoGuaranies,
} from "@/domain/catalogo-p6";
import type { CampoP6 } from "@/domain/catalogo-p6";
import { DECLARACIONES_P6 } from "@/domain/elegibilidad";
import { formatearGuaranies } from "@/domain/catalogo";
import {
  AYUDA_PEP,
  LEYENDA_DOCUMENTOS_P6,
  NOTA_BENEFICIARIO_DESIGNADO_P6,
  REGLA_ELEGIBILIDAD_P6,
  ROTULO_AYUDA_PEP,
  SUBTITULOS_DECLARACIONES_P6,
  TEXTOS_DECLARACIONES_P6,
  guiaHabilitacionVisible,
  rotuloRespuestaHabilitante,
} from "@/domain/textos-p6";
import type { RespuestaDeclaracion } from "@/domain/tipos";

/**
 * Bloques interactivos de P6 (docs/ESPECIFICACION_PANTALLAS.md → "P6 · Paso 6
 * de 9 — Datos y declaraciones"): los siete datos complementarios, el
 * beneficiario por fallecimiento y las ocho declaraciones obligatorias.
 *
 * **No tiene lógica de negocio.** Ni el motor de elegibilidad ni la decisión
 * de derivar viven acá: el componente reutiliza `interpretarDatosComplementariosP6`
 * —la misma función que corre el servidor— solo para saber cuándo habilitar el
 * botón, y el resultado real lo decide siempre `POST /api/p6/declaraciones`.
 * Que el badge diga "Habilita: Sí" no significa que la pantalla evalúe nada:
 * el badge sale de `DECLARACIONES_P6`, que es la definición del motor.
 *
 * **Regla inviolable #7:** las respuestas de las declaraciones 1, 2, 3 y 8
 * viven en el `useState` de este componente y salen una sola vez, en el cuerpo
 * del POST. No se escriben a `localStorage`, ni a la URL, ni a `console`, ni a
 * ninguna instrumentación. La respuesta del servidor tampoco las devuelve.
 */

type Respuestas = Partial<Record<number, RespuestaDeclaracion>>;

interface RespuestaApi {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly camposInvalidos?: readonly CampoP6[];
  readonly declaracionesSinResponder?: readonly number[];
  readonly elegibleParaEmisionAutomatica?: boolean;
  readonly numeroCaso?: string;
  readonly siguientePantalla?: string;
}

const MENSAJES: Readonly<Record<string, string>> = {
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  ESTADO_INVALIDO: "Este proceso ya no está en el paso de datos y declaraciones.",
  DATOS_INCOMPLETOS: "Revisá los campos marcados: faltan datos obligatorios.",
  DECLARACIONES_INCOMPLETAS: "Faltan declaraciones por responder. Las ocho son obligatorias.",
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};

const ROTULOS_CAMPO: Readonly<Record<CampoP6, string>> = {
  domicilio: "Domicilio",
  ciudad: "Ciudad",
  situacionLaboral: "Situación laboral",
  actividad: "Actividad",
  profesion: "Profesión",
  ingresoMensualDeclaradoGs: "Ingreso mensual declarado",
  beneficiarioTipo: "Beneficiario por fallecimiento",
  beneficiarioNombreCompleto: "Nombre completo del beneficiario",
  beneficiarioParentesco: "Parentesco",
  beneficiarioDomicilio: "Domicilio del beneficiario",
};

const CLASE_CAMPO =
  "h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo placeholder:text-etiqueta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500";

function Selector({
  id,
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  opciones: readonly string[];
  onChange: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-etiqueta">
        {etiqueta} *
      </label>
      <select id={id} value={valor} onChange={(e) => onChange(e.target.value)} className={CLASE_CAMPO}>
        <option value="">Elegí una opción</option>
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FormularioDatosYDeclaraciones() {
  const [domicilio, setDomicilio] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [situacionLaboral, setSituacionLaboral] = useState("");
  const [actividad, setActividad] = useState("");
  const [profesion, setProfesion] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [ingreso, setIngreso] = useState("");

  // `Herederos legales — 100%` es la opción por defecto de la especificación.
  const [beneficiarioTipo, setBeneficiarioTipo] = useState<"HEREDEROS_LEGALES" | "PERSONA_DESIGNADA">(
    "HEREDEROS_LEGALES",
  );
  const [beneficiarioNombre, setBeneficiarioNombre] = useState("");
  const [beneficiarioParentesco, setBeneficiarioParentesco] = useState("");
  const [beneficiarioDomicilio, setBeneficiarioDomicilio] = useState("");

  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [mostrarAyudaPep, setMostrarAyudaPep] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camposInvalidos, setCamposInvalidos] = useState<readonly CampoP6[]>([]);

  const bloqueDatos = useMemo(
    () => ({
      domicilio,
      ciudad,
      situacionLaboral,
      actividad,
      profesion,
      empresa,
      ingresoMensualDeclaradoGs: ingreso,
      beneficiarioTipo,
      beneficiarioNombreCompleto: beneficiarioNombre,
      beneficiarioParentesco,
      beneficiarioDomicilio,
    }),
    [
      domicilio,
      ciudad,
      situacionLaboral,
      actividad,
      profesion,
      empresa,
      ingreso,
      beneficiarioTipo,
      beneficiarioNombre,
      beneficiarioParentesco,
      beneficiarioDomicilio,
    ],
  );

  const datosCompletos = useMemo(
    () => interpretarDatosComplementariosP6(bloqueDatos).ok,
    [bloqueDatos],
  );

  const declaracionesCompletas = DECLARACIONES_P6.every(({ numero }) => respuestas[numero]);
  const puedeContinuar = datosCompletos && declaracionesCompletas && !enviando;

  const ingresoNumerico = interpretarMontoGuaranies(ingreso);

  function marcado(campo: CampoP6): boolean {
    return camposInvalidos.includes(campo);
  }

  async function guardar() {
    setEnviando(true);
    setError(null);
    setCamposInvalidos([]);
    try {
      const peticion = await fetch("/api/p6/declaraciones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ datos: bloqueDatos, declaraciones: respuestas }),
      });
      const respuesta = (await peticion.json().catch(() => ({}))) as RespuestaApi;

      if (!respuesta.ok) {
        setCamposInvalidos(respuesta.camposInvalidos ?? []);
        setError(
          (respuesta.motivo && MENSAJES[respuesta.motivo]) ?? "No pudimos guardar tus datos.",
        );
        return;
      }

      // El destino lo decide el servidor a partir del motor de elegibilidad,
      // no esta pantalla: si una declaración de las 1, 2, 3 u 8 fue
      // incompatible, la respuesta trae `/revision-manual` (Pantalla A).
      window.location.assign(respuesta.siguientePantalla ?? "/p7-pago");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* En pantallas anchas: datos complementarios a la izquierda y las ocho
          declaraciones a la derecha; debajo, beneficiario y botón. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* ------------------------------------------------------------------ */}
      {/* Bloque 1 — Datos complementarios                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Datos complementarios
          </h2>
          <p className="text-xs text-cuerpo">Los marcados con * son obligatorios.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="p6-domicilio" className="text-xs font-semibold text-etiqueta">
              Domicilio *
            </label>
            <input
              id="p6-domicilio"
              type="text"
              value={domicilio}
              onChange={(e) => setDomicilio(e.target.value)}
              placeholder="Calle, número y barrio"
              aria-invalid={marcado("domicilio")}
              className={`${CLASE_CAMPO} ${marcado("domicilio") ? "border-rojo-500" : ""}`}
            />
          </div>

          <Selector
            id="p6-ciudad"
            etiqueta="Ciudad"
            valor={ciudad}
            opciones={CIUDADES}
            onChange={setCiudad}
          />
          <Selector
            id="p6-situacion-laboral"
            etiqueta="Situación laboral"
            valor={situacionLaboral}
            opciones={SITUACIONES_LABORALES}
            onChange={setSituacionLaboral}
          />
          <Selector
            id="p6-actividad"
            etiqueta="Actividad"
            valor={actividad}
            opciones={ACTIVIDADES}
            onChange={setActividad}
          />
          <Selector
            id="p6-profesion"
            etiqueta="Profesión"
            valor={profesion}
            opciones={PROFESIONES}
            onChange={setProfesion}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="p6-empresa" className="text-xs font-semibold text-etiqueta">
              Empresa / empleador
            </label>
            <input
              id="p6-empresa"
              type="text"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Opcional"
              className={CLASE_CAMPO}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="p6-ingreso" className="text-xs font-semibold text-etiqueta">
              Ingreso mensual declarado *
            </label>
            <input
              id="p6-ingreso"
              type="text"
              inputMode="numeric"
              value={ingreso}
              onChange={(e) => setIngreso(e.target.value)}
              placeholder="Ej.: 9.500.000"
              aria-invalid={marcado("ingresoMensualDeclaradoGs")}
              aria-describedby="p6-ingreso-ayuda"
              className={`${CLASE_CAMPO} tabular-nums ${
                marcado("ingresoMensualDeclaradoGs") ? "border-rojo-500" : ""
              }`}
            />
            <p id="p6-ingreso-ayuda" className="text-xs text-etiqueta">
              {ingresoNumerico && ingresoNumerico > 0
                ? formatearGuaranies(ingresoNumerico)
                : "En guaraníes."}
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Bloque 2 — Declaraciones obligatorias (un solo recuadro)            */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-4">
        <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          Declaraciones obligatorias
        </h2>

        <ul className="flex flex-col divide-y divide-borde-tenue">
          {TEXTOS_DECLARACIONES_P6.map((declaracion) => {
            const definicion = DECLARACIONES_P6.find((d) => d.numero === declaracion.numero);
            if (!definicion) return null;
            const respuesta = respuestas[declaracion.numero];

            const subtitulo = SUBTITULOS_DECLARACIONES_P6[declaracion.numero];

            return (
              <Fragment key={declaracion.numero}>
                {/* CHG-20 · el subtítulo abre el grupo. Va como `li` sin
                    semántica de ítem para no anunciar un elemento de lista
                    vacío, conservando el encabezado que sí orienta. */}
                {subtitulo ? (
                  <li role="presentation" className="pt-2 first:pt-0">
                    <h3 className="text-xs font-bold tracking-wide text-azul-700 uppercase dark:text-azul-300">
                      {subtitulo}
                    </h3>
                  </li>
                ) : null}
              <li>
                <fieldset className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <legend className="float-left text-xs font-bold tracking-wide text-titulo uppercase">
                      {declaracion.numero}. {declaracion.titulo}
                      {guiaHabilitacionVisible() ? (
                        <span className="ml-2 rounded-full border border-verde-300 bg-verde-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-verde-800 uppercase dark:border-verde-700 dark:bg-verde-950 dark:text-verde-200">
                          {rotuloRespuestaHabilitante(definicion.respuestaHabilitante)}
                        </span>
                      ) : null}
                    </legend>

                    <div className="flex gap-1.5">
                      {(["SI", "NO"] as const).map((opcion) => (
                        <label
                          key={opcion}
                          className={`flex h-7 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-4 text-xs font-bold uppercase ${
                            respuesta === opcion
                              ? "border-naranja-500 bg-naranja-50 text-azul-950 dark:bg-naranja-950 dark:text-naranja-100"
                              : "border-borde-sutil bg-superficie text-cuerpo"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`p6-declaracion-${declaracion.numero}`}
                            value={opcion}
                            // Sin esto, un lector de pantalla anuncia ocho pares
                            // de "Sí / No" idénticos y sin contexto.
                            aria-label={`${declaracion.numero}. ${declaracion.titulo}: ${
                              opcion === "SI" ? "Sí" : "No"
                            }`}
                            checked={respuesta === opcion}
                            onChange={() =>
                              setRespuestas((actuales) => ({
                                ...actuales,
                                [declaracion.numero]: opcion,
                              }))
                            }
                            className="sr-only"
                          />
                          {opcion === "SI" ? "Sí" : "No"}
                        </label>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-cuerpo">{declaracion.texto}</p>

                  {declaracion.numero === 8 ? (
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => setMostrarAyudaPep((visible) => !visible)}
                        aria-expanded={mostrarAyudaPep}
                        className="self-start text-xs font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
                      >
                        {ROTULO_AYUDA_PEP}
                      </button>
                      {mostrarAyudaPep ? (
                        <p className="rounded-lg border border-azul-200 bg-azul-50 px-3 py-2 text-xs text-azul-900 dark:border-azul-700 dark:bg-azul-950 dark:text-azul-100">
                          {AYUDA_PEP}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </fieldset>
              </li>
              </Fragment>
            );
          })}
        </ul>
      </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Beneficiario (izquierda) y acción (derecha)                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          Beneficiario por fallecimiento
        </h2>

        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Elegí el beneficiario</legend>
          {(
            [
              ["HEREDEROS_LEGALES", "Herederos legales — 100%"],
              ["PERSONA_DESIGNADA", "Designar una persona — 100%"],
            ] as const
          ).map(([valor, rotulo]) => (
            <label
              key={valor}
              className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm ${
                beneficiarioTipo === valor
                  ? "border-verde-400 bg-verde-50 font-semibold text-titulo dark:border-verde-600 dark:bg-verde-950"
                  : "border-borde-sutil bg-superficie-suave text-cuerpo"
              }`}
            >
              <input
                type="radio"
                name="p6-beneficiario"
                value={valor}
                checked={beneficiarioTipo === valor}
                onChange={() => setBeneficiarioTipo(valor)}
                className="h-4 w-4 shrink-0 accent-naranja-500"
              />
              {rotulo}
            </label>
          ))}
        </fieldset>

        {beneficiarioTipo === "PERSONA_DESIGNADA" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="p6-benef-nombre" className="text-xs font-semibold text-etiqueta">
                Nombre completo *
              </label>
              <input
                id="p6-benef-nombre"
                type="text"
                value={beneficiarioNombre}
                onChange={(e) => setBeneficiarioNombre(e.target.value)}
                aria-invalid={marcado("beneficiarioNombreCompleto")}
                className={`${CLASE_CAMPO} ${
                  marcado("beneficiarioNombreCompleto") ? "border-rojo-500" : ""
                }`}
              />
            </div>

            <Selector
              id="p6-benef-parentesco"
              etiqueta="Parentesco"
              valor={beneficiarioParentesco}
              opciones={PARENTESCOS}
              onChange={setBeneficiarioParentesco}
            />

            <div className="flex flex-col gap-1">
              <label htmlFor="p6-benef-domicilio" className="text-xs font-semibold text-etiqueta">
                Domicilio del beneficiario *
              </label>
              <input
                id="p6-benef-domicilio"
                type="text"
                value={beneficiarioDomicilio}
                onChange={(e) => setBeneficiarioDomicilio(e.target.value)}
                aria-invalid={marcado("beneficiarioDomicilio")}
                className={`${CLASE_CAMPO} ${
                  marcado("beneficiarioDomicilio") ? "border-rojo-500" : ""
                }`}
              />
            </div>
          </div>
        ) : null}

        <p className="text-xs text-etiqueta">{NOTA_BENEFICIARIO_DESIGNADO_P6}</p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Guardar y continuar (derecha), con los textos debajo del botón       */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={guardar}
            disabled={!puedeContinuar}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:bg-superficie-suave disabled:text-etiqueta disabled:opacity-60 sm:w-auto sm:self-start"
          >
            {enviando ? "Guardando…" : "Guardar y continuar →"}
          </button>
          {!puedeContinuar ? (
            <p className="text-xs text-etiqueta">
              Se habilita al completar los datos obligatorios y responder las ocho declaraciones.
            </p>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
            {camposInvalidos.length > 0
              ? ` (${camposInvalidos.map((campo) => ROTULOS_CAMPO[campo]).join(", ")})`
              : ""}
          </p>
        ) : null}

        <div className="flex flex-col gap-1 rounded-lg border border-rojo-200 bg-rojo-50 px-3 py-2.5 dark:border-rojo-800 dark:bg-rojo-950">
          <p className="text-[11px] font-bold tracking-wide text-rojo-800 uppercase dark:text-rojo-200">
            Regla automática de elegibilidad
          </p>
          <p className="text-xs text-rojo-900 dark:text-rojo-100">{REGLA_ELEGIBILIDAD_P6}</p>
        </div>

        <p className="text-xs text-etiqueta">{LEYENDA_DOCUMENTOS_P6}</p>
      </div>
      </div>
    </div>
  );
}
