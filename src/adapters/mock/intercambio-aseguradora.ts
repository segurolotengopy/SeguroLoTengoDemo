/**
 * Adaptador simulado del intercambio documental con la aseguradora (ítem 36).
 *
 * Simula las dos puntas: el conector SFTP de Transfer Family y a **Alianza
 * firmando**. Lo que manda se "transfiere" después de una demora, se publica
 * (deja de ser `.tmp`) y Alianza devuelve en su carpeta de firmados **el mismo
 * PDF con una revisión incremental agregada**. Esa es la propiedad que importa:
 * los bytes enviados quedan intactos como prefijo del archivo devuelto, que es
 * lo que el lote de firma usa para emparejar (`docs/plan/DISENO_FIRMA_EN_LOTE.md`
 * §2). Un mock que devolviera un PDF cualquiera no serviría para probar eso.
 *
 * **La firma es de utilería.** La revisión agregada tiene la forma de un
 * diccionario de firma y ningún valor criptográfico: no hay certificado ni CMS.
 * Si algún día el lote verifica la firma, este documento tiene que fallar esa
 * verificación, y está bien que falle.
 *
 * El estado vive en memoria del proceso (`estado-compartido.ts`), con el mismo
 * límite que el resto de los mocks.
 */
import { createHash, randomUUID } from "node:crypto";
import type {
  ArchivoRemoto,
  EstadoDeTransferencia,
  EventoTransferencia,
  IntercambioAseguradora,
  ResultadoArchivado,
  ResultadoEnvioDocumento,
  ResultadoListado,
  ResultadoPedido,
  ResultadoRecibido,
  SolicitudEnvioDocumento,
  DireccionTransferencia,
  TipoEventoTransferencia,
} from "../../ports/intercambio-aseguradora";
import { estadoSegunEventos } from "../../ports/intercambio-aseguradora";
import type {
  CarpetaRecepcion,
  ConfiguracionIntercambioAseguradora,
} from "../../domain/intercambio-aseguradora";
import {
  SUFIJO_EN_CURSO,
  carpetaRemotaDeRecepcion,
  construirMetadatoEnviado,
  nombreArchivoRemoto,
  nombreRemotoAceptable,
  validarDocumentoAEnviar,
} from "../../domain/intercambio-aseguradora";
import { estadoCompartidoDemo } from "./estado-compartido";

/** Cuánto tarda cada operación simulada (transferir, listar, traer). */
export const DEMORA_INTERCAMBIO_MS = 3_000;

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Agrega al PDF una revisión incremental con un diccionario de firma de
 * utilería. No toca un solo byte del original: solo agrega al final un objeto
 * nuevo, su tabla `xref`, un `trailer` con `/Prev` apuntando a la tabla
 * anterior y un `%%EOF` nuevo, como hace un firmador PAdES incremental.
 */
export function agregarRevisionIncrementalSimulada(original: Uint8Array, firmante: string): Uint8Array {
  const texto = new TextDecoder("latin1").decode(original);
  const previa = [...texto.matchAll(/startxref\s+(\d+)/g)].at(-1)?.[1] ?? "0";
  const objeto = 9_000;
  const nombre = firmante.replace(/[^A-Za-z0-9 ]/g, "");

  const encabezado = `\n% Revision incremental SIMULADA (demo): firma de ${nombre}, sin valor\n`;
  const offsetObjeto = original.length + encabezado.length;
  const cuerpoObjeto =
    `${objeto} 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /ETSI.CAdES.detached ` +
    `/Name (${nombre} SIMULADO) /ByteRange [0 0 0 0] /Contents <00> >>\nendobj\n`;
  const offsetXref = offsetObjeto + cuerpoObjeto.length;
  const cola =
    `xref\n${objeto} 1\n${String(offsetObjeto).padStart(10, "0")} 00000 n \n` +
    `trailer\n<< /Size ${objeto + 1} /Prev ${previa} >>\nstartxref\n${offsetXref}\n%%EOF\n`;

  const agregado = new TextEncoder().encode(encabezado + cuerpoObjeto + cola);
  const resultado = new Uint8Array(original.length + agregado.length);
  resultado.set(original, 0);
  resultado.set(agregado, original.length);
  return resultado;
}

