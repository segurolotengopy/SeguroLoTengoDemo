/**
 * Puerta de entrada al panel de demo: modo demo + clave.
 *
 * Dos condiciones independientes, ambas obligatorias:
 *   1. `DEMO_MODE === "true"`. Si no, la ruta responde 404 — no existe.
 *   2. Conocer `DEMO_PANEL_KEY` (vive en Secrets Manager, no en el código ni
 *      en variables de entorno).
 *
 * La cookie de sesión NO guarda la clave: guarda un HMAC calculado con la
 * clave como secreto. Así el navegador nunca tiene el secreto en claro y la
 * cookie no se puede fabricar sin conocerlo. Se compara con `timingSafeEqual`.
 *
 * Archivo con guion bajo: App Router no lo enruta.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { obtenerDemoPanelKey } from "@/repositories/secrets-client";

export const COOKIE_PANEL = "slt_demo_panel";

/** Valor firmado que va en la cookie; no es la clave. */
function tokenDeSesion(clave: string): string {
  return createHmac("sha256", clave).update("demo-panel-sesion-v1", "utf8").digest("hex");
}

export function esModoDemo(): boolean {
  return process.env.DEMO_MODE === "true";
}

function comparacionConstante(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Verifica la clave ingresada y devuelve el token de cookie si es correcta. */
export async function autenticar(claveIngresada: string): Promise<string | null> {
  const clave = await obtenerDemoPanelKey();
  if (!comparacionConstante(claveIngresada, clave)) return null;
  return tokenDeSesion(clave);
}

/** Valida el token que trae la cookie contra el secreto vigente. */
export async function sesionValida(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const clave = await obtenerDemoPanelKey();
  return comparacionConstante(token, tokenDeSesion(clave));
}
