/**
 * Acelerador del plazo de firma para la demostración (CLAUDE.md → "Panel de
 * demo": *"acelerar el plazo de firma de 24 h a segundos"*).
 *
 * El plazo real son 24 horas (`PLAZO_FIRMA_MS` en `src/domain/pago-p7.ts`,
 * `PLAZO PARA FIRMAR: 24 HORAS` de P7 y nota inferior de P8). Sin esta palanca
 * no habría forma de mostrar la Pantalla B en una reunión: habría que pagar el
 * QR y volver al día siguiente.
 *
 * Tres candados para que esto no sea una puerta trasera:
 *
 * 1. **Solo con `DEMO_MODE=true`.** Con el flag apagado `plazoFirmaMs()`
 *    devuelve 24 horas aunque alguien haya fijado otra cosa antes de apagarlo.
 * 2. **Nunca alarga el plazo**, solo lo acorta. Estirarlo sería cambiarle a la
 *    persona una condición ya informada (fila 30 de la matriz de cumplimiento:
 *    *"Devolver el premio si el cliente no firma dentro del plazo comunicado"*,
 *    Ley 4868/13, arts. 7(f), 17 y 30(b)).
 * 3. **No toca ningún expediente ya vencido ni ya emitido.** El plazo se
 *    congela en `Expediente.plazoFirmaVenceEn` cuando Bancard confirma; cambiar
 *    el valor de acá después no reescribe lo que ya se calculó, solo afecta a
 *    los pagos que se confirmen a partir de ahora.
 *
 * Igual que la persona activa del panel, esto es memoria del proceso: en un
 * despliegue con varias instancias cada una tiene su valor.
 */
import { PLAZO_FIRMA_MS } from "../../domain/pago-p7";

/** Piso: por debajo de esto la pantalla no alcanza ni a dibujar el enlace. */
export const PLAZO_FIRMA_DEMO_MINIMO_MS = 5_000;

/** Opciones que ofrece el panel, en milisegundos. */
export const PLAZOS_FIRMA_DEMO: readonly { readonly ms: number; readonly rotulo: string }[] = [
  { ms: PLAZO_FIRMA_MS, rotulo: "24 horas (real)" },
  { ms: 120_000, rotulo: "2 minutos" },
  { ms: 30_000, rotulo: "30 segundos" },
  { ms: PLAZO_FIRMA_DEMO_MINIMO_MS, rotulo: "5 segundos" },
];

let plazoElegidoMs: number = PLAZO_FIRMA_MS;

function modoDemo(): boolean {
  return process.env.DEMO_MODE === "true";
}

/**
 * Plazo vigente para firmar. Es lo que `DependenciasP7`/`DependenciasP8` reciben
 * como `plazoFirmaMs`, y en modo no-demo son siempre las 24 horas del producto.
 */
export function plazoFirmaMs(): number {
  return modoDemo() ? plazoElegidoMs : PLAZO_FIRMA_MS;
}

export type ResultadoFijarPlazo =
  | { readonly ok: true; readonly plazoMs: number }
  | { readonly ok: false; readonly motivo: "FUERA_DE_MODO_DEMO" | "PLAZO_INVALIDO" };

/** Palanca del panel. Solo acorta, y solo en modo demo. */
export function fijarPlazoFirmaDemo(ms: number): ResultadoFijarPlazo {
  if (!modoDemo()) return { ok: false, motivo: "FUERA_DE_MODO_DEMO" };
  if (!Number.isFinite(ms) || ms < PLAZO_FIRMA_DEMO_MINIMO_MS || ms > PLAZO_FIRMA_MS) {
    return { ok: false, motivo: "PLAZO_INVALIDO" };
  }
  plazoElegidoMs = Math.floor(ms);
  return { ok: true, plazoMs: plazoElegidoMs };
}

/** Deja el plazo como al arrancar el proceso: 24 horas. */
export function reiniciarPlazoFirmaDemo(): void {
  plazoElegidoMs = PLAZO_FIRMA_MS;
}
