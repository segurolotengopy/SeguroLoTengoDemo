/**
 * El registro del plan ante la SIS es dato oficial desde la Nota SS.SG.
 * N.º 397/2026 (07-ago-2026), y estas pruebas fijan lo que ya no puede volver
 * a ser un marcador: el código con la forma que la SIS asigna, el acto que lo
 * inscribe, y la separación entre el nombre comercial y la denominación
 * registral. La última prueba vigila que el desglose del IVA siga rotulado
 * como provisional por su propio motivo (D-04): dejó de colgar del registro.
 */
import { describe, expect, it } from "vitest";
import { desglosePremio, NOMBRE_PRODUCTO, ORDEN_PLANES, REGISTRO_PRODUCTO } from "../catalogo";

describe("registro oficial del plan (D-26, Nota SS.SG. N.º 397/2026)", () => {
  it("lleva el código de registro tal como lo asignó la SIS", () => {
    expect(REGISTRO_PRODUCTO.codigo).toBe("15-VI.0002");
    expect(REGISTRO_PRODUCTO.codigo).toMatch(/^\d{2}-[A-Z]{2}\.\d{4}$/);
  });

  it("cita el acto de inscripción y su fecha, y ya no es provisional", () => {
    expect(REGISTRO_PRODUCTO.acto).toBe("Nota SS.SG. N.º 397/2026");
    expect(REGISTRO_PRODUCTO.actoFecha).toBe("2026-08-07");
    expect(REGISTRO_PRODUCTO.esProvisional).toBe(false);
  });

  it("distingue la denominación registral del nombre comercial", () => {
    expect(REGISTRO_PRODUCTO.denominacionRegistral).toBe(
      "Seguro de Vida Individual con Indemnización Adicional por Diagnóstico de Cáncer",
    );
    expect(REGISTRO_PRODUCTO.denominacionRegistral).not.toBe(NOMBRE_PRODUCTO);
  });

  it("no inventa la URL del modelo inscripto mientras Alianza no la pase", () => {
    expect(REGISTRO_PRODUCTO.urlModelo).toBeNull();
  });

  it("el desglose del IVA sigue siendo provisional aunque el registro sea oficial (D-04)", () => {
    for (const plan of ORDEN_PLANES) {
      expect(desglosePremio(plan).esProvisional).toBe(true);
    }
  });
});
