/**
 * Lectura **aproximada** de los campos de una cédula desde el texto del OCR,
 * para el camino de demostración con cámara.
 *
 * ## Por qué existe, y por qué producción no lo usa
 *
 * `textract-cedula.ts` es deliberadamente conservador: sin MRZ no devuelve ni
 * nombre ni fecha de nacimiento, porque el frente de la cédula no tiene un
 * formato publicado y reconocer campos por posición es adivinar. La fecha de
 * nacimiento alimenta el corte de edad 18–64 (regla inviolable #8), y ahí
 * adivinar es inaceptable: el precio de equivocarse es emitir —o negar— una
 * póliza sobre una edad inventada.
 *
 * Este módulo **sí adivina**, con heurísticas de rótulo y de proximidad. Es
 * exactamente lo que producción no puede hacer. Existe para que una
 * demostración con cédulas reales muestre datos reales en pantalla en vez de
 * campos vacíos, y por eso:
 *
 * - solo lo usa `identity-provider-camara.ts`, que exige `DEMO_MODE=true`;
 * - cada dato que sale de acá viaja marcado con la política de demostración
 *   (`VERSION_POLITICA_IDENTIDAD_DEMO`), así la evidencia nunca lo confunde
 *   con una lectura verificada contra MRZ;
 * - cuando **sí** hay MRZ, el adaptador ni siquiera llama a este módulo: el
 *   MRZ trae dígitos verificadores y siempre gana.
 *
 * Dicho de otra forma: esto es una lupa, no un notario.
 */
import type { PaisDocumento } from "../../domain/documento-regional";
import { nombreLeidoOVacio } from "../../domain/nombre-plausible";
import { normalizarTexto } from "../../domain/documento-regional";
import type { LineaReconocida } from "./textract-cedula";

/** Fecha impresa, en `DD/MM/AAAA` o `DD-MM-AAAA` (también con dos dígitos de año). */
const PATRON_FECHA = /\b(\d{2})[/.-](\d{2})[/.-](\d{2,4})\b/;

/**
 * Meses en palabras, para la fecha escrita en texto.
 *
 * La cédula boliviana del formato anterior **no imprime fechas en números**:
 * dice `Nacido el 30 de Diciembre de 1967`, `Emitida el 14 de Mayo de 2021`.
 * Sin esto no se extrae ninguna fecha de ese documento, y sin fecha de
 * nacimiento no hay corte de edad — el recorrido se corta con "no pudimos leer
 * los datos de la cédula" aunque el OCR haya leído todo bien.
 */
const MESES: Readonly<Record<string, number>> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10,
  NOVIEMBRE: 11, DICIEMBRE: 12,
};

/** `30 DE DICIEMBRE DE 1967`, ya normalizado a mayúsculas sin tildes. */
const PATRON_FECHA_EN_PALABRAS = new RegExp(
  String.raw`\b(\d{1,2})\s+DE\s+(` + Object.keys(MESES).join("|") + String.raw`)\s+DE\s+(\d{4})\b`,
);

/**
 * Rótulos que anteceden a cada campo, por país. Se buscan **normalizados**.
 *
 * El valor puede estar en la misma línea después del rótulo (`NOMBRES: MONICA`)
 * o en la línea siguiente, que es lo más común cuando Textract corta por
 * bloques visuales. Se prueban las dos formas, en ese orden.
 */
const ROTULOS: Readonly<Record<PaisDocumento, Readonly<Record<string, readonly string[]>>>> = {
  PY: {
    nombres: ["NOMBRES", "NOMBRE"],
    apellidos: ["APELLIDOS", "APELLIDO"],
    fechaNacimiento: ["FECHA DE NACIMIENTO", "NACIMIENTO", "FEC NAC"],
    sexo: ["SEXO"],
  },
  BO: {
    nombres: ["NOMBRES", "NOMBRE"],
    apellidos: ["APELLIDOS", "APELLIDO"],
    // `NACIDO EL` es el del formato anterior, que no rotula "fecha de
    // nacimiento" en ningún lado: el dorso dice `Nacido el 30 de Diciembre de
    // 1967`.
    fechaNacimiento: ["FECHA DE NACIMIENTO", "NACIMIENTO", "NACIDO EL", "NACIDA EL"],
    sexo: ["SEXO"],
  },
};

/** Palabras que nunca son un valor: si el candidato es una de estas, no sirve. */
const NO_ES_VALOR = new Set([
  "NOMBRES",
  "NOMBRE",
  "APELLIDOS",
  "APELLIDO",
  "SEXO",
  "NACIONALIDAD",
  "FECHA DE NACIMIENTO",
  "FECHA DE EMISION",
  "FECHA DE EXPIRACION",
  "FECHA DE EXPEDICION",
  "VENCIMIENTO",
  "SERIE",
  "SECCION",
  "FIRMA",
  "DONANTE",
  "CEDULA DE IDENTIDAD",
]);

