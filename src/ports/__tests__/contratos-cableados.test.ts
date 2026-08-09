/**
 * Meta-test: vigila que las suites de contrato de los puertos realmente
 * corran.
 *
 * `vitest.config.mts` incluye solo `src/**\/*.test.ts`, y los archivos
 * `*.contract.ts` no son suites autoejecutables: exportan una función
 * `run…ContractTests(crearProveedor)` que alguien tiene que invocar desde un
 * `.test.ts`, pasándole una implementación concreta. Hoy solo
 * `evidence-store.contract.ts` está cableado (desde
 * `src/repositories/__tests__/evidencia-repository.test.ts`); las otras seis
 * esperan a que existan los adaptadores de `src/adapters/mock/`, que todavía
 * no se escribieron.
 *
 * El riesgo real es silencioso: una suite de contrato escrita y nunca
 * invocada se ve igual que una que pasa. Este test convierte eso en un fallo
 * ruidoso a partir del momento en que existan los mocks — que es cuando
 * dejar un puerto sin verificar pasa a ser una omisión y no una etapa.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR_CONTRATOS = dirname(fileURLToPath(import.meta.url));
const DIR_SRC = resolve(DIR_CONTRATOS, "../..");
const DIR_ADAPTADORES_MOCK = join(DIR_SRC, "adapters", "mock");

function archivosDeContrato(): readonly string[] {
  return readdirSync(DIR_CONTRATOS)
    .filter((archivo) => archivo.endsWith(".contract.ts"))
    .sort();
}

function suiteExportadaPor(archivo: string): string | null {
  const contenido = readFileSync(join(DIR_CONTRATOS, archivo), "utf8");
  const encontrada = contenido.match(/export function (run\w*ContractTests)\b/);
  return encontrada ? encontrada[1] : null;
}

function archivosDeTest(directorio: string): readonly string[] {
  const encontrados: string[] = [];

  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      encontrados.push(...archivosDeTest(ruta));
    } else if (entrada.endsWith(".test.ts") || entrada.endsWith(".test.tsx")) {
      encontrados.push(ruta);
    }
  }

  return encontrados;
}

function suitesInvocadas(): ReadonlySet<string> {
  const invocadas = new Set<string>();

  for (const rutaTest of archivosDeTest(DIR_SRC)) {
    const contenido = readFileSync(rutaTest, "utf8");
    for (const llamada of contenido.matchAll(/\b(run\w*ContractTests)\s*\(/g)) {
      invocadas.add(llamada[1]);
    }
  }

  return invocadas;
}

describe("suites de contrato de los puertos", () => {
  it("cada archivo *.contract.ts exporta una suite run…ContractTests", () => {
    const sinSuite = archivosDeContrato().filter((archivo) => suiteExportadaPor(archivo) === null);

    expect(
      sinSuite,
      `Estos archivos *.contract.ts no exportan ninguna función run…ContractTests, ` +
        `así que ningún test puede invocarlos: ${sinSuite.join(", ")}`,
    ).toEqual([]);
  });

  it("hay al menos una suite de contrato por puerto declarado en src/ports/", () => {
    const puertos = readdirSync(DIR_SRC + "/ports")
      .filter((archivo) => archivo.endsWith(".ts") && archivo !== "index.ts")
      .map((archivo) => archivo.replace(/\.ts$/, ""));

    const conContrato = archivosDeContrato().map((archivo) => archivo.replace(/\.contract\.ts$/, ""));

    expect(conContrato.sort()).toEqual(puertos.sort());
  });

  /**
   * El chequeo es por puerto, no por la existencia del directorio
   * `src/adapters/mock/`: los mocks se escriben de a uno (P1 trajo el de
   * `otp-provider`), y exigir las siete suites cableadas apenas aparece el
   * primer mock convertiría una etapa normal del proyecto en un test rojo.
   * Lo que sí es una omisión —y esto lo detecta— es tener el mock de un
   * puerto y su suite de contrato sin invocar: ahí la suite no verifica nada
   * y nadie se entera.
   */
  function tieneAdaptadorMock(puerto: string): boolean {
    return existsSync(join(DIR_ADAPTADORES_MOCK, `${puerto}.ts`));
  }

  it("todo puerto que ya tiene adaptador mock corre su suite de contrato", () => {
    const invocadas = suitesInvocadas();

    const sinCablear = archivosDeContrato()
      .map((archivo) => ({
        archivo,
        puerto: archivo.replace(/\.contract\.ts$/, ""),
        suite: suiteExportadaPor(archivo),
      }))
      .filter(({ puerto, suite }) => suite !== null && tieneAdaptadorMock(puerto) && !invocadas.has(suite))
      .map(({ archivo, suite }) => `${archivo} (${suite})`);

    expect(
      sinCablear,
      `Estos puertos ya tienen adaptador en src/adapters/mock/, así que su suite de contrato debería ` +
        `correr contra él. Escritas pero nunca invocadas, no verifican nada: ${sinCablear.join(", ")}`,
    ).toEqual([]);
  });

  it("deja a la vista qué puertos siguen sin mock y sin contrato ejercido", () => {
    const invocadas = suitesInvocadas();
    const pendientes = archivosDeContrato()
      .map((archivo) => ({ puerto: archivo.replace(/\.contract\.ts$/, ""), suite: suiteExportadaPor(archivo) }))
      .filter(({ suite }) => suite !== null && !invocadas.has(suite))
      .map(({ puerto }) => puerto);

    // No es una aserción de que estén pendientes: es la constancia visible de
    // cuáles faltan, para que el hueco no quede implícito. Cuando se escriba
    // el mock de cualquiera de ellos, el test de arriba lo empieza a exigir.
    for (const puerto of pendientes) {
      expect(tieneAdaptadorMock(puerto)).toBe(false);
    }
  });
});
