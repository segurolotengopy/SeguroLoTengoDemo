"use client";

/**
 * 03D · Completá tus datos. Etapa 2 de 5.
 *
 * Los 14 estados del arte, con tres correcciones de coherencia que el análisis
 * visual dejó anotadas (§6.2):
 *
 * - **La edad se oculta mientras la fecha no sea válida.** El arte muestra
 *   `EDAD CALCULADA: 42 AÑOS` junto a `31/02/1984`, y el manual prohíbe
 *   calcular elegibilidad con una fecha inválida.
 * - **`Otra ciudad o localidad` va al final** de las 44, no como séptima fila.
 * - Los selectores dicen **«Elegí una opción»**, unificado con 04A (D-35).
 *
 * D-31 en una línea: la cédula y la fecha **se editan y se registran**, pero
 * la elegibilidad y el bloqueo se calculan con lo que leyó el OCR. Por eso la
 * edad que muestra la ficha es la del servidor, no una cuenta hecha acá con el
 * campo editado.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CIUDADES_V4,
  paisDeNacionalidadLeida,
  ESTADOS_CIVILES_V4,
  NACIONALIDADES_V4,
  PAISES_V4,
  SEXOS_V4,
} from "@/domain/v4/catalogos-03d";
import { TEXTOS_03D } from "@/domain/v4/textos-identidad";
import { MarcoV4 } from "../MarcoV4";
import { BarraPlanV4 } from "../BarraPlanV4";
import { HojaV4 } from "../superficies";
import {
  AvisoAzulV4,
  BotonPrincipalV4,
  CampoTextoV4,
  FranjaErrorV4,
  IconoCandado,
  IconoTildeDisco,
  ListaDeOpcionesV4,
  SelectorV4,
} from "../piezas";
import { IlustracionDatos } from "../ilustraciones";

type CampoSelector =
  | "sexo"
  | "estadoCivil"
  | "paisNacimiento"
  | "nacionalidad"
  | "paisResidencia"
  | "ciudad";

/** Los dos que el arte abre **en línea**; los otros cuatro, en hoja inferior. */
const EN_LINEA: readonly CampoSelector[] = ["sexo", "estadoCivil"];

const CATALOGOS: Record<CampoSelector, readonly string[]> = {
  sexo: SEXOS_V4,
  estadoCivil: ESTADOS_CIVILES_V4,
  paisNacimiento: PAISES_V4,
  nacionalidad: NACIONALIDADES_V4,
  paisResidencia: PAISES_V4,
  ciudad: CIUDADES_V4,
};

const TITULOS_HOJA: Record<CampoSelector, string> = {
  sexo: "SEXO",
  estadoCivil: "ESTADO CIVIL",
  paisNacimiento: "PAÍS DE NACIMIENTO",
  nacionalidad: "NACIONALIDAD",
  paisResidencia: "PAÍS DE RESIDENCIA",
  ciudad: "CIUDAD",
};

const BUSCADOR: Record<CampoSelector, string | null> = {
  sexo: null,
  estadoCivil: null,
  paisNacimiento: TEXTOS_03D.buscar.pais,
  nacionalidad: TEXTOS_03D.buscar.nacionalidad,
  paisResidencia: TEXTOS_03D.buscar.pais,
  ciudad: TEXTOS_03D.buscar.ciudad,
};

interface DatosDelServidor {
  readonly identidad: {
    readonly numeroCedula: string;
    readonly nombres: string;
    readonly apellidos: string;
    readonly fechaNacimiento: string;
    readonly sexo: string;
    readonly nacionalidad: string;
    readonly paisNacimiento: string;
    readonly paisResidencia: string;
    readonly estadoCivil: string;
  };
  readonly edad: number;
  readonly edadEnRango: boolean;
  readonly datosPersonales: { domicilio: string; ciudad: string; barrio: string } | null;
}

/** `1984-05-14` → `14/05/1984`, que es como lo escribe el arte. */
function aFechaVisible(iso: string): string {
  const partes = iso.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : iso;
}

