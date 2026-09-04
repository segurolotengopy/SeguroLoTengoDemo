/**
 * Tests de la verificación pública de documentos (CMP-06).
 *
 * Dos cosas se cuidan acá por encima de todo, y ninguna es de maquetado:
 *
 * - **No sale ni un dato de la persona.** La página es pública y el código va
 *   impreso en un PDF que se reenvía, así que cualquiera que lo tenga la abre.
 *   Hay un barrido que serializa la proyección entera y busca la cédula, el
 *   nombre, los canales y el importe (regla inviolable #7).
 * - **La huella que se publica es la del archivo que la persona tiene.** Para
 *   el paquete eso significa la del firmado en cuanto existe: comparar contra
 *   la del cerrado daría "no coincide" sobre un documento legítimo.
 */
import { describe, expect, it } from "vitest";
import { interpretarCodigo, verificarDocumento } from "../verificacion-documento";
import { codigoCertificado } from "../certificado-cobertura";
import { codigoComprobante } from "../comprobante-pago";
import { codigoConstancia, codigoFipf, codigoSolicitud } from "../documentos";
import { firmantesDe } from "../firmantes-documento";
import type { Expediente } from "../tipos";
import {
  NUMERO_PROPUESTA_FIJO,
  certificadoFixture,
  expedienteEnPagoConfirmado,
  expedienteEnPaqueteGenerado,
  expedienteFirmado,
  constanciaFixture,
  firmaFixture,
} from "./fixtures";

const CORRELATIVO = NUMERO_PROPUESTA_FIJO;

// ---------------------------------------------------------------------------
// Interpretación del código
// ---------------------------------------------------------------------------

describe("interpretación del código", () => {
  it.each([
    [codigoSolicitud(CORRELATIVO), "PAQUETE"],
    [codigoFipf(CORRELATIVO), "SECCION_FIPF"],
    [codigoCertificado(CORRELATIVO), "CERTIFICADO"],
    [codigoComprobante(CORRELATIVO), "COMPROBANTE"],
    [codigoConstancia(CORRELATIVO), "CONSTANCIA"],
  ])("reconoce %s", (codigo, tipo) => {
    expect(interpretarCodigo(codigo)).toEqual({ tipo, correlativo: CORRELATIVO, codigo });
  });

  /**
   * El código se tipea desde un papel: mayúsculas y espacios sobrantes son lo
   * normal, no un error de quien consulta.
   */
  it("tolera minúsculas y espacios", () => {
    expect(interpretarCodigo(`  cpc-${CORRELATIVO}  `)?.codigo).toBe(codigoCertificado(CORRELATIVO));
  });

  it.each([
    ["sin prefijo", CORRELATIVO],
    ["prefijo desconocido", `XXX-${CORRELATIVO}`],
    ["correlativo corto", "PROP-1234"],
    ["correlativo no numérico", "PROP-ABCDEFGH"],
    ["vacío", ""],
  ])("rechaza %s", (_caso, entrada) => {
    expect(interpretarCodigo(entrada)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Certificado
// ---------------------------------------------------------------------------

describe("verificación del certificado", () => {
  function verificar(expediente: Expediente = expedienteEnPagoConfirmado()) {
    const interpretado = interpretarCodigo(codigoCertificado(CORRELATIVO));
    if (!interpretado) throw new Error("código no interpretado");
    return verificarDocumento(expediente, interpretado);
  }

  it("publica su huella, su versión y el paquete del que cuelga", () => {
    const resultado = verificar();
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.documento.codigo).toBe(certificadoFixture.codigo);
    expect(resultado.documento.hashSha256).toBe(certificadoFixture.hashSha256);
    expect(resultado.documento.version).toBe(certificadoFixture.version);
    expect(resultado.documento.codigoVinculado).toBe(codigoSolicitud(CORRELATIVO));
  });

  it("publica la vigencia que el certificado declara", () => {
    const resultado = verificar();
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.documento.vigencia).not.toBeNull();
    // Formateadas y en UTC, como las imprime el PDF.
    expect(resultado.documento.vigencia?.inicio).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} UTC$/);
  });

  it("declara a Alianza como única firmante, prefirmada (D-13)", () => {
    const resultado = verificar();
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.documento.firmantes.map((firmante) => firmante.rol)).toEqual(
      firmantesDe("CPC").map((firmante) => firmante.rol),
    );
    expect(resultado.documento.firmantes[0]?.modalidad).toBe("PREFIRMADO");
    expect(resultado.documento.firmantes[0]?.aplicadaEn).not.toBeNull();
  });

  /**
   * Un expediente que cobró antes de D-12 no tiene certificado. El código
   * `CPC-…` de ese correlativo no corresponde a ningún documento emitido, así
   * que la respuesta es la misma que para un código inventado.
   */
  it("un expediente sin certificado responde NO_ENCONTRADO", () => {
    const legado: Expediente = { ...expedienteEnPagoConfirmado(), certificadoCobertura: null };
    const resultado = verificar(legado);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("NO_ENCONTRADO");
  });
});

