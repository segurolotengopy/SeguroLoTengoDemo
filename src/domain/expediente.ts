/**
 * Máquina de estados del Expediente (CLAUDE.md, sección "Máquina de estados
 * del expediente"). Esta es la única función de transición: ningún Route
 * Handler ni componente debe cambiar `estado` directamente.
 *
 *   INICIADO → CANAL_WA_VERIFICADO → PLAN_SELECCIONADO → AUTORIZADO
 *     → CANAL_EMAIL_VERIFICADO → IDENTIDAD_VERIFICADA
 *        ├─ DERIVADO_MANUAL (terminal) → Pantalla A
 *        └─ DECLARACIONES_OK → PAGO_CONFIRMADO → PAQUETE_GENERADO
 *               ├─ VENCIDO → DEVOLUCION_EN_TRAMITE → Pantalla B
 *               └─ FIRMADO → EMITIDO → P9
 */
import type { DatosComplementariosP6, Declaraciones, EstadoExpediente, Expediente } from "./tipos";
import { ESTADOS_TERMINALES } from "./tipos";
import { evaluarElegibilidad } from "./elegibilidad";

/** Grafo de transiciones legales: única fuente de verdad de la máquina de estados. */
const TRANSICIONES_LEGALES: Readonly<Record<EstadoExpediente, readonly EstadoExpediente[]>> = {
  INICIADO: ["CANAL_WA_VERIFICADO"],
  CANAL_WA_VERIFICADO: ["PLAN_SELECCIONADO"],
  // El autobucle es el enlace `Cambiar plan` de la barra de plan seleccionado
  // (docs/ESPECIFICACION_PANTALLAS.md → "Elementos comunes"): volver a P2 y
  // elegir otro plan antes de la autorización de P3. No agrega ningún estado
  // alcanzable nuevo —desde acá se sigue saliendo solo a AUTORIZADO— y cada
  // re-selección queda como una entrada más del historial append-only.
  PLAN_SELECCIONADO: ["PLAN_SELECCIONADO", "AUTORIZADO"],
  AUTORIZADO: ["CANAL_EMAIL_VERIFICADO"],
  CANAL_EMAIL_VERIFICADO: ["IDENTIDAD_VERIFICADA"],
  IDENTIDAD_VERIFICADA: ["DERIVADO_MANUAL", "DECLARACIONES_OK"],
  // Terminal en el flujo digital (regla de negocio #5): no hay transición
  // posible desde acá hacia pago, firma ni emisión.
  DERIVADO_MANUAL: [],
  DECLARACIONES_OK: ["PAGO_CONFIRMADO"],
  PAGO_CONFIRMADO: ["PAQUETE_GENERADO"],
  PAQUETE_GENERADO: ["VENCIDO", "FIRMADO"],
  VENCIDO: ["DEVOLUCION_EN_TRAMITE"],
  DEVOLUCION_EN_TRAMITE: [],
  FIRMADO: ["EMITIDO"],
  EMITIDO: [],
};

export type ResultadoTransicion =
  | { readonly ok: true; readonly expediente: Expediente }
  | { readonly ok: false; readonly error: string };

export function transicionesLegalesDesde(estado: EstadoExpediente): readonly EstadoExpediente[] {
  return TRANSICIONES_LEGALES[estado];
}

export function esTransicionLegal(desde: EstadoExpediente, hacia: EstadoExpediente): boolean {
  return TRANSICIONES_LEGALES[desde].includes(hacia);
}

export function esEstadoTerminal(estado: EstadoExpediente): boolean {
  return ESTADOS_TERMINALES.includes(estado);
}

type CambiosExpediente = Partial<
  Omit<Expediente, "id" | "estado" | "historial" | "creadoEn" | "actualizadoEn">
>;

/**
 * Única función que puede cambiar el estado de un Expediente. Valida la
 * transición contra el grafo antes de aplicar cualquier cambio; nunca muta
 * el objeto recibido y nunca modifica ni borra entradas previas del
 * historial (regla de negocio #10, append-only).
 */
export function transicionarExpediente(
  expediente: Expediente,
  estadoDestino: EstadoExpediente,
  cambios: CambiosExpediente = {},
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (!esTransicionLegal(expediente.estado, estadoDestino)) {
    return {
      ok: false,
      error: `Transición ilegal: no se puede pasar de ${expediente.estado} a ${estadoDestino}.`,
    };
  }

  return {
    ok: true,
    expediente: {
      ...expediente,
      ...cambios,
      estado: estadoDestino,
      historial: [...expediente.historial, { estado: estadoDestino, en: ahora }],
      actualizadoEn: ahora,
    },
  };
}

/**
 * Punto único de entrada para el registro de declaraciones de P6. Aplica el
 * motor de elegibilidad y decide la transición: una declaración incompatible
 * en 1, 2, 3 u 8 deriva a DERIVADO_MANUAL en vez de DECLARACIONES_OK (regla
 * de negocio #5). Como DERIVADO_MANUAL no tiene transiciones legales de
 * salida, ningún llamador posterior puede llevar este expediente a pago,
 * firma ni emisión.
 *
 * `numeroCasoDerivacion` se recibe ya generado (el generador vive en
 * `declaraciones-p6.ts`, que sí puede usar `node:crypto`) y **solo se escribe
 * si la derivación efectivamente ocurre**: un expediente elegible no puede
 * quedar con un número de caso colgado, aunque el llamador pase uno. Al revés
 * también está cerrado: derivar sin número de caso es un error de programación
 * y no se persiste.
 */
export function registrarDeclaracionesP6(
  expediente: Expediente,
  declaraciones: Declaraciones,
  datosComplementarios: DatosComplementariosP6,
  numeroCasoDerivacion: string,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  const resultado = evaluarElegibilidad(declaraciones);

  if (resultado.elegibleParaEmisionAutomatica) {
    return transicionarExpediente(
      expediente,
      "DECLARACIONES_OK",
      { declaraciones, datosComplementarios, motivoDerivacionManual: null, numeroCasoDerivacion: null },
      ahora,
    );
  }

  if (numeroCasoDerivacion.trim() === "") {
    return { ok: false, error: "Una derivación a DERIVADO_MANUAL requiere un número de caso." };
  }

  return transicionarExpediente(
    expediente,
    "DERIVADO_MANUAL",
    {
      declaraciones,
      datosComplementarios,
      motivoDerivacionManual: resultado.declaracionesQueBloquean,
      numeroCasoDerivacion,
    },
    ahora,
  );
}
