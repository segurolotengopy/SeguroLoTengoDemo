/**
 * Tests del caso de uso de P7.
 *
 * Tres cosas se prueban con más insistencia que el resto, porque son controles
 * de la matriz de cumplimiento y no meras validaciones de formulario:
 *
 * - **Fila 32 (idempotencia)** — un reintento del mismo intento reutiliza la
 *   clave y no abre una segunda operación en Bancard; un intento distinto
 *   (otro medio, o después de una cancelación) sí genera una clave nueva.
 * - **Fila 16 (origen de fondos)** — la declaración es bloqueante y corta
 *   *antes* de tocar al proveedor.
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
import { transicionarExpediente } from "../expediente";
import {
  PASO_EVIDENCIA_CONFIRMACION_P7,
  PASO_EVIDENCIA_INICIO_P7,
  PLAZO_FIRMA_MS,
  confirmarPagoP7,
  generarNumeroPropuesta,
  iniciarPagoP7,
  leerResumenPagoP7,
  normalizarRuc,
} from "../pago-p7";
import { VERSION_DECLARACION_ORIGEN_LICITO } from "../textos-p7";
import type { EstadoPago, Expediente, MedioDePago, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal";
import {
  avanzarHastaIdentidadVerificada,
  crearExpediente,
  datosComplementariosFixture,
  declaracionesCompatibles,
} from "./fixtures";

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
function expedienteListoParaPagar(): Expediente {
  const base = avanzarHastaIdentidadVerificada(crearExpediente());
  const conIdentidad: Expediente = {
    ...base,
    plan: {
      planId: "CONFIO_PLUS",
      premioAnualGs: PREMIO,
      idVersionOferta: "OFERTA-CONFIO-v1",
      hashOfertaSha256: "hash-de-prueba",
      seleccionadoEn: AHORA,
    },
    identidad: {
      numeroCedula: "9323336",
      nombres: "Mónica Mariana",
      apellidos: "Gorena Tapia",
      fechaNacimiento: "1990-04-17",
      sexo: "F",
      nacionalidad: "Paraguaya",
      paisNacimiento: "Paraguay",
      estadoCivil: "Soltera",
      captura: {
        hashFrenteCedula: "a",
        hashDorsoCedula: "b",
        hashSelfie: "c",
        pruebaDeVidaAprobada: true,
        coincidenciaFacialAprobada: true,
      },
    },
  };

  const transicion = transicionarExpediente(conIdentidad, "DECLARACIONES_OK", {
    declaraciones: declaracionesCompatibles,
    datosComplementarios: datosComplementariosFixture,
  });
  if (!transicion.ok) throw new Error(transicion.error);
  return transicion.expediente;
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
      nuevoNumeroPropuesta: () => NUMERO_PROPUESTA,
    },
  };
}

const ENTRADA_QR = {
  expedienteId: "EXP-TEST-1",
  medio: "QR_BANCARD" as const,
  ruc: "",
  origenLicitoDeFondos: true,
  contexto: CONTEXTO,
};

// ---------------------------------------------------------------------------
// Origen lícito de fondos — bloqueante
// ---------------------------------------------------------------------------

describe("P7 · declaración de origen lícito de fondos", () => {
  it("sin la declaración no se abre ninguna operación en Bancard", async () => {
    const { deps, bancard, expedientes } = armar(expedienteListoParaPagar());

    const resultado = await iniciarPagoP7(deps, { ...ENTRADA_QR, origenLicitoDeFondos: false });

    expect(resultado).toEqual({ ok: false, motivo: "ORIGEN_FONDOS_NO_DECLARADO" });
    expect(bancard.llamadas).toHaveLength(0);
    expect(expedientes.actual().pago).toBeNull();
  });

  it("un valor que no sea exactamente `true` tampoco alcanza", async () => {
    const { deps, bancard } = armar(expedienteListoParaPagar());

    for (const valor of ["true", 1, {}, null, undefined]) {
      const resultado = await iniciarPagoP7(deps, { ...ENTRADA_QR, origenLicitoDeFondos: valor });
      expect(resultado.ok).toBe(false);
    }
    expect(bancard.llamadas).toHaveLength(0);
  });

  it("el rechazo deja evidencia, para que quede el intento asentado", async () => {
    const { deps, evidencias } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, { ...ENTRADA_QR, origenLicitoDeFondos: false });

    expect(evidencias.registros).toHaveLength(1);
    expect(evidencias.registros[0].paso).toBe(PASO_EVIDENCIA_INICIO_P7);
    expect(evidencias.registros[0].resultado).toBe("FALLIDO");
  });

  it("al aceptarla se persiste versionada y con el literal íntegro", async () => {
    const { deps, expedientes } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);

    const declaracion = expedientes.actual().facturacion?.declaracionOrigenLicito;
    expect(declaracion?.versionTexto).toBe(VERSION_DECLARACION_ORIGEN_LICITO);
    expect(declaracion?.textoAceptado).toContain("origen lícito");
    expect(declaracion?.aceptadaEn).toBe(AHORA);
    expect(declaracion?.ip).toBe(CONTEXTO.ip);
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

  it("acuña el correlativo de la propuesta y no lo vuelve a cambiar", async () => {
    const { deps, expedientes } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);
    expect(expedientes.actual().numeroPropuesta).toBe(NUMERO_PROPUESTA);

    // Cambiar de medio abre otro intento, pero el correlativo es el mismo.
    await iniciarPagoP7(deps, { ...ENTRADA_QR, medio: "TARJETA_CREDITO" });
    expect(expedientes.actual().numeroPropuesta).toBe(NUMERO_PROPUESTA);
  });

  it("genera correlativos de ocho dígitos", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(generarNumeroPropuesta()).toMatch(/^\d{8}$/);
    }
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
    expect(expedientes.actual().estado).toBe("DECLARACIONES_OK");
    expect(evidencias.registros).toHaveLength(registrosTrasIniciar);
  });

  it("con el QR acreditado transiciona a PAGO_CONFIRMADO y arranca las 24 horas", async () => {
    const { deps, expedientes } = armar(expedienteListoParaPagar());

    await iniciarPagoP7(deps, ENTRADA_QR);
    const resultado = await confirmarPagoP7(deps, { expedienteId: "EXP-TEST-1", contexto: CONTEXTO });

    expect(resultado).toMatchObject({
      ok: true,
      confirmado: true,
      estado: "PAGO_CONFIRMADO",
      siguientePantalla: "/firma",
    });

    const guardado = expedientes.actual();
    expect(guardado.pago?.estado).toBe("CONFIRMADO");
    expect(guardado.pago?.confirmadoEn).toBe(AHORA);
    expect(guardado.plazoFirmaVenceEn).toBe(
      new Date(new Date(AHORA).getTime() + PLAZO_FIRMA_MS).toISOString(),
    );
  });

  it("el débito confirma igual que el QR: es pago definitivo antes de la firma", async () => {
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
    expect(expedientes.actual().estado).toBe("DECLARACIONES_OK");
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
    expect(inicio?.versionTextoAceptado).toBe(VERSION_DECLARACION_ORIGEN_LICITO);

    expect(confirmacion?.detalle).toContain("estadoPago=CONFIRMADO");
    expect(confirmacion?.detalle).toContain("plazoFirmaVenceEn=");
    // La evidencia de la confirmación no acepta nada: no hay literal nuevo.
    expect(confirmacion?.textoAceptado).toBeNull();

    for (const registro of evidencias.registros) {
      expect(registro.ip).toBe(CONTEXTO.ip);
      expect(registro.dispositivo).toBe(CONTEXTO.dispositivo);
      expect(registro.sesionId).toBe(CONTEXTO.sesionId);
    }
  });
});

// ---------------------------------------------------------------------------
// Lectura para la pantalla
// ---------------------------------------------------------------------------

describe("P7 · resumen para la pantalla", () => {
  it("devuelve el nombre del asegurado y el premio persistido", () => {
    const resumen = leerResumenPagoP7(expedienteListoParaPagar());

    expect(resumen).toMatchObject({
      nombreAFacturar: "Mónica Mariana Gorena Tapia",
      montoGs: PREMIO,
      medio: null,
      garantiaLista: false,
    });
  });

  it("devuelve null para un expediente que todavía no llegó a P7", () => {
    expect(leerResumenPagoP7(avanzarHastaIdentidadVerificada(crearExpediente()))).toBeNull();
  });
});
