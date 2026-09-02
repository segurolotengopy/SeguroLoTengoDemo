/**
 * Lectura y verificación del MRZ TD1 del dorso de la cédula (ICAO Doc 9303).
 *
 * La prueba que sostiene a todas las demás es la del **especimen canónico de
 * ICAO** (`ERIKSSON`, Doc 9303 Parte 5): si nuestros cuatro dígitos
 * verificadores coinciden con los del ejemplo publicado en la norma, el
 * algoritmo —pesos 7-3-1, alfabeto, y sobre todo el rango del verificador
 * compuesto— está bien. Sin ese anclaje, un test escrito con fixtures propios
 * solo probaría que el código coincide consigo mismo.
 */
import { describe, expect, it } from "vitest";
import {
  CODIGO_PARAGUAY,
  cruzarConMrz,
  digitoVerificador,
  leerMrzTd1,
  normalizarLineasTd1,
  verificadorCorrecto,
} from "../mrz";
import type { DatosFrenteParaCruce } from "../mrz";

/**
 * Especimen TD1 de ICAO Doc 9303 Parte 5. Estado emisor ficticio `UTO`
 * (Utopía), el que la norma usa en todos sus ejemplos.
 */
const MRZ_ICAO = [
  "I<UTOD231458907<<<<<<<<<<<<<<<",
  "7408122F1204159UTO<<<<<<<<<<<6",
  "ERIKSSON<<ANNA<MARIA<<<<<<<<<<",
].join("\n");

/**
 * Cédula paraguaya de la persona de prueba: número 9.323.336, nacimiento
 * 1990-05-12, vencimiento 2030-05-12, femenino. Los cuatro verificadores
 * (9, 3, 1, 0) están calculados según ICAO Doc 9303.
 */
const MRZ_PARAGUAYO = [
  "IDPRY9323336<<9<<<<<<<<<<<<<<<",
  "9005123F3005121PRY<<<<<<<<<<<0",
  "GORENA<TAPIA<<MONICA<MARIANA<<",
].join("\n");

/** Fecha de referencia fija: el vencimiento 2030 tiene que seguir vigente. */
const HOY = new Date("2026-08-13T12:00:00.000Z");

describe("digitoVerificador (ICAO Doc 9303, pesos 7-3-1)", () => {
  it("reproduce los cuatro verificadores del especimen canónico de ICAO", () => {
    // Esta es la prueba de que el algoritmo es el de la norma y no una
    // reconstrucción parecida. Los valores esperados están impresos en el
    // propio especimen del Doc 9303 Parte 5.
    expect(digitoVerificador("D23145890")).toBe(7); // número de documento
    expect(digitoVerificador("740812")).toBe(2); // fecha de nacimiento
    expect(digitoVerificador("120415")).toBe(9); // fecha de vencimiento
    expect(
      digitoVerificador(
        "D23145890" + "7" + "<<<<<<<<<<<<<<<" + "740812" + "2" + "120415" + "9" + "<<<<<<<<<<<",
      ),
    ).toBe(6); // verificador compuesto
  });

  it("el relleno `<` vale 0 y las letras valen 10 a 35", () => {
    expect(digitoVerificador("<<<")).toBe(0);
    // A=10 con peso 7 → 70 → 70 % 10 = 0.
    expect(digitoVerificador("A")).toBe(0);
    // Z=35 con peso 7 → 245 → 5.
    expect(digitoVerificador("Z")).toBe(5);
  });

  it("un carácter fuera del alfabeto del MRZ no produce dígito", () => {
    expect(digitoVerificador("ABC-123")).toBeNull();
    expect(digitoVerificador("ñ")).toBeNull();
  });

  it("verificadorCorrecto acepta `<` como cero y rechaza el vacío", () => {
    expect(verificadorCorrecto("<<<", "<")).toBe(true);
    expect(verificadorCorrecto("<<<", "0")).toBe(true);
    expect(verificadorCorrecto("<<<", "")).toBe(false);
    expect(verificadorCorrecto("740812", "3")).toBe(false);
  });
});

