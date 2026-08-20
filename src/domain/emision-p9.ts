/**
 * Caso de uso de P9 · Contratación aceptada
 * (docs/ESPECIFICACION_PANTALLAS.md → "P9 · Paso 9 de 9 — Contratación
 * aceptada").
 *
 * Dos operaciones y una lectura:
 *
 * 1. `emitirPolizaP9` — al entrar a la pantalla: SeguroLoTengo remite el
 *    expediente a Alianza, que lo valida automáticamente por SEBAOT.
 *    PAGO_CONFIRMADO → EMITIDO, con la póliza `EN PROCESO DE EMISIÓN`.
 * 2. `consultarEmisionP9` — el sondeo posterior, mientras la pantalla muestra
 *    el badge `EN EMISIÓN`. Actualiza el estado de la póliza y de la factura
 *    **sin mover el estado del expediente**, que ya llegó a EMITIDO.
 * 3. `leerResumenP9` — la proyección que dibuja la pantalla.
 *
 * ## Las cuatro reglas que este módulo hace imposibles de violar
 *
 * **No hay emisión sin firma completa** (regla inviolable #3).
 * `PolicyIssuer.emitirPoliza` exige `firma: Firma` con los dos hashes
 * obligatorios, y llegar al estado de origen ya exigió pasar por la firma: no
 * hay forma de pedirle a SEBAOT que emita sobre un paquete a medio firmar.
 *
 * **El orden es firma → cobro → emisión** (filas 43 y 44 de la matriz de
 * cumplimiento), que desde D-08 es también el orden de las pantallas. El único
 * estado de origen es PAGO_CONFIRMADO, que ya significa *"el dinero entró"*;
 * la comprobación explícita del `Pago` se conserva igual porque una condición
 * de la que depende una obligación legal no se sostiene sola en el grafo —
 * fila 44: *"Si falla el cobro, no solicitar la emisión automática"* (Código
 * Civil, art. 1373; Ley 4868/13, arts. 7(e) y 7(p)).
 *
 * **La póliza conserva el correlativo de la propuesta** (fila 47). El número no
 * lo inventa nadie acá: se le pasa `numeroPropuesta` a SEBAOT y
 * `registrarEmisionP9` rechaza cualquier número que no coincida.
 *
 * **No se genera Nota de Cobertura.** No hay función que la produzca ni campo
 * que la represente, ni en este módulo ni en el puerto.
 *
 * ## Lo que este módulo NO hace
 *
 * No emite la póliza ni la factura: las emite Alianza (SEBAOT y SIFEN) y las
 * envía a los canales verificados. SeguroLoTengo solo recibe estado y
 * referencia, y desde el portal se descargan únicamente la Solicitud y el FIPF
 * firmados (CLAUDE.md → "Reglas transversales de integraciones").
 */
import { randomUUID } from "node:crypto";
import { ErrorEscrituraConcurrente, conReintentoPorConflicto } from "./concurrencia";
import type { EvidenceStore } from "../ports/evidence-store";
import type { PolicyIssuer } from "../ports/policy-issuer";
import { actualizarEstadoPolizaP9, registrarEmisionP9 } from "./expediente";
import { enmascararCorreo } from "./correo";
import { enmascararCelular } from "./telefono";
import {
  TEXTO_COMUNICACIONES_COMERCIALES,
  VERSION_COMUNICACIONES_COMERCIALES,
} from "./textos-p9";
import { cobroConfirmadoParaEmision } from "./tipos";
import type {
  EstadoExpediente,
  Expediente,
  MedioDePago,
  PolizaDelExpediente,
  RegistroEvidencia,
} from "./tipos";
import type { ContextoPeticion, RepositorioExpediente } from "./verificacion-canal";

// ---------------------------------------------------------------------------
// Dependencias y constantes
// ---------------------------------------------------------------------------

