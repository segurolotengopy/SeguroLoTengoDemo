/**
 * Rótulos y proyección del trámite de devolución (D-02).
 *
 * Vive aparte de `devolucion.ts` por la misma razón que `documentos.ts` vive
 * aparte del servicio que escribe PDF: **este módulo no importa `node:*`** y
 * por eso lo puede consumir la consola, que es un componente de cliente.
 * `devolucion.ts` usa `node:crypto` para los identificadores de evidencia, así
 * que importarlo desde el navegador arrastraría todo eso al bundle.
 */
import type { DevolucionDelExpediente, Expediente, MotivoDevolucion, SolicitanteDevolucion } from "./tipos";

/** Rótulos para la consola. El motivo es una categoría, nunca un texto libre. */
export const ROTULO_MOTIVO_DEVOLUCION: Readonly<Record<MotivoDevolucion, string>> = {
  PEDIDO_DEL_TITULAR: "Pedido del titular",
  ERROR_DE_COBRO: "Error de cobro",
  COBRO_DUPLICADO: "Cobro duplicado",
  VENCIMIENTO_LEGADO: "Vencimiento con cobro (orden anterior)",
};

export const ROTULO_SOLICITANTE_DEVOLUCION: Readonly<Record<SolicitanteDevolucion, string>> = {
  TITULAR: "El titular",
  INTERSEGUROS: "Interseguros",
  ALIANZA: "Alianza Garantía",
};

// ---------------------------------------------------------------------------
// Lectura para la consola
// ---------------------------------------------------------------------------

export interface SeguimientoDevolucion {
  readonly estado: DevolucionDelExpediente["estado"];
  readonly solicitante: string;
  readonly motivo: string;
  readonly solicitadaEn: string;
  readonly acreditadaEn: string | null;
  readonly montoGs: number;
  readonly medio: string;
  readonly referenciaBancard: string | null;
  readonly referenciaReintegro: string | null;
  /** Cuánto lleva abierto el trámite, en horas. Es lo que la consola ordena. */
  readonly horasAbierta: number | null;
}

/**
 * Proyección del trámite para la consola. Devuelve `null` si el expediente no
 * tiene devolución — que es el caso normal.
 */
export function leerSeguimientoDevolucion(
  expediente: Expediente,
  ahora: string = new Date().toISOString(),
): SeguimientoDevolucion | null {
  const devolucion = expediente.devolucion;
  if (!devolucion) return null;

  const cierre = devolucion.acreditadaEn ?? ahora;
  const horas =
    (new Date(cierre).getTime() - new Date(devolucion.solicitadaEn).getTime()) / 3_600_000;

  return {
    estado: devolucion.estado,
    solicitante: ROTULO_SOLICITANTE_DEVOLUCION[devolucion.solicitante],
    motivo: ROTULO_MOTIVO_DEVOLUCION[devolucion.motivo],
    solicitadaEn: devolucion.solicitadaEn,
    acreditadaEn: devolucion.acreditadaEn,
    montoGs: devolucion.montoGs,
    medio: devolucion.medio,
    referenciaBancard: devolucion.referenciaBancard,
    referenciaReintegro: devolucion.referenciaReintegro,
    horasAbierta: Number.isFinite(horas) ? Math.max(Math.round(horas * 10) / 10, 0) : null,
  };
}
