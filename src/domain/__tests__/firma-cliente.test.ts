/**
 * Acto de firma del cliente — la firma electrónica no cualificada que genera
 * SeguroLoTengo (Res. SS.SG. 210/2025, art. 4).
 *
 * Lo que se prueba con insistencia son las reglas, no las validaciones de
 * formulario:
 *
 * - **Regla #1** — el código que verificó el celular **no firma**. Y el
 *   intento de usarlo ni siquiera consume el OTP de firma.
 * - **Reglas #1 y #9** — el código sale hacia el canal verificado del
 *   expediente, nunca hacia un destino que venga en la petición.
 * - **Regla #3** — el acto lleva la huella del documento único (D-11).
 * - **Regla #4** — sin paquete cerrado y hasheado no se emite el código.
 * - **Res. 210/2025, art. 9** — la evidencia conserva IP, dispositivo,
 *   sesión, fecha, el texto aceptado y su versión.
 *
 * El proveedor de OTP es el **mock real** con el repositorio real sobre un
 * DynamoDB falso: así se ejercita el mismo camino que la demostración, con la
 * política de verdad (6 dígitos, uso único, 3 intentos).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { crearOtpProviderMock, limpiarRegistroDemo, obtenerEnvioDemo } from "../../adapters/mock/otp-provider";
import type { EvidenceStore } from "../../ports/evidence-store";
import type { OtpProvider } from "../../ports/otp-provider";
import { crearFakeDynamoDocumentClient } from "../../repositories/__tests__/fake-dynamo-document-client";
import { crearOtpRepositoryDynamoDb } from "../../repositories/otp-repository";
import type { OtpRepository } from "../../repositories/otp-repository";
import {
  PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE,
  PASO_EVIDENCIA_OTP_FIRMA_ENVIO,
  evaluarElegibilidadFirmaCliente,
  registrarActoDeFirmaCliente,
  solicitarOtpDeFirmaCliente,
} from "../firma-cliente";
import type { DependenciasFirmaCliente } from "../firma-cliente";
import type { Expediente, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion, LectorMetadataOtp, RepositorioExpediente } from "../verificacion-canal";
import { expedienteEnPaqueteGenerado } from "./fixtures";

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-firma",
};

const TEXTO = "Declaro haber revisado la Solicitud y el FIPF y solicito firmarlos.";
const VERSION_TEXTO = "2026-08-FIRMA-v1";

function repositorioFalso(
  inicial: Expediente,
): RepositorioExpediente & { actual: () => Expediente } {
  let guardado = inicial;
  return {
    async obtenerPorId(id) {
      return id === guardado.id ? guardado : null;
    },
    async crear(expediente) {
      guardado = expediente;
    },
    async guardar(expediente) {
      guardado = expediente;
    },
    actual: () => guardado,
  };
}

function evidenciasFalsas(): EvidenceStore & { registros: RegistroEvidencia[] } {
  const registros: RegistroEvidencia[] = [];
  return {
    registros,
    async guardar(registro) {
      registros.push(registro);
    },
    async obtenerHistorial(expedienteId: string) {
      return registros.filter((registro) => registro.expedienteId === expedienteId);
    },
  };
}

interface Armado {
  readonly deps: DependenciasFirmaCliente & {
    readonly evidencias: ReturnType<typeof evidenciasFalsas>;
    readonly expedientes: ReturnType<typeof repositorioFalso>;
  };
  readonly expediente: Expediente;
  readonly otpRepository: OtpRepository;
  readonly otpProvider: OtpProvider;
  /** Cuántas veces se llamó a verificar: sirve para probar que no se gastó. */
  readonly verificaciones: () => number;
}

function armar(expediente: Expediente = expedienteEnPaqueteGenerado()): Armado {
  const { documentClient } = crearFakeDynamoDocumentClient();
  const otpRepository = crearOtpRepositoryDynamoDb({
    documentClient,
    nombreTabla: "tabla-de-prueba",
    obtenerPepper: async () => "pepper-de-prueba",
  });
  const mock = crearOtpProviderMock({ otpRepository, retenerCodigoParaPanelDemo: true });

  let verificaciones = 0;
  const otpProvider: OtpProvider = {
    enviarOtp: (solicitud) => mock.enviarOtp(solicitud),
    verificarOtp: (solicitud) => {
      verificaciones += 1;
      return mock.verificarOtp(solicitud);
    },
    reenviarOtp: (otpId) => mock.reenviarOtp(otpId),
  };

  const lectorOtp: LectorMetadataOtp = { obtener: (otpId) => otpRepository.obtener(otpId) };
  const evidencias = evidenciasFalsas();

  return {
    deps: {
      otpProvider,
      lectorOtp,
      expedientes: repositorioFalso(expediente),
      evidencias,
      ahora: () => "2026-08-27T12:00:00.000Z",
      nuevoId: () => `EV-${Math.random().toString(36).slice(2, 10)}`,
    },
    expediente,
    otpRepository,
    otpProvider,
    verificaciones: () => verificaciones,
  };
}

