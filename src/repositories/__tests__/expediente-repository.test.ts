import { describe, expect, it } from "vitest";
import { ErrorEscrituraConcurrente } from "../../domain/concurrencia";
import { crearExpedienteInicial } from "../../domain/tipos";
import { crearExpedienteRepositoryDynamoDb } from "../expediente-repository";
import { crearFakeDynamoDocumentClient } from "./fake-dynamo-document-client";

function crearRepo() {
  const { documentClient, tabla } = crearFakeDynamoDocumentClient();
  const repo = crearExpedienteRepositoryDynamoDb({ documentClient, nombreTabla: "tabla-de-test" });
  return { repo, tabla };
}

describe("ExpedienteRepository (DynamoDB, con cliente falso)", () => {
  it("crea y recupera un expediente por id", async () => {
    const { repo } = crearRepo();
    const expediente = crearExpedienteInicial({ id: "EXP-1", ahora: "2026-01-01T00:00:00.000Z" });

    await repo.crear(expediente);
    const recuperado = await repo.obtenerPorId("EXP-1");

    expect(recuperado).toEqual(expediente);
  });

  it("obtenerPorId de un id inexistente devuelve null", async () => {
    const { repo } = crearRepo();
    expect(await repo.obtenerPorId("no-existe")).toBeNull();
  });

  it("crear dos veces el mismo id falla en vez de sobrescribir", async () => {
    const { repo } = crearRepo();
    const expediente = crearExpedienteInicial({ id: "EXP-1", ahora: "2026-01-01T00:00:00.000Z" });

    await repo.crear(expediente);
    await expect(repo.crear(expediente)).rejects.toThrow(/Ya existe un expediente/);
  });

  it("guardar persiste una versión más nueva y no pierde el historial previo", async () => {
    const { repo } = crearRepo();
    const inicial = crearExpedienteInicial({ id: "EXP-1", ahora: "2026-01-01T00:00:00.000Z" });
    await repo.crear(inicial);

    const actualizado = {
      ...inicial,
      estado: "CANAL_WA_VERIFICADO" as const,
      historial: [...inicial.historial, { estado: "CANAL_WA_VERIFICADO" as const, en: "2026-01-01T00:01:00.000Z" }],
      actualizadoEn: "2026-01-01T00:01:00.000Z",
    };
    await repo.guardar(actualizado);

    const recuperado = await repo.obtenerPorId("EXP-1");
    expect(recuperado?.estado).toBe("CANAL_WA_VERIFICADO");
    expect(recuperado?.historial).toHaveLength(2);
  });

  it("guardar con actualizadoEnEsperado falla si otra escritura ya pisó ese valor (bloqueo optimista)", async () => {
    const { repo } = crearRepo();
    const inicial = crearExpedienteInicial({ id: "EXP-1", ahora: "2026-01-01T00:00:00.000Z" });
    await repo.crear(inicial);

    // Escritura concurrente "gana" primero.
    await repo.guardar({ ...inicial, actualizadoEn: "2026-01-01T00:05:00.000Z" });

    // La escritura original, que todavía cree que actualizadoEn es el del alta, pierde.
    // El error es tipado a propósito: los casos de uso lo atajan y lo
    // convierten en respuesta controlada (`src/domain/concurrencia.ts`).
    const perdedora = repo.guardar({ ...inicial, actualizadoEn: "2026-01-01T00:10:00.000Z" }, inicial.actualizadoEn);
    await expect(perdedora).rejects.toBeInstanceOf(ErrorEscrituraConcurrente);
    await expect(
      repo.guardar({ ...inicial, actualizadoEn: "2026-01-01T00:10:00.000Z" }, inicial.actualizadoEn),
    ).rejects.toThrow(/modificado por otra escritura/);
  });
});
