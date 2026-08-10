/**
 * El adaptador mock de `OtpProvider` contra la misma suite de contrato que
 * tendrá que pasar el adaptador oficial
 * (`src/ports/__tests__/otp-provider.contract.ts`), más lo específico del
 * mock: el canal de lectura del panel de demo y su apagado con `DEMO_MODE`
 * en falso.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { crearFakeDynamoDocumentClient } from "../../../repositories/__tests__/fake-dynamo-document-client";
import { crearOtpRepositoryDynamoDb } from "../../../repositories/otp-repository";
import type { OtpRepository } from "../../../repositories/otp-repository";
import { runOtpProviderContractTests } from "../../../ports/__tests__/otp-provider.contract";
import { crearOtpProviderMock, limpiarRegistroDemo, obtenerEnvioDemo } from "../otp-provider";
import type { FallaOtpDemo } from "../otp-provider";

const PEPPER = "pepper-de-prueba";

function crearRepositorio(): OtpRepository {
  const { documentClient } = crearFakeDynamoDocumentClient();
  return crearOtpRepositoryDynamoDb({
    documentClient,
    nombreTabla: "tabla-de-prueba",
    obtenerPepper: async () => PEPPER,
  });
}

runOtpProviderContractTests(
  () => crearOtpProviderMock({ otpRepository: crearRepositorio(), retenerCodigoParaPanelDemo: true }),
  (otpId) => {
    const envio = obtenerEnvioDemo(otpId);
    if (!envio) throw new Error(`El registro de demo no tiene el OTP ${otpId}`);
    return envio.codigo;
  },
);

describe("OtpProviderMock — canal del panel de demo", () => {
  beforeEach(() => {
    limpiarRegistroDemo();
  });

  it("con DEMO_MODE apagado no retiene el código ni siquiera en memoria", async () => {
    const proveedor = crearOtpProviderMock({
      otpRepository: crearRepositorio(),
      retenerCodigoParaPanelDemo: false,
    });

    const envio = await proveedor.enviarOtp({
      expedienteId: "EXP-1",
      proposito: "VERIFICACION_CELULAR",
      destino: { canal: "WHATSAPP", valor: "+595981000000" },
    });
    if (!envio.ok) throw new Error("el envío debería haber tenido éxito");

    expect(obtenerEnvioDemo(envio.otpId)).toBeNull();
  });

  it("el resultado del envío no trae el código, solo referencia de entrega", async () => {
    const proveedor = crearOtpProviderMock({
      otpRepository: crearRepositorio(),
      retenerCodigoParaPanelDemo: true,
    });

    const envio = await proveedor.enviarOtp({
      expedienteId: "EXP-2",
      proposito: "VERIFICACION_CELULAR",
      destino: { canal: "WHATSAPP", valor: "+595981000000" },
    });
    if (!envio.ok) throw new Error("el envío debería haber tenido éxito");

    const codigo = obtenerEnvioDemo(envio.otpId)?.codigo;
    expect(codigo).toMatch(/^\d{6}$/);
    expect(JSON.stringify(envio)).not.toContain(codigo);
    expect(envio.referenciaEnvio).toMatch(/^MOCK-WHATSAPP-/);
  });

  it("al consumirse el OTP, el código deja de estar disponible para el panel", async () => {
    const proveedor = crearOtpProviderMock({
      otpRepository: crearRepositorio(),
      retenerCodigoParaPanelDemo: true,
    });

    const envio = await proveedor.enviarOtp({
      expedienteId: "EXP-3",
      proposito: "VERIFICACION_CELULAR",
      destino: { canal: "WHATSAPP", valor: "+595981000000" },
    });
    if (!envio.ok) throw new Error("el envío debería haber tenido éxito");

    const codigo = obtenerEnvioDemo(envio.otpId)!.codigo;
    await proveedor.verificarOtp({ otpId: envio.otpId, codigoIngresado: codigo });

    expect(obtenerEnvioDemo(envio.otpId)).toBeNull();
  });

  it("rechaza un canal que no corresponde al propósito", async () => {
    const proveedor = crearOtpProviderMock({
      otpRepository: crearRepositorio(),
      retenerCodigoParaPanelDemo: true,
    });

    const envio = await proveedor.enviarOtp({
      expedienteId: "EXP-4",
      proposito: "VERIFICACION_CELULAR",
      destino: { canal: "EMAIL", valor: "persona@correo.com" },
    });

    expect(envio.ok).toBe(false);
    if (envio.ok) return;
    expect(envio.motivo).toBe("ERROR_ENVIO");
  });
});

/**
 * Los dos fallos de OTP que el panel de demo puede forzar (CLAUDE.md → "Panel
 * de demo"). Lo que se verifica no es que "devuelvan un error", sino que el OTP
 * que producen sea **real** y lo rechace la validación de siempre: el mock no
 * tiene una rama que finja un vencimiento ni un contador de intentos propio.
 */
describe("OtpProviderMock — fallos forzados desde el panel de demo", () => {
  beforeEach(() => {
    limpiarRegistroDemo();
  });

  function proveedorCon(falla: FallaOtpDemo) {
    return crearOtpProviderMock({
      otpRepository: crearRepositorio(),
      retenerCodigoParaPanelDemo: true,
      fallaForzada: () => falla,
    });
  }

  async function enviar(proveedor: ReturnType<typeof crearOtpProviderMock>) {
    const envio = await proveedor.enviarOtp({
      expedienteId: "EXP-FALLA",
      proposito: "VERIFICACION_CELULAR",
      destino: { canal: "WHATSAPP", valor: "+595981000000" },
    });
    if (!envio.ok) throw new Error("el envío debería haber tenido éxito");
    const codigo = obtenerEnvioDemo(envio.otpId)?.codigo ?? "";
    return { otpId: envio.otpId, codigo };
  }

  it("EXPIRADO: el código correcto se rechaza por vigencia vencida", async () => {
    const proveedor = proveedorCon("EXPIRADO");
    const { otpId, codigo } = await enviar(proveedor);

    const resultado = await proveedor.verificarOtp({ otpId, codigoIngresado: codigo });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("EXPIRADO");
  });

  it("INTENTOS_AGOTADOS: el código correcto se rechaza porque ya no quedan intentos", async () => {
    const proveedor = proveedorCon("INTENTOS_AGOTADOS");
    const { otpId, codigo } = await enviar(proveedor);

    const resultado = await proveedor.verificarOtp({ otpId, codigoIngresado: codigo });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("INTENTOS_AGOTADOS");
  });

  it("sin falla forzada, el mismo camino verifica bien", async () => {
    const proveedor = crearOtpProviderMock({
      otpRepository: crearRepositorio(),
      retenerCodigoParaPanelDemo: true,
    });
    const { otpId, codigo } = await enviar(proveedor);

    expect((await proveedor.verificarOtp({ otpId, codigoIngresado: codigo })).ok).toBe(true);
  });

  it("el envío con falla forzada sigue sin devolver el código por el puerto", async () => {
    const proveedor = proveedorCon("EXPIRADO");
    const envio = await proveedor.enviarOtp({
      expedienteId: "EXP-FALLA-2",
      proposito: "VERIFICACION_CELULAR",
      destino: { canal: "WHATSAPP", valor: "+595981000000" },
    });
    if (!envio.ok) throw new Error("el envío debería haber tenido éxito");

    const codigo = obtenerEnvioDemo(envio.otpId)?.codigo ?? "";
    expect(codigo).not.toBe("");
    expect(JSON.stringify(envio)).not.toContain(codigo);
  });
});
