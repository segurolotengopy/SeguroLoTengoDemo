/**
 * Regla inviolable #1, en su forma nueva: **hay un solo OTP de canal**, el del
 * celular, y su código no sirve para ningún otro propósito.
 *
 * Reemplaza a `otp-independientes.test.ts`, que protegía la independencia
 * entre el OTP del celular y el del correo. Ese segundo código se retiró
 * (D-06): el correo se declara con doble tipeo y se respalda con la
 * declaración de veracidad firmada, así que ya no hay dos códigos que
 * confundir. Lo que sí sigue habiendo —y esto es lo que el test protege— es un
 * código con un propósito declarado, que no puede reutilizarse para otro.
 *
 * Se ejerce contra el repositorio de OTP real (sobre un DynamoDB falso en
 * memoria) y el adaptador mock real, no contra dobles del propio motor, así
 * que lo que se prueba es el comportamiento de producción.
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
import { crearFakeDynamoDocumentClient } from "../../repositories/__tests__/fake-dynamo-document-client";
import type { Expediente, RegistroEvidencia } from "../tipos";
import { enviarOtpWhatsapp, verificarOtpWhatsapp } from "../verificacion-canal-whatsapp";
import type { DependenciasVerificacionCanal, RepositorioExpediente } from "../verificacion-canal";
import { transicionarExpediente } from "../expediente";
import { crearExpediente } from "./fixtures";

const NUMERO = "+595 981 123 456";
const CONTEXTO = { ip: "200.10.20.30", dispositivo: "vitest", sesionId: "sesion-otp" };

function expedientesEnMemoria(): RepositorioExpediente & { todos: Map<string, Expediente> } {
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

function evidenciasEnMemoria(): EvidenceStore & { registros: RegistroEvidencia[] } {
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
  readonly expedientes: ReturnType<typeof expedientesEnMemoria>;
  readonly expedienteId: string;
}

/** Expediente con plan elegido: el estado desde el que se verifica el canal. */
function crearBanco(id = "EXP-OTP"): Banco {
  const { documentClient } = crearFakeDynamoDocumentClient();
  const otpRepository = crearOtpRepositoryDynamoDb({
    documentClient,
    nombreTabla: "tabla-de-prueba",
    obtenerPepper: async () => "pepper-de-prueba",
  });
  const expedientes = expedientesEnMemoria();
  const transicion = transicionarExpediente(crearExpediente(id), "PLAN_SELECCIONADO");
  if (!transicion.ok) throw new Error(transicion.error);
  expedientes.todos.set(id, transicion.expediente);

  const otpProvider = crearOtpProviderMock({ otpRepository, retenerCodigoParaPanelDemo: true });

  return {
    expedientes,
    expedienteId: id,
    deps: {
      otpProvider,
      lectorOtp: otpRepository,
      expedientes,
      evidencias: evidenciasEnMemoria(),
    },
  };
}

async function enviarYLeerCodigo(banco: Banco) {
  const envio = await enviarOtpWhatsapp(banco.deps, {
    expedienteId: banco.expedienteId,
    otpIdPrevio: null,
    numeroIngresado: NUMERO,
    autorizacionAceptada: true,
    contexto: CONTEXTO,
  });
  if (!envio.ok) throw new Error(`el envío debería haber salido bien: ${envio.motivo}`);
  const codigo = obtenerEnvioDemo(envio.otpId)?.codigo;
  if (!codigo) throw new Error("el registro de demo no tiene el código");
  return { otpId: envio.otpId, codigo };
}

describe("regla #1 · un solo OTP de canal", () => {
  beforeEach(() => limpiarRegistroDemo());

  it("el código del celular verifica el celular y deja el canal asentado", async () => {
    const banco = crearBanco();
    const { otpId, codigo } = await enviarYLeerCodigo(banco);

    const resultado = await verificarOtpWhatsapp(banco.deps, {
      expedienteId: banco.expedienteId,
      otpId,
      codigoIngresado: codigo,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    const expediente = banco.expedientes.todos.get(banco.expedienteId);
    expect(expediente?.estado).toBe("CANAL_WA_VERIFICADO");
    expect(expediente?.canalWhatsapp?.valor).toBe("+595981123456");
  });

  it("el código se consume: no sirve dos veces", async () => {
    const banco = crearBanco();
    const { otpId, codigo } = await enviarYLeerCodigo(banco);

    const primera = await verificarOtpWhatsapp(banco.deps, {
      expedienteId: banco.expedienteId,
      otpId,
      codigoIngresado: codigo,
      contexto: CONTEXTO,
    });
    const segunda = await verificarOtpWhatsapp(banco.deps, {
      expedienteId: banco.expedienteId,
      otpId,
      codigoIngresado: codigo,
      contexto: CONTEXTO,
    });

    expect(primera.ok).toBe(true);
    expect(segunda.ok).toBe(false);
  });

  it("el código no viaja en claro: solo lo conoce el canal del panel de demo", async () => {
    const banco = crearBanco();
    const envio = await enviarOtpWhatsapp(banco.deps, {
      expedienteId: banco.expedienteId,
      otpIdPrevio: null,
      numeroIngresado: NUMERO,
      autorizacionAceptada: true,
      contexto: CONTEXTO,
    });
    if (!envio.ok) throw new Error("el envío debería haber salido bien");

    const codigo = obtenerEnvioDemo(envio.otpId)?.codigo;
    expect(codigo).toMatch(/^\d{6}$/);

    // Ni la respuesta del caso de uso ni la evidencia pueden contenerlo.
    const serializado = JSON.stringify({ envio, evidencias: banco.deps.evidencias });
    expect(serializado).not.toContain(codigo);
  });
});
