"use client";

/**
 * Beneficiario + las 5 preguntas + aceptación agrupada 2 del paso 2 (lote F3).
 *
 * Las cinco preguntas reemplazan en pantalla a las ocho declaraciones de P6;
 * el servidor las expande con el mapa 5→8 (`declaraciones-v3.ts`) y el PDF
 * sigue imprimiendo las ocho. La pregunta de carencias en No **bloquea sin
 * derivar**; una incompatible en las otras cuatro cambia el CTA a «enviar mi
 * caso a un asesor» — el POST es el mismo y la derivación la decide el motor.
 * La pantalla v2 (`FormularioDatosYDeclaraciones`) queda intacta.
 */
import { useState } from "react";
import { PARENTESCOS, interpretarBeneficiarioP6 } from "@/domain/catalogo-p6";
import type { ClaveRespuestaV3 } from "@/domain/declaraciones-v3";
import {
  ITEMS_ACEPTACION_SEGURO,
  PREGUNTAS_SEGURO_V3,
  ROTULO_ACEPTACION_SEGURO,
} from "@/domain/textos-seguro";

type Respuesta = "SI" | "NO" | null;

interface RespuestaApi {
  ok?: boolean;
  motivo?: string;
  siguientePantalla?: string;
  camposInvalidos?: string[];
  respuestasSinResponderV3?: string[];
}

const MENSAJES: Readonly<Record<string, string>> = {
  DATOS_INCOMPLETOS: "Revisá los datos del beneficiario: falta completar o corregir algún campo.",
  DECLARACIONES_INCOMPLETAS: "Respondé las cinco preguntas para poder continuar.",
  ACEPTACION_REQUERIDA: "Marcá la aceptación de las condiciones de tu plan para continuar.",
  CARENCIAS_NO_ACEPTADAS:
    "Sin la aceptación de las carencias no podemos avanzar. Si algo no te queda claro, un asesor te lo explica.",
  ESTADO_INVALIDO: "Tu trámite ya no está en este paso. Recargá la página para retomarlo donde quedó.",
  EXPEDIENTE_NO_ENCONTRADO: "No encontramos tu trámite. Volvé al inicio para empezar de nuevo.",
};

const CLASE_CAMPO =
  "h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500";

