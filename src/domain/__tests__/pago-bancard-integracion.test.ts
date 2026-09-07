/**
 * La parte de Bancard, de punta a punta: **el dominio contra el adaptador
 * real**, no contra un doble escrito a mano.
 *
 * ## Por qué existe si `pago-p7.test.ts` ya prueba P7
 *
 * Aquel archivo usa un `PaymentProvider` falso definido en el propio test. Eso
 * está bien para aislar las reglas del caso de uso, y tiene un punto ciego
 * grande: **un doble que el mismo test escribe siempre está de acuerdo con lo
 * que el test espera**. Si el dominio y el adaptador se desalinean —el dominio
 * pide un estado que el adaptador nunca produce, o el adaptador cambia una
 * garantía de idempotencia— los dos archivos siguen en verde.
 *
 * Acá se cablea `crearPaymentProviderMock`, que es el adaptador que corre en la
 * demostración, y se verifica el resultado **mirando las operaciones que quedan
 * de su lado** (`listarOperacionesMock`), no solo la respuesta del caso de uso.
 * Es la pregunta que ninguno de los dos archivos anteriores contesta: *¿lo que
 * el expediente dice que pasó es lo que le pasó a la operación en Bancard?*
 *
 * ## Es agnóstico de la versión del flujo
 *
 * v2 (`/pago`) y v3 (`/pago-y-firma`) comparten este dominio, esta API y este
 * adaptador — la pantalla de v3 monta el mismo `FormularioPagoP7`. Así que lo
 * que se prueba acá vale para las dos, y no hay que duplicarlo cuando se apague
 * `FLUJO_V3`.
 *
 * ## Qué cubre
 *
 * Los cinco desenlaces que Bancard documenta, y los dos huecos que la segunda
 * ronda de respuestas destrabó:
 *
 * - el cobro que entra (QR y tarjeta), con su certificado;
 * - la idempotencia del intento (fila 32: no cobrar dos veces);
 * - el timeout, y el reintento que no abre una segunda operación;
 * - **G2** · el rechazo, y que el reintento abra una operación **nueva**
 *   (B10: el `shop_process_id` se quema con el intento aunque falle);
 * - **G1** · el vencimiento, que apaga la operación abierta (B4-bis), y el
 *   cambio de medio, que apaga la que queda huérfana;
 * - el TTL propio del QR, que el proveedor no puede hacer cumplir (B5-bis).
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  VIGENCIA_QR_MINUTOS,
  crearPaymentProviderMock,
  limpiarOperacionesMock,
  listarOperacionesMock,
} from "../../adapters/mock/payment-provider";
import type { FallaBancardDemo, OperacionMock } from "../../adapters/mock/payment-provider";
import type { EvidenceStore } from "../../ports/evidence-store";
import {
  PASO_EVIDENCIA_REVERSA_P7,
  confirmarPagoP7,
  iniciarPagoP7,
  vencerPlazoPagoP7,
} from "../pago-p7";
import type { DependenciasP7 } from "../pago-p7";
import type { Expediente, MedioDePago, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal";
import { emisorCertificadoFalso, expedienteFirmado } from "./fixtures";

// ---------------------------------------------------------------------------
// Cableado
// ---------------------------------------------------------------------------

const EXPEDIENTE_ID = "EXP-BANCARD-1";

/** Un instante antes del plazo del fixture, y otro después. */
const ANTES_DEL_PLAZO = "2026-08-09T15:10:00.000Z";
const DESPUES_DEL_PLAZO = "2026-08-10T15:03:00.001Z";

/**
 * Demora de acreditación que hace que el mock **no acredite solo**.
 *
 * Es lo que usa la demostración desplegada
 * (`DEMORA_ACREDITACION_SOLO_POR_BOTON_MS`): el dinero entra cuando alguien lo
 * paga, no cuando pasa el tiempo. Los escenarios de vencimiento la necesitan,
 * porque con la acreditación por reloj encendida adelantar hasta el plazo
 * acredita el pago de paso, y entonces lo que se prueba ya no es "venció sin
 * pagar" sino el caso de borde de más abajo.
 */
