/**
 * La regla que decide si lo que leyó el OCR puede ser un nombre.
 *
 * Los casos que importan son los reales: la prueba con la cédula de Rodrigo
 * (fixtures D-21) devolvió «BLI» como nombres y «FECHA DE VENCIMIENTO» como
 * apellidos, y los dos llegaron hasta el cotejo (01-sep-2026).
 */
import { describe, expect, it } from "vitest";
import { nombreLeidoOVacio, pareceNombreDePersona } from "../nombre-plausible";

describe("¿puede ser un nombre de persona?", () => {
  it("acepta nombres y apellidos reales, con tildes, ñ y partículas", () => {
    for (const nombre of [
      "Rodrigo",
      "Mónica Mariana",
      "Fernandez Echazu",
      "Gorena Tapia",
      "José de la Cruz",
      "Núñez",
      "O'Higgins",
    ]) {
      expect(pareceNombreDePersona(nombre), nombre).toBe(true);
    }
  });

  it("rechaza lo que el OCR sacó del propio documento", () => {
    for (const basura of [
      "BLI",
      "FECHA DE VENCIMIENTO",
      "NACIONALIDAD",
      "PARAGUAYA",
      "REPUBLICA DEL PARAGUAY",
      "CEDULA DE IDENTIDAD",
    ]) {
      expect(pareceNombreDePersona(basura), basura).toBe(false);
    }
  });

  it("rechaza números, símbolos, vacío y fragmentos demasiado cortos", () => {
    for (const invalido of [
      "",
      "  ",
      "A",
      "Ana1",
      "9323336",
      "17/04/1990",
      "--",
      null,
      undefined,
    ]) {
      expect(pareceNombreDePersona(invalido), String(invalido)).toBe(false);
    }
  });

  it("rechaza una línea entera del documento aunque sean todas letras", () => {
    expect(pareceNombreDePersona("Juan Carlos Pedro Maria Jose Antonio")).toBe(false);
  });

  it("normaliza los espacios del valor que acepta y vacía el que no", () => {
    expect(nombreLeidoOVacio("  Rodrigo   Andrés ")).toBe("Rodrigo Andrés");
    expect(nombreLeidoOVacio("FECHA DE VENCIMIENTO")).toBeNull();
  });
});
