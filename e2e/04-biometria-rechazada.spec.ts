import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { prepararEscenario } from "./support/demo-panel";
import { completarCapturasP5, completarWhatsapp, completarPlan, completarPreparacion, declararCorreo } from "./support/flujo";

/**
 * Escenario 4 — Rechazo de biometría en P5.
 *
 * La selfie no coincide con la cédula (`coincidenciaFacialAprobada: false`
 * en el fixture) → el flujo no debe permitir avanzar a P6. Los campos
 * extraídos por OCR están bloqueados (candado, `readOnly`); el único camino
 * ante la discrepancia es repetir la captura, nunca editar a mano.
 *
 * Con Julio César Ramírez Cabral (C.I. 4.209.336): sus declaraciones son
 * compatibles a propósito — lo que lo frena acá es la biometría, no la
 * elegibilidad (docs/ESPECIFICACION_DEMO.md).
 */
test("selfie que no coincide con la cédula no deja avanzar a P6", async ({ page }) => {
  const persona = obtenerPersonaDemo("biometria-rechazada");
  if (!persona) throw new Error("Fixture 'biometria-rechazada' no encontrado en personas.ts.");
  expect(
    persona.identidad.captura.coincidenciaFacialAprobada,
    "el fixture debe traer la coincidencia facial rechazada",
  ).toBe(false);

  await prepararEscenario(page, { personaId: persona.id });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await declararCorreo(page, persona);

  await completarCapturasP5(page);

  // El botón de continuar sigue deshabilitado: la coincidencia facial no se
  // cumplió y la pantalla no ofrece ningún otro camino hacia P6.
  const continuar = page.getByRole("button", { name: "Validar identidad y continuar →" });
  await expect(continuar).toBeDisabled();

  // Los campos extraídos por OCR están bloqueados: candado + readOnly, y no
  // hay ningún input editable para "corregir" el resultado a mano.
  const numeroCedula = page.locator("#p5-numeroCedula");
  await expect(numeroCedula).toHaveAttribute("readonly", "");
  await expect(numeroCedula).toHaveValue(persona.identidad.numeroCedula);

  // El único camino ofrecido es repetir la captura.
  await expect(page.getByRole("button", { name: "Repetir captura" })).toBeVisible();

  // Intentar forzar el paso a P6 por la API también lo rechaza: el
  // expediente nunca llegó a IDENTIDAD_VERIFICADA.
  const resumenP6 = await page.request.post("/api/p6/declaraciones", {
    data: { datos: {}, declaraciones: {} },
  });
  expect(resumenP6.status()).not.toBe(200);
  await expect(page).toHaveURL(/\/identidad$/);
});