const SIN_ACREDITACION_AUTOMATICA_MS = 365 * 24 * 60 * 60 * 1000;

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (integracion)",
  sesionId: "sesion-bancard",
};

function repositorioEnMemoria(inicial: Expediente): RepositorioExpediente & {
  actual: () => Expediente;
  /** Cuántas veces se escribió. Un sondeo que escribe de más se ve acá. */
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
    async guardar(expediente) {
      escrituras += 1;
      guardado = expediente;
    },
    actual: () => guardado,
    escrituras: () => escrituras,
  };
}

function evidenciasEnMemoria(): EvidenceStore & { registros: RegistroEvidencia[] } {
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
 * Arma el paso de pago con el **adaptador de verdad**.
 *
 * El reloj es movible y compartido entre el dominio y el adaptador: los dos
 * tienen que estar mirando la misma hora, o el vencimiento del expediente y el
 * del QR se evaluarían contra relojes distintos, que es precisamente la clase
 * de desalineación que este archivo busca.
 */
function armar(
  opciones: {
    readonly falla?: FallaBancardDemo | null;
    /**
     * Cuánto tarda la operación en acreditarse sola, en el reloj del mock.
     *
     * Por defecto un minuto, para poder acreditar adelantando el reloj. Los
     * escenarios de vencimiento la pasan **más larga que el plazo**, que es lo
     * que hace la demostración desplegada (`DEMORA_ACREDITACION_SOLO_POR_BOTON_MS`):
     * si no, el mock acredita solo antes de que la reversa llegue y el
     * escenario deja de ser "venció sin pagar" para ser otro.
     */
    readonly demoraAcreditacionMs?: number;
  } = {},
) {
  let instante = new Date(ANTES_DEL_PLAZO);
  let fallaPendiente = opciones.falla ?? null;

  const expedientes = repositorioEnMemoria(expedienteFirmado(EXPEDIENTE_ID));
  const evidencias = evidenciasEnMemoria();

  const pagos = crearPaymentProviderMock({
    ahora: () => instante,
    // Los tests no esperan de verdad: la demora simula el ida y vuelta HTTP.
    demoraGeneracionMs: 0,
    // La acreditación no llega sola. La dispara el reloj cuando el test lo
    // adelanta, igual que en la demostración la dispara la persona.
    demoraAcreditacionMs: opciones.demoraAcreditacionMs ?? 60_000,
    // Las palancas del panel se consumen en un solo intento, como en el panel.
    fallaForzada: () => {
      const actual = fallaPendiente;
      fallaPendiente = null;
      return actual;
    },
  });

  let contadorId = 0;
  const deps: DependenciasP7 = {
    pagos,
    expedientes,
    evidencias,
    // El certificado no es la parte de Bancard: se cablea el emisor falso de
    // los fixtures, que ya tiene su propia batería en `documentos/__tests__`.
    // Lo que este archivo verifica de él es solo que se emita, o no, según el
    // cobro (D-12 / CMP-07).
    emitirCertificado: emisorCertificadoFalso(),
    ahora: () => instante.toISOString(),
    nuevoId: () => {
      contadorId += 1;
      return `id-${contadorId}`;
    },
  };

  return {
    deps,
    expedientes,
    evidencias,
    pagos,
    avanzarReloj: (ms: number) => {
      instante = new Date(instante.getTime() + ms);
    },
    fijarReloj: (iso: string) => {
      instante = new Date(iso);
    },
  };
}

function entrada(medio: MedioDePago) {
  return {
    expedienteId: EXPEDIENTE_ID,
    medio,
    ruc: "",
    aceptaCertificadoYEntrega: true,
    contexto: CONTEXTO,
  };
}

/** Lo que quedó del lado de Bancard, que es lo que este archivo mira. */
function operacionesDeBancard(): readonly Readonly<OperacionMock>[] {
  return listarOperacionesMock();
}

function operacion(referenciaBancard: string): Readonly<OperacionMock> {
  const encontrada = operacionesDeBancard().find(
    (op) => op.referenciaBancard === referenciaBancard,
  );
  if (!encontrada) throw new Error(`Bancard no conoce la operación ${referenciaBancard}.`);
  return encontrada;
}

afterEach(() => {
  // El adaptador guarda las operaciones a nivel de módulo, como en el proceso
  // real: sin esto un test vería las operaciones del anterior.
  limpiarOperacionesMock();
});

// ---------------------------------------------------------------------------
// El cobro que entra
// ---------------------------------------------------------------------------

describe("Bancard · el cobro que entra", () => {
  it("abre un QR pendiente, lo acredita y emite el certificado en la misma escritura", async () => {
    const t = armar();

    const inicio = await iniciarPagoP7(t.deps, entrada("QR_BANCARD"));
    expect(inicio.ok).toBe(true);
    if (!inicio.ok) return;
    // El QR viaja en EMVCo, que es lo que lee una app de banco.
    expect(inicio.instruccion).toMatchObject({ tipo: "QR" });
    expect(operacion(inicio.referenciaBancard).estado).toBe("PENDIENTE");

    // Todavía no pagó: el sondeo no escribe nada.
    const sondeoTemprano = await confirmarPagoP7(t.deps, {
      expedienteId: EXPEDIENTE_ID,
      contexto: CONTEXTO,
    });
    expect(sondeoTemprano).toMatchObject({ ok: true, confirmado: false });

    t.avanzarReloj(60_000);
    const confirmado = await confirmarPagoP7(t.deps, {
      expedienteId: EXPEDIENTE_ID,
      contexto: CONTEXTO,
    });

    expect(confirmado).toMatchObject({ ok: true, confirmado: true });
    expect(t.expedientes.actual().estado).toBe("PAGO_CONFIRMADO");
    // D-12 / CMP-07 · no existe un expediente cobrado sin certificado.
    expect(t.expedientes.actual().certificadoCobertura).not.toBeNull();
    expect(operacion(inicio.referenciaBancard).estado).toBe("CONFIRMADO");
  });

  it("cobra igual con tarjeta, y por el formulario seguro de Bancard", async () => {
    const t = armar();

    const inicio = await iniciarPagoP7(t.deps, entrada("TARJETA_DEBITO"));
    expect(inicio.ok).toBe(true);
    if (!inicio.ok) return;
    // Regla inviolable #6: lo único que baja para tarjeta es una URL.
    expect(inicio.instruccion).toMatchObject({ tipo: "FORMULARIO_SEGURO" });

    t.avanzarReloj(60_000);
    await confirmarPagoP7(t.deps, { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO });

    expect(t.expedientes.actual().estado).toBe("PAGO_CONFIRMADO");
  });
});

// ---------------------------------------------------------------------------
// Idempotencia — fila 32
// ---------------------------------------------------------------------------

describe("Bancard · un intento, un cobro", () => {
  it("dos toques del mismo botón abren una sola operación del lado de Bancard", async () => {
    const t = armar();

    const primero = await iniciarPagoP7(t.deps, entrada("QR_BANCARD"));
    const segundo = await iniciarPagoP7(t.deps, entrada("QR_BANCARD"));

    expect(primero.ok && segundo.ok).toBe(true);
    if (!primero.ok || !segundo.ok) return;
    expect(segundo.referenciaBancard).toBe(primero.referenciaBancard);
    // La garantía no es que el dominio devuelva lo mismo: es que Bancard tenga
    // una sola operación. Eso solo se ve mirando el adaptador.
    expect(operacionesDeBancard()).toHaveLength(1);
  });

  it("tras un timeout, el reintento con la misma clave sigue abriendo una sola", async () => {
    // El caso que justifica la clave: el timeout deja al llamador sin saber si
    // Bancard alcanzó a crear la operación.
    const t = armar({ falla: "TIMEOUT" });

    const fallido = await iniciarPagoP7(t.deps, entrada("QR_BANCARD"));
    expect(fallido).toMatchObject({ ok: false, motivo: "BANCARD_NO_DISPONIBLE" });
    expect(operacionesDeBancard()).toHaveLength(0);

    const reintento = await iniciarPagoP7(t.deps, entrada("QR_BANCARD"));
    const otroMas = await iniciarPagoP7(t.deps, entrada("QR_BANCARD"));

    expect(reintento.ok && otroMas.ok).toBe(true);
    expect(operacionesDeBancard()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// G2 · el rechazo
// ---------------------------------------------------------------------------

describe("Bancard · G2 · un intento rechazado deja reintentar", () => {
  it("el sondeo asienta RECHAZADO con el código del proveedor y no cobra", async () => {
    const t = armar({ falla: "RECHAZO_AL_CONFIRMAR" });

    const inicio = await iniciarPagoP7(t.deps, entrada("TARJETA_DEBITO"));
    expect(inicio.ok).toBe(true);
    if (!inicio.ok) return;

    t.avanzarReloj(60_000);
    const sondeo = await confirmarPagoP7(t.deps, {
      expedienteId: EXPEDIENTE_ID,
      contexto: CONTEXTO,
    });

    // `51` es el que usa el propio documento de Bancard en su ejemplo de
    // rechazo, y sube hasta la pantalla porque la razón la pone el proveedor.
    expect(sondeo).toMatchObject({ ok: false, motivo: "BANCARD_RECHAZO", codigoRespuesta: "51" });
    expect(t.expedientes.actual().pago?.estado).toBe("RECHAZADO");
    // Lo que fracasó es el cobro, no el contrato.
    expect(t.expedientes.actual().estado).toBe("FIRMADO");
    expect(t.expedientes.actual().certificadoCobertura).toBeNull();
  });

  it("el reintento abre una operación NUEVA en Bancard, no reabre la quemada", async () => {
    // Es el punto de G2. B10: el `shop_process_id` queda registrado aunque el
    // intento falle, así que reabrirlo no podría prosperar.
    const t = armar({ falla: "RECHAZO_AL_CONFIRMAR" });

    const primero = await iniciarPagoP7(t.deps, entrada("TARJETA_DEBITO"));
    expect(primero.ok).toBe(true);
    if (!primero.ok) return;
    t.avanzarReloj(60_000);
    await confirmarPagoP7(t.deps, { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO });

    const reintento = await iniciarPagoP7(t.deps, entrada("TARJETA_DEBITO"));

    expect(reintento.ok).toBe(true);
    if (!reintento.ok) return;
    expect(reintento.referenciaBancard).not.toBe(primero.referenciaBancard);
    expect(operacionesDeBancard()).toHaveLength(2);
    // Y la rechazada sigue rechazada: reintentar no la resucita.
    expect(operacion(primero.referenciaBancard).estado).toBe("RECHAZADO");
  });

  it("sondear de nuevo un rechazo no vuelve a escribir ni a duplicar la evidencia", async () => {
    // No es prolijidad: la pantalla habilita el botón apenas ve el rechazo, y
    // un sondeo en vuelo que escribiera entre la lectura y la escritura de
    // `iniciarPagoP7` le hace perder el bloqueo optimista. Como abrir un pago
    // **no** se reintenta a propósito, el resultado era un
    // `CONFLICTO_CONCURRENCIA` que dejaba a la persona sin poder pagar justo
    // después de decirle que podía. Lo encontró el E2E de v3 (2 de 2 corridas).
    const t = armar({ falla: "RECHAZO_AL_CONFIRMAR" });
    await iniciarPagoP7(t.deps, entrada("TARJETA_DEBITO"));
    t.avanzarReloj(60_000);

    await confirmarPagoP7(t.deps, { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO });
    const escriturasTrasElPrimero = t.expedientes.escrituras();
    const versionTrasElPrimero = t.expedientes.actual().actualizadoEn;

    const segundo = await confirmarPagoP7(t.deps, {
      expedienteId: EXPEDIENTE_ID,
      contexto: CONTEXTO,
    });

    // Devuelve lo mismo, con el código del proveedor…
    expect(segundo).toMatchObject({ ok: false, motivo: "BANCARD_RECHAZO", codigoRespuesta: "51" });
    // …y no toca nada.
    expect(t.expedientes.escrituras()).toBe(escriturasTrasElPrimero);
    expect(t.expedientes.actual().actualizadoEn).toBe(versionTrasElPrimero);
    // La fila 31 pide constancia del rechazo, no una por cada vez que la
    // pantalla preguntó.
    const rechazos = t.evidencias.registros.filter((evidencia) =>
      evidencia.detalle.includes("estadoPago=RECHAZADO"),
    );
    expect(rechazos).toHaveLength(1);
  });

  it("el segundo intento sí puede cobrar", async () => {
    // La palanca se consume en el primer intento, así que el reintento pasa —
    // que es exactamente lo que la demostración tiene que poder mostrar.
    const t = armar({ falla: "RECHAZO_AL_CONFIRMAR" });

    await iniciarPagoP7(t.deps, entrada("TARJETA_DEBITO"));
    t.avanzarReloj(60_000);
    await confirmarPagoP7(t.deps, { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO });

    await iniciarPagoP7(t.deps, entrada("TARJETA_DEBITO"));
    t.avanzarReloj(60_000);
    const segundo = await confirmarPagoP7(t.deps, {
      expedienteId: EXPEDIENTE_ID,
      contexto: CONTEXTO,
    });

    expect(segundo).toMatchObject({ ok: true, confirmado: true });
    expect(t.expedientes.actual().estado).toBe("PAGO_CONFIRMADO");
  });
});

// ---------------------------------------------------------------------------
// G1 · la operación no sobrevive al expediente
// ---------------------------------------------------------------------------

describe("Bancard · G1 · toda operación que el expediente deja de mirar se apaga", () => {
  it("al vencer el plazo, el QR abierto queda CANCELADO en Bancard", async () => {
    // Sin esto el QR viviría 3 días (B5) sobre un expediente terminal: dinero
    // cobrado sin contrato vigente.
    const t = armar({ demoraAcreditacionMs: SIN_ACREDITACION_AUTOMATICA_MS });
    const inicio = await iniciarPagoP7(t.deps, entrada("QR_BANCARD"));
    expect(inicio.ok).toBe(true);
    if (!inicio.ok) return;

    t.fijarReloj(DESPUES_DEL_PLAZO);
    const vencimiento = await vencerPlazoPagoP7(t.deps, {
      expedienteId: EXPEDIENTE_ID,
      contexto: CONTEXTO,
    });

    expect(vencimiento).toMatchObject({ ok: true, vencio: true });
    expect(t.expedientes.actual().estado).toBe("VENCIDO");
    // La verificación que importa: no que el expediente lo diga, sino que la
    // operación esté apagada del otro lado.
    expect(operacion(inicio.referenciaBancard).estado).toBe("CANCELADO");
    expect(t.expedientes.actual().pago?.estado).toBe("CANCELADO");
  });

  it("deja evidencia de la reversa, con el motivo y la referencia", async () => {
    const t = armar({ demoraAcreditacionMs: SIN_ACREDITACION_AUTOMATICA_MS });
    const inicio = await iniciarPagoP7(t.deps, entrada("QR_BANCARD"));
    if (!inicio.ok) return;

    t.fijarReloj(DESPUES_DEL_PLAZO);
    await vencerPlazoPagoP7(t.deps, { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO });

    const registro = t.evidencias.registros.find(
      (evidencia) => evidencia.paso === PASO_EVIDENCIA_REVERSA_P7,
    );
    expect(registro?.resultado).toBe("EXITOSO");
    expect(registro?.detalle).toContain("motivoReversa=VENCIMIENTO_EXPEDIENTE");
    expect(registro?.detalle).toContain(`referenciaBancard=${inicio.referenciaBancard}`);
    // No hubo dinero adentro: el expediente vence antes de cobrar (D-08).
    expect(registro?.detalle).toContain("dineroDevuelto=false");
  });

  it("cambiar de medio apaga la operación anterior y deja viva solo la nueva", async () => {
    // `Expediente.pago` guarda un solo intento: sin esto, el QR anterior queda
    // huérfano y pagable, y la persona podría pagar dos veces.
    const t = armar({ demoraAcreditacionMs: SIN_ACREDITACION_AUTOMATICA_MS });
    const qr = await iniciarPagoP7(t.deps, entrada("QR_BANCARD"));
    expect(qr.ok).toBe(true);
    if (!qr.ok) return;

    const tarjeta = await iniciarPagoP7(t.deps, entrada("TARJETA_CREDITO"));
    expect(tarjeta.ok).toBe(true);
    if (!tarjeta.ok) return;

    expect(operacion(qr.referenciaBancard).estado).toBe("CANCELADO");
    expect(operacion(tarjeta.referenciaBancard).estado).toBe("PENDIENTE");
  });

  it("si el pago entró justo antes de la reversa, se devuelve y queda asentado", async () => {
    // La franja que no se puede cerrar —son dos sistemas— pero sí detectar. La
    // produce el adaptador real solo: con la acreditación automática encendida,
    // el reloj del vencimiento ya pasó también el de la acreditación, así que
    // cuando la reversa llega el dinero está adentro y lo que hace es
    // devolverlo. Es raro en producción y tiene que poder encontrarse después.
    const t = armar();
    const inicio = await iniciarPagoP7(t.deps, entrada("QR_BANCARD"));
    if (!inicio.ok) return;

    t.fijarReloj(DESPUES_DEL_PLAZO);
    await vencerPlazoPagoP7(t.deps, { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO });

    expect(operacion(inicio.referenciaBancard).estado).toBe("DEVUELTO");
    expect(t.expedientes.actual().pago?.estado).toBe("DEVUELTO");
    const registro = t.evidencias.registros.find(
      (evidencia) => evidencia.paso === PASO_EVIDENCIA_REVERSA_P7,
    );
    // FALLIDO aunque la llamada funcionó: lo que falló es el desenlace.
    expect(registro?.resultado).toBe("FALLIDO");
    expect(registro?.detalle).toContain("dineroDevuelto=true");
  });

  it("un QR ya vencido por su propio plazo no se puede pagar después", async () => {
    // El TTL de 15 minutos es política nuestra: el proveedor no la puede hacer
    // cumplir, porque su QR vive 3 días fijos (B5-bis).
    const t = armar({ demoraAcreditacionMs: SIN_ACREDITACION_AUTOMATICA_MS });
    const inicio = await iniciarPagoP7(t.deps, entrada("QR_BANCARD"));
    if (!inicio.ok) return;

    t.avanzarReloj((VIGENCIA_QR_MINUTOS + 1) * 60_000);
    const sondeo = await confirmarPagoP7(t.deps, {
      expedienteId: EXPEDIENTE_ID,
      contexto: CONTEXTO,
    });

    expect(sondeo).toMatchObject({ ok: false, motivo: "PAGO_CANCELADO" });
    expect(t.expedientes.actual().estado).toBe("FIRMADO");
  });
});
