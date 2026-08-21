import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import {
  BOTON_CONTINUAR_PLAN,
  TITULO_TRAMITE_EN_OTRO_PASO,
} from "@/domain/textos-plan";
import { prepararEscenario } from "./support/demo-panel";
import { completarPlan, completarWhatsapp, esperarHidratacion } from "./support/flujo";

/**
 * Escenario 8 — volver al catálogo con un trámite ya empezado.
 *
 * La máquina de estados admite elegir plan solo desde `INICIADO` y desde
 * `PLAN_SELECCIONADO` (el enlace `Cambiar plan`). Hasta acá la pantalla no
 * miraba nada: dejaba elegir y recién el envío contestaba *"Este proceso ya no
 * está en el paso de selección de plan"*, un rechazo cierto y sin salida.
 *
 * Lo que se verifica es el cambio de momento —se pregunta antes de dibujar, no
 * después de elegir— y las dos caras del mismo hecho:
 *
 * 1. Con el plan elegido y el canal sin verificar, el catálogo sigue abierto:
 *    cambiar de plan es una corrección legítima previa a la autorización.
 * 2. Con el WhatsApp ya verificado, el catálogo se reemplaza por el camino de
 *    vuelta al paso donde quedó el trámite.
 */
test("volver al catálogo con el trámite avanzado reencamina en vez de rechazar", async ({
  page,
}) => {
  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id });

  await completarPlan(page, persona);

  // 1 · PLAN_SELECCIONADO: el catálogo sigue disponible (`Cambiar plan`).
  await page.goto("/plan");
  await esperarHidratacion(page);
  await expect(page.getByRole("button", { name: BOTON_CONTINUAR_PLAN })).toBeVisible();
  await expect(page.getByText(TITULO_TRAMITE_EN_OTRO_PASO)).toHaveCount(0);

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);

  // 2 · CANAL_WA_VERIFICADO: el trámite pasó este paso.
  await page.goto("/plan");
  await expect(page.getByText(TITULO_TRAMITE_EN_OTRO_PASO)).toBeVisible();
  // Ya no hay nada que elegir: el rechazo dejó de ser alcanzable porque el
  // formulario que lo producía no se dibuja.
  await expect(page.getByRole("button", { name: BOTON_CONTINUAR_PLAN })).toHaveCount(0);

  // El destino lo decide `destinoDelExpediente`, no la pantalla: desde
  // CANAL_WA_VERIFICADO se sigue en la preparación.
  const volver = page.getByRole("link", { name: /Continuá desde donde quedaste/ });
  await expect(volver).toBeVisible();
  await volver.click();
  await expect(page).toHaveURL(/\/preparacion$/);
});
