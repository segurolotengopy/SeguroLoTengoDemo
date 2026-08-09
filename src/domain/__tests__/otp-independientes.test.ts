/**
 * Regla inviolable #1: los OTP de celular (P1) y de correo (P4) son
 * independientes y **nunca** se reutiliza uno para el propósito del otro.
 *
 * Este test existe porque P1 y P4 comparten el motor
 * (`src/domain/verificacion-canal.ts`): compartir la mecánica no puede
 * significar compartir el secreto. Se ejerce contra el repositorio de OTP
 * real (sobre un DynamoDB falso en memoria) y el adaptador mock real, no
 * contra dobles del propio motor, así que lo que se prueba es el
 * comportamiento de producción.
 *
 * Los códigos en claro se leen por el canal exclusivo del panel de demo
 * (`obtenerEnvioDemo`), que es el único lugar del sistema donde existen
 * después del envío — jamás salen por la API del flujo (regla inviolable #2).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  crearOtpProviderMock,
  limpiarRegistroDemo,
  obtenerEnvioDemo,
} from "../../adapters/mock/otp-provider";
import type { EvidenceStore } from "../../ports/evidence-store";
import { crearOtpRepositoryDynamoDb } from "../../repositories/otp-repository";
import type { OtpRepository } from "../../repositories/otp-repository";
import { crearFakeDynamoDocumentClient } from "../../repositories/__tests__/fake-dynamo-document-client";
import type { Expediente, RegistroEvidencia } from "../tipos";
import { enviarOtpWhatsapp, verificarOtpWhatsapp } from "../verificacion-canal-whatsapp";
import { enviarOtpCorreo, verificarOtpCorreo } from "../verificacion-canal-correo";
import type { DependenciasVerificacionCanal, RepositorioExpediente } from "../verificacion-canal";
import { transicionarExpediente } from "../expediente";
import { enmascararCorreo, normalizarCorreo } from "../correo";

const CONTEXTO = { ip: "200.10.20.30", dispositivo: "vitest", sesionId: "sesion-1" };
const NUMERO = "981000123";
const CORREO = "monica.gorena@example.com";

function crearExpedientesEnMemoria(): RepositorioExpediente & { todos: Map<string, Expediente> } {
  const todos = new Map<string, Expediente>();
  return {
    todos,
    async obtenerPorId(id) {
      return todos.get(id) ?? null;
    },
    async crear(expediente) {
      todos.set(expediente.id, expediente);
    },
    async guardar(expediente) {
      todos.set(expediente.id, expediente);
    },
  };
}

function crearEvidenciasEnMemoria(): EvidenceStore & { registros: RegistroEvidencia[] } {
  const registros: RegistroEvidencia[] = [];
  return {
    registros,
    async guardar(registro) {
      registros.push(registro);
    },
    async obtenerHistorial(expedienteId) {
      return registros.filter((registro) => registro.expedienteId === expedienteId);
    },
  };
}

interface Banco {
  readonly deps: DependenciasVerificacionCanal;
  readonly otpRepository: OtpRepository;
  readonly expedientes: ReturnType<typeof crearExpedientesEnMemoria>;
}

function crearBanco(): Banco {
  const { documentClient } = crearFakeDynamoDocumentClient();
  const otpRepository = crearOtpRepositoryDynamoDb({
    documentClient,
    nombreTabla: "tabla-de-prueba",
    obtenerPepper: async () => "pepper-de-prueba",
  });
  const expedientes = crearExpedientesEnMemoria();
  const evidencias = crearEvidenciasEnMemoria();
  const ahora = "2026-03-15T12:00:00.000Z";

  const otpProvider = crearOtpProviderMock({
    otpRepository,
    retenerCodigoParaPanelDemo: true,
    ahora: () => ahora,
  });

  return {
    otpRepository,
    expedientes,
    deps: {
      otpProvider,
      lectorOtp: otpRepository,
      expedientes,
      evidencias,
      ahora: () => ahora,
    },
  };
}

function codigoDe(otpId: string): string {
  const codigo = obtenerEnvioDemo(otpId)?.codigo;
  if (!codigo) throw new Error(`el registro de demo no tiene el código de ${otpId}`);
  return codigo;
}

/**
 * Deja un expediente en AUTORIZADO (el estado con el que se llega a P4) con
 * el WhatsApp ya verificado, y devuelve además un OTP de celular vivo para
 * poder intentar los cruces.
 */
