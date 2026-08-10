import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { prepararEscenario } from "./support/demo-panel";
import {
  completarP1,
  completarP2,
  completarP3,
  completarP4,
  completarP5Aprobado,
  completarP6,
  enviarP6,
} from "./support/flujo";

/**
 * Escenario 3 — Bloqueo por salud incompatible.
 *
 * En P6, las declaraciones 1 (Estado de salud = No, en vez de Sí), 2
 * (Antecedentes de contratación = Sí) y 3 (Enfermedades diagnosticadas = Sí)
 * son incompatibles a la vez → mismo resultado que el escenario de PEP:
 * Pantalla A, sin pasar por P7/P8/P9, estado terminal DERIVADO_MANUAL.
 *
 * Con Carolina Beatriz Ayala Benítez (C.I. 5.612.908).
 */
test("declaraciones de salud incompatibles derivan a Pantalla A, sin pago ni firma", async ({ page }) => {
  const persona = obtenerPersonaDemo("salud-incompatible");
  if (!persona) throw new Error("Fixture 'salud-incompatible' no encontrado en personas.ts.");
  expect(persona.declaraciones.estadoDeSalud, "declaración 1 debe ser incompatible (No)").toBe("NO");
  expect(persona.declaraciones.antecedentesDeContratacion, "declaración 2 debe ser incompatible (Sí)").toBe("SI");
  expect(persona.declaraciones.enfermedadesDiagnosticadas, "declaración 3 debe ser incompatible (Sí)").toBe("SI");

  await prepararEscenario(page, { personaId: persona.id });

  await completarP1(page, persona);
  await completarP2(page, persona);
  await completarP3(page);
  await completarP4(page, persona);
  await completarP5Aprobado(page);
  await completarP6(page, persona);
  await enviarP6(page, /\/revision-manual$/);

  // Pantalla A · Emisión no automática — mismo desenlace terminal que la PEP.
  await expect(page.getByText("Tu solicitud requiere una revisión adicional")).toBeVisible();
  await expect(page.getByText("EN ANÁLISIS")).toBeVisible();
  await expect(page.getByText("No se generó una póliza ni se inició su emisión.")).toBeVisible();
  await expect(page.getByText("No se solicitó ninguna firma de contratación.")).toBeVisible();
  await expect(page.getByText("No se realizó ni se autorizó ningún pago.")).toBeVisible();

  // El motivo mostrado no expone las respuestas médicas concretas (regla
  // inviolable #7): la pantalla solo dice la categoría gruesa.
  const motivo = await page.locator("dd", { hasText: /Salud|PEP/ }).first().textContent();
  expect(motivo).toBeTruthy();
  expect(motivo).not.toContain("cáncer");
  expect(motivo).not.toContain("diabetes");

  // Terminal: las tres pantallas siguientes rechazan operar sobre este expediente.
  for (const ruta of ["/api/p7/resumen", "/api/p8/resumen", "/api/p9/resumen"]) {
    const respuesta = await page.request.get(ruta);
    expect(respuesta.status(), `${ruta} debería rechazar un expediente DERIVADO_MANUAL`).toBe(409);
    const cuerpo = (await respuesta.json()) as { ok?: boolean; motivo?: string };
    expect(cuerpo.ok).toBe(false);
    expect(cuerpo.motivo).toBe("ESTADO_INVALIDO");
  }
});
