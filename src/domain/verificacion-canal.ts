/**
 * Motor de verificación de canal por OTP, compartido por P1 (WhatsApp) y P4
 * (correo).
 *
 * Las dos pantallas tienen la misma mecánica —pedir código, reenviarlo con
 * cooldown, verificarlo, transicionar el expediente y dejar evidencia— y
 * difieren solo en la configuración: propósito, canal, estados de origen y
 * destino, cómo se normaliza y se enmascara el destino, y qué literal se
 * acepta. Esa diferencia vive en `ConfiguracionCanal`; la mecánica vive acá
 * una sola vez.
 *
 * Que el motor sea uno solo NO afloja la regla inviolable #1: los OTP siguen
 * siendo independientes porque cada uno se crea con su propio `proposito` y
 * el repositorio genera un código nuevo por cada `crear`. El motor además
 * rechaza explícitamente un OTP cuyo propósito no sea el de la pantalla que
 * lo está verificando, así que un código de celular no sirve para el correo
 * ni al revés. Ver `__tests__/otp-independientes.test.ts`.
 *
 * Los Route Handlers solo traducen HTTP (cookies, IP, user-agent, códigos de
 * estado) y llaman a estas tres funciones: así la regla de CLAUDE.md "ningún
 * Route Handler modifica el estado directamente" se cumple por construcción,
 * porque la única transición se hace acá vía `transicionarExpediente`.
 *
 * Dependencias declaradas como interfaces estructurales mínimas (no como los
 * tipos concretos de `src/repositories/`) para que este módulo no arrastre al
 * dominio ninguna dependencia de infraestructura: `OtpRepository` y
 * `ExpedienteRepository` las satisfacen tal cual, y los tests pueden pasar
 * dobles en memoria.
 *
 * Regla inviolable #2: ninguno de los tipos de retorno de este módulo tiene
 * un campo donde pueda viajar el código del OTP. El código solo existe entre
 * el repositorio (que lo genera) y el adaptador (que lo entrega).
 */
import { randomUUID } from "node:crypto";
import type { CanalOtp, OtpProvider, PropositoOtp } from "../ports/otp-provider";
import type { EvidenceStore } from "../ports/evidence-store";
import { transicionarExpediente } from "./expediente";
import { COOLDOWN_REENVIO_MS } from "./reglas-otp";
import { crearExpedienteInicial } from "./tipos";
import type { EstadoExpediente, Expediente, RegistroEvidencia } from "./tipos";

// ---------------------------------------------------------------------------
// Dependencias
// ---------------------------------------------------------------------------

/** Datos de la petición HTTP que la evidencia exige (regla inviolable #10). */
export interface ContextoPeticion {
  readonly ip: string;
  readonly dispositivo: string;
  readonly sesionId: string;
}

/** Metadata del OTP que el motor necesita; `OtpRepository` la satisface. */
export interface RegistroOtpMinimo {
  readonly otpId: string;
  readonly expedienteId: string;
  readonly proposito: PropositoOtp;
  readonly destino: string;
  readonly ultimoEnvioEn: string;
  readonly consumidoEn: string | null;
}

export interface LectorMetadataOtp {
  obtener(otpId: string): Promise<RegistroOtpMinimo | null>;
}

/** Subconjunto de `ExpedienteRepository` que usa este motor. */
export interface RepositorioExpediente {
  obtenerPorId(expedienteId: string): Promise<Expediente | null>;
  crear(expediente: Expediente): Promise<void>;
  guardar(expediente: Expediente, actualizadoEnEsperado?: string): Promise<void>;
}

