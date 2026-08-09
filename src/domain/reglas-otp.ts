/**
 * Parámetros de la regla de negocio inviolable #1 (CLAUDE.md): 6 dígitos,
 * uso único, vigencia 5 minutos, máximo 3 intentos, reenvío bloqueado 60
 * segundos. Los mismos valores figuran en
 * docs/ESPECIFICACION_PANTALLAS.md → P1, "Reglas".
 *
 * Viven en el dominio y sin ninguna dependencia para que los use tanto el
 * repositorio (que las hace cumplir contra DynamoDB) como los casos de uso y
 * la UI (que muestra el contador de reenvío y los intentos restantes), sin
 * que ninguna capa tenga que redefinirlas y se desincronicen.
 */

export const VIGENCIA_OTP_MS = 5 * 60 * 1000;
export const INTENTOS_MAXIMOS_OTP = 3;
export const COOLDOWN_REENVIO_MS = 60 * 1000;
export const LONGITUD_CODIGO_OTP = 6;
