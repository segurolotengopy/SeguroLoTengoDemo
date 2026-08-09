/**
 * Implementación DynamoDB del puerto `EvidenceStore` (regla de negocio
 * inviolable #10: registro append-only de fecha, hora, IP, dispositivo,
 * sesión, versión de texto aceptado y resultado de cada paso).
 *
 * La interfaz `EvidenceStore` (`src/ports/evidence-store.ts`) ya hace
 * imposible pedir un borrado o una actualización a nivel de tipos — acá
 * además se refuerza a nivel de infraestructura: `guardar` hace un
 * `PutItem` con `ConditionExpression: attribute_not_exists(pk)`, así que ni
 * siquiera un bug que reutilice un `id` de evidencia puede pisar un
 * registro existente.
 *
 * Corre contra la misma suite de contrato que cualquier otra implementación
 * de `EvidenceStore` (`src/ports/__tests__/evidence-store.contract.ts`) —
 * ver `src/repositories/__tests__/evidencia-repository.test.ts`.
 */
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { RegistroEvidencia } from "../domain/tipos";
import type { EvidenceStore } from "../ports/evidence-store";
import { claveEvidencia, prefijoEvidenciaDeExpediente, quitarClavesInternas } from "./claves-tabla-unica";

export interface DependenciasEvidenciaRepository {
  readonly documentClient: DynamoDBDocumentClient;
  readonly nombreTabla: string;
}

export function crearEvidenceStoreDynamoDb(deps: DependenciasEvidenciaRepository): EvidenceStore {
  const { documentClient, nombreTabla } = deps;

  return {
    async guardar(registro: RegistroEvidencia): Promise<void> {
      const { pk, sk } = claveEvidencia(registro.expedienteId, registro.id, registro.fecha);

      try {
        await documentClient.send(
          new PutCommand({
            TableName: nombreTabla,
            Item: { pk, sk, entityType: "EVIDENCIA", ...registro },
            ConditionExpression: "attribute_not_exists(pk)",
          }),
        );
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
          throw new Error(
            `Ya existe un registro de evidencia con id ${registro.id} para el expediente ${registro.expedienteId}: ` +
              "un EvidenceStore es append-only, no se puede sobrescribir.",
          );
        }
        throw error;
      }
    },

    async obtenerHistorial(expedienteId: string): Promise<readonly RegistroEvidencia[]> {
      const respuesta = await documentClient.send(
        new QueryCommand({
          TableName: nombreTabla,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefijo)",
          ExpressionAttributeValues: {
            ":pk": prefijoEvidenciaDeExpediente(expedienteId),
            ":prefijo": "EVID#",
          },
          // El sort key embebe la fecha ISO antes del id (claves-tabla-unica.ts),
          // así que el orden ascendente por defecto de Query ya es el orden
          // cronológico de guardado: no hace falta ordenar en memoria.
          ScanIndexForward: true,
        }),
      );

      const items = (respuesta.Items ?? []) as Array<{ pk: string; sk: string; entityType: string } & RegistroEvidencia>;
      return items.map(quitarClavesInternas);
    },
  };
}
