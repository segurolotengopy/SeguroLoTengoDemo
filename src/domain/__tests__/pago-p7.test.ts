/**
 * Tests del caso de uso de P7.
 *
 * Tres cosas se prueban con más insistencia que el resto, porque son controles
 * de la matriz de cumplimiento y no meras validaciones de formulario:
 *
 * - **Fila 32 (idempotencia)** — un reintento del mismo intento reutiliza la
 *   clave y no abre una segunda operación en Bancard; un intento distinto
 *   (otro medio, o después de una cancelación) sí genera una clave nueva.
 * - **D-08 (no se cobra sin firma)** — el único estado de origen es FIRMADO, y
 *   el correlativo ya viene acuñado por el cierre del paquete documental.
 * - **Fila 25 (importe)** — lo que viaja a Bancard es el premio persistido en
 *   el expediente, pase lo que pase por el cuerpo de la petición.
 *
 * La regla inviolable #6 (ningún dato de tarjeta) tiene su propio archivo:
 * `src/app/api/p7/__tests__/no-persiste-datos-de-tarjeta.test.ts`.
 */
import { describe, expect, it, vi } from "vitest";
import type { EvidenceStore } from "../../ports/evidence-store";
import { ErrorBancard } from "../../ports/payment-provider";
import type { PaymentProvider } from "../../ports/payment-provider";
import { PLANES } from "../catalogo";
import {
  PASO_EVIDENCIA_CONFIRMACION_P7,
  PASO_EVIDENCIA_INICIO_P7,
  PASO_EVIDENCIA_VENCIMIENTO_P7,
  RUTA_PANTALLA_B,
  confirmarPagoP7,
  iniciarPagoP7,
  leerResumenPagoP7,
  normalizarRuc,
  vencerPlazoPagoP7,
} from "../pago-p7";
import type { EstadoPago, Expediente, MedioDePago, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal";
import { PAQUETE_FIXTURE, PLAZO_PAGO_FIJO, expedienteFirmado } from "./fixtures";

// ---------------------------------------------------------------------------
// Dobles en memoria
// ---------------------------------------------------------------------------

const AHORA = "2026-08-09T15:00:00.000Z";
const NUMERO_PROPUESTA = "00018425";
const PREMIO = PLANES.CONFIO_PLUS.premioAnualGs;

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-p7",
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

/**
 * Doble de Bancard que registra cada llamada y devuelve una referencia por
 * `idempotencyKey`, igual que exige el puerto. Con `estadoTrasAcreditar` se
 * fija a qué estado llega la operación al consultarla.
 */
function bancardFalso(opciones: { estadoTrasAcreditar?: EstadoPago | null } = {}) {
  const llamadas: { metodo: string; idempotencyKey: string; montoGs: number }[] = [];
  const porClave = new Map<string, string>();
  const medios = new Map<string, MedioDePago>();
  let contador = 0;

  function abrir(metodo: string, medio: MedioDePago, input: { idempotencyKey: string; montoGs: number }) {
    llamadas.push({ metodo, idempotencyKey: input.idempotencyKey, montoGs: input.montoGs });
    const existente = porClave.get(input.idempotencyKey);
    if (existente) return existente;
    contador += 1;
    const referencia = `REF-${contador}`;
    porClave.set(input.idempotencyKey, referencia);
    medios.set(referencia, medio);
    return referencia;
  }

  const provider: PaymentProvider = {
    async iniciarPagoQr(input) {
      const referenciaBancard = abrir("qr", "QR_BANCARD", input);
      return { referenciaBancard, qrPayload: `qr://${referenciaBancard}`, expiraEn: AHORA };
    },
    async iniciarPagoTarjetaDebito(input) {
      const referenciaBancard = abrir("debito", "TARJETA_DEBITO", input);
      return { referenciaBancard, urlFormularioSeguro: `https://vpos/${referenciaBancard}` };
    },
    async iniciarPagoTarjetaCredito(input) {
      const referenciaBancard = abrir("credito", "TARJETA_CREDITO", input);
      return { referenciaBancard, urlFormularioSeguro: `https://vpos/${referenciaBancard}` };
    },
    async consultarEstadoPago(referenciaBancard) {
      const medio = medios.get(referenciaBancard);
      if (!medio) return null;
      const estado =
        opciones.estadoTrasAcreditar === undefined
          ? medio === "TARJETA_CREDITO"
            ? "CONFIRMADO"
            : "CONFIRMADO"
          : opciones.estadoTrasAcreditar;
      return {
        referenciaBancard,
        medio,
        estado: estado ?? "PENDIENTE",
        montoGs: PREMIO,
        // Bancard sí devuelve el enmascarado; el dominio lo tiene que descartar.
        ultimos4Digitos: medio === "QR_BANCARD" ? null : "0042",
        actualizadoEn: AHORA,
      };
    },
    cancelarOLiberarReserva: vi.fn(),
  };

  return { provider, llamadas };
}

/** Expediente en DECLARACIONES_OK, listo para P7. */
/**
 * D-08 · la entrada de este paso es un expediente **firmado**: paquete cerrado,
 * correlativo acuñado y plazo de pago corriendo.
 */
function expedienteListoParaPagar(): Expediente {
  return expedienteFirmado("EXP-TEST-1");
}

function armar(expediente: Expediente, bancard = bancardFalso()) {
  const expedientes = repositorioFalso(expediente);
  const evidencias = evidenciasFalsas();
  return {
    expedientes,
    evidencias,
    bancard,
    deps: {
      pagos: bancard.provider,
      expedientes,
      evidencias,
      ahora: () => AHORA,
      nuevoId: (() => {
        let n = 0;
        return () => {
          n += 1;
          return `id-${n}`;
        };
      })(),
    },
  };
}

const ENTRADA_QR = {
  expedienteId: "EXP-TEST-1",
  medio: "QR_BANCARD" as const,
  ruc: "",
  contexto: CONTEXTO,
};

// ---------------------------------------------------------------------------
// No se cobra sin firma (D-08)
// ---------------------------------------------------------------------------

describe("pago · no hay cobro sin firma", () => {
  it("desde DECLARACIONES_OK no se abre ninguna operación en Bancard", async () => {
    // Es la garantía de la Matriz V4 §7: el medio de cobro solo se habilita
    // con firma válida. El rechazo ocurre antes de tocar al proveedor.
    const firmado = expedienteListoParaPagar();
    const sinFirmar: Expediente = { ...firmado, estado: "DECLARACIONES_OK", firma: null };
    const { deps, bancard, expedientes } = armar(sinFirmar);

    const resultado = await iniciarPagoP7(deps, ENTRADA_QR);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("ESTADO_INVALIDO");
    expect(bancard.llamadas).toHaveLength(0);
    expect(expedientes.actual().pago).toBeNull();
  });

  it("la declaración de licitud ya no se acepta acá: viaja impresa en el documento firmado", async () => {
    const { deps, expedientes } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);

    // Matriz V4 §4: "no casilla adicional". El literal se imprime en el PDF y
    // lo cubre el acto de firma; la facturación no lo lleva ni lo repite.
    expect(JSON.stringify(expedientes.actual().facturacion)).not.toContain("lícit");
  });
});

