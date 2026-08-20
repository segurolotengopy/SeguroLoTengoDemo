/**
 * A dónde reencaminar a alguien que llegó a la pantalla equivocada.
 *
 * Nace de una persona trabada en su celular leyendo "este proceso ya no está
 * en el paso de verificación de WhatsApp": cierto, inútil y sin salida. El
 * servidor sabía dónde estaba su trámite y no se lo dijo.
 */
import { describe, expect, it } from "vitest";
import { ESTADOS_EXPEDIENTE } from "../tipos";
import {
  PANTALLA_POR_ESTADO,
  PASOS_FLUJO,
  REDIRECCIONES_RUTAS_VIEJAS,
  TOTAL_PASOS,
  destinoDelExpediente,
  numeroDePaso,
} from "../rutas-flujo";

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
    // Orden nuevo (CHG-01): el plan primero, el WhatsApp después.
    expect(PANTALLA_POR_ESTADO.INICIADO).toBe("/plan");
    expect(PANTALLA_POR_ESTADO.PLAN_SELECCIONADO).toBe("/whatsapp");
    expect(PANTALLA_POR_ESTADO.CANAL_WA_VERIFICADO).toBe("/preparacion");
    expect(PANTALLA_POR_ESTADO.AUTORIZADO).toBe("/identidad");
    expect(PANTALLA_POR_ESTADO.IDENTIDAD_VERIFICADA).toBe("/declaraciones");
  });

  it("el estado legado del correo verificado sigue teniendo a dónde ir", () => {
    // D-06 retiró el paso, pero los expedientes que quedaron ahí no se
    // reescriben (regla #10): tienen que poder terminar su trámite.
    expect(PANTALLA_POR_ESTADO.CANAL_EMAIL_VERIFICADO).toBe("/identidad");
  });

  it("el número de paso sale de la lista y no de cada pantalla", () => {
    expect(numeroDePaso("/plan")).toBe(1);
    expect(numeroDePaso("/whatsapp")).toBe(2);
    expect(numeroDePaso("/confirmacion")).toBe(TOTAL_PASOS);
    expect(numeroDePaso("/no-existe")).toBeNull();
  });

  it("toda ruta vieja redirige a una que existe", () => {
    const slugs = new Set(PASOS_FLUJO.map((paso) => paso.slug));
    for (const [vieja, nueva] of Object.entries(REDIRECCIONES_RUTAS_VIEJAS)) {
      expect(slugs.has(nueva), `${vieja} redirige a ${nueva}, que no es un paso`).toBe(true);
    }
  });

  it("D-08 · se firma en el paso 6 y se paga en el 7", () => {
    // La inversión se hizo moviendo dos elementos de `PASOS_FLUJO`, y todo lo
    // demás se deriva. Este test es lo que impide que alguien los devuelva de
    // lugar sin darse cuenta de que cambia la secuencia entera.
    expect(numeroDePaso("/firma")).toBe(6);
    expect(numeroDePaso("/pago")).toBe(7);
    expect(PANTALLA_POR_ESTADO.DECLARACIONES_OK).toBe("/firma");
    expect(PANTALLA_POR_ESTADO.FIRMADO).toBe("/pago");
    expect(PANTALLA_POR_ESTADO.PAGO_CONFIRMADO).toBe("/confirmacion");
  });

  it("los dos estados intermedios de la firma comparten su pantalla", () => {
    // El paquete se cierra al entrar a firmar y la firma del cliente deja el
    // expediente esperando las institucionales: desde el lado de la persona
    // los tres momentos son la misma pantalla.
    expect(PANTALLA_POR_ESTADO.PAQUETE_GENERADO).toBe("/firma");
    expect(PANTALLA_POR_ESTADO.FIRMADO_CLIENTE).toBe("/firma");
  });
});

describe("destinoDelExpediente", () => {
  it("ofrece continuar cuando el flujo digital sigue abierto", () => {
    const destino = destinoDelExpediente("CANAL_EMAIL_VERIFICADO");
    expect(destino.terminal).toBe(false);
    expect(destino.rotulo).toContain("Continuá");
    expect(destino.ruta).toBe("/identidad");
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
