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

test("el stepper anuncia el paso 2 de 3", async ({ page }) => {
  await page.goto("/seguro");
  await expect(page.getByText(/paso 2 de 3/i)).toBeVisible();
});