export function FormularioSeguroP2({ nombrePila }: { nombrePila: string | null }) {
  const [tipoBeneficiario, setTipoBeneficiario] = useState<"HEREDEROS_LEGALES" | "PERSONA_DESIGNADA">(
    "HEREDEROS_LEGALES",
  );
  const [benefNombre, setBenefNombre] = useState("");
  const [benefParentesco, setBenefParentesco] = useState("");
  const [benefDomicilio, setBenefDomicilio] = useState("");
  const [benefCedula, setBenefCedula] = useState("");

  const [respuestas, setRespuestas] = useState<Record<ClaveRespuestaV3, Respuesta>>({
    salud: null,
    antecedentes: null,
    enfermedades: null,
    pep: null,
    carencias: null,
  });
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);
  const [aceptada, setAceptada] = useState(false);
  const [verItems, setVerItems] = useState(false);
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false);

  const bloqueBeneficiario: Record<string, unknown> = {
    beneficiarioTipo: tipoBeneficiario,
    beneficiarioNombreCompleto: benefNombre,
    beneficiarioParentesco: benefParentesco,
    beneficiarioDomicilio: benefDomicilio,
    beneficiarioCedula: benefCedula,
  };
  const beneficiarioOk = interpretarBeneficiarioP6(bloqueBeneficiario).ok;
  const respondidas = PREGUNTAS_SEGURO_V3.every((p) => respuestas[p.clave] !== null);
  const carenciasRechazadas = respuestas.carencias === "NO";
  const hayIncompatibles = PREGUNTAS_SEGURO_V3.some(
    (p) => p.clave !== "carencias" && respuestas[p.clave] !== null && respuestas[p.clave] !== p.habilita,
  );

  const faltantes: string[] = [];
  if (!beneficiarioOk) faltantes.push("completar los datos de tu beneficiario");
  if (!respondidas) faltantes.push("responder las cinco preguntas");
  if (carenciasRechazadas) faltantes.push("aceptar las carencias y el inicio de vigencia");
  if (!aceptada) faltantes.push("marcar la aceptación final");
  const puedeEnviar = faltantes.length === 0;

  async function enviar() {
    if (!puedeEnviar) {
      setMostrarFaltantes(true);
      return;
    }
    setEnProceso(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/p6/declaraciones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          beneficiario: bloqueBeneficiario,
          respuestasV3: respuestas,
          aceptacionPlan: aceptada,
        }),
      });
      const datos = (await respuesta.json().catch(() => ({}))) as RespuestaApi;
      if (!datos.ok) {
        setError(
          (datos.motivo && MENSAJES[datos.motivo]) ??
            "No pudimos guardar tus respuestas. Esperá un momento e intentá de nuevo.",
        );
        setEnProceso(false);
        return;
      }
      window.location.assign(datos.siguientePantalla ?? "/pago-y-firma");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
      setEnProceso(false);
    }
  }

  const con = (frase: string) =>
    nombrePila ? `${nombrePila}, ${frase}` : frase.charAt(0).toUpperCase() + frase.slice(1);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Beneficiario ─────────────────────────────────────────────── */}
      <section aria-label="Beneficiario" className="flex flex-col gap-3">
        <h3 className="text-base font-bold text-titulo">{con("¿a quién protegés?")}</h3>
        <p className="text-sm text-cuerpo">
          ¿Quién recibiría la cobertura por fallecimiento? Elegí una de las dos opciones.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 items-start gap-2 rounded-lg border border-borde-sutil p-3 text-sm text-cuerpo">
            <input
              type="radio"
              name="seguro-beneficiario"
              checked={tipoBeneficiario === "HEREDEROS_LEGALES"}
              onChange={() => setTipoBeneficiario("HEREDEROS_LEGALES")}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">Opción por defecto: mis herederos legales.</span>{" "}
              La cobertura la reciben según el Código Civil paraguayo — cónyuge, hijos, padres —
              en el orden y la proporción que la ley establece. No hay datos que completar.
            </span>
          </label>
          <label className="flex flex-1 items-start gap-2 rounded-lg border border-borde-sutil p-3 text-sm text-cuerpo">
            <input
              type="radio"
              name="seguro-beneficiario"
              checked={tipoBeneficiario === "PERSONA_DESIGNADA"}
              onChange={() => setTipoBeneficiario("PERSONA_DESIGNADA")}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">Quiero designar a una persona</span>, que cobra el
              100% de la cobertura por fallecimiento antes que mis herederos legales.
            </span>
          </label>
        </div>
        {tipoBeneficiario === "PERSONA_DESIGNADA" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold text-titulo">
              Nombre completo del beneficiario
              <input
                className={CLASE_CAMPO}
                value={benefNombre}
                onChange={(e) => setBenefNombre(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-titulo">
              Parentesco
              <select
                className={CLASE_CAMPO}
                value={benefParentesco}
                onChange={(e) => setBenefParentesco(e.target.value)}
              >
                <option value="">Elegí una opción</option>
                {PARENTESCOS.map((parentesco) => (
                  <option key={parentesco} value={parentesco}>
                    {parentesco}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-titulo sm:col-span-2">
              Domicilio del beneficiario
              <input
                className={CLASE_CAMPO}
                value={benefDomicilio}
                onChange={(e) => setBenefDomicilio(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-titulo">
              Número de cédula (opcional)
              <input
                className={CLASE_CAMPO}
                value={benefCedula}
                onChange={(e) => setBenefCedula(e.target.value)}
              />
            </label>
          </div>
        ) : null}
        <p className="text-xs text-etiqueta">
          Un único beneficiario, que recibe la totalidad de la cobertura por fallecimiento. Podés
          cambiarlo cuando quieras avisando a Interseguros.
        </p>
      </section>

      {/* ── Las 5 preguntas ──────────────────────────────────────────── */}
      <section aria-label="Declaraciones" className="flex flex-col gap-3">
        <h3 className="text-base font-bold text-titulo">{con("unas preguntas antes de seguir")}</h3>
        <p className="text-sm text-cuerpo">
          Estas respuestas integran tu propuesta y su FIPF. Respondé con total tranquilidad — se
          firman recién en el paso 3.
        </p>
        {PREGUNTAS_SEGURO_V3.map((pregunta) => {
          const valor = respuestas[pregunta.clave];
          const incompatible = valor !== null && valor !== pregunta.habilita;
          const falta = mostrarFaltantes && valor === null;
          return (
            <div
              key={pregunta.clave}
              className={`flex flex-col gap-2 rounded-xl border p-3 ${
                falta ? "border-rojo-400" : "border-borde-sutil"
              } bg-superficie`}
            >
              <p className="text-sm text-cuerpo">
                <span className="font-semibold">{pregunta.titulo}. </span>
                {pregunta.texto}
                {falta ? <span className="font-bold text-rojo-700 dark:text-rojo-300"> *</span> : null}
              </p>
              {pregunta.rotuloNota ? (
                <button
                  type="button"
                  onClick={() =>
                    setNotaAbierta((actual) => (actual === pregunta.clave ? null : pregunta.clave))
                  }
                  className="self-start text-xs font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 dark:text-azul-200"
                >
                  {notaAbierta === pregunta.clave ? "Ocultar" : pregunta.rotuloNota}
                </button>
              ) : null}
              {notaAbierta === pregunta.clave && pregunta.nota ? (
                <p className="rounded-lg bg-fondo p-3 text-xs text-cuerpo">{pregunta.nota}</p>
              ) : null}
              <div className="flex gap-2" role="radiogroup" aria-label={pregunta.titulo}>
                {(["SI", "NO"] as const).map((opcion) => (
                  <button
                    key={opcion}
                    type="button"
                    role="radio"
                    aria-checked={valor === opcion}
                    onClick={() =>
                      setRespuestas((actual) => ({ ...actual, [pregunta.clave]: opcion }))
                    }
                    className={`h-10 rounded-lg px-5 text-sm font-bold ${
                      valor === opcion
                        ? "bg-naranja-600 text-white"
                        : "border border-borde-sutil bg-superficie text-cuerpo"
                    }`}
                  >
                    {opcion === "SI" ? "Sí" : "No"}
                  </button>
                ))}
              </div>
              {incompatible ? (
                <p className="text-xs font-semibold text-naranja-800 dark:text-naranja-200">
                  {pregunta.aviso}
                </p>
              ) : null}
            </div>
          );
        })}
      </section>

      {/* ── Aceptación agrupada 2 ────────────────────────────────────── */}
      <section aria-label="Aceptación" className="flex flex-col gap-3">
        <label className="flex items-start gap-2 text-sm text-cuerpo">
          <input
            type="checkbox"
            checked={aceptada}
            onChange={(evento) => setAceptada(evento.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>{ROTULO_ACEPTACION_SEGURO}</span>
        </label>
        <button
          type="button"
          onClick={() => setVerItems((v) => !v)}
          className="self-start text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 dark:text-azul-200"
        >
          {verItems ? "Ocultar el detalle" : "Ver todo lo que aceptás"}
        </button>
        {verItems ? (
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-cuerpo">
            {ITEMS_ACEPTACION_SEGURO.map((item) => (
              <li key={item.slice(0, 40)}>{item}</li>
            ))}
          </ol>
        ) : null}
      </section>

      {/* ── CTA dual ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={enProceso || carenciasRechazadas}
          onClick={() => void enviar()}
          className={`h-11 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-40 ${
            hayIncompatibles ? "bg-azul-700" : "bg-naranja-600"
          }`}
        >
          {hayIncompatibles
            ? "Tocá acá para enviar mi caso a un asesor →"
            : "Tocá acá para continuar al paso 3 →"}
        </button>
        {mostrarFaltantes && faltantes.length > 0 ? (
          <p className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            Te falta: {faltantes.join(", ")}. Lo que falta está marcado en rojo con un asterisco.
          </p>
        ) : null}
        {!puedeEnviar && !mostrarFaltantes ? (
          <button
            type="button"
            onClick={() => setMostrarFaltantes(true)}
            className="self-start text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 dark:text-azul-200"
          >
            Mostrame qué me falta
          </button>
        ) : null}
        {error ? <p className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">{error}</p> : null}
      </div>
    </div>
  );
}