export interface DependenciasVerificacionCanal {
  readonly otpProvider: OtpProvider;
  readonly lectorOtp: LectorMetadataOtp;
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

// ---------------------------------------------------------------------------
// Configuración por pantalla
// ---------------------------------------------------------------------------

export type ResultadoNormalizacionDestino =
  | { readonly ok: true; readonly valor: string }
  | { readonly ok: false };

export interface ConfiguracionCanal {
  /** Regla inviolable #1: cada pantalla tiene su propio propósito de OTP. */
  readonly proposito: PropositoOtp;
  readonly canal: CanalOtp;
  /** Único estado desde el que esta pantalla puede pedir un código. */
  readonly estadoRequerido: EstadoExpediente;
  readonly estadoDestino: EstadoExpediente;
  /** Campo del expediente donde queda asentado el canal verificado. */
  readonly campoCanal: "canalWhatsapp" | "canalEmail";
  readonly normalizar: (entrada: string) => ResultadoNormalizacionDestino;
  readonly enmascarar: (valor: string) => string;
  readonly pasosEvidencia: {
    readonly envio: string;
    readonly reenvio: string;
    readonly verificacion: string;
  };
  /**
   * Versión del literal que se acepta al pedir el código. `null` si la
   * pantalla no pide aceptar nada (P4: el consentimiento de tratamiento de
   * datos ya se tomó en P3).
   */
  readonly versionTextoAceptado: string | null;
  /** `true` si la pantalla tiene un checkbox obligatorio (P1). */
  readonly requiereAutorizacion: boolean;
  /** `true` solo en P1: es la pantalla donde nace el expediente. */
  readonly creaExpediente: boolean;
}

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

/**
 * Bloque `REGISTRO DE SEGURIDAD` que la pantalla muestra al pie: fecha, hora,
 * IP, destino enmascarado, referencia del envío y resultado. "el código no se
 * conserva visible" — y este tipo no tiene dónde ponerlo.
 */
export interface RegistroSeguridadCanal {
  readonly fecha: string; // ISO 8601: fecha y hora
  readonly ip: string;
  readonly destinoEnmascarado: string;
  readonly referenciaEnvio: string | null;
  readonly resultado: "EXITOSO" | "FALLIDO";
}

export type MotivoRechazoEnvio =
  | "AUTORIZACION_REQUERIDA"
  | "DESTINO_INVALIDO"
  | "ESTADO_INVALIDO"
  | "REENVIO_BLOQUEADO"
  | "ERROR_ENVIO";

export type ResultadoEnvioCanal =
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly otpId: string;
      readonly expiraEn: string;
      readonly destinoEnmascarado: string;
      readonly registroSeguridad: RegistroSeguridadCanal;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoEnvio;
      readonly expedienteId: string | null;
      readonly segundosRestantes?: number;
    };

export type MotivoRechazoVerificacion =
  | "OTP_NO_ENCONTRADO"
  | "OTP_DE_OTRO_EXPEDIENTE"
  | "PROPOSITO_INCORRECTO"
  | "CODIGO_INCORRECTO"
  | "INTENTOS_AGOTADOS"
  | "EXPIRADO"
  | "YA_UTILIZADO"
  | "ESTADO_INVALIDO";

export type ResultadoVerificacionCanal =
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly estado: Expediente["estado"];
      readonly destinoEnmascarado: string;
      readonly registroSeguridad: RegistroSeguridadCanal;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoVerificacion;
      readonly intentosRestantes?: number;
    };

// ---------------------------------------------------------------------------
// Evidencia
// ---------------------------------------------------------------------------

/**
 * Serializa los datos propios del paso en el campo `detalle` de
 * `RegistroEvidencia`. Solo entran valores ya seguros de registrar: destino
 * enmascarado, referencia de envío y motivo. El código nunca llega acá — no
 * hay ningún camino desde el que se lo pueda pasar.
 */
function formatearDetalle(datos: Readonly<Record<string, string | number>>): string {
  return Object.entries(datos)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(" · ");
}

interface Reloj {
  readonly ahora: () => string;
  readonly nuevoId: () => string;
}

function resolverReloj(deps: DependenciasVerificacionCanal): Reloj {
  return {
    ahora: deps.ahora ?? (() => new Date().toISOString()),
    nuevoId: deps.nuevoId ?? (() => randomUUID()),
  };
}

