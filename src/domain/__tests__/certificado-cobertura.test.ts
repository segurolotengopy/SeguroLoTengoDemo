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
import { codigoSolicitud } from "../documentos";
import { firmantesDe } from "../firmantes-documento";
import type { Expediente } from "../tipos";
import {
  NUMERO_PROPUESTA_FIJO,
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
