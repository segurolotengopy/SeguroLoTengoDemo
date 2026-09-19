/**
 * Adaptador oficial del intercambio documental con Alianza (ítem 36): conector
 * SFTP de AWS Transfer Family + bandeja de S3.
 *
 * La app nunca abre una sesión SFTP ni ve la credencial. Le pide al conector
 * que mueva archivos entre la bandeja y el servidor de Alianza, y el conector
 * sale por sus IP estáticas (o por la VPN, si se enciende): `infra/alianza-sftp.tf`.
 *
 * APIs usadas, verificadas contra la referencia oficial (15-sep-2026):
 * - `StartFileTransfer` — envío (`SendFilePaths` + `RemoteDirectoryPath`) y
 *   recepción (`RetrieveFilePaths` + `LocalDirectoryPath`), hasta 10 rutas.
 *   https://docs.aws.amazon.com/transfer/latest/APIReference/API_StartFileTransfer.html
 * - `ListFileTransferResults` — estado por archivo: QUEUED, IN_PROGRESS,
 *   COMPLETED, FAILED (con `FailureCode`). Disponible 7 días.
 *   https://docs.aws.amazon.com/transfer/latest/APIReference/API_ListFileTransferResults.html
 * - `StartDirectoryListing` — escribe en S3 un JSON `<connector>-<listing>.json`
 *   con `files[{filePath, modifiedTimestamp, size}]`, `paths` y `truncated`.
 *   https://docs.aws.amazon.com/transfer/latest/APIReference/API_StartDirectoryListing.html
 * - `StartRemoteMove` — mueve en el servidor remoto: de la carpeta de tránsito
 *   a la que vigila el firmador, y lo recibido → `procesados/`. Devuelve un
 *   `MoveId` y **no hay API para consultar su resultado**: se confirma listando.
 *   https://docs.aws.amazon.com/transfer/latest/APIReference/API_StartRemoteMove.html
 *
 * `StartRemoteDelete` existe y **no se usa a propósito**: lo procesado se mueve,
 * no se borra, y el rol de la app ni siquiera tiene el permiso.
 *
 * ## Persistencia: todo en la bandeja, nada que pisar
 *
 * El cómputo de Amplify es serverless: dos sondeos pueden caer en instancias
 * distintas. El estado de cada transferencia vive en la bandeja, escrito con
 * `guardarSiNoExiste` (S3 `If-None-Match`), así que:
 *
 * - el marcador de un intento es la idempotencia: dos pedidos iguales a la vez
 *   escriben la misma clave y solo uno gana;
 * - cada evento es un objeto con clave fija por tipo (`03-PUBLICADA.json`): el
 *   que gana la escritura es el único que ejecuta la acción (renombrar), y
 *   ningún evento se sobrescribe (regla inviolable #10).
 *
 * ## Regla #7
 *
 * Los PDF llevan salud y PEP. Este archivo no loguea nada, y los `detalle` de
 * los eventos llevan solo nombres de error, códigos de falla e identificadores
 * técnicos — nunca el mensaje de una excepción, que podría citar contenido.
 */
import { createHash } from "node:crypto";
import {
  ListFileTransferResultsCommand,
  StartDirectoryListingCommand,
  StartFileTransferCommand,
  StartRemoteMoveCommand,
} from "@aws-sdk/client-transfer";
import type { TransferClient } from "@aws-sdk/client-transfer";
import type {
  ArchivoRemoto,
  DireccionTransferencia,
  EstadoDeTransferencia,
  EventoTransferencia,
  IntercambioAseguradora,
  ResultadoArchivado,
  ResultadoEnvioDocumento,
  ResultadoListado,
  ResultadoPedido,
  ResultadoRecibido,
  SolicitudEnvioDocumento,
  TipoEventoTransferencia,
} from "../../ports/intercambio-aseguradora";
import { estadoSegunEventos } from "../../ports/intercambio-aseguradora";
import type {
  CarpetaRecepcion,
  ConfiguracionIntercambioAseguradora,
} from "../../domain/intercambio-aseguradora";
import {
  carpetaRemotaDeRecepcion,
  construirMetadatoEnviado,
  nombreArchivoRemoto,
  nombreMetadatoRemoto,
  nombreRemotoAceptable,
  validarDocumentoAEnviar,
} from "../../domain/intercambio-aseguradora";
import type { BandejaIntercambio } from "../../repositories/bandeja-intercambio-repository";

