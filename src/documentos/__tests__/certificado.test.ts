/**
 * Tests de la emisión del Certificado de Cobertura Provisional (D-12).
 *
 * Tres cosas que este archivo cuida, y las tres son de cumplimiento:
 *
 * - **Determinismo** — mismo contenido y mismo instante de emisión ⇒ mismos
 *   bytes ⇒ mismo SHA-256. Sin eso el QR de verificación (CMP-06) no
 *   probaría nada: una auditoría tiene que poder reproducir el archivo.
 * - **La huella es la del archivo guardado** — el servicio compara su hash
 *   contra el que devuelve el repositorio y no registra el certificado si
 *   difieren (regla inviolable #4, fila 35).
 * - **El certificado no persiste nada por su cuenta** — devuelve la ficha y
 *   quien la asienta es la transición del pago, en una sola escritura
 *   (CMP-07). Es lo que hace imposible un expediente cobrado sin certificado.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  VERSION_INICIAL_CERTIFICADO,
  codigoCertificado,
  finCoberturaDesde,
  inicioCoberturaDesde,
} from "../../domain/certificado-cobertura";
import { codigoSolicitud } from "../../domain/documentos";
import {
  NUMERO_PROPUESTA_FIJO,
  expedienteEnPagoConfirmado,
  expedienteFirmado,
  pagoConfirmadoFixture,
} from "../../domain/__tests__/fixtures";
import { claveCertificado, emitirCertificadoCobertura } from "../servicio";
import type { RepositorioArchivos } from "../servicio";

const EMITIDO_EN = "2026-08-09T15:04:00.000Z";

/** Archivos en memoria que hashean de verdad, como hace el repositorio de S3. */
function repositorioArchivos(): RepositorioArchivos & { archivos: Map<string, Uint8Array> } {
  const archivos = new Map<string, Uint8Array>();
  return {
    archivos,
    async guardarArchivo(clave, contenido) {
      archivos.set(clave, contenido);
      return { clave, hashSha256: createHash("sha256").update(contenido).digest("hex") };
    },
  };
}

