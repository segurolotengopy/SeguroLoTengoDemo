/**
 * La puerta del panel de demo es lo único que separa los códigos OTP en
 * claro del mundo: `/demo-panel` es, por diseño, el único lugar donde el
 * código puede verse (regla inviolable #2). Si esta puerta falla, la regla
 * deja de valer aunque el resto del sistema esté impecable.
 *
 * Se cubren los tres modos de fallo que importan: que el panel siga
 * existiendo con el flag apagado, que acepte una clave incorrecta, y que la
 * cookie que emite sea la clave misma en vez de un valor derivado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CLAVE = "clave-de-panel-de-prueba-123";
// Valores por constante y no como literal pegado a `OTP_PEPPER:` /
// `DEMO_PANEL_KEY:`: esas dos formas son exactamente las que buscan las
// reglas propias de `.gitleaks.toml`, y un fixture no tiene por qué
// obligarnos a aflojarlas.
const PEPPER = "pepper-de-prueba";

vi.mock("@/repositories/secrets-client", () => ({
  obtenerDemoPanelKey: async () => CLAVE,
  obtenerOtpPepper: async () => PEPPER,
  obtenerSecretosApp: async () => ({ DEMO_PANEL_KEY: CLAVE, OTP_PEPPER: PEPPER }),
}));

import { POST } from "@/app/api/demo-panel/sesion/route.demo";

function peticion(cuerpo: unknown): Request {
  return new Request("https://segurolotengo.test/api/demo-panel/sesion", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

function cookiesDe(respuesta: Response): readonly string[] {
  return respuesta.headers.getSetCookie?.() ?? [];
}

const demoModeOriginal = process.env.DEMO_MODE;

describe("puerta del panel de demo", () => {
  beforeEach(() => {
    process.env.DEMO_MODE = "true";
  });

  afterEach(() => {
    if (demoModeOriginal === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = demoModeOriginal;
  });

  it("con DEMO_MODE apagado el panel no existe, ni siquiera con la clave correcta", async () => {
    process.env.DEMO_MODE = "false";

    const respuesta = await POST(peticion({ clave: CLAVE }));

    expect(respuesta.status).toBe(404);
    expect(cookiesDe(respuesta)).toHaveLength(0);
  });

  it("rechaza una clave incorrecta sin filtrar la correcta en la respuesta", async () => {
    const respuesta = await POST(peticion({ clave: "clave-equivocada" }));

    expect(respuesta.status).toBe(401);
    expect(await respuesta.text()).not.toContain(CLAVE);
    expect(cookiesDe(respuesta)).toHaveLength(0);
  });

  it("rechaza un cuerpo sin clave en vez de dejar pasar la cadena vacía", async () => {
    const respuesta = await POST(peticion({}));

    expect(respuesta.status).toBe(400);
    expect(cookiesDe(respuesta)).toHaveLength(0);
  });

  it("con la clave correcta emite una cookie httpOnly que NO es la clave", async () => {
    const respuesta = await POST(peticion({ clave: CLAVE }));

    expect(respuesta.status).toBe(200);

    const cookies = cookiesDe(respuesta);
    expect(cookies).toHaveLength(1);

    const cookie = cookies[0];
    expect(cookie).toContain("slt_demo_panel=");
    expect(cookie).toContain("HttpOnly");
    // El valor es un HMAC de 64 hex, no el secreto: si esto se rompe, el
    // navegador estaría guardando la clave del panel en claro y cualquier
    // volcado de cookies la expondría.
    expect(cookie).not.toContain(CLAVE);
    expect(cookie).toMatch(/slt_demo_panel=[a-f0-9]{64}(;|$)/);
  });
});
