import { expect, test } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { TEXTOS_MEDIOS_DE_PAGO_P7 } from "@/domain/textos-p7";
import { prepararEscenario } from "./support/demo-panel";
import {
  completarP5Aprobado,
  completarP6,
  completarPlan,
  completarPreparacion,
  completarWhatsapp,
  declararCorreo,
  enviarEnlaceYAbrir,
  enviarP6,
  firmarNormalmente,
} from "./support/flujo";

/**
 * Escenario 10 — **G2**: una tarjeta rechazada no encierra a la persona.
 *
 * Mientras hay una operación abierta, la pantalla de pago bloquea el botón y
 * el cambio de medio. Un rechazo que solo cortara el sondeo dejaría un error
 * correcto y **nada que hacer con él**: el trámite quedaría firmado, sin
 * cobrar y sin salida, que es justo el desenlace que G2 existe para impedir.
 * Acá se verifica que el botón vuelva, que el mensaje diga la razón del
 * proveedor, y que **el reintento cobre**.
 *
 * Se paga con **débito** a propósito: es el medio donde el rechazo de tarjeta
 * ocurre de verdad —la persona tipea sus datos en el formulario seguro de
 * Bancard y el emisor contesta que no— y donde `BANCARD_TARJETA_RECHAZADA`
 * reproduce el momento correcto. La palanca del panel distingue dos instantes
 * que no son dos intensidades: `BANCARD_TIMEOUT` corta **al abrir** y esta
 * corta **al terminar de pagar**.
 *
 * La mecánica del lado del servidor —qué estado queda, qué evidencia, qué le
 * pasa a la operación en Bancard— vive en
 * `src/domain/__tests__/pago-bancard-integracion.test.ts`, que corre en
 * segundos contra el adaptador real. Acá va solo lo que necesita un navegador.
 *
 * **G1 (la reversa al vencer) no se prueba acá a propósito:** exige agotar el
 * plazo dentro del recorrido completo por una garantía que el test de
 * integración ya verifica mirando la operación del lado de Bancard, y el
 * escenario 06 ya cubre la caducidad en pantalla. El E2E no agregaría nada
 * que se vea.
 *
 * Este escenario **nació en la batería v3** y se trajo acá cuando v4 pasó a
 * ser el flujo vigente (D-28): la pantalla de pago es la misma
 * —`FormularioPagoP7`—, así que lo único que cambia es el camino para llegar.
 */

const BOTON_DEBITO = TEXTOS_MEDIOS_DE_PAGO_P7.find((t) => t.medio === "TARJETA_DEBITO")?.botón;

test("una tarjeta rechazada no encierra a la persona: puede reintentar y cobrar", async ({
  page,
}) => {
  // El recorrido entero más los dos intentos de pago.
  test.setTimeout(300_000);

  if (!BOTON_DEBITO) throw new Error("TEXTOS_MEDIOS_DE_PAGO_P7 no trae el medio TARJETA_DEBITO.");

  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  // La palanca se consume en el primer intento, así que el segundo pasa: es la
  // demostración que hay que poder hacer en vivo.
  await prepararEscenario(page, {
    personaId: persona.id,
    fallas: ["BANCARD_TARJETA_RECHAZADA"],
  });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await declararCorreo(page, persona);
  await completarP5Aprobado(page);
  await completarP6(page, persona);
  await enviarP6(page, /\/firma$/);

  // No hay cobro sin firma (regla 6-bis, D-08): el medio de pago recién existe
  // del otro lado de esto.
  const idCode100 = await enviarEnlaceYAbrir(page);
  await firmarNormalmente(page, idCode100);
  await expect(page).toHaveURL(/\/pago$/);

  // ── Primer intento: la operación se abre bien ───────────────────────────
  // CHG-37 · sin esta casilla el botón queda deshabilitado.
  await page.locator("#p7-acepta-certificado").check();
  // El medio arranca en QR: hay que elegir débito, y el botón de pagar cambia
  // de rótulo con él (`TEXTOS_MEDIOS_DE_PAGO_P7`).
  await page.getByRole("radio", { name: "Tarjeta de débito" }).click();
  const pagar = page.getByRole("button", { name: BOTON_DEBITO });
  // Corto a propósito: si el rótulo cambiara, el spec tiene que fallar en
  // segundos y no consumir los 5 minutos del timeout del test.
  await expect(pagar).toBeEnabled({ timeout: 10_000 });
  await pagar.click();

  // Mientras la operación está abierta, la pantalla se bloquea entera.
  await expect(pagar).toBeDisabled();

  // ── El rechazo llega al terminar de pagar, no al abrir ──────────────────
  const datosDeEjemplo = page.getByRole("button", { name: /completar con datos de ejemplo/i });
  await expect(datosDeEjemplo).toBeVisible({ timeout: 15_000 });
  await datosDeEjemplo.click();
  await page.getByRole("button", { name: /^Pagar / }).click();

  // La razón la pone Bancard —código y descripción del proveedor— y el qué
  // hacer lo pone la pantalla.
  // Sigue siendo `role="alert"` —el mensaje tiene que anunciarse solo— pero
  // filtrado: Next monta su propio `role="alert"` vacío para anunciar cambios
  // de ruta (`__next-route-announcer__`), y sin el filtro Playwright corta por
  // ambigüedad antes de mirar el texto.
  const aviso = page.getByRole("alert").filter({ hasText: "Bancard" });
  await expect(aviso).toContainText(/Bancard rechazó el pago/i, { timeout: 15_000 });
  await expect(aviso).toContainText("Fondos insuficientes");
  await expect(aviso).toContainText("código 51");
  await expect(aviso).toContainText(/no se te cobró nada/i);

  // Lo que este test existe para probar: la pantalla vuelve a dejar pagar. Sin
  // esto el mensaje sería correcto y no habría nada que hacer con él.
  await expect(pagar).toBeEnabled();

  // ── El reintento cobra ──────────────────────────────────────────────────
  // Se espera la respuesta del POST y no solo el modal: si el reintento no
  // prospera, este `expect` dice **por qué** —con el cuerpo de la respuesta— en
  // vez de dejar al spec esperando un botón que nunca aparece. Fue lo que
  // destapó el rechazo no idempotente que devolvía `CONFLICTO_CONCURRENCIA`.
  const [apertura] = await Promise.all([
    page.waitForResponse(
      (respuesta) =>
        respuesta.url().includes("/api/p7/pago") && respuesta.request().method() === "POST",
      { timeout: 20_000 },
    ),
    pagar.click(),
  ]);
  expect(apertura.status(), await apertura.text()).toBe(200);

  const datosDeEjemploOtraVez = page.getByRole("button", {
    name: /completar con datos de ejemplo/i,
  });
  await expect(datosDeEjemploOtraVez).toBeVisible({ timeout: 15_000 });
  await datosDeEjemploOtraVez.click();
  await page.getByRole("button", { name: /^Pagar / }).click();

  await expect(page.getByRole("heading", { name: "Pago acreditado" })).toBeVisible({
    timeout: 20_000,
  });
});
