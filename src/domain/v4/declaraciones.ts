/**
 * Casos de uso de **04A · Datos y declaraciones** y **04D · Consentimientos**
 * (flujo v4).
 *
 * Son dos pantallas y un solo tramo: 04A recoge las tres declaraciones de
 * salud y el beneficiario, 04D los dos consentimientos, y el expediente llega
 * a `DECLARACIONES_OK` recién al final del segundo.
 *
 * ## Por qué la evaluación médica ocurre en 04A
 *
 * Porque es donde el arte la pone: `04A1 · Evaluación manual` se dispara desde
 * 04A, no desde 04D. Detener ahí es además lo correcto para la persona — no
 * tiene sentido pedirle dos consentimientos para un trámite que ya se detuvo.
 *
 * ## Regla inviolable #7, en los dos
 *
 * Ninguna respuesta médica ni la condición PEP salen de estos módulos hacia
 * ningún lado. Lo que va a la evidencia es **si el caso se derivó** y su
 * número, nunca qué se respondió. Es el mismo criterio de `declaraciones-p6.ts`.
 */
import { randomUUID } from "node:crypto";
import type { EvidenceStore } from "../../ports/evidence-store";
import { interpretarBeneficiarioP6 } from "../catalogo-p6";
import { generarNumeroCaso } from "../declaraciones-p6";
import { registrarConsentimientosV4, registrarDeclaracionesMedicasV4 } from "../expediente";
import { esRespuestaDeclaracion } from "../elegibilidad";
import type {
  DeclaracionesMedicasV4,
  Expediente,
  RegistroEvidencia,
  RespuestaDeclaracion,
} from "../tipos";
import { TEXTO_CONSENTIMIENTOS_04D, VERSION_CONSENTIMIENTOS_04D } from "./textos-consentimientos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal-whatsapp";

export const PASO_EVIDENCIA_DECLARACIONES_V4 = "V4_04A_DECLARACIONES_SALUD";
export const PASO_EVIDENCIA_CONSENTIMIENTOS_V4 = "V4_04D_CONSENTIMIENTOS";

export interface DependenciasDeclaracionesV4 {
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
  readonly nuevoNumeroCaso?: () => string;
}

const ESTADO_REQUERIDO: Expediente["estado"] = "IDENTIDAD_VERIFICADA";

function formatearDetalle(datos: Readonly<Record<string, string | number | boolean>>): string {
  return Object.entries(datos)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(" · ");
}

// ---------------------------------------------------------------------------
// 04A · declaraciones de salud y beneficiario
// ---------------------------------------------------------------------------

export interface EntradaDeclaracionesV4 {
  readonly expedienteId: string;
  /** Las tres respuestas, crudas: se validan acá. */
  readonly respuestas: Readonly<Record<string, unknown>>;
  /** Cuerpo crudo del beneficiario; lo interpreta el dominio. */
  readonly beneficiario: Readonly<Record<string, unknown>>;
  readonly contexto: ContextoPeticion;
}

export type MotivoRechazoDeclaracionesV4 =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "DECLARACIONES_INCOMPLETAS"
  | "BENEFICIARIO_INVALIDO";

export type ResultadoDeclaracionesV4 =
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly estado: Expediente["estado"];
      /** `true` si la evaluación médica derivó el caso a revisión. */
      readonly derivado: boolean;
      readonly numeroCasoDerivacion?: string;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoDeclaracionesV4;
      readonly camposInvalidos?: readonly string[];
    };

/** Las tres claves de 04A, en el orden en que la pantalla las muestra. */
const CLAVES_MEDICAS = [
  "estadoDeSalud",
  "antecedentesDeContratacion",
  "enfermedadesDiagnosticadas",
] as const;

