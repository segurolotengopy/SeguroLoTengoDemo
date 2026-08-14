/**
 * Mock de `RegistroCivilProvider` (ítem 33) — el camino que le da salida a la
 * cédula del formato anterior, que no tiene MRZ.
 *
 * Corre la suite de contrato compartida y agrega lo propio del mock: que
 * responda con las personas de prueba (para que el demo sea coherente
 * consigo mismo) y que la palanca de caída del panel produzca `NO_DISPONIBLE`
 * y no `NO_ENCONTRADO`, que es la distinción que más importa de este puerto.
 */
import { describe, expect, it } from "vitest";
import { runRegistroCivilContractTests } from "../../../ports/__tests__/registro-civil.contract";
import { PERSONAS_DEMO } from "../personas";
import { crearRegistroCivilMock } from "../registro-civil";

/** Mónica Gorena Tapia, la persona del camino feliz. */
const CEDULA_EXISTENTE = "9323336";
const CEDULA_INEXISTENTE = "1111111";

runRegistroCivilContractTests(() => crearRegistroCivilMock(), {
  cedulaExistente: CEDULA_EXISTENTE,
  cedulaInexistente: CEDULA_INEXISTENTE,
});

describe("mock del registro civil", () => {
  it("responde con los datos de la persona de prueba, no con datos inventados", async () => {
    // Si el registro devolviera otro nombre que el de la cédula simulada,
    // el demo se contradiría en pantalla.
    const persona = PERSONAS_DEMO.find(
      (candidata) => candidata.identidad.numeroCedula === CEDULA_EXISTENTE,
    );
    expect(persona).toBeDefined();
    if (!persona) return;

    const resultado = await crearRegistroCivilMock().consultarPorCedula(CEDULA_EXISTENTE);
    expect(resultado.estado).toBe("ENCONTRADO");
    if (resultado.estado !== "ENCONTRADO") return;

    expect(resultado.datos.nombres).toBe(persona.identidad.nombres);
    expect(resultado.datos.apellidos).toBe(persona.identidad.apellidos);
    expect(resultado.datos.fechaNacimiento).toBe(persona.identidad.fechaNacimiento);
  });

  it("encuentra a todas las personas de prueba, no solo a la del camino feliz", async () => {
    const proveedor = crearRegistroCivilMock();
    for (const persona of PERSONAS_DEMO) {
      const resultado = await proveedor.consultarPorCedula(persona.identidad.numeroCedula);
      expect(resultado.estado).toBe("ENCONTRADO");
    }
  });

  it("la palanca de caída da NO_DISPONIBLE, nunca NO_ENCONTRADO", async () => {
    // La distinción central del puerto: una caída del registro no dice nada
    // sobre la persona. Confundirlas rechazaría a alguien legítimo por una
    // falla de infraestructura ajena.
    const caido = crearRegistroCivilMock({ caido: () => true });
    const resultado = await caido.consultarPorCedula(CEDULA_EXISTENTE);

    expect(resultado.estado).toBe("NO_DISPONIBLE");
    expect(resultado.estado).not.toBe("NO_ENCONTRADO");
  });

  it("cada consulta tiene su propia referencia", async () => {
    // Dos consultas por la misma cédula son dos hechos distintos, y la
    // evidencia es append-only: compartir referencia las haría indistinguibles.
    const proveedor = crearRegistroCivilMock();
    const primera = await proveedor.consultarPorCedula(CEDULA_EXISTENTE);
    const segunda = await proveedor.consultarPorCedula(CEDULA_EXISTENTE);

    if (primera.estado !== "ENCONTRADO" || segunda.estado !== "ENCONTRADO") {
      throw new Error("las dos consultas tenían que encontrar la cédula");
    }
    expect(primera.referenciaConsulta).not.toBe(segunda.referenciaConsulta);
  });
});
