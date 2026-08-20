/**
 * Caso de uso de P8 · Revisión y firma final
 * (docs/ESPECIFICACION_PANTALLAS.md → "P8 · Paso 8 de 9 — Revisión y firma
 * final").
 *
 * Tres operaciones, y ninguna más:
 *
 * 1. `iniciarFirmaP8` — el botón `ENVIAR ENLACE SEGURO DE FIRMA`. Abre **un**
 *    acto de firma en Code100 con los dos documentos adentro y manda el enlace
 *    al canal verificado elegido. **No mueve el estado del expediente.**
 * 2. `confirmarFirmaP8` — el sondeo que hace la pantalla mientras muestra
 *    `Esperando confirmación verificable de Code100`. Es lo único que puede
 *    llevar el expediente de PAQUETE_GENERADO a FIRMADO, y de paso ordena la
 *    captura de la preautorización de crédito.
 * 3. `vencerPlazoFirmaP8` — el plazo de 24 horas cumplido: PAQUETE_GENERADO (o
 *    PAGO_CONFIRMADO) → VENCIDO, y de ahí a Pantalla B.
 *
 * ## Las cuatro reglas que este módulo hace imposibles de violar
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
 * **El plazo se evalúa antes que nada.** Toda operación de P8 empieza
 * chequeando `plazoFirmaVenceEn`: no se puede pedir un enlace, ni confirmar una
 * firma, sobre un expediente cuyo plazo ya se cumplió (fila 30: *"Devolver el
 * premio si el cliente no firma dentro del plazo comunicado"*).
 *
 * ## Lo que este módulo NO hace
 *
 * No genera los documentos: eso es `src/documentos/servicio.ts`, que corre
 * antes y deja el expediente en PAQUETE_GENERADO. No emite la póliza: la emite
 * Alianza por SEBAOT y eso es P9. Y no dibuja nada: los literales están en
 * `textos-p8.ts`.
 */
import { randomUUID } from "node:crypto";
import { ErrorEscrituraConcurrente, conReintentoPorConflicto } from "./concurrencia";
import type { EvidenceStore } from "../ports/evidence-store";
import type { PaymentProvider } from "../ports/payment-provider";
import type { SignatureProvider } from "../ports/signature-provider";
import { ErrorCode100 } from "../ports/signature-provider";
import { enmascararCorreo } from "./correo";
import { enmascararCelular } from "./telefono";
import {
  registrarEnvioEnlaceFirmaP8,
  registrarEstadoDePagoP8,
  registrarFirmaP8,
  vencerPlazoFirmaSiCorresponde,
} from "./expediente";
import { PLAZO_FIRMA_MS } from "./pago-p7";
import {
  TEXTO_DECLARACION_FIRMA_P8,
  VERSION_DECLARACION_FIRMA_P8,
} from "./textos-p8";
import { esPagoDefinitivoAntesDeFirma, garantiaDePagoLista } from "./tipos";
import type {
  ActoDeFirmaEnCurso,
  CanalFirma,
  DocumentoCerrado,
  EstadoExpediente,
  Expediente,
  MedioDePago,
  RegistroEvidencia,
} from "./tipos";
import type { ContextoPeticion, RepositorioExpediente } from "./verificacion-canal";

// ---------------------------------------------------------------------------
// Dependencias y constantes
// ---------------------------------------------------------------------------