async function registrarEvidencia(
  deps: DependenciasVerificacionCanal,
  reloj: Reloj,
  entrada: {
    expedienteId: string;
    paso: string;
    fecha: string;
    contexto: ContextoPeticion;
    resultado: "EXITOSO" | "FALLIDO";
    versionTextoAceptado: string | null;
    detalle: Readonly<Record<string, string | number>>;
  },
): Promise<void> {
  const registro: RegistroEvidencia = {
    id: reloj.nuevoId(),
    expedienteId: entrada.expedienteId,
    paso: entrada.paso,
    fecha: entrada.fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    versionTextoAceptado: entrada.versionTextoAceptado,
    // Las pantallas de canal registran la versión del literal, no el
    // literal: el texto completo se guarda donde hay consentimiento de
    // tratamiento de datos (P3).
    textoAceptado: null,
    resultado: entrada.resultado,
    detalle: formatearDetalle(entrada.detalle),
  };
  await deps.evidencias.guardar(registro);
}

// ---------------------------------------------------------------------------
// Casos de uso
// ---------------------------------------------------------------------------

export interface EntradaEnvioCanal {
  /** `null` la primera vez en P1: se crea el expediente en INICIADO. */
  readonly expedienteId: string | null;
  /** OTP anterior de esta sesión, si lo hay: sirve para aplicar el cooldown. */
  readonly otpIdPrevio: string | null;
  readonly destinoIngresado: string;
  /** Solo lo mira la pantalla que tiene checkbox obligatorio. */
  readonly autorizacionAceptada: boolean;
  readonly contexto: ContextoPeticion;
}

/**
 * Paso 1 de la pantalla: valida el destino, crea el expediente si la
 * configuración lo permite y dispara el envío del OTP de canal.
 */
