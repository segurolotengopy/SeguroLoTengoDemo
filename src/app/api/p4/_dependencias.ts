/**
 * Armado de dependencias de los Route Handlers de P4.
 *
 * Es el mismo cableado que P1 —mismo `OtpProvider`, mismo repositorio de OTP,
 * mismo expediente y misma evidencia— porque P4 usa exactamente el mismo
 * motor (`src/domain/verificacion-canal.ts`). Lo que distingue al OTP de
 * correo del de celular no es el cableado sino el `proposito` con el que se
 * crea, que lo fija `CANAL_CORREO_P4`.
 *
 * Archivo con guion bajo: App Router solo enruta `route.ts`, así que esto no
 * queda expuesto como endpoint.
 */
import { obtenerLectorOtp, obtenerOtpProvider } from "@/adapters/registro";
import type { DependenciasP4 } from "@/domain/verificacion-canal-correo";
import { crearEvidenceStore, crearExpedienteRepository, crearOtpRepository } from "@/repositories";

export function dependenciasP4(): DependenciasP4 {
  const otpRepository = crearOtpRepository();

  return {
    otpProvider: obtenerOtpProvider(otpRepository),
    // Mismo criterio que P1: provider y lector salen juntos del composition
    // root para hablar del mismo universo de otpId en modo mock y live.
    lectorOtp: obtenerLectorOtp(otpRepository),
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
  };
}
