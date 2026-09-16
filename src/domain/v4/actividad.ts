/**
 * Caso de uso de **03E · Actividad, ingresos y condición PEP** (flujo v4).
 *
 * ## La regla que gobierna la pantalla
 *
 * Responder **Sí** a la condición PEP **no rechaza nada**: detiene la emisión
 * automática y manda el caso a revisión manual, con su número, sin firma y sin
 * cobro. Lo dicen el manual, el arte (`03E_15`, aviso rojo) y la matriz de
 * cumplimiento (fila 19: derivar una respuesta PEP a análisis reforzado).
 *
 * La garantía de que no se cobra ni se firma **no la da esta función**: la da
 * el grafo de estados, donde `DERIVADO_MANUAL` no tiene salidas. Acá solo se
 * elige el destino.
 *
 * ## Por qué la validación está en el dominio
 *
 * Porque estos ocho campos son el bloque laboral y económico del FIPF (Res.
 * SEPRELAD 71/19, art. 26) y lo que entre acá se imprime en un documento que
 * se firma. El formulario del navegador no puede decidirlo.
 */
import { randomUUID } from "node:crypto";
import type { EvidenceStore } from "../../ports/evidence-store";
import { generarNumeroCaso } from "../declaraciones-p6";
import { registrarActividadV4 } from "../expediente";
import type { ActividadEconomicaV4, Expediente, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal-whatsapp";
import {
  ACTIVIDADES_ECONOMICAS_V4,
  OCUPACIONES_V4,
  ORIGENES_INGRESOS_V4,
  PROFESIONES_V4,
  SITUACIONES_LABORALES_V4,
  exigeEmpresaV4,
} from "./catalogos-03e";

export const PASO_EVIDENCIA_ACTIVIDAD_V4 = "V4_03E_ACTIVIDAD_INGRESOS";

export interface DependenciasActividadV4 {
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
  readonly nuevoNumeroCaso?: () => string;
}

export interface EntradaActividadV4 {
  readonly expedienteId: string;
  readonly situacionLaboral: string;
  readonly actividadEconomica: string;
  readonly ocupacion: string;
  readonly profesion: string;
  readonly empresa?: string;
  /** Tal como lo escribió la persona; se interpreta acá. */
  readonly ingresoMensualDeclarado: string;
  readonly origenIngresos: string;
  /** `null` mientras no se haya respondido: la pantalla no deja continuar así. */
  readonly esPep: boolean | null;
  readonly contexto: ContextoPeticion;
}

export type MotivoRechazoActividadV4 =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "DOMICILIO_FALTANTE"
  | "CAMPOS_INVALIDOS";

export type ResultadoActividadV4 =
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly estado: Expediente["estado"];
      readonly actividad: ActividadEconomicaV4;
      /** Presente solo cuando la respuesta PEP derivó el caso. */
      readonly numeroCasoDerivacion?: string;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoActividadV4;
      readonly camposInvalidos?: readonly string[];
    };

const ESTADO_REQUERIDO: Expediente["estado"] = "IDENTIDAD_VERIFICADA";

function formatearDetalle(datos: Readonly<Record<string, string | number | boolean>>): string {
  return Object.entries(datos)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(" · ");
}

/**
 * `Gs. 9.500.000`, `9500000`, `9.500.000` → 9500000. Devuelve `null` si no es
 * un entero positivo: un ingreso negativo o con letras no es un dato del FIPF.
 */
export function interpretarIngresoV4(texto: string): number | null {
  const limpio = texto.replace(/[^\d-]/g, "");
  if (limpio === "" || limpio.includes("-")) return null;
  const numero = Number(limpio);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

export async function registrarActividad(
  deps: DependenciasActividadV4,
  entrada: EntradaActividadV4,
): Promise<ResultadoActividadV4> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const nuevoId = deps.nuevoId ?? (() => randomUUID());
  const nuevoNumeroCaso = deps.nuevoNumeroCaso ?? (() => generarNumeroCaso());
  const fecha = ahora();

  const camposInvalidos: string[] = [];
  if (!SITUACIONES_LABORALES_V4.includes(entrada.situacionLaboral)) {
    camposInvalidos.push("situacionLaboral");
  }
  if (!ACTIVIDADES_ECONOMICAS_V4.includes(entrada.actividadEconomica)) {
    camposInvalidos.push("actividadEconomica");
  }
  if (!OCUPACIONES_V4.includes(entrada.ocupacion)) camposInvalidos.push("ocupacion");
  if (!PROFESIONES_V4.includes(entrada.profesion)) camposInvalidos.push("profesion");
  if (!ORIGENES_INGRESOS_V4.includes(entrada.origenIngresos)) camposInvalidos.push("origenIngresos");

  // Empresa: obligatoria solo para las dos situaciones que tienen empleador.
  const empresa = (entrada.empresa ?? "").trim();
  const necesitaEmpresa = exigeEmpresaV4(entrada.situacionLaboral);
  if (necesitaEmpresa && empresa === "") camposInvalidos.push("empresa");

  const ingreso = interpretarIngresoV4(entrada.ingresoMensualDeclarado);
  if (ingreso === null) camposInvalidos.push("ingresoMensualDeclarado");

  // Sin respuesta PEP no se avanza: es el dato que decide el destino del caso.
  if (entrada.esPep === null) camposInvalidos.push("esPep");

  if (camposInvalidos.length > 0 || ingreso === null || entrada.esPep === null) {
    return { ok: false, motivo: "CAMPOS_INVALIDOS", camposInvalidos };
  }

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };
  if (expediente.estado !== ESTADO_REQUERIDO) return { ok: false, motivo: "ESTADO_INVALIDO" };
  if (!expediente.datosPersonales) return { ok: false, motivo: "DOMICILIO_FALTANTE" };

  const actividad: ActividadEconomicaV4 = {
    situacionLaboral: entrada.situacionLaboral,
    actividadEconomica: entrada.actividadEconomica,
    ocupacion: entrada.ocupacion,
    profesion: entrada.profesion,
    empresa: necesitaEmpresa ? empresa : empresa === "" ? null : empresa,
    ingresoMensualDeclaradoGs: ingreso,
    origenIngresos: entrada.origenIngresos,
    esPep: entrada.esPep,
  };

  const numeroCasoDerivacion = entrada.esPep ? nuevoNumeroCaso() : undefined;

  const resultado = registrarActividadV4(
    expediente,
    { actividad, ...(numeroCasoDerivacion ? { numeroCasoDerivacion } : {}) },
    fecha,
  );

  if (!resultado.ok) {
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  const registro: RegistroEvidencia = {
    id: nuevoId(),
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_ACTIVIDAD_V4,
    fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado: "EXITOSO",
    // **La condición PEP no viaja a la evidencia como dato de la persona**: lo
    // que se registra es la consecuencia —si el caso se derivó— y el número de
    // caso. Es el mismo criterio que la regla inviolable #7 aplica a la salud.
    detalle: formatearDetalle({
      estado: resultado.expediente.estado,
      derivadoARevision: Boolean(numeroCasoDerivacion),
      ...(numeroCasoDerivacion ? { numeroCaso: numeroCasoDerivacion } : {}),
    }),
  };

  await deps.expedientes.guardar(resultado.expediente, expediente.actualizadoEn);
  await deps.evidencias.guardar(registro);

  return {
    ok: true,
    expedienteId: expediente.id,
    estado: resultado.expediente.estado,
    actividad,
    ...(numeroCasoDerivacion ? { numeroCasoDerivacion } : {}),
  };
}
