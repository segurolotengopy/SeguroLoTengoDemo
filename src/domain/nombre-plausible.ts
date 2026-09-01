/**
 * ¿Lo que el OCR leyó puede ser un nombre de persona?
 *
 * **Por qué existe.** Sin MRZ, la lectura del frente de la cédula adivina por
 * posición: toma la línea que sigue al rótulo. Cuando el rótulo cae al lado de
 * otra cosa, esa apuesta devuelve el texto impreso del propio documento —
 * «BLI», «FECHA DE VENCIMIENTO»— y la pantalla lo presenta como si fuera el
 * nombre de la persona. Un campo vacío se corrige solo; un campo con basura
 * que parece un dato hay que notarlo primero, y en la prueba con documentos
 * reales viajó hasta el cotejo (pedido de Andres, 01-sep).
 *
 * **La regla es dejar vacío ante la duda**, no arriesgar: el nombre lo escribe
 * la persona y se respalda con la declaración que firma (regla #8 por su
 * espíritu — nada que decida elegibilidad sale de una adivinanza). Esto **no**
 * valida identidad ni reemplaza al MRZ: cuando hay MRZ, el MRZ gana y esto no
 * corre.
 *
 * No es un diccionario de nombres: un diccionario dejaría afuera nombres
 * legítimos poco frecuentes, que es un daño peor que un campo vacío. Lo que
 * descarta es lo que **no puede** ser un nombre — números, símbolos, palabras
 * del propio documento y fragmentos demasiado cortos para ser uno.
 */

/** Palabras impresas en la cédula que nunca son parte de un nombre. */
const PALABRAS_DEL_DOCUMENTO: ReadonlySet<string> = new Set([
  "CEDULA",
  "IDENTIDAD",
  "REPUBLICA",
  "PARAGUAY",
  "PARAGUAYA",
  "PARAGUAYO",
  "BOLIVIA",
  "BOLIVIANA",
  "BOLIVIANO",
  "DOCUMENTO",
  "NOMBRES",
  "NOMBRE",
  "APELLIDOS",
  "APELLIDO",
  "FECHA",
  "NACIMIENTO",
  "VENCIMIENTO",
  "EMISION",
  "EXPIRACION",
  "EXPEDICION",
  "CADUCIDAD",
  "NACIONALIDAD",
  "SEXO",
  "SERIE",
  "FIRMA",
  "DIRECCION",
  "ESTADO",
  "CIVIL",
  "LUGAR",
  "IDENTIFICACION",
  "PERSONAL",
  "NUMERO",
  "DNI",
  "BLI",
]);

/** Mínimo de letras para que un token pueda ser un nombre o un apellido. */
const LARGO_MINIMO_TOKEN = 3;
/** Mínimo del texto completo: descarta iniciales y restos de rótulo. */
const LARGO_MINIMO_TOTAL = 4;
/** Más de esto no es un nombre: es una línea entera del documento. */
const MAXIMO_TOKENS = 5;

const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’-]+$/;

/**
 * `true` solo si el texto puede ser un nombre o apellido de persona. Ante
 * cualquier duda devuelve `false`: el costo de un campo vacío es que la
 * persona lo escriba; el de un campo con basura es que no lo mire.
 */
export function pareceNombreDePersona(valor: string | null | undefined): boolean {
  if (valor === null || valor === undefined) return false;
  const texto = valor.trim().replace(/\s+/g, " ");
  if (texto.length < LARGO_MINIMO_TOTAL) return false;

  const tokens = texto.split(" ");
  if (tokens.length > MAXIMO_TOKENS) return false;

  for (const token of tokens) {
    if (!SOLO_LETRAS.test(token)) return false;
    // Las partículas de apellido son legítimas y cortas: «de», «la», «del»,
    // «da». Se admiten solo acompañadas, nunca como el valor entero.
    const esParticula =
      tokens.length > 1 && token.length <= 3 && /^[A-Za-zÁÉÍÓÚÑáéíóúñ]+$/.test(token);
    if (token.length < LARGO_MINIMO_TOKEN && !esParticula) return false;
    if (PALABRAS_DEL_DOCUMENTO.has(quitarTildes(token).toUpperCase())) return false;
  }

  return true;
}

function quitarTildes(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** El valor si puede ser un nombre; `null` si no. Ante la duda, vacío. */
export function nombreLeidoOVacio(valor: string | null | undefined): string | null {
  return pareceNombreDePersona(valor) ? (valor ?? "").trim().replace(/\s+/g, " ") : null;
}
