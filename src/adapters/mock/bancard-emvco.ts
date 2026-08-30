/**
 * Construcción del `qr_data` en formato EMVCo que devuelve Bancard QR.
 *
 * ## Por qué existe
 *
 * El mock devolvía una cadena inventada —`bancard-qr://pago?ref=…&monto=…`—
 * que no es lo que Bancard devuelve ni lo que ninguna app de banco sabe leer.
 * El contrato está escrito: `docs/Integraciones/Qr en API de Comercios v1.2 16
 * (1).pdf` define el campo `qr_data` como *"Datos del QR en formato EMVCo"* y
 * trae un ejemplo real. Una demostración que muestra una cadena que ningún
 * lector reconoce enseña algo falso sobre el producto, y el día que se escriba
 * el adaptador oficial nadie se acuerda de que ese formato era de mentira.
 *
 * ## Qué es EMVCo, en lo que hace falta acá
 *
 * Una cadena de campos `TT LL VVVV`: dos dígitos de etiqueta, dos de longitud,
 * y el valor. Sin separadores. El último campo es siempre el `63`, un CRC-16
 * sobre todo lo anterior **incluido su propio encabezado `6304`**, que es la
 * parte que se implementa mal si uno no la lee con cuidado.
 *
 * Las etiquetas que usa el ejemplo del documento, y por lo tanto estas:
 *
 * | Etiqueta | Qué lleva |
 * | :---- | :---- |
 * | `00` | Versión del formato, siempre `01` |
 * | `01` | Método de iniciación: `11` estático, **`12` dinámico** |
 * | `02` | Identificador del comercio en la red de Bancard |
 * | `52` | Rubro del comercio (MCC) |
 * | `53` | Moneda, numérica ISO 4217: **`600`** es el guaraní |
 * | `54` | Importe |
 * | `58` | País, `PY` |
 * | `59` | Nombre del comercio |
 * | `60` | Ciudad |
 * | `62` | Datos adicionales; adentro, `05` es la referencia de la operación |
 *
 * **Es un QR dinámico (`01` = `12`)**: cada venta genera el suyo, con su
 * importe adentro. Es lo que el documento llama *Venta Rápida QR*, y es el
 * único tipo que sirve acá — un QR estático no lleva importe y obligaría a que
 * la persona lo tipee.
 *
 * ## Qué NO lleva
 *
 * Ningún dato de la persona: ni nombre, ni cédula, ni el número de propuesta.
 * Lo que va adentro es del comercio y de la operación. Vale la misma regla que
 * el QR de verificación de documentos (regla inviolable #7).
 *
 * Los datos del comercio son de demostración y lo dicen: los reales los provee
 * Bancard al dar de alta el comercio, junto con las credenciales.
 */

/** Guaraní, ISO 4217 numérico. El documento lo usa así en su ejemplo (`5303600`). */
export const MONEDA_GUARANI_EMVCO = "600";

/** País del comercio, ISO 3166-1 alfa-2. */
export const PAIS_COMERCIO_EMVCO = "PY";

/**
 * Datos del comercio que Bancard entrega al dar de alta la cuenta.
 *
 * Son de demostración y se nota: el comercio adherido real es Alianza (P7 lo
 * declara en la pantalla), y su código de comercio, sucursal y rubro los provee
 * Bancard con las credenciales. Cuando existan, esto sale de configuración.
 */
export const COMERCIO_DEMO_EMVCO = {
  /** Identificador del comercio en la red (etiqueta 02). */
  codigo: "0000000000",
  /** Merchant Category Code (etiqueta 52). 6300 = seguros. */
  rubro: "6300",
  /** Etiqueta 59, hasta 25 caracteres por la especificación. */
  nombre: "ALIANZA GARANTIA DEMO",
  /** Etiqueta 60. */
  ciudad: "ASUNCION",
} as const;

/** `TT LL VVVV`: etiqueta, longitud en dos dígitos, valor. */
function campo(etiqueta: string, valor: string): string {
  return `${etiqueta}${valor.length.toString().padStart(2, "0")}${valor}`;
}

/**
 * CRC-16/CCITT-FALSE: polinomio `0x1021`, valor inicial `0xFFFF`, sin reflejar
 * ni la entrada ni la salida, sin XOR final. Es el que fija EMVCo para la
 * etiqueta `63`.
 *
 * Se escribe acá y no se trae una librería por el mismo criterio con el que el
 * generador de QR y el de PDF viven en este repo: son veinte líneas, y el
 * dominio no tiene una sola dependencia.
 */
export function crc16Emvco(datos: string): string {
  let crc = 0xffff;

  for (const caracter of datos) {
    crc ^= caracter.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface DatosQrEmvco {
  /** Importe en guaraníes, entero: el guaraní no tiene decimales. */
  readonly montoGs: number;
  /**
   * Alias del pago que devuelve Bancard (`hook_alias`), que es el
   * identificador con el que después llega la confirmación por callback. Va en
   * la referencia de la operación, etiqueta `62` → `05`.
   */
  readonly hookAlias: string;
}

/**
 * Arma el `qr_data` completo, con su CRC.
 *
 * Determinista: los mismos datos dan la misma cadena. No hay reloj ni azar
 * adentro — lo aleatorio es el `hook_alias`, y entra por parámetro.
 */
export function construirQrEmvco({ montoGs, hookAlias }: DatosQrEmvco): string {
  const cuerpo = [
    campo("00", "01"),
    // Dinámico: este QR vale para esta venta y lleva su importe adentro.
    campo("01", "12"),
    campo("02", COMERCIO_DEMO_EMVCO.codigo),
    campo("52", COMERCIO_DEMO_EMVCO.rubro),
    campo("53", MONEDA_GUARANI_EMVCO),
    campo("54", String(Math.trunc(montoGs))),
    campo("58", PAIS_COMERCIO_EMVCO),
    campo("59", COMERCIO_DEMO_EMVCO.nombre),
    campo("60", COMERCIO_DEMO_EMVCO.ciudad),
    campo("62", campo("05", hookAlias)),
  ].join("");

  // El CRC se calcula sobre el cuerpo **más** el encabezado `6304` de su propio
  // campo, que ya tiene que estar puesto cuando se lo computa.
  const conEncabezadoCrc = `${cuerpo}6304`;
  return `${conEncabezadoCrc}${crc16Emvco(conEncabezadoCrc)}`;
}

/**
 * Alias del pago, con la forma que devuelve Bancard: corto y alfanumérico en
 * mayúsculas (el ejemplo del documento es `SRK597`).
 *
 * Lleva prefijo `DEMO` para que en una evidencia o en la consola administrativa
 * se distinga de un alias real de un vistazo, igual que hacen las referencias
 * del camino de identidad de demostración.
 */
export function generarHookAlias(aleatorio: () => string): string {
  const cuerpo = aleatorio().replace(/[^0-9a-z]/gi, "").slice(0, 6).toUpperCase();
  return `DEMO${cuerpo.padEnd(6, "0")}`;
}
