/**
 * Suite de contrato para cualquier implementación de `PolicyIssuer` (mock u
 * oficial): emisión de póliza (SEBAOT) posterior a P8, y consulta de
 * estado de póliza y de facturación electrónica.
 */
import { describe, expect, it } from "vitest";
import type { Firma, PaqueteDocumental } from "../../domain/tipos";
import type { PolicyIssuer } from "../policy-issuer";

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

const FIRMA_DE_PRUEBA: Firma = {
  canal: "WHATSAPP",
  idCode100: "C100-CONTRATO-1",
  firmadoEn: "2026-01-01T00:05:00.000Z",
  hashSolicitudFirmada: "c".repeat(64),
  hashFipfFirmado: "d".repeat(64),
};

export function runPolicyIssuerContractTests(
  crearProveedor: () => PolicyIssuer | Promise<PolicyIssuer>,
): void {
  async function proveedor(): Promise<PolicyIssuer> {
    return await crearProveedor();
  }

  describe("PolicyIssuer (contrato)", () => {
    it("emite la póliza con el número de la propuesta (sin Nota de Cobertura)", async () => {
      const p = await proveedor();
      const resultado = await p.emitirPoliza({
        expedienteId: "EXP-CONTRATO-1",
        propuestaId: "PROP-00018425",
        referenciaBancard: "BAN-123",
        paqueteDocumental: PAQUETE_DE_PRUEBA,
        firma: FIRMA_DE_PRUEBA,
      });

      expect(resultado.numeroPoliza).toBe("PROP-00018425");
      expect(["EN_PROCESO_DE_EMISION", "EMITIDA"]).toContain(resultado.estado);
    });

    it("consulta el estado de una póliza ya emitida", async () => {
      const p = await proveedor();
      await p.emitirPoliza({
        expedienteId: "EXP-CONTRATO-2",
        propuestaId: "PROP-00018425",
        referenciaBancard: "BAN-123",
        paqueteDocumental: PAQUETE_DE_PRUEBA,
        firma: FIRMA_DE_PRUEBA,
      });

      const estado = await p.consultarEstadoPoliza("PROP-00018425");

      expect(estado.numeroPoliza).toBe("PROP-00018425");
    });

    it("consulta el estado de la facturación electrónica que emite Alianza", async () => {
      const p = await proveedor();
      await p.emitirPoliza({
        expedienteId: "EXP-CONTRATO-3",
        propuestaId: "PROP-00018425",
        referenciaBancard: "BAN-123",
        paqueteDocumental: PAQUETE_DE_PRUEBA,
        firma: FIRMA_DE_PRUEBA,
      });

      const factura = await p.consultarEstadoFacturaElectronica("PROP-00018425");

      expect(["PENDIENTE", "EMITIDA", "RECHAZADA"]).toContain(factura.estado);
    });

    // Nota (regla #3): `emitirPoliza` exige `firma: Firma` completa — no hay
    // forma de invocar este puerto con documentos parcialmente firmados.
  });
}
