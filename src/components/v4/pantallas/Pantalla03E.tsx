"use client";

/**
 * 03E · Actividad, ingresos y condición PEP. Etapa 3 de 5.
 *
 * Los 21 artes de este grupo son **candidatos**: se implementan por el encargo
 * del 16-sep-2026 y la pantalla se rehace si Interseguros aprueba otro dibujo.
 *
 * La regla dura: responder **Sí** a la condición PEP no rechaza nada, deriva a
 * revisión manual. Quien lo garantiza no es esta pantalla sino el grafo de
 * estados, donde `DERIVADO_MANUAL` no tiene salidas.
 *
 * El autocompletado por situación laboral (artes 02 a 07) sale de
 * `AUTOCOMPLETADO_LABORAL_V4`: cuatro situaciones resuelven actividad,
 * ocupación y empresa; dos habilitan el campo de empresa; la restante deja
 * todo a mano. **Profesión nunca se autocompleta** — un jubilado puede ser
 * médico jubilado.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACTIVIDADES_ECONOMICAS_V4,
  AUTOCOMPLETADO_LABORAL_V4,
  NO_APLICA_V4,
  OCUPACIONES_V4,
  ORIGENES_INGRESOS_V4,
  PROFESIONES_V4,
  SITUACIONES_LABORALES_V4,
  exigeEmpresaV4,
} from "@/domain/v4/catalogos-03e";
import { TEXTOS_03E } from "@/domain/v4/textos-actividad";
import { MarcoV4 } from "../MarcoV4";
import { BarraPlanV4 } from "../BarraPlanV4";
import { HojaV4 } from "../superficies";
import {
  AvisoAzulV4,
  AvisoRojoV4,
  BotonPrincipalV4,
  CampoTextoV4,
  FranjaErrorV4,
  ListaDeOpcionesV4,
  ParSiNoV4,
  SelectorV4,
} from "../piezas";
import { IlustracionActividad } from "../ilustraciones";
import { PanelPep03E1 } from "./PanelPep03E1";

type CampoSelector = "situacionLaboral" | "actividadEconomica" | "ocupacion" | "profesion" | "origenIngresos";

const CATALOGOS: Record<CampoSelector, readonly string[]> = {
  situacionLaboral: SITUACIONES_LABORALES_V4,
  actividadEconomica: ACTIVIDADES_ECONOMICAS_V4,
  ocupacion: OCUPACIONES_V4,
  profesion: PROFESIONES_V4,
  origenIngresos: ORIGENES_INGRESOS_V4,
};

const TITULOS: Record<CampoSelector, string> = {
  situacionLaboral: "SITUACIÓN LABORAL",
  actividadEconomica: "ACTIVIDAD ECONÓMICA",
  ocupacion: "OCUPACIÓN U OFICIO",
  profesion: "PROFESIÓN",
  origenIngresos: "ORIGEN DE INGRESOS",
};

/** Cuáles llevan buscador, según el arte. */
const BUSCADOR: Record<CampoSelector, string | null> = {
  situacionLaboral: null,
  actividadEconomica: TEXTOS_03E.buscar.actividad,
  ocupacion: TEXTOS_03E.buscar.ocupacion,
  profesion: TEXTOS_03E.buscar.profesion,
  origenIngresos: null,
};