export interface DependenciasP9 {
  readonly polizas: PolicyIssuer;
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

/**
 * Único estado desde el que se puede remitir el expediente a Alianza.
 *
 * Era `FIRMADO` mientras se cobraba antes de firmar. Con el orden invertido
 * (D-08) firmar es el paso anterior y lo último que falta es la plata, así que
 * la emisión arranca del cobro acreditado.
 */
export const ESTADO_REQUERIDO_P9: EstadoExpediente = "PAGO_CONFIRMADO";

export const PASO_EVIDENCIA_EMISION_P9 = "P9_EMISION_POLIZA";
export const PASO_EVIDENCIA_ESTADO_POLIZA_P9 = "P9_ESTADO_POLIZA";
export const PASO_EVIDENCIA_COMUNICACIONES_P9 = "P9_COMUNICACIONES_COMERCIALES";

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

export type MotivoRechazoP9 =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "SIN_FIRMA"
  | "COBRO_NO_CONFIRMADO"
  | "EXPEDIENTE_INCOMPLETO"
  | "SEBAOT_NO_DISPONIBLE"
  /**
   * Otra petición escribió el expediente entre la lectura y el guardado y el
   * conflicto persistió tras los reintentos (`src/domain/concurrencia.ts`).
   * No se perdió nada: el bloqueo optimista impidió pisar la otra escritura.
   * La próxima carga o sondeo ve la versión que ganó.
   */
  | "CONFLICTO_CONCURRENCIA";

export type ResultadoEmisionP9 =
  | {
      readonly ok: true;
      /** `false` cuando el expediente ya estaba EMITIDO y se devolvió lo persistido. */
      readonly emitida: boolean;
      readonly estado: EstadoExpediente;
      readonly poliza: PolizaDelExpediente;
    }
  | { readonly ok: false; readonly motivo: MotivoRechazoP9; readonly detalle?: string };

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

interface Reloj {
  readonly ahora: () => string;
  readonly nuevoId: () => string;
}

function resolverReloj(deps: DependenciasP9): Reloj {
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
 * Es lo que exigen las filas 43, 47 y 75: el correlativo que vincula póliza,
 * Solicitud, FIPF y pago, las huellas firmadas, la referencia de Bancard y el
 * estado. Nada más: acá no viaja ningún dato de salud, PEP, cédula ni tarjeta
 * (reglas inviolables #6 y #7).
 */
async function registrarEvidencia(
  deps: DependenciasP9,
  reloj: Reloj,
  entrada: {
    readonly expedienteId: string;
    readonly paso: string;
    readonly fecha: string;
    readonly contexto: ContextoPeticion;
    readonly resultado: "EXITOSO" | "FALLIDO";
    readonly detalle: Readonly<Record<string, string | number | boolean>>;
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
    // Esta pantalla informa un desenlace; no pide aceptar nada. El único
    // consentimiento opcional es el de comunicaciones comerciales, que tiene su
    // propio registro cuando la persona lo marca.
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado: entrada.resultado,
    detalle: formatearDetalle(entrada.detalle),
  };
  await deps.evidencias.guardar(registro);
}

function polizaDesde(
  emision: { readonly numeroPoliza: string; readonly estado: string; readonly emitidaEn: string | null },
  factura: { readonly referencia: string | null; readonly estado: string },
  solicitadaEn: string,
): PolizaDelExpediente {
  return {
    numeroPoliza: emision.numeroPoliza,
    estado: emision.estado as PolizaDelExpediente["estado"],
    emitidaEn: emision.emitidaEn,
    estadoFactura: factura.estado as PolizaDelExpediente["estadoFactura"],
    referenciaFactura: factura.referencia,
    solicitadaEn,
  };
}

// ---------------------------------------------------------------------------
// Operación 1 — remitir el expediente y ordenar la emisión
// ---------------------------------------------------------------------------

/**
 * PAGO_CONFIRMADO → EMITIDO, al entrar a P9.
 *
 * Idempotente de punta a punta: con el expediente ya EMITIDO devuelve la póliza
 * persistida sin volver a llamar a SEBAOT ni a transicionar. Importa porque la
 * pantalla se puede recargar y porque el adaptador oficial va a atender por acá
 * la confirmación de Alianza.
 */
export async function emitirPolizaP9(
  deps: DependenciasP9,
  entrada: { readonly expedienteId: string; readonly contexto: ContextoPeticion },
): Promise<ResultadoEmisionP9> {
  try {
    return await intentarEmitirPolizaP9(deps, entrada);
  } catch (error) {
    // Sin reintento, como `iniciarPagoP7` e `iniciarFirmaP8`: la orden de
    // emisión ya salió hacia SEBAOT y reintentar podría duplicarla
    // (`src/domain/concurrencia.ts`). Se devuelve el conflicto; la próxima
    // carga de la pantalla entra por la rama idempotente si el ganador de la
    // carrera ya dejó el expediente EMITIDO.
    if (error instanceof ErrorEscrituraConcurrente) {
      return { ok: false, motivo: "CONFLICTO_CONCURRENCIA" };
    }
    throw error;
  }
}

async function intentarEmitirPolizaP9(
  deps: DependenciasP9,
  entrada: { readonly expedienteId: string; readonly contexto: ContextoPeticion },
): Promise<ResultadoEmisionP9> {
  const reloj = resolverReloj(deps);
  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  // Ya remitido: se responde con lo persistido.
  if (expediente.estado === "EMITIDO" && expediente.poliza) {
    return { ok: true, emitida: false, estado: expediente.estado, poliza: expediente.poliza };
  }

  if (expediente.estado !== ESTADO_REQUERIDO_P9) {
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  const firma = expediente.firma;
  if (!firma) return { ok: false, motivo: "SIN_FIRMA" };

  const paquete = expediente.paqueteDocumental;
  const pago = expediente.pago;
  if (!paquete || !pago || !expediente.numeroPropuesta) {
    return { ok: false, motivo: "EXPEDIENTE_INCOMPLETO" };
  }

  // Fila 44: sin cobro no se pide la emisión. Con crédito, una preautorización
  // sin capturar no es un cobro — habilitó la firma, no la póliza.
  if (!cobroConfirmadoParaEmision(pago)) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_EMISION_P9,
      fecha: reloj.ahora(),
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: {
        motivo: "COBRO_NO_CONFIRMADO",
        medio: pago.medio,
        estadoPago: pago.estado,
        propuesta: expediente.numeroPropuesta,
      },
    });
    return { ok: false, motivo: "COBRO_NO_CONFIRMADO" };
  }

  const fecha = reloj.ahora();

  let emision;
  let factura;
  try {
    emision = await deps.polizas.emitirPoliza({
      expedienteId: expediente.id,
      // El correlativo de la propuesta: SEBAOT no acuña un número nuevo.
      propuestaId: expediente.numeroPropuesta,
      referenciaBancard: pago.referenciaBancard ?? "",
      paqueteDocumental: paquete,
      // Completa por tipo: no hay forma de emitir sobre una firma parcial.
      firma,
    });
    factura = await deps.polizas.consultarEstadoFacturaElectronica(emision.numeroPoliza);
  } catch (error) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_EMISION_P9,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: {
        motivo: "SEBAOT_NO_DISPONIBLE",
        propuesta: expediente.numeroPropuesta,
        detalle: error instanceof Error ? error.message : "desconocido",
      },
    });
    return { ok: false, motivo: "SEBAOT_NO_DISPONIBLE" };
  }

  const poliza = polizaDesde(emision, factura, fecha);

  const transicion = registrarEmisionP9(expediente, poliza, fecha);
  if (!transicion.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_EMISION_P9,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { motivo: "TRANSICION_INVALIDA", detalle: transicion.error },
    });
    return { ok: false, motivo: "ESTADO_INVALIDO", detalle: transicion.error };
  }

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_EMISION_P9,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: {
      // Todo lo que vincula la póliza con lo que la respalda (fila 47).
      numeroPoliza: poliza.numeroPoliza,
      propuesta: expediente.numeroPropuesta,
      estadoPoliza: poliza.estado,
      referenciaBancard: pago.referenciaBancard ?? "",
      idCode100: firma.idCode100,
      hashSolicitudFirmada: firma.hashSolicitudFirmada,
      hashFipfFirmado: firma.hashFipfFirmado,
      emisorPoliza: "ALIANZA_GARANTIA_SEBAOT",
      // Constancia explícita de que no existe: el producto no la contempla.
      notaDeCobertura: "NO_SE_GENERA",
    },
  });

  return { ok: true, emitida: true, estado: transicion.expediente.estado, poliza };
}

