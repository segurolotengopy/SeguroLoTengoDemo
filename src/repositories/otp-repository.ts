/**
 * Repositorio de OTP (celular P1 y correo P4) sobre la tabla única de
 * DynamoDB, con TTL nativo.
 *
 * Regla de negocio inviolable #1 (CLAUDE.md): 6 dígitos, uso único,
 * vigencia 5 minutos, máximo 3 intentos, reenvío bloqueado 60 segundos.
 * Regla de negocio inviolable #2: solo el hash del OTP se persiste, nunca
 * el código en claro — ni en base, ni en logs, ni en respuestas de API.
 *
 * Este repositorio es la única pieza del sistema que ve el código en
 * claro, y solo en el instante de generarlo o de recibir el código
 * ingresado para compararlo (`otp-hash.ts`); lo que persiste en DynamoDB es
 * siempre `codigoHash`, nunca `codigo`. `RegistroOtp` (el tipo que exponen
 * `obtener`/`crear`/`registrarReenvio` hacia el resto de la app) ni
 * siquiera declara un campo de hash, para que no haya manera de que un
 * caller lo reenvíe por accidente en una respuesta de API.
 *
 * TTL nativo (`expiresAt`, en `infra/dynamodb.tf`): se fija a 24 horas
 * después de `expiraEn`, no exactamente en `expiraEn`. La vigencia de
 * negocio de 5 minutos la sigue evaluando esta clase comparando `expiraEn`
 * contra `ahora` en cada verificación (el borrado de DynamoDB por TTL no es
 * instantáneo, típicamente tarda hasta 48hs) — el TTL acá es limpieza de
 * almacenamiento, no el mecanismo que hace cumplir la vigencia de 5
 * minutos.
 *
 * El otpId (`crypto.randomUUID()`) es la única clave de lectura: el
 * `OtpProvider` (adaptador) que consuma este repositorio no vuelve a pasar
 * `expedienteId` en `verificarOtp`/`reenviarOtp`, así que el ítem vive en
 * su propia partición (`OTP#<otpId>`), no anidado bajo el expediente — ver
 * `claves-tabla-unica.ts`.
 */
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { COOLDOWN_REENVIO_MS, INTENTOS_MAXIMOS_OTP, VIGENCIA_OTP_MS } from "../domain/reglas-otp";
import type { CanalOtp, PropositoOtp, ResultadoVerificacionOtp } from "../ports/otp-provider";
import { aEpochSegundos, claveOtp } from "./claves-tabla-unica";
import { codigoCoincideConHash, generarCodigoOtp, hashOtpConPepper } from "./otp-hash";

// Los parámetros de la regla #1 viven en el dominio (`domain/reglas-otp.ts`)
// para que repositorio, casos de uso y UI compartan los mismos valores. Se
// re-exportan acá porque este módulo era su lugar original.
export { COOLDOWN_REENVIO_MS, INTENTOS_MAXIMOS_OTP, VIGENCIA_OTP_MS };

const MARGEN_LIMPIEZA_TTL_MS = 24 * 60 * 60 * 1000;

export interface CrearOtpInput {
  readonly expedienteId: string;
  readonly proposito: PropositoOtp;
  readonly canal: CanalOtp;
  /**
   * Número E.164 o correo al que se envía. Se persiste para atar
   * criptográficamente "el canal que recibió el código" con "el canal que
   * queda registrado como verificado": sin esto, el cliente podría pedir el
   * código a un número y declarar otro al verificar. También es lo que
   * alimenta el número enmascarado de la evidencia (regla inviolable #10).
   */
  readonly destino: string;
  readonly ahora?: string; // ISO 8601, default: instante de la llamada
}

export interface OtpCreado {
  readonly otpId: string;
  /**
   * Código en claro — existe únicamente en este valor de retorno, para que
   * el adaptador lo mande por WhatsApp/correo. No se persiste en ningún
   * lado ni puede volver a leerse (regla inviolable #2).
   */
  readonly codigo: string;
  readonly expiraEn: string;
}

/** Vista pública de un OTP: deliberadamente sin `codigoHash` (regla #2). */
export interface RegistroOtp {
  readonly otpId: string;
  readonly expedienteId: string;
  readonly proposito: PropositoOtp;
  readonly canal: CanalOtp;
  readonly destino: string;
  readonly creadoEn: string;
  readonly expiraEn: string;
  readonly ultimoEnvioEn: string;
  readonly intentos: number;
  readonly consumidoEn: string | null;
}

export type ResultadoReenvioOtpRepo =
  | { readonly ok: true; readonly codigo: string; readonly expiraEn: string }
  | { readonly ok: false; readonly motivo: "REENVIO_BLOQUEADO"; readonly segundosRestantes: number }
  | { readonly ok: false; readonly motivo: "NO_ENCONTRADO" };

