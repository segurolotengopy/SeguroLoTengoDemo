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
 * Escenario 2 — Bloqueo por PEP.
 *
 * En P6, declaración 8 (Condición PEP) = "Sí" → deriva a Pantalla A
 * (`/revision-manual`) sin pasar por P7, P8 ni P9. `DERIVADO_MANUAL` es
 * terminal en el flujo digital (regla inviolable #5): no existe transición
 * desde ahí hacia pago, firma ni emisión — `src/domain/expediente.ts` no le da
 * ninguna arista de salida.
 *
 * Con Ramón Elías Duarte Villalba (C.I. 3.874.512), que además trae
 * beneficiario designado (100% a una persona) en vez de herederos legales.
 */
test("declaración PEP = Sí deriva a Pantalla A, sin pago ni firma", async ({ page }) => {
  const persona = obtenerPersonaDemo("pep-positivo");
  if (!persona) throw new Error("Fixture 'pep-positivo' no encontrado en personas.ts.");
  expect(persona.declaraciones.condicionPep, "el fixture debe traer PEP = Sí").toBe("SI");

  await prepararEscenario(page, { personaId: persona.id });

  await completarP1(page, persona);
  await completarP2(page, persona);
  await completarP3(page);
  await completarP4(page, persona);
  await completarP5Aprobado(page);
  await completarP6(page, persona);
  await enviarP6(page, /\/revision-manual$/);

  // Pantalla A · Emisión no automática — fuera del contador de 9 pasos.
  await expect(page.getByText("Tu solicitud requiere una revisión adicional")).toBeVisible();
  await expect(page.getByText("No se inició la emisión")).toBeVisible();
  await expect(page.getByText("No se generó una póliza ni se inició su emisión.")).toBeVisible();
  await expect(page.getByText("No se solicitó ninguna firma de contratación.")).toBeVisible();
  await expect(page.getByText("No se realizó ni se autorizó ningún pago.")).toBeVisible();

  // Se generó un número de caso, distinto del correlativo de una propuesta.
  // `ResumenDelCaso` lo trae por `GET /api/expediente/caso` de forma
  // asíncrona: hay que esperar con una aserción que reintente, no leer
  // `textContent()` una sola vez apenas se pinta el "—" inicial.
  await expect(page.getByText("EN ANÁLISIS")).toBeVisible();
  const numeroCasoLocator = page.locator("dd.font-mono.text-base.font-bold").first();
  await expect(numeroCasoLocator).not.toHaveText("—");
  const numeroCaso = await numeroCasoLocator.textContent();
  expect(numeroCaso?.trim()).not.toMatch(/^PROP-/);

  // Regla del sistema: no hay camino de vuelta a pago, firma ni emisión.
  await expect(
    page.getByText(
      "Desde este estado el proceso digital no continúa a pago mediante Bancard, ni a firma mediante " +
        "Code100, ni a emisión mediante SEBAOT.",
    ),
  ).toBeVisible();

  // No hay transición de DERIVADO_MANUAL hacia pago, firma ni emisión: las
  // tres pantallas siguientes existen como ruta, pero sus APIs rechazan
  // operar sobre este expediente. Es la verificación real de la regla
  // inviolable #5 — la URL de P7/P8/P9 no redirige sola (no hay guard de
  // enrutamiento), lo que la bloquea es la máquina de estados del dominio.
  for (const ruta of ["/api/p7/resumen", "/api/p8/resumen", "/api/p9/resumen"]) {
    const respuesta = await page.request.get(ruta);
    expect(respuesta.status(), `${ruta} debería rechazar un expediente DERIVADO_MANUAL`).toBe(409);
    const cuerpo = (await respuesta.json()) as { ok?: boolean; motivo?: string };
    expect(cuerpo.ok).toBe(false);
    expect(cuerpo.motivo).toBe("ESTADO_INVALIDO");
  }
});
