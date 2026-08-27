/**
 * Suite de contrato para cualquier implementación de `OtpProvider` (mock u
 * oficial). Cubre la regla de negocio inviolable #1 (6 dígitos, uso único,
 * vigencia 5 minutos, máximo 3 intentos, reenvío bloqueado 60 segundos) y
 * la #2 (el código nunca se expone en texto plano por esta interfaz).
 *
 * Los **tres** propósitos entran acá: verificación de celular, verificación
 * de correo y firma. El de firma es el que sostiene la firma electrónica no
 * cualificada del cliente (Res. SS.SG. 210/2025, art. 4), así que su
 * independencia de los otros dos no es una prolijidad: es lo que hace que un
 * código de verificación no pueda pasar por una manifestación de voluntad.
 *
 * Como la interfaz nunca expone el código en claro (regla #2), esta suite
 * recibe además un segundo parámetro `obtenerCodigoDePrueba`: un canal de
 * lectura fuera de `OtpProvider`, pensado para que un adaptador de pruebas
 * (p.ej. el mock, que ya expone el código al panel de demo por un canal
 * aparte) pueda inyectar cómo leer el código durante el test, sin que la
 * interfaz de producto lo permita.
 *
 * Uso esperado, una vez exista el adaptador mock:
 *
 *   runOtpProviderContractTests(
 *     () => crearOtpProviderMock(),
 *     (otpId) => obtenerCodigoDePruebaDelMock(otpId),
 *   );
 */
import { describe, expect, it, vi } from "vitest";
import type { OtpProvider } from "../otp-provider";

const CINCO_MINUTOS_MS = 5 * 60 * 1000;