export interface DependenciasP8 {
  readonly firmas: SignatureProvider;
  /** Para capturar la preautorización de crédito y para liberarla al vencer. */
  readonly pagos: PaymentProvider;
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

/** Único estado desde el que se puede pedir el enlace de firma. */
export const ESTADO_REQUERIDO_P8: EstadoExpediente = "PAQUETE_GENERADO";

export const PASO_EVIDENCIA_ENVIO_ENLACE_P8 = "P8_ENVIO_ENLACE_FIRMA";
export const PASO_EVIDENCIA_FIRMA_P8 = "P8_FIRMA";
export const PASO_EVIDENCIA_CAPTURA_P8 = "P8_CAPTURA_PAGO";
export const PASO_EVIDENCIA_VENCIMIENTO_P8 = "P8_VENCIMIENTO_PLAZO_FIRMA";

export const RUTA_PANTALLA_B = "/solicitud-vencida";
export const RUTA_P9 = "/confirmacion";

/** Re-exportado para que la pantalla no tenga que importar de P7 el mismo dato. */
export { PLAZO_FIRMA_MS };

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
  | "PLAZO_VENCIDO"
  | "CANAL_INVALIDO"
  | "CANAL_NO_VERIFICADO"
  | "PAQUETE_NO_GENERADO"
  | "GARANTIA_PAGO_NO_LISTA"
  | "CODE100_NO_DISPONIBLE"
  | "CODE100_RECHAZO"
  | "FIRMA_NO_INICIADA"
  | "FIRMA_NO_COMPLETADA"
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
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoP8;
      readonly detalle?: string;
      /** A dónde mandar a la persona cuando el rechazo la saca del flujo. */
      readonly siguientePantalla?: typeof RUTA_PANTALLA_B;
    };

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
      /**
       * `true` si la firma quedó registrada pero la captura de la
       * preautorización de crédito todavía no: la firma es un hecho de Code100
       * y no se pierde porque Bancard no conteste. El próximo sondeo reintenta.
       */
      readonly capturaPendiente: boolean;
      readonly siguientePantalla: typeof RUTA_P9;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoP8;
      readonly detalle?: string;
      readonly siguientePantalla?: typeof RUTA_PANTALLA_B;
    };

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

/**
 * Aplica el vencimiento del plazo si corresponde, persiste y deja evidencia.
 *
 * Devuelve el expediente que hay que seguir usando: el mismo si el plazo no se
 * cumplió, o el ya vencido si se cumplió. Toda operación de P8 arranca por acá.
 */
async function aplicarVencimiento(
  deps: DependenciasP8,
  reloj: Reloj,
  expediente: Expediente,
  contexto: ContextoPeticion,
): Promise<{ readonly expediente: Expediente; readonly vencio: boolean }> {
  // Ya vencido —por una llamada anterior a este mismo camino o por la petición
  // concurrente que ganó la carrera de escritura—: no hay nada que escribir ni
  // evidencia nueva que dejar. Es lo que hace convergente el reintento ante
  // conflicto y cierta la promesa de idempotencia de `POST /api/p8/vencimiento`.
  if (expediente.estado === "VENCIDO") return { expediente, vencio: true };

  const fecha = reloj.ahora();
  const transicion = vencerPlazoFirmaSiCorresponde(expediente, fecha);

  if (!transicion.ok) {
    // La única forma de llegar acá es una transición ilegal, que sería un error
    // de programación. Se deja el expediente como estaba antes que romper.
    return { expediente, vencio: false };
  }
  if (transicion.expediente.estado !== "VENCIDO") {
    return { expediente: transicion.expediente, vencio: false };
  }

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  const pago = transicion.expediente.pago;
  const definitivo = pago ? esPagoDefinitivoAntesDeFirma(pago.medio) : false;

  await registrarEvidencia(deps, reloj, {
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_VENCIMIENTO_P8,
    fecha,
    contexto,
    resultado: "FALLIDO",
    detalle: {
      motivo: "PLAZO_FIRMA_VENCIDO",
      estadoAnterior: expediente.estado,
      plazoFirmaVenceEn: expediente.plazoFirmaVenceEn ?? "",
      ...(pago ? { medio: pago.medio, estadoPago: pago.estado } : {}),
      // Con QR o débito el dinero ya se movió y hay que devolverlo; con crédito
      // alcanza con liberar la reserva (fila 30 de la matriz).
      consecuencia: definitivo ? "DEVOLUCION_AL_ORIGEN" : "LIBERACION_DE_RESERVA",
    },
  });

  const conReservaLiberada = await liberarReservaSiEsCredito(deps, reloj, transicion.expediente, contexto);
  return { expediente: conReservaLiberada, vencio: true };
}

/**
 * Crédito vencido sin firma: se libera la reserva. Con QR o débito no hay nada
 * que liberar —el dinero ya se movió— y la devolución es el procedimiento
 * presencial de Pantalla B, no una llamada a Bancard.
 */