/** `14/05/1984` → `1984-05-14`, o `null` si la fecha no existe en el calendario. */
function aFechaIso(visible: string): string | null {
  const coincide = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(visible.trim());
  if (!coincide) return null;
  const [, dia, mes, anio] = coincide;
  const fecha = new Date(`${anio}-${mes}-${dia}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return null;
  // `new Date("2024-02-31")` no falla: se corre al 2 de marzo. Se compara el
  // día para rechazar el 31 de febrero, que es justamente el caso del arte.
  return fecha.getUTCDate() === Number(dia) && fecha.getUTCMonth() + 1 === Number(mes)
    ? `${anio}-${mes}-${dia}`
    : null;
}

export function Pantalla03D() {
  const router = useRouter();
  const [servidor, setServidor] = useState<DatosDelServidor | null>(null);

  const [numeroCedula, setNumeroCedula] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [valores, setValores] = useState<Record<CampoSelector, string>>({
    sexo: "",
    estadoCivil: "",
    paisNacimiento: "",
    nacionalidad: "",
    paisResidencia: "",
    ciudad: "",
  });
  const [direccion, setDireccion] = useState("");
  const [barrio, setBarrio] = useState("");

  const [abierto, setAbierto] = useState<CampoSelector | null>(null);
  const [editados, setEditados] = useState<Set<string>>(new Set());
  const [errorFranja, setErrorFranja] = useState<{ titulo: string; indicacion: string } | null>(null);
  const [campoEnRojo, setCampoEnRojo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const respuesta = await fetch("/api/v4/datos-personales");
      const datos = (await respuesta.json()) as DatosDelServidor & { ok: boolean };
      if (!vigente || !datos.ok) return;
      setServidor(datos);
      setNumeroCedula(datos.identidad.numeroCedula);
      setNombres(datos.identidad.nombres);
      const apellidos = datos.identidad.apellidos.split(" ");
      setApellidoPaterno(apellidos[0] ?? "");
      setApellidoMaterno(apellidos.slice(1).join(" "));
      setFechaNacimiento(aFechaVisible(datos.identidad.fechaNacimiento));
      setValores((previos) => ({
        ...previos,
        sexo: datos.identidad.sexo,
        // La cédula dice el gentilicio; el catálogo, el país.
        nacionalidad: paisDeNacionalidadLeida(datos.identidad.nacionalidad) ?? "",
        paisNacimiento: datos.identidad.paisNacimiento,
        paisResidencia: datos.identidad.paisResidencia,
        estadoCivil: datos.identidad.estadoCivil,
        ciudad: datos.datosPersonales?.ciudad ?? "",
      }));
      setDireccion(datos.datosPersonales?.domicilio ?? "");
      setBarrio(datos.datosPersonales?.barrio ?? "");
    })();
    return () => {
      vigente = false;
    };
  }, []);

  function marcarEditado(campo: string) {
    setEditados((previos) => new Set(previos).add(campo));
  }

  function elegir(campo: CampoSelector, opcion: string) {
    setValores((previos) => ({ ...previos, [campo]: opcion }));
    setAbierto(null);
    setCampoEnRojo(null);
    setErrorFranja(null);
  }

  const fechaValida = aFechaIso(fechaNacimiento) !== null;
  const completo =
    numeroCedula.trim() !== "" &&
    nombres.trim() !== "" &&
    apellidoPaterno.trim() !== "" &&
    apellidoMaterno.trim() !== "" &&
    fechaValida &&
    Object.values(valores).every((valor) => valor !== "") &&
    direccion.trim() !== "" &&
    barrio.trim() !== "";

  async function continuar() {
    setErrorFranja(null);
    setCampoEnRojo(null);

    if (!fechaValida) {
      setCampoEnRojo("fechaNacimiento");
      setErrorFranja(TEXTOS_03D.errorFecha);
      return;
    }
    if (barrio.trim() === "") {
      setCampoEnRojo("barrio");
      setErrorFranja(TEXTOS_03D.errorObligatorio(TEXTOS_03D.etiquetas.barrio));
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await fetch("/api/v4/datos-personales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombres,
          apellidoPaterno,
          apellidoMaterno,
          numeroCedula,
          fechaNacimiento: aFechaIso(fechaNacimiento),
          sexo: valores.sexo,
          estadoCivil: valores.estadoCivil,
          paisNacimiento: valores.paisNacimiento,
          nacionalidad: valores.nacionalidad,
          paisResidencia: valores.paisResidencia,
          domicilio: direccion,
          ciudad: valores.ciudad,
          barrio,
        }),
      });
      const datos = (await respuesta.json()) as {
        ok: boolean;
        camposInvalidos?: readonly string[];
      };
      if (datos.ok) {
        router.push("/actividad");
        return;
      }
      const primero = datos.camposInvalidos?.[0];
      if (primero) {
        setCampoEnRojo(primero);
        setErrorFranja(TEXTOS_03D.errorObligatorio(primero));
        return;
      }
      setErrorFranja({
        titulo: "NO PUDIMOS GUARDAR LOS DATOS.",
        indicacion: "Revisá los campos e intentá nuevamente.",
      });
    } catch {
      setErrorFranja({
        titulo: "NO PUDIMOS GUARDAR LOS DATOS.",
        indicacion: "Revisá tu conexión e intentá nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  }

  // 03D_13 · la edad quedó fuera de rango. Es una vista propia, no una tarjeta.
  if (servidor && !servidor.edadEnRango) {
    return (
      <MarcoV4 codigo="03D">
        <div className="flex items-center justify-between">
          <h1 className="text-[1.25rem] font-bold" style={{ color: "var(--v4-rojo)" }}>
            {TEXTOS_03D.noElegible.encabezado}
          </h1>
        </div>
        <BarraPlanV4 className="mt-4" />
        <div className="mt-10 flex flex-col items-center text-center">
          <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--v4-rojo)" strokeWidth="4" />
            <path d="M40 40 L80 80 M80 40 L40 80" stroke="var(--v4-rojo)" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <p className="mt-6 text-[1.75rem] font-bold leading-tight" style={{ color: "var(--v4-rojo)" }}>
            {TEXTOS_03D.noElegible.titulo}
          </p>
          <p className="mt-4 text-[1rem]" style={{ color: "var(--v4-navy)" }}>
            {TEXTOS_03D.noElegible.cuerpo}
          </p>
        </div>
        <AvisoAzulV4 className="mt-6">{TEXTOS_03D.noElegible.aviso}</AvisoAzulV4>
        <div className="mt-5">
          <BotonPrincipalV4
            onClick={async () => {
              await fetch("/api/flujo/cerrar", { method: "POST" });
              router.push("/");
            }}
          >
            {TEXTOS_03D.noElegible.boton}
          </BotonPrincipalV4>
        </div>
        <p className="mt-2 text-center text-[0.8125rem]" style={{ color: "var(--v4-azul)" }}>
          {TEXTOS_03D.noElegible.pie}
        </p>
      </MarcoV4>
    );
  }

  function Selector({ campo, etiqueta }: { readonly campo: CampoSelector; readonly etiqueta: string }) {
    const enLinea = EN_LINEA.includes(campo);
    return (
      <div className="relative">
        <SelectorV4
          etiqueta={etiqueta}
          valor={valores[campo] || null}
          marcador={TEXTOS_03D.marcadorSeleccione}
          abierto={abierto === campo}
          error={campoEnRojo === campo ? "" : null}
          alAbrir={() => setAbierto(abierto === campo ? null : campo)}
        />
        {enLinea && abierto === campo ? (
          <ul
            className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border bg-white shadow-lg"
            style={{ borderColor: "var(--v4-navy)" }}
            role="listbox"
          >
            {CATALOGOS[campo].map((opcion) => (
              <li key={opcion}>
                <button
                  type="button"
                  role="option"
                  aria-selected={valores[campo] === opcion}
                  onClick={() => elegir(campo, opcion)}
                  className="w-full border-b px-4 py-3 text-left text-[1rem]"
                  style={{ borderColor: "var(--v4-gris-borde)", color: "var(--v4-navy)" }}
                >
                  {opcion}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <MarcoV4 codigo="03D">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="v4-titular">
            {TEXTOS_03D.titulo}
            <em>{TEXTOS_03D.tituloAcento}</em>
          </h1>
          <p className="v4-bajada mt-2">{TEXTOS_03D.bajada}</p>
        </div>
        <IlustracionDatos tamano={108} className="shrink-0" />
      </div>

      <div className="v4-tarjeta-azul mt-4 flex items-center gap-3 p-3">
        <IconoTildeDisco tamano={40} color="var(--v4-navy)" />
        <p className="text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
          {TEXTOS_03D.identidadVerificada}
        </p>
      </div>

      <BarraPlanV4 className="mt-3" />

      <h2 className="v4-rotulo mt-5">{TEXTOS_03D.seccionIdentidad}</h2>
      <AvisoAzulV4 className="mt-3">{TEXTOS_03D.avisoCampos}</AvisoAzulV4>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <span className="v4-etiqueta">{TEXTOS_03D.etiquetas.tipoDocumento}</span>
          <div className="v4-campo v4-campo-bloqueado flex items-center justify-between" style={{ paddingRight: "0.75rem" }}>
            <span>{TEXTOS_03D.valorTipoDocumento}</span>
            <IconoCandado />
          </div>
        </div>
        <CampoTextoV4
          etiqueta={TEXTOS_03D.etiquetas.numeroCedula}
          valor={numeroCedula}
          alCambiar={(valor) => {
            setNumeroCedula(valor);
            marcarEditado("numeroCedula");
          }}
          editado={editados.has("numeroCedula")}
          inputMode="numeric"
        />
      </div>

      <div className="mt-3">
        <CampoTextoV4
          etiqueta={TEXTOS_03D.etiquetas.nombres}
          valor={nombres}
          alCambiar={(valor) => {
            setNombres(valor);
            marcarEditado("nombres");
          }}
          editado={editados.has("nombres")}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <CampoTextoV4
          etiqueta={TEXTOS_03D.etiquetas.apellidoPaterno}
          valor={apellidoPaterno}
          alCambiar={(valor) => {
            setApellidoPaterno(valor);
            marcarEditado("apellidos");
          }}
          editado={editados.has("apellidos")}
        />
        <CampoTextoV4
          etiqueta={TEXTOS_03D.etiquetas.apellidoMaterno}
          valor={apellidoMaterno}
          alCambiar={(valor) => {
            setApellidoMaterno(valor);
            marcarEditado("apellidos");
          }}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <CampoTextoV4
          etiqueta={TEXTOS_03D.etiquetas.fechaNacimiento}
          valor={fechaNacimiento}
          alCambiar={(valor) => {
            setFechaNacimiento(valor);
            marcarEditado("fechaNacimiento");
            setCampoEnRojo(null);
            setErrorFranja(null);
          }}
          error={campoEnRojo === "fechaNacimiento" ? "" : null}
          editado={editados.has("fechaNacimiento")}
          inputMode="numeric"
        />
        <Selector campo="sexo" etiqueta={TEXTOS_03D.etiquetas.sexo} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Selector campo="estadoCivil" etiqueta={TEXTOS_03D.etiquetas.estadoCivil} />
        <Selector campo="paisNacimiento" etiqueta={TEXTOS_03D.etiquetas.paisNacimiento} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Selector campo="nacionalidad" etiqueta={TEXTOS_03D.etiquetas.nacionalidad} />
        <Selector campo="paisResidencia" etiqueta={TEXTOS_03D.etiquetas.paisResidencia} />
      </div>

      <h2 className="v4-rotulo mt-5">{TEXTOS_03D.seccionDomicilio}</h2>

      <div className="mt-3">
        <CampoTextoV4
          etiqueta={TEXTOS_03D.etiquetas.direccion}
          valor={direccion}
          alCambiar={setDireccion}
          marcador={TEXTOS_03D.marcadorComplete}
          error={campoEnRojo === "domicilio" ? "" : null}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Selector campo="ciudad" etiqueta={TEXTOS_03D.etiquetas.ciudad} />
        <CampoTextoV4
          etiqueta={TEXTOS_03D.etiquetas.barrio}
          valor={barrio}
          alCambiar={(valor) => {
            setBarrio(valor);
            setCampoEnRojo(null);
            setErrorFranja(null);
          }}
          marcador={TEXTOS_03D.marcadorComplete}
          error={campoEnRojo === "barrio" ? "" : null}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <AvisoAzulV4
          titulo={editados.size > 0 ? TEXTOS_03D.fichaModificacion.titulo : TEXTOS_03D.fichaNoCoinciden.titulo}
        >
          {editados.size > 0 ? TEXTOS_03D.fichaModificacion.cuerpo : TEXTOS_03D.fichaNoCoinciden.cuerpo}
        </AvisoAzulV4>

        {/* La edad **se oculta con una fecha inválida**: calcular elegibilidad
            con una fecha que no existe es exactamente lo que el manual
            prohíbe. Y la que se muestra es la del servidor, calculada con lo
            que leyó el OCR (D-31). */}
        {servidor && fechaValida ? (
          <AvisoAzulV4 titulo={TEXTOS_03D.fichaEdad.titulo(servidor.edad)}>
            {TEXTOS_03D.fichaEdad.cuerpo}
          </AvisoAzulV4>
        ) : (
          <div />
        )}
      </div>

      {errorFranja ? (
        <div className="mt-4">
          <FranjaErrorV4 titulo={errorFranja.titulo} indicacion={errorFranja.indicacion} />
        </div>
      ) : null}

      <div className="mt-5">
        <BotonPrincipalV4 onClick={continuar} disabled={!completo} cargando={enviando}>
          {enviando ? TEXTOS_03D.validando : TEXTOS_03D.continuar}
        </BotonPrincipalV4>
      </div>

      {abierto && !EN_LINEA.includes(abierto) ? (
        <HojaV4
          titulo={TITULOS_HOJA[abierto]}
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
    </MarcoV4>
  );
}
