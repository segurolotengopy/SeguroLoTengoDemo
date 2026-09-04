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

// ---------------------------------------------------------------------------
// Parametrización por entorno (pedido expreso de la revisión de gerencia)
// ---------------------------------------------------------------------------

/**
 * Nombres y premios editables **sin tocar código**: se sobrescriben por
 * variable de entorno y se cambian desde la consola de Amplify (más un
 * redeploy, porque Next.js los congela al compilar).
 *
 *   NEXT_PUBLIC_PLAN_CONFIO_NOMBRE / _PREMIO_GS
 *   NEXT_PUBLIC_PLAN_CONFIO_PLUS_NOMBRE / _PREMIO_GS
 *   NEXT_PUBLIC_PLAN_CONFIO_TOTAL_NOMBRE / _PREMIO_GS
 *
 * `NEXT_PUBLIC_` y lectura escrita a mano, variable por variable: el selector
 * corre en el navegador y Next solo inyecta las expresiones estáticas (misma
 * regla que en `entidades.ts`). Sin variable, valen los montos de la Matriz V4
 * (D-04). **El premio sobrescrito es el que se cobra**: el importe de Bancard
 * y el desglose salen de esta misma tabla, así que la pantalla y el cobro no
 * pueden divergir. La sobreescritura queda capturada por `hashOfertaSha256`,
 * que se calcula sobre la tabla efectiva.
 */
function nombreDeEntorno(valor: string | undefined, porDefecto: string): string {
  const limpio = valor?.trim();
  return limpio ? limpio : porDefecto;
}

function premioDeEntorno(valor: string | undefined, porDefecto: number): number {
  const numero = Number(valor?.trim());
  return Number.isInteger(numero) && numero > 0 ? numero : porDefecto;
}

export const PLANES: Readonly<Record<PlanId, Plan>> = {
  CONFIO: {
    id: "CONFIO",
    nombre: nombreDeEntorno(process.env.NEXT_PUBLIC_PLAN_CONFIO_NOMBRE, "CONFÍO"),
    muerteCualquierCausaGs: 3_500_000,
    indemnizacionCancerGs: 50_000_000,
    rentaHospitalariaTotalGs: 7_500_000,
    rentaHospitalariaPorDiaGs: 500_000,
    gastosMedicosAccidenteGs: 7_000_000,
    premioAnualGs: premioDeEntorno(process.env.NEXT_PUBLIC_PLAN_CONFIO_PREMIO_GS, 319_000),
  },
  CONFIO_PLUS: {
    id: "CONFIO_PLUS",
    nombre: nombreDeEntorno(process.env.NEXT_PUBLIC_PLAN_CONFIO_PLUS_NOMBRE, "CONFÍO+"),
    muerteCualquierCausaGs: 5_000_000,
    indemnizacionCancerGs: 75_000_000,
    rentaHospitalariaTotalGs: 11_250_000,
    rentaHospitalariaPorDiaGs: 750_000,
    gastosMedicosAccidenteGs: 10_000_000,
    premioAnualGs: premioDeEntorno(process.env.NEXT_PUBLIC_PLAN_CONFIO_PLUS_PREMIO_GS, 522_500),
  },
  CONFIO_TOTAL: {
    id: "CONFIO_TOTAL",
    nombre: nombreDeEntorno(process.env.NEXT_PUBLIC_PLAN_CONFIO_TOTAL_NOMBRE, "CONFÍO TOTAL"),
    muerteCualquierCausaGs: 7_000_000,
    indemnizacionCancerGs: 100_000_000,
    rentaHospitalariaTotalGs: 15_000_000,
    rentaHospitalariaPorDiaGs: 1_000_000,
    gastosMedicosAccidenteGs: 14_000_000,
    premioAnualGs: premioDeEntorno(process.env.NEXT_PUBLIC_PLAN_CONFIO_TOTAL_PREMIO_GS, 726_000),
  },
};

/** Orden de presentación en P2, de menor a mayor cobertura. */
export const ORDEN_PLANES: readonly PlanId[] = ["CONFIO", "CONFIO_PLUS", "CONFIO_TOTAL"];

// ---------------------------------------------------------------------------
// Oferta versionada
// ---------------------------------------------------------------------------

export const NOMBRE_PRODUCTO = "Seguro de Vida Oncológico CONFÍO";

/**
 * Identificación del producto ante la Superintendencia de Seguros (CHG-03).
 *
 * La Res. SS.SG. 215/17 exige que la propuesta lleve la denominación del plan
 * (Anexo, num. 11.2) y que la póliza cite el código y el acto administrativo
 * de inscripción (punto 9.d y num. 9.13.19) más una URL directa al modelo
 * inscripto (punto 9.f). Los datos oficiales llegaron con la **Nota SS.SG.
 * N.º 397/2026** del 7 de agosto de 2026 (`docs/RegistrosOficiales/`): el plan
 * quedó inscripto en la sección Seguro de Vida de Corto Plazo con el código
 * **15-VI.0002**, y su denominación registral no es el nombre comercial.
 *
 * Por eso hay dos nombres y los dos se imprimen: `NOMBRE_PRODUCTO` es la
 * marca (Res. 190/2025 y Circular 011/2025) y `denominacionRegistral` es lo
 * que la SIS inscribió. Confundirlos en un documento sería citar un plan que
 * no existe con ese nombre.
 *
 * Lo único que sigue pendiente es `urlModelo`: la dirección del modelo
 * inscripto en el sitio de Alianza (punto 9.f), sin la cual queda en `null`
 * y no se inventa. `esProvisional` dejó de ser `true` el 04-sep-2026 (D-26).
 *
 * Cambiar estos valores cambia los bytes de los PDF que los imprimen: los
 * documentos ya cerrados conservan su huella (reglas #4 y #10); los nuevos
 * nacen con el código real.
 */
