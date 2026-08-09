/**
 * Caso de uso de P1 · Verificación de WhatsApp
 * (docs/ESPECIFICACION_PANTALLAS.md → "P1 · Paso 1 de 9").
 *
 * Acá vive toda la lógica del paso: validación del número, cooldown de
 * reenvío, atadura entre el canal que recibió el código y el que queda
 * verificado, transición del expediente y escritura de evidencia. Los Route
 * Handlers solo traducen HTTP (cookies, IP, user-agent, códigos de estado) y
 * llaman a estas tres funciones — así la regla de CLAUDE.md "ningún Route
 * Handler modifica el estado directamente" se cumple por construcción: la
 * única transición se hace acá, vía `transicionarExpediente`.
 *
 * Dependencias declaradas como interfaces estructurales mínimas (no como los
 * tipos concretos de `src/repositories/`) para que este módulo no arrastre
 * al dominio ninguna dependencia de infraestructura: `OtpRepository` y
 * `ExpedienteRepository` las satisfacen tal cual, y los tests pueden pasar
 * dobles en memoria.
 *
 * Regla inviolable #2: ninguno de los tipos de retorno de este módulo tiene
 * un campo donde pueda viajar el código del OTP. El código solo existe entre
 * el repositorio (que lo genera) y el adaptador (que lo entrega).
 */
import { randomUUID } from "node:crypto";
import type { EvidenceStore } from "../ports/evidence-store";
import type { OtpProvider, PropositoOtp } from "../ports/otp-provider";
import { transicionarExpediente } from "./expediente";
import { COOLDOWN_REENVIO_MS } from "./reglas-otp";
import { enmascararCelular, normalizarCelularParaguayo } from "./telefono";
// Los literales viven aparte (`textos-p1.ts`) para que la pantalla pueda
// mostrarlos sin importar este módulo de servidor. Se re-exportan porque la
// evidencia de este paso los usa y quien lea el caso de uso los espera acá.
import { TEXTO_AUTORIZACION_P1, VERSION_TEXTO_AUTORIZACION_P1 } from "./textos-p1";
import { crearExpedienteInicial } from "./tipos";
import type { Expediente, RegistroEvidencia } from "./tipos";

export { TEXTO_AUTORIZACION_P1, VERSION_TEXTO_AUTORIZACION_P1 };

export const PASO_EVIDENCIA_ENVIO = "P1_OTP_WHATSAPP_ENVIO";
export const PASO_EVIDENCIA_REENVIO = "P1_OTP_WHATSAPP_REENVIO";
export const PASO_EVIDENCIA_VERIFICACION = "P1_OTP_WHATSAPP_VERIFICACION";

const PROPOSITO_P1: PropositoOtp = "VERIFICACION_CELULAR";

// ---------------------------------------------------------------------------
// Dependencias
// ---------------------------------------------------------------------------

/** Datos de la petición HTTP que la evidencia exige (regla inviolable #10). */
export interface ContextoPeticion {
  readonly ip: string;
  readonly dispositivo: string;
  readonly sesionId: string;
}

/** Metadata del OTP que el caso de uso necesita; `OtpRepository` la satisface. */
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

/** Subconjunto de `ExpedienteRepository` que usa este caso de uso. */
export interface RepositorioExpediente {
  obtenerPorId(expedienteId: string): Promise<Expediente | null>;
  crear(expediente: Expediente): Promise<void>;
  guardar(expediente: Expediente, actualizadoEnEsperado?: string): Promise<void>;
}

export interface DependenciasP1 {
  readonly otpProvider: OtpProvider;
  readonly lectorOtp: LectorMetadataOtp;
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

/**
 * Bloque `REGISTRO DE SEGURIDAD` que P1 muestra al pie
 * (docs/ESPECIFICACION_PANTALLAS.md → P1): fecha, hora, IP, número
 * enmascarado, referencia del envío y resultado. "el código no se conserva
 * visible" — y este tipo no tiene dónde ponerlo.
 */
export interface RegistroSeguridadP1 {
  readonly fecha: string; // ISO 8601: fecha y hora
  readonly ip: string;
  readonly numeroEnmascarado: string;
  readonly referenciaEnvio: string | null;
  readonly resultado: "EXITOSO" | "FALLIDO";
}

export type MotivoRechazoEnvio =
  | "AUTORIZACION_REQUERIDA"
  | "NUMERO_INVALIDO"
  | "ESTADO_INVALIDO"
  | "REENVIO_BLOQUEADO"
  | "ERROR_ENVIO";

export type ResultadoEnvioP1 =
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly otpId: string;
      readonly expiraEn: string;
      readonly numeroEnmascarado: string;
      readonly registroSeguridad: RegistroSeguridadP1;
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

export type ResultadoVerificacionP1 =
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly estado: Expediente["estado"];
      readonly numeroEnmascarado: string;
      readonly registroSeguridad: RegistroSeguridadP1;
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
 * `RegistroEvidencia`. Solo entran valores ya seguros de registrar: número
 * enmascarado, referencia de envío y motivo. El código nunca llega acá — no
 * hay ningún camino desde el que se lo pueda pasar.
 */
function formatearDetalle(datos: Readonly<Record<string, string | number>>): string {
  return Object.entries(datos)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(" · ");
}

// ---------------------------------------------------------------------------
// Casos de uso
// ---------------------------------------------------------------------------

interface Reloj {
  readonly ahora: () => string;
  readonly nuevoId: () => string;
}

function resolverReloj(deps: DependenciasP1): Reloj {
  return {
    ahora: deps.ahora ?? (() => new Date().toISOString()),
    nuevoId: deps.nuevoId ?? (() => randomUUID()),
  };
}

async function registrarEvidencia(
  deps: DependenciasP1,
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
    resultado: entrada.resultado,
    detalle: formatearDetalle(entrada.detalle),
  };
  await deps.evidencias.guardar(registro);
}

