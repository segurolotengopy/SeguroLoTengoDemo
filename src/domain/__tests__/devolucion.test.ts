/**
 * Tests del seguimiento de devoluciones (D-02).
 *
 * Lo que se cuida acá:
 *
 * - **No hay devolución sin cobro acreditado.** Abrir un trámite sobre un
 *   expediente sin dinero adentro le describiría a la persona un movimiento
 *   que no existió.
 * - **No hay vuelta al flujo digital.** `DEVOLUCION_EN_TRAMITE` y `DEVUELTO`
 *   no llevan a pago, firma ni emisión, y los dos bloquean la cédula.
 * - **El cierre exige referencia.** Un trámite cerrado sin ella no se puede
 *   auditar: sería "alguien dijo que devolvió".
 * - **No hay dónde poner un destino.** Ni en el tipo ni en la firma de las
 *   funciones (fila 30 de la matriz).
 */
import { describe, expect, it } from "vitest";
import {
  PASO_EVIDENCIA_DEVOLUCION_ACREDITADA,
  PASO_EVIDENCIA_DEVOLUCION_SOLICITADA,
  acreditarDevolucion,
  leerSeguimientoDevolucion,
  solicitarDevolucion,
} from "../devolucion";
import type { DependenciasDevolucion } from "../devolucion";
import { esTransicionLegal, registrarEmisionP9 } from "../expediente";
import type { EvidenceStore } from "../../ports/evidence-store";
import type { Expediente, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal";
import { expedienteEnPagoConfirmado, expedienteFirmado } from "./fixtures";

const AHORA = "2026-08-09T16:00:00.000Z";

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-consola",
};