// ---------------------------------------------------------------------------
// Importe y facturación
// ---------------------------------------------------------------------------

describe("P7 · importe y datos de la factura", () => {
  it("el importe que viaja a Bancard sale del plan del expediente, no del cliente", async () => {
    const { deps, bancard } = armar(expedienteListoParaPagar());

    // El cuerpo trae un monto ridículo: el dominio ni siquiera lo lee.
    await iniciarPagoP7(deps, { ...ENTRADA_QR, ...({ montoGs: 1 } as object) });

    expect(bancard.llamadas[0].montoGs).toBe(PREMIO);
  });

  it("la factura va siempre a nombre del asegurado, tomado de la identidad", async () => {
    const { deps, expedientes } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);

    expect(expedientes.actual().facturacion?.nombreAFacturar).toBe("Mónica Mariana Gorena Tapia");
  });

  it("acepta el RUC con y sin guion, y lo normaliza", async () => {
    expect(normalizarRuc("80012345-6")).toBe("80012345-6");
    expect(normalizarRuc(" 800123456 ")).toBe("80012345-6");
    expect(normalizarRuc("")).toBeNull();
    expect(normalizarRuc("no-es-un-ruc")).toBeNull();
  });

  it("rechaza un RUC con formato inválido sin llamar a Bancard", async () => {
    const { deps, bancard } = armar(expedienteListoParaPagar());

    const resultado = await iniciarPagoP7(deps, { ...ENTRADA_QR, ruc: "abc" });

    expect(resultado).toEqual({ ok: false, motivo: "RUC_INVALIDO" });
    expect(bancard.llamadas).toHaveLength(0);
  });

  it("un RUC vacío es válido: se persiste como null", async () => {
    const { deps, expedientes } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, { ...ENTRADA_QR, ruc: "   " });

    expect(expedientes.actual().facturacion?.ruc).toBeNull();
  });

  it("cita el correlativo que acuñó el paquete documental, y no acuña otro (D-08)", async () => {
    const { deps, expedientes } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);
    expect(expedientes.actual().numeroPropuesta).toBe(NUMERO_PROPUESTA);

    // Cambiar de medio abre otro intento, pero el correlativo es el mismo:
    // no hay ninguna rama por la que este paso pueda generar un número.
    await iniciarPagoP7(deps, { ...ENTRADA_QR, medio: "TARJETA_CREDITO" });
    expect(expedientes.actual().numeroPropuesta).toBe(NUMERO_PROPUESTA);
  });
});

