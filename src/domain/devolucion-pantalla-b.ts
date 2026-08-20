/**
 * Caso de uso de la Pantalla B · QR pagado, firma no completada
 * (docs/ESPECIFICACION_PANTALLAS.md → "Pantalla B · QR pagado, firma no
 * completada").
 *
 * Se llega acá desde el vencimiento del plazo de firma de P8: el expediente
 * quedó en VENCIDO y hay un pago que resolver. Dos operaciones y una lectura:
 *
 * 1. `iniciarDevolucionPantallaB` — VENCIDO → DEVOLUCION_EN_TRAMITE. Corre al
 *    entrar a la pantalla, una sola vez, y **solo si el dinero efectivamente se
 *    movió** (QR o débito). Es lo que hace verdadero el encabezado: *"se inició
 *    el procedimiento de devolución"*.
 * 2. `registrarDevolucionEjecutadaPantallaB` — DEVOLUCION_EN_TRAMITE →
 *    DEVUELTO. Alianza devolvió el premio al medio de origen. Ocurre fuera del
 *    flujo digital (presencial, en las oficinas), así que lo asienta quien lo
 *    sabe: en el demo, el panel; en producción, la consola administrativa.
 * 3. `leerCasoVencido` — la proyección que dibuja la pantalla.
 *
 * ## Las tres reglas que este módulo hace imposibles de violar
 *
 * **No hay devolución sin cobro.** Con tarjeta de crédito el importe quedó
 * reservado y P8 ya liberó la reserva al vencer: no hay premio que devolver, y
 * el expediente se queda en VENCIDO. Abrir un trámite de devolución ahí sería
 * describirle a la persona un movimiento de plata que no existió (fila 25 de
 * `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`; misma razón por la que
 * P7 separó el débito del crédito).
 *
 * **No hay vuelta al flujo digital.** DEVOLUCION_EN_TRAMITE y DEVUELTO no
 * tienen ninguna transición hacia pago, firma ni emisión, y los dos bloquean un
 * registro nuevo con la misma cédula (regla inviolable #11). Solo la consola
 * administrativa levanta el bloqueo, creando un expediente **nuevo** enlazado.
 *
 * **La devolución va al origen y a ningún otro lado.** Esta pantalla no tiene
 * ni un campo donde escribir una cuenta de destino, y este módulo tampoco: el
 * medio de origen es el `Pago` que ya está en el expediente. La leyenda *"No se
 * devuelve en efectivo, a terceros ni a otra cuenta"* no es solo un texto — no
 * hay dónde poner un tercero (fila 30 de la matriz, Ley 4868/13, arts. 7(f), 17
 * y 30(b)).
 *
 * ## Lo que este módulo NO hace
 *
 * **No manda las notificaciones.** El bloque `ACTORES Y REGISTRO` dice que
 * SeguroLoTengo *"genera las comunicaciones"*, y eso es lo que se hace: se deja
 * el registro de evidencia del aviso a los dos canales verificados. La entrega
 * en sí necesitaría un proveedor de notificaciones que hoy no existe en
 * `docs/Tabla de Integraciones externas - Tabla.csv` (`OtpProvider` es para
 * OTP), y CLAUDE.md prohíbe introducir uno sin registrarlo antes.
 *
 * **No ejecuta la devolución.** La hace Alianza, presencialmente, contra el
 * formulario firmado. Acá solo se asienta que ocurrió.
 */
import { randomUUID } from "node:crypto";
import type { EvidenceStore } from "../ports/evidence-store";
import { transicionarExpediente } from "./expediente";
import { enmascararCorreo } from "./correo";
import { enmascararCelular } from "./telefono";
import { HITOS_SEGUIMIENTO } from "./textos-pantalla-b";
import { pagoAcreditado } from "./tipos";
import type { EstadoExpediente, Expediente, MedioDePago, RegistroEvidencia } from "./tipos";
import type { ContextoPeticion, RepositorioExpediente } from "./verificacion-canal";

// ---------------------------------------------------------------------------
// Dependencias y constantes
// ---------------------------------------------------------------------------

