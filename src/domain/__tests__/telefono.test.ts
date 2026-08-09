import { describe, expect, it } from "vitest";
import { enmascararCelular, normalizarCelularParaguayo } from "../telefono";

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

describe("enmascararCelular", () => {
  it("deja ver solo los últimos tres dígitos, como pide la especificación de P1", () => {
    expect(enmascararCelular("+595981000123")).toBe("+595 ••• ••• 123");
  });

  it("nunca deja pasar el número completo", () => {
    const enmascarado = enmascararCelular("+595981000123");
    expect(enmascarado).not.toContain("981000123");
  });
});
