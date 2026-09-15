/**
 * "Un nuevo OTP invalida el anterior" — manual funcional v4 de Interseguros
 * (14-sep-2026), sección 03A, y el reenvío: "invalidar OTP anterior, emitir
 * uno nuevo y reiniciar vigencia e intentos".
 *
 * Defecto confirmado el 15-sep-2026: la verificación comprobaba que el `otpId`
 * existiera, fuera del expediente y del propósito, pero no que fuera **el
 * último** emitido. Un código anterior seguía sirviendo si alguien armaba la
 * petición con su `otpId`.
 *
 * La regla vive en el dominio (`Expediente.otpVigente`), así que se prueba
 * contra los **dos** proveedores que existen, que se comportan distinto:
 *
 * - el **mock** rota el código dentro del mismo `otpId` al reenviar, pero un
 *   pedido desde cero acuña un `otpId` nuevo y no apaga el anterior;
 * - el **live** de WhatsApp-Modular acuña un `otpId` nuevo en cada pedido,
 *   reenvío incluido, y el servicio sigue verificando el anterior hasta que
 *   vence. El doble de acá lo imita: no invalida nada por su cuenta.
 *
 * Con los dos, el código reemplazado se rechaza con `OTP_REEMPLAZADO` sin
 * llegar al proveedor, así que no gasta ningún intento del vigente, y el
 * rechazo queda en la evidencia (regla inviolable #10).
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  crearOtpProviderWhatsAppModular,
  lectorConMetadataWhatsAppModular,
  limpiarMetadataWhatsAppModular,
} from "../../adapters/live/otp-provider";
import type { ClienteWhatsAppModular } from "../../adapters/live/whatsapp-modular";
import { crearOtpProviderMock, limpiarRegistroDemo, obtenerEnvioDemo } from "../../adapters/mock/otp-provider";
import type { EvidenceStore } from "../../ports/evidence-store";
import type { OtpProvider } from "../../ports/otp-provider";
import { crearFakeDynamoDocumentClient } from "../../repositories/__tests__/fake-dynamo-document-client";
import { crearOtpRepositoryDynamoDb } from "../../repositories/otp-repository";
import type { OtpRepository } from "../../repositories/otp-repository";
import { transicionarExpediente } from "../expediente";
import {
  PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE,
  PASO_EVIDENCIA_OTP_FIRMA_ENVIO,
  registrarActoDeFirmaCliente,
  solicitarOtpDeFirmaCliente,
} from "../firma-cliente";
import type { DependenciasFirmaCliente } from "../firma-cliente";
import type { Expediente, RegistroEvidencia } from "../tipos";
import type { CanalFirma } from "../tipos";
import type { LectorMetadataOtp, RepositorioExpediente } from "../verificacion-canal";
import {
  PASO_EVIDENCIA_ENVIO,
  PASO_EVIDENCIA_REENVIO,
  PASO_EVIDENCIA_VERIFICACION,
  enviarOtpWhatsapp,
  reenviarOtpWhatsapp,
  verificarOtpWhatsapp,
} from "../verificacion-canal-whatsapp";
import { crearExpediente, emisorConstanciaFalso, expedienteEnPaqueteGenerado } from "./fixtures";

const CONTEXTO = { ip: "200.10.20.30", dispositivo: "vitest", sesionId: "sesion-otp-vigente" };
const NUMERO = "981000123";
const T0 = "2026-09-15T12:00:00.000Z";
const T0_MAS_61S = "2026-09-15T12:01:01.000Z";
const T0_MAS_122S = "2026-09-15T12:02:02.000Z";
const TEXTO = "Declaro haber revisado la Solicitud y el FIPF y solicito firmarlos.";
const VERSION_TEXTO = "2026-08-FIRMA-v1";

// ---------------------------------------------------------------------------
// Dobles
// ---------------------------------------------------------------------------

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
      return registros.filter((r) => r.expedienteId === expedienteId);
    },
  };
}

/**
 * `otp-service` de WhatsApp-Modular en memoria, con la semántica que importa
 * acá: cada pedido acuña un `otpId` nuevo y **ninguno apaga al anterior**.
 */
