import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { leerSesionFirmaDelPanel, prepararEscenario } from "./support/demo-panel";
import {
  completarWhatsapp,
  completarPlan,
  completarPreparacion,
  declararCorreo,
  completarP5Aprobado,
  completarP6,
  enviarEnlaceYAbrir,
  enviarP6,
} from "./support/flujo";

/**
 * Escenario 9 — El código de firma se puede reintentar: por error y a pedido.
 *
 * ## Por qué existe
 *
 * El paso 6 dejó de mandar un enlace y pasa a pedir el código en la pantalla
 * (21-ago-2026). Andres aceptó ese cambio **con una condición**: que se pueda
 * reintentar si hay un error, y que se pueda pedir otro código cuando la
 * persona quiera. Sin eso, equivocarse al tipear seis dígitos sería un callejón
 * sin salida — y equivocarse tipeando seis dígitos es lo más normal del mundo.
 *
 * Verificar eso destapó que los mensajes de esta pantalla **no correspondían a
 * los motivos que el servidor devuelve**: de los ocho posibles, el mapa acertaba
 * dos, y el resto caía en un genérico que no decía qué hacer. Este escenario
 * fija los dos caminos y, de paso, que el texto sea el correcto y no el
 * comodín.
 *
 * ## Qué prueba, en orden
 *
 * 1. Un código equivocado **no cierra nada**: avisa qué pasó y cuántos intentos
 *    quedan.
 * 2. *Pedir un código nuevo* emite otro y reinicia el contador de intentos —el
 *    proveedor simulado devuelve un `hash` nuevo con `intentos: 0`—, así que el
 *    código viejo deja de servir y el nuevo sí.
 * 3. Con el código nuevo se firma y el flujo sigue al pago, como siempre.
 *
 * Con Mónica Mariana Gorena Tapia, el camino que aprueba.
 */
test("el código de firma se puede errar y volver a pedir sin perder el trámite", async ({
  page,
}) => {
  // Recorre el flujo entero y además yerra el código, pide otro y firma.
  test.setTimeout(300_000);

  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await declararCorreo(page, persona);
  await completarP5Aprobado(page);
  await completarP6(page, persona);
  await enviarP6(page, /\/firma$/);

  const idCode100 = await enviarEnlaceYAbrir(page);

  // --- 1 · Un código equivocado avisa y deja seguir --------------------------
  const primera = await leerSesionFirmaDelPanel(page, idCode100);
  expect(primera.codigo, "El panel no tiene código de firma para esta sesión.").not.toBeNull();

  // Seis dígitos que no son el emitido. Se deriva del real para no chocar con
  // él por casualidad.
  const equivocado = (primera.codigo as string)
    .split("")
    .map((digito) => String((Number(digito) + 1) % 10))
    .join("");

  for (let i = 0; i < equivocado.length; i += 1) {
    await page.locator(`#p8-otp-${i}`).fill(equivocado[i]);
  }

  // El mensaje es el específico del motivo real (`CODIGO_INCORRECTO`), no el
  // comodín, y dice cuántos intentos quedan.
  //
  // Se busca por texto y no por `getByRole("alert")`: Next monta su propio
  // `role="alert"` invisible para anunciar las navegaciones
  // (`__next-route-announcer__`), así que el rol solo devuelve dos elementos y
  // el modo estricto de Playwright —con razón— se niega a elegir.
  const aviso = page.getByText("El código no coincide", { exact: false });
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  await expect(aviso).toContainText("intento");
  // Y sobre todo: el trámite sigue acá, no se cerró ni se cayó a otra pantalla.
  await expect(page).toHaveURL(/\/firma$/);

  // --- 2 · Se pide uno nuevo, a demanda -------------------------------------
  await page.getByRole("button", { name: "Pedir un código nuevo" }).click();

  await expect
    .poll(
      async () => {
        const sesion = await leerSesionFirmaDelPanel(page, idCode100);
        return sesion.codigo;
      },
      {
        message: "El proveedor no emitió un código nuevo al pedirlo.",
        timeout: 15_000,
      },
    )
    .not.toBe(primera.codigo);

  const segunda = await leerSesionFirmaDelPanel(page, idCode100);
  expect(segunda.codigo).not.toBeNull();

  // --- 3 · Con el código nuevo se firma y el flujo sigue --------------------
  const codigoNuevo = segunda.codigo as string;
  for (let i = 0; i < codigoNuevo.length; i += 1) {
    await page.locator(`#p8-otp-${i}`).fill(codigoNuevo[i]);
  }

  await expect(page).toHaveURL(/\/pago$/, { timeout: 20_000 });
});