export interface DependenciasPantallaB {
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

export const PASO_EVIDENCIA_DEVOLUCION_INICIADA = "PANTALLA_B_DEVOLUCION_INICIADA";
export const PASO_EVIDENCIA_DEVOLUCION_EJECUTADA = "PANTALLA_B_DEVOLUCION_EJECUTADA";

/** Estados en los que la Pantalla B tiene algo que mostrar. */
export const ESTADOS_PANTALLA_B: readonly EstadoExpediente[] = [
  "VENCIDO",
  "DEVOLUCION_EN_TRAMITE",
  "DEVUELTO",
];

/** Horas del plazo completo, contra las que se prorratean los hitos. */
const HORAS_DEL_PLAZO = 24;

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

interface Reloj {
  readonly ahora: () => string;
  readonly nuevoId: () => string;
}

function resolverReloj(deps: DependenciasPantallaB): Reloj {
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
 * Única forma en la que información de esta pantalla sale hacia la evidencia.
 *
 * Es lo que enumera el bloque `EVIDENCIA CONSERVADA`: pago y referencia
 * Bancard, fecha y hora, avisos a los dos canales, vencimiento y devolución al
 * origen. Nada más: acá no viaja ningún dato de salud, PEP, cédula completa ni
 * tarjeta (reglas inviolables #6 y #7).
 */
async function registrarEvidencia(
  deps: DependenciasPantallaB,
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
    // Esta pantalla no pide aceptar nada: informa un desenlace.
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado: entrada.resultado,
    detalle: formatearDetalle(entrada.detalle),
  };
  await deps.evidencias.guardar(registro);
}

// ---------------------------------------------------------------------------
// Operación 1 — abrir el trámite de devolución
// ---------------------------------------------------------------------------

export type MotivoRechazoPantallaB =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "SIN_PAGO_QUE_DEVOLVER";

export type ResultadoIniciarDevolucion =
  | {
      readonly ok: true;
      /** `false` si el trámite ya estaba abierto o si no corresponde abrirlo. */
      readonly iniciado: boolean;
      readonly estado: EstadoExpediente;
    }
  | { readonly ok: false; readonly motivo: MotivoRechazoPantallaB };

/**
 * VENCIDO → DEVOLUCION_EN_TRAMITE, al entrar a la pantalla.
 *
 * Idempotente y silencioso: sobre un expediente que ya está en trámite, ya
 * devuelto, o que venció con una tarjeta de crédito (donde no hay nada que
 * devolver), devuelve `iniciado: false` sin escribir nada. Así la pantalla lo
 * puede llamar en cada carga.
 */
export async function iniciarDevolucionPantallaB(
  deps: DependenciasPantallaB,
  entrada: { readonly expedienteId: string; readonly contexto: ContextoPeticion },
): Promise<ResultadoIniciarDevolucion> {
  const reloj = resolverReloj(deps);
  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  if (expediente.estado === "DEVOLUCION_EN_TRAMITE" || expediente.estado === "DEVUELTO") {
    return { ok: true, iniciado: false, estado: expediente.estado };
  }

  if (expediente.estado !== "VENCIDO") {
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  const pago = expediente.pago;
  // Sin cobro acreditado no hay nada que devolver. Con los tres medios
  // cobrando directo (D-02), el criterio dejó de depender del medio: depende
  // de si el dinero entró.
  if (!pago || !pagoAcreditado(pago.estado)) {
    return { ok: true, iniciado: false, estado: expediente.estado };
  }

  const fecha = reloj.ahora();
  const transicion = transicionarExpediente(expediente, "DEVOLUCION_EN_TRAMITE", {}, fecha);
  if (!transicion.ok) return { ok: false, motivo: "ESTADO_INVALIDO" };

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_DEVOLUCION_INICIADA,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: {
      medio: pago.medio,
      montoGs: pago.montoGs,
      referenciaBancard: pago.referenciaBancard ?? "",
      propuesta: expediente.numeroPropuesta ?? "",
      plazoPagoVenceEn: expediente.plazoPagoVenceEn ?? "",
      // `ACTORES Y REGISTRO`: SeguroLoTengo genera las comunicaciones. Queda el
      // registro del aviso a los dos canales verificados; la entrega necesita
      // un proveedor de notificaciones que todavía no está en el catálogo.
      avisoWhatsapp: expediente.canalWhatsapp
        ? enmascararCelular(expediente.canalWhatsapp.valor)
        : "sin canal",
      avisoCorreo: expediente.canalEmail ? enmascararCorreo(expediente.canalEmail.valor) : "sin canal",
      destinoDevolucion: "MEDIO_DE_ORIGEN",
    },
  });

  return { ok: true, iniciado: true, estado: transicion.expediente.estado };
}

// ---------------------------------------------------------------------------
// Operación 2 — asentar la devolución ejecutada
// ---------------------------------------------------------------------------

export type ResultadoDevolucionEjecutada =
  | { readonly ok: true; readonly estado: EstadoExpediente }
  | { readonly ok: false; readonly motivo: MotivoRechazoPantallaB };

/**
 * DEVOLUCION_EN_TRAMITE → DEVUELTO: Alianza devolvió el premio al medio de
 * origen, contra el formulario presencial firmado.
 *
 * No recibe ningún dato de destino **a propósito**: el medio de origen es el
 * `Pago` que ya está en el expediente, y no hay parámetro por el que se pueda
 * pedir otra cuenta. La leyenda *"No se devuelve en efectivo, a terceros ni a
 * otra cuenta"* queda así garantizada por la firma de la función, no por una
 * validación que alguien pueda saltear.
 */
export async function registrarDevolucionEjecutadaPantallaB(
  deps: DependenciasPantallaB,
  entrada: { readonly expedienteId: string; readonly contexto: ContextoPeticion },
): Promise<ResultadoDevolucionEjecutada> {
  const reloj = resolverReloj(deps);
  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  // Idempotente: ya devuelto se responde con lo persistido.
  if (expediente.estado === "DEVUELTO") return { ok: true, estado: expediente.estado };

  if (expediente.estado !== "DEVOLUCION_EN_TRAMITE") {
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  const pago = expediente.pago;
  if (!pago) return { ok: false, motivo: "SIN_PAGO_QUE_DEVOLVER" };

  const fecha = reloj.ahora();
  const transicion = transicionarExpediente(expediente, "DEVUELTO", {}, fecha);
  if (!transicion.ok) return { ok: false, motivo: "ESTADO_INVALIDO" };

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_DEVOLUCION_EJECUTADA,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: {
      medio: pago.medio,
      montoGs: pago.montoGs,
      referenciaBancard: pago.referenciaBancard ?? "",
      propuesta: expediente.numeroPropuesta ?? "",
      ejecutadaPor: "ALIANZA_GARANTIA",
      destinoDevolucion: "MEDIO_DE_ORIGEN",
    },
  });