describe("normalizarLineasTd1", () => {
  it("acepta las tres líneas separadas por saltos", () => {
    expect(normalizarLineasTd1(MRZ_PARAGUAYO)).toHaveLength(3);
  });

  it("acepta 90 caracteres corridos, como los devuelve un OCR", () => {
    const corrido = MRZ_PARAGUAYO.replace(/\n/g, "");
    const lineas = normalizarLineasTd1(corrido);
    expect(lineas).toEqual(MRZ_PARAGUAYO.split("\n"));
  });

  it("descarta espacios y ruido que el OCR mete entre caracteres", () => {
    const conRuido = MRZ_PARAGUAYO.split("\n")
      .map((linea) => linea.split("").join(" "))
      .join("\n");
    expect(normalizarLineasTd1(conRuido)).toEqual(MRZ_PARAGUAYO.split("\n"));
  });

  it("rechaza lo que no tiene la forma de un TD1", () => {
    expect(normalizarLineasTd1("")).toBeNull();
    expect(normalizarLineasTd1("IDPRY9323336")).toBeNull();
    // Dos líneas de 44 es un TD3 (pasaporte), no un TD1.
    expect(normalizarLineasTd1(`${"A".repeat(44)}\n${"B".repeat(44)}`)).toBeNull();
  });
});

/**
 * El caso real: Textract recorta el relleno `<` del final, así que la banda
 * llega con líneas de 27 y 29 caracteres. Antes se descartaba entera —«no hay
 * MRZ»— y el flujo caía a la heurística del frente.
 */
describe("MRZ real recortado por el OCR", () => {
  const CRUDAS = [
    "IEPRYAA0740311692883<0207<<",
    "7409152M2610298BOL<<<<<<<<<<5",
    "FERNANDEZ<ECHAZU<<RODR<I<<<<<<",
  ].join("\n");

  it("repone el relleno que el OCR se comió y consigue leer la banda", () => {
    const lineas = normalizarLineasTd1(CRUDAS);
    expect(lineas).not.toBeNull();
    expect(lineas?.every((linea) => linea.length === 30)).toBe(true);
  });

  it("informa la fecha de nacimiento porque su propio dígito verifica", () => {
    const resultado = leerMrzTd1(CRUDAS, new Date("2026-09-01"));

    // El compuesto no cierra —el OCR perdió además algún carácter— pero la
    // fecha sí, y es la que decide el corte de edad (regla inviolable #8).
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivos).toContain("VERIFICADOR_COMPUESTO");
    expect(resultado.verificados?.fechaNacimiento).toBe("1974-09-15");
    expect(resultado.verificados?.numeroDocumento).toBe("AA0740311");
  });

  it("no repone relleno si falta demasiado: no se inventa un MRZ", () => {
    const muyCorta = ["IEPRYAA074", "7409152M26", "FERNANDEZ<"].join("\n");
    expect(normalizarLineasTd1(muyCorta)).toBeNull();
  });
});