async function liberarReservaSiEsCredito(
  deps: DependenciasP8,
  reloj: Reloj,
  expediente: Expediente,
  contexto: ContextoPeticion,
): Promise<Expediente> {
  const pago = expediente.pago;
  if (!pago || pago.medio !== "TARJETA_CREDITO" || pago.estado !== "PREAUTORIZADO") return expediente;
  if (!pago.referenciaBancard) return expediente;

  const fecha = reloj.ahora();
  try {
    const liberada = await deps.pagos.cancelarOLiberarReserva(pago.referenciaBancard);
    const transicion = registrarEstadoDePagoP8(
      expediente,
      { ...pago, estado: liberada.estado },
      fecha,
    );
    if (!transicion.ok) return expediente;

    await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: PASO_EVIDENCIA_CAPTURA_P8,
      fecha,
      contexto,
      resultado: "EXITOSO",
      detalle: {
        operacion: "LIBERACION_DE_RESERVA",
        medio: pago.medio,
        referenciaBancard: pago.referenciaBancard,
        estadoPago: liberada.estado,
      },
    });
    return transicion.expediente;
  } catch (error) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: PASO_EVIDENCIA_CAPTURA_P8,
      fecha,
      contexto,
      resultado: "FALLIDO",
      detalle: {
        operacion: "LIBERACION_DE_RESERVA",
        medio: pago.medio,
        referenciaBancard: pago.referenciaBancard,
        detalle: error instanceof Error ? error.message : "desconocido",
      },
    });
    return expediente;
  }
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

  const guardado = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!guardado) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  const { expediente, vencio } = await aplicarVencimiento(deps, reloj, guardado, entrada.contexto);
  if (vencio) {
    return { ok: false, motivo: "PLAZO_VENCIDO", siguientePantalla: RUTA_PANTALLA_B };
  }

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

  if (!garantiaDePagoLista(expediente.pago?.estado ?? "PENDIENTE")) {
    return { ok: false, motivo: "GARANTIA_PAGO_NO_LISTA" };
  }

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
      // Los DOS documentos, en la MISMA llamada (regla inviolable #3).
      paqueteDocumental: paquete,
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
        solicitud: paquete.solicitud.codigo,
        fipf: paquete.fipf.codigo,
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
      // Las dos huellas del paquete que se manda a firmar: es lo que después
      // permite probar que se firmó exactamente esto (filas 42 y 47).
      solicitud: paquete.solicitud.codigo,
      hashSolicitud: paquete.solicitud.hashSha256,
      fipf: paquete.fipf.codigo,
      hashFipf: paquete.fipf.hashSha256,
      version: paquete.solicitud.version,
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
 * Es idempotente de punta a punta: llamarlo con el expediente ya FIRMADO
 * devuelve los mismos datos sin volver a transicionar ni a escribir. Eso
 * importa porque la pantalla sondea en bucle y porque el mismo endpoint va a
 * atender el callback de Code100 cuando exista el adaptador oficial (CLAUDE.md
 * → "Idempotencia de webhooks").
 */
export async function confirmarFirmaP8(
  deps: DependenciasP8,
  entrada: { readonly expedienteId: string; readonly contexto: ContextoPeticion },
): Promise<ResultadoConfirmarFirmaP8> {
  // Perder la carrera de escritura contra el vencimiento o contra otro sondeo
  // se resuelve releyendo: la operación es convergente (rama idempotente para
  // FIRMADO, `aplicarVencimiento` para VENCIDO) y no repite efectos en Code100.
  return conReintentoPorConflicto(
    () => intentarConfirmarFirmaP8(deps, entrada),
    () => ({ ok: false, motivo: "CONFLICTO_CONCURRENCIA" }),
  );
}

