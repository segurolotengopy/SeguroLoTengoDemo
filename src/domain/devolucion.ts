/**
 * Seguimiento de una devolución del premio (D-02).
 *
 * Con la inversión de D-08 el vencimiento dejó de costar plata —se firma antes
 * de cobrar, así que caducar es gratis— y la devolución quedó reservada a lo
 * único que sí puede pedirse: **un cobro ya acreditado**. Este módulo es ese
 * camino, y es el que le devuelve a los estados `DEVOLUCION_EN_TRAMITE` y
 * `DEVUELTO` un disparador propio en vez de dejarlos como legado.
 *
 * ## Dos linajes que no se mezclan
 *
 * `devolucion-pantalla-b.ts` atiende el camino **viejo**: expedientes que
 * vencieron bajo el orden anterior con el pago hecho. Sigue existiendo porque
 * esos expedientes existen y no se reescriben (regla inviolable #10), y
 * conserva sus propios pasos de evidencia para que su historia siga contándose
 * igual que cuando ocurrió.
 *
 * Este módulo atiende el camino **nuevo**: alguien pide que le devuelvan un
 * premio que ya se cobró. Los dos terminan en los mismos estados y escriben el
 * mismo `Expediente.devolucion`, así que la consola los muestra igual; lo que
 * no comparten es la evidencia, porque son hechos distintos.
 *
 * ## Las tres reglas que este módulo hace imposibles de violar
 *
 * **No hay devolución sin cobro acreditado.** Se exige `pagoAcreditado`: abrir
 * un trámite sobre un expediente sin dinero adentro sería describirle a la
 * persona un movimiento que no existió.
 *
 * **La devolución va al medio de origen y a ningún otro lado.** No hay ni un
 * parámetro donde escribir una cuenta de destino — el medio es el `Pago` que
 * ya está en el expediente. La leyenda *"no se devuelve en efectivo, a
 * terceros ni a otra cuenta"* queda garantizada por la firma de las funciones
 * (fila 30 de la matriz; Ley 4868/13, arts. 7(f), 17 y 30(b)).
 *
 * **No hay vuelta al flujo digital.** `DEVOLUCION_EN_TRAMITE` y `DEVUELTO` no
 * tienen transición hacia pago, firma ni emisión, y los dos bloquean un
 * registro nuevo con la misma cédula (regla inviolable #11).
 *
 * ## Lo que este módulo NO hace
 *
 * **No ejecuta la devolución.** La hace Bancard/Alianza fuera del flujo
 * digital; el expediente la asienta y la sigue. Por eso `acreditarDevolucion`
 * recibe la referencia del reintegro: es el dato que prueba que ocurrió, y
 * viene de afuera.
 */
import { randomUUID } from "node:crypto";
import type { EvidenceStore } from "../ports/evidence-store";
import { transicionarExpediente } from "./expediente";
import { pagoAcreditado } from "./tipos";
import type {
  DevolucionDelExpediente,
  EstadoExpediente,
  MotivoDevolucion,
  RegistroEvidencia,
  SolicitanteDevolucion,
} from "./tipos";
import type { ContextoPeticion, RepositorioExpediente } from "./verificacion-canal";

export {
  ROTULO_MOTIVO_DEVOLUCION,
  ROTULO_SOLICITANTE_DEVOLUCION,
  leerSeguimientoDevolucion,
} from "./textos-devolucion";
export type { SeguimientoDevolucion } from "./textos-devolucion";

export const PASO_EVIDENCIA_DEVOLUCION_SOLICITADA = "DEVOLUCION_SOLICITADA";
export const PASO_EVIDENCIA_DEVOLUCION_ACREDITADA = "DEVOLUCION_ACREDITADA";

/** Estados desde los que se puede pedir una devolución: los que tienen dinero adentro. */
export const ESTADOS_CON_DEVOLUCION_POSIBLE: readonly EstadoExpediente[] = [
  "PAGO_CONFIRMADO",
  "EMITIDO",
];

