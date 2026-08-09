/**
 * Caso de uso de P2 con dobles en memoria: la regla técnica del paso (guardar
 * el ID de versión de la oferta y su hash SHA-256), la transición de estado y
 * el contenido de la evidencia, sin pasar por HTTP ni por DynamoDB.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { EvidenceStore } from "../../ports/evidence-store";
import { ID_VERSION_OFERTA, PLANES, serializarOfertaCanonica } from "../catalogo";
import { transicionarExpediente } from "../expediente";
import {
  PASO_EVIDENCIA_SELECCION_PLAN,
  hashOfertaSha256,
  seleccionarPlan,
} from "../seleccion-plan";
import type { DependenciasP2 } from "../seleccion-plan";
import type { Expediente, RegistroEvidencia } from "../tipos";
import type { RepositorioExpediente } from "../verificacion-canal-whatsapp";
import { crearExpediente } from "./fixtures";

const CONTEXTO = { ip: "200.10.20.30", dispositivo: "vitest", sesionId: "sesion-1" };
const AHORA = "2026-02-01T12:00:00.000Z";

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
      registros.push(registro);
    },
    async obtenerHistorial(expedienteId) {
      return registros.filter((registro) => registro.expedienteId === expedienteId);
    },
  };
}

let expedientes: ReturnType<typeof crearExpedientesEnMemoria>;
let evidencias: ReturnType<typeof crearEvidenciasEnMemoria>;
let deps: DependenciasP2;

/** Expediente en CANAL_WA_VERIFICADO: el estado real con el que se llega a P2. */
function conWhatsappVerificado(id = "EXP-P2"): Expediente {
  const transicion = transicionarExpediente(crearExpediente(id), "CANAL_WA_VERIFICADO");
  if (!transicion.ok) throw new Error(transicion.error);
  expedientes.todos.set(id, transicion.expediente);
  return transicion.expediente;
}

beforeEach(() => {
  expedientes = crearExpedientesEnMemoria();
  evidencias = crearEvidenciasEnMemoria();

  let contador = 0;
  deps = {
    expedientes,
    evidencias,
    ahora: () => AHORA,
    nuevoId: () => `id-${++contador}`,
  };
});

describe("hash de la oferta", () => {
  it("es el SHA-256 hexadecimal del texto canónico del catálogo", () => {
    const esperado = createHash("sha256").update(serializarOfertaCanonica(), "utf8").digest("hex");

    expect(hashOfertaSha256()).toBe(esperado);
    expect(hashOfertaSha256()).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("seleccionarPlan", () => {
  it("guarda el plan con el ID de versión de la oferta y su hash SHA-256", async () => {
    conWhatsappVerificado();

    const resultado = await seleccionarPlan(deps, {
      expedienteId: "EXP-P2",
      planId: "CONFIO_PLUS",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.plan).toEqual({
      planId: "CONFIO_PLUS",
      premioAnualGs: PLANES.CONFIO_PLUS.premioAnualGs,
      idVersionOferta: ID_VERSION_OFERTA,
      hashOfertaSha256: hashOfertaSha256(),
      seleccionadoEn: AHORA,
    });

    const persistido = expedientes.todos.get("EXP-P2");
    expect(persistido?.estado).toBe("PLAN_SELECCIONADO");
    expect(persistido?.plan).toEqual(resultado.plan);
  });

  it("toma el premio del catálogo, no de la petición", async () => {
    conWhatsappVerificado();

    const resultado = await seleccionarPlan(deps, {
      expedienteId: "EXP-P2",
      planId: "CONFIO",
      contexto: CONTEXTO,
    });

    expect(resultado.ok && resultado.plan.premioAnualGs).toBe(290_000);
  });

  it("registra evidencia con la versión de la oferta y su hash", async () => {
    conWhatsappVerificado();

    await seleccionarPlan(deps, {
      expedienteId: "EXP-P2",
      planId: "CONFIO_TOTAL",
      contexto: CONTEXTO,
    });

    expect(evidencias.registros).toHaveLength(1);
    const [registro] = evidencias.registros;
    expect(registro.paso).toBe(PASO_EVIDENCIA_SELECCION_PLAN);
    expect(registro.resultado).toBe("EXITOSO");
    expect(registro.ip).toBe(CONTEXTO.ip);
    expect(registro.dispositivo).toBe(CONTEXTO.dispositivo);
    expect(registro.sesionId).toBe(CONTEXTO.sesionId);
    expect(registro.fecha).toBe(AHORA);
    expect(registro.versionTextoAceptado).toBe(ID_VERSION_OFERTA);
    expect(registro.detalle).toContain("planId=CONFIO_TOTAL");
    expect(registro.detalle).toContain(`hashOfertaSha256=${hashOfertaSha256()}`);
  });

  it("rechaza un plan que no está en el catálogo, sin tocar el expediente", async () => {
    conWhatsappVerificado();

    const resultado = await seleccionarPlan(deps, {
      expedienteId: "EXP-P2",
      planId: "CONFIO_PREMIUM",
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "PLAN_INVALIDO" });
    expect(expedientes.todos.get("EXP-P2")?.estado).toBe("CANAL_WA_VERIFICADO");
  });

  it("rechaza un expediente inexistente", async () => {
    const resultado = await seleccionarPlan(deps, {
      expedienteId: "EXP-FANTASMA",
      planId: "CONFIO",
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" });
  });

  it("no deja elegir plan si el WhatsApp todavía no está verificado", async () => {
    expedientes.todos.set("EXP-NUEVO", crearExpediente("EXP-NUEVO"));

    const resultado = await seleccionarPlan(deps, {
      expedienteId: "EXP-NUEVO",
      planId: "CONFIO",
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "ESTADO_INVALIDO" });
    expect(expedientes.todos.get("EXP-NUEVO")?.estado).toBe("INICIADO");
    expect(evidencias.registros[0]?.resultado).toBe("FALLIDO");
  });

  it("permite cambiar de plan antes de la autorización, sin borrar el historial", async () => {
    conWhatsappVerificado();

    await seleccionarPlan(deps, { expedienteId: "EXP-P2", planId: "CONFIO", contexto: CONTEXTO });
    const segunda = await seleccionarPlan(deps, {
      expedienteId: "EXP-P2",
      planId: "CONFIO_TOTAL",
      contexto: CONTEXTO,
    });

    expect(segunda.ok).toBe(true);

    const persistido = expedientes.todos.get("EXP-P2");
    expect(persistido?.plan?.planId).toBe("CONFIO_TOTAL");
    expect(persistido?.historial.map((entrada) => entrada.estado)).toEqual([
      "INICIADO",
      "CANAL_WA_VERIFICADO",
      "PLAN_SELECCIONADO",
      "PLAN_SELECCIONADO",
    ]);
    expect(evidencias.registros).toHaveLength(2);
  });

  it("no permite volver a P2 una vez autorizado en P3", async () => {
    let actual = conWhatsappVerificado();
    for (const estado of ["PLAN_SELECCIONADO", "AUTORIZADO"] as const) {
      const paso = transicionarExpediente(actual, estado);
      if (!paso.ok) throw new Error(paso.error);
      actual = paso.expediente;
    }
    expedientes.todos.set("EXP-P2", actual);

    const resultado = await seleccionarPlan(deps, {
      expedienteId: "EXP-P2",
      planId: "CONFIO",
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "ESTADO_INVALIDO" });
  });
});
