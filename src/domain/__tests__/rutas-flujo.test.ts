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
  PANTALLA_POR_ESTADO_V2,
  PANTALLA_POR_ESTADO_V3,
  PASOS_FLUJO,
  PASOS_FLUJO_V2,
  PASOS_FLUJO_V3,
  REDIRECCIONES_RUTAS_VIEJAS,
  REDIRECCIONES_RUTAS_VIEJAS_V2,
  REDIRECCIONES_RUTAS_VIEJAS_V3,
  TOTAL_PASOS,
  destinoDelExpediente,
  numeroDePaso,
  pasoAnteriorDe,
} from "../rutas-flujo";

/** Número de paso 1-based dentro de una lista concreta, para fijar contratos por versión. */
function numeroEn(pasos: readonly { slug: string }[], slug: string): number | null {
  const indice = pasos.findIndex((paso) => paso.slug === slug);
  return indice === -1 ? null : indice + 1;
}

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

  it("v2 · manda cada paso del flujo a su pantalla", () => {
    // Orden CHG-01: el plan primero, el WhatsApp después.
    expect(PANTALLA_POR_ESTADO_V2.INICIADO).toBe("/plan");
    expect(PANTALLA_POR_ESTADO_V2.PLAN_SELECCIONADO).toBe("/whatsapp");
    expect(PANTALLA_POR_ESTADO_V2.CANAL_WA_VERIFICADO).toBe("/preparacion");
    expect(PANTALLA_POR_ESTADO_V2.AUTORIZADO).toBe("/identidad");
    expect(PANTALLA_POR_ESTADO_V2.IDENTIDAD_VERIFICADA).toBe("/declaraciones");
  });

  it("el estado legado del correo verificado sigue teniendo a dónde ir, en las dos versiones", () => {
    // D-06 retiró el paso, pero los expedientes que quedaron ahí no se
    // reescriben (regla #10): tienen que poder terminar su trámite.
    expect(PANTALLA_POR_ESTADO_V2.CANAL_EMAIL_VERIFICADO).toBe("/identidad");
    expect(PANTALLA_POR_ESTADO_V3.CANAL_EMAIL_VERIFICADO).toBe("/inscripcion");
  });

  it("el número de paso sale de la lista y no de cada pantalla", () => {
    expect(numeroEn(PASOS_FLUJO_V2, "/plan")).toBe(1);
    expect(numeroEn(PASOS_FLUJO_V2, "/whatsapp")).toBe(2);
    expect(numeroEn(PASOS_FLUJO_V2, "/confirmacion")).toBe(PASOS_FLUJO_V2.length);
    expect(numeroDePaso(PASOS_FLUJO[0].slug)).toBe(1);
    expect(numeroDePaso(PASOS_FLUJO[TOTAL_PASOS - 1].slug)).toBe(TOTAL_PASOS);
    expect(numeroDePaso("/no-existe")).toBeNull();
  });

  it("toda ruta vieja redirige a una que existe, en las dos versiones del flujo", () => {
    const slugsV2 = new Set(PASOS_FLUJO_V2.map((paso) => paso.slug));
    for (const [vieja, nueva] of Object.entries(REDIRECCIONES_RUTAS_VIEJAS_V2)) {
      expect(slugsV2.has(nueva), `${vieja} redirige a ${nueva}, que no es un paso v2`).toBe(true);
    }
    // En v3 la confirmación sigue existiendo con su slug, fuera del contador.
    const destinosV3 = new Set([...PASOS_FLUJO_V3.map((paso) => paso.slug), "/confirmacion"]);
    for (const [vieja, nueva] of Object.entries(REDIRECCIONES_RUTAS_VIEJAS_V3)) {
      expect(destinosV3.has(nueva), `${vieja} redirige a ${nueva}, que no existe en v3`).toBe(true);
    }
    // La tabla vigente es una de las dos, nunca una mezcla.
    expect([REDIRECCIONES_RUTAS_VIEJAS_V2, REDIRECCIONES_RUTAS_VIEJAS_V3]).toContain(
      REDIRECCIONES_RUTAS_VIEJAS,
    );
  });

  it("D-08 · se firma en el paso 6 y se paga en el 7 (v2)", () => {
    // La inversión se hizo moviendo dos elementos de la lista, y todo lo
    // demás se deriva. Este test es lo que impide que alguien los devuelva de
    // lugar sin darse cuenta de que cambia la secuencia entera.
    expect(numeroEn(PASOS_FLUJO_V2, "/firma")).toBe(6);
    expect(numeroEn(PASOS_FLUJO_V2, "/pago")).toBe(7);
    expect(PANTALLA_POR_ESTADO_V2.DECLARACIONES_OK).toBe("/firma");
    expect(PANTALLA_POR_ESTADO_V2.FIRMADO).toBe("/pago");
    expect(PANTALLA_POR_ESTADO_V2.PAGO_CONFIRMADO).toBe("/confirmacion");
  });

  it("los dos estados intermedios de la firma comparten su pantalla, en las dos versiones", () => {
    // El paquete se cierra al entrar a firmar y la firma del cliente deja el
    // expediente esperando las institucionales: desde el lado de la persona
    // los tres momentos son la misma pantalla.
    expect(PANTALLA_POR_ESTADO_V2.PAQUETE_GENERADO).toBe("/firma");
    expect(PANTALLA_POR_ESTADO_V2.FIRMADO_CLIENTE).toBe("/firma");
    expect(PANTALLA_POR_ESTADO_V3.PAQUETE_GENERADO).toBe("/pago-y-firma");
    expect(PANTALLA_POR_ESTADO_V3.FIRMADO_CLIENTE).toBe("/pago-y-firma");
  });
});

