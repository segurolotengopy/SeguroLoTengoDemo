/**
 * Caso de uso de P8 · Revisión y firma final
 * (docs/ESPECIFICACION_PANTALLAS.md → "P8 · Paso 8 de 9 — Revisión y firma
 * final").
 *
 * Dos operaciones, y ninguna más:
 *
 * 1. `iniciarFirmaP8` — el botón `ENVIAR ENLACE SEGURO DE FIRMA`. Abre **un**
 *    acto de firma en Code100 con los dos documentos adentro y manda el enlace
 *    al canal verificado elegido. **No mueve el estado del expediente.**
 * 2. `confirmarFirmaP8` — el sondeo que hace la pantalla mientras muestra
 *    `Esperando confirmación verificable de Code100`. Lleva el expediente de
 *    PAQUETE_GENERADO a FIRMADO_CLIENTE y, aplicadas las firmas
 *    institucionales (D-13), a FIRMADO — que es lo único que habilita el
 *    cobro del paso siguiente.
 *
 * ## D-08 · esta pantalla ahora va antes del pago
 *
 * Hasta el Lote 4 se firmaba lo que ya estaba pagado, y este módulo tenía dos
 * responsabilidades más: exigir la garantía de pago para dejar firmar y hacer
 * vencer el expediente pagado que no firmaba. Las dos desaparecieron. No hay
 * pago que exigir —todavía no ocurrió— y el vencimiento se mudó al paso de
 * pago, que es donde ahora corre el reloj de 24 horas (D-10). Lo que este
 * módulo hace en cambio es **abrirlo**: al aplicar las firmas institucionales
 * fija `plazoPagoVenceEn`.
 *
 * ## Las tres reglas que este módulo hace imposibles de violar
 *
 * **Un solo acto de firma para los dos documentos** (regla inviolable #3, fila
 * 36 de `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`). Nunca se llama
 * al proveedor con un documento: `IniciarFirmaInput` recibe el
 * `PaqueteDocumental` completo, y `registrarFirmaP8` exige las dos huellas
 * firmadas en una sola escritura. No hay ninguna rama que pueda dejar la
 * Solicitud firmada y el FIPF no.
 *
 * **No hay firma sobre PDF abierto** (regla inviolable #4, fila 35). El único
 * estado desde el que se puede pedir el enlace es PAQUETE_GENERADO, que por
 * definición ya tiene los dos documentos cerrados y hasheados.
 *
 * **El enlace va a un canal verificado, y a ninguno más.** La pantalla elige
 * *cuál* de los dos —WhatsApp de P1 o correo de P4—, nunca *a dónde*: el
 * destino sale del expediente. No hay ningún campo de esta entrada por el que
 * pueda viajar una dirección escrita por el cliente, así que un enlace de firma
 * no puede terminar en un canal que nadie verificó (reglas inviolables #1 y #9).
 *
 * ## Lo que este módulo NO hace
 *
 * No genera los documentos: eso es `src/documentos/servicio.ts`, que corre
 * antes y deja el expediente en PAQUETE_GENERADO. No cobra: eso es
 * `pago-p7.ts`, que corre después. No emite la póliza: la emite Alianza por
 * SEBAOT y eso es P9. Y no dibuja nada: los literales están en `textos-p8.ts`.
 */
import { randomUUID } from "node:crypto";
import { ErrorEscrituraConcurrente, conReintentoPorConflicto } from "./concurrencia";
import type { EvidenceStore } from "../ports/evidence-store";
import type { SignatureProvider } from "../ports/signature-provider";
import { ErrorCode100 } from "../ports/signature-provider";
import { enmascararCorreo } from "./correo";
import { enmascararCelular } from "./telefono";
import {
  registrarEnvioEnlaceFirmaP8,
  registrarFirmaP8,
  registrarFirmasInstitucionales,
} from "./expediente";
import { firmantesConjuntos } from "./firmantes-documento";
import {
  TEXTO_DECLARACION_FIRMA_P8,
  VERSION_DECLARACION_FIRMA_P8,
} from "./textos-p8";
import type {
  ActoDeFirmaEnCurso,
  CanalFirma,
  DocumentoCerrado,
  EstadoExpediente,
  Expediente,
  FirmaInstitucional,
  RegistroEvidencia,
} from "./tipos";
import type { ContextoPeticion, RepositorioExpediente } from "./verificacion-canal";

