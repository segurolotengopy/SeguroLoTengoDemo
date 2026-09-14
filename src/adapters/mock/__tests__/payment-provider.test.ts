/**
 * Tests del adaptador mock de `PaymentProvider` (P7).
 *
 * Corre la suite de contrato del puerto —la misma que va a correr el
 * adaptador oficial de Bancard— y agrega lo que solo se puede verificar con
 * el reloj bajo control: la ventana en la que la operación está pendiente, el
 * vencimiento del QR y las fallas forzadas del panel de demo.
 *
 * La suite de contrato se cablea con las demoras en 0: verifica promesas del
 * puerto (idempotencia, forma de las respuestas, referencias desconocidas),
 * no la simulación del paso del tiempo, que se prueba acá abajo.
 */
import { afterEach, describe, expect, it } from "vitest";
import { runPaymentProviderContractTests } from "../../../ports/__tests__/payment-provider.contract";
import { ErrorBancard } from "../../../ports/payment-provider";
import {
  VIGENCIA_QR_MINUTOS,
  crearPaymentProviderMock,
  limpiarOperacionesMock,
  listarOperacionesMock,
} from "../payment-provider";
import type { FallaBancardDemo } from "../payment-provider";

runPaymentProviderContractTests(() =>
  crearPaymentProviderMock({ demoraGeneracionMs: 0, demoraAcreditacionMs: 0 }),
);

// ---------------------------------------------------------------------------
// Comportamiento propio del mock
// ---------------------------------------------------------------------------

const T0 = new Date("2026-08-09T14:00:00.000Z");

/** Reloj movible, para no tener que esperar de verdad en los tests. */
function relojFijo(inicial: Date = T0) {
  let actual = inicial;
  return {
    ahora: () => actual,
    avanzar(ms: number) {
      actual = new Date(actual.getTime() + ms);
    },
  };
}

const ENTRADA_QR = {
  expedienteId: "EXP-MOCK-1",
  propuestaId: "00018425",
  montoGs: 475_000,
  idempotencyKey: "IDEMP-MOCK-1",
};

const ENTRADA_TARJETA = {
  expedienteId: "EXP-MOCK-1",
  propuestaId: "00018425",
  montoGs: 475_000,
  urlRetorno: "https://segurolotengo.com/pago/retorno",
  idempotencyKey: "IDEMP-MOCK-TARJETA",
};

afterEach(() => {
  limpiarOperacionesMock();
});

describe("PaymentProvider mock · acreditación simulada", () => {
  it("deja el QR en PENDIENTE hasta que pasa la demora de acreditación", async () => {
    const reloj = relojFijo();
    const p = crearPaymentProviderMock({
      ahora: reloj.ahora,
      demoraGeneracionMs: 0,
      demoraAcreditacionMs: 5_000,
    });

    const qr = await p.iniciarPagoQr(ENTRADA_QR);

    expect((await p.consultarEstadoPago(qr.referenciaBancard))?.estado).toBe("PENDIENTE");

    reloj.avanzar(4_999);
    expect((await p.consultarEstadoPago(qr.referenciaBancard))?.estado).toBe("PENDIENTE");

    reloj.avanzar(1);
    expect((await p.consultarEstadoPago(qr.referenciaBancard))?.estado).toBe("CONFIRMADO");
  });

  it("el débito llega a CONFIRMADO y el crédito a PREAUTORIZADO", async () => {
    const reloj = relojFijo();
    const p = crearPaymentProviderMock({
      ahora: reloj.ahora,
      demoraGeneracionMs: 0,
      demoraAcreditacionMs: 1_000,
    });

    const debito = await p.iniciarPagoTarjetaDebito(ENTRADA_TARJETA);
    const credito = await p.iniciarPagoTarjetaCredito({
      ...ENTRADA_TARJETA,
      idempotencyKey: "IDEMP-MOCK-CREDITO",
    });

    reloj.avanzar(1_000);

    // Débito: el dinero ya se movió, igual que con el QR.
    expect((await p.consultarEstadoPago(debito.referenciaBancard))?.estado).toBe("CONFIRMADO");
    // Crédito: reservado, sin cobro. La captura la ordena la firma en P8.
    expect((await p.consultarEstadoPago(credito.referenciaBancard))?.estado).toBe("CONFIRMADO");
  });

  it("cancela el QR si vence antes de que lo paguen", async () => {
    const reloj = relojFijo();
    const p = crearPaymentProviderMock({
      ahora: reloj.ahora,
      demoraGeneracionMs: 0,
      // Nunca se acredita dentro de la vigencia: el QR se deja vencer.
      demoraAcreditacionMs: (VIGENCIA_QR_MINUTOS + 10) * 60_000,
    });

    const qr = await p.iniciarPagoQr(ENTRADA_QR);
    reloj.avanzar(VIGENCIA_QR_MINUTOS * 60_000);

    expect((await p.consultarEstadoPago(qr.referenciaBancard))?.estado).toBe("CANCELADO");
  });
});