export function Pantalla03E() {
  const router = useRouter();

  const [valores, setValores] = useState<Record<CampoSelector, string>>({
    situacionLaboral: "",
    actividadEconomica: "",
    ocupacion: "",
    profesion: "",
    origenIngresos: "",
  });
  const [empresa, setEmpresa] = useState("");
  const [ingreso, setIngreso] = useState("");
  const [esPep, setEsPep] = useState<boolean | null>(null);

  const [abierto, setAbierto] = useState<CampoSelector | null>(null);
  const [pepAbierto, setPepAbierto] = useState(false);
  const [campoEnRojo, setCampoEnRojo] = useState<string | null>(null);
  const [errorFranja, setErrorFranja] = useState<{ titulo: string; indicacion: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const autocompletado = AUTOCOMPLETADO_LABORAL_V4[valores.situacionLaboral];
  const empresaHabilitada = exigeEmpresaV4(valores.situacionLaboral);
  const empresaNoAplica = autocompletado?.empresa === NO_APLICA_V4;

  function elegir(campo: CampoSelector, opcion: string) {
    setAbierto(null);
    setCampoEnRojo(null);
    setErrorFranja(null);

    if (campo !== "situacionLaboral") {
      setValores((previos) => ({ ...previos, [campo]: opcion }));
      return;
    }

    // Al cambiar la situación laboral se recalcula el bloque entero: es lo que
    // hacen los artes 02 a 07, y dejar valores de la situación anterior
    // produciría un FIPF con un empleador que ya no corresponde.
    const relleno = AUTOCOMPLETADO_LABORAL_V4[opcion];
    setValores((previos) => ({
      ...previos,
      situacionLaboral: opcion,
      actividadEconomica: relleno?.actividadEconomica ?? "",
      ocupacion: relleno?.ocupacion ?? "",
    }));
    setEmpresa(relleno?.empresa === NO_APLICA_V4 ? NO_APLICA_V4 : "");
  }

  const completo =
    Object.values(valores).every((valor) => valor !== "") &&
    ingreso.trim() !== "" &&
    esPep !== null &&
    (!empresaHabilitada || empresa.trim() !== "");

  async function continuar() {
    setErrorFranja(null);
    setCampoEnRojo(null);
    setEnviando(true);
    try {
      const respuesta = await fetch("/api/v4/actividad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situacionLaboral: valores.situacionLaboral,
          actividadEconomica: valores.actividadEconomica,
          ocupacion: valores.ocupacion,
          profesion: valores.profesion,
          empresa: empresaHabilitada ? empresa : "",
          ingresoMensualDeclarado: ingreso,
          origenIngresos: valores.origenIngresos,
          esPep,
        }),
      });
      const datos = (await respuesta.json()) as {
        ok: boolean;
        derivado?: boolean;
        camposInvalidos?: readonly string[];
      };

      if (datos.ok) {
        router.push(datos.derivado ? "/revision-manual" : "/declaraciones");
        return;
      }

      const invalido = datos.camposInvalidos?.[0];
      if (invalido === "empresa") {
        setCampoEnRojo("empresa");
        setErrorFranja(TEXTOS_03E.errores.empresa);
        return;
      }
      if (invalido === "ingresoMensualDeclarado") {
        setCampoEnRojo("ingreso");
        setErrorFranja(TEXTOS_03E.errores.ingreso);
        return;
      }
      if (invalido === "profesion") {
        setCampoEnRojo("profesion");
        setErrorFranja(TEXTOS_03E.errores.profesion);
        return;
      }
      if (invalido) {
        setCampoEnRojo(invalido);
        setErrorFranja(TEXTOS_03E.errores.generico(invalido));
        return;
      }
      // El expediente se movió por otro lado: se lo lleva a donde corresponde.
      router.refresh();
    } catch {
      setErrorFranja({
        titulo: "NO PUDIMOS GUARDAR TUS DATOS.",
        indicacion: "Revisá tu conexión e intentá nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  }

  function Campo({ campo }: { readonly campo: CampoSelector }) {
    const bloqueadoPorAutocompletado =
      (campo === "actividadEconomica" || campo === "ocupacion") &&
      autocompletado !== undefined;
    return (
      <SelectorV4
        etiqueta={TEXTOS_03E.etiquetas[campo]}
        valor={valores[campo] || null}
        marcador={TEXTOS_03E.marcadorSeleccione}
        abierto={abierto === campo}
        error={campoEnRojo === campo ? "" : null}
        deshabilitado={bloqueadoPorAutocompletado}
        alAbrir={() => setAbierto(abierto === campo ? null : campo)}
      />
    );
  }

  return (
    <MarcoV4 codigo="03E">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="v4-titular">
            {TEXTOS_03E.titulo}
            <br />
            <em>{TEXTOS_03E.tituloAcento}</em>
          </h1>
          <p className="v4-bajada mt-2">{TEXTOS_03E.bajada}</p>
        </div>
        <IlustracionActividad tamano={108} className="shrink-0" />
      </div>

      <BarraPlanV4 className="mt-4" />

      <h2 className="v4-rotulo mt-5">{TEXTOS_03E.seccionLaboral}</h2>

      <div className="mt-3 space-y-3">
        <Campo campo="situacionLaboral" />
        <Campo campo="actividadEconomica" />
        <Campo campo="ocupacion" />
        <Campo campo="profesion" />
        <div>
          <CampoTextoV4
            etiqueta={TEXTOS_03E.etiquetas.empresa}
            valor={empresaNoAplica ? NO_APLICA_V4 : empresa}
            alCambiar={empresaHabilitada ? setEmpresa : undefined}
            deshabilitado={!empresaHabilitada}
            marcador={
              empresaHabilitada ? TEXTOS_03E.marcadorComplete : TEXTOS_03E.marcadorEmpresaBloqueada
            }
            error={campoEnRojo === "empresa" ? "" : null}
          />
          <p
            className="mt-1 text-[0.75rem]"
            style={{
              color: campoEnRojo === "empresa" ? "var(--v4-rojo)" : "var(--v4-azul)",
              fontWeight: campoEnRojo === "empresa" ? 700 : 400,
            }}
          >
            {TEXTOS_03E.notaEmpresa}
          </p>
        </div>
      </div>

      <h2 className="v4-rotulo mt-5">{TEXTOS_03E.seccionEconomica}</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <CampoTextoV4
          etiqueta={TEXTOS_03E.etiquetas.ingreso}
          valor={ingreso}
          alCambiar={(valor) => {
            setIngreso(valor);
            setCampoEnRojo(null);
            setErrorFranja(null);
          }}
          marcador={TEXTOS_03E.marcadorComplete}
          inputMode="numeric"
          error={campoEnRojo === "ingreso" ? "" : null}
        />
        <div>
          <Campo campo="origenIngresos" />
          <p className="mt-1 text-[0.75rem]" style={{ color: "var(--v4-azul)" }}>
            {TEXTOS_03E.notaOrigen}
          </p>
        </div>
      </div>

      <h2 className="v4-rotulo mt-5">{TEXTOS_03E.seccionPep}</h2>

      <div className="v4-tarjeta mt-3 flex items-center gap-3 p-4">
        <p className="min-w-0 flex-1 text-[0.9375rem]" style={{ color: "var(--v4-navy)" }}>
          {TEXTOS_03E.preguntaPep}
        </p>
        <ParSiNoV4
          valor={esPep}
          alElegir={setEsPep}
          etiquetaAccesible={TEXTOS_03E.preguntaPep}
        />
      </div>

      <div className="mt-2 text-center">
        <button type="button" className="v4-enlace text-[0.9375rem]" onClick={() => setPepAbierto(true)}>
          {TEXTOS_03E.enlacePep}
        </button>
      </div>

      {esPep === true ? (
        <AvisoRojoV4 className="mt-4" titulo={TEXTOS_03E.avisoPepTitulo}>
          {TEXTOS_03E.avisoPep}
        </AvisoRojoV4>
      ) : (
        <AvisoAzulV4 className="mt-4" titulo={TEXTOS_03E.avisoNeutroTitulo}>
          {TEXTOS_03E.avisoNeutro}
        </AvisoAzulV4>
      )}

      {errorFranja ? (
        <div className="mt-4">
          <FranjaErrorV4 titulo={errorFranja.titulo} indicacion={errorFranja.indicacion} />
        </div>
      ) : null}

      <div className="mt-5">
        <BotonPrincipalV4 onClick={continuar} disabled={!completo} cargando={enviando}>
          {enviando
            ? esPep
              ? TEXTOS_03E.registrandoRevision
              : TEXTOS_03E.validando
            : TEXTOS_03E.continuar}
        </BotonPrincipalV4>
      </div>

      {abierto ? (
        <HojaV4
          titulo={TITULOS[abierto]}
          tituloEnVersalitas
          alto="media"
          alCerrar={() => setAbierto(null)}
        >
          <ListaDeOpcionesV4
            opciones={CATALOGOS[abierto]}
            conBuscador={BUSCADOR[abierto] !== null}
            marcadorBusqueda={BUSCADOR[abierto] ?? undefined}
            alElegir={(opcion) => elegir(abierto, opcion)}
          />
        </HojaV4>
      ) : null}

      {pepAbierto ? <PanelPep03E1 alCerrar={() => setPepAbierto(false)} /> : null}
    </MarcoV4>
  );
}
