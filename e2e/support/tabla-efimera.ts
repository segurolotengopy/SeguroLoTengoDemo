/**
 * Tabla de DynamoDB propia de cada corrida de la batería.
 *
 * ## Por qué
 *
 * La batería corría contra la tabla compartida del demo, y eso la volvió
 * inestable de una forma engañosa: los siete escenarios pasaban de a uno, pero
 * la corrida completa dejaba uno o dos en rojo y **nunca los mismos**, con el
 * tiempo total subiendo de 9 a 14 minutos entre corridas.
 *
 * La causa no era el código sino el volumen. Tres escenarios terminan —por
 * diseño— con la cédula en un estado que bloquea (regla #11), y el saneo previo
 * levanta ese bloqueo **creando un expediente nuevo enlazado**, que es lo
 * correcto: reactivar el viejo violaría la regla #5. Consecuencia: cada corrida
 * suma registros y ninguno se va. Los expedientes por cédula de prueba pasaron
 * de 28/26/57 a 31/28/61 en tres corridas, y cada consulta por cédula —que el
 * paso de identidad hace en cada escenario— se paga más cara que la anterior.
 *
 * Con una tabla por corrida el problema desaparece de raíz en vez de
 * compensarse con esperas más largas. Y trae un segundo beneficio que no era el
 * objetivo: **ya no hace falta sanear cédulas bloqueadas**, porque no hay nada
 * que heredar. Un escenario que deja un expediente terminal ya no le complica
 * la vida al siguiente.
 *
 * ## Qué NO cambia
 *
 * Se sigue hablando con DynamoDB de verdad, no con un doble: la fidelidad
 * —claves reales, TTL real, condiciones de escritura reales— es lo que hace
 * valiosa a esta batería, y era justamente lo que un doble local habría
 * perdido.
 *
 * El bucket de S3 sigue siendo el compartido: ahí los objetos se acumulan sin
 * encarecer ninguna consulta, así que no justifica el costo de crear y destruir
 * uno por corrida.
 */
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";

/**
 * Prefijo de las tablas efímeras.
 *
 * El permiso del usuario de QA está acotado a este prefijo
 * (`infra/iam-policy-qa-reference.json`, Sid `DynamoDBTablasEfimerasE2E`): la
 * batería puede crear y borrar **sus** tablas y ninguna otra. En particular no
 * puede tocar `slt-demo-expedientes`, que es la del demo.
 */
const PREFIJO = "slt-e2e-";

const clienteDynamo = new DynamoDBClient({});

/** Nombre único de la tabla de esta corrida. */
export function nombreTablaDeLaCorrida(): string {
  return `${PREFIJO}${Date.now()}-${process.pid}`;
}

async function esperarActiva(nombre: string, limiteMs = 120_000): Promise<void> {
  const limite = Date.now() + limiteMs;
  for (;;) {
    const { Table } = await clienteDynamo.send(new DescribeTableCommand({ TableName: nombre }));
    if (Table?.TableStatus === "ACTIVE") return;
    if (Date.now() > limite) {
      throw new Error(`La tabla ${nombre} no quedó ACTIVE en ${limiteMs} ms.`);
    }
    await new Promise((resolver) => setTimeout(resolver, 1_000));
  }
}

/**
 * Crea la tabla de la corrida con el mismo esquema que la del demo
 * (`infra/dynamodb.tf`): clave compuesta `pk`/`sk` y TTL nativo sobre
 * `expiresAt`, del que dependen la expiración del OTP y el vencimiento de los
 * expedientes.
 *
 * `PAY_PER_REQUEST` a propósito: una tabla que vive quince minutos y recibe
 * unos cientos de escrituras no justifica aprovisionar capacidad.
 */
export async function crearTablaDeLaCorrida(nombre: string): Promise<void> {
  await clienteDynamo.send(
    new CreateTableCommand({
      TableName: nombre,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
    }),
  );

  await esperarActiva(nombre);

  // El TTL se habilita después de que la tabla está activa: DynamoDB no lo
  // acepta en la creación. Sin esto, los escenarios que dependen de que un OTP
  // expire seguirían viendo códigos vivos.
  await clienteDynamo.send(
    new UpdateTimeToLiveCommand({
      TableName: nombre,
      TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
    }),
  );
}

/**
 * Borra la tabla de la corrida.
 *
 * No lanza si falla: el teardown no debería convertir una batería verde en
 * roja. Una tabla que quedó viva se ve enseguida por el prefijo y cuesta
 * centavos; una corrida marcada como fallida por un error de limpieza cuesta
 * una investigación.
 */
export async function borrarTablaDeLaCorrida(nombre: string): Promise<void> {
  try {
    await clienteDynamo.send(new DeleteTableCommand({ TableName: nombre }));
  } catch (error) {
    console.warn(`No se pudo borrar la tabla efímera ${nombre}: ${String(error)}`);
  }
}
