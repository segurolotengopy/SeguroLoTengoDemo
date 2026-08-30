/**
 * Caso de uso de P6 · Datos y declaraciones
 * (docs/ESPECIFICACION_PANTALLAS.md → "P6 · Paso 6 de 9 — Datos y
 * declaraciones").
 *
 * Una sola operación: el botón `GUARDAR Y CONTINUAR →`. Valida los siete
 * campos complementarios y el beneficiario, exige las ocho respuestas, corre
 * el motor de elegibilidad y transiciona el expediente. No hay endpoint que
 * "guarde el borrador" ni que evalúe la elegibilidad por adelantado: el badge
 * de qué respuesta habilita ya está en la pantalla, así que no hace falta —y
 * no conviene— tener un camino por el que las respuestas médicas viajen sin
 * quedar asentadas.
 *
 * ## Las dos ramas (regla de negocio inviolable #5)
 *
 * - Las ocho compatibles → `DECLARACIONES_OK`, sigue a P7.
 * - Una incompatible en 1, 2, 3 u 8 → `DERIVADO_MANUAL`, se genera un número
 *   de caso **distinto del correlativo de la propuesta** y la pantalla
 *   redirige a la Pantalla A. Ese estado es terminal: `expediente.ts` no le
 *   define ninguna transición de salida, así que no existe forma —ni siquiera
 *   con una petición armada a mano— de llevarlo a pago, firma o emisión.
 *
 * Respaldo normativo de la derivación: fila 19 de `docs/Tabla Cumplimiento
 * SeguroLo Tengo - Tabla.csv` — "R2 - CONSENTIMIENTO, IDENTIFICACIÓN Y
 * REPUDIO", *"Derivar una respuesta PEP a análisis reforzado, sin rechazo
 * automático"*, Res. SEPRELAD 50/20, art. 7. Los literales de las ocho
 * declaraciones y su respaldo por fila están en `textos-p6.ts`.
 *
 * ## Aislamiento de los datos sensibles (regla de negocio inviolable #7)
 *
 * Las respuestas médicas (declaraciones 1, 2 y 3) y la condición PEP
 * (declaración 8) se persisten **únicamente** dentro del `Expediente`, que es
 * su lugar contractual: de ahí salen a la Solicitud y al FIPF. No salen a
 * ninguna otra parte:
 *
 * - **Evidencia:** el `RegistroEvidencia` de este paso no lleva ni una
 *   respuesta. Lleva el resultado del motor —elegible sí/no—, los números de
 *   las declaraciones que bloquearon y el número de caso. Un número de
 *   declaración dice *cuál* pregunta frenó el caso, que es lo que la auditoría
 *   necesita para reconstruir la decisión; la respuesta concreta se queda en
 *   el expediente. Es exactamente lo que documenta `ESPECIFICACION_DEMO.md`
 *   para el recorrido "Salud incompatible".
 * - **Respuesta de la API:** `ResultadoP6` no tiene ningún campo donde pueda
 *   viajar una respuesta de vuelta al navegador. El motivo que ve la Pantalla
 *   A es la categoría gruesa (`SALUD` / `PEP` / `SALUD_Y_PEP`) que devuelve
 *   `clasificarMotivoDerivacion`, nunca el detalle.
 * - **Logs e instrumentación:** este módulo no escribe a `console` ni a
 *   ninguna otra instrumentación, y no debe hacerlo nunca. Si en el futuro se
 *   agrega Sentry, PostHog o cualquier traza, el objeto `Declaraciones` y los
 *   campos de salud/PEP quedan explícitamente fuera. `resumenSeguroP6` es la
 *   **única** proyección que puede salir de acá hacia cualquier destino que no
 *   sea el expediente. Ver `__tests__/declaraciones-p6.test.ts`, que lo
 *   verifica serializando todo lo que este módulo emite.
 *
 * Respaldo normativo del aislamiento: fila 21 — *"Proteger especialmente las
 * respuestas médicas y la información PEP"*, Ley 4868/13, arts. 6(a) y 7(b);
 * Res. SEPRELAD 71/19, art. 44.
 */
