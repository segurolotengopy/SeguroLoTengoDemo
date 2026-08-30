import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { accionarFirmaPanel, leerSesionFirmaDelPanel, prepararEscenario } from "./support/demo-panel";
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
 * Escenario 7 — El sellado a medias, después de D-11.
 *
 * **Este escenario cambió de objeto.** Probaba la regla inviolable #3 cortando
 * el sellado entre la Solicitud y el FIPF: la aserción era que ninguno de los
 * dos quedara firmado. Con el PDF unificado esa falla dejó de existir —hay un
 * archivo y una huella— así que la regla ya no necesita un escenario que la
 * vigile: no hay dos cosas que puedan separarse.
 *
 * Lo que sí puede quedar a medias, y es donde ahora vive el riesgo, es el
 * tramo entre la firma del cliente y las institucionales (D-13). Eso es lo que
 * se prueba acá: el cliente firma, las cualificadas de Interseguros y Alianza
 * no llegan, y el expediente queda en `FIRMADO_CLIENTE` **con el cobro
 * inhabilitado**. Es la diferencia entre un sellado incompleto y un expediente
 * sin firmar, que es exactamente lo que D-13 pide poder distinguir.
 *
 * Con Mónica Mariana Gorena Tapia.
 */
test("si las firmas institucionales no llegan, el cobro sigue inhabilitado", async ({ page }) => {
  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, {
    personaId: persona.id,
    fallas: ["FIRMAS_INSTITUCIONALES_FALLAN"],
  });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await declararCorreo(page, persona);
  await completarP5Aprobado(page);
  await completarP6(page, persona);
  // D-08 · se firma en el paso 6, antes de que exista ninguna operación de pago.
  await enviarP6(page, /\/firma$/);

  const idCode100 = await enviarEnlaceYAbrir(page);

  const antes = await leerSesionFirmaDelPanel(page, idCode100);
  expect(antes.hashDocumentoFirmado).toBeNull();
  expect(antes.codigo, "Code100 tiene que haber emitido el OTP al abrir el enlace.").not.toBeNull();

  // El cliente firma de verdad: Code100 sella el documento.
  const firmado = await accionarFirmaPanel(page, idCode100, {
    accion: "FIRMAR",
    codigo: antes.codigo as string,
  });
  expect(firmado.ok, `firmar: ${JSON.stringify(firmado.datos)}`).toBeTruthy();

  // La firma del cliente existe del lado del proveedor: no se perdió.
  const despues = await leerSesionFirmaDelPanel(page, idCode100);
  expect(despues.hashDocumentoFirmado).not.toBeNull();

  // Pero la pantalla no avanza al pago: las institucionales no llegaron, así
  // que el expediente se queda en FIRMADO_CLIENTE.
  await expect(page).toHaveURL(/\/firma$/);

  // El sondeo de la pantalla corre cada dos segundos y **reintenta el tramo
  // institucional**, así que la ventana que este test quiere observar la cierra
  // el propio producto. Comprobar el 409 con la pantalla abierta era una
  // carrera: el escenario fallaba de a ratos en la corrida completa y pasaba
  // siempre aislado, que es la firma de una condición de tiempo y no de un
  // error.
  //
  // La salida no es dar más plazo —eso vuelve la carrera más lenta, no la
  // elimina— sino **apagar el sondeo antes de mirar**. En `about:blank` no hay
  // temporizadores corriendo, y `page.request` usa las cookies del contexto, no
  // las de la pantalla, así que la consulta sigue siendo la del expediente.
  await page.goto("about:blank");
  const resumenPago = await page.request.get("/api/p7/resumen");
  expect(resumenPago.status(), "el paso de pago no puede estar disponible").toBe(409);

  // La falla se consume en un solo intento (regla de las palancas del panel).
  // No se vuelve a firmar —el OTP es de uso único y ya se gastó, que es
  // justamente la razón de que el tramo institucional se retome solo—: alcanza
  // con que el sondeo corra de nuevo. Ahí sí avanza al pago.
  await page.goto("/firma");
  await expect(page).toHaveURL(/\/pago$/, { timeout: 30_000 });

  // Y la firma del cliente siguió siendo la misma de siempre: no se repitió.
  const sesionFinal = await leerSesionFirmaDelPanel(page, idCode100);
  expect(sesionFinal.hashDocumentoFirmado).toBe(despues.hashDocumentoFirmado);
});
