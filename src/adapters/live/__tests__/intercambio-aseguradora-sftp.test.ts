/**
 * Adaptador oficial del intercambio con Alianza sobre Transfer Family, contra
 * un doble del conector y del servidor SFTP. Sin red, sin AWS, sin gasto.
 *
 * El doble imita lo que la referencia de la API documenta: las transferencias
 * se piden y terminan después (`ListFileTransferResults`), el listado aparece
 * en S3 como un JSON `<connector>-<listing>.json`, y `StartRemoteMove` mueve en
 * el servidor remoto. "Alianza" firma lo que queda publicado en la carpeta de
 * envío devolviendo el mismo PDF con una revisión incremental.
 */
import {
  ListFileTransferResultsCommand,
  StartDirectoryListingCommand,
  StartFileTransferCommand,
  StartRemoteMoveCommand,
} from "@aws-sdk/client-transfer";
import { describe, expect, it } from "vitest";
import {
  CENTINELA_SENSIBLE,
  pdfDePrueba,
  runIntercambioAseguradoraContractTests,
  solicitudDePrueba,
} from "../../../ports/__tests__/intercambio-aseguradora.contract";
import { CARPETAS_REMOTAS_PROPUESTAS } from "../../../domain/intercambio-aseguradora";
import type { CarpetasRemotas, ConfiguracionIntercambioAseguradora } from "../../../domain/intercambio-aseguradora";
import { crearBandejaIntercambioEnMemoria } from "../../../repositories/bandeja-intercambio-repository";
import { agregarRevisionIncrementalSimulada } from "../../mock/intercambio-aseguradora";
import { crearIntercambioAseguradoraSftp } from "../intercambio-aseguradora-sftp";
import type { ClienteTransfer } from "../intercambio-aseguradora-sftp";

const CONECTOR = "c-0123456789abcdef0";
const CONFIGURACION: ConfiguracionIntercambioAseguradora = {
  documentosHabilitados: ["CPC"],
  carpetas: CARPETAS_REMOTAS_PROPUESTAS,
};

type Bandeja = ReturnType<typeof crearBandejaIntercambioEnMemoria>;

interface ResultadoArchivo {
  FilePath: string;
  StatusCode: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  FailureCode?: string;
}

function basename(ruta: string): string {
  return ruta.split("/").pop() ?? "";
}

function dirname(ruta: string): string {
  return ruta.slice(0, ruta.lastIndexOf("/"));
}

