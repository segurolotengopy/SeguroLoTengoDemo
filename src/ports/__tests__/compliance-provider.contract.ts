/**
 * Suite de contrato para cualquier implementación de `ComplianceProvider`
 * (mock u oficial). Cubre el flujo principal de consulta de PEP, sanciones,
 * listas de vigilancia y noticias adversas.
 *
 * Esta suite no testea gating de flujo (derivación a Pantalla A): esa
 * decisión se toma en `src/domain/` a partir de la declaración autodeclarada
 * de P6 (regla de negocio inviolable #5), no a partir del resultado de este
 * puerto.
 */
import { describe, expect, it } from "vitest";
import type { ComplianceProvider } from "../compliance-provider";

export function runComplianceProviderContractTests(
  crearProveedor: () => ComplianceProvider | Promise<ComplianceProvider>,
): void {
  async function proveedor(): Promise<ComplianceProvider> {
    return await crearProveedor();
  }

  describe("ComplianceProvider (contrato)", () => {
    it("consulta PEP, sanciones, listas de vigilancia y noticias adversas por identidad", async () => {
      const p = await proveedor();
      const resultado = await p.consultarPepYSanciones({
        expedienteId: "EXP-CONTRATO-1",
        numeroCedula: "9323336",
        nombres: "Mónica Mariana",
        apellidos: "Gorena Tapia",
        fechaNacimiento: "1990-01-01",
      });

      expect(typeof resultado.hayCoincidencias).toBe("boolean");
      expect(Array.isArray(resultado.coincidencias)).toBe(true);
      expect(resultado.consultaId.length).toBeGreaterThan(0);
      expect(resultado.consultadoEn.length).toBeGreaterThan(0);
    });

    it("sin coincidencias, la lista de coincidencias queda vacía", async () => {
      const p = await proveedor();
      const resultado = await p.consultarPepYSanciones({
        expedienteId: "EXP-CONTRATO-2",
        numeroCedula: "1111111",
        nombres: "Persona",
        apellidos: "Sin Coincidencias",
        fechaNacimiento: "1990-01-01",
      });

      if (!resultado.hayCoincidencias) {
        expect(resultado.coincidencias).toHaveLength(0);
      }
    });
  });
}