function codigoDe(otpId: string): string {
  const envio = obtenerEnvioDemo(otpId);
  if (!envio) throw new Error(`El registro de demo no tiene el OTP ${otpId}`);
  return envio.codigo;
}

beforeEach(() => {
  limpiarRegistroDemo();
});

describe("solicitud del código de firma", () => {
  it("emite el código con propósito FIRMA hacia el canal verificado del expediente", async () => {
    const { deps, expediente, otpRepository } = armar();

    const resultado = await solicitarOtpDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    // Se lee del repositorio, que es donde el propósito queda persistido: si
    // el acto se registrara como verificación de canal, la evidencia diría
    // que se verificó un teléfono cuando en realidad se firmó un contrato.
    const registro = await otpRepository.obtener(resultado.otpId);
    expect(registro?.proposito).toBe("FIRMA");
    // El destino es el del expediente, no uno que venga de afuera.
    expect(registro?.destino).toBe(expediente.canalWhatsapp?.valor);
    expect(resultado.destinoEnmascarado).not.toContain("981");
  });

  it("deja evidencia del envío con el destino enmascarado y sin el código", async () => {
    const { deps, expediente } = armar();

    const resultado = await solicitarOtpDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      contexto: CONTEXTO,
    });
    if (!resultado.ok) throw new Error("el envío debería haber salido");

    const registro = deps.evidencias.registros.find(
      (r) => r.paso === PASO_EVIDENCIA_OTP_FIRMA_ENVIO,
    );
    expect(registro?.resultado).toBe("EXITOSO");
    expect(registro?.ip).toBe(CONTEXTO.ip);
    expect(registro?.detalle).toContain(resultado.destinoEnmascarado);
    // Regla inviolable #2: el código no aparece en la evidencia.
    expect(registro?.detalle).not.toContain(codigoDe(resultado.otpId));
  });

  it("sin paquete cerrado no se emite ningún código", async () => {
    const expediente = expedienteEnPaqueteGenerado();
    const sinPaquete: Expediente = { ...expediente, paqueteDocumental: null };
    const { deps } = armar(sinPaquete);

    const resultado = await solicitarOtpDeFirmaCliente(deps, {
      expedienteId: sinPaquete.id,
      canal: "WHATSAPP",
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "PAQUETE_NO_CERRADO" });
  });

  it("un documento con la huella vacía no habilita la firma", () => {
    const expediente = expedienteEnPaqueteGenerado();
    const paquete = expediente.paqueteDocumental;
    if (!paquete) throw new Error("el fixture debería traer paquete");

    const conHuellaVacia: Expediente = {
      ...expediente,
      paqueteDocumental: { ...paquete, hashSha256: "  " },
    };

    expect(evaluarElegibilidadFirmaCliente(conHuellaVacia)).toEqual({
      ok: false,
      motivo: "PAQUETE_NO_CERRADO",
    });
  });

  it("un canal que la persona no verificó no recibe el código", async () => {
    const expediente = expedienteEnPaqueteGenerado();
    const sinCorreo: Expediente = { ...expediente, canalEmail: null };
    const { deps } = armar(sinCorreo);

    const resultado = await solicitarOtpDeFirmaCliente(deps, {
      expedienteId: sinCorreo.id,
      canal: "EMAIL",
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "CANAL_NO_VERIFICADO" });
  });
});