/** Doble del conector SFTP de Transfer Family y del servidor de Alianza. */
function crearConectorSimulado(bandeja: Bandeja, carpetas: CarpetasRemotas) {
  const servidor = new Map<string, { bytes: Uint8Array; modificadoEn: string }>();
  const pendientes: (() => void)[] = [];
  const transferencias = new Map<string, { hecha: boolean; resultados: ResultadoArchivo[] }>();
  const firmados = new Set<string>();
  const comandos: unknown[] = [];
  let secuencia = 0;
  const controles = { errorAlPedir: null as Error | null, codigoDeFalla: null as string | null };

  const instante = () => `2026-09-15T12:${String(secuencia).padStart(2, "0")}:00Z`;

  const cliente = {
    async send(comando: unknown) {
      comandos.push(comando);
      if (controles.errorAlPedir) {
        const error = controles.errorAlPedir;
        controles.errorAlPedir = null;
        throw error;
      }

      if (comando instanceof StartFileTransferCommand) {
        const entrada = comando.input;
        const id = `transfer-${++secuencia}`;
        const rutas = entrada.SendFilePaths ?? entrada.RetrieveFilePaths ?? [];
        const registro = {
          hecha: false,
          resultados: rutas.map((ruta): ResultadoArchivo => ({ FilePath: ruta, StatusCode: "IN_PROGRESS" })),
        };
        transferencias.set(id, registro);
        const falla = controles.codigoDeFalla;
        controles.codigoDeFalla = null;

        pendientes.push(() => {
          registro.hecha = true;
          registro.resultados = rutas.map((ruta): ResultadoArchivo => {
            if (falla) return { FilePath: ruta, StatusCode: "FAILED", FailureCode: falla };
            if (entrada.SendFilePaths) {
              const clave = bandeja.claveDesdeRutaTransfer(ruta);
              const bytes = clave ? bandeja.objetos.get(clave) : undefined;
              if (!bytes) return { FilePath: ruta, StatusCode: "FAILED", FailureCode: "SEND_FILE_NOT_FOUND" };
              servidor.set(`${entrada.RemoteDirectoryPath}/${basename(ruta)}`, { bytes, modificadoEn: instante() });
            } else {
              const archivo = servidor.get(ruta);
              if (!archivo) return { FilePath: ruta, StatusCode: "FAILED", FailureCode: "RETRIEVE_FILE_NOT_FOUND" };
              const destino = bandeja.claveDesdeRutaTransfer(entrada.LocalDirectoryPath ?? "");
              bandeja.escribirDirecto(`${destino}/${basename(ruta)}`, archivo.bytes);
            }
            return { FilePath: ruta, StatusCode: "COMPLETED" };
          });
        });
        return { TransferId: id };
      }

      if (comando instanceof ListFileTransferResultsCommand) {
        return { FileTransferResults: transferencias.get(comando.input.TransferId ?? "")?.resultados ?? [] };
      }

      if (comando instanceof StartDirectoryListingCommand) {
        const entrada = comando.input;
        const id = `listing-${++secuencia}`;
        const archivoSalida = `${entrada.ConnectorId}-${id}.json`;
        pendientes.push(() => {
          const files = [...servidor]
            .filter(([ruta]) => dirname(ruta) === entrada.RemoteDirectoryPath)
            .map(([ruta, archivo]) => ({ filePath: ruta, modifiedTimestamp: archivo.modificadoEn, size: archivo.bytes.length }));
          const destino = bandeja.claveDesdeRutaTransfer(entrada.OutputDirectoryPath ?? "");
          bandeja.escribirDirecto(
            `${destino}/${archivoSalida}`,
            new TextEncoder().encode(JSON.stringify({ files, paths: [], truncated: false })),
          );
        });
        return { ListingId: id, OutputFileName: archivoSalida };
      }

      if (comando instanceof StartRemoteMoveCommand) {
        const { SourcePath = "", TargetPath = "" } = comando.input;
        const archivo = servidor.get(SourcePath);
        if (archivo) {
          servidor.delete(SourcePath);
          servidor.set(TargetPath, archivo);
        }
        return { MoveId: `move-${++secuencia}` };
      }

      throw new Error("comando no simulado");
    },
  } as unknown as ClienteTransfer;

  function resolver(): void {
    // Alianza firma lo que ya quedó publicado (sin .tmp) en su carpeta de entrada.
    for (const [ruta, archivo] of [...servidor]) {
      if (dirname(ruta) !== carpetas.envio || !ruta.endsWith(".pdf") || firmados.has(ruta)) continue;
      firmados.add(ruta);
      servidor.set(`${carpetas.documentosFirmados}/${basename(ruta)}`, {
        bytes: agregarRevisionIncrementalSimulada(archivo.bytes, "Alianza Garantia"),
        modificadoEn: instante(),
      });
    }
    for (const accion of pendientes.splice(0)) accion();
  }

  return { cliente, servidor, comandos, controles, resolver };
}

function montar() {
  const bandeja = crearBandejaIntercambioEnMemoria("slt-demo-intercambio-alianza-prueba");
  const conector = crearConectorSimulado(bandeja, CONFIGURACION.carpetas);
  const proveedor = crearIntercambioAseguradoraSftp({
    cliente: conector.cliente,
    bandeja,
    connectorId: CONECTOR,
    configuracion: CONFIGURACION,
  });
  return { bandeja, conector, proveedor };
}

