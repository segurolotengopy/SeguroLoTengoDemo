/**
 * Acelerador del plazo de pago para la demostración (CLAUDE.md → "Panel de
 * demo").
 *
 * El plazo real son 24 horas (`PLAZO_PAGO_MS` en `src/domain/firma-p8.ts`,
 * D-10). Sin esta palanca no habría forma de mostrar la caducidad en una
 * reunión: habría que firmar y volver al día siguiente.
 *
 * **Se llamaba "plazo de firma" hasta la inversión de firma y pago** (D-08).
 * Medía el tiempo para firmar algo ya pagado; ahora mide el tiempo para pagar
 * algo ya firmado. La palanca es la misma y el candado también; lo que cambió
 * es qué caduca.
 *
 * Tres candados para que esto no sea una puerta trasera:
 *
 * 1. **Solo con `DEMO_MODE=true`.** Con el flag apagado `plazoPagoMs()`
 *    devuelve 24 horas aunque alguien haya fijado otra cosa antes de apagarlo.
 * 2. **Nunca alarga el plazo**, solo lo acorta. Estirarlo sería cambiarle a la
 *    persona una condición ya informada (fila 30 de la matriz de cumplimiento:
 *    *"Devolver el premio si el cliente no firma dentro del plazo comunicado"*,
 *    Ley 4868/13, arts. 7(f), 17 y 30(b)).
 * 3. **No toca ningún expediente ya vencido ni ya emitido.** El plazo se
 *    congela en `Expediente.plazoPagoVenceEn` al aplicarse las firmas
 *    institucionales; cambiar el valor de acá después no reescribe lo ya
 *    calculado, solo afecta a las firmas que se completen a partir de ahora.
 *
 * Igual que la persona activa del panel, esto es memoria del proceso: en un
 * despliegue con varias instancias cada una tiene su valor.
 */
import { PLAZO_PAGO_MS } from "../../domain/firma-p8";
import { estadoCompartidoDemo } from "./estado-compartido";

/** Piso: por debajo de esto la pantalla no alcanza ni a dibujar el medio de cobro. */
export const PLAZO_PAGO_DEMO_MINIMO_MS = 5_000;

/** Opciones que ofrece el panel, en milisegundos. */
export const PLAZOS_PAGO_DEMO: readonly { readonly ms: number; readonly rotulo: string }[] = [
  { ms: PLAZO_PAGO_MS, rotulo: "24 horas (real)" },
  { ms: 120_000, rotulo: "2 minutos" },
  { ms: 30_000, rotulo: "30 segundos" },
  { ms: PLAZO_PAGO_DEMO_MINIMO_MS, rotulo: "5 segundos" },
];

const caja = estadoCompartidoDemo("plazo-pago.elegido", () => ({
  plazoElegidoMs: PLAZO_PAGO_MS,
}));

function modoDemo(): boolean {
  return process.env.DEMO_MODE === "true";
}

/**
 * Plazo vigente para pagar. Es lo que `DependenciasP8` recibe como
 * `plazoPagoMs`, y en modo no-demo son siempre las 24 horas del producto.
 */
export function plazoPagoMs(): number {
  return modoDemo() ? caja.plazoElegidoMs : PLAZO_PAGO_MS;
}

export type ResultadoFijarPlazo =
  | { readonly ok: true; readonly plazoMs: number }
  | { readonly ok: false; readonly motivo: "FUERA_DE_MODO_DEMO" | "PLAZO_INVALIDO" };

/** Palanca del panel. Solo acorta, y solo en modo demo. */
export function fijarPlazoPagoDemo(ms: number): ResultadoFijarPlazo {
  if (!modoDemo()) return { ok: false, motivo: "FUERA_DE_MODO_DEMO" };
  if (!Number.isFinite(ms) || ms < PLAZO_PAGO_DEMO_MINIMO_MS || ms > PLAZO_PAGO_MS) {
    return { ok: false, motivo: "PLAZO_INVALIDO" };
  }
  caja.plazoElegidoMs = Math.floor(ms);
  return { ok: true, plazoMs: caja.plazoElegidoMs };
}

/** Deja el plazo como al arrancar el proceso: 24 horas. */
export function reiniciarPlazoPagoDemo(): void {
  caja.plazoElegidoMs = PLAZO_PAGO_MS;
}
