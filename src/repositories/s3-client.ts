/**
 * Cliente único de S3. Mismo criterio que `dynamo-client.ts`: único archivo
 * de este directorio que importa `@aws-sdk/client-s3`.
 */
import { S3Client } from "@aws-sdk/client-s3";

/** Nombre del bucket de evidencias (`infra/s3.tf`), inyectado por Amplify como variable de entorno. */
export function nombreBucketEvidencias(entorno: NodeJS.ProcessEnv = process.env): string {
  const nombre = entorno.S3_BUCKET;
  if (!nombre) {
    throw new Error("Falta la variable de entorno S3_BUCKET (nombre del bucket de evidencias).");
  }
  return nombre;
}

let clienteS3Singleton: S3Client | null = null;

export function obtenerClienteS3(): S3Client {
  if (!clienteS3Singleton) {
    clienteS3Singleton = new S3Client({ region: process.env.AWS_REGION });
  }
  return clienteS3Singleton;
}
