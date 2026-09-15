/**
 * El vencimiento del plazo de pago (D-32) caduca un expediente firmado y **no
 * pagado**. Desde la enmienda del 04-sep a D-08, `FIRMADO` también es el
 * estado de un expediente ya cobrado con la firma institucional diferida
 * aplicada, y conserva el `plazoPagoVenceEn` de la firma del cliente: estos
 * tests fijan que un cobro acreditado apaga el reloj, así ninguna lectura
 * posterior lo declara vencido por la arista legada `FIRMADO → VENCIDO`.
 */
import { describe, expect, it } from "vitest";
import { vencerPlazoSiCorresponde } from "../expediente";
import { expedienteFirmado, expedienteFirmadoTrasElPago } from "./fixtures";

/** Muy posterior a cualquier plazo de los fixtures. */
const MUCHO_DESPUES = "2030-01-01T00:00:00.000Z";

describe("vencimiento del plazo de pago con cobro acreditado", () => {
  it("no vence un expediente FIRMADO que ya cobró, aunque su plazo esté cumplido", () => {
    const cobradoYFirmado = expedienteFirmadoTrasElPago();
    expect(cobradoYFirmado.estado).toBe("FIRMADO");
    expect(cobradoYFirmado.plazoPagoVenceEn).not.toBeNull();

    const resultado = vencerPlazoSiCorresponde(cobradoYFirmado, MUCHO_DESPUES);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.expediente.estado).toBe("FIRMADO");
    expect(resultado.expediente).toBe(cobradoYFirmado);
  });

  it("sí vence un expediente firmado por el cliente y sin pagar", () => {
    const sinPagar = expedienteFirmado();
    expect(sinPagar.estado).toBe("FIRMADO_CLIENTE");

    const resultado = vencerPlazoSiCorresponde(sinPagar, MUCHO_DESPUES);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.expediente.estado).toBe("VENCIDO");
  });
});