import { randomInt, randomUUID } from "node:crypto";
import type { EvidenceStore } from "../ports/evidence-store";
import { interpretarBeneficiarioP6 } from "./catalogo-p6";
import type { CampoP6 } from "./catalogo-p6";
import {
  clasificarMotivoDerivacion,
  evaluarElegibilidad,
  interpretarDeclaracionesP6,
} from "./elegibilidad";
import type { MotivoDerivacion } from "./elegibilidad";
import { expandirRespuestasV3, interpretarRespuestasV3 } from "./declaraciones-v3";
import type { ClaveRespuestaV3 } from "./declaraciones-v3";
import { registrarDeclaracionesP6 } from "./expediente";
import { flujoV3Activo } from "./flujo-vigente";
import { PANTALLA_POR_ESTADO } from "./rutas-flujo";
import { registrarRemisionFallida, remitirCasoAAlianza } from "./remision-alianza";
import { TEXTO_ACEPTACION_SEGURO, VERSION_ACEPTACION_SEGURO } from "./textos-seguro";
import { VERSION_TEXTOS_DECLARACIONES_P6 } from "./textos-p6";
import type { EstadoExpediente, Expediente, RegistroEvidencia } from "./tipos";
import type { ContextoPeticion, RepositorioExpediente } from "./verificacion-canal";

// ---------------------------------------------------------------------------
// Dependencias y constantes
// ---------------------------------------------------------------------------

export interface DependenciasP6 {
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
  /** Inyectable solo para que los tests puedan fijar el número de caso. */
  readonly nuevoNumeroCaso?: () => string;
}

/**
 * Único estado desde el que P6 puede operar.
 *
 * v3 (DI-2): las declaraciones viven en el paso 2 junto con el plan, así que
 * se responden con el plan ya elegido — la identidad quedó atrás, en el paso 1.
 */
export const ESTADO_REQUERIDO_P6: EstadoExpediente = flujoV3Activo()
  ? "PLAN_SELECCIONADO"
  : "IDENTIDAD_VERIFICADA";

/**
 * A dónde sigue quien queda elegible: la pantalla que contiene la firma, que
 * en v2 es `/firma` y en v3 la página larga del paso 3. Derivada del mapa
 * estado→pantalla para que siga al flag sola.
 */
export const RUTA_TRAS_DECLARACIONES = PANTALLA_POR_ESTADO.DECLARACIONES_OK;

export const PASO_EVIDENCIA_P6 = "P6_DATOS_Y_DECLARACIONES";

/**
 * Reexporta el catálogo y los textos para que el servidor tenga un solo punto
 * de entrada de P6. La pantalla los importa directamente de `catalogo-p6.ts` y
 * `textos-p6.ts`, que no arrastran `node:crypto` al bundle del navegador.
 */
export {
  ACTIVIDADES,
  CIUDADES,
  PARENTESCOS,
  PROFESIONES,
  SITUACIONES_LABORALES,
  interpretarBeneficiarioP6,
} from "./catalogo-p6";
export type { CampoP6 } from "./catalogo-p6";

// ---------------------------------------------------------------------------
// Número de caso de revisión manual
// ---------------------------------------------------------------------------

export const PREFIJO_NUMERO_CASO = "CASO";

/**
 * Genera el número de caso de la Pantalla A: `CASO-2026-418302`.
 *
 * **Por qué este formato:** la especificación solo exige que sea *"distinto
 * del correlativo de una propuesta o póliza"* (Pantalla A) y la consola
 * administrativa espera poder distinguirlo de `PROP-xxxxx` y `FIPF-xxxxx`
 * (`docs/CONSOLA_ADMINISTRATIVA.md`). El prefijo propio y un espacio de
 * numeración separado cumplen las dos cosas. El formato exacto es decisión de
 * producto: no tiene fila en la matriz de cumplimiento.
 *
 * Los seis dígitos salen de `randomInt` (CSPRNG) y no de un contador: en el
 * demo no hay secuencia central, y un correlativo adivinable expondría cuántos
 * casos derivados existen. La consola busca por número exacto, no por rango.
 */
export function generarNumeroCaso(ahora: Date = new Date()): string {
  const secuencia = String(randomInt(0, 1_000_000)).padStart(6, "0");
  return `${PREFIJO_NUMERO_CASO}-${ahora.getUTCFullYear()}-${secuencia}`;
}

// ---------------------------------------------------------------------------
// Entrada y resultado
// ---------------------------------------------------------------------------