function whatsAppModularEnMemoria(): ClienteWhatsAppModular & { codigoDe(otpId: string): string | undefined } {
  const otps = new Map<string, { codigo: string; intentos: number }>();
  let secuencia = 0;
  return {
    async solicitarOtp() {
      secuencia += 1;
      const otpId = `otp-wm-${secuencia}`;
      otps.set(otpId, { codigo: String(100000 + secuencia * 7919).slice(0, 6), intentos: 0 });
      return { ok: true, otpId, expiraEn: "2026-09-15T12:30:00.000Z", destinoEnmascarado: "+595 ••• ••• 123" };
    },
    async verificarOtp({ otpId, codigo }) {
      const otp = otps.get(otpId);
      if (!otp) return { ok: false, motivo: "ERROR", detalle: "no existe" };
      if (otp.intentos >= 3) return { ok: false, motivo: "INTENTOS_AGOTADOS" };
      if (otp.codigo === codigo) return { ok: true };
      otp.intentos += 1;
      return otp.intentos >= 3
        ? { ok: false, motivo: "INTENTOS_AGOTADOS" }
        : { ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes: 3 - otp.intentos };
    },
    codigoDe: (otpId) => otps.get(otpId)?.codigo,
  };
}

interface Banco {
  readonly otpProvider: OtpProvider;
  readonly lectorOtp: LectorMetadataOtp;
  readonly otpRepository: OtpRepository;
  readonly expedientes: ReturnType<typeof expedientesEnMemoria>;
  readonly evidencias: ReturnType<typeof evidenciasEnMemoria>;
  /** Cuántas veces llegó una verificación al proveedor. */
  verificaciones(): number;
  codigoDe(otpId: string): string;
  ahora(): string;
  avanzarA(fecha: string): void;
}

interface Proveedor {
  readonly nombre: string;
  /** El mock rota dentro del mismo `otpId`; WhatsApp-Modular acuña otro. */
  readonly reenvioAcunaOtpIdNuevo: boolean;
  crear(): Banco;
}

function armarBanco(
  construir: (otpRepository: OtpRepository, reloj: () => string) => {
    readonly proveedor: OtpProvider;
    readonly lector: LectorMetadataOtp;
    readonly codigoPropio: (otpId: string) => string | undefined;
  },
): Banco {
  const { documentClient } = crearFakeDynamoDocumentClient();
  const otpRepository = crearOtpRepositoryDynamoDb({
    documentClient,
    nombreTabla: "tabla-de-prueba",
    obtenerPepper: async () => "pepper-de-prueba",
  });
  let ahora = T0;
  let verificaciones = 0;
  const { proveedor, lector, codigoPropio } = construir(otpRepository, () => ahora);

  return {
    otpProvider: {
      enviarOtp: (solicitud) => proveedor.enviarOtp(solicitud),
      verificarOtp: (solicitud) => {
        verificaciones += 1;
        return proveedor.verificarOtp(solicitud);
      },
      reenviarOtp: (otpId) => proveedor.reenviarOtp(otpId),
    },
    lectorOtp: lector,
    otpRepository,
    expedientes: expedientesEnMemoria(),
    evidencias: evidenciasEnMemoria(),
    verificaciones: () => verificaciones,
    codigoDe(otpId) {
      const codigo = codigoPropio(otpId) ?? obtenerEnvioDemo(otpId)?.codigo;
      if (!codigo) throw new Error(`No hay código conocido para ${otpId}`);
      return codigo;
    },
    ahora: () => ahora,
    avanzarA(fecha) {
      ahora = fecha;
    },
  };
}

const PROVEEDORES: readonly Proveedor[] = [
  {
    nombre: "mock",
    reenvioAcunaOtpIdNuevo: false,
    crear: () =>
      armarBanco((otpRepository, reloj) => ({
        proveedor: crearOtpProviderMock({ otpRepository, retenerCodigoParaPanelDemo: true, ahora: reloj }),
        lector: otpRepository,
        codigoPropio: () => undefined,
      })),
  },
  {
    nombre: "live · WhatsApp-Modular",
    reenvioAcunaOtpIdNuevo: true,
    crear: () =>
      armarBanco((otpRepository, reloj) => {
        const cliente = whatsAppModularEnMemoria();
        // El correo lo atiende el mock, igual que en el composition root.
        const correo = crearOtpProviderMock({ otpRepository, retenerCodigoParaPanelDemo: true, ahora: reloj });
        return {
          proveedor: crearOtpProviderWhatsAppModular({ cliente, correo, ahora: reloj }),
          lector: lectorConMetadataWhatsAppModular(otpRepository),
          codigoPropio: (otpId) => cliente.codigoDe(otpId),
        };
      }),
  },
];

function otroCodigo(codigo: string): string {
  return codigo === "000000" ? "999999" : "000000";
}

