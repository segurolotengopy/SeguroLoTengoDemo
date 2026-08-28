/**
 * Tests de lo que la pantalla le dice a la persona sobre su devolución
 * (respuestas B2 y B3 de Bancard, `docs/Integraciones/Bancard - Respuestas B1
 * a B13.md`).
 *
 * Lo que se cuida acá es una sola cosa, y es normativa antes que técnica: **no
 * prometer un plazo que nadie se comprometió a cumplir.** Bancard fijó un SLA
 * solo para crédito; para débito dijo explícitamente que no lo hay, y para el
 * QR no lo dijo. La fila 65 de la matriz obliga a explicar la metodología de
 * devolución, y explicarla mal —con un número inventado— es peor que no tener
 * el bloque.
 */
import { describe, expect, it } from "vitest";
import {
  MEDIOS_CON_DEVOLUCION_PARCIAL,
  MESES_MAXIMO_PARA_PEDIR_DEVOLUCION,
  devolucionPorMedio,
} from "../textos-devolucion";
import { MEDIOS_DE_PAGO } from "../tipos";

describe("devolucionPorMedio", () => {
  it("cubre los tres medios y el caso sin medio conocido", () => {
    for (const medio of MEDIOS_DE_PAGO) {
      const proyeccion = devolucionPorMedio(medio);
      expect(proyeccion.destino.length).toBeGreaterThan(0);
      expect(proyeccion.plazo.length).toBeGreaterThan(0);
    }

    const sinMedio = devolucionPorMedio(null);
    expect(sinMedio.destino.length).toBeGreaterThan(0);
    expect(sinMedio.plazoLoFijaElBanco).toBe(true);
  });

  it("solo el crédito lleva un plazo comprometido por Bancard", () => {
    expect(devolucionPorMedio("TARJETA_CREDITO").plazoLoFijaElBanco).toBe(false);
    expect(devolucionPorMedio("TARJETA_DEBITO").plazoLoFijaElBanco).toBe(true);
    expect(devolucionPorMedio("QR_BANCARD").plazoLoFijaElBanco).toBe(true);
  });

  it("el plazo de crédito es el que respondió Bancard: 48 a 72 horas", () => {
    const credito = devolucionPorMedio("TARJETA_CREDITO");
    expect(credito.plazo).toContain("48");
    expect(credito.plazo).toContain("72");
  });

  /**
   * El test que le pone precio a un retoque de redacción. Bancard no fijó SLA
   * para débito ni respondió por el QR A2A, así que ninguno de los dos puede
   * llevar un número de horas o de días: si alguien "mejora" ese texto
   * poniendo un plazo concreto, la suite se pone en rojo a propósito.
   */
  it("los medios sin SLA no nombran ninguna cantidad de tiempo", () => {
    for (const medio of ["TARJETA_DEBITO", "QR_BANCARD"] as const) {
      expect(devolucionPorMedio(medio).plazo).not.toMatch(/\d/);
    }
    expect(devolucionPorMedio(null).plazo).not.toMatch(/\d/);
  });

  it("el destino nunca ofrece efectivo, terceros ni otra cuenta", () => {
    for (const medio of [...MEDIOS_DE_PAGO, null]) {
      const { destino } = devolucionPorMedio(medio);
      expect(destino.toLowerCase()).not.toContain("efectivo");
      expect(destino.toLowerCase()).not.toContain("terceros");
    }
  });

  it("el QR vuelve a la cuenta y las tarjetas al plástico (B3)", () => {
    expect(devolucionPorMedio("QR_BANCARD").destino.toLowerCase()).toContain("cuenta");
    expect(devolucionPorMedio("TARJETA_CREDITO").destino.toLowerCase()).toContain("tarjeta");
    expect(devolucionPorMedio("TARJETA_DEBITO").destino.toLowerCase()).toContain("tarjeta");
  });
});

describe("condiciones que Bancard puso al trámite", () => {
  it("el plazo máximo para pedir una devolución es de un año (B2c)", () => {
    expect(MESES_MAXIMO_PARA_PEDIR_DEVOLUCION).toBe(12);
  });

  /**
   * B2(d): la parcial existe solo con crédito. CONFÍO hoy devuelve siempre el
   * total, así que esto no cambia ningún camino — está para que quien alguna
   * vez diseñe una devolución parcial se encuentre con el límite escrito y no
   * lo descubra contra el proveedor.
   */
  it("la devolución parcial es exclusiva de la tarjeta de crédito (B2d)", () => {
    expect(MEDIOS_CON_DEVOLUCION_PARCIAL).toEqual(["TARJETA_CREDITO"]);
  });
});