describe("acto de firma", () => {
  it("con el código correcto produce el acto con la huella del documento y su versión", async () => {
    const { deps, expediente } = armar();
    const envio = await solicitarOtpDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      contexto: CONTEXTO,
    });
    if (!envio.ok) throw new Error("el envío debería haber salido");

    const resultado = await registrarActoDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      otpId: envio.otpId,
      codigoIngresado: codigoDe(envio.otpId),
      textoAceptado: TEXTO,
      versionTextoAceptado: VERSION_TEXTO,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const documento = expediente.paqueteDocumental;
    if (!documento) throw new Error("el fixture debería traer documento");

    // Regla #3, ahora estructural (D-11): un documento, una huella, y las dos
    // secciones citables por su código propio.
    expect(resultado.acto.hashDocumento).toBe(documento.hashSha256);
    expect(resultado.acto.versionDocumento).toBe(documento.version);
    expect(resultado.acto.codigoDocumento).toBe(documento.codigo);
    expect(resultado.acto.codigoFipf).toBe(documento.codigoSeccionFipf);
    expect(resultado.acto.firmadoEn).toBe("2026-08-27T12:00:00.000Z");
    expect(resultado.acto.ip).toBe(CONTEXTO.ip);
  });

  it("la evidencia del acto conserva el texto aceptado con su versión", async () => {
    const { deps, expediente } = armar();
    const envio = await solicitarOtpDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      contexto: CONTEXTO,
    });
    if (!envio.ok) throw new Error("el envío debería haber salido");

    await registrarActoDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      otpId: envio.otpId,
      codigoIngresado: codigoDe(envio.otpId),
      textoAceptado: TEXTO,
      versionTextoAceptado: VERSION_TEXTO,
      contexto: CONTEXTO,
    });

    const registro = deps.evidencias.registros.find(
      (r) => r.paso === PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE,
    );
    expect(registro?.resultado).toBe("EXITOSO");
    expect(registro?.textoAceptado).toBe(TEXTO);
    expect(registro?.versionTextoAceptado).toBe(VERSION_TEXTO);
    expect(registro?.sesionId).toBe(CONTEXTO.sesionId);
  });

  it("el código que verificó el celular no firma, y ni siquiera consume el OTP de firma", async () => {
    const { deps, expediente, otpProvider, verificaciones } = armar();

    // El OTP de P1: mismo expediente, mismo teléfono, otro acto.
    const deCanal = await otpProvider.enviarOtp({
      expedienteId: expediente.id,
      proposito: "VERIFICACION_CELULAR",
      destino: { canal: "WHATSAPP", valor: expediente.canalWhatsapp?.valor ?? "" },
    });
    if (!deCanal.ok) throw new Error("el envío de P1 debería haber salido");

    const resultado = await registrarActoDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      otpId: deCanal.otpId,
      codigoIngresado: codigoDe(deCanal.otpId),
      textoAceptado: TEXTO,
      versionTextoAceptado: VERSION_TEXTO,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "OTP_AJENO_AL_ACTO" });
    // Se corta antes de verificar: un código correcto de otro acto no debe
    // llegar siquiera a gastarse contra el motor de OTP.
    expect(verificaciones()).toBe(0);

    const registro = deps.evidencias.registros.find(
      (r) => r.paso === PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE,
    );
    expect(registro?.resultado).toBe("FALLIDO");
    expect(registro?.detalle).toContain("OTP_AJENO_AL_ACTO");
  });

  it("un código de firma de otro expediente no firma este", async () => {
    const { deps, expediente, otpProvider } = armar();

    const ajeno = await otpProvider.enviarOtp({
      expedienteId: "EXP-DE-OTRA-PERSONA",
      proposito: "FIRMA",
      destino: { canal: "WHATSAPP", valor: "+595981999999" },
    });
    if (!ajeno.ok) throw new Error("el envío ajeno debería haber salido");

    const resultado = await registrarActoDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      otpId: ajeno.otpId,
      codigoIngresado: codigoDe(ajeno.otpId),
      textoAceptado: TEXTO,
      versionTextoAceptado: VERSION_TEXTO,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "OTP_AJENO_AL_ACTO" });
  });

  it("un código incorrecto informa los intentos restantes y deja evidencia fallida", async () => {
    const { deps, expediente } = armar();
    const envio = await solicitarOtpDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      contexto: CONTEXTO,
    });
    if (!envio.ok) throw new Error("el envío debería haber salido");

    const correcto = codigoDe(envio.otpId);
    const resultado = await registrarActoDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      otpId: envio.otpId,
      codigoIngresado: correcto === "000000" ? "999999" : "000000",
      textoAceptado: TEXTO,
      versionTextoAceptado: VERSION_TEXTO,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("CODIGO_INCORRECTO");
    expect(resultado.intentosRestantes).toBe(2);

    const registro = deps.evidencias.registros.find(
      (r) => r.paso === PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE,
    );
    expect(registro?.resultado).toBe("FALLIDO");
  });

  it("el mismo código no firma dos veces", async () => {
    const { deps, expediente } = armar();
    const envio = await solicitarOtpDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      contexto: CONTEXTO,
    });
    if (!envio.ok) throw new Error("el envío debería haber salido");

    const entrada = {
      expedienteId: expediente.id,
      canal: "WHATSAPP" as const,
      otpId: envio.otpId,
      codigoIngresado: codigoDe(envio.otpId),
      textoAceptado: TEXTO,
      versionTextoAceptado: VERSION_TEXTO,
      contexto: CONTEXTO,
    };

    const primera = await registrarActoDeFirmaCliente(deps, entrada);
    const segunda = await registrarActoDeFirmaCliente(deps, entrada);

    expect(primera.ok).toBe(true);
    expect(segunda).toEqual({ ok: false, motivo: "CODIGO_YA_UTILIZADO" });
  });

  it("sin paquete cerrado no se gasta el código", async () => {
    const { deps, expediente, otpProvider, verificaciones } = armar();
    const envio = await otpProvider.enviarOtp({
      expedienteId: expediente.id,
      proposito: "FIRMA",
      destino: { canal: "WHATSAPP", valor: expediente.canalWhatsapp?.valor ?? "" },
    });
    if (!envio.ok) throw new Error("el envío debería haber salido");

    const sinPaquete: Expediente = { ...expediente, paqueteDocumental: null };
    const deps2 = { ...deps, expedientes: repositorioFalso(sinPaquete) };

    const resultado = await registrarActoDeFirmaCliente(deps2, {
      expedienteId: sinPaquete.id,
      canal: "WHATSAPP",
      otpId: envio.otpId,
      codigoIngresado: codigoDe(envio.otpId),
      textoAceptado: TEXTO,
      versionTextoAceptado: VERSION_TEXTO,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "PAQUETE_NO_CERRADO" });
    expect(verificaciones()).toBe(0);
  });

  it("deja el expediente en FIRMADO_CLIENTE con la firma interna registrada", async () => {
    const { deps, expediente } = armar();
    const envio = await solicitarOtpDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      contexto: CONTEXTO,
    });
    if (!envio.ok) throw new Error("el envío debería haber salido");

    const resultado = await registrarActoDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      otpId: envio.otpId,
      codigoIngresado: codigoDe(envio.otpId),
      textoAceptado: TEXTO,
      versionTextoAceptado: VERSION_TEXTO,
      contexto: CONTEXTO,
    });
    expect(resultado.ok).toBe(true);

    const guardado = deps.expedientes.actual();
    // FIRMADO_CLIENTE y no FIRMADO: faltan las institucionales (D-13), así que
    // el cobro sigue inhabilitado.
    expect(guardado.estado).toBe("FIRMADO_CLIENTE");
    expect(guardado.firma?.origen).toBe("INTERNA");
    // La referencia del acto es el OTP consumido: no hay sesión de proveedor
    // que registrar, y el campo no finge que la haya.
    expect(guardado.firma?.referenciaActo).toBe(envio.otpId);
    expect(guardado.firma?.hashDocumentoFirmado).toBe(expediente.paqueteDocumental?.hashSha256);
  });

  it("un expediente ya firmado no vuelve a firmarse, ni con un código nuevo", async () => {
    const { deps, expediente } = armar();

    const primerEnvio = await solicitarOtpDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      contexto: CONTEXTO,
    });
    if (!primerEnvio.ok) throw new Error("el envío debería haber salido");
    await registrarActoDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      otpId: primerEnvio.otpId,
      codigoIngresado: codigoDe(primerEnvio.otpId),
      textoAceptado: TEXTO,
      versionTextoAceptado: VERSION_TEXTO,
      contexto: CONTEXTO,
    });

    // Código nuevo, expediente ya firmado: lo corta el grafo de transiciones.
    const segundoEnvio = await solicitarOtpDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      contexto: CONTEXTO,
    });
    if (!segundoEnvio.ok) throw new Error("el segundo envío debería haber salido");

    const resultado = await registrarActoDeFirmaCliente(deps, {
      expedienteId: expediente.id,
      canal: "WHATSAPP",
      otpId: segundoEnvio.otpId,
      codigoIngresado: codigoDe(segundoEnvio.otpId),
      textoAceptado: TEXTO,
      versionTextoAceptado: VERSION_TEXTO,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "ESTADO_INVALIDO" });
    expect(deps.expedientes.actual().firma?.referenciaActo).toBe(primerEnvio.otpId);
  });
});
