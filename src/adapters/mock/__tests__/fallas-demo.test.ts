/**
 * Las cuatro palancas de "forzar fallos puntuales" del panel de demo.
 *
 * Lo que importa probar acá no es que se prendan y se apaguen, sino las dos
 * propiedades que las hacen seguras: **se consumen en el primer uso** (para que
 * la demostración pueda seguir sin volver al panel) y **no existen fuera de
 * `DEMO_MODE`** (para que en un despliegue normal no haya ninguna vía por la
 * que un adaptador pueda fallar a propósito).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FALLAS_DEMO,
  armarFallaDemo,
  consumirFallaDemo,
  esFallaDemo,
  fallasArmadasDemo,
  reiniciarFallasDemo,
} from "../fallas-demo";

const MODO_ORIGINAL = process.env.DEMO_MODE;

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  reiniciarFallasDemo();
});

afterEach(() => {
  reiniciarFallasDemo();
  if (MODO_ORIGINAL === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = MODO_ORIGINAL;
});

describe("fallas forzadas del panel de demo", () => {
  it("son las de CLAUDE.md y ninguna más", () => {
    // `BANCARD_CAPTURA_FALLIDA` se retiró al desaparecer la preautorización
    // (D-02): sin captura no hay captura que hacer fallar. El timeout la
    // reemplaza como escenario de cobro fallido y ahora cubre a los tres
    // medios.
    // `REGISTRO_CIVIL_CAIDO` la agregó el cruce contra el registro civil: sin
    // ella no se puede mostrar que una caída **deriva** en vez de rechazar.
    expect([...FALLAS_DEMO].sort()).toEqual([
      "BANCARD_TIMEOUT",
      "CODE100_RECHAZO",
      "OTP_EXPIRADO",
      "OTP_INTENTOS_AGOTADOS",
      "REGISTRO_CIVIL_CAIDO",
    ]);
    expect(esFallaDemo("CUALQUIER_OTRA")).toBe(false);
  });

  it("una falla armada se consume en el primer intento y el segundo pasa", () => {
    armarFallaDemo("BANCARD_TIMEOUT", true);

    expect(consumirFallaDemo("BANCARD_TIMEOUT")).toBe(true);
    expect(consumirFallaDemo("BANCARD_TIMEOUT")).toBe(false);
    expect(fallasArmadasDemo()).toEqual([]);
  });

  it("armar una no arma las otras", () => {
    armarFallaDemo("CODE100_RECHAZO", true);

    expect(consumirFallaDemo("OTP_EXPIRADO")).toBe(false);
    expect(consumirFallaDemo("BANCARD_TIMEOUT")).toBe(false);
    expect(consumirFallaDemo("CODE100_RECHAZO")).toBe(true);
  });

  it("desarmarla antes de usarla la deja sin efecto", () => {
    armarFallaDemo("OTP_EXPIRADO", true);
    armarFallaDemo("OTP_EXPIRADO", false);

    expect(consumirFallaDemo("OTP_EXPIRADO")).toBe(false);
  });

  it("`reiniciarFallasDemo` deja el tablero limpio", () => {
    for (const falla of FALLAS_DEMO) armarFallaDemo(falla, true);
    expect(fallasArmadasDemo()).toHaveLength(FALLAS_DEMO.length);

    reiniciarFallasDemo();

    expect(fallasArmadasDemo()).toEqual([]);
  });

  it("sin DEMO_MODE no se puede armar ninguna", () => {
    process.env.DEMO_MODE = "false";

    const resultado = armarFallaDemo("BANCARD_TIMEOUT", true);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("FUERA_DE_MODO_DEMO");
  });

  it("apagar DEMO_MODE desactiva incluso las que ya estaban armadas", () => {
    armarFallaDemo("BANCARD_TIMEOUT", true);

    process.env.DEMO_MODE = "false";

    expect(fallasArmadasDemo()).toEqual([]);
    expect(consumirFallaDemo("BANCARD_TIMEOUT")).toBe(false);
  });
});
