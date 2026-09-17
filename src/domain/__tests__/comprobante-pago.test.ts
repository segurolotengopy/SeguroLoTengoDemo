/**
 * Tests del comprobante de pago (D-05).
 *
 * Lo que este archivo cuida no es el maquetado del PDF sino las tres cosas que
 * hacen que el documento no engañe a nadie:
 *
 * - **No se confunde con la factura.** La factura la emite Alianza por SIFEN
 *   (fila 40 de la matriz); un comprobante del corredor que no lo dijera sería
 *   leído como documento fiscal.
 * - **No contiene datos de tarjeta** (regla inviolable #6), ni siquiera
 *   enmascarados: del pago salen medio y referencia.
 * - **No existe sin cobro acreditado**, y tampoco sin el certificado que ese
 *   cobro emitió: los dos nacen juntos (D-12).
 */
import { describe, expect, it } from "vitest";
import {
  armarContenidoComprobante,
  codigoComprobante,
} from "../comprobante-pago";
import { codigoCertificado } from "../certificado-cobertura";
import { codigoSolicitud } from "../documentos";
import { desglosePremio, formatearGuaranies } from "../catalogo";
import type { Expediente } from "../tipos";
import {
  NUMERO_PROPUESTA_FIJO,
  certificadoFixture,
  expedienteEnPagoConfirmado,
  expedienteFirmado,
  pagoConfirmadoFixture,
} from "./fixtures";

function contenidoDe(expediente: Expediente = expedienteEnPagoConfirmado()) {
  const resultado = armarContenidoComprobante(expediente);
  if (!resultado.ok) throw new Error(`Faltantes: ${resultado.faltantes.join(",")}`);
  return resultado.contenido;
}

describe("comprobante de pago", () => {
  it("lleva su propio código derivado del correlativo y cita la propuesta pagada", () => {
    const contenido = contenidoDe();
    expect(contenido.encabezado.codigo).toBe(codigoComprobante(NUMERO_PROPUESTA_FIJO));
    expect(contenido.encabezado.codigoVinculado).toBe(codigoSolicitud(NUMERO_PROPUESTA_FIJO));
  });

  /**
   * Sin QR, y el encabezado tiene que decirlo con un `null` y no con una URL
   * vacía: lo que este documento afirma ya está probado por el certificado y
   * por la Solicitud firmada, y un QR sugeriría una verificación propia que no
   * existe.
   */
  it("no lleva QR de verificación", () => {
    expect(contenidoDe().encabezado.urlVerificacion).toBeNull();
  });

  it("dice, en el cuerpo, que no es la factura y quién la emite", () => {
    const contenido = contenidoDe();
    expect(contenido.leyendaNoEsFactura).toMatch(/no es la factura/i);
    expect(contenido.leyendaNoEsFactura).toMatch(/SIFEN/);
  });

  it("no contiene ningún dato de tarjeta: del pago salen medio y referencia (regla #6)", () => {
    const serializado = JSON.stringify(contenidoDe());
    expect(serializado).toContain(pagoConfirmadoFixture.referenciaBancard);
    // Ninguna secuencia con forma de PAN, ni el CVV, ni el vencimiento.
    expect(serializado).not.toMatch(/\b\d{13,19}\b/);
    expect(serializado.toLowerCase()).not.toContain("cvv");
    expect(sinReferenciasAlInstrumento(serializado)).toBe(true);
  });

  it("el desglose sale del catálogo y está rotulado como provisional (D-04)", () => {
    const contenido = contenidoDe();
    const esperado = desglosePremio("CONFIO_PLUS");
    const valores = contenido.desglose.map((campo) => campo.valor);
    expect(valores[0]).toBe(formatearGuaranies(esperado.primaNetaGs));
    expect(contenido.leyendaDesgloseProvisional).toMatch(/provisional/i);
  });

  /**
   * El bloque que conecta el pago con lo que habilitó. Cita el certificado por
   * su código porque es el documento al que hay que ir para verificar la
   * cobertura: el comprobante no se verifica solo.
   */
  it("cita el certificado emitido y las fechas de cobertura", () => {
    const contenido = contenidoDe();
    const texto = contenido.consecuencias.join(" ");
    expect(texto).toContain(codigoCertificado(NUMERO_PROPUESTA_FIJO));
    expect(texto).toMatch(/La cobertura comienza el/);
  });

  it("un expediente firmado y sin pagar no tiene comprobante que armar", () => {
    const resultado = armarContenidoComprobante(expedienteFirmado());
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.faltantes).toContain("pagoConfirmado");
      expect(resultado.faltantes).toContain("certificadoCobertura");
    }
  });

  /**
   * Un expediente legado —cobrado antes de D-12, sin certificado— tampoco
   * genera comprobante, y es deliberado: el documento cita el certificado como
   * lo que ese pago habilitó, así que sin él diría algo que no puede sostener.
   */
  it("sin certificado no hay comprobante, aunque el cobro esté acreditado", () => {
    const legado: Expediente = { ...expedienteEnPagoConfirmado(), certificadoCobertura: null };
    const resultado = armarContenidoComprobante(legado);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.faltantes).toEqual(["certificadoCobertura"]);
  });

  it("usa el certificado del expediente, no uno recalculado", () => {
    const contenido = contenidoDe();
    expect(contenido.consecuencias.join(" ")).toContain(certificadoFixture.codigo);
  });
});

/**
 * El comprobante nombra el **medio** de pago ("Tarjeta de crédito (Bancard)"),
 * nunca el instrumento. Ni siquiera los últimos cuatro dígitos: Bancard los
 * devuelve y el dominio los descarta, así que no hay de dónde sacarlos.
 */
function sinReferenciasAlInstrumento(serializado: string): boolean {
  return !/tarjeta terminada|últimos 4|ultimos4/i.test(serializado);
}
