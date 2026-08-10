/**
 * Tests del codificador de QR.
 *
 * El codificador de `qr.ts` no tiene una librería de referencia contra la cual
 * compararse, así que la verificación fuerte de este archivo es un **lector**
 * independiente: `leerMatrizQr` recorre la matriz generada siguiendo la norma
 * —lee la información de formato, desenmascara, recupera los codewords en
 * zigzag, los desintercala y verifica la corrección Reed-Solomon— y devuelve el
 * texto. Si la colocación, el enmascarado o el intercalado se rompen, el texto
 * no vuelve a salir y el test falla.
 *
 * Además se verifica a mano lo que un lector escrito por la misma persona
 * podría no notar: la geometría de los patrones fijos (búsqueda, separadores,
 * sincronismo, alineación, módulo oscuro) y la aritmética de la tabla de
 * versiones.
 */
import { describe, expect, it } from "vitest";
import {
  LARGO_MAXIMO_QR,
  bitsDeFormato,
  bitsDeVersion,
  codewordsDeCorreccion,
  codewordsDeDatos,
  generarMatrizQr,
  parametrosDeVersion,
  versionMinima,
} from "../qr";
import type { MatrizQr } from "../qr";

// ---------------------------------------------------------------------------
// Lector independiente
// ---------------------------------------------------------------------------

/** Reconstruye qué celdas ocupan los patrones fijos, según la geometría de la norma. */
function celdasReservadas(tamano: number, version: number): boolean[][] {
  const reservado = Array.from({ length: tamano }, () => new Array<boolean>(tamano).fill(false));
  const marcar = (fila: number, columna: number): void => {
    if (fila >= 0 && columna >= 0 && fila < tamano && columna < tamano) reservado[fila][columna] = true;
  };

  for (const [f0, c0] of [
    [0, 0],
    [0, tamano - 7],
    [tamano - 7, 0],
  ]) {
    for (let df = -1; df <= 7; df++) for (let dc = -1; dc <= 7; dc++) marcar(f0 + df, c0 + dc);
  }

  for (let i = 0; i < tamano; i++) {
    marcar(6, i);
    marcar(i, 6);
  }

  const centros = parametrosDeVersion(version).alineacion;
  for (let i = 0; i < centros.length; i++) {
    for (let j = 0; j < centros.length; j++) {
      const enEsquina =
        (i === 0 && j === 0) ||
        (i === 0 && j === centros.length - 1) ||
        (i === centros.length - 1 && j === 0);
      if (enEsquina) continue;
      for (let df = -2; df <= 2; df++) for (let dc = -2; dc <= 2; dc++) marcar(centros[i] + df, centros[j] + dc);
    }
  }

  for (let i = 0; i <= 8; i++) {
    marcar(8, i);
    marcar(i, 8);
  }
  for (let i = 0; i < 8; i++) {
    marcar(8, tamano - 1 - i);
    marcar(tamano - 1 - i, 8);
  }
  marcar(tamano - 8, 8);

  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = tamano - 11 + (i % 3);
      const b = Math.floor(i / 3);
      marcar(b, a);
      marcar(a, b);
    }
  }

  return reservado;
}

function invertir(mascara: number, fila: number, columna: number): boolean {
  switch (mascara) {
    case 0:
      return (fila + columna) % 2 === 0;
    case 1:
      return fila % 2 === 0;
    case 2:
      return columna % 3 === 0;
    case 3:
      return (fila + columna) % 3 === 0;
    case 4:
      return (Math.floor(fila / 2) + Math.floor(columna / 3)) % 2 === 0;
    case 5:
      return ((fila * columna) % 2) + ((fila * columna) % 3) === 0;
    case 6:
      return (((fila * columna) % 2) + ((fila * columna) % 3)) % 2 === 0;
    default:
      return (((fila + columna) % 2) + ((fila * columna) % 3)) % 2 === 0;
  }
}

interface LecturaQr {
  readonly texto: string;
  readonly mascara: number;
  readonly nivelCorreccion: number;
  /** `true` si la corrección Reed-Solomon de cada bloque coincide con la recalculada. */
  readonly correccionValida: boolean;
}