async function prepararExpedienteConAmbosCanales(banco: Banco): Promise<{
  expedienteId: string;
  otpCelular: { otpId: string; codigo: string };
  otpCorreo: { otpId: string; codigo: string };
}> {
  // P1 real: crea el expediente y emite el OTP de celular.
  const envioCelular = await enviarOtpWhatsapp(banco.deps, {
    expedienteId: null,
    otpIdPrevio: null,
    numeroIngresado: NUMERO,
    autorizacionAceptada: true,
    contexto: CONTEXTO,
  });
  if (!envioCelular.ok) throw new Error(`P1 debería haber enviado: ${envioCelular.motivo}`);
  const expedienteId = envioCelular.expedienteId;

  // Se verifica de verdad, para que el expediente quede con el canal de
  // WhatsApp asentado como en el recorrido real.
  const verificacionCelular = await verificarOtpWhatsapp(banco.deps, {
    expedienteId,
    otpId: envioCelular.otpId,
    codigoIngresado: codigoDe(envioCelular.otpId),
    contexto: CONTEXTO,
  });
  if (!verificacionCelular.ok) throw new Error("P1 debería haber verificado");

  // Se emite un segundo OTP de celular, que queda vivo y sin consumir, para
  // poder probar los cruces contra él más adelante.
  const otpCelularVivo = await banco.otpRepository.crear({
    expedienteId,
    proposito: "VERIFICACION_CELULAR",
    canal: "WHATSAPP",
    destino: "+595981000123",
  });

  // Se lleva el expediente hasta AUTORIZADO por la máquina de estados, que es
  // donde P4 puede operar.
  let expediente = banco.expedientes.todos.get(expedienteId);
  if (!expediente) throw new Error("no se creó el expediente");
  for (const estado of ["PLAN_SELECCIONADO", "AUTORIZADO"] as const) {
    const paso = transicionarExpediente(expediente, estado);
    if (!paso.ok) throw new Error(paso.error);
    expediente = paso.expediente;
  }
  banco.expedientes.todos.set(expedienteId, expediente);

  // P4 real: emite el OTP de correo sobre el mismo expediente.
  const envioCorreo = await enviarOtpCorreo(banco.deps, {
    expedienteId,
    otpIdPrevio: null,
    correoIngresado: CORREO,
    contexto: CONTEXTO,
  });
  if (!envioCorreo.ok) throw new Error(`P4 debería haber enviado: ${envioCorreo.motivo}`);

  return {
    expedienteId,
    otpCelular: { otpId: otpCelularVivo.otpId, codigo: otpCelularVivo.codigo },
    otpCorreo: { otpId: envioCorreo.otpId, codigo: codigoDe(envioCorreo.otpId) },
  };
}

beforeEach(() => limpiarRegistroDemo());

describe("los dos OTP son distintos", () => {
  it("cada envío genera un código propio: no hay un código compartido por expediente", async () => {
    // Un solo par podría coincidir por azar (1 en 10⁶). Con doce pares, una
    // implementación que reutilizara el código daría doce coincidencias,
    // mientras que dos generaciones independientes dan cero salvo una
    // casualidad astronómica (P(≥2 coincidencias) ≈ 7·10⁻¹¹).
    const PARES = 12;
    let coincidencias = 0;

    for (let i = 0; i < PARES; i += 1) {
      const banco = crearBanco();
      const celular = await banco.otpRepository.crear({
        expedienteId: `EXP-${i}`,
        proposito: "VERIFICACION_CELULAR",
        canal: "WHATSAPP",
        destino: "+595981000123",
      });
      const correo = await banco.otpRepository.crear({
        expedienteId: `EXP-${i}`,
        proposito: "VERIFICACION_CORREO",
        canal: "EMAIL",
        destino: CORREO,
      });

      expect(celular.otpId).not.toBe(correo.otpId);
      if (celular.codigo === correo.codigo) coincidencias += 1;
    }

    expect(coincidencias).toBeLessThan(2);
  });

  it("quedan como dos registros separados, cada uno con su propósito y su destino", async () => {
    const banco = crearBanco();
    const { otpCelular, otpCorreo } = await prepararExpedienteConAmbosCanales(banco);

    const registroCelular = await banco.otpRepository.obtener(otpCelular.otpId);
    const registroCorreo = await banco.otpRepository.obtener(otpCorreo.otpId);

    expect(registroCelular?.proposito).toBe("VERIFICACION_CELULAR");
    expect(registroCelular?.canal).toBe("WHATSAPP");
    expect(registroCorreo?.proposito).toBe("VERIFICACION_CORREO");
    expect(registroCorreo?.canal).toBe("EMAIL");
    expect(registroCelular?.destino).not.toBe(registroCorreo?.destino);
  });
});

