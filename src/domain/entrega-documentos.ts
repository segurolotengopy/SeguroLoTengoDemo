/**
 * Entrega de los documentos por los canales verificados (CHG-44, CMP-05, D-18).
 *
 * Cuando el expediente llega a `EMITIDO`, la persona ya tiene los documentos
 * para descargar en la pantalla. Esto es lo otro que la matriz pide: que los
 * documentos **le lleguen** a los canales que verificó, y que quede registrado
 * el medio de recepción **y el acuse** (CMP-05).
 *
 * ## La máquina de la entrega
 *
 *   PENDIENTE ──envío aceptado──▶ ENVIADO ──acuse del proveedor──▶ ACUSADO
 *       │                             │
 *       ├─ falla transitoria ─┐       └─ el proveedor reporta que no llegó ─┐
 *       │   (otro intento)    │                                             │
 *       └─ intentos agotados ─┴─────────────▶ FALLIDO ◀─────────────────────┘
 *
 * `ENVIADO` y `ACUSADO` son **dos cosas distintas**, y ese es el punto de todo
 * el módulo: el proveedor acepta un mensaje mucho antes de que llegue, y a
 * veces no llega nunca. Colapsarlos —dar por acusado lo que solo fue aceptado—
 * dejaría a CMP-05 cumplido de mentira.
 *
 * `ACUSADO` significa *"el proveedor confirmó la recepción"*, nunca *"la
 * persona lo leyó"*. La Matriz §9 es explícita: se registra **puesto a
 * disposición**, no leído.
 *
 * ## Lo que este módulo no hace, a propósito
 *
 * **No controla la secuencia del negocio.** El despachador corre *después* de
 * que el expediente fue emitido; no cobra, no firma, no emite, y no hay estado
 * del expediente que dependa de que la entrega salga bien. Es la regla
 * transversal de `docs/SeguroLoTengo-integraciones-externas-alta-resolucion.pdf`:
 * *"no usar automatizaciones administrativas para controlar la secuencia
 * crítica pago → firma → emisión"*. Una entrega fallida es un problema de
 * comunicación, no de contrato: los documentos siguen descargables.
 *
 * **No es una cola.** En el demo el despachador se invoca desde la pantalla de
 * confirmación —que ya sondea— y es re-invocable: cada pasada procesa lo que
 * está vencido. En producción esto va detrás de una cola administrada (SQS) y
 * el módulo no cambia: lo que cambia es quién llama a `despacharEntregas`.
 */
import { randomUUID } from "node:crypto";
import type {
  CanalEntrega,
  DocumentoAdjunto,
  MessagingProvider,
} from "../ports/messaging-provider";
import type { EvidenceStore } from "../ports/evidence-store";
import { PLANES } from "./catalogo";
import { formatearInstante } from "./certificado-cobertura";
import { enmascararCorreo } from "./correo";
import { enmascararCelular } from "./telefono";
import type { Expediente, RegistroEvidencia } from "./tipos";
import type { ContextoPeticion } from "./verificacion-canal";

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------

export type EstadoEntrega = "PENDIENTE" | "ENVIADO" | "ACUSADO" | "FALLIDO";

/** Estados desde los que ya no hay nada más que intentar. */
const TERMINALES: readonly EstadoEntrega[] = ["ACUSADO", "FALLIDO"];

export interface EntregaDeDocumentos {
  readonly expedienteId: string;
  readonly canal: CanalEntrega;
  /** Nunca el destino completo: la evidencia y la pantalla ven el enmascarado. */
  readonly destinoEnmascarado: string;
  /** Códigos de los documentos que van adjuntos. */
  readonly documentos: readonly string[];
  readonly estado: EstadoEntrega;
  /** Envíos intentados, incluido el que está en curso. */
  readonly intentos: number;
  /** Cuándo corresponde el próximo intento; `null` en los estados terminales. */
  readonly proximoIntentoEn: string | null;
  readonly referenciaEnvio: string | null;
  readonly creadaEn: string;
  readonly enviadaEn: string | null;
  readonly acusadaEn: string | null;
  readonly ultimoError: string | null;
}

