/**
 * Límite de tasa (L6).
 *
 * Lo que se prueba acá no es "cuenta hasta N": es que la ventana **deslice**,
 * que un rechazo no consuma cupo y que el tiempo de reintento sea el real. Los
 * tres son los lugares donde un limitador mal hecho falla — dejando pasar el
 * doble en el borde, encerrando a quien insiste, o mintiendo sobre la espera.
 */
import { describe, expect, it } from "vitest";
import {
  LIMITE_OTP_ENVIO,
  LIMITE_OTP_VERIFICACION,
  evaluarLimite,
  type PoliticaLimite,
  type RegistroLimite,
} from "../rate-limit";
import { VIGENCIA_OTP_MS } from "../reglas-otp";

const T0 = Date.UTC(2026, 7, 20, 12, 0, 0);
const POLITICA: PoliticaLimite = { nombre: "prueba", maximo: 3, ventanaSegundos: 60 };

/** Consume `cantidad` eventos seguidos y devuelve el registro resultante. */
function consumir(cantidad: number, ahoraMs = T0): RegistroLimite {
  let registro: RegistroLimite = [];
  for (let i = 0; i < cantidad; i += 1) {
    registro = evaluarLimite(registro, POLITICA, ahoraMs).registro;
  }
  return registro;
}

describe("evaluarLimite", () => {
  it("admite hasta el máximo y rechaza el siguiente", () => {
    const registro = consumir(3);
    expect(registro).toHaveLength(3);

    const excedido = evaluarLimite(registro, POLITICA, T0);
    expect(excedido.permitido).toBe(false);
  });

  it("no muta el registro que recibe", () => {
    const original: RegistroLimite = [T0];
    evaluarLimite(original, POLITICA, T0);
    expect(original).toEqual([T0]);
  });

  it("un rechazo no consume cupo: insistir no extiende el bloqueo", () => {
    const lleno = consumir(3);

    // Diez pedidos rechazados seguidos, todos dentro de la ventana.
    let registro = lleno;
    for (let i = 0; i < 10; i += 1) {
      const resultado = evaluarLimite(registro, POLITICA, T0 + 1_000);
      expect(resultado.permitido).toBe(false);
      registro = resultado.registro;
    }

    // Apenas la ventana deja salir al más viejo, vuelve a haber cupo — si los
    // rechazos hubieran contado, la espera se habría corrido diez veces.
    const despues = evaluarLimite(registro, POLITICA, T0 + 60_001);
    expect(despues.permitido).toBe(true);
  });

  it("la ventana desliza: no hay un corte que regale el doble de cupo", () => {
    // Tres eventos repartidos a lo largo de la ventana.
    let registro: RegistroLimite = [];
    for (const desplazamiento of [0, 20_000, 40_000]) {
      registro = evaluarLimite(registro, POLITICA, T0 + desplazamiento).registro;
    }

    // A los 50 s los tres siguen vigentes: rechazado.
    expect(evaluarLimite(registro, POLITICA, T0 + 50_000).permitido).toBe(false);

    // A los 61 s salió el primero, así que entra uno: **uno**, no tres.
    const conCupo = evaluarLimite(registro, POLITICA, T0 + 61_000);
    expect(conCupo.permitido).toBe(true);
    expect(evaluarLimite(conCupo.registro, POLITICA, T0 + 61_000).permitido).toBe(false);
  });

  it("informa cuántos segundos falta esperar, y nunca cero", () => {
    const registro = consumir(3);

    const alInstante = evaluarLimite(registro, POLITICA, T0);
    expect(alInstante.reintentarEnSegundos).toBe(60);

    // A 59,5 s del primer evento falta medio segundo: se informa 1, no 0.
    const casiLibre = evaluarLimite(registro, POLITICA, T0 + 59_500);
    expect(casiLibre.reintentarEnSegundos).toBe(1);
  });

  it("las marcas que salieron de la ventana se descartan del registro", () => {
    const registro = consumir(3);
    // Muy después: el registro no crece para siempre.
    const resultado = evaluarLimite(registro, POLITICA, T0 + 10 * 60_000);
    expect(resultado.permitido).toBe(true);
    expect(resultado.registro).toEqual([T0 + 10 * 60_000]);
  });
});

describe("las políticas del OTP", () => {
  it("dejan pasar varias personas detrás de la misma IP", () => {
    // Una oficina o una red móvil con NAT comparten dirección: si el cupo
    // estuviera calibrado para una sola persona, la segunda quedaría afuera.
    // Diez pedidos de código seguidos desde la misma IP tienen que entrar.
    let envios: RegistroLimite = [];
    for (let i = 0; i < 10; i += 1) {
      const resultado = evaluarLimite(envios, LIMITE_OTP_ENVIO, T0 + i * 30_000);
      expect(resultado.permitido, `envío ${i + 1} rechazado`).toBe(true);
      envios = resultado.registro;
    }

    let verificaciones: RegistroLimite = [];
    for (let i = 0; i < 4; i += 1) {
      const resultado = evaluarLimite(verificaciones, LIMITE_OTP_VERIFICACION, T0 + i * 20_000);
      expect(resultado.permitido, `intento ${i + 1} rechazado`).toBe(true);
      verificaciones = resultado.registro;
    }
  });

  it("la verificación admite más eventos que el envío: es la que tipea la persona", () => {
    expect(LIMITE_OTP_VERIFICACION.maximo).toBeGreaterThan(LIMITE_OTP_ENVIO.maximo);
  });

  it("dentro de la vida de un código, los intentos posibles son una fracción del espacio", () => {
    // La pregunta correcta no es cuánto tarda en agotarse el espacio de seis
    // dígitos —el código vence a los cinco minutos, así que nadie lo recorre
    // entero—, sino **cuántos intentos entran mientras ese código vive**.
    const intentosEnLaVidaDelCodigo =
      (LIMITE_OTP_VERIFICACION.maximo * (VIGENCIA_OTP_MS / 1000)) /
      LIMITE_OTP_VERIFICACION.ventanaSegundos;

    // Con los números de hoy son treinta intentos mientras el código vive:
    // una chance entre treinta y tres mil, y **eso ignorando** que el propio
    // OTP corta a los tres intentos. El límite de tasa es el techo de arriba,
    // no el control principal.
    expect(intentosEnLaVidaDelCodigo).toBe(30);
    expect(1_000_000 / intentosEnLaVidaDelCodigo).toBeGreaterThan(30_000);
  });
});