describe("leerMrzTd1", () => {
  it("lee el especimen de ICAO completo", () => {
    const resultado = leerMrzTd1(MRZ_ICAO, HOY);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.datos.numeroDocumento).toBe("D23145890");
    expect(resultado.datos.estadoEmisor).toBe("UTO");
    expect(resultado.datos.fechaNacimiento).toBe("1974-08-12");
    expect(resultado.datos.fechaVencimiento).toBe("2012-04-15");
    expect(resultado.datos.sexo).toBe("F");
    expect(resultado.datos.apellidos).toBe("ERIKSSON");
    expect(resultado.datos.nombres).toBe("ANNA MARIA");
  });

  it("lee una cédula paraguaya y separa apellidos de nombres", () => {
    const resultado = leerMrzTd1(MRZ_PARAGUAYO, HOY);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.datos.numeroDocumento).toBe("9323336");
    expect(resultado.datos.estadoEmisor).toBe(CODIGO_PARAGUAY);
    expect(resultado.datos.nacionalidad).toBe(CODIGO_PARAGUAY);
    expect(resultado.datos.fechaNacimiento).toBe("1990-05-12");
    expect(resultado.datos.fechaVencimiento).toBe("2030-05-12");
    expect(resultado.datos.apellidos).toBe("GORENA TAPIA");
    expect(resultado.datos.nombres).toBe("MONICA MARIANA");
  });

  it("detecta un dígito adulterado en la fecha de nacimiento", () => {
    // Cambiar el año de nacimiento sin recalcular los verificadores rompe el
    // de la fecha y también el compuesto: es justamente lo que hace difícil
    // falsificar un dorso a mano.
    const adulterado = MRZ_PARAGUAYO.replace("9005123F", "8005123F");
    const resultado = leerMrzTd1(adulterado, HOY);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivos).toContain("VERIFICADOR_FECHA_NACIMIENTO");
    expect(resultado.motivos).toContain("VERIFICADOR_COMPUESTO");
  });

  it("detecta un número de cédula adulterado", () => {
    const adulterado = MRZ_PARAGUAYO.replace("9323336<<9", "9323337<<9");
    const resultado = leerMrzTd1(adulterado, HOY);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivos).toContain("VERIFICADOR_NUMERO_DOCUMENTO");
  });

  it("un solo verificador roto se distingue de un MRZ que no es MRZ", () => {
    // Un verificador roto sugiere OCR mal leído → repetir captura tiene
    // sentido. Todos rotos sugiere que eso no es un MRZ.
    const unoRoto = leerMrzTd1(MRZ_PARAGUAYO.replace("9323336<<9", "9323336<<8"), HOY);
    expect(unoRoto.ok).toBe(false);
    if (unoRoto.ok) return;
    expect(unoRoto.motivos).toEqual(["VERIFICADOR_NUMERO_DOCUMENTO", "VERIFICADOR_COMPUESTO"]);
  });

  it("rechaza estructura y caracteres inválidos por separado", () => {
    const corta = leerMrzTd1("IDPRY", HOY);
    expect(corta.ok).toBe(false);
    if (!corta.ok) expect(corta.motivos).toEqual(["ESTRUCTURA_INVALIDA"]);
  });

  it("rechaza una fecha que no existe", () => {
    // Mes 13: los verificadores pueden cerrar y la fecha seguir siendo falsa,
    // así que la validez del calendario se controla aparte.
    const mes13 = "991302";
    const resultado = leerMrzTd1(
      ["IDPRY9323336<<9<<<<<<<<<<<<<<<", `${mes13}0F3005121PRY<<<<<<<<<<<0`, "X<<Y<<<<<<<<<<<<<<<<<<<<<<<<<<"].join(
        "\n",
      ),
      HOY,
    );
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivos).toContain("FECHA_INVALIDA");
  });

  it("infiere el siglo de la fecha de nacimiento hacia el pasado", () => {
    // `90` no puede ser 2090 porque todavía no pasó; `05` sí puede ser 2005.
    const noventa = leerMrzTd1(MRZ_PARAGUAYO, HOY);
    expect(noventa.ok && noventa.datos.fechaNacimiento).toBe("1990-05-12");

    // Mismo MRZ con nacimiento 2005-05-12 (verificadores recalculados).
    const dosMil = leerMrzTd1(
      ["IDPRY9323336<<9<<<<<<<<<<<<<<<", "0505125F3005121PRY<<<<<<<<<<<4", "GORENA<TAPIA<<MONICA<<<<<<<<<<"].join(
        "\n",
      ),
      HOY,
    );
    expect(dosMil.ok).toBe(true);
    if (!dosMil.ok) return;
    expect(dosMil.datos.fechaNacimiento).toBe("2005-05-12");
  });
});

