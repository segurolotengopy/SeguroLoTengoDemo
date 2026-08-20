/**
 * Caso de uso de P3 con dobles en memoria.
 *
 * Lo que se prueba acá es el registro del consentimiento inicial (fila 11 de
 * la matriz de cumplimiento — Ley 4868/13, arts. 6(c) y 7(r)): que guarde
 * texto completo, versión, IP, dispositivo, sesión y timestamp, y que no haya
 * ningún camino por el que un registro ya escrito se pise o se borre.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { EvidenceStore } from "../../ports/evidence-store";
import {
  PASO_EVIDENCIA_AUTORIZACION_INICIAL,
  TEXTO_AUTORIZACION_INICIAL_P3,
  VERSION_AVISO_P3,
  registrarAutorizacionInicial,
} from "../autorizacion-inicial";
import type { DependenciasP3 } from "../autorizacion-inicial";
import { transicionarExpediente } from "../expediente";
import {
  ADVERTENCIA_AUTORIZACION_INICIAL_P3,
  CUERPO_AUTORIZACION_INICIAL_P3,
} from "../textos-p3";
import type { EstadoExpediente, Expediente, RegistroEvidencia } from "../tipos";
import type { RepositorioExpediente } from "../verificacion-canal-whatsapp";
import { crearExpediente } from "./fixtures";

const CONTEXTO = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (Linux; Android 14) vitest",
  sesionId: "sesion-p3",
};
const AHORA = "2026-03-01T15:30:00.000Z";

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

/** Doble append-only: rechaza reutilizar un id, igual que el repositorio DynamoDB. */
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
let deps: DependenciasP3;

/** Deja el expediente en el estado con el que realmente se llega a P3. */
function avanzarHasta(id: string, ...estados: EstadoExpediente[]): Expediente {
  let actual = crearExpediente(id);
  for (const estado of estados) {
    const paso = transicionarExpediente(actual, estado);
    if (!paso.ok) throw new Error(paso.error);
    actual = paso.expediente;
  }
  expedientes.todos.set(id, actual);
  return actual;
}

