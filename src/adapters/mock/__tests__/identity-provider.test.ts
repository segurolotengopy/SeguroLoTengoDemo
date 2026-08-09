/**
 * Adaptador mock de `IdentityProvider` (P5).
 *
 * Corre la suite de contrato del puerto —la misma que va a tener que pasar el
 * adaptador oficial— y agrega los casos propios del mock: los cuatro
 * desenlaces configurables y de dónde sale cada uno (la persona de prueba
 * activa del panel de demo, o el escenario forzado que la pisa).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { runIdentityProviderContractTests } from "../../../ports/__tests__/identity-provider.contract";
import { crearIdentityProviderMock, limpiarSesionesIdentidadMock } from "../identity-provider";
import {
  escenarioIdentidadDe,
  fijarSeleccionDemo,
  obtenerSeleccionDemo,
  reiniciarSeleccionDemo,
} from "../persona-activa";
import { obtenerPersonaDemo } from "../personas";
import { edadEnRangoPermitido } from "../../../domain/tipos";

const IMAGEN = new Uint8Array([9, 8, 7, 6]);
const OTRA_IMAGEN = new Uint8Array([1, 2, 3, 4, 5]);

beforeEach(() => {
  limpiarSesionesIdentidadMock();
  reiniciarSeleccionDemo();
});

runIdentityProviderContractTests(() => crearIdentityProviderMock());

/** Recorre las tres capturas y devuelve OCR + comparación, como hace P5. */
async function recorrerP5(expedienteId: string) {
  const proveedor = crearIdentityProviderMock();
  const frente = await proveedor.capturarFrenteCedula(expedienteId, IMAGEN);
  const dorso = await proveedor.capturarDorsoCedula(expedienteId, IMAGEN);
  const selfie = await proveedor.capturarSelfieYPruebaDeVida(expedienteId, IMAGEN);
  const ocr = await proveedor.extraerDatosCedula(expedienteId);
  const comparacion = await proveedor.compararRostro(expedienteId);
  return { frente, dorso, selfie, ocr, comparacion };
}

