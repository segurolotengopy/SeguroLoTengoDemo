/**
 * Catálogo de planes del Seguro de Vida Oncológico CONFÍO.
 *
 * Valores transcritos textualmente de docs/ESPECIFICACION_PANTALLAS.md → P2,
 * tabla "Tres planes (valores exactos)". NO son datos de prueba: son el
 * producto. Los fixtures del demo (`src/adapters/mock/personas.ts`) eligen un
 * plan de acá, no definen importes propios.
 *
 * Vive en el dominio porque lo consumen P2 (selección), la barra de plan de
 * P3–P8, la liquidación de P7 y el resumen de P9. Un solo lugar donde
 * corregir si Alianza actualiza el tarifario.
 */
import type { PlanId } from "./tipos";

export interface Plan {
  readonly id: PlanId;
  /** Nombre comercial tal como se muestra: "CONFÍO", "CONFÍO+", "CONFÍO TOTAL". */
  readonly nombre: string;
  readonly muerteCualquierCausaGs: number;
  readonly indemnizacionCancerGs: number;
  /** Máximo 15 días por vigencia. */
  readonly rentaHospitalariaTotalGs: number;
  readonly rentaHospitalariaPorDiaGs: number;
  readonly gastosMedicosAccidenteGs: number;
  /** Premio total anual, IVA incluido. */
  readonly premioAnualGs: number;
}

export const PLANES: Readonly<Record<PlanId, Plan>> = {
  CONFIO: {
    id: "CONFIO",
    nombre: "CONFÍO",
    muerteCualquierCausaGs: 3_500_000,
    indemnizacionCancerGs: 50_000_000,
    rentaHospitalariaTotalGs: 7_500_000,
    rentaHospitalariaPorDiaGs: 500_000,
    gastosMedicosAccidenteGs: 7_000_000,
    premioAnualGs: 290_000,
  },
  CONFIO_PLUS: {
    id: "CONFIO_PLUS",
    nombre: "CONFÍO+",
    muerteCualquierCausaGs: 5_000_000,
    indemnizacionCancerGs: 75_000_000,
    rentaHospitalariaTotalGs: 11_250_000,
    rentaHospitalariaPorDiaGs: 750_000,
    gastosMedicosAccidenteGs: 10_000_000,
    premioAnualGs: 475_000,
  },
  CONFIO_TOTAL: {
    id: "CONFIO_TOTAL",
    nombre: "CONFÍO TOTAL",
    muerteCualquierCausaGs: 7_000_000,
    indemnizacionCancerGs: 100_000_000,
    rentaHospitalariaTotalGs: 15_000_000,
    rentaHospitalariaPorDiaGs: 1_000_000,
    gastosMedicosAccidenteGs: 14_000_000,
    premioAnualGs: 660_000,
  },
};

/** Orden de presentación en P2, de menor a mayor cobertura. */
export const ORDEN_PLANES: readonly PlanId[] = ["CONFIO", "CONFIO_PLUS", "CONFIO_TOTAL"];

/** Gs. 475.000 → "Gs. 475.000". Separador de miles con punto, como en la especificación. */
export function formatearGuaranies(monto: number): string {
  return `Gs. ${monto.toLocaleString("es-PY").replace(/,/g, ".")}`;
}