/**
 * Espera antes de cada reintento, en milisegundos.
 *
 * Creciente y con techo: un proveedor caído no se arregla martillándolo, y una
 * persona que espera sus documentos tampoco quiere enterarse cuatro horas
 * después de que nunca salieron. Cinco intentos cubren poco más de cinco horas
 * de caída, que es mucho más de lo que dura un incidente de mensajería.
 */
export const ESPERAS_REINTENTO_MS: readonly number[] = [
  60_000, // 1 minuto
  300_000, // 5 minutos
  900_000, // 15 minutos
  3_600_000, // 1 hora
];

export const MAX_INTENTOS = ESPERAS_REINTENTO_MS.length + 1;

export const PASO_EVIDENCIA_ENTREGA = "P9_ENTREGA_DOCUMENTOS";

// ---------------------------------------------------------------------------
// El mensaje que acompaña a los documentos (D-18)
// ---------------------------------------------------------------------------

/**
 * Redacción adoptada por D-18, palabra por palabra.
 *
 * Las 48 horas de la póliza **no son** las 24 del inicio de cobertura y no hay
 * contradicción: una cosa es cuándo empieza a responder la aseguradora y otra
 * cuándo llega el papel que lo documenta. El mensaje dice las dos, en ese
 * orden, porque quien lo recibe necesita saber sobre todo la primera.
 */
export function mensajeDeEntrega(entrada: {
  readonly nombre: string;
  readonly plan: string;
  readonly inicioCobertura: string;
}): string {
  const [fecha, hora] = formatearInstante(entrada.inicioCobertura).split(" ");
  return (
    `¡Hola, ${entrada.nombre}! Tu seguro ${entrada.plan} ya está en marcha. ` +
    "Te adjuntamos el Certificado de Cobertura Provisional: tu cobertura comienza el " +
    `${fecha} a las ${hora}, 24 horas después de tu pago. ` +
    "La póliza y la factura electrónica te van a llegar por este mismo canal y por correo " +
    "dentro de las próximas 48 horas, emitidas por Alianza Garantía Seguros y Reaseguros S.A. " +
    "Guardá este documento: es tu respaldo desde el primer día. " +
    "— Interseguros S.A., Corredores de Seguros"
  );
}

// ---------------------------------------------------------------------------
// Dependencias
// ---------------------------------------------------------------------------

/** Persistencia de los registros de entrega. Implementada en `src/repositories/`. */
export interface RepositorioEntregas {
  obtenerPorExpediente(expedienteId: string): Promise<readonly EntregaDeDocumentos[]>;
  guardar(entrega: EntregaDeDocumentos): Promise<void>;
}

/**
 * Los archivos que se adjuntan, ya verificados contra la huella registrada.
 *
 * Entra inyectado y no importado por el mismo motivo que el emisor del
 * certificado en P7: quien los lee vive en `src/documentos/` y en
 * `src/repositories/`, y que el dominio los importara cerraría un ciclo.
 */
export type LectorDeAdjuntos = (
  expediente: Expediente,
) => Promise<
  | { readonly ok: true; readonly adjuntos: readonly DocumentoAdjunto[] }
  | { readonly ok: false; readonly detalle: string }
>;

