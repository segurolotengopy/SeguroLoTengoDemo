/**
 * Lector de dimensiones de PNG y JPEG.
 *
 * Importa porque de acá sale el divisor del control de tamaño mínimo de rostro:
 * Rekognition devuelve el recuadro en proporción y el umbral está en píxeles.
 * Un ancho mal leído no da un error visible — da un rechazo o una aprobación
 * silenciosamente equivocados.
 */
import { describe, expect, it } from "vitest";
import { dimensionesDeImagen } from "../dimensiones-imagen";

function png(ancho: number, alto: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const escribir = (offset: number, valor: number) => {
    bytes[offset] = (valor >>> 24) & 0xff;
    bytes[offset + 1] = (valor >>> 16) & 0xff;
    bytes[offset + 2] = (valor >>> 8) & 0xff;
    bytes[offset + 3] = valor & 0xff;
  };
  escribir(16, ancho);
  escribir(20, alto);
  return bytes;
}

/**
 * JPEG mínimo: SOI, un segmento intermedio de relleno y el SOF0 con las
 * dimensiones. El segmento del medio es lo que hace útil el test: si el lector
 * asumiera un offset fijo en vez de recorrer marcadores, fallaría acá.
 */
function jpeg(ancho: number, alto: number, relleno = 4): Uint8Array {
  const bytes: number[] = [0xff, 0xd8];
  // Segmento arbitrario (APP0) de largo variable, como el EXIF de una cámara.
  bytes.push(0xff, 0xe0, 0x00, relleno + 2, ...new Array(relleno).fill(0));
  bytes.push(
    0xff,
    0xc0, // SOF0
    0x00,
    0x11, // largo
    0x08, // precisión
    (alto >> 8) & 0xff,
    alto & 0xff,
    (ancho >> 8) & 0xff,
    ancho & 0xff,
  );
  return new Uint8Array(bytes);
}

describe("dimensionesDeImagen", () => {
  it("lee un PNG del chunk IHDR", () => {
    expect(dimensionesDeImagen(png(1920, 1080))).toEqual({ ancho: 1920, alto: 1080 });
  });

  it("lee un JPEG recorriendo los marcadores hasta el SOF", () => {
    expect(dimensionesDeImagen(jpeg(4032, 3024))).toEqual({ ancho: 4032, alto: 3024 });
  });

  it("encuentra el SOF aunque haya segmentos previos de distinto largo", () => {
    // Un offset fijo funcionaría con un relleno y fallaría con otro.
    for (const relleno of [0, 4, 64, 300]) {
      expect(dimensionesDeImagen(jpeg(800, 600, relleno))).toEqual({ ancho: 800, alto: 600 });
    }
  });

  it("devuelve null en vez de inventar un tamaño", () => {
    // Un valor por defecto haría pasar el control de tamaño de rostro sin
    // haberlo medido, que es peor que no poder medirlo.
    expect(dimensionesDeImagen(new Uint8Array([]))).toBeNull();
    expect(dimensionesDeImagen(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(dimensionesDeImagen(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull(); // GIF
  });

  it("rechaza un PNG truncado antes del IHDR", () => {
    expect(dimensionesDeImagen(png(100, 100).slice(0, 20))).toBeNull();
  });

  it("rechaza dimensiones de cero", () => {
    expect(dimensionesDeImagen(png(0, 100))).toBeNull();
    expect(dimensionesDeImagen(png(100, 0))).toBeNull();
  });

  it("no confunde una tabla de Huffman con un marcador de frame", () => {
    // 0xC4 comparte el rango de los SOF pero no lleva dimensiones. Si el lector
    // lo tomara por frame, devolvería basura en vez del tamaño real.
    const bytes = [0xff, 0xd8];
    bytes.push(0xff, 0xc4, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00);
    bytes.push(0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x00, 0x03, 0x00);
    expect(dimensionesDeImagen(new Uint8Array(bytes))).toEqual({ ancho: 768, alto: 512 });
  });
});
