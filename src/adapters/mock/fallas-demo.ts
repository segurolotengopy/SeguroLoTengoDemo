/**
 * Fallos puntuales que el panel de demo puede forzar (CLAUDE.md → "Panel de
 * demo": *"forzar fallos puntuales (OTP expirado, intentos agotados, timeout
 * de Bancard, rechazo de Code100)"*).
 *
 * Son los cuatro de CLAUDE.md más uno —`BANCARD_CAPTURA_FALLIDA`— que agregó la
 * auditoría de cumplimiento de P8/P9: es la única forma de ejercitar en vivo la
 * fila 44 de la matriz (*"Si falla el cobro, no solicitar la emisión
 * automática"*), que sin palanca quedaba probada solo por tests. No es una
 * lista abierta: cada una existe para mostrar un desenlace concreto.
 *
 * ## Son de un solo uso
 *
 * Una falla armada se **consume** en el primer intento que la encuentra. Es lo
 * que hace que la demostración pueda seguir: se muestra el error, la persona
 * reintenta y el segundo intento funciona, que es justo lo que hay que enseñar.
 * Una palanca pegada obligaría a volver al panel a apagarla.
 *
 * ## Ninguna inventa un camino
 *
 * Cada falla usa el mecanismo real, no una rama especial del código:
 *
 * - `OTP_EXPIRADO` crea el OTP con la hora corrida hacia atrás, así nace
 *   vencido y lo rechaza la misma validación de vigencia de siempre.
 * - `OTP_INTENTOS_AGOTADOS` quema los tres intentos contra el repositorio real,
 *   con códigos incorrectos.
 * - `BANCARD_TIMEOUT` y `CODE100_RECHAZO` entran por el `fallaForzada` que los
 *   adaptadores mock de pago y firma ya exponían.
 *
 * Igual que la persona activa y el plazo de firma, esto es memoria del proceso
 * y solo funciona con `DEMO_MODE=true`.
 */

import { estadoCompartidoDemo } from "./estado-compartido";

export type FallaDemo =
  | "OTP_EXPIRADO"
  | "OTP_INTENTOS_AGOTADOS"
  | "BANCARD_TIMEOUT"
  | "BANCARD_CAPTURA_FALLIDA"
  | "CODE100_RECHAZO";

export const FALLAS_DEMO: readonly FallaDemo[] = [
  "OTP_EXPIRADO",
  "OTP_INTENTOS_AGOTADOS",
  "BANCARD_TIMEOUT",
  "BANCARD_CAPTURA_FALLIDA",
  "CODE100_RECHAZO",
];

/** Rótulos y explicación para el panel; no se usan en el flujo P0–P9. */
export const DESCRIPCION_FALLA_DEMO: Readonly<
  Record<FallaDemo, { readonly rotulo: string; readonly donde: string; readonly efecto: string }>
> = {
  OTP_EXPIRADO: {
    rotulo: "OTP expirado",
    donde: "P1 o P4, al pedir el código",
    efecto: "El próximo código nace vencido: al verificarlo, la pantalla informa que expiró.",
  },
  OTP_INTENTOS_AGOTADOS: {
    rotulo: "3 intentos agotados",
    donde: "P1 o P4, al pedir el código",
    efecto: "El próximo código llega con los tres intentos ya quemados: hay que reenviar.",
  },
  BANCARD_TIMEOUT: {
    rotulo: "Timeout de Bancard",
    donde: "P7, al generar el QR o abrir el formulario",
    efecto:
      "Bancard no responde. El reintento reutiliza la misma clave de idempotencia, así que no cobra dos veces.",
  },
  BANCARD_CAPTURA_FALLIDA: {
    rotulo: "Falla la captura de Bancard",
    donde: "P8, al confirmarse la firma con tarjeta de crédito",
    efecto:
      "La firma queda registrada pero el cobro no. P8 no deja pasar a P9 y reintenta: sin cobro no se pide la emisión (fila 44).",
  },
  CODE100_RECHAZO: {
    rotulo: "Rechazo de Code100",
    donde: "P8, al enviar el enlace de firma",
    efecto: "Code100 rechaza la apertura del acto. No queda ningún documento firmado.",
  },
};

export function esFallaDemo(valor: unknown): valor is FallaDemo {
  return FALLAS_DEMO.some((falla) => falla === valor);
}

const armadas = estadoCompartidoDemo("fallas.armadas", () => new Set<FallaDemo>());

function modoDemo(): boolean {
  return process.env.DEMO_MODE === "true";
}

export function fallasArmadasDemo(): readonly FallaDemo[] {
  return modoDemo() ? FALLAS_DEMO.filter((falla) => armadas.has(falla)) : [];
}

export type ResultadoArmarFalla =
  | { readonly ok: true; readonly armadas: readonly FallaDemo[] }
  | { readonly ok: false; readonly motivo: "FUERA_DE_MODO_DEMO" };

export function armarFallaDemo(falla: FallaDemo, activa: boolean): ResultadoArmarFalla {
  if (!modoDemo()) return { ok: false, motivo: "FUERA_DE_MODO_DEMO" };
  if (activa) armadas.add(falla);
  else armadas.delete(falla);
  return { ok: true, armadas: fallasArmadasDemo() };
}

/**
 * ¿Hay que fallar acá? Devuelve `true` una sola vez por armado: la falla queda
 * consumida, así el reintento de la persona funciona.
 */
export function consumirFallaDemo(falla: FallaDemo): boolean {
  if (!modoDemo() || !armadas.has(falla)) return false;
  armadas.delete(falla);
  return true;
}

/** Deja el tablero sin ninguna falla armada. */
export function reiniciarFallasDemo(): void {
  armadas.clear();
}
