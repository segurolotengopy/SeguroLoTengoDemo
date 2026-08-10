/**
 * Codificador de códigos QR, en modo byte y nivel de corrección M.
 *
 * Existe acá, y no como dependencia, por el mismo criterio con el que P7
 * decidió no dibujar el QR de Bancard (`FormularioPagoP7.tsx`): agregar una
 * librería de códigos QR al bundle no se justificaba para mostrar un payload
 * en pantalla. Acá sí hace falta el QR dibujado —va **dentro** del PDF
 * cerrado, así que el hash del documento depende de él— pero lo que se
 * necesita es la matriz de módulos, no un canvas ni un DOM: lo que devuelve
 * este módulo es una grilla de booleanos que `pdf.ts` convierte en
 * rectángulos vectoriales. Una librería de QR resolvería el 20% del problema
 * (la matriz) y traería el 80% que no se usa (renderers de canvas, SVG, PNG).
 *
 * Alcance deliberadamente acotado a lo que el paquete documental necesita:
 *
 * - **Modo byte** (0100) sobre ISO-8859-1, que es lo que admite una URL.
 * - **Nivel de corrección M** (~15%), el habitual para documentos impresos.
 * - **Versiones 1 a 10** (21×21 a 57×57), hasta 213 caracteres. La URL de
 *   verificación de un documento ronda los 50, así que sobra margen sin
 *   arrastrar la tabla completa de las 40 versiones.
 *
 * Referencia: ISO/IEC 18004. La implementación sigue la estructura clásica
 * (codificación → bloques Reed-Solomon → intercalado → colocación en zigzag →
 * enmascarado por penalización), y `__tests__/qr.test.ts` la verifica leyendo
 * de vuelta la matriz generada: si la colocación, el enmascarado o el
 * intercalado se rompen, el texto no vuelve a salir.
 *
 * **Determinismo:** para un mismo texto la matriz es siempre idéntica (la
 * máscara se elige por penalización, no al azar). Es un requisito, no una
 * casualidad: el QR va dentro del PDF que se hashea, así que un generador no
 * determinista haría que el mismo documento tuviera dos huellas digitales
 * distintas (regla de negocio inviolable #4).
 */

// ---------------------------------------------------------------------------
// Tipos y parámetros de versión
// ---------------------------------------------------------------------------

export interface MatrizQr {
  /** Versión del símbolo (1 a 10). */
  readonly version: number;
  /** Lado en módulos: 17 + 4 × versión. */
  readonly tamano: number;
  /** `true` = módulo oscuro. Indexado `[fila][columna]`. */
  readonly modulos: readonly (readonly boolean[])[];
}

/** Cantidad máxima de caracteres que este módulo puede codificar (versión 10-M). */
export const LARGO_MAXIMO_QR = 213;

interface ParametrosVersion {
  /** Codewords totales del símbolo (datos + corrección). */
  readonly totalCodewords: number;
  /** Codewords de corrección por bloque. */
  readonly ecPorBloque: number;
  /** Bloques del grupo 1 y sus codewords de datos. */
  readonly bloquesGrupo1: number;
  readonly datosGrupo1: number;
  /** Bloques del grupo 2 (0 si la versión no tiene un segundo grupo). */
  readonly bloquesGrupo2: number;
  readonly datosGrupo2: number;
  /** Centros de los patrones de alineación (vacío en la versión 1). */
  readonly alineacion: readonly number[];
}

/**
 * Tabla de las versiones 1 a 10 en nivel M. Los valores son los de la norma;
 * `__tests__/qr.test.ts` verifica la consistencia aritmética de cada fila
 * (datos + corrección = total), que es lo que un dedazo rompería.
 */
