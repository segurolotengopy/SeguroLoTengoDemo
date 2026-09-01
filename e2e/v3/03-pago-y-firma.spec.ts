/**
 * Flujo v3 · Lote F4b — la página `/pago-y-firma` y su mecánica propia.
 *
 * Molde de los specs 01/02: cubre lo que no existe en v2 (los redirects de
 * `/firma` y `/pago`, la puerta sin trámite, el stepper de 3). El recorrido
 * completo del acto de firma interno está cubierto por unidad
 * (`src/domain/__tests__/firma-cliente.test.ts`, de la rama mergeada en F4a)
 * y el circuito entero entra al E2E cuando el flujo cierre (F5–F6).
 */
import { expect, test } from "@playwright/test";

test("/firma y /pago redirigen 308 a /pago-y-firma", async ({ page }) => {
  for (const vieja of ["/firma", "/pago"] as const) {
    const respuesta = await page.request.get(vieja, { maxRedirects: 0 });
    expect(respuesta.status(), vieja).toBe(308);
    expect(respuesta.headers()["location"], vieja).toContain("/pago-y-firma");
  }
});

test("sin trámite listo para firmar, ofrece la puerta a la inscripción", async ({ page }) => {
  await page.goto("/pago-y-firma");
  await expect(page.getByRole("link", { name: /empezá tu inscripción/i })).toBeVisible();
  // El encabezado dice el orden del paso: primero la firma, después el pago.
  await expect(page.getByText(/firmás primero y pagás después/i)).toBeVisible();
});

test("la banda de pasos marca el paso 3 como actual", async ({ page }) => {
  await page.goto("/pago-y-firma");
  // El canvas dibuja los tres pasos a lo ancho y marca el actual con
  // `aria-current`, en vez del rótulo «Paso N de 3» que tenía esta
  // implementación y el diseño nunca tuvo.
  const banda = page.getByRole("navigation", { name: "Progreso" });
  await expect(banda).toBeVisible();
  await expect(banda.locator('[aria-current="step"]')).toContainText("Pagá y firmá");
});
