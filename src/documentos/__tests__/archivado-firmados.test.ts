/**
 * Archivado de los PDF firmados que devuelve Code100 (entrada de P9).
 *
 * Es lo que hace que el botón `DESCARGAR` de P9 sirva el documento **firmado**
 * y no el cerrado, y lo que garantiza que el archivo que se descarga es
 * exactamente aquel cuya huella quedó registrada en el expediente (fila 47 de
 * la matriz de cumplimiento).
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  abrirEnlaceDeFirmaMock,
  crearSignatureProviderMock,
  firmarEnCode100Mock,
  limpiarSesionesFirmaMock,
  obtenerCodigoFirmaDemo,
} from "../../adapters/mock/signature-provider";
import { registrarFirmasInstitucionales, transicionarExpediente } from "../../domain/expediente";
import type { Expediente } from "../../domain/tipos";
import type { SignatureProvider } from "../../ports/signature-provider";
import {
  PLAZO_PAGO_FIJO,
  expedienteEnPaqueteGenerado,
  firmasInstitucionalesFixture,
} from "../../domain/__tests__/fixtures";
import { archivarDocumentosFirmados, claveDocumento, claveDocumentoFirmado } from "../servicio";

/** Repositorio de archivos en memoria que cuenta las escrituras. */
function archivosEnMemoria() {
  const guardados = new Map<string, Uint8Array>();
  const escrituras: string[] = [];
  return {
    guardados,
    escrituras,
    async guardarArchivo(clave: string, contenido: Uint8Array) {
      escrituras.push(clave);
      guardados.set(clave, contenido);
      return { clave, hashSha256: createHash("sha256").update(contenido).digest("hex") };
    },
    async obtenerArchivo(clave: string) {
      return guardados.get(clave) ?? null;
    },
  };
}

/** Firma un expediente de verdad contra el mock de Code100. */
async function expedienteFirmado(): Promise<{ expediente: Expediente; firmas: SignatureProvider }> {
  const base = expedienteEnPaqueteGenerado("EXP-ARCHIVADO");
  const firmas = crearSignatureProviderMock({ demoraEnvioEnlaceMs: 0 });

  const iniciada = await firmas.iniciarFirma({
    expedienteId: base.id,
    canal: "WHATSAPP",
    destino: "+595981000456",
    documento: base.paqueteDocumental!,
  });

  await abrirEnlaceDeFirmaMock(iniciada.idCode100, { retenerCodigoParaPanelDemo: true });
  const codigo = (await obtenerCodigoFirmaDemo(iniciada.idCode100))?.codigo ?? "";
  const firmado = await firmarEnCode100Mock(iniciada.idCode100, codigo);
  if (!firmado.ok) throw new Error("no se pudo firmar en el mock");

  const conActo: Expediente = {
    ...base,
    actoDeFirma: {
      idCode100: iniciada.idCode100,
      canal: "WHATSAPP",
      destinoEnmascarado: "+595 ••• ••• 456",
      enlaceEnviadoEn: iniciada.enlaceEnviadoEn,
      venceEn: iniciada.venceEn,
    },
  };
  // D-08 · dos transiciones: el cliente firma y después entran las
  // institucionales, que abren el plazo de pago.
  const delCliente = transicionarExpediente(conActo, "FIRMADO_CLIENTE", { firma: firmado.firma });
  if (!delCliente.ok) throw new Error(delCliente.error);

  const transicion = registrarFirmasInstitucionales(
    delCliente.expediente,
    firmasInstitucionalesFixture,
    PLAZO_PAGO_FIJO,
  );
  if (!transicion.ok) throw new Error(transicion.error);

  return { expediente: transicion.expediente, firmas };
}

beforeEach(() => {
  limpiarSesionesFirmaMock();
});

afterEach(() => {
  limpiarSesionesFirmaMock();
});

