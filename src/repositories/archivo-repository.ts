/**
 * Repositorio S3 genérico de archivos (bucket `slt-demo-evidencias`,
 * `infra/s3.tf`): imágenes de captura de identidad (P5), y los PDF
 * cerrados de Solicitud/FIPF antes y después de la firma.
 *
 * Deliberadamente genérico por `clave`/bytes — no sabe de Solicitud, FIPF
 * ni cédulas; quien arma la `clave` (p.ej. `expedientes/<id>/identidad/frente-cedula.jpg`)
 * es el llamador (el futuro `IdentityProvider` mock/live, o el servicio de
 * generación de PDF). Mantiene a este repositorio libre de lógica de
 * negocio, igual que `dynamo-client.ts`.
 *
 * Siempre calcula y devuelve el SHA-256 del contenido guardado: regla de
 * negocio inviolable #4 (los PDF se hashean antes de habilitar la firma) y
 * el patrón general de evidencia hasheada de CLAUDE.md dependen de poder
 * conocer ese hash en el momento de guardar, no reconstruirlo después.
 */
import { createHash } from "node:crypto";
import { GetObjectCommand, NoSuchKey, PutObjectCommand } from "@aws-sdk/client-s3";
import type { GetObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";

export interface ArchivoGuardado {
  readonly clave: string;
  readonly hashSha256: string;
}

export interface ArchivoRepository {
  guardarArchivo(clave: string, contenido: Uint8Array, contentType: string): Promise<ArchivoGuardado>;
  /** `null` si la clave no existe (nunca lanza por "no encontrado"). */
  obtenerArchivo(clave: string): Promise<Uint8Array | null>;
}

export interface DependenciasArchivoRepository {
  readonly s3Client: S3Client;
  readonly nombreBucket: string;
}

function sha256Hex(contenido: Uint8Array): string {
  return createHash("sha256").update(contenido).digest("hex");
}

async function bufferDesdeCuerpo(cuerpo: NonNullable<GetObjectCommandOutput["Body"]>): Promise<Uint8Array> {
  // El SDK v3 tipa `Body` como `sdk-stream-mixin`; en runtime Node siempre
  // expone `transformToByteArray`, que es lo único que necesitamos acá.
  const transformable = cuerpo as { transformToByteArray: () => Promise<Uint8Array> };
  return transformable.transformToByteArray();
}

export function crearArchivoRepositoryS3(deps: DependenciasArchivoRepository): ArchivoRepository {
  const { s3Client, nombreBucket } = deps;

  return {
    async guardarArchivo(clave: string, contenido: Uint8Array, contentType: string): Promise<ArchivoGuardado> {
      const hashSha256 = sha256Hex(contenido);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: nombreBucket,
          Key: clave,
          Body: contenido,
          ContentType: contentType,
          // Guardado como metadata del objeto para poder verificar
          // integridad en S3 sin volver a descargar y rehashear el archivo.
          Metadata: { sha256: hashSha256 },
        }),
      );
      return { clave, hashSha256 };
    },

    async obtenerArchivo(clave: string): Promise<Uint8Array | null> {
      try {
        const respuesta = await s3Client.send(new GetObjectCommand({ Bucket: nombreBucket, Key: clave }));
        if (!respuesta.Body) return null;
        return await bufferDesdeCuerpo(respuesta.Body);
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
  };
}
