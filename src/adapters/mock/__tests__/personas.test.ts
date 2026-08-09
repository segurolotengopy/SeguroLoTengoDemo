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
import { PLANES } from "../../../domain/catalogo";
import {
  esActividad,
  esCiudad,
  esIngresoMensualValido,
  esParentesco,
  esProfesion,
  esSituacionLaboral,
} from "../../../domain/catalogo-p6";
import { enmascararCorreo, normalizarCorreo } from "../../../domain/correo";
import { normalizarCelularParaguayo } from "../../../domain/telefono";
import { edadEnRangoPermitido } from "../../../domain/tipos";
import {
  obtenerPersonaDemo,
  PERSONAS_DEMO,
  personaPorCelular,
  personaPorCorreo,
} from "../personas";

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

  it("todos los correos son válidos para P4 y ya están normalizados", () => {
    // Gemelo de la prueba de celulares: si alguien agrega una persona con un
    // correo mal escrito, o con mayúsculas o espacios, la demostración se
    // rompería recién en vivo, en P4, al pedir el código.
    for (const persona of PERSONAS_DEMO) {
      const normalizado = normalizarCorreo(persona.correo);
      expect(normalizado.ok, `${persona.rotulo}: correo inválido para P4`).toBe(true);
      // Ya normalizado: el fixture y lo que P4 persiste en el expediente
      // tienen que ser exactamente el mismo string.
      if (normalizado.ok) expect(normalizado.correo).toBe(persona.correo);
    }
  });

  it("cada correo se enmascara distinto, para poder distinguirlos en pantalla", () => {
    // P4 y la evidencia solo muestran la versión enmascarada. Si dos personas
    // compartieran inicial, en una demostración con varias sesiones abiertas
    // no se sabría cuál es cuál.
    const enmascarados = PERSONAS_DEMO.map((persona) => enmascararCorreo(persona.correo));
    expect(new Set(enmascarados).size, `enmascarados repetidos: ${enmascarados.join(", ")}`).toBe(
      enmascarados.length,
    );
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

  it("los datos complementarios de cada persona son valores que P6 acepta", () => {
    // Sin esto, una persona de prueba podría traer una profesión o una ciudad
    // que el selector de P6 no ofrece: la demostración se rompería en vivo, al
    // guardar, con un `DATOS_INCOMPLETOS` que nadie esperaba.
    for (const { rotulo, datosComplementarios: datos } of PERSONAS_DEMO) {
      expect(esCiudad(datos.ciudad), `${rotulo}: ciudad fuera del catálogo`).toBe(true);
      expect(
        esSituacionLaboral(datos.situacionLaboral),
        `${rotulo}: situación laboral fuera del catálogo`,
      ).toBe(true);
      expect(esActividad(datos.actividad), `${rotulo}: actividad fuera del catálogo`).toBe(true);
      expect(esProfesion(datos.profesion), `${rotulo}: profesión fuera del catálogo`).toBe(true);
      expect(datos.domicilio.trim(), `${rotulo}: domicilio vacío`).not.toBe("");
      expect(
        esIngresoMensualValido(datos.ingresoMensualDeclaradoGs),
        `${rotulo}: ingreso mensual inválido`,
      ).toBe(true);
      if (datos.beneficiario.tipo === "PERSONA_DESIGNADA") {
        expect(
          esParentesco(datos.beneficiario.parentesco),
          `${rotulo}: parentesco fuera del catálogo`,
        ).toBe(true);
      }
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

  it("encuentra por correo el que se tipea en P4", () => {
    expect(personaPorCorreo("monica.gorena@example.com")?.id).toBe("camino-feliz");
    expect(personaPorCorreo("ramon.duarte@example.com")?.id).toBe("pep-positivo");
    expect(personaPorCorreo("nadie@example.com")).toBeNull();
  });

  it("encuentra por correo aunque se tipee con mayúsculas o espacios, como lo normaliza P4", () => {
    expect(personaPorCorreo("  Monica.Gorena@Example.COM ")?.id).toBe("camino-feliz");
  });

  it("un correo con formato inválido devuelve null en vez de romper", () => {
    expect(personaPorCorreo("sin-arroba")).toBeNull();
    expect(personaPorCorreo("")).toBeNull();
  });

  it("cada persona es alcanzable por sus dos canales y son la misma persona", () => {
    // Es lo que hace posible seguir un recorrido en el panel: P1 identifica
    // por celular, P4 por correo, y tienen que coincidir.
    for (const persona of PERSONAS_DEMO) {
      expect(personaPorCelular(persona.celular)?.id).toBe(persona.id);
      expect(personaPorCorreo(persona.correo)?.id).toBe(persona.id);
    }
  });

  it("devuelve null para un id inexistente en vez de romper", () => {
    // @ts-expect-error se prueba a propósito un id fuera del tipo
    expect(obtenerPersonaDemo("no-existe")).toBeNull();
  });
});
