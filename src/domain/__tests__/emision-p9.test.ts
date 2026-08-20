/**
 * Tests del caso de uso de P9.
 *
 * Lo que se prueba con más insistencia que el resto:
 *
 * - **Regla #3** — no se puede emitir sobre un paquete a medio firmar. El
 *   puerto lo hace imposible por tipo; acá se verifica que el caso de uso
 *   tampoco llegue a llamarlo sin firma.
 * - **Fila 43** — el orden firma → cobro → emisión: sin garantía de pago
 *   resuelta no se remite nada a Alianza.
 * - **Fila 47** — la póliza conserva el correlativo de la propuesta.
 * - **No se genera Nota de Cobertura** — ni en el expediente, ni en la
 *   proyección de la pantalla, ni en la evidencia.
 *
 * El proveedor que se usa es el **mock real** (`adapters/mock/policy-issuer`),
 * no un doble improvisado: estos tests ejercitan el mismo camino que la
 * demostración.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMORA_EMISION_MS,
  DEMORA_FACTURA_MS,
  crearPolicyIssuerMock,
  limpiarPolizasMock,
} from "../../adapters/mock/policy-issuer";
import type { EvidenceStore } from "../../ports/evidence-store";
import type { PolicyIssuer } from "../../ports/policy-issuer";
import {
  PASO_EVIDENCIA_EMISION_P9,
  PASO_EVIDENCIA_ESTADO_POLIZA_P9,
  consultarEmisionP9,
  emitirPolizaP9,
  leerResumenP9,
} from "../emision-p9";
import { registrarEmisionP9, transicionarExpediente } from "../expediente";
import type { Expediente, PolizaDelExpediente, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal";
import {
  expedienteEnPaqueteGenerado,
  expedienteFirmado,
  facturacionFixture,
  firmaFixture,
  pagoConfirmadoFixture,
} from "./fixtures";

const AHORA = "2026-08-09T15:20:00.000Z";

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-p9",
};

/** La firma que trae el fixture compartido: acá solo se la cita. */
const FIRMA = firmaFixture;

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

/**
 * Expediente firmado y cobrado, listo para que P9 lo remita a Alianza.
 *
 * D-08 · con el orden invertido la entrada de la emisión es PAGO_CONFIRMADO,
 * no FIRMADO: primero se firma y después entra la plata.
 */
function expedienteListoParaEmitir(id = "EXP-TEST-P9"): Expediente {
  const firmado = expedienteFirmado(id);
  const cobrado = transicionarExpediente(
    firmado,
    "PAGO_CONFIRMADO",
    { facturacion: facturacionFixture, pago: pagoConfirmadoFixture },
    "2026-08-09T15:04:00.000Z",
  );
  if (!cobrado.ok) throw new Error(cobrado.error);
  return cobrado.expediente;
}

function armar(expediente: Expediente = expedienteListoParaEmitir(), sebaot?: PolicyIssuer) {
  const repositorio = repositorioFalso(expediente);
  const evidencias = evidenciasFalsas();
  let reloj = AHORA;
  let contador = 0;

  return {
    deps: {
      polizas: sebaot ?? crearPolicyIssuerMock({ ahora: () => new Date(reloj) }),
      expedientes: repositorio,
      evidencias,
      ahora: () => reloj,
      nuevoId: () => `ev-${(contador += 1)}`,
    },
    repositorio,
    evidencias,
    avanzarReloj: (ms: number) => {
      reloj = new Date(new Date(reloj).getTime() + ms).toISOString();
    },
  };
}

beforeEach(() => {
  limpiarPolizasMock();
});

afterEach(() => {
  limpiarPolizasMock();
});

// ---------------------------------------------------------------------------

