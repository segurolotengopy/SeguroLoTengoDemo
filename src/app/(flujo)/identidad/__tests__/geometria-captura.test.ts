/**
 * Proyección del marco guía sobre los píxeles de la cámara.
 *
 * Es la prueba de una propiedad que la persona da por sentada y que el visor
 * anterior no cumplía: **lo que quedó dentro del marco es exactamente lo que se
 * manda**. Los números del primer caso son los del bug real que motivó el
 * módulo.
 */
import { describe, expect, it } from "vitest";
import {
  ajustarContenido,
  anchoRelativoDelMarco,
  mapearGuiaAFuente,
  type Caja,
} from "../geometria-captura";

/** Marco centrado dentro de un contenedor que arranca en el origen. */
function marcoCentrado(contenedor: Caja, ancho: number, alto: number): Caja {
  return {
    izquierda: contenedor.izquierda + (contenedor.ancho - ancho) / 2,
    arriba: contenedor.arriba + (contenedor.alto - alto) / 2,
    ancho,
    alto,
  };
}

const CELULAR: Caja = { izquierda: 0, arriba: 0, ancho: 375, alto: 500 };
const CAMARA_HORIZONTAL = { ancho: 1920, alto: 1080 };

describe("mapearGuiaAFuente", () => {
  it("no confunde el marco con una fracción del cuadro fuente (el bug que originó el módulo)", () => {
    const guia = marcoCentrado(CELULAR, 330, 208);

    const conCover = mapearGuiaAFuente(
      CELULAR,
      guia,
      CAMARA_HORIZONTAL.ancho,
      CAMARA_HORIZONTAL.alto,
      "cover",
    );

    // El cálculo viejo recortaba 0,88 × 1920 = 1690 px de sensor. Con `cover`
    // sobre un contenedor vertical, el marco abarca menos de la mitad de eso:
    // la foto enviada incluía muchísimo más de lo encuadrado.
    expect(Math.round(conCover.ancho)).toBe(713);
    expect(conCover.ancho).toBeLessThan(0.88 * CAMARA_HORIZONTAL.ancho * 0.5);
  });

  it("con `contain` el marco abarca casi todo el ancho del sensor", () => {
    const contenido = mapearGuiaAFuente(
      CELULAR,
      marcoCentrado(CELULAR, 330, 208),
      CAMARA_HORIZONTAL.ancho,
      CAMARA_HORIZONTAL.alto,
      "contain",
    );

    // Misma pantalla y mismo marco, pero sin descartar los costados del cuadro:
    // 1690 px de sensor para la cédula, que es lo que el MRZ necesita.
    expect(Math.round(contenido.ancho)).toBe(1690);
  });

  it("conserva la proporción del marco al proyectarlo", () => {
    const guia = marcoCentrado(CELULAR, 330, 208);
    const recorte = mapearGuiaAFuente(CELULAR, guia, 1920, 1080, "contain");

    expect(recorte.ancho / recorte.alto).toBeCloseTo(guia.ancho / guia.alto, 6);
  });

  it("centra el recorte cuando el marco está centrado", () => {
    const recorte = mapearGuiaAFuente(CELULAR, marcoCentrado(CELULAR, 300, 300), 1920, 1080, "cover");

    expect(recorte.x + recorte.ancho / 2).toBeCloseTo(1920 / 2, 6);
    expect(recorte.y + recorte.alto / 2).toBeCloseTo(1080 / 2, 6);
  });

  it("el espejo de la selfie no mueve un marco centrado, pero sí uno desplazado", () => {
    const centrado = marcoCentrado(CELULAR, 300, 300);
    expect(mapearGuiaAFuente(CELULAR, centrado, 1920, 1080, "cover", true).x).toBeCloseTo(
      mapearGuiaAFuente(CELULAR, centrado, 1920, 1080, "cover", false).x,
      6,
    );

    const corrido: Caja = { ...centrado, izquierda: centrado.izquierda - 40 };
    const derecho = mapearGuiaAFuente(CELULAR, corrido, 1920, 1080, "cover", false);
    const reflejado = mapearGuiaAFuente(CELULAR, corrido, 1920, 1080, "cover", true);

    expect(reflejado.x).toBeCloseTo(1920 - derecho.x - derecho.ancho, 6);
    expect(reflejado.ancho).toBeCloseTo(derecho.ancho, 6);
  });

  it("recorta a los bordes del cuadro cuando el marco se sale", () => {
    const desbordado: Caja = { izquierda: -200, arriba: -200, ancho: 900, alto: 900 };
    const recorte = mapearGuiaAFuente(CELULAR, desbordado, 1920, 1080, "contain");

    expect(recorte.x).toBeGreaterThanOrEqual(0);
    expect(recorte.y).toBeGreaterThanOrEqual(0);
    expect(recorte.x + recorte.ancho).toBeLessThanOrEqual(1920);
    expect(recorte.y + recorte.alto).toBeLessThanOrEqual(1080);
  });

  it("devuelve un recorte vacío mientras no hay cuadro", () => {
    const guia = marcoCentrado(CELULAR, 300, 200);
    expect(mapearGuiaAFuente(CELULAR, guia, 0, 0, "cover")).toEqual({ x: 0, y: 0, ancho: 0, alto: 0 });
    expect(
      mapearGuiaAFuente({ izquierda: 0, arriba: 0, ancho: 0, alto: 0 }, guia, 1920, 1080, "cover"),
    ).toEqual({ x: 0, y: 0, ancho: 0, alto: 0 });
  });
});