async function intentarConfirmarFirmaP8(
  deps: DependenciasP8,
  entrada: { readonly expedienteId: string; readonly contexto: ContextoPeticion },
): Promise<ResultadoConfirmarFirmaP8> {
  const reloj = resolverReloj(deps);

  const guardado = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!guardado) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  // Ya firmado: se responde con lo persistido. Es la rama que hace inofensivo
  // un callback duplicado. Se sigue intentando la captura, que es idempotente.
  if (guardado.firma && (guardado.estado === "FIRMADO" || guardado.estado === "EMITIDO")) {
    const capturado = await capturarSiEsCredito(deps, reloj, guardado, entrada.contexto);
    return {
      ok: true,
      firmado: true,
      estado: capturado.expediente.estado,
      numeroPropuesta: capturado.expediente.numeroPropuesta ?? "",
      idCode100: guardado.firma.idCode100,
      firmadoEn: guardado.firma.firmadoEn,
      capturaPendiente: capturado.pendiente,
      siguientePantalla: RUTA_P9,
    };
  }

  const { expediente, vencio } = await aplicarVencimiento(deps, reloj, guardado, entrada.contexto);
  if (vencio) {
    return { ok: false, motivo: "PLAZO_VENCIDO", siguientePantalla: RUTA_PANTALLA_B };
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
      idCode100: resultado.firma.idCode100,
      canal: resultado.firma.canal,
      firmante: "CLIENTE",
      firmadoEn: resultado.firma.firmadoEn,
      // Las dos huellas firmadas, juntas y en el mismo registro: es la prueba
      // de que el acto fue uno solo (regla inviolable #3, filas 42 y 47).
      hashSolicitudFirmada: resultado.firma.hashSolicitudFirmada,
      hashFipfFirmado: resultado.firma.hashFipfFirmado,
      propuesta: transicion.expediente.numeroPropuesta ?? "",
    },
  });

  const capturado = await capturarSiEsCredito(deps, reloj, transicion.expediente, entrada.contexto);

  return {
    ok: true,
    firmado: true,
    estado: capturado.expediente.estado,
    numeroPropuesta: capturado.expediente.numeroPropuesta ?? "",
    idCode100: resultado.firma.idCode100,
    firmadoEn: resultado.firma.firmadoEn,
    capturaPendiente: capturado.pendiente,
    siguientePantalla: RUTA_P9,
  };
}

/**
 * La firma del cliente ordena la captura de la preautorización (fila 27 de la
 * matriz — Código Civil, arts. 1348, 1373 y 1374). Solo aplica a crédito: con
 * QR y débito el cobro ya ocurrió en P7.
 *
 * Corre **después** de asentar la firma, no antes, y a propósito: la firma es
 * un hecho registrado por Code100 y no puede depender de que Bancard conteste.
 * Si la captura falla, el expediente queda FIRMADO con la captura pendiente y
 * el próximo sondeo la reintenta — `capturarPreautorizacion` es idempotente por
 * `referenciaBancard`.
 */
async function capturarSiEsCredito(
  deps: DependenciasP8,
  reloj: Reloj,
  expediente: Expediente,
  contexto: ContextoPeticion,
): Promise<{ readonly expediente: Expediente; readonly pendiente: boolean }> {
  const pago = expediente.pago;
  if (!pago || pago.medio !== "TARJETA_CREDITO") return { expediente, pendiente: false };
  if (pago.estado === "CAPTURADO") return { expediente, pendiente: false };
  if (pago.estado !== "PREAUTORIZADO" || !pago.referenciaBancard) {
    return { expediente, pendiente: true };
  }

  const fecha = reloj.ahora();
  try {
    const capturada = await deps.pagos.capturarPreautorizacion(pago.referenciaBancard);
    const transicion = registrarEstadoDePagoP8(
      expediente,
      { ...pago, estado: capturada.estado, confirmadoEn: pago.confirmadoEn ?? fecha },
      fecha,
    );
    if (!transicion.ok) return { expediente, pendiente: true };

    await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: PASO_EVIDENCIA_CAPTURA_P8,
      fecha,
      contexto,
      resultado: "EXITOSO",
      detalle: {
        operacion: "CAPTURA_POR_FIRMA",
        medio: pago.medio,
        montoGs: pago.montoGs,
        referenciaBancard: pago.referenciaBancard,
        estadoPago: capturada.estado,
      },
    });
    return { expediente: transicion.expediente, pendiente: capturada.estado !== "CAPTURADO" };
  } catch (error) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: PASO_EVIDENCIA_CAPTURA_P8,
      fecha,
      contexto,
      resultado: "FALLIDO",
      detalle: {
        operacion: "CAPTURA_POR_FIRMA",
        medio: pago.medio,
        referenciaBancard: pago.referenciaBancard,
        detalle: error instanceof Error ? error.message : "desconocido",
      },
    });
    return { expediente, pendiente: true };
  }
}

