/**
 * Acto de firma del cliente — firma electrónica **no cualificada, generada
 * internamente** por SeguroLoTengo.
 *
 * Reemplaza al acto de firma de un tercero que modela `firma-p8.ts`, que
 * sigue sirviendo el recorrido actual hasta que las pantallas se rediseñen.
 * Los dos conviven a propósito: este módulo no toca nada de aquel.
 *
 * **Respaldo normativo.** Resolución SS.SG. N.º 210/2025, art. 4
 * (`docs/normativa/`): la propuesta y los documentos precontractuales pueden
 * suscribirse con firma electrónica simple **siempre que esté respaldada por
 * un mecanismo de autenticación previo —OTP u otro medio técnicamente
 * idóneo— que garantice la identificación del firmante, el origen e
 * integridad de sus datos y la trazabilidad de la operación**. Las tres cosas
 * que exige ese artículo son las tres que este módulo produce: identificación
 * (la de P5, ya verificada, más el OTP), integridad (la huella del documento
 * cerrado) y trazabilidad (el registro de evidencia).
 *
 * Su art. 9 agrega qué hay que conservar: metadatos, dirección IP, fecha y
 * hora y códigos de validación. Por eso el acto se construye con el contexto
 * de la petición adentro y no como un dato accesorio.
 *
 * **Un documento, una huella** (D-11). Desde que la Solicitud y el FIPF son
 * dos secciones de un mismo PDF, la regla inviolable #3 es estructural: no
 * existe la operación que podría firmar una y no la otra. El acto conserva
 * igual los dos códigos internos, porque son dos formularios con vida
 * normativa distinta y un auditor de cualquiera de los dos tiene que poder
 * citar el suyo.
 *
 * **Lo que este módulo todavía no hace.** No sella los bytes: con la variante
 * de evidencia, firmar no modifica el PDF y lo que prueba la firma es el
 * registro. Si el dictamen legal elige la variante criptográfica, el sellado
 * se agrega encima sin tocar nada de acá
 * (`docs/VALIDACION_LEGAL_FIRMA_INTERNA.md` §1).
 */
import { conReintentoPorConflicto } from "./concurrencia";
import { enmascararCorreo } from "./correo";
import { registrarFirmaClienteInterna } from "./expediente";
import { enmascararCelular } from "./telefono";
import type { EvidenceStore } from "../ports/evidence-store";
import type { OtpProvider } from "../ports/otp-provider";
import type { CanalFirma, DocumentoCerrado, Expediente, Firma, RegistroEvidencia } from "./tipos";
import type {
  ContextoPeticion,
  LectorMetadataOtp,
  RepositorioExpediente,
} from "./verificacion-canal";

// ---------------------------------------------------------------------------
// Pasos de evidencia
// ---------------------------------------------------------------------------

export const PASO_EVIDENCIA_OTP_FIRMA_ENVIO = "FIRMA_CLIENTE_OTP_ENVIO";
export const PASO_EVIDENCIA_OTP_FIRMA_REENVIO = "FIRMA_CLIENTE_OTP_REENVIO";
export const PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE = "FIRMA_CLIENTE_ACTO";

// ---------------------------------------------------------------------------
// Dependencias
// ---------------------------------------------------------------------------

