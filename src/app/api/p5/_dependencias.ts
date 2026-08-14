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
import { obtenerIdentityProvider, obtenerRegistroCivilProvider } from "@/adapters/registro";
import type { DependenciasP5 } from "@/domain/verificacion-identidad";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export function dependenciasP5(): DependenciasP5 {
  const expedientes = crearExpedienteRepository();
  return {
    identidad: obtenerIdentityProvider(),
    // Sin esto, una cédula del formato anterior (sin MRZ) no tiene de dónde
    // sacar nombre ni fecha de nacimiento y no puede completar P5.
    registroCivil: obtenerRegistroCivilProvider(),
    expedientes,
    evidencias: crearEvidenceStore(),
    // Mismo repositorio: `ExpedienteRepository` y `ConsultaExpedientes` los
    // implementa el mismo objeto, pero P5 solo recibe la búsqueda por cédula
    // que necesita la regla de bloqueo.
    bloqueos: expedientes,
  };
}