const VERSIONES_M: readonly ParametrosVersion[] = [
  { totalCodewords: 26, ecPorBloque: 10, bloquesGrupo1: 1, datosGrupo1: 16, bloquesGrupo2: 0, datosGrupo2: 0, alineacion: [] },
  { totalCodewords: 44, ecPorBloque: 16, bloquesGrupo1: 1, datosGrupo1: 28, bloquesGrupo2: 0, datosGrupo2: 0, alineacion: [6, 18] },
  { totalCodewords: 70, ecPorBloque: 26, bloquesGrupo1: 1, datosGrupo1: 44, bloquesGrupo2: 0, datosGrupo2: 0, alineacion: [6, 22] },
  { totalCodewords: 100, ecPorBloque: 18, bloquesGrupo1: 2, datosGrupo1: 32, bloquesGrupo2: 0, datosGrupo2: 0, alineacion: [6, 26] },
  { totalCodewords: 134, ecPorBloque: 24, bloquesGrupo1: 2, datosGrupo1: 43, bloquesGrupo2: 0, datosGrupo2: 0, alineacion: [6, 30] },
  { totalCodewords: 172, ecPorBloque: 16, bloquesGrupo1: 4, datosGrupo1: 27, bloquesGrupo2: 0, datosGrupo2: 0, alineacion: [6, 34] },
  { totalCodewords: 196, ecPorBloque: 18, bloquesGrupo1: 4, datosGrupo1: 31, bloquesGrupo2: 0, datosGrupo2: 0, alineacion: [6, 22, 38] },
  { totalCodewords: 242, ecPorBloque: 22, bloquesGrupo1: 2, datosGrupo1: 38, bloquesGrupo2: 2, datosGrupo2: 39, alineacion: [6, 24, 42] },
  { totalCodewords: 292, ecPorBloque: 22, bloquesGrupo1: 3, datosGrupo1: 36, bloquesGrupo2: 2, datosGrupo2: 37, alineacion: [6, 26, 46] },
  { totalCodewords: 346, ecPorBloque: 26, bloquesGrupo1: 4, datosGrupo1: 43, bloquesGrupo2: 1, datosGrupo2: 44, alineacion: [6, 28, 50] },
];

export function parametrosDeVersion(version: number): ParametrosVersion {
  const parametros = VERSIONES_M[version - 1];
  if (!parametros) throw new Error(`Versión de QR fuera del alcance soportado (1-10): ${version}.`);
  return parametros;
}

export function codewordsDeDatos(version: number): number {
  const p = parametrosDeVersion(version);
  return p.bloquesGrupo1 * p.datosGrupo1 + p.bloquesGrupo2 * p.datosGrupo2;
}

/** 8 bits para las versiones 1-9, 16 desde la 10 (norma, tabla 3). */
function bitsDelContador(version: number): number {
  return version <= 9 ? 8 : 16;
}

