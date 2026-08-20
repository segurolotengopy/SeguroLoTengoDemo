import { describe, expect, it } from "vitest";
import type { EstadoExpediente } from "../tipos";
import { calcularEdadDesde, edadEnRangoPermitido } from "../tipos";
import {
  esEstadoTerminal,
  esTransicionLegal,
  registrarDeclaracionesP6,
  registrarPagoConfirmadoP7,
  transicionarExpediente,
  transicionesLegalesDesde,
} from "../expediente";
import {
  avanzarHastaIdentidadVerificada,
  certificadoFixture,
  crearExpediente,
  beneficiarioFixture,
  declaracionesCompatibles,
  expedienteFirmado,
  pagoConfirmadoFixture,
  NUMERO_CASO_FIJO,
} from "./fixtures";

const TODOS_LOS_ESTADOS: EstadoExpediente[] = [
  "INICIADO",
  "CANAL_WA_VERIFICADO",
  "PLAN_SELECCIONADO",
  "AUTORIZADO",
  "CANAL_EMAIL_VERIFICADO",
  "IDENTIDAD_VERIFICADA",
  "DERIVADO_MANUAL",
  "DECLARACIONES_OK",
  "PAGO_CONFIRMADO",
  "PAQUETE_GENERADO",
  "VENCIDO",
  "DEVOLUCION_EN_TRAMITE",
  "FIRMADO",
  "EMITIDO",
];

describe("transicionarExpediente", () => {
  it("aplica una transición legal y agrega una entrada al historial", () => {
    const expediente = crearExpediente();

    const resultado = transicionarExpediente(expediente, "PLAN_SELECCIONADO", {}, "2026-01-01T10:05:00.000Z");

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.expediente.estado).toBe("PLAN_SELECCIONADO");
    expect(resultado.expediente.historial).toHaveLength(2);
    expect(resultado.expediente.historial[1]).toEqual({
      estado: "PLAN_SELECCIONADO",
      en: "2026-01-01T10:05:00.000Z",
    });
  });

  it("no muta el expediente original", () => {
    const expediente = crearExpediente();

    transicionarExpediente(expediente, "PLAN_SELECCIONADO");

    expect(expediente.estado).toBe("INICIADO");
    expect(expediente.historial).toHaveLength(1);
  });

  it("rechaza una transición que se salta pasos", () => {
    const expediente = crearExpediente();

    const resultado = transicionarExpediente(expediente, "PAGO_CONFIRMADO");

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("INICIADO");
    expect(resultado.error).toContain("PAGO_CONFIRMADO");
  });

  it("recorre el camino feliz completo hasta EMITIDO", () => {
    let expediente = avanzarHastaIdentidadVerificada(crearExpediente());

    const declaraciones = registrarDeclaracionesP6(
      expediente,
      declaracionesCompatibles,
      beneficiarioFixture,
          NUMERO_CASO_FIJO,
    );
    expect(declaraciones.ok).toBe(true);
    if (!declaraciones.ok) return;
    expediente = declaraciones.expediente;
    expect(expediente.estado).toBe("DECLARACIONES_OK");

    // D-08 · se cierra el paquete, se firma y recién ahí se cobra.
    const feliz = [
      "PAQUETE_GENERADO",
      "FIRMADO_CLIENTE",
      "FIRMADO",
      "PAGO_CONFIRMADO",
      "EMITIDO",
    ] as const;
    for (const siguiente of feliz) {
      const paso = transicionarExpediente(expediente, siguiente);
      expect(paso.ok).toBe(true);
      if (!paso.ok) return;
      expediente = paso.expediente;
    }

    expect(expediente.estado).toBe("EMITIDO");
    expect(esEstadoTerminal(expediente.estado)).toBe(true);
  });

  it("recorre la rama de vencimiento: se firma, no se paga y caduca sin devolución", () => {
    let expediente = avanzarHastaIdentidadVerificada(crearExpediente());
    const declaraciones = registrarDeclaracionesP6(
      expediente,
      declaracionesCompatibles,
      beneficiarioFixture,
          NUMERO_CASO_FIJO,
    );
    if (!declaraciones.ok) throw new Error(declaraciones.error);
    expediente = declaraciones.expediente;

    const rama = ["PAQUETE_GENERADO", "FIRMADO_CLIENTE", "FIRMADO", "VENCIDO"] as const;
    for (const siguiente of rama) {
      const paso = transicionarExpediente(expediente, siguiente);
      if (!paso.ok) throw new Error(paso.error);
      expediente = paso.expediente;
    }

    // D-08 · bajo el orden nuevo el expediente caduca **antes** de cobrar, así
    // que no hay premio que devolver y VENCIDO es el final del camino.
    expect(expediente.estado).toBe("VENCIDO");
  });

  it("la rama de devolución sigue existiendo para los expedientes que sí cobraron", () => {
    // DEVOLUCION_EN_TRAMITE es un trámite en curso, no un final, y el estado
    // terminal es DEVUELTO (pie de la Pantalla B). Se llega desde el cobro —a
    // pedido (D-02)— y desde un VENCIDO del orden viejo, que no se reescribe
    // (regla inviolable #10).
    expect(esTransicionLegal("PAGO_CONFIRMADO", "DEVOLUCION_EN_TRAMITE")).toBe(true);
    expect(esTransicionLegal("EMITIDO", "DEVOLUCION_EN_TRAMITE")).toBe(true);
    expect(esTransicionLegal("VENCIDO", "DEVOLUCION_EN_TRAMITE")).toBe(true);
    expect(esEstadoTerminal("DEVOLUCION_EN_TRAMITE")).toBe(false);
    expect(esEstadoTerminal("DEVUELTO")).toBe(true);
  });
});