// ---------------------------------------------------------------------------
// Operación 3 — vencimiento del plazo
// ---------------------------------------------------------------------------

export type ResultadoVencimientoP8 =
  | { readonly ok: true; readonly vencio: boolean; readonly estado: EstadoExpediente }
  | {
      readonly ok: false;
      readonly motivo: "EXPEDIENTE_NO_ENCONTRADO" | "CONFLICTO_CONCURRENCIA";
    };

/**
 * Evalúa el plazo y, si se cumplió, vence el expediente.
 *
 * Es la misma rutina que corre al principio de las otras dos operaciones,
 * expuesta aparte para que la pantalla pueda dispararla cuando su cuenta
 * regresiva llega a cero sin tener que pedir un enlace ni confirmar una firma.
 *
 * La pantalla la dispara a la vez que sigue sondeando `/api/p8/estado`, así
 * que perder la carrera de escritura contra ese sondeo es esperable: se
 * reintenta con una lectura fresca, que converge (un expediente ya VENCIDO no
 * se vuelve a escribir ni deja evidencia nueva).
 */
export async function vencerPlazoFirmaP8(
  deps: DependenciasP8,
  entrada: { readonly expedienteId: string; readonly contexto: ContextoPeticion },
): Promise<ResultadoVencimientoP8> {
  return conReintentoPorConflicto<ResultadoVencimientoP8>(
    async () => {
      const reloj = resolverReloj(deps);
      const guardado = await deps.expedientes.obtenerPorId(entrada.expedienteId);
      if (!guardado) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

      const { expediente, vencio } = await aplicarVencimiento(deps, reloj, guardado, entrada.contexto);
      return { ok: true, vencio, estado: expediente.estado };
    },
    () => ({ ok: false, motivo: "CONFLICTO_CONCURRENCIA" }),
  );
}

// ---------------------------------------------------------------------------
// Lectura para la pantalla
// ---------------------------------------------------------------------------

export interface DocumentoVisibleP8 {
  readonly codigo: string;
  readonly version: number;
  readonly hashSha256: string;
  readonly cerradoEn: string;
}

export interface GarantiaDePagoVisibleP8 {
  readonly medio: MedioDePago;
  readonly lista: boolean;
  /** `true` con QR y débito: ya se cobró. `false` con crédito: está reservado. */
  readonly pagoDefinitivo: boolean;
  readonly referenciaBancard: string | null;
}

export interface ResumenFirmaP8 {
  readonly estado: EstadoExpediente;
  readonly numeroPropuesta: string | null;
  readonly solicitud: DocumentoVisibleP8;
  readonly fipf: DocumentoVisibleP8;
  /** Canales verificados, enmascarados: nunca el valor completo (regla de UI). */
  readonly canalWhatsappEnmascarado: string | null;
  readonly canalEmailEnmascarado: string | null;
  readonly garantia: GarantiaDePagoVisibleP8 | null;
  readonly plazoFirmaVenceEn: string | null;
  readonly acto: ActoDeFirmaVisible | null;
  readonly firmadoEn: string | null;
}

function documentoVisible(documento: DocumentoCerrado): DocumentoVisibleP8 {
  return {
    codigo: documento.codigo,
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

  const estadosVisibles: readonly EstadoExpediente[] = ["PAQUETE_GENERADO", "FIRMADO", "EMITIDO"];
  if (!estadosVisibles.includes(expediente.estado)) return null;

  const pago = expediente.pago;

  return {
    estado: expediente.estado,
    numeroPropuesta: expediente.numeroPropuesta,
    solicitud: documentoVisible(paquete.solicitud),
    fipf: documentoVisible(paquete.fipf),
    canalWhatsappEnmascarado: expediente.canalWhatsapp
      ? enmascararCelular(expediente.canalWhatsapp.valor)
      : null,
    canalEmailEnmascarado: expediente.canalEmail ? enmascararCorreo(expediente.canalEmail.valor) : null,
    garantia: pago
      ? {
          medio: pago.medio,
          lista: garantiaDePagoLista(pago.estado),
          pagoDefinitivo: esPagoDefinitivoAntesDeFirma(pago.medio),
          referenciaBancard: pago.referenciaBancard,
        }
      : null,
    plazoFirmaVenceEn: expediente.plazoFirmaVenceEn,
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
