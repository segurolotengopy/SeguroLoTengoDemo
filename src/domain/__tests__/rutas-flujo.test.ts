/**
 * A dónde reencaminar a alguien que llegó a la pantalla equivocada.
 *
 * Nace de una persona trabada en su celular leyendo "este proceso ya no está
 * en el paso de verificación de WhatsApp": cierto, inútil y sin salida. El
 * servidor sabía dónde estaba su trámite y no se lo dijo.
 */
import { describe, expect, it } from "vitest";
import { ESTADOS_EXPEDIENTE } from "../tipos";
import { PANTALLA_POR_ESTADO, destinoDelExpediente } from "../rutas-flujo";

describe("PANTALLA_POR_ESTADO", () => {
  it("cubre todos los estados del expediente, sin excepción", () => {
    // Si mañana se agrega un estado y nadie decide su pantalla, alguien va a
    // quedar sin salida en esa rama. El Record exhaustivo lo impide en
    // compilación; esto lo fija también en tiempo de ejecución.
    for (const estado of ESTADOS_EXPEDIENTE) {
      expect(PANTALLA_POR_ESTADO[estado]).toBeTruthy();
      expect(PANTALLA_POR_ESTADO[estado].startsWith("/")).toBe(true);
    }
  });

  it("manda cada paso del flujo a su pantalla", () => {
    expect(PANTALLA_POR_ESTADO.INICIADO).toBe("/p1-whatsapp");
    expect(PANTALLA_POR_ESTADO.CANAL_WA_VERIFICADO).toBe("/p2-plan");
    expect(PANTALLA_POR_ESTADO.CANAL_EMAIL_VERIFICADO).toBe("/p5-identidad");
    expect(PANTALLA_POR_ESTADO.IDENTIDAD_VERIFICADA).toBe("/p6-declaraciones");
  });

  it("los dos estados con el pago hecho apuntan a P8", () => {
    // El paquete se cierra al entrar a P8, así que PAGO_CONFIRMADO y
    // PAQUETE_GENERADO son la misma pantalla desde el lado de la persona.
    expect(PANTALLA_POR_ESTADO.PAGO_CONFIRMADO).toBe("/p8-firma");
    expect(PANTALLA_POR_ESTADO.PAQUETE_GENERADO).toBe("/p8-firma");
  });
});

describe("destinoDelExpediente", () => {
  it("ofrece continuar cuando el flujo digital sigue abierto", () => {
    const destino = destinoDelExpediente("CANAL_EMAIL_VERIFICADO");
    expect(destino.terminal).toBe(false);
    expect(destino.rotulo).toContain("Continuá");
    expect(destino.ruta).toBe("/p5-identidad");
  });

  it("no promete continuar desde un estado terminal", () => {
    // Ofrecer "seguí desde donde quedaste" hacia ASISTENCIA_IDENTIDAD sería
    // mentir: de ahí no se vuelve al flujo. Pero tampoco se deja a nadie sin
    // pantalla — se la lleva a ver qué pasó con su trámite.
    for (const estado of ["ASISTENCIA_IDENTIDAD", "DERIVADO_MANUAL", "VENCIDO"] as const) {
      const destino = destinoDelExpediente(estado);
      expect(destino.terminal).toBe(true);
      expect(destino.rotulo).not.toContain("Continuá");
      expect(destino.ruta).toBeTruthy();
    }
  });

  it("el rótulo dice la acción, nunca el estado técnico", () => {
    // La persona no tiene por qué leer "PAQUETE_GENERADO" en un botón.
    for (const estado of ESTADOS_EXPEDIENTE) {
      const { rotulo } = destinoDelExpediente(estado);
      expect(rotulo).not.toContain("_");
      expect(rotulo).not.toBe(estado);
    }
  });
});