export async function enviarOtpDeCanal(
  config: ConfiguracionCanal,
  deps: DependenciasVerificacionCanal,
  entrada: EntradaEnvioCanal,
): Promise<ResultadoEnvioCanal> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();

  if (config.requiereAutorizacion && !entrada.autorizacionAceptada) {
    return { ok: false, motivo: "AUTORIZACION_REQUERIDA", expedienteId: entrada.expedienteId };
  }

  const destino = config.normalizar(entrada.destinoIngresado);
  if (!destino.ok) {
    return { ok: false, motivo: "DESTINO_INVALIDO", expedienteId: entrada.expedienteId };
  }
  const destinoEnmascarado = config.enmascarar(destino.valor);

  let expediente: Expediente;
  if (entrada.expedienteId) {
    const existente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
    if (!existente) {
      return { ok: false, motivo: "ESTADO_INVALIDO", expedienteId: entrada.expedienteId };
    }
    // Solo se puede pedir un código mientras el canal no esté verificado.
    if (existente.estado !== config.estadoRequerido) {
      await registrarEvidencia(deps, reloj, {
        expedienteId: existente.id,
        paso: config.pasosEvidencia.envio,
        fecha,
        contexto: entrada.contexto,
        resultado: "FALLIDO",
        versionTextoAceptado: config.versionTextoAceptado,
        detalle: { destinoEnmascarado, motivo: "ESTADO_INVALIDO", estado: existente.estado },
      });
      return { ok: false, motivo: "ESTADO_INVALIDO", expedienteId: existente.id };
    }
    expediente = existente;
  } else {
    // Sin expediente previo: solo P1 puede crearlo (P0 es informativa y no
    // genera nada). En P4 llegar acá significa que se perdió la sesión.
    if (!config.creaExpediente) {
      return { ok: false, motivo: "ESTADO_INVALIDO", expedienteId: null };
    }
    expediente = crearExpedienteInicial({ id: reloj.nuevoId(), ahora: fecha });
    await deps.expedientes.crear(expediente);
  }

  // Cooldown de 60s también en el envío: sin esto, pedir un código nuevo
  // desde cero sería una forma trivial de saltear el bloqueo del reenvío
  // (regla inviolable #1).
  if (entrada.otpIdPrevio) {
    const previo = await deps.lectorOtp.obtener(entrada.otpIdPrevio);
    if (
      previo &&
      previo.expedienteId === expediente.id &&
      previo.proposito === config.proposito &&
      !previo.consumidoEn
    ) {
      const transcurrido = new Date(fecha).getTime() - new Date(previo.ultimoEnvioEn).getTime();
      if (transcurrido < COOLDOWN_REENVIO_MS) {
        return {
          ok: false,
          motivo: "REENVIO_BLOQUEADO",
          expedienteId: expediente.id,
          segundosRestantes: Math.ceil((COOLDOWN_REENVIO_MS - transcurrido) / 1000),
        };
      }
    }
  }

  const envio = await deps.otpProvider.enviarOtp({
    expedienteId: expediente.id,
    proposito: config.proposito,
    destino: { canal: config.canal, valor: destino.valor },
  });

  if (!envio.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: config.pasosEvidencia.envio,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      versionTextoAceptado: config.versionTextoAceptado,
      detalle: { destinoEnmascarado, motivo: envio.motivo },
    });
    return envio.motivo === "REENVIO_BLOQUEADO"
      ? {
          ok: false,
          motivo: "REENVIO_BLOQUEADO",
          expedienteId: expediente.id,
          segundosRestantes: envio.segundosRestantes,
        }
      : { ok: false, motivo: "ERROR_ENVIO", expedienteId: expediente.id };
  }

  await registrarEvidencia(deps, reloj, {
    expedienteId: expediente.id,
    paso: config.pasosEvidencia.envio,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    versionTextoAceptado: config.versionTextoAceptado,
    detalle: { destinoEnmascarado, referenciaEnvio: envio.referenciaEnvio },
  });

  return {
    ok: true,
    expedienteId: expediente.id,
    otpId: envio.otpId,
    expiraEn: envio.expiraEn,
    destinoEnmascarado,
    registroSeguridad: {
      fecha,
      ip: entrada.contexto.ip,
      destinoEnmascarado,
      referenciaEnvio: envio.referenciaEnvio,
      resultado: "EXITOSO",
    },
  };
}

export interface EntradaReenvioCanal {
  readonly expedienteId: string;
  readonly otpId: string;
  readonly contexto: ContextoPeticion;
}

/** Enlace `Reenviar código`. Sujeto al bloqueo de 60 segundos. */
export async function reenviarOtpDeCanal(
  config: ConfiguracionCanal,
  deps: DependenciasVerificacionCanal,
  entrada: EntradaReenvioCanal,
): Promise<ResultadoEnvioCanal> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();

  const previo = await deps.lectorOtp.obtener(entrada.otpId);
  if (
    !previo ||
    previo.expedienteId !== entrada.expedienteId ||
    previo.proposito !== config.proposito
  ) {
    return { ok: false, motivo: "ERROR_ENVIO", expedienteId: entrada.expedienteId };
  }
  const destinoEnmascarado = config.enmascarar(previo.destino);

  const envio = await deps.otpProvider.reenviarOtp(entrada.otpId);

  if (!envio.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: config.pasosEvidencia.reenvio,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      versionTextoAceptado: null,
      detalle: { destinoEnmascarado, motivo: envio.motivo },
    });
    return envio.motivo === "REENVIO_BLOQUEADO"
      ? {
          ok: false,
          motivo: "REENVIO_BLOQUEADO",
          expedienteId: entrada.expedienteId,
          segundosRestantes: envio.segundosRestantes,
        }
      : { ok: false, motivo: "ERROR_ENVIO", expedienteId: entrada.expedienteId };
  }

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: config.pasosEvidencia.reenvio,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    versionTextoAceptado: null,
    detalle: { destinoEnmascarado, referenciaEnvio: envio.referenciaEnvio },
  });

  return {
    ok: true,
    expedienteId: entrada.expedienteId,
    otpId: envio.otpId,
    expiraEn: envio.expiraEn,
    destinoEnmascarado,
    registroSeguridad: {
      fecha,
      ip: entrada.contexto.ip,
      destinoEnmascarado,
      referenciaEnvio: envio.referenciaEnvio,
      resultado: "EXITOSO",
    },
  };
}

