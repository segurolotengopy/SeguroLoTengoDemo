/**
 * Búsqueda por número de propuesta (`docs/CONSOLA_ADMINISTRATIVA.md` §3:
 * *"Número de propuesta / caso: PROP-xxxxx, FIPF-xxxxx, o el número de caso
 * de derivación... la búsqueda debe aceptar cualquiera de los tres
 * formatos"*).
 *
 * Nace del defecto que encontró la revisión de QA del 2026-08-10: la consola
 * solo buscaba contra `numeroCasoDerivacion`, así que un expediente pagado —
 * el caso más común que un operador busca por teléfono — era invisible por su
 * `PROP-`/`FIPF-`. La ruta traduce el prefijo con `correlativoDeCodigo` y el
 * repositorio indexa `numeroPropuesta`; acá se prueba la cadena completa.
 */
import { describe, expect, it } from "vitest";
import { crearExpedienteRepositoryDynamoDb } from "../expediente-repository";
import { crearFakeDynamoDocumentClient } from "./fake-dynamo-document-client";
import { crearExpedienteInicial } from "../../domain/tipos";
import type { CapturaBiometrica, Expediente, Identidad } from "../../domain/tipos";
import { codigoFipf, codigoSolicitud, correlativoDeCodigo } from "../../domain/documentos";

const TABLA = "tabla-de-prueba";

function crearRepositorio() {
  const { documentClient } = crearFakeDynamoDocumentClient();
  return crearExpedienteRepositoryDynamoDb({ documentClient, nombreTabla: TABLA });
}

const CAPTURA: CapturaBiometrica = {
  hashFrenteCedula: "a".repeat(64),
  hashDorsoCedula: "b".repeat(64),
  hashSelfie: "c".repeat(64),
  pruebaDeVidaAprobada: true,
  coincidenciaFacialAprobada: true,
};

const IDENTIDAD: Identidad = {
  numeroCedula: "9323336",
  nombres: "Mónica Mariana",
  apellidos: "Gorena Tapia",
  fechaNacimiento: "1990-04-17",
  sexo: "Femenino",
  nacionalidad: "Paraguaya",
  paisNacimiento: "Paraguay",
  paisResidencia: "Paraguay",
  estadoCivil: "Soltero/a",
  captura: CAPTURA,
};

const CORRELATIVO = "00018425";

function expedienteConPropuesta(id: string): Expediente {
  return {
    ...crearExpedienteInicial({ id, ahora: "2026-08-01T10:00:00.000Z" }),
    identidad: IDENTIDAD,
    numeroPropuesta: CORRELATIVO,
  };
}

describe("búsqueda por número de propuesta (PROP-/FIPF-)", () => {
  it("encuentra el expediente por el correlativo, venga de PROP- o de FIPF-", async () => {
    const repositorio = crearRepositorio();
    await repositorio.crear(expedienteConPropuesta("EXP-PROP"));

    // La traducción que hace la ruta de la consola con los dos prefijos.
    for (const codigo of [codigoSolicitud(CORRELATIVO), codigoFipf(CORRELATIVO)]) {
      const correlativo = correlativoDeCodigo(codigo);
      expect(correlativo).toBe(CORRELATIVO);

      const encontrados = await repositorio.buscarPorNumeroPropuesta(correlativo!);
      expect(encontrados.map((e) => e.id)).toEqual(["EXP-PROP"]);
    }
  });

  it("un correlativo ajeno no devuelve nada", async () => {
    const repositorio = crearRepositorio();
    await repositorio.crear(expedienteConPropuesta("EXP-PROP"));

    expect(await repositorio.buscarPorNumeroPropuesta("00099999")).toEqual([]);
  });

  it("el índice aparece también al guardar, no solo al crear", async () => {
    const repositorio = crearRepositorio();
    // Nace sin propuesta (el correlativo se acuña recién en P7)...
    const inicial = crearExpedienteInicial({ id: "EXP-P7", ahora: "2026-08-01T10:00:00.000Z" });
    await repositorio.crear(inicial);
    expect(await repositorio.buscarPorNumeroPropuesta(CORRELATIVO)).toEqual([]);

    // ...y se vuelve buscable con la escritura que lo agrega.
    await repositorio.guardar({ ...inicial, identidad: IDENTIDAD, numeroPropuesta: CORRELATIVO });
    const encontrados = await repositorio.buscarPorNumeroPropuesta(CORRELATIVO);
    expect(encontrados.map((e) => e.id)).toEqual(["EXP-P7"]);
  });

  it("un valor sin prefijo conocido sigue siendo un número de caso, no una propuesta", () => {
    expect(correlativoDeCodigo("CASO-2026-000042")).toBeNull();
  });
});
