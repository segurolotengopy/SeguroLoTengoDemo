/**
 * Bandeja de S3 del intercambio con la aseguradora, contra un cliente de S3
 * falso. Lo que se prueba es la única garantía que el adaptador da por
 * sentada: **ninguna escritura pisa una clave existente**.
 */
import { GetObjectCommand, ListObjectsV2Command, NoSuchKey, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { crearBandejaIntercambioEnMemoria, crearBandejaIntercambioS3 } from "../bandeja-intercambio-repository";

function errorS3(nombre: string, estado: number): Error {
  return Object.assign(new Error(nombre), { name: nombre, $metadata: { httpStatusCode: estado } });
}

function clienteQue(responder: (comando: unknown) => unknown) {
  const comandos: unknown[] = [];
  return {
    comandos,
    s3Client: {
      async send(comando: unknown) {
        comandos.push(comando);
        return responder(comando);
      },
    } as never,
  };
}

describe("crearBandejaIntercambioS3", () => {
  it("escribe con If-None-Match: * y el Content-Type pedido", async () => {
    const { s3Client, comandos } = clienteQue(() => ({}));
    const bandeja = crearBandejaIntercambioS3({ s3Client, nombreBucket: "b" });

    expect(await bandeja.guardarSiNoExiste("alianza/x.json", new Uint8Array([1]), "application/json")).toBe("CREADO");
    const put = comandos[0] as PutObjectCommand;
    expect(put).toBeInstanceOf(PutObjectCommand);
    expect(put.input).toMatchObject({ Bucket: "b", Key: "alianza/x.json", IfNoneMatch: "*", ContentType: "application/json" });
  });

  it.each([
    ["PreconditionFailed", 412],
    ["ConditionalRequestConflict", 409],
  ])("una escritura condicional perdida (%s) es YA_EXISTIA, no un error", async (nombre, estado) => {
    const { s3Client } = clienteQue(() => {
      throw errorS3(nombre, estado);
    });
    const bandeja = crearBandejaIntercambioS3({ s3Client, nombreBucket: "b" });
    expect(await bandeja.guardarSiNoExiste("k", new Uint8Array([1]), "application/json")).toBe("YA_EXISTIA");
  });

  it("cualquier otro error se propaga", async () => {
    const { s3Client } = clienteQue(() => {
      throw errorS3("AccessDenied", 403);
    });
    const bandeja = crearBandejaIntercambioS3({ s3Client, nombreBucket: "b" });
    await expect(bandeja.guardarSiNoExiste("k", new Uint8Array([1]), "x")).rejects.toThrow("AccessDenied");
  });

  it("una clave inexistente se lee como null", async () => {
    const { s3Client } = clienteQue((comando) => {
      if (comando instanceof GetObjectCommand) throw new NoSuchKey({ message: "no", $metadata: {} });
      return {};
    });
    const bandeja = crearBandejaIntercambioS3({ s3Client, nombreBucket: "b" });
    expect(await bandeja.obtener("nada")).toBeNull();
  });

  it("lista todas las páginas, en orden", async () => {
    let pagina = 0;
    const { s3Client } = clienteQue((comando) => {
      if (!(comando instanceof ListObjectsV2Command)) return {};
      pagina += 1;
      return pagina === 1
        ? { Contents: [{ Key: "p/2" }], IsTruncated: true, NextContinuationToken: "t" }
        : { Contents: [{ Key: "p/1" }], IsTruncated: false };
    });
    const bandeja = crearBandejaIntercambioS3({ s3Client, nombreBucket: "b" });
    expect(await bandeja.listarClaves("p/")).toEqual(["p/1", "p/2"]);
  });

  it("traduce entre clave y ruta de Transfer Family, y rechaza rutas de otro bucket", () => {
    const { s3Client } = clienteQue(() => ({}));
    const bandeja = crearBandejaIntercambioS3({ s3Client, nombreBucket: "slt-demo-intercambio-alianza-1a2b" });
    const ruta = bandeja.rutaTransfer("alianza/salida/x.pdf");
    expect(ruta).toBe("/slt-demo-intercambio-alianza-1a2b/alianza/salida/x.pdf");
    expect(bandeja.claveDesdeRutaTransfer(ruta)).toBe("alianza/salida/x.pdf");
    expect(bandeja.claveDesdeRutaTransfer("/otro-bucket/alianza/x.pdf")).toBeNull();
  });
});

describe("crearBandejaIntercambioEnMemoria", () => {
  it("tampoco sobrescribe", async () => {
    const bandeja = crearBandejaIntercambioEnMemoria();
    expect(await bandeja.guardarSiNoExiste("k", new Uint8Array([1]), "x")).toBe("CREADO");
    expect(await bandeja.guardarSiNoExiste("k", new Uint8Array([2]), "x")).toBe("YA_EXISTIA");
    expect(await bandeja.obtener("k")).toEqual(new Uint8Array([1]));
  });
});
