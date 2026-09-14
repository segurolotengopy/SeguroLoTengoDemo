import { describe, expect, it } from "vitest";
import type { AsistenteProvider } from "../asistente-provider";

/**
 * Contrato compartido por el mock y el adaptador oficial del asistente.
 * Verifica la forma y las reglas de la interfaz, no la calidad de las respuestas.
 */
export function runAsistenteProviderContractTests(crear: () => AsistenteProvider) {
  describe("contrato AsistenteProvider", () => {
    it("describe el agente con un perfil por producto y una bienvenida", async () => {
      const d = await crear().describir();
      expect(d).not.toBeNull();
      expect(d!.nombreAsistente.length).toBeGreaterThan(0);
      expect(d!.perfiles.map((p) => p.id)).toEqual(expect.arrayContaining(["VIDA_ONCOLOGICO"]));
      expect(d!.bienvenida.length).toBeGreaterThan(0);
    });

    it("responde con texto y respaldo tipado, sin datos de la persona", async () => {
      const r = await crear().responder({ conversacionId: "web_contrato01", perfilId: "VIDA_ONCOLOGICO", texto: "¿Cuánto cuesta el plan CONFÍO?" });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(typeof r.texto).toBe("string");
        for (const f of r.respaldo) expect(f).toEqual({ fuenteId: expect.any(String), titulo: expect.any(String), version: expect.any(String) });
        expect(r.texto).not.toMatch(/web_contrato01/);
      }
    });

    it("un perfil desconocido no se atiende como si fuera el por defecto", async () => {
      const r = await crear().responder({ conversacionId: "web_contrato02", perfilId: "NO_EXISTE", texto: "hola" });
      expect(r).toEqual({ ok: false, motivo: "PERFIL_DESCONOCIDO" });
    });
  });
}