describe("ajustarContenido", () => {
  it("mete el cuadro entero en el área sin deformarlo", () => {
    const caja = ajustarContenido(1185, 456, 1920, 1080);

    expect(caja.alto).toBeCloseTo(456, 6);
    expect(caja.ancho).toBeCloseTo(456 * (1920 / 1080), 6);
    expect(caja.ancho / caja.alto).toBeCloseTo(1920 / 1080, 6);
  });

  it("achica los dos lados, que es lo que el CSS no hacía", () => {
    // El caso medido en el visor: con `max-height` el navegador recortaba el
    // alto y dejaba el ancho en 1185, y el marco terminaba fuera de la imagen.
    const caja = ajustarContenido(1185, 456, 1280, 720);
    expect(caja.ancho).toBeLessThan(1185);
    expect(caja.alto).toBeLessThanOrEqual(456);
  });

  it("no devuelve nada dibujable si todavía no hay área o cuadro", () => {
    expect(ajustarContenido(0, 400, 1920, 1080)).toEqual({ ancho: 0, alto: 0 });
    expect(ajustarContenido(400, 400, 0, 0)).toEqual({ ancho: 0, alto: 0 });
  });
});

describe("anchoRelativoDelMarco", () => {
  const ID1 = 85.6 / 53.98;

  it("usa el ancho pedido cuando el marco es más apaisado que el recuadro", () => {
    // Recuadro vertical (celular con cámara vertical): la cédula entra a lo ancho.
    expect(anchoRelativoDelMarco(0.92, ID1, 1080 / 1920)).toBeCloseTo(0.92, 6);
  });

  it("achica el ancho cuando quien limita es el alto", () => {
    // Recuadro 16:9 y marco 1,586: por alto no entra, así que ocupa menos ancho.
    const ancho = anchoRelativoDelMarco(0.92, ID1, 16 / 9);
    expect(ancho).toBeLessThan(0.92);
    expect(ancho).toBeCloseTo((0.92 * ID1) / (16 / 9), 6);
  });

  it("un marco cuadrado en un recuadro apaisado nunca ocupa el ancho entero", () => {
    // La selfie: círculo dentro de un cuadro 16:9.
    expect(anchoRelativoDelMarco(0.74, 1, 16 / 9)).toBeCloseTo(0.74 / (16 / 9), 6);
  });

  it("el marco proyectado conserva su proporción en cualquier recuadro", () => {
    for (const proporcionRecuadro of [0.5, 1, 4 / 3, 16 / 9, 2.4]) {
      const anchoRelativo = anchoRelativoDelMarco(0.92, ID1, proporcionRecuadro);
      // Alto del marco, también relativo al recuadro: ancho × (1/ID1) × proporción.
      const altoRelativo = (anchoRelativo / ID1) * proporcionRecuadro;
      expect(anchoRelativo).toBeLessThanOrEqual(0.92 + 1e-9);
      expect(altoRelativo).toBeLessThanOrEqual(0.92 + 1e-9);
    }
  });
});