export interface EntradaP6 {
  readonly expedienteId: string;
  /**
   * Cuerpo crudo del beneficiario por fallecimiento: se interpreta y valida en
   * el dominio. Los datos laborales y económicos **ya no vienen por acá**: se
   * capturan en el paso 4, junto a la identidad (maqueta p.4).
   */
  readonly beneficiario: Readonly<Record<string, unknown>>;
  /** Respuestas del bloque 2, indexadas por número de declaración ("1".."8"). */
  readonly declaraciones: Readonly<Record<string, unknown>>;
  /**
   * v3 (lote F3) · las **cinco** respuestas de la pantalla del paso 2, por
   * clave (`salud`, `antecedentes`, `enfermedades`, `pep`, `carencias`). Con
   * el flag encendido este bloque reemplaza a `declaraciones`: el mapa 5→8
   * (`declaraciones-v3.ts`) las expande antes de tocar el motor.
   */
  readonly respuestasV3?: Readonly<Record<string, unknown>>;
  /** v3 · la casilla agrupada 2 (DI-8), fuente de las claves 5/6/7 del mapa. */
  readonly aceptacionPlan?: boolean;
  readonly contexto: ContextoPeticion;
}

export type MotivoRechazoP6 =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "DATOS_INCOMPLETOS"
  | "DECLARACIONES_INCOMPLETAS"
  // v3 · la casilla agrupada sin marcar: sin ella no hay claves 5/6/7.
  | "ACEPTACION_REQUERIDA"
  // v3 · la pregunta de carencias en No **bloquea sin derivar** (DI-3): es un
  // alto de la pantalla, no una declaración que entre al motor ni al PDF.
  | "CARENCIAS_NO_ACEPTADAS";

/**
 * Lo que devuelve el caso de uso. Deliberadamente **no tiene** ningún campo de
 * tipo `Declaraciones` ni `RespuestaDeclaracion`: las respuestas entran, se
 * persisten en el expediente y no vuelven a salir (regla inviolable #7).
 */
export type ResultadoP6 =
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly estado: EstadoExpediente;
      readonly elegibleParaEmisionAutomatica: true;
      /**
       * D-08 · se firma antes de pagar: el paso siguiente es el que contiene
       * la firma (`/firma` en v2, la página del paso 3 en v3).
       */
      readonly siguientePantalla: typeof RUTA_TRAS_DECLARACIONES;
    }
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly estado: EstadoExpediente;
      readonly elegibleParaEmisionAutomatica: false;
      /** Correlativo propio, distinto del de la propuesta. */
      readonly numeroCaso: string;
      readonly motivoDerivacion: MotivoDerivacion;
      /** Números de declaración (1, 2, 3 y/o 8), nunca sus respuestas. */
      readonly declaracionesQueBloquean: readonly number[];
      readonly siguientePantalla: "/revision-manual";
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoP6;
      readonly camposInvalidos?: readonly CampoP6[];
      readonly declaracionesSinResponder?: readonly number[];
      /** v3 · las claves de las cinco preguntas que faltan responder. */
      readonly respuestasSinResponderV3?: readonly ClaveRespuestaV3[];
    };

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

interface Reloj {
  readonly ahora: () => string;
  readonly nuevoId: () => string;
  readonly nuevoNumeroCaso: (fecha: string) => string;
}

function resolverReloj(deps: DependenciasP6): Reloj {
  const generadorInyectado = deps.nuevoNumeroCaso;
  return {
    ahora: deps.ahora ?? (() => new Date().toISOString()),
    nuevoId: deps.nuevoId ?? (() => randomUUID()),
    nuevoNumeroCaso: generadorInyectado
      ? () => generadorInyectado()
      : (fecha: string) => generarNumeroCaso(new Date(fecha)),
  };
}

/**
 * Única forma en la que información de este paso sale hacia la evidencia.
 *
 * Todo lo que devuelve es seguro de registrar: booleanos, números de
 * declaración, el número de caso y la versión de los literales. No existe una
 * rama por la que pueda entrar acá una respuesta `SI`/`NO`, ni el ingreso
 * declarado, ni el domicilio.
 */
export function resumenSeguroP6(entrada: {
  estado: EstadoExpediente;
  elegible: boolean;
  declaracionesQueBloquean: readonly number[];
  numeroCaso: string | null;
  motivoDerivacion: MotivoDerivacion | null;
}): Readonly<Record<string, string | number | boolean>> {
  return {
    estado: entrada.estado,
    elegible: entrada.elegible,
    // Cuál pregunta frenó el caso, nunca qué se respondió.
    ...(entrada.declaracionesQueBloquean.length > 0
      ? { declaracionesQueBloquean: entrada.declaracionesQueBloquean.join(",") }
      : {}),
    ...(entrada.numeroCaso ? { numeroCaso: entrada.numeroCaso } : {}),
    ...(entrada.motivoDerivacion ? { motivoDerivacion: entrada.motivoDerivacion } : {}),
  };
}

