import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { TEXTOS_REVISION_MANUAL } from "@/domain/v4/textos-actividad";
import { prepararEscenario } from "./support/demo-panel";
import {
  completarActividadV4,
  completarDatosPersonalesV4,
  completarIdentidadAprobada,
  completarPlan,
  completarPreparacion,
  completarWhatsapp,
  leerNumeroCasoV4,
} from "./support/flujo";

/**
 * Escenario 2 — Bloqueo por PEP (v4).
 *
 * En 03E, la condición PEP responde "Sí" → deriva directo a `/revision-manual`
 * (arte `03E2`) sin pasar por 04A, 04D, 04E, 05A ni 05B. `DERIVADO_MANUAL` es
 * terminal en el flujo digital (regla inviolable #5): no existe transición
 * desde ahí hacia pago, firma ni emisión — `src/domain/expediente.ts` no le da
 * ninguna arista de salida.
 *
 * A diferencia de v2, la condición PEP ya no vive entre las declaraciones de
 * 04A: se pregunta en 03E, antes de llegar a los datos de salud, así que la
 * derivación ocurre sin que la persona haya visto la pantalla de declaraciones.
 *
 * Con Ramón Elías Duarte Villalba (C.I. 3.874.512), que además trae
 * beneficiario designado (100% a una persona) en vez de herederos legales —
 * ese dato no llega a completarse acá porque la derivación es anterior a 04A.
 */
test("condición PEP = Sí deriva a revisión manual, sin pago ni firma", async ({ page }) => {
  const persona = obtenerPersonaDemo("pep-positivo");
  if (!persona) throw new Error("Fixture 'pep-positivo' no encontrado en personas.ts.");
  expect(persona.declaraciones.condicionPep, "el fixture debe traer PEP = Sí").toBe("SI");

  await prepararEscenario(page, { personaId: persona.id });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await completarIdentidadAprobada(page, persona);
  await completarDatosPersonalesV4(page);
  await completarActividadV4(page, { esPep: true });

  // Pantalla A (03E2) · Emisión no automática — fuera de las cinco etapas.
  await expect(page.getByText(TEXTOS_REVISION_MANUAL.porMotivo.PEP.tarjetaTitulo)).toBeVisible();
  await expect(page.getByText(TEXTOS_REVISION_MANUAL.enRevision).first()).toBeVisible();
  await expect(page.getByText(TEXTOS_REVISION_MANUAL.filas.firma.concepto, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_REVISION_MANUAL.filas.firma.estado, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_REVISION_MANUAL.filas.pago.estado, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_REVISION_MANUAL.filas.cobertura.estado, { exact: true })).toBeVisible();

  // Se generó un número de caso, distinto del correlativo de una propuesta.
  const numeroCaso = await leerNumeroCasoV4(page);
  expect(numeroCaso).not.toMatch(/^PROP-/);
  expect(numeroCaso.length).toBeGreaterThan(0);

  await expect(page.getByText(TEXTOS_REVISION_MANUAL.avisoCanales)).toBeVisible();

  // No hay transición de DERIVADO_MANUAL hacia pago, firma ni emisión: las
  // tres pantallas siguientes existen como ruta, pero sus APIs rechazan
  // operar sobre este expediente. Es la verificación real de la regla
  // inviolable #5 — la URL no redirige sola (no hay guard de enrutamiento),
  // lo que la bloquea es la máquina de estados del dominio.
  for (const ruta of ["/api/p7/resumen", "/api/p8/resumen", "/api/p9/resumen"]) {
    const respuesta = await page.request.get(ruta);
    expect(respuesta.status(), `${ruta} debería rechazar un expediente DERIVADO_MANUAL`).toBe(409);
    const cuerpo = (await respuesta.json()) as { ok?: boolean; motivo?: string };
    expect(cuerpo.ok).toBe(false);
    expect(cuerpo.motivo).toBe("ESTADO_INVALIDO");
  }

  // CHG-47 · el caso se remitió a Alianza **solo**, al derivarse. Se comprueba
  // en el visor de evidencia del panel, que es donde el registro se puede leer.
  await page.goto("/demo-panel");
  const remision = page.locator("li", { hasText: "ADMIN_ENVIO_CASO_ALIANZA" }).first();
  await expect(remision, "la derivación no remitió el caso a Alianza").toBeVisible();
  await expect(remision).toContainText("origen=AUTOMATICA");
  await expect(remision).toContainText(numeroCaso);
  // Regla inviolable #7: la remisión es una comunicación saliente y no lleva
  // el motivo de la derivación ni nada de la persona.
  await expect(remision).not.toContainText("PEP");
});
