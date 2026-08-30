/**
 * Caso de uso de P3 · Preparación y autorización inicial
 * (docs/ESPECIFICACION_PANTALLAS.md → "P3 · Paso 3 de 9").
 *
 * P3 no pide ni un solo dato: lo único que produce es el **consentimiento
 * inicial** (fila 11 de la matriz de cumplimiento — Ley 4868/13, arts. 6(c) y
 * 7(r); Constitución Nacional, arts. 33 y 36). Este módulo lo registra en los
 * dos lugares que hacen falta:
 *
 * 1. **En el expediente** (`AutorizacionInicial`), como estado actual: texto
 *    completo, versión, IP, dispositivo, sesión y timestamp. Se escribe una
 *    sola vez porque PLAN_SELECCIONADO → AUTORIZADO no tiene autobucle.
 * 2. **En el `EvidenceStore`**, que es append-only por construcción: el
 *    puerto no declara borrado ni actualización (`src/ports/evidence-store.ts`)
 *    y la implementación DynamoDB además hace el `PutItem` condicionado a que
 *    la clave no exista. Ni un bug que reutilice un id puede pisar un
 *    registro anterior.
 *
 * El literal aceptado NO se reconstruye desde el cuerpo de la petición: lo
 * pone el servidor desde `textos-p3.ts`. Si viniera del navegador, cualquiera
 * podría hacer constar que aceptó un texto distinto del que se le mostró.
 *
 * Este módulo importa `node:crypto`; la pantalla lee el literal desde
 * `textos-p3.ts`, que no tiene dependencias.
 */
import { randomUUID } from "node:crypto";
import type { EvidenceStore } from "../ports/evidence-store";
import { transicionarExpediente } from "./expediente";
import { flujoV3Activo } from "./flujo-vigente";
import {
  TEXTO_ACEPTACION_INSCRIPCION,
  VERSION_ACEPTACION_INSCRIPCION,
} from "./textos-inscripcion";
import { TEXTO_AUTORIZACION_INICIAL_P3, VERSION_AVISO_P3 } from "./textos-p3";
import type { AutorizacionInicial, Expediente, RegistroEvidencia } from "./tipos";
import type { ContextoPeticion, RepositorioExpediente } from "./verificacion-canal-whatsapp";

export { TEXTO_AUTORIZACION_INICIAL_P3, VERSION_AVISO_P3 };

/**
 * Qué literal firma la autorización según la versión del flujo (lote F2).
 *
 * En v3 la autorización es la **aceptación agrupada** del paso 1 (DI-8, siete
 * ítems de `textos-inscripcion.ts`); en v2 sigue siendo el aviso de P3. La
 * transición (`CANAL_WA_VERIFICADO → AUTORIZADO`) y el endpoint no cambian:
 * cambia qué texto queda asentado con qué versión — mismo patrón de selección
 * a import-time que las constantes del lote F1.
 */
export const TEXTO_AUTORIZACION_VIGENTE = flujoV3Activo()
  ? TEXTO_ACEPTACION_INSCRIPCION
  : TEXTO_AUTORIZACION_INICIAL_P3;

export const VERSION_AUTORIZACION_VIGENTE = flujoV3Activo()
  ? VERSION_ACEPTACION_INSCRIPCION
  : VERSION_AVISO_P3;

export const PASO_EVIDENCIA_AUTORIZACION_INICIAL = "P3_AUTORIZACION_INICIAL";

export interface DependenciasP3 {
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

export type MotivoRechazoAutorizacion =
  | "AUTORIZACION_REQUERIDA"
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO";

export type ResultadoAutorizacionInicial =
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly estado: Expediente["estado"];
      readonly autorizacion: AutorizacionInicial;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoAutorizacion;
    };

export interface EntradaAutorizacionInicial {
  readonly expedienteId: string;
  /**
   * Confirmación explícita de que se presionó `TENGO TODO LISTO`. No trae el
   * texto: el que vale es el del servidor.
   */
  readonly aceptada: boolean;
  readonly contexto: ContextoPeticion;
}

function formatearDetalle(datos: Readonly<Record<string, string | number>>): string {
  return Object.entries(datos)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(" · ");
}

/**
 * Botón `TENGO TODO LISTO →` de P3.
 *
 * No contrata ni autoriza un pago: solo habilita el tratamiento de datos y
 * deja el expediente en AUTORIZADO, listo para la verificación de correo de
 * P4.
 */
export async function registrarAutorizacionInicial(
  deps: DependenciasP3,
  entrada: EntradaAutorizacionInicial,
): Promise<ResultadoAutorizacionInicial> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const nuevoId = deps.nuevoId ?? (() => randomUUID());
  const fecha = ahora();

  if (!entrada.aceptada) {
    return { ok: false, motivo: "AUTORIZACION_REQUERIDA" };
  }

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) {
    return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };
  }

  const autorizacion: AutorizacionInicial = {
    aceptadaEn: fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionAviso: VERSION_AUTORIZACION_VIGENTE,
    textoAceptado: TEXTO_AUTORIZACION_VIGENTE,
  };

  const transicion = transicionarExpediente(expediente, "AUTORIZADO", { autorizacionInicial: autorizacion }, fecha);

  const registro: RegistroEvidencia = {
    id: nuevoId(),
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_AUTORIZACION_INICIAL,
    fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: VERSION_AUTORIZACION_VIGENTE,
    textoAceptado: TEXTO_AUTORIZACION_VIGENTE,
    resultado: transicion.ok ? "EXITOSO" : "FALLIDO",
    detalle: transicion.ok
      ? formatearDetalle({ estado: "AUTORIZADO" })
      : formatearDetalle({ motivo: "ESTADO_INVALIDO", estado: expediente.estado }),
  };

  if (!transicion.ok) {
    await deps.evidencias.guardar(registro);
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);
  await deps.evidencias.guardar(registro);

  return {
    ok: true,
    expedienteId: expediente.id,
    estado: transicion.expediente.estado,
    autorizacion,
  };
}
