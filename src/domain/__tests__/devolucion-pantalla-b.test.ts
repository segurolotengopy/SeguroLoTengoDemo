/**
 * Tests de la Pantalla B · QR pagado, firma no completada.
 *
 * Lo que se prueba con más insistencia que el resto:
 *
 * - **Fila 30** — vencido con el premio ya cobrado se abre el trámite de
 *   devolución; vencido con una reserva de crédito, no, porque no hay nada que
 *   devolver.
 * - **"No se devuelve en efectivo, a terceros ni a otra cuenta"** — la firma de
 *   `registrarDevolucionEjecutadaPantallaB` no tiene ningún parámetro de
 *   destino: la leyenda es una propiedad del tipo, no una validación.
 * - **Regla #11** — los tres estados de la rama bloquean un registro nuevo con
 *   la misma cédula, DEVUELTO incluido.
 * - **Reglas #6 y #7** — la proyección de la pantalla no expone la cédula
 *   completa, ni un canal sin enmascarar, ni un dato de tarjeta.
 */
import { describe, expect, it } from "vitest";
import type { EvidenceStore } from "../../ports/evidence-store";
import { estadoBloqueaRegistro } from "../consola-administrativa";
import {
  ESTADOS_PANTALLA_B,
  PASO_EVIDENCIA_DEVOLUCION_EJECUTADA,
  PASO_EVIDENCIA_DEVOLUCION_INICIADA,
  iniciarDevolucionPantallaB,
  leerCasoVencido,
  registrarDevolucionEjecutadaPantallaB,
} from "../devolucion-pantalla-b";
import { esEstadoTerminal, transicionarExpediente } from "../expediente";
import { HITOS_SEGUIMIENTO } from "../textos-pantalla-b";
import type { Expediente, MedioDePago, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal";
import { expedienteEnPaqueteGenerado } from "./fixtures";

const AHORA = "2026-08-10T15:05:00.000Z";
const PAGO_CONFIRMADO_EN = "2026-08-09T15:01:00.000Z";
const PLAZO_VENCE_EN = "2026-08-10T15:01:00.000Z";

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-pantalla-b",
};

function repositorioFalso(inicial: Expediente): RepositorioExpediente & { actual: () => Expediente } {
  let guardado = inicial;
  return {
    async obtenerPorId(id) {
      return id === guardado.id ? guardado : null;
    },
    async crear(expediente) {
      guardado = expediente;
    },
    async guardar(expediente) {
      guardado = expediente;
    },
    actual: () => guardado,
  };
}

