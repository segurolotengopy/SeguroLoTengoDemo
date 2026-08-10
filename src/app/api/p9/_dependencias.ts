/**
 * Armado de dependencias de los Route Handlers de P9.
 *
 * El `PolicyIssuer` sale del composition root (`src/adapters/registro.ts`), así
 * que la pantalla no sabe si detrás hay el mock del demo o SEBAOT. Es la única
 * vía por la que P9 llega al proveedor: ningún archivo de `src/app/` importa
 * `src/adapters/mock/policy-issuer.ts`.
 *
 * Archivo con guion bajo: App Router solo enruta `route.ts`.
 */
import { obtenerPolicyIssuer, obtenerSignatureProvider } from "@/adapters/registro";
import type { DependenciasArchivadoFirmados } from "@/documentos";
import type { DependenciasP9 } from "@/domain/emision-p9";
import { crearArchivoRepository, crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

export function dependenciasP9(): DependenciasP9 {
  return {
    polizas: obtenerPolicyIssuer(),
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
  };
}

/**
 * Dependencias del archivado de los PDF firmados, que P9 corre al entrar: baja
 * de Code100 la Solicitud y el FIPF firmados y los guarda, para poder
 * ofrecerlos en `DOCUMENTOS DISPONIBLES PARA DESCARGAR`.
 */
export function dependenciasArchivadoP9(): DependenciasArchivadoFirmados {
  return { archivos: crearArchivoRepository(), firmas: obtenerSignatureProvider() };
}