interface Transferencia {
  readonly referencia: string;
  readonly direccion: DireccionTransferencia;
  readonly nombreArchivo: string;
  /** Ruta remota del archivo (envío: destino; recepción: origen). */
  readonly rutaRemota: string;
  readonly carpetaRemota: string;
  readonly solicitadaEn: number;
  readonly bytesEnviados: Uint8Array | null;
  readonly metadato: Uint8Array | null;
  hashSha256: string | null;
  bytesRecibidos: Uint8Array | null;
  readonly eventos: EventoTransferencia[];
}

interface ArchivoEnServidor {
  readonly bytes: Uint8Array;
  readonly modificadoEn: string;
}

interface Almacen {
  readonly transferencias: Map<string, Transferencia>;
  /** Intentos de envío por `<tipo>:<huella>`, en orden. */
  readonly enviosPorHuella: Map<string, string[]>;
  /** Intentos de recepción por entrada de listado, en orden. */
  readonly recepcionesPorEntrada: Map<string, string[]>;
  readonly listados: Map<string, { readonly carpeta: string; readonly solicitadoEn: number }>;
  /** El servidor SFTP de Alianza: ruta absoluta → archivo. */
  readonly servidor: Map<string, ArchivoEnServidor>;
}

function almacen(): Almacen {
  return estadoCompartidoDemo("intercambio-aseguradora", () => ({
    transferencias: new Map(),
    enviosPorHuella: new Map(),
    recepcionesPorEntrada: new Map(),
    listados: new Map(),
    servidor: new Map(),
  }));
}

export function limpiarIntercambioMock(): void {
  const a = almacen();
  a.transferencias.clear();
  a.enviosPorHuella.clear();
  a.recepcionesPorEntrada.clear();
  a.listados.clear();
  a.servidor.clear();
}

export interface OpcionesIntercambioMock {
  readonly configuracion: ConfiguracionIntercambioAseguradora;
  readonly ahora?: () => number;
  readonly demoraMs?: number;
  /** Para tests: el "conector" no está disponible al pedir. */
  readonly fallaForzada?: () => boolean;
}