beforeEach(() => {
  limpiarRegistroDemo();
  limpiarMetadataWhatsAppModular();
});

// ---------------------------------------------------------------------------
// VERIFICACION_CELULAR (P1)
// ---------------------------------------------------------------------------

function conPlanElegido(banco: Banco, id = "EXP-OTP-VIGENTE"): string {
  const transicion = transicionarExpediente(crearExpediente(id), "PLAN_SELECCIONADO");
  if (!transicion.ok) throw new Error(transicion.error);
  banco.expedientes.todos.set(id, transicion.expediente);
  return id;
}

function depsP1(banco: Banco) {
  return {
    otpProvider: banco.otpProvider,
    lectorOtp: banco.lectorOtp,
    expedientes: banco.expedientes,
    evidencias: banco.evidencias,
    ahora: () => banco.ahora(),
  };
}

async function enviarP1(banco: Banco, expedienteId: string, otpIdPrevio: string | null): Promise<string> {
  const envio = await enviarOtpWhatsapp(depsP1(banco), {
    expedienteId,
    otpIdPrevio,
    numeroIngresado: NUMERO,
    autorizacionAceptada: true,
    contexto: CONTEXTO,
  });
  if (!envio.ok) throw new Error(`el envío debería haber salido: ${envio.motivo}`);
  return envio.otpId;
}

function verificarP1(banco: Banco, expedienteId: string, otpId: string, codigoIngresado: string) {
  return verificarOtpWhatsapp(depsP1(banco), { expedienteId, otpId, codigoIngresado, contexto: CONTEXTO });
}