export interface DependenciasFirmaCliente {
  readonly otpProvider: OtpProvider;
  /**
   * Para saber **de qué acto es** un `otpId` antes de aceptarlo como firma.
   * Sin esto, el código que verificó el celular en P1 serviría para firmar:
   * bastaría con mandar ese `otpId`. Es la regla inviolable #1 hecha cumplir
   * en el dominio, no solo confiando en que los códigos son distintos.
   */
  readonly lectorOtp: LectorMetadataOtp;
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

/** Distingue "el expediente no podía firmar" de "perdí la carrera de escritura". */
class ErrorTransicionFirma extends Error {}

interface Reloj {
  readonly ahora: () => string;
  readonly nuevoId: () => string;
}

function resolverReloj(deps: DependenciasFirmaCliente): Reloj {
  return {
    ahora: deps.ahora ?? (() => new Date().toISOString()),
    nuevoId: deps.nuevoId ?? (() => `EV-${Math.random().toString(36).slice(2, 12)}`),
  };
}

// ---------------------------------------------------------------------------
// El acto
// ---------------------------------------------------------------------------

/**
 * Lo que queda registrado cuando el cliente firma.
 *
 * La huella es la del documento **tal como se firmó**, con su versión al lado:
 * sin la versión, una huella suelta no dice contra qué comparar.
 */
export interface ActoDeFirmaCliente {
  readonly expedienteId: string;
  readonly canal: CanalFirma;
  /** Enmascarado: en el expediente no hace falta el destino completo. */
  readonly destinoEnmascarado: string;
  /** Identificador del OTP consumido. Nunca el código (regla inviolable #2). */
  readonly otpId: string;
  readonly firmadoEn: string;
  /** Identidad del PDF único (`PROP-<correlativo>`). */
  readonly codigoDocumento: string;
  /** Código interno de la sección FIPF, impreso en el mismo PDF (D-11). */
  readonly codigoFipf: string;
  readonly versionDocumento: number;
  readonly hashDocumento: string;
  /** Qué aceptó exactamente, y qué versión de ese texto. */
  readonly textoAceptado: string;
  readonly versionTextoAceptado: string;
  readonly ip: string;
  readonly dispositivo: string;
  readonly sesionId: string;
}

export type MotivoRechazoFirmaCliente =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "PAQUETE_NO_CERRADO"
  | "CANAL_NO_VERIFICADO"
  | "OTP_NO_ENVIADO"
  | "REENVIO_BLOQUEADO"
  /** El `otpId` existe pero no es de este expediente o no es de firma. */
  | "OTP_AJENO_AL_ACTO"
  | "CODIGO_INCORRECTO"
  | "INTENTOS_AGOTADOS"
  | "CODIGO_EXPIRADO"
  | "CODIGO_YA_UTILIZADO"
  | "OTP_NO_ENCONTRADO"
  /** El expediente no está en el estado desde el que se puede firmar. */
  | "ESTADO_INVALIDO"
  /**
   * Otra escritura ganó la carrera y el conflicto persistió tras los
   * reintentos. **El código ya se consumió**: no se puede reintentar la firma
   * sin pedir uno nuevo, y por eso este caso se distingue de los demás.
   */
  | "CONFLICTO_CONCURRENCIA";

// ---------------------------------------------------------------------------
// Elegibilidad
// ---------------------------------------------------------------------------

export type ResultadoElegibilidad =
  | { readonly ok: true; readonly documento: DocumentoCerrado }
  | { readonly ok: false; readonly motivo: MotivoRechazoFirmaCliente };

/**
 * Sin paquete cerrado y hasheado no hay nada válido que firmar (regla
 * inviolable #4). Una huella vacía se rechaza acá: pasaría el chequeo del
 * tipo y no probaría nada.
 */
export function evaluarElegibilidadFirmaCliente(expediente: Expediente): ResultadoElegibilidad {
  const documento = expediente.paqueteDocumental;
  if (!documento) return { ok: false, motivo: "PAQUETE_NO_CERRADO" };

  // Una huella vacía pasaría el chequeo del tipo y no probaría nada.
  if (documento.hashSha256.trim() === "") {
    return { ok: false, motivo: "PAQUETE_NO_CERRADO" };
  }

  return { ok: true, documento };
}

/**
 * Destino verificado del canal elegido. **Sale del expediente, nunca de la
 * petición** (reglas inviolables #1 y #9): un código de firma no puede
 * terminar en un canal que nadie verificó.
 */
export function destinoVerificado(
  expediente: Expediente,
  canal: CanalFirma,
): { readonly valor: string; readonly enmascarado: string } | null {
  if (canal === "WHATSAPP") {
    const numero = expediente.canalWhatsapp?.valor;
    return numero ? { valor: numero, enmascarado: enmascararCelular(numero) } : null;
  }
  const correo = expediente.canalEmail?.valor;
  return correo ? { valor: correo, enmascarado: enmascararCorreo(correo) } : null;
}

// ---------------------------------------------------------------------------
// Evidencia
// ---------------------------------------------------------------------------

function formatearDetalle(datos: Readonly<Record<string, string | number | boolean>>): string {
  return Object.entries(datos)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(" · ");
}

async function registrarEvidencia(
  deps: DependenciasFirmaCliente,
  reloj: Reloj,
  entrada: {
    readonly expedienteId: string;
    readonly paso: string;
    readonly fecha: string;
    readonly contexto: ContextoPeticion;
    readonly resultado: "EXITOSO" | "FALLIDO";
    readonly detalle: Readonly<Record<string, string | number | boolean>>;
    readonly aceptacion?: { readonly versionTexto: string; readonly texto: string };
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
    versionTextoAceptado: entrada.aceptacion?.versionTexto ?? null,
    textoAceptado: entrada.aceptacion?.texto ?? null,
    resultado: entrada.resultado,
    detalle: formatearDetalle(entrada.detalle),
  };
  await deps.evidencias.guardar(registro);
}

// ---------------------------------------------------------------------------
// 1 · Pedir el código de firma
// ---------------------------------------------------------------------------

export interface EntradaSolicitudOtpFirma {
  readonly expedienteId: string;
  readonly canal: CanalFirma;
  readonly contexto: ContextoPeticion;
}

export type ResultadoSolicitudOtpFirma =
  | {
      readonly ok: true;
      readonly otpId: string;
      readonly expiraEn: string;
      readonly destinoEnmascarado: string;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoFirmaCliente;
      readonly segundosRestantes?: number;
    };

/**
 * Emite el código con el que se va a firmar y lo manda al canal verificado que
 * la persona eligió. El propósito es `FIRMA`, distinto del de P1 y del de P4
 * aunque llegue al mismo teléfono (regla inviolable #1).
 */
export async function solicitarOtpDeFirmaCliente(
  deps: DependenciasFirmaCliente,
  entrada: EntradaSolicitudOtpFirma,
): Promise<ResultadoSolicitudOtpFirma> {
  const reloj = resolverReloj(deps);
  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  const elegibilidad = evaluarElegibilidadFirmaCliente(expediente);
  if (!elegibilidad.ok) return { ok: false, motivo: elegibilidad.motivo };

  const destino = destinoVerificado(expediente, entrada.canal);
  if (!destino) return { ok: false, motivo: "CANAL_NO_VERIFICADO" };

  const envio = await deps.otpProvider.enviarOtp({
    expedienteId: expediente.id,
    proposito: "FIRMA",
    destino: { canal: entrada.canal === "WHATSAPP" ? "WHATSAPP" : "EMAIL", valor: destino.valor },
  });

  const fecha = reloj.ahora();

  if (!envio.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: PASO_EVIDENCIA_OTP_FIRMA_ENVIO,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: {
        canal: entrada.canal,
        destino: destino.enmascarado,
        motivo: envio.motivo,
      },
    });
    return envio.motivo === "REENVIO_BLOQUEADO"
      ? { ok: false, motivo: "REENVIO_BLOQUEADO", segundosRestantes: envio.segundosRestantes }
      : { ok: false, motivo: "OTP_NO_ENVIADO" };
  }

  await registrarEvidencia(deps, reloj, {
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_OTP_FIRMA_ENVIO,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: {
      canal: entrada.canal,
      destino: destino.enmascarado,
      otpId: envio.otpId,
      referenciaEnvio: envio.referenciaEnvio,
      expiraEn: envio.expiraEn,
    },
  });

  return {
    ok: true,
    otpId: envio.otpId,
    expiraEn: envio.expiraEn,
    destinoEnmascarado: destino.enmascarado,
  };
}

