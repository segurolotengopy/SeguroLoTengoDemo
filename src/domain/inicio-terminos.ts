/**
 * Caso de uso del inicio del flujo v3 · Aceptación de Términos y condiciones
 * (DI-10, Bloque E de docs/plan/DECISIONES.md; docs/ESPECIFICACION_PANTALLAS.md
 * → "Inicio").
 *
 * Es el acto que **crea el expediente**: la casilla de T&C del inicio deja el
 * trámite en `INICIADO` con evidencia de fecha, hora, IP, dispositivo, sesión
 * y versión del texto aceptado (regla inviolable #10). En v2 no existe — ahí
 * el expediente nace al elegir plan (`seleccion-plan.ts`) — así que el caso de
 * uso **rechaza operar sin el flag**: un despliegue v2 no puede acumular
 * expedientes en `INICIADO` que su flujo no sabe retomar.
 *
 * Mientras la página `/inicio` no exista (lote F5), la casilla vive como
 * bloque de entrada provisional arriba de `/inscripcion`; el caso de uso y el
 * endpoint son los definitivos y no se mueven con ella.
 *
 * El literal aceptado NO se reconstruye desde el cuerpo de la petición: lo
 * pone el servidor desde `textos-inicio.ts` (mismo criterio que
 * `autorizacion-inicial.ts`).
 */
import { randomUUID } from "node:crypto";
import type { EvidenceStore } from "../ports/evidence-store";
import { flujoV3Activo } from "./flujo-vigente";
import { TEXTO_TERMINOS_INICIO, VERSION_TERMINOS_INICIO } from "./textos-inicio";
import { crearExpedienteInicial } from "./tipos";
import type { AutorizacionInicial, Expediente, RegistroEvidencia } from "./tipos";
import type { ContextoPeticion, RepositorioExpediente } from "./verificacion-canal-whatsapp";

export { TEXTO_TERMINOS_INICIO, VERSION_TERMINOS_INICIO };

export const PASO_EVIDENCIA_TERMINOS_INICIO = "INICIO_TERMINOS_ACEPTADOS";

export interface DependenciasInicio {
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

export type MotivoRechazoTerminos =
  | "ACEPTACION_REQUERIDA"
  // El flujo v2 no tiene este acto: su expediente nace al elegir plan.
  | "FLUJO_NO_DISPONIBLE"
  // Ya hay un trámite en esta sesión: se retoma, no se duplica.
  | "EXPEDIENTE_YA_EXISTE";

export type ResultadoTerminosIniciales =
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly estado: Expediente["estado"];
      readonly aceptacion: AutorizacionInicial;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoTerminos;
    };

export interface EntradaTerminosIniciales {
  /**
   * Id del expediente de la cookie, si la sesión ya tiene uno. Con un trámite
   * empezado no se crea otro: la pantalla reencamina.
   */
  readonly expedienteId: string | null;
  /** Confirmación explícita de la casilla. No trae el texto: vale el del servidor. */
  readonly aceptada: boolean;
  readonly contexto: ContextoPeticion;
}

/**
 * Casilla de T&C + botón `Tocá acá para empezar →` del inicio.
 *
 * Crea el expediente en `INICIADO` y deja la evidencia del consentimiento.
 * No contrata, no firma y no autoriza ningún pago.
 */
export async function aceptarTerminosIniciales(
  deps: DependenciasInicio,
  entrada: EntradaTerminosIniciales,
): Promise<ResultadoTerminosIniciales> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const nuevoId = deps.nuevoId ?? (() => randomUUID());
  const fecha = ahora();

  if (!flujoV3Activo()) {
    return { ok: false, motivo: "FLUJO_NO_DISPONIBLE" };
  }
  if (!entrada.aceptada) {
    return { ok: false, motivo: "ACEPTACION_REQUERIDA" };
  }
  if (entrada.expedienteId !== null) {
    const existente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
    if (existente) {
      return { ok: false, motivo: "EXPEDIENTE_YA_EXISTE" };
    }
    // Cookie huérfana (base reiniciada, expediente purgado): se empieza de
    // nuevo, que es lo que la persona vino a hacer.
  }

  const aceptacion: AutorizacionInicial = {
    aceptadaEn: fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionAviso: VERSION_TERMINOS_INICIO,
    textoAceptado: TEXTO_TERMINOS_INICIO,
  };

  const expediente: Expediente = {
    ...crearExpedienteInicial({ id: nuevoId(), ahora: fecha }),
    terminosIniciales: aceptacion,
  };
  await deps.expedientes.crear(expediente);

  const registro: RegistroEvidencia = {
    id: nuevoId(),
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_TERMINOS_INICIO,
    fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: VERSION_TERMINOS_INICIO,
    textoAceptado: TEXTO_TERMINOS_INICIO,
    resultado: "EXITOSO",
    detalle: "estado=INICIADO",
  };
  await deps.evidencias.guardar(registro);

  return {
    ok: true,
    expedienteId: expediente.id,
    estado: expediente.estado,
    aceptacion,
  };
}
