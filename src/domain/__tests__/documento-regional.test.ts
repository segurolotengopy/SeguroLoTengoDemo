/**
 * Reconocimiento básico de cédula paraguaya y boliviana.
 *
 * Lo que importa probar acá son las dos direcciones del error, que tienen
 * costos muy distintos: dejar pasar algo que no es una cédula (lo que motivó
 * el módulo) y rechazar una cédula real por exigir de más (lo que arruinaría
 * el recorrido de una persona con documento válido).
 */
import { describe, expect, it } from "vitest";
import {
  MARCADORES_MINIMOS_DOCUMENTO,
  PAISES_ACEPTADOS_POR_DEFECTO,
  mensajeDocumentoNoReconocido,
  normalizarTexto,
  reconocerDocumentoRegional,
} from "../documento-regional";

const FRENTE_PY = [
  "REPÚBLICA DEL PARAGUAY",
  "CÉDULA DE IDENTIDAD",
  "9.323.336",
  "GORENA TAPIA",
  "MÓNICA MARIANA",
  "12/05/1990",
];

const FRENTE_BO = [
  "ESTADO PLURINACIONAL DE BOLIVIA",
  "CÉDULA DE IDENTIDAD",
  "SERVICIO GENERAL DE IDENTIFICACIÓN PERSONAL",
  "4827193 LP",
  "FECHA DE EXPIRACIÓN",
];

describe("normalizarTexto", () => {
  it("saca tildes, sube a mayúsculas y colapsa espacios", () => {
    expect(normalizarTexto("  República   del  Paraguay ")).toBe("REPUBLICA DEL PARAGUAY");
  });

  it("normaliza la diéresis y la eñe sin romper la letra base", () => {
    expect(normalizarTexto("Ñandutí")).toBe("NANDUTI");
  });
});

describe("reconocerDocumentoRegional", () => {
  it("reconoce el frente de una cédula paraguaya y le saca el número sin puntos", () => {
    const senales = reconocerDocumentoRegional(FRENTE_PY, "FRENTE", ["PY"]);

    expect(senales.pais).toBe("PY");
    expect(senales.numeroDetectado).toBe("9323336");
    expect(senales.marcadoresEncontrados.length).toBeGreaterThanOrEqual(
      MARCADORES_MINIMOS_DOCUMENTO,
    );
  });

  it("reconoce el frente de una cédula boliviana y descarta el complemento departamental", () => {
    const senales = reconocerDocumentoRegional(FRENTE_BO, "FRENTE", ["PY", "BO"]);

    expect(senales.pais).toBe("BO");
    expect(senales.numeroDetectado).toBe("4827193");
  });

  it("no reconoce nada en la fotografía de un objeto cualquiera", () => {
    // Es el caso que motivó el módulo: que la foto de un vaso no pase por
    // cédula. Sin marcadores no hay país, y sin país el adaptador rechaza.
    const senales = reconocerDocumentoRegional(
      ["VASO", "500 ML", "APTO PARA LAVAVAJILLAS"],
      "FRENTE",
      ["PY", "BO"],
    );

    expect(senales.pais).toBeNull();
    expect(senales.numeroDetectado).toBeNull();
  });

  it("no alcanza con un solo marcador genérico", () => {
    // "CEDULA DE IDENTIDAD" sola aparece en documentos de media región y en
    // cualquier formulario que la mencione.
    const senales = reconocerDocumentoRegional(["CEDULA DE IDENTIDAD", "1234567"], "FRENTE", [
      "PY",
    ]);

    expect(senales.pais).toBeNull();
  });

  it("rechaza una cédula boliviana si solo se aceptan documentos paraguayos", () => {
    const senales = reconocerDocumentoRegional(FRENTE_BO, "FRENTE", ["PY"]);

    expect(senales.pais).toBeNull();
  });

  it("acepta solo Paraguay por defecto", () => {
    expect(PAISES_ACEPTADOS_POR_DEFECTO).toEqual(["PY"]);
    expect(reconocerDocumentoRegional(FRENTE_BO, "FRENTE").pais).toBeNull();
  });

  it("elige el país con más marcadores cuando el texto podría ser de los dos", () => {
    // Un dorso boliviano menciona "LUGAR DE NACIMIENTO", que también es
    // marcador paraguayo. Gana el que tenga más señales propias.
    const senales = reconocerDocumentoRegional(
      ["ESTADO PLURINACIONAL DE BOLIVIA", "LUGAR DE NACIMIENTO", "GRUPO SANGUÍNEO", "NPIOC"],
      "DORSO",
      ["PY", "BO"],
    );

    expect(senales.pais).toBe("BO");
  });

  it("usa los marcadores del dorso y no los del frente", () => {
    // El frente paraguayo no tiene "FECHA DE EXPEDICION" ni el código PRY del
    // MRZ; pedirle marcadores de dorso a un frente no tiene que reconocerlo.
    expect(reconocerDocumentoRegional(FRENTE_PY, "DORSO", ["PY"]).pais).toBeNull();
  });

  it("reconoce el dorso paraguayo por el código de país del MRZ", () => {
    const senales = reconocerDocumentoRegional(
      ["IDPRY9323336<<9<<<<<<<<<<<<<<<", "REPUBLICA DEL PARAGUAY"],
      "DORSO",
      ["PY"],
    );

    expect(senales.pais).toBe("PY");
  });
});