describe.each(PROVEEDORES)("VERIFICACION_CELULAR · un nuevo OTP invalida el anterior ($nombre)", (proveedor) => {
  it("pedido desde cero: el código viejo falla con OTP_REEMPLAZADO y el nuevo pasa con sus tres intentos", async () => {
    const banco = proveedor.crear();
    const expedienteId = conPlanElegido(banco);

    const viejo = await enviarP1(banco, expedienteId, null);
    const codigoViejo = banco.codigoDe(viejo);
    banco.avanzarA(T0_MAS_61S);
    const nuevo = await enviarP1(banco, expedienteId, viejo);
    expect(nuevo).not.toBe(viejo);

    // El código viejo es correcto para su `otpId`: sin la regla, verificaría.
    const conElViejo = await verificarP1(banco, expedienteId, viejo, codigoViejo);
    expect(conElViejo).toEqual({ ok: false, motivo: "OTP_REEMPLAZADO" });
    expect(banco.verificaciones()).toBe(0);
    expect(banco.expedientes.todos.get(expedienteId)?.estado).toBe("PLAN_SELECCIONADO");

    const rechazo = banco.evidencias.registros.at(-1)!;
    expect(rechazo.paso).toBe(PASO_EVIDENCIA_VERIFICACION);
    expect(rechazo.resultado).toBe("FALLIDO");
    expect(rechazo.ip).toBe(CONTEXTO.ip);
    expect(rechazo.detalle).toContain("motivo=OTP_REEMPLAZADO");
    expect(rechazo.detalle).toContain(`otpId=${viejo}`);
    expect(rechazo.detalle).toContain(`otpVigente=${nuevo}`);

    // El rechazo no tocó al vigente: sigue con los tres intentos.
    const codigoNuevo = banco.codigoDe(nuevo);
    const errado = await verificarP1(banco, expedienteId, nuevo, otroCodigo(codigoNuevo));
    expect(errado).toEqual({ ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes: 2 });

    const conElNuevo = await verificarP1(banco, expedienteId, nuevo, codigoNuevo);
    expect(conElNuevo.ok).toBe(true);
    expect(banco.expedientes.todos.get(expedienteId)?.estado).toBe("CANAL_WA_VERIFICADO");
  });

  it("la evidencia del envío nuevo dice qué código dejó de valer, y el expediente asienta el vigente", async () => {
    const banco = proveedor.crear();
    const expedienteId = conPlanElegido(banco);

    const viejo = await enviarP1(banco, expedienteId, null);
    expect(banco.expedientes.todos.get(expedienteId)?.otpVigente.VERIFICACION_CELULAR).toBe(viejo);

    banco.avanzarA(T0_MAS_61S);
    const nuevo = await enviarP1(banco, expedienteId, viejo);
    expect(banco.expedientes.todos.get(expedienteId)?.otpVigente.VERIFICACION_CELULAR).toBe(nuevo);

    const envios = banco.evidencias.registros.filter((r) => r.paso === PASO_EVIDENCIA_ENVIO);
    expect(envios).toHaveLength(2);
    expect(envios[0]!.detalle).not.toContain("otpReemplazado=");
    expect(envios[1]!.detalle).toContain(`otpId=${nuevo}`);
    expect(envios[1]!.detalle).toContain(`otpReemplazado=${viejo}`);
  });

  it("tras un reenvío solo verifica el último código", async () => {
    const banco = proveedor.crear();
    const expedienteId = conPlanElegido(banco);

    const original = await enviarP1(banco, expedienteId, null);
    const codigoOriginal = banco.codigoDe(original);
    banco.avanzarA(T0_MAS_61S);
    const reenvio = await reenviarOtpWhatsapp(depsP1(banco), { expedienteId, otpId: original, contexto: CONTEXTO });
    if (!reenvio.ok) throw new Error(`el reenvío debería haber salido: ${reenvio.motivo}`);

    expect(reenvio.otpId !== original).toBe(proveedor.reenvioAcunaOtpIdNuevo);
    expect(banco.expedientes.todos.get(expedienteId)?.otpVigente.VERIFICACION_CELULAR).toBe(reenvio.otpId);

    const conElOriginal = await verificarP1(banco, expedienteId, original, codigoOriginal);
    expect(conElOriginal.ok).toBe(false);
    if (!conElOriginal.ok) {
      // WhatsApp-Modular: otro `otpId`, que el dominio corta. Mock: mismo
      // `otpId` con el código rotado, que el repositorio rechaza.
      expect(conElOriginal.motivo).toBe(proveedor.reenvioAcunaOtpIdNuevo ? "OTP_REEMPLAZADO" : "CODIGO_INCORRECTO");
    }

    const conElUltimo = await verificarP1(banco, expedienteId, reenvio.otpId, banco.codigoDe(reenvio.otpId));
    expect(conElUltimo.ok).toBe(true);
  });

  it("no deja reenviar un código ya reemplazado, que volvería a quedar vigente", async () => {
    const banco = proveedor.crear();
    const expedienteId = conPlanElegido(banco);

    const viejo = await enviarP1(banco, expedienteId, null);
    banco.avanzarA(T0_MAS_61S);
    const nuevo = await enviarP1(banco, expedienteId, viejo);
    const codigoNuevo = banco.codigoDe(nuevo);

    banco.avanzarA(T0_MAS_122S);
    const reenvio = await reenviarOtpWhatsapp(depsP1(banco), { expedienteId, otpId: viejo, contexto: CONTEXTO });
    expect(reenvio).toEqual({ ok: false, motivo: "OTP_REEMPLAZADO", expedienteId });
    expect(banco.expedientes.todos.get(expedienteId)?.otpVigente.VERIFICACION_CELULAR).toBe(nuevo);

    const rechazo = banco.evidencias.registros.at(-1)!;
    expect(rechazo.paso).toBe(PASO_EVIDENCIA_REENVIO);
    expect(rechazo.resultado).toBe("FALLIDO");
    expect(rechazo.detalle).toContain("motivo=OTP_REEMPLAZADO");

    // El vigente no se enteró: su código sigue siendo el mismo y verifica.
    expect(banco.codigoDe(nuevo)).toBe(codigoNuevo);
    expect((await verificarP1(banco, expedienteId, nuevo, codigoNuevo)).ok).toBe(true);
  });
});

