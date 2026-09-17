"use client";

/**
 * 04A · Datos y declaraciones. Etapa 4 de 5.
 *
 * **Tres** preguntas de salud, no ocho (D-33): la condición PEP se declaró en
 * 03E y los consentimientos van en 04D. El beneficiario vive **dentro de esta
 * pantalla**; `screens.json` es explícito en que no existe una 04B.
 *
 * La CTA **arranca deshabilitada**. El arte la dibuja roja con todo vacío y el
 * manual prohíbe avanzar sin las respuestas: manda el manual (D-28).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PARENTESCOS } from "@/domain/catalogo-p6";
import type { RespuestaDeclaracion } from "@/domain/tipos";
import { TEXTOS_04A } from "@/domain/v4/textos-consentimientos";
import { MarcoV4 } from "../MarcoV4";
import { BarraPlanV4 } from "../BarraPlanV4";
import { HojaV4 } from "../superficies";
import { AccionesV4, CamposV4, CampoAnchoV4, DisposicionV4, RejillaV4 } from "../disposicion";
import {
  AvisoAzulV4,
  BotonPrincipalV4,
  CampoTextoV4,
  FranjaErrorV4,
  ListaDeOpcionesV4,
  ParSiNoV4,
  SelectorV4,
} from "../piezas";
import { IlustracionDeclaraciones } from "../ilustraciones";

type ClaveMedica = (typeof TEXTOS_04A.preguntas)[number]["clave"];
type TipoBeneficiario = "HEREDEROS_LEGALES" | "PERSONA_DESIGNADA";

export function Pantalla04A() {
  const router = useRouter();

  const [respuestas, setRespuestas] = useState<Partial<Record<ClaveMedica, RespuestaDeclaracion>>>({});
  const [tipo, setTipo] = useState<TipoBeneficiario>("HEREDEROS_LEGALES");
  const [nombre, setNombre] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [cedula, setCedula] = useState("");
  const [parentescoAbierto, setParentescoAbierto] = useState(false);
  const [errorFranja, setErrorFranja] = useState<{ titulo: string; indicacion: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const designada = tipo === "PERSONA_DESIGNADA";
  const completo =
    TEXTOS_04A.preguntas.every((pregunta) => respuestas[pregunta.clave] !== undefined) &&
    (!designada || (nombre.trim() !== "" && domicilio.trim() !== "" && parentesco !== ""));

  async function continuar() {
    setErrorFranja(null);
    setEnviando(true);
    try {
      const respuesta = await fetch("/api/v4/declaraciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respuestas,
          beneficiario: {
            beneficiarioTipo: tipo,
            ...(designada
              ? {
                  beneficiarioNombreCompleto: nombre,
                  beneficiarioDomicilio: domicilio,
                  beneficiarioParentesco: parentesco,
                  beneficiarioCedula: cedula,
                }
              : {}),
          },
        }),
      });
      const datos = (await respuesta.json()) as {
        ok: boolean;
        derivado?: boolean;
        camposInvalidos?: readonly string[];
      };
      if (datos.ok) {
        router.push(datos.derivado ? "/revision-manual" : "/consentimientos");
        return;
      }
      const invalido = datos.camposInvalidos?.[0];
      setErrorFranja({
        titulo: invalido ? `FALTA COMPLETAR ${invalido.toUpperCase()}.` : "FALTAN DATOS.",
        indicacion: "Revisá el formulario para poder continuar.",
      });
    } catch {
      setErrorFranja({
        titulo: "NO PUDIMOS GUARDAR TUS DECLARACIONES.",
        indicacion: "Revisá tu conexión e intentá nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoV4 codigo="04A">
      <DisposicionV4
        contexto={
          <>
            <div className="flex items-start gap-2 lg:flex-col lg:gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="v4-titular">
                  {TEXTOS_04A.titulo}
                  <em>{TEXTOS_04A.tituloAcento}</em>
                </h1>
                <p className="v4-bajada mt-2">{TEXTOS_04A.bajada}</p>
              </div>
              <IlustracionDeclaraciones tamano={108} className="shrink-0" />
            </div>

            <BarraPlanV4 className="mt-4" />
          </>
        }
      >
        <h2 className="v4-rotulo mt-5 lg:mt-0">{TEXTOS_04A.seccionSalud}</h2>

        {/* Tres declaraciones de salud, cada una con su par SÍ/NO: una lista
            de tarjetas iguales, así que en escritorio van lado a lado en tres
            columnas (RejillaV4) y el par se corre debajo del enunciado en vez
            de aplastarse contra el texto. */}
        <RejillaV4 columnas={3} className="mt-3">
          {TEXTOS_04A.preguntas.map((pregunta) => (
            <div
              key={pregunta.clave}
              className="v4-tarjeta-azul flex items-center gap-3 p-4 lg:flex-col lg:items-start lg:justify-between lg:gap-4"
            >
              <p className="min-w-0 flex-1 text-[0.9375rem] leading-snug" style={{ color: "var(--v4-navy)" }}>
                {pregunta.texto}
              </p>
              <ParSiNoV4
                valor={
                  respuestas[pregunta.clave] === undefined
                    ? null
                    : respuestas[pregunta.clave] === "SI"
                }
                alElegir={(esSi) =>
                  setRespuestas((previas) => ({ ...previas, [pregunta.clave]: esSi ? "SI" : "NO" }))
                }
                etiquetaAccesible={pregunta.texto}
              />
            </div>
          ))}
        </RejillaV4>

        <h2 className="v4-rotulo mt-5">
          {TEXTOS_04A.seccionBeneficiario}
          <span style={{ color: "var(--v4-rojo)" }}>*</span>
        </h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["HEREDEROS_LEGALES", TEXTOS_04A.opciones.herederos],
              ["PERSONA_DESIGNADA", TEXTOS_04A.opciones.designada],
            ] as const
          ).map(([valor, rotulo]) => (
            <label
              key={valor}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
              style={{
                borderColor: tipo === valor ? "var(--v4-azul)" : "var(--v4-azul-borde)",
                background: "var(--v4-blanco)",
              }}
            >
              <input
                type="radio"
                name="beneficiario"
                checked={tipo === valor}
                onChange={() => setTipo(valor)}
                className="h-5 w-5"
                style={{ accentColor: "var(--v4-azul)" }}
              />
              <span className="text-[0.9375rem]" style={{ color: "var(--v4-navy)" }}>
                {rotulo}
              </span>
            </label>
          ))}
        </div>

        {designada ? (
          <CamposV4 className="mt-3 gap-y-3">
            <CampoAnchoV4>
              <CampoTextoV4
                etiqueta={TEXTOS_04A.etiquetas.nombre}
                valor={nombre}
                alCambiar={setNombre}
                marcador={TEXTOS_04A.marcadores.nombre}
                obligatorioConAsterisco
              />
            </CampoAnchoV4>
            <CampoAnchoV4>
              <CampoTextoV4
                etiqueta={TEXTOS_04A.etiquetas.domicilio}
                valor={domicilio}
                alCambiar={setDomicilio}
                marcador={TEXTOS_04A.marcadores.domicilio}
                obligatorioConAsterisco
              />
            </CampoAnchoV4>
            <SelectorV4
              etiqueta={TEXTOS_04A.etiquetas.parentesco}
              valor={parentesco || null}
              marcador={TEXTOS_04A.marcadores.parentesco}
              abierto={parentescoAbierto}
              obligatorioConAsterisco
              alAbrir={() => setParentescoAbierto(true)}
            />
            {/* La cédula del beneficiario es **opcional y no bloqueante**
                (CHG-24): la norma no la pide y frenar el trámite por el
                documento de un tercero sería exigir más que la norma. */}
            <CampoTextoV4
              etiqueta={TEXTOS_04A.etiquetas.cedula}
              valor={cedula}
              alCambiar={setCedula}
              marcador={TEXTOS_04A.marcadores.cedula}
              inputMode="numeric"
            />
          </CamposV4>
        ) : null}

        <AvisoAzulV4 className="mt-4" iconoRojo>
          {TEXTOS_04A.avisoEvaluacion}
        </AvisoAzulV4>

        {errorFranja ? (
          <div className="mt-4">
            <FranjaErrorV4 titulo={errorFranja.titulo} indicacion={errorFranja.indicacion} />
          </div>
        ) : null}

        <AccionesV4 className="mt-5">
          <BotonPrincipalV4 onClick={continuar} disabled={!completo} cargando={enviando}>
            {TEXTOS_04A.continuar}
          </BotonPrincipalV4>
        </AccionesV4>
      </DisposicionV4>

      {parentescoAbierto ? (
        <HojaV4
          titulo="PARENTESCO"
          tituloEnVersalitas
          alto="media"
          alCerrar={() => setParentescoAbierto(false)}
        >
          <ListaDeOpcionesV4
            opciones={PARENTESCOS}
            conBuscador={false}
            alElegir={(opcion) => {
              setParentesco(opcion);
              setParentescoAbierto(false);
            }}
          />
        </HojaV4>
      ) : null}
    </MarcoV4>
  );
}
