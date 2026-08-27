/**
 * Persistencia de los registros de entrega de documentos (CHG-44, CMP-05).
 *
 * Vive en la misma tabla única, anidado bajo la partición del expediente:
 *
 *     pk = EXPEDIENTE#<id>     sk = ENTREGA#<canal>
 *
 * **Un ítem por canal y por expediente**, y eso es lo que hace idempotente al
 * despachador: no hay forma de que dos pasadas creen dos entregas del mismo
 * canal, porque las dos escribirían en la misma clave. Es el mismo patrón de
 * "item collection" con el que ya conviven la metadata y la evidencia.
 *
 * ## Por qué no hay índice de pendientes
 *
 * La tentación es un `INDICE#ENTREGA_PENDIENTE` con el próximo intento en el
 * sort key, para que un despachador global levante todo lo vencido. No está, y
 * es una decisión y no un olvido: en el demo el despachador se invoca **por
 * expediente**, desde la pantalla que ya sondea, así que la lectura siempre es
 * por partición conocida. Un índice global solo hace falta con una cola de
 * verdad (SQS) barriendo expedientes que nadie está mirando, y ese es el
 * momento de agregarlo — junto con el problema de mantenerlo consistente, que
 * el índice por estado de la consola ya documenta.
 *
 * ## Sin TTL
 *
 * Los ítems no expiran. El registro de que un documento se entregó —o de que
 * no se pudo— es parte de la historia del expediente y la conservación de la
 * matriz se mide en años (CMP-14), no en horas. Lo que la nota del plan llamaba
 * "TTL de reintento" es el `proximoIntentoEn` del propio registro, que es un
 * dato y no un vencimiento de base.
 */
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { EntregaDeDocumentos, RepositorioEntregas } from "../domain/entrega-documentos";
import { claveEntrega, particionDeExpediente, quitarClavesInternas } from "./claves-tabla-unica";

export interface DependenciasEntregaRepository {
  readonly documentClient: DynamoDBDocumentClient;
  readonly nombreTabla: string;
}

type ItemEntrega = EntregaDeDocumentos & { pk: string; sk: string; entityType: string };

export function crearEntregaRepositoryDynamoDb(
  deps: DependenciasEntregaRepository,
): RepositorioEntregas {
  const { documentClient, nombreTabla } = deps;

  return {
    async obtenerPorExpediente(expedienteId: string): Promise<readonly EntregaDeDocumentos[]> {
      const respuesta = await documentClient.send(
        new QueryCommand({
          TableName: nombreTabla,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefijo)",
          ExpressionAttributeValues: {
            ":pk": particionDeExpediente(expedienteId),
            ":prefijo": "ENTREGA#",
          },
        }),
      );

      return (respuesta.Items ?? []).map((item) =>
        quitarClavesInternas(item as ItemEntrega),
      ) as EntregaDeDocumentos[];
    },

    async guardar(entrega: EntregaDeDocumentos): Promise<void> {
      const { pk, sk } = claveEntrega(entrega.expedienteId, entrega.canal);
      // Sin bloqueo optimista, y a propósito: el estado de una entrega es
      // convergente —dos pasadas simultáneas ven al proveedor decir lo mismo—
      // y perder una escritura solo significa que la próxima pasada la repite.
      // No es evidencia: la evidencia sale aparte y esa sí es append-only.
      await documentClient.send(
        new PutCommand({
          TableName: nombreTabla,
          Item: { pk, sk, entityType: "ENTREGA", ...entrega },
        }),
      );
    },
  };
}
