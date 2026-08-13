/**
 * OCR de la cédula sobre Textract.
 *
 * Lo que importa acá es la disciplina del umbral y el reparto de
 * responsabilidad entre frente y dorso: el frente aporta lo que se puede
 * reconocer sin ambigüedad, y **el dato que manda es el del MRZ**, que es el
 * único con formato normado y dígitos verificadores.
 */
import { describe, expect, it } from "vitest";
import { CONFIANZA_MINIMA_OCR } from "../../../domain/identidad-parametros";
import {
  buscarMrzTd1,
  elegirFechaNacimiento,
  extraerCamposCedulaParaguaya,
  leerTextoDocumento,
} from "../textract-cedula";
import type { ClienteTextract, LineaReconocida } from "../textract-cedula";
import { leerMrzTd1 } from "../../../domain/mrz";

const HOY = new Date("2026-08-13T12:00:00.000Z");

/** Cédula paraguaya válida: 9.323.336, nacida el 12/05/1990, vence 12/05/2030. */
const MRZ_LINEAS = [
  "IDPRY9323336<<9<<<<<<<<<<<<<<<",
  "9005123F3005121PRY<<<<<<<<<<<0",
  "GORENA<TAPIA<<MONICA<MARIANA<<",
];

function clienteConBloques(bloques: unknown[]): ClienteTextract {
  return {
    async send() {
      return { Blocks: bloques } as never;
    },
  };
}

function linea(texto: string, confianza: number): LineaReconocida {
  return { texto, confianza };
}

describe("leerTextoDocumento", () => {
  it("separa las líneas confiables de las que no alcanzan el umbral", async () => {
    const cliente = clienteConBloques([
      { BlockType: "LINE", Text: "9.323.336", Confidence: 99.1 },
      { BlockType: "LINE", Text: "GORENA TAPIA", Confidence: 97.4 },
      { BlockType: "LINE", Text: "borrosa", Confidence: 62.0 },
    ]);

    const resultado = await leerTextoDocumento(cliente, new Uint8Array([1]));

    expect(resultado.lineas).toHaveLength(3);
    expect(resultado.lineasConfiables).toHaveLength(2);
    expect(resultado.confianzaMinima).toBeCloseTo(97.4);
  });

  it("ignora bloques que no son líneas y líneas vacías", async () => {
    const cliente = clienteConBloques([
      { BlockType: "PAGE", Text: "no cuenta", Confidence: 99 },
      { BlockType: "WORD", Text: "tampoco", Confidence: 99 },
      { BlockType: "LINE", Text: "   ", Confidence: 99 },
      { BlockType: "LINE", Text: "sí", Confidence: 99 },
    ]);

    const resultado = await leerTextoDocumento(cliente, new Uint8Array([1]));
    expect(resultado.lineas.map((l) => l.texto)).toEqual(["sí"]);
  });

  it("un bloque sin confianza declarada no es confiable", async () => {
    // Ausente cae a 0, que no llega al umbral. Lado seguro: los campos que
    // salen de acá quedan bloqueados y no editables en P5.
    const cliente = clienteConBloques([{ BlockType: "LINE", Text: "9.323.336" }]);
    const resultado = await leerTextoDocumento(cliente, new Uint8Array([1]));

    expect(resultado.lineasConfiables).toHaveLength(0);
    expect(resultado.confianzaMinima).toBeNull();
  });

  it("el umbral es exactamente el de la política", async () => {
    const justo = clienteConBloques([
      { BlockType: "LINE", Text: "al filo", Confidence: CONFIANZA_MINIMA_OCR },
      { BlockType: "LINE", Text: "abajo", Confidence: CONFIANZA_MINIMA_OCR - 0.1 },
    ]);
    const resultado = await leerTextoDocumento(justo, new Uint8Array([1]));

    expect(resultado.lineasConfiables.map((l) => l.texto)).toEqual(["al filo"]);
  });
});