export interface CamposAproximados {
  readonly nombres: string | null;
  readonly apellidos: string | null;
  /** ISO 8601 (AAAA-MM-DD). */
  readonly fechaNacimiento: string | null;
  /** `M` o `F`. */
  readonly sexo: string | null;
  /** Todas las fechas encontradas, en ISO, en el orden en que aparecieron. */
  readonly fechasEncontradas: readonly string[];
}

/** `DD/MM/AAAA` → `AAAA-MM-DD`. Devuelve `null` si la fecha no es un día real. */
function aIso(dia: string, mes: string, anio: string): string | null {
  // Año de dos dígitos: la cédula no trae siglo, así que se resuelve por
  // ventana. Una fecha de nacimiento no puede estar en el futuro, así que
  // todo lo que caiga adelante pertenece al siglo pasado.
  const anioCompleto =
    anio.length === 4
      ? Number(anio)
      : Number(anio) + (Number(anio) > Number(String(new Date().getFullYear()).slice(2)) ? 1900 : 2000);

  const d = Number(dia);
  const m = Number(mes);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const fecha = new Date(Date.UTC(anioCompleto, m - 1, d));
  // Rebote de `Date`: el 31/02 se convierte en 03/03 y hay que descartarlo.
  if (fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) return null;

  return fecha.toISOString().slice(0, 10);
}

/** Lee una fecha de un texto, en cualquiera de las dos formas. `null` si no hay. */
function fechaDeTexto(texto: string): string | null {
  const numerica = texto.match(PATRON_FECHA);
  if (numerica) return aIso(numerica[1], numerica[2], numerica[3]);

  const enPalabras = texto.match(PATRON_FECHA_EN_PALABRAS);
  if (!enPalabras) return null;
  return aIso(
    enPalabras[1].padStart(2, "0"),
    String(MESES[enPalabras[2]]).padStart(2, "0"),
    enPalabras[3],
  );
}

/**
 * Palabras que delatan una línea institucional del documento, no un nombre.
 *
 * Hacen falta porque el reverso está lleno de líneas que son puras letras y
 * espacios —"EL SERVICIO GENERAL DE IDENTIFICACION PERSONAL"— y pasarían
 * cualquier prueba de forma.
 */
const PALABRAS_NO_PERSONALES = [
  "SERVICIO",
  "CERTIFICA",
  "IDENTIFICACION",
  "PERSONAL",
  "PLURINACIONAL",
  "BOLIVIA",
  "PARAGUAY",
  "ESTADO",
  "DOCUMENTOS",
  "REGISTRADOS",
  "DOMICILIO",
  "PERTENECE",
  "IMPRESION",
  "FOTOGRAFIA",
  "FIRMA",
  "CEDULA",
  "IDENTIDAD",
  "DIRECTOR",
  "DIRECTORA",
];

/** Una línea que parece un nombre completo: solo letras y espacios, 2 a 6 palabras. */
function pareceNombreCompleto(texto: string): boolean {
  if (!/^[A-ZÑ ]+$/.test(texto)) return false;
  if (PALABRAS_NO_PERSONALES.some((palabra) => texto.includes(palabra))) return false;
  const palabras = texto.split(" ").filter((p) => p.length >= 2);
  return palabras.length >= 2 && palabras.length <= 6 && texto.length >= 6;
}

/**
 * Nombre completo del dorso de la cédula boliviana del formato anterior.
 *
 * Ese dorso **no separa nombres de apellidos**: dice "…que la firma, fotografía
 * e impresión pertenece / A: JAVIER ANDRES …" en una sola línea corrida. No hay
 * rótulo `NOMBRES` que buscar, así que se ancla en `PERTENECE` y se toma la
 * primera línea posterior que parezca un nombre.
 *
 * El corte entre nombres y apellidos es una **convención, no un dato**: en
 * Bolivia el orden es nombres + apellido paterno + apellido materno, así que se
 * asignan los dos últimos tokens a los apellidos. Con un solo apellido queda
 * mal repartido, y es un precio que solo se paga en el camino de demostración.
 */
function nombreCompletoBoliviano(textos: readonly string[]): string | null {
  // **Después** del ancla, no desde el ancla: la línea que dice "PERTENECE" es
  // también puras letras y espacios, y se colaba como nombre.
  const ancla = textos.findIndex((texto) => texto.includes("PERTENECE"));
  const desde = ancla === -1 ? 0 : ancla + 1;

  for (const texto of textos.slice(desde)) {
    // "A: JAVIER ANDRES …" — se saca el prefijo del rótulo si vino pegado.
    const limpio = texto.replace(/^A\s*[:.]?\s*/, "").trim();
    if (pareceNombreCompleto(limpio)) return limpio;
  }
  return null;
}