// ---------------------------------------------------------------------------
// Idempotencia (fila 32 de la matriz)
// ---------------------------------------------------------------------------

describe("P7 · idempotencia del intento de pago", () => {
  it("un reintento del mismo intento reutiliza la clave y no abre otra operación", async () => {
    const { deps, bancard, expedientes } = armar(expedienteListoParaPagar());

    const primero = await iniciarPagoP7(deps, ENTRADA_QR);
    const reintento = await iniciarPagoP7(deps, ENTRADA_QR);

    expect(primero.ok && reintento.ok).toBe(true);
    expect(bancard.llamadas[0].idempotencyKey).toBe(bancard.llamadas[1].idempotencyKey);
    if (primero.ok && reintento.ok) {
      expect(reintento.referenciaBancard).toBe(primero.referenciaBancard);
    }
    expect(expedientes.actual().pago?.idempotencyKey).toBe(bancard.llamadas[0].idempotencyKey);
  });

  it("cambiar de medio de pago es un intento distinto y usa una clave nueva", async () => {
    const { deps, bancard } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);
    await iniciarPagoP7(deps, { ...ENTRADA_QR, medio: "TARJETA_DEBITO" });

    expect(bancard.llamadas[1].idempotencyKey).not.toBe(bancard.llamadas[0].idempotencyKey);
  });

  it("después de una cancelación el intento siguiente usa una clave nueva", async () => {
    const expediente = expedienteListoParaPagar();
    const { deps, bancard, expedientes } = armar(expediente);

    await iniciarPagoP7(deps, ENTRADA_QR);
    const cancelado = expedientes.actual();
    await expedientes.guardar({
      ...cancelado,
      // Lo que dejaría `confirmarPagoP7` ante un QR vencido.
      pago: cancelado.pago ? { ...cancelado.pago, estado: "CANCELADO" } : null,
    });

    await iniciarPagoP7(deps, ENTRADA_QR);

    expect(bancard.llamadas[1].idempotencyKey).not.toBe(bancard.llamadas[0].idempotencyKey);
  });

  it("no abre un intento nuevo si la garantía de pago ya está lista", async () => {
    const { deps, expedientes, bancard } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);
    await confirmarPagoP7(deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });

    const resultado = await iniciarPagoP7(deps, { ...ENTRADA_QR, medio: "TARJETA_CREDITO" });

    expect(resultado).toEqual({ ok: false, motivo: "ESTADO_INVALIDO" });
    // Ni siquiera se le pidió una preautorización a Bancard: con el
    // expediente ya en PAGO_CONFIRMADO el chequeo de estado corta antes.
    expect(bancard.llamadas.filter((l) => l.metodo === "credito")).toHaveLength(0);
    expect(expedientes.actual().pago?.medio).toBe("QR_BANCARD");
    expect(expedientes.actual().estado).toBe("PAGO_CONFIRMADO");
  });
});

// ---------------------------------------------------------------------------
// Confirmación y plazo de firma
// ---------------------------------------------------------------------------