export interface OtpRepository {
  /** Genera el código, lo hashea con pepper y persiste solo el hash. */
  crear(input: CrearOtpInput): Promise<OtpCreado>;
  /** Metadata sin el hash. `null` si no existe (incluida la posibilidad de que ya haya sido purgado por TTL). */
  obtener(otpId: string): Promise<RegistroOtp | null>;
  /** Re-hashea `codigoIngresado` y compara contra el hash persistido; nunca recibe ni devuelve el código correcto. */
  verificarCodigo(otpId: string, codigoIngresado: string, ahora?: string): Promise<ResultadoVerificacionOtp>;
  /** Rota el código (nuevo hash, intentos en cero, vigencia extendida) si ya pasó el cooldown de 60s. */
  registrarReenvio(otpId: string, ahora?: string): Promise<ResultadoReenvioOtpRepo>;
}

interface ItemOtpCrudo {
  readonly pk: string;
  readonly sk: string;
  readonly entityType: "OTP";
  readonly otpId: string;
  readonly expedienteId: string;
  readonly proposito: PropositoOtp;
  readonly canal: CanalOtp;
  readonly destino: string;
  readonly codigoHash: string;
  readonly creadoEn: string;
  readonly expiraEn: string;
  readonly ultimoEnvioEn: string;
  readonly intentos: number;
  /**
   * Ausente (no `null`) mientras el OTP no se consumió. Es a propósito: el
   * cliente de DynamoDB marshalla `null` como un atributo NULL explícito
   * (que sí "existe" para `attribute_not_exists`), así que si este campo se
   * guardara como `null` desde el arranque, `verificarCodigo` nunca podría
   * usar `attribute_not_exists(consumidoEn)` para garantizar el uso único
   * de forma atómica (regla inviolable #1) — el atributo ya existiría.
   */
  readonly consumidoEn?: string;
  readonly expiresAt: number;
}

function aRegistroPublico(item: ItemOtpCrudo): RegistroOtp {
  return {
    otpId: item.otpId,
    expedienteId: item.expedienteId,
    proposito: item.proposito,
    canal: item.canal,
    destino: item.destino,
    creadoEn: item.creadoEn,
    expiraEn: item.expiraEn,
    ultimoEnvioEn: item.ultimoEnvioEn,
    intentos: item.intentos,
    consumidoEn: item.consumidoEn ?? null,
  };
}

export interface DependenciasOtpRepository {
  readonly documentClient: DynamoDBDocumentClient;
  readonly nombreTabla: string;
  /** Inyectado (no importado directo) para poder testear sin Secrets Manager real. */
  readonly obtenerPepper: () => Promise<string>;
}

