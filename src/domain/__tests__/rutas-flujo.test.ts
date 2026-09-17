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
  RUTA_CIERRE_DE_TRAMITE,
  TOTAL_ETAPAS,
  TOTAL_PASOS,
  destinoDelExpediente,
  etapaDePaso,
  numeroDePaso,
  pasoAnteriorDe,
  perteneceAEstePaso,
  rutaDelPasoSiguiente,
  rutaSiguienteDe,
} from "../rutas-flujo";
import { PANTALLAS_V4 } from "../v4/etapas";

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
    // Orden CHG-01: el plan primero, el WhatsApp después.
    expect(PANTALLA_POR_ESTADO.INICIADO).toBe("/plan");
    expect(PANTALLA_POR_ESTADO.PLAN_SELECCIONADO).toBe("/whatsapp");
    expect(PANTALLA_POR_ESTADO.CANAL_WA_VERIFICADO).toBe("/preparacion");
    expect(PANTALLA_POR_ESTADO.AUTORIZADO).toBe("/identidad");
    // v4 · con la identidad verificada siguen los datos personales (03D), no
    // las declaraciones: es la línea que distingue este mapa del de 8 pasos.
    expect(PANTALLA_POR_ESTADO.IDENTIDAD_VERIFICADA).toBe("/datos");
  });

  it("el estado legado del correo verificado sigue teniendo a dónde ir", () => {
    // D-06 retiró el paso, pero los expedientes que quedaron ahí no se
    // reescriben (regla #10): tienen que poder terminar su trámite.
    expect(PANTALLA_POR_ESTADO.CANAL_EMAIL_VERIFICADO).toBe("/identidad");
  });

  it("toda pantalla del mapa es un paso del flujo o una salida declarada", () => {
    const destinos = new Set([
      ...PASOS_FLUJO.map((paso) => paso.slug),
      "/asistencia-identidad",
      "/revision-manual",
      "/solicitud-vencida",
    ]);
    for (const estado of ESTADOS_EXPEDIENTE) {
      expect(destinos.has(PANTALLA_POR_ESTADO[estado]), `${estado} → ${PANTALLA_POR_ESTADO[estado]}`).toBe(true);
    }
  });

  it("D-08 · se firma antes de pagar", () => {
    // La inversión se hizo moviendo dos elementos de la lista, y todo lo
    // demás se deriva. Este test es lo que impide que alguien los devuelva de
    // lugar sin darse cuenta de que cambia la secuencia entera.
    expect(numeroDePaso("/firma")!).toBeLessThan(numeroDePaso("/pago")!);
    expect(PANTALLA_POR_ESTADO.DECLARACIONES_OK).toBe("/firma");
    // D-08 enmendada (04-sep-2026) · el paso de firma se completa con
    // FIRMADO_CLIENTE, no con FIRMADO: la institucional ya no es condición
    // para seguir al pago (D-38).
    expect(PANTALLA_POR_ESTADO.FIRMADO_CLIENTE).toBe("/pago");
    expect(PANTALLA_POR_ESTADO.PAGO_CONFIRMADO).toBe("/confirmacion");
    // FIRMADO describe ahora un momento posterior al pago (D-38, D-42): mismo
    // destino que PAGO_CONFIRMADO, no que DECLARACIONES_OK.
    expect(PANTALLA_POR_ESTADO.FIRMADO).toBe("/confirmacion");
  });

  it("los estados intermedios de la firma del cliente comparten su pantalla", () => {
    // El paquete se cierra al entrar a firmar: desde el lado de la persona los
    // dos momentos son la misma pantalla.
    expect(PANTALLA_POR_ESTADO.PAQUETE_GENERADO).toBe("/firma");
    expect(perteneceAEstePaso("/firma", "DECLARACIONES_OK")).toBe(true);
    expect(perteneceAEstePaso("/firma", "PAQUETE_GENERADO")).toBe(true);
    expect(perteneceAEstePaso("/firma", "FIRMADO_CLIENTE")).toBe(false);
  });
});

