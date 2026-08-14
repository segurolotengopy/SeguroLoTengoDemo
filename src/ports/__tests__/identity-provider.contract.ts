/**
 * Suite de contrato para cualquier implementación de `IdentityProvider`
 * (mock u oficial), P5. Cubre el camino feliz de captura documental, OCR,
 * selfie con prueba de vida y comparación facial, y la regla de negocio
 * inviolable #8 (la fecha de nacimiento para calcular edad viene del OCR,
 * no de un campo declarado).
 *
 * No cubre exhaustivamente los distintos escenarios de rechazo de la
 * especificación (p.ej. la persona de prueba "Biometría rechazada") porque
 * dependen de comportamiento específico de cada adaptador; esos casos van
 * en los tests propios del adaptador.
 */
import { describe, expect, it } from "vitest";
import type { IdentityProvider } from "../identity-provider";

const IMAGEN_DE_PRUEBA = new Uint8Array([0, 1, 2, 3]);

export function runIdentityProviderContractTests(
  crearProveedor: () => IdentityProvider | Promise<IdentityProvider>,
): void {
  async function proveedor(): Promise<IdentityProvider> {
    return await crearProveedor();
  }

  describe("IdentityProvider (contrato)", () => {
    it("captura el frente de la cédula y aprueba calidad y autenticidad en el camino feliz", async () => {
      const p = await proveedor();
      const resultado = await p.capturarFrenteCedula("EXP-CONTRATO-1", IMAGEN_DE_PRUEBA);

      expect(resultado.calidadAprobada).toBe(true);
      expect(resultado.autenticidadAprobada).toBe(true);
      expect(resultado.imagen.hashSha256.length).toBeGreaterThan(0);
    });

    it("captura el dorso de la cédula y aprueba calidad y autenticidad en el camino feliz", async () => {
      const p = await proveedor();
      const resultado = await p.capturarDorsoCedula("EXP-CONTRATO-1", IMAGEN_DE_PRUEBA);

      expect(resultado.calidadAprobada).toBe(true);
      expect(resultado.autenticidadAprobada).toBe(true);
    });

    it("extrae los datos de la cédula por OCR, con fecha de nacimiento en formato ISO 8601 (regla #8)", async () => {
      const p = await proveedor();
      await p.capturarFrenteCedula("EXP-CONTRATO-1", IMAGEN_DE_PRUEBA);
      await p.capturarDorsoCedula("EXP-CONTRATO-1", IMAGEN_DE_PRUEBA);

      const resultado = await p.extraerDatosCedula("EXP-CONTRATO-1");

      expect(resultado.confiable).toBe(true);
      expect(resultado.datos.fechaNacimiento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(resultado.datos.numeroCedula.length).toBeGreaterThan(0);
    });

    it("aprueba la prueba de vida en la captura de selfie en el camino feliz", async () => {
      const p = await proveedor();
      const resultado = await p.capturarSelfieYPruebaDeVida("EXP-CONTRATO-1", { tipo: "VIDEO", video: IMAGEN_DE_PRUEBA });

      expect(resultado.pruebaDeVidaAprobada).toBe(true);
      expect(resultado.imagen.hashSha256.length).toBeGreaterThan(0);
    });

    it("compara el rostro capturado contra la cédula y aprueba la coincidencia en el camino feliz", async () => {
      const p = await proveedor();
      await p.capturarFrenteCedula("EXP-CONTRATO-1", IMAGEN_DE_PRUEBA);
      await p.capturarSelfieYPruebaDeVida("EXP-CONTRATO-1", { tipo: "VIDEO", video: IMAGEN_DE_PRUEBA });

      const resultado = await p.compararRostro("EXP-CONTRATO-1");

      expect(resultado.coincidenciaFacialAprobada).toBe(true);
    });

    // Nota: no hay un caso de "corregir un dato a mano" en esta suite porque
    // la interfaz no expone ningún método de edición de los campos extraídos
    // — ante una discrepancia, el único camino es repetir la captura
    // (capturarFrenteCedula / capturarDorsoCedula) y volver a llamar a
    // extraerDatosCedula.
  });
}
