import { describe, expect, it } from "vitest";
import {
  COMERCIO_DEMO_EMVCO,
  MONEDA_GUARANI_EMVCO,
  construirQrEmvco,
  crc16Emvco,
  generarHookAlias,
} from "../bancard-emvco";

/**
 * El contrato que se está cuidando acá es el de
 * `docs/Integraciones/Qr en API de Comercios v1.2 16 (1).pdf`: el campo
 * `qr_data` es EMVCo, no una cadena cualquiera que el mock invente.
 *
 * Lo que hace falta verificar no es "que devuelva algo": es que la cadena sea
 * **parseable con la regla del formato** y que el CRC cierre. Por eso el test
 * trae su propio lector de TLV en vez de comparar contra una constante — una
 * comparación literal pasaría igual con un CRC mal calculado.
 */

/** Lee `TT LL VVVV…` y devuelve las etiquetas encontradas, en orden. */
function leerTlv(cadena: string): { etiqueta: string; valor: string }[] {
  const campos: { etiqueta: string; valor: string }[] = [];
  let i = 0;
  while (i < cadena.length) {
    const etiqueta = cadena.slice(i, i + 2);
    const longitud = Number(cadena.slice(i + 2, i + 4));
    expect(Number.isInteger(longitud), `longitud no numérica en la etiqueta ${etiqueta}`).toBe(true);
    campos.push({ etiqueta, valor: cadena.slice(i + 4, i + 4 + longitud) });
    i += 4 + longitud;
  }
  return campos;
}

describe("CRC-16 de EMVCo", () => {
  it("da el valor de referencia de CCITT-FALSE para «123456789»", () => {
    // Vector de prueba público del algoritmo: si el polinomio, el valor inicial
    // o la reflexión estuvieran mal, este número no sale.
    expect(crc16Emvco("123456789")).toBe("29B1");
  });

  it("es determinista y de cuatro caracteres en mayúsculas", () => {
    expect(crc16Emvco("hola")).toBe(crc16Emvco("hola"));
    expect(crc16Emvco("hola")).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe("qr_data EMVCo", () => {
  const cadena = construirQrEmvco({ montoGs: 522_500, hookAlias: "DEMO123456" });

  it("se parsea entero con la regla del formato", () => {
    const campos = leerTlv(cadena);
    // Si alguna longitud estuviera mal, el recorrido se desalinearía y la
    // reconstrucción no daría la misma cadena.
    const reconstruida = campos
      .map(({ etiqueta, valor }) => `${etiqueta}${valor.length.toString().padStart(2, "0")}${valor}`)
      .join("");
    expect(reconstruida).toBe(cadena);
  });

  it("declara el formato, el tipo dinámico, la moneda y el país que fija el documento", () => {
    const campos = new Map(leerTlv(cadena).map(({ etiqueta, valor }) => [etiqueta, valor]));

    expect(campos.get("00")).toBe("01");
    // Dinámico: cada venta genera el suyo y lleva su importe. Un QR estático
    // (`11`) obligaría a que la persona tipee el monto.
    expect(campos.get("01")).toBe("12");
    expect(campos.get("53")).toBe(MONEDA_GUARANI_EMVCO);
    expect(campos.get("58")).toBe("PY");
    expect(campos.get("59")).toBe(COMERCIO_DEMO_EMVCO.nombre);
  });

  it("lleva el importe en guaraníes, sin decimales", () => {
    const campos = new Map(leerTlv(cadena).map(({ etiqueta, valor }) => [etiqueta, valor]));
    expect(campos.get("54")).toBe("522500");
  });

  it("lleva el hook_alias como referencia de la operación, dentro de la etiqueta 62", () => {
    const campos = new Map(leerTlv(cadena).map(({ etiqueta, valor }) => [etiqueta, valor]));
    const adicionales = new Map(
      leerTlv(campos.get("62") ?? "").map(({ etiqueta, valor }) => [etiqueta, valor]),
    );
    expect(adicionales.get("05")).toBe("DEMO123456");
  });

  it("cierra con un CRC calculado sobre todo lo anterior, su propio encabezado incluido", () => {
    // Es el error clásico al implementar EMVCo: calcular el CRC sin el `6304`
    // que lo precede. Recalcularlo acá desde cero lo detectaría.
    const sinCrc = cadena.slice(0, -4);
    expect(sinCrc.endsWith("6304")).toBe(true);
    expect(cadena.slice(-4)).toBe(crc16Emvco(sinCrc));
  });

  it("no lleva más etiquetas que las declaradas", () => {
    // Que no haya datos de la persona adentro es **estructural**: la función
    // solo recibe importe y alias, así que no tiene con qué filtrarlos —un test
    // que buscara cédulas en la salida sería teatro—. Lo que sí puede
    // degradarse con el tiempo es que alguien agregue una etiqueta con datos
    // del expediente, y eso es lo que esta lista congela.
    const etiquetas = leerTlv(cadena).map(({ etiqueta }) => etiqueta);
    expect(etiquetas).toEqual(["00", "01", "02", "52", "53", "54", "58", "59", "60", "62", "63"]);
  });

  it("es determinista: mismos datos, misma cadena", () => {
    expect(construirQrEmvco({ montoGs: 319_000, hookAlias: "DEMOABC123" })).toBe(
      construirQrEmvco({ montoGs: 319_000, hookAlias: "DEMOABC123" }),
    );
  });
});

describe("hook_alias", () => {
  it("tiene la forma corta y alfanumérica que devuelve Bancard, con marca de demostración", () => {
    const alias = generarHookAlias(() => "a1b2c3d4-e5f6");
    expect(alias).toMatch(/^DEMO[0-9A-Z]{6}$/);
  });

  it("completa cuando el azar da menos caracteres de los necesarios", () => {
    expect(generarHookAlias(() => "ab")).toBe("DEMOAB0000");
  });
});
