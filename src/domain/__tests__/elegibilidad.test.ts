import { describe, expect, it } from "vitest";
import { evaluarElegibilidad } from "../elegibilidad";
import { declaracionesCompatibles } from "./fixtures";

describe("evaluarElegibilidad", () => {
  it("es elegible para emisión automática cuando las 8 respuestas son compatibles", () => {
    const resultado = evaluarElegibilidad(declaracionesCompatibles);

    expect(resultado.elegibleParaEmisionAutomatica).toBe(true);
    expect(resultado.declaracionesIncompatibles).toEqual([]);
    expect(resultado.declaracionesQueBloquean).toEqual([]);
  });

  it.each([
    ["estadoDeSalud" as const, 1],
    ["antecedentesDeContratacion" as const, 2],
    ["enfermedadesDiagnosticadas" as const, 3],
    ["condicionPep" as const, 8],
  ])("una respuesta incompatible en la declaración %s (#%i) bloquea la emisión automática", (clave, numero) => {
    const declaraciones = {
      ...declaracionesCompatibles,
      [clave]: declaracionesCompatibles[clave] === "SI" ? "NO" : "SI",
    };

    const resultado = evaluarElegibilidad(declaraciones);

    expect(resultado.elegibleParaEmisionAutomatica).toBe(false);
    expect(resultado.declaracionesQueBloquean).toEqual([numero]);
    expect(resultado.declaracionesIncompatibles).toContain(numero);
  });

  it.each([
    ["vigenciaYCarencias" as const, 4],
    ["veracidad" as const, 5],
    ["entregaDigital" as const, 6],
    ["corredorDeLaPoliza" as const, 7],
  ])("una respuesta incompatible en la declaración %s (#%i) NO bloquea la emisión automática", (clave, numero) => {
    const declaraciones = {
      ...declaracionesCompatibles,
      [clave]: declaracionesCompatibles[clave] === "SI" ? "NO" : "SI",
    };

    const resultado = evaluarElegibilidad(declaraciones);

    expect(resultado.elegibleParaEmisionAutomatica).toBe(true);
    expect(resultado.declaracionesQueBloquean).toEqual([]);
    expect(resultado.declaracionesIncompatibles).toContain(numero);
  });

  it("acumula todas las declaraciones que bloquean cuando hay varias incompatibles a la vez", () => {
    const resultado = evaluarElegibilidad({
      ...declaracionesCompatibles,
      estadoDeSalud: "NO", // #1
      condicionPep: "SI", // #8
    });

    expect(resultado.elegibleParaEmisionAutomatica).toBe(false);
    expect(resultado.declaracionesQueBloquean).toEqual([1, 8]);
  });
});
