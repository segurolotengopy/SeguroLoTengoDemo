/**
 * Armado de dependencias del Route Handler de P2.
 *
 * P2 no habla con ningún proveedor externo —elegir plan es una decisión
 * interna, no una integración—, así que solo necesita el repositorio del
 * expediente y el almacén de evidencia.
 *
 * Archivo con guion bajo: App Router solo enruta `route.ts`, así que esto no
 * queda expuesto como endpoint.
 */
import type { DependenciasP2 } from "@/domain/seleccion-plan";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export function dependenciasP2(): DependenciasP2 {
  return {
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
  };
}
