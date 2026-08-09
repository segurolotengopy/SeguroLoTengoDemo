/**
 * Catálogo versionado de la oferta del Seguro de Vida Oncológico CONFÍO.
 *
 * Valores transcritos textualmente de docs/ESPECIFICACION_PANTALLAS.md → P2,
 * tabla "Tres planes (valores exactos)". NO son datos de prueba: son el
 * producto. Los fixtures del demo (`src/adapters/mock/personas.ts`) eligen un
 * plan de acá, no definen importes propios.
 *
 * Vive en el dominio porque lo consumen P2 (selección), la barra de plan de
 * P3–P8, la liquidación de P7 y el resumen de P9. Un solo lugar donde
 * corregir si Alianza actualiza el tarifario.
 *
 * **Versionado (regla técnica de P2):** la oferta es un objeto versionado, no
 * una tabla suelta. Al seleccionar plan se guarda en el expediente el
 * `idVersion` y el SHA-256 de esta tabla, así queda probado exactamente qué
 * importes y coberturas vio el proponente. Si se toca un solo número de acá
 * **hay que subir `ID_VERSION_OFERTA`**: los expedientes ya guardados apuntan
 * a la versión vieja y su hash no se recalcula nunca.
 *
 * Módulo sin dependencias (ni siquiera `node:*`) a propósito: lo importan las
 * dos orillas —la pantalla de P2, que es un componente de cliente, y el caso
 * de uso del servidor que calcula el hash (`seleccion-plan.ts`)—. El SHA-256
 * se calcula allá, con `node:crypto`, para no arrastrar módulos de Node al
 * bundle del navegador.
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

// ---------------------------------------------------------------------------
// Oferta versionada
// ---------------------------------------------------------------------------

export const NOMBRE_PRODUCTO = "Seguro de Vida Oncológico CONFÍO";

/**
 * Identificador de esta versión de la oferta. Se persiste en el expediente
 * (`PlanSeleccionado.idVersionOferta`) y viaja a la evidencia de P2.
 *
 * **Subir la versión ante cualquier cambio de importes, coberturas o del
 * conjunto de planes ofrecidos.** No es un número de build: es la identidad
 * de lo que se le mostró al proponente.
 */
export const ID_VERSION_OFERTA = "OFERTA-CONFIO-v1";

export interface OfertaVersionada {
  readonly idVersion: string;
  readonly producto: string;
  /** Fecha desde la que rige esta versión de la tabla (ISO 8601, YYYY-MM-DD). */
  readonly vigenteDesde: string;
  readonly moneda: "PYG";
  /** Los planes en el orden en que se presentan, que es el orden que se hashea. */
  readonly planes: readonly Plan[];
}

export const OFERTA_VIGENTE: OfertaVersionada = {
  idVersion: ID_VERSION_OFERTA,
  producto: NOMBRE_PRODUCTO,
  vigenteDesde: "2026-01-01",
  moneda: "PYG",
  planes: ORDEN_PLANES.map((id) => PLANES[id]),
};

/**
 * Representación canónica de una versión de la oferta: es exactamente lo que
 * se hashea con SHA-256 en `seleccion-plan.ts`.
 *
 * Se arma a mano en vez de con `JSON.stringify` porque el hash tiene que ser
 * reproducible por un tercero (un perito, una auditoría de Alianza) años
 * después: el orden de las claves de un objeto no es un contrato, este
 * formato sí. Cada línea es legible y verificable a ojo contra la tabla de
 * `docs/ESPECIFICACION_PANTALLAS.md`.
 *
 * Cambiar este formato invalida los hashes ya guardados: si alguna vez hay
 * que tocarlo, se versiona el formato, no se reescribe la evidencia.
 */
export function serializarOfertaCanonica(oferta: OfertaVersionada = OFERTA_VIGENTE): string {
  const cabecera = [
    `oferta=${oferta.idVersion}`,
    `producto=${oferta.producto}`,
    `vigenteDesde=${oferta.vigenteDesde}`,
    `moneda=${oferta.moneda}`,
  ];

  const filas = oferta.planes.map((plan) =>
    [
      `plan=${plan.id}`,
      `nombre=${plan.nombre}`,
      `muerte=${plan.muerteCualquierCausaGs}`,
      `cancer=${plan.indemnizacionCancerGs}`,
      `rentaTotal=${plan.rentaHospitalariaTotalGs}`,
      `rentaDia=${plan.rentaHospitalariaPorDiaGs}`,
      `gastosAccidente=${plan.gastosMedicosAccidenteGs}`,
      `premioAnual=${plan.premioAnualGs}`,
    ].join("|"),
  );

  return [...cabecera, ...filas].join("\n");
}

// ---------------------------------------------------------------------------
// Selector de producto de P2
// ---------------------------------------------------------------------------

/**
 * Las cuatro opciones del selector `¿Qué seguro estás buscando?` de P2. Solo
 * CONFÍO está disponible; las otras tres se muestran con etiqueta
 * `PRÓXIMAMENTE` y deshabilitadas.
 *
 * Queda fuera de `OfertaVersionada` —y por lo tanto fuera del hash— a
 * propósito: habilitar un producto nuevo en el futuro no debe invalidar los
 * hashes de las ofertas de CONFÍO ya firmadas.
 */
export interface OpcionProducto {
  readonly id: string;
  readonly nombre: string;
  readonly disponible: boolean;
}

export const PRODUCTOS: readonly OpcionProducto[] = [
  { id: "VIDA_ONCOLOGICO", nombre: "Seguro de Vida Oncológico", disponible: true },
  { id: "VIDA", nombre: "Seguro de Vida", disponible: false },
  { id: "ACCIDENTES_PERSONALES", nombre: "Accidentes Personales", disponible: false },
  { id: "RESPONSABILIDAD_CIVIL", nombre: "Responsabilidad Civil", disponible: false },
];

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

/** Gs. 475.000 → "Gs. 475.000". Separador de miles con punto, como en la especificación. */
export function formatearGuaranies(monto: number): string {
  return `Gs. ${monto.toLocaleString("es-PY").replace(/,/g, ".")}`;
}

/** `true` si el valor es uno de los tres `PlanId` del catálogo. */
export function esPlanId(valor: unknown): valor is PlanId {
  return typeof valor === "string" && valor in PLANES;
}