// ---------------------------------------------------------------------------
// Paquete
// ---------------------------------------------------------------------------

describe("verificación del paquete", () => {
  function verificar(expediente: Expediente, codigo: string) {
    const interpretado = interpretarCodigo(codigo);
    if (!interpretado) throw new Error("código no interpretado");
    return verificarDocumento(expediente, interpretado);
  }

  /**
   * La huella que se publica es la del archivo **que la persona descargó**.
   * Después de firmar, ese archivo es el firmado; publicar la del cerrado haría
   * que el comparador diera "no coincide" sobre un documento legítimo.
   */
  it("después de firmar publica la huella del PDF firmado", () => {
    const resultado = verificar(expedienteFirmado(), codigoSolicitud(CORRELATIVO));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.documento.hashSha256).toBe(firmaFixture.hashDocumentoFirmado);
  });

  it("antes de firmar publica la huella del cerrado", () => {
    const expediente = expedienteEnPaqueteGenerado();
    const resultado = verificar(expediente, codigoSolicitud(CORRELATIVO));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.documento.hashSha256).toBe(expediente.paqueteDocumental?.hashSha256);
    // Y las firmas figuran como todavía no aplicadas, en vez de inventarse.
    expect(resultado.documento.firmantes.every((firmante) => firmante.aplicadaEn === null)).toBe(true);
  });

  /**
   * D-11 · los dos códigos apuntan al mismo archivo. Preguntar por el FIPF
   * tiene que responder con el documento único, no con un "no encontrado" que
   * haría dudar de un código impreso en el propio PDF.
   */
  it("el código de la sección FIPF responde con el documento único", () => {
    const resultado = verificar(expedienteFirmado(), codigoFipf(CORRELATIVO));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.documento.codigo).toBe(codigoSolicitud(CORRELATIVO));
    expect(resultado.documento.codigoVinculado).toBe(codigoSolicitud(CORRELATIVO));
  });

  it("un correlativo que no existe responde NO_ENCONTRADO", () => {
    const interpretado = interpretarCodigo("PROP-99999999");
    if (!interpretado) throw new Error("código no interpretado");
    const resultado = verificarDocumento(null, interpretado);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("NO_ENCONTRADO");
  });

  /**
   * Defensa contra una confusión de correlativos: aunque el repositorio
   * devuelva un expediente, si su número no es el pedido no se publica nada.
   */
  it("un expediente con otro correlativo no verifica", () => {
    const otro: Expediente = { ...expedienteFirmado(), numeroPropuesta: "11112222" };
    const resultado = verificar(otro, codigoSolicitud(CORRELATIVO));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("NO_ENCONTRADO");
  });
});

// ---------------------------------------------------------------------------
// Comprobante y privacidad
// ---------------------------------------------------------------------------

describe("comprobante de pago", () => {
  /**
   * No se verifica, y la respuesta lo dice con su propio motivo: un
   * `NO_ENCONTRADO` haría pensar que el comprobante es falso.
   */
  it("responde con su propio motivo, sin tocar el expediente", () => {
    const interpretado = interpretarCodigo(codigoComprobante(CORRELATIVO));
    if (!interpretado) throw new Error("código no interpretado");
    const resultado = verificarDocumento(expedienteEnPagoConfirmado(), interpretado);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("COMPROBANTE_SIN_VERIFICACION");
  });
});

