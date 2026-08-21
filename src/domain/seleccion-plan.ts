/**
 * Caso de uso de P2 · Selección de plan
 * (docs/ESPECIFICACION_PANTALLAS.md → "P2 · Paso 2 de 9 — Selección de plan").
 *
 * Acá vive la regla técnica del paso: *"al seleccionar plan se guarda el ID
 * de versión de la oferta y su hash SHA-256"*. El hash se calcula sobre la
 * representación canónica de la tabla completa —no sobre el plan elegido—
 * porque lo que hay que poder probar después es qué tarifario vio el
 * proponente cuando eligió, incluidos los otros dos planes que descartó.
 *
 * El Route Handler de `/api/p2/plan` solo traduce HTTP; la única transición
 * del paso se hace acá vía `transicionarExpediente`, igual que en P1.
 *
 * Este módulo importa `node:crypto`: es de servidor y no debe importarse
 * desde un componente de cliente. La pantalla lee los importes de
 * `catalogo.ts`, que no tiene ninguna dependencia.
 */
import { createHash, randomUUID } from "node:crypto";
import type { EvidenceStore } from "../ports/evidence-store";
import { ID_VERSION_OFERTA, OFERTA_VIGENTE, PLANES, esPlanId, serializarOfertaCanonica } from "./catalogo";
import type { OfertaVersionada } from "./catalogo";
import { esTransicionLegal, transicionarExpediente } from "./expediente";
import { crearExpedienteInicial } from "./tipos";
import type { ContextoPeticion, RepositorioExpediente } from "./verificacion-canal-whatsapp";
import type {
  EstadoExpediente,
  Expediente,
  PlanId,
  PlanSeleccionado,
  RegistroEvidencia,
} from "./tipos";

export const PASO_EVIDENCIA_SELECCION_PLAN = "P2_SELECCION_PLAN";

// ---------------------------------------------------------------------------
// Hash de la oferta
// ---------------------------------------------------------------------------

/**
 * SHA-256 en hexadecimal de la versión de la oferta, sobre el texto canónico
 * de `serializarOfertaCanonica`. Determinista: la misma tabla da siempre el
 * mismo hash, en cualquier máquina y en cualquier momento — que es la única
 * forma de que sirva como prueba.
 */
