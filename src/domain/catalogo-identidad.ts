/**
 * Piezas de P5 que necesitan las dos orillas: el componente de cliente de la
 * pantalla y el caso de uso del servidor (`verificacion-identidad.ts`, que las
 * reexporta). Módulo sin dependencias a propósito —ni siquiera `node:*`— para
 * que la pantalla no arrastre `node:crypto` al bundle del navegador, igual que
 * `textos-p3.ts` con P3.
 *
 * Contiene las opciones de los dos únicos campos que la persona completa a
 * mano en P5 —`PAÍS DE NACIMIENTO` y `ESTADO CIVIL`— y la lista de los cinco
 * requisitos para continuar (docs/ESPECIFICACION_PANTALLAS.md → "P5 · Paso 5
 * de 9", bloque 2: *"Campos obligatorios que el usuario sí completa: PAÍS DE
 * NACIMIENTO y ESTADO CIVIL (ambos selectores)"*).
 *
 * Los dos alimentan el FIPF (`docs/FIPF.pdf`, bloque 1 "Datos personales y
 * canales verificados", campos `PAÍS DE NACIMIENTO` y `ESTADO CIVIL`), que es
 * la fuente de verdad de que existen y son obligatorios. Lo que el FIPF **no**
 * fija es la lista de valores: ni ese formulario ni la matriz de cumplimiento
 * enumeran opciones, así que el contenido concreto de estas dos listas es una
 * decisión de producto/UX, no una obligación legal.
 *
 * Cuando el proyecto salga del modo demo conviene reemplazar `PAISES_NACIMIENTO`
 * por la lista completa de ISO 3166-1 y dejar de ofrecer "Otro": hoy es una
 * lista corta y navegable en celular, coherente con un piloto local.
 */

export const PAIS_NACIMIENTO_POR_DEFECTO = "Paraguay";

export const PAISES_NACIMIENTO: readonly string[] = [
  "Paraguay",
  "Argentina",
  "Bolivia",
  "Brasil",
  "Chile",
  "Colombia",
  "Ecuador",
  "España",
  "Estados Unidos",
  "Perú",
  "Uruguay",
  "Venezuela",
  "Otro",
];

export const ESTADOS_CIVILES: readonly string[] = [
  "Soltero/a",
  "Casado/a",
  "Unión de hecho",
  "Separado/a",
  "Divorciado/a",
  "Viudo/a",
];

export function esPaisNacimiento(valor: unknown): valor is string {
  return typeof valor === "string" && PAISES_NACIMIENTO.includes(valor);
}

export function esEstadoCivil(valor: unknown): valor is string {
  return typeof valor === "string" && ESTADOS_CIVILES.includes(valor);
}

// ---------------------------------------------------------------------------
// Capturas y requisitos para continuar
// ---------------------------------------------------------------------------

/** Las tres tarjetas del bloque 1: frente, dorso y selfie en vivo. */
export type TipoCapturaP5 = "FRENTE" | "DORSO" | "SELFIE";

/**
 * Bloque `REQUISITOS PARA CONTINUAR` de la especificación, en el mismo orden:
 * cédula vigente y legible · frente y dorso aprobados · prueba de vida
 * aprobada · coincidencia facial · país y estado civil completos.
 */
export interface RequisitosP5 {
  readonly cedulaVigenteYLegible: boolean;
  readonly frenteYDorsoAprobados: boolean;
  readonly pruebaDeVidaAprobada: boolean;
  readonly coincidenciaFacial: boolean;
  readonly paisYEstadoCivilCompletos: boolean;
}

export type IdRequisitoP5 = keyof RequisitosP5;

export const REQUISITOS_P5: readonly { readonly id: IdRequisitoP5; readonly rotulo: string }[] = [
  { id: "cedulaVigenteYLegible", rotulo: "Cédula vigente y legible" },
  { id: "frenteYDorsoAprobados", rotulo: "Frente y dorso aprobados" },
  { id: "pruebaDeVidaAprobada", rotulo: "Prueba de vida aprobada" },
  { id: "coincidenciaFacial", rotulo: "Coincidencia facial" },
  { id: "paisYEstadoCivilCompletos", rotulo: "País y estado civil completos" },
];

export function requisitosPendientes(requisitos: RequisitosP5): readonly IdRequisitoP5[] {
  return REQUISITOS_P5.filter(({ id }) => !requisitos[id]).map(({ id }) => id);
}

export function todosLosRequisitosCumplidos(requisitos: RequisitosP5): boolean {
  return requisitosPendientes(requisitos).length === 0;
}