export interface EntradaEnvioP1 {
  /** `null` la primera vez: se crea el expediente en INICIADO. */
  readonly expedienteId: string | null;
  /** OTP anterior de esta sesión, si lo hay: sirve para aplicar el cooldown. */
  readonly otpIdPrevio: string | null;
  readonly numeroIngresado: string;
  readonly autorizacionAceptada: boolean;
  readonly contexto: ContextoPeticion;
}

/**
 * Paso 1 de P1: valida el número y la autorización, crea el expediente si
 * hace falta y dispara el envío del OTP de canal.
 */
export async function enviarOtpWhatsapp(
  deps: DependenciasP1,
  entrada: EntradaEnvioP1,
): Promise<ResultadoEnvioP1> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();

  if (!entrada.autorizacionAceptada) {
    return { ok: false, motivo: "AUTORIZACION_REQUERIDA", expedienteId: entrada.expedienteId };
  }

  const numero = normalizarCelularParaguayo(entrada.numeroIngresado);
  if (!numero.ok) {
    return { ok: false, motivo: "NUMERO_INVALIDO", expedienteId: entrada.expedienteId };
  }
  const numeroEnmascarado = enmascararCelular(numero.e164);

  // Expediente: se crea recién acá (P0 es informativa y no genera nada).
  let expediente: Expediente;
  if (entrada.expedienteId) {
    const existente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
    if (!existente) {
      return { ok: false, motivo: "ESTADO_INVALIDO", expedienteId: entrada.expedienteId };
    }
    // P1 solo puede pedir un código mientras el canal no esté verificado.
    if (existente.estado !== "INICIADO") {
      await registrarEvidencia(deps, reloj, {
        expedienteId: existente.id,
        paso: PASO_EVIDENCIA_ENVIO,
        fecha,
        contexto: entrada.contexto,
        resultado: "FALLIDO",
        versionTextoAceptado: VERSION_TEXTO_AUTORIZACION_P1,
        detalle: { numeroEnmascarado, motivo: "ESTADO_INVALIDO", estado: existente.estado },
      });
      return { ok: false, motivo: "ESTADO_INVALIDO", expedienteId: existente.id };
    }
    expediente = existente;
  } else {
    expediente = crearExpedienteInicial({ id: reloj.nuevoId(), ahora: fecha });
    await deps.expedientes.crear(expediente);
  }

  // Cooldown de 60s también en el envío: sin esto, pedir un código nuevo
  // desde cero sería una forma trivial de saltear el bloqueo del reenvío
  // (regla inviolable #1).
  if (entrada.otpIdPrevio) {
    const previo = await deps.lectorOtp.obtener(entrada.otpIdPrevio);
    if (previo && previo.expedienteId === expediente.id && !previo.consumidoEn) {
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
    proposito: PROPOSITO_P1,
    destino: { canal: "WHATSAPP", valor: numero.e164 },
  });

  if (!envio.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: PASO_EVIDENCIA_ENVIO,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      versionTextoAceptado: VERSION_TEXTO_AUTORIZACION_P1,
      detalle: { numeroEnmascarado, motivo: envio.motivo },
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
    paso: PASO_EVIDENCIA_ENVIO,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    versionTextoAceptado: VERSION_TEXTO_AUTORIZACION_P1,
    detalle: { numeroEnmascarado, referenciaEnvio: envio.referenciaEnvio },
  });

  return {
    ok: true,
    expedienteId: expediente.id,
    otpId: envio.otpId,
    expiraEn: envio.expiraEn,
    numeroEnmascarado,
    registroSeguridad: {
      fecha,
      ip: entrada.contexto.ip,
      numeroEnmascarado,
      referenciaEnvio: envio.referenciaEnvio,
      resultado: "EXITOSO",
    },
  };
}

