/**
 * Cliente único de DynamoDB para toda la app. Regla dura de CLAUDE.md: nada
 * fuera de `src/repositories/` importa el SDK de DynamoDB — este es el
 * único archivo que construye el cliente; el resto de este directorio lo
 * recibe ya armado.
 *
 * Credenciales: no se configuran acá. Se usa la cadena de resolución por
 * defecto del SDK (rol de ejecución de Amplify Hosting en producción,
 * variables de entorno o profile de AWS CLI en desarrollo local).
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/** Nombre de la tabla única (`infra/dynamodb.tf`), inyectado por Amplify como variable de entorno. */
export function nombreTablaExpedientes(entorno: NodeJS.ProcessEnv = process.env): string {
  const nombre = entorno.DYNAMODB_TABLE;
  if (!nombre) {
    throw new Error("Falta la variable de entorno DYNAMODB_TABLE (nombre de la tabla DynamoDB).");
  }
  return nombre;
}

let clienteDocumentoSingleton: DynamoDBDocumentClient | null = null;

/**
 * Cliente "documento" (marshalling automático de tipos JS <-> atributos
 * DynamoDB). `removeUndefinedValues` evita que un campo opcional en `undefined`
 * (en vez de `null` explícito) rompa el marshalling.
 */
export function obtenerClienteDynamoDb(): DynamoDBDocumentClient {
  if (!clienteDocumentoSingleton) {
    const clienteBase = new DynamoDBClient({ region: process.env.AWS_REGION });
    clienteDocumentoSingleton = DynamoDBDocumentClient.from(clienteBase, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return clienteDocumentoSingleton;
}
