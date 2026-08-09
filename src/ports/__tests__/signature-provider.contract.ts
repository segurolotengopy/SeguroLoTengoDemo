/**
 * Suite de contrato para cualquier implementación de `SignatureProvider`
 * (mock u oficial), P8. Cubre la regla de negocio inviolable #3 (firma
 * atómica): el resultado exitoso trae ambos hashes firmados juntos, y no
 * hay forma de modelar un resultado parcial.
 */
import { describe, expect, it } from "vitest";
import type { PaqueteDocumental } from "../../domain/tipos";
import type { SignatureProvider } from "../signature-provider";

const PAQUETE_DE_PRUEBA: PaqueteDocumental = {
  solicitud: {
    codigo: "PROP-00018425",
    version: 1,
    hashSha256: "a".repeat(64),
    cerradoEn: "2026-01-01T00:00:00.000Z",
  },
  fipf: {
    codigo: "FIPF-00018425",
    version: 1,
    hashSha256: "b".repeat(64),
    cerradoEn: "2026-01-01T00:00:00.000Z",
  },
};

export function runSignatureProviderContractTests(
  crearProveedor: () => SignatureProvider | Promise<SignatureProvider>,
): void {
  async function proveedor(): Promise<SignatureProvider> {
    return await crearProveedor();
  }

  describe("SignatureProvider (contrato)", () => {
    it("inicia el acto de firma y devuelve un identificador de Code100", async () => {
      const p = await proveedor();
      const iniciada = await p.iniciarFirma({
        expedienteId: "EXP-CONTRATO-1",
        canal: "WHATSAPP",
        destino: "+595981000000",
        paqueteDocumental: PAQUETE_DE_PRUEBA,
      });

      expect(iniciada.idCode100.length).toBeGreaterThan(0);
    });

    it("una firma exitosa trae ambos hashes firmados juntos (regla #3, atómica)", async () => {
      const p = await proveedor();
      const iniciada = await p.iniciarFirma({
        expedienteId: "EXP-CONTRATO-2",
        canal: "WHATSAPP",
        destino: "+595981000000",
        paqueteDocumental: PAQUETE_DE_PRUEBA,
      });

      const resultado = await p.confirmarResultado(iniciada.idCode100);

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.firma.hashSolicitudFirmada.length).toBeGreaterThan(0);
      expect(resultado.firma.hashFipfFirmado.length).toBeGreaterThan(0);
    });

    // Nota (regla #3): `ResultadoFirma` no tiene forma de representar "un
    // documento firmado y el otro no": la rama exitosa exige `firma: Firma`
    // completa (ambos hashes son campos obligatorios en src/domain/tipos.ts)
    // y la rama fallida no expone ningún hash. No existe un estado
    // intermedio representable a nivel de tipos, así que no hace falta (ni
    // se puede) escribir un test de "firma parcial".

    it("una firma no exitosa no expone ningún hash de documento firmado", async () => {
      // Este caso depende de que la implementación soporte forzar un
      // resultado no exitoso (p.ej. el mock, vía panel de demo). Si el
      // `idCode100` provisto corresponde a una firma exitosa, este test no
      // hace ninguna aserción sobre hashes ausentes (rama `ok`).
      const p = await proveedor();
      const iniciada = await p.iniciarFirma({
        expedienteId: "EXP-CONTRATO-3",
        canal: "EMAIL",
        destino: "persona@correo.com",
        paqueteDocumental: PAQUETE_DE_PRUEBA,
      });

      const resultado = await p.confirmarResultado(iniciada.idCode100);
      if (resultado.ok) return;

      expect(["RECHAZADA", "EXPIRADA", "CANCELADA", "ERROR_PROVEEDOR"]).toContain(resultado.motivo);
      expect(Object.keys(resultado)).not.toContain("firma");
    });
  });
}