export interface DependenciasDevolucion {
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

export type MotivoRechazoDevolucion =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "SIN_COBRO_ACREDITADO"
  | "MOTIVO_INVALIDO"
  | "SOLICITANTE_INVALIDO"
  | "SIN_TRAMITE_ABIERTO"
  | "REFERENCIA_REQUERIDA";

export type ResultadoDevolucion =
  | {
      readonly ok: true;
      /** `false` cuando el trámite ya estaba en ese punto y se respondió lo persistido. */
      readonly cambio: boolean;
      readonly estado: EstadoExpediente;
      readonly devolucion: DevolucionDelExpediente;
    }
  | { readonly ok: false; readonly motivo: MotivoRechazoDevolucion };

// ---------------------------------------------------------------------------
// Validación de la entrada
// ---------------------------------------------------------------------------

const SOLICITANTES: readonly SolicitanteDevolucion[] = ["TITULAR", "INTERSEGUROS", "ALIANZA"];

const MOTIVOS: readonly MotivoDevolucion[] = [
  "PEDIDO_DEL_TITULAR",
  "ERROR_DE_COBRO",
  "COBRO_DUPLICADO",
  "VENCIMIENTO_LEGADO",
];

export function esSolicitanteDevolucion(valor: unknown): valor is SolicitanteDevolucion {
  return typeof valor === "string" && SOLICITANTES.includes(valor as SolicitanteDevolucion);
}

export function esMotivoDevolucion(valor: unknown): valor is MotivoDevolucion {
  return typeof valor === "string" && MOTIVOS.includes(valor as MotivoDevolucion);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Reloj {
  readonly ahora: () => string;
  readonly nuevoId: () => string;
}

function resolverReloj(deps: DependenciasDevolucion): Reloj {
  return {
    ahora: deps.ahora ?? (() => new Date().toISOString()),
    nuevoId: deps.nuevoId ?? (() => randomUUID()),
  };
}

/**
 * Única forma en la que información de este trámite sale hacia la evidencia:
 * solicitante, motivo, medio, importe y referencias. Nada de salud, PEP,
 * cédula ni tarjeta (reglas inviolables #6 y #7).
 */
async function registrarEvidencia(
  deps: DependenciasDevolucion,
  reloj: Reloj,
  entrada: {
    readonly expedienteId: string;
    readonly paso: string;
    readonly fecha: string;
    readonly contexto: ContextoPeticion;
    readonly detalle: Readonly<Record<string, string | number>>;
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
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado: "EXITOSO",
    detalle: Object.entries(entrada.detalle)
      .map(([clave, valor]) => `${clave}=${valor}`)
      .join(" · "),
  };
  await deps.evidencias.guardar(registro);
}

// ---------------------------------------------------------------------------
// Operación 1 — abrir el trámite
// ---------------------------------------------------------------------------

/**
 * PAGO_CONFIRMADO | EMITIDO → DEVOLUCION_EN_TRAMITE.
 *
 * Idempotente: sobre un expediente que ya tiene el trámite abierto devuelve lo
 * persistido sin volver a escribir, así la consola puede repetir la acción sin
 * duplicar evidencia.
 *
 * **Que el expediente esté EMITIDO no lo impide.** Que se haya ordenado la
 * emisión no vuelve al cobro irreversible: si hubo un error de cobro o el
 * titular lo pide, la devolución procede y Alianza resuelve la póliza por su
 * lado. El expediente asienta el trámite, no decide sobre la póliza.
 */
export async function solicitarDevolucion(
  deps: DependenciasDevolucion,
  entrada: {
    readonly expedienteId: string;
    readonly solicitante: unknown;
    readonly motivo: unknown;
    readonly contexto: ContextoPeticion;
  },
): Promise<ResultadoDevolucion> {
  const reloj = resolverReloj(deps);

  if (!esSolicitanteDevolucion(entrada.solicitante)) {
    return { ok: false, motivo: "SOLICITANTE_INVALIDO" };
  }
  if (!esMotivoDevolucion(entrada.motivo)) return { ok: false, motivo: "MOTIVO_INVALIDO" };

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  // Ya abierto o ya cerrado: se responde con lo persistido.
  if (expediente.devolucion) {
    return { ok: true, cambio: false, estado: expediente.estado, devolucion: expediente.devolucion };
  }

  if (!ESTADOS_CON_DEVOLUCION_POSIBLE.includes(expediente.estado)) {
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  const pago = expediente.pago;
  if (!pago || !pagoAcreditado(pago.estado)) return { ok: false, motivo: "SIN_COBRO_ACREDITADO" };

  const fecha = reloj.ahora();
  const devolucion: DevolucionDelExpediente = {
    estado: "EN_TRAMITE",
    solicitante: entrada.solicitante,
    motivo: entrada.motivo,
    solicitadaEn: fecha,
    // El importe y el medio se congelan acá: son los del cobro que se devuelve,
    // y leerlos después del `Pago` los haría depender de que nadie lo toque.
    montoGs: pago.montoGs,
    medio: pago.medio,
    referenciaBancard: pago.referenciaBancard,
    acreditadaEn: null,
    referenciaReintegro: null,
  };

  const transicion = transicionarExpediente(
    expediente,
    "DEVOLUCION_EN_TRAMITE",
    { devolucion },
    fecha,
  );
  if (!transicion.ok) return { ok: false, motivo: "ESTADO_INVALIDO" };

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_DEVOLUCION_SOLICITADA,
    fecha,
    contexto: entrada.contexto,
    detalle: {
      solicitante: devolucion.solicitante,
      motivo: devolucion.motivo,
      medio: devolucion.medio,
      montoGs: devolucion.montoGs,
      referenciaBancard: devolucion.referenciaBancard ?? "",
      propuesta: expediente.numeroPropuesta ?? "",
      estadoAnterior: expediente.estado,
      destinoDevolucion: "MEDIO_DE_ORIGEN",
    },
  });

  return {
    ok: true,
    cambio: true,
    estado: transicion.expediente.estado,
    devolucion,
  };
}

// ---------------------------------------------------------------------------
// Operación 2 — cerrar el trámite
// ---------------------------------------------------------------------------

/**
 * DEVOLUCION_EN_TRAMITE → DEVUELTO: el reintegro se acreditó al medio de origen.
 *
 * Exige la **referencia del reintegro**, y no es un capricho: es lo único que
 * distingue "alguien dijo que devolvió" de "hay un movimiento que se puede
 * buscar". Un trámite que se cierra sin referencia no se puede auditar.
 */
export async function acreditarDevolucion(
  deps: DependenciasDevolucion,
  entrada: {
    readonly expedienteId: string;
    readonly referenciaReintegro: string;
    readonly contexto: ContextoPeticion;
  },
): Promise<ResultadoDevolucion> {
  const reloj = resolverReloj(deps);

  const referencia = entrada.referenciaReintegro.trim();
  if (referencia === "") return { ok: false, motivo: "REFERENCIA_REQUERIDA" };

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  // Idempotente: ya acreditada se responde con lo persistido.
  if (expediente.estado === "DEVUELTO" && expediente.devolucion) {
    return { ok: true, cambio: false, estado: expediente.estado, devolucion: expediente.devolucion };
  }

  if (expediente.estado !== "DEVOLUCION_EN_TRAMITE") {
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }
  const abierta = expediente.devolucion;
  if (!abierta) return { ok: false, motivo: "SIN_TRAMITE_ABIERTO" };

  const fecha = reloj.ahora();
  const devolucion: DevolucionDelExpediente = {
    ...abierta,
    estado: "ACREDITADA",
    acreditadaEn: fecha,
    referenciaReintegro: referencia,
  };

  const transicion = transicionarExpediente(expediente, "DEVUELTO", { devolucion }, fecha);
  if (!transicion.ok) return { ok: false, motivo: "ESTADO_INVALIDO" };

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_DEVOLUCION_ACREDITADA,
    fecha,
    contexto: entrada.contexto,
    detalle: {
      solicitante: devolucion.solicitante,
      motivo: devolucion.motivo,
      medio: devolucion.medio,
      montoGs: devolucion.montoGs,
      referenciaBancard: devolucion.referenciaBancard ?? "",
      referenciaReintegro: referencia,
      solicitadaEn: devolucion.solicitadaEn,
      ejecutadaPor: "BANCARD_ALIANZA",
      destinoDevolucion: "MEDIO_DE_ORIGEN",
    },
  });

  return { ok: true, cambio: true, estado: transicion.expediente.estado, devolucion };
}