describe("emisión del Certificado de Cobertura Provisional", () => {
  it("cierra el PDF, lo guarda con su versión en la clave y registra su huella real", async () => {
    const archivos = repositorioArchivos();
    const expediente = expedienteEnPagoConfirmado();

    const resultado = await emitirCertificadoCobertura({ archivos }, { expediente, emitidoEn: EMITIDO_EN });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const codigo = codigoCertificado(NUMERO_PROPUESTA_FIJO);
    const clave = claveCertificado(
      expediente.id,
      codigo,
      VERSION_INICIAL_CERTIFICADO,
      resultado.certificado.hashSha256,
    );
    expect(resultado.clave).toBe(clave);
    // La huella forma parte de la ruta: es lo que impide que dos emisiones
    // simultáneas se pisen (ver `claveCertificado`).
    expect(resultado.clave).toContain(resultado.certificado.hashSha256);

    const guardado = archivos.archivos.get(clave);
    expect(guardado).toBeDefined();
    expect(resultado.certificado.hashSha256).toBe(
      createHash("sha256").update(guardado as Uint8Array).digest("hex"),
    );
    // Un PDF de verdad, no un marcador: empieza por su cabecera.
    expect(new TextDecoder().decode((guardado as Uint8Array).slice(0, 5))).toBe("%PDF-");
  });

  it("un correlativo, tres códigos: el certificado cita el paquete del que cuelga", async () => {
    const resultado = await emitirCertificadoCobertura(
      { archivos: repositorioArchivos() },
      { expediente: expedienteEnPagoConfirmado(), emitidoEn: EMITIDO_EN },
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.certificado.codigo).toBe(codigoCertificado(NUMERO_PROPUESTA_FIJO));
    expect(resultado.certificado.codigoPaquete).toBe(codigoSolicitud(NUMERO_PROPUESTA_FIJO));
  });

  it("la vigencia que queda en el expediente es la del cobro, calculada una sola vez", async () => {
    const resultado = await emitirCertificadoCobertura(
      { archivos: repositorioArchivos() },
      { expediente: expedienteEnPagoConfirmado(), emitidoEn: EMITIDO_EN },
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const inicio = inicioCoberturaDesde(pagoConfirmadoFixture.confirmadoEn ?? "");
    expect(resultado.certificado.inicioCobertura).toBe(inicio);
    expect(resultado.certificado.finCobertura).toBe(finCoberturaDesde(inicio));
    expect(resultado.certificado.referenciaBancard).toBe(pagoConfirmadoFixture.referenciaBancard);
  });

  /**
   * D-13 · la firma del CPC sale de `firmantes-documento.ts`, con certificado
   * simulado que **dice que lo es**: una evidencia que afirmara un certificado
   * cualificado real no probaría nada mientras Code100 sea un mock.
   */
  it("queda firmado por Alianza, en modalidad prefirmada y con certificado rotulado como simulado", async () => {
    const resultado = await emitirCertificadoCobertura(
      { archivos: repositorioArchivos() },
      { expediente: expedienteEnPagoConfirmado(), emitidoEn: EMITIDO_EN },
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.certificado.firmas).toHaveLength(1);
    const firma = resultado.certificado.firmas[0];
    expect(firma?.rol).toBe("ALIANZA");
    expect(firma?.nivel).toBe("CUALIFICADA");
    expect(firma?.modalidad).toBe("PREFIRMADO");
    expect(firma?.certificado).toMatch(/^DEMO-CERT-ALIANZA-CPC-/);
  });

  it("es determinista: mismo expediente y mismo instante dan los mismos bytes y el mismo hash", async () => {
    const expediente = expedienteEnPagoConfirmado();
    const primera = repositorioArchivos();
    const segunda = repositorioArchivos();

    const a = await emitirCertificadoCobertura({ archivos: primera }, { expediente, emitidoEn: EMITIDO_EN });
    const b = await emitirCertificadoCobertura({ archivos: segunda }, { expediente, emitidoEn: EMITIDO_EN });

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.certificado.hashSha256).toBe(b.certificado.hashSha256);
    expect([...primera.archivos.values()][0]).toEqual([...segunda.archivos.values()][0]);
  });

  /**
   * La carrera que este diseño existe para hacer imposible: dos sondeos
   * solapados emiten con instantes distintos y los dos escriben en S3. Con una
   * clave que solo dependiera del código y la versión, el que escribiera
   * último dejaría en el bucket un archivo cuya huella no es la que el
   * expediente registró, y la descarga fallaría sobre un expediente sano.
   */
  it("dos emisiones con instantes distintos escriben en claves distintas", async () => {
    const archivos = repositorioArchivos();
    const expediente = expedienteEnPagoConfirmado();

    const a = await emitirCertificadoCobertura({ archivos }, { expediente, emitidoEn: EMITIDO_EN });
    const b = await emitirCertificadoCobertura(
      { archivos },
      { expediente, emitidoEn: "2026-08-09T15:04:01.000Z" },
    );

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.certificado.hashSha256).not.toBe(b.certificado.hashSha256);
    expect(a.clave).not.toBe(b.clave);
    // Los dos archivos conviven, y cada uno es exactamente lo que su huella dice.
    expect(archivos.archivos.size).toBe(2);
    for (const resultado of [a, b]) {
      const guardado = archivos.archivos.get(resultado.clave);
      expect(createHash("sha256").update(guardado as Uint8Array).digest("hex")).toBe(
        resultado.certificado.hashSha256,
      );
    }
  });

  it("si el archivo guardado no coincide con lo renderizado, no se emite certificado", async () => {
    const archivosMentirosos: RepositorioArchivos = {
      async guardarArchivo(clave) {
        return { clave, hashSha256: "f".repeat(64) };
      },
    };

    const resultado = await emitirCertificadoCobertura(
      { archivos: archivosMentirosos },
      { expediente: expedienteEnPagoConfirmado(), emitidoEn: EMITIDO_EN },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("ALMACENAMIENTO_INCONSISTENTE");
  });

  /**
   * El paquete y el certificado comparten correlativo, así que sus tokens solo
   * se separan por el código que entra en la derivación. Si se los compartiera,
   * el QR del certificado abriría la verificación del paquete y diría cosas de
   * otro documento.
   */
  it("el token del certificado es distinto del token del paquete que lo respalda", async () => {
    const expediente = expedienteEnPagoConfirmado();
    const resultado = await emitirCertificadoCobertura(
      { archivos: repositorioArchivos() },
      { expediente, emitidoEn: EMITIDO_EN },
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.certificado.tokenVerificacion).toMatch(
      new RegExp(`^${NUMERO_PROPUESTA_FIJO}-[0-9a-f]{32}$`),
    );
    expect(resultado.certificado.tokenVerificacion).not.toBe(
      expediente.paqueteDocumental?.tokenVerificacion,
    );
  });

  it("sin cobro acreditado no hay certificado, y el motivo dice qué faltó", async () => {
    const resultado = await emitirCertificadoCobertura(
      { archivos: repositorioArchivos() },
      { expediente: expedienteFirmado(), emitidoEn: EMITIDO_EN },
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.motivo).toBe("EXPEDIENTE_INCOMPLETO");
      expect(resultado.faltantes).toContain("pagoConfirmado");
    }
  });
});
