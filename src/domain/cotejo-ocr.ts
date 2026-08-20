/**
 * Corrección de los datos que el OCR leyó de la cédula, con cotejo (CHG-15).
 *
 * ## El problema que resuelve
 *
 * Hasta ahora los seis campos leídos de la cédula eran de solo lectura y el
 * único camino ante una discrepancia era repetir la captura. Es seguro, pero
 * deja sin salida a quien tiene un OCR que se equivoca siempre igual: una `O`
 * por un `0`, una tilde de más, un apellido compuesto partido. Repetir la foto
 * diez veces no arregla una lectura que va a fallar diez veces.
 *
 * La reunión (00:10:44–00:15:51) pidió permitir la corrección **con una
 * condición**, en palabras de Rodrigo: *"tiene que cotejar que luego sea lo
 * mismo… no puede poner Juan y el carnet que diga Pedro"*. Eso es lo que hace
 * este módulo: acepta que se arregle una lectura, rechaza que se reemplace.
 *
 * ## Qué se puede corregir y qué no
 *
 * **Corregibles:** nombres y apellidos. Son los campos donde el OCR falla por
 * forma —caracteres parecidos, acentos, espacios— y donde el error es visible
 * para la persona.
 *
 * **No corregibles, y no es una omisión:** número de cédula, fecha de
 * nacimiento, sexo y nacionalidad.
 *
 * - La **fecha de nacimiento** decide el corte de edad de 18 a 64 (regla
 *   inviolable #8, que exige verificarla contra el documento y *no* contra un
 *   campo declarado). Si se pudiera escribir, alcanzaría con tipear otro año
 *   para entrar al producto.
 * - El **número de cédula** es la llave del expediente y la base del bloqueo
 *   por cédula (regla inviolable #11). Editarlo permitiría empezar de nuevo
 *   con una cédula distinta de la fotografiada.
 * - **Sexo** y **nacionalidad** salen del MRZ con dígito verificador; una
 *   discrepancia ahí no es un error de lectura, es otro documento.
 *
 * Para esos cuatro el camino sigue siendo repetir la captura. La distinción no
 * es de comodidad: es dónde una corrección libre convertiría un dato del
 * documento en un dato declarado.
 *
 * ## Cómo coteja
 *
 * Comparación normalizada —sin acentos, sin dobles espacios, en mayúsculas— y,
 * si aun así difieren, una distancia de edición acotada. La idea es aceptar
 * *arreglos* y rechazar *reemplazos*: `JÜAN` → `JUAN` pasa; `PEDRO` → `JUAN`
 * no. El umbral es deliberadamente chico y crece con el largo del campo,
 * porque un apellido largo tiene más lugar donde el OCR se equivoque.
 */

/** Campos leídos de la cédula que la persona puede corregir. */
export const CAMPOS_CORREGIBLES = ["nombres", "apellidos"] as const;

export type CampoCorregible = (typeof CAMPOS_CORREGIBLES)[number];

export function esCampoCorregible(valor: string): valor is CampoCorregible {
  return (CAMPOS_CORREGIBLES as readonly string[]).includes(valor);
}

/**
 * Correcciones que llegan desde la pantalla. Ausente significa "sin corregir":
 * el valor del OCR queda tal cual.
 */
export type CorreccionesOcr = Partial<Record<CampoCorregible, string>>;

/** Mayúsculas, sin acentos, sin espacios de más. */
export function normalizarParaCotejo(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Distancia de Levenshtein entre dos cadenas ya normalizadas.
 *
 * Implementada acá y no traída de una librería: son veinte líneas, y sumar una
 * dependencia al dominio —que no tiene ninguna, ni siquiera `node:*`— por esto
 * sería un mal negocio.
 */
export function distanciaDeEdicion(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(
        (actual[j - 1] ?? 0) + 1,
        (anterior[j] ?? 0) + 1,
        (anterior[j - 1] ?? 0) + costo,
      );
    }
    anterior = actual;
  }

  return anterior[b.length] ?? 0;
}

/**
 * Cuántos caracteres puede diferir una corrección de lo que leyó el OCR.
 *
 * Uno cada seis caracteres, con un piso de 1 y un techo de 3. El piso permite
 * arreglar un campo corto (`ANA` con una letra mal); el techo evita que un
 * campo largo se vuelva reescribible: `MARIA DE LOS ANGELES` admite tres
 * arreglos, no convertirse en otro nombre.
 */
export function toleranciaDe(leidoPorOcr: string): number {
  return Math.min(3, Math.max(1, Math.floor(normalizarParaCotejo(leidoPorOcr).length / 6)));
}

export type ResultadoCotejo =
  | { readonly ok: true; readonly valor: string; readonly corregido: boolean }
  | {
      readonly ok: false;
      readonly motivo: "NO_COINCIDE_CON_LA_CEDULA";
      readonly campo: CampoCorregible;
    };

/**
 * Coteja una corrección contra lo que el OCR leyó.
 *
 * Devuelve el valor a persistir: el corregido si pasa el cotejo, o el del OCR
 * si no hubo corrección. Nunca inventa un valor intermedio.
 */
export function cotejarCorreccion(
  campo: CampoCorregible,
  leidoPorOcr: string,
  corregido: string | undefined,
): ResultadoCotejo {
  if (corregido === undefined || corregido.trim() === "") {
    return { ok: true, valor: leidoPorOcr, corregido: false };
  }

  const ocrNormalizado = normalizarParaCotejo(leidoPorOcr);
  const correccionNormalizada = normalizarParaCotejo(corregido);

  if (correccionNormalizada === "") {
    return { ok: false, motivo: "NO_COINCIDE_CON_LA_CEDULA", campo };
  }

  // Igual salvo acentos, mayúsculas o espacios: es la misma lectura escrita de
  // otra forma, y se guarda como la escribió la persona.
  if (ocrNormalizado === correccionNormalizada) {
    return { ok: true, valor: corregido.trim(), corregido: true };
  }

  if (distanciaDeEdicion(ocrNormalizado, correccionNormalizada) <= toleranciaDe(leidoPorOcr)) {
    return { ok: true, valor: corregido.trim(), corregido: true };
  }

  return { ok: false, motivo: "NO_COINCIDE_CON_LA_CEDULA", campo };
}
