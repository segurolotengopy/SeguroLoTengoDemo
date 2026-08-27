/**
 * Configuración de campos por producto (CHG-18).
 *
 * El test que más importa es el último: que los campos impuestos por norma
 * **no** estén acá. Es la clase de invariante que se pierde en silencio — nadie
 * nota que alguien agregó una clave hasta que un expediente sale sin origen de
 * fondos.
 */
import { describe, expect, it } from "vitest";
import {
  configuracionDe,
  esRequerido,
  esVisible,
  type CampoConfigurable,
} from "../configuracion-producto";
import { ORDEN_PLANES } from "../catalogo";

describe("configuración por producto", () => {
  it("los tres planes del oncológico piden lo mismo", () => {
    // Cambia cuánto paga cada plan, no qué datos pide.
    const [primero, ...resto] = ORDEN_PLANES.map((plan) => configuracionDe(plan));
    for (const otra of resto) expect(otra).toEqual(primero);
  });

  it("el parentesco del beneficiario se exige y su cédula no", () => {
    expect(esRequerido("CONFIO", "beneficiarioParentesco")).toBe(true);
    expect(esRequerido("CONFIO", "beneficiarioCedula")).toBe(false);
    // Opcional no es lo mismo que oculto: se muestra igual.
    expect(esVisible("CONFIO", "beneficiarioCedula")).toBe(true);
  });

  it("no gobierna ningún campo impuesto por norma", () => {
    // La Matriz V4 los marca como bloque OBLIGATORIO: "los campos impuestos
    // por norma se incorporan directamente y no se someten a decisión
    // comercial". Tenerlos acá permitiría apagarlos con un cambio de una línea
    // y sin discusión, aunque hoy dijeran REQUERIDO.
    const impuestosPorNorma = [
      "domicilio",
      "ciudad",
      "situacionLaboral",
      "actividad",
      "profesion",
      "ingresoMensualDeclaradoGs",
      "origenIngresos",
      "condicionPep",
      "paisNacimiento",
      "estadoCivil",
      "nacionalidad",
      "paisResidencia",
    ];

    const configurables = Object.keys(configuracionDe("CONFIO")) as CampoConfigurable[];
    for (const campo of impuestosPorNorma) {
      expect(
        configurables as string[],
        `${campo} lo exige la norma: no puede depender de la configuración del producto`,
      ).not.toContain(campo);
    }
  });
});
