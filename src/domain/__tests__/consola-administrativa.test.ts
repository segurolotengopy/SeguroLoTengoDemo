/**
 * Enmascarado y filtro del listado de búsqueda de la consola administrativa
 * (`docs/CONSOLA_ADMINISTRATIVA.md` §3: *"titular (enmascarado salvo que se
 * abra el detalle)"*).
 *
 * Era el pendiente anotado en la auditoría de reglas inviolables del
 * 2026-08-10: `armarResultados` y `filtrarPorNombre` solo quedaban cubiertos
 * de forma indirecta por la suite de bloqueo. Lo que importa acá es que el
 * listado nunca exponga nombre ni cédula completos — el dato completo solo
 * vive en la vista de detalle.
 */
import { describe, expect, it } from "vitest";
import { armarResultados, filtrarPorNombre } from "../consola-administrativa";
import type { Expediente } from "../tipos";
import { crearExpediente, expedienteEnDeclaracionesOk, identidadFixture } from "./fixtures";

/** Expediente con identidad completa (la de Mónica, `identidadFixture`). */
function expedienteConIdentidad(id: string): Expediente {
  return expedienteEnDeclaracionesOk(id);
}

describe("armarResultados", () => {
  it("enmascara nombre y documento: inicial + bullets, nunca el valor completo", () => {
    const [fila] = armarResultados([expedienteConIdentidad("EXP-A")]);

    // "Mónica Mariana Gorena Tapia" → primera palabra de nombre y apellido.
    expect(fila.titularEnmascarado).toBe("M••••• G•••••");
    // "9.323.336" → dos primeros caracteres y bullets.
    expect(fila.documentoEnmascarado).toBe("9.•••••••");

    // Ni el nombre ni la cédula completos pueden aparecer en ningún campo de
    // la fila serializada.
    const serializada = JSON.stringify(fila);
    expect(serializada).not.toContain(identidadFixture.nombres);
    expect(serializada).not.toContain(identidadFixture.apellidos);
    expect(serializada).not.toContain(identidadFixture.numeroCedula);
  });

  it("sin identidad todavía (antes de P5) no hay nada que enmascarar", () => {
    const [fila] = armarResultados([crearExpediente("EXP-SIN-ID")]);
    expect(fila.titularEnmascarado).toBeNull();
    expect(fila.documentoEnmascarado).toBeNull();
  });

  it("copia los campos operativos que el listado sí muestra", () => {
    const expediente = expedienteConIdentidad("EXP-B");
    const [fila] = armarResultados([expediente]);

    expect(fila.id).toBe("EXP-B");
    expect(fila.estado).toBe(expediente.estado);
    expect(fila.actualizadoEn).toBe(expediente.actualizadoEn);
    expect(fila.bloqueaRegistro).toBe(false);
  });
});

describe("filtrarPorNombre", () => {
  const conIdentidad = expedienteConIdentidad("EXP-FILTRO");
  const sinIdentidad = crearExpediente("EXP-FILTRO-SIN-ID");

  it("busca por fragmento sobre nombre y apellido, sin distinguir mayúsculas", () => {
    expect(filtrarPorNombre([conIdentidad], "gorena")).toHaveLength(1);
    expect(filtrarPorNombre([conIdentidad], "MÓNICA")).toHaveLength(1);
    // Fragmento que cruza nombre y apellido: "…Mariana Gorena…".
    expect(filtrarPorNombre([conIdentidad], "mariana gorena")).toHaveLength(1);
    expect(filtrarPorNombre([conIdentidad], "lopez")).toHaveLength(0);
  });

  it("fragmento vacío o de espacios devuelve todo sin filtrar", () => {
    expect(filtrarPorNombre([conIdentidad, sinIdentidad], "")).toHaveLength(2);
    expect(filtrarPorNombre([conIdentidad, sinIdentidad], "   ")).toHaveLength(2);
  });

  it("un expediente sin identidad nunca coincide con un fragmento", () => {
    expect(filtrarPorNombre([sinIdentidad], "gorena")).toHaveLength(0);
  });
});
