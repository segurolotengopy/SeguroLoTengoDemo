/**
 * Lectura aproximada de la cédula sin MRZ.
 *
 * El foco está en la heurística de la fecha de nacimiento, que es la más
 * riesgosa del módulo: alimenta el corte de edad 18–64 (regla inviolable #8) y
 * es exactamente lo que el adaptador de producción se niega a adivinar.
 */
import { describe, expect, it } from "vitest";
import { extraerCamposAproximados } from "../cedula-aproximada";

/** Líneas sin geometría: el proveedor no siempre la informa. */
function lineas(...textos: readonly string[]) {
  return textos.map((texto) => ({ texto, confianza: 99, caja: null }));
}

/**
 * Líneas **con** geometría, como las devuelve Textract. Cada entrada es
 * `[texto, izquierda, arriba]` en la escala 0–1 del proveedor.
 */
function lineasUbicadas(...items: readonly (readonly [string, number, number])[]) {
  return items.map(([texto, izquierda, arriba]) => ({
    texto,
    confianza: 99,
    caja: { izquierda, arriba, ancho: 0.1, alto: 0.02 },
  }));
}

describe("extraerCamposAproximados", () => {
  /**
   * El caso real que rompía: la cédula paraguaya tiene dos columnas y Textract
   * devuelve las líneas en orden de lectura, saltando de una a la otra. Las
   * coordenadas son las que devolvió Textract sobre el documento de la prueba
   * del 01-sep-2026 (fixture D-21).
   *
   * Leyendo «la línea siguiente», APELLIDOS tomaba «FECHA DE VENCIMIENTO» —que
   * está en la columna derecha— y NOMBRES tomaba «BLI», un fragmento suelto.
   */
  it("asocia cada rótulo con el valor de su columna, no con la línea siguiente", () => {
    const campos = extraerCamposAproximados(
      lineasUbicadas(
        ["APELLIDOS", 0.332, 0.222],
        ["FECHA DE VENCIMIENTO", 0.714, 0.224],
        ["FERNANDEZ ECHAZU", 0.34, 0.259],
        ["29-10-2026", 0.74, 0.262],
        ["NOMBRES", 0.331, 0.364],
        ["BLI", 0.434, 0.282],
        ["RODRIGO", 0.34, 0.397],
        ["FECHA DE NACIMIENTO", 0.33, 0.757],
        ["15-09-1974", 0.339, 0.792],
      ),
      "PY",
    );

    expect(campos.apellidos).toBe("FERNANDEZ ECHAZU");
    expect(campos.nombres).toBe("RODRIGO");
    expect(campos.fechaNacimiento).toBe("1974-09-15");
  });

  /**
   * Con cajas y sin nada debajo del rótulo, no se adivina con el orden: es
   * preferible el campo vacío a un valor de otra columna.
   */
  it("con geometría, no toma un valor lejano cuando no hay nada bajo el rótulo", () => {
    const campos = extraerCamposAproximados(
      lineasUbicadas(
        ["NOMBRES", 0.33, 0.36],
        ["ALGO EN OTRA COLUMNA", 0.72, 0.37],
      ),
      "PY",
    );

    expect(campos.nombres).toBeNull();
  });

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

/**
 * Cédula boliviana del **formato anterior**, que sigue circulando.
 *
 * Este bloque nace de una prueba con un documento real que no completó P5. Sus
 * tres particularidades rompían el parser a la vez: fechas escritas en
 * palabras, datos personales en el reverso, y el nombre corrido sin rótulos de
 * nombres/apellidos.
 *
 * Los valores son inventados; lo que se reproduce es la **estructura**.
 */
describe("cédula boliviana del formato anterior", () => {
  const ANVERSO = lineas(
    "ESTADO PLURINACIONAL DE BOLIVIA",
    "CÉDULA DE IDENTIDAD",
    "BIO",
    "serie",
    "42333",
    "sección",
    "42222",
    "No. 1234567",
    "Emitida el 14 de Mayo de 2021",
    "Expira el 14 de Mayo de 2031",
  );

  const REVERSO = lineas(
    "EL SERVICIO GENERAL DE IDENTIFICACIÓN PERSONAL",
    "CERTIFICA: Que la firma, fotografía",
    "e impresión pertenece",
    "A:  ROSA MARIA PEREIRA SUAREZ",
    "Nacido el 30 de Diciembre de 1967",
    "En LA PAZ - MURILLO",
    "Estado Civil CASADO",
    "Domicilio AV. SIEMPREVIVA 742",
  );

  it("lee la fecha de nacimiento escrita en palabras", () => {
    // Sin esto no se extraía ninguna fecha: el formato anterior no imprime
    // ninguna en números, y sin fecha no hay corte de edad.
    const campos = extraerCamposAproximados([...ANVERSO, ...REVERSO], "BO");
    expect(campos.fechaNacimiento).toBe("1967-12-30");
  });

  it("prefiere la fecha rotulada por 'Nacido el' sobre emisión y vencimiento", () => {
    const campos = extraerCamposAproximados([...ANVERSO, ...REVERSO], "BO");
    // La más antigua también sería 1967, así que se comprueba que las otras
    // dos fechas se hayan leído y descartado, no ignorado.
    expect(campos.fechasEncontradas).toContain("2021-05-14");
    expect(campos.fechasEncontradas).toContain("2031-05-14");
  });

  it("parte el nombre corrido del reverso en nombres y apellidos", () => {
    // El reverso no separa los campos: dice "…pertenece / A: NOMBRE COMPLETO".
    const campos = extraerCamposAproximados([...ANVERSO, ...REVERSO], "BO");
    expect(campos.nombres).toBe("ROSA MARIA");
    expect(campos.apellidos).toBe("PEREIRA SUAREZ");
  });

  it("no toma el rótulo 'A' como parte del nombre", () => {
    const campos = extraerCamposAproximados(REVERSO, "BO");
    expect(campos.nombres?.startsWith("A ")).toBe(false);
  });

  it("no confunde la línea del organismo emisor con un nombre", () => {
    // "EL SERVICIO GENERAL DE IDENTIFICACION PERSONAL" también son puras
    // letras y espacios: el ancla en "PERTENECE" es lo que lo evita.
    const campos = extraerCamposAproximados(REVERSO, "BO");
    expect(campos.nombres).not.toContain("SERVICIO");
    expect(campos.apellidos).not.toContain("PERSONAL");
  });
});
