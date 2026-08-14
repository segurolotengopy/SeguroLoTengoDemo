/**
 * Ancho y alto de una imagen, leídos de su cabecera.
 *
 * Hace falta porque Rekognition devuelve el recuadro del rostro en
 * **proporción** (0–1) y el umbral de tamaño mínimo de
 * `src/domain/identidad-parametros.ts` está en **píxeles**: sin las
 * dimensiones reales, un rostro que ocupa media foto se leería como "menor a
 * 50 px" y se rechazaría siempre.
 *
 * Sin librería de imágenes: son las dos cabeceras que produce la cámara de un
 * teléfono (PNG y JPEG) y leerlas es medio archivo, contra unos megabytes de
 * decodificador del que solo usaríamos dos enteros. Mismo criterio que con el
 * PDF y el QR de `src/documentos/`.
 *
 * **No decodifica ni valida la imagen**: solo lee los enteros de la cabecera.
 * Si el archivo está corrupto más allá de la cabecera, esto no lo detecta —
 * lo detecta Rekognition, que es quien tiene que hacerlo.
 */

export interface Dimensiones {
  readonly ancho: number;
  readonly alto: number;
}

/** Los 8 bytes de firma de un PNG. */
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function esPng(bytes: Uint8Array): boolean {
  return FIRMA_PNG.every((byte, i) => bytes[i] === byte);
}

/**
 * PNG: el chunk `IHDR` es obligatoriamente el primero, así que ancho y alto
 * están en offsets fijos 16 y 20, big-endian de 4 bytes.
 */
function dimensionesPng(bytes: Uint8Array): Dimensiones | null {
  if (bytes.length < 24) return null;
  const leer32 = (offset: number) =>
    (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
  return { ancho: leer32(16), alto: leer32(20) };
}

/**
 * JPEG: hay que recorrer los marcadores hasta encontrar un `SOF` (Start Of
 * Frame), que es el que lleva las dimensiones. No están en un offset fijo
 * porque antes puede haber EXIF, miniaturas y tablas de cuantización de
 * tamaño variable.
 *
 * Se saltean `SOF4` (0xC4, tablas de Huffman), `SOF8` (0xC8) y `SOFC` (0xCC),
 * que comparten el rango pero **no** son marcadores de frame.
 */
function dimensionesJpeg(bytes: Uint8Array): Dimensiones | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let i = 2;
  // Se lee hasta `bytes[i + 8]` en el caso del SOF, así que ese es el límite.
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }

    const marcador = bytes[i + 1];

    // Marcadores sin payload: relleno (0xFF), RST0–RST7, SOI, EOI y TEM. No
    // llevan longitud, así que leerles dos bytes como si la tuvieran
    // desincronizaría el recorrido.
    const esAutonomo =
      marcador === 0xff ||
      marcador === 0x01 ||
      marcador === 0xd8 ||
      marcador === 0xd9 ||
      (marcador >= 0xd0 && marcador <= 0xd7);
    if (esAutonomo) {
      i += 2;
      continue;
    }

    const esFrame =
      marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc;

    if (esFrame) {
      // Tras el marcador: largo (2), precisión (1), alto (2), ancho (2).
      const alto = (bytes[i + 5] << 8) | bytes[i + 6];
      const ancho = (bytes[i + 7] << 8) | bytes[i + 8];
      return { ancho, alto };
    }

    const largoSegmento = (bytes[i + 2] << 8) | bytes[i + 3];
    // Un segmento declara al menos sus propios 2 bytes de longitud; menos que
    // eso no avanzaría y dejaría el bucle girando sobre el mismo offset.
    if (largoSegmento < 2) return null;
    i += 2 + largoSegmento;
  }

  return null;
}

/**
 * Dimensiones de una imagen PNG o JPEG. `null` si no reconoce el formato o la
 * cabecera está truncada.
 *
 * Devolver `null` en vez de un valor por defecto es deliberado: un tamaño
 * inventado haría pasar el control de tamaño mínimo de rostro sin haberlo
 * medido, que es peor que no poder medirlo.
 */
export function dimensionesDeImagen(bytes: Uint8Array): Dimensiones | null {
  if (bytes.length < 4) return null;

  const dimensiones = esPng(bytes) ? dimensionesPng(bytes) : dimensionesJpeg(bytes);
  if (!dimensiones) return null;
  if (dimensiones.ancho <= 0 || dimensiones.alto <= 0) return null;

  return dimensiones;
}
