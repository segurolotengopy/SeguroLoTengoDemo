/**
 * Dependencias de los Route Handlers del flujo v4.
 *
 * Las tres pantallas nuevas —03C, 03D y 03E— no hablan con ningún proveedor
 * externo salvo el de identidad, que ya sale del composition root. Archivo con
 * guion bajo: App Router solo enruta `route.ts`.
 */
import { obtenerIdentityProvider, obtenerRegistroCivilProvider } from "@/adapters/registro";
import type { DependenciasActividadV4 } from "@/domain/v4/actividad";
import type { DependenciasDeclaracionesV4 } from "@/domain/v4/declaraciones";
import type { DependenciasDatosPersonalesV4 } from "@/domain/v4/datos-personales";
import type { DependenciasP5 } from "@/domain/verificacion-identidad";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export function dependenciasIdentidadV4(): DependenciasP5 {
  const expedientes = crearExpedienteRepository();
  return {
    identidad: obtenerIdentityProvider(),
    registroCivil: obtenerRegistroCivilProvider(),
    expedientes,
    evidencias: crearEvidenceStore(),
    bloqueos: expedientes,
  };
}

export function dependenciasDatosPersonalesV4(): DependenciasDatosPersonalesV4 {
  return {
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
  };
}

export function dependenciasActividadV4(): DependenciasActividadV4 {
  return {
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
  };
}

export function dependenciasDeclaracionesV4(): DependenciasDeclaracionesV4 {
  return {
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
  };
}
