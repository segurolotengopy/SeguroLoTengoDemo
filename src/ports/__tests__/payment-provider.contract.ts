/**
 * Suite de contrato para cualquier implementación de `PaymentProvider`
 * (mock u oficial), P7. Cubre las tres modalidades: QR y débito (pago
 * definitivo antes de la firma) y crédito (preautorización, captura y
 * liberación de reserva).
 *
 * La suite **no verifica el estado al que llega cada modalidad** después de
 * pagar: eso depende de cuándo la persona escanea el QR o completa el
 * formulario seguro, que ninguna implementación puede forzar desde acá. Lo que
 * sí verifica es lo que el puerto promete pase lo que pase: idempotencia,
 * forma de las respuestas y comportamiento ante una referencia desconocida.
 * Los desenlaces temporales los prueba el test del adaptador, que sí puede
 * fijar el reloj.
 *
 * Regla de negocio inviolable #6 (ningún PAN completo ni CVV): es una
 * garantía de tipos, no verificable en runtime. `EstadoConsultaPago` solo
 * declara `ultimos4Digitos: string | null` — ningún método de entrada ni de
 * salida de `PaymentProvider` admite un campo de PAN completo ni de CVV. Si
 * algún día se agregara un campo así, este puerto dejaría de tipar contra
 * CLAUDE.md regla #6, así que no hace falta un test en runtime para eso.
 */
import { describe, expect, it } from "vitest";
import type { PaymentProvider } from "../payment-provider";

