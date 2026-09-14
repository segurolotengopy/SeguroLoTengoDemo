/**
 * La ruta del asistente no reenvía datos sensibles al proveedor de IA ni los
 * escribe en logs (regla inviolable #7; punto 8 del checklist de CLAUDE.md).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MensajeAsistente } from "@/ports/asistente-provider";

const recibidos: MensajeAsistente[] = [];

vi.mock("@/app/api/asistente/_dependencias", () => ({
  dependenciasAsistente: () => ({
    asistente: {
      nombre: "espia",
      describir: async () => null,
      responder: async (m: MensajeAsistente) => {
        recibidos.push(m);
        return { ok: true, texto: "ok", respaldo: [], avisos: [], derivacion: false };
      },
    },
  }),
}));

import { POST } from "@/app/api/asistente/mensaje/route";
import { GET } from "@/app/api/asistente/agente/route";
import { limpiarLimitador } from "@/app/api/_http/limitador";

function peticion(cuerpo: unknown, ip = "10.0.0.1"): Request {
  return new Request("http://localhost/api/asistente/mensaje", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(cuerpo),
  });
}

describe("POST /api/asistente/mensaje", () => {
  const consola = {
    log: vi.spyOn(console, "log").mockImplementation(() => undefined),
    error: vi.spyOn(console, "error").mockImplementation(() => undefined),
    warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
  };

  beforeEach(() => {
    process.env.ASISTENTE_ENABLED = "true";
    recibidos.length = 0;
    limpiarLimitador();
    for (const s of Object.values(consola)) s.mockClear();
  });
  afterEach(() => {
    delete process.env.ASISTENTE_ENABLED;
  });

  it("responde 404 con el asistente apagado", async () => {
    delete process.env.ASISTENTE_ENABLED;
    expect((await POST(peticion({ conversacionId: "web_ruta0001", texto: "hola" }))).status).toBe(404);
    expect((await GET()).status).toBe(404);
  });

  it("bloquea un dato sensible sin reenviarlo ni registrarlo", async () => {
    const r = await POST(peticion({ conversacionId: "web_ruta0001", perfilId: "VIDA_ONCOLOGICO", texto: "tengo cáncer, mi CI es 4.523.118" }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { bloqueado: boolean; categorias: string[]; texto: string };
    expect(j.bloqueado).toBe(true);
    expect(j.categorias).toEqual(["cedula", "salud"]);
    expect(recibidos).toHaveLength(0);
    const todo = JSON.stringify([...consola.log.mock.calls, ...consola.error.mock.calls, ...consola.warn.mock.calls]);
    expect(todo).not.toContain("4.523.118");
    expect(todo).not.toContain("cáncer");
  });

  it("reenvía texto limpio con el producto como perfil y devuelve cache-control: no-store", async () => {
    const r = await POST(peticion({ conversacionId: "web_ruta0002", perfilId: "VIDA", texto: "¿qué planes hay?" }));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(recibidos).toEqual([{ conversacionId: "web_ruta0002", perfilId: "VIDA", texto: "¿qué planes hay?" }]);
  });

  it("mapea motivos a status", async () => {
    expect((await POST(peticion({ conversacionId: "malo", texto: "hola" }))).status).toBe(400);
    expect((await POST(peticion({ conversacionId: "web_ruta0003", texto: "a".repeat(1600) }))).status).toBe(413);
    expect((await POST(peticion({ conversacionId: "web_ruta0003", perfilId: "AUTO", texto: "hola" }))).status).toBe(404);
  });

  it("limita por IP y no toca al proveedor al rechazar", async () => {
    let ultimo = 200;
    for (let i = 0; i < 31; i++) ultimo = (await POST(peticion({ conversacionId: "web_ruta0004", texto: `mensaje ${i}` }, "10.9.9.9"))).status;
    expect(ultimo).toBe(429);
    expect(recibidos).toHaveLength(30);
  });
});