function evidenciasFalsas(): EvidenceStore & { registros: RegistroEvidencia[] } {
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

/** Expediente que venció sin firmar, con el medio de pago que se indique. */
function expedienteVencido(medio: MedioDePago = "QR_BANCARD"): Expediente {
  const base = expedienteEnPaqueteGenerado("EXP-TEST-B");
  const pago = base.pago;
  if (!pago) throw new Error("el fixture debería tener pago");

  const conMedio: Expediente = {
    ...base,
    pago: {
      ...pago,
      medio,
      estado: medio === "TARJETA_CREDITO" ? "CANCELADO" : "CONFIRMADO",
      confirmadoEn: PAGO_CONFIRMADO_EN,
    },
    plazoFirmaVenceEn: PLAZO_VENCE_EN,
  };

  const vencido = transicionarExpediente(conMedio, "VENCIDO", {}, AHORA);
  if (!vencido.ok) throw new Error(vencido.error);
  return vencido.expediente;
}

function armar(expediente: Expediente) {
  const repositorio = repositorioFalso(expediente);
  const evidencias = evidenciasFalsas();
  return {
    deps: { expedientes: repositorio, evidencias, ahora: () => AHORA, nuevoId: () => "ev-b" },
    repositorio,
    evidencias,
  };
}

// ---------------------------------------------------------------------------

describe("Pantalla B · abrir el trámite de devolución", () => {
  it("vencido con QR pagado abre la devolución y deja evidencia", async () => {
    const entorno = armar(expedienteVencido("QR_BANCARD"));

    const resultado = await iniciarDevolucionPantallaB(entorno.deps, {
      expedienteId: "EXP-TEST-B",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.iniciado).toBe(true);
    expect(entorno.repositorio.actual().estado).toBe("DEVOLUCION_EN_TRAMITE");

    const registro = entorno.evidencias.registros.find(
      (evidencia) => evidencia.paso === PASO_EVIDENCIA_DEVOLUCION_INICIADA,
    );
    expect(registro?.resultado).toBe("EXITOSO");
    expect(registro?.detalle).toContain("destinoDevolucion=MEDIO_DE_ORIGEN");
    // `ACTORES Y REGISTRO`: queda constancia del aviso a los dos canales.
    expect(registro?.detalle).toContain("avisoWhatsapp=");
    expect(registro?.detalle).toContain("avisoCorreo=");
  });

  it("el débito también abre devolución: el dinero se movió igual que con QR", async () => {
    const entorno = armar(expedienteVencido("TARJETA_DEBITO"));

    const resultado = await iniciarDevolucionPantallaB(entorno.deps, {
      expedienteId: "EXP-TEST-B",
      contexto: CONTEXTO,
    });

    expect(resultado.ok && resultado.iniciado).toBe(true);
    expect(entorno.repositorio.actual().estado).toBe("DEVOLUCION_EN_TRAMITE");
  });

  it("el crédito NO abre devolución: no hubo cobro, solo una reserva liberada", async () => {
    const entorno = armar(expedienteVencido("TARJETA_CREDITO"));

    const resultado = await iniciarDevolucionPantallaB(entorno.deps, {
      expedienteId: "EXP-TEST-B",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.iniciado).toBe(false);
    expect(entorno.repositorio.actual().estado).toBe("VENCIDO");
    expect(entorno.evidencias.registros).toHaveLength(0);
  });

  it("es idempotente: entrar de nuevo no vuelve a transicionar ni duplica evidencia", async () => {
    const entorno = armar(expedienteVencido());
    await iniciarDevolucionPantallaB(entorno.deps, { expedienteId: "EXP-TEST-B", contexto: CONTEXTO });
    const historial = entorno.repositorio.actual().historial.length;

    const segunda = await iniciarDevolucionPantallaB(entorno.deps, {
      expedienteId: "EXP-TEST-B",
      contexto: CONTEXTO,
    });

    expect(segunda.ok && segunda.iniciado).toBe(false);
    expect(entorno.repositorio.actual().historial.length).toBe(historial);
    expect(entorno.evidencias.registros).toHaveLength(1);
  });

  it("un expediente que no venció no abre ninguna devolución", async () => {
    const entorno = armar(expedienteEnPaqueteGenerado("EXP-TEST-B"));

    const resultado = await iniciarDevolucionPantallaB(entorno.deps, {
      expedienteId: "EXP-TEST-B",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("ESTADO_INVALIDO");
  });
});

describe("Pantalla B · devolución ejecutada", () => {
  async function hastaEnTramite() {
    const entorno = armar(expedienteVencido());
    await iniciarDevolucionPantallaB(entorno.deps, { expedienteId: "EXP-TEST-B", contexto: CONTEXTO });
    return entorno;
  }

  it("DEVOLUCION_EN_TRAMITE → DEVUELTO, que es el estado terminal de la rama", async () => {
    const entorno = await hastaEnTramite();

    const resultado = await registrarDevolucionEjecutadaPantallaB(entorno.deps, {
      expedienteId: "EXP-TEST-B",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.estado).toBe("DEVUELTO");
    expect(esEstadoTerminal("DEVUELTO")).toBe(true);

    const registro = entorno.evidencias.registros.find(
      (evidencia) => evidencia.paso === PASO_EVIDENCIA_DEVOLUCION_EJECUTADA,
    );
    expect(registro?.detalle).toContain("ejecutadaPor=ALIANZA_GARANTIA");
    expect(registro?.detalle).toContain("destinoDevolucion=MEDIO_DE_ORIGEN");
  });

  it("es idempotente sobre un expediente ya devuelto", async () => {
    const entorno = await hastaEnTramite();
    await registrarDevolucionEjecutadaPantallaB(entorno.deps, {
      expedienteId: "EXP-TEST-B",
      contexto: CONTEXTO,
    });
    const historial = entorno.repositorio.actual().historial.length;

    const segunda = await registrarDevolucionEjecutadaPantallaB(entorno.deps, {
      expedienteId: "EXP-TEST-B",
      contexto: CONTEXTO,
    });

    expect(segunda.ok).toBe(true);
    expect(entorno.repositorio.actual().historial.length).toBe(historial);
  });

  it("no se puede marcar devuelto un expediente que nunca abrió el trámite", async () => {
    const entorno = armar(expedienteVencido("TARJETA_CREDITO"));

    const resultado = await registrarDevolucionEjecutadaPantallaB(entorno.deps, {
      expedienteId: "EXP-TEST-B",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("ESTADO_INVALIDO");
    expect(entorno.repositorio.actual().estado).toBe("VENCIDO");
  });

  it("desde DEVUELTO no hay ninguna vuelta al flujo digital", async () => {
    const entorno = await hastaEnTramite();
    await registrarDevolucionEjecutadaPantallaB(entorno.deps, {
      expedienteId: "EXP-TEST-B",
      contexto: CONTEXTO,
    });
    const devuelto = entorno.repositorio.actual();

    for (const destino of ["PAGO_CONFIRMADO", "PAQUETE_GENERADO", "FIRMADO", "EMITIDO"] as const) {
      expect(transicionarExpediente(devuelto, destino).ok, destino).toBe(false);
    }
  });
});

describe("Pantalla B · bloqueo por cédula (regla inviolable #11)", () => {
  it("los tres estados de la rama bloquean un registro nuevo, DEVUELTO incluido", () => {
    for (const estado of ESTADOS_PANTALLA_B) {
      expect(estadoBloqueaRegistro(estado), estado).toBe(true);
    }
  });
});

describe("Pantalla B · resumen del caso", () => {
  it("trae la propuesta, la referencia de Bancard y el premio", () => {
    const caso = leerCasoVencido(expedienteVencido(), AHORA);

    expect(caso?.numeroPropuesta).toBe("00018425");
    expect(caso?.referenciaBancard).toBe("BCD-DEMO-000018425");
    expect(caso?.premioGs).toBeGreaterThan(0);
    expect(caso?.hayPremioQueDevolver).toBe(true);
  });

  it("con crédito informa que no hay premio que devolver", () => {
    const caso = leerCasoVencido(expedienteVencido("TARJETA_CREDITO"), AHORA);

    expect(caso?.hayPremioQueDevolver).toBe(false);
  });

  it("no expone la cédula completa ni ningún canal sin enmascarar", () => {
    const expediente = expedienteVencido();
    const caso = leerCasoVencido(expediente, AHORA);

    const serializado = JSON.stringify(caso);
    expect(serializado).not.toContain(expediente.identidad?.numeroCedula ?? "@@");
    expect(serializado).not.toContain(expediente.canalWhatsapp?.valor ?? "@@");
    expect(serializado).not.toContain(expediente.canalEmail?.valor ?? "@@");
    expect(caso?.documentoEnmascarado).toContain("•");
  });

  it("los cuatro hitos caen dentro del plazo, con el vencimiento al final", () => {
    const caso = leerCasoVencido(expedienteVencido(), AHORA);

    expect(caso?.hitos).toHaveLength(HITOS_SEGUIMIENTO.length);
    const instantes = (caso?.hitos ?? []).map((hito) => hito.en ?? "");
    expect([...instantes].sort()).toEqual(instantes); // en orden cronológico
    expect(instantes[0] > PAGO_CONFIRMADO_EN).toBe(true);
    expect(instantes[3]).toBe(PLAZO_VENCE_EN);
    expect(caso?.hitos[3].esVencimiento).toBe(true);
  });

  it("con el plazo comprimido por el panel, los hitos se comprimen con él", () => {
    // 40 segundos de plazo en vez de 24 horas: los recordatorios tienen que
    // caer dentro de la ventana, no todos en el futuro.
    const base = expedienteVencido();
    const comprimido: Expediente = {
      ...base,
      plazoFirmaVenceEn: new Date(new Date(PAGO_CONFIRMADO_EN).getTime() + 40_000).toISOString(),
    };

    const caso = leerCasoVencido(comprimido, AHORA);

    for (const hito of caso?.hitos ?? []) {
      expect(hito.en! <= comprimido.plazoFirmaVenceEn!, hito.rotulo).toBe(true);
      expect(hito.cumplido, hito.rotulo).toBe(true);
    }
    // Los rótulos siguen siendo los de la especificación.
    expect(caso?.hitos.map((hito) => hito.rotulo)).toEqual([
      "1 HORA",
      "5 HORAS",
      "12 HORAS",
      "24 HORAS",
    ]);
  });

  it("no hay caso que mostrar si el expediente no está en la rama del vencimiento", () => {
    expect(leerCasoVencido(expedienteEnPaqueteGenerado("EXP-TEST-B"), AHORA)).toBeNull();
  });
});
