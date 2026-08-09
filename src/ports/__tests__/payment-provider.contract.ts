/**
 * Suite de contrato para cualquier implementación de `PaymentProvider`
 * (mock u oficial), P7. Cubre el flujo de QR (pago definitivo) y de tarjeta
 * (preautorización, captura y liberación de reserva).
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

      expect(estado.medio).toBe("QR_BANCARD");
      expect(estado.montoGs).toBe(475000);
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
