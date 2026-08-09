/**
 * Corre la MISMA suite de contrato que cualquier otra implementación de
 * `EvidenceStore` (`src/ports/__tests__/evidence-store.contract.ts`) contra
 * la implementación DynamoDB de este directorio — tal como promete el
 * comentario de esa suite: "estos mismos tests correrán después contra los
 * proveedores oficiales". Acá "oficial" es DynamoDB, con un cliente falso
 * en memoria en vez de red real.
 */
import { describe, expect, it } from "vitest";
import { runEvidenceStoreContractTests } from "../../ports/__tests__/evidence-store.contract";
import type { RegistroEvidencia } from "../../domain/tipos";
import { crearEvidenceStoreDynamoDb } from "../evidencia-repository";
import { crearFakeDynamoDocumentClient } from "./fake-dynamo-document-client";

runEvidenceStoreContractTests(() => {
  const { documentClient } = crearFakeDynamoDocumentClient();
  return crearEvidenceStoreDynamoDb({ documentClient, nombreTabla: "tabla-de-test" });
});

describe("EvidenceStore DynamoDB — refuerzo de infraestructura de la regla append-only", () => {
  function registro(overrides: Partial<RegistroEvidencia> = {}): RegistroEvidencia {
    return {
      id: overrides.id ?? "EVID-1",
      expedienteId: overrides.expedienteId ?? "EXP-1",
      paso: overrides.paso ?? "P1_OTP_WHATSAPP",
      fecha: overrides.fecha ?? "2026-01-01T00:00:00.000Z",
      ip: overrides.ip ?? "127.0.0.1",
      dispositivo: overrides.dispositivo ?? "vitest",
      sesionId: overrides.sesionId ?? "SES-1",
      versionTextoAceptado: overrides.versionTextoAceptado ?? null,
      textoAceptado: overrides.textoAceptado ?? null,
      resultado: overrides.resultado ?? "EXITOSO",
      detalle: overrides.detalle ?? null,
    };
  }

  it("guardar dos veces el mismo id de evidencia falla en vez de sobrescribir", async () => {
    const { documentClient } = crearFakeDynamoDocumentClient();
    const store = crearEvidenceStoreDynamoDb({ documentClient, nombreTabla: "tabla-de-test" });

    await store.guardar(registro({ resultado: "EXITOSO" }));

    await expect(store.guardar(registro({ resultado: "FALLIDO" }))).rejects.toThrow(/append-only/);

    const historial = await store.obtenerHistorial("EXP-1");
    expect(historial).toHaveLength(1);
    expect(historial[0].resultado).toBe("EXITOSO");
  });
});
