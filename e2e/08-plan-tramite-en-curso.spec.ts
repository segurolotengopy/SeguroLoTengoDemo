import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { PLANES } from "@/domain/catalogo";
import { TEXTOS_02 } from "@/domain/v4/textos-plan";
import { prepararEscenario } from "./support/demo-panel";
import { clickearHidratado, completarPlan, completarWhatsapp, esperarHidratacion } from "./support/flujo";

/**
 * Escenario 8 — volver al catálogo con un trámite ya empezado (v4).
 *
 * **Divergencia importante respecto de v2, reportada a Andres.** v2 tenía
 * `TramiteEnOtroPaso` (`src/components/shared/TramiteEnOtroPaso.tsx`) y la
 * pregunta `expedienteEnOtroPaso` / `tramiteQueYaPasoEstePaso`, evaluadas **en
 * el servidor antes de dibujar** el catálogo: con el canal ya verificado, la
 * pantalla directamente no mostraba el formulario y ofrecía un enlace
 * "Continuá desde donde quedaste". Al apagarse v2 (rama `v4/encendido`,
 * 16-sep-2026) esos dos archivos y `_reencaminado.ts` se borraron, y
 * `/plan` en v4 (`src/app/(flujo)/plan/page.tsx`) siempre devuelve
 * `<Pantalla02 />` sin ninguna consulta previa al expediente. **Ninguna otra
 * pantalla de v4 quedó con guardia de render tampoco** — mismo patrón en
 * `/whatsapp`, `/preparacion`, `/identidad`, `/declaraciones`, `/pago` y
 * `/confirmacion`.
 *
 * Lo que **sí** sigue intacto es la máquina de estados del lado del servidor:
 * `POST /api/p2/plan` solo acepta elegir plan desde `INICIADO` o
 * `PLAN_SELECCIONADO` (`puedeElegirPlan`), y cuando el expediente ya pasó ese
 * paso responde `ok:false` con `destino.ruta` — que `Pantalla02.continuar()`
 * usa para reencaminar en el cliente en vez de mostrar un error sin salida.
 * Es esa garantía, y no la de la pantalla, la que este escenario verifica
 * ahora: **elegir de nuevo el plan nunca revienta el trámite**, ni antes ni
 * después de verificar el canal — antes porque es una corrección legítima,
 * después porque el servidor redirige.
 */
test("re-elegir el plan es idempotente antes de verificar el canal, y reencamina después", async ({
  page,
}) => {
  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id });

  await completarPlan(page, persona);
  const nombrePlan = PLANES[persona.planElegido].nombre;

  // 1 · PLAN_SELECCIONADO: volver a `/plan` y elegir de nuevo el mismo plan es
  // una corrección legítima previa a la autorización del canal.
  await page.goto("/plan");
  await esperarHidratacion(page);
  await page.getByRole("radio", { name: `Elegir el plan ${nombrePlan}`, exact: true }).click();
  await clickearHidratado(page.getByRole("button", { name: TEXTOS_02.continuar, exact: true }));
  await expect(page).toHaveURL(/\/whatsapp$/);

  await completarWhatsapp(page, persona);

  // 2 · CANAL_WA_VERIFICADO: el catálogo se sigue dibujando (gap de v4, ver
  // más arriba), pero el servidor ya no deja re-elegir. La pantalla no se
  // queda mostrando un error: usa el `destino` de la respuesta para llevar a
  // la persona a donde quedó el trámite.
  await page.goto("/plan");
  await esperarHidratacion(page);
  await page.getByRole("radio", { name: `Elegir el plan ${nombrePlan}`, exact: true }).click();
  await page.getByRole("button", { name: TEXTOS_02.continuar, exact: true }).click();
  await expect(page).toHaveURL(/\/preparacion$/, { timeout: 15_000 });
});
