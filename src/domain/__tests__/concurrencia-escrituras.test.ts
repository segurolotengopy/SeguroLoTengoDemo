/**
 * Carreras de escritura sobre el mismo expediente (`src/domain/concurrencia.ts`).
 *
 * La carrera real que motivó esto: la pantalla sondea el estado —que puede
 * escribir— a la vez que su cuenta regresiva dispara el vencimiento. Con la
 * inversión de firma y pago (D-08) el reloj se mudó al paso de pago, así que
 * hoy la carrera es entre `/api/p7/estado` y `/api/p7/vencimiento`; el
 * mecanismo y lo que se afirma son los mismos. Las dos peticiones leen la
 * misma versión del
 * expediente y las dos intentan escribir; el bloqueo optimista del repositorio
 * hace fallar a la segunda. Antes de estos tests, ese fallo subía como
 * excepción hasta el Route Handler y terminaba en un 500 con stack en los
 * logs. Lo que se afirma acá es que ahora las dos peticiones terminan en una
 * respuesta controlada, que el expediente queda escrito **una** sola vez y que
 * la evidencia no se duplica.
 *
 * El repositorio falso replica la semántica exacta del bloqueo optimista de
 * `src/repositories/expediente-repository.ts`: si se pasa
 * `actualizadoEnEsperado` y ya no coincide, lanza `ErrorEscrituraConcurrente`.
 * Con `Promise.all`, las dos operaciones quedan suspendidas en su primera
 * lectura antes de que ninguna escriba, así que la segunda escritura pierde
 * siempre: la carrera se reproduce determinísticamente en cada corrida.
 */
import { describe, expect, it } from "vitest";
import { ErrorEscrituraConcurrente } from "../concurrencia";
import {
  PASO_EVIDENCIA_ESTADO_POLIZA_P9,
  consultarEmisionP9,
  emitirPolizaP9,
} from "../emision-p9";
import {
  registrarEmisionP9,
  registrarIntentoPagoP7,
  registrarPagoConfirmadoP7,
} from "../expediente";
import { iniciarFirmaP8 } from "../firma-p8";
import {
  PASO_EVIDENCIA_CONFIRMACION_P7,
  PASO_EVIDENCIA_VENCIMIENTO_P7,
  RUTA_PANTALLA_B,
  confirmarPagoP7,
  vencerPlazoPagoP7,
} from "../pago-p7";
import type { EvidenceStore } from "../../ports/evidence-store";
import type { EstadoConsultaPago, PaymentProvider } from "../../ports/payment-provider";
import type { PolicyIssuer } from "../../ports/policy-issuer";
import type { SignatureProvider } from "../../ports/signature-provider";
import type { Expediente, Pago, PolizaDelExpediente, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal";
import {
  NUMERO_PROPUESTA_FIJO,
  certificadoFixture,
  emisorCertificadoFalso,
  expedienteEnPaqueteGenerado,
  expedienteFirmado,
  facturacionFixture,
  pagoConfirmadoFixture,
} from "./fixtures";

// El fixture firmado tiene `plazoPagoVenceEn` = 2026-08-10T15:03:00.000Z.
const DENTRO_DEL_PLAZO = "2026-08-09T15:05:00.000Z";
const DESPUES_DEL_PLAZO = "2026-08-10T15:04:00.000Z";

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-concurrencia",
};

// ---------------------------------------------------------------------------
// Dobles en memoria
// ---------------------------------------------------------------------------

/**
 * Repositorio con el mismo bloqueo optimista que el real: la escritura
 * condicional pierde si `actualizadoEn` ya no es el que el caller leyó.
 */
function repositorioConLockOptimista(inicial: Expediente): RepositorioExpediente & {
  actual: () => Expediente;
  escrituras: () => number;
} {
  let guardado = inicial;
  let escrituras = 0;
  return {
    async obtenerPorId(id) {
      return id === guardado.id ? guardado : null;
    },
    async crear(expediente) {
      guardado = expediente;
    },
    async guardar(expediente, actualizadoEnEsperado) {
      if (actualizadoEnEsperado !== undefined && guardado.actualizadoEn !== actualizadoEnEsperado) {
        throw new ErrorEscrituraConcurrente(expediente.id);
      }
      escrituras += 1;
      guardado = expediente;
    },
    actual: () => guardado,
    escrituras: () => escrituras,
  };
}

