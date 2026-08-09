import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { crearArchivoRepositoryS3 } from "../archivo-repository";
import { crearFakeS3Client } from "./fake-s3-client";

function crearRepo() {
  const { s3Client, bucket } = crearFakeS3Client();
  const repo = crearArchivoRepositoryS3({ s3Client, nombreBucket: "bucket-de-test" });
  return { repo, bucket };
}

describe("ArchivoRepository (S3, con cliente falso)", () => {
  it("guarda un archivo y devuelve su hash SHA-256", async () => {
    const { repo } = crearRepo();
    const contenido = new TextEncoder().encode("contenido de prueba");
    const esperado = createHash("sha256").update(contenido).digest("hex");

    const guardado = await repo.guardarArchivo("expedientes/EXP-1/frente-cedula.jpg", contenido, "image/jpeg");

    expect(guardado.hashSha256).toBe(esperado);
    expect(guardado.clave).toBe("expedientes/EXP-1/frente-cedula.jpg");
  });

  it("obtiene un archivo ya guardado con el mismo contenido", async () => {
    const { repo } = crearRepo();
    const contenido = new TextEncoder().encode("otro contenido");
    await repo.guardarArchivo("clave-1", contenido, "application/pdf");

    const leido = await repo.obtenerArchivo("clave-1");

    expect(leido).toEqual(contenido);
  });

  it("obtener una clave inexistente devuelve null, no lanza", async () => {
    const { repo } = crearRepo();
    expect(await repo.obtenerArchivo("no-existe")).toBeNull();
  });
});
