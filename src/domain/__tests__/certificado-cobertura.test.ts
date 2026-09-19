/**
 * Tests del Certificado de Cobertura Provisional en su parte de dominio:
 * **cuándo empieza y cuándo termina la cobertura**, y qué dice el documento.
 *
 * La vigencia se lleva la mayor parte del archivo porque es el único dato que
 * este documento aporta y la póliza todavía no. CHG-41 lo fija sin ambigüedad
 * —*inicio = pago + 24 h exactas*— y el criterio de aceptación de L5 pide
 * verificarlo **incluyendo los bordes de mes**, que es donde una
 * implementación por calendario se equivoca sin avisar.
 */
import { describe, expect, it } from "vitest";
import {
  HORAS_HASTA_INICIO_COBERTURA,
  armarContenidoCertificado,
  codigoCertificado,
  finCoberturaDesde,
  formatearInstante,
  inicioCoberturaDesde,
} from "../certificado-cobertura";
import { CONDICIONES_PRODUCTO, camposDefinidos } from "../condiciones-producto";
import { codigoSolicitud } from "../documentos";
import { firmantesDe } from "../firmantes-documento";
import type { Expediente } from "../tipos";
import {
  NUMERO_PROPUESTA_FIJO,
  datosComplementariosFixture,
  expedienteEnPagoConfirmado,
  expedienteFirmado,
  pagoConfirmadoFixture,
} from "./fixtures";

const EMITIDO_EN = "2026-08-09T15:04:00.000Z";

// ---------------------------------------------------------------------------
// Inicio de la cobertura
// ---------------------------------------------------------------------------

describe("inicio de la cobertura · pago + 24 horas exactas (CHG-41)", () => {
  it("son 24 horas y no un día de calendario", () => {
    expect(HORAS_HASTA_INICIO_COBERTURA).toBe(24);
    expect(inicioCoberturaDesde("2026-08-09T15:04:00.000Z")).toBe("2026-08-10T15:04:00.000Z");
  });

  it("conserva los minutos y los segundos del pago", () => {
    expect(inicioCoberturaDesde("2026-08-09T15:04:37.512Z")).toBe("2026-08-10T15:04:37.512Z");
  });

  /**
   * Los bordes que pide el criterio de aceptación de L5. Cada uno es un caso
   * en el que sumar "un día" a la fecha en vez de 24 horas al instante daría
   * una respuesta distinta o directamente inválida (`32 de octubre`).
   */
  it.each([
    ["fin de mes de 31 días", "2026-10-31T23:30:00.000Z", "2026-11-01T23:30:00.000Z"],
    ["fin de mes de 30 días", "2026-11-30T23:59:00.000Z", "2026-12-01T23:59:00.000Z"],
    ["fin de año", "2026-12-31T22:15:00.000Z", "2027-01-01T22:15:00.000Z"],
    ["28 de febrero de un año común", "2026-02-28T10:00:00.000Z", "2026-03-01T10:00:00.000Z"],
    ["28 de febrero de un año bisiesto", "2028-02-28T10:00:00.000Z", "2028-02-29T10:00:00.000Z"],
    ["29 de febrero de un año bisiesto", "2028-02-29T10:00:00.000Z", "2028-03-01T10:00:00.000Z"],
  ])("cruza correctamente %s", (_caso, pago, esperado) => {
    expect(inicioCoberturaDesde(pago)).toBe(esperado);
  });

  it("una fecha inválida no produce una cobertura inventada: falla", () => {
    expect(() => inicioCoberturaDesde("no-es-una-fecha")).toThrow(/inválida/i);
  });
});

// ---------------------------------------------------------------------------
// Fin de la vigencia
// ---------------------------------------------------------------------------

describe("fin de la vigencia · un año calendario", () => {
  it("termina en el aniversario del inicio", () => {
    expect(finCoberturaDesde("2026-08-10T15:04:00.000Z")).toBe("2027-08-10T15:04:00.000Z");
  });

  /**
   * Un año **calendario**, no 365 días: una vigencia que arranca antes del
   * 29 de febrero y lo cruza tiene que terminar en su aniversario, no un día
   * antes.
   */
  it("cruzar un bisiesto no adelanta el vencimiento", () => {
    expect(finCoberturaDesde("2027-06-01T00:00:00.000Z")).toBe("2028-06-01T00:00:00.000Z");
  });

  /**
   * El 29 de febrero es el único día sin aniversario. Se resuelve al 28 y no
   * al 1 de marzo: extender la cobertura un día por encima de lo contratado
   * sería regalar un día de riesgo que nadie cotizó.
   */
  it("una vigencia que arranca el 29 de febrero termina el 28", () => {
    expect(finCoberturaDesde("2028-02-29T10:00:00.000Z")).toBe("2029-02-28T10:00:00.000Z");
  });
});