export interface EntradaReenvioP1 {
  readonly expedienteId: string;
  readonly otpId: string;
  readonly contexto: ContextoPeticion;
}

/** Enlace `Reenviar código` de P1. Sujeto al bloqueo de 60 segundos. */
export async function reenviarOtpWhatsapp(
  deps: DependenciasP1,
  entrada: EntradaReenvioP1,
): Promise<ResultadoEnvioP1> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();

  const previo = await deps.lectorOtp.obtener(entrada.otpId);
  if (!previo || previo.expedienteId !== entrada.expedienteId || previo.proposito !== PROPOSITO_P1) {
    return { ok: false, motivo: "ERROR_ENVIO", expedienteId: entrada.expedienteId };
  }
  const numeroEnmascarado = enmascararCelular(previo.destino);

  const envio = await deps.otpProvider.reenviarOtp(entrada.otpId);

  if (!envio.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_REENVIO,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      versionTextoAceptado: null,
      detalle: { numeroEnmascarado, motivo: envio.motivo },
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
    paso: PASO_EVIDENCIA_REENVIO,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    versionTextoAceptado: null,
    detalle: { numeroEnmascarado, referenciaEnvio: envio.referenciaEnvio },
  });

  return {
    ok: true,
    expedienteId: entrada.expedienteId,
    otpId: envio.otpId,
    expiraEn: envio.expiraEn,
    numeroEnmascarado,
    registroSeguridad: {
      fecha,
      ip: entrada.contexto.ip,
      numeroEnmascarado,
      referenciaEnvio: envio.referenciaEnvio,
      resultado: "EXITOSO",
    },
  };
}

export interface EntradaVerificacionP1 {
  readonly expedienteId: string;
  readonly otpId: string;
  readonly codigoIngresado: string;
  readonly contexto: ContextoPeticion;
}

/**
 * Paso 2 de P1: verifica el código y, solo si es correcto, transiciona el
 * expediente a CANAL_WA_VERIFICADO registrando como canal verificado el
 * mismo número al que se envió el código (nunca uno declarado por el
 * cliente en esta petición).
 */
export async function verificarOtpWhatsapp(
  deps: DependenciasP1,
  entrada: EntradaVerificacionP1,
): Promise<ResultadoVerificacionP1> {
  const reloj = resolverReloj(deps);
  const fecha = reloj.ahora();

  const registroOtp = await deps.lectorOtp.obtener(entrada.otpId);
  if (!registroOtp) return { ok: false, motivo: "OTP_NO_ENCONTRADO" };
  if (registroOtp.expedienteId !== entrada.expedienteId) {
    return { ok: false, motivo: "OTP_DE_OTRO_EXPEDIENTE" };
  }
  // Regla inviolable #1: un OTP nunca se reutiliza para otro propósito.
  if (registroOtp.proposito !== PROPOSITO_P1) {
    return { ok: false, motivo: "PROPOSITO_INCORRECTO" };
  }

  const numeroEnmascarado = enmascararCelular(registroOtp.destino);

  const verificacion = await deps.otpProvider.verificarOtp({
    otpId: entrada.otpId,
    codigoIngresado: entrada.codigoIngresado,
  });

  if (!verificacion.ok) {
    const intentosRestantes =
      verificacion.motivo === "CODIGO_INCORRECTO" ? verificacion.intentosRestantes : undefined;

    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_VERIFICACION,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      versionTextoAceptado: null,
      detalle: {
        numeroEnmascarado,
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
    "CANAL_WA_VERIFICADO",
    { canalWhatsapp: { valor: registroOtp.destino, verificadoEn: fecha } },
    fecha,
  );

  if (!transicion.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: entrada.expedienteId,
      paso: PASO_EVIDENCIA_VERIFICACION,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      versionTextoAceptado: null,
      detalle: { numeroEnmascarado, motivo: "ESTADO_INVALIDO", estado: expediente.estado },
    });
    return { ok: false, motivo: "ESTADO_INVALIDO" };
  }

  await deps.expedientes.guardar(transicion.expediente, expediente.actualizadoEn);

  await registrarEvidencia(deps, reloj, {
    expedienteId: entrada.expedienteId,
    paso: PASO_EVIDENCIA_VERIFICACION,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    versionTextoAceptado: VERSION_TEXTO_AUTORIZACION_P1,
    detalle: { numeroEnmascarado, estado: transicion.expediente.estado },
  });

  return {
    ok: true,
    expedienteId: entrada.expedienteId,
    estado: transicion.expediente.estado,
    numeroEnmascarado,
    registroSeguridad: {
      fecha,
      ip: entrada.contexto.ip,
      numeroEnmascarado,
      referenciaEnvio: null,
      resultado: "EXITOSO",
    },
  };
}