describe("PANTALLA_POR_ESTADO_V3 · el flujo de 3 pasos", () => {
  it("cubre todos los estados, igual que el v2", () => {
    for (const estado of ESTADOS_EXPEDIENTE) {
      expect(PANTALLA_POR_ESTADO_V3[estado]).toBeTruthy();
      expect(PANTALLA_POR_ESTADO_V3[estado].startsWith("/")).toBe(true);
    }
  });

  it("son tres pasos: inscripción, seguro, pago y firma", () => {
    expect(PASOS_FLUJO_V3.map((paso) => paso.slug)).toEqual([
      "/inscripcion",
      "/seguro",
      "/pago-y-firma",
    ]);
    expect(numeroEn(PASOS_FLUJO_V3, "/pago-y-firma")).toBe(3);
  });

  it("DI-2 · la identidad va primero: sus estados viven en la página de inscripción", () => {
    // Cada página larga cubre varios estados — es el corazón del gating en
    // cascada: el estado dice qué sección se habilita, no a qué pantalla ir.
    expect(PANTALLA_POR_ESTADO_V3.INICIADO).toBe("/inscripcion");
    expect(PANTALLA_POR_ESTADO_V3.IDENTIDAD_VERIFICADA).toBe("/inscripcion");
    expect(PANTALLA_POR_ESTADO_V3.CANAL_WA_VERIFICADO).toBe("/inscripcion");
    expect(PANTALLA_POR_ESTADO_V3.AUTORIZADO).toBe("/seguro");
    expect(PANTALLA_POR_ESTADO_V3.PLAN_SELECCIONADO).toBe("/seguro");
    expect(PANTALLA_POR_ESTADO_V3.DECLARACIONES_OK).toBe("/pago-y-firma");
    expect(PANTALLA_POR_ESTADO_V3.FIRMADO).toBe("/pago-y-firma");
    expect(PANTALLA_POR_ESTADO_V3.PAGO_CONFIRMADO).toBe("/confirmacion");
    expect(PANTALLA_POR_ESTADO_V3.EMITIDO).toBe("/confirmacion");
  });

  it("los terminales no cambian con el rediseño", () => {
    for (const estado of [
      "ASISTENCIA_IDENTIDAD",
      "DERIVADO_MANUAL",
      "VENCIDO",
      "DEVOLUCION_EN_TRAMITE",
      "DEVUELTO",
    ] as const) {
      expect(PANTALLA_POR_ESTADO_V3[estado]).toBe(PANTALLA_POR_ESTADO_V2[estado]);
    }
  });

  it("los slugs viejos del flujo de 8 pasos redirigen a su página nueva", () => {
    expect(REDIRECCIONES_RUTAS_VIEJAS_V3["/plan"]).toBe("/seguro");
    expect(REDIRECCIONES_RUTAS_VIEJAS_V3["/whatsapp"]).toBe("/inscripcion");
    expect(REDIRECCIONES_RUTAS_VIEJAS_V3["/identidad"]).toBe("/inscripcion");
    expect(REDIRECCIONES_RUTAS_VIEJAS_V3["/declaraciones"]).toBe("/seguro");
    expect(REDIRECCIONES_RUTAS_VIEJAS_V3["/firma"]).toBe("/pago-y-firma");
    expect(REDIRECCIONES_RUTAS_VIEJAS_V3["/pago"]).toBe("/pago-y-firma");
  });
});

describe("pasoAnteriorDe", () => {
  it("nunca devuelve un paso posterior — el enlace de volver tiene que volver", () => {
    // El caso que lo motivó: la pantalla de firma tenía escrito a mano "Volver
    // a facturación y garantía de pago" apuntando a /pago. Era correcto cuando
    // se pagaba antes de firmar; con D-08 el pago quedó DESPUÉS, así que el
    // enlace mandaba a la persona hacia adelante, a un paso que todavía no
    // podía completar. Esto lo vuelve imposible para cualquier pantalla.
    for (const paso of PASOS_FLUJO) {
      const anterior = pasoAnteriorDe(paso.slug);
      if (anterior === null) continue;
      expect(numeroDePaso(anterior.slug)!).toBeLessThan(numeroDePaso(paso.slug)!);
    }
  });

  it("el paso anterior a la firma son las declaraciones, no el pago (D-08)", () => {
    expect(pasoAnteriorDe("/firma")?.slug).toBe("/declaraciones");
    expect(pasoAnteriorDe("/pago")?.slug).toBe("/firma");
  });

  it("el primer paso no tiene anterior, y una ruta ajena tampoco", () => {
    expect(pasoAnteriorDe(PASOS_FLUJO[0]!.slug)).toBeNull();
    expect(pasoAnteriorDe("/no-es-un-paso")).toBeNull();
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