export interface RegistroProducto {
  /** Denominación con la que la SIS inscribió el plan (num. 11.2). */
  readonly denominacionRegistral: string;
  /** Código de registro del plan (punto 9.d). */
  readonly codigo: string;
  /** Acto administrativo que lo inscribe, tal como se cita en la póliza (num. 9.13.19). */
  readonly acto: string;
  /** Fecha del acto (ISO 8601, YYYY-MM-DD). */
  readonly actoFecha: string;
  /** URL directa al modelo inscripto en el sitio de la aseguradora (punto 9.f); `null` mientras Alianza no la pase. */
  readonly urlModelo: string | null;
  /** `true` solo mientras el código y el acto no fueran los oficiales. */
  readonly esProvisional: boolean;
}

/**
 * Alícuota del IVA con la que se arma el desglose **del demo**.
 *
 * En Paraguay los seguros tributan al 10% (Ley 6380/2019). Se usa acá para que
 * la pantalla de pago muestre números que cierran, no para afirmar cuánto
 * tributa este producto: el desglose oficial lo fija Alianza y sigue
 * pendiente (D-04).
 */
const ALICUOTA_IVA_DEMO = 0.1;

/**
 * `false` hasta que Alianza confirme la apertura prima neta / IVA (D-04). Antes
 * este flag se leía del registro del producto, y al llegar el código oficial
 * (D-26) habría dejado de rotular como provisional un desglose que sigue
 * siendo nuestro: son dos pendientes distintos, con dos banderas.
 */
const DESGLOSE_OFICIAL_DE_ALIANZA = false;

export interface DesglosePremio {
  readonly primaNetaGs: number;
  readonly ivaGs: number;
  readonly premioTotalGs: number;
  /** `true` mientras el desglose no venga de Alianza. */
  readonly esProvisional: boolean;
}

/**
 * Abre el premio total en prima neta más IVA (CHG-35).
 *
 * Hasta ahora la pantalla mostraba el rótulo "Valor oficial de Alianza" en
 * lugar de cada importe, porque la apertura no figura en ningún documento
 * fuente y calcular un 10% por cuenta propia habría sido inventar el contenido
 * de una factura. Para el demo hacen falta números que cierren, así que se
 * derivan del premio —que sí está en la matriz— y **el resultado se rotula
 * como provisional** en la pantalla.
 *
 * El IVA se calcula por diferencia y no multiplicando, para que la suma dé
 * exacta siempre: con 290.000 el redondeo de la prima dejaría 289.999 o
 * 290.001, y un total que no cierra en una pantalla de pago destruye la
 * confianza más rápido que cualquier otra cosa.
 */
export function desglosePremio(planId: PlanId): DesglosePremio {
  const premioTotalGs = PLANES[planId].premioAnualGs;
  const primaNetaGs = Math.round(premioTotalGs / (1 + ALICUOTA_IVA_DEMO));
  return {
    primaNetaGs,
    ivaGs: premioTotalGs - primaNetaGs,
    premioTotalGs,
    esProvisional: !DESGLOSE_OFICIAL_DE_ALIANZA,
  };
}

export const REGISTRO_PRODUCTO: RegistroProducto = {
  denominacionRegistral:
    "Seguro de Vida Individual con Indemnización Adicional por Diagnóstico de Cáncer",
  codigo: "15-VI.0002",
  acto: "Nota SS.SG. N.º 397/2026",
  actoFecha: "2026-08-07",
  urlModelo: null,
  esProvisional: false,
};

/**
 * Enlace del video informativo del paso 1 (maqueta p.1), parametrizable sin
 * tocar código: `NEXT_PUBLIC_VIDEO_INFORMATIVO_URL` (un enlace de YouTube).
 * Sin variable no hay enlace y el recuadro queda como marcador de demo — no se
 * enlaza un video inventado.
 */
export function urlVideoInformativo(): string | null {
  const valor = process.env.NEXT_PUBLIC_VIDEO_INFORMATIVO_URL?.trim();
  return valor ? valor : null;
}

/**
 * Documento de coberturas, exclusiones y condiciones que se enlaza por plan
 * (CHG-05, decisión D-15).
 *
 * En la reunión quedó abierto si son tres documentos o uno solo; Rodrigo se
 * inclinó por uno ("el mismo va a ser, yo creo") y la decisión fue dejarlo
 * **parametrizable**. Un `Record` por plan resuelve las dos formas sin cambiar
 * ninguna pantalla: hoy los tres apuntan al mismo documento; el día que Alianza
 * mande uno por plan, se cambian estas tres líneas.
 */
export const DOCUMENTO_COBERTURAS_POR_PLAN: Readonly<Record<PlanId, "coberturas">> = {
  CONFIO: "coberturas",
  CONFIO_PLUS: "coberturas",
  CONFIO_TOTAL: "coberturas",
};

/**
 * Identificador de esta versión de la oferta. Se persiste en el expediente
 * (`PlanSeleccionado.idVersionOferta`) y viaja a la evidencia de P2.
 *
 * **Subir la versión ante cualquier cambio de importes, coberturas o del
 * conjunto de planes ofrecidos.** No es un número de build: es la identidad
 * de lo que se le mostró al proponente.
 */
/**
 * v2 (20-ago-2026): los premios pasaron a ser los de `PantallasDemo2.pdf`
 * —319.000 / 522.500 / 726.000— por aprobación de gerencia. Los expedientes
 * que eligieron plan bajo la v1 conservan su premio y su hash, que no se
 * recalculan (regla inviolable #10).
 */
export const ID_VERSION_OFERTA = "OFERTA-CONFIO-v2";

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
  vigenteDesde: "2026-08-20",
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
