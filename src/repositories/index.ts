/**
 * Punto de entrada del directorio de repositorios: arma cada repositorio ya
 * conectado a sus clientes de AWS reales, para que el resto de la app
 * (route handlers, adaptadores) los importe sin tocar `@aws-sdk/*` ni
 * `process.env` directamente.
 *
 * Regla dura de CLAUDE.md: nada fuera de `src/repositories/` importa el SDK
 * de DynamoDB ni de S3. Este archivo (y los demás de esta carpeta) son la
 * única excepción.
 *
 * No es un singleton de todos los repositorios juntos a propósito — cada
 * `crearXRepository()` se puede llamar independientemente, y los tests
 * (`__tests__/`) arman los repositorios con un `documentClient`/`s3Client`
 * falso en vez de pasar por acá.
 */
import { obtenerClienteDynamoDb, nombreTablaExpedientes } from "./dynamo-client";
import { obtenerClienteS3, nombreBucketEvidencias } from "./s3-client";
import { obtenerOtpPepper } from "./secrets-client";
import { crearOtpRepositoryDynamoDb } from "./otp-repository";
import type { OtpRepository } from "./otp-repository";
import { crearEvidenceStoreDynamoDb } from "./evidencia-repository";
import { crearEntregaRepositoryDynamoDb } from "./entrega-repository";
import type { RepositorioEntregas } from "../domain/entrega-documentos";
import { crearExpedienteRepositoryDynamoDb } from "./expediente-repository";
import type { ConsultaExpedientes, ExpedienteRepository } from "./expediente-repository";
import { crearArchivoRepositoryS3 } from "./archivo-repository";
import type { ArchivoRepository } from "./archivo-repository";
import {
  crearAlmacenEstadoDemoDynamoDb,
  crearAlmacenEstadoDemoEnMemoria,
} from "./estado-demo-repository";
import type { AlmacenEstadoDemo } from "./estado-demo-repository";
import type { EvidenceStore } from "../ports/evidence-store";

export function crearOtpRepository(): OtpRepository {
  return crearOtpRepositoryDynamoDb({
    documentClient: obtenerClienteDynamoDb(),
    nombreTabla: nombreTablaExpedientes(),
    obtenerPepper: obtenerOtpPepper,
  });
}

export function crearEvidenceStore(): EvidenceStore {
  return crearEvidenceStoreDynamoDb({
    documentClient: obtenerClienteDynamoDb(),
    nombreTabla: nombreTablaExpedientes(),
  });
}

/** Registros de entrega de documentos por canal (CHG-44, CMP-05). */
export function crearEntregaRepository(): RepositorioEntregas {
  return crearEntregaRepositoryDynamoDb({
    documentClient: obtenerClienteDynamoDb(),
    nombreTabla: nombreTablaExpedientes(),
  });
}

/**
 * Devuelve el repositorio con las búsquedas de la consola administrativa
 * incluidas (`ConsultaExpedientes`). Quien solo necesite leer y guardar puede
 * tipar el resultado como `ExpedienteRepository` y no verlas.
 */
export function crearExpedienteRepository(): ExpedienteRepository & ConsultaExpedientes {
  return crearExpedienteRepositoryDynamoDb({
    documentClient: obtenerClienteDynamoDb(),
    nombreTabla: nombreTablaExpedientes(),
  });
}

export function crearArchivoRepository(): ArchivoRepository {
  return crearArchivoRepositoryS3({
    s3Client: obtenerClienteS3(),
    nombreBucket: nombreBucketEvidencias(),
  });
}

export type { OtpRepository, CrearOtpInput, OtpCreado, RegistroOtp, ResultadoReenvioOtpRepo } from "./otp-repository";
export type { ConsultaExpedientes, ExpedienteRepository } from "./expediente-repository";
export type { ArchivoRepository, ArchivoGuardado } from "./archivo-repository";
export type { DependenciasEntregaRepository } from "./entrega-repository";

/**
 * Almacén del estado de los mocks que **no puede vivir en memoria**.
 *
 * Cae a memoria si no hay tabla configurada, que es el caso de `next dev` sin
 * AWS: ahí un solo proceso alcanza y no tiene sentido exigir DynamoDB para
 * levantar el demo. Desplegado, la tabla siempre está.
 */
let almacenEnMemoria: AlmacenEstadoDemo | null = null;

export function crearAlmacenEstadoDemo(): AlmacenEstadoDemo {
  if (!process.env.DYNAMODB_TABLE) {
    // Memoizado: crear uno nuevo por llamada perdería el estado entre
    // peticiones incluso dentro del mismo proceso, que es justo lo que este
    // almacén existe para evitar.
    almacenEnMemoria ??= crearAlmacenEstadoDemoEnMemoria();
    return almacenEnMemoria;
  }
  return crearAlmacenEstadoDemoDynamoDb({
    documentClient: obtenerClienteDynamoDb(),
    nombreTabla: nombreTablaExpedientes(),
  });
}

export type { AlmacenEstadoDemo } from "./estado-demo-repository";
