/**
 * Persona de prueba activa del panel de demo y escenario de identidad (P5).
 *
 * CLAUDE.md → "Panel de demo": el panel permite *"elegir persona de prueba"* y
 * *"forzar fallos puntuales"*. Este módulo es donde vive esa elección, en
 * memoria del proceso, y es lo único que los adaptadores `mock` consultan para
 * saber a quién están simulando.
 *
 * Dos niveles, en este orden:
 *
 * 1. **La persona activa manda.** Su desenlace de P5 se deriva de los datos
 *    que ya tiene en `personas.ts` (`escenarioIdentidadDe`): no se declara dos
 *    veces la misma verdad. Si mañana se agrega una persona con la coincidencia
 *    facial en `false` o con una fecha de nacimiento fuera del rango 18-64, su
 *    escenario sale solo.
 * 2. **El escenario forzado, si lo hay, pisa a la persona.** Es la palanca de
 *    "forzar fallos puntuales" del panel: sirve para mostrar en la demo un
 *    rechazo de calidad o una edad fuera de rango sin inventar personas nuevas
 *    (las cinco están fijadas en CLAUDE.md).
 *
 * Igual que el registro de OTP del panel, esto es memoria del proceso, no
 * base: en un despliegue con varias instancias cada una tiene su selección.
 * Es aceptable porque es una ayuda de demostración, no parte del flujo ni de
 * la evidencia probatoria.
 */
import { edadEnRangoPermitido } from "../../domain/tipos";
import { estadoCompartidoDemo } from "./estado-compartido";
import { obtenerPersonaDemo, PERSONAS_DEMO } from "./personas";
import type { IdPersonaDemo, PersonaDemo } from "./personas";

/**
 * Los cuatro desenlaces posibles de P5 en modo demo.
 *
 * `EDAD_FUERA_DE_RANGO` no es un rechazo del proveedor: el proveedor extrae la
 * fecha de nacimiento y es el dominio el que aplica la regla inviolable #8
 * (18-64 años, verificada contra la cédula). Acá se modela como escenario
 * porque lo que cambia es el dato que devuelve el OCR simulado.
 */
export type EscenarioIdentidadDemo =
  | "APROBADO"
  | "CALIDAD_INSUFICIENTE"
  | "EDAD_FUERA_DE_RANGO"
  | "NO_COINCIDE_CARA";

export const ESCENARIOS_IDENTIDAD_DEMO: readonly EscenarioIdentidadDemo[] = [
  "APROBADO",
  "CALIDAD_INSUFICIENTE",
  "EDAD_FUERA_DE_RANGO",
  "NO_COINCIDE_CARA",
];

/** Rótulos para el panel; no se usan en el flujo P0–P9. */
export const ROTULO_ESCENARIO_IDENTIDAD: Readonly<Record<EscenarioIdentidadDemo, string>> = {
  APROBADO: "Aprobado",
  CALIDAD_INSUFICIENTE: "Calidad insuficiente",
  EDAD_FUERA_DE_RANGO: "Edad fuera del rango 18-64",
  NO_COINCIDE_CARA: "No coincide la cara",
};

export const ID_PERSONA_POR_DEFECTO: IdPersonaDemo = "camino-feliz";

export interface SeleccionDemo {
  readonly personaId: IdPersonaDemo;
  /** `null` = el escenario que corresponde a la persona activa. */
  readonly escenarioIdentidadForzado: EscenarioIdentidadDemo | null;
}

const SELECCION_INICIAL: SeleccionDemo = {
  personaId: ID_PERSONA_POR_DEFECTO,
  escenarioIdentidadForzado: null,
};

const caja = estadoCompartidoDemo("persona-activa.seleccion", () => ({
  seleccion: SELECCION_INICIAL,
}));

export function obtenerSeleccionDemo(): SeleccionDemo {
  return caja.seleccion;
}

export function fijarSeleccionDemo(nueva: SeleccionDemo): void {
  caja.seleccion = nueva;
}

/** Deja la selección como al arrancar el proceso (camino feliz, sin forzados). */
export function reiniciarSeleccionDemo(): void {
  caja.seleccion = SELECCION_INICIAL;
}

/** La persona activa; si el id guardado ya no existe, cae al camino feliz. */
export function personaActiva(): PersonaDemo {
  const persona = obtenerPersonaDemo(caja.seleccion.personaId) ?? obtenerPersonaDemo(ID_PERSONA_POR_DEFECTO);
  if (!persona) {
    // Imposible salvo que alguien borre el fixture del camino feliz; mejor
    // fallar acá que simular a nadie.
    throw new Error("No hay ninguna persona de prueba disponible en src/adapters/mock/personas.ts.");
  }
  return persona;
}

/**
 * Desenlace de P5 que corresponde a una persona, derivado de sus propios
 * datos: la captura biométrica del fixture y su fecha de nacimiento. No hay
 * una tabla aparte que pueda quedar desincronizada.
 */
export function escenarioIdentidadDe(
  persona: PersonaDemo,
  fechaReferencia: Date = new Date(),
): EscenarioIdentidadDemo {
  if (!edadEnRangoPermitido(persona.identidad.fechaNacimiento, fechaReferencia)) {
    return "EDAD_FUERA_DE_RANGO";
  }
  if (!persona.identidad.captura.coincidenciaFacialAprobada) return "NO_COINCIDE_CARA";
  return "APROBADO";
}

/** Escenario efectivo: el forzado por el panel si existe, si no el de la persona. */
export function escenarioIdentidadActivo(fechaReferencia: Date = new Date()): EscenarioIdentidadDemo {
  return caja.seleccion.escenarioIdentidadForzado ?? escenarioIdentidadDe(personaActiva(), fechaReferencia);
}

export function esIdPersonaDemo(valor: unknown): valor is IdPersonaDemo {
  return PERSONAS_DEMO.some((persona) => persona.id === valor);
}

export function esEscenarioIdentidadDemo(valor: unknown): valor is EscenarioIdentidadDemo {
  return ESCENARIOS_IDENTIDAD_DEMO.some((escenario) => escenario === valor);
}
