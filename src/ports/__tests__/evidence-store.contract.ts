/**
 * Suite de contrato para cualquier implementación de `EvidenceStore` (mock
 * u oficial). Cubre la regla de negocio inviolable #10 (append-only):
 * guardar dos registros del mismo expediente deja ambos recuperables, en
 * el orden en que se guardaron.
 */
import { describe, expect, it } from "vitest";
import type { RegistroEvidencia } from "../../domain/tipos";
import type { EvidenceStore } from "../evidence-store";

function registro(overrides: Partial<RegistroEvidencia> = {}): RegistroEvidencia {
  return {
    id: overrides.id ?? `EVID-${Math.random().toString(36).slice(2)}`,
    expedienteId: overrides.expedienteId ?? "EXP-CONTRATO-1",
    paso: overrides.paso ?? "P1_OTP_WHATSAPP",
    fecha: overrides.fecha ?? "2026-01-01T00:00:00.000Z",
    ip: overrides.ip ?? "127.0.0.1",
    dispositivo: overrides.dispositivo ?? "vitest",
    sesionId: overrides.sesionId ?? "SES-1",
    versionTextoAceptado: overrides.versionTextoAceptado ?? null,
    resultado: overrides.resultado ?? "EXITOSO",
    detalle: overrides.detalle ?? null,
  };
}

export function runEvidenceStoreContractTests(
  crearProveedor: () => EvidenceStore | Promise<EvidenceStore>,
): void {
  async function proveedor(): Promise<EvidenceStore> {
    return await crearProveedor();
  }

  describe("EvidenceStore (contrato, regla #10 append-only)", () => {
    it("guarda un registro y lo recupera en el historial del expediente", async () => {
      const store = await proveedor();
      const r = registro({ expedienteId: "EXP-CONTRATO-EVID-1" });

      await store.guardar(r);
      const historial = await store.obtenerHistorial("EXP-CONTRATO-EVID-1");

      expect(historial.some((h) => h.id === r.id)).toBe(true);
    });

    it("guarda dos registros del mismo expediente: ambos recuperables y en el orden en que se guardaron", async () => {
      const store = await proveedor();
      const primero = registro({
        expedienteId: "EXP-CONTRATO-EVID-2",
        paso: "P1_OTP_WHATSAPP",
        fecha: "2026-01-01T00:00:00.000Z",
      });
      const segundo = registro({
        expedienteId: "EXP-CONTRATO-EVID-2",
        paso: "P4_OTP_EMAIL",
        fecha: "2026-01-01T00:05:00.000Z",
      });

      await store.guardar(primero);
      await store.guardar(segundo);

      const historial = await store.obtenerHistorial("EXP-CONTRATO-EVID-2");
      const indicePrimero = historial.findIndex((h) => h.id === primero.id);
      const indiceSegundo = historial.findIndex((h) => h.id === segundo.id);

      expect(indicePrimero).toBeGreaterThanOrEqual(0);
      expect(indiceSegundo).toBeGreaterThan(indicePrimero);
    });

    // Nota (regla #10, garantía de tipos): `EvidenceStore` solo declara
    // `guardar` y `obtenerHistorial`. No existe ningún método de borrado ni
    // de actualización de un registro existente en la interfaz — la regla
    // append-only es imposible de violar a través de este puerto porque la
    // API no lo permite, no porque una convención lo desaliente. No hace
    // falta (ni se puede) escribir un test en runtime para "no existe el
    // método".
  });
}