describe("VERIFICACION_CELULAR · expedientes anteriores a la regla", () => {
  it("sin OTP asentado, el código en curso sigue verificando (vence solo a los 5 minutos)", async () => {
    const banco = PROVEEDORES[0]!.crear();
    const expedienteId = conPlanElegido(banco);
    expect(banco.expedientes.todos.get(expedienteId)?.otpVigente).toEqual({});

    // Emitido por fuera del dominio, como los que salieron antes del cambio.
    const creado = await banco.otpRepository.crear({
      expedienteId,
      proposito: "VERIFICACION_CELULAR",
      canal: "WHATSAPP",
      destino: "+595981000123",
      ahora: T0,
    });

    const resultado = await verificarP1(banco, expedienteId, creado.otpId, creado.codigo);
    expect(resultado.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FIRMA (acto de firma interna del cliente)
// ---------------------------------------------------------------------------

function depsFirma(banco: Banco, expediente: Expediente): DependenciasFirmaCliente {
  banco.expedientes.todos.set(expediente.id, expediente);
  return {
    otpProvider: banco.otpProvider,
    lectorOtp: banco.lectorOtp,
    expedientes: banco.expedientes,
    evidencias: banco.evidencias,
    emitirConstancia: emisorConstanciaFalso(),
    ahora: () => banco.ahora(),
  };
}

async function pedirCodigoFirma(deps: DependenciasFirmaCliente, expedienteId: string, canal: CanalFirma) {
  const envio = await solicitarOtpDeFirmaCliente(deps, { expedienteId, canal, contexto: CONTEXTO });
  if (!envio.ok) throw new Error(`el código de firma debería haber salido: ${envio.motivo}`);
  return envio.otpId;
}

function firmar(
  deps: DependenciasFirmaCliente,
  expedienteId: string,
  canal: CanalFirma,
  otpId: string,
  codigoIngresado: string,
) {
  return registrarActoDeFirmaCliente(deps, {
    expedienteId,
    canal,
    otpId,
    codigoIngresado,
    textoAceptado: TEXTO,
    versionTextoAceptado: VERSION_TEXTO,
    contexto: CONTEXTO,
  });
}

describe.each(PROVEEDORES)("FIRMA · un nuevo OTP invalida el anterior ($nombre)", (proveedor) => {
  it("pedir otro código de firma: el viejo no firma, no gasta nada del vigente, y el nuevo firma", async () => {
    const banco = proveedor.crear();
    const expediente = expedienteEnPaqueteGenerado();
    const deps = depsFirma(banco, expediente);

    const viejo = await pedirCodigoFirma(deps, expediente.id, "WHATSAPP");
    const codigoViejo = banco.codigoDe(viejo);
    const nuevo = await pedirCodigoFirma(deps, expediente.id, "WHATSAPP");
    expect(nuevo).not.toBe(viejo);

    const conElViejo = await firmar(deps, expediente.id, "WHATSAPP", viejo, codigoViejo);
    expect(conElViejo).toEqual({ ok: false, motivo: "OTP_REEMPLAZADO" });
    expect(banco.verificaciones()).toBe(0);
    expect(banco.expedientes.todos.get(expediente.id)?.estado).toBe("PAQUETE_GENERADO");
    expect(banco.expedientes.todos.get(expediente.id)?.firma).toBeNull();

    const rechazo = banco.evidencias.registros.at(-1)!;
    expect(rechazo.paso).toBe(PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE);
    expect(rechazo.resultado).toBe("FALLIDO");
    expect(rechazo.detalle).toContain("motivo=OTP_REEMPLAZADO");
    expect(rechazo.detalle).toContain(`otpVigente=${nuevo}`);

    const envios = banco.evidencias.registros.filter((r) => r.paso === PASO_EVIDENCIA_OTP_FIRMA_ENVIO);
    expect(envios.at(-1)!.detalle).toContain(`otpReemplazado=${viejo}`);

    const codigoNuevo = banco.codigoDe(nuevo);
    const errado = await firmar(deps, expediente.id, "WHATSAPP", nuevo, otroCodigo(codigoNuevo));
    expect(errado).toEqual({ ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes: 2 });

    const firmado = await firmar(deps, expediente.id, "WHATSAPP", nuevo, codigoNuevo);
    expect(firmado.ok).toBe(true);
    expect(banco.expedientes.todos.get(expediente.id)?.firma?.referenciaActo).toBe(nuevo);
  });

  it("cambiar de canal también reemplaza: el código pedido por WhatsApp deja de firmar al pedir otro por correo", async () => {
    // Mismo caso que la contingencia SMS del manual: otro canal, mismo
    // propósito, así que el anterior queda reemplazado igual.
    const banco = proveedor.crear();
    const expediente = expedienteEnPaqueteGenerado();
    const deps = depsFirma(banco, expediente);

    const porWhatsapp = await pedirCodigoFirma(deps, expediente.id, "WHATSAPP");
    const codigoWhatsapp = banco.codigoDe(porWhatsapp);
    const porCorreo = await pedirCodigoFirma(deps, expediente.id, "EMAIL");

    const conElDeWhatsapp = await firmar(deps, expediente.id, "WHATSAPP", porWhatsapp, codigoWhatsapp);
    expect(conElDeWhatsapp).toEqual({ ok: false, motivo: "OTP_REEMPLAZADO" });
    expect(banco.verificaciones()).toBe(0);

    const conElDeCorreo = await firmar(deps, expediente.id, "EMAIL", porCorreo, banco.codigoDe(porCorreo));
    expect(conElDeCorreo.ok).toBe(true);
  });
});