// ---------------------------------------------------------------------------
// Dependencias y constantes
// ---------------------------------------------------------------------------

export interface DependenciasP8 {
  readonly firmas: SignatureProvider;
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
  /**
   * Duración del plazo para pagar, que se abre al quedar firmado el
   * expediente. 24 horas por D-10; el panel de demo lo comprime a segundos
   * para poder mostrar la caducidad sin esperar un día (CLAUDE.md → "Panel de
   * demo").
   */
  readonly plazoPagoMs?: number;
  /**
   * `true` cuando las firmas institucionales **no** se pueden aplicar.
   *
   * No es una palanca de demo disfrazada: aplicar una firma cualificada es una
   * operación contra un proveedor y puede fallar de verdad. Modelarla como algo
   * que puede salir mal es lo que hace que exista un camino donde el expediente
   * queda en `FIRMADO_CLIENTE` —el cliente firmó, las institucionales no— con
   * el cobro inhabilitado, que es exactamente lo que D-13 pide poder
   * distinguir. El panel de demo la fuerza; en producción la resolverá el
   * adaptador oficial.
   */
  readonly firmasInstitucionalesCaidas?: () => boolean;
}

/** Único estado desde el que se puede pedir el enlace de firma. */
export const ESTADO_REQUERIDO_P8: EstadoExpediente = "PAQUETE_GENERADO";

export const PASO_EVIDENCIA_ENVIO_ENLACE_P8 = "P8_ENVIO_ENLACE_FIRMA";
export const PASO_EVIDENCIA_FIRMA_P8 = "P8_FIRMA";
export const PASO_EVIDENCIA_FIRMAS_INSTITUCIONALES_P8 = "P8_FIRMAS_INSTITUCIONALES";

/**
 * Una confirmación que llegó sobre un expediente ya firmado (CHG-33).
 *
 * Se registra aparte de la firma para que la evidencia no mezcle *"el
 * expediente se firmó"* con *"nos avisaron de nuevo"*: son dos hechos, y solo
 * el primero transiciona.
 */
export const PASO_EVIDENCIA_CONFIRMACION_DUPLICADA_P8 = "P8_CONFIRMACION_DUPLICADA";

/** D-08 · firmado el expediente, el paso siguiente es el pago. */
export const RUTA_PAGO = "/pago";

/**
 * Plazo para pagar un expediente ya firmado (D-10: 24 horas).
 *
 * Se abre acá, al aplicarse las firmas institucionales, y lo consume el paso
 * de pago. Antes de la inversión se llamaba `PLAZO_FIRMA_MS`, vivía en
 * `pago-p7.ts` y medía lo contrario: el tiempo para firmar algo ya pagado.
 *
 * **La caducidad de la sesión de firma es otra cosa.** Code100 expone la suya
 * (`fecha_expiracion` / `expirado`) y no documenta una duración fija, así que
 * no se la hardcodea: este plazo es nuestro y es el del expediente (D-10).
 */
export const PLAZO_PAGO_MS = 24 * 60 * 60 * 1000;

/** Estados en los que el expediente ya está firmado por todos los intervinientes. */
const ESTADOS_YA_FIRMADOS: readonly EstadoExpediente[] = ["FIRMADO", "PAGO_CONFIRMADO", "EMITIDO"];

export const CANALES_FIRMA: readonly CanalFirma[] = ["WHATSAPP", "EMAIL"];

export function esCanalFirma(valor: unknown): valor is CanalFirma {
  return CANALES_FIRMA.some((canal) => canal === valor);
}

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

export type MotivoRechazoP8 =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "CANAL_INVALIDO"
  | "CANAL_NO_VERIFICADO"
  | "PAQUETE_NO_GENERADO"
  | "CODE100_NO_DISPONIBLE"
  | "CODE100_RECHAZO"
  | "FIRMA_NO_INICIADA"
  | "FIRMA_NO_COMPLETADA"
  /**
   * El cliente firmó pero las institucionales no llegaron (D-13). El
   * expediente queda en `FIRMADO_CLIENTE`: no se perdió la firma y el cobro
   * sigue inhabilitado. El próximo sondeo retoma ese tramo.
   */
  | "FIRMAS_INSTITUCIONALES_PENDIENTES"
  /**
   * Otra petición escribió el expediente entre la lectura y el guardado y el
   * conflicto persistió tras los reintentos (`src/domain/concurrencia.ts`).
   * No se perdió nada: el bloqueo optimista impidió pisar la otra escritura.
   * El próximo sondeo ve la versión que ganó.
   */
  | "CONFLICTO_CONCURRENCIA";