describe("IdentityProvider mock · desenlaces configurables", () => {
  it("aprueba todo y devuelve los datos de la persona activa en el camino feliz", async () => {
    fijarSeleccionDemo({ personaId: "camino-feliz", escenarioIdentidadForzado: null });

    const { frente, dorso, selfie, ocr, comparacion } = await recorrerP5("EXP-FELIZ");
    const persona = obtenerPersonaDemo("camino-feliz");

    expect(frente.calidadAprobada).toBe(true);
    expect(dorso.calidadAprobada).toBe(true);
    expect(selfie.pruebaDeVidaAprobada).toBe(true);
    expect(comparacion.coincidenciaFacialAprobada).toBe(true);
    expect(ocr.confiable).toBe(true);
    expect(ocr.datos.numeroCedula).toBe(persona?.identidad.numeroCedula);
    expect(ocr.datos.fechaNacimiento).toBe(persona?.identidad.fechaNacimiento);
  });

  it("rechaza frente y dorso por calidad, y sin capturas aprobadas el OCR no es confiable", async () => {
    fijarSeleccionDemo({
      personaId: "camino-feliz",
      escenarioIdentidadForzado: "CALIDAD_INSUFICIENTE",
    });

    const { frente, dorso, ocr, comparacion } = await recorrerP5("EXP-CALIDAD");

    expect(frente.calidadAprobada).toBe(false);
    expect(frente.motivoRechazo).not.toBeNull();
    expect(dorso.calidadAprobada).toBe(false);
    expect(ocr.confiable).toBe(false);
    // Sin documento legible no hay contra qué comparar la cara.
    expect(comparacion.coincidenciaFacialAprobada).toBe(false);
  });

  it("devuelve una fecha de nacimiento fuera del rango 18-64 cuando se fuerza ese escenario", async () => {
    fijarSeleccionDemo({
      personaId: "camino-feliz",
      escenarioIdentidadForzado: "EDAD_FUERA_DE_RANGO",
    });

    const { ocr, comparacion } = await recorrerP5("EXP-EDAD");

    // El proveedor no bloquea: entrega el dato y el bloqueo lo aplica el
    // dominio (regla inviolable #8).
    expect(ocr.confiable).toBe(true);
    expect(comparacion.coincidenciaFacialAprobada).toBe(true);
    expect(ocr.datos.fechaNacimiento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(edadEnRangoPermitido(ocr.datos.fechaNacimiento)).toBe(false);
  });

  it("aprueba la prueba de vida pero no la coincidencia facial cuando la cara no coincide", async () => {
    fijarSeleccionDemo({
      personaId: "camino-feliz",
      escenarioIdentidadForzado: "NO_COINCIDE_CARA",
    });

    const { frente, selfie, ocr, comparacion } = await recorrerP5("EXP-CARA");

    expect(frente.calidadAprobada).toBe(true);
    expect(selfie.pruebaDeVidaAprobada).toBe(true);
    expect(ocr.confiable).toBe(true);
    expect(comparacion.coincidenciaFacialAprobada).toBe(false);
    expect(comparacion.puntuacion).not.toBeNull();
  });
});

describe("IdentityProvider mock · de dónde sale el desenlace", () => {
  it("toma el desenlace de la persona de prueba activa sin necesidad de forzarlo", async () => {
    // "Biometría rechazada" tiene la coincidencia facial en `false` en el
    // fixture: el escenario sale de ahí, no de una tabla aparte.
    fijarSeleccionDemo({ personaId: "biometria-rechazada", escenarioIdentidadForzado: null });

    const { comparacion, ocr } = await recorrerP5("EXP-BIOMETRIA");
    const persona = obtenerPersonaDemo("biometria-rechazada");

    expect(escenarioIdentidadDe(persona!)).toBe("NO_COINCIDE_CARA");
    expect(comparacion.coincidenciaFacialAprobada).toBe(false);
    expect(ocr.datos.nombres).toBe(persona?.identidad.nombres);
  });

  it("el escenario forzado del panel pisa al de la persona", async () => {
    fijarSeleccionDemo({
      personaId: "biometria-rechazada",
      escenarioIdentidadForzado: "APROBADO",
    });

    const { comparacion } = await recorrerP5("EXP-FORZADO");

    expect(comparacion.coincidenciaFacialAprobada).toBe(true);
  });

  it("arranca en el camino feliz y vuelve a él al reiniciar la selección", () => {
    expect(obtenerSeleccionDemo()).toEqual({
      personaId: "camino-feliz",
      escenarioIdentidadForzado: null,
    });

    fijarSeleccionDemo({ personaId: "no-firma", escenarioIdentidadForzado: "NO_COINCIDE_CARA" });
    reiniciarSeleccionDemo();

    expect(obtenerSeleccionDemo().personaId).toBe("camino-feliz");
    expect(obtenerSeleccionDemo().escenarioIdentidadForzado).toBeNull();
  });
});

describe("IdentityProvider mock · hashes y repetición de captura", () => {
  it("hashea los bytes recibidos: una imagen distinta da un hash distinto", async () => {
    const proveedor = crearIdentityProviderMock();

    const primera = await proveedor.capturarFrenteCedula("EXP-HASH", IMAGEN);
    const segunda = await proveedor.capturarFrenteCedula("EXP-HASH", OTRA_IMAGEN);

    expect(primera.imagen.hashSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(segunda.imagen.hashSha256).not.toBe(primera.imagen.hashSha256);
    expect(segunda.imagen.referencia).not.toBe(primera.imagen.referencia);
  });

  it("no expone ninguna forma de corregir un dato extraído: solo repetir la captura", async () => {
    const proveedor = crearIdentityProviderMock();

    // La interfaz no tiene métodos de edición; lo único que cambia el
    // resultado del OCR es volver a capturar.
    expect(Object.keys(proveedor).sort()).toEqual([
      "capturarDorsoCedula",
      "capturarFrenteCedula",
      "capturarSelfieYPruebaDeVida",
      "compararRostro",
      "extraerDatosCedula",
    ]);
  });

  it("no extrae datos si falta una de las dos caras de la cédula", async () => {
    const proveedor = crearIdentityProviderMock();
    await proveedor.capturarFrenteCedula("EXP-INCOMPLETO", IMAGEN);

    const ocr = await proveedor.extraerDatosCedula("EXP-INCOMPLETO");

    expect(ocr.confiable).toBe(false);
    expect(ocr.datos.numeroCedula).toBe("");
  });

  it("rechaza una imagen vacía y no aprueba la prueba de vida sin video", async () => {
    const proveedor = crearIdentityProviderMock();
    const vacia = new Uint8Array();

    const frente = await proveedor.capturarFrenteCedula("EXP-VACIO", vacia);
    const selfie = await proveedor.capturarSelfieYPruebaDeVida("EXP-VACIO", vacia);

    expect(frente.calidadAprobada).toBe(false);
    expect(frente.autenticidadAprobada).toBe(false);
    expect(selfie.pruebaDeVidaAprobada).toBe(false);
  });
});