describe("buscarMrzTd1", () => {
  it("encuentra el MRZ en tres líneas consecutivas", () => {
    const lineas = [
      linea("REPUBLICA DEL PARAGUAY", 99),
      ...MRZ_LINEAS.map((l) => linea(l, 71)),
    ];
    const resultado = buscarMrzTd1(lineas, HOY);

    expect(resultado.encontrado).toBe(true);
    if (!resultado.encontrado) return;
    expect(resultado.datos.numeroDocumento).toBe("9323336");
    expect(resultado.datos.fechaNacimiento).toBe("1990-05-12");
  });

  it("lo encuentra aunque Textract devuelva las tres líneas pegadas", () => {
    const resultado = buscarMrzTd1([linea(MRZ_LINEAS.join(""), 68)], HOY);
    expect(resultado.encontrado).toBe(true);
  });

  it("busca sobre las líneas crudas, no sobre las confiables", () => {
    // La fuente OCR-B del MRZ le baja la confianza a Textract. Filtrar por
    // umbral antes de intentar leerlo tiraría MRZ válidos. No hace falta el
    // umbral: el MRZ trae su propia verificación, que es más fuerte.
    const bajaConfianza = MRZ_LINEAS.map((l) => linea(l, 55));
    expect(bajaConfianza.every((l) => l.confianza < CONFIANZA_MINIMA_OCR)).toBe(true);

    const resultado = buscarMrzTd1(bajaConfianza, HOY);
    expect(resultado.encontrado).toBe(true);
  });

  it("un dorso sin MRZ no es un error", () => {
    // El formato anterior de cédula no lo tiene. Quien llama decide.
    const resultado = buscarMrzTd1([linea("REPUBLICA DEL PARAGUAY", 99)], HOY);
    expect(resultado).toEqual({ encontrado: false, motivo: "SIN_MRZ" });
  });

  it("un MRZ con verificadores rotos sí es un problema y se distingue", () => {
    const adulterado = [...MRZ_LINEAS];
    adulterado[1] = adulterado[1].replace("9005123F", "8005123F");

    const resultado = buscarMrzTd1(
      adulterado.map((l) => linea(l, 70)),
      HOY,
    );
    expect(resultado).toEqual({ encontrado: false, motivo: "MRZ_INVALIDO" });
  });
});

describe("extraerCamposCedulaParaguaya", () => {
  it("reconoce el número de cédula con y sin puntos", () => {
    expect(extraerCamposCedulaParaguaya([linea("9.323.336", 99)]).numeroCedula).toBe("9323336");
    expect(extraerCamposCedulaParaguaya([linea("9323336", 99)]).numeroCedula).toBe("9323336");
  });

  it("junta todas las fechas sin decidir cuál es cuál", () => {
    // La cédula trae nacimiento, emisión y vencimiento, y sin el formato
    // oficial del frente no se puede afirmar cuál es cuál por posición.
    const campos = extraerCamposCedulaParaguaya([
      linea("12/05/1990", 99),
      linea("01/03/2020", 99),
      linea("12-05-2030", 99),
    ]);

    expect(campos.fechasEncontradas).toEqual(["1990-05-12", "2020-03-01", "2030-05-12"]);
    // Nunca adivina la de nacimiento por su cuenta.
    expect(campos.fechaNacimiento).toBeNull();
  });

  it("devuelve nulo cuando no hay nada reconocible", () => {
    const campos = extraerCamposCedulaParaguaya([linea("REPUBLICA DEL PARAGUAY", 99)]);
    expect(campos.numeroCedula).toBeNull();
    expect(campos.fechasEncontradas).toEqual([]);
  });
});

describe("elegirFechaNacimiento", () => {
  const mrz = (() => {
    const leido = leerMrzTd1(MRZ_LINEAS.join("\n"), HOY);
    if (!leido.ok) throw new Error("el fixture MRZ tiene que ser válido");
    return leido.datos;
  })();

  it("elige la fecha del frente que el MRZ confirma", () => {
    const campos = extraerCamposCedulaParaguaya([
      linea("12/05/1990", 99),
      linea("12/05/2030", 99),
    ]);
    expect(elegirFechaNacimiento(campos, mrz)).toBe("1990-05-12");
  });

  it("sin MRZ no adivina: devuelve nulo", () => {
    // Regla inviolable #8: la edad se verifica contra la fecha de la cédula.
    // Elegir "la más antigua" arriesgaría un corte de edad mal hecho, así que
    // antes de adivinar no se devuelve nada.
    const campos = extraerCamposCedulaParaguaya([linea("12/05/1990", 99)]);
    expect(elegirFechaNacimiento(campos, null)).toBeNull();
  });

  it("si el frente no confirma lo que dice el MRZ, devuelve nulo", () => {
    const campos = extraerCamposCedulaParaguaya([linea("01/01/1985", 99)]);
    expect(elegirFechaNacimiento(campos, mrz)).toBeNull();
  });
});
