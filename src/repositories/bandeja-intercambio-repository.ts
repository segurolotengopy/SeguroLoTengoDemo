/**
 * Bandeja de S3 del intercambio con la aseguradora (bucket
 * `slt-demo-intercambio-alianza-*`, `infra/alianza-sftp.tf`).
 *
 * El conector de Transfer Family lee de acá lo que se manda y escribe acá lo
 * que trae. El adaptador `live` del puerto `IntercambioAseguradora` no puede
 * importar el SDK de S3 (regla dura de acceso a datos), así que pasa por este
 * repositorio.
 *
 * Deliberadamente genérico por clave y bytes, como `archivo-repository.ts`.
 *
 * ## Escritura sin pisar
 *
 * La única escritura es `guardarSiNoExiste`, sobre `PutObject` con
 * `If-None-Match: *`: S3 rechaza la escritura si la clave ya existe. Con eso
 * el adaptador obtiene dos cosas sin una base aparte:
 *
 * - **Idempotencia atómica.** Dos instancias de cómputo que reciben el mismo
 *   pedido a la vez escriben el mismo marcador; una gana y la otra se entera.
 * - **Bitácora append-only** (regla inviolable #10). Cada evento de una
 *   transferencia es un objeto nuevo que no se puede sobrescribir, y el rol de
 *   la app no tiene `s3:DeleteObject` sobre esta bandeja.
 *
 * Referencia: https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
 */
import {
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { GetObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";

export type ResultadoGuardadoBandeja = "CREADO" | "YA_EXISTIA";

export interface BandejaIntercambio {
  /** Escribe solo si la clave no existe. Nunca sobrescribe. */
  guardarSiNoExiste(clave: string, contenido: Uint8Array, contentType: string): Promise<ResultadoGuardadoBandeja>;
  /** `null` si la clave no existe (nunca lanza por "no encontrado"). */
  obtener(clave: string): Promise<Uint8Array | null>;
  /** Claves bajo el prefijo, en orden lexicográfico. */
  listarClaves(prefijo: string): Promise<readonly string[]>;
  /** Ruta con la que Transfer Family nombra un objeto: `/<bucket>/<clave>`. */
  rutaTransfer(clave: string): string;
  /** Inversa de `rutaTransfer`; `null` si la ruta es de otro bucket. */
  claveDesdeRutaTransfer(ruta: string): string | null;
}

export interface DependenciasBandejaS3 {
  readonly s3Client: Pick<S3Client, "send">;
  readonly nombreBucket: string;
}

function rutasDelBucket(nombreBucket: string) {
  const prefijo = `/${nombreBucket}/`;
  return {
    rutaTransfer: (clave: string) => `${prefijo}${clave}`,
    claveDesdeRutaTransfer: (ruta: string) => (ruta.startsWith(prefijo) ? ruta.slice(prefijo.length) : null),
  };
}

/** `If-None-Match` perdido: 412, o 409 si otra escritura condicional estaba en curso. */
function esEscrituraCondicionalPerdida(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const estado = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return (
    error.name === "PreconditionFailed" ||
    error.name === "ConditionalRequestConflict" ||
    estado === 412 ||
    estado === 409
  );
}

async function bytesDesdeCuerpo(cuerpo: NonNullable<GetObjectCommandOutput["Body"]>): Promise<Uint8Array> {
  const transformable = cuerpo as { transformToByteArray: () => Promise<Uint8Array> };
  return transformable.transformToByteArray();
}

export function crearBandejaIntercambioS3(deps: DependenciasBandejaS3): BandejaIntercambio {
  const { s3Client, nombreBucket } = deps;

  return {
    ...rutasDelBucket(nombreBucket),

    async guardarSiNoExiste(clave, contenido, contentType) {
      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: nombreBucket,
            Key: clave,
            Body: contenido,
            ContentType: contentType,
            IfNoneMatch: "*",
          }),
        );
        return "CREADO";
      } catch (error) {
        if (esEscrituraCondicionalPerdida(error)) return "YA_EXISTIA";
        throw error;
      }
    },

    async obtener(clave) {
      try {
        const respuesta = await s3Client.send(new GetObjectCommand({ Bucket: nombreBucket, Key: clave }));
        if (!respuesta.Body) return null;
        return await bytesDesdeCuerpo(respuesta.Body);
      } catch (error) {
        if (error instanceof NoSuchKey || (error instanceof Error && error.name === "NoSuchKey")) return null;
        throw error;
      }
    },

    async listarClaves(prefijo) {
      const claves: string[] = [];
      let continuacion: string | undefined;
      do {
        const pagina = await s3Client.send(
          new ListObjectsV2Command({ Bucket: nombreBucket, Prefix: prefijo, ContinuationToken: continuacion }),
        );
        for (const objeto of pagina.Contents ?? []) {
          if (objeto.Key) claves.push(objeto.Key);
        }
        continuacion = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
      } while (continuacion);
      return claves.sort();
    },
  };
}

/**
 * Implementación en memoria, con la misma semántica de no sobrescribir. La
 * usan los tests del adaptador `live` y del contrato; no tiene otro uso.
 */
export function crearBandejaIntercambioEnMemoria(
  nombreBucket = "bandeja-en-memoria",
): BandejaIntercambio & { readonly objetos: ReadonlyMap<string, Uint8Array>; escribirDirecto(clave: string, contenido: Uint8Array): void } {
  const objetos = new Map<string, Uint8Array>();

  return {
    ...rutasDelBucket(nombreBucket),
    objetos,
    /** Lo que escribe el conector de Transfer Family, que no pasa por la app. */
    escribirDirecto(clave, contenido) {
      objetos.set(clave, contenido);
    },
    async guardarSiNoExiste(clave, contenido) {
      if (objetos.has(clave)) return "YA_EXISTIA";
      objetos.set(clave, contenido);
      return "CREADO";
    },
    async obtener(clave) {
      return objetos.get(clave) ?? null;
    },
    async listarClaves(prefijo) {
      return [...objetos.keys()].filter((clave) => clave.startsWith(prefijo)).sort();
    },
  };
}