export type ClienteTransfer = Pick<TransferClient, "send">;

/** Mismo prefijo que `local.alianza_prefijo_bandeja` en `infra/alianza-sftp.tf`. */
export const PREFIJO_BANDEJA = "alianza";

const ORDEN_EVENTO: Record<TipoEventoTransferencia, string> = {
  SOLICITADA: "01",
  TRANSFERIDA: "02",
  PUBLICADA: "03",
  RECIBIDA: "04",
  ARCHIVADA: "05",
  FALLIDA: "09",
};

interface RegistroTransferencia {
  readonly referencia: string;
  readonly direccion: DireccionTransferencia;
  readonly nombreArchivo: string;
  /** Envío: carpeta final, la que vigila el firmador. Recepción: de dónde se trae. */
  readonly carpetaRemota: string;
  /** Solo en un envío: dónde se sube antes de publicar. Ver `PUBLICACION_POR_MOVIMIENTO`. */
  readonly carpetaTransito?: string;
  /** Envío: huella del PDF. Recepción: null hasta recibir. */
  readonly hashSha256: string | null;
  /** Archivos que mueve la transferencia: en un envío, metadato y PDF. */
  readonly archivos: readonly string[];
}

interface EventoGuardado extends EventoTransferencia {
  /** Datos técnicos que el adaptador necesita y el puerto no expone. */
  readonly datos?: Readonly<Record<string, string>>;
}

interface RegistroListado {
  readonly carpetaRemota: string;
  readonly archivoSalida: string;
}