// ---------------------------------------------------------------------------
// 2 · Firmar
// ---------------------------------------------------------------------------

export interface EntradaActoDeFirmaCliente {
  readonly expedienteId: string;
  readonly canal: CanalFirma;
  readonly otpId: string;
  readonly codigoIngresado: string;
  /** Texto exacto que la persona aceptó, con su versión: se registra tal cual. */
  readonly textoAceptado: string;
  readonly versionTextoAceptado: string;
  readonly contexto: ContextoPeticion;
}

export type ResultadoActoDeFirmaCliente =
  | { readonly ok: true; readonly acto: ActoDeFirmaCliente }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoFirmaCliente;
      readonly intentosRestantes?: number;
    };

/**
 * Verifica el código y, si es correcto, construye el acto de firma.
 *
 * El orden de los controles no es casual: primero se comprueba que **haya
 * algo válido que firmar** y que **el código sea de este acto**, y recién
 * después se lo consume. Verificar primero gastaría un OTP de uso único en un
 * expediente que no podía firmar.
 */
export async function registrarActoDeFirmaCliente(
  deps: DependenciasFirmaCliente,
  entrada: EntradaActoDeFirmaCliente,
): Promise<ResultadoActoDeFirmaCliente> {
  const reloj = resolverReloj(deps);
  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };

  const elegibilidad = evaluarElegibilidadFirmaCliente(expediente);
  if (!elegibilidad.ok) return { ok: false, motivo: elegibilidad.motivo };

  const destino = destinoVerificado(expediente, entrada.canal);
  if (!destino) return { ok: false, motivo: "CANAL_NO_VERIFICADO" };

  // El código tiene que ser de este expediente y de un acto de firma. Un OTP
  // de verificación de canal no manifiesta ninguna voluntad de firmar.
  const metadata = await deps.lectorOtp.obtener(entrada.otpId);
  if (!metadata) return { ok: false, motivo: "OTP_NO_ENCONTRADO" };
  if (metadata.expedienteId !== expediente.id || metadata.proposito !== "FIRMA") {
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE,
      fecha: reloj.ahora(),
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: {
        otpId: entrada.otpId,
        motivo: "OTP_AJENO_AL_ACTO",
        propositoDelOtp: metadata.proposito,
      },
    });
    return { ok: false, motivo: "OTP_AJENO_AL_ACTO" };
  }

  const verificacion = await deps.otpProvider.verificarOtp({
    otpId: entrada.otpId,
    codigoIngresado: entrada.codigoIngresado,
  });

  const fecha = reloj.ahora();
  const { documento } = elegibilidad;

  if (!verificacion.ok) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { otpId: entrada.otpId, canal: entrada.canal, motivo: verificacion.motivo },
    });

    switch (verificacion.motivo) {
      case "CODIGO_INCORRECTO":
        return {
          ok: false,
          motivo: "CODIGO_INCORRECTO",
          intentosRestantes: verificacion.intentosRestantes,
        };
      case "INTENTOS_AGOTADOS":
        return { ok: false, motivo: "INTENTOS_AGOTADOS" };
      case "EXPIRADO":
        return { ok: false, motivo: "CODIGO_EXPIRADO" };
      case "YA_UTILIZADO":
        return { ok: false, motivo: "CODIGO_YA_UTILIZADO" };
      case "NO_ENCONTRADO":
        return { ok: false, motivo: "OTP_NO_ENCONTRADO" };
    }
  }

  const acto: ActoDeFirmaCliente = {
    expedienteId: expediente.id,
    canal: entrada.canal,
    destinoEnmascarado: destino.enmascarado,
    otpId: entrada.otpId,
    firmadoEn: fecha,
    codigoDocumento: documento.codigo,
    codigoFipf: documento.codigoSeccionFipf,
    versionDocumento: documento.version,
    hashDocumento: documento.hashSha256,
    textoAceptado: entrada.textoAceptado,
    versionTextoAceptado: entrada.versionTextoAceptado,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
  };

  // El código ya se consumió, así que de acá en adelante no se puede volver a
  // empezar: el reintento por conflicto vuelve a leer y a transicionar, pero
  // nunca a verificar otro OTP.
  const firma: Firma = {
    canal: entrada.canal,
    origen: "INTERNA",
    referenciaActo: entrada.otpId,
    firmadoEn: fecha,
    // Sin sellado, el PDF firmado es byte a byte el que se cerró: lo que
    // prueba la firma es la evidencia, no un archivo distinto.
    hashDocumentoFirmado: documento.hashSha256,
  };

  let persistido = false;
  try {
    persistido = await conReintentoPorConflicto(
      async () => {
        const actual = await deps.expedientes.obtenerPorId(expediente.id);
        if (!actual) {
          throw new ErrorTransicionFirma("El expediente desapareció entre la lectura y la escritura.");
        }

        const transicion = registrarFirmaClienteInterna(actual, firma, fecha);
        if (!transicion.ok) throw new ErrorTransicionFirma(transicion.error);

        await deps.expedientes.guardar(transicion.expediente, actual.actualizadoEn);
        return true;
      },
      () => false,
    );
  } catch (error) {
    const motivo = error instanceof ErrorTransicionFirma ? "ESTADO_INVALIDO" : "CONFLICTO_CONCURRENCIA";
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: {
        otpId: entrada.otpId,
        motivo,
        detalle: error instanceof Error ? error.message : String(error),
      },
    });
    return { ok: false, motivo };
  }

  if (!persistido) {
    await registrarEvidencia(deps, reloj, {
      expedienteId: expediente.id,
      paso: PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE,
      fecha,
      contexto: entrada.contexto,
      resultado: "FALLIDO",
      detalle: { otpId: entrada.otpId, motivo: "CONFLICTO_CONCURRENCIA" },
    });
    return { ok: false, motivo: "CONFLICTO_CONCURRENCIA" };
  }

  await registrarEvidencia(deps, reloj, {
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE,
    fecha,
    contexto: entrada.contexto,
    resultado: "EXITOSO",
    detalle: {
      canal: entrada.canal,
      destino: destino.enmascarado,
      otpId: entrada.otpId,
      documento: `${acto.codigoDocumento} v${acto.versionDocumento}`,
      seccionFipf: acto.codigoFipf,
      hashDocumento: acto.hashDocumento,
    },
    aceptacion: {
      versionTexto: entrada.versionTextoAceptado,
      texto: entrada.textoAceptado,
    },
  });

  return { ok: true, acto };
}
