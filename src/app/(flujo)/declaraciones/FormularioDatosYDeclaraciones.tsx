"use client";

import { useMemo, useState } from "react";
// Desde `catalogo-p6` y `textos-p6`, no desde el caso de uso: este es un
// componente de cliente e importar `declaraciones-p6.ts` arrastraría
// `node:crypto` al bundle.
import { PARENTESCOS, interpretarBeneficiarioP6 } from "@/domain/catalogo-p6";
import type { CampoBeneficiarioP6 } from "@/domain/catalogo-p6";
import { DECLARACIONES_P6 } from "@/domain/elegibilidad";
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
  readonly camposInvalidos?: readonly CampoBeneficiarioP6[];
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

/**
 * Rótulos de los campos que **esta** pantalla puede marcar. Los del bloque
 * económico se fueron al paso 4 con sus campos, así que el tipo se acota a los
 * del beneficiario en vez de mantener entradas muertas.
 */
const ROTULOS_CAMPO: Readonly<Record<CampoBeneficiarioP6, string>> = {
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

/**
 * La condición PEP. Es la octava declaración y decide la elegibilidad igual
 * que las tres de salud, pero se muestra aparte (maqueta p.5).
 */
const NUMERO_DECLARACION_PEP = 8;

/**
 * Los dos grupos de la columna izquierda. Salen de
 * `SUBTITULOS_DECLARACIONES_P6`, que es donde vive el rótulo de cada grupo, y
 * excluyen a la PEP.
 */
const GRUPOS_DECLARACIONES: readonly {
  readonly subtitulo: string;
  readonly numeros: readonly number[];
}[] = [
  { subtitulo: SUBTITULOS_DECLARACIONES_P6[1], numeros: [1, 2, 3] },
  { subtitulo: SUBTITULOS_DECLARACIONES_P6[4], numeros: [4, 5, 6, 7] },
];

/**
 * Una declaración con su par Sí/No. Se extrajo del bucle cuando la PEP pasó a
 * su propio recuadro: el mismo dibujo se usa en los dos lugares y duplicarlo
 * habría dejado dos versiones que se desincronizan.
 */
function FilaDeclaracion({
  numero,
  respuesta,
  mostrarGuia,
  onResponder,
}: {
  numero: number;
  respuesta: "SI" | "NO" | undefined;
  mostrarGuia: boolean;
  onResponder: (opcion: "SI" | "NO") => void;
}) {
  const texto = TEXTOS_DECLARACIONES_P6.find((d) => d.numero === numero);
  const definicion = DECLARACIONES_P6.find((d) => d.numero === numero);
  if (!texto || !definicion) return null;

  return (
    <fieldset className="flex flex-col gap-0.5 py-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="float-left text-xs font-bold tracking-wide text-titulo uppercase">
          {texto.numero}. {texto.titulo}
          {mostrarGuia ? (
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
                name={`p6-declaracion-${texto.numero}`}
                value={opcion}
                // Sin esto, un lector de pantalla anuncia ocho pares de
                // "Sí / No" idénticos y sin contexto.
                aria-label={`${texto.numero}. ${texto.titulo}: ${opcion === "SI" ? "Sí" : "No"}`}
                checked={respuesta === opcion}
                onChange={() => onResponder(opcion)}
                className="sr-only"
              />
              {opcion === "SI" ? "Sí" : "No"}
            </label>
          ))}
        </div>
      </div>

      <p className="text-xs leading-snug text-cuerpo">{texto.texto}</p>
    </fieldset>
  );
}

