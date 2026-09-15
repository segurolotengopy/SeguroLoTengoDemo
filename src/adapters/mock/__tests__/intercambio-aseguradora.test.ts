/**
 * El adaptador simulado del intercambio con la aseguradora, contra la suite de
 * contrato del puerto y contra lo que solo él hace: simular la firma de Alianza.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  pdfDePrueba,
  runIntercambioAseguradoraContractTests,
  solicitudDePrueba,
} from "../../../ports/__tests__/intercambio-aseguradora.contract";
import { CARPETAS_REMOTAS_PROPUESTAS } from "../../../domain/intercambio-aseguradora";
import type { ConfiguracionIntercambioAseguradora } from "../../../domain/intercambio-aseguradora";
import {
  agregarRevisionIncrementalSimulada,
  crearIntercambioAseguradoraMock,
  limpiarIntercambioMock,
} from "../intercambio-aseguradora";

const DEMORA_MS = 3_000;
let ahora = Date.parse("2026-09-15T12:00:00.000Z");

const CONFIGURACION: ConfiguracionIntercambioAseguradora = {
  documentosHabilitados: ["CPC"],
  carpetas: CARPETAS_REMOTAS_PROPUESTAS,
};

beforeEach(() => {
  ahora = Date.parse("2026-09-15T12:00:00.000Z");
  limpiarIntercambioMock();
});

runIntercambioAseguradoraContractTests(
  () => crearIntercambioAseguradoraMock({ configuracion: CONFIGURACION, ahora: () => ahora, demoraMs: DEMORA_MS }),
  {
    resolverPendientes: () => {
      ahora += DEMORA_MS;
    },
  },
);

describe("agregarRevisionIncrementalSimulada", () => {
  it("no toca el original y encadena la revisión nueva con /Prev", () => {
    const original = pdfDePrueba("revision");
    const firmado = agregarRevisionIncrementalSimulada(original, "Alianza Garantia");

    expect(Buffer.from(firmado.subarray(0, original.length)).equals(Buffer.from(original))).toBe(true);
    const cola = new TextDecoder("latin1").decode(firmado.subarray(original.length));
    expect(cola).toContain("/Prev 60");
    expect(cola).toContain("SIMULADO");

    // El startxref nuevo apunta a la tabla xref agregada.
    const texto = new TextDecoder("latin1").decode(firmado);
    const offset = Number([...texto.matchAll(/startxref\s+(\d+)/g)].at(-1)?.[1]);
    expect(texto.slice(offset, offset + 4)).toBe("xref");
  });
});

describe("falla del conector simulado", () => {
  it("un envío fallido queda FALLIDA y el reintento con la misma huella es un intento nuevo", async () => {
    let fallar = true;
    const p = crearIntercambioAseguradoraMock({
      configuracion: CONFIGURACION,
      ahora: () => ahora,
      demoraMs: DEMORA_MS,
      fallaForzada: () => fallar,
    });
    const solicitud = solicitudDePrueba({ bytes: pdfDePrueba("reintento") });

    expect(await p.enviarDocumento(solicitud)).toMatchObject({ ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE" });

    fallar = false;
    const reintento = await p.enviarDocumento(solicitud);
    expect(reintento).toMatchObject({ ok: true, duplicado: false });
    if (!reintento.ok) return;
    expect(reintento.referencia.endsWith("-2")).toBe(true);
    expect(reintento.referencia).toContain(
      createHash("sha256").update(solicitud.bytes).digest("hex").slice(0, 24),
    );
  });
});