  return { ok: true, estado: transicion.expediente.estado };
}

// ---------------------------------------------------------------------------
// Lectura para la pantalla
// ---------------------------------------------------------------------------

export interface HitoSeguimientoCalculado {
  readonly horas: number;
  readonly rotulo: string;
  readonly detalle: string;
  readonly esVencimiento: boolean;
  /** Instante en el que correspondía el recordatorio, o `null` sin datos de pago. */
  readonly en: string | null;
  readonly cumplido: boolean;
}

export interface CasoVencido {
  readonly estado: EstadoExpediente;
  readonly rotuloEstado: string;
  readonly numeroPropuesta: string | null;
  readonly referenciaBancard: string | null;
  readonly premioGs: number;
  readonly medio: MedioDePago | null;
  /**
   * `true` solo si el dinero efectivamente entró — lo que bajo el orden nuevo
   * no puede pasar en un expediente vencido, y bajo el viejo sí pasaba.
   */
  readonly hayPremioQueDevolver: boolean;
  readonly nombreAsegurado: string | null;
  readonly documentoEnmascarado: string | null;
  readonly whatsappEnmascarado: string | null;
  readonly correoEnmascarado: string | null;
  readonly pagoConfirmadoEn: string | null;
  readonly plazoPagoVenceEn: string | null;
  readonly hitos: readonly HitoSeguimientoCalculado[];
}