function repositorio(inicial: Expediente): RepositorioExpediente & { actual: () => Expediente } {
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

function evidencias(): EvidenceStore & { registros: RegistroEvidencia[] } {
  const registros: RegistroEvidencia[] = [];
  return {
    registros,
    async guardar(registro) {
      registros.push(registro);
    },
    async obtenerHistorial() {
      return registros;
    },
  };
}

function armar(expediente: Expediente, ahora = AHORA) {
  const repo = repositorio(expediente);
  const evid = evidencias();
  let contador = 0;
  const deps: DependenciasDevolucion = {
    expedientes: repo,
    evidencias: evid,
    ahora: () => ahora,
    nuevoId: () => `ev-${(contador += 1)}`,
  };
  return { deps, repo, evidencias: evid };
}

function expedienteEmitido(): Expediente {
  const cobrado = expedienteEnPagoConfirmado("EXP-DEV");
  const emitido = registrarEmisionP9(
    cobrado,
    {
      numeroPoliza: cobrado.numeroPropuesta ?? "",
      estado: "EN_PROCESO_DE_EMISION",
      emitidaEn: null,
      estadoFactura: "PENDIENTE",
      referenciaFactura: null,
      solicitadaEn: AHORA,
    },
    AHORA,
  );
  if (!emitido.ok) throw new Error(emitido.error);
  return emitido.expediente;
}

const PEDIDO = { solicitante: "TITULAR", motivo: "PEDIDO_DEL_TITULAR" } as const;

// ---------------------------------------------------------------------------
// Apertura
// ---------------------------------------------------------------------------

describe("solicitar una devolución", () => {
  it("abre el trámite sobre un cobro acreditado y transiciona", async () => {
    const { deps, repo } = armar(expedienteEnPagoConfirmado("EXP-DEV"));

    const resultado = await solicitarDevolucion(deps, {
      expedienteId: "EXP-DEV",
      ...PEDIDO,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.estado).toBe("DEVOLUCION_EN_TRAMITE");
    expect(repo.actual().estado).toBe("DEVOLUCION_EN_TRAMITE");
    expect(resultado.devolucion.estado).toBe("EN_TRAMITE");
    expect(resultado.devolucion.solicitante).toBe("TITULAR");
  });

  /**
   * Que se haya ordenado la emisión no vuelve al cobro irreversible: si hubo un
   * error o el titular lo pide, la devolución procede.
   */
  it("también procede sobre un expediente ya emitido", async () => {
    const { deps, repo } = armar(expedienteEmitido());

    const resultado = await solicitarDevolucion(deps, {
      expedienteId: "EXP-DEV",
      ...PEDIDO,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    expect(repo.actual().estado).toBe("DEVOLUCION_EN_TRAMITE");
  });

  /**
   * Bajo el orden nuevo un expediente firmado y no pagado no tiene dinero
   * adentro: caducar es gratis (D-08/D-10) y no hay nada que devolver.
   */
  it("un expediente firmado y sin pagar no tiene devolución posible", async () => {
    const { deps, repo } = armar(expedienteFirmado("EXP-DEV"));

    const resultado = await solicitarDevolucion(deps, {
      expedienteId: "EXP-DEV",
      ...PEDIDO,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("ESTADO_INVALIDO");
    expect(repo.actual().estado).toBe("FIRMADO");
  });

  it("congela el importe y el medio del cobro que se devuelve", async () => {
    const expediente = expedienteEnPagoConfirmado("EXP-DEV");
    const { deps } = armar(expediente);

    const resultado = await solicitarDevolucion(deps, {
      expedienteId: "EXP-DEV",
      ...PEDIDO,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.devolucion.montoGs).toBe(expediente.pago?.montoGs);
    expect(resultado.devolucion.medio).toBe(expediente.pago?.medio);
    expect(resultado.devolucion.referenciaBancard).toBe(expediente.pago?.referenciaBancard);
  });

  it("es idempotente: repetirla no duplica evidencia ni reabre nada", async () => {
    const { deps, evidencias: evid } = armar(expedienteEnPagoConfirmado("EXP-DEV"));
    const entrada = { expedienteId: "EXP-DEV", ...PEDIDO, contexto: CONTEXTO };

    await solicitarDevolucion(deps, entrada);
    const segunda = await solicitarDevolucion(deps, entrada);

    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;
    expect(segunda.cambio).toBe(false);
    expect(
      evid.registros.filter((r) => r.paso === PASO_EVIDENCIA_DEVOLUCION_SOLICITADA),
    ).toHaveLength(1);
  });

  it.each([
    ["solicitante", { solicitante: "EL_VECINO", motivo: "PEDIDO_DEL_TITULAR" }, "SOLICITANTE_INVALIDO"],
    ["motivo", { solicitante: "TITULAR", motivo: "PORQUE_SI" }, "MOTIVO_INVALIDO"],
  ])("rechaza un %s que no es de la lista", async (_caso, pedido, esperado) => {
    const { deps, repo } = armar(expedienteEnPagoConfirmado("EXP-DEV"));

    const resultado = await solicitarDevolucion(deps, {
      expedienteId: "EXP-DEV",
      ...pedido,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe(esperado);
    expect(repo.actual().estado).toBe("PAGO_CONFIRMADO");
  });
});

// ---------------------------------------------------------------------------
// Cierre
// ---------------------------------------------------------------------------

describe("acreditar la devolución", () => {
  async function conTramiteAbierto() {
    const entorno = armar(expedienteEnPagoConfirmado("EXP-DEV"));
    await solicitarDevolucion(entorno.deps, {
      expedienteId: "EXP-DEV",
      ...PEDIDO,
      contexto: CONTEXTO,
    });
    return entorno;
  }

  it("cierra el trámite y deja el expediente en DEVUELTO", async () => {
    const { deps, repo } = await conTramiteAbierto();

    const resultado = await acreditarDevolucion(deps, {
      expedienteId: "EXP-DEV",
      referenciaReintegro: "BCD-REINT-991",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.estado).toBe("DEVUELTO");
    expect(resultado.devolucion.estado).toBe("ACREDITADA");
    expect(resultado.devolucion.referenciaReintegro).toBe("BCD-REINT-991");
    expect(repo.actual().estado).toBe("DEVUELTO");
  });

  /**
   * Sin referencia el cierre no se puede auditar: sería "alguien dijo que
   * devolvió". Por eso es un requisito y no un campo opcional.
   */
  it("no cierra sin referencia del reintegro", async () => {
    const { deps, repo } = await conTramiteAbierto();

    const resultado = await acreditarDevolucion(deps, {
      expedienteId: "EXP-DEV",
      referenciaReintegro: "   ",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("REFERENCIA_REQUERIDA");
    expect(repo.actual().estado).toBe("DEVOLUCION_EN_TRAMITE");
  });

  it("no cierra un trámite que no está abierto", async () => {
    const { deps } = armar(expedienteEnPagoConfirmado("EXP-DEV"));

    const resultado = await acreditarDevolucion(deps, {
      expedienteId: "EXP-DEV",
      referenciaReintegro: "BCD-REINT-991",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("ESTADO_INVALIDO");
  });

  it("es idempotente sobre un expediente ya devuelto", async () => {
    const { deps, evidencias: evid } = await conTramiteAbierto();
    const entrada = {
      expedienteId: "EXP-DEV",
      referenciaReintegro: "BCD-REINT-991",
      contexto: CONTEXTO,
    };

    await acreditarDevolucion(deps, entrada);
    const segunda = await acreditarDevolucion(deps, entrada);

    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;
    expect(segunda.cambio).toBe(false);
    expect(
      evid.registros.filter((r) => r.paso === PASO_EVIDENCIA_DEVOLUCION_ACREDITADA),
    ).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Garantías estructurales
// ---------------------------------------------------------------------------

describe("garantías del trámite", () => {
  /** Regla inviolable #5 y #11: los dos estados son salidas sin retorno. */
  it.each([
    ["DEVOLUCION_EN_TRAMITE", "PAGO_CONFIRMADO"],
    ["DEVOLUCION_EN_TRAMITE", "EMITIDO"],
    ["DEVUELTO", "PAGO_CONFIRMADO"],
    ["DEVUELTO", "EMITIDO"],
    ["DEVUELTO", "FIRMADO"],
  ] as const)("no se vuelve de %s a %s", (desde, hacia) => {
    expect(esTransicionLegal(desde, hacia)).toBe(false);
  });

  /**
   * Fila 30 · la devolución va al medio de origen. La garantía no es una
   * validación sino la ausencia de un lugar donde escribir otro destino: si
   * alguna vez apareciera un campo así, este test lo marca.
   */
  it("no hay ningún campo de destino en el trámite persistido", async () => {
    const { deps, repo } = armar(expedienteEnPagoConfirmado("EXP-DEV"));
    await solicitarDevolucion(deps, { expedienteId: "EXP-DEV", ...PEDIDO, contexto: CONTEXTO });

    const claves = Object.keys(repo.actual().devolucion ?? {});
    for (const prohibida of ["cuenta", "cbu", "iban", "destinatario", "titularCuenta", "banco"]) {
      expect(claves.map((c) => c.toLowerCase())).not.toContain(prohibida);
    }
  });

  it("la evidencia no lleva datos de la persona ni de la tarjeta", async () => {
    const expediente = expedienteEnPagoConfirmado("EXP-DEV");
    const { deps, evidencias: evid } = armar(expediente);

    await solicitarDevolucion(deps, { expedienteId: "EXP-DEV", ...PEDIDO, contexto: CONTEXTO });
    await acreditarDevolucion(deps, {
      expedienteId: "EXP-DEV",
      referenciaReintegro: "BCD-REINT-991",
      contexto: CONTEXTO,
    });

    const texto = evid.registros.map((r) => r.detalle ?? "").join(" ");
    for (const dato of [
      expediente.identidad?.numeroCedula,
      expediente.identidad?.nombres,
      expediente.canalWhatsapp?.valor,
      expediente.canalEmail?.valor,
    ]) {
      if (dato) expect(texto).not.toContain(dato);
    }
    // Lo que sí lleva: quién, por qué, cuánto y con qué referencias.
    expect(texto).toContain("solicitante=TITULAR");
    expect(texto).toContain("motivo=PEDIDO_DEL_TITULAR");
    expect(texto).toContain("referenciaReintegro=BCD-REINT-991");
    expect(texto).toContain("destinoDevolucion=MEDIO_DE_ORIGEN");
  });
});

// ---------------------------------------------------------------------------
// Lectura para la consola
// ---------------------------------------------------------------------------

describe("seguimiento para la consola", () => {
  it("un expediente sin devolución no tiene seguimiento", () => {
    expect(leerSeguimientoDevolucion(expedienteEnPagoConfirmado("EXP-DEV"))).toBeNull();
  });

  it("mide cuánto lleva abierto el trámite, que es lo que hace visible uno olvidado", async () => {
    const { deps, repo } = armar(expedienteEnPagoConfirmado("EXP-DEV"));
    await solicitarDevolucion(deps, { expedienteId: "EXP-DEV", ...PEDIDO, contexto: CONTEXTO });

    const seguimiento = leerSeguimientoDevolucion(repo.actual(), "2026-08-10T04:00:00.000Z");
    expect(seguimiento?.horasAbierta).toBe(12);
    expect(seguimiento?.estado).toBe("EN_TRAMITE");
    // Rótulos legibles, no los identificadores del dominio.
    expect(seguimiento?.solicitante).toBe("El titular");
    expect(seguimiento?.motivo).toBe("Pedido del titular");
  });
});
