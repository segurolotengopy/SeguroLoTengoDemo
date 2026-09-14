import { describe, expect, it } from "vitest";
import { crearAsistenteChatbotRag } from "../asistente-chatbotrag";

type Captura = { url: string; init: RequestInit };

function fetchFalso(respuestas: Array<{ status: number; cuerpo: unknown }>, capturas: Captura[]): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    capturas.push({ url: String(url), init: init ?? {} });
    const r = respuestas.shift() ?? { status: 500, cuerpo: { ok: false } };
    return new Response(JSON.stringify(r.cuerpo), { status: r.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

const CLAVE = "clave-fija-de-prueba-larga";

describe("adaptador live del asistente (ChatbotRAG)", () => {
  it("envía Bearer, perfil y canal, y traduce la respuesta al puerto", async () => {
    const capturas: Captura[] = [];
    const a = crearAsistenteChatbotRag({
      baseUrl: "https://chatbotrag.ejemplo.com/",
      clave: async () => CLAVE,
      fetchFn: fetchFalso(
        [{ status: 200, cuerpo: { ok: true, texto: "Según el documento…", respaldo: [{ fuenteId: "planes", titulo: "Planes", version: "v2", puntaje: 0.7 }], avisos: [], derivacion: null } }],
        capturas,
      ),
    });
    const r = await a.responder({ conversacionId: "web_live0001", perfilId: "VIDA_ONCOLOGICO", texto: "¿precio?" });
    expect(r).toEqual({ ok: true, texto: "Según el documento…", respaldo: [{ fuenteId: "planes", titulo: "Planes", version: "v2" }], avisos: [], derivacion: false });
    expect(capturas[0]?.url).toBe("https://chatbotrag.ejemplo.com/v1/conversaciones/web_live0001/mensajes");
    expect((capturas[0]?.init.headers as Record<string, string>).authorization).toBe(`Bearer ${CLAVE}`);
    expect(JSON.parse(String(capturas[0]?.init.body))).toEqual({ perfilId: "VIDA_ONCOLOGICO", texto: "¿precio?", canal: "web" });
  });

  it("traduce 429, 404 y 5xx a motivos del puerto y no lanza ante red caída", async () => {
    const a = crearAsistenteChatbotRag({
      baseUrl: "https://c.ejemplo.com",
      clave: CLAVE,
      fetchFn: fetchFalso([{ status: 429, cuerpo: { ok: false } }, { status: 404, cuerpo: { ok: false } }, { status: 503, cuerpo: { ok: false } }], []),
    });
    const m = { conversacionId: "web_live0002", perfilId: null, texto: "x" };
    expect(await a.responder(m)).toEqual({ ok: false, motivo: "LIMITE" });
    expect(await a.responder(m)).toEqual({ ok: false, motivo: "PERFIL_DESCONOCIDO" });
    expect(await a.responder(m)).toEqual({ ok: false, motivo: "NO_DISPONIBLE" });

    const caido = crearAsistenteChatbotRag({
      baseUrl: "https://c.ejemplo.com",
      clave: CLAVE,
      fetchFn: (async () => {
        throw new Error("ECONNREFUSED");
      }) as typeof fetch,
    });
    expect(await caido.responder(m)).toEqual({ ok: false, motivo: "NO_DISPONIBLE" });
    expect(await caido.describir()).toBeNull();
  });

  it("describe el agente desde /v1/agente", async () => {
    const a = crearAsistenteChatbotRag({
      baseUrl: "https://c.ejemplo.com",
      clave: CLAVE,
      fetchFn: fetchFalso(
        [
          {
            status: 200,
            cuerpo: { ok: true, agente: { nombreAsistente: "Terra" }, perfilPorDefecto: "VIDA_ONCOLOGICO", perfiles: [{ id: "VIDA_ONCOLOGICO", nombre: "Vida Oncológico", bienvenida: "Hola" }], bienvenida: "Hola" },
          },
        ],
        [],
      ),
    });
    expect(await a.describir()).toEqual({
      nombreAsistente: "Terra",
      perfilPorDefecto: "VIDA_ONCOLOGICO",
      perfiles: [{ id: "VIDA_ONCOLOGICO", nombre: "Vida Oncológico", bienvenida: "Hola" }],
      bienvenida: "Hola",
    });
  });
});