/** Repositorio donde toda escritura condicional pierde: el peor caso posible. */
function repositorioSiempreEnConflicto(inicial: Expediente): RepositorioExpediente {
  return {
    async obtenerPorId(id) {
      return id === inicial.id ? inicial : null;
    },
    async crear() {
      throw new Error("crear no debería usarse en este test");
    },
    async guardar(expediente) {
      throw new ErrorEscrituraConcurrente(expediente.id);
    },
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

/** Los tests de vencimiento con pago QR no tienen por qué tocar a Code100. */
const firmasNoUsadas: SignatureProvider = {
  async iniciarFirma() {
    throw new Error("Code100 no debería usarse en este test");
  },
  async descargarDocumentoFirmado() {
    throw new Error("Code100 no debería usarse en este test");
  },
  async confirmarResultado() {
    throw new Error("Code100 no debería usarse en este test");
  },
};

/** Ni a Bancard: con QR ya cobrado no hay reserva que capturar ni liberar. */
const bancardNoUsado: PaymentProvider = {
  async iniciarPagoQr() {
    throw new Error("Bancard no debería usarse en este test");
  },
  async iniciarPagoTarjetaDebito() {
    throw new Error("Bancard no debería usarse en este test");
  },
  async iniciarPagoTarjetaCredito() {
    throw new Error("Bancard no debería usarse en este test");
  },
  async consultarEstadoPago() {
    throw new Error("Bancard no debería usarse en este test");
  },
  async cancelarOLiberarReserva() {
    throw new Error("Bancard no debería usarse en este test");
  },
};

function armarPago(expediente: Expediente, ahora: string) {
  const repositorio = repositorioConLockOptimista(expediente);
  const evidencias = evidenciasFalsas();
  let contador = 0;
  return {
    repositorio,
    evidencias,
    deps: {
      pagos: bancardNoUsado,
      expedientes: repositorio,
      evidencias,
      emitirCertificado: emisorCertificadoFalso(),
      ahora: () => ahora,
      nuevoId: () => `ev-${(contador += 1)}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Pago · la carrera reportada: sondeo de estado contra vencimiento del plazo
// ---------------------------------------------------------------------------

describe("pago · escrituras concurrentes sobre el mismo expediente", () => {
  it("el sondeo de estado y el vencimiento corren a la vez: ninguno revienta, una sola escritura y una sola evidencia", async () => {
    const entorno = armarPago(expedienteFirmado(), DESPUES_DEL_PLAZO);
    const expedienteId = entorno.repositorio.actual().id;

    // Antes de la conversión a respuesta controlada, este Promise.all
    // rechazaba con el error del bloqueo optimista (el 500 de los logs).
    const [vencimiento, sondeo] = await Promise.all([
      vencerPlazoPagoP7(entorno.deps, { expedienteId, contexto: CONTEXTO }),
      confirmarPagoP7(entorno.deps, { expedienteId, contexto: CONTEXTO }),
    ]);

    expect(vencimiento).toEqual({ ok: true, vencio: true, estado: "VENCIDO" });
    expect(sondeo.ok).toBe(false);
    if (!sondeo.ok) {
      expect(sondeo.motivo).toBe("PLAZO_VENCIDO");
      expect(sondeo.siguientePantalla).toBe(RUTA_PANTALLA_B);
    }

    expect(entorno.repositorio.actual().estado).toBe("VENCIDO");
    // El perdedor reintentó con una lectura fresca y no volvió a escribir.
    expect(entorno.repositorio.escrituras()).toBe(1);
    expect(
      entorno.evidencias.registros.filter((r) => r.paso === PASO_EVIDENCIA_VENCIMIENTO_P7),
    ).toHaveLength(1);
  });

  it("vencer un expediente ya vencido no escribe de nuevo ni duplica la evidencia", async () => {
    const entorno = armarPago(expedienteFirmado(), DESPUES_DEL_PLAZO);
    const expedienteId = entorno.repositorio.actual().id;

    const primera = await vencerPlazoPagoP7(entorno.deps, { expedienteId, contexto: CONTEXTO });
    const segunda = await vencerPlazoPagoP7(entorno.deps, { expedienteId, contexto: CONTEXTO });

    expect(primera).toEqual({ ok: true, vencio: true, estado: "VENCIDO" });
    expect(segunda).toEqual({ ok: true, vencio: true, estado: "VENCIDO" });
    expect(entorno.repositorio.escrituras()).toBe(1);
    expect(
      entorno.evidencias.registros.filter((r) => r.paso === PASO_EVIDENCIA_VENCIMIENTO_P7),
    ).toHaveLength(1);
  });

  it("si el conflicto persiste tras los reintentos, el vencimiento devuelve CONFLICTO_CONCURRENCIA en vez de lanzar", async () => {
    const expediente = expedienteFirmado();
    const evidencias = evidenciasFalsas();
    const deps = {
      pagos: bancardNoUsado,
      expedientes: repositorioSiempreEnConflicto(expediente),
      evidencias,
      emitirCertificado: emisorCertificadoFalso(),
      ahora: () => DESPUES_DEL_PLAZO,
      nuevoId: () => "ev-1",
    };

    const resultado = await vencerPlazoPagoP7(deps, {
      expedienteId: expediente.id,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "CONFLICTO_CONCURRENCIA" });
    // La evidencia del vencimiento se deja solo después de persistirlo: si la
    // escritura perdió, no queda un registro de algo que no pasó.
    expect(evidencias.registros).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Firma · Code100 no se llama dos veces
// ---------------------------------------------------------------------------

describe("firma · escrituras concurrentes sobre el mismo expediente", () => {
  it("iniciar la firma no se reintenta ante conflicto: Code100 se llama una sola vez y baja CONFLICTO_CONCURRENCIA", async () => {
    const expediente = expedienteEnPaqueteGenerado();
    let llamadasACode100 = 0;
    const firmas: SignatureProvider = {
      ...firmasNoUsadas,
      async iniciarFirma() {
        llamadasACode100 += 1;
        return {
          idCode100: `C100-${llamadasACode100}`,
          enlaceEnviadoEn: DENTRO_DEL_PLAZO,
          venceEn: "2026-08-10T15:01:00.000Z",
          urlActoDeFirma: "https://code100.example/acto",
        };
      },
    };

    const resultado = await iniciarFirmaP8(
      {
        firmas,
        expedientes: repositorioSiempreEnConflicto(expediente),
        evidencias: evidenciasFalsas(),
        ahora: () => DENTRO_DEL_PLAZO,
        nuevoId: () => "ev-1",
      },
      { expedienteId: expediente.id, canal: "WHATSAPP", contexto: CONTEXTO },
    );

    expect(resultado).toEqual({ ok: false, motivo: "CONFLICTO_CONCURRENCIA" });
    expect(llamadasACode100).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// P9 · el sondeo de la póliza y la carga de la pantalla escriben a la vez
// ---------------------------------------------------------------------------

/** D-08 · la entrada de la emisión es un expediente firmado **y cobrado**. */
function expedienteListoParaEmitir(id = "EXP-TEST-P9"): Expediente {
  const conIntento = registrarIntentoPagoP7(
    expedienteFirmado(id),
    { facturacion: facturacionFixture, pago: pagoConfirmadoFixture },
    "2026-08-09T15:10:00.000Z",
  );
  if (!conIntento.ok) throw new Error(conIntento.error);

  const cobrado = registrarPagoConfirmadoP7(
    conIntento.expediente,
    { pago: pagoConfirmadoFixture, certificado: certificadoFixture },
    "2026-08-09T15:10:30.000Z",
  );
  if (!cobrado.ok) throw new Error(cobrado.error);
  return cobrado.expediente;
}

function expedienteEmitido(id = "EXP-TEST-P9"): Expediente {
  const polizaEnProceso: PolizaDelExpediente = {
    numeroPoliza: NUMERO_PROPUESTA_FIJO,
    estado: "EN_PROCESO_DE_EMISION",
    emitidaEn: null,
    estadoFactura: "PENDIENTE",
    referenciaFactura: null,
    solicitadaEn: "2026-08-09T15:11:00.000Z",
  };
  const emitido = registrarEmisionP9(expedienteListoParaEmitir(id), polizaEnProceso, "2026-08-09T15:11:00.000Z");
  if (!emitido.ok) throw new Error(emitido.error);
  return emitido.expediente;
}

describe("P9 · escrituras concurrentes sobre el mismo expediente", () => {
  it("dos sondeos asientan el mismo avance de la póliza a la vez: los dos responden, una sola escritura y una sola evidencia", async () => {
    const repositorio = repositorioConLockOptimista(expedienteEmitido());
    const evidencias = evidenciasFalsas();
    const sebaotConPolizaEmitida: PolicyIssuer = {
      async emitirPoliza() {
        throw new Error("emitirPoliza no debería usarse en este test");
      },
      async consultarEstadoPoliza(numeroPoliza) {
        return { numeroPoliza, estado: "EMITIDA", emitidaEn: "2026-08-09T15:12:00.000Z" };
      },
      async consultarEstadoFacturaElectronica() {
        return { referencia: "FACT-TEST-1", estado: "EMITIDA" };
      },
    };
    let contador = 0;
    const deps = {
      polizas: sebaotConPolizaEmitida,
      expedientes: repositorio,
      evidencias,
      ahora: () => "2026-08-09T15:12:00.000Z",
      nuevoId: () => `ev-${(contador += 1)}`,
    };
    const expedienteId = repositorio.actual().id;

    const [primero, segundo] = await Promise.all([
      consultarEmisionP9(deps, { expedienteId, contexto: CONTEXTO }),
      consultarEmisionP9(deps, { expedienteId, contexto: CONTEXTO }),
    ]);

    // El perdedor reintentó, releyó la póliza ya asentada como EMITIDA y entró
    // por la rama `sinCambios`: para la pantalla las dos respuestas son iguales.
    for (const resultado of [primero, segundo]) {
      expect(resultado.ok).toBe(true);
      if (resultado.ok) expect(resultado.poliza.estado).toBe("EMITIDA");
    }
    expect(repositorio.actual().poliza?.estado).toBe("EMITIDA");
    expect(repositorio.escrituras()).toBe(1);
    expect(
      evidencias.registros.filter((r) => r.paso === PASO_EVIDENCIA_ESTADO_POLIZA_P9),
    ).toHaveLength(1);
  });

  it("remitir a Alianza no se reintenta ante conflicto: SEBAOT se llama una sola vez y baja CONFLICTO_CONCURRENCIA", async () => {
    const expediente = expedienteListoParaEmitir();
    let ordenesDeEmision = 0;
    const sebaotContable: PolicyIssuer = {
      async emitirPoliza(input) {
        ordenesDeEmision += 1;
        return { numeroPoliza: input.propuestaId, estado: "EN_PROCESO_DE_EMISION", emitidaEn: null };
      },
      async consultarEstadoPoliza() {
        throw new Error("consultarEstadoPoliza no debería usarse en este test");
      },
      async consultarEstadoFacturaElectronica() {
        return { referencia: null, estado: "PENDIENTE" };
      },
    };

    const resultado = await emitirPolizaP9(
      {
        polizas: sebaotContable,
        expedientes: repositorioSiempreEnConflicto(expediente),
        evidencias: evidenciasFalsas(),
        ahora: () => "2026-08-09T15:11:00.000Z",
        nuevoId: () => "ev-1",
      },
      { expedienteId: expediente.id, contexto: CONTEXTO },
    );

    expect(resultado).toEqual({ ok: false, motivo: "CONFLICTO_CONCURRENCIA" });
    expect(ordenesDeEmision).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// P7 · dos sondeos confirman el mismo pago a la vez
// ---------------------------------------------------------------------------

describe("P7 · escrituras concurrentes sobre el mismo expediente", () => {
  it("dos sondeos de estado confirman el pago a la vez: los dos responden confirmado, una sola escritura y una sola evidencia", async () => {
    const pagoPendiente: Pago = { ...pagoConfirmadoFixture, estado: "PENDIENTE", confirmadoEn: null };
    const conIntento = registrarIntentoPagoP7(
      expedienteFirmado(),
      { facturacion: facturacionFixture, pago: pagoPendiente },
      "2026-08-09T15:04:00.000Z",
    );
    if (!conIntento.ok) throw new Error(conIntento.error);

    const repositorio = repositorioConLockOptimista(conIntento.expediente);
    const evidencias = evidenciasFalsas();
    const bancardConfirmado: PaymentProvider = {
      ...bancardNoUsado,
      async consultarEstadoPago(referenciaBancard): Promise<EstadoConsultaPago> {
        return {
          referenciaBancard,
          medio: "QR_BANCARD",
          estado: "CONFIRMADO",
          montoGs: pagoPendiente.montoGs,
          ultimos4Digitos: null,
          actualizadoEn: "2026-08-09T15:01:00.000Z",
        };
      },
    };
    let contador = 0;
    const deps = {
      pagos: bancardConfirmado,
      expedientes: repositorio,
      evidencias,
      emitirCertificado: emisorCertificadoFalso(),
      ahora: () => "2026-08-09T15:01:00.000Z",
      nuevoId: () => `ev-${(contador += 1)}`,
    };
    const expedienteId = conIntento.expediente.id;

    const [primero, segundo] = await Promise.all([
      confirmarPagoP7(deps, { expedienteId, contexto: CONTEXTO }),
      confirmarPagoP7(deps, { expedienteId, contexto: CONTEXTO }),
    ]);

    // El perdedor reintentó, releyó PAGO_CONFIRMADO y entró por la rama
    // idempotente: para la pantalla las dos respuestas son iguales.
    for (const resultado of [primero, segundo]) {
      expect(resultado.ok).toBe(true);
      if (resultado.ok) expect(resultado.confirmado).toBe(true);
    }
    expect(repositorio.actual().estado).toBe("PAGO_CONFIRMADO");
    expect(repositorio.escrituras()).toBe(1);
    expect(
      evidencias.registros.filter((r) => r.paso === PASO_EVIDENCIA_CONFIRMACION_P7),
    ).toHaveLength(1);
  });
});
