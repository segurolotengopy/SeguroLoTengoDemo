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
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ErrorEscrituraConcurrente } from "../domain/concurrencia";
import type { EstadoExpediente, Expediente } from "../domain/tipos";
import {
  claveExpediente,
  claveIndicePorEstado,
  claveIndicePorValor,
  particionIndice,
  quitarClavesInternas,
} from "./claves-tabla-unica";

export interface ExpedienteRepository {
  /** Falla si ya existe un expediente con ese id. */
  crear(expediente: Expediente): Promise<void>;
  obtenerPorId(expedienteId: string): Promise<Expediente | null>;
  /**
   * Persiste la versión más nueva del expediente. Si se pasa
   * `actualizadoEnEsperado`, la escritura es condicional (bloqueo
   * optimista): falla con `ErrorEscrituraConcurrente` si el `actualizadoEn`
   * persistido ya no coincide (alguien más escribió una versión más nueva
   * entre la lectura y esta escritura).
   */
  guardar(expediente: Expediente, actualizadoEnEsperado?: string): Promise<void>;
}

/**
 * Búsquedas de la consola administrativa (`docs/CONSOLA_ADMINISTRATIVA.md` §3).
 *
 * Interfaz separada de `ExpedienteRepository` a propósito: el flujo P0–P9 no
 * busca expedientes, los abre por id desde la cookie de sesión. Manteniéndolas
 * aparte, ningún caso de uso del flujo puede llamarlas por accidente y los
 * dobles de test del dominio no tienen que implementarlas.
 */
export interface ConsultaExpedientes {
  buscarPorCedula(numeroCedula: string): Promise<readonly Expediente[]>;
  /**
   * Por el celular verificado en P1, en formato E.164.
   *
   * Es la búsqueda que permite atender a quien llama trabado antes de P5:
   * hasta ahí **no hay cédula**, y el celular es el único dato que la persona
   * puede dar por teléfono.
   */
  buscarPorCelular(numeroE164: string): Promise<readonly Expediente[]>;
  /** Por el correo verificado en P4, normalizado. */
  buscarPorCorreo(correo: string): Promise<readonly Expediente[]>;
  buscarPorNumeroCaso(numeroCaso: string): Promise<readonly Expediente[]>;
  /**
   * Por el correlativo de la propuesta (`00018425`), sin prefijo: la consola
   * traduce `PROP-`/`FIPF-` con `correlativoDeCodigo` antes de llamar acá
   * (`docs/CONSOLA_ADMINISTRATIVA.md` §3 exige aceptar los tres formatos).
   */
  buscarPorNumeroPropuesta(correlativo: string): Promise<readonly Expediente[]>;
  /** Expedientes que declaran a este como `expedienteAnteriorId`. */
  buscarSucesores(expedienteId: string): Promise<readonly Expediente[]>;
  /** `desde`/`hasta` son ISO 8601 y filtran por `actualizadoEn`. */
  buscarPorEstado(
    estado: EstadoExpediente,
    rango?: { desde?: string; hasta?: string; limite?: number },
  ): Promise<readonly Expediente[]>;
}

export interface DependenciasExpedienteRepository {
  readonly documentClient: DynamoDBDocumentClient;
  readonly nombreTabla: string;
}