describe("P7 · confirmación de la garantía de pago", () => {
  it("mientras Bancard responde PENDIENTE no transiciona ni escribe evidencia", async () => {
    const { deps, expedientes, evidencias } = armar(
      expedienteListoParaPagar(),
      bancardFalso({ estadoTrasAcreditar: "PENDIENTE" }),
    );

    await iniciarPagoP7(deps, ENTRADA_QR);
    const registrosTrasIniciar = evidencias.registros.length;

    const resultado = await confirmarPagoP7(deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });

    expect(resultado).toMatchObject({ ok: true, confirmado: false });
    expect(expedientes.actual().estado).toBe("FIRMADO");
    expect(evidencias.registros).toHaveLength(registrosTrasIniciar);
  });

  it("con el QR acreditado transiciona a PAGO_CONFIRMADO y cierra el plazo", async () => {
    const { deps, expedientes } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);
    const resultado = await confirmarPagoP7(deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });

    expect(resultado).toMatchObject({
      ok: true,
      confirmado: true,
      estado: "PAGO_CONFIRMADO",
      // D-08 · pagado el premio, la contratación queda cerrada.
      siguientePantalla: "/confirmacion",
    });

    const guardado = expedientes.actual();
    expect(guardado.pago?.estado).toBe("CONFIRMADO");
    expect(guardado.pago?.confirmadoEn).toBe(AHORA);
    // El plazo lo abrió la firma (D-10) y no se recalcula al cobrar: lo que
    // hace el pago es apagarlo, sacando el expediente de la ventana que caduca.
    expect(guardado.plazoPagoVenceEn).toBe(PLAZO_PAGO_FIJO);
  });

  it("el débito confirma igual que el QR: cobro directo (D-02)", async () => {
    const { deps, expedientes } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, { ...ENTRADA_QR, medio: "TARJETA_DEBITO" });
    const resultado = await confirmarPagoP7(deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });

    expect(resultado).toMatchObject({ ok: true, confirmado: true });
    expect(expedientes.actual().pago?.estado).toBe("CONFIRMADO");
  });

  it("el crédito cobra directo, igual que el QR y el débito (D-02)", async () => {
    const { deps, expedientes } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, { ...ENTRADA_QR, medio: "TARJETA_CREDITO" });
    const resultado = await confirmarPagoP7(deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });

    expect(resultado).toMatchObject({ ok: true, confirmado: true });
    expect(expedientes.actual().estado).toBe("PAGO_CONFIRMADO");
    expect(expedientes.actual().pago?.estado).toBe("CONFIRMADO");
  });

  /**
   * La rama que hace inofensivo un callback duplicado de Bancard: sondear de
   * nuevo con el expediente ya confirmado no vuelve a transicionar ni a
   * escribir evidencia.
   */
  it("confirmar dos veces es idempotente: no re-transiciona ni duplica evidencia", async () => {
    const { deps, expedientes, evidencias } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);
    const primera = await confirmarPagoP7(deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });
    const historialTrasPrimera = expedientes.actual().historial.length;
    const evidenciasTrasPrimera = evidencias.registros.length;

    const segunda = await confirmarPagoP7(deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });

    expect(segunda).toEqual(primera);
    expect(expedientes.actual().historial).toHaveLength(historialTrasPrimera);
    expect(evidencias.registros).toHaveLength(evidenciasTrasPrimera);
  });

  it("una operación cancelada corta el flujo y deja el pago en CANCELADO", async () => {
    const { deps, expedientes } = armar(
      expedienteListoParaPagar(),
      bancardFalso({ estadoTrasAcreditar: "CANCELADO" }),
    );

    await iniciarPagoP7(deps, ENTRADA_QR);
    const resultado = await confirmarPagoP7(deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });

    expect(resultado).toEqual({ ok: false, motivo: "PAGO_CANCELADO" });
    expect(expedientes.actual().estado).toBe("FIRMADO");
    expect(expedientes.actual().pago?.estado).toBe("CANCELADO");
  });

  it("sin operación abierta no hay nada que confirmar", async () => {
    const { deps } = armar(expedienteListoParaPagar());

    const resultado = await confirmarPagoP7(deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });

    expect(resultado).toEqual({ ok: false, motivo: "PAGO_NO_INICIADO" });
  });
});

// ---------------------------------------------------------------------------
// Fallas de Bancard
// ---------------------------------------------------------------------------

describe("P7 · fallas de Bancard", () => {
  function bancardQueFalla(motivo: "TIMEOUT" | "RECHAZADA"): PaymentProvider {
    const explotar = async () => {
      throw new ErrorBancard(motivo, "simulado");
    };
    return {
      iniciarPagoQr: explotar,
      iniciarPagoTarjetaDebito: explotar,
      iniciarPagoTarjetaCredito: explotar,
      consultarEstadoPago: async () => null,
      cancelarOLiberarReserva: vi.fn(),
    };
  }

  it("un timeout se traduce a BANCARD_NO_DISPONIBLE y no persiste ningún pago", async () => {
    const expedientes = repositorioFalso(expedienteListoParaPagar());
    const evidencias = evidenciasFalsas();

    const resultado = await iniciarPagoP7(
      { pagos: bancardQueFalla("TIMEOUT"), expedientes, evidencias, ahora: () => AHORA },
      ENTRADA_QR,
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.motivo).toBe("BANCARD_NO_DISPONIBLE");
    expect(expedientes.actual().pago).toBeNull();
    expect(evidencias.registros.at(-1)?.resultado).toBe("FALLIDO");
  });

  it("un rechazo se distingue del timeout", async () => {
    const expedientes = repositorioFalso(expedienteListoParaPagar());

    const resultado = await iniciarPagoP7(
      { pagos: bancardQueFalla("RECHAZADA"), expedientes, evidencias: evidenciasFalsas(), ahora: () => AHORA },
      ENTRADA_QR,
    );

    expect(resultado.ok === false && resultado.motivo).toBe("BANCARD_RECHAZO");
  });
});