describe("privacidad de la página pública (regla inviolable #7)", () => {
  it.each([
    ["certificado", codigoCertificado(CORRELATIVO)],
    ["paquete", codigoSolicitud(CORRELATIVO)],
  ])("la proyección del %s no lleva ningún dato de la persona", (_caso, codigo) => {
    const expediente = expedienteEnPagoConfirmado();
    const interpretado = interpretarCodigo(codigo);
    if (!interpretado) throw new Error("código no interpretado");
    const resultado = verificarDocumento(expediente, interpretado);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const serializado = JSON.stringify(resultado.documento).toLowerCase();
    const identidad = expediente.identidad;
    for (const dato of [
      identidad?.numeroCedula,
      identidad?.nombres,
      identidad?.apellidos,
      expediente.canalWhatsapp?.valor,
      expediente.canalEmail?.valor,
      expediente.pago?.referenciaBancard,
    ]) {
      if (dato) expect(serializado).not.toContain(dato.toLowerCase());
    }
    // Tampoco el importe ni el plan: no hacen falta para verificar nada.
    expect(serializado).not.toContain(String(expediente.pago?.montoGs ?? "@@"));
    expect(serializado).not.toContain("confio");
  });
});

// ---------------------------------------------------------------------------
// La firma del proponente y su constancia (D-27)
// ---------------------------------------------------------------------------

describe("la firma del proponente en la verificación (D-27)", () => {
  function conFirmaInterna(): Expediente {
    return {
      ...expedienteFirmado(),
      firma: { ...firmaFixture, origen: "INTERNA", referenciaActo: "OTP-FIRMA-1" },
      constanciaFirma: constanciaFixture,
    };
  }
  function verificar(expediente: Expediente, codigo: string) {
    const interpretado = interpretarCodigo(codigo);
    if (!interpretado) throw new Error("código no interpretado");
    return verificarDocumento(expediente, interpretado);
  }

  it("sobre una firma de proveedor no hay bloque del proponente", () => {
    const resultado = verificar(expedienteFirmado(), codigoSolicitud(CORRELATIVO));
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.documento.firmaDelProponente).toBeNull();
  });

  it("sobre la firma interna publica la norma, los respaldos y la huella de la constancia", () => {
    const resultado = verificar(conFirmaInterna(), codigoSolicitud(CORRELATIVO));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const firma = resultado.documento.firmaDelProponente;
    expect(firma).not.toBeNull();
    expect(firma?.norma).toContain("210/2025");
    expect(firma?.respaldos.length).toBeGreaterThanOrEqual(4);
    expect(firma?.constancia).toEqual({
      codigo: constanciaFixture.codigo,
      version: constanciaFixture.version,
      hashSha256: constanciaFixture.hashSha256,
    });
  });

  it("no publica ningún dato personal del titular (regla #7)", () => {
    const expediente = conFirmaInterna();
    const resultado = verificar(expediente, codigoSolicitud(CORRELATIVO));
    const serializado = JSON.stringify(resultado);
    const identidad = expediente.identidad!;
    for (const privado of [identidad.numeroCedula, identidad.apellidos, "200.", "Mozilla"]) {
      expect(serializado).not.toContain(privado);
    }
  });

  it("la constancia se verifica por su propio código, vinculada al paquete", () => {
    const resultado = verificar(conFirmaInterna(), codigoConstancia(CORRELATIVO));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.documento.codigo).toBe(constanciaFixture.codigo);
    expect(resultado.documento.hashSha256).toBe(constanciaFixture.hashSha256);
    expect(resultado.documento.codigoVinculado).toBe(codigoSolicitud(CORRELATIVO));
    expect(resultado.documento.firmantes).toEqual([]);
    expect(resultado.documento.firmaDelProponente?.constancia?.codigo).toBe(constanciaFixture.codigo);
  });

  it("un expediente sin constancia responde NO_ENCONTRADO a su código", () => {
    const sinConstancia: Expediente = { ...conFirmaInterna(), constanciaFirma: null };
    const resultado = verificar(sinConstancia, codigoConstancia(CORRELATIVO));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("NO_ENCONTRADO");
  });
});
