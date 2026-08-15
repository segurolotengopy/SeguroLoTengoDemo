/**
 * Armado de dependencias de los Route Handlers de P1.
 *
 * Un módulo aparte (no inline en cada `route.ts`) por dos razones: los tres
 * handlers comparten exactamente el mismo cableado, y los tests pueden
 * sustituirlo por dobles en memoria sin tocar AWS — que es lo que hace
 * `__tests__/no-filtra-codigo-otp.test.ts` para ejercer los handlers reales.
 *
 * Archivo con guion bajo: App Router solo enruta `route.ts`, así que esto no
 * queda expuesto como endpoint.
 */
import { obtenerLectorOtp, obtenerOtpProvider } from "@/adapters/registro";
import type { DependenciasP1 } from "@/domain/verificacion-canal-whatsapp";
import { crearEvidenceStore, crearExpedienteRepository, crearOtpRepository } from "@/repositories";

export function dependenciasP1(): DependenciasP1 {
  const otpRepository = crearOtpRepository();

  return {
    otpProvider: obtenerOtpProvider(otpRepository),
    // Lector de metadata del OTP (`LectorMetadataOtp`): el caso de uso
    // necesita saber a qué expediente y a qué número pertenece un otpId, cosa
    // que el puerto `OtpProvider` no expone a propósito. Se pide al
    // composition root junto con el provider porque en modo live
    // (WhatsApp-Modular) los otpId de P1 no viven en el repositorio local.
    lectorOtp: obtenerLectorOtp(otpRepository),
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
  };
}
