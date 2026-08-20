import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { prepararEscenario } from "./support/demo-panel";
import {
  completarWhatsapp,
  completarPlan,
  completarPreparacion,
  declararCorreo,
  completarP5Aprobado,
  completarP6,
  completarP7Qr,
  continuarAFirma,
  enviarEnlaceYAbrir,
  enviarP6,
  firmarNormalmente,
} from "./support/flujo";

/**
 * Escenario 1 — Camino feliz completo.
 *
 * P0 → P1 (OTP celular) → P2 (CONFÍO+) → P3 (checklist + consentimiento) →
 * P4 (OTP correo) → P5 (identidad aprobada) → P6 (las ocho declaraciones
 * compatibles) → P7 (pago QR) → P8 (firma Code100) → P9 (contratación
 * aceptada), con Mónica Mariana Gorena Tapia (C.I. 9.323.336).
 *
 * P9 tiene que mostrar `Solicitud aceptada ✓` junto a `Póliza en preparación
 * ⋯`: son dos hitos distintos (aceptación de la solicitud vs. estado del
 * documento, que mueve Alianza a su ritmo) — CLAUDE.md, "Máquina de estados
 * del expediente".
 */
test("camino feliz P0→P9 con Mónica Gorena Tapia", async ({ page }) => {
  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id });

  await page.goto("/");
  await expect(page.getByText("La contratación comienza recién en el paso 1.")).toBeVisible();
  // La puerta de entrada lleva ahora al catálogo, que es el paso 1 (CHG-01).
  await page.getByRole("link", { name: "Elegí tu plan y cotizá →" }).click();
  await expect(page).toHaveURL(/\/plan$/);

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await declararCorreo(page, persona);
  await completarP5Aprobado(page);
  await completarP6(page, persona);
  await enviarP6(page, /\/pago$/);
  await completarP7Qr(page);
  await continuarAFirma(page);

  const idCode100 = await enviarEnlaceYAbrir(page);
  await firmarNormalmente(page, idCode100);

  // P9 · Paso 9 de 9 — Contratación aceptada.
  await expect(page).toHaveURL(/\/confirmacion$/);
  await expect(page.getByText("¡Tu solicitud de seguro fue aceptada!")).toBeVisible();

  const hitoSolicitud = page.locator("li", { hasText: "Solicitud aceptada" });
  await expect(hitoSolicitud.getByText("✓", { exact: false })).toBeVisible();

  const hitoPoliza = page.locator("li", { hasText: "Póliza en preparación" });
  await expect(hitoPoliza).toBeVisible();
  await expect(hitoPoliza.getByText("⋯", { exact: false })).toBeVisible();

  await expect(page.getByText("ACEPTADA", { exact: true })).toBeVisible();
  await expect(page.getByText("No se genera Nota de Cobertura.")).toBeVisible();
});
