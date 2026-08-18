/**
 * Almacén persistente para el estado de los adaptadores mock.
 *
 * ## Por qué existe
 *
 * `src/adapters/mock/estado-compartido.ts` ancla el estado de los mocks en
 * `globalThis`, que alcanza para un proceso y por eso funciona en `next dev` y
 * en los E2E. **No alcanza en el cómputo de Amplify**: cada petición puede caer
 * en otra instancia, y ahí ese estado no existe.
 *
 * Ese límite estaba documentado como aceptable porque "lo que pertenece al
 * flujo real vive en DynamoDB". La clasificación era incorrecta para un caso:
 * la **sesión de firma simulada de Code100** sí pertenece al flujo cuando el
 * demo corre con `DEMO_MODE`. Es donde vive el OTP de firma y el resultado del
 * sellado, así que perderla entre dos peticiones rompe P8 entero — lo que se
 * observó desplegado: el enlace se creaba, y siete segundos después el
 * proveedor "no conocía" el acto de firma.
 *
 * ## Qué NO es
 *
 * No es evidencia ni parte del expediente. Es el estado interno de un
 * proveedor simulado, con TTL: en el flujo real ese estado vive en los
 * servidores de Code100 y nosotros no lo guardamos. Por eso va en su propia
 * partición y se borra solo.
 *
 * Es genérico a propósito (colección + clave + JSON) para que los otros mocks
 * con el mismo problema —persona activa, palancas de falla— puedan usarlo sin
 * inventar otro repositorio.
 */
import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { aEpochSegundos } from "./claves-tabla-unica";

/** 48 horas: mucho más que el plazo de firma, y suficiente para una demostración. */
const VIGENCIA_POR_DEFECTO_MS = 48 * 60 * 60 * 1000;

export interface AlmacenEstadoDemo {
  obtener<T>(coleccion: string, clave: string): Promise<T | null>;
  guardar(coleccion: string, clave: string, valor: unknown): Promise<void>;
  listar<T>(coleccion: string): Promise<readonly T[]>;
  borrar(coleccion: string, clave: string): Promise<void>;
}

function particion(coleccion: string): string {
  return `DEMO#${coleccion}`;
}

export interface OpcionesEstadoDemoDynamoDb {
  readonly documentClient: DynamoDBDocumentClient;
  readonly nombreTabla: string;
  readonly ahora?: () => Date;
}

export function crearAlmacenEstadoDemoDynamoDb(
  opciones: OpcionesEstadoDemoDynamoDb,
): AlmacenEstadoDemo {
  const { documentClient, nombreTabla } = opciones;
  const ahora = opciones.ahora ?? (() => new Date());

  return {
    async obtener<T>(coleccion: string, clave: string): Promise<T | null> {
      const respuesta = await documentClient.send(
        new GetCommand({ TableName: nombreTabla, Key: { pk: particion(coleccion), sk: clave } }),
      );
      return (respuesta.Item?.valor as T | undefined) ?? null;
    },

    async guardar(coleccion: string, clave: string, valor: unknown): Promise<void> {
      const expira = new Date(ahora().getTime() + VIGENCIA_POR_DEFECTO_MS).toISOString();
      await documentClient.send(
        new PutCommand({
          TableName: nombreTabla,
          Item: {
            pk: particion(coleccion),
            sk: clave,
            valor,
            // Mismo atributo de TTL que el resto de la tabla (infra/dynamodb.tf).
            expiresAt: aEpochSegundos(expira),
          },
        }),
      );
    },

    async listar<T>(coleccion: string): Promise<readonly T[]> {
      const respuesta = await documentClient.send(
        new QueryCommand({
          TableName: nombreTabla,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": particion(coleccion) },
        }),
      );
      return (respuesta.Items ?? []).map((item) => item.valor as T);
    },

    async borrar(coleccion: string, clave: string): Promise<void> {
      await documentClient.send(
        new DeleteCommand({ TableName: nombreTabla, Key: { pk: particion(coleccion), sk: clave } }),
      );
    },
  };
}

/**
 * Almacén en memoria: el que usan los tests y el desarrollo local.
 *
 * Se mantiene como implementación de primera clase —y no como un mock de
 * test— porque `next dev` es un solo proceso y no necesita DynamoDB para que
 * el demo funcione.
 */
export function crearAlmacenEstadoDemoEnMemoria(): AlmacenEstadoDemo {
  const datos = new Map<string, Map<string, unknown>>();

  function coleccionDe(nombre: string): Map<string, unknown> {
    const existente = datos.get(nombre);
    if (existente) return existente;
    const nueva = new Map<string, unknown>();
    datos.set(nombre, nueva);
    return nueva;
  }

  return {
    async obtener<T>(coleccion: string, clave: string): Promise<T | null> {
      return (coleccionDe(coleccion).get(clave) as T | undefined) ?? null;
    },
    async guardar(coleccion, clave, valor) {
      coleccionDe(coleccion).set(clave, valor);
    },
    async listar<T>(coleccion: string): Promise<readonly T[]> {
      return [...coleccionDe(coleccion).values()] as T[];
    },
    async borrar(coleccion, clave) {
      coleccionDe(coleccion).delete(clave);
    },
  };
}
