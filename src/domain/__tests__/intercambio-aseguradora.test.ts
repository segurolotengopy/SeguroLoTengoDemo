import { describe, expect, it } from "vitest";
import {
  CARPETAS_REMOTAS_PROPUESTAS,
  leerConfiguracionIntercambio,
  nombreArchivoRemoto,
  nombreRemotoAceptable,
  validarDocumentoAEnviar,
} from "../intercambio-aseguradora";

describe("leerConfiguracionIntercambio", () => {
  /**
   * Qué firma Alianza sigue abierto (P1). Sin configuración explícita no sale
   * ningún documento: el código no decide por nadie.
   */
  it("sin variable no habilita ningún documento", () => {
    expect(leerConfiguracionIntercambio({}).documentosHabilitados).toEqual([]);
  });

  it("lee la lista, normaliza y quita repetidos", () => {
    const configuracion = leerConfiguracionIntercambio({ INTERCAMBIO_ASEGURADORA_DOCUMENTOS: " cpc, PROP ,CPC" });
    expect(configuracion.documentosHabilitados).toEqual(["CPC", "PROP"]);
  });

  it("un tipo desconocido tira en vez de ignorarse en silencio", () => {
    expect(() => leerConfiguracionIntercambio({ INTERCAMBIO_ASEGURADORA_DOCUMENTOS: "CPC,CPX" })).toThrow(/CPX/);
  });

  it("usa las carpetas propuestas y acepta las que confirme Alianza", () => {
    expect(leerConfiguracionIntercambio({}).carpetas).toEqual(CARPETAS_REMOTAS_PROPUESTAS);
    const carpetas = leerConfiguracionIntercambio({
      ALIANZA_SFTP_CARPETA_ENVIO: "in/firma/",
      ALIANZA_SFTP_CARPETA_FIRMADOS: "/out/cpc",
    }).carpetas;
    expect(carpetas.envio).toBe("/in/firma");
    expect(carpetas.documentosFirmados).toBe("/out/cpc");
    expect(carpetas.respuestas).toBe(CARPETAS_REMOTAS_PROPUESTAS.respuestas);
  });
});

describe("validarDocumentoAEnviar", () => {
  const base = { tipo: "CPC" as const, codigo: "CPC-00018425", correlativo: "00018425", version: 1 };

  it("acepta un documento coherente", () => {
    expect(validarDocumentoAEnviar(base)).toBeNull();
  });

  it("rechaza un código que no es del tipo, o que trae otra cosa que el correlativo", () => {
    expect(validarDocumentoAEnviar({ ...base, codigo: "PROP-00018425" })).toBe("CODIGO_NO_CORRESPONDE_AL_TIPO");
    expect(validarDocumentoAEnviar({ ...base, codigo: "CPC-Gorena-Tapia" })).toBe("CODIGO_NO_CORRESPONDE_AL_TIPO");
    expect(validarDocumentoAEnviar({ ...base, correlativo: "00018426" })).toBe("CORRELATIVO_NO_CORRESPONDE");
  });

  it("rechaza versiones que no son enteros positivos", () => {
    expect(validarDocumentoAEnviar({ ...base, version: 0 })).toBe("VERSION_INVALIDA");
    expect(validarDocumentoAEnviar({ ...base, version: 1.5 })).toBe("VERSION_INVALIDA");
  });
});

describe("nombres remotos", () => {
  it("el nombre del PDF sale del código y la versión, y nada más", () => {
    expect(nombreArchivoRemoto("CPC-00018425", 2)).toBe("CPC-00018425-v2.pdf");
  });

  it.each(["../x.pdf", "a/b.pdf", "x.pdf.tmp", ".oculto", "", "con espacio.pdf"])(
    "no acepta %j como nombre que llega del servidor",
    (nombre) => {
      expect(nombreRemotoAceptable(nombre)).toBe(false);
    },
  );

  it("acepta un nombre de archivo común", () => {
    expect(nombreRemotoAceptable("CPC-00018425-v1_firmado.pdf")).toBe(true);
  });
});