let actual = montar();

runIntercambioAseguradoraContractTests(
  () => {
    actual = montar();
    return actual.proveedor;
  },
  { resolverPendientes: () => actual.conector.resolver() },
);

describe("intercambio sobre Transfer Family", () => {
  it("sube metadato y PDF como .tmp a la carpeta de envío, y los renombra en ese orden", async () => {
    const { conector, proveedor } = montar();
    const envio = await proveedor.enviarDocumento(solicitudDePrueba());
    if (!envio.ok) throw new Error("envío rechazado");

    const pedido = conector.comandos.find((c) => c instanceof StartFileTransferCommand) as StartFileTransferCommand;
    expect(pedido.input.ConnectorId).toBe(CONECTOR);
    expect(pedido.input.RemoteDirectoryPath).toBe("/entrada/documentos");
    expect(pedido.input.SendFilePaths?.map(basename)).toEqual(["CPC-00018425-v1.json.tmp", "CPC-00018425-v1.pdf.tmp"]);

    conector.resolver();
    expect((await proveedor.consultarTransferencia(envio.referencia))?.estado).toBe("COMPLETADA");

    const movimientos = conector.comandos
      .filter((c): c is StartRemoteMoveCommand => c instanceof StartRemoteMoveCommand)
      .map((c) => [c.input.SourcePath, c.input.TargetPath]);
    expect(movimientos).toEqual([
      ["/entrada/documentos/CPC-00018425-v1.json.tmp", "/entrada/documentos/CPC-00018425-v1.json"],
      ["/entrada/documentos/CPC-00018425-v1.pdf.tmp", "/entrada/documentos/CPC-00018425-v1.pdf"],
    ]);
  });

  it("el metadato lleva huella y tamaño, y nada de la persona", async () => {
    const { conector, proveedor } = montar();
    const solicitud = solicitudDePrueba();
    await proveedor.enviarDocumento(solicitud);
    conector.resolver();

    const metadato = JSON.parse(
      new TextDecoder().decode(conector.servidor.get("/entrada/documentos/CPC-00018425-v1.json.tmp")?.bytes),
    ) as Record<string, unknown>;
    expect(Object.keys(metadato).sort()).toEqual(
      ["archivo", "codigo", "correlativo", "enviadoEn", "formato", "hashSha256", "tamanoBytes", "tipo", "version"],
    );
    expect(metadato.hashSha256).toBe(solicitud.hashSha256);
    expect(metadato.tamanoBytes).toBe(solicitud.bytes.length);
  });

  it("dos pedidos simultáneos con la misma huella mueven el archivo una sola vez", async () => {
    const { conector, proveedor } = montar();
    const solicitud = solicitudDePrueba({ bytes: pdfDePrueba("carrera") });
    const [a, b] = await Promise.all([proveedor.enviarDocumento(solicitud), proveedor.enviarDocumento(solicitud)]);

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.referencia).toBe(b.referencia);
    expect([a.duplicado, b.duplicado].sort()).toEqual([false, true]);
    expect(conector.comandos.filter((c) => c instanceof StartFileTransferCommand)).toHaveLength(1);
  });

  it("un error del SDK se informa por su nombre, sin el mensaje (regla #7)", async () => {
    const { conector, proveedor } = montar();
    const error = new Error(`fallo con ${CENTINELA_SENSIBLE} en el mensaje`);
    error.name = "ServiceUnavailableException";
    conector.controles.errorAlPedir = error;

    const resultado = await proveedor.enviarDocumento(solicitudDePrueba());
    expect(resultado).toEqual({
      ok: false,
      motivo: "PROVEEDOR_NO_DISPONIBLE",
      detalle: "Transfer: ServiceUnavailableException",
    });
  });

  it("una transferencia que el conector da por fallida queda FALLIDA con su código, y se puede reintentar", async () => {
    const { conector, proveedor } = montar();
    conector.controles.codigoDeFalla = "CONNECTION_REFUSED";
    const solicitud = solicitudDePrueba({ bytes: pdfDePrueba("falla-remota") });

    const primero = await proveedor.enviarDocumento(solicitud);
    if (!primero.ok) throw new Error("envío rechazado");
    conector.resolver();
    const estado = await proveedor.consultarTransferencia(primero.referencia);
    expect(estado?.estado).toBe("FALLIDA");
    expect(estado?.eventos.at(-1)).toMatchObject({ tipo: "FALLIDA", detalle: "CONNECTION_REFUSED" });

    const reintento = await proveedor.enviarDocumento(solicitud);
    expect(reintento).toMatchObject({ ok: true, duplicado: false });
    if (!reintento.ok) return;
    expect(reintento.referencia).not.toBe(primero.referencia);
  });

  it("el listado ignora los .tmp y los nombres hostiles que devuelva el servidor", async () => {
    const { conector, proveedor } = montar();
    const ahora = { bytes: new Uint8Array([1]), modificadoEn: "2026-09-15T12:00:00Z" };
    conector.servidor.set("/salida/documentos/CPC-00018425-v1.pdf", ahora);
    conector.servidor.set("/salida/documentos/CPC-00018426-v1.pdf.tmp", ahora);
    conector.servidor.set("/salida/documentos/..", ahora);

    const pedido = await proveedor.solicitarListado("DOCUMENTOS_FIRMADOS");
    if (!pedido.ok) throw new Error("listado no pedido");
    expect(await proveedor.obtenerListado(pedido.referencia)).toEqual({ estado: "EN_CURSO" });
    conector.resolver();
    const listado = await proveedor.obtenerListado(pedido.referencia);
    expect(listado).toMatchObject({ estado: "COMPLETADO", truncado: false });
    if (listado?.estado !== "COMPLETADO") return;
    expect(listado.archivos.map((a) => a.nombre)).toEqual(["CPC-00018425-v1.pdf"]);
  });

  it("no entrega un archivo recibido si en la bandeja ya no coincide con la huella asentada", async () => {
    const { bandeja, conector, proveedor } = montar();
    conector.servidor.set("/salida/documentos/CPC-00018425-v1.pdf", {
      bytes: pdfDePrueba("firmado"),
      modificadoEn: "2026-09-15T12:00:00Z",
    });
    const pedido = await proveedor.solicitarRecepcion("DOCUMENTOS_FIRMADOS", {
      nombre: "CPC-00018425-v1.pdf",
      tamanoBytes: 10,
      modificadoEn: "2026-09-15T12:00:00Z",
    });
    if (!pedido.ok) throw new Error("recepción no pedida");
    conector.resolver();
    expect((await proveedor.obtenerRecibido(pedido.referencia))?.estado).toBe("COMPLETADA");

    const clave = [...bandeja.objetos.keys()].find((k) => k.startsWith(`alianza/entrada/${pedido.referencia}/`));
    bandeja.escribirDirecto(clave ?? "", new Uint8Array([0]));
    expect(await proveedor.obtenerRecibido(pedido.referencia)).toEqual({
      estado: "FALLIDA",
      detalle: "HUELLA_NO_COINCIDE",
    });
  });

  it("la bitácora de control no se reescribe: cada evento es un objeto propio", async () => {
    const { bandeja, conector, proveedor } = montar();
    const envio = await proveedor.enviarDocumento(solicitudDePrueba());
    if (!envio.ok) throw new Error("envío rechazado");
    conector.resolver();
    await proveedor.consultarTransferencia(envio.referencia);
    await proveedor.consultarTransferencia(envio.referencia);

    const eventos = [...bandeja.objetos.keys()].filter((k) => k.startsWith(`alianza/control/eventos/${envio.referencia}/`));
    expect(eventos.map(basename)).toEqual(["01-SOLICITADA.json", "02-TRANSFERIDA.json", "03-PUBLICADA.json"]);
  });
});