export interface DependenciasEntrega {
  readonly mensajeria: MessagingProvider;
  readonly entregas: RepositorioEntregas;
  readonly evidencias: EvidenceStore;
  readonly adjuntos: LectorDeAdjuntos;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

// ---------------------------------------------------------------------------
// Programación
// ---------------------------------------------------------------------------

export type MotivoNoProgramada =
  | "EXPEDIENTE_SIN_EMITIR"
  | "SIN_CANALES_VERIFICADOS"
  | "SIN_CERTIFICADO";

/**
 * Crea los registros de entrega del expediente, uno por canal verificado.
 *
 * **Idempotente**: si ya existen, no toca nada. La pantalla de confirmación la
 * llama en cada carga, así que tiene que ser inofensiva de repetir.
 *
 * Exige el certificado: es el documento que D-18 anuncia en el mensaje, y un
 * mensaje que prometiera un adjunto que no existe sería peor que no mandar
 * nada.
 */
export function programarEntregas(
  expediente: Expediente,
  ahora: string,
): { readonly ok: true; readonly entregas: readonly EntregaDeDocumentos[] } | {
  readonly ok: false;
  readonly motivo: MotivoNoProgramada;
} {
  if (expediente.estado !== "EMITIDO") return { ok: false, motivo: "EXPEDIENTE_SIN_EMITIR" };
  if (!expediente.certificadoCobertura) return { ok: false, motivo: "SIN_CERTIFICADO" };

  const canales: { canal: CanalEntrega; destino: string }[] = [];
  if (expediente.canalWhatsapp) {
    canales.push({ canal: "WHATSAPP", destino: enmascararCelular(expediente.canalWhatsapp.valor) });
  }
  if (expediente.canalEmail) {
    canales.push({ canal: "EMAIL", destino: enmascararCorreo(expediente.canalEmail.valor) });
  }
  if (canales.length === 0) return { ok: false, motivo: "SIN_CANALES_VERIFICADOS" };

  const documentos = codigosAEntregar(expediente);

  return {
    ok: true,
    entregas: canales.map(({ canal, destino }) => ({
      expedienteId: expediente.id,
      canal,
      destinoEnmascarado: destino,
      documentos,
      estado: "PENDIENTE" as const,
      intentos: 0,
      // El primer intento es inmediato: la persona está mirando la pantalla.
      proximoIntentoEn: ahora,
      referenciaEnvio: null,
      creadaEn: ahora,
      enviadaEn: null,
      acusadaEn: null,
      ultimoError: null,
    })),
  };
}

/**
 * Qué se entrega: el certificado y el paquete firmado.
 *
 * El comprobante de pago **no va**. No es un instrumento —se genera al pedirlo
 * (D-05)— y sumarlo haría más pesado un mensaje de WhatsApp para adjuntar algo
 * que la persona ya puede descargar. La póliza y la factura tampoco: las envía
 * Alianza por sus propios canales (fila 40, ítem 23 del catálogo de
 * integraciones).
 */
function codigosAEntregar(expediente: Expediente): readonly string[] {
  const codigos: string[] = [];
  if (expediente.certificadoCobertura) codigos.push(expediente.certificadoCobertura.codigo);
  if (expediente.paqueteDocumental) codigos.push(expediente.paqueteDocumental.codigo);
  return codigos;
}

// ---------------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------------

export interface ResultadoDespacho {
  readonly entregas: readonly EntregaDeDocumentos[];
  /** Cuántas avanzaron de estado en esta pasada. */
  readonly avanzadas: number;
}

/**
 * Procesa las entregas del expediente que estén vencidas.
 *
 * Re-invocable y barato de repetir: lo que no está vencido no se toca, y lo
 * que ya terminó tampoco. Cada pasada hace como mucho una llamada al proveedor
 * por canal.
 */
export async function despacharEntregas(
  deps: DependenciasEntrega,
  entrada: { readonly expediente: Expediente; readonly contexto: ContextoPeticion },
): Promise<ResultadoDespacho> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const instante = ahora();

  const existentes = await deps.entregas.obtenerPorExpediente(entrada.expediente.id);
  let entregas = existentes;

  if (existentes.length === 0) {
    const programadas = programarEntregas(entrada.expediente, instante);
    if (!programadas.ok) return { entregas: [], avanzadas: 0 };
    for (const entrega of programadas.entregas) await deps.entregas.guardar(entrega);
    entregas = programadas.entregas;
  }

  const resultado: EntregaDeDocumentos[] = [];
  let avanzadas = 0;

  for (const entrega of entregas) {
    const despues = await procesar(deps, entrada, entrega, instante);
    if (despues !== entrega) {
      await deps.entregas.guardar(despues);
      avanzadas += 1;
    }
    resultado.push(despues);
  }

  return { entregas: resultado, avanzadas };
}

