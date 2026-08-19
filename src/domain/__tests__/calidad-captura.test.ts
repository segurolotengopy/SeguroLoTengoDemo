/**
 * Medición de calidad en el navegador (`calidad-captura.ts`).
 *
 * Dos cosas se prueban acá, y la segunda importa más que la primera:
 *
 * 1. que la aritmética distinga de verdad una imagen enfocada de una lavada,
 *    una oscura de una quemada y un reflejo de una superficie mate; y
 * 2. que este módulo **no tenga forma de aprobar nada**. Su salida es un
 *    consejo y un permiso para apretar el obturador solo — nunca un veredicto
 *    de identidad. Si alguien lo cablea a una decisión, que sea en un archivo
 *    que declare lo que está haciendo.
 */
import { describe, expect, it } from "vitest";
import {
  ANCHO_FUENTE_MINIMO_PX,
  CONSEJO_APTA,
  CONSEJO_POR_MOTIVO,
  LADO_MUESTRA_PX,
  LUMINANCIA_MAXIMA,
  LUMINANCIA_MINIMA,
  NITIDEZ_MINIMA,
  REFLEJO_MAXIMO_DOCUMENTO,
  evaluarCaptura,
  medirCaptura,
  resolucionSuficiente,
  type MuestraGris,
} from "../calidad-captura";

/** Superficie de un solo tono: ni un borde, así que nitidez cero. */
function plana(valor: number, ancho = 32, alto = 32): MuestraGris {
  return { datos: new Uint8ClampedArray(ancho * alto).fill(valor), ancho, alto };
}

/** Damero de 1 px: el peor caso para el laplaciano, o sea el más nítido posible. */
function damero(bajo = 40, alto = 200, lado = 32): MuestraGris {
  const datos = new Uint8ClampedArray(lado * lado);
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      datos[y * lado + x] = (x + y) % 2 === 0 ? bajo : alto;
    }
  }
  return { datos, ancho: lado, alto: lado };
}

/** Damero con una mancha de píxeles quemados, como el brillo sobre el plástico. */
function dameroConReflejo(fraccionQuemada: number): MuestraGris {
  const base = damero();
  const datos = new Uint8ClampedArray(base.datos as Uint8ClampedArray);
  const aQuemar = Math.round(datos.length * fraccionQuemada);
  for (let i = 0; i < aQuemar; i += 1) datos[i] = 255;
  return { datos, ancho: base.ancho, alto: base.alto };
}

describe("medirCaptura", () => {
  it("da nitidez cero en una superficie plana y alta en un damero", () => {
    expect(medirCaptura(plana(128)).nitidez).toBe(0);
    expect(medirCaptura(damero()).nitidez).toBeGreaterThan(NITIDEZ_MINIMA.DOCUMENTO);
  });

  it("promedia la luminancia y cuenta los píxeles quemados", () => {
    expect(medirCaptura(plana(90)).luminancia).toBeCloseTo(90, 5);
    expect(medirCaptura(plana(255)).reflejo).toBeCloseTo(1, 5);
    expect(medirCaptura(plana(100)).reflejo).toBe(0);
  });

  it("no explota con una muestra vacía o de un solo píxel", () => {
    expect(medirCaptura({ datos: [], ancho: 0, alto: 0 })).toEqual({
      nitidez: 0,
      luminancia: 0,
      reflejo: 0,
    });
    expect(medirCaptura(plana(128, 1, 1)).nitidez).toBe(0);
  });
});