export function crearOtpRepositoryDynamoDb(deps: DependenciasOtpRepository): OtpRepository {
  const { documentClient, nombreTabla, obtenerPepper } = deps;

  async function obtenerCrudo(otpId: string): Promise<ItemOtpCrudo | null> {
    const { pk, sk } = claveOtp(otpId);
    const respuesta = await documentClient.send(new GetCommand({ TableName: nombreTabla, Key: { pk, sk } }));
    return (respuesta.Item as ItemOtpCrudo | undefined) ?? null;
  }

  return {
    async crear(input: CrearOtpInput): Promise<OtpCreado> {
      const ahora = input.ahora ?? new Date().toISOString();
      const otpId = randomUUID();
      const expiraEn = new Date(new Date(ahora).getTime() + VIGENCIA_OTP_MS).toISOString();
      const codigo = generarCodigoOtp();
      const pepper = await obtenerPepper();
      const codigoHash = hashOtpConPepper(codigo, pepper);

      const { pk, sk } = claveOtp(otpId);
      const item: ItemOtpCrudo = {
        pk,
        sk,
        entityType: "OTP",
        otpId,
        expedienteId: input.expedienteId,
        proposito: input.proposito,
        canal: input.canal,
        destino: input.destino,
        codigoHash,
        creadoEn: ahora,
        expiraEn,
        ultimoEnvioEn: ahora,
        intentos: 0,
        // consumidoEn NO se incluye acá a propósito (ver el comentario en
        // ItemOtpCrudo) — un OTP recién creado no tiene el atributo, no lo
        // tiene en `null`.
        expiresAt: aEpochSegundos(expiraEn) + MARGEN_LIMPIEZA_TTL_MS / 1000,
      };

      await documentClient.send(
        new PutCommand({
          TableName: nombreTabla,
          Item: item,
          // otpId es un UUID random: esta condición es defensa en profundidad
          // contra una colisión, no un caso esperado.
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );

      return { otpId, codigo, expiraEn };
    },

    async obtener(otpId: string): Promise<RegistroOtp | null> {
      const item = await obtenerCrudo(otpId);
      return item ? aRegistroPublico(item) : null;
    },

    async verificarCodigo(
      otpId: string,
      codigoIngresado: string,
      ahora: string = new Date().toISOString(),
    ): Promise<ResultadoVerificacionOtp> {
      const item = await obtenerCrudo(otpId);
      if (!item) return { ok: false, motivo: "NO_ENCONTRADO" };
      if (item.consumidoEn) return { ok: false, motivo: "YA_UTILIZADO" };
      if (new Date(ahora).getTime() > new Date(item.expiraEn).getTime()) {
        return { ok: false, motivo: "EXPIRADO" };
      }
      if (item.intentos >= INTENTOS_MAXIMOS_OTP) return { ok: false, motivo: "INTENTOS_AGOTADOS" };

      const pepper = await obtenerPepper();
      const coincide = codigoCoincideConHash(codigoIngresado, item.codigoHash, pepper);

      if (!coincide) {
        const intentosActualizados = item.intentos + 1;
        await documentClient.send(
          new UpdateCommand({
            TableName: nombreTabla,
            Key: { pk: item.pk, sk: item.sk },
            UpdateExpression: "SET intentos = :nuevo",
            // Optimista: si otra verificación concurrente ya incrementó
            // `intentos` entre el Get y este Update, este intento se
            // pierde en vez de pisar el conteo — más seguro que sobreescribir
            // a ciegas un límite de intentos.
            ConditionExpression: "intentos = :actual",
            ExpressionAttributeValues: { ":nuevo": intentosActualizados, ":actual": item.intentos },
          }),
        );
        const intentosRestantes = Math.max(0, INTENTOS_MAXIMOS_OTP - intentosActualizados);
        return { ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes };
      }

      await documentClient.send(
        new UpdateCommand({
          TableName: nombreTabla,
          Key: { pk: item.pk, sk: item.sk },
          UpdateExpression: "SET consumidoEn = :ahora",
          // Uso único (regla #1): si ya se consumió entre el Get y este
          // Update (doble submit concurrente con el mismo código), esta
          // segunda escritura falla en vez de aceptar dos verificaciones
          // exitosas del mismo OTP.
          ConditionExpression: "attribute_not_exists(consumidoEn)",
          ExpressionAttributeValues: { ":ahora": ahora },
        }),
      );
      return { ok: true };
    },

    async registrarReenvio(otpId: string, ahora: string = new Date().toISOString()): Promise<ResultadoReenvioOtpRepo> {
      const item = await obtenerCrudo(otpId);
      if (!item) return { ok: false, motivo: "NO_ENCONTRADO" };

      const msDesdeUltimoEnvio = new Date(ahora).getTime() - new Date(item.ultimoEnvioEn).getTime();
      if (msDesdeUltimoEnvio < COOLDOWN_REENVIO_MS) {
        const segundosRestantes = Math.ceil((COOLDOWN_REENVIO_MS - msDesdeUltimoEnvio) / 1000);
        return { ok: false, motivo: "REENVIO_BLOQUEADO", segundosRestantes };
      }

      const nuevoExpiraEn = new Date(new Date(ahora).getTime() + VIGENCIA_OTP_MS).toISOString();
      const codigo = generarCodigoOtp();
      const pepper = await obtenerPepper();
      const codigoHash = hashOtpConPepper(codigo, pepper);

      try {
        await documentClient.send(
          new UpdateCommand({
            TableName: nombreTabla,
            Key: { pk: item.pk, sk: item.sk },
            UpdateExpression:
              "SET codigoHash = :hash, ultimoEnvioEn = :ahora, expiraEn = :expira, intentos = :cero, expiresAt = :ttl",
            // Reafirma el cooldown de forma atómica: si otro reenvío
            // concurrente ya movió `ultimoEnvioEn` entre el Get y este
            // Update, esta escritura falla en vez de rotar el código dos
            // veces.
            ConditionExpression: "ultimoEnvioEn <= :cutoff",
            ExpressionAttributeValues: {
              ":hash": codigoHash,
              ":ahora": ahora,
              ":expira": nuevoExpiraEn,
              ":cero": 0,
              ":ttl": aEpochSegundos(nuevoExpiraEn) + MARGEN_LIMPIEZA_TTL_MS / 1000,
              ":cutoff": new Date(new Date(ahora).getTime() - COOLDOWN_REENVIO_MS).toISOString(),
            },
          }),
        );
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
          return { ok: false, motivo: "REENVIO_BLOQUEADO", segundosRestantes: 1 };
        }
        throw error;
      }

      return { ok: true, codigo, expiraEn: nuevoExpiraEn };
    },
  };
}
