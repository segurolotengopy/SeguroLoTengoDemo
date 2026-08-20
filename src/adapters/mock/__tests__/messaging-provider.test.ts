/**
 * El adaptador simulado de mensajería, contra la suite de contrato del puerto
 * y contra lo que solo él puede mostrar: las dos palancas del panel de demo.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMessagingProviderContractTests } from "../../../ports/__tests__/messaging-provider.contract";
import { armarFallaDemo, reiniciarFallasDemo } from "../fallas-demo";
import { crearMessagingProviderMock, limpiarEnviosMock } from "../messaging-provider";

const DESTINO_WHATSAPP = "+595981000456";
const DESTINO_CORREO = "monica@example.com";

/** Reloj controlado: la demora del acuse se simula, no se espera de verdad. */
let ahora = Date.parse("2026-08-09T15:00:00.000Z");
const DEMORA_MS = 4_000;

function proveedor() {
  return crearMessagingProviderMock({ ahora: () => ahora, demoraAcuseMs: DEMORA_MS });
}

/** Las palancas solo existen con `DEMO_MODE=true`, así que el bloque las enciende. */
const MODO_ORIGINAL = process.env.DEMO_MODE;

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  ahora = Date.parse("2026-08-09T15:00:00.000Z");
  limpiarEnviosMock();
  reiniciarFallasDemo();
});

afterEach(() => {
  limpiarEnviosMock();
  reiniciarFallasDemo();
  if (MODO_ORIGINAL === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = MODO_ORIGINAL;
});

runMessagingProviderContractTests(proveedor, {
  destinoWhatsapp: DESTINO_WHATSAPP,
  destinoCorreo: DESTINO_CORREO,
  resolverEntregas: () => {
    ahora += DEMORA_MS;
  },
});

describe("palancas del panel de demo", () => {
  it("`ENTREGA_NO_DISPONIBLE` rechaza el envío como falla transitoria", async () => {
    armarFallaDemo("ENTREGA_NO_DISPONIBLE", true);
    const p = proveedor();

    const resultado = await p.entregarDocumentos({
      expedienteId: "EXP-1",
      canal: "WHATSAPP",
      destino: DESTINO_WHATSAPP,
      mensaje: "hola",
      adjuntos: [
        {
          codigo: "CPC-1",
          nombreArchivo: "c.pdf",
          contentType: "application/pdf",
          bytes: new Uint8Array([1]),
          hashSha256: "a".repeat(64),
        },
      ],
      idempotencyKey: "EXP-1:WHATSAPP:1",
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    // Transitoria, no definitiva: el despachador va a programar otro intento.
    expect(resultado.motivo).toBe("PROVEEDOR_NO_DISPONIBLE");
  });

  /**
   * La palanca que hace visible por qué `ENVIADO` y `ACUSADO` tienen que ser
   * dos estados: el proveedor acepta y después el mensaje no llega.
   */
  it("`ENTREGA_SIN_ACUSE` acepta el envío y después lo reporta fallido", async () => {
    armarFallaDemo("ENTREGA_SIN_ACUSE", true);
    const p = proveedor();

    const envio = await p.entregarDocumentos({
      expedienteId: "EXP-1",
      canal: "WHATSAPP",
      destino: DESTINO_WHATSAPP,
      mensaje: "hola",
      adjuntos: [
        {
          codigo: "CPC-1",
          nombreArchivo: "c.pdf",
          contentType: "application/pdf",
          bytes: new Uint8Array([1]),
          hashSha256: "a".repeat(64),
        },
      ],
      idempotencyKey: "EXP-1:WHATSAPP:1",
    });

    expect(envio.ok).toBe(true);
    if (!envio.ok) return;

    // Aceptado: en tránsito, igual que un envío bueno.
    expect((await p.consultarEntrega(envio.referenciaEnvio))?.estado).toBe("EN_TRANSITO");

    ahora += DEMORA_MS;
    expect((await p.consultarEntrega(envio.referenciaEnvio))?.estado).toBe("FALLIDO");
  });

  it("las palancas se consumen en un solo intento", async () => {
    armarFallaDemo("ENTREGA_NO_DISPONIBLE", true);
    const p = proveedor();
    const base = {
      expedienteId: "EXP-1",
      canal: "WHATSAPP" as const,
      destino: DESTINO_WHATSAPP,
      mensaje: "hola",
      adjuntos: [
        {
          codigo: "CPC-1",
          nombreArchivo: "c.pdf",
          contentType: "application/pdf",
          bytes: new Uint8Array([1]),
          hashSha256: "a".repeat(64),
        },
      ],
    };

    const primero = await p.entregarDocumentos({ ...base, idempotencyKey: "EXP-1:WHATSAPP:1" });
    const segundo = await p.entregarDocumentos({ ...base, idempotencyKey: "EXP-1:WHATSAPP:2" });

    expect(primero.ok).toBe(false);
    // El reintento funciona: se ve el error una vez y la demostración sigue.
    expect(segundo.ok).toBe(true);
  });
});
