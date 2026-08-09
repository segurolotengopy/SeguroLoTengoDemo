/**
 * Repositorio DynamoDB del `Expediente` (el agregado central del dominio,
 * `src/domain/tipos.ts`). No es uno de los 7 puertos de `src/ports/` — esos
 * son proveedores externos; el Expediente es dato propio de la app, así que
 * su interfaz de acceso vive directamente acá, sin puerto intermedio.
 *
 * Guarda una foto completa del `Expediente` en cada escritura (no eventos
 * separados): el propio objeto ya es append-only en su `historial`
 * (`src/domain/expediente.ts` nunca borra ni reescribe una entrada previa),
 * así que sobreescribir el ítem con la versión más nueva no pierde ningún
 * paso anterior.
 *
 * `guardar` acepta un `actualizadoEnEsperado` opcional para bloqueo
 * optimista: si se pasa, la escritura falla en vez de pisar un cambio
 * concurrente que el caller no vio. Ningún Route Handler debe llamar a
 * `guardar` directamente con el resultado de mutar un expediente a mano —
 * el cambio de estado en sí lo valida `src/domain/expediente.ts`
 * (`transicionarExpediente`); este repositorio solo persiste el resultado.
 */
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Expediente } from "../domain/tipos";
import { claveExpediente, quitarClavesInternas } from "./claves-tabla-unica";

export interface ExpedienteRepository {
  /** Falla si ya existe un expediente con ese id. */
  crear(expediente: Expediente): Promise<void>;
  obtenerPorId(expedienteId: string): Promise<Expediente | null>;
  /**
   * Persiste la versión más nueva del expediente. Si se pasa
   * `actualizadoEnEsperado`, la escritura es condicional (bloqueo
   * optimista): falla si el `actualizadoEn` persistido ya no coincide
   * (alguien más escribió una versión más nueva entre la lectura y esta
   * escritura).
   */
  guardar(expediente: Expediente, actualizadoEnEsperado?: string): Promise<void>;
}

export interface DependenciasExpedienteRepository {
  readonly documentClient: DynamoDBDocumentClient;
  readonly nombreTabla: string;
}

export function crearExpedienteRepositoryDynamoDb(deps: DependenciasExpedienteRepository): ExpedienteRepository {
  const { documentClient, nombreTabla } = deps;

  return {
    async crear(expediente: Expediente): Promise<void> {
      const { pk, sk } = claveExpediente(expediente.id);
      try {
        await documentClient.send(
          new PutCommand({
            TableName: nombreTabla,
            Item: { pk, sk, entityType: "EXPEDIENTE", ...expediente },
            ConditionExpression: "attribute_not_exists(pk)",
          }),
        );
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
          throw new Error(`Ya existe un expediente con id ${expediente.id}.`);
        }
        throw error;
      }
    },

    async obtenerPorId(expedienteId: string): Promise<Expediente | null> {
      const { pk, sk } = claveExpediente(expedienteId);
      const respuesta = await documentClient.send(new GetCommand({ TableName: nombreTabla, Key: { pk, sk } }));
      if (!respuesta.Item) return null;
      const item = respuesta.Item as { pk: string; sk: string; entityType: string } & Expediente;
      return quitarClavesInternas(item);
    },

    async guardar(expediente: Expediente, actualizadoEnEsperado?: string): Promise<void> {
      const { pk, sk } = claveExpediente(expediente.id);
      try {
        await documentClient.send(
          new PutCommand({
            TableName: nombreTabla,
            Item: { pk, sk, entityType: "EXPEDIENTE", ...expediente },
            ...(actualizadoEnEsperado
              ? {
                  ConditionExpression: "actualizadoEn = :esperado",
                  ExpressionAttributeValues: { ":esperado": actualizadoEnEsperado },
                }
              : {}),
          }),
        );
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
          throw new Error(
            `El expediente ${expediente.id} fue modificado por otra escritura entre la lectura y este guardado ` +
              "(actualizadoEn ya no coincide).",
          );
        }
        throw error;
      }
    },
  };
}
