/**
 * Lectura aproximada de la cédula sin MRZ.
 *
 * El foco está en la heurística de la fecha de nacimiento, que es la más
 * riesgosa del módulo: alimenta el corte de edad 18–64 (regla inviolable #8) y
 * es exactamente lo que el adaptador de producción se niega a adivinar.
 */
import { describe, expect, it } from "vitest";
import { extraerCamposAproximados } from "../cedula-aproximada";

function lineas(...textos: readonly string[]) {
  return textos.map((texto) => ({ texto, confianza: 99 }));
}

describe("extraerCamposAproximados", () => {
  it("toma el valor de la línea siguiente al rótulo", () => {
    const campos = extraerCamposAproximados(
      lineas("NOMBRES", "MÓNICA MARIANA", "APELLIDOS", "GORENA TAPIA"),
      "PY",
    );

    expect(campos.nombres).toBe("MONICA MARIANA");
    expect(campos.apellidos).toBe("GORENA TAPIA");
  });

  it("toma el valor de la misma línea cuando viene pegado al rótulo", () => {
    const campos = extraerCamposAproximados(lineas("NOMBRES: MÓNICA MARIANA"), "PY");

    expect(campos.nombres).toBe("MONICA MARIANA");
  });

  it("no toma otro rótulo como si fuera un valor", () => {
    // Textract puede devolver los rótulos juntos y los valores después; sin
    // esta guarda, "NOMBRES" tendría como valor "APELLIDOS".
    const campos = extraerCamposAproximados(lineas("NOMBRES", "APELLIDOS"), "PY");

    expect(campos.nombres).toBeNull();
  });

  it("prefiere la fecha rotulada por encima de cualquier heurística", () => {
    const campos = extraerCamposAproximados(
      lineas("FECHA DE EMISIÓN", "01/03/2024", "FECHA DE NACIMIENTO", "12/05/1990"),
      "PY",
    );

    expect(campos.fechaNacimiento).toBe("1990-05-12");
  });

  it("sin rótulo, toma la más antigua de las fechas del documento", () => {
    // La apuesta del módulo: emisión y vencimiento son siempre posteriores al
    // nacimiento. Es cierto en toda cédula real, y es la razón por la que esto
    // no puede salir de DEMO_MODE.
    const campos = extraerCamposAproximados(
      lineas("12/05/1990", "01/03/2024", "01/03/2034"),
      "PY",
    );

    expect(campos.fechaNacimiento).toBe("1990-05-12");
    expect(campos.fechasEncontradas).toHaveLength(3);
  });

  it("descarta una fecha que no existe en el calendario", () => {
    // El 31 de febrero rebota en `Date` y se convertiría en marzo: aceptarlo
    // daría una fecha de nacimiento inventada.
    const campos = extraerCamposAproximados(lineas("31/02/1990", "12/05/1990"), "PY");

    expect(campos.fechasEncontradas).toEqual(["1990-05-12"]);
  });

  it("normaliza el sexo a M o F", () => {
    expect(extraerCamposAproximados(lineas("SEXO", "FEMENINO"), "PY").sexo).toBe("F");
    expect(extraerCamposAproximados(lineas("SEXO: M"), "PY").sexo).toBe("M");
  });

  it("devuelve null en el sexo si no lo reconoce, en vez de inventar uno", () => {
    expect(extraerCamposAproximados(lineas("SEXO", "?"), "PY").sexo).toBeNull();
  });

  it("lee un frente boliviano con sus propios rótulos", () => {
    const campos = extraerCamposAproximados(
      lineas(
        "ESTADO PLURINACIONAL DE BOLIVIA",
        "NOMBRES",
        "CARLOS ANDRÉS",
        "APELLIDOS",
        "QUISPE MAMANI",
        "FECHA DE NACIMIENTO",
        "07/11/1988",
      ),
      "BO",
    );

    expect(campos.nombres).toBe("CARLOS ANDRES");
    expect(campos.fechaNacimiento).toBe("1988-11-07");
  });

  it("devuelve todo en null cuando el texto no tiene nada de una cédula", () => {
    const campos = extraerCamposAproximados(lineas("VASO", "500 ML"), "PY");

    expect(campos).toMatchObject({
      nombres: null,
      apellidos: null,
      fechaNacimiento: null,
      sexo: null,
    });
  });
});
