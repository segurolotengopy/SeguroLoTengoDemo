/**
 * Tests de la generación del comprobante de pago (D-05).
 *
 * El comprobante es el único de los tres documentos del motor que **no se
 * cierra, no se hashea y no se guarda**: se arma de lo que ya está en el
 * expediente cada vez que alguien lo pide. Lo que este archivo cuida es que esa
 * decisión no le quite lo que sí necesita —determinismo— y que no exista sobre
 * un expediente que no lo puede sostener.
 */
import { describe, expect, it } from "vitest";
import {
  expedienteEnPagoConfirmado,
  expedienteFirmado,
} from "../../domain/__tests__/fixtures";
import { generarComprobantePago } from "../servicio";

describe("comprobante de pago", () => {
  it("se genera al vuelo, sin tocar el almacenamiento", () => {
    const resultado = generarComprobantePago(expedienteEnPagoConfirmado());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(new TextDecoder().decode(resultado.bytes.slice(0, 5))).toBe("%PDF-");
  });

  /**
   * Aunque no tenga hash registrado, tiene que dar siempre el mismo archivo:
   * dos descargas del mismo pago con dos comprobantes distintos es exactamente
   * lo que hace desconfiar de un comprobante.
   */
  it("es determinista: descargarlo dos veces da los mismos bytes", () => {
    const expediente = expedienteEnPagoConfirmado();
    const a = generarComprobantePago(expediente);
    const b = generarComprobantePago(expediente);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.bytes).toEqual(b.bytes);
  });

  it("sin cobro acreditado no se genera, y dice qué faltó", () => {
    const resultado = generarComprobantePago(expedienteFirmado());
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.faltantes).toContain("pagoConfirmado");
  });
});