describe("los dos OTP no son intercambiables", () => {
  it("el código del celular no verifica el OTP del correo", async () => {
    const banco = crearBanco();
    const { expedienteId, otpCelular, otpCorreo } = await prepararExpedienteConAmbosCanales(banco);

    const resultado = await verificarOtpCorreo(banco.deps, {
      expedienteId,
      otpId: otpCorreo.otpId,
      codigoIngresado: otpCelular.codigo,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("CODIGO_INCORRECTO");
    // Y el expediente no avanzó.
    expect(banco.expedientes.todos.get(expedienteId)?.estado).toBe("AUTORIZADO");
    expect(banco.expedientes.todos.get(expedienteId)?.canalEmail).toBeNull();
  });

  it("el código del correo no verifica el OTP del celular", async () => {
    const banco = crearBanco();
    const { otpCelular, otpCorreo } = await prepararExpedienteConAmbosCanales(banco);

    const resultado = await banco.deps.otpProvider.verificarOtp({
      otpId: otpCelular.otpId,
      codigoIngresado: otpCorreo.codigo,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("CODIGO_INCORRECTO");
  });

  it("P4 rechaza un otpId de celular por propósito, sin gastarle un intento", async () => {
    const banco = crearBanco();
    const { expedienteId, otpCelular } = await prepararExpedienteConAmbosCanales(banco);

    // Se manda el código correcto DEL CELULAR contra su propio otpId, pero
    // pidiéndoselo a la pantalla del correo: aunque el código sea válido para
    // ese OTP, el propósito no corresponde.
    const resultado = await verificarOtpCorreo(banco.deps, {
      expedienteId,
      otpId: otpCelular.otpId,
      codigoIngresado: otpCelular.codigo,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "PROPOSITO_INCORRECTO" });

    // El rechazo ocurre antes de tocar al proveedor: el OTP de celular sigue
    // intacto, sin intentos gastados y sin consumir.
    const registro = await banco.otpRepository.obtener(otpCelular.otpId);
    expect(registro?.intentos).toBe(0);
    expect(registro?.consumidoEn).toBeNull();
  });

  it("P1 rechaza un otpId de correo por propósito", async () => {
    const banco = crearBanco();
    const { expedienteId, otpCorreo } = await prepararExpedienteConAmbosCanales(banco);

    const resultado = await verificarOtpWhatsapp(banco.deps, {
      expedienteId,
      otpId: otpCorreo.otpId,
      codigoIngresado: otpCorreo.codigo,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "PROPOSITO_INCORRECTO" });

    const registro = await banco.otpRepository.obtener(otpCorreo.otpId);
    expect(registro?.intentos).toBe(0);
    expect(registro?.consumidoEn).toBeNull();
  });

  it("verificar el correo no consume ni invalida el OTP del celular", async () => {
    const banco = crearBanco();
    const { expedienteId, otpCelular, otpCorreo } = await prepararExpedienteConAmbosCanales(banco);

    const resultado = await verificarOtpCorreo(banco.deps, {
      expedienteId,
      otpId: otpCorreo.otpId,
      codigoIngresado: otpCorreo.codigo,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    expect(banco.expedientes.todos.get(expedienteId)?.estado).toBe("CANAL_EMAIL_VERIFICADO");
    expect(banco.expedientes.todos.get(expedienteId)?.canalEmail?.valor).toBe(CORREO);

    // El OTP de celular sigue siendo un registro aparte, intacto.
    const registroCelular = await banco.otpRepository.obtener(otpCelular.otpId);
    expect(registroCelular?.consumidoEn).toBeNull();
    expect(registroCelular?.intentos).toBe(0);

    // Y el canal de WhatsApp verificado en P1 no se pisó con el correo.
    expect(banco.expedientes.todos.get(expedienteId)?.canalWhatsapp?.valor).toBe("+595981000123");
  });

  it("el cooldown de un OTP no bloquea el envío del otro propósito", async () => {
    const banco = crearBanco();

    const envioCelular = await enviarOtpWhatsapp(banco.deps, {
      expedienteId: null,
      otpIdPrevio: null,
      numeroIngresado: NUMERO,
      autorizacionAceptada: true,
      contexto: CONTEXTO,
    });
    if (!envioCelular.ok) throw new Error("P1 debería haber enviado");
    const expedienteId = envioCelular.expedienteId;

    let expediente = banco.expedientes.todos.get(expedienteId);
    if (!expediente) throw new Error("no se creó el expediente");
    for (const estado of ["CANAL_WA_VERIFICADO", "PLAN_SELECCIONADO", "AUTORIZADO"] as const) {
      const paso = transicionarExpediente(expediente, estado);
      if (!paso.ok) throw new Error(paso.error);
      expediente = paso.expediente;
    }
    banco.expedientes.todos.set(expedienteId, expediente);

    // Mismo instante que el envío de P1, con el otpId de P1 todavía en la
    // cookie: el cooldown de 60s es por propósito, así que P4 puede mandar.
    const envioCorreo = await enviarOtpCorreo(banco.deps, {
      expedienteId,
      otpIdPrevio: envioCelular.otpId,
      correoIngresado: CORREO,
      contexto: CONTEXTO,
    });

    expect(envioCorreo.ok).toBe(true);
    if (!envioCorreo.ok) return;
    expect(envioCorreo.otpId).not.toBe(envioCelular.otpId);
    expect(codigoDe(envioCorreo.otpId)).not.toBe(codigoDe(envioCelular.otpId));
  });
});

describe("cada OTP deja su propia evidencia", () => {
  it("los pasos de P1 y P4 se registran con nombres distintos", async () => {
    const banco = crearBanco();
    const evidencias = banco.deps.evidencias as ReturnType<typeof crearEvidenciasEnMemoria>;

    await prepararExpedienteConAmbosCanales(banco);

    const pasos = evidencias.registros.map((registro) => registro.paso);
    expect(pasos).toContain("P1_OTP_WHATSAPP_ENVIO");
    expect(pasos).toContain("P4_OTP_CORREO_ENVIO");
  });

  it("la evidencia guarda los destinos enmascarados, nunca los completos", async () => {
    const banco = crearBanco();
    const evidencias = banco.deps.evidencias as ReturnType<typeof crearEvidenciasEnMemoria>;

    await prepararExpedienteConAmbosCanales(banco);

    for (const registro of evidencias.registros) {
      expect(registro.detalle).not.toContain(CORREO);
      expect(registro.detalle).not.toContain("+595981000123");
      // Y bajo ninguna circunstancia el código.
      expect(registro.detalle ?? "").not.toMatch(/codigo=/);
    }

    const correoEnmascarado = evidencias.registros.find((registro) =>
      registro.paso.startsWith("P4_"),
    )?.detalle;
    expect(correoEnmascarado).toContain("m••••••@example.com");
  });
});

describe("normalización y enmascarado del correo", () => {
  it("enmascara con una cantidad fija de viñetas, sin filtrar el largo del buzón", () => {
    expect(enmascararCorreo("a@correo.com")).toBe("a••••••@correo.com");
    expect(enmascararCorreo("nombre.muy.largo@correo.com")).toBe("n••••••@correo.com");

    expect(normalizarCorreo("  Nombre@Correo.COM ")).toEqual({
      ok: true,
      correo: "nombre@correo.com",
    });
    expect(normalizarCorreo("sin-arroba").ok).toBe(false);
    expect(normalizarCorreo("dos@@arrobas.com").ok).toBe(false);
    expect(normalizarCorreo("sin@dominio").ok).toBe(false);
  });
});