describe("formato de instante", () => {
  it("se lee como día/mes/año y hora, con la zona dicha", () => {
    expect(formatearInstante("2026-08-10T15:04:00.000Z")).toBe("10/08/2026 15:04 UTC");
  });
});

// ---------------------------------------------------------------------------
// Contenido del documento
// ---------------------------------------------------------------------------

describe("contenido del certificado", () => {
  function contenidoDe(expediente: Expediente = expedienteEnPagoConfirmado()) {
    const resultado = armarContenidoCertificado(expediente, { emitidoEn: EMITIDO_EN });
    if (!resultado.ok) throw new Error(`Faltantes: ${resultado.faltantes.join(",")}`);
    return resultado.contenido;
  }

  it("lleva el correlativo de la propuesta con su propio prefijo, y cita el paquete del que cuelga", () => {
    const contenido = contenidoDe();
    expect(contenido.encabezado.codigo).toBe(codigoCertificado(NUMERO_PROPUESTA_FIJO));
    // Fila 47: el vínculo entre documentos queda impreso, no deducido.
    expect(contenido.encabezado.codigoVinculado).toBe(codigoSolicitud(NUMERO_PROPUESTA_FIJO));
    expect(contenido.correlativo).toBe(NUMERO_PROPUESTA_FIJO);
  });

  it("el QR codifica solo la URL de verificación, sin hash ni datos de la persona", () => {
    const contenido = contenidoDe();
    expect(contenido.encabezado.urlVerificacion).toMatch(
      new RegExp(`/${codigoCertificado(NUMERO_PROPUESTA_FIJO)}$`),
    );
    const identidad = expedienteEnPagoConfirmado().identidad;
    expect(contenido.encabezado.urlVerificacion).not.toContain(identidad?.numeroCedula ?? "@@");
  });

  it("las fechas de vigencia salen del instante del cobro, no del de emisión", () => {
    const contenido = contenidoDe();
    const inicio = inicioCoberturaDesde(pagoConfirmadoFixture.confirmadoEn ?? "");
    expect(contenido.vigencia.map((campo) => campo.valor)).toEqual([
      formatearInstante(pagoConfirmadoFixture.confirmadoEn ?? ""),
      formatearInstante(inicio),
      formatearInstante(finCoberturaDesde(inicio)),
    ]);
  });

  /**
   * D-13 · el CPC lo firma solo Alianza, y prefirmado. El cliente no firma
   * este documento: no incorpora obligaciones nuevas y pedirle una firma más
   * sería fricción sin contenido.
   */
  it("firma solo Alianza, y la lista sale de la configuración de firmantes", () => {
    const contenido = contenidoDe();
    const configurados = firmantesDe("CPC");
    expect(configurados).toHaveLength(1);
    expect(configurados[0]?.rol).toBe("ALIANZA");
    expect(configurados[0]?.modalidad).toBe("PREFIRMADO");
    expect(contenido.firmantes.map((firmante) => firmante.etiqueta)).toEqual(
      configurados.map((firmante) => firmante.rotulo),
    );
  });

  it("dice, en el propio documento, que no es la póliza ni una Nota de Cobertura", () => {
    const contenido = contenidoDe();
    expect(contenido.leyendaNoEsPoliza).toMatch(/no es la póliza/i);
    expect(contenido.leyendaNoEsPoliza).toMatch(/Nota de Cobertura/);
    // Compuerta de producción §8.E.3: el modelo está rotulado como provisional.
    expect(contenido.leyendaProvisional).toMatch(/provisional/i);
  });

  it("no muestra ningún dato de tarjeta: del pago salen medio y referencia (regla #6)", () => {
    const contenido = contenidoDe();
    const serializado = JSON.stringify(contenido.pago);
    expect(serializado).toContain(pagoConfirmadoFixture.referenciaBancard);
    expect(serializado).not.toMatch(/\b\d{13,19}\b/);
    expect(serializado.toLowerCase()).not.toContain("cvv");
  });

  /**
   * Sin cobro acreditado no hay certificado que armar, y no porque una
   * validación lo prohíba: sin el instante del pago no existe el dato del que
   * cuelga toda la vigencia.
   */
  it("un expediente firmado y sin pagar devuelve faltantes en vez de un documento a medias", () => {
    const resultado = armarContenidoCertificado(expedienteFirmado(), { emitidoEn: EMITIDO_EN });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.faltantes).toContain("pagoConfirmado");
  });
});

/**
 * El modelo oficial de Alianza (18-sep-2026,
 * `docs/MODELO_CERTIFICADO_COBERTURA_ALIANZA.docx`) pide campos que el
 * certificado no imprimía. Estos tests cubren los que ya se pueden llenar con
 * lo que el expediente tiene, y la regla que gobierna a los que no: **lo que
 * Alianza todavía no confirmó no se imprime**.
 */
