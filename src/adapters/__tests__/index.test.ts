import { describe, expect, it } from "vitest";
import { resolverAdaptador, resolverModoIntegracion } from "../index";

describe("resolverModoIntegracion", () => {
  it("por defecto resuelve a mock cuando no hay ninguna variable de entorno", () => {
    expect(resolverModoIntegracion("OTP", {})).toBe("mock");
  });

  it("usa el flag global INTEGRATION_MODE cuando está presente", () => {
    expect(resolverModoIntegracion("OTP", { INTEGRATION_MODE: "live" })).toBe("live");
  });

  it("ignora un valor no reconocido de INTEGRATION_MODE y cae al default", () => {
    expect(resolverModoIntegracion("OTP", { INTEGRATION_MODE: "algo-invalido" })).toBe("mock");
  });

  it("el flag granular INTEGRATION_<PUERTO> tiene prioridad sobre el global", () => {
    expect(
      resolverModoIntegracion("PAYMENT", {
        INTEGRATION_MODE: "live",
        INTEGRATION_PAYMENT: "mock",
      }),
    ).toBe("mock");
  });

  it("el flag granular se aplica solo al puerto que le corresponde", () => {
    const entorno = { INTEGRATION_MODE: "mock", INTEGRATION_SIGNATURE: "live" };

    expect(resolverModoIntegracion("SIGNATURE", entorno)).toBe("live");
    expect(resolverModoIntegracion("OTP", entorno)).toBe("mock");
  });

  it("ignora un valor no reconocido del flag granular y cae al global", () => {
    expect(
      resolverModoIntegracion("EVIDENCE", {
        INTEGRATION_MODE: "live",
        INTEGRATION_EVIDENCE: "algo-invalido",
      }),
    ).toBe("live");
  });
});

describe("resolverAdaptador", () => {
  it("invoca la fábrica mock cuando el modo resuelto es mock", () => {
    const resultado = resolverAdaptador(
      "IDENTITY",
      { mock: () => "adaptador-mock", live: () => "adaptador-live" },
      {},
    );

    expect(resultado).toBe("adaptador-mock");
  });

  it("invoca la fábrica live cuando el modo resuelto es live", () => {
    const resultado = resolverAdaptador(
      "IDENTITY",
      { mock: () => "adaptador-mock", live: () => "adaptador-live" },
      { INTEGRATION_IDENTITY: "live" },
    );

    expect(resultado).toBe("adaptador-live");
  });

  it("no invoca la fábrica del modo no elegido", () => {
    let mockInvocada = false;
    let liveInvocada = false;

    resolverAdaptador(
      "COMPLIANCE",
      {
        mock: () => {
          mockInvocada = true;
          return "mock";
        },
        live: () => {
          liveInvocada = true;
          return "live";
        },
      },
      { INTEGRATION_COMPLIANCE: "live" },
    );

    expect(liveInvocada).toBe(true);
    expect(mockInvocada).toBe(false);
  });
});