describe("cruzarConMrz", () => {
  const mrz = (() => {
    const resultado = leerMrzTd1(MRZ_PARAGUAYO, HOY);
    if (!resultado.ok) throw new Error("el fixture MRZ tiene que ser válido");
    return resultado.datos;
  })();

  const FRENTE_COHERENTE: DatosFrenteParaCruce = {
    numeroCedula: "9.323.336",
    fechaNacimiento: "1990-05-12",
    sexo: "FEMENINO",
  };

  it("acepta un frente coherente con el dorso", () => {
    expect(cruzarConMrz(FRENTE_COHERENTE, mrz, HOY)).toEqual({ coincide: true, motivos: [] });
  });

  it("ignora los puntos con que se imprime la cédula en el frente", () => {
    // El frente dice `9.323.336`, el MRZ `9323336`. Son el mismo número.
    expect(cruzarConMrz({ ...FRENTE_COHERENTE, numeroCedula: "9323336" }, mrz, HOY).coincide).toBe(
      true,
    );
  });

  it("compara el sexo por la inicial, no por la palabra completa", () => {
    expect(cruzarConMrz({ ...FRENTE_COHERENTE, sexo: "F" }, mrz, HOY).coincide).toBe(true);
    expect(cruzarConMrz({ ...FRENTE_COHERENTE, sexo: "MASCULINO" }, mrz, HOY).motivos).toContain(
      "SEXO_NO_COINCIDE",
    );
  });

  it("detecta un frente que no corresponde a ese dorso", () => {
    const otro = cruzarConMrz(
      { numeroCedula: "1.234.567", fechaNacimiento: "1985-01-01", sexo: "MASCULINO" },
      mrz,
      HOY,
    );
    expect(otro.coincide).toBe(false);
    expect([...otro.motivos].sort()).toEqual(
      ["FECHA_NACIMIENTO_NO_COINCIDE", "NUMERO_CEDULA_NO_COINCIDE", "SEXO_NO_COINCIDE"].sort(),
    );
  });

  it("rechaza un documento vencido", () => {
    // Misma cédula, leída en 2031: el vencimiento 2030-05-12 ya pasó.
    const enElFuturo = new Date("2031-01-01T00:00:00.000Z");
    expect(cruzarConMrz(FRENTE_COHERENTE, mrz, enElFuturo).motivos).toContain("DOCUMENTO_VENCIDO");
  });

  it("rechaza un documento que no emitió Paraguay", () => {
    const eriksson = leerMrzTd1(MRZ_ICAO, HOY);
    expect(eriksson.ok).toBe(true);
    if (!eriksson.ok) return;

    // P5 no admite pasaporte ni documento extranjero.
    const cruce = cruzarConMrz(
      { numeroCedula: "D23145890", fechaNacimiento: "1974-08-12", sexo: "F" },
      eriksson.datos,
      HOY,
    );
    expect(cruce.motivos).toContain("ESTADO_EMISOR_NO_ES_PARAGUAY");
  });
});

describe("microtexto de seguridad que no es un MRZ", () => {
  it("no toma el fondo repetido de la cédula boliviana por un MRZ", () => {
    // El fondo de seguridad es "ESTADOPLURINACIONALDEBOLIVIA…" repetido, y el
    // OCR lo devuelve como líneas largas de mayúsculas sin espacios. Cuando
    // sumaban 90 caracteres se leían como TD1, los verificadores no cerraban y
    // el dorso quedaba rechazado por "código no consistente" en un documento
    // que no tiene MRZ. Peor: dependía de cómo cortara las líneas el OCR, así
    // que el mismo documento pasaba o fallaba entre intentos.
    const microtexto = "ESTADOPLURINACIONALDEBOLIVIAES".repeat(3);
    expect(microtexto.length).toBe(90);
    expect(normalizarLineasTd1(microtexto)).toBeNull();
  });

  it("sigue aceptando un TD1 real, que empieza con el código de documento", () => {
    // ICAO Doc 9303 Parte 5: una tarjeta de identidad empieza con I, A o C.
    const linea1 = "IDPRY9323336<<9<<<<<<<<<<<<<<<";
    expect(linea1.length).toBe(30);
    expect(normalizarLineasTd1(`${linea1}\n${"0".repeat(30)}\n${"A".repeat(30)}`)).not.toBeNull();
  });
});
