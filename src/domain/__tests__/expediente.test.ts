import { describe, expect, it } from "vitest";
import type { EstadoExpediente } from "../tipos";
import { calcularEdadDesde, edadEnRangoPermitido } from "../tipos";
import {
  esEstadoTerminal,
  esTransicionLegal,
  registrarDeclaracionesP6,
  transicionarExpediente,
  transicionesLegalesDesde,
} from "../expediente";
import {
  avanzarHastaIdentidadVerificada,
  crearExpediente,
  datosComplementariosFixture,
  declaracionesCompatibles,
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

    const declaraciones = registrarDeclaracionesP6(expediente, declaracionesCompatibles, datosComplementariosFixture, NUMERO_CASO_FIJO);
    expect(declaraciones.ok).toBe(true);
    if (!declaraciones.ok) return;
    expediente = declaraciones.expediente;
    expect(expediente.estado).toBe("DECLARACIONES_OK");

    for (const siguiente of ["PAGO_CONFIRMADO", "PAQUETE_GENERADO", "FIRMADO", "EMITIDO"] as const) {
      const paso = transicionarExpediente(expediente, siguiente);
      expect(paso.ok).toBe(true);
      if (!paso.ok) return;
      expediente = paso.expediente;
    }

    expect(expediente.estado).toBe("EMITIDO");
    expect(esEstadoTerminal(expediente.estado)).toBe(true);
  });

  it("recorre la rama de vencimiento hasta DEVUELTO", () => {
    let expediente = avanzarHastaIdentidadVerificada(crearExpediente());
    const declaraciones = registrarDeclaracionesP6(expediente, declaracionesCompatibles, datosComplementariosFixture, NUMERO_CASO_FIJO);
    if (!declaraciones.ok) throw new Error(declaraciones.error);
    expediente = declaraciones.expediente;

    const rama = ["PAGO_CONFIRMADO", "PAQUETE_GENERADO", "VENCIDO", "DEVOLUCION_EN_TRAMITE", "DEVUELTO"] as const;
    for (const siguiente of rama) {
      const paso = transicionarExpediente(expediente, siguiente);
      if (!paso.ok) throw new Error(paso.error);
      expediente = paso.expediente;
    }

    // El trámite de devolución tiene una etapa más que el resto de las ramas:
    // DEVOLUCION_EN_TRAMITE es un trámite en curso, no un final, y el estado
    // terminal es DEVUELTO (pie de la Pantalla B).
    expect(expediente.estado).toBe("DEVUELTO");
    expect(esEstadoTerminal("DEVOLUCION_EN_TRAMITE")).toBe(false);
    expect(esEstadoTerminal(expediente.estado)).toBe(true);
  });
});

describe("DERIVADO_MANUAL es terminal en el flujo digital (regla de negocio #5)", () => {
  it("registrarDeclaracionesP6 deriva a DERIVADO_MANUAL cuando una declaración de las 1, 2, 3 u 8 es incompatible", () => {
    const expediente = avanzarHastaIdentidadVerificada(crearExpediente());

    const resultado = registrarDeclaracionesP6(
      expediente,
      { ...declaracionesCompatibles, condicionPep: "SI" }, // #8 incompatible
      datosComplementariosFixture,
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
      datosComplementariosFixture,
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
      datosComplementariosFixture,
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
      datosComplementariosFixture,
      NUMERO_CASO_FIJO,
    );
    if (!derivado.ok) throw new Error(derivado.error);
    expect(derivado.expediente.estado).toBe("DERIVADO_MANUAL");

    for (const destino of ["DECLARACIONES_OK", "PAGO_CONFIRMADO", "PAQUETE_GENERADO", "FIRMADO", "EMITIDO"] as const) {
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
