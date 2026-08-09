/**
 * Puerta de entrada a la consola administrativa
 * (`docs/CONSOLA_ADMINISTRATIVA.md` §2).
 *
 * Mismo patrón que `/demo-panel/_sesion.ts`, con dos diferencias deliberadas:
 *
 * 1. **Flag propio**, `ADMIN_CONSOLE_ENABLED`, no `DEMO_MODE`. La consola es
 *    una herramienta de staff que en algún momento va a existir en entornos
 *    donde el panel de demo no debe existir; atarlas al mismo flag obligaría a
 *    encender el panel para poder auditar.
 * 2. **Clave propia**, `ADMIN_CONSOLE_KEY`. La consola puede crear expedientes
 *    y levantar el bloqueo por cédula; el panel de demo no puede hacer nada de
 *    eso. Compartir secreto haría imposible revocar uno sin el otro.
 *
 * **Sin roles todavía** (§2 del documento): quien tiene la clave puede
 * consultar y también autorizar reinicios. El control granular —solo lectura
 * vs. puede reiniciar, usuarios nominales— queda diferido a producción y está
 * anotado en el documento como pendiente.
 *
 * La cookie no guarda la clave sino un HMAC calculado con ella como secreto, y
 * se compara con `timingSafeEqual`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { obtenerAdminConsoleKey } from "@/repositories/secrets-client";

export const COOKIE_CONSOLA = "slt_admin_consola";

/** Vida de la sesión: 1 hora, igual que el panel de demo. */
export const VIDA_SESION_CONSOLA_SEGUNDOS = 60 * 60;

function tokenDeSesion(clave: string): string {
  return createHmac("sha256", clave).update("admin-consola-sesion-v1", "utf8").digest("hex");
}

export function consolaHabilitada(): boolean {
  return process.env.ADMIN_CONSOLE_ENABLED === "true";
}

function comparacionConstante(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export async function autenticarConsola(claveIngresada: string): Promise<string | null> {
  const clave = await obtenerAdminConsoleKey();
  if (!comparacionConstante(claveIngresada, clave)) return null;
  return tokenDeSesion(clave);
}

export async function sesionConsolaValida(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const clave = await obtenerAdminConsoleKey();
  return comparacionConstante(token, tokenDeSesion(clave));
}