export function runPaymentProviderContractTests(
  crearProveedor: () => PaymentProvider | Promise<PaymentProvider>,
): void {
  async function proveedor(): Promise<PaymentProvider> {
    return await crearProveedor();
  }

  describe("PaymentProvider (contrato)", () => {
    it("inicia un pago por QR con referencia y payload de Bancard", async () => {
      const p = await proveedor();
      const resultado = await p.iniciarPagoQr({
        expedienteId: "EXP-CONTRATO-1",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        idempotencyKey: "IDEMP-CONTRATO-1",
      });

      expect(resultado.referenciaBancard.length).toBeGreaterThan(0);
      expect(resultado.qrPayload.length).toBeGreaterThan(0);
    });

    it("consulta el estado de un pago QR recién iniciado", async () => {
      const p = await proveedor();
      const inicio = await p.iniciarPagoQr({
        expedienteId: "EXP-CONTRATO-2",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        idempotencyKey: "IDEMP-CONTRATO-2",
      });

      const estado = await p.consultarEstadoPago(inicio.referenciaBancard);

      expect(estado?.medio).toBe("QR_BANCARD");
      expect(estado?.montoGs).toBe(475000);
      // Un QR no tiene tarjeta detrás; ni siquiera el dato enmascarado.
      expect(estado?.ultimos4Digitos).toBeNull();
    });

    it("devuelve null al consultar una referencia que Bancard no conoce", async () => {
      const p = await proveedor();

      expect(await p.consultarEstadoPago("NO-EXISTE-ESTA-REFERENCIA")).toBeNull();
    });

    it("inicia un pago con tarjeta de débito por compra simple, con URL de formulario seguro", async () => {
      const p = await proveedor();
      const resultado = await p.iniciarPagoTarjetaDebito({
        expedienteId: "EXP-CONTRATO-9",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        urlRetorno: "https://segurolotengo.com/p7/retorno",
        idempotencyKey: "IDEMP-CONTRATO-9",
      });

      expect(resultado.referenciaBancard.length).toBeGreaterThan(0);
      expect(resultado.urlFormularioSeguro).toMatch(/^https?:\/\//);
    });

    it("reintenta iniciarPagoTarjetaDebito con la misma idempotencyKey y no abre un cobro nuevo", async () => {
      const p = await proveedor();
      const input = {
        expedienteId: "EXP-CONTRATO-10",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        urlRetorno: "https://segurolotengo.com/p7/retorno",
        idempotencyKey: "IDEMP-CONTRATO-10",
      };

      const primero = await p.iniciarPagoTarjetaDebito(input);
      const reintento = await p.iniciarPagoTarjetaDebito(input);

      expect(reintento.referenciaBancard).toBe(primero.referenciaBancard);
      expect(reintento.urlFormularioSeguro).toBe(primero.urlFormularioSeguro);
    });

    /**
     * La preautorización es exclusiva de la tarjeta de crédito (confirmado por
     * Bancard): con débito el dinero ya se movió en P7, así que no hay nada
     * que capturar y pedirlo es un error de programación.
     */
    it("rechaza capturar una operación de débito: no es una preautorización", async () => {
      const p = await proveedor();
      const debito = await p.iniciarPagoTarjetaDebito({
        expedienteId: "EXP-CONTRATO-11",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        urlRetorno: "https://segurolotengo.com/p7/retorno",
        idempotencyKey: "IDEMP-CONTRATO-11",
      });

      await expect(p.capturarPreautorizacion(debito.referenciaBancard)).rejects.toThrow();
    });

    it("distingue el medio de cada operación al consultarla", async () => {
      const p = await proveedor();
      const debito = await p.iniciarPagoTarjetaDebito({
        expedienteId: "EXP-CONTRATO-12",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        urlRetorno: "https://segurolotengo.com/p7/retorno",
        idempotencyKey: "IDEMP-CONTRATO-12",
      });
      const credito = await p.iniciarPreautorizacionTarjeta({
        expedienteId: "EXP-CONTRATO-12",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        urlRetorno: "https://segurolotengo.com/p7/retorno",
        idempotencyKey: "IDEMP-CONTRATO-12-BIS",
      });

      expect((await p.consultarEstadoPago(debito.referenciaBancard))?.medio).toBe("TARJETA_DEBITO");
      expect((await p.consultarEstadoPago(credito.referenciaBancard))?.medio).toBe("TARJETA_CREDITO");
    });

    it("inicia una preautorización de tarjeta con URL de formulario seguro de Bancard", async () => {
      const p = await proveedor();
      const resultado = await p.iniciarPreautorizacionTarjeta({
        expedienteId: "EXP-CONTRATO-3",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        urlRetorno: "https://segurolotengo.com/p7/retorno",
        idempotencyKey: "IDEMP-CONTRATO-3",
      });

      expect(resultado.referenciaBancard.length).toBeGreaterThan(0);
      expect(resultado.urlFormularioSeguro).toMatch(/^https?:\/\//);
    });

    it("captura una preautorización de tarjeta y la deja en estado CAPTURADO", async () => {
      const p = await proveedor();
      const inicio = await p.iniciarPreautorizacionTarjeta({
        expedienteId: "EXP-CONTRATO-4",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        urlRetorno: "https://segurolotengo.com/p7/retorno",
        idempotencyKey: "IDEMP-CONTRATO-4",
      });

      const capturado = await p.capturarPreautorizacion(inicio.referenciaBancard);

      expect(capturado.estado).toBe("CAPTURADO");
    });

    it("cancela o libera una reserva de tarjeta no capturada", async () => {
      const p = await proveedor();
      const inicio = await p.iniciarPreautorizacionTarjeta({
        expedienteId: "EXP-CONTRATO-5",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        urlRetorno: "https://segurolotengo.com/p7/retorno",
        idempotencyKey: "IDEMP-CONTRATO-5",
      });

      const cancelado = await p.cancelarOLiberarReserva(inicio.referenciaBancard);

      expect(cancelado.estado).toBe("CANCELADO");
    });

    it("reintenta iniciarPagoQr con la misma idempotencyKey y no crea un QR nuevo", async () => {
      const p = await proveedor();
      const input = {
        expedienteId: "EXP-CONTRATO-6",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        idempotencyKey: "IDEMP-CONTRATO-6",
      };

      const primero = await p.iniciarPagoQr(input);
      const reintento = await p.iniciarPagoQr(input);

      expect(reintento.referenciaBancard).toBe(primero.referenciaBancard);
      expect(reintento.qrPayload).toBe(primero.qrPayload);
    });

    it("reintenta iniciarPreautorizacionTarjeta con la misma idempotencyKey y no crea una preautorización nueva", async () => {
      const p = await proveedor();
      const input = {
        expedienteId: "EXP-CONTRATO-7",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        urlRetorno: "https://segurolotengo.com/p7/retorno",
        idempotencyKey: "IDEMP-CONTRATO-7",
      };

      const primero = await p.iniciarPreautorizacionTarjeta(input);
      const reintento = await p.iniciarPreautorizacionTarjeta(input);

      expect(reintento.referenciaBancard).toBe(primero.referenciaBancard);
    });

    it("reintenta capturarPreautorizacion sobre una referencia ya CAPTURADO sin volver a cobrar", async () => {
      const p = await proveedor();
      const inicio = await p.iniciarPreautorizacionTarjeta({
        expedienteId: "EXP-CONTRATO-8",
        propuestaId: "PROP-00018425",
        montoGs: 475000,
        urlRetorno: "https://segurolotengo.com/p7/retorno",
        idempotencyKey: "IDEMP-CONTRATO-8",
      });

      const primeraCaptura = await p.capturarPreautorizacion(inicio.referenciaBancard);
      const segundaCaptura = await p.capturarPreautorizacion(inicio.referenciaBancard);

      expect(primeraCaptura.estado).toBe("CAPTURADO");
      expect(segundaCaptura.estado).toBe("CAPTURADO");
      expect(segundaCaptura.referenciaBancard).toBe(primeraCaptura.referenciaBancard);
      expect(segundaCaptura.montoGs).toBe(primeraCaptura.montoGs);
    });
  });
}
