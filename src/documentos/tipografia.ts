/**
 * Métricas y codificación de las dos fuentes estándar que usan los documentos:
 * Helvetica y Helvetica-Bold.
 *
 * Son fuentes que todo lector de PDF trae incorporadas, así que no hay nada
 * que embeber: alcanza con conocer el **avance** de cada carácter para poder
 * centrar, alinear a la derecha y cortar párrafos por palabras. Los valores
 * son los de los AFM de Adobe, en milésimas de em.
 *
 * Los documentos se escriben en WinAnsiEncoding, que cubre el castellano
 * completo (vocales acentuadas, `ñ`, `¿`, `¡`) más los signos tipográficos que
 * usan los textos de la especificación (`—`, `·`, comillas curvas).
 */

export type Fuente = "regular" | "negrita";

// ---------------------------------------------------------------------------
// Avances (AFM de Adobe, en 1/1000 de em)
// ---------------------------------------------------------------------------

/** Avances de Helvetica para los códigos 32 a 126, en orden. */
const HELVETICA_ASCII = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Avances de Helvetica-Bold para los códigos 32 a 126, en orden. */
const HELVETICA_NEGRITA_ASCII = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/**
 * Letra base de cada carácter acentuado de Latin-1. En Helvetica el glifo
 * acentuado tiene **el mismo avance** que su letra base (el acento no
 * ensancha la caja), así que esta tabla da el ancho exacto, no una
 * aproximación.
 */
const LETRA_BASE: Readonly<Record<string, string>> = {
  "À": "A", "Á": "A", "Â": "A", "Ã": "A", "Ä": "A", "Å": "A",
  "Ç": "C",
  "È": "E", "É": "E", "Ê": "E", "Ë": "E",
  "Ì": "I", "Í": "I", "Î": "I", "Ï": "I",
  "Ñ": "N",
  "Ò": "O", "Ó": "O", "Ô": "O", "Õ": "O", "Ö": "O",
  "Ù": "U", "Ú": "U", "Û": "U", "Ü": "U",
  "Ý": "Y",
  "à": "a", "á": "a", "â": "a", "ã": "a", "ä": "a", "å": "a",
  "ç": "c",
  "è": "e", "é": "e", "ê": "e", "ë": "e",
  "ì": "i", "í": "i", "î": "i", "ï": "i",
  "ñ": "n",
  "ò": "o", "ó": "o", "ô": "o", "õ": "o", "ö": "o",
  "ù": "u", "ú": "u", "û": "u", "ü": "u",
  "ý": "y", "ÿ": "y",
};

/**
 * Avances de los símbolos de Latin-1 y de WinAnsi que no son letras
 * acentuadas. Se usan los mismos valores para redonda y negrita: la
 * diferencia real entre ambas en estos glifos es de pocas milésimas de em y
 * no mueve una línea de texto. Los que sí importan —letras y dígitos— salen
 * de las tablas exactas de arriba.
 */
const SIMBOLOS: Readonly<Record<string, number>> = {
  "¡": 333, "¢": 556, "£": 556, "¤": 556, "¥": 556, "¦": 260, "§": 556,
  "¨": 333, "©": 737, "ª": 370, "«": 556, "¬": 584, "®": 737, "¯": 333,
  "°": 400, "±": 584, "²": 333, "³": 333, "´": 333, "µ": 556, "¶": 537,
  "·": 278, "¸": 333, "¹": 333, "º": 365, "»": 556, "¼": 834, "½": 834,
  "¾": 834, "¿": 611, "Æ": 1000, "Ð": 722, "×": 584, "Ø": 778, "Þ": 667,
  "ß": 611, "æ": 889, "ð": 556, "÷": 584, "ø": 611, "þ": 556,
  "€": 556, "‚": 222, "„": 333, "…": 1000, "†": 556, "‡": 556, "‰": 1000,
  "‘": 222, "’": 222, "“": 333, "”": 333, "•": 350, "–": 556, "—": 1000,
  "™": 1000, "Œ": 1000, "œ": 944, "Š": 667, "š": 500, "Ž": 611, "ž": 500,
  "Ÿ": 667, "ˆ": 333, "˜": 333, "‹": 333, "›": 333, "ƒ": 556,
};

function avance(caracter: string, fuente: Fuente): number {
  const tabla = fuente === "negrita" ? HELVETICA_NEGRITA_ASCII : HELVETICA_ASCII;
  const base = LETRA_BASE[caracter] ?? caracter;
  const codigo = base.charCodeAt(0);
  if (codigo >= 32 && codigo <= 126) return tabla[codigo - 32];
  return SIMBOLOS[base] ?? tabla[0];
}

/** Ancho de `texto` en puntos, para un cuerpo de `tamano` puntos. */
export function anchoDeTexto(texto: string, fuente: Fuente, tamano: number): number {
  let total = 0;
  for (const caracter of texto) total += avance(caracter, fuente);
  return (total * tamano) / 1000;
}

/**
 * Corta `texto` en líneas que entren en `ancho`. Corta por espacios; una
 * palabra más larga que la caja se deja sobresalir en vez de partirla, que es
 * lo correcto para un número de documento o un hash.
 */
export function partirEnLineas(texto: string, fuente: Fuente, tamano: number, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split("\n")) {
    let actual = "";
    for (const palabra of parrafo.split(" ")) {
      const candidata = actual === "" ? palabra : `${actual} ${palabra}`;
      if (actual !== "" && anchoDeTexto(candidata, fuente, tamano) > ancho) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = candidata;
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

// ---------------------------------------------------------------------------
// WinAnsiEncoding
// ---------------------------------------------------------------------------

/**
 * Los caracteres que WinAnsi ubica en 0x80–0x9F y que Latin-1 no tiene. Son
 * los signos tipográficos que aparecen en los literales de la especificación.
 */
const WINANSI_ALTO: Readonly<Record<string, number>> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87,
  "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

/** Byte WinAnsi de un carácter, o `null` si la codificación no lo representa. */
export function byteWinAnsi(caracter: string): number | null {
  const alto = WINANSI_ALTO[caracter];
  if (alto !== undefined) return alto;
  const codigo = caracter.charCodeAt(0);
  if (codigo <= 0xff && caracter.length === 1) return codigo;
  return null;
}

/**
 * Codifica una cadena a bytes WinAnsi. Un carácter no representable se
 * sustituye por `?` en vez de romper la generación: un documento con un signo
 * degradado se puede leer y firmar; uno que no se generó, no.
 */
export function bytesWinAnsi(texto: string): Uint8Array {
  const bytes: number[] = [];
  for (const caracter of texto) {
    bytes.push(byteWinAnsi(caracter) ?? 0x3f);
  }
  return Uint8Array.from(bytes);
}

/**
 * Escapa una cadena para meterla en un literal `( … )` de PDF. Los tres
 * caracteres que hay que neutralizar son el paréntesis que abre, el que
 * cierra y la barra invertida.
 */
export function escaparTextoPdf(texto: string): string {
  return texto.replace(/[\\()]/g, (caracter) => `\\${caracter}`);
}
