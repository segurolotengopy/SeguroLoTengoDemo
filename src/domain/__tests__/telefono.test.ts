import { describe, expect, it } from "vitest";
import {
  enmascararCelular,
  normalizarCelularParaguayo,
  normalizarCelularRegional,
  PAISES_CELULAR,
} from "../telefono";

describe("normalizarCelularParaguayo", () => {
  it("acepta el formato del placeholder de P1 y lo lleva a E.164", () => {
    expect(normalizarCelularParaguayo("981 000 000")).toEqual({ ok: true, e164: "+595981000000" });
  });

  it("tolera el 0 inicial, el prefijo de país y los separadores que la gente escribe", () => {
    for (const entrada of ["0981000000", "+595 981 000 000", "595-981-000-000", "(0981) 000-000"]) {
      expect(normalizarCelularParaguayo(entrada)).toEqual({ ok: true, e164: "+595981000000" });
    }
  });

  it("rechaza lo que no es un celular paraguayo", () => {
    for (const entrada of ["", "12345", "981000", "9810000001", "212000000", "abcdefghi"]) {
      expect(normalizarCelularParaguayo(entrada)).toEqual({ ok: false, motivo: "FORMATO_INVALIDO" });
    }
  });
});

describe("normalizarCelularRegional", () => {
  it("acepta un celular boliviano con su prefijo (pruebas del demo con +591)", () => {
    for (const entrada of ["+591 712 34567", "591 71234567", "+591-612-34567"]) {
      const resultado = normalizarCelularRegional(entrada);
      expect(resultado.ok).toBe(true);
    }
    expect(normalizarCelularRegional("+591 712 34567")).toEqual({
      ok: true,
      e164: "+59171234567",
    });
  });

  it("aplica la regla estricta de Bolivia: 8 dígitos que empiezan con 6 o 7", () => {
    for (const entrada of ["+591 812 34567", "+591 7123 456", "+591 712 345 678"]) {
      expect(normalizarCelularRegional(entrada)).toEqual({ ok: false, motivo: "FORMATO_INVALIDO" });
    }
  });

  it("distingue prefijos largos de cortos: +595 es Paraguay y +51 es Perú", () => {
    expect(normalizarCelularRegional("+595 981 000 000")).toEqual({
      ok: true,
      e164: "+595981000000",
    });
    expect(normalizarCelularRegional("+51 912 345 678")).toEqual({
      ok: true,
      e164: "+51912345678",
    });
  });

  it("sin prefijo de la región asume Paraguay en formato local (comportamiento histórico)", () => {
    expect(normalizarCelularRegional("981 000 000")).toEqual({ ok: true, e164: "+595981000000" });
    expect(normalizarCelularRegional("0981000000")).toEqual({ ok: true, e164: "+595981000000" });
  });

  it("sigue aplicando la regla estricta paraguaya al camino sin prefijo", () => {
    for (const entrada of ["", "12345", "212000000"]) {
      expect(normalizarCelularRegional(entrada)).toEqual({ ok: false, motivo: "FORMATO_INVALIDO" });
    }
  });

  it("cada ejemplo del catálogo es válido para su propio país", () => {
    for (const pais of PAISES_CELULAR) {
      const resultado = normalizarCelularRegional(`${pais.prefijo} ${pais.ejemplo}`);
      expect(resultado.ok, `${pais.nombre}: ${pais.ejemplo}`).toBe(true);
    }
  });
});

describe("enmascararCelular", () => {
  it("deja ver solo los últimos tres dígitos, como pide la especificación de P1", () => {
    expect(enmascararCelular("+595981000123")).toBe("+595 ••• ••• 123");
  });

  it("muestra el prefijo del país del número, no siempre el de Paraguay", () => {
    expect(enmascararCelular("+59171234567")).toBe("+591 ••• ••• 567");
    expect(enmascararCelular("+51912345678")).toBe("+51 ••• ••• 678");
  });

  it("nunca deja pasar el número completo", () => {
    const enmascarado = enmascararCelular("+595981000123");
    expect(enmascarado).not.toContain("981000123");
    expect(enmascararCelular("+59171234567")).not.toContain("71234567");
  });
});