export interface EntradaVerificacionCanal {
  readonly expedienteId: string;
  readonly otpId: string;
  readonly codigoIngresado: string;
  readonly contexto: ContextoPeticion;
}

/**
 * Paso 2 de la pantalla: verifica el código y, solo si es correcto,
 * transiciona el expediente registrando como canal verificado el mismo
 * destino al que se envió el código (nunca uno declarado por el cliente en
 * esta petición).
 */
export async function verificarOtpDeCanal(
  config: ConfiguracionCanal,
  deps: DependenciasVerificacionCanal,
  entrada: EntradaVerificacionCanal,
): Promise<ResultadoVerificacionCanal> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();

  const registroOtp = await deps.lectorOtp.obtener(entrada.otpId);
  if (!registroOtp) return { ok: false, motivo: "OTP_NO_ENCONTRADO" };
  if (registroOtp.expedienteId !== entrada.expedienteId) {
    return { ok: false, motivo: "OTP_DE_OTRO_EXPEDIENTE" };
  }
  // Regla inviolable #1: un OTP nunca se reutiliza para otro propósito. Este
  // rechazo es el que hace que el código del celular no sirva para el correo
  // ni al revés, aunque ambos vivan en el mismo expediente y el motor sea el
  // mismo. Se comprueba ANTES de llamar al proveedor, así un intento cruzado
  // ni siquiera gasta uno de los 3 intentos del OTP legítimo.
  if (registroOtp.proposito !== config.proposito) {
    return { ok: false, motivo: "PROPOSITO_INCORRECTO" };
  }

  const destinoEnmascarado = config.enmascarar(registroOtp.destino);

  const verificacion = await deps.otpProvider.verificarOtp({
    otpId: entrada.otpId,
    codigoIngresado: entrada.codigoIngresado,
  });

  if (!verificacion.ok) {
    const intentosRestantes =
      verificacion.motivo === "CODIGO_INCORRECTO" ? verificacion.intentosRestantes : undefined;

    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: config.pasosEvidencia.verificacion,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      versionTextoAceptado: null,
      detalle: {
        destinoEnmascarado,
        motivo: verificacion.motivo,
        ...(intentosRestantes === undefined ? {} : { intentosRestantes }),
      },
    });

    const motivo: MotivoRechazoVerificacion =
      verificacion.motivo === "NO_ENCONTRADO" ? "OTP_NO_ENCONTRADO" : verificacion.motivo;
    return { ok: false, motivo, ...(intentosRestantes === undefined ? {} : { intentosRestantes }) };
  }

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "ESTADO_INVALIDO" };

  // Única transición del paso, validada por la máquina de estados.
  const transicion = transicionarExpediente(
    expediente,
    config.estadoDestino,
    { [config.campoCanal]: { valor: registroOtp.destino, verificadoEn: fecha } },
    fecha,
  );

  if (!transicion.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: config.pasosEvidencia.verificacion,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      versionTextoAceptado: null,
      detalle: { destinoEnmascarado, motivo: "ESTADO_INVALIDO", estado: expediente.estado },
    });
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: config.pasosEvidencia.verificacion,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    versionTextoAceptado: config.versionTextoAceptado,
    detalle: { destinoEnmascarado, estado: transicion.expediente.estado },
  });

  return {
    ok: true,
    expedienteId: entrada.expedienteId,
    estado: transicion.expediente.estado,
    destinoEnmascarado,
    registroSeguridad: {
      fecha,
      ip: entrada.contexto.ip,
      destinoEnmascarado,
      referenciaEnvio: null,
      resultado: "EXITOSO",
    },
  };
}
