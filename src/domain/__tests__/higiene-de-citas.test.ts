/**
 * Meta-test: vigila que el código no cite como vigente una norma derogada,
 * ni repita la errata de numeración de la resolución de modelos, ni publique
 * un dato de contacto inventado.
 *
 * Por qué existe. Este repositorio justifica sus reglas de negocio citando
 * normas en los comentarios, y esas citas se copian de un módulo al
 * siguiente: la resolución de modelos apareció con el año equivocado en 72
 * lugares porque la primera cita se escribió mal y las demás la heredaron
 * («215/15», después «215/2025»; es **215/17**, del 28-dic-2017). Una cita mal
 * copiada no rompe ninguna prueba y sobrevive a
 * cualquier revisión de código, así que la única forma de que no vuelva es
 * que falle la suite.
 *
 * Qué NO hace: no valida que la cita sea *pertinente* —que el artículo diga
 * lo que el comentario afirma—, porque eso exige leer la norma. Solo impide
 * las citas que ya sabemos equivocadas.
 *
 * Alcance. Se revisa `src/` y la matriz de cumplimiento, que son lo que
 * viaja al producto y la fuente de verdad regulatoria. **No** se revisa el
 * resto de `docs/`: los documentos de auditoría nombran las normas
 * derogadas justamente para advertir que no se citen, y prohibírselo haría
 * imposible documentar la advertencia.
 *
 * Procedencia de la lista: memo «Actualizaciones normativas relevantes»
 * (26-ago-2026), §9 «Normas derogadas, sustituidas o no aplicables», y
 * `docs/auditoria/ANALISIS_RES_210_2025.md` §8.9. La entrada de la 215 se
 * corrigió el 04-sep-2026 con los textos oficiales en `docs/normativa/`: la
 * 215/17 es la vigente (la 231/2025 la cita como base) y «215/2025» fue la
 * errata que este mismo test imponía hasta entonces.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ESTE_ARCHIVO = fileURLToPath(import.meta.url);
const DIR_SRC = resolve(dirname(ESTE_ARCHIVO), "../..");
const RAIZ = resolve(DIR_SRC, "..");
const MATRIZ_CUMPLIMIENTO = join(RAIZ, "docs", "Tabla Cumplimiento SeguroLo Tengo - Tabla.csv");

interface CitaProhibida {
  /** Cómo se escribiría la cita en este repositorio si alguien la reintrodujera. */
  readonly patron: RegExp;
  readonly queEs: string;
  readonly enSuLugar: string;
}

const CITAS_PROHIBIDAS: readonly CitaProhibida[] = [
  {
    patron: /\bLey\s*(N\.?\s*º?\s*)?4017\b/i,
    queEs: "Ley 4017/2010 (firma digital), derogada",
    enSuLugar: "Ley 6822/2021",
  },
  {
    patron: /\bLey\s*(N\.?\s*º?\s*)?4610\b/i,
    queEs: "Ley 4610/2012 (modificatoria de la 4017), derogada",
    enSuLugar: "Ley 6822/2021",
  },
  {
    patron: /\b136\/(20)?18\b/,
    queEs: "Res. SIS 136/2018 (pólizas con firma facsimilar y digital), abrogada por el art. 1º de la 231/2025",
    enSuLugar: "Res. SIS 231/2025",
  },
  {
    patron: /\b292\/(20)?07\b/,
    queEs: "Res. SIS 292/2007 (modelos de póliza), derogada por el art. 19º de la 215/17",
    enSuLugar: "Res. SIS 215/17",
  },
  {
    patron: /\b022\/(20)?24\b/,
    queEs: "Res. SIS 022/2024 (consultas, quejas y reclamos), abrogada",
    enSuLugar: "Res. SIS 030/2025",
  },
  {
    patron: /\b303\/(20)?24\b/,
    queEs: "Res. SIS 303/2024 (matriculación de auxiliares), abrogada",
    enSuLugar: "Res. SIS 031/2026, ampliada por la 117/2026",
  },
  {
    patron: /\b215\/(15|2025)\b/,
    queEs:
      "«Res. 215/15» o «215/2025»: erratas de la resolución de registro de planes y modelos, que es la 215/17 (28-dic-2017)",
    enSuLugar: "Res. SIS 215/17",
  },
  {
    patron: /segurolotengo\.com\.py/i,
    queEs: "un dominio de contacto que no existe ni está cerrado en la matriz",
    enSuLugar:
      "los datos de `src/domain/entidades.ts`, que omiten lo que todavía no tenemos (D-19)",
  },
];

function archivosDeCodigo(directorio: string): readonly string[] {
  const encontrados: string[] = [];

  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      encontrados.push(...archivosDeCodigo(ruta));
    } else if (/\.tsx?$/.test(entrada) && ruta !== ESTE_ARCHIVO) {
      encontrados.push(ruta);
    }
  }

  return encontrados;
}

/** `archivo:línea` de cada aparición, que es lo que se necesita para ir a arreglarla. */
function aparicionesEn(rutas: readonly string[], patron: RegExp): readonly string[] {
  const apariciones: string[] = [];

  for (const ruta of rutas) {
    const lineas = readFileSync(ruta, "utf8").split("\n");
    lineas.forEach((linea, indice) => {
      if (patron.test(linea)) {
        apariciones.push(`${relative(RAIZ, ruta)}:${indice + 1}`);
      }
    });
  }

  return apariciones;
}

describe("higiene de citas normativas", () => {
  const codigo = archivosDeCodigo(DIR_SRC);

  it("encuentra archivos que revisar (si no, el test estaría pasando por vacío)", () => {
    expect(codigo.length).toBeGreaterThan(100);
  });

  describe.each(CITAS_PROHIBIDAS)("$queEs", ({ patron, enSuLugar }) => {
    it(`no aparece en src/ — corresponde ${enSuLugar}`, () => {
      expect(aparicionesEn(codigo, patron)).toEqual([]);
    });

    it(`no aparece en la matriz de cumplimiento — corresponde ${enSuLugar}`, () => {
      expect(aparicionesEn([MATRIZ_CUMPLIMIENTO], patron)).toEqual([]);
    });
  });
});