/** Menor versión en la que entran `cantidadBytes` bytes, o `null` si no entra en ninguna. */
export function versionMinima(cantidadBytes: number): number | null {
  for (let version = 1; version <= VERSIONES_M.length; version++) {
    const disponibles = codewordsDeDatos(version) * 8 - 4 - bitsDelContador(version);
    if (cantidadBytes * 8 <= disponibles) return version;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Aritmética en GF(256) y Reed-Solomon
// ---------------------------------------------------------------------------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    // Polinomio primitivo de la norma: x^8 + x^4 + x^3 + x^2 + 1.
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

function multiplicar(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** g(x) = ∏ (x − α^i), coeficientes de mayor a menor grado. */
function polinomioGenerador(grado: number): Uint8Array {
  let g = Uint8Array.from([1]);
  for (let i = 0; i < grado; i++) {
    const siguiente = new Uint8Array(g.length + 1);
    for (let j = 0; j < g.length; j++) {
      siguiente[j] ^= g[j];
      siguiente[j + 1] ^= multiplicar(g[j], EXP[i]);
    }
    g = siguiente;
  }
  return g;
}

/** Resto de dividir el bloque de datos por el polinomio generador. */
export function codewordsDeCorreccion(datos: Uint8Array, cantidad: number): Uint8Array {
  const generador = polinomioGenerador(cantidad);
  const resto = new Uint8Array(datos.length + cantidad);
  resto.set(datos);
  for (let i = 0; i < datos.length; i++) {
    const coeficiente = resto[i];
    if (coeficiente === 0) continue;
    for (let j = 0; j < generador.length; j++) {
      resto[i + j] ^= multiplicar(generador[j], coeficiente);
    }
  }
  return resto.slice(datos.length);
}

// ---------------------------------------------------------------------------
// Codificación del texto
// ---------------------------------------------------------------------------

/**
 * Texto → bytes ISO-8859-1. Cualquier carácter fuera de Latin-1 es un error
 * del llamador: la URL de verificación se arma con el código del documento,
 * que es ASCII, así que llegar acá con otra cosa significa que alguien metió
 * un dato de la persona en el payload del QR.
 */
export function bytesLatin1(texto: string): Uint8Array {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const codigo = texto.charCodeAt(i);
    if (codigo > 0xff) {
      throw new Error(`El payload del QR solo admite caracteres Latin-1; se recibió "${texto[i]}".`);
    }
    bytes[i] = codigo;
  }
  return bytes;
}

/** Bits del segmento (modo + contador + datos), ya con terminador y relleno. */
function codewordsDelMensaje(bytes: Uint8Array, version: number): Uint8Array {
  const capacidad = codewordsDeDatos(version);
  const bits: number[] = [];

  const empujar = (valor: number, cantidad: number): void => {
    for (let i = cantidad - 1; i >= 0; i--) bits.push((valor >> i) & 1);
  };

  empujar(0b0100, 4); // modo byte
  empujar(bytes.length, bitsDelContador(version));
  for (const byte of bytes) empujar(byte, 8);

  // Terminador: hasta 4 ceros, o menos si ya no queda lugar.
  const capacidadBits = capacidad * 8;
  for (let i = 0; i < 4 && bits.length < capacidadBits; i++) bits.push(0);
  // Relleno hasta completar el último byte.
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = new Uint8Array(capacidad);
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords[i / 8] = byte;
  }

  // Bytes de relleno alternados de la norma.
  const RELLENO = [0xec, 0x11];
  for (let i = bits.length / 8, turno = 0; i < capacidad; i++, turno++) {
    codewords[i] = RELLENO[turno % 2];
  }

  return codewords;
}

/**
 * Parte los datos en bloques, calcula la corrección de cada uno y los
 * intercala en el orden que exige la norma (primero un codeword de cada
 * bloque de datos, después uno de cada bloque de corrección).
 */
function codewordsFinales(mensaje: Uint8Array, version: number): Uint8Array {
  const p = parametrosDeVersion(version);
  const bloquesDatos: Uint8Array[] = [];
  const bloquesEc: Uint8Array[] = [];

  let desplazamiento = 0;
  const agregarBloques = (cantidad: number, largo: number): void => {
    for (let i = 0; i < cantidad; i++) {
      const datos = mensaje.slice(desplazamiento, desplazamiento + largo);
      desplazamiento += largo;
      bloquesDatos.push(datos);
      bloquesEc.push(codewordsDeCorreccion(datos, p.ecPorBloque));
    }
  };
  agregarBloques(p.bloquesGrupo1, p.datosGrupo1);
  agregarBloques(p.bloquesGrupo2, p.datosGrupo2);

  const salida = new Uint8Array(p.totalCodewords);
  let escritos = 0;

  const maximoDatos = Math.max(p.datosGrupo1, p.datosGrupo2);
  for (let i = 0; i < maximoDatos; i++) {
    for (const bloque of bloquesDatos) {
      if (i < bloque.length) salida[escritos++] = bloque[i];
    }
  }
  for (let i = 0; i < p.ecPorBloque; i++) {
    for (const bloque of bloquesEc) salida[escritos++] = bloque[i];
  }

  return salida;
}

// ---------------------------------------------------------------------------
// Información de formato y de versión
// ---------------------------------------------------------------------------

/** 15 bits: nivel de corrección (M = 00) + máscara, con BCH(15,5) y XOR de la norma. */
export function bitsDeFormato(mascara: number): number {
  const datos = (0b00 << 3) | mascara;
  let resto = datos << 10;
  for (let i = 4; i >= 0; i--) {
    if ((resto >>> (i + 10)) & 1) resto ^= 0x537 << i;
  }
  return ((datos << 10) | (resto & 0x3ff)) ^ 0x5412;
}

/** 18 bits con BCH(18,6). Solo se dibuja desde la versión 7. */
export function bitsDeVersion(version: number): number {
  let resto = version << 12;
  for (let i = 5; i >= 0; i--) {
    if ((resto >>> (i + 12)) & 1) resto ^= 0x1f25 << i;
  }
  return (version << 12) | (resto & 0xfff);
}

// ---------------------------------------------------------------------------
// Construcción de la matriz
// ---------------------------------------------------------------------------

type Grilla = boolean[][];

function grillaVacia(tamano: number): Grilla {
  return Array.from({ length: tamano }, () => new Array<boolean>(tamano).fill(false));
}

/**
 * Dibuja los patrones fijos (búsqueda, separadores, sincronismo, alineación,
 * módulo oscuro) y marca como reservadas todas las celdas que los datos no
 * pueden ocupar, incluidas las de formato y de versión.
 */
function dibujarPatronesFijos(matriz: Grilla, reservado: Grilla, version: number): void {
  const tamano = matriz.length;

  const fijar = (fila: number, columna: number, oscuro: boolean): void => {
    if (fila < 0 || columna < 0 || fila >= tamano || columna >= tamano) return;
    matriz[fila][columna] = oscuro;
    reservado[fila][columna] = true;
  };

  // Patrones de búsqueda con su separador (9×9 alrededor de cada esquina).
  for (const [filaBase, columnaBase] of [
    [0, 0],
    [0, tamano - 7],
    [tamano - 7, 0],
  ]) {
    for (let df = -1; df <= 7; df++) {
      for (let dc = -1; dc <= 7; dc++) {
        const distancia = Math.max(Math.abs(df - 3), Math.abs(dc - 3));
        fijar(filaBase + df, columnaBase + dc, distancia !== 2 && distancia !== 4);
      }
    }
  }

  // Patrones de sincronismo: fila y columna 6, alternando desde oscuro.
  for (let i = 8; i < tamano - 8; i++) {
    const oscuro = i % 2 === 0;
    fijar(6, i, oscuro);
    fijar(i, 6, oscuro);
  }

  // Patrones de alineación, salvo los que pisarían un patrón de búsqueda.
  const centros = parametrosDeVersion(version).alineacion;
  for (let i = 0; i < centros.length; i++) {
    for (let j = 0; j < centros.length; j++) {
      const enEsquinaDeBusqueda =
        (i === 0 && j === 0) ||
        (i === 0 && j === centros.length - 1) ||
        (i === centros.length - 1 && j === 0);
      if (enEsquinaDeBusqueda) continue;
      for (let df = -2; df <= 2; df++) {
        for (let dc = -2; dc <= 2; dc++) {
          fijar(centros[i] + df, centros[j] + dc, Math.max(Math.abs(df), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // Módulo oscuro fijo, siempre en (4 × versión + 9, 8).
  fijar(tamano - 8, 8, true);

  // Celdas de la información de formato: se reservan acá y se escriben
  // después, cuando ya se sabe qué máscara ganó.
  for (let i = 0; i <= 8; i++) {
    if (!reservado[8][i]) fijar(8, i, false);
    if (!reservado[i][8]) fijar(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!reservado[8][tamano - 1 - i]) fijar(8, tamano - 1 - i, false);
    if (!reservado[tamano - 1 - i][8]) fijar(tamano - 1 - i, 8, false);
  }

  // Información de versión (dos bloques de 6×3), solo desde la versión 7.
  if (version >= 7) {
    const bits = bitsDeVersion(version);
    for (let i = 0; i < 18; i++) {
      const oscuro = ((bits >>> i) & 1) === 1;
      const a = tamano - 11 + (i % 3);
      const b = Math.floor(i / 3);
      fijar(b, a, oscuro);
      fijar(a, b, oscuro);
    }
  }
}

/** Recorrido en zigzag de derecha a izquierda, salteando la columna 6. */
function colocarDatos(matriz: Grilla, reservado: Grilla, codewords: Uint8Array): void {
  const tamano = matriz.length;
  const totalBits = codewords.length * 8;
  let bit = 0;
  let haciaArriba = true;

  for (let derecha = tamano - 1; derecha >= 1; derecha -= 2) {
    if (derecha === 6) derecha = 5;
    for (let paso = 0; paso < tamano; paso++) {
      const fila = haciaArriba ? tamano - 1 - paso : paso;
      for (const columna of [derecha, derecha - 1]) {
        if (reservado[fila][columna]) continue;
        // Los bits de relleno del final del símbolo quedan claros.
        matriz[fila][columna] =
          bit < totalBits && ((codewords[bit >> 3] >> (7 - (bit & 7))) & 1) === 1;
        bit++;
      }
    }
    haciaArriba = !haciaArriba;
  }
}

/** Las 8 máscaras de la norma. `true` = hay que invertir el módulo. */
function aplicaMascara(mascara: number, fila: number, columna: number): boolean {
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

/**
 * Escribe las dos copias de la información de formato. Se llama después de
 * enmascarar porque los 15 bits dependen de la máscara elegida; las celdas ya
 * estaban reservadas, así que no pisa ningún módulo de datos.
 */
function escribirFormato(matriz: Grilla, mascara: number): void {
  const tamano = matriz.length;
  const bits = bitsDeFormato(mascara);
  const leer = (i: number): boolean => ((bits >>> i) & 1) === 1;

  const fijar = (fila: number, columna: number, oscuro: boolean): void => {
    matriz[fila][columna] = oscuro;
  };

  // Primera copia, alrededor del patrón de búsqueda superior izquierdo.
  for (let i = 0; i <= 5; i++) fijar(i, 8, leer(i));
  fijar(7, 8, leer(6));
  fijar(8, 8, leer(7));
  fijar(8, 7, leer(8));
  for (let i = 9; i < 15; i++) fijar(8, 14 - i, leer(i));

  // Segunda copia, repartida entre las otras dos esquinas.
  for (let i = 0; i < 8; i++) fijar(8, tamano - 1 - i, leer(i));
  for (let i = 8; i < 15; i++) fijar(tamano - 15 + i, 8, leer(i));
}

// ---------------------------------------------------------------------------
// Penalización y elección de máscara
// ---------------------------------------------------------------------------

const SECUENCIA_PENALIZADA = [true, false, true, true, true, false, true];

function penalizacion(matriz: Grilla): number {
  const tamano = matriz.length;
  let total = 0;

  // Regla 1: series de 5 o más módulos del mismo color.
  const penalizarSerie = (largo: number): number => (largo >= 5 ? 3 + (largo - 5) : 0);
  for (let i = 0; i < tamano; i++) {
    let serieFila = 1;
    let serieColumna = 1;
    for (let j = 1; j < tamano; j++) {
      serieFila = matriz[i][j] === matriz[i][j - 1] ? serieFila + 1 : 1;
      if (j === tamano - 1 || matriz[i][j] !== matriz[i][j + 1]) total += penalizarSerie(serieFila);
      serieColumna = matriz[j][i] === matriz[j - 1][i] ? serieColumna + 1 : 1;
      if (j === tamano - 1 || matriz[j][i] !== matriz[j + 1][i]) total += penalizarSerie(serieColumna);
    }
  }

  // Regla 2: bloques de 2×2 del mismo color.
  for (let i = 0; i < tamano - 1; i++) {
    for (let j = 0; j < tamano - 1; j++) {
      const color = matriz[i][j];
      if (matriz[i][j + 1] === color && matriz[i + 1][j] === color && matriz[i + 1][j + 1] === color) {
        total += 3;
      }
    }
  }

  // Regla 3: la secuencia 1:1:3:1:1 con 4 módulos claros de un lado.
  const coincide = (leer: (k: number) => boolean, desde: number, largo: number): boolean => {
    for (let k = 0; k < 7; k++) {
      if (leer(desde + k) !== SECUENCIA_PENALIZADA[k]) return false;
    }
    const antes = [desde - 4, desde - 3, desde - 2, desde - 1].every((k) => k < 0 || !leer(k));
    const despues = [desde + 7, desde + 8, desde + 9, desde + 10].every((k) => k >= largo || !leer(k));
    return antes || despues;
  };
  for (let i = 0; i < tamano; i++) {
    for (let j = 0; j + 7 <= tamano; j++) {
      if (coincide((k) => matriz[i][k], j, tamano)) total += 40;
      if (coincide((k) => matriz[k][i], j, tamano)) total += 40;
    }
  }

  // Regla 4: desvío de la proporción de módulos oscuros respecto del 50%.
  let oscuros = 0;
  for (const fila of matriz) for (const modulo of fila) if (modulo) oscuros++;
  const porcentaje = (oscuros * 100) / (tamano * tamano);
  total += Math.floor(Math.abs(porcentaje - 50) / 5) * 10;

  return total;
}

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

/**
 * Codifica `texto` y devuelve la matriz de módulos lista para dibujar.
 *
 * La máscara se elige por penalización mínima, recorriendo las 8 en orden y
 * quedándose con la primera que empata el mínimo: eso es lo que hace que la
 * salida sea determinista y, por lo tanto, que el PDF que la contiene tenga
 * siempre el mismo hash.
 */
export function generarMatrizQr(texto: string): MatrizQr {
  const bytes = bytesLatin1(texto);
  const version = versionMinima(bytes.length);
  if (version === null) {
    throw new Error(
      `El payload del QR excede el máximo soportado (${LARGO_MAXIMO_QR} caracteres): ${bytes.length}.`,
    );
  }

  const codewords = codewordsFinales(codewordsDelMensaje(bytes, version), version);
  const tamano = 17 + 4 * version;

  const base = grillaVacia(tamano);
  const reservado = grillaVacia(tamano);
  dibujarPatronesFijos(base, reservado, version);
  colocarDatos(base, reservado, codewords);

  let mejor: Grilla | null = null;
  let mejorPenalizacion = Number.POSITIVE_INFINITY;

  for (let mascara = 0; mascara < 8; mascara++) {
    const candidata = base.map((fila) => [...fila]);
    for (let fila = 0; fila < tamano; fila++) {
      for (let columna = 0; columna < tamano; columna++) {
        if (reservado[fila][columna]) continue;
        if (aplicaMascara(mascara, fila, columna)) candidata[fila][columna] = !candidata[fila][columna];
      }
    }
    escribirFormato(candidata, mascara);

    const puntaje = penalizacion(candidata);
    if (puntaje < mejorPenalizacion) {
      mejorPenalizacion = puntaje;
      mejor = candidata;
    }
  }

  if (!mejor) throw new Error("No se pudo generar la matriz del QR.");

  return { version, tamano, modulos: mejor.map((fila) => [...fila]) };
}
