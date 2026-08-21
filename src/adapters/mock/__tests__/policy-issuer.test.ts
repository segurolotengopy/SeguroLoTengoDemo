/**
 * El adaptador mock de `PolicyIssuer` (SEBAOT) contra la misma suite de
 * contrato que tendrá que pasar el adaptador oficial, más lo específico del
 * mock: el número de póliza que conserva el correlativo, la idempotencia de la
 * emisión y el paso del tiempo hasta `EMITIDA`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runPolicyIssuerContractTests } from "../../../ports/__tests__/policy-issuer.contract";
import type { EmitirPolizaInput } from "../../../ports/policy-issuer";
import {
  DEMORA_EMISION_MS,
  DEMORA_FACTURA_MS,
  crearPolicyIssuerMock,
  limpiarPolizasMock,
  listarPolizasMock,
} from "../policy-issuer";

const ENTRADA: EmitirPolizaInput = {
  expedienteId: "EXP-P9-1",
  propuestaId: "00018425",
  referenciaBancard: "MOCK-BANCARD-ABC",
  documento: {
    codigo: "PROP-00018425",
    codigoSeccionFipf: "FIPF-00018425",
    version: 1,
    hashSha256: "a".repeat(64),
    cerradoEn: "2026-08-09T15:02:00.000Z",
  },
  firma: {
    canal: "WHATSAPP",
    idCode100: "MOCK-FIRMA-XYZ",
    firmadoEn: "2026-08-09T15:10:00.000Z",
    hashDocumentoFirmado: "c".repeat(64),
  },
};

beforeEach(() => {
  limpiarPolizasMock();
});

afterEach(() => {
  limpiarPolizasMock();
});

runPolicyIssuerContractTests(() => crearPolicyIssuerMock());

describe("MockPolicyIssuer · SEBAOT simulado", () => {
  it("la póliza conserva el correlativo de la propuesta (fila 47)", async () => {
    const sebaot = crearPolicyIssuerMock();

    const resultado = await sebaot.emitirPoliza(ENTRADA);

    expect(resultado.numeroPoliza).toBe(ENTRADA.propuestaId);
  });

  it("arranca EN_PROCESO_DE_EMISION y no trae fecha de emisión", async () => {
    const instante = new Date("2026-08-09T15:20:00.000Z");
    const sebaot = crearPolicyIssuerMock({ ahora: () => instante });

    const resultado = await sebaot.emitirPoliza(ENTRADA);

    expect(resultado.estado).toBe("EN_PROCESO_DE_EMISION");
    expect(resultado.emitidaEn).toBeNull();
  });

  it("pasa a EMITIDA cuando el reloj alcanza el tiempo de preparación", async () => {
    let reloj = new Date("2026-08-09T15:20:00.000Z");
    const sebaot = crearPolicyIssuerMock({ ahora: () => reloj });
    await sebaot.emitirPoliza(ENTRADA);

    reloj = new Date(reloj.getTime() + DEMORA_EMISION_MS);
    const estado = await sebaot.consultarEstadoPoliza(ENTRADA.propuestaId);

    expect(estado.estado).toBe("EMITIDA");
    expect(estado.emitidaEn).toBe(reloj.toISOString());
  });

  it("la factura no se adelanta a la póliza y trae referencia solo al emitirse", async () => {
    let reloj = new Date("2026-08-09T15:20:00.000Z");
    const sebaot = crearPolicyIssuerMock({ ahora: () => reloj });
    await sebaot.emitirPoliza(ENTRADA);

    const antes = await sebaot.consultarEstadoFacturaElectronica(ENTRADA.propuestaId);
    expect(antes.estado).toBe("PENDIENTE");
    expect(antes.referencia).toBeNull();

    // Con la póliza emitida pero todavía sin llegar al momento de facturar.
    reloj = new Date(reloj.getTime() + DEMORA_EMISION_MS);
    expect((await sebaot.consultarEstadoFacturaElectronica(ENTRADA.propuestaId)).estado).toBe(
      "PENDIENTE",
    );

    reloj = new Date(reloj.getTime() + (DEMORA_FACTURA_MS - DEMORA_EMISION_MS));
    const despues = await sebaot.consultarEstadoFacturaElectronica(ENTRADA.propuestaId);
    expect(despues.estado).toBe("EMITIDA");
    expect(despues.referencia).toMatch(/^MOCK-SIFEN-/);
  });

  it("emitir dos veces el mismo expediente no crea dos pólizas ni reinicia el reloj", async () => {
    const instante = new Date("2026-08-09T15:20:00.000Z");
    const sebaot = crearPolicyIssuerMock({ ahora: () => instante });

    const primera = await sebaot.emitirPoliza(ENTRADA);
    const segunda = await sebaot.emitirPoliza(ENTRADA);

    expect(segunda).toEqual(primera);
    expect(listarPolizasMock()).toHaveLength(1);
  });

  it("guarda las huellas firmadas que respaldan la emisión", async () => {
    const sebaot = crearPolicyIssuerMock();

    await sebaot.emitirPoliza(ENTRADA);

    const poliza = listarPolizasMock()[0];
    expect(poliza.hashDocumentoFirmado).toBe(ENTRADA.firma.hashDocumentoFirmado);
  });

  it("una póliza desconocida se reporta como no emitida, nunca como emitida sin fecha", async () => {
    const sebaot = crearPolicyIssuerMock();

    const estado = await sebaot.consultarEstadoPoliza("00099999");

    expect(estado.estado).toBe("EN_PROCESO_DE_EMISION");
    expect(estado.emitidaEn).toBeNull();
  });

  /**
   * No se genera Nota de Cobertura: no hay método que la produzca. El test es
   * estructural a propósito — si alguien agrega uno, esto falla.
   */
  it("el puerto no tiene ninguna operación que genere Nota de Cobertura", () => {
    const sebaot = crearPolicyIssuerMock();

    expect(Object.keys(sebaot).sort()).toEqual([
      "consultarEstadoFacturaElectronica",
      "consultarEstadoPoliza",
      "emitirPoliza",
    ]);
    expect(JSON.stringify(Object.keys(sebaot)).toLowerCase()).not.toContain("cobertura");
  });
});