describe("certificado · campos del modelo oficial de Alianza", () => {
  function contenidoDe(expediente: Expediente = expedienteEnPagoConfirmado()) {
    const resultado = armarContenidoCertificado(expediente, { emitidoEn: EMITIDO_EN });
    if (!resultado.ok) throw new Error(`Faltantes: ${resultado.faltantes.join(",")}`);
    return resultado.contenido;
  }

  const etiquetas = (campos: readonly { readonly etiqueta: string }[]) => campos.map((c) => c.etiqueta);

  it("imprime domicilio y localidad, que el modelo pide en el bloque del asegurado", () => {
    const asegurado = contenidoDe().asegurado;
    expect(asegurado).toContainEqual({ etiqueta: "Domicilio", valor: datosComplementariosFixture.domicilio });
    expect(asegurado).toContainEqual({ etiqueta: "Localidad", valor: datosComplementariosFixture.ciudad });
  });

  /**
   * El modelo las pide en dos renglones y el certificado las junta en uno, para
   * no empujar el cierre a otra carilla. Los dos números siguen a la vista, que
   * es lo que la regla #8 obliga a declarar.
   */
  it("imprime las edades de ingreso, que son nuestras y no de Alianza (regla #8)", () => {
    const condiciones = contenidoDe().condiciones;
    expect(condiciones).toContainEqual({ etiqueta: "Edad de ingreso", valor: "18 a 64 años" });
  });

  /**
   * La regla que evita el peor resultado posible: un certificado con ocho
   * casilleros vacíos, que se lee como un documento al que se le perdieron los
   * datos en vez de uno cuyos valores todavía no se acordaron.
   */
  it("omite las ocho condiciones que Alianza todavía no confirmó", () => {
    const pendientes = [
      "Sección / sub-sección",
      "Objeto del seguro",
      "Edad límite",
      "Límite de padecimientos",
      "Plazo máximo del pago",
      "Período de espera",
      "Período de carencia",
      "Deducible",
    ];
    const contenido = contenidoDe();
    const presentes = [...etiquetas(contenido.asegurado), ...etiquetas(contenido.condiciones)];
    for (const pendiente of pendientes) {
      expect(CONDICIONES_PRODUCTO).toBeDefined();
      expect(presentes).not.toContain(pendiente);
    }
  });

  it("ninguna condición viaja con el valor vacío: o tiene contenido o no está", () => {
    for (const campo of contenidoDe().condiciones) {
      expect(campo.valor.trim()).not.toBe("");
    }
  });

  /**
   * `camposDefinidos` es la puerta por la que pasan los pendientes, así que el
   * día que Alianza conteste alcanza con llenar `CONDICIONES_PRODUCTO`: esto
   * prueba que no hace falta tocar nada más.
   */
  it("con un valor confirmado, el campo aparece sin tocar el armado", () => {
    const definidos = camposDefinidos([
      { etiqueta: "Deducible", valor: null },
      { etiqueta: "Período de espera", valor: "30 días" },
      { etiqueta: "Objeto del seguro", valor: "   " },
    ]);
    expect(definidos).toEqual([{ etiqueta: "Período de espera", valor: "30 días" }]);
  });

  it("los herederos legales se llevan el 100 % y no inventan nombre ni cédula", () => {
    const beneficiarios = contenidoDe().beneficiarios;
    expect(beneficiarios).toEqual([{ etiqueta: "Beneficiarios", valor: "Herederos legales — 100 %" }]);
  });

  it("una persona designada lleva nombre, parentesco, cédula y proporción", () => {
    const base = expedienteEnPagoConfirmado();
    const contenido = contenidoDe({
      ...base,
      beneficiario: {
        tipo: "PERSONA_DESIGNADA",
        nombreCompleto: "Ana María Gorena",
        parentesco: "Hija",
        domicilio: "Avda. España 123",
        numeroCedula: "1.234.567",
      },
    });
    expect(contenido.beneficiarios).toEqual([
      { etiqueta: "Nombre", valor: "Ana María Gorena" },
      { etiqueta: "Parentesco", valor: "Hija" },
      { etiqueta: "C.I.", valor: "1.234.567" },
      { etiqueta: "Proporción", valor: "100 %" },
    ]);
  });

  /** La cédula del designado es opcional (CHG-24): sin ella se omite el renglón. */
  it("sin cédula del designado no queda un casillero vacío", () => {
    const base = expedienteEnPagoConfirmado();
    const contenido = contenidoDe({
      ...base,
      beneficiario: {
        tipo: "PERSONA_DESIGNADA",
        nombreCompleto: "Ana María Gorena",
        parentesco: "Hija",
        domicilio: null,
        numeroCedula: null,
      },
    });
    expect(etiquetas(contenido.beneficiarios)).toEqual(["Nombre", "Parentesco", "Proporción"]);
  });

  it("sin beneficiario declarado no se arma el certificado", () => {
    const base = expedienteEnPagoConfirmado();
    const resultado = armarContenidoCertificado({ ...base, beneficiario: null }, { emitidoEn: EMITIDO_EN });
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.faltantes).toContain("beneficiario");
  });
});
