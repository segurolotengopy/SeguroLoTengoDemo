/**
 * Armado de dependencias del Route Handler de P3.
 *
 * Como P2, no habla con ningún proveedor externo: registrar el consentimiento
 * inicial es una operación interna. Solo necesita el repositorio del
 * expediente y el almacén de evidencia append-only.
 *
 * Archivo con guion bajo: App Router solo enruta `route.ts`, así que esto no
 * queda expuesto como endpoint.
 */
import type { DependenciasP3 } from "@/domain/autorizacion-inicial";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export function dependenciasP3(): DependenciasP3 {
  return {
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
  };
}
