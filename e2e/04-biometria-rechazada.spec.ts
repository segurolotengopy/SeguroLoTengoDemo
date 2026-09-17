import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { TEXTOS_03C } from "@/domain/v4/textos-identidad";
import { prepararEscenario } from "./support/demo-panel";
import {
  completarCapturasIdentidadRechazada,
  completarPlan,
  completarPreparacion,
  completarWhatsapp,
} from "./support/flujo";

/**
 * Escenario 4 — Rechazo de biometría en 03C (v4).
 *
 * La selfie no coincide con la cédula (`coincidenciaFacialAprobada: false` en
 * el fixture) → el flujo no debe permitir avanzar a 03D. La comparación
 * facial contra el frente ocurre en el paso de validación final
 * (`VALIDAR Y CONTINUAR` → `POST /api/v4/identidad`), no en la captura
 * individual de la selfie (`POST /api/p5/captura`, que solo mide calidad y
 * prueba de vida): con este fixture, la selfie se marca `✓ VALIDADO` como
 * tarjeta y recién al validar el conjunto aparece el rechazo.
 *
 * Los campos extraídos por OCR (número de cédula, fecha de nacimiento) viven
 * en 03D, a la que este fixture nunca llega — así que el único camino que se
 * puede probar acá es que 03C no deje avanzar y ofrezca "REPETIR SELFIE".
 *
 * Con Julio César Ramírez Cabral (C.I. 4.209.336): sus declaraciones son
 * compatibles a propósito — lo que lo frena acá es la biometría, no la
 * elegibilidad (docs/ESPECIFICACION_DEMO.md).
 */
test("selfie que no coincide con la cédula no deja avanzar a 03D", async ({ page }) => {
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

  await completarCapturasIdentidadRechazada(page, persona);

  // El botón de continuar sigue deshabilitado: la coincidencia facial no se
  // cumplió y la pantalla no ofrece ningún otro camino hacia 03D.
  const validar = page.getByRole("button", { name: TEXTOS_03C.validar, exact: true });
  await expect(validar).toBeDisabled();

  // El único camino ofrecido es repetir la selfie — nunca editar un campo a
  // mano, porque acá no hay ningún campo editable: eso vive en 03D.
  await expect(
    page.getByRole("button", { name: TEXTOS_03C.errores.PRUEBA_DE_VIDA.boton, exact: true }),
  ).toBeVisible();

  await expect(page).toHaveURL(/\/identidad$/);

  // Intentar forzar el paso a 03D por la API también lo rechaza: el
  // expediente nunca llegó a IDENTIDAD_VERIFICADA.
  const intentoDatos = await page.request.post("/api/v4/datos-personales", {
    data: {
      nombres: "x",
      apellidoPaterno: "x",
      apellidoMaterno: "x",
      numeroCedula: "0",
      fechaNacimiento: "2000-01-01",
      sexo: "Femenino",
      estadoCivil: "Soltero/a",
      paisNacimiento: "Paraguay",
      nacionalidad: "Paraguay",
      paisResidencia: "Paraguay",
      domicilio: "x",
      ciudad: "Asunción",
      barrio: "x",
    },
  });
  expect(intentoDatos.status()).not.toBe(200);
  await expect(page).toHaveURL(/\/identidad$/);
});