function formatearDetalle(datos: Readonly<Record<string, string | number | boolean>>): string {
  return Object.entries(datos)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(" · ");
}

async function registrarEvidencia(
  deps: DependenciasP6,
  reloj: Reloj,
  entrada: {
    expedienteId: string;
    fecha: string;
    contexto: ContextoPeticion;
    resultado: "EXITOSO" | "FALLIDO";
    detalle: Readonly<Record<string, string | number | boolean>>;
  },
): Promise<void> {
  const registro: RegistroEvidencia = {
    id: reloj.nuevoId(),
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_P6,
    fecha: entrada.fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    // v2: la versión de los literales de las ocho declaraciones (el texto
    // íntegro queda en la Solicitud y el FIPF, que se cierran y hashean en P8
    // — regla inviolable #4; duplicarlo acá solo agrandaría el registro).
    // v3: además de esa garantía, la persona marcó la casilla agrupada 2
    // (DI-8), y ese literal sí se asienta acá con su versión propia.
    versionTextoAceptado: flujoV3Activo()
      ? VERSION_ACEPTACION_SEGURO
      : VERSION_TEXTOS_DECLARACIONES_P6,
    textoAceptado: flujoV3Activo() ? TEXTO_ACEPTACION_SEGURO : null,
    resultado: entrada.resultado,
    detalle: formatearDetalle(entrada.detalle),
  };
  await deps.evidencias.guardar(registro);
}

// ---------------------------------------------------------------------------
// Caso de uso
// ---------------------------------------------------------------------------

/**
 * Botón `GUARDAR Y CONTINUAR →`.
 *
 * Las dos transiciones posibles del paso las ejecuta
 * `expediente.registrarDeclaracionesP6`, nunca el Route Handler ni este
 * módulo directamente.
 *
 * La validación se repite entera del lado del servidor aunque la pantalla ya
 * deshabilite el botón: el estado del formulario es del navegador y no puede
 * decidir qué entra al FIPF.
 */