export interface ActoDeFirmaVisible {
  readonly idCode100: string;
  readonly canal: CanalFirma;
  readonly destinoEnmascarado: string;
  readonly enlaceEnviadoEn: string;
  readonly venceEn: string;
}

export type ResultadoIniciarFirmaP8 =
  | { readonly ok: true; readonly acto: ActoDeFirmaVisible }
  | { readonly ok: false; readonly motivo: MotivoRechazoP8; readonly detalle?: string };

/**
 * Por dónde llegó la confirmación de que el cliente firmó (CHG-33).
 *
 * La confirmación tiene **dos vías**, y las dos pueden llegar por el mismo
 * acto: la pantalla sondea cada dos segundos mientras la persona firma en la
 * ventana de Code100, y al volver de esa ventana el navegador confirma de una.
 * La que llega primero transiciona; la segunda encuentra el expediente ya
 * firmado y se registra como duplicado, sin repetir nada.
 *
 * Que el origen sea un dato y no una suposición es lo que permite responder,
 * meses después, *"¿por dónde se enteró el sistema de que esto se firmó?"* —
 * que es una pregunta de auditoría, no de depuración.
 *
 * **`WEBHOOK` no existe todavía**, y no está acá de adorno: la documentación
 * de Code100 (`docs/Integraciones/Documentacion Firmador - API FLOW.pdf`) no
 * expone ningún callback servidor a servidor —sus cuatro endpoints son `auth`,
 * `session-start`, `getSessionId` y `sign-pdf`—, así que inventarle payload y
 * verificación de firma sería inventar el contrato. Queda como PEN-02. El
 * valor está declarado para que agregarlo el día que Code100 lo confirme sea
 * sumar un alimentador más, no rehacer esta costura.
 */
export type OrigenConfirmacionFirma = "SONDEO" | "RETORNO_NAVEGADOR" | "WEBHOOK";

export type ResultadoConfirmarFirmaP8 =
  | {
      readonly ok: true;
      /** `false` mientras Code100 siga sin confirmar: la pantalla sigue sondeando. */
      readonly firmado: false;
      readonly enlaceAbierto: boolean;
      readonly venceEn: string;
    }
  | {
      readonly ok: true;
      readonly firmado: true;
      readonly estado: EstadoExpediente;
      readonly numeroPropuesta: string;
      readonly idCode100: string;
      readonly firmadoEn: string;
      /** Hasta cuándo hay tiempo de pagar (D-10). */
      readonly plazoPagoVenceEn: string;
      /**
       * `true` cuando esta confirmación llegó sobre un expediente que **ya**
       * estaba firmado: otra vía se le adelantó. No es un error —es el caso
       * normal cuando el sondeo y el retorno del navegador se cruzan— y por
       * eso se responde igual, con los mismos datos.
       */
      readonly duplicada: boolean;
      readonly siguientePantalla: typeof RUTA_PAGO;
    }
  | { readonly ok: false; readonly motivo: MotivoRechazoP8; readonly detalle?: string };

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

interface Reloj {
  readonly ahora: () => string;
  readonly nuevoId: () => string;
}

function resolverReloj(deps: DependenciasP8): Reloj {
  return {
    ahora: deps.ahora ?? (() => new Date().toISOString()),
    nuevoId: deps.nuevoId ?? (() => randomUUID()),
  };
}

function formatearDetalle(datos: Readonly<Record<string, string | number | boolean>>): string {
  return Object.entries(datos)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(" · ");
}

/**
 * Única forma en la que información de este paso sale hacia la evidencia.
 *
 * Es exactamente lo que exige la fila 42 de la matriz —*"Conservar evidencia
 * Code100: identidad, OTP, IP, fecha, hora, hash y resultado"*, Ley 6822/21,
 * arts. 42(5), 66 y 68(3)— y nada más. La identidad entra por `expedienteId`,
 * la IP y el dispositivo por el contexto, y del OTP entra el hecho de que hubo
 * uno, nunca el código: acá no hay ninguna rama por la que pueda viajar (regla
 * inviolable #2), ni tampoco un dato de salud, PEP, cédula o tarjeta (regla
 * inviolable #7).
 */