describe("PASOS_FLUJO · las pantallas v4 y sus cinco etapas", () => {
  it("son las once pantallas del contador, en el orden del handoff", () => {
    expect(PASOS_FLUJO.map((paso) => paso.slug)).toEqual([
      "/plan",
      "/whatsapp",
      "/preparacion",
      "/identidad",
      "/datos",
      "/actividad",
      "/declaraciones",
      "/consentimientos",
      "/firma",
      "/pago",
      "/confirmacion",
    ]);
    expect(TOTAL_PASOS).toBe(11);
  });

  it("el número de paso sale de la lista y no de cada pantalla", () => {
    expect(numeroDePaso("/plan")).toBe(1);
    expect(numeroDePaso("/whatsapp")).toBe(2);
    expect(numeroDePaso("/confirmacion")).toBe(TOTAL_PASOS);
    expect(numeroDePaso(PASOS_FLUJO[TOTAL_PASOS - 1]!.slug)).toBe(TOTAL_PASOS);
    expect(numeroDePaso("/no-existe")).toBeNull();
  });

  it("la etapa de cada paso coincide con la de `v4/etapas.ts`, que es lo que dibuja el stepper", () => {
    // Dos tablas con la misma información tienen que decir lo mismo: si una
    // pantalla cambia de etapa en una sola, el stepper y el enrutado dejan de
    // coincidir sin que nadie lo note.
    const porRuta = new Map(PANTALLAS_V4.map((pantalla) => [pantalla.ruta, pantalla.etapa]));
    for (const paso of PASOS_FLUJO) {
      expect(porRuta.get(paso.slug), `${paso.slug} no está en PANTALLAS_V4`).toBeDefined();
      expect(etapaDePaso(paso.slug), `${paso.slug}`).toBe(porRuta.get(paso.slug));
    }
    expect(etapaDePaso("/no-existe")).toBeNull();
    expect(TOTAL_ETAPAS).toBe(5);
    expect(new Set(PASOS_FLUJO.map((paso) => paso.etapa)).size).toBe(TOTAL_ETAPAS);
  });

  it("las etapas no retroceden a lo largo de la lista", () => {
    for (let i = 1; i < PASOS_FLUJO.length; i += 1) {
      expect(PASOS_FLUJO[i]!.etapa).toBeGreaterThanOrEqual(PASOS_FLUJO[i - 1]!.etapa);
    }
  });

  it("el siguiente de cada pantalla es el elemento que le sigue en la lista", () => {
    for (let i = 0; i < PASOS_FLUJO.length; i += 1) {
      expect(rutaSiguienteDe(PASOS_FLUJO[i]!.slug)).toBe(PASOS_FLUJO[i + 1]?.slug ?? null);
    }
    expect(rutaSiguienteDe("/no-existe")).toBeNull();
  });

  it("el siguiente de un estado es la pantalla que sigue al primer paso que lo produce", () => {
    // IDENTIDAD_VERIFICADA lo producen cuatro pantallas (03C, 03D, 03E y
    // 04A): la derivación por estado responde por la primera, y cada una
    // reenvía a la siguiente cuando lo suyo ya está completo.
    expect(rutaDelPasoSiguiente("PLAN_SELECCIONADO")).toBe("/whatsapp");
    expect(rutaDelPasoSiguiente("IDENTIDAD_VERIFICADA")).toBe("/datos");
    expect(rutaDelPasoSiguiente("DECLARACIONES_OK")).toBe("/firma");
    expect(rutaDelPasoSiguiente("EMITIDO")).toBeNull();
    expect(rutaDelPasoSiguiente("DERIVADO_MANUAL")).toBeNull();
  });
});

describe("REDIRECCIONES_RUTAS_VIEJAS", () => {
  it("toda ruta vieja redirige a una pantalla que existe", () => {
    const slugs = new Set(PASOS_FLUJO.map((paso) => paso.slug));
    for (const [vieja, nueva] of Object.entries(REDIRECCIONES_RUTAS_VIEJAS)) {
      expect(slugs.has(nueva), `${vieja} redirige a ${nueva}, que no es un paso del flujo`).toBe(true);
      expect(slugs.has(vieja), `${vieja} sigue siendo una ruta viva: no debería redirigirse`).toBe(false);
    }
  });

  it("cubre las dos generaciones de enlaces ya enviados: el wizard numerado y las páginas largas", () => {
    for (const numerada of ["/p1-whatsapp", "/p2-plan", "/p5-identidad", "/p7-pago", "/p8-firma", "/p9-confirmacion"]) {
      expect(REDIRECCIONES_RUTAS_VIEJAS[numerada], numerada).toBeDefined();
    }
    for (const larga of ["/inscripcion", "/seguro", "/pago-y-firma"]) {
      expect(REDIRECCIONES_RUTAS_VIEJAS[larga], larga).toBeDefined();
    }
    // El paso de correo dejó de existir (D-06): va a la identidad, que es
    // donde vive ahora su contenido.
    expect(REDIRECCIONES_RUTAS_VIEJAS["/p4-correo"]).toBe("/identidad");
  });

  it("quien cierra el trámite vuelve a la portada", () => {
    expect(RUTA_CIERRE_DE_TRAMITE).toBe("/");
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

  it("el paso anterior a la firma son los consentimientos, no el pago (D-08)", () => {
    expect(pasoAnteriorDe("/firma")?.slug).toBe("/consentimientos");
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