// ---------------------------------------------------------------------------
// Operación 2 — sondear el avance de Alianza
// ---------------------------------------------------------------------------

/**
 * Sondeo de la pantalla mientras la póliza dice `EN EMISIÓN`.
 *
 * **No mueve el estado del expediente**: EMITIDO ya se alcanzó al aceptarse la
 * solicitud. Lo único que cambia es `poliza.estado` y `poliza.estadoFactura`, y
 * solo se escribe cuando efectivamente cambiaron — un sondeo cada dos segundos
 * no tiene por qué generar una escritura.
 */
export async function consultarEmisionP9(
  deps: DependenciasP9,
  entrada: { readonly expedienteId: string; readonly contexto: ContextoPeticion },
): Promise<ResultadoEmisionP9> {
  // Perder la carrera de escritura contra otro sondeo (o contra la carga de la
  // pantalla, que también escribe) se resuelve releyendo: la operación es
  // convergente —si el ganador ya asentó el mismo estado de póliza, la releída
  // cae en `sinCambios` y no escribe— y consultar a SEBAOT no repite efectos.
  return conReintentoPorConflicto(
    () => intentarConsultarEmisionP9(deps, entrada),
    () => ({ ok: false, motivo: "CONFLICTO_CONCURRENCIA" }),
  );
}