export async function guardarDatosYDeclaracionesP6(
  deps: DependenciasP6,
  entrada: EntradaP6,
): Promise<ResultadoP6> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();

  const beneficiario = interpretarBeneficiarioP6(entrada.beneficiario);
  if (!beneficiario.ok) {
    return {
      ok: false,
      motivo: "DATOS_INCOMPLETOS",
      camposInvalidos: beneficiario.camposInvalidos,
    };
  }

  // v3 · la pantalla manda cinco respuestas y la casilla agrupada; el mapa
  // 5→8 las convierte en las ocho claves de siempre ANTES del intérprete: de
  // acá en adelante, el motor, el expediente y el PDF no distinguen versiones.
  let brutoDeclaraciones = entrada.declaraciones;
  if (flujoV3Activo()) {
    if (entrada.aceptacionPlan !== true) {
      return { ok: false, motivo: "ACEPTACION_REQUERIDA" };
    }
    const cinco = interpretarRespuestasV3(entrada.respuestasV3 ?? {});
    if (!cinco.ok) {
      return {
        ok: false,
        motivo: "DECLARACIONES_INCOMPLETAS",
        respuestasSinResponderV3: cinco.sinResponder,
      };
    }
    if (cinco.respuestas.carencias === "NO") {
      return { ok: false, motivo: "CARENCIAS_NO_ACEPTADAS" };
    }
    brutoDeclaraciones = expandirRespuestasV3(cinco.respuestas);
  }

  const declaraciones = interpretarDeclaracionesP6(brutoDeclaraciones);
  if (!declaraciones.ok) {
    return {
      ok: false,
      motivo: "DECLARACIONES_INCOMPLETAS",
      declaracionesSinResponder: declaraciones.sinResponder,
    };
  }

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };
  if (expediente.estado !== ESTADO_REQUERIDO_P6) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { motivo: "ESTADO_INVALIDO", estado: expediente.estado },
    });
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  const elegibilidad = evaluarElegibilidad(declaraciones.declaraciones);
  const elegible = elegibilidad.elegibleParaEmisionAutomatica;
  const numeroCaso = elegible ? null : reloj.nuevoNumeroCaso(fecha);
  const motivoDerivacion = clasificarMotivoDerivacion(elegibilidad.declaracionesQueBloquean);

  const transicion = registrarDeclaracionesP6(
    expediente,
    declaraciones.declaraciones,
    beneficiario.beneficiario,
    numeroCaso ?? "",
    fecha,
  );

  if (!transicion.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { motivo: "ESTADO_INVALIDO", estado: expediente.estado },
    });
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    fecha,
    contexto: entrada.contexto,
    // Una derivación no es un fallo del paso: el paso se completó y la
    // decisión quedó registrada. Lo que cambia es el estado resultante.
    resultado: "EXITOSO",
    detalle: resumenSeguroP6({
      estado: transicion.expediente.estado,
      elegible,
      declaracionesQueBloquean: elegibilidad.declaracionesQueBloquean,
      numeroCaso,
      motivoDerivacion,
    }),
  });

  if (elegible) {
    return {
      ok: true,
      expedienteId: entrada.expedienteId,
      estado: transicion.expediente.estado,
      elegibleParaEmisionAutomatica: true,
      siguientePantalla: RUTA_TRAS_DECLARACIONES,
    };
  }

  // CHG-47 · el caso se remite a Alianza en el mismo acto en que se deriva.
  // Antes dependía de que alguien lo empujara desde la consola, en un caso que
  // por definición ya salió del flujo automático.
  //
  // **Best-effort a propósito**: la derivación ya ocurrió y es terminal (regla
  // inviolable #5). Si la remisión falla, el expediente no vuelve atrás — lo
  // que queda es evidencia del fallo, visible en la consola, y el reenvío
  // manual que sigue estando ahí.
  try {
    await remitirCasoAAlianza(
      { evidencias: deps.evidencias, ahora: reloj.ahora, nuevoId: reloj.nuevoId },
      { expediente: transicion.expediente, contexto: entrada.contexto, origen: "AUTOMATICA" },
    );
  } catch (error) {
    await registrarRemisionFallida(
      { evidencias: deps.evidencias, ahora: reloj.ahora, nuevoId: reloj.nuevoId },
      {
        expediente: transicion.expediente,
        contexto: entrada.contexto,
        detalle: error instanceof Error ? error.message : "desconocido",
      },
    ).catch(() => {
      // Si tampoco se puede escribir la evidencia del fallo, no queda nada por
      // hacer acá: la derivación está guardada y la consola muestra el caso
      // igual, sin remisión registrada.
    });
  }

  return {
    ok: true,
    expedienteId: entrada.expedienteId,
    estado: transicion.expediente.estado,
    elegibleParaEmisionAutomatica: false,
    // `numeroCaso` y `motivoDerivacion` no pueden ser `null` en esta rama: los
    // dos se derivan de que `elegible` sea `false`. El `??` está solo para que
    // el tipo no dependa de esa inferencia.
    numeroCaso: numeroCaso ?? "",
    motivoDerivacion: motivoDerivacion ?? "SALUD",
    declaracionesQueBloquean: elegibilidad.declaracionesQueBloquean,
    siguientePantalla: "/revision-manual",
  };
}

// ---------------------------------------------------------------------------
// Lectura para la Pantalla A
// ---------------------------------------------------------------------------

export interface CasoDerivado {
  readonly numeroCaso: string;
  readonly motivo: MotivoDerivacion;
  readonly derivadoEn: string;
}

/**
 * Datos del bloque `CASO DERIVADO PARA ANÁLISIS` de la Pantalla A. Devuelve
 * `null` si el expediente no está derivado — no hay forma de pedirle un número
 * de caso a un expediente que sigue en el flujo normal.
 */
export function leerCasoDerivado(expediente: Expediente): CasoDerivado | null {
  if (expediente.estado !== "DERIVADO_MANUAL") return null;
  if (!expediente.numeroCasoDerivacion) return null;

  const motivo = clasificarMotivoDerivacion(expediente.motivoDerivacionManual ?? []);
  if (!motivo) return null;

  const entradaDerivacion = [...expediente.historial]
    .reverse()
    .find((entrada) => entrada.estado === "DERIVADO_MANUAL");

  return {
    numeroCaso: expediente.numeroCasoDerivacion,
    motivo,
    derivadoEn: entradaDerivacion?.en ?? expediente.actualizadoEn,
  };
}
