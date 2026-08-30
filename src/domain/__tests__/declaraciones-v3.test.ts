/**
 * El mapa 5→8 (DI-3) y el camino v3 del caso de uso de declaraciones.
 *
 * El test que DI-3 exige por nombre: la pantalla pregunta cinco cosas, el PDF
 * imprime ocho, y esta es la única pieza que traduce — si el mapa pierde una
 * clave o cambia una derivación, la Solicitud imprimiría algo que nadie
 * respondió.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvidenceStore } from "../../ports/evidence-store";
import {
  CLAVES_RESPUESTAS_V3,
  expandirRespuestasV3,
  interpretarRespuestasV3,
} from "../declaraciones-v3";
import type { RespuestasSeguroV3 } from "../declaraciones-v3";
import { DECLARACIONES_P6, evaluarElegibilidad, interpretarDeclaracionesP6 } from "../elegibilidad";
import type { DependenciasP6 } from "../declaraciones-p6";
import { VERSION_ACEPTACION_SEGURO } from "../textos-seguro";
import type { Expediente, RegistroEvidencia } from "../tipos";
import { crearExpediente } from "./fixtures";

const COMPATIBLES: RespuestasSeguroV3 = {
  salud: "SI",
  antecedentes: "NO",
  enfermedades: "NO",
  pep: "NO",
  carencias: "SI",
};

describe("expandirRespuestasV3 · el mapa 5→8 (DI-3)", () => {
  it("produce exactamente las ocho claves numéricas que el motor exige", () => {
    const expandidas = expandirRespuestasV3(COMPATIBLES);
    expect(Object.keys(expandidas).sort()).toEqual(
      DECLARACIONES_P6.map((definicion) => String(definicion.numero)).sort(),
    );
    // Y el intérprete de siempre las acepta sin faltantes.
    const interpretadas = interpretarDeclaracionesP6(expandidas);
    expect(interpretadas.ok).toBe(true);
  });

  it("mapea cada pregunta a su declaración: 1←salud, 2←antecedentes, 3←enfermedades, 4←carencias, 8←pep", () => {
    const expandidas = expandirRespuestasV3({
      salud: "NO",
      antecedentes: "SI",
      enfermedades: "SI",
      pep: "SI",
      carencias: "SI",
    });
    expect(expandidas["1"]).toBe("NO");
    expect(expandidas["2"]).toBe("SI");
    expect(expandidas["3"]).toBe("SI");
    expect(expandidas["4"]).toBe("SI");
    expect(expandidas["8"]).toBe("SI");
  });

  it("las claves 5/6/7 salen aceptadas: son los ítems de la casilla agrupada 2", () => {
    const expandidas = expandirRespuestasV3(COMPATIBLES);
    expect(expandidas["5"]).toBe("SI");
    expect(expandidas["6"]).toBe("SI");
    expect(expandidas["7"]).toBe("SI");
  });

  it("una incompatible en las cuatro que bloquean deriva igual que en v2", () => {
    for (const [clave, valorIncompatible, numero] of [
      ["salud", "NO", 1],
      ["antecedentes", "SI", 2],
      ["enfermedades", "SI", 3],
      ["pep", "SI", 8],
    ] as const) {
      const expandidas = expandirRespuestasV3({ ...COMPATIBLES, [clave]: valorIncompatible });
      const interpretadas = interpretarDeclaracionesP6(expandidas);
      expect(interpretadas.ok).toBe(true);
      if (!interpretadas.ok) continue;
      const elegibilidad = evaluarElegibilidad(interpretadas.declaraciones);
      expect(elegibilidad.elegibleParaEmisionAutomatica, clave).toBe(false);
      expect(elegibilidad.declaracionesQueBloquean, clave).toEqual([numero]);
    }
  });
});

describe("interpretarRespuestasV3", () => {
  it("acepta las cinco bien formadas", () => {
    expect(interpretarRespuestasV3({ ...COMPATIBLES })).toEqual({
      ok: true,
      respuestas: COMPATIBLES,
    });
  });

  it("nombra exactamente qué falta, para el «Mostrame qué me falta»", () => {
    const resultado = interpretarRespuestasV3({ salud: "SI", pep: "NO", carencias: "x" });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.sinResponder).toEqual(["antecedentes", "enfermedades", "carencias"]);
  });

  it("las claves del mapa son estables: la pantalla y el dominio hablan el mismo idioma", () => {
    expect(CLAVES_RESPUESTAS_V3).toEqual(["salud", "antecedentes", "enfermedades", "pep", "carencias"]);
  });
});

// ---------------------------------------------------------------------------
// El caso de uso con el flag encendido
// ---------------------------------------------------------------------------

function crearExpedientesEnMemoria() {
  const todos = new Map<string, Expediente>();
  return {
    todos,
    async obtenerPorId(id: string) {
      return todos.get(id) ?? null;
    },
    async crear(expediente: Expediente) {
      todos.set(expediente.id, expediente);
    },
    async guardar(expediente: Expediente) {
      todos.set(expediente.id, expediente);
    },
  };
}

function crearEvidenciasEnMemoria(): EvidenceStore & { registros: RegistroEvidencia[] } {
  const registros: RegistroEvidencia[] = [];
  return {
    registros,
    async guardar(registro) {
      registros.push(registro);
    },
    async obtenerHistorial(expedienteId) {
      return registros.filter((registro) => registro.expedienteId === expedienteId);
    },
  };
}

const CONTEXTO = { ip: "10.0.0.1", dispositivo: "vitest", sesionId: "sesion-f3" };

const BENEFICIARIO_HEREDEROS = { beneficiarioTipo: "HEREDEROS_LEGALES" };

describe("guardarDatosYDeclaracionesP6 con FLUJO_V3=true", () => {
  // Las constantes por flag (`ESTADO_REQUERIDO_P6`, el grafo) se resuelven a
  // import-time, así que los módulos se cargan DESPUÉS de fijar el entorno —
  // el mismo patrón de `flujo-v3.test.ts`.
  let guardarDatosYDeclaracionesP6: typeof import("../declaraciones-p6").guardarDatosYDeclaracionesP6;
  let transicionarExpediente: typeof import("../expediente").transicionarExpediente;

  let expedientes: ReturnType<typeof crearExpedientesEnMemoria>;
  let evidencias: ReturnType<typeof crearEvidenciasEnMemoria>;
  let deps: DependenciasP6;

  /** Expediente v3 en PLAN_SELECCIONADO, que es donde el paso 2 opera. */
  function sembrarExpediente(id = "EXP-F3"): Expediente {
    let actual = crearExpediente(id);
    for (const estado of [
      "IDENTIDAD_VERIFICADA",
      "CANAL_WA_VERIFICADO",
      "AUTORIZADO",
      "PLAN_SELECCIONADO",
    ] as const) {
      const paso = transicionarExpediente(actual, estado);
      if (!paso.ok) throw new Error(paso.error);
      actual = paso.expediente;
    }
    expedientes.todos.set(id, actual);
    return actual;
  }

  beforeEach(async () => {
    vi.stubEnv("FLUJO_V3", "true");
    vi.resetModules();
    ({ guardarDatosYDeclaracionesP6 } = await import("../declaraciones-p6"));
    ({ transicionarExpediente } = await import("../expediente"));
    expedientes = crearExpedientesEnMemoria();
    evidencias = crearEvidenciasEnMemoria();
    deps = {
      expedientes,
      evidencias,
      ahora: () => "2026-08-30T15:00:00.000Z",
      nuevoId: () => `ID-${evidencias.registros.length + 1}`,
      nuevoNumeroCaso: () => "CASO-2026-000099",
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sin la casilla agrupada no avanza: es la fuente de las claves 5/6/7", async () => {
    sembrarExpediente();
    const resultado = await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-F3",
      beneficiario: BENEFICIARIO_HEREDEROS,
      declaraciones: {},
      respuestasV3: { ...COMPATIBLES },
      aceptacionPlan: false,
      contexto: CONTEXTO,
    });
    expect(resultado).toEqual({ ok: false, motivo: "ACEPTACION_REQUERIDA" });
  });

  it("carencias en No bloquea sin derivar: no hay expediente derivado ni evidencia de respuestas", async () => {
    sembrarExpediente();
    const resultado = await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-F3",
      beneficiario: BENEFICIARIO_HEREDEROS,
      declaraciones: {},
      respuestasV3: { ...COMPATIBLES, carencias: "NO" },
      aceptacionPlan: true,
      contexto: CONTEXTO,
    });
    expect(resultado).toEqual({ ok: false, motivo: "CARENCIAS_NO_ACEPTADAS" });
    expect(expedientes.todos.get("EXP-F3")?.estado).toBe("PLAN_SELECCIONADO");
    expect(evidencias.registros).toHaveLength(0);
  });

  it("el camino feliz transiciona PLAN_SELECCIONADO → DECLARACIONES_OK con la versión nueva asentada", async () => {
    sembrarExpediente();
    const resultado = await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-F3",
      beneficiario: BENEFICIARIO_HEREDEROS,
      declaraciones: {},
      respuestasV3: { ...COMPATIBLES },
      aceptacionPlan: true,
      contexto: CONTEXTO,
    });
    expect(resultado.ok).toBe(true);
    expect(expedientes.todos.get("EXP-F3")?.estado).toBe("DECLARACIONES_OK");
    // Las ocho quedaron en el expediente, como siempre (DI-3: el PDF no cambia).
    expect(expedientes.todos.get("EXP-F3")?.declaraciones?.veracidad).toBe("SI");
    expect(evidencias.registros[0]?.versionTextoAceptado).toBe(VERSION_ACEPTACION_SEGURO);
  });

  it("PEP en Sí deriva a revisión manual desde PLAN_SELECCIONADO (regla #5 en el orden nuevo)", async () => {
    sembrarExpediente();
    const resultado = await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-F3",
      beneficiario: BENEFICIARIO_HEREDEROS,
      declaraciones: {},
      respuestasV3: { ...COMPATIBLES, pep: "SI" },
      aceptacionPlan: true,
      contexto: CONTEXTO,
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.elegibleParaEmisionAutomatica).toBe(false);
    expect(expedientes.todos.get("EXP-F3")?.estado).toBe("DERIVADO_MANUAL");
    if (resultado.elegibleParaEmisionAutomatica) return;
    expect(resultado.siguientePantalla).toBe("/revision-manual");
    expect(resultado.declaracionesQueBloquean).toEqual([8]);
  });

  it("una pregunta sin responder nombra su clave v3, no un número de la lista vieja", async () => {
    sembrarExpediente();
    const resultado = await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-F3",
      beneficiario: BENEFICIARIO_HEREDEROS,
      declaraciones: {},
      respuestasV3: { salud: "SI" },
      aceptacionPlan: true,
      contexto: CONTEXTO,
    });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("DECLARACIONES_INCOMPLETAS");
    expect(resultado.respuestasSinResponderV3).toEqual([
      "antecedentes",
      "enfermedades",
      "pep",
      "carencias",
    ]);
  });
});