async function registrarEvidencia(
  deps: DependenciasP8,
  reloj: Reloj,
  entrada: {
    readonly expedienteId: string;
    readonly paso: string;
    readonly fecha: string;
    readonly contexto: ContextoPeticion;
    readonly resultado: "EXITOSO" | "FALLIDO";
    readonly detalle: Readonly<Record<string, string | number | boolean>>;
    /** Solo al pedir el enlace, que es donde se acepta la declaración de firma. */
    readonly aceptacion?: { readonly versionTexto: string; readonly texto: string };
  },
): Promise<void> {
  const registro: RegistroEvidencia = {
    id: reloj.nuevoId(),
    expedienteId: entrada.expedienteId,
    paso: entrada.paso,
    fecha: entrada.fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: entrada.aceptacion?.versionTexto ?? null,
    textoAceptado: entrada.aceptacion?.texto ?? null,
    resultado: entrada.resultado,
    detalle: formatearDetalle(entrada.detalle),
  };
  await deps.evidencias.guardar(registro);
}

/** Destino verificado del canal elegido, enmascarado para mostrar y registrar. */
function destinoDelCanal(
  expediente: Expediente,
  canal: CanalFirma,
): { readonly valor: string; readonly enmascarado: string } | null {
  if (canal === "WHATSAPP") {
    const numero = expediente.canalWhatsapp?.valor;
    if (!numero) return null;
    return { valor: numero, enmascarado: enmascararCelular(numero) };
  }
  const correo = expediente.canalEmail?.valor;
  if (!correo) return null;
  return { valor: correo, enmascarado: enmascararCorreo(correo) };
}

// ---------------------------------------------------------------------------
// Operación 1 — enviar el enlace de firma
// ---------------------------------------------------------------------------

export interface EntradaIniciarFirmaP8 {
  readonly expedienteId: string;
  /** Cuerpo crudo del formulario: se interpreta y valida en el dominio. */
  readonly canal: unknown;
  readonly contexto: ContextoPeticion;
}

/**
 * Botón `ENVIAR ENLACE SEGURO DE FIRMA`.
 *
 * Pedir un enlace cuando ya hay uno vivo devuelve el que ya existe en vez de
 * abrir un acto nuevo: dos sesiones simultáneas en Code100 para el mismo
 * expediente serían dos firmas posibles del mismo paquete, y solo una podría
 * quedar registrada. La persona puede pedir uno nuevo recién cuando el anterior
 * quedó cerrado (rechazado, cancelado o vencido).
 */
export async function iniciarFirmaP8(
  deps: DependenciasP8,
  entrada: EntradaIniciarFirmaP8,
): Promise<ResultadoIniciarFirmaP8> {
  try {
    return await intentarIniciarFirmaP8(deps, entrada);
  } catch (error) {
    // Sin reintento, a diferencia de los sondeos: reintentar podría abrir un
    // segundo acto de firma en Code100 (`src/domain/concurrencia.ts`). Se
    // devuelve el conflicto y la persona puede volver a tocar el botón; si el
    // acto ya quedó abierto, `actoVigente` devuelve ese mismo enlace.
    if (error instanceof ErrorEscrituraConcurrente) {
      return { ok: false, motivo: "CONFLICTO_CONCURRENCIA" };
    }
    throw error;
  }
}

