/**
 * La aceptación de T&C del inicio del flujo v3 (DI-10, lote F2): el acto que
 * crea el expediente, con su evidencia de versión y texto, y que **no existe**
 * en el flujo v2.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvidenceStore } from "../../ports/evidence-store";
import {
  PASO_EVIDENCIA_TERMINOS_INICIO,
  aceptarTerminosIniciales,
} from "../inicio-terminos";
import type { DependenciasInicio } from "../inicio-terminos";
import { TEXTO_TERMINOS_INICIO, VERSION_TERMINOS_INICIO } from "../textos-inicio";
import {
  ITEMS_ACEPTACION_INSCRIPCION,
  TEXTO_ACEPTACION_INSCRIPCION,
  VERSION_ACEPTACION_INSCRIPCION,
} from "../textos-inscripcion";
import { VERSION_AVISO_P3 } from "../textos-p3";
import type { Expediente, RegistroEvidencia } from "../tipos";
import type { RepositorioExpediente } from "../verificacion-canal-whatsapp";
import { crearExpediente } from "./fixtures";

const CONTEXTO = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (Linux; Android 14) vitest",
  sesionId: "sesion-inicio",
};
const AHORA = "2026-08-30T12:00:00.000Z";

function crearExpedientesEnMemoria(): RepositorioExpediente & { todos: Map<string, Expediente> } {
  const todos = new Map<string, Expediente>();
  return {
    todos,
    async obtenerPorId(id) {
      return todos.get(id) ?? null;
    },
    async crear(expediente) {
      todos.set(expediente.id, expediente);
    },
    async guardar(expediente) {
      todos.set(expediente.id, expediente);
    },
  };
}

function crearEvidenciasEnMemoria(): EvidenceStore & { registros: RegistroEvidencia[] } {
  const registros: RegistroEvidencia[] = [];
  return {
    registros,
    async guardar(registro) {
      if (registros.some((previo) => previo.id === registro.id)) {
        throw new Error(`Evidencia duplicada: ${registro.id}`);
      }
      registros.push(registro);
    },
    async obtenerHistorial(expedienteId) {
      return registros.filter((registro) => registro.expedienteId === expedienteId);
    },
  };
}

let expedientes: ReturnType<typeof crearExpedientesEnMemoria>;
let evidencias: ReturnType<typeof crearEvidenciasEnMemoria>;
let deps: DependenciasInicio;
let contadorIds: number;

beforeEach(() => {
  vi.stubEnv("FLUJO_V3", "true");
  expedientes = crearExpedientesEnMemoria();
  evidencias = crearEvidenciasEnMemoria();
  contadorIds = 0;
  deps = {
    expedientes,
    evidencias,
    ahora: () => AHORA,
    nuevoId: () => `ID-${++contadorIds}`,
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("aceptarTerminosIniciales (flujo v3)", () => {
  it("crea el expediente en INICIADO con la aceptación asentada", async () => {
    const resultado = await aceptarTerminosIniciales(deps, {
      expedienteId: null,
      aceptada: true,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.estado).toBe("INICIADO");

    const guardado = expedientes.todos.get(resultado.expedienteId);
    expect(guardado?.terminosIniciales).toEqual({
      aceptadaEn: AHORA,
      ip: CONTEXTO.ip,
      dispositivo: CONTEXTO.dispositivo,
      sesionId: CONTEXTO.sesionId,
      versionAviso: VERSION_TERMINOS_INICIO,
      textoAceptado: TEXTO_TERMINOS_INICIO,
    });
  });

  it("deja evidencia con la versión y el literal del servidor (DI-10, regla #10)", async () => {
    await aceptarTerminosIniciales(deps, {
      expedienteId: null,
      aceptada: true,
      contexto: CONTEXTO,
    });

    expect(evidencias.registros).toHaveLength(1);
    const registro = evidencias.registros[0];
    expect(registro.paso).toBe(PASO_EVIDENCIA_TERMINOS_INICIO);
    expect(registro.versionTextoAceptado).toBe(VERSION_TERMINOS_INICIO);
    expect(registro.textoAceptado).toBe(TEXTO_TERMINOS_INICIO);
    expect(registro.ip).toBe(CONTEXTO.ip);
    expect(registro.resultado).toBe("EXITOSO");
  });

  it("sin la casilla marcada no crea nada", async () => {
    const resultado = await aceptarTerminosIniciales(deps, {
      expedienteId: null,
      aceptada: false,
      contexto: CONTEXTO,
    });
    expect(resultado).toEqual({ ok: false, motivo: "ACEPTACION_REQUERIDA" });
    expect(expedientes.todos.size).toBe(0);
    expect(evidencias.registros).toHaveLength(0);
  });

  it("con un trámite ya empezado en la sesión no duplica: se retoma", async () => {
    const existente = crearExpediente("EXP-YA-EXISTE");
    expedientes.todos.set(existente.id, existente);

    const resultado = await aceptarTerminosIniciales(deps, {
      expedienteId: existente.id,
      aceptada: true,
      contexto: CONTEXTO,
    });
    expect(resultado).toEqual({ ok: false, motivo: "EXPEDIENTE_YA_EXISTE" });
    expect(expedientes.todos.size).toBe(1);
  });

  it("una cookie huérfana no traba el arranque: se crea un expediente nuevo", async () => {
    const resultado = await aceptarTerminosIniciales(deps, {
      expedienteId: "EXP-PURGADO",
      aceptada: true,
      contexto: CONTEXTO,
    });
    expect(resultado.ok).toBe(true);
  });

  it("en el flujo v2 no existe: el expediente nace al elegir plan", async () => {
    vi.stubEnv("FLUJO_V3", "");
    const resultado = await aceptarTerminosIniciales(deps, {
      expedienteId: null,
      aceptada: true,
      contexto: CONTEXTO,
    });
    expect(resultado).toEqual({ ok: false, motivo: "FLUJO_NO_DISPONIBLE" });
    expect(expedientes.todos.size).toBe(0);
  });
});

describe("textos de la aceptación agrupada (DI-8)", () => {
  it("el literal persistido contiene los siete ítems, en orden", () => {
    expect(ITEMS_ACEPTACION_INSCRIPCION).toHaveLength(7);
    let posicion = -1;
    for (const item of ITEMS_ACEPTACION_INSCRIPCION) {
      const indice = TEXTO_ACEPTACION_INSCRIPCION.indexOf(item);
      expect(indice, item.slice(0, 40)).toBeGreaterThan(posicion);
      posicion = indice;
    }
  });

  it("su versión es propia, no la del aviso de P3", () => {
    expect(VERSION_ACEPTACION_INSCRIPCION).not.toBe(VERSION_AVISO_P3);
  });

  it("no incluye publicidad: el consentimiento comercial es separado (D-01)", () => {
    // El ítem 1 la menciona solo para decir que se confirma aparte.
    expect(TEXTO_ACEPTACION_INSCRIPCION).toContain("se confirma aparte");
    expect(TEXTO_ACEPTACION_INSCRIPCION).not.toMatch(/acepto recibir.*ofertas/i);
  });
});

describe("la autorización asienta el texto de su versión del flujo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("con FLUJO_V3=true firma la aceptación agrupada de inscripción", async () => {
    vi.stubEnv("FLUJO_V3", "true");
    vi.resetModules();
    const modulo = await import("../autorizacion-inicial");
    expect(modulo.VERSION_AUTORIZACION_VIGENTE).toBe(VERSION_ACEPTACION_INSCRIPCION);
    expect(modulo.TEXTO_AUTORIZACION_VIGENTE).toBe(TEXTO_ACEPTACION_INSCRIPCION);
  });

  it("sin el flag sigue firmando el aviso de P3", async () => {
    vi.stubEnv("FLUJO_V3", "");
    vi.resetModules();
    const modulo = await import("../autorizacion-inicial");
    expect(modulo.VERSION_AUTORIZACION_VIGENTE).toBe(VERSION_AVISO_P3);
  });
});
