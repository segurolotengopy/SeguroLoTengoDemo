/**
 * Búsquedas de la consola administrativa sobre los ítems de índice de la tabla
 * única (`docs/CONSOLA_ADMINISTRATIVA.md` §3, `claves-tabla-unica.ts`).
 *
 * Lo que más importa probar acá no es que encuentre, sino que **no encuentre de
 * más**: el índice por estado guarda una entrada por cada estado por el que
 * pasó el expediente y no borra las viejas, así que sin el filtro contra el
 * expediente real la consola mostraría como `DERIVADO_MANUAL` a expedientes
 * que hoy están en otro estado.
 */
import { describe, expect, it } from "vitest";
import { crearExpedienteRepositoryDynamoDb } from "../expediente-repository";
import { crearFakeDynamoDocumentClient } from "./fake-dynamo-document-client";
import { transicionarExpediente } from "../../domain/expediente";
import { crearExpedienteInicial } from "../../domain/tipos";
import type { CapturaBiometrica, Expediente, Identidad } from "../../domain/tipos";

const TABLA = "tabla-de-prueba";

function crearRepositorio() {
  const { documentClient, tabla } = crearFakeDynamoDocumentClient();
  return {
    repositorio: crearExpedienteRepositoryDynamoDb({ documentClient, nombreTabla: TABLA }),
    tabla,
  };
}

const CAPTURA: CapturaBiometrica = {
  hashFrenteCedula: "a".repeat(64),
  hashDorsoCedula: "b".repeat(64),
  hashSelfie: "c".repeat(64),
  pruebaDeVidaAprobada: true,
  coincidenciaFacialAprobada: true,
};

function identidadDe(numeroCedula: string, nombres = "Mónica Mariana"): Identidad {
  return {
    numeroCedula,
    nombres,
    apellidos: "Gorena Tapia",
    fechaNacimiento: "1990-04-17",
    sexo: "Femenino",
    nacionalidad: "Paraguaya",
    paisNacimiento: "Paraguay",
    estadoCivil: "Soltero/a",
    captura: CAPTURA,
  };
}

function conEstado(base: Expediente, cambios: Partial<Expediente>): Expediente {
  return { ...base, ...cambios };
}

describe("buscarPorCedula", () => {
  it("encuentra los expedientes de esa cédula y no los de otra", async () => {
    const { repositorio } = crearRepositorio();

    const uno = conEstado(crearExpedienteInicial({ id: "EXP-1", ahora: "2026-08-01T10:00:00.000Z" }), {
      identidad: identidadDe("9323336"),
    });
    const otro = conEstado(crearExpedienteInicial({ id: "EXP-2", ahora: "2026-08-02T10:00:00.000Z" }), {
      identidad: identidadDe("5612908", "Carolina Beatriz"),
    });
    await repositorio.crear(uno);
    await repositorio.crear(otro);

    const encontrados = await repositorio.buscarPorCedula("9323336");

    expect(encontrados.map((e) => e.id)).toEqual(["EXP-1"]);
  });

  it("devuelve vacío para una cédula sin expedientes", async () => {
    const { repositorio } = crearRepositorio();
    expect(await repositorio.buscarPorCedula("1111111")).toEqual([]);
  });

  it("no indexa por cédula un expediente que todavía no pasó por P5", async () => {
    const { repositorio, tabla } = crearRepositorio();
    await repositorio.crear(crearExpedienteInicial({ id: "EXP-SIN-CEDULA", ahora: "2026-08-01T10:00:00.000Z" }));

    const indices = [...tabla.values()].filter((item) =>
      String(item.pk).startsWith("INDICE#CEDULA#"),
    );
    expect(indices).toEqual([]);
  });
});

describe("buscarPorNumeroCaso", () => {
  it("encuentra el expediente derivado por su número de caso", async () => {
    const { repositorio } = crearRepositorio();
    const derivado = conEstado(crearExpedienteInicial({ id: "EXP-D", ahora: "2026-08-01T10:00:00.000Z" }), {
      estado: "DERIVADO_MANUAL",
      numeroCasoDerivacion: "CASO-2026-000042",
      identidad: identidadDe("9323336"),
    });
    await repositorio.crear(derivado);

    const encontrados = await repositorio.buscarPorNumeroCaso("CASO-2026-000042");

    expect(encontrados.map((e) => e.id)).toEqual(["EXP-D"]);
    expect(await repositorio.buscarPorNumeroCaso("CASO-2026-999999")).toEqual([]);
  });
});

