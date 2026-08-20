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
import { PLAZO_PAGO_FIJO, expedienteEnPaqueteGenerado } from "../../domain/__tests__/fixtures";
import { archivarDocumentosFirmados, claveDocumentoFirmado } from "../servicio";

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
    paqueteDocumental: base.paqueteDocumental!,
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

  const transicion = registrarFirmasInstitucionales(delCliente.expediente, PLAZO_PAGO_FIJO);
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
  it("guarda los dos PDF firmados con la huella que quedó registrada", async () => {
    const { expediente, firmas } = await expedienteFirmado();
    const archivos = archivosEnMemoria();

    const resultado = await archivarDocumentosFirmados({ archivos, firmas }, expediente);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    // Los dos archivos, cada uno bajo su clave `-firmado`.
    expect(archivos.guardados.size).toBe(2);
    expect(resultado.claveSolicitud).toContain("-firmado.pdf");
    expect(resultado.claveFipf).toContain("-firmado.pdf");

    // Y el SHA-256 de lo guardado es el que el expediente dice que es.
    const bytes = archivos.guardados.get(resultado.claveSolicitud)!;
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(hash).toBe(expediente.firma!.hashSolicitudFirmada);
  });

  it("no pisa el PDF cerrado: son claves distintas", async () => {
    const { expediente, firmas } = await expedienteFirmado();
    const archivos = archivosEnMemoria();

    await archivarDocumentosFirmados({ archivos, firmas }, expediente);

    const solicitud = expediente.paqueteDocumental!.solicitud;
    const claveFirmada = claveDocumentoFirmado(expediente.id, solicitud.codigo, solicitud.version);
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
    expect(expediente.firma!.hashSolicitudFirmada).not.toBe(
      expediente.paqueteDocumental!.solicitud.hashSha256,
    );
    expect(expediente.firma!.hashFipfFirmado).not.toBe(
      expediente.paqueteDocumental!.fipf.hashSha256,
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
      async descargarDocumentosFirmados() {
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
      async descargarDocumentosFirmados() {
        return {
          solicitud: new TextEncoder().encode("no es el PDF firmado"),
          fipf: new TextEncoder().encode("tampoco"),
        };
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
   * El caso que encontró la auditoría: si el segundo documento no coincide, el
   * primero tampoco se guarda. Si no, `GET /api/p8/documento?firmado=1` podría
   * servir una Solicitud firmada mientras el FIPF nunca llegó a archivarse.
   */
  it("si el FIPF no coincide, la Solicitud tampoco queda guardada", async () => {
    const { expediente, firmas } = await expedienteFirmado();
    const archivos = archivosEnMemoria();
    const reales = await firmas.descargarDocumentosFirmados(expediente.firma!.idCode100);

    const soloElFipfMal: SignatureProvider = {
      async iniciarFirma() {
        throw new Error("no usado");
      },
      async descargarDocumentosFirmados() {
        // La Solicitud es la buena; el FIPF, no.
        return { solicitud: reales!.solicitud, fipf: new TextEncoder().encode("FIPF adulterado") };
      },
      async confirmarResultado() {
        throw new Error("no usado");
      },
    };

    const resultado = await archivarDocumentosFirmados(
      { archivos, firmas: soloElFipfMal },
      expediente,
    );

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("HUELLA_NO_COINCIDE");
    // Lo importante: ni un solo archivo escrito.
    expect(archivos.escrituras).toEqual([]);
    expect(archivos.guardados.size).toBe(0);
  });
});