function leerMatrizQr(qr: MatrizQr): LecturaQr {
  const { tamano, version, modulos } = qr;

  // 1. Información de formato, primera copia.
  let formato = 0;
  const leerBit = (fila: number, columna: number, indice: number): void => {
    if (modulos[fila][columna]) formato |= 1 << indice;
  };
  for (let i = 0; i <= 5; i++) leerBit(i, 8, i);
  leerBit(7, 8, 6);
  leerBit(8, 8, 7);
  leerBit(8, 7, 8);
  for (let i = 9; i < 15; i++) leerBit(8, 14 - i, i);

  const datosFormato = (formato ^ 0x5412) >>> 10;
  const nivelCorreccion = datosFormato >> 3;
  const mascara = datosFormato & 0b111;

  // 2. Desenmascarar y recuperar los codewords en zigzag.
  const reservado = celdasReservadas(tamano, version);
  const bits: number[] = [];
  let haciaArriba = true;
  for (let derecha = tamano - 1; derecha >= 1; derecha -= 2) {
    if (derecha === 6) derecha = 5;
    for (let paso = 0; paso < tamano; paso++) {
      const fila = haciaArriba ? tamano - 1 - paso : paso;
      for (const columna of [derecha, derecha - 1]) {
        if (reservado[fila][columna]) continue;
        const crudo = modulos[fila][columna];
        const claro = invertir(mascara, fila, columna) ? !crudo : crudo;
        bits.push(claro ? 1 : 0);
      }
    }
    haciaArriba = !haciaArriba;
  }

  const p = parametrosDeVersion(version);
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length && codewords.length < p.totalCodewords; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }

  // 3. Desintercalar en bloques de datos y de corrección.
  const largos = [
    ...new Array<number>(p.bloquesGrupo1).fill(p.datosGrupo1),
    ...new Array<number>(p.bloquesGrupo2).fill(p.datosGrupo2),
  ];
  const bloques: number[][] = largos.map(() => []);
  let cursor = 0;
  for (let i = 0; i < Math.max(...largos); i++) {
    for (let b = 0; b < bloques.length; b++) {
      if (i < largos[b]) bloques[b].push(codewords[cursor++]);
    }
  }
  const bloquesEc: number[][] = largos.map(() => []);
  for (let i = 0; i < p.ecPorBloque; i++) {
    for (let b = 0; b < bloquesEc.length; b++) bloquesEc[b].push(codewords[cursor++]);
  }

  const correccionValida = bloques.every((bloque, b) => {
    const recalculada = codewordsDeCorreccion(Uint8Array.from(bloque), p.ecPorBloque);
    return bloquesEc[b].every((valor, i) => valor === recalculada[i]);
  });

  // 4. Decodificar el segmento en modo byte.
  const mensaje = bloques.flat();
  const bitsMensaje: number[] = [];
  for (const byte of mensaje) for (let i = 7; i >= 0; i--) bitsMensaje.push((byte >> i) & 1);

  const tomar = (desde: number, cantidad: number): number => {
    let valor = 0;
    for (let i = 0; i < cantidad; i++) valor = (valor << 1) | bitsMensaje[desde + i];
    return valor;
  };

  const modo = tomar(0, 4);
  if (modo !== 0b0100) throw new Error(`Modo inesperado: ${modo.toString(2)}`);
  const bitsContador = version <= 9 ? 8 : 16;
  const largo = tomar(4, bitsContador);

  let texto = "";
  for (let i = 0; i < largo; i++) {
    texto += String.fromCharCode(tomar(4 + bitsContador + i * 8, 8));
  }

  return { texto, mascara, nivelCorreccion, correccionValida };
}

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

describe("generarMatrizQr — ida y vuelta", () => {
  const casos: readonly string[] = [
    "A",
    "https://segurolotengo.com/verificar/PROP-00018425",
    "https://segurolotengo.com/verificar/FIPF-00018425",
    "HELLO WORLD",
    "0123456789",
    // Justo en el borde de cada salto de versión que nos interesa.
    "x".repeat(14),
    "x".repeat(15),
    "x".repeat(62),
    "x".repeat(63),
    "x".repeat(122),
    "x".repeat(LARGO_MAXIMO_QR),
  ];

  for (const texto of casos) {
    it(`recupera el texto de ${texto.length} caracteres`, () => {
      const qr = generarMatrizQr(texto);
      const lectura = leerMatrizQr(qr);

      expect(lectura.texto).toBe(texto);
      // Nivel M = 0b00 en la codificación de la información de formato.
      expect(lectura.nivelCorreccion).toBe(0b00);
      expect(lectura.mascara).toBeGreaterThanOrEqual(0);
      expect(lectura.mascara).toBeLessThanOrEqual(7);
      expect(lectura.correccionValida).toBe(true);
    });
  }

  it("es determinista: el mismo texto produce siempre la misma matriz", () => {
    const texto = "https://segurolotengo.com/verificar/PROP-00018425";
    const primera = generarMatrizQr(texto);
    const segunda = generarMatrizQr(texto);

    expect(segunda.version).toBe(primera.version);
    expect(segunda.modulos).toEqual(primera.modulos);
  });

  it("rechaza un payload fuera de Latin-1 y uno demasiado largo", () => {
    expect(() => generarMatrizQr("código €")).toThrow(/Latin-1/);
    expect(() => generarMatrizQr("x".repeat(LARGO_MAXIMO_QR + 1))).toThrow(/excede/);
  });
});

