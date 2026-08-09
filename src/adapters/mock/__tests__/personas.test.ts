/**
 * Los fixtures del demo tienen un riesgo propio: si alguien cambia una regla
 * de negocio, los datos siguen ahí, la demostración sigue corriendo, y lo que
 * se le muestra a la gerencia deja de coincidir con lo que el sistema hace.
 *
 * Estos tests atan cada persona al motor real. El `desenlace` documentado en
 * `personas.ts` no se cree por escrito: se recalcula con
 * `evaluarElegibilidad` y `edadEnRangoPermitido`.
 */
import { describe, expect, it } from "vitest";
import { evaluarElegibilidad } from "../../../domain/elegibilidad";
import { PLANES } from "../../../domain/planes";
import { normalizarCelularParaguayo } from "../../../domain/telefono";
import { edadEnRangoPermitido } from "../../../domain/tipos";
import { obtenerPersonaDemo, PERSONAS_DEMO, personaPorCelular } from "../personas";

/** Fecha de referencia fija: la edad de un fixture no puede depender de cuándo corran los tests. */
const HOY = new Date("2026-08-08T12:00:00.000Z");

describe("personas de demo · consistencia del catálogo", () => {
  it("los identificadores, cédulas, celulares y correos son únicos", () => {
    const campos = ["id", "celular", "correo"] as const;
    for (const campo of campos) {
      const valores = PERSONAS_DEMO.map((persona) => persona[campo]);
      expect(new Set(valores).size, `hay ${campo} repetidos`).toBe(valores.length);
    }
    const cedulas = PERSONAS_DEMO.map((p) => p.identidad.numeroCedula);
    expect(new Set(cedulas).size).toBe(cedulas.length);
  });

  it("todos los celulares son celulares paraguayos válidos para P1", () => {
    for (const persona of PERSONAS_DEMO) {
      const normalizado = normalizarCelularParaguayo(persona.celular);
      expect(normalizado.ok, `${persona.rotulo}: celular inválido`).toBe(true);
      if (normalizado.ok) expect(normalizado.e164).toBe(persona.celular);
    }
  });

  it("todas usan el dominio reservado example.com, para no escribirle a nadie real", () => {
    for (const persona of PERSONAS_DEMO) {
      expect(persona.correo.endsWith("@example.com"), `${persona.rotulo}: correo no reservado`).toBe(true);
    }
  });

  it("todas están dentro del rango de edad de 18 a 64 (regla #8)", () => {
    // Incluidas las que se bloquean después: ninguna debe frenarse por edad,
    // porque entonces el recorrido demostraría otra cosa de la que dice.
    for (const persona of PERSONAS_DEMO) {
      expect(
        edadEnRangoPermitido(persona.identidad.fechaNacimiento, HOY),
        `${persona.rotulo}: fuera del rango 18-64`,
      ).toBe(true);
    }
  });

  it("cada plan elegido existe en el catálogo de productos", () => {
    for (const persona of PERSONAS_DEMO) {
      expect(PLANES[persona.planElegido]).toBeDefined();
    }
  });

  it("un beneficiario designado tiene nombre; los herederos legales no", () => {
    for (const { rotulo, datosComplementarios } of PERSONAS_DEMO) {
      const { beneficiario } = datosComplementarios;
      if (beneficiario.tipo === "PERSONA_DESIGNADA") {
        expect(beneficiario.nombreCompleto, `${rotulo}: designado sin nombre`).toBeTruthy();
      } else {
        expect(beneficiario.nombreCompleto, `${rotulo}: heredero legal con nombre`).toBeNull();
      }
    }
  });

  it("el catálogo cubre los cinco recorridos definidos en CLAUDE.md", () => {
    expect(PERSONAS_DEMO.map((p) => p.id).sort()).toEqual(
      ["biometria-rechazada", "camino-feliz", "no-firma", "pep-positivo", "salud-incompatible"].sort(),
    );
  });
});

describe("personas de demo · el desenlace documentado es el que produce el motor real", () => {
  it("camino feliz: elegible para emisión automática", () => {
    const persona = obtenerPersonaDemo("camino-feliz")!;
    const resultado = evaluarElegibilidad(persona.declaraciones);

    expect(resultado.elegibleParaEmisionAutomatica).toBe(true);
    expect(resultado.declaracionesQueBloquean).toEqual([]);
    expect(persona.desenlace.pantallaFinal).toBe("P9");
  });

  it("PEP positivo: bloquea, y bloquea exactamente por la declaración 8", () => {
    const persona = obtenerPersonaDemo("pep-positivo")!;
    const resultado = evaluarElegibilidad(persona.declaraciones);

    expect(resultado.elegibleParaEmisionAutomatica).toBe(false);
    expect(resultado.declaracionesQueBloquean).toEqual([8]);
    expect(persona.desenlace.estadoFinal).toBe("DERIVADO_MANUAL");
  });

  it("salud incompatible: bloquea por las declaraciones 1, 2 y 3", () => {
    const persona = obtenerPersonaDemo("salud-incompatible")!;
    const resultado = evaluarElegibilidad(persona.declaraciones);

    expect(resultado.elegibleParaEmisionAutomatica).toBe(false);
    expect(resultado.declaracionesQueBloquean).toEqual([1, 2, 3]);
    expect(persona.desenlace.estadoFinal).toBe("DERIVADO_MANUAL");
  });

  it("biometría rechazada: la coincidencia facial no aprueba y la prueba de vida sí", () => {
    const persona = obtenerPersonaDemo("biometria-rechazada")!;

    expect(persona.identidad.captura.coincidenciaFacialAprobada).toBe(false);
    expect(persona.identidad.captura.pruebaDeVidaAprobada).toBe(true);
    expect(persona.desenlace.pantallaFinal).toBe("P5");
    // Sus declaraciones son compatibles a propósito: lo que la frena es la
    // biometría, no la elegibilidad. Si esto cambiara, el recorrido estaría
    // demostrando dos bloqueos a la vez y ninguno con claridad.
    expect(evaluarElegibilidad(persona.declaraciones).elegibleParaEmisionAutomatica).toBe(true);
  });

  it("paga y no firma: es elegible y paga por QR; lo que falla es la firma", () => {
    const persona = obtenerPersonaDemo("no-firma")!;

    expect(evaluarElegibilidad(persona.declaraciones).elegibleParaEmisionAutomatica).toBe(true);
    expect(persona.medioDePago).toBe("QR_BANCARD");
    expect(persona.desenlace.pantallaFinal).toBe("Pantalla B");
  });

  it("solo una persona recorre el flujo completo hasta la emisión", () => {
    const lleganAP9 = PERSONAS_DEMO.filter((p) => p.desenlace.pantallaFinal === "P9");
    expect(lleganAP9).toHaveLength(1);
  });
});

describe("personas de demo · búsqueda", () => {
  it("encuentra por celular el que se tipea en P1", () => {
    expect(personaPorCelular("+595981000123")?.id).toBe("camino-feliz");
    expect(personaPorCelular("+595999999999")).toBeNull();
  });

  it("devuelve null para un id inexistente en vez de romper", () => {
    // @ts-expect-error se prueba a propósito un id fuera del tipo
    expect(obtenerPersonaDemo("no-existe")).toBeNull();
  });
});