async function intentarConsultarEmisionP9(
  deps: DependenciasP9,
  entrada: { readonly expedienteId: string; readonly contexto: ContextoPeticion },
): Promise<ResultadoEmisionP9> {
  const reloj = resolverReloj(deps);
  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  const anterior = expediente.poliza;
  if (expediente.estado !== "EMITIDO" || !anterior) {
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  const emision = await deps.polizas.consultarEstadoPoliza(anterior.numeroPoliza);
  const factura = await deps.polizas.consultarEstadoFacturaElectronica(anterior.numeroPoliza);
  const poliza = polizaDesde(emision, factura, anterior.solicitadaEn);

  const sinCambios =
    poliza.estado === anterior.estado &&
    poliza.estadoFactura === anterior.estadoFactura &&
    poliza.referenciaFactura === anterior.referenciaFactura;
  if (sinCambios) {
    return { ok: true, emitida: false, estado: expediente.estado, poliza: anterior };
  }

  const actualizado = actualizarEstadoPolizaP9(expediente, poliza, reloj.ahora());
  if (!actualizado.ok) return { ok: false, motivo: "ESTADO_INVALIDO", detalle: actualizado.error };

  await deps.expedientes.guardar(actualizado.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_ESTADO_POLIZA_P9,
    fecha: reloj.ahora(),
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: {
      numeroPoliza: poliza.numeroPoliza,
      estadoPoliza: poliza.estado,
      estadoFactura: poliza.estadoFactura,
      ...(poliza.emitidaEn ? { emitidaEn: poliza.emitidaEn } : {}),
      ...(poliza.referenciaFactura ? { referenciaFactura: poliza.referenciaFactura } : {}),
    },
  });

  return { ok: true, emitida: false, estado: expediente.estado, poliza };
}

// ---------------------------------------------------------------------------
// Operación 3 — comunicaciones comerciales (opcional)
// ---------------------------------------------------------------------------

/**
 * Bloque `COMUNICACIONES COMERCIALES · OPCIONAL` del pie de P9.
 *
 * Es un consentimiento de marketing y se trata como tal:
 *
 * - **No toca el expediente.** El contrato ya está celebrado; aceptar o no
 *   aceptar no cambia ni el estado ni la emisión. Por eso esto solo escribe
 *   evidencia y no transiciona nada.
 * - **Versionado y con el literal íntegro**, igual que la autorización de P3 y
 *   la declaración de origen lícito de P7 (regla inviolable #10).
 * - **Revocable**: `acepta: false` deja su propio registro. No se borra ni se
 *   sobrescribe el anterior, así que queda la historia completa de qué se
 *   autorizó y cuándo.
 * - **Nunca premarcado**: esta función solo corre por un acto de la persona.
 *   Un consentimiento premarcado no es consentimiento (Ley 4868/13, art. 7(r)).
 */
export async function registrarComunicacionesComercialesP9(
  deps: DependenciasP9,
  entrada: {
    readonly expedienteId: string;
    readonly acepta: boolean;
    readonly contexto: ContextoPeticion;
  },
): Promise<{ readonly ok: true; readonly acepta: boolean } | { readonly ok: false; readonly motivo: MotivoRechazoP9 }> {
  const reloj = resolverReloj(deps);
  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  // Solo desde la pantalla que lo ofrece: no es un consentimiento que se pueda
  // dejar registrado en cualquier punto del flujo.
  if (expediente.estado !== "EMITIDO") return { ok: false, motivo: "ESTADO_INVALIDO" };

  const registro: RegistroEvidencia = {
    id: reloj.nuevoId(),
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_COMUNICACIONES_P9,
    fecha: reloj.ahora(),
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: VERSION_COMUNICACIONES_COMERCIALES,
    // El literal íntegro, aunque se esté revocando: es el texto sobre el que se
    // tomó la decisión en los dos casos.
    textoAceptado: TEXTO_COMUNICACIONES_COMERCIALES,
    resultado: "EXITOSO",
    detalle: formatearDetalle({ acepta: entrada.acepta }),
  };
  await deps.evidencias.guardar(registro);

  return { ok: true, acepta: entrada.acepta };
}