// ---------------------------------------------------------------------------
// Evidencia (fila 31 de la matriz)
// ---------------------------------------------------------------------------

describe("P7 · evidencia", () => {
  it("registra ID, estado, importe y referencia de la operación Bancard", async () => {
    const { deps, evidencias } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);
    await confirmarPagoP7(deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });

    const inicio = evidencias.registros.find((r) => r.paso === PASO_EVIDENCIA_INICIO_P7);
    const confirmacion = evidencias.registros.find((r) => r.paso === PASO_EVIDENCIA_CONFIRMACION_P7);

    expect(inicio?.detalle).toContain(`montoGs=${PREMIO}`);
    expect(inicio?.detalle).toContain("referenciaBancard=REF-1");
    expect(inicio?.detalle).toContain(`propuesta=${NUMERO_PROPUESTA}`);
    // Este paso ya no acepta ningún literal: la declaración de origen lícito
    // se firmó con el FIPF, dos pasos antes (D-08).
    expect(inicio?.versionTextoAceptado).toBeNull();

    expect(confirmacion?.detalle).toContain("estadoPago=CONFIRMADO");
    expect(confirmacion?.textoAceptado).toBeNull();

    for (const registro of evidencias.registros) {
      expect(registro.ip).toBe(CONTEXTO.ip);
      expect(registro.dispositivo).toBe(CONTEXTO.dispositivo);
      expect(registro.sesionId).toBe(CONTEXTO.sesionId);
    }
  });
});

// ---------------------------------------------------------------------------
// CMP-08 · el medio de cobro se emite contra un documento con huella
// ---------------------------------------------------------------------------

describe("pago · el cobro se emite contra el documento firmado (CMP-08)", () => {
  it("no abre ninguna operación si el documento no tiene huella", async () => {
    // Con el paquete cerrado e inmutable esto no debería poder pasar nunca.
    // Que no deba es la razón de comprobarlo: si pasara, nada más lo notaría, y
    // se estaría cobrando por algo que no se puede probar qué es (fila 47).
    const sinHuella: Expediente = {
      ...expedienteListoParaPagar(),
      paqueteDocumental: { ...expedienteListoParaPagar().paqueteDocumental!, hashSha256: "" },
    };
    const { deps, bancard } = armar(sinHuella);

    const resultado = await iniciarPagoP7(deps, ENTRADA_QR);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("DOCUMENTO_SIN_HUELLA");
    expect(bancard.llamadas).toHaveLength(0);
  });

  it("la evidencia ata el medio de cobro a la huella del documento", async () => {
    const { deps, evidencias } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);

    const inicio = evidencias.registros.find((r) => r.paso === PASO_EVIDENCIA_INICIO_P7);
    expect(inicio?.detalle).toContain(`hashDocumento=${PAQUETE_FIXTURE.hashSha256}`);
  });

  it("cada regeneración queda asentada, con la misma huella", async () => {
    // Pedir un QR nuevo no transiciona ni cambia el documento: lo que cambia es
    // la operación en Bancard. Los dos registros comparten huella, que es lo
    // que prueba que se cobró siempre contra el mismo contrato.
    const { deps, evidencias } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);
    await iniciarPagoP7(deps, { ...ENTRADA_QR, medio: "TARJETA_CREDITO" });

    const inicios = evidencias.registros.filter((r) => r.paso === PASO_EVIDENCIA_INICIO_P7);
    expect(inicios).toHaveLength(2);
    expect(inicios[0].detalle).toContain("regeneracion=false");
    expect(inicios[1].detalle).toContain("regeneracion=true");
    for (const registro of inicios) {
      expect(registro.detalle).toContain(PAQUETE_FIXTURE.hashSha256);
    }
  });
});