describe("DERIVADO_MANUAL es terminal en el flujo digital (regla de negocio #5)", () => {
  it("registrarDeclaracionesP6 deriva a DERIVADO_MANUAL cuando una declaración de las 1, 2, 3 u 8 es incompatible", () => {
    const expediente = avanzarHastaIdentidadVerificada(crearExpediente());

    const resultado = registrarDeclaracionesP6(
      expediente,
      { ...declaracionesCompatibles, condicionPep: "SI" }, // #8 incompatible
      beneficiarioFixture,
          NUMERO_CASO_FIJO,
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.expediente.estado).toBe("DERIVADO_MANUAL");
    expect(resultado.expediente.motivoDerivacionManual).toEqual([8]);
    expect(resultado.expediente.numeroCasoDerivacion).toBe(NUMERO_CASO_FIJO);
  });

  it("un expediente elegible no queda con número de caso, aunque el llamador pase uno", () => {
    const expediente = avanzarHastaIdentidadVerificada(crearExpediente());

    const resultado = registrarDeclaracionesP6(
      expediente,
      declaracionesCompatibles,
      beneficiarioFixture,
          NUMERO_CASO_FIJO,
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.expediente.estado).toBe("DECLARACIONES_OK");
    expect(resultado.expediente.numeroCasoDerivacion).toBeNull();
    expect(resultado.expediente.motivoDerivacionManual).toBeNull();
  });

  it("no se deriva sin número de caso: la transición falla en vez de dejar el caso sin correlativo", () => {
    const expediente = avanzarHastaIdentidadVerificada(crearExpediente());

    const resultado = registrarDeclaracionesP6(
      expediente,
      { ...declaracionesCompatibles, condicionPep: "SI" },
      beneficiarioFixture,
          "   ",
    );

    expect(resultado.ok).toBe(false);
  });

  it("no existe ninguna transición legal desde DERIVADO_MANUAL hacia ningún otro estado", () => {
    expect(transicionesLegalesDesde("DERIVADO_MANUAL")).toEqual([]);
    for (const destino of TODOS_LOS_ESTADOS) {
      expect(esTransicionLegal("DERIVADO_MANUAL", destino)).toBe(false);
    }
  });

  it("no se puede transicionar un expediente DERIVADO_MANUAL hacia pago, firma ni emisión", () => {
    const expediente = avanzarHastaIdentidadVerificada(crearExpediente());
    const derivado = registrarDeclaracionesP6(
      expediente,
      { ...declaracionesCompatibles, estadoDeSalud: "NO" }, // #1 incompatible
      beneficiarioFixture,
          NUMERO_CASO_FIJO,
    );
    if (!derivado.ok) throw new Error(derivado.error);
    expect(derivado.expediente.estado).toBe("DERIVADO_MANUAL");

    const prohibidos = [
      "DECLARACIONES_OK",
      "PAQUETE_GENERADO",
      "FIRMADO_CLIENTE",
      "FIRMADO",
      "PAGO_CONFIRMADO",
      "EMITIDO",
    ] as const;
    for (const destino of prohibidos) {
      const intento = transicionarExpediente(derivado.expediente, destino);
      expect(intento.ok).toBe(false);
    }
  });

  it("es un estado terminal", () => {
    expect(esEstadoTerminal("DERIVADO_MANUAL")).toBe(true);
  });
});