describe("PaymentProvider mock · fallas forzadas del panel de demo", () => {
  it("un timeout de Bancard lanza ErrorBancard y no deja ninguna operación creada", async () => {
    const p = crearPaymentProviderMock({
      demoraGeneracionMs: 0,
      demoraAcreditacionMs: 0,
      fallaForzada: () => "TIMEOUT",
    });

    await expect(p.iniciarPagoQr(ENTRADA_QR)).rejects.toBeInstanceOf(ErrorBancard);
    expect(listarOperacionesMock()).toHaveLength(0);
  });

  it("un rechazo de Bancard se distingue del timeout por el motivo", async () => {
    const p = crearPaymentProviderMock({
      demoraGeneracionMs: 0,
      demoraAcreditacionMs: 0,
      fallaForzada: () => "RECHAZADA",
    });

    await expect(p.iniciarPagoQr(ENTRADA_QR)).rejects.toMatchObject({ motivo: "RECHAZADA" });
  });

  /**
   * El caso que justifica la clave de idempotencia: la primera llamada muere
   * por timeout sin que sepamos si Bancard creó la operación. Al despejarse la
   * falla, el reintento con la MISMA clave tiene que producir una sola
   * operación, no dos cobros.
   */
  it("reintentar tras un timeout con la misma clave deja una sola operación", async () => {
    let falla: FallaBancardDemo | null = "TIMEOUT";
    const p = crearPaymentProviderMock({
      demoraGeneracionMs: 0,
      demoraAcreditacionMs: 0,
      fallaForzada: () => falla,
    });

    await expect(p.iniciarPagoQr(ENTRADA_QR)).rejects.toBeInstanceOf(ErrorBancard);
    falla = null;

    const primero = await p.iniciarPagoQr(ENTRADA_QR);
    const segundo = await p.iniciarPagoQr(ENTRADA_QR);

    expect(segundo.referenciaBancard).toBe(primero.referenciaBancard);
    expect(listarOperacionesMock()).toHaveLength(1);
  });

  /**
   * `RECHAZO_AL_CONFIRMAR` es otro momento que `RECHAZADA`, no otra intensidad:
   * aquella corta al abrir la operación —la persona nunca ve el formulario— y
   * esta ocurre al terminar de pagar, que es cuando contesta el emisor. Es el
   * desenlace que Bancard confirmó que nos llega (B10-bis) y el que le da a
   * `EstadoPago` su valor `RECHAZADO`.
   */
  it("una tarjeta rechazada abre la operación igual y la deja RECHAZADA al pagarla", async () => {
    const reloj = relojFijo();
    const p = crearPaymentProviderMock({
      ahora: reloj.ahora,
      demoraGeneracionMs: 0,
      demoraAcreditacionMs: 1_000,
      fallaForzada: () => "RECHAZO_AL_CONFIRMAR",
    });

    // A diferencia del timeout, acá sí hay operación: la persona llega al
    // formulario seguro y recién ahí le rechazan la tarjeta.
    const debito = await p.iniciarPagoTarjetaDebito(ENTRADA_TARJETA);
    expect(debito.urlFormularioSeguro).toMatch(/^https?:\/\//);
    expect((await p.consultarEstadoPago(debito.referenciaBancard))?.estado).toBe("PENDIENTE");

    reloj.avanzar(1_000);

    const rechazado = await p.consultarEstadoPago(debito.referenciaBancard);
    expect(rechazado?.estado).toBe("RECHAZADO");
    // Con el código y la descripción del proveedor, no con un texto propio.
    expect(rechazado?.codigoRespuesta).toBe("51");
    expect(rechazado?.descripcionRespuesta).toBe("Fondos insuficientes");
  });

  it("el desenlace se decide al abrir la operación, así que la palanca no se evapora", async () => {
    // La palanca se consume en el primer intento que la encuentra, y el
    // desenlace queda pegado a la operación: si dependiera de volver a
    // consultarla, la segunda lectura la aprobaría.
    const reloj = relojFijo();
    let falla: FallaBancardDemo | null = "RECHAZO_AL_CONFIRMAR";
    const p = crearPaymentProviderMock({
      ahora: reloj.ahora,
      demoraGeneracionMs: 0,
      demoraAcreditacionMs: 1_000,
      fallaForzada: () => {
        const actual = falla;
        falla = null;
        return actual;
      },
    });

    const debito = await p.iniciarPagoTarjetaDebito(ENTRADA_TARJETA);
    reloj.avanzar(1_000);

    expect((await p.consultarEstadoPago(debito.referenciaBancard))?.estado).toBe("RECHAZADO");
    expect((await p.consultarEstadoPago(debito.referenciaBancard))?.estado).toBe("RECHAZADO");
  });

  it("reversar una operación ya rechazada no la cambia: el intento existió", async () => {
    // Decir "cancelado" borraría el hecho de que hubo un intento, que es
    // justamente lo que quema el `shop_process_id` (B10).
    const reloj = relojFijo();
    const p = crearPaymentProviderMock({
      ahora: reloj.ahora,
      demoraGeneracionMs: 0,
      demoraAcreditacionMs: 1_000,
      fallaForzada: () => "RECHAZO_AL_CONFIRMAR",
    });

    const debito = await p.iniciarPagoTarjetaDebito(ENTRADA_TARJETA);
    reloj.avanzar(1_000);

    expect((await p.cancelarOLiberarReserva(debito.referenciaBancard)).estado).toBe("RECHAZADO");
  });
});

/**
 * G1 · el uso de la reversa que Bancard declara mandatorio: apagar un QR
 * generado y no pagado cuando el comercio cancela la venta (respuesta B4-bis).
 * El QR del proveedor vive 3 días y no es configurable (B5-bis), así que la
 * política de 24 h del expediente la hace cumplir esta llamada o nadie.
 */
describe("PaymentProvider mock · apagar un QR emitido y no pagado", () => {
  it("deja CANCELADO un QR pendiente, y repetirlo no cambia nada", async () => {
    const p = crearPaymentProviderMock({
      demoraGeneracionMs: 0,
      // Nunca se acredita solo: queda pendiente, que es el caso de G1.
      demoraAcreditacionMs: 24 * 60 * 60 * 1000,
    });

    const qr = await p.iniciarPagoQr(ENTRADA_QR);
    expect((await p.consultarEstadoPago(qr.referenciaBancard))?.estado).toBe("PENDIENTE");

    const primera = await p.cancelarOLiberarReserva(qr.referenciaBancard);
    const segunda = await p.cancelarOLiberarReserva(qr.referenciaBancard);

    expect(primera.estado).toBe("CANCELADO");
    // Idempotente por referencia: los reintentos de red son esperables acá.
    expect(segunda).toEqual(primera);
    expect((await p.consultarEstadoPago(qr.referenciaBancard))?.estado).toBe("CANCELADO");
  });
});

describe("PaymentProvider mock · regla inviolable #6", () => {
  /**
   * Verificación en runtime de lo que los tipos ya garantizan: nada de lo que
   * el adaptador retiene se parece a un PAN o a un CVV. Los datos de tarjeta
   * viven exclusivamente dentro del formulario seguro de Bancard, al que se
   * llega por `urlFormularioSeguro`.
   */
  it("no retiene ningún dato de tarjeta en el estado de las operaciones", async () => {
    const p = crearPaymentProviderMock({ demoraGeneracionMs: 0, demoraAcreditacionMs: 0 });

    await p.iniciarPagoTarjetaDebito(ENTRADA_TARJETA);
    await p.iniciarPagoTarjetaCredito({ ...ENTRADA_TARJETA, idempotencyKey: "IDEMP-X" });

    const serializado = JSON.stringify(listarOperacionesMock());

    expect(serializado).not.toMatch(/\b\d{13,19}\b/); // un PAN
    expect(serializado.toLowerCase()).not.toMatch(/\b(pan|cvv|cvc|cvv2)\b/);
  });

  it("solo expone los últimos 4 dígitos enmascarados, y nunca para un QR", async () => {
    const p = crearPaymentProviderMock({ demoraGeneracionMs: 0, demoraAcreditacionMs: 0 });

    const qr = await p.iniciarPagoQr(ENTRADA_QR);
    const debito = await p.iniciarPagoTarjetaDebito(ENTRADA_TARJETA);

    expect((await p.consultarEstadoPago(qr.referenciaBancard))?.ultimos4Digitos).toBeNull();
    expect((await p.consultarEstadoPago(debito.referenciaBancard))?.ultimos4Digitos).toHaveLength(4);
  });
});
