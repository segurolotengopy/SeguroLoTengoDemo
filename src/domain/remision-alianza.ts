/**
 * Remisión de un caso al área de análisis de Alianza (CHG-47).
 *
 * Existía como **acción manual de la consola**: alguien del staff abría el
 * expediente derivado y apretaba "enviar a Alianza". Eso deja la remisión
 * dependiendo de que una persona se acuerde, en un caso que por definición ya
 * salió del flujo automático. CHG-47 la automatiza: la derivación por
 * elegibilidad (regla inviolable #5) remite el caso sola, en el mismo acto en
 * que se deriva.
 *
 * La acción de la consola **no desaparece**: sigue siendo la vía para reenviar
 * un caso cuando el envío automático falló, o cuando Alianza pide el caso de
 * nuevo. Las dos entran por acá, y por eso este módulo existe: cuando eran dos
 * implementaciones, la evidencia de una remisión automática y la de una manual
 * podían no parecerse.
 *
 * ## El origen viaja a la evidencia
 *
 * `AUTOMATICA` o `CONSOLA`, igual que `OrigenConfirmacionFirma` en CHG-33.
 * *"¿este caso salió solo o alguien lo empujó?"* es una pregunta de auditoría:
 * un expediente derivado hace tres días cuya única remisión es de ayer y
 * manual cuenta una historia distinta de uno que se remitió al derivarse.
 *
 * ## Qué NO viaja
 *
 * **Ninguna respuesta médica ni la condición PEP.** El asunto lleva la
 * referencia del caso y el estado, y nada más — es una comunicación saliente y
 * la regla inviolable #7 no hace excepción por el destinatario. Quien analiza
 * el caso lo abre en la consola, que es la única excepción autorizada a esa
 * regla. Ni siquiera va el **motivo** de la derivación: saber que un caso es
 * "de salud" ya dice algo de la persona, y no hace falta para que el buzón lo
 * enrute.
 *
 * ## En el demo no sale ningún correo
 *
 * La remisión se materializa como evidencia append-only en el expediente, que
 * es lo que la consola puede auditar. El día que salga de verdad va por
 * `MessagingProvider` —el puerto ya existe (ítem 34)— y este módulo no cambia:
 * cambia quién lo entrega.
 */
import { randomUUID } from "node:crypto";
import type { EvidenceStore } from "../ports/evidence-store";
import { codigoSolicitud } from "./documentos";
import type { Expediente, RegistroEvidencia } from "./tipos";
import type { ContextoPeticion } from "./verificacion-canal";

/**
 * Buzón simulado del área de casos de Alianza. En el demo no sale ningún
 * correo real.
 */
export const DESTINATARIO_CASOS_ALIANZA = "casos@alianzagarantia.com.py";

/**
 * Conserva el nombre que tenía cuando la remisión era solo una acción de la
 * consola (`ADMIN_…`), aunque ahora también salga sola.
 *
 * Renombrarlo habría sido más prolijo y peor: hay expedientes con evidencia
 * guardada bajo este paso, y cambiarlo haría que el mismo hecho —el caso se
 * remitió— apareciera con dos nombres según cuándo ocurrió. La evidencia es
 * append-only (regla inviolable #10) y eso incluye cómo se llama lo que ya se
 * escribió. Quién lo disparó lo dice `origen`, que es el dato que faltaba.
 */
export const PASO_EVIDENCIA_REMISION_ALIANZA = "ADMIN_ENVIO_CASO_ALIANZA";

/** Por dónde se decidió remitir el caso. Pregunta de auditoría, no de depuración. */
export type OrigenRemision = "AUTOMATICA" | "CONSOLA";

export interface DependenciasRemision {
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

export interface RemisionRealizada {
  readonly destinatario: string;
  readonly asunto: string;
  readonly enviadoEn: string;
  readonly referencia: string;
  readonly origen: OrigenRemision;
}

/**
 * Cómo se nombra el caso hacia afuera.
 *
 * El número de caso de derivación primero, porque es el que Alianza usa; el
 * correlativo de la propuesta después, para los expedientes que llegaron a
 * tenerlo; y el id como último recurso. Nunca la cédula ni el nombre.
 */
export function referenciaDelCaso(expediente: Expediente): string {
  if (expediente.numeroCasoDerivacion) return expediente.numeroCasoDerivacion;
  if (expediente.numeroPropuesta) return codigoSolicitud(expediente.numeroPropuesta);
  return expediente.id;
}

/**
 * Asienta la remisión del caso.
 *
 * Trabaja sobre un expediente **ya leído** y no lo modifica: remitir un caso no
 * cambia su estado. `DERIVADO_MANUAL` sigue siendo terminal (regla inviolable
 * #5) y remitirlo dos veces no lo mueve de ahí.
 */
export async function remitirCasoAAlianza(
  deps: DependenciasRemision,
  entrada: {
    readonly expediente: Expediente;
    readonly contexto: ContextoPeticion;
    readonly origen: OrigenRemision;
  },
): Promise<RemisionRealizada> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const nuevoId = deps.nuevoId ?? (() => randomUUID());
  const fecha = ahora();

  const referencia = referenciaDelCaso(entrada.expediente);
  const asunto = `Caso ${referencia} · ${entrada.expediente.estado}`;

  const evidencia: RegistroEvidencia = {
    id: nuevoId(),
    expedienteId: entrada.expediente.id,
    paso: PASO_EVIDENCIA_REMISION_ALIANZA,
    fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado: "EXITOSO",
    detalle:
      `destinatario=${DESTINATARIO_CASOS_ALIANZA} · asunto=${asunto} · ` +
      `origen=${entrada.origen} · envío simulado (demo)`,
  };
  await deps.evidencias.guardar(evidencia);

  return {
    destinatario: DESTINATARIO_CASOS_ALIANZA,
    asunto,
    enviadoEn: fecha,
    referencia,
    origen: entrada.origen,
  };
}

/**
 * Registra que la remisión automática no se pudo hacer.
 *
 * Existe para que el fallo sea **visible en la consola** en vez de silencioso:
 * un caso derivado que nunca llegó a Alianza es exactamente lo que CHG-47 vino
 * a evitar, y la salida es el reenvío manual, que sigue estando.
 *
 * No se reintenta automáticamente y es una decisión: en el demo el "envío" es
 * una escritura de evidencia, así que si falla es porque falló la base — y en
 * ese caso el reintento tampoco va a andar. Cuando la remisión salga de verdad
 * por `MessagingProvider`, hereda los reintentos de ese despachador.
 */
export async function registrarRemisionFallida(
  deps: DependenciasRemision,
  entrada: {
    readonly expediente: Expediente;
    readonly contexto: ContextoPeticion;
    readonly detalle: string;
  },
): Promise<void> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const nuevoId = deps.nuevoId ?? (() => randomUUID());

  const evidencia: RegistroEvidencia = {
    id: nuevoId(),
    expedienteId: entrada.expediente.id,
    paso: PASO_EVIDENCIA_REMISION_ALIANZA,
    fecha: ahora(),
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado: "FALLIDO",
    detalle:
      `referencia=${referenciaDelCaso(entrada.expediente)} · origen=AUTOMATICA · ` +
      `detalle=${entrada.detalle} · reenviable desde la consola`,
  };
  await deps.evidencias.guardar(evidencia);
}