// ---------------------------------------------------------------------------
// Lectura para la pantalla
// ---------------------------------------------------------------------------

export interface DocumentoDescargableP9 {
  readonly codigo: string;
  readonly version: number;
  /** Huella del PDF **firmado**, que es el archivo que se descarga. */
  readonly hashFirmado: string;
}

export interface ResumenP9 {
  readonly estado: EstadoExpediente;
  readonly numeroPropuesta: string;
  readonly numeroPoliza: string;
  readonly estadoPoliza: string;
  readonly estadoFactura: string;
  readonly referenciaFactura: string | null;
  readonly polizaEmitidaEn: string | null;
  readonly referenciaBancard: string | null;
  readonly medio: MedioDePago | null;
  readonly nombreAsegurado: string | null;
  readonly documentoEnmascarado: string | null;
  readonly whatsappEnmascarado: string | null;
  readonly correoEnmascarado: string | null;
  readonly firmadoEn: string | null;
  readonly pagoConfirmadoEn: string | null;
  readonly solicitudAceptadaEn: string;
  readonly solicitud: DocumentoDescargableP9;
  readonly fipf: DocumentoDescargableP9;
}

/** `9323336` → `93•••••`: alcanza para reconocer el documento sin exponerlo. */
function enmascararCedula(numero: string): string {
  const visibles = numero.slice(0, 2);
  return `${visibles}${"•".repeat(Math.max(numero.length - 2, 0))}`;
}

/**
 * Lo que P9 necesita para dibujarse. Devuelve `null` si el expediente todavía
 * no llegó a EMITIDO: la pantalla de contratación aceptada no puede mostrarse
 * sobre un expediente que no lo está.
 *
 * No expone la cédula completa ni ningún canal sin enmascarar (regla de UI), ni
 * un dato de tarjeta (regla inviolable #6): del pago salen el medio y la
 * referencia de Bancard, nada más.
 */
export function leerResumenP9(expediente: Expediente): ResumenP9 | null {
  const poliza = expediente.poliza;
  const paquete = expediente.paqueteDocumental;
  const firma = expediente.firma;
  if (expediente.estado !== "EMITIDO" || !poliza || !paquete || !firma) return null;

  const identidad = expediente.identidad;
  const pago = expediente.pago;

  return {
    estado: expediente.estado,
    numeroPropuesta: expediente.numeroPropuesta ?? poliza.numeroPoliza,
    numeroPoliza: poliza.numeroPoliza,
    estadoPoliza: poliza.estado,
    estadoFactura: poliza.estadoFactura,
    referenciaFactura: poliza.referenciaFactura,
    polizaEmitidaEn: poliza.emitidaEn,
    referenciaBancard: pago?.referenciaBancard ?? null,
    medio: pago?.medio ?? null,
    nombreAsegurado: identidad ? `${identidad.nombres} ${identidad.apellidos}`.trim() : null,
    documentoEnmascarado: identidad ? enmascararCedula(identidad.numeroCedula) : null,
    whatsappEnmascarado: expediente.canalWhatsapp
      ? enmascararCelular(expediente.canalWhatsapp.valor)
      : null,
    correoEnmascarado: expediente.canalEmail ? enmascararCorreo(expediente.canalEmail.valor) : null,
    firmadoEn: firma.firmadoEn,
    pagoConfirmadoEn: pago?.confirmadoEn ?? null,
    solicitudAceptadaEn: poliza.solicitadaEn,
    solicitud: {
      codigo: paquete.solicitud.codigo,
      version: paquete.solicitud.version,
      hashFirmado: firma.hashSolicitudFirmada,
    },
    fipf: {
      codigo: paquete.fipf.codigo,
      version: paquete.fipf.version,
      hashFirmado: firma.hashFipfFirmado,
    },
  };
}
