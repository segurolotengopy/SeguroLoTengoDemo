/**
 * Doble de prueba en memoria de `S3Client`, para testear
 * `archivo-repository.ts` sin red ni credenciales de AWS reales. Solo
 * implementa `PutObjectCommand`/`GetObjectCommand`, que es lo único que usa
 * ese repositorio.
 */
import { NoSuchKey } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";

interface ComandoGenerico {
  readonly input: {
    readonly Bucket?: string;
    readonly Key?: string;
    readonly Body?: Uint8Array;
    readonly ContentType?: string;
  };
  readonly constructor: { readonly name: string };
}

export function crearFakeS3Client(): { s3Client: S3Client; bucket: Map<string, Uint8Array> } {
  const bucket = new Map<string, Uint8Array>();

  const s3Client = {
    async send(comando: ComandoGenerico): Promise<{ Body?: unknown }> {
      const tipo = comando.constructor.name;
      const { input } = comando;

      if (tipo === "PutObjectCommand") {
        bucket.set(input.Key!, input.Body!);
        return {};
      }

      if (tipo === "GetObjectCommand") {
        const contenido = bucket.get(input.Key!);
        if (!contenido) {
          throw new NoSuchKey({ message: "The specified key does not exist.", $metadata: {} });
        }
        return { Body: { transformToByteArray: async () => contenido } };
      }

      throw new Error(`fake-s3-client: comando no soportado en el test: "${tipo}"`);
    },
  } as unknown as S3Client;

  return { s3Client, bucket };
}