/** Un paso de una entrega. Devuelve el mismo objeto si no había nada que hacer. */
async function procesar(
  deps: DependenciasEntrega,
  entrada: { readonly expediente: Expediente; readonly contexto: ContextoPeticion },
  entrega: EntregaDeDocumentos,
  instante: string,
): Promise<EntregaDeDocumentos> {
  if (TERMINALES.includes(entrega.estado)) return entrega;

  if (entrega.estado === "ENVIADO") return await consultarAcuse(deps, entrada, entrega, instante);

  // PENDIENTE: se intenta si ya venció la espera.
  if (entrega.proximoIntentoEn && entrega.proximoIntentoEn > instante) return entrega;
  return await intentarEnvio(deps, entrada, entrega, instante);
}

async function intentarEnvio(
  deps: DependenciasEntrega,
  entrada: { readonly expediente: Expediente; readonly contexto: ContextoPeticion },
  entrega: EntregaDeDocumentos,
  instante: string,
): Promise<EntregaDeDocumentos> {
  const { expediente } = entrada;

  const adjuntos = await deps.adjuntos(expediente);
  if (!adjuntos.ok) {
    // Sin archivos verificados no se manda nada: entregar un PDF que no sea el
    // emitido rompería el vínculo de la fila 47. Cuenta como intento aunque no
    // se haya llamado al proveedor — si no, un documento que nunca termina de
    // archivarse dejaría la entrega reintentando para siempre en vez de
    // avisar que algo hay que mirar.
    return await reprogramar(
      deps,
      entrada,
      { ...entrega, intentos: entrega.intentos + 1 },
      instante,
      adjuntos.detalle,
    );
  }

  const destino = destinoReal(expediente, entrega.canal);
  if (!destino) return await darPorFallida(deps, entrada, entrega, instante, "Canal sin destino.");

  const intentos = entrega.intentos + 1;
  const resultado = await deps.mensajeria.entregarDocumentos({
    expedienteId: expediente.id,
    canal: entrega.canal,
    destino,
    mensaje: mensajeParaExpediente(expediente),
    adjuntos: adjuntos.adjuntos,
    // La clave incluye el número de intento: un reintento del **mismo** intento
    // (timeout de red) no duplica el mensaje, y un intento nuevo sí manda de
    // nuevo, que es lo que se quiere cuando el anterior no llegó.
    idempotencyKey: `${expediente.id}:${entrega.canal}:${intentos}`,
  });

  if (resultado.ok) {
    const enviada: EntregaDeDocumentos = {
      ...entrega,
      estado: "ENVIADO",
      intentos,
      proximoIntentoEn: null,
      referenciaEnvio: resultado.referenciaEnvio,
      enviadaEn: instante,
      ultimoError: null,
    };
    await registrar(deps, entrada, enviada, instante, "EXITOSO", "ENVIO_ACEPTADO");
    return enviada;
  }

  // `DESTINO_INVALIDO` no se arregla reintentando: el destino es el que la
  // persona verificó y no va a cambiar solo.
  if (resultado.motivo === "DESTINO_INVALIDO") {
    return await darPorFallida(
      deps,
      entrada,
      { ...entrega, intentos },
      instante,
      resultado.detalle ?? resultado.motivo,
    );
  }
  return await reprogramar(
    deps,
    entrada,
    { ...entrega, intentos },
    instante,
    resultado.detalle ?? resultado.motivo,
  );
}

async function consultarAcuse(
  deps: DependenciasEntrega,
  entrada: { readonly expediente: Expediente; readonly contexto: ContextoPeticion },
  entrega: EntregaDeDocumentos,
  instante: string,
): Promise<EntregaDeDocumentos> {
  if (!entrega.referenciaEnvio) return entrega;

  const consulta = await deps.mensajeria.consultarEntrega(entrega.referenciaEnvio);
  if (!consulta || consulta.estado === "EN_TRANSITO") return entrega;

  if (consulta.estado === "ENTREGADO") {
    const acusada: EntregaDeDocumentos = {
      ...entrega,
      estado: "ACUSADO",
      acusadaEn: consulta.actualizadoEn,
      proximoIntentoEn: null,
    };
    await registrar(deps, entrada, acusada, instante, "EXITOSO", "ACUSE_RECIBIDO");
    return acusada;
  }

  // El proveedor aceptó y después no entregó: vuelve a la cola si quedan
  // intentos. Es el caso que hace que ENVIADO y ACUSADO tengan que ser dos.
  return await reprogramar(
    deps,
    entrada,
    { ...entrega, estado: "PENDIENTE", referenciaEnvio: null },
    instante,
    consulta.detalle ?? "El proveedor reportó que no se entregó.",
  );
}