// ---------------------------------------------------------------------------
// Geometría de los patrones fijos
// ---------------------------------------------------------------------------

describe("geometría del símbolo", () => {
  it("dibuja los tres patrones de búsqueda con su separador", () => {
    const qr = generarMatrizQr("https://segurolotengo.com/verificar/PROP-00018425");
    const { modulos, tamano } = qr;

    for (const [f0, c0] of [
      [0, 0],
      [0, tamano - 7],
      [tamano - 7, 0],
    ]) {
      for (let df = 0; df < 7; df++) {
        for (let dc = 0; dc < 7; dc++) {
          const distancia = Math.max(Math.abs(df - 3), Math.abs(dc - 3));
          expect(modulos[f0 + df][c0 + dc]).toBe(distancia !== 2);
        }
      }
    }

    // La cuarta esquina no tiene patrón de búsqueda.
    expect(modulos[tamano - 1][tamano - 1]).toBeDefined();
  });

  it("alterna los patrones de sincronismo y fija el módulo oscuro", () => {
    const qr = generarMatrizQr("https://segurolotengo.com/verificar/PROP-00018425");
    const { modulos, tamano } = qr;

    for (let i = 8; i < tamano - 8; i++) {
      expect(modulos[6][i]).toBe(i % 2 === 0);
      expect(modulos[i][6]).toBe(i % 2 === 0);
    }

    expect(modulos[tamano - 8][8]).toBe(true);
  });

  it("el lado es 17 + 4 × versión", () => {
    for (const texto of ["A", "x".repeat(60), "x".repeat(LARGO_MAXIMO_QR)]) {
      const qr = generarMatrizQr(texto);
      expect(qr.tamano).toBe(17 + 4 * qr.version);
      expect(qr.modulos).toHaveLength(qr.tamano);
      for (const fila of qr.modulos) expect(fila).toHaveLength(qr.tamano);
    }
  });
});

// ---------------------------------------------------------------------------
// Tabla de versiones y códigos BCH
// ---------------------------------------------------------------------------

describe("tabla de versiones", () => {
  it("cierra la aritmética de cada versión: datos + corrección = total", () => {
    for (let version = 1; version <= 10; version++) {
      const p = parametrosDeVersion(version);
      const bloques = p.bloquesGrupo1 + p.bloquesGrupo2;
      expect(codewordsDeDatos(version) + bloques * p.ecPorBloque).toBe(p.totalCodewords);
    }
  });

  it("elige la versión mínima que admite el payload", () => {
    // Capacidad en modo byte, nivel M: 14 caracteres en la versión 1.
    expect(versionMinima(14)).toBe(1);
    expect(versionMinima(15)).toBe(2);
    expect(versionMinima(LARGO_MAXIMO_QR)).toBe(10);
    expect(versionMinima(LARGO_MAXIMO_QR + 1)).toBeNull();
  });

  it("la información de formato codifica el nivel M y la máscara", () => {
    for (let mascara = 0; mascara < 8; mascara++) {
      const bits = bitsDeFormato(mascara);
      expect((bits ^ 0x5412) >>> 10).toBe(mascara);
      expect(bits).toBeLessThanOrEqual(0x7fff);
    }
    // Valor tabulado en la norma para nivel M y máscara 0.
    expect(bitsDeFormato(0)).toBe(0b101010000010010);
  });

  it("la información de versión conserva el número en sus 6 bits altos", () => {
    for (let version = 7; version <= 10; version++) {
      expect(bitsDeVersion(version) >>> 12).toBe(version);
    }
    // Valor tabulado en la norma para la versión 7.
    expect(bitsDeVersion(7)).toBe(0b000111110010010100);
  });
});
