/**
 * Armado de dependencias de los Route Handlers de P6.
 *
 * P6 no toca ningún proveedor externo: no hay OTP, ni identidad, ni pago, ni
 * firma en esta pantalla. Solo el expediente y la evidencia. El
 * `ComplianceProvider` (ComplyAdvantage) **no se usa acá a propósito**: la
 * derivación de la declaración 8 se decide con la respuesta autodeclarada,
 * nunca con el resultado de una consulta externa — está documentado en
 * `src/ports/compliance-provider.ts` y es lo que exige la regla inviolable #5.
 *
 * Archivo con guion bajo: App Router solo enruta `route.ts`, así que esto no
 * queda expuesto como endpoint.
 */
import type { DependenciasP6 } from "@/domain/declaraciones-p6";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export function dependenciasP6(): DependenciasP6 {
  return {
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
  };
}