/** Programa otro intento, o da la entrega por fallida si ya no quedan. */
async function reprogramar(
  deps: DependenciasEntrega,
  entrada: { readonly expediente: Expediente; readonly contexto: ContextoPeticion },
  entrega: EntregaDeDocumentos,
  instante: string,
  detalle: string,
): Promise<EntregaDeDocumentos> {
  const espera = ESPERAS_REINTENTO_MS[entrega.intentos - 1];
  if (espera === undefined) return await darPorFallida(deps, entrada, entrega, instante, detalle);

  const reprogramada: EntregaDeDocumentos = {
    ...entrega,
    estado: "PENDIENTE",
    proximoIntentoEn: new Date(new Date(instante).getTime() + espera).toISOString(),
    ultimoError: detalle,
  };
  await registrar(deps, entrada, reprogramada, instante, "FALLIDO", "REINTENTO_PROGRAMADO");
  return reprogramada;
}

async function darPorFallida(
  deps: DependenciasEntrega,
  entrada: { readonly expediente: Expediente; readonly contexto: ContextoPeticion },
  entrega: EntregaDeDocumentos,
  instante: string,
  detalle: string,
): Promise<EntregaDeDocumentos> {
  const fallida: EntregaDeDocumentos = {
    ...entrega,
    estado: "FALLIDO",
    proximoIntentoEn: null,
    ultimoError: detalle,
  };
  await registrar(deps, entrada, fallida, instante, "FALLIDO", "ENTREGA_FALLIDA");
  return fallida;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function destinoReal(expediente: Expediente, canal: CanalEntrega): string | null {
  const valor = canal === "WHATSAPP" ? expediente.canalWhatsapp?.valor : expediente.canalEmail?.valor;
  return valor ?? null;
}

/** El mensaje de D-18 armado con los datos de este expediente. */
export function mensajeParaExpediente(expediente: Expediente): string {
  const identidad = expediente.identidad;
  const plan = expediente.plan ? PLANES[expediente.plan.planId].nombre : "";
  return mensajeDeEntrega({
    nombre: identidad?.nombres ?? "",
    plan,
    inicioCobertura: expediente.certificadoCobertura?.inicioCobertura ?? "",
  });
}

/**
 * Evidencia de cada paso de la entrega (CMP-05: medio de recepción y acuse).
 *
 * Lo que viaja es el canal, el destino **enmascarado**, los códigos de los
 * documentos, el intento y la referencia del proveedor. Nunca el destino
 * completo, ni el contenido del mensaje —que lleva el nombre de la persona—,
 * ni nada de salud o PEP (regla inviolable #7).
 */
async function registrar(
  deps: DependenciasEntrega,
  entrada: { readonly expediente: Expediente; readonly contexto: ContextoPeticion },
  entrega: EntregaDeDocumentos,
  instante: string,
  resultado: "EXITOSO" | "FALLIDO",
  suceso: string,
): Promise<void> {
  const nuevoId = deps.nuevoId ?? (() => randomUUID());
  const detalle = [
    `suceso=${suceso}`,
    `canal=${entrega.canal}`,
    `destino=${entrega.destinoEnmascarado}`,
    `documentos=${entrega.documentos.join(",")}`,
    `estado=${entrega.estado}`,
    `intento=${entrega.intentos}`,
    ...(entrega.referenciaEnvio ? [`referencia=${entrega.referenciaEnvio}`] : []),
    ...(entrega.acusadaEn ? [`acusadaEn=${entrega.acusadaEn}`] : []),
    ...(entrega.ultimoError ? [`detalle=${entrega.ultimoError}`] : []),
  ].join(" · ");

  const registro: RegistroEvidencia = {
    id: nuevoId(),
    expedienteId: entrega.expedienteId,
    paso: PASO_EVIDENCIA_ENTREGA,
    fecha: instante,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado,
    detalle,
  };
  await deps.evidencias.guardar(registro);
}
