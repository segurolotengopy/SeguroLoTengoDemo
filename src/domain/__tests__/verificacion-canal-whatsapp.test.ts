/**
 * Caso de uso de P1 con dobles en memoria: acá se prueban las reglas del
 * paso (autorización obligatoria, cooldown, atadura del canal, transición de
 * estado y contenido de la evidencia) sin pasar por HTTP ni por DynamoDB.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { crearOtpProviderMock, limpiarRegistroDemo, obtenerEnvioDemo } from "../../adapters/mock/otp-provider";
import type { EvidenceStore } from "../../ports/evidence-store";
import { crearOtpRepositoryDynamoDb } from "../../repositories/otp-repository";
import type { OtpRepository } from "../../repositories/otp-repository";
import { crearFakeDynamoDocumentClient } from "../../repositories/__tests__/fake-dynamo-document-client";
import type { Expediente, RegistroEvidencia } from "../tipos";
import {
  enviarOtpWhatsapp,
  reenviarOtpWhatsapp,
  verificarOtpWhatsapp,
  VERSION_TEXTO_AUTORIZACION_P1,
} from "../verificacion-canal-whatsapp";
import type { DependenciasP1, RepositorioExpediente } from "../verificacion-canal-whatsapp";

const CONTEXTO = { ip: "200.10.20.30", dispositivo: "vitest", sesionId: "sesion-1" };
const NUMERO = "981000123";
const ENMASCARADO = "+595 ••• ••• 123";

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
      return registros.filter((r) => r.expedienteId === expedienteId);
    },
  };
}

interface Banco {
  readonly deps: DependenciasP1;
  readonly otpRepository: OtpRepository;
  readonly expedientes: ReturnType<typeof crearExpedientesEnMemoria>;
  readonly evidencias: ReturnType<typeof crearEvidenciasEnMemoria>;
  avanzarA(fecha: string): void;
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

  let ahora = "2026-03-15T12:00:00.000Z";
  const otpProvider = crearOtpProviderMock({
    otpRepository,
    retenerCodigoParaPanelDemo: true,
    ahora: () => ahora,
  });

  return {
    otpRepository,
    expedientes,
    evidencias,
    deps: { otpProvider, lectorOtp: otpRepository, expedientes, evidencias, ahora: () => ahora },
    avanzarA(fecha: string) {
      ahora = fecha;
    },
  };
}

async function enviarYObtenerCodigo(banco: Banco): Promise<{ expedienteId: string; otpId: string; codigo: string }> {
  const envio = await enviarOtpWhatsapp(banco.deps, {
    expedienteId: null,
    otpIdPrevio: null,
    numeroIngresado: NUMERO,
    autorizacionAceptada: true,
    contexto: CONTEXTO,
  });
  if (!envio.ok) throw new Error(`el envío debería haber salido bien: ${envio.motivo}`);
  const codigo = obtenerEnvioDemo(envio.otpId)?.codigo;
  if (!codigo) throw new Error("el registro de demo no tiene el código");
  return { expedienteId: envio.expedienteId, otpId: envio.otpId, codigo };
}

describe("P1 · envío del OTP de WhatsApp", () => {
  beforeEach(() => limpiarRegistroDemo());

  it("exige la autorización del checkbox antes de mandar nada", async () => {
    const banco = crearBanco();
    const resultado = await enviarOtpWhatsapp(banco.deps, {
      expedienteId: null,
      otpIdPrevio: null,
      numeroIngresado: NUMERO,
      autorizacionAceptada: false,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "AUTORIZACION_REQUERIDA", expedienteId: null });
    expect(banco.expedientes.todos.size).toBe(0);
    expect(banco.evidencias.registros).toHaveLength(0);
  });

  it("rechaza un número que no es celular paraguayo", async () => {
    const banco = crearBanco();
    const resultado = await enviarOtpWhatsapp(banco.deps, {
      expedienteId: null,
      otpIdPrevio: null,
      numeroIngresado: "12345",
      autorizacionAceptada: true,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("DESTINO_INVALIDO");
  });

  it("crea el expediente en INICIADO y registra evidencia con número enmascarado y referencia", async () => {
    const banco = crearBanco();
    const { expedienteId } = await enviarYObtenerCodigo(banco);

    expect(banco.expedientes.todos.get(expedienteId)?.estado).toBe("INICIADO");

    const evidencia = banco.evidencias.registros.at(-1)!;
    expect(evidencia.paso).toBe("P1_OTP_WHATSAPP_ENVIO");
    expect(evidencia.resultado).toBe("EXITOSO");
    expect(evidencia.ip).toBe(CONTEXTO.ip);
    expect(evidencia.sesionId).toBe(CONTEXTO.sesionId);
    expect(evidencia.versionTextoAceptado).toBe(VERSION_TEXTO_AUTORIZACION_P1);
    expect(evidencia.detalle).toContain(ENMASCARADO);
    expect(evidencia.detalle).toContain("referenciaEnvio=MOCK-WHATSAPP-");
    expect(evidencia.fecha).toBe("2026-03-15T12:00:00.000Z");
  });

  it("aplica el cooldown de 60s también al pedir un código nuevo desde cero", async () => {
    const banco = crearBanco();
    const primero = await enviarYObtenerCodigo(banco);

    banco.avanzarA("2026-03-15T12:00:30.000Z");
    const segundo = await enviarOtpWhatsapp(banco.deps, {
      expedienteId: primero.expedienteId,
      otpIdPrevio: primero.otpId,
      numeroIngresado: NUMERO,
      autorizacionAceptada: true,
      contexto: CONTEXTO,
    });

    expect(segundo.ok).toBe(false);
    if (segundo.ok) return;
    expect(segundo.motivo).toBe("REENVIO_BLOQUEADO");
    expect(segundo.segundosRestantes).toBe(30);
  });
});

describe("P1 · verificación del código", () => {
  beforeEach(() => limpiarRegistroDemo());

  it("con el código correcto pasa el expediente a CANAL_WA_VERIFICADO y guarda el canal", async () => {
    const banco = crearBanco();
    const { expedienteId, otpId, codigo } = await enviarYObtenerCodigo(banco);

    const resultado = await verificarOtpWhatsapp(banco.deps, {
      expedienteId,
      otpId,
      codigoIngresado: codigo,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.estado).toBe("CANAL_WA_VERIFICADO");
    expect(resultado.destinoEnmascarado).toBe(ENMASCARADO);

    const expediente = banco.expedientes.todos.get(expedienteId)!;
    expect(expediente.estado).toBe("CANAL_WA_VERIFICADO");
    // El canal verificado es el número al que se envió el código, no uno
    // declarado por el cliente en la petición de verificación.
    expect(expediente.canalWhatsapp).toEqual({
      valor: "+595981000123",
      verificadoEn: "2026-03-15T12:00:00.000Z",
    });
    expect(expediente.historial.map((h) => h.estado)).toEqual(["INICIADO", "CANAL_WA_VERIFICADO"]);
  });

  it("un código incorrecto no transiciona el expediente y descuenta intentos", async () => {
    const banco = crearBanco();
    const { expedienteId, otpId } = await enviarYObtenerCodigo(banco);

    const resultado = await verificarOtpWhatsapp(banco.deps, {
      expedienteId,
      otpId,
      codigoIngresado: "000000",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("CODIGO_INCORRECTO");
    expect(resultado.intentosRestantes).toBe(2);
    expect(banco.expedientes.todos.get(expedienteId)?.estado).toBe("INICIADO");

    const evidencia = banco.evidencias.registros.at(-1)!;
    expect(evidencia.resultado).toBe("FALLIDO");
    expect(evidencia.detalle).toContain("motivo=CODIGO_INCORRECTO");
  });

  it("no acepta un OTP que pertenece a otro expediente", async () => {
    const banco = crearBanco();
    const { otpId, codigo } = await enviarYObtenerCodigo(banco);

    const resultado = await verificarOtpWhatsapp(banco.deps, {
      expedienteId: "EXP-DE-OTRA-PERSONA",
      otpId,
      codigoIngresado: codigo,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "OTP_DE_OTRO_EXPEDIENTE" });
  });

  it("no reutiliza un OTP de otro propósito (regla #1: tres OTP independientes)", async () => {
    const banco = crearBanco();
    const creado = await banco.otpRepository.crear({
      expedienteId: "EXP-1",
      proposito: "VERIFICACION_CORREO",
      canal: "EMAIL",
      destino: "persona@correo.com",
      ahora: "2026-03-15T12:00:00.000Z",
    });

    const resultado = await verificarOtpWhatsapp(banco.deps, {
      expedienteId: "EXP-1",
      otpId: creado.otpId,
      codigoIngresado: creado.codigo,
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "PROPOSITO_INCORRECTO" });
  });

  it("un OTP ya usado no vuelve a verificar (uso único)", async () => {
    const banco = crearBanco();
    const { expedienteId, otpId, codigo } = await enviarYObtenerCodigo(banco);

    await verificarOtpWhatsapp(banco.deps, { expedienteId, otpId, codigoIngresado: codigo, contexto: CONTEXTO });
    const segunda = await verificarOtpWhatsapp(banco.deps, {
      expedienteId,
      otpId,
      codigoIngresado: codigo,
      contexto: CONTEXTO,
    });

    expect(segunda.ok).toBe(false);
    if (segunda.ok) return;
    expect(segunda.motivo).toBe("YA_UTILIZADO");
  });
});

describe("P1 · reenvío", () => {
  beforeEach(() => limpiarRegistroDemo());

  it("bloquea antes de los 60 segundos y rota el código después", async () => {
    const banco = crearBanco();
    const { expedienteId, otpId, codigo } = await enviarYObtenerCodigo(banco);

    banco.avanzarA("2026-03-15T12:00:30.000Z");
    const bloqueado = await reenviarOtpWhatsapp(banco.deps, { expedienteId, otpId, contexto: CONTEXTO });
    expect(bloqueado.ok).toBe(false);
    if (!bloqueado.ok) expect(bloqueado.motivo).toBe("REENVIO_BLOQUEADO");

    banco.avanzarA("2026-03-15T12:01:01.000Z");
    const reenviado = await reenviarOtpWhatsapp(banco.deps, { expedienteId, otpId, contexto: CONTEXTO });
    expect(reenviado.ok).toBe(true);

    const codigoNuevo = obtenerEnvioDemo(otpId)?.codigo;
    expect(codigoNuevo).toMatch(/^\d{6}$/);
    expect(codigoNuevo).not.toBe(codigo);

    // El código viejo deja de servir apenas se rota.
    const conCodigoViejo = await verificarOtpWhatsapp(banco.deps, {
      expedienteId,
      otpId,
      codigoIngresado: codigo,
      contexto: CONTEXTO,
    });
    expect(conCodigoViejo.ok).toBe(false);
  });
});
