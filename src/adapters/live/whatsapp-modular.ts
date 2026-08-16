/**
 * Cliente HTTP del `otp-service` de WhatsApp-Modular (ítem 3 de
 * `docs/Tabla de Integraciones externas - Tabla.csv`: módulo propio del
 * proyecto, repo `segurolotengopy/WhatsAppModular`, conexión directa a Meta
 * WhatsApp Cloud API).
 *
 * Contrato consumido (docs/01-arquitectura.md §5 de ese repo, y
 * `packages/otp-service/src/http/app.ts`):
 *
 *   POST /v1/otp/request  → 202 {otpId, channel, maskedTo, expiresAt, ...}
 *   POST /v1/otp/verify   → 200 {verified: true}
 *
 * Los errores llegan como `application/problem+json` (RFC 9457) con código
 * estable `WM-xxxx`. Este cliente traduce ese contrato a uniones discriminadas
 * y NO decide nada de negocio: el mapeo hacia `OtpProvider` vive en
 * `live/otp-provider.ts`.
 *
 * Regla inviolable #2: el código del OTP nunca aparece en ninguna respuesta
 * de WhatsApp-Modular (es su prohibición dura #1) ni en los tipos de este
 * cliente. Lo genera y lo guarda (hasheado) el propio servicio; acá solo
 * viajan identificadores opacos y el código que la persona tipea al verificar.
 *
 * La política de OTP de WhatsApp-Modular es idéntica a la regla inviolable #1
 * de este proyecto (6 dígitos, 5 minutos, 3 intentos, cooldown 60 s), así que
 * delegarle la generación y la verificación no afloja ninguna regla.
 */

/** Propósitos que expone el `otp-service`. Independientes entre sí (su T9). */
export type PropositoWhatsAppModular = "PHONE_VERIFICATION" | "SIGNATURE_P7A";

export interface ConfiguracionClienteWm {
  /** Origen del servicio, sin barra final. Ej.: `http://127.0.0.1:8080`. */
  readonly baseUrl: string;
  /**
   * Bearer de la API (Fase 0: token compartido; Fase 1: JWT).
   *
   * Admite una función además de un valor porque desplegado el token vive en
   * Secrets Manager y no en el entorno: resolverlo dentro de la llamada —que
   * ya es asíncrona— evita volver asíncrono al composition root entero, que es
   * síncrono a propósito. El resultado no se cachea acá; de eso se ocupa
   * `obtenerSecretosApp`, que cachea la promesa del secret completo.
   */
  readonly token: string | (() => Promise<string>);
  /** Inyectable para tests: nunca se hace red real en la suite. */
  readonly fetchFn?: typeof fetch;
  readonly timeoutMs?: number;
}

export type RespuestaSolicitudWm =
  | {
      readonly ok: true;
      readonly otpId: string;
      readonly expiraEn: string;
      readonly destinoEnmascarado: string;
    }
  | { readonly ok: false; readonly motivo: "COOLDOWN"; readonly segundosRestantes: number }
  | { readonly ok: false; readonly motivo: "ERROR"; readonly detalle: string };

export type RespuestaVerificacionWm =
  | { readonly ok: true }
  | { readonly ok: false; readonly motivo: "CODIGO_INCORRECTO"; readonly intentosRestantes: number }
  | { readonly ok: false; readonly motivo: "EXPIRADO" }
  | { readonly ok: false; readonly motivo: "INTENTOS_AGOTADOS" }
  | { readonly ok: false; readonly motivo: "ERROR"; readonly detalle: string };

export interface SolicitudOtpWm {
  /** E.164 con `+` (solo +595/+591: lo valida el servicio, no este cliente). */
  readonly telefonoE164: string;
  readonly proposito: PropositoWhatsAppModular;
  /** Una clave nueva por envío: repetirla devuelve el MISMO envío (su caché de 1 h). */
  readonly idempotencyKey: string;
}

export interface VerificacionOtpWm {
  readonly otpId: string;
  readonly codigo: string;
}

