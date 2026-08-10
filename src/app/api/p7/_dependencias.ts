/**
 * Armado de dependencias de los Route Handlers de P7.
 *
 * El `PaymentProvider` sale del composition root (`src/adapters/registro.ts`),
 * así que la pantalla no sabe si detrás hay el mock del demo o el adaptador
 * oficial de Bancard. Es la única vía por la que P7 llega al proveedor: ningún
 * archivo de `src/app/` importa `src/adapters/mock/payment-provider.ts`.
 *
 * Archivo con guion bajo: App Router solo enruta `route.ts`, así que esto no
 * queda expuesto como endpoint.
 */
import { obtenerPaymentProvider } from "@/adapters/registro";
import { URL_RETORNO_TARJETA_POR_DEFECTO } from "@/domain/pago-p7";
import type { DependenciasP7 } from "@/domain/pago-p7";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";

/**
 * URL absoluta a la que Bancard devuelve a la persona después del formulario
 * seguro de tarjeta. Se arma con el origen de la propia petición: en el demo
 * corre en `localhost` y en Amplify en el dominio desplegado, sin necesidad de
 * una variable de entorno más.
 */
function urlRetornoTarjeta(request: Request): string {
  try {
    return new URL(URL_RETORNO_TARJETA_POR_DEFECTO, new URL(request.url).origin).toString();
  } catch {
    return URL_RETORNO_TARJETA_POR_DEFECTO;
  }
}

export function dependenciasP7(request: Request): DependenciasP7 {
  return {
    pagos: obtenerPaymentProvider(),
    expedientes: crearExpedienteRepository(),
    evidencias: crearEvidenceStore(),
    urlRetornoTarjeta: urlRetornoTarjeta(request),
  };
}
