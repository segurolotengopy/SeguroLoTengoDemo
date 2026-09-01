/**
 * Flujo v3 · Lote F3 — la página `/seguro` y su mecánica propia.
 *
 * Igual que el spec de inscripción: cubre lo que no existe en v2 (la puerta
 * sin trámite, el stepper de 3, el redirect de `/declaraciones`). El
 * recorrido completo del paso 2 —plan, beneficiario, las 5 preguntas y la
 * derivación a asesor— está cubierto por unidad en
 * `src/domain/__tests__/declaraciones-v3.test.ts` y entra al E2E cuando el
 * flujo sea recorrible de punta a punta (F4–F6).
 */
import { expect, test } from "@playwright/test";

test("/declaraciones redirige 308 a /seguro", async ({ page }) => {
  const respuesta = await page.request.get("/declaraciones", { maxRedirects: 0 });
  expect(respuesta.status()).toBe(308);
  expect(respuesta.headers()["location"]).toContain("/seguro");
});

test("sin trámite empezado, /seguro ofrece la puerta a la inscripción", async ({ page }) => {
  await page.goto("/seguro");
  await expect(page.getByRole("link", { name: /empezá tu inscripción/i })).toBeVisible();
  // Las pestañas de ramos anuncian los productos por venir con la etiqueta v3.
  await expect(page.getByText("PRONTO").first()).toBeVisible();
});

test("la banda de pasos marca el paso 2 como actual", async ({ page }) => {
  await page.goto("/seguro");
  // El canvas dibuja los tres pasos a lo ancho y marca el actual con
  // `aria-current`, en vez del rótulo «Paso N de 3» que tenía esta
  // implementación y el diseño nunca tuvo.
  const banda = page.getByRole("navigation", { name: "Progreso" });
  await expect(banda).toBeVisible();
  await expect(banda.locator('[aria-current="step"]')).toContainText("Elegí tu seguro");
});