export async function registrarDeclaracionesSalud(
  deps: DependenciasDeclaracionesV4,
  entrada: EntradaDeclaracionesV4,
): Promise<ResultadoDeclaracionesV4> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const nuevoId = deps.nuevoId ?? (() => randomUUID());
  const nuevoNumeroCaso = deps.nuevoNumeroCaso ?? (() => generarNumeroCaso());
  const fecha = ahora();

  const faltantes = CLAVES_MEDICAS.filter(
    (clave) => !esRespuestaDeclaracion(entrada.respuestas[clave]),
  );
  if (faltantes.length > 0) {
    return { ok: false, motivo: "DECLARACIONES_INCOMPLETAS", camposInvalidos: faltantes };
  }

  const beneficiario = interpretarBeneficiarioP6(entrada.beneficiario);
  if (!beneficiario.ok) {
    return { ok: false, motivo: "BENEFICIARIO_INVALIDO", camposInvalidos: beneficiario.camposInvalidos };
  }

  const declaracionesMedicas: DeclaracionesMedicasV4 = {
    estadoDeSalud: entrada.respuestas.estadoDeSalud as RespuestaDeclaracion,
    antecedentesDeContratacion: entrada.respuestas.antecedentesDeContratacion as RespuestaDeclaracion,
    enfermedadesDiagnosticadas: entrada.respuestas.enfermedadesDiagnosticadas as RespuestaDeclaracion,
  };

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };
  if (expediente.estado !== ESTADO_REQUERIDO) return { ok: false, motivo: "ESTADO_INVALIDO" };

  const numeroCaso = nuevoNumeroCaso();
  const resultado = registrarDeclaracionesMedicasV4(
    expediente,
    { declaracionesMedicas, beneficiario: beneficiario.beneficiario, numeroCasoDerivacion: numeroCaso },
    fecha,
  );
  if (!resultado.ok) return { ok: false, motivo: "ESTADO_INVALIDO" };

  const derivado = resultado.expediente.estado === "DERIVADO_MANUAL";

  const registro: RegistroEvidencia = {
    id: nuevoId(),
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_DECLARACIONES_V4,
    fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado: "EXITOSO",
    // Nunca las respuestas: solo el desenlace (regla inviolable #7).
    detalle: formatearDetalle({
      estado: resultado.expediente.estado,
      derivadoARevision: derivado,
      beneficiario: beneficiario.beneficiario.tipo,
      ...(derivado ? { numeroCaso } : {}),
    }),
  };

  await deps.expedientes.guardar(resultado.expediente, expediente.actualizadoEn);
  await deps.evidencias.guardar(registro);

  return {
    ok: true,
    expedienteId: expediente.id,
    estado: resultado.expediente.estado,
    derivado,
    ...(derivado ? { numeroCasoDerivacion: numeroCaso } : {}),
  };
}

// ---------------------------------------------------------------------------
// 04D · consentimientos
// ---------------------------------------------------------------------------

export interface EntradaConsentimientosV4 {
  readonly expedienteId: string;
  readonly aceptaInicioDeCoberturaYCarencias: boolean;
  readonly aceptaEntregaDigital: boolean;
  readonly contexto: ContextoPeticion;
}

export type MotivoRechazoConsentimientosV4 =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "CONSENTIMIENTOS_REQUERIDOS"
  | "DECLARACIONES_FALTANTES";

export type ResultadoConsentimientosV4 =
  | { readonly ok: true; readonly expedienteId: string; readonly estado: Expediente["estado"] }
  | { readonly ok: false; readonly motivo: MotivoRechazoConsentimientosV4 };

export async function registrarConsentimientos(
  deps: DependenciasDeclaracionesV4,
  entrada: EntradaConsentimientosV4,
): Promise<ResultadoConsentimientosV4> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const nuevoId = deps.nuevoId ?? (() => randomUUID());
  const nuevoNumeroCaso = deps.nuevoNumeroCaso ?? (() => generarNumeroCaso());
  const fecha = ahora();

  if (!entrada.aceptaInicioDeCoberturaYCarencias || !entrada.aceptaEntregaDigital) {
    return { ok: false, motivo: "CONSENTIMIENTOS_REQUERIDOS" };
  }

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };
  if (expediente.estado !== ESTADO_REQUERIDO) return { ok: false, motivo: "ESTADO_INVALIDO" };
  if (!expediente.declaracionesMedicas || !expediente.beneficiario) {
    return { ok: false, motivo: "DECLARACIONES_FALTANTES" };
  }

  const resultado = registrarConsentimientosV4(
    expediente,
    {
      aceptaInicioDeCoberturaYCarencias: entrada.aceptaInicioDeCoberturaYCarencias,
      aceptaEntregaDigital: entrada.aceptaEntregaDigital,
      numeroCasoDerivacion: nuevoNumeroCaso(),
    },
    fecha,
  );
  if (!resultado.ok) return { ok: false, motivo: "ESTADO_INVALIDO" };

  const registro: RegistroEvidencia = {
    id: nuevoId(),
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_CONSENTIMIENTOS_V4,
    fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    // Acá **sí** hay texto aceptado, y por eso queda entero con su versión:
    // es lo que la persona consintió, y el servidor lo pone —nunca el cuerpo
    // de la petición, que podría hacer constar otro.
    versionTextoAceptado: VERSION_CONSENTIMIENTOS_04D,
    textoAceptado: TEXTO_CONSENTIMIENTOS_04D,
    resultado: "EXITOSO",
    detalle: formatearDetalle({ estado: resultado.expediente.estado }),
  };

  await deps.expedientes.guardar(resultado.expediente, expediente.actualizadoEn);
  await deps.evidencias.guardar(registro);

  return { ok: true, expedienteId: expediente.id, estado: resultado.expediente.estado };
}