export function runOtpProviderContractTests(
  crearProveedor: () => OtpProvider | Promise<OtpProvider>,
  obtenerCodigoDePrueba: (otpId: string) => Promise<string> | string,
): void {
  async function proveedor(): Promise<OtpProvider> {
    return await crearProveedor();
  }

  describe("OtpProvider (contrato)", () => {
    it("envía y verifica un OTP con el código correcto: éxito único", async () => {
      const p = await proveedor();
      const envio = await p.enviarOtp({
        expedienteId: "EXP-CONTRATO-1",
        proposito: "VERIFICACION_CELULAR",
        destino: { canal: "WHATSAPP", valor: "+595981000000" },
      });

      expect(envio.ok).toBe(true);
      if (!envio.ok) return;

      const codigo = await obtenerCodigoDePrueba(envio.otpId);
      expect(codigo).toMatch(/^\d{6}$/);

      const verificacion = await p.verificarOtp({ otpId: envio.otpId, codigoIngresado: codigo });
      expect(verificacion.ok).toBe(true);
    });

    it("un código incorrecto falla e informa intentos restantes", async () => {
      const p = await proveedor();
      const envio = await p.enviarOtp({
        expedienteId: "EXP-CONTRATO-2",
        proposito: "VERIFICACION_CELULAR",
        destino: { canal: "WHATSAPP", valor: "+595981000000" },
      });
      if (!envio.ok) throw new Error("el envío debería haber tenido éxito");

      const verificacion = await p.verificarOtp({ otpId: envio.otpId, codigoIngresado: "000000" });

      expect(verificacion.ok).toBe(false);
      if (verificacion.ok) return;
      expect(verificacion.motivo).toBe("CODIGO_INCORRECTO");
      if (verificacion.motivo === "CODIGO_INCORRECTO") {
        expect(verificacion.intentosRestantes).toBe(2);
      }
    });

    it("el cuarto intento (tras 3 fallidos) queda agotado", async () => {
      const p = await proveedor();
      const envio = await p.enviarOtp({
        expedienteId: "EXP-CONTRATO-3",
        proposito: "VERIFICACION_CELULAR",
        destino: { canal: "WHATSAPP", valor: "+595981000000" },
      });
      if (!envio.ok) throw new Error("el envío debería haber tenido éxito");

      await p.verificarOtp({ otpId: envio.otpId, codigoIngresado: "000000" });
      await p.verificarOtp({ otpId: envio.otpId, codigoIngresado: "000000" });
      await p.verificarOtp({ otpId: envio.otpId, codigoIngresado: "000000" });
      const cuartoIntento = await p.verificarOtp({ otpId: envio.otpId, codigoIngresado: "000000" });

      expect(cuartoIntento.ok).toBe(false);
      if (cuartoIntento.ok) return;
      expect(cuartoIntento.motivo).toBe("INTENTOS_AGOTADOS");
    });

    it("un OTP vencido (más de 5 minutos) no puede verificarse aunque el código sea correcto", async () => {
      vi.useFakeTimers();
      try {
        const p = await proveedor();
        const envio = await p.enviarOtp({
          expedienteId: "EXP-CONTRATO-4",
          proposito: "VERIFICACION_CELULAR",
          destino: { canal: "WHATSAPP", valor: "+595981000000" },
        });
        if (!envio.ok) throw new Error("el envío debería haber tenido éxito");

        const codigo = await obtenerCodigoDePrueba(envio.otpId);
        vi.advanceTimersByTime(CINCO_MINUTOS_MS + 1000);

        const verificacion = await p.verificarOtp({ otpId: envio.otpId, codigoIngresado: codigo });

        expect(verificacion.ok).toBe(false);
        if (verificacion.ok) return;
        expect(verificacion.motivo).toBe("EXPIRADO");
      } finally {
        vi.useRealTimers();
      }
    });

    it("un reenvío antes de 60 segundos queda bloqueado", async () => {
      const p = await proveedor();
      const envio = await p.enviarOtp({
        expedienteId: "EXP-CONTRATO-5",
        proposito: "VERIFICACION_CELULAR",
        destino: { canal: "WHATSAPP", valor: "+595981000000" },
      });
      if (!envio.ok) throw new Error("el envío debería haber tenido éxito");

      const reenvio = await p.reenviarOtp(envio.otpId);

      expect(reenvio.ok).toBe(false);
      if (reenvio.ok) return;
      expect(reenvio.motivo).toBe("REENVIO_BLOQUEADO");
      if (reenvio.motivo === "REENVIO_BLOQUEADO") {
        expect(reenvio.segundosRestantes).toBeGreaterThan(0);
      }
    });

    it("un OTP ya usado no puede reutilizarse", async () => {
      const p = await proveedor();
      const envio = await p.enviarOtp({
        expedienteId: "EXP-CONTRATO-6",
        proposito: "VERIFICACION_CELULAR",
        destino: { canal: "WHATSAPP", valor: "+595981000000" },
      });
      if (!envio.ok) throw new Error("el envío debería haber tenido éxito");

      const codigo = await obtenerCodigoDePrueba(envio.otpId);
      const primeraVerificacion = await p.verificarOtp({ otpId: envio.otpId, codigoIngresado: codigo });
      expect(primeraVerificacion.ok).toBe(true);

      const segundaVerificacion = await p.verificarOtp({ otpId: envio.otpId, codigoIngresado: codigo });
      expect(segundaVerificacion.ok).toBe(false);
      if (segundaVerificacion.ok) return;
      expect(segundaVerificacion.motivo).toBe("YA_UTILIZADO");
    });

    it("el OTP de celular (P1) y el de correo (P4) son independientes y criptográficamente distintos", async () => {
      const p = await proveedor();
      const envioCelular = await p.enviarOtp({
        expedienteId: "EXP-CONTRATO-7",
        proposito: "VERIFICACION_CELULAR",
        destino: { canal: "WHATSAPP", valor: "+595981000000" },
      });
      const envioCorreo = await p.enviarOtp({
        expedienteId: "EXP-CONTRATO-7",
        proposito: "VERIFICACION_CORREO",
        destino: { canal: "EMAIL", valor: "persona@correo.com" },
      });
      if (!envioCelular.ok || !envioCorreo.ok) throw new Error("ambos envíos deberían haber tenido éxito");

      expect(envioCelular.otpId).not.toBe(envioCorreo.otpId);

      const codigoCelular = await obtenerCodigoDePrueba(envioCelular.otpId);
      const codigoCorreo = await obtenerCodigoDePrueba(envioCorreo.otpId);
      expect(codigoCelular).not.toBe(codigoCorreo);
    });

    it("el OTP de firma viaja por cualquiera de los dos canales verificados", async () => {
      const p = await proveedor();
      const porWhatsApp = await p.enviarOtp({
        expedienteId: "EXP-CONTRATO-8",
        proposito: "FIRMA",
        destino: { canal: "WHATSAPP", valor: "+595981000000" },
      });
      const porCorreo = await p.enviarOtp({
        expedienteId: "EXP-CONTRATO-8-BIS",
        proposito: "FIRMA",
        destino: { canal: "EMAIL", valor: "persona@correo.com" },
      });

      expect(porWhatsApp.ok).toBe(true);
      expect(porCorreo.ok).toBe(true);
      if (!porWhatsApp.ok || !porCorreo.ok) return;

      // Y firma de verdad por los dos: el canal no cambia el acto.
      for (const envio of [porWhatsApp, porCorreo]) {
        const codigo = await obtenerCodigoDePrueba(envio.otpId);
        expect(codigo).toMatch(/^\d{6}$/);
        const verificacion = await p.verificarOtp({ otpId: envio.otpId, codigoIngresado: codigo });
        expect(verificacion.ok).toBe(true);
      }
    });

    it("el código que verificó el celular no sirve para firmar (regla inviolable #1)", async () => {
      const p = await proveedor();
      const verificacion = await p.enviarOtp({
        expedienteId: "EXP-CONTRATO-9",
        proposito: "VERIFICACION_CELULAR",
        destino: { canal: "WHATSAPP", valor: "+595981000000" },
      });
      const firma = await p.enviarOtp({
        expedienteId: "EXP-CONTRATO-9",
        proposito: "FIRMA",
        destino: { canal: "WHATSAPP", valor: "+595981000000" },
      });
      if (!verificacion.ok || !firma.ok) throw new Error("ambos envíos deberían haber tenido éxito");

      // Mismo expediente y mismo teléfono, pero son dos actos distintos.
      expect(verificacion.otpId).not.toBe(firma.otpId);

      const codigoDeVerificacion = await obtenerCodigoDePrueba(verificacion.otpId);
      const codigoDeFirma = await obtenerCodigoDePrueba(firma.otpId);
      expect(codigoDeVerificacion).not.toBe(codigoDeFirma);

      // Y el del canal no firma: reutilizarlo cuenta como intento fallido.
      const intento = await p.verificarOtp({
        otpId: firma.otpId,
        codigoIngresado: codigoDeVerificacion,
      });
      expect(intento.ok).toBe(false);
    });
  });
}