export function crearExpedienteRepositoryDynamoDb(
  deps: DependenciasExpedienteRepository,
): ExpedienteRepository & ConsultaExpedientes {
  const { documentClient, nombreTabla } = deps;

  /**
   * Escribe los ítems de índice que consume la consola administrativa.
   *
   * Se hace **después** del Put del expediente y sin transacción: si alguna de
   * estas escrituras falla, el expediente ya quedó guardado y lo único que se
   * pierde es que la consola no lo encuentre por ese criterio hasta la próxima
   * escritura. Es la compensación correcta — el expediente es el dato, el
   * índice es una ayuda de búsqueda; ninguna regla de negocio depende de él.
   */
  async function escribirIndices(expediente: Expediente): Promise<void> {
    const claves: { pk: string; sk: string }[] = [
      claveIndicePorEstado(expediente.estado, expediente.actualizadoEn, expediente.id),
    ];

    // La cédula aparece recién en P5; el número de caso, solo si P6 derivó.
    if (expediente.identidad) {
      claves.push(claveIndicePorValor("CEDULA", expediente.identidad.numeroCedula, expediente.id));
    }
    // Canales verificados: el celular queda desde P1 y el correo desde P4,
    // mucho antes que la cédula. Son los índices que permiten atender a quien
    // llama trabado en los primeros pasos.
    if (expediente.canalWhatsapp) {
      claves.push(claveIndicePorValor("CELULAR", expediente.canalWhatsapp.valor, expediente.id));
    }
    if (expediente.canalEmail) {
      claves.push(claveIndicePorValor("EMAIL", expediente.canalEmail.valor, expediente.id));
    }
    if (expediente.numeroCasoDerivacion) {
      claves.push(claveIndicePorValor("CASO", expediente.numeroCasoDerivacion, expediente.id));
    }
    // El caso de asistencia de identidad comparte la partición "CASO" con el
    // de derivación a propósito: son dos colas distintas pero un solo campo de
    // búsqueda en la consola, y los prefijos (`CASO-` / `ASIS-`) ya los
    // distinguen sin ambigüedad. Un índice aparte obligaría a la consola a
    // adivinar en cuál buscar.
    if (expediente.numeroCasoAsistenciaIdentidad) {
      claves.push(
        claveIndicePorValor("CASO", expediente.numeroCasoAsistenciaIdentidad, expediente.id),
      );
    }
    // El correlativo de la propuesta se acuña en P7 y no cambia más, así que
    // este índice tampoco puede quedar obsoleto. Los expedientes guardados
    // antes de que existiera lo ganan en su próxima escritura — misma
    // compensación que el resto: el índice acota candidatos, no es verdad.
    if (expediente.numeroPropuesta) {
      claves.push(claveIndicePorValor("PROPUESTA", expediente.numeroPropuesta, expediente.id));
    }
    // Índice de sucesión: permite preguntar "¿alguien ya superó a este
    // expediente?" sin depender de que tenga cédula. Es lo que impide crear
    // dos sucesores del mismo caso terminal.
    if (expediente.expedienteAnteriorId) {
      claves.push(
        claveIndicePorValor("ANTERIOR", expediente.expedienteAnteriorId, expediente.id),
      );
    }

    for (const { pk, sk } of claves) {
      await documentClient.send(
        new PutCommand({
          TableName: nombreTabla,
          // El ítem de índice solo apunta: no duplica ni un dato del
          // expediente. Así no puede quedar desactualizado ni filtrar nada
          // sensible si alguien lee la tabla cruda.
          Item: { pk, sk, entityType: "INDICE_EXPEDIENTE", expedienteId: expediente.id },
        }),
      );
    }
  }

  /** Resuelve ids a expedientes, salteando los que ya no existan. */
  async function hidratar(ids: readonly string[]): Promise<readonly Expediente[]> {
    const expedientes: Expediente[] = [];
    for (const id of [...new Set(ids)]) {
      const expediente = await repositorio.obtenerPorId(id);
      if (expediente) expedientes.push(expediente);
    }
    return expedientes;
  }

  async function idsDeIndice(pk: string, extra?: {
    sortKeyExpresion: string;
    valores: Readonly<Record<string, string>>;
    limite?: number;
  }): Promise<readonly string[]> {
    const respuesta = await documentClient.send(
      new QueryCommand({
        TableName: nombreTabla,
        KeyConditionExpression: extra ? `pk = :pk AND ${extra.sortKeyExpresion}` : "pk = :pk",
        ExpressionAttributeValues: { ":pk": pk, ...(extra?.valores ?? {}) },
        ScanIndexForward: false, // más reciente primero
        ...(extra?.limite ? { Limit: extra.limite } : {}),
      }),
    );

    const items = (respuesta.Items ?? []) as Array<{ expedienteId?: unknown }>;
    return items
      .map((item) => item.expedienteId)
      .filter((id): id is string => typeof id === "string");
  }

  const repositorio: ExpedienteRepository & ConsultaExpedientes = {
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
      await escribirIndices(expediente);
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
          // Tipado a propósito: es una carrera esperable entre dos peticiones
          // de la misma pantalla, y los casos de uso la atajan y la convierten
          // en respuesta controlada (ver `src/domain/concurrencia.ts`).
          throw new ErrorEscrituraConcurrente(expediente.id);
        }
        throw error;
      }
      await escribirIndices(expediente);
    },

    // -----------------------------------------------------------------------
    // Consultas de la consola administrativa
    // -----------------------------------------------------------------------

    async buscarPorCedula(numeroCedula: string): Promise<readonly Expediente[]> {
      const ids = await idsDeIndice(particionIndice("CEDULA", numeroCedula));
      const expedientes = await hidratar(ids);
      // El índice por cédula no puede quedar obsoleto (la cédula no cambia),
      // pero sí se verifica igual: si alguien escribiera un ítem de índice a
      // mano, no alcanzaría para que la consola muestre un expediente ajeno.
      return expedientes.filter(
        (expediente) => expediente.identidad?.numeroCedula === numeroCedula,
      );
    },

    async buscarPorCelular(numeroE164: string): Promise<readonly Expediente[]> {
      const ids = await idsDeIndice(particionIndice("CELULAR", numeroE164));
      const expedientes = await hidratar(ids);
      // Se verifica contra el expediente igual que la cédula: el índice acota
      // candidatos, no es la verdad.
      return expedientes.filter((expediente) => expediente.canalWhatsapp?.valor === numeroE164);
    },

    async buscarPorCorreo(correo: string): Promise<readonly Expediente[]> {
      const ids = await idsDeIndice(particionIndice("EMAIL", correo));
      const expedientes = await hidratar(ids);
      return expedientes.filter((expediente) => expediente.canalEmail?.valor === correo);
    },

    async buscarPorNumeroCaso(numeroCaso: string): Promise<readonly Expediente[]> {
      const ids = await idsDeIndice(particionIndice("CASO", numeroCaso));
      const expedientes = await hidratar(ids);
      return expedientes.filter(
        (expediente) =>
          expediente.numeroCasoDerivacion === numeroCaso ||
          expediente.numeroCasoAsistenciaIdentidad === numeroCaso,
      );
    },

    async buscarPorNumeroPropuesta(correlativo: string): Promise<readonly Expediente[]> {
      const ids = await idsDeIndice(particionIndice("PROPUESTA", correlativo));
      const expedientes = await hidratar(ids);
      return expedientes.filter((expediente) => expediente.numeroPropuesta === correlativo);
    },

    async buscarSucesores(expedienteId: string): Promise<readonly Expediente[]> {
      const ids = await idsDeIndice(particionIndice("ANTERIOR", expedienteId));
      const expedientes = await hidratar(ids);
      return expedientes.filter(
        (expediente) => expediente.expedienteAnteriorId === expedienteId,
      );
    },

    async buscarPorEstado(
      estado: EstadoExpediente,
      rango: { desde?: string; hasta?: string; limite?: number } = {},
    ): Promise<readonly Expediente[]> {
      const { desde, hasta, limite = 50 } = rango;

      // El sort key es `<actualizadoEn>#<id>`; los centinelas cubren todo el
      // rango de ids dentro de cada fecha.
      const extra =
        desde || hasta
          ? {
              sortKeyExpresion: "sk BETWEEN :desde AND :hasta",
              valores: {
                ":desde": `${desde ?? "0000"}#`,
                ":hasta": `${hasta ?? "9999"}#￿`,
              },
            }
          : undefined;

      const ids = await idsDeIndice(particionIndice("ESTADO", estado), extra && { ...extra, limite });
      const expedientes = await hidratar(ids);

      // Filtro obligatorio: el índice por estado guarda una entrada por cada
      // estado por el que pasó el expediente y no borra las viejas (ver
      // `claves-tabla-unica.ts`). Sin esto, la consola mostraría como
      // "DERIVADO_MANUAL" a expedientes que hoy están en otro estado.
      return expedientes.filter((expediente) => expediente.estado === estado).slice(0, limite);
    },
  };

  return repositorio;
}
