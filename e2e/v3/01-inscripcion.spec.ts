/**
 * Flujo v3 · Lote F2 — la página `/inscripcion` y su mecánica nueva.
 *
 * Cubre lo que **no existe** en el flujo v2: la puerta de T&C que crea el
 * expediente (DI-10), el gating de secciones en cascada y las redirecciones
 * 308 de las rutas v2. El recorrido completo del paso 1 (capturas de
 * identidad + OTP + aceptación agrupada) reutiliza pantallas ya cubiertas por
 * la batería histórica y se incorpora acá cuando el flujo v3 sea recorrible
 * de punta a punta (lotes F3–F6); mientras tanto se verifica a mano por
 * navegador (bitácora del lote F2).
 */
import { expect, test } from "@playwright/test";
import { esperarHidratacion } from "../support/flujo";

test("las rutas v2 redirigen 308 a la página larga que absorbió su contenido", async ({
  page,
}) => {
  for (const [vieja, nueva] of [
    ["/whatsapp", "/inscripcion"],
    ["/preparacion", "/inscripcion"],
    ["/identidad", "/inscripcion"],
    ["/plan", "/seguro"],
  ] as const) {
    const respuesta = await page.request.get(vieja, { maxRedirects: 0 });
    expect(respuesta.status(), vieja).toBe(308);
    expect(respuesta.headers()["location"], vieja).toContain(nueva);
  }
});

test("la puerta de T&C crea el expediente y habilita la sección de identidad", async ({
  page,
}) => {
  await page.goto("/inscripcion");
  await esperarHidratacion(page);

  // Sin expediente: la puerta provisional de T&C, con el CTA apagado.
  const empezar = page.getByRole("button", { name: /empezar/i });
  await expect(empezar).toBeDisabled();

  await page.getByRole("checkbox").check();
  await expect(empezar).toBeEnabled();
  await empezar.click();

  // Con el expediente creado (INICIADO), la sección 1 queda activa…
  await expect(page.getByRole("heading", { name: /empecemos por tu cédula/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /tomar fotografía/i }).first()).toBeVisible();

  // …y las secciones 2 y 3 dicen qué falta, sin dibujarse.
  await expect(page.getByText("Se habilita cuando confirmes tus datos de identidad.")).toBeVisible();
  await expect(
    page.getByText("Se habilita cuando verifiques tu WhatsApp con el código."),
  ).toBeVisible();

  // La cookie sostiene el estado: recargar no vuelve a pedir los T&C.
  await page.reload();
  await expect(page.getByRole("heading", { name: /empecemos por tu cédula/i })).toBeVisible();
  await expect(page.getByText(/tocá acá para empezar/i)).toHaveCount(0);
});

test("el stepper anuncia el paso 1 de 3", async ({ page }) => {
  await page.goto("/inscripcion");
  await expect(page.getByText(/paso 1 de 3/i)).toBeVisible();
});