export interface OpcionesIntercambioSftp {
  readonly cliente: ClienteTransfer;
  readonly bandeja: BandejaIntercambio;
  /** `c-…`, output `alianza_sftp_connector_id` de Terraform. */
  readonly connectorId: string;
  readonly configuracion: ConfiguracionIntercambioAseguradora;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

const JSON_TIPO = "application/json";
const texto = new TextEncoder();
const lector = new TextDecoder();

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Solo el nombre del error: el mensaje puede citar rutas o contenido. */
function nombreDeError(error: unknown): string {
  return error instanceof Error ? error.name : "ERROR_DESCONOCIDO";
}

function json(valor: unknown): Uint8Array {
  return texto.encode(JSON.stringify(valor));
}

function leerJson<T>(bytes: Uint8Array | null): T | null {
  if (!bytes) return null;
  try {
    return JSON.parse(lector.decode(bytes)) as T;
  } catch {
    return null;
  }
}

export function crearIntercambioAseguradoraSftp(opciones: OpcionesIntercambioSftp): IntercambioAseguradora {
  const { cliente, bandeja, connectorId, configuracion } = opciones;
  const { carpetas } = configuracion;
  const ahora = opciones.ahora ?? (() => new Date().toISOString());
  const nuevoId = opciones.nuevoId ?? (() => crypto.randomUUID());

  const claves = {
    intentos: (grupo: string) => `${PREFIJO_BANDEJA}/control/intentos/${grupo}/`,
    registro: (ref: string) => `${PREFIJO_BANDEJA}/control/transferencias/${ref}.json`,
    eventos: (ref: string) => `${PREFIJO_BANDEJA}/control/eventos/${ref}/`,
    listado: (ref: string) => `${PREFIJO_BANDEJA}/control/listados/${ref}.json`,
    salida: (ref: string, nombre: string) => `${PREFIJO_BANDEJA}/salida/${ref}/${nombre}`,
    entradaDir: (ref: string) => `${PREFIJO_BANDEJA}/entrada/${ref}`,
    listadosDir: `${PREFIJO_BANDEJA}/listados`,
  };

  async function leerEventos(ref: string): Promise<EventoGuardado[]> {
    const eventos: EventoGuardado[] = [];
    for (const clave of await bandeja.listarClaves(claves.eventos(ref))) {
      const evento = leerJson<EventoGuardado>(await bandeja.obtener(clave));
      if (evento) eventos.push(evento);
    }
    return eventos;
  }

  /** `true` si este llamador escribió el evento (y por lo tanto le toca actuar). */
  async function registrarEvento(
    ref: string,
    tipo: TipoEventoTransferencia,
    detalle?: string,
    datos?: Record<string, string>,
  ): Promise<boolean> {
    const evento: EventoGuardado = {
      tipo,
      instante: ahora(),
      ...(detalle ? { detalle } : {}),
      ...(datos ? { datos } : {}),
    };
    const clave = `${claves.eventos(ref)}${ORDEN_EVENTO[tipo]}-${tipo}.json`;
    return (await bandeja.guardarSiNoExiste(clave, json(evento), JSON_TIPO)) === "CREADO";
  }

  /**
   * Reserva el siguiente intento de un grupo (una huella, o una entrada de
   * listado). Si el último intento no falló, devuelve ese: es un duplicado.
   */
  async function reservarIntento(
    grupo: string,
    referenciaDe: (numero: number) => string,
  ): Promise<{ readonly referencia: string; readonly duplicado: boolean }> {
    const existentes = await bandeja.listarClaves(claves.intentos(grupo));
    const ultimo = existentes.at(-1);
    if (ultimo) {
      const referencia = leerJson<{ referencia: string }>(await bandeja.obtener(ultimo))?.referencia;
      if (referencia) {
        const eventos = await leerEventos(referencia);
        if (!eventos.some((e) => e.tipo === "FALLIDA")) return { referencia, duplicado: true };
      }
    }
    const numero = existentes.length + 1;
    const referencia = referenciaDe(numero);
    const marcador = `${claves.intentos(grupo)}${String(numero).padStart(4, "0")}.json`;
    if ((await bandeja.guardarSiNoExiste(marcador, json({ referencia }), JSON_TIPO)) === "YA_EXISTIA") {
      // Otro pedido igual ganó la carrera por este mismo número de intento.
      const ganador = leerJson<{ referencia: string }>(await bandeja.obtener(marcador))?.referencia;
      return { referencia: ganador ?? referencia, duplicado: true };
    }
    return { referencia, duplicado: false };
  }

  async function leerRegistro(ref: string): Promise<RegistroTransferencia | null> {
    return leerJson<RegistroTransferencia>(await bandeja.obtener(claves.registro(ref)));
  }

  function vista(registro: RegistroTransferencia, eventos: readonly EventoGuardado[]): EstadoDeTransferencia {
    const recibida = eventos.find((e) => e.tipo === "RECIBIDA");
    return {
      referencia: registro.referencia,
      direccion: registro.direccion,
      estado: estadoSegunEventos(registro.direccion, eventos),
      nombreArchivo: registro.nombreArchivo,
      hashSha256: registro.hashSha256 ?? recibida?.datos?.sha256 ?? null,
      eventos: eventos.map(({ tipo, instante, detalle }) => ({ tipo, instante, ...(detalle ? { detalle } : {}) })),
    };
  }

  /** Lleva la transferencia tan lejos como el proveedor permita hoy. */
  async function avanzar(registro: RegistroTransferencia): Promise<void> {
    const ref = registro.referencia;
    let eventos = await leerEventos(ref);
    if (estadoSegunEventos(registro.direccion, eventos) !== "EN_CURSO") return;

    const transferId = eventos.find((e) => e.tipo === "SOLICITADA")?.datos?.transferId;
    if (!transferId) return; // el pedido todavía se está haciendo en otra instancia

    if (!eventos.some((e) => e.tipo === "TRANSFERIDA")) {
      let resultados;
      try {
        resultados = (
          await cliente.send(new ListFileTransferResultsCommand({ ConnectorId: connectorId, TransferId: transferId }))
        ).FileTransferResults ?? [];
      } catch {
        return; // sin respuesta del proveedor: sigue en curso, el próximo sondeo reintenta
      }
      const fallido = resultados.find((r) => r.StatusCode === "FAILED");
      if (fallido) {
        await registrarEvento(ref, "FALLIDA", fallido.FailureCode ?? "FAILED");
        return;
      }
      const completos = resultados.filter((r) => r.StatusCode === "COMPLETED").length;
      if (completos < registro.archivos.length) return;
      await registrarEvento(ref, "TRANSFERIDA");
      eventos = await leerEventos(ref);
    }

    if (registro.direccion === "ENVIO") {
      // Solo quien escribe PUBLICADA renombra: dos sondeos simultáneos no
      // piden dos veces el mismo movimiento.
      if (!(await registrarEvento(ref, "PUBLICADA"))) return;
      const origen = registro.carpetaTransito ?? registro.carpetaRemota;
      try {
        // El PDF va último: cuando el firmador lo ve, lo que lo acompaña ya está.
        for (const nombre of registro.archivos) {
          await cliente.send(
            new StartRemoteMoveCommand({
              ConnectorId: connectorId,
              SourcePath: `${origen}/${nombre}`,
              TargetPath: `${registro.carpetaRemota}/${nombre}`,
            }),
          );
        }
      } catch (error) {
        await registrarEvento(ref, "FALLIDA", `Transfer: ${nombreDeError(error)} al renombrar`);
      }
      return;
    }

    const bytes = await bandeja.obtener(`${claves.entradaDir(ref)}/${registro.nombreArchivo}`);
    if (!bytes) return; // consistencia eventual de S3: el próximo sondeo lo ve
    const sha256 = sha256Hex(bytes);
    await registrarEvento(ref, "RECIBIDA", `sha256=${sha256}`, { sha256, tamanoBytes: String(bytes.length) });
  }

  async function consultar(ref: string): Promise<EstadoDeTransferencia | null> {
    const registro = await leerRegistro(ref);
    if (!registro) return null;
    await avanzar(registro);
    return vista(registro, await leerEventos(ref));
  }

  return {
    async enviarDocumento(solicitud: SolicitudEnvioDocumento): Promise<ResultadoEnvioDocumento> {
      const invalido = validarDocumentoAEnviar(solicitud);
      if (invalido) return { ok: false, motivo: invalido };
      if (!configuracion.documentosHabilitados.includes(solicitud.tipo)) {
        return { ok: false, motivo: "TIPO_NO_HABILITADO", detalle: `${solicitud.tipo} no está en la lista configurada.` };
      }
      if (sha256Hex(solicitud.bytes) !== solicitud.hashSha256) return { ok: false, motivo: "HUELLA_NO_COINCIDE" };

      const nombreRemoto = nombreArchivoRemoto(solicitud.codigo, solicitud.version);
      const nombreMetadato = nombreMetadatoRemoto(solicitud.codigo, solicitud.version);
      const { referencia, duplicado } = await reservarIntento(
        `envio-${solicitud.tipo}-${solicitud.hashSha256}`,
        (n) => `env-${solicitud.hashSha256.slice(0, 24)}-${n}`,
      );
      if (duplicado) return { ok: true, referencia, duplicado: true, nombreRemoto };

      // El PDF primero en la lista, para que sea el último en moverse: cuando
      // el firmador lo ve, todo lo que lo acompaña ya está publicado.
      const archivos = configuracion.enviarMetadato ? [nombreMetadato, nombreRemoto] : [nombreRemoto];
      const registro: RegistroTransferencia = {
        referencia,
        direccion: "ENVIO",
        nombreArchivo: nombreRemoto,
        carpetaRemota: carpetas.envio,
        carpetaTransito: carpetas.transito,
        hashSha256: solicitud.hashSha256,
        archivos,
      };
      await bandeja.guardarSiNoExiste(claves.registro(referencia), json(registro), JSON_TIPO);

      // Sin sufijo: lo que protege de una lectura a medias es la carpeta de
      // tránsito, que nadie vigila (`PUBLICACION_POR_MOVIMIENTO`).
      const rutas: string[] = [];
      if (configuracion.enviarMetadato) {
        const metadato = construirMetadatoEnviado(solicitud, solicitud.hashSha256, solicitud.bytes.length, ahora());
        const claveMetadato = claves.salida(referencia, nombreMetadato);
        await bandeja.guardarSiNoExiste(claveMetadato, json(metadato), JSON_TIPO);
        rutas.push(bandeja.rutaTransfer(claveMetadato));
      }
      const clavePdf = claves.salida(referencia, nombreRemoto);
      await bandeja.guardarSiNoExiste(clavePdf, solicitud.bytes, "application/pdf");
      rutas.push(bandeja.rutaTransfer(clavePdf));

      try {
        const salida = await cliente.send(
          new StartFileTransferCommand({
            ConnectorId: connectorId,
            SendFilePaths: rutas,
            RemoteDirectoryPath: carpetas.transito,
          }),
        );
        const transferId = salida.TransferId ?? "";
        await registrarEvento(referencia, "SOLICITADA", `transferId=${transferId}`, { transferId });
      } catch (error) {
        const detalle = `Transfer: ${nombreDeError(error)}`;
        await registrarEvento(referencia, "FALLIDA", detalle);
        return { ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE", detalle };
      }
      return { ok: true, referencia, duplicado: false, nombreRemoto };
    },

    async solicitarListado(carpeta: CarpetaRecepcion): Promise<ResultadoPedido> {
      const carpetaRemota = carpetaRemotaDeRecepcion(carpetas, carpeta);
      const referencia = `lst-${nuevoId()}`;
      try {
        const salida = await cliente.send(
          new StartDirectoryListingCommand({
            ConnectorId: connectorId,
            RemoteDirectoryPath: carpetaRemota,
            OutputDirectoryPath: bandeja.rutaTransfer(claves.listadosDir),
          }),
        );
        const registro: RegistroListado = { carpetaRemota, archivoSalida: salida.OutputFileName ?? "" };
        await bandeja.guardarSiNoExiste(claves.listado(referencia), json(registro), JSON_TIPO);
      } catch (error) {
        return { ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE", detalle: `Transfer: ${nombreDeError(error)}` };
      }
      return { ok: true, referencia, duplicado: false };
    },

    async obtenerListado(referencia: string): Promise<ResultadoListado | null> {
      const registro = leerJson<RegistroListado>(await bandeja.obtener(claves.listado(referencia)));
      if (!registro) return null;
      // Si el conector no llega al servidor el archivo nunca aparece: quien
      // consume tiene que poner su propio límite de espera.
      const bytes = await bandeja.obtener(`${claves.listadosDir}/${registro.archivoSalida}`);
      if (!bytes) return { estado: "EN_CURSO" };

      const contenido = leerJson<{
        files?: { filePath?: string; size?: number; modifiedTimestamp?: string }[];
        truncated?: boolean;
      }>(bytes);
      if (!contenido) return { estado: "FALLIDO", detalle: "El listado no es un JSON válido." };

      const archivos: ArchivoRemoto[] = (contenido.files ?? [])
        .map((archivo) => ({
          nombre: (archivo.filePath ?? "").split("/").pop() ?? "",
          tamanoBytes: typeof archivo.size === "number" ? archivo.size : null,
          modificadoEn: archivo.modifiedTimestamp ?? null,
        }))
        // Dato no confiable del servidor remoto: nada de `..`, separadores ni `.tmp`.
        .filter((archivo) => nombreRemotoAceptable(archivo.nombre))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      return { estado: "COMPLETADO", archivos, truncado: contenido.truncated === true };
    },

    async solicitarRecepcion(carpeta: CarpetaRecepcion, archivo: ArchivoRemoto): Promise<ResultadoPedido> {
      if (!nombreRemotoAceptable(archivo.nombre)) return { ok: false, motivo: "NOMBRE_INVALIDO" };
      const carpetaRemota = carpetaRemotaDeRecepcion(carpetas, carpeta);
      const entrada = sha256Hex(
        texto.encode(`${carpetaRemota}|${archivo.nombre}|${archivo.tamanoBytes}|${archivo.modificadoEn}`),
      );
      const { referencia, duplicado } = await reservarIntento(
        `recepcion-${entrada}`,
        (n) => `rec-${entrada.slice(0, 24)}-${n}`,
      );
      if (duplicado) return { ok: true, referencia, duplicado: true };

      const registro: RegistroTransferencia = {
        referencia,
        direccion: "RECEPCION",
        nombreArchivo: archivo.nombre,
        carpetaRemota,
        hashSha256: null,
        archivos: [archivo.nombre],
      };
      await bandeja.guardarSiNoExiste(claves.registro(referencia), json(registro), JSON_TIPO);

      try {
        const salida = await cliente.send(
          new StartFileTransferCommand({
            ConnectorId: connectorId,
            RetrieveFilePaths: [`${carpetaRemota}/${archivo.nombre}`],
            LocalDirectoryPath: bandeja.rutaTransfer(claves.entradaDir(referencia)),
          }),
        );
        const transferId = salida.TransferId ?? "";
        await registrarEvento(referencia, "SOLICITADA", `transferId=${transferId}`, { transferId });
      } catch (error) {
        const detalle = `Transfer: ${nombreDeError(error)}`;
        await registrarEvento(referencia, "FALLIDA", detalle);
        return { ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE", detalle };
      }
      return { ok: true, referencia, duplicado: false };
    },

    async obtenerRecibido(referencia: string): Promise<ResultadoRecibido | null> {
      const estado = await consultar(referencia);
      if (!estado || estado.direccion !== "RECEPCION") return null;
      if (estado.estado === "FALLIDA") return { estado: "FALLIDA", detalle: estado.eventos.at(-1)?.detalle };
      if (estado.estado === "EN_CURSO") return { estado: "EN_CURSO" };

      const bytes = await bandeja.obtener(`${claves.entradaDir(referencia)}/${estado.nombreArchivo}`);
      // La huella quedó asentada al recibir; si el objeto cambió desde entonces,
      // no se entrega como si fuera el mismo.
      if (!bytes || sha256Hex(bytes) !== estado.hashSha256) {
        return { estado: "FALLIDA", detalle: "HUELLA_NO_COINCIDE" };
      }
      return { estado: "COMPLETADA", nombreArchivo: estado.nombreArchivo, bytes, hashSha256: estado.hashSha256 };
    },

    async archivarRecibido(referencia: string): Promise<ResultadoArchivado> {
      const registro = await leerRegistro(referencia);
      if (!registro || registro.direccion !== "RECEPCION") return { ok: false, motivo: "NO_ENCONTRADA" };
      const estado = await consultar(referencia);
      if (!estado || estado.estado !== "COMPLETADA") return { ok: false, motivo: "RECEPCION_NO_COMPLETADA" };
      if (estado.eventos.some((e) => e.tipo === "ARCHIVADA")) return { ok: true };

      try {
        const salida = await cliente.send(
          new StartRemoteMoveCommand({
            ConnectorId: connectorId,
            SourcePath: `${registro.carpetaRemota}/${registro.nombreArchivo}`,
            TargetPath: `${registro.carpetaRemota}/${carpetas.procesados}/${registro.nombreArchivo}`,
          }),
        );
        await registrarEvento(referencia, "ARCHIVADA", `destino=${carpetas.procesados}/`, {
          moveId: salida.MoveId ?? "",
        });
      } catch (error) {
        return { ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE", detalle: `Transfer: ${nombreDeError(error)}` };
      }
      return { ok: true };
    },

    consultarTransferencia: consultar,
  };
}
