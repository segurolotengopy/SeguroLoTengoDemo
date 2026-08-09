/**
 * Helpers de claves para el modelo de tabla única de DynamoDB
 * (`infra/dynamodb.tf`: tabla `slt-demo-expedientes`, PK `pk` / SK `sk`,
 * TTL nativo en el atributo `expiresAt`).
 *
 * Deliberadamente sin ningún import del SDK de AWS: son funciones puras de
 * construcción de strings, para poder testearlas sin tocar DynamoDB y para
 * que cualquier repositorio de este directorio arme sus claves de la misma
 * forma.
 *
 * Patrones de partición usados hoy (sin GSI, la tabla `slt-demo-expedientes`
 * solo tiene índice primario):
 *
 * - Expediente (metadata):      pk = EXPEDIENTE#<id>      sk = META
 * - Evidencia (colección 1-N):  pk = EXPEDIENTE#<id>      sk = EVID#<fechaIso>#<evidenciaId>
 * - OTP (ítem propio):          pk = OTP#<otpId>           sk = OTP#<otpId>
 *
 * La evidencia queda anidada bajo la partición del expediente (patrón
 * "item collection" de tabla única) para poder pedir "todo lo de este
 * expediente, en orden" con un solo Query y sin índice secundario.
 *
 * El OTP es su propio ítem (no anidado bajo el expediente) porque
 * `OtpProvider.verificarOtp` y `reenviarOtp` reciben solo `otpId` — el
 * caller nunca vuelve a mandar `expedienteId` en esas llamadas, así que no
 * conviene depender de conocerlo para armar la clave de lectura.
 *
 * Pendiente (fuera de este cambio): la consola administrativa
 * (`docs/CONSOLA_ADMINISTRATIVA.md`) va a necesitar buscar expedientes por
 * cédula — eso requiere un GSI (p.ej. `gsi1pk = CEDULA#<numeroCedula>`) que
 * todavía no existe en `infra/dynamodb.tf`. No se agrega acá porque la
 * consola "está definida, sin implementar todavía"; queda anotado para
 * cuando se implemente.
 */

const SEPARADOR = "#";

export function claveExpediente(expedienteId: string): { pk: string; sk: string } {
  return { pk: `EXPEDIENTE${SEPARADOR}${expedienteId}`, sk: "META" };
}

export function prefijoEvidenciaDeExpediente(expedienteId: string): string {
  return `EXPEDIENTE${SEPARADOR}${expedienteId}`;
}

/**
 * `fechaIso` va primero en el sort key (antes del id) para que el orden
 * lexicográfico del `sk` coincida con el orden cronológico de guardado —
 * así `obtenerHistorial` no necesita ordenar en memoria, alcanza con el
 * orden que ya devuelve el Query.
 */
export function claveEvidencia(
  expedienteId: string,
  evidenciaId: string,
  fechaIso: string,
): { pk: string; sk: string } {
  return {
    pk: prefijoEvidenciaDeExpediente(expedienteId),
    sk: `EVID${SEPARADOR}${fechaIso}${SEPARADOR}${evidenciaId}`,
  };
}

export function claveOtp(otpId: string): { pk: string; sk: string } {
  return { pk: `OTP${SEPARADOR}${otpId}`, sk: `OTP${SEPARADOR}${otpId}` };
}

/** DynamoDB TTL nativo espera epoch en **segundos**, no milisegundos. */
export function aEpochSegundos(fechaIso: string): number {
  return Math.floor(new Date(fechaIso).getTime() / 1000);
}

/**
 * Todo ítem de la tabla única carga `pk`/`sk`/`entityType` además de los
 * campos del dominio (`RegistroEvidencia`, `Expediente`). Este helper les
 * quita esos tres campos técnicos al leer, para no filtrarlos hacia el
 * resto de la app. Vive acá (no como un `delete` inline en cada
 * repositorio) para no repetir tres variables sin usar en cada
 * destructuring — eso disparaba warnings de lint en cada lugar que leía un
 * ítem.
 */
export function quitarClavesInternas<T extends { pk: string; sk: string; entityType: string }>(
  item: T,
): Omit<T, "pk" | "sk" | "entityType"> {
  const copia: Partial<T> = { ...item };
  delete copia.pk;
  delete copia.sk;
  delete copia.entityType;
  return copia as Omit<T, "pk" | "sk" | "entityType">;
}