// ---------------------------------------------------------------------------
// El plazo de 24 horas (D-10)
// ---------------------------------------------------------------------------

describe("pago · caducidad del expediente firmado sin pagar", () => {
  /** Un reloj después del plazo del fixture. */
  const VENCIDO = "2026-08-10T15:03:00.001Z";

  function armarConReloj(expediente: Expediente, ahora: string) {
    const base = armar(expediente);
    return { ...base, deps: { ...base.deps, ahora: () => ahora } };
  }

  it("cumplido el plazo el expediente vence y manda a Pantalla B", async () => {
    const entorno = armarConReloj(expedienteListoParaPagar(), VENCIDO);

    const resultado = await vencerPlazoPagoP7(entorno.deps, {
      expedienteId: "EXP-TEST-1",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.vencio).toBe(true);
    expect(entorno.expedientes.actual().estado).toBe("VENCIDO");
  });

  it("antes del plazo no vence nada", async () => {
    const entorno = armarConReloj(expedienteListoParaPagar(), AHORA);

    const resultado = await vencerPlazoPagoP7(entorno.deps, {
      expedienteId: "EXP-TEST-1",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.vencio).toBe(false);
    expect(entorno.expedientes.actual().estado).toBe("FIRMADO");
  });

  it("vencido no se puede abrir una operación en Bancard", async () => {
    const entorno = armarConReloj(expedienteListoParaPagar(), VENCIDO);

    const resultado = await iniciarPagoP7(entorno.deps, ENTRADA_QR);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("PLAZO_VENCIDO");
    expect(resultado.siguientePantalla).toBe(RUTA_PANTALLA_B);
    expect(entorno.bancard.llamadas).toHaveLength(0);
  });

  it("un pago ya acreditado no vence, aunque el reloj haya pasado", async () => {
    // El expediente salió de la ventana que caduca al cobrar: evaluar el plazo
    // sobre él solo abriría una carrera contra la escritura recién hecha.
    const entorno = armar(expedienteListoParaPagar());
    await iniciarPagoP7(entorno.deps, ENTRADA_QR);
    await confirmarPagoP7(entorno.deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });

    const tarde = armarConReloj(entorno.expedientes.actual(), VENCIDO);
    const resultado = await confirmarPagoP7(tarde.deps, {
      expedienteId: "EXP-TEST-1",
      contexto: CONTEXTO,
    });

    expect(resultado).toMatchObject({ ok: true, confirmado: true });
    expect(tarde.expedientes.actual().estado).toBe("PAGO_CONFIRMADO");
  });

  it("deja evidencia del vencimiento y de que no hubo cobro que deshacer", async () => {
    const entorno = armarConReloj(expedienteListoParaPagar(), VENCIDO);

    await vencerPlazoPagoP7(entorno.deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });

    const registro = entorno.evidencias.registros.find(
      (evidencia) => evidencia.paso === PASO_EVIDENCIA_VENCIMIENTO_P7,
    );
    expect(registro?.resultado).toBe("FALLIDO");
    // Con el pago después de la firma (D-08) el expediente vence sin haber
    // cobrado nunca: no hay premio que devolver ni reserva que liberar.
    expect(registro?.detalle).toContain("consecuencia=CADUCIDAD_SIN_COBRO");
  });
});

// ---------------------------------------------------------------------------
// Lectura para la pantalla
// ---------------------------------------------------------------------------

describe("P7 · resumen para la pantalla", () => {
  it("devuelve el nombre del asegurado, el premio y el plazo para pagar", () => {
    const resumen = leerResumenPagoP7(expedienteListoParaPagar());

    expect(resumen).toMatchObject({
      nombreAFacturar: "Mónica Mariana Gorena Tapia",
      montoGs: PREMIO,
      medio: null,
      cobrado: false,
      // CHG-34 · la identificación que viaja si el RUC queda vacío, dicha y
      // enmascarada: la caída ya existía, lo que faltaba era mostrarla.
      identificacionFiscalPorDefecto: "Cédula 93•••••",
      // D-10 · la cuenta regresiva de la pantalla sale de acá.
      plazoPagoVenceEn: PLAZO_PAGO_FIJO,
    });
  });

  it("devuelve null para un expediente que todavía no firmó", () => {
    const sinFirmar: Expediente = { ...expedienteListoParaPagar(), estado: "DECLARACIONES_OK" };
    expect(leerResumenPagoP7(sinFirmar)).toBeNull();
  });
});