async function intentarIniciarFirmaP8(
  deps: DependenciasP8,
  entrada: EntradaIniciarFirmaP8,
): Promise<ResultadoIniciarFirmaP8> {
  const reloj = resolverReloj(deps);

  if (!esCanalFirma(entrada.canal)) {
    return { ok: false, motivo: "CANAL_INVALIDO" };
  }
  const canal = entrada.canal;

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  const fecha = reloj.ahora();

  if (expediente.estado !== ESTADO_REQUERIDO_P8) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_ENVIO_ENLACE_P8,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { canal, motivo: "ESTADO_INVALIDO", estado: expediente.estado },
    });
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  const paquete = expediente.paqueteDocumental;
  if (!paquete) return { ok: false, motivo: "PAQUETE_NO_GENERADO" };

  const destino = destinoDelCanal(expediente, canal);
  if (!destino) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_ENVIO_ENLACE_P8,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { canal, motivo: "CANAL_NO_VERIFICADO" },
    });
    return { ok: false, motivo: "CANAL_NO_VERIFICADO" };
  }

  // Acto vivo: se devuelve el mismo enlace en vez de abrir otro.
  const enCurso = await actoVigente(deps, expediente, fecha);
  if (enCurso) return { ok: true, acto: enCurso };

  let iniciada;
  try {
    iniciada = await deps.firmas.iniciarFirma({
      expedienteId: expediente.id,
      canal,
      destino: destino.valor,
      // El documento único del expediente (D-11): la Solicitud y el FIPF son
      // secciones del mismo PDF, así que no hay dos llamadas posibles.
      documento: paquete,
    });
  } catch (error) {
    const esDeCode100 = error instanceof ErrorCode100;
    const motivo: MotivoRechazoP8 =
      esDeCode100 && error.motivo === "RECHAZADA" ? "CODE100_RECHAZO" : "CODE100_NO_DISPONIBLE";

    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_ENVIO_ENLACE_P8,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: {
        canal,
        destino: destino.enmascarado,
        motivo,
        documento: paquete.codigo,
      },
    });
    return { ok: false, motivo, detalle: esDeCode100 ? error.message : undefined };
  }

  const acto: ActoDeFirmaEnCurso = {
    idCode100: iniciada.idCode100,
    canal,
    destinoEnmascarado: destino.enmascarado,
    enlaceEnviadoEn: iniciada.enlaceEnviadoEn,
    venceEn: iniciada.venceEn,
  };

  const registro = registrarEnvioEnlaceFirmaP8(expediente, acto, fecha);
  if (!registro.ok) {
    return { ok: false, motivo: "ESTADO_INVALIDO", detalle: registro.error };
  }

  await deps.expedientes.guardar(registro.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_ENVIO_ENLACE_P8,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: {
      canal,
      destino: destino.enmascarado,
      idCode100: acto.idCode100,
      venceEn: acto.venceEn,
      // La huella del documento que se manda a firmar: es lo que después
      // permite probar que se firmó exactamente esto (filas 42 y 47).
      documento: paquete.codigo,
      seccionFipf: paquete.codigoSeccionFipf,
      hashDocumento: paquete.hashSha256,
      version: paquete.version,
    },
    // La declaración de P8 se acepta en este acto: se guarda el literal
    // íntegro, no solo la versión, por el mismo motivo que en P3 y P7.
    aceptacion: { versionTexto: VERSION_DECLARACION_FIRMA_P8, texto: TEXTO_DECLARACION_FIRMA_P8 },
  });

  return { ok: true, acto: { ...acto } };
}

/**
 * Acto de firma todavía utilizable, o `null` si no hay ninguno o el que hay ya
 * quedó cerrado del lado del proveedor.
 */
async function actoVigente(
  deps: DependenciasP8,
  expediente: Expediente,
  fecha: string,
): Promise<ActoDeFirmaVisible | null> {
  const acto = expediente.actoDeFirma;
  if (!acto) return null;
  if (fecha >= acto.venceEn) return null;

  const resultado = await deps.firmas.confirmarResultado(acto.idCode100);
  if (resultado.estado !== "PENDIENTE") return null;

  return {
    idCode100: acto.idCode100,
    canal: acto.canal,
    destinoEnmascarado: acto.destinoEnmascarado,
    enlaceEnviadoEn: acto.enlaceEnviadoEn,
    venceEn: acto.venceEn,
  };
}

// ---------------------------------------------------------------------------
// Operación 2 — confirmar la firma contra Code100
// ---------------------------------------------------------------------------

/**
 * Sondeo de la pantalla mientras espera a Code100, y única puerta por la que el
 * expediente pasa a FIRMADO.
 *
 * Son **dos** transiciones en una operación: la firma del cliente deja el
 * expediente en `FIRMADO_CLIENTE` y las institucionales lo llevan a `FIRMADO`
 * (D-13). Que sean dos estados y no uno es lo que permite distinguir un
 * sellado a medio hacer de un expediente sin firmar, y lo que mantiene el
 * cobro inhabilitado si el segundo tramo falla: un expediente detenido en
 * `FIRMADO_CLIENTE` no puede pagar. El siguiente sondeo lo reintenta.
 *
 * Es idempotente de punta a punta: llamarlo con el expediente ya FIRMADO
 * devuelve los mismos datos sin volver a transicionar ni a escribir. Eso
 * importa porque la pantalla sondea en bucle y porque el mismo endpoint va a
 * atender el callback de Code100 cuando exista el adaptador oficial (CLAUDE.md
 * → "Idempotencia de webhooks").
 */