export function FormularioDatosYDeclaraciones() {
  // `Herederos legales — 100%` es la opción por defecto de la especificación.
  const [beneficiarioTipo, setBeneficiarioTipo] = useState<"HEREDEROS_LEGALES" | "PERSONA_DESIGNADA">(
    "HEREDEROS_LEGALES",
  );
  const [beneficiarioNombre, setBeneficiarioNombre] = useState("");
  const [beneficiarioParentesco, setBeneficiarioParentesco] = useState("");
  const [beneficiarioDomicilio, setBeneficiarioDomicilio] = useState("");
  const [beneficiarioCedula, setBeneficiarioCedula] = useState("");

  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [mostrarAyudaPep, setMostrarAyudaPep] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camposInvalidos, setCamposInvalidos] = useState<readonly CampoBeneficiarioP6[]>([]);

  const bloqueBeneficiario = useMemo(
    () => ({
      beneficiarioTipo,
      beneficiarioNombreCompleto: beneficiarioNombre,
      beneficiarioParentesco,
      beneficiarioDomicilio,
      beneficiarioCedula,
    }),
    [
      beneficiarioTipo,
      beneficiarioNombre,
      beneficiarioParentesco,
      beneficiarioDomicilio,
      beneficiarioCedula,
    ],
  );

  const datosCompletos = useMemo(
    () => interpretarBeneficiarioP6(bloqueBeneficiario).ok,
    [bloqueBeneficiario],
  );

  const declaracionesCompletas = DECLARACIONES_P6.every(({ numero }) => respuestas[numero]);
  const puedeContinuar = datosCompletos && declaracionesCompletas && !enviando;

  function marcado(campo: CampoBeneficiarioP6): boolean {
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
        body: JSON.stringify({ beneficiario: bloqueBeneficiario, declaraciones: respuestas }),
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
      window.location.assign(respuesta.siguientePantalla ?? "/pago");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* ------------------------------------------------------------------ */}
      {/* Columna izquierda — las siete declaraciones, en dos grupos          */}
      {/* ------------------------------------------------------------------ */}
      {/* Maqueta p.5: van pegadas, sin filete ni aire entre una y otra. La
          etiqueta en versalita alcanza para distinguirlas, y con siete
          separadores la pantalla no entra sin bajar. La octava —la condición
          PEP— vive en su propio recuadro a la derecha. */}
      <div className="flex flex-col gap-3">
        {GRUPOS_DECLARACIONES.map(({ subtitulo, numeros }) => (
          <section
            key={subtitulo}
            className="flex flex-col gap-1 rounded-lg border border-borde-sutil bg-superficie p-4"
          >
            <h2 className="text-xs font-bold tracking-wide text-azul-700 uppercase dark:text-azul-300">
              {subtitulo}
            </h2>
            <ul className="flex flex-col">
              {numeros.map((numero) => (
                <li key={numero}>
                  <FilaDeclaracion
                    numero={numero}
                    respuesta={respuestas[numero]}
                    mostrarGuia={guiaHabilitacionVisible()}
                    onResponder={(opcion) =>
                      setRespuestas((actuales) => ({ ...actuales, [numero]: opcion }))
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Columna derecha — beneficiario, PEP, regla y acción                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
        <section className="flex flex-col gap-3 rounded-lg border-2 border-naranja-500 bg-superficie p-4">
          <h2 className="text-sm font-bold tracking-wide text-naranja-700 uppercase dark:text-naranja-300">
            A. Beneficiario por fallecimiento
          </h2>

          <fieldset className="flex flex-col gap-2 sm:flex-row">
            <legend className="sr-only">Elegí el beneficiario</legend>
            {(
              [
                ["HEREDEROS_LEGALES", "Herederos legales — 100%"],
                ["PERSONA_DESIGNADA", "Designar una persona — 100%"],
              ] as const
            ).map(([valor, rotulo]) => (
              <label
                key={valor}
                className={`flex flex-1 items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm ${
                  beneficiarioTipo === valor
                    ? "border-naranja-500 bg-naranja-50 font-semibold text-titulo dark:bg-naranja-950"
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
            <div className="grid gap-3 sm:grid-cols-2">
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

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label htmlFor="p6-benef-domicilio" className="text-xs font-semibold text-etiqueta">
                  Domicilio completo *
                </label>
                <input
                  id="p6-benef-domicilio"
                  type="text"
                  value={beneficiarioDomicilio}
                  onChange={(e) => setBeneficiarioDomicilio(e.target.value)}
                  placeholder="Calle, número, ciudad y departamento"
                  aria-invalid={marcado("beneficiarioDomicilio")}
                  className={`${CLASE_CAMPO} ${
                    marcado("beneficiarioDomicilio") ? "border-rojo-500" : ""
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

              {/* CHG-24 · sin asterisco y sin validación de formato: la norma
                  pide nombre y domicilio del beneficiario designado, no su
                  cédula. Se ofrece porque facilita el cobro el día del
                  siniestro, y dejarla vacía no frena nada (CMP-21). */}
              <div className="flex flex-col gap-1">
                <label htmlFor="p6-benef-cedula" className="text-xs font-semibold text-etiqueta">
                  N.° de cédula del beneficiario
                </label>
                <input
                  id="p6-benef-cedula"
                  type="text"
                  inputMode="numeric"
                  value={beneficiarioCedula}
                  onChange={(e) => setBeneficiarioCedula(e.target.value)}
                  placeholder="Opcional"
                  aria-describedby="p6-benef-cedula-ayuda"
                  className={CLASE_CAMPO}
                />
                <p id="p6-benef-cedula-ayuda" className="text-xs text-etiqueta">
                  Opcional. Si no la tenés a mano, podés continuar sin completarla.
                </p>
              </div>
            </div>
          ) : null}

          <p className="text-xs text-etiqueta">{NOTA_BENEFICIARIO_DESIGNADO_P6}</p>
        </section>

        {/* La condición PEP en su propio recuadro (maqueta p.5): decide la
            elegibilidad igual que las tres de salud, y mezclada entre las de
            conformidad se leía como una más. */}
        <section className="flex flex-col gap-2 rounded-lg border border-rojo-200 bg-rojo-50 p-4 dark:border-rojo-800 dark:bg-rojo-950">
          <FilaDeclaracion
            numero={NUMERO_DECLARACION_PEP}
            respuesta={respuestas[NUMERO_DECLARACION_PEP]}
            mostrarGuia={guiaHabilitacionVisible()}
            onResponder={(opcion) =>
              setRespuestas((actuales) => ({ ...actuales, [NUMERO_DECLARACION_PEP]: opcion }))
            }
          />
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
        </section>

        <div className="flex items-start gap-3 rounded-lg border border-rojo-200 bg-rojo-50 px-3 py-2.5 dark:border-rojo-800 dark:bg-rojo-950">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mt-0.5 h-5 w-5 shrink-0 text-rojo-700 dark:text-rojo-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l7 2.5v5.2c0 4.6-3 8.2-7 10.3-4-2.1-7-5.7-7-10.3V5.5L12 3z" />
            <path d="M12 9v4M12 15.8v.2" />
          </svg>
          <p className="text-xs text-rojo-900 dark:text-rojo-100">{REGLA_ELEGIBILIDAD_P6}</p>
        </div>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
            {camposInvalidos.length > 0
              ? ` (${camposInvalidos.map((campo) => ROTULOS_CAMPO[campo]).join(", ")})`
              : ""}
          </p>
        ) : null}

        {/* Maqueta p.5: el botón toma el ancho del aviso que tiene encima y va
            debajo de él, no como franja de ancho completo. */}
        <button
          type="button"
          onClick={guardar}
          disabled={!puedeContinuar}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:bg-superficie-suave disabled:text-etiqueta disabled:opacity-60"
        >
          {enviando ? "Guardando…" : "Declarar y continuar"}
        </button>
        {!puedeContinuar ? (
          <p className="text-xs text-etiqueta">
            Se habilita al completar el beneficiario y responder las ocho declaraciones.
          </p>
        ) : null}

        <p className="text-xs text-etiqueta">{LEYENDA_DOCUMENTOS_P6}</p>
      </div>
    </div>
  );
}