/** `9323336` → `93•••••`: alcanza para reconocer el documento sin exponerlo. */
function enmascararCedula(numero: string): string {
  const visibles = numero.slice(0, 2);
  return `${visibles}${"•".repeat(Math.max(numero.length - 2, 0))}`;
}

/**
 * Los cuatro hitos con su instante.
 *
 * Se **prorratean sobre el plazo real** en vez de sumar 1, 5 y 12 horas fijas.
 * Con el plazo de producción da exactamente lo mismo (24 horas: 1 h, 5 h, 12 h
 * y 24 h), pero cuando el panel de demo comprime el plazo a 30 segundos, los
 * recordatorios caen dentro de la ventana comprimida en vez de quedar todos en
 * el futuro. Los rótulos siguen siendo los de la especificación, que es lo que
 * la pantalla tiene que decir.
 */
function calcularHitos(
  desde: string | null,
  hasta: string | null,
  ahora: string,
): readonly HitoSeguimientoCalculado[] {
  const inicio = desde ? new Date(desde).getTime() : Number.NaN;
  const fin = hasta ? new Date(hasta).getTime() : Number.NaN;
  const plazoMs = fin - inicio;

  return HITOS_SEGUIMIENTO.map((hito) => {
    if (!Number.isFinite(plazoMs) || plazoMs <= 0) {
      return { ...hito, en: null, cumplido: true };
    }
    const en = new Date(inicio + (hito.horas / HORAS_DEL_PLAZO) * plazoMs).toISOString();
    return { ...hito, en, cumplido: ahora >= en };
  });
}

/**
 * Lo que la Pantalla B necesita para dibujarse. Devuelve `null` si el
 * expediente no está en la rama del vencimiento: la pantalla no puede mostrarse
 * con datos de uno que sigue en el flujo normal ni de uno emitido.
 *
 * Nunca expone el valor completo de un canal ni la cédula entera (regla de UI y
 * regla inviolable #7), ni ningún dato de tarjeta (regla inviolable #6): del
 * pago salen el medio, el importe y la referencia de Bancard, nada más.
 */
export function leerCasoVencido(
  expediente: Expediente,
  ahora: string = new Date().toISOString(),
): CasoVencido | null {
  if (!ESTADOS_PANTALLA_B.includes(expediente.estado)) return null;

  const pago = expediente.pago;
  const identidad = expediente.identidad;

  return {
    estado: expediente.estado,
    rotuloEstado: expediente.estado,
    numeroPropuesta: expediente.numeroPropuesta,
    referenciaBancard: pago?.referenciaBancard ?? null,
    premioGs: pago?.montoGs ?? expediente.plan?.premioAnualGs ?? 0,
    medio: pago?.medio ?? null,
    hayPremioQueDevolver: pago ? pagoAcreditado(pago.estado) : false,
    nombreAsegurado: identidad ? `${identidad.nombres} ${identidad.apellidos}`.trim() : null,
    documentoEnmascarado: identidad ? enmascararCedula(identidad.numeroCedula) : null,
    whatsappEnmascarado: expediente.canalWhatsapp
      ? enmascararCelular(expediente.canalWhatsapp.valor)
      : null,
    correoEnmascarado: expediente.canalEmail ? enmascararCorreo(expediente.canalEmail.valor) : null,
    pagoConfirmadoEn: pago?.confirmadoEn ?? null,
    plazoPagoVenceEn: expediente.plazoPagoVenceEn,
    // D-08 · el reloj arranca con la firma, no con el pago. Para los
    // expedientes vencidos bajo el orden viejo —que sí pagaron y no firmaron—
    // se usa el pago, que es el hito que tenían.
    hitos: calcularHitos(
      expediente.firma?.firmadoEn ?? pago?.confirmadoEn ?? null,
      expediente.plazoPagoVenceEn,
      ahora,
    ),
  };
}