export async function confirmarFirmaP8(
  deps: DependenciasP8,
  entrada: {
    readonly expedienteId: string;
    readonly contexto: ContextoPeticion;
    /** Por dónde llegó (CHG-33). El sondeo es el valor por defecto. */
    readonly origen?: OrigenConfirmacionFirma;
  },
): Promise<ResultadoConfirmarFirmaP8> {
  // Perder la carrera de escritura contra otro sondeo se resuelve releyendo:
  // la operación es convergente —rama idempotente para FIRMADO, retoma del
  // tramo institucional para FIRMADO_CLIENTE— y no repite efectos en Code100.
  return conReintentoPorConflicto(
    () => intentarConfirmarFirmaP8(deps, entrada),
    () => ({ ok: false, motivo: "CONFLICTO_CONCURRENCIA" }),
  );
}

async function intentarConfirmarFirmaP8(
  deps: DependenciasP8,
  entrada: {
    readonly expedienteId: string;
    readonly contexto: ContextoPeticion;
    readonly origen?: OrigenConfirmacionFirma;
  },
): Promise<ResultadoConfirmarFirmaP8> {
  const reloj = resolverReloj(deps);
  const origen = entrada.origen ?? "SONDEO";

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  // Ya firmado por todos: otra vía se adelantó. Se responde con lo persistido
  // —sin transicionar, sin tocar a Code100— y se deja constancia de por dónde
  // llegó la que perdió la carrera (CHG-33). Es la rama que hace inofensivo un
  // callback duplicado, y ahora además lo documenta.
  if (expediente.firma && ESTADOS_YA_FIRMADOS.includes(expediente.estado)) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_CONFIRMACION_DUPLICADA_P8,
      fecha: reloj.ahora(),
      contexto: entrada.contexto,
      // No es un fallo: es el cruce esperable entre el sondeo y el retorno del
      // navegador. Se registra como exitoso porque la confirmación era cierta.
      resultado: "EXITOSO",
      detalle: {
        origen,
        idCode100: expediente.firma.referenciaActo,
        estado: expediente.estado,
      },
    });

    return {
      ok: true,
      firmado: true,
      estado: expediente.estado,
      numeroPropuesta: expediente.numeroPropuesta ?? "",
      idCode100: expediente.firma.referenciaActo,
      firmadoEn: expediente.firma.firmadoEn,
      plazoPagoVenceEn: expediente.plazoPagoVenceEn ?? "",
      duplicada: true,
      siguientePantalla: RUTA_PAGO,
    };
  }

  // El cliente ya firmó pero el tramo institucional no llegó a completarse
  // —una falla de red, un reinicio, una escritura perdida—. Se retoma desde
  // ahí en vez de volver a pedirle la firma a Code100: la firma del cliente es
  // un hecho registrado y no se repite.
  if (expediente.estado === "FIRMADO_CLIENTE") {
    return aplicarFirmasInstitucionales(deps, reloj, expediente, entrada.contexto, origen);
  }

  if (expediente.estado !== ESTADO_REQUERIDO_P8) {
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  const acto = expediente.actoDeFirma;
  if (!acto) return { ok: false, motivo: "FIRMA_NO_INICIADA" };

  const resultado = await deps.firmas.confirmarResultado(acto.idCode100);

  if (resultado.estado === "PENDIENTE") {
    // Sigue esperando. No se escribe nada: un sondeo cada dos segundos no tiene
    // por qué generar una escritura ni un registro de evidencia.
    return { ok: true, firmado: false, enlaceAbierto: resultado.enlaceAbierto, venceEn: acto.venceEn };
  }

  const fecha = reloj.ahora();

  if (resultado.estado === "NO_FIRMADO") {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_FIRMA_P8,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: {
        idCode100: acto.idCode100,
        canal: acto.canal,
        motivo: resultado.motivo,
        ...(resultado.detalle ? { detalle: resultado.detalle } : {}),
      },
    });
    // El expediente se queda en PAQUETE_GENERADO: mientras el plazo siga
    // corriendo, la persona puede pedir un enlace nuevo. Nada quedó firmado.
    return { ok: false, motivo: "FIRMA_NO_COMPLETADA", detalle: resultado.motivo };
  }

  const transicion = registrarFirmaP8(expediente, resultado.firma, fecha);
  if (!transicion.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_FIRMA_P8,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { idCode100: acto.idCode100, motivo: "TRANSICION_INVALIDA", detalle: transicion.error },
    });
    return { ok: false, motivo: "ESTADO_INVALIDO", detalle: transicion.error };
  }

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_FIRMA_P8,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: {
      idCode100: resultado.firma.referenciaActo,
      canal: resultado.firma.canal,
      firmante: "CLIENTE",
      firmadoEn: resultado.firma.firmadoEn,
      // La huella del documento firmado: un acto, un archivo, una prueba
      // (filas 42 y 47).
      hashDocumentoFirmado: resultado.firma.hashDocumentoFirmado,
      propuesta: transicion.expediente.numeroPropuesta ?? "",
    },
  });

  return aplicarFirmasInstitucionales(deps, reloj, transicion.expediente, entrada.contexto, origen);
}

