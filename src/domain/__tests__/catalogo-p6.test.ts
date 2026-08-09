import { describe, expect, it } from "vitest";
import {
  ACTIVIDADES,
  CIUDADES,
  INGRESO_MENSUAL_MAXIMO_GS,
  LARGO_MAXIMO_TEXTO_P6,
  PARENTESCOS,
  PROFESIONES,
  SITUACIONES_LABORALES,
  esIngresoMensualValido,
  interpretarDatosComplementariosP6,
  interpretarMontoGuaranies,
  normalizarTextoP6,
} from "../catalogo-p6";
import { interpretarDeclaracionesP6, clasificarMotivoDerivacion } from "../elegibilidad";
import { datosComplementariosFixture } from "./fixtures";

const DATOS_VALIDOS = {
  domicilio: datosComplementariosFixture.domicilio,
  ciudad: datosComplementariosFixture.ciudad,
  situacionLaboral: datosComplementariosFixture.situacionLaboral,
  actividad: datosComplementariosFixture.actividad,
  profesion: datosComplementariosFixture.profesion,
  empresa: datosComplementariosFixture.empresa,
  ingresoMensualDeclaradoGs: 8_000_000,
  beneficiarioTipo: "HEREDEROS_LEGALES",
};

describe("catálogos de los cinco selectores de P6", () => {
  it("no tienen opciones repetidas ni vacías", () => {
    const listas = { CIUDADES, SITUACIONES_LABORALES, ACTIVIDADES, PROFESIONES, PARENTESCOS };
    for (const [nombre, lista] of Object.entries(listas)) {
      expect(new Set(lista).size, `${nombre} tiene repetidos`).toBe(lista.length);
      for (const opcion of lista) expect(opcion.trim(), `${nombre} tiene una opción vacía`).not.toBe("");
    }
  });

  it("el fixture del dominio usa valores que están en los catálogos", () => {
    const resultado = interpretarDatosComplementariosP6(DATOS_VALIDOS);
    expect(resultado.ok).toBe(true);
  });
});

describe("interpretarMontoGuaranies", () => {
  it.each([
    ["9.500.000", 9_500_000],
    ["9500000", 9_500_000],
    ["Gs. 12 500 000", 12_500_000],
    [12_000_000, 12_000_000],
  ])("interpreta %s como %i", (entrada, esperado) => {
    expect(interpretarMontoGuaranies(entrada)).toBe(esperado);
  });

  it("devuelve null cuando no queda ningún dígito", () => {
    expect(interpretarMontoGuaranies("Gs.")).toBeNull();
    expect(interpretarMontoGuaranies("")).toBeNull();
    expect(interpretarMontoGuaranies(null)).toBeNull();
  });
});

describe("esIngresoMensualValido", () => {
  it("acepta un entero positivo dentro del tope", () => {
    expect(esIngresoMensualValido(1)).toBe(true);
    expect(esIngresoMensualValido(INGRESO_MENSUAL_MAXIMO_GS)).toBe(true);
  });

  it("rechaza cero, negativos, decimales y valores absurdos", () => {
    expect(esIngresoMensualValido(0)).toBe(false);
    expect(esIngresoMensualValido(-1)).toBe(false);
    expect(esIngresoMensualValido(1.5)).toBe(false);
    expect(esIngresoMensualValido(INGRESO_MENSUAL_MAXIMO_GS + 1)).toBe(false);
  });
});

describe("normalizarTextoP6", () => {
  it("recorta, colapsa espacios y acota el largo", () => {
    expect(normalizarTextoP6("  Avda.   España  123 ")).toBe("Avda. España 123");
    expect(normalizarTextoP6("x".repeat(500))).toHaveLength(LARGO_MAXIMO_TEXTO_P6);
    expect(normalizarTextoP6(42)).toBe("");
  });
});

describe("interpretarDatosComplementariosP6", () => {
  it("marca cada campo obligatorio que falta", () => {
    const resultado = interpretarDatosComplementariosP6({});
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.camposInvalidos).toEqual([
      "domicilio",
      "ciudad",
      "situacionLaboral",
      "actividad",
      "profesion",
      "ingresoMensualDeclaradoGs",
      "beneficiarioTipo",
    ]);
  });

  it("la empresa es el único campo opcional del bloque 1", () => {
    const resultado = interpretarDatosComplementariosP6({ ...DATOS_VALIDOS, empresa: "  " });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.datos.empresa).toBeNull();
  });

  it("una persona designada sin nombre, parentesco o domicilio no valida", () => {
    const resultado = interpretarDatosComplementariosP6({
      ...DATOS_VALIDOS,
      beneficiarioTipo: "PERSONA_DESIGNADA",
    });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.camposInvalidos).toEqual([
      "beneficiarioNombreCompleto",
      "beneficiarioParentesco",
      "beneficiarioDomicilio",
    ]);
  });

  it("rechaza un valor de selector que no está en el catálogo", () => {
    const resultado = interpretarDatosComplementariosP6({
      ...DATOS_VALIDOS,
      profesion: "Astronauta",
    });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.camposInvalidos).toEqual(["profesion"]);
  });
});

describe("interpretarDeclaracionesP6", () => {
  it("exige las ocho y devuelve las que faltan, en orden", () => {
    const resultado = interpretarDeclaracionesP6({ "1": "SI", "4": "SI" });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.sinResponder).toEqual([2, 3, 5, 6, 7, 8]);
  });

  it("un valor que no es SI ni NO cuenta como sin responder", () => {
    const resultado = interpretarDeclaracionesP6({
      "1": "SI", "2": "NO", "3": "NO", "4": "SI",
      "5": "SI", "6": "SI", "7": "SI", "8": "quizás",
    });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.sinResponder).toEqual([8]);
  });
});

describe("clasificarMotivoDerivacion", () => {
  it.each([
    [[1], "SALUD"],
    [[2, 3], "SALUD"],
    [[8], "PEP"],
    [[1, 8], "SALUD_Y_PEP"],
  ])("clasifica %j como %s", (numeros, esperado) => {
    expect(clasificarMotivoDerivacion(numeros)).toBe(esperado);
  });

  it("devuelve null si no bloqueó ninguna", () => {
    expect(clasificarMotivoDerivacion([])).toBeNull();
    // Las 4 a 7 no tienen categoría de bloqueo: no derivan.
    expect(clasificarMotivoDerivacion([4, 5, 6, 7])).toBeNull();
  });
});
