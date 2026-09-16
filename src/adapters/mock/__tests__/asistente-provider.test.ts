import { describe, expect, it } from "vitest";
import { runAsistenteProviderContractTests } from "@/ports/__tests__/asistente-provider.contract";
import { crearAsistenteProviderMock, DERIVACION_MOCK, SIN_RESPALDO_MOCK } from "../asistente-provider";

runAsistenteProviderContractTests(crearAsistenteProviderMock);

describe("mock del asistente", () => {
  const mock = crearAsistenteProviderMock();
  const preguntar = (texto: string, perfilId: string | null = "VIDA_ONCOLOGICO") =>
    mock.responder({ conversacionId: "web_mock00001", perfilId, texto });

  it("responde planes y premios desde el catálogo versionado", async () => {
    const r = await preguntar("¿Cuánto cuesta el plan VIVE+?");
    expect(r.ok && r.texto).toContain("Gs. 575.000");
    expect(r.ok && r.respaldo[0]?.version).toBe("OFERTA-VIVE-v3");
  });

  it("responde carencias, exclusiones y edades desde el documento de coberturas v1.0", async () => {
    const c = await preguntar("¿Qué carencia tiene?");
    expect(c.ok && c.texto).toContain("180 días");
    const e = await preguntar("¿Cuáles son las exclusiones?");
    expect(e.ok && e.texto).toContain("preexistentes");
    expect(e.ok && e.respaldo[0]?.version).toBe("v1.0");
    const d = await preguntar("¿Hasta qué edad puedo entrar?");
    expect(d.ok && d.texto).toContain("18 y 64");
  });

  it("los productos «próximamente» no reciben planes ni precios", async () => {
    const r = await preguntar("¿Cuánto cuesta?", "VIDA");
    expect(r.ok && r.texto).toContain("próximamente");
    expect(r.ok && r.texto).not.toMatch(/Gs\./);
  });

  it("deriva cuando la persona pide hablar con alguien y cae a «sin respaldo» ante lo desconocido", async () => {
    const d = await preguntar("quiero hablar con un asesor");
    expect(d.ok && d.derivacion).toBe(true);
    expect(d.ok && d.texto).toContain(DERIVACION_MOCK);
    const s = await preguntar("¿me recomendás un restaurante?");
    expect(s.ok && s.texto).toContain(SIN_RESPALDO_MOCK);
    expect(s.ok && s.avisos).toEqual(["sin_respaldo"]);
  });
});