describe("buscarSucesores", () => {
  it("encuentra el expediente que declara a otro como anterior", async () => {
    const { repositorio } = crearRepositorio();
    await repositorio.crear(crearExpedienteInicial({ id: "EXP-VIEJO", ahora: "2026-08-01T10:00:00.000Z" }));
    await repositorio.crear(
      crearExpedienteInicial({
        id: "EXP-NUEVO",
        ahora: "2026-08-05T10:00:00.000Z",
        expedienteAnteriorId: "EXP-VIEJO",
      }),
    );

    expect((await repositorio.buscarSucesores("EXP-VIEJO")).map((e) => e.id)).toEqual(["EXP-NUEVO"]);
    expect(await repositorio.buscarSucesores("EXP-NUEVO")).toEqual([]);
  });
});

describe("buscarPorEstado", () => {
  it("descarta las entradas viejas del índice cuando el expediente ya cambió de estado", async () => {
    const { repositorio, tabla } = crearRepositorio();

    let expediente = crearExpedienteInicial({ id: "EXP-M", ahora: "2026-08-01T10:00:00.000Z" });
    await repositorio.crear(expediente);

    const paso = transicionarExpediente(expediente, "PLAN_SELECCIONADO", {}, "2026-08-01T11:00:00.000Z");
    if (!paso.ok) throw new Error(paso.error);
    expediente = paso.expediente;
    await repositorio.guardar(expediente);

    // El ítem de índice de INICIADO sigue en la tabla: nadie lo borra. Es la
    // inconsistencia conocida y aceptada del índice por estado.
    const indiceViejo = [...tabla.values()].filter((item) => item.pk === "INDICE#ESTADO#INICIADO");
    expect(indiceViejo).toHaveLength(1);

    // Pero la búsqueda por INICIADO no lo devuelve, porque relee el
    // expediente y su estado actual ya no coincide.
    expect(await repositorio.buscarPorEstado("INICIADO")).toEqual([]);
    expect((await repositorio.buscarPorEstado("PLAN_SELECCIONADO")).map((e) => e.id)).toEqual([
      "EXP-M",
    ]);
  });

  it("filtra por rango de fechas de última actividad", async () => {
    const { repositorio } = crearRepositorio();

    for (const [id, fecha] of [
      ["EXP-JUL", "2026-07-15T10:00:00.000Z"],
      ["EXP-AGO", "2026-08-15T10:00:00.000Z"],
    ] as const) {
      await repositorio.crear(
        conEstado(crearExpedienteInicial({ id, ahora: fecha }), { estado: "DERIVADO_MANUAL" }),
      );
    }

    const deAgosto = await repositorio.buscarPorEstado("DERIVADO_MANUAL", {
      desde: "2026-08-01",
      hasta: "2026-08-31T23:59:59.999Z",
    });

    expect(deAgosto.map((e) => e.id)).toEqual(["EXP-AGO"]);
  });

  it("respeta el límite de resultados", async () => {
    const { repositorio } = crearRepositorio();
    for (let i = 0; i < 5; i += 1) {
      await repositorio.crear(
        conEstado(
          crearExpedienteInicial({ id: `EXP-${i}`, ahora: `2026-08-0${i + 1}T10:00:00.000Z` }),
          { estado: "VENCIDO" },
        ),
      );
    }

    const limitados = await repositorio.buscarPorEstado("VENCIDO", { limite: 2 });

    expect(limitados).toHaveLength(2);
  });
});

describe("los ítems de índice no duplican datos del expediente", () => {
  it("guardan solo el id, nunca la cédula ni el nombre", async () => {
    const { repositorio, tabla } = crearRepositorio();
    await repositorio.crear(
      conEstado(crearExpedienteInicial({ id: "EXP-X", ahora: "2026-08-01T10:00:00.000Z" }), {
        identidad: identidadDe("9323336"),
        numeroCasoDerivacion: "CASO-2026-000042",
      }),
    );

    const indices = [...tabla.values()].filter((item) => item.entityType === "INDICE_EXPEDIENTE");
    expect(indices.length).toBeGreaterThan(0);

    for (const indice of indices) {
      expect(Object.keys(indice).sort()).toEqual(["entityType", "expedienteId", "pk", "sk"]);
      // El valor buscado vive en la clave, no en el cuerpo del ítem.
      expect(JSON.stringify(indice)).not.toContain("Gorena");
    }
  });
});