/**
 * Busca el valor que sigue a un rótulo: primero en la misma línea, después en
 * la siguiente.
 */
function valorTrasRotulo(
  lineas: readonly string[],
  rotulos: readonly string[],
): string | null {
  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i];

    // Se prueba **un solo rótulo por línea**: el primero que matchee. Los
    // rótulos vienen del más largo al más corto ("NOMBRES" antes que
    // "NOMBRE") y son prefijos entre sí, así que seguir probando después de
    // un acierto haría que la línea "NOMBRES" matcheara también con "NOMBRE"
    // y devolviera la "S" sobrante como si fuera el nombre de la persona.
    const rotulo = rotulos.find((candidato) => linea.includes(candidato));
    if (rotulo === undefined) continue;

    const resto = linea.slice(linea.indexOf(rotulo) + rotulo.length).replace(/^[\s:.-]+/, "").trim();
    if (resto !== "" && !NO_ES_VALOR.has(resto)) return resto;

    const siguiente = (lineas[i + 1] ?? "").trim();
    if (siguiente !== "" && !NO_ES_VALOR.has(siguiente)) return siguiente;
  }

  return null;
}

/**
 * Extrae lo que se pueda del frente, sin MRZ y sin garantías.
 *
 * **La fecha de nacimiento tiene dos caminos, y el segundo es una apuesta.**
 * Si aparece rotulada, se usa esa. Si no, se toma **la más antigua** de todas
 * las que haya en el documento, apoyándose en que emisión y vencimiento son
 * siempre posteriores al nacimiento. Es cierto en toda cédula real, pero
 * depende de que el OCR haya leído bien los tres números — y de que no haya
 * colado una cuarta fecha de otro lado. Producción no acepta esa apuesta; la
 * demostración sí, a cambio de mostrar datos en pantalla.
 */
export function extraerCamposAproximados(
  lineas: readonly LineaReconocida[],
  pais: PaisDocumento,
): CamposAproximados {
  const textos = lineas.map((linea) => normalizarTexto(linea.texto)).filter((t) => t !== "");
  const rotulos = ROTULOS[pais];

  const fechasEncontradas: string[] = [];
  for (const texto of textos) {
    const numerica = texto.match(PATRON_FECHA);
    if (numerica) {
      const iso = aIso(numerica[1], numerica[2], numerica[3]);
      if (iso) fechasEncontradas.push(iso);
      continue;
    }
    const enPalabras = texto.match(PATRON_FECHA_EN_PALABRAS);
    if (enPalabras) {
      const iso = aIso(
        enPalabras[1].padStart(2, "0"),
        String(MESES[enPalabras[2]]).padStart(2, "0"),
        enPalabras[3],
      );
      if (iso) fechasEncontradas.push(iso);
    }
  }

  const fechaRotulada = valorTrasRotulo(textos, rotulos.fechaNacimiento);
  const desdeRotulo = fechaRotulada === null ? null : fechaDeTexto(fechaRotulada);
  const fechaNacimiento =
    desdeRotulo ?? (fechasEncontradas.length > 0 ? [...fechasEncontradas].sort()[0] : null);

  const sexoCrudo = valorTrasRotulo(textos, rotulos.sexo);
  const sexo =
    sexoCrudo === null
      ? null
      : /^(M|MASCULINO|VARON)\b/.test(sexoCrudo)
        ? "M"
        : /^(F|FEMENINO|MUJER)\b/.test(sexoCrudo)
          ? "F"
          : null;

  // Camino rotulado (formato nuevo) y, si no hay, el nombre corrido del dorso
  // boliviano del formato anterior.
  // Sin MRZ la lectura del frente es una apuesta por posición: si lo que salió
  // no puede ser un nombre, se deja vacío en vez de presentarlo como dato
  // (pedido de Andres, 01-sep — la prueba con cédulas reales devolvió «BLI» y
  // «FECHA DE VENCIMIENTO» y eso llegó hasta el cotejo).
  let nombres = nombreLeidoOVacio(valorTrasRotulo(textos, rotulos.nombres));
  let apellidos = nombreLeidoOVacio(valorTrasRotulo(textos, rotulos.apellidos));

  if (pais === "BO" && (nombres === null || apellidos === null)) {
    const completo = nombreCompletoBoliviano(textos);
    if (completo) {
      const palabras = completo.split(" ").filter((p) => p !== "");
      const corte = Math.max(1, palabras.length - 2);
      nombres = nombres ?? nombreLeidoOVacio(palabras.slice(0, corte).join(" "));
      apellidos = apellidos ?? nombreLeidoOVacio(palabras.slice(corte).join(" "));
    }
  }

  return {
    nombres,
    apellidos,
    fechaNacimiento,
    sexo,
    fechasEncontradas,
  };
}