/**
 * FIRMADO_CLIENTE → FIRMADO: las firmas de Interseguros y Alianza sobre el
 * mismo documento, y con ellas la apertura del plazo para pagar (D-10).
 *
 * En el demo se aplican en el acto, apenas vuelve la firma del cliente; con
 * Code100 real serán dos actos con certificado cualificado y esta función será
 * el punto donde se los espera. Que viva aparte —y no dentro de la rama de la
 * firma del cliente— es lo que permite retomarla sola cuando el primer tramo
 * ya quedó registrado y el segundo no (regla inviolable #3: el sellado a medias
 * tiene que ser distinguible, y también recuperable).
 *
 * El orden es el del contrato de Code100 y no se puede invertir: cliente
 * primero, institucionales después.
 */
async function aplicarFirmasInstitucionales(
  deps: DependenciasP8,
  reloj: Reloj,
  expediente: Expediente,
  contexto: ContextoPeticion,
  origen: OrigenConfirmacionFirma,
): Promise<ResultadoConfirmarFirmaP8> {
  const fecha = reloj.ahora();

  if (deps.firmasInstitucionalesCaidas?.() === true) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: PASO_EVIDENCIA_FIRMAS_INSTITUCIONALES_P8,
      fecha,
      contexto,
      resultado: "FALLIDO",
      detalle: {
        motivo: "PROVEEDOR_NO_APLICO_LAS_FIRMAS",
        // El expediente se queda donde está: la firma del cliente no se
        // pierde y el cobro no se habilita.
        estado: expediente.estado,
      },
    });
    return { ok: false, motivo: "FIRMAS_INSTITUCIONALES_PENDIENTES" };
  }

  const plazoPagoMs = deps.plazoPagoMs ?? PLAZO_PAGO_MS;
  const plazoPagoVenceEn = new Date(new Date(fecha).getTime() + plazoPagoMs).toISOString();

  // D-13 · quiénes firman y con qué modalidad sale de la configuración, no de
  // una lista escrita acá: es la misma de la que salen el bloque de firmas del
  // PDF y lo que la consola muestra.
  const firmas: readonly FirmaInstitucional[] = firmantesConjuntos("PAQUETE").map((firmante) => ({
    rol: firmante.rol,
    nivel: firmante.nivel,
    modalidad: firmante.modalidad,
    // Simulado mientras Code100 sea un mock, y la referencia lo dice: una
    // evidencia que afirmara un certificado cualificado real no probaría nada.
    certificado: `DEMO-CERT-${firmante.rol}-${expediente.numeroPropuesta ?? "SIN-CORRELATIVO"}`,
    aplicadaEn: fecha,
  }));

  const transicion = registrarFirmasInstitucionales(expediente, firmas, plazoPagoVenceEn, fecha);
  if (!transicion.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: PASO_EVIDENCIA_FIRMAS_INSTITUCIONALES_P8,
      fecha,
      contexto,
      resultado: "FALLIDO",
      detalle: { motivo: "TRANSICION_INVALIDA", detalle: transicion.error },
    });
    return { ok: false, motivo: "ESTADO_INVALIDO", detalle: transicion.error };
  }

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_FIRMAS_INSTITUCIONALES_P8,
    fecha,
    contexto,
    resultado: "EXITOSO",
    detalle: {
      firmantes: firmas.map((firma) => firma.rol).join(","),
      niveles: firmas.map((firma) => `${firma.rol}:${firma.nivel}`).join(","),
      modalidades: firmas.map((firma) => `${firma.rol}:${firma.modalidad}`).join(","),
      certificados: firmas.map((firma) => firma.certificado).join(","),
      propuesta: transicion.expediente.numeroPropuesta ?? "",
      plazoPagoVenceEn,
      // Por dónde llegó la confirmación que disparó este tramo (CHG-33).
      origen,
    },
  });

  const firma = transicion.expediente.firma;
  return {
    ok: true,
    firmado: true,
    estado: transicion.expediente.estado,
    numeroPropuesta: transicion.expediente.numeroPropuesta ?? "",
    idCode100: firma?.referenciaActo ?? "",
    firmadoEn: firma?.firmadoEn ?? fecha,
    plazoPagoVenceEn,
    duplicada: false,
    siguientePantalla: RUTA_PAGO,
  };
}


