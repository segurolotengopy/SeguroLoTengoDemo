/**
 * El catálogo es la tabla de precios del producto: estos tests lo comparan
 * contra los valores exactos de docs/ESPECIFICACION_PANTALLAS.md → P2, para
 * que un cambio accidental de un importe rompa la suite en vez de llegar a
 * una pantalla de venta.
 */
import { describe, expect, it } from "vitest";
import {
  ID_VERSION_OFERTA,
  OFERTA_VIGENTE,
  ORDEN_PLANES,
  PLANES,
  PRODUCTOS,
  esPlanId,
  formatearGuaranies,
  serializarOfertaCanonica,
} from "../catalogo";

describe("tabla de planes", () => {
  it("reproduce los valores exactos de la especificación de P2", () => {
    expect(PLANES.CONFIO).toEqual({
      id: "CONFIO",
      nombre: "CONFÍO",
      muerteCualquierCausaGs: 3_500_000,
      indemnizacionCancerGs: 50_000_000,
      rentaHospitalariaTotalGs: 7_500_000,
      rentaHospitalariaPorDiaGs: 500_000,
      gastosMedicosAccidenteGs: 7_000_000,
      premioAnualGs: 319_000,
    });

    expect(PLANES.CONFIO_PLUS).toEqual({
      id: "CONFIO_PLUS",
      nombre: "CONFÍO+",
      muerteCualquierCausaGs: 5_000_000,
      indemnizacionCancerGs: 75_000_000,
      rentaHospitalariaTotalGs: 11_250_000,
      rentaHospitalariaPorDiaGs: 750_000,
      gastosMedicosAccidenteGs: 10_000_000,
      premioAnualGs: 522_500,
    });

    expect(PLANES.CONFIO_TOTAL).toEqual({
      id: "CONFIO_TOTAL",
      nombre: "CONFÍO TOTAL",
      muerteCualquierCausaGs: 7_000_000,
      indemnizacionCancerGs: 100_000_000,
      rentaHospitalariaTotalGs: 15_000_000,
      rentaHospitalariaPorDiaGs: 1_000_000,
      gastosMedicosAccidenteGs: 14_000_000,
      premioAnualGs: 726_000,
    });
  });

  it("ofrece exactamente tres planes, de menor a mayor cobertura", () => {
    expect(ORDEN_PLANES).toEqual(["CONFIO", "CONFIO_PLUS", "CONFIO_TOTAL"]);
    expect(OFERTA_VIGENTE.planes).toHaveLength(3);
    expect(OFERTA_VIGENTE.planes.map((plan) => plan.premioAnualGs)).toEqual([
      319_000, 522_500, 726_000,
    ]);
  });

  it("la renta hospitalaria total es la diaria por los 15 días de la vigencia", () => {
    for (const plan of OFERTA_VIGENTE.planes) {
      expect(plan.rentaHospitalariaTotalGs).toBe(plan.rentaHospitalariaPorDiaGs * 15);
    }
  });
});

describe("selector de producto", () => {
  it("solo habilita el Seguro de Vida Oncológico; los otros tres son PRÓXIMAMENTE", () => {
    expect(PRODUCTOS).toHaveLength(4);
    expect(PRODUCTOS.filter((producto) => producto.disponible)).toEqual([
      { id: "VIDA_ONCOLOGICO", nombre: "Seguro de Vida Oncológico", disponible: true },
    ]);
  });
});

describe("serialización canónica de la oferta", () => {
  it("es determinista: la misma tabla produce siempre el mismo texto", () => {
    expect(serializarOfertaCanonica()).toBe(serializarOfertaCanonica());
  });

  it("incluye la versión y los importes de los tres planes", () => {
    const canonico = serializarOfertaCanonica();

    expect(canonico).toContain(`oferta=${ID_VERSION_OFERTA}`);
    expect(canonico).toContain("plan=CONFIO_PLUS");
    expect(canonico).toContain("premioAnual=522500");
    // Una línea de cabecera por dato de la oferta y una por plan.
    expect(canonico.split("\n")).toHaveLength(4 + 3);
  });

  it("cambia si cambia un solo importe (es lo que vuelve útil al hash)", () => {
    const alterada = {
      ...OFERTA_VIGENTE,
      planes: OFERTA_VIGENTE.planes.map((plan) =>
        plan.id === "CONFIO" ? { ...plan, premioAnualGs: 290_001 } : plan,
      ),
    };

    expect(serializarOfertaCanonica(alterada)).not.toBe(serializarOfertaCanonica());
  });
});

describe("utilidades", () => {
  it("formatea guaraníes con punto como separador de miles", () => {
    expect(formatearGuaranies(522_500)).toBe("Gs. 522.500");
    expect(formatearGuaranies(100_000_000)).toBe("Gs. 100.000.000");
  });

  it("reconoce solo los tres identificadores de plan del catálogo", () => {
    expect(esPlanId("CONFIO_PLUS")).toBe(true);
    expect(esPlanId("CONFIO_PREMIUM")).toBe(false);
    expect(esPlanId(null)).toBe(false);
  });
});
