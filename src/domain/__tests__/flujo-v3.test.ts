/**
 * El flujo de 3 pasos (Bloque E de `docs/plan/DECISIONES.md`) detrás del flag
 * `FLUJO_V3`.
 *
 * Dos familias de tests, a propósito:
 *
 * 1. **Invariantes del grafo v3**, contra `TRANSICIONES_V3` por nombre — no
 *    dependen del entorno, así que vigilan el rediseño aunque el flag esté
 *    apagado, que es como corre la suite hasta el lote F6.
 * 2. **La selección por flag**, con `vi.stubEnv` + import dinámico: los
 *    módulos resuelven la versión a import-time, así que hay que recargarlos
 *    para ver la otra cara.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ESTADOS_EXPEDIENTE } from "../tipos";
import type { EstadoExpediente } from "../tipos";
import { TRANSICIONES_V2, TRANSICIONES_V3 } from "../expediente";

function aristasHacia(
  grafo: Readonly<Record<EstadoExpediente, readonly EstadoExpediente[]>>,
  destino: EstadoExpediente,
): EstadoExpediente[] {
  return ESTADOS_EXPEDIENTE.filter((estado) => grafo[estado].includes(destino));
}

describe("TRANSICIONES_V3 · invariantes que el rediseño no puede romper", () => {
  it("cubre todos los estados del expediente", () => {
    for (const estado of ESTADOS_EXPEDIENTE) {
      expect(TRANSICIONES_V3[estado]).toBeDefined();
    }
  });

  it("regla 6-bis · no hay cobro sin firma: a PAGO_CONFIRMADO solo se llega desde FIRMADO", () => {
    expect(aristasHacia(TRANSICIONES_V3, "PAGO_CONFIRMADO")).toEqual(["FIRMADO"]);
    // Y la arista que la regla prohíbe por nombre no existe.
    expect(TRANSICIONES_V3.DECLARACIONES_OK).not.toContain("PAGO_CONFIRMADO");
  });

  it("el tramo desde DECLARACIONES_OK es idéntico al v2: D-08 no se renegocia", () => {
    for (const estado of [
      "DECLARACIONES_OK",
      "PAQUETE_GENERADO",
      "FIRMADO_CLIENTE",
      "FIRMADO",
      "PAGO_CONFIRMADO",
      "VENCIDO",
      "DEVOLUCION_EN_TRAMITE",
      "DEVUELTO",
      "EMITIDO",
    ] as const) {
      expect(TRANSICIONES_V3[estado], estado).toEqual(TRANSICIONES_V2[estado]);
    }
  });

  it("DI-2 · la identidad va primero y la cédula se conoce al comienzo", () => {
    expect(TRANSICIONES_V3.INICIADO).toContain("IDENTIDAD_VERIFICADA");
    expect(TRANSICIONES_V3.INICIADO).not.toContain("PLAN_SELECCIONADO");
    expect(TRANSICIONES_V3.IDENTIDAD_VERIFICADA).toEqual(["CANAL_WA_VERIFICADO"]);
    expect(TRANSICIONES_V3.AUTORIZADO).toEqual(["PLAN_SELECCIONADO"]);
  });

  it("la salida a asistencia humana sale del comienzo, y sigue sin volver al flujo", () => {
    expect(TRANSICIONES_V3.INICIADO).toContain("ASISTENCIA_IDENTIDAD");
    expect(TRANSICIONES_V3.ASISTENCIA_IDENTIDAD).toEqual([]);
  });

  it("regla #5 · la derivación por elegibilidad sale de las declaraciones y es terminal", () => {
    // En v3 las declaraciones se responden con el plan elegido (paso 2).
    expect(aristasHacia(TRANSICIONES_V3, "DERIVADO_MANUAL")).toEqual(["PLAN_SELECCIONADO"]);
    expect(TRANSICIONES_V3.DERIVADO_MANUAL).toEqual([]);
  });

  it("el autobucle de cambiar plan sobrevive al rediseño", () => {
    expect(TRANSICIONES_V3.PLAN_SELECCIONADO).toContain("PLAN_SELECCIONADO");
  });

  it("el legado del correo verificado conserva sus salidas v2 (regla #10)", () => {
    expect(TRANSICIONES_V3.CANAL_EMAIL_VERIFICADO).toEqual(
      TRANSICIONES_V2.CANAL_EMAIL_VERIFICADO,
    );
    expect(aristasHacia(TRANSICIONES_V3, "CANAL_EMAIL_VERIFICADO")).toEqual([]);
  });
});

describe("selección por flag · los módulos eligen la versión a import-time", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function conFlagV3<T>(importar: () => Promise<T>): Promise<T> {
    vi.stubEnv("FLUJO_V3", "true");
    vi.resetModules();
    return importar();
  }

  it("con FLUJO_V3=true rige la lista de 3 pasos y su mapa", async () => {
    const rutas = await conFlagV3(() => import("../rutas-flujo"));
    expect(rutas.TOTAL_PASOS).toBe(3);
    expect(rutas.PASOS_FLUJO).toEqual(rutas.PASOS_FLUJO_V3);
    expect(rutas.PANTALLA_POR_ESTADO).toEqual(rutas.PANTALLA_POR_ESTADO_V3);
    expect(rutas.REDIRECCIONES_RUTAS_VIEJAS).toEqual(rutas.REDIRECCIONES_RUTAS_VIEJAS_V3);
    expect(rutas.numeroDePaso("/inscripcion")).toBe(1);
    expect(rutas.destinoDelExpediente("IDENTIDAD_VERIFICADA").ruta).toBe("/inscripcion");
  });

  it("con FLUJO_V3=true rige el grafo v3", async () => {
    const expediente = await conFlagV3(() => import("../expediente"));
    expect(expediente.esTransicionLegal("INICIADO", "IDENTIDAD_VERIFICADA")).toBe(true);
    expect(expediente.esTransicionLegal("INICIADO", "PLAN_SELECCIONADO")).toBe(false);
    expect(expediente.esTransicionLegal("PLAN_SELECCIONADO", "DECLARACIONES_OK")).toBe(true);
  });

  it("con FLUJO_V3=true los casos de uso piden los estados del orden nuevo", async () => {
    const identidad = await conFlagV3(() => import("../verificacion-identidad"));
    expect(identidad.ESTADO_REQUERIDO_P5).toBe("INICIADO");

    const canal = await conFlagV3(() => import("../verificacion-canal-whatsapp"));
    expect(canal.CANAL_WHATSAPP_P1.estadoRequerido).toBe("IDENTIDAD_VERIFICADA");
    // En v3 el expediente nace con los T&C del inicio (DI-10), nunca acá.
    expect(canal.CANAL_WHATSAPP_P1.creaExpediente).toBe(false);

    const declaraciones = await conFlagV3(() => import("../declaraciones-p6"));
    expect(declaraciones.ESTADO_REQUERIDO_P6).toBe("PLAN_SELECCIONADO");
    expect(declaraciones.RUTA_TRAS_DECLARACIONES).toBe("/pago-y-firma");

    const firma = await conFlagV3(() => import("../firma-p8"));
    expect(firma.RUTA_PAGO).toBe("/pago-y-firma");
  });

  it("sin el flag, todo sigue siendo el flujo de 8 pasos", async () => {
    vi.stubEnv("FLUJO_V3", "");
    vi.resetModules();
    const rutas = await import("../rutas-flujo");
    expect(rutas.TOTAL_PASOS).toBe(8);
    expect(rutas.PASOS_FLUJO).toEqual(rutas.PASOS_FLUJO_V2);
    const firma = await import("../firma-p8");
    expect(firma.RUTA_PAGO).toBe("/pago");
  });
});