// ---------------------------------------------------------------------------
// Lectura para la pantalla
// ---------------------------------------------------------------------------

export interface DocumentoVisibleP8 {
  readonly codigo: string;
  /** Código interno de la sección FIPF, visible dentro del mismo PDF. */
  readonly codigoSeccionFipf: string;
  readonly version: number;
  readonly hashSha256: string;
  readonly cerradoEn: string;
}

export interface ResumenFirmaP8 {
  readonly estado: EstadoExpediente;
  readonly numeroPropuesta: string | null;
  /** El documento único del expediente (D-11): Solicitud + FIPF en un PDF. */
  readonly documento: DocumentoVisibleP8;
  /** Canales verificados, enmascarados: nunca el valor completo (regla de UI). */
  readonly canalWhatsappEnmascarado: string | null;
  readonly canalEmailEnmascarado: string | null;
  readonly acto: ActoDeFirmaVisible | null;
  readonly firmadoEn: string | null;
}

function documentoVisible(documento: DocumentoCerrado): DocumentoVisibleP8 {
  return {
    codigo: documento.codigo,
    codigoSeccionFipf: documento.codigoSeccionFipf,
    version: documento.version,
    hashSha256: documento.hashSha256,
    cerradoEn: documento.cerradoEn,
  };
}

/**
 * Lo que P8 necesita para dibujarse. Devuelve `null` si el expediente todavía
 * no llegó a tener el paquete cerrado o si ya salió del tramo de firma.
 *
 * No expone ningún dato de salud ni la condición PEP (regla inviolable #7):
 * esas respuestas están dentro de los PDF, que se descargan por su propio
 * endpoint, no en la proyección de la pantalla.
 */
export function leerResumenFirmaP8(expediente: Expediente): ResumenFirmaP8 | null {
  const paquete = expediente.paqueteDocumental;
  if (!paquete) return null;

  // D-08 · la pantalla también tiene que poder dibujarse con el expediente ya
  // firmado y todavía sin pagar, que es el estado normal al salir de acá.
  const estadosVisibles: readonly EstadoExpediente[] = [
    "PAQUETE_GENERADO",
    "FIRMADO_CLIENTE",
    "FIRMADO",
    "PAGO_CONFIRMADO",
    "EMITIDO",
  ];
  if (!estadosVisibles.includes(expediente.estado)) return null;

  return {
    estado: expediente.estado,
    numeroPropuesta: expediente.numeroPropuesta,
    documento: documentoVisible(paquete),
    canalWhatsappEnmascarado: expediente.canalWhatsapp
      ? enmascararCelular(expediente.canalWhatsapp.valor)
      : null,
    canalEmailEnmascarado: expediente.canalEmail ? enmascararCorreo(expediente.canalEmail.valor) : null,
    acto: expediente.actoDeFirma
      ? {
          idCode100: expediente.actoDeFirma.idCode100,
          canal: expediente.actoDeFirma.canal,
          destinoEnmascarado: expediente.actoDeFirma.destinoEnmascarado,
          enlaceEnviadoEn: expediente.actoDeFirma.enlaceEnviadoEn,
          venceEn: expediente.actoDeFirma.venceEn,
        }
      : null,
    firmadoEn: expediente.firma?.firmadoEn ?? null,
  };
}