export function hashOfertaSha256(oferta: OfertaVersionada = OFERTA_VIGENTE): string {
  return createHash("sha256").update(serializarOfertaCanonica(oferta), "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Dependencias y resultados
// ---------------------------------------------------------------------------

export interface DependenciasP2 {
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

export type MotivoRechazoSeleccion =
  | "PLAN_INVALIDO"
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO";

export type ResultadoSeleccionPlan =
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly estado: Expediente["estado"];
      readonly plan: PlanSeleccionado;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoSeleccion;
      /**
       * Estado en que quedó el expediente cuando el rechazo es
       * `ESTADO_INVALIDO`.
       *
       * Va en el resultado —y no solo en la evidencia— para que la pantalla
       * pueda **reencaminar** en vez de limitarse a avisar. El servidor sabe
       * dónde quedó el trámite; sin este dato la persona queda leyendo "este
       * proceso ya no está en el paso de selección de plan", que es cierto e
       * inútil (mismo criterio que `verificacion-canal.ts`, ver
       * `rutas-flujo.ts`).
       */
      readonly estado?: EstadoExpediente;
    };

/**
 * `true` si un expediente en ese estado todavía puede elegir plan.
 *
 * Se deriva del grafo de transiciones en vez de repetir la lista de estados:
 * si mañana se agrega una arista hacia `PLAN_SELECCIONADO`, la pantalla se
 * entera sola. Existe para que `/plan` pueda **preguntar antes** de dibujar
 * el selector, en lugar de dejar elegir y rechazar con `ESTADO_INVALIDO`
 * después de que la persona ya eligió.
 */
export function puedeElegirPlan(estado: EstadoExpediente): boolean {
  return esTransicionLegal(estado, "PLAN_SELECCIONADO");
}

export interface EntradaSeleccionPlan {
  /** `null` en la primera visita: el expediente todavía no existe. */
  readonly expedienteId: string | null;
  /** Llega como texto desde HTTP: se valida contra el catálogo antes de usarlo. */
  readonly planId: string;
  readonly contexto: ContextoPeticion;
}

// ---------------------------------------------------------------------------
// Caso de uso
// ---------------------------------------------------------------------------

function formatearDetalle(datos: Readonly<Record<string, string | number>>): string {
  return Object.entries(datos)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(" · ");
}

async function registrarEvidencia(
  deps: DependenciasP2,
  entrada: {
    expedienteId: string;
    fecha: string;
    contexto: ContextoPeticion;
    resultado: "EXITOSO" | "FALLIDO";
    detalle: Readonly<Record<string, string | number>>;
    nuevoId: () => string;
  },
): Promise<void> {
  const registro: RegistroEvidencia = {
    id: entrada.nuevoId(),
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_SELECCION_PLAN,
    fecha: entrada.fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    // La "versión de texto aceptado" de este paso es la versión de la oferta:
    // es lo que el proponente tuvo a la vista al elegir.
    versionTextoAceptado: ID_VERSION_OFERTA,
    // En P2 no se acepta ningún texto: se elige un plan. Lo que prueba qué
    // vio la persona es el hash de la oferta, que va en el detalle.
    textoAceptado: null,
    resultado: entrada.resultado,
    detalle: formatearDetalle(entrada.detalle),
  };
  await deps.evidencias.guardar(registro);
}

/**
 * Botón `SELECCIONAR <PLAN> Y CONTINUAR →` de P2.
 *
 * Deja el expediente en PLAN_SELECCIONADO con el plan elegido, el
 * `idVersionOferta` y el `hashOfertaSha256` de la tabla vigente. Todavía no
 * contrata ni firma nada: la aceptación contractual ocurre en P8.
 *
 * Se admite volver a P2 y elegir otro plan mientras el expediente siga en
 * PLAN_SELECCIONADO (enlace `Cambiar plan`): es una corrección previa a la
 * autorización de P3, no un avance. La re-selección vuelve a pasar por
 * `transicionarExpediente`, así que queda asentada como una entrada más del
 * historial append-only en vez de pisar la anterior.
 */
export async function seleccionarPlan(
  deps: DependenciasP2,
  entrada: EntradaSeleccionPlan,
): Promise<ResultadoSeleccionPlan> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const nuevoId = deps.nuevoId ?? (() => randomUUID());
  const fecha = ahora();

  if (!esPlanId(entrada.planId)) {
    return { ok: false, motivo: "PLAN_INVALIDO" };
  }
  const planId: PlanId = entrada.planId;

  // CHG-01 · elegir plan es ahora el primer paso, así que acá **nace** el
  // expediente si todavía no existe. Antes lo creaba la verificación de
  // WhatsApp, que era el paso 1; moverlo sin mover esto habría dejado el
  // catálogo sin poder guardar nada.
  //
  // `entrada.expedienteId` puede llegar nulo (visita nueva) o apuntar a un
  // expediente real (volver por `Cambiar plan`). Un id que no existe **no** se
  // trata como visita nueva: sería crear un expediente con el id que mandó el
  // cliente, y esos ids son la llave de todo el trámite.
  let expediente: Expediente;
  if (entrada.expedienteId === null) {
    expediente = crearExpedienteInicial({ id: nuevoId(), ahora: fecha });
    await deps.expedientes.crear(expediente);
  } else {
    const existente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
    if (!existente) {
      return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };
    }
    expediente = existente;
  }

  const plan: PlanSeleccionado = {
    planId,
    premioAnualGs: PLANES[planId].premioAnualGs,
    idVersionOferta: OFERTA_VIGENTE.idVersion,
    hashOfertaSha256: hashOfertaSha256(),
    seleccionadoEn: fecha,
  };

  const transicion = transicionarExpediente(expediente, "PLAN_SELECCIONADO", { plan }, fecha);

  if (!transicion.ok) {
    await registrarEvidencia(deps, {
      expedienteId: expediente.id,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { planId, motivo: "ESTADO_INVALIDO", estado: expediente.estado },
      nuevoId,
    });
    return { ok: false, motivo: "ESTADO_INVALIDO", estado: expediente.estado };
  }

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, {
    expedienteId: expediente.id,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: {
      planId,
      premioAnualGs: plan.premioAnualGs,
      idVersionOferta: plan.idVersionOferta,
      hashOfertaSha256: plan.hashOfertaSha256,
    },
    nuevoId,
  });

  return {
    ok: true,
    expedienteId: expediente.id,
    estado: transicion.expediente.estado,
    plan,
  };
}