describe("edadEnRangoPermitido (regla de negocio #8)", () => {
  it("acepta exactamente 18 años cumplidos hoy", () => {
    expect(calcularEdadDesde("2008-01-01", new Date("2026-01-01"))).toBe(18);
    expect(edadEnRangoPermitido("2008-01-01", new Date("2026-01-01"))).toBe(true);
  });

  it("rechaza a quien todavía no cumplió 18 (falta un día)", () => {
    expect(calcularEdadDesde("2008-01-02", new Date("2026-01-01"))).toBe(17);
    expect(edadEnRangoPermitido("2008-01-02", new Date("2026-01-01"))).toBe(false);
  });

  it("acepta exactamente 64 años cumplidos y rechaza 65", () => {
    expect(edadEnRangoPermitido("1962-01-01", new Date("2026-01-01"))).toBe(true);
    expect(edadEnRangoPermitido("1961-01-01", new Date("2026-01-01"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Certificado de Cobertura Provisional en la transición del cobro (D-12)
// ---------------------------------------------------------------------------

describe("registrarPagoConfirmadoP7 · el certificado entra con el cobro", () => {
  it("asienta el estado y el certificado en la misma transición", () => {
    const resultado = registrarPagoConfirmadoP7(
      expedienteFirmado(),
      { pago: pagoConfirmadoFixture, certificado: certificadoFixture },
      "2026-08-09T15:04:00.000Z",
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.expediente.estado).toBe("PAGO_CONFIRMADO");
    expect(resultado.expediente.certificadoCobertura).toEqual(certificadoFixture);
  });

  /**
   * Fila 47 · el certificado tiene que derivar del mismo correlativo que el
   * expediente. Un CPC que citara otro número rompería el vínculo entre
   * póliza, Solicitud, FIPF y pago, y este es el punto donde eso se corta:
   * antes de persistir nada.
   */
  it("rechaza un certificado que no deriva del correlativo del expediente", () => {
    const resultado = registrarPagoConfirmadoP7(
      expedienteFirmado(),
      {
        pago: pagoConfirmadoFixture,
        certificado: { ...certificadoFixture, codigo: "CPC-99999999" },
      },
      "2026-08-09T15:04:00.000Z",
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/no deriva del correlativo/);
  });

  it("rechaza un certificado que cuelga de otro paquete", () => {
    const resultado = registrarPagoConfirmadoP7(
      expedienteFirmado(),
      {
        pago: pagoConfirmadoFixture,
        certificado: { ...certificadoFixture, codigoPaquete: "PROP-99999999" },
      },
      "2026-08-09T15:04:00.000Z",
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/no cuelga del paquete/);
  });
});