export interface ClienteWhatsAppModular {
  solicitarOtp(solicitud: SolicitudOtpWm): Promise<RespuestaSolicitudWm>;
  verificarOtp(verificacion: VerificacionOtpWm): Promise<RespuestaVerificacionWm>;
}

/** Forma del `application/problem+json` que emite el servicio. */
interface ProblemaWm {
  readonly code?: string;
  readonly title?: string;
  readonly retryInMs?: number;
  readonly attemptsLeft?: number;
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function leerProblema(cuerpo: unknown): ProblemaWm {
  if (!esRegistro(cuerpo)) return {};
  return {
    code: typeof cuerpo.code === "string" ? cuerpo.code : undefined,
    title: typeof cuerpo.title === "string" ? cuerpo.title : undefined,
    retryInMs: typeof cuerpo.retryInMs === "number" ? cuerpo.retryInMs : undefined,
    attemptsLeft: typeof cuerpo.attemptsLeft === "number" ? cuerpo.attemptsLeft : undefined,
  };
}

/**
 * Detalle apto para evidencia y logs: código estable + título. Los mensajes de
 * WhatsApp-Modular nunca contienen el OTP ni teléfonos sin enmascarar (regla
 * de mensajes de su `AppError`), así que registrar el título es seguro.
 */
function detalleDe(problema: ProblemaWm, status: number): string {
  return `${problema.code ?? "HTTP_" + String(status)}: ${problema.title ?? "sin detalle"}`;
}

export function crearClienteWhatsAppModular(config: ConfiguracionClienteWm): ClienteWhatsAppModular {
  const fetchFn = config.fetchFn ?? fetch;
  const timeoutMs = config.timeoutMs ?? 5_000;
  const base = config.baseUrl.replace(/\/+$/, "");

  async function post(
    ruta: string,
    cuerpo: Record<string, unknown>,
    encabezadosExtra: Record<string, string> = {},
  ): Promise<{ status: number; cuerpo: unknown } | { status: null; detalle: string }> {
    try {
      const token = typeof config.token === "string" ? config.token : await config.token();
      const respuesta = await fetchFn(`${base}${ruta}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          ...encabezadosExtra,
        },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const texto = await respuesta.text();
      let parseado: unknown = null;
      try {
        parseado = texto === "" ? null : JSON.parse(texto);
      } catch {
        parseado = null;
      }
      return { status: respuesta.status, cuerpo: parseado };
    } catch (error) {
      const detalle = error instanceof Error ? error.name : "ERROR_DE_RED";
      return { status: null, detalle: `SIN_RESPUESTA: ${detalle}` };
    }
  }

  return {
    async solicitarOtp(solicitud: SolicitudOtpWm): Promise<RespuestaSolicitudWm> {
      const resultado = await post(
        "/v1/otp/request",
        {
          phone: solicitud.telefonoE164,
          purpose: solicitud.proposito,
          locale: "es_PY",
          channel: "AUTO",
        },
        { "idempotency-key": solicitud.idempotencyKey },
      );

      if (resultado.status === null) {
        return { ok: false, motivo: "ERROR", detalle: resultado.detalle };
      }

      if (resultado.status === 202 && esRegistro(resultado.cuerpo)) {
        const { otpId, expiresAt, maskedTo } = resultado.cuerpo;
        if (typeof otpId === "string" && typeof expiresAt === "string") {
          return {
            ok: true,
            otpId,
            expiraEn: expiresAt,
            destinoEnmascarado: typeof maskedTo === "string" ? maskedTo : "",
          };
        }
        return { ok: false, motivo: "ERROR", detalle: "RESPUESTA_INVALIDA: 202 sin otpId/expiresAt" };
      }

      const problema = leerProblema(resultado.cuerpo);
      // WM-1020: reenvío antes del cooldown de 60 s. Es la misma regla que el
      // bloqueo de reenvío local (regla inviolable #1), aplicada por el servicio.
      if (problema.code === "WM-1020") {
        const retryInMs = problema.retryInMs ?? 60_000;
        return { ok: false, motivo: "COOLDOWN", segundosRestantes: Math.ceil(retryInMs / 1000) };
      }
      return { ok: false, motivo: "ERROR", detalle: detalleDe(problema, resultado.status) };
    },

    async verificarOtp(verificacion: VerificacionOtpWm): Promise<RespuestaVerificacionWm> {
      const resultado = await post("/v1/otp/verify", {
        otpId: verificacion.otpId,
        code: verificacion.codigo,
      });

      if (resultado.status === null) {
        return { ok: false, motivo: "ERROR", detalle: resultado.detalle };
      }

      if (resultado.status === 200 && esRegistro(resultado.cuerpo) && resultado.cuerpo.verified === true) {
        return { ok: true };
      }

      const problema = leerProblema(resultado.cuerpo);

      // WM-1050: código incorrecto, con intentos restantes.
      if (problema.code === "WM-1050") {
        return {
          ok: false,
          motivo: "CODIGO_INCORRECTO",
          intentosRestantes: problema.attemptsLeft ?? 0,
        };
      }

      // WM-1060: el OTP ya no es verificable. El contrato usa un solo código
      // para "venció" y "quedó bloqueado por intentos" (`OtpGoneError`), y el
      // motivo solo se distingue por el título. Es frágil a propósito de su
      // anti-enumeración: ante duda se informa EXPIRADO, que es también lo que
      // el servicio responde para un otpId inexistente (su caso 17).
      if (problema.code === "WM-1060") {
        const bloqueado = (problema.title ?? "").toLowerCase().includes("bloqueado");
        return bloqueado ? { ok: false, motivo: "INTENTOS_AGOTADOS" } : { ok: false, motivo: "EXPIRADO" };
      }

      return { ok: false, motivo: "ERROR", detalle: detalleDe(problema, resultado.status) };
    },
  };
}

/**
 * Configuración desde el entorno.
 *
 * `WHATSAPP_MODULAR_URL` es obligatoria siempre: no es un secreto, es a dónde
 * se apunta, y fallar acá con el nombre de la variable es mejor que un fetch a
 * `undefined` en el primer envío.
 *
 * El **token** tiene dos orígenes, en este orden:
 *
 * 1. `WHATSAPP_MODULAR_TOKEN` del entorno — el camino de desarrollo local,
 *    donde vive en `.env.local` y nunca en el repo.
 * 2. `tokenDeRespaldo` — el camino desplegado, donde el bearer está en Secrets
 *    Manager. Se pasa como función y se resuelve dentro de cada llamada.
 *
 * El orden importa: con la variable presente gana ella, así una prueba local
 * contra el dry-run no depende de que Secrets Manager tenga nada.
 *
 * En el dry-run local de WhatsApp-Modular el bearer por defecto del servicio
 * es `dev-bearer-token` (sus DEV_DEFAULTS) — el valor igual se pasa explícito
 * por entorno: este módulo no incrusta credenciales, ni siquiera de desarrollo.
 */
export function crearClienteWhatsAppModularDesdeEntorno(
  entorno: Readonly<Record<string, string | undefined>> = process.env,
  tokenDeRespaldo?: () => Promise<string>,
): ClienteWhatsAppModular {
  const baseUrl = entorno.WHATSAPP_MODULAR_URL;
  const token = entorno.WHATSAPP_MODULAR_TOKEN ?? tokenDeRespaldo;

  if (!baseUrl || !token) {
    const faltantes = [
      ...(baseUrl ? [] : ["WHATSAPP_MODULAR_URL"]),
      ...(token ? [] : ["WHATSAPP_MODULAR_TOKEN (entorno o Secrets Manager)"]),
    ].join(", ");
    throw new Error(
      `INTEGRATION_OTP=live requiere configurar ${faltantes} (otp-service de WhatsApp-Modular).`,
    );
  }
  return crearClienteWhatsAppModular({ baseUrl, token });
}