function conPlanSeleccionado(id = "EXP-P3"): Expediente {
  return avanzarHasta(id, "PLAN_SELECCIONADO", "CANAL_WA_VERIFICADO");
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

describe("literal del consentimiento", () => {
  it("lo que se persiste es exactamente la concatenación de lo que se muestra", () => {
    // La pantalla dibuja el cuerpo y la advertencia por separado para poder
    // destacar la segunda; si alguien tocara una sola de las dos partes, lo
    // mostrado y lo asentado dejarían de coincidir.
    expect(TEXTO_AUTORIZACION_INICIAL_P3).toBe(
      `${CUERPO_AUTORIZACION_INICIAL_P3} ${ADVERTENCIA_AUTORIZACION_INICIAL_P3}`,
    );
  });

  it("no incluye consentimiento comercial ni publicitario", () => {
    // Fila 12 de la matriz de cumplimiento (Ley 4868/13, arts. 20, 23 y
    // 30(a)): ese consentimiento tiene que ser separado, opcional y no
    // premarcado, así que no puede viajar dentro de esta autorización.
    const enMinusculas = TEXTO_AUTORIZACION_INICIAL_P3.toLowerCase();
    expect(enMinusculas).not.toContain("publicidad");
    expect(enMinusculas).not.toContain("promocion");
    expect(enMinusculas).not.toContain("marketing");
  });
});

describe("registrarAutorizacionInicial", () => {
  it("guarda texto completo, versión, IP, dispositivo, sesión y timestamp en el expediente", async () => {
    conPlanSeleccionado();

    const resultado = await registrarAutorizacionInicial(deps, {
      expedienteId: "EXP-P3",
      aceptada: true,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.autorizacion).toEqual({
      aceptadaEn: AHORA,
      ip: CONTEXTO.ip,
      dispositivo: CONTEXTO.dispositivo,
      sesionId: CONTEXTO.sesionId,
      versionAviso: VERSION_AVISO_P3,
      textoAceptado: TEXTO_AUTORIZACION_INICIAL_P3,
    });

    const persistido = expedientes.todos.get("EXP-P3");
    expect(persistido?.estado).toBe("AUTORIZADO");
    expect(persistido?.autorizacionInicial).toEqual(resultado.autorizacion);
  });

  it("registra la misma evidencia en el almacén append-only", async () => {
    conPlanSeleccionado();

    await registrarAutorizacionInicial(deps, {
      expedienteId: "EXP-P3",
      aceptada: true,
      contexto: CONTEXTO,
    });

    expect(evidencias.registros).toHaveLength(1);
    const [registro] = evidencias.registros;

    expect(registro.paso).toBe(PASO_EVIDENCIA_AUTORIZACION_INICIAL);
    expect(registro.resultado).toBe("EXITOSO");
    expect(registro.textoAceptado).toBe(TEXTO_AUTORIZACION_INICIAL_P3);
    expect(registro.versionTextoAceptado).toBe(VERSION_AVISO_P3);
    expect(registro.ip).toBe(CONTEXTO.ip);
    expect(registro.dispositivo).toBe(CONTEXTO.dispositivo);
    expect(registro.sesionId).toBe(CONTEXTO.sesionId);
    expect(registro.fecha).toBe(AHORA);
  });

  it("el texto asentado es el del servidor, no uno que mande el cliente", async () => {
    conPlanSeleccionado();

    // La entrada del caso de uso no tiene dónde poner un texto: solo puede
    // decir "acepté". Este test fija esa forma como contrato.
    const resultado = await registrarAutorizacionInicial(deps, {
      expedienteId: "EXP-P3",
      aceptada: true,
      contexto: CONTEXTO,
    });

    expect(resultado.ok && resultado.autorizacion.textoAceptado).toBe(TEXTO_AUTORIZACION_INICIAL_P3);
    expect(evidencias.registros[0]?.textoAceptado).toBe(TEXTO_AUTORIZACION_INICIAL_P3);
  });

  it("no registra nada si no se presionó el botón", async () => {
    conPlanSeleccionado();

    const resultado = await registrarAutorizacionInicial(deps, {
      expedienteId: "EXP-P3",
      aceptada: false,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "AUTORIZACION_REQUERIDA" });
    expect(expedientes.todos.get("EXP-P3")?.estado).toBe("CANAL_WA_VERIFICADO");
    expect(expedientes.todos.get("EXP-P3")?.autorizacionInicial).toBeNull();
    expect(evidencias.registros).toHaveLength(0);
  });

  it("rechaza un expediente inexistente", async () => {
    const resultado = await registrarAutorizacionInicial(deps, {
      expedienteId: "EXP-FANTASMA",
      aceptada: true,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" });
    expect(evidencias.registros).toHaveLength(0);
  });

  it("no deja autorizar sin haber verificado el WhatsApp, y deja evidencia del intento", async () => {
    // Con el orden nuevo (CHG-01) "autorizar sin plan" dejó de ser posible por
    // construcción: elegir plan es el primer paso y sin él no hay expediente.
    // Lo que este paso sí tiene que seguir protegiendo es el orden inverso —
    // llegar a la autorización salteando el código de WhatsApp—, que es la
    // barrera que la reunión puso ahí a propósito.
    avanzarHasta("EXP-SIN-WA", "PLAN_SELECCIONADO");

    const resultado = await registrarAutorizacionInicial(deps, {
      expedienteId: "EXP-SIN-WA",
      aceptada: true,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "ESTADO_INVALIDO" });
    expect(expedientes.todos.get("EXP-SIN-WA")?.estado).toBe("PLAN_SELECCIONADO");
    expect(expedientes.todos.get("EXP-SIN-WA")?.autorizacionInicial).toBeNull();
    expect(evidencias.registros).toHaveLength(1);
    expect(evidencias.registros[0]?.resultado).toBe("FALLIDO");
  });

  it("el consentimiento no se puede pisar: un segundo intento no reescribe el primero", async () => {
    conPlanSeleccionado();

    const primero = await registrarAutorizacionInicial(deps, {
      expedienteId: "EXP-P3",
      aceptada: true,
      contexto: CONTEXTO,
    });
    expect(primero.ok).toBe(true);

    const segundo = await registrarAutorizacionInicial(deps, {
      expedienteId: "EXP-P3",
      aceptada: true,
      contexto: { ...CONTEXTO, ip: "1.2.3.4", sesionId: "otra-sesion" },
    });

    // AUTORIZADO no tiene autobucle: no hay transición legal de vuelta a sí
    // mismo, así que la autorización original queda intacta.
    expect(segundo).toEqual({ ok: false, motivo: "ESTADO_INVALIDO" });
    expect(expedientes.todos.get("EXP-P3")?.autorizacionInicial?.ip).toBe(CONTEXTO.ip);
    expect(expedientes.todos.get("EXP-P3")?.autorizacionInicial?.sesionId).toBe(CONTEXTO.sesionId);

    // El intento fallido se suma al historial en vez de reemplazar nada.
    expect(evidencias.registros).toHaveLength(2);
    expect(evidencias.registros.map((registro) => registro.resultado)).toEqual([
      "EXITOSO",
      "FALLIDO",
    ]);
    expect(evidencias.registros[0]?.ip).toBe(CONTEXTO.ip);
  });

  it("no expone datos sensibles: el texto asentado es institucional, igual para todos", async () => {
    conPlanSeleccionado("EXP-A");
    conPlanSeleccionado("EXP-B");

    await registrarAutorizacionInicial(deps, {
      expedienteId: "EXP-A",
      aceptada: true,
      contexto: CONTEXTO,
    });
    await registrarAutorizacionInicial(deps, {
      expedienteId: "EXP-B",
      aceptada: true,
      contexto: { ...CONTEXTO, sesionId: "sesion-b" },
    });

    const [a, b] = evidencias.registros;
    expect(a.textoAceptado).toBe(b.textoAceptado);
    expect(a.detalle).not.toContain("cedula");
  });
});