describe("archivarDocumentosFirmados", () => {
  it("guarda el PDF firmado con la huella que quedó registrada", async () => {
    const { expediente, firmas } = await expedienteFirmado();
    const archivos = archivosEnMemoria();

    const resultado = await archivarDocumentosFirmados({ archivos, firmas }, expediente);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    // D-11 · un solo archivo, bajo su clave `-firmado`.
    expect(archivos.guardados.size).toBe(1);
    expect(resultado.clave).toContain("-firmado.pdf");

    // Y el SHA-256 de lo guardado es el que el expediente dice que es.
    const bytes = archivos.guardados.get(resultado.clave)!;
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(hash).toBe(expediente.firma!.hashDocumentoFirmado);
  });

  /**
   * D1 · con la firma **interna** no hay proveedor al que pedirle nada: el
   * acto no modifica los bytes, así que el documento firmado **es** el paquete
   * cerrado. Sin esto, en v3 el paquete firmado no se podía descargar nunca y
   * la confirmación se quedaba en «Preparando el archivo firmado…» para
   * siempre (reportado por Andres, 01-sep).
   */
  it("con firma interna archiva el paquete cerrado, verificando su huella", async () => {
    const { expediente, firmas } = await expedienteFirmado();
    const paquete = expediente.paqueteDocumental!;
    const archivos = archivosEnMemoria();

    // El cerrado está guardado y su huella es la que quedó al firmar.
    const cerrado = new TextEncoder().encode("%PDF-1.7 paquete cerrado\n");
    const huella = createHash("sha256").update(cerrado).digest("hex");
    await archivos.guardarArchivo(
      claveDocumento(expediente.id, paquete.codigo, paquete.version),
      cerrado,
    );

    const interno: Expediente = {
      ...expediente,
      firma: { ...expediente.firma!, origen: "INTERNA", hashDocumentoFirmado: huella },
    };

    const resultado = await archivarDocumentosFirmados({ archivos, firmas }, interno);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.clave).toContain("-firmado.pdf");
    expect(archivos.guardados.get(resultado.clave)).toEqual(cerrado);
  });

  it("con firma interna no archiva si el cerrado no coincide con la huella firmada", async () => {
    const { expediente, firmas } = await expedienteFirmado();
    const paquete = expediente.paqueteDocumental!;
    const archivos = archivosEnMemoria();
    await archivos.guardarArchivo(
      claveDocumento(expediente.id, paquete.codigo, paquete.version),
      new TextEncoder().encode("otro contenido"),
    );

    const interno: Expediente = {
      ...expediente,
      firma: { ...expediente.firma!, origen: "INTERNA", hashDocumentoFirmado: "a".repeat(64) },
    };

    const resultado = await archivarDocumentosFirmados({ archivos, firmas }, interno);
    expect(resultado).toMatchObject({ ok: false, motivo: "HUELLA_NO_COINCIDE" });
  });

  it("no pisa el PDF cerrado: son claves distintas", async () => {
    const { expediente, firmas } = await expedienteFirmado();
    const archivos = archivosEnMemoria();

    await archivarDocumentosFirmados({ archivos, firmas }, expediente);

    const documento = expediente.paqueteDocumental!;
    const claveFirmada = claveDocumentoFirmado(expediente.id, documento.codigo, documento.version);
    expect(claveFirmada).not.toContain("-v1.pdf");
    expect([...archivos.guardados.keys()].every((clave) => clave.endsWith("-firmado.pdf"))).toBe(true);
  });

  it("es idempotente: llamarlo de nuevo no vuelve a bajar ni a escribir", async () => {
    const { expediente, firmas } = await expedienteFirmado();
    const archivos = archivosEnMemoria();

    await archivarDocumentosFirmados({ archivos, firmas }, expediente);
    const escriturasTrasLaPrimera = archivos.escrituras.length;
    const segunda = await archivarDocumentosFirmados({ archivos, firmas }, expediente);

    expect(segunda.ok).toBe(true);
    expect(archivos.escrituras.length).toBe(escriturasTrasLaPrimera);
  });

  it("los bytes firmados son distintos de los del PDF cerrado", async () => {
    const { expediente, firmas } = await expedienteFirmado();

    // La huella firmada nunca puede coincidir con la del documento cerrado: si
    // coincidiera, el archivo no tendría ninguna firma incrustada.
    expect(expediente.firma!.hashDocumentoFirmado).not.toBe(
      expediente.paqueteDocumental!.hashSha256,
    );
    expect(firmas).toBeDefined();
  });

  it("sin firma no hay nada que archivar", async () => {
    const archivos = archivosEnMemoria();
    const firmas = crearSignatureProviderMock({ demoraEnvioEnlaceMs: 0 });

    const resultado = await archivarDocumentosFirmados(
      { archivos, firmas },
      expedienteEnPaqueteGenerado("EXP-ARCHIVADO"),
    );

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("SIN_FIRMA");
    expect(archivos.guardados.size).toBe(0);
  });

  it("si el proveedor no tiene los documentos, no se archiva nada a medias", async () => {
    const { expediente } = await expedienteFirmado();
    const archivos = archivosEnMemoria();
    const sinDocumentos: SignatureProvider = {
      async iniciarFirma() {
        throw new Error("no usado");
      },
      async descargarDocumentoFirmado() {
        return null;
      },
      async confirmarResultado() {
        throw new Error("no usado");
      },
    };

    const resultado = await archivarDocumentosFirmados(
      { archivos, firmas: sinDocumentos },
      expediente,
    );

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("PROVEEDOR_SIN_DOCUMENTOS");
    expect(archivos.guardados.size).toBe(0);
  });

  it("rechaza un archivo cuya huella no coincide con la firmada", async () => {
    const { expediente } = await expedienteFirmado();
    const archivos = archivosEnMemoria();
    const adulterado: SignatureProvider = {
      async iniciarFirma() {
        throw new Error("no usado");
      },
      async descargarDocumentoFirmado() {
        return new TextEncoder().encode("no es el PDF firmado");
      },
      async confirmarResultado() {
        throw new Error("no usado");
      },
    };

    const resultado = await archivarDocumentosFirmados({ archivos, firmas: adulterado }, expediente);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("HUELLA_NO_COINCIDE");
  });

  /**
   * El test que había acá —*"si el FIPF no coincide, la Solicitud tampoco
   * queda guardada"*— probaba que el archivado no dejara medio paquete
   * escrito. Con el documento único (D-11) desapareció junto con el segundo
   * archivo: hay uno, y su huella coincide o no se guarda nada. Lo verifica
   * el test de arriba.
   */
});
