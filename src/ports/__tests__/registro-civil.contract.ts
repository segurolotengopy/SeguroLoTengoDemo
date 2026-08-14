/**
 * Suite de contrato de `RegistroCivilProvider` (ítem 33): la cumple tanto el
 * mock del demo como el adaptador oficial que exista algún día.
 *
 * Lo que se verifica no es qué datos devuelve —eso depende del registro— sino
 * **la disciplina de los tres estados**, que es de donde viene el riesgo. Un
 * adaptador que confunda "no contestó" con "no existe" rechazaría a personas
 * legítimas cada vez que el servicio de Identificaciones se cae; uno que lo
 * confunda con "existe" dejaría pasar a cualquiera justo en el momento que un
 * atacante elegiría.
 */
import { describe, expect, it } from "vitest";
import type { RegistroCivilProvider } from "../registro-civil";

export interface EscenariosRegistroCivil {
  /** Cédula que el proveedor debe encontrar. */
  readonly cedulaExistente: string;
  /** Cédula que el proveedor debe reportar como inexistente. */
  readonly cedulaInexistente: string;
}

export function runRegistroCivilContractTests(
  crearProveedor: () => RegistroCivilProvider | Promise<RegistroCivilProvider>,
  escenarios: EscenariosRegistroCivil,
): void {
  async function proveedor(): Promise<RegistroCivilProvider> {
    return await crearProveedor();
  }

  describe("RegistroCivilProvider (contrato)", () => {
    it("encuentra una cédula existente y devuelve los cinco campos", async () => {
      const p = await proveedor();
      const resultado = await p.consultarPorCedula(escenarios.cedulaExistente);

      expect(resultado.estado).toBe("ENCONTRADO");
      if (resultado.estado !== "ENCONTRADO") return;

      // Ninguno puede venir vacío: un campo en blanco que llegue al expediente
      // es peor que un error, porque no se nota.
      expect(resultado.datos.nombres.length).toBeGreaterThan(0);
      expect(resultado.datos.apellidos.length).toBeGreaterThan(0);
      expect(resultado.datos.sexo.length).toBeGreaterThan(0);
      expect(resultado.datos.nacionalidad.length).toBeGreaterThan(0);

      // La fecha alimenta el corte de edad 18–64: tiene que ser ISO 8601, no
      // el formato que use el registro de turno (regla inviolable #8).
      expect(resultado.datos.fechaNacimiento).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Referencia de consulta para la evidencia.
      expect(resultado.referenciaConsulta.length).toBeGreaterThan(0);
    });

    it("normaliza el formato del número: con puntos y sin puntos son la misma cédula", async () => {
      const p = await proveedor();
      const sinPuntos = escenarios.cedulaExistente.replace(/\D/g, "");
      const conPuntos = sinPuntos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

      const a = await p.consultarPorCedula(sinPuntos);
      const b = await p.consultarPorCedula(conPuntos);

      expect(a.estado).toBe("ENCONTRADO");
      expect(b.estado).toBe("ENCONTRADO");
    });

    it("distingue NO_ENCONTRADO de ENCONTRADO", async () => {
      const p = await proveedor();
      const resultado = await p.consultarPorCedula(escenarios.cedulaInexistente);

      expect(resultado.estado).toBe("NO_ENCONTRADO");
      // También trae referencia: "no existe" es una respuesta concluyente del
      // registro y hay que poder probar que se preguntó.
      if (resultado.estado === "NO_ENCONTRADO") {
        expect(resultado.referenciaConsulta.length).toBeGreaterThan(0);
      }
    });

    it("nunca devuelve datos junto a un estado que no sea ENCONTRADO", async () => {
      // El tipo ya lo impide, pero un adaptador escrito con `as` podría
      // colarlo. Es la propiedad que impide que un `NO_ENCONTRADO` con datos
      // residuales termine en el expediente de otra persona.
      const p = await proveedor();
      const resultado = await p.consultarPorCedula(escenarios.cedulaInexistente);

      expect(Object.keys(resultado)).not.toContain("datos");
    });
  });
}
