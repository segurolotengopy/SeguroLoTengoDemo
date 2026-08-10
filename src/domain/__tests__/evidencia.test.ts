/**
 * Clasificación de la evidencia por integración para el visor compartido.
 *
 * Lo que se prueba acá es que cada paso se impute al puerto correcto —en
 * particular que P8 no se trate como un bloque: mezcla firma (Code100),
 * captura (Bancard) y actos del dominio— y que el resumen cuente y ordene
 * sin perder registros.
 */
import { describe, expect, it } from "vitest";
import { integracionDelPaso, resumenPorIntegracion } from "../evidencia";
import type { RegistroEvidencia } from "../tipos";

function registro(parcial: Partial<RegistroEvidencia> & { paso: string }): RegistroEvidencia {
  return {
    id: `evid-${parcial.paso}-${parcial.fecha ?? ""}`,
    expedienteId: "exp-1",
    fecha: "2026-03-01T15:30:00.000Z",
    ip: "200.10.20.30",
    dispositivo: "Mozilla/5.0 (Linux; Android 14) vitest",
    sesionId: "sesion-visor",
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado: "EXITOSO",
    detalle: null,
    ...parcial,
  };
}

describe("integracionDelPaso", () => {
  it("imputa el ciclo completo de cada OTP a OtpProvider", () => {
    for (const paso of [
      "P1_OTP_WHATSAPP_ENVIO",
      "P1_OTP_WHATSAPP_REENVIO",
      "P1_OTP_WHATSAPP_VERIFICACION",
      "P4_OTP_CORREO_ENVIO",
      "P4_OTP_CORREO_REENVIO",
      "P4_OTP_CORREO_VERIFICACION",
    ]) {
      expect(integracionDelPaso(paso), paso).toBe("OtpProvider");
    }
  });

  it("separa los tres destinos que conviven en P8", () => {
    expect(integracionDelPaso("P8_ENVIO_ENLACE_FIRMA")).toBe("SignatureProvider");
    expect(integracionDelPaso("P8_FIRMA")).toBe("SignatureProvider");
    expect(integracionDelPaso("P8_CAPTURA_PAGO")).toBe("PaymentProvider");
    expect(integracionDelPaso("P8_PAQUETE_DOCUMENTAL")).toBeNull();
    expect(integracionDelPaso("P8_VENCIMIENTO_PLAZO_FIRMA")).toBeNull();
  });

  it("no imputa a ningún proveedor los actos del dominio", () => {
    for (const paso of [
      "P2_SELECCION_PLAN",
      "P3_AUTORIZACION_INICIAL",
      // P6 decide con la respuesta autodeclarada: ComplianceProvider no se
      // consulta a propósito (regla inviolable #5).
      "P6_DATOS_Y_DECLARACIONES",
      "P9_COMUNICACIONES_COMERCIALES",
      "PANTALLA_B_DEVOLUCION_INICIADA",
      "PANTALLA_B_DEVOLUCION_EJECUTADA",
      "ADMIN_REINICIO_EXPEDIENTE",
      "ADMIN_EXPEDIENTE_CREADO_POR_REINICIO",
      "UN_PASO_QUE_NO_EXISTE",
    ]) {
      expect(integracionDelPaso(paso), paso).toBeNull();
    }
  });
});

describe("resumenPorIntegracion", () => {
  it("cuenta por integración, toma el último resultado y respeta el orden del flujo", () => {
    const evidencias = [
      registro({ paso: "P1_OTP_WHATSAPP_ENVIO", fecha: "2026-03-01T10:00:00.000Z" }),
      registro({
        paso: "P1_OTP_WHATSAPP_VERIFICACION",
        fecha: "2026-03-01T10:01:00.000Z",
        resultado: "FALLIDO",
      }),
      registro({
        paso: "P1_OTP_WHATSAPP_VERIFICACION",
        fecha: "2026-03-01T10:02:00.000Z",
      }),
      registro({ paso: "P3_AUTORIZACION_INICIAL", fecha: "2026-03-01T10:03:00.000Z" }),
      registro({
        paso: "P8_FIRMA",
        fecha: "2026-03-01T12:00:00.000Z",
        resultado: "FALLIDO",
      }),
      registro({ paso: "P7_INICIO_PAGO", fecha: "2026-03-01T11:00:00.000Z" }),
    ];

    const resumen = resumenPorIntegracion(evidencias);

    // Orden del flujo, no de aparición: OTP → pago → firma.
    expect(resumen.map((fila) => fila.integracion)).toEqual([
      "OtpProvider",
      "PaymentProvider",
      "SignatureProvider",
    ]);

    const otp = resumen[0];
    expect(otp.total).toBe(3);
    expect(otp.exitosos).toBe(2);
    expect(otp.fallidos).toBe(1);
    // El más reciente del historial (orden de guardado) manda.
    expect(otp.ultimoResultado).toBe("EXITOSO");
    expect(otp.ultimaFecha).toBe("2026-03-01T10:02:00.000Z");

    expect(resumen[2].ultimoResultado).toBe("FALLIDO");
  });

  it("una integración sin registros no aparece: no participó todavía", () => {
    expect(resumenPorIntegracion([])).toEqual([]);
    const soloDominio = [registro({ paso: "P2_SELECCION_PLAN" })];
    expect(resumenPorIntegracion(soloDominio)).toEqual([]);
  });
});
