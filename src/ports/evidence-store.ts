/**
 * Puerto de evidencia (regla de negocio inviolable #10): registro
 * append-only de fecha, hora, IP, dispositivo, sesión, versión de texto
 * aceptado y resultado de cada paso del flujo.
 *
 * Toda escritura de evidencia (hashes, IP, dispositivo, sesión, timestamps,
 * resultados de intentos) se hace a través de este puerto, nunca a un log
 * plano.
 *
 * La interfaz declara deliberadamente solo `guardar` y `obtenerHistorial`.
 * No existe ningún método de borrado ni de actualización de un registro
 * existente — así la regla append-only queda imposible de violar a nivel de
 * tipo, no solo por convención.
 */
import type { RegistroEvidencia } from "../domain/tipos";

export interface EvidenceStore {
  /** Agrega un registro nuevo. Nunca sobrescribe ni reemplaza uno existente. */
  guardar(registro: RegistroEvidencia): Promise<void>;

  /** Historial completo de un expediente, en el orden en que se guardó. */
  obtenerHistorial(expedienteId: string): Promise<readonly RegistroEvidencia[]>;
}