describe("P9 · remitir el expediente a Alianza", () => {
  it("FIRMADO → EMITIDO, con la póliza en proceso de emisión", async () => {
    const entorno = armar();

    const resultado = await emitirPolizaP9(entorno.deps, {
      expedienteId: "EXP-TEST-P9",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.emitida).toBe(true);
    expect(resultado.poliza.estado).toBe("EN_PROCESO_DE_EMISION");

    const expediente = entorno.repositorio.actual();
    expect(expediente.estado).toBe("EMITIDO");
    expect(expediente.poliza?.numeroPoliza).toBe(expediente.numeroPropuesta);
  });

  it("la póliza conserva el correlativo de la propuesta (fila 47)", async () => {
    const entorno = armar();

    const resultado = await emitirPolizaP9(entorno.deps, {
      expedienteId: "EXP-TEST-P9",
      contexto: CONTEXTO,
    });

    expect(resultado.ok && resultado.poliza.numeroPoliza).toBe("00018425");
  });

  it("la máquina de estados rechaza una póliza con numeración propia", () => {
    const expediente = expedienteListoParaEmitir();
    const ajena: PolizaDelExpediente = {
      numeroPoliza: "99999999",
      estado: "EN_PROCESO_DE_EMISION",
      emitidaEn: null,
      estadoFactura: "PENDIENTE",
      referenciaFactura: null,
      solicitadaEn: AHORA,
    };

    const resultado = registrarEmisionP9(expediente, ajena, AHORA);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("correlativo");
  });

  it("no se emite sin firma (regla inviolable #3)", async () => {
    const sinFirmar = expedienteEnPaqueteGenerado("EXP-TEST-P9");
    const entorno = armar(sinFirmar);

    const resultado = await emitirPolizaP9(entorno.deps, {
      expedienteId: "EXP-TEST-P9",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("ESTADO_INVALIDO");
    expect(entorno.repositorio.actual().estado).toBe("PAQUETE_GENERADO");
  });

  it("no se emite sin cobro (fila 44)", async () => {
    const base = expedienteListoParaEmitir();
    const pago = base.pago;
    if (!pago) throw new Error("el fixture debería tener pago");
    const entorno = armar({ ...base, pago: { ...pago, estado: "CANCELADO" } });

    const resultado = await emitirPolizaP9(entorno.deps, {
      expedienteId: "EXP-TEST-P9",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("COBRO_NO_CONFIRMADO");
  });

  it("crédito CAPTURADO sí emite: ahí el dinero entró", async () => {
    const base = expedienteListoParaEmitir();
    const pago = base.pago;
    if (!pago) throw new Error("el fixture debería tener pago");
    const entorno = armar({
      ...base,
      pago: { ...pago, medio: "TARJETA_CREDITO", estado: "CONFIRMADO" },
    });

    const resultado = await emitirPolizaP9(entorno.deps, {
      expedienteId: "EXP-TEST-P9",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    expect(entorno.repositorio.actual().estado).toBe("EMITIDO");
  });

  it("es idempotente: entrar de nuevo no emite una segunda póliza", async () => {
    const entorno = armar();
    await emitirPolizaP9(entorno.deps, { expedienteId: "EXP-TEST-P9", contexto: CONTEXTO });
    const historial = entorno.repositorio.actual().historial.length;

    const segunda = await emitirPolizaP9(entorno.deps, {
      expedienteId: "EXP-TEST-P9",
      contexto: CONTEXTO,
    });

    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;
    expect(segunda.emitida).toBe(false);
    expect(entorno.repositorio.actual().historial.length).toBe(historial);
  });

  it("si SEBAOT falla, el expediente se queda en PAGO_CONFIRMADO y queda la evidencia", async () => {
    const roto: PolicyIssuer = {
      async emitirPoliza() {
        throw new Error("SEBAOT no responde (simulado).");
      },
      async consultarEstadoPoliza() {
        throw new Error("no usado");
      },
      async consultarEstadoFacturaElectronica() {
        throw new Error("no usado");
      },
    };
    const entorno = armar(expedienteListoParaEmitir(), roto);

    const resultado = await emitirPolizaP9(entorno.deps, {
      expedienteId: "EXP-TEST-P9",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("SEBAOT_NO_DISPONIBLE");
    expect(entorno.repositorio.actual().estado).toBe("PAGO_CONFIRMADO");
    expect(
      entorno.evidencias.registros.some(
        (evidencia) => evidencia.paso === PASO_EVIDENCIA_EMISION_P9 && evidencia.resultado === "FALLIDO",
      ),
    ).toBe(true);
  });

  it("la evidencia vincula póliza, propuesta, pago y las dos huellas firmadas", async () => {
    const entorno = armar();

    await emitirPolizaP9(entorno.deps, { expedienteId: "EXP-TEST-P9", contexto: CONTEXTO });

    const registro = entorno.evidencias.registros.find(
      (evidencia) => evidencia.paso === PASO_EVIDENCIA_EMISION_P9 && evidencia.resultado === "EXITOSO",
    );
    expect(registro?.detalle).toContain("numeroPoliza=00018425");
    expect(registro?.detalle).toContain(FIRMA.hashSolicitudFirmada);
    expect(registro?.detalle).toContain(FIRMA.hashFipfFirmado);
    expect(registro?.detalle).toContain("emisorPoliza=ALIANZA_GARANTIA_SEBAOT");
    // Constancia explícita de que no existe.
    expect(registro?.detalle).toContain("notaDeCobertura=NO_SE_GENERA");
  });
});

describe("P9 · sondeo de la emisión", () => {
  async function hastaEmitido() {
    const entorno = armar();
    await emitirPolizaP9(entorno.deps, { expedienteId: "EXP-TEST-P9", contexto: CONTEXTO });
    return entorno;
  }

  it("mientras la póliza se prepara, nada cambia y no se escribe evidencia", async () => {
    const entorno = await hastaEmitido();
    const registros = entorno.evidencias.registros.length;

    const resultado = await consultarEmisionP9(entorno.deps, {
      expedienteId: "EXP-TEST-P9",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.poliza.estado).toBe("EN_PROCESO_DE_EMISION");
    expect(entorno.evidencias.registros.length).toBe(registros);
  });

  it("pasado el tiempo, la póliza queda EMITIDA sin mover el estado del expediente", async () => {
    const entorno = await hastaEmitido();
    entorno.avanzarReloj(DEMORA_EMISION_MS);

    const resultado = await consultarEmisionP9(entorno.deps, {
      expedienteId: "EXP-TEST-P9",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.poliza.estado).toBe("EMITIDA");
    expect(resultado.poliza.emitidaEn).not.toBeNull();
    // EMITIDO ya se había alcanzado: el expediente no se mueve más.
    expect(entorno.repositorio.actual().estado).toBe("EMITIDO");
    expect(
      entorno.evidencias.registros.some(
        (evidencia) => evidencia.paso === PASO_EVIDENCIA_ESTADO_POLIZA_P9,
      ),
    ).toBe(true);
  });

  it("la factura llega después de la póliza, con su referencia", async () => {
    const entorno = await hastaEmitido();
    entorno.avanzarReloj(DEMORA_FACTURA_MS);

    const resultado = await consultarEmisionP9(entorno.deps, {
      expedienteId: "EXP-TEST-P9",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.poliza.estadoFactura).toBe("EMITIDA");
    expect(resultado.poliza.referenciaFactura).toMatch(/^MOCK-SIFEN-/);
  });

  it("no se puede sondear un expediente que no llegó a EMITIDO", async () => {
    const entorno = armar();

    const resultado = await consultarEmisionP9(entorno.deps, {
      expedienteId: "EXP-TEST-P9",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
  });
});

describe("P9 · resumen para la pantalla", () => {
  async function resumenDe() {
    const entorno = armar();
    await emitirPolizaP9(entorno.deps, { expedienteId: "EXP-TEST-P9", contexto: CONTEXTO });
    return { entorno, resumen: leerResumenP9(entorno.repositorio.actual()) };
  }

  it("trae los dos documentos con la huella del PDF firmado", async () => {
    const { resumen } = await resumenDe();

    expect(resumen?.solicitud.codigo).toBe("PROP-00018425");
    expect(resumen?.fipf.codigo).toBe("FIPF-00018425");
    // La huella que se muestra es la del firmado, no la del cerrado.
    expect(resumen?.solicitud.hashFirmado).toBe(FIRMA.hashSolicitudFirmada);
    expect(resumen?.fipf.hashFirmado).toBe(FIRMA.hashFipfFirmado);
  });

  it("no expone la cédula completa ni ningún canal sin enmascarar", async () => {
    const { entorno, resumen } = await resumenDe();
    const expediente = entorno.repositorio.actual();

    const serializado = JSON.stringify(resumen);
    expect(serializado).not.toContain(expediente.identidad?.numeroCedula ?? "@@");
    expect(serializado).not.toContain(expediente.canalWhatsapp?.valor ?? "@@");
    expect(serializado).not.toContain(expediente.canalEmail?.valor ?? "@@");
  });

  it("no hay ningún campo de póliza descargable ni de Nota de Cobertura", async () => {
    const { resumen } = await resumenDe();

    // Del portal solo se descargan la Solicitud y el FIPF firmados: la póliza y
    // la factura las envía Alianza a los canales verificados.
    const serializado = JSON.stringify(resumen).toLowerCase();
    expect(serializado).not.toContain("cobertura");
    expect(serializado).not.toContain("urlpoliza");
    expect(serializado).not.toContain("pdfpoliza");
  });

  it("no hay resumen antes de llegar a EMITIDO", () => {
    expect(leerResumenP9(expedienteListoParaEmitir())).toBeNull();
  });
});
