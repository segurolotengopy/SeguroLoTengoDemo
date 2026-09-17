/**
 * El literal que la firma interna del cliente registra como aceptado.
 *
 * Nació como el archivo de textos del paso 3 del flujo v3 («Pagá y firmá»);
 * con ese flujo retirado (16-sep-2026) queda solo lo que el servidor sigue
 * asentando: `POST /api/p8/firma-interna/verificar` pasa este literal y su
 * versión a `firma-cliente.ts`, que los asienta en la firma. Lo que se acepta
 * al firmar es lo que queda firmado. Módulo sin dependencias con `node:*`.
 * **Cambiar una palabra del literal aceptado obliga a subir la versión.**
 */

/**
 * D-08 enmendada (04-sep-2026) / D-32, D-38, D-42 · el tercer ítem se
 * reescribió tres veces: el pago se habilita con mi firma, no con la
 * espera de la institucional (que ahora se aplica **después** del cobro);
 * Alianza no firma la propuesta (solo Interseguros la firma, en modalidad
 * diferida); y el plazo pasó de 24 horas a 10 minutos.
 */
export const ITEMS_ACEPTACION_FIRMA: readonly string[] = [
  "Confirmo que recibí de Interseguros el PDF único con la propuesta y el FIPF, que pude " +
    "revisarlo y corregir mis datos, que acepto su contenido y que deseo firmarlo " +
    "electrónicamente.",
  "Declaro que los fondos con los que pagaré este seguro tienen origen lícito.",
  "Entiendo que con mi firma ya se habilita el pago, con 10 minutos para completarlo, y que " +
    "Interseguros firma después el paquete con firma cualificada.",
];

/** El literal que la firma del cliente registra como texto aceptado. */
export const TEXTO_ACEPTACION_FIRMA = ITEMS_ACEPTACION_FIRMA.join(" ");

export const VERSION_ACEPTACION_FIRMA = "PAGO-FIRMA-ACEPTACION-v2";
