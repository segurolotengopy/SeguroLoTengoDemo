/**
 * Cotejo de correcciones del OCR (CHG-15).
 *
 * Lo que se prueba es la frontera entre *arreglar una lectura* y *reemplazar
 * un dato*, que es exactamente lo que Rodrigo pidió en la reunión: "no puede
 * poner Juan y el carnet que diga Pedro".
 */
import { describe, expect, it } from "vitest";
import {
  CAMPOS_CORREGIBLES,
  cotejarCorreccion,
  distanciaDeEdicion,
  esCampoCorregible,
  normalizarParaCotejo,
  toleranciaDe,
} from "../cotejo-ocr";

describe("qué campos se pueden corregir", () => {
  it("acepta nombres y apellidos", () => {
    expect(esCampoCorregible("nombres")).toBe(true);
    expect(esCampoCorregible("apellidos")).toBe(true);
  });

  it("no acepta los cuatro campos de los que dependen reglas del negocio", () => {
    // La fecha decide el corte de edad (regla #8) y la cédula es la llave del
    // expediente y del bloqueo (regla #11). Sexo y nacionalidad salen del MRZ
    // con dígito verificador. Editarlos convertiría un dato del documento en
    // uno declarado.
    for (const campo of ["fechaNacimiento", "numeroCedula", "sexo", "nacionalidad"]) {
      expect(esCampoCorregible(campo), `${campo} no debería ser corregible`).toBe(false);
    }
  });

  it("no crece por accidente", () => {
    // Si alguien agrega un campo a la lista, este test lo obliga a pasar por
    // acá y a mirar el comentario de arriba.
    expect([...CAMPOS_CORREGIBLES]).toEqual(["nombres", "apellidos"]);
  });
});

describe("normalización", () => {
  it("iguala acentos, mayúsculas y espacios de más", () => {
    expect(normalizarParaCotejo("  José  María ")).toBe("JOSE MARIA");
  });
});

describe("distancia de edición", () => {
  it("es cero entre iguales y cuenta cada cambio", () => {
    expect(distanciaDeEdicion("JUAN", "JUAN")).toBe(0);
    expect(distanciaDeEdicion("JUAN", "JUAM")).toBe(1);
    expect(distanciaDeEdicion("JUAN", "JU4N")).toBe(1);
    expect(distanciaDeEdicion("PEDRO", "JUAN")).toBeGreaterThan(3);
  });
});

describe("tolerancia", () => {
  it("da al menos un arreglo, incluso en un campo corto", () => {
    expect(toleranciaDe("ANA")).toBe(1);
  });

  it("no deja que un campo largo se vuelva reescribible", () => {
    expect(toleranciaDe("MARIA DE LOS ANGELES DEL ROSARIO")).toBe(3);
  });
});

describe("cotejarCorreccion", () => {
  it("sin corrección deja el valor del OCR", () => {
    const resultado = cotejarCorreccion("nombres", "MONICA MARIANA", undefined);
    expect(resultado).toEqual({ ok: true, valor: "MONICA MARIANA", corregido: false });
  });

  it("una corrección vacía se trata como ausencia, no como borrado", () => {
    const resultado = cotejarCorreccion("nombres", "MONICA", "   ");
    expect(resultado).toEqual({ ok: true, valor: "MONICA", corregido: false });
  });

  it("acepta arreglar un carácter que el OCR leyó mal", () => {
    const resultado = cotejarCorreccion("nombres", "JU4N", "JUAN");
    expect(resultado.ok && resultado.valor).toBe("JUAN");
    expect(resultado.ok && resultado.corregido).toBe(true);
  });

  it("acepta reponer un acento o cambiar mayúsculas, y guarda lo que la persona escribió", () => {
    const resultado = cotejarCorreccion("nombres", "JOSE MARIA", "José María");
    expect(resultado.ok && resultado.valor).toBe("José María");
  });

  it("acepta arreglar un apellido compuesto largo dentro del margen", () => {
    const resultado = cotejarCorreccion("apellidos", "GORENA TAPIA", "GOREÑA TAPIA");
    expect(resultado.ok).toBe(true);
  });

  it("RECHAZA cambiar un nombre por otro", () => {
    const resultado = cotejarCorreccion("nombres", "PEDRO", "JUAN");
    expect(resultado).toEqual({
      ok: false,
      motivo: "NO_COINCIDE_CON_LA_CEDULA",
      campo: "nombres",
    });
  });

  it("RECHAZA agregar un apellido que la cédula no dice", () => {
    const resultado = cotejarCorreccion("apellidos", "GORENA", "GORENA TAPIA VILLALBA");
    expect(resultado.ok).toBe(false);
  });

  it("RECHAZA vaciar el campo escribiendo un solo carácter", () => {
    const resultado = cotejarCorreccion("apellidos", "GORENA TAPIA", "X");
    expect(resultado.ok).toBe(false);
  });
});
