/**
 * Armado de dependencias de los Route Handlers de P5.
 *
 * El `IdentityProvider` sale del composition root (`src/adapters/registro.ts`),
 * así que la pantalla no sabe si detrás hay el mock del demo o el adaptador
 * oficial de Entrust/Onfido.
 *
 * Archivo con guion bajo: App Router solo enruta `route.ts`, así que esto no
 * queda expuesto como endpoint.
 */
import { obtenerIdentityProvider } from "@/adapters/registro";
import type { DependenciasP5 } from "@/domain/verificacion-identidad";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export function dependenciasP5(): DependenciasP5 {
  return {
    identidad: obtenerIdentityProvider(),
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
  };
}