export function crearIntercambioAseguradoraMock(opciones: OpcionesIntercambioMock): IntercambioAseguradora {
  const { configuracion } = opciones;
  const ahora = opciones.ahora ?? (() => Date.now());
  const demora = opciones.demoraMs ?? DEMORA_INTERCAMBIO_MS;
  const fallaForzada = opciones.fallaForzada ?? (() => false);
  const { carpetas } = configuracion;

  function evento(t: Transferencia, tipo: TipoEventoTransferencia, detalle?: string): void {
    t.eventos.push({ tipo, instante: new Date(ahora()).toISOString(), ...(detalle ? { detalle } : {}) });
  }

  /** Hace avanzar lo que ya cumplió su demora. Se llama al entrar a cada método. */
  function avanzar(): void {
    const { transferencias, servidor } = almacen();
    for (const t of transferencias.values()) {
      if (estadoSegunEventos(t.direccion, t.eventos) !== "EN_CURSO") continue;
      if (ahora() - t.solicitadaEn < demora) continue;

      if (t.direccion === "ENVIO" && t.bytesEnviados && t.metadato) {
        const instante = new Date(ahora()).toISOString();
        const rutaMetadato = `${t.carpetaRemota}/${t.nombreArchivo.replace(/\.pdf$/, ".json")}`;
        evento(t, "TRANSFERIDA");
        // Primero el metadato y después el PDF, igual que el adaptador real.
        servidor.set(rutaMetadato, { bytes: t.metadato, modificadoEn: instante });
        servidor.set(t.rutaRemota, { bytes: t.bytesEnviados, modificadoEn: instante });
        evento(t, "PUBLICADA");
        // Alianza firma y lo deja en su carpeta de firmados.
        servidor.set(`${carpetas.documentosFirmados}/${t.nombreArchivo}`, {
          bytes: agregarRevisionIncrementalSimulada(t.bytesEnviados, "Alianza Garantia"),
          modificadoEn: instante,
        });
        continue;
      }

      if (t.direccion === "RECEPCION") {
        const archivo = servidor.get(t.rutaRemota);
        if (!archivo) {
          evento(t, "FALLIDA", "RETRIEVE_FILE_NOT_FOUND");
          continue;
        }
        evento(t, "TRANSFERIDA");
        t.bytesRecibidos = archivo.bytes;
        t.hashSha256 = sha256Hex(archivo.bytes);
        evento(t, "RECIBIDA", `sha256=${t.hashSha256}`);
      }
    }
  }

  function vista(t: Transferencia): EstadoDeTransferencia {
    return {
      referencia: t.referencia,
      direccion: t.direccion,
      estado: estadoSegunEventos(t.direccion, t.eventos),
      nombreArchivo: t.nombreArchivo,
      hashSha256: t.hashSha256,
      eventos: [...t.eventos],
    };
  }

  /** El último intento de una clave, si no falló; `null` si hay que intentar de nuevo. */
  function intentoVigente(intentos: readonly string[] | undefined): string | null {
    const ultimo = intentos?.at(-1);
    if (!ultimo) return null;
    const t = almacen().transferencias.get(ultimo);
    return t && estadoSegunEventos(t.direccion, t.eventos) !== "FALLIDA" ? ultimo : null;
  }

  return {
    async enviarDocumento(solicitud: SolicitudEnvioDocumento): Promise<ResultadoEnvioDocumento> {
      avanzar();
      const invalido = validarDocumentoAEnviar(solicitud);
      if (invalido) return { ok: false, motivo: invalido };
      if (!configuracion.documentosHabilitados.includes(solicitud.tipo)) {
        return { ok: false, motivo: "TIPO_NO_HABILITADO", detalle: `${solicitud.tipo} no está en la lista configurada.` };
      }
      if (sha256Hex(solicitud.bytes) !== solicitud.hashSha256) return { ok: false, motivo: "HUELLA_NO_COINCIDE" };

      const nombreRemoto = nombreArchivoRemoto(solicitud.codigo, solicitud.version);
      const { transferencias, enviosPorHuella } = almacen();
      const clave = `${solicitud.tipo}:${solicitud.hashSha256}`;
      const vigente = intentoVigente(enviosPorHuella.get(clave));
      if (vigente) return { ok: true, referencia: vigente, duplicado: true, nombreRemoto };

      const intentos = enviosPorHuella.get(clave) ?? [];
      const referencia = `env-${solicitud.hashSha256.slice(0, 24)}-${intentos.length + 1}`;
      enviosPorHuella.set(clave, [...intentos, referencia]);

      const metadato = construirMetadatoEnviado(
        solicitud,
        solicitud.hashSha256,
        solicitud.bytes.length,
        new Date(ahora()).toISOString(),
      );
      const t: Transferencia = {
        referencia,
        direccion: "ENVIO",
        nombreArchivo: nombreRemoto,
        rutaRemota: `${carpetas.envio}/${nombreRemoto}`,
        carpetaRemota: carpetas.envio,
        solicitadaEn: ahora(),
        bytesEnviados: solicitud.bytes,
        metadato: new TextEncoder().encode(JSON.stringify(metadato)),
        hashSha256: solicitud.hashSha256,
        bytesRecibidos: null,
        eventos: [],
      };
      transferencias.set(referencia, t);

      if (fallaForzada()) {
        evento(t, "FALLIDA", "Transfer: ServiceUnavailableException (simulado)");
        return { ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE", detalle: "Conector simulado no disponible." };
      }
      evento(t, "SOLICITADA", `transferId=MOCK-${randomUUID().slice(0, 8)}`);
      return { ok: true, referencia, duplicado: false, nombreRemoto };
    },

    async solicitarListado(carpeta: CarpetaRecepcion): Promise<ResultadoPedido> {
      avanzar();
      if (fallaForzada()) return { ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE" };
      const referencia = `lst-${randomUUID()}`;
      almacen().listados.set(referencia, {
        carpeta: carpetaRemotaDeRecepcion(carpetas, carpeta),
        solicitadoEn: ahora(),
      });
      return { ok: true, referencia, duplicado: false };
    },

    async obtenerListado(referencia: string): Promise<ResultadoListado | null> {
      avanzar();
      const listado = almacen().listados.get(referencia);
      if (!listado) return null;
      if (ahora() - listado.solicitadoEn < demora) return { estado: "EN_CURSO" };

      const archivos: ArchivoRemoto[] = [];
      for (const [ruta, archivo] of almacen().servidor) {
        const corte = ruta.lastIndexOf("/");
        if (ruta.slice(0, corte) !== listado.carpeta) continue;
        const nombre = ruta.slice(corte + 1);
        if (!nombreRemotoAceptable(nombre)) continue;
        archivos.push({ nombre, tamanoBytes: archivo.bytes.length, modificadoEn: archivo.modificadoEn });
      }
      archivos.sort((a, b) => a.nombre.localeCompare(b.nombre));
      return { estado: "COMPLETADO", archivos, truncado: false };
    },

    async solicitarRecepcion(carpeta: CarpetaRecepcion, archivo: ArchivoRemoto): Promise<ResultadoPedido> {
      avanzar();
      if (!nombreRemotoAceptable(archivo.nombre) || archivo.nombre.endsWith(SUFIJO_EN_CURSO)) {
        return { ok: false, motivo: "NOMBRE_INVALIDO" };
      }
      const carpetaRemota = carpetaRemotaDeRecepcion(carpetas, carpeta);
      const { transferencias, recepcionesPorEntrada } = almacen();
      const clave = `${carpetaRemota}|${archivo.nombre}|${archivo.tamanoBytes}|${archivo.modificadoEn}`;
      const vigente = intentoVigente(recepcionesPorEntrada.get(clave));
      if (vigente) return { ok: true, referencia: vigente, duplicado: true };
      if (fallaForzada()) return { ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE" };

      const intentos = recepcionesPorEntrada.get(clave) ?? [];
      const referencia = `rec-${sha256Hex(new TextEncoder().encode(clave)).slice(0, 24)}-${intentos.length + 1}`;
      recepcionesPorEntrada.set(clave, [...intentos, referencia]);
      const t: Transferencia = {
        referencia,
        direccion: "RECEPCION",
        nombreArchivo: archivo.nombre,
        rutaRemota: `${carpetaRemota}/${archivo.nombre}`,
        carpetaRemota,
        solicitadaEn: ahora(),
        bytesEnviados: null,
        metadato: null,
        hashSha256: null,
        bytesRecibidos: null,
        eventos: [],
      };
      transferencias.set(referencia, t);
      evento(t, "SOLICITADA", `transferId=MOCK-${randomUUID().slice(0, 8)}`);
      return { ok: true, referencia, duplicado: false };
    },

    async obtenerRecibido(referencia: string): Promise<ResultadoRecibido | null> {
      avanzar();
      const t = almacen().transferencias.get(referencia);
      if (!t || t.direccion !== "RECEPCION") return null;
      const estado = estadoSegunEventos(t.direccion, t.eventos);
      if (estado === "FALLIDA") return { estado: "FALLIDA", detalle: t.eventos.at(-1)?.detalle };
      if (estado === "EN_CURSO" || !t.bytesRecibidos || !t.hashSha256) return { estado: "EN_CURSO" };
      return { estado: "COMPLETADA", nombreArchivo: t.nombreArchivo, bytes: t.bytesRecibidos, hashSha256: t.hashSha256 };
    },

    async archivarRecibido(referencia: string): Promise<ResultadoArchivado> {
      avanzar();
      const t = almacen().transferencias.get(referencia);
      if (!t || t.direccion !== "RECEPCION") return { ok: false, motivo: "NO_ENCONTRADA" };
      if (estadoSegunEventos(t.direccion, t.eventos) !== "COMPLETADA") {
        return { ok: false, motivo: "RECEPCION_NO_COMPLETADA" };
      }
      if (t.eventos.some((e) => e.tipo === "ARCHIVADA")) return { ok: true };
      if (fallaForzada()) return { ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE" };

      const { servidor } = almacen();
      const archivo = servidor.get(t.rutaRemota);
      if (archivo) {
        servidor.delete(t.rutaRemota);
        servidor.set(`${t.carpetaRemota}/${carpetas.procesados}/${t.nombreArchivo}`, archivo);
      }
      evento(t, "ARCHIVADA", `destino=${carpetas.procesados}/`);
      return { ok: true };
    },

    async consultarTransferencia(referencia: string): Promise<EstadoDeTransferencia | null> {
      avanzar();
      const t = almacen().transferencias.get(referencia);
      return t ? vista(t) : null;
    },
  };
}
