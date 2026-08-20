/**
 * Armado de dependencias de los Route Handlers de la pantalla de firma.
 *
 * El `SignatureProvider` sale del composition root
 * (`src/adapters/registro.ts`), así que la pantalla no sabe si detrás hay el
 * mock del demo o el adaptador oficial de Code100. Es la única vía por la que
 * la firma llega al proveedor: ningún archivo de `src/app/` importa
 * `src/adapters/mock/signature-provider.ts`.
 *
 * Desde D-08 ya **no** recibe el `PaymentProvider`: el cobro ocurre después de
 * firmar y es cosa del paso siguiente.
 *
 * Archivo con guion bajo: App Router solo enruta `route.ts`, así que esto no
 * queda expuesto como endpoint.
 */
import {
  firmasInstitucionalesCaidas,
  obtenerPlazoPagoMs,
  obtenerSignatureProvider,
} from "@/adapters/registro";
import type { DependenciasP8 } from "@/domain/firma-p8";
import type { DependenciasDocumentos } from "@/documentos";
import { crearArchivoRepository, crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export function dependenciasP8(): DependenciasP8 {
  return {
    firmas: obtenerSignatureProvider(),
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
    // 24 horas, salvo que el panel de demo lo haya comprimido. Se congela en
    // el expediente al aplicarse las firmas institucionales: cambiarlo después
    // no mueve un vencimiento ya calculado.
    plazoPagoMs: obtenerPlazoPagoMs(),
    firmasInstitucionalesCaidas,
  };
}

/**
 * Dependencias del servicio de generación de documentos, que la pantalla de
 * firma corre una vez al entrar: es el paso que cierra la Solicitud y el FIPF,
 * los hashea y lleva el expediente de DECLARACIONES_OK a PAQUETE_GENERADO
 * (regla inviolable #4).
 */
export function dependenciasDocumentosP8(): DependenciasDocumentos {
  return {
    expedientes: crearExpedienteRepository(),
    archivos: crearArchivoRepository(),
    evidencias: crearEvidenceStore(),
  };
}
