import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { TEXTOS_REVISION_MANUAL } from "@/domain/v4/textos-actividad";
import { prepararEscenario } from "./support/demo-panel";
import {
  completarActividadV4,
  completarDatosPersonalesV4,
  completarDeclaracionesV4,
  completarIdentidadAprobada,
  completarPlan,
  completarPreparacion,
  completarWhatsapp,
} from "./support/flujo";

/**
 * Escenario 3 — Bloqueo por salud incompatible (v4).
 *
 * En 04A, las tres declaraciones de salud (D-33: estado de salud = No en vez
 * de Sí, antecedentes de contratación = Sí y enfermedades diagnosticadas = Sí)
 * son incompatibles a la vez → mismo resultado que el escenario de PEP:
 * `/revision-manual` (arte `04A1`), sin pasar por 04D/04E/05A/05B, estado
 * terminal `DERIVADO_MANUAL`.
 *
 * Con Carolina Beatriz Ayala Benítez (C.I. 5.612.908).
 */
test("las tres declaraciones de salud incompatibles derivan a revisión manual, sin pago ni firma", async ({
  page,
}) => {
  const persona = obtenerPersonaDemo("salud-incompatible");
  if (!persona) throw new Error("Fixture 'salud-incompatible' no encontrado en personas.ts.");
  expect(persona.declaraciones.estadoDeSalud, "declaración 1 debe ser incompatible (No)").toBe("NO");
  expect(
    persona.declaraciones.antecedentesDeContratacion,
    "declaración 2 debe ser incompatible (Sí)",
  ).toBe("SI");
  expect(
    persona.declaraciones.enfermedadesDiagnosticadas,
    "declaración 3 debe ser incompatible (Sí)",
  ).toBe("SI");
  expect(persona.declaraciones.condicionPep, "el fixture no debe traer PEP para aislar el motivo").toBe(
    "NO",
  );

  await prepararEscenario(page, { personaId: persona.id });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await completarIdentidadAprobada(page, persona);
  await completarDatosPersonalesV4(page);
  await completarActividadV4(page, { esPep: false });
  await completarDeclaracionesV4(page, persona, /\/revision-manual$/);

  // Pantalla A (04A1) · Emisión no automática — mismo desenlace terminal que la PEP.
  await expect(page.getByText(TEXTOS_REVISION_MANUAL.porMotivo.SALUD.tarjetaTitulo)).toBeVisible();
  await expect(
    page.getByText(TEXTOS_REVISION_MANUAL.porMotivo.SALUD.filaEstado, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(TEXTOS_REVISION_MANUAL.enRevision).first()).toBeVisible();
  await expect(page.getByText(TEXTOS_REVISION_MANUAL.filas.firma.estado, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_REVISION_MANUAL.filas.pago.estado, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_REVISION_MANUAL.filas.cobertura.estado, { exact: true })).toBeVisible();

  // Regla inviolable #7: la pantalla nunca interpola una respuesta médica
  // concreta — el texto es siempre el mismo genérico, sin importar el motivo.
  const cuerpo = (await page.locator("main, body").first().innerText()).toLowerCase();
  expect(cuerpo).not.toContain("cáncer");
  expect(cuerpo).not.toContain("diabetes");

  // Terminal: las tres pantallas siguientes rechazan operar sobre este expediente.
  for (const ruta of ["/api/p7/resumen", "/api/p8/resumen", "/api/p9/resumen"]) {
    const respuesta = await page.request.get(ruta);
    expect(respuesta.status(), `${ruta} debería rechazar un expediente DERIVADO_MANUAL`).toBe(409);
    const cuerpoRespuesta = (await respuesta.json()) as { ok?: boolean; motivo?: string };
    expect(cuerpoRespuesta.ok).toBe(false);
    expect(cuerpoRespuesta.motivo).toBe("ESTADO_INVALIDO");
  }

  // CHG-47 · la derivación por salud (04A) también remite el caso a Alianza
  // sola, igual que la PEP de 03E. Se comprueba en el visor de evidencia del
  // panel; regla #7: la remisión no lleva el motivo ni nada de la persona.
  await page.goto("/demo-panel");
  const remision = page.locator("li", { hasText: "ADMIN_ENVIO_CASO_ALIANZA" }).first();
  await expect(remision, "la derivación no remitió el caso a Alianza").toBeVisible();
  await expect(remision).toContainText("origen=AUTOMATICA");
  const textoRemision = (await remision.innerText()).toLowerCase();
  expect(textoRemision).not.toContain("salud");
  expect(textoRemision).not.toContain(persona.identidad.apellidos.toLowerCase());
});
