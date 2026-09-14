import { describe, expect, it } from "vitest";
import { categoriasBloqueadas, conversarConAsistente, esPerfilConocido, TEXTO_ENTRADA_BLOQUEADA } from "../asistente";
import type { AsistenteProvider, MensajeAsistente } from "../../ports/asistente-provider";

function asistenteEspia() {
  const recibidos: MensajeAsistente[] = [];
  const asistente: AsistenteProvider = {
    nombre: "espia",
    async describir() {
      return null;
    },
    async responder(m) {
      recibidos.push(m);
      return { ok: true, texto: "respuesta", respaldo: [], avisos: [], derivacion: false };
    },
  };
  return { asistente, recibidos };
}

describe("categoriasBloqueadas — regla inviolable #7 aplicada al chat", () => {
  it("bloquea cédula (con puntos, corrida y por contexto), tarjeta y códigos", () => {
    expect(categoriasBloqueadas("mi cédula es 4.523.118")).toContain("cedula");
    expect(categoriasBloqueadas("CI 4523118 puedo contratar?")).toContain("cedula");
    expect(categoriasBloqueadas("mi número es 4.523.118")).toContain("cedula");
    expect(categoriasBloqueadas("pago con la 4111 1111 1111 1111")).toContain("tarjeta");
    expect(categoriasBloqueadas("el cvv es 123")).toContain("tarjeta");
    expect(categoriasBloqueadas("me llegó el código 482913")).toContain("codigo");
  });

  it("bloquea datos de salud y PEP en primera persona, pero no preguntas sobre el producto", () => {
    expect(categoriasBloqueadas("tengo cáncer, ¿puedo contratar?")).toEqual(["salud"]);
    expect(categoriasBloqueadas("mi mamá tiene diabetes")).toEqual(["salud"]);
    expect(categoriasBloqueadas("soy diputado")).toEqual(["pep"]);
    expect(categoriasBloqueadas("¿El seguro cubre cáncer?")).toEqual([]);
    expect(categoriasBloqueadas("¿qué carencia tiene el cáncer?")).toEqual([]);
    expect(categoriasBloqueadas("¿qué es una persona políticamente expuesta?")).toEqual([]);
  });

  it("no confunde premios en guaraníes con cédulas", () => {
    expect(categoriasBloqueadas("¿el premio es Gs. 319.000 al año?")).toEqual([]);
    expect(categoriasBloqueadas("cuesta 522.500?")).toEqual([]);
  });
});

describe("conversarConAsistente", () => {
  it("valida forma antes de tocar el proveedor", async () => {
    const { asistente, recibidos } = asistenteEspia();
    expect(await conversarConAsistente({ asistente }, { conversacionId: "x", perfilId: null, texto: "hola" })).toEqual({ ok: false, motivo: "CONVERSACION_INVALIDA" });
    expect(await conversarConAsistente({ asistente }, { conversacionId: "web_12345678", perfilId: null, texto: "   " })).toEqual({ ok: false, motivo: "TEXTO_VACIO" });
    expect(await conversarConAsistente({ asistente }, { conversacionId: "web_12345678", perfilId: null, texto: "a".repeat(1501) })).toEqual({ ok: false, motivo: "TEXTO_LARGO" });
    expect(await conversarConAsistente({ asistente }, { conversacionId: "web_12345678", perfilId: "HOGAR", texto: "hola" })).toEqual({ ok: false, motivo: "PERFIL_DESCONOCIDO" });
    expect(recibidos).toHaveLength(0);
  });

  it("un dato sensible NO llega al proveedor y responde el texto fijo", async () => {
    const { asistente, recibidos } = asistenteEspia();
    const r = await conversarConAsistente({ asistente }, { conversacionId: "web_12345678", perfilId: "VIDA_ONCOLOGICO", texto: "Tengo cáncer y mi cédula es 4.523.118" });
    expect(r).toEqual({ ok: true, bloqueado: true, categorias: ["cedula", "salud"], texto: TEXTO_ENTRADA_BLOQUEADA });
    expect(recibidos).toHaveLength(0);
  });

  it("un texto limpio viaja con el perfil del producto y devuelve la respuesta", async () => {
    const { asistente, recibidos } = asistenteEspia();
    const r = await conversarConAsistente({ asistente }, { conversacionId: "web_12345678", perfilId: "VIDA", texto: "¿Qué planes hay?" });
    expect(r).toMatchObject({ ok: true, texto: "respuesta", derivacion: false });
    expect(recibidos).toEqual([{ conversacionId: "web_12345678", perfilId: "VIDA", texto: "¿Qué planes hay?" }]);
  });

  it("quita caracteres de control y BIDI antes de evaluar", async () => {
    const { asistente, recibidos } = asistenteEspia();
    await conversarConAsistente({ asistente }, { conversacionId: "web_12345678", perfilId: null, texto: "hola\u202e mundo\u0007 " });
    expect(recibidos[0]?.texto).toBe("hola mundo");
  });

  it("solo reconoce los productos del catálogo como perfil", () => {
    expect(esPerfilConocido("VIDA_ONCOLOGICO")).toBe(true);
    expect(esPerfilConocido("RESPONSABILIDAD_CIVIL")).toBe(true);
    expect(esPerfilConocido("AUTO")).toBe(false);
  });
});