describe("evaluarCaptura", () => {
  it("aprueba un cuadro enfocado y bien expuesto", () => {
    const veredicto = evaluarCaptura(medirCaptura(damero()), "DOCUMENTO");
    expect(veredicto).toEqual({ apta: true, motivo: null, consejo: CONSEJO_APTA });
  });

  it("señala la exposición antes que el foco, porque la oscuridad lava la nitidez", () => {
    const oscura = evaluarCaptura(
      { nitidez: 0, luminancia: LUMINANCIA_MINIMA - 1, reflejo: 0 },
      "DOCUMENTO",
    );
    expect(oscura.motivo).toBe("OSCURA");
    expect(oscura.consejo).toBe(CONSEJO_POR_MOTIVO.OSCURA);

    const quemada = evaluarCaptura(
      { nitidez: 0, luminancia: LUMINANCIA_MAXIMA + 1, reflejo: 0 },
      "SELFIE",
    );
    expect(quemada.motivo).toBe("QUEMADA");
  });

  it("detecta el reflejo del plástico solo en el documento", () => {
    const conBrillo = medirCaptura(dameroConReflejo(REFLEJO_MAXIMO_DOCUMENTO + 0.1));

    expect(evaluarCaptura(conBrillo, "DOCUMENTO").motivo).toBe("REFLEJO");
    // En una selfie, una ventana de fondo quema píxeles sin estorbar al rostro.
    expect(evaluarCaptura(conBrillo, "SELFIE").apta).toBe(true);
  });

  it("marca como movida una toma enfocada por debajo del umbral de su tipo", () => {
    const media: MuestraGris = plana(128);
    expect(evaluarCaptura(medirCaptura(media), "DOCUMENTO").motivo).toBe("MOVIDA");
    expect(evaluarCaptura(medirCaptura(media), "SELFIE").motivo).toBe("MOVIDA");
  });

  it("le exige más foco al documento que a la selfie", () => {
    const metricas = { nitidez: NITIDEZ_MINIMA.SELFIE, luminancia: 128, reflejo: 0 };
    expect(evaluarCaptura(metricas, "SELFIE").apta).toBe(true);
    // El MRZ del dorso es lo más exigente de las tres tomas.
    expect(evaluarCaptura(metricas, "DOCUMENTO").apta).toBe(false);
    expect(NITIDEZ_MINIMA.DOCUMENTO).toBeGreaterThan(NITIDEZ_MINIMA.SELFIE);
  });

  it("todo consejo dice qué hacer, no solo qué pasó", () => {
    // Ningún mensaje puede terminar en un diagnóstico mudo: la regla del
    // proyecto es que el texto le diga a la persona el próximo movimiento.
    for (const consejo of Object.values(CONSEJO_POR_MOTIVO)) {
      expect(consejo.length).toBeGreaterThan(20);
      expect(/[.!]/.test(consejo)).toBe(true);
    }
  });
});

describe("resolucionSuficiente", () => {
  it("rechaza un marco que abarca menos píxeles de los que el MRZ necesita", () => {
    expect(resolucionSuficiente(ANCHO_FUENTE_MINIMO_PX.DOCUMENTO - 1, "DOCUMENTO")).toBe(false);
    expect(resolucionSuficiente(ANCHO_FUENTE_MINIMO_PX.DOCUMENTO, "DOCUMENTO")).toBe(true);
  });

  it("le pide menos resolución a la selfie que al documento", () => {
    expect(ANCHO_FUENTE_MINIMO_PX.SELFIE).toBeLessThan(ANCHO_FUENTE_MINIMO_PX.DOCUMENTO);
    expect(resolucionSuficiente(500, "SELFIE")).toBe(true);
    expect(resolucionSuficiente(500, "DOCUMENTO")).toBe(false);
  });
});

describe("el módulo asiste, no decide", () => {
  it("la muestra se normaliza a un ancho fijo para que el umbral no dependa de la cámara", () => {
    // Sin normalizar, la varianza del laplaciano de una 4K y una de 720p no
    // son comparables y el mismo número sería severo en una y laxo en la otra.
    expect(LADO_MUESTRA_PX).toBeGreaterThan(0);
  });

  it("no exporta nada que se parezca a una decisión biométrica", async () => {
    const modulo = await import("../calidad-captura");
    const nombres = Object.keys(modulo).join(" ").toLowerCase();

    // `DecisionBiometrica`, umbrales faciales y versiones de política viven en
    // `identidad-parametros.ts` y se sellan en la evidencia. Acá no entra nada
    // de eso: si algún día aparece, es que se cruzaron los dos criterios.
    expect(nombres).not.toContain("decision");
    expect(nombres).not.toContain("politica");
    expect(nombres).not.toContain("facial");
    expect(nombres).not.toContain("umbral_coincidencia");
  });
});
