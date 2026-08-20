/**
 * Acelerador del plazo de firma (CLAUDE.md → "Panel de demo": *"acelerar el
 * plazo de firma de 24 h a segundos"*).
 *
 * Los tres candados que se verifican son los que evitan que esto sea una puerta
 * trasera: solo con `DEMO_MODE`, solo hacia abajo, y con un piso razonable.
 * Acortar el plazo es una ayuda de demostración; alargarlo sería cambiarle a la
 * persona una condición ya informada (fila 30 de la matriz de cumplimiento).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PLAZO_PAGO_MS } from "../../../domain/firma-p8";
import {
  PLAZOS_PAGO_DEMO,
  PLAZO_PAGO_DEMO_MINIMO_MS,
  fijarPlazoPagoDemo,
  plazoPagoMs,
  reiniciarPlazoPagoDemo,
} from "../plazo-pago-demo";

const MODO_ORIGINAL = process.env.DEMO_MODE;

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  reiniciarPlazoPagoDemo();
});

afterEach(() => {
  reiniciarPlazoPagoDemo();
  if (MODO_ORIGINAL === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = MODO_ORIGINAL;
});

describe("plazo de firma configurable", () => {
  it("arranca en las 24 horas del producto", () => {
    expect(plazoPagoMs()).toBe(PLAZO_PAGO_MS);
    expect(PLAZO_PAGO_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("se puede comprimir a segundos para la demostración", () => {
    const resultado = fijarPlazoPagoDemo(30_000);

    expect(resultado.ok).toBe(true);
    expect(plazoPagoMs()).toBe(30_000);
  });

  it("todas las opciones del panel son aceptables", () => {
    for (const opcion of PLAZOS_PAGO_DEMO) {
      expect(fijarPlazoPagoDemo(opcion.ms).ok, opcion.rotulo).toBe(true);
    }
  });

  it("no se puede alargar más allá de las 24 horas", () => {
    const resultado = fijarPlazoPagoDemo(PLAZO_PAGO_MS + 1);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("PLAZO_INVALIDO");
    expect(plazoPagoMs()).toBe(PLAZO_PAGO_MS);
  });

  it("no se puede bajar por debajo del piso", () => {
    expect(fijarPlazoPagoDemo(PLAZO_PAGO_DEMO_MINIMO_MS - 1).ok).toBe(false);
    expect(fijarPlazoPagoDemo(0).ok).toBe(false);
    expect(fijarPlazoPagoDemo(Number.NaN).ok).toBe(false);
  });

  it("con DEMO_MODE apagado rigen las 24 horas aunque quede otra cosa elegida", () => {
    fijarPlazoPagoDemo(30_000);

    process.env.DEMO_MODE = "false";

    expect(plazoPagoMs()).toBe(PLAZO_PAGO_MS);
    expect(fijarPlazoPagoDemo(30_000).ok).toBe(false);
  });
});