describe("mensajeDocumentoNoReconocido", () => {
  it("nombra los dos países cuando los dos están habilitados", () => {
    expect(mensajeDocumentoNoReconocido(["PY", "BO"])).toContain("Paraguay o Bolivia");
  });

  it("nombra solo Paraguay cuando es el único aceptado", () => {
    const mensaje = mensajeDocumentoNoReconocido(["PY"]);
    expect(mensaje).toContain("Paraguay");
    expect(mensaje).not.toContain("Bolivia");
  });

  it("no revela qué marcadores busca el sistema", () => {
    // Publicar la lista sería publicar cómo pasarla.
    const mensaje = mensajeDocumentoNoReconocido(["PY", "BO"]);
    expect(mensaje).not.toContain("REPUBLICA");
    expect(mensaje).not.toContain("SEGIP");
  });
});

/**
 * Cédula boliviana del formato anterior (sigue circulando junto al del SEGIP
 * de 2023). Valores inventados; lo que importa es la estructura, que rompía el
 * reconocimiento en un documento real.
 */
describe("cédula boliviana del formato anterior", () => {
  const ANVERSO = [
    "ESTADO PLURINACIONAL DE BOLIVIA",
    "CÉDULA DE IDENTIDAD",
    "BIO",
    "serie",
    "42333",
    "sección",
    "42222",
    "No. 1234567",
    "Emitida el 14 de Mayo de 2021",
  ];

  const REVERSO = [
    "EL SERVICIO GENERAL DE IDENTIFICACIÓN PERSONAL",
    "CERTIFICA: Que la firma, fotografía e impresión pertenece",
    "Nacido el 30 de Diciembre de 1967",
    "Estado Civil CASADO",
    "Profesión/Ocupación BACHILLER",
    "Domicilio AV. SIEMPREVIVA 742",
    "DOCUMENTOS REGISTRADOS",
  ];

  it("reconoce el anverso", () => {
    expect(reconocerDocumentoRegional(ANVERSO, "FRENTE", ["PY", "BO"]).pais).toBe("BO");
  });

  it("reconoce el reverso, que no tiene los rótulos del formato nuevo", () => {
    // No trae GRUPO SANGUÍNEO ni NPIOC, y escribe "Profesión/Ocupación" con
    // barra en vez de "u". Con los marcadores del formato 2023 no se reconocía.
    expect(reconocerDocumentoRegional(REVERSO, "DORSO", ["PY", "BO"]).pais).toBe("BO");
  });

  it("toma el número rotulado y no la serie que aparece antes", () => {
    // El anverso imprime "serie 42333" y "sección 42222" ARRIBA del número
    // real. Quedarse con la primera corrida de dígitos devolvía la serie.
    expect(reconocerDocumentoRegional(ANVERSO, "FRENTE", ["BO"]).numeroDetectado).toBe("1234567");
  });

  it("sin rótulo, elige la corrida de dígitos más larga", () => {
    const senales = reconocerDocumentoRegional(
      ["ESTADO PLURINACIONAL DE BOLIVIA", "CÉDULA DE IDENTIDAD", "42333", "1234567"],
      "FRENTE",
      ["BO"],
    );
    expect(senales.numeroDetectado).toBe("1234567");
  });
});
