/**
 * Armado de dependencias de los Route Handlers de P8.
 *
 * El `SignatureProvider` y el `PaymentProvider` salen del composition root
 * (`src/adapters/registro.ts`), así que la pantalla no sabe si detrás hay los
 * mocks del demo o los adaptadores oficiales de Code100 y Bancard. Es la única
 * vía por la que P8 llega a los proveedores: ningún archivo de `src/app/`
 * importa `src/adapters/mock/signature-provider.ts`.
 *
 * Archivo con guion bajo: App Router solo enruta `route.ts`, así que esto no
 * queda expuesto como endpoint.
 */
import { obtenerPaymentProvider, obtenerSignatureProvider } from "@/adapters/registro";
import type { DependenciasP8 } from "@/domain/firma-p8";
import type { DependenciasDocumentos } from "@/documentos";
import { crearArchivoRepository, crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export function dependenciasP8(): DependenciasP8 {
  return {
    firmas: obtenerSignatureProvider(),
    pagos: obtenerPaymentProvider(),
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
  };
}

/**
 * Dependencias del servicio de generación de documentos, que P8 corre una vez
 * al entrar: es el paso que cierra la Solicitud y el FIPF, los hashea y lleva
 * el expediente de PAGO_CONFIRMADO a PAQUETE_GENERADO (regla inviolable #4).
 */
export function dependenciasDocumentosP8(): DependenciasDocumentos {
  return {
    expedientes: crearExpedienteRepository(),
    archivos: crearArchivoRepository(),
    evidencias: crearEvidenceStore(),
  };
}
