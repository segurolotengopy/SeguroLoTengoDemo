/**
 * Caso de uso de P5 con el adaptador mock de identidad y dobles en memoria:
 * acá se prueban las reglas del paso —los cinco requisitos, el rango de edad
 * calculado desde la cédula, la autorización biométrica, la transición de
 * estado y el contenido de la evidencia— sin pasar por HTTP ni por DynamoDB.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  crearIdentityProviderMock,
  limpiarSesionesIdentidadMock,
} from "../../adapters/mock/identity-provider";
import { fijarSeleccionDemo, reiniciarSeleccionDemo } from "../../adapters/mock/persona-activa";
import { obtenerPersonaDemo } from "../../adapters/mock/personas";
import type { EscenarioIdentidadDemo } from "../../adapters/mock/persona-activa";
import type { EvidenceStore } from "../../ports/evidence-store";
import { transicionarExpediente } from "../expediente";
import { crearExpedienteInicial } from "../tipos";
import type { EstadoExpediente, Expediente, RegistroEvidencia } from "../tipos";
import {
  analizarIdentidadP5,
  confirmarIdentidadP5,
  PASO_EVIDENCIA_CAPTURA_P5,
  PASO_EVIDENCIA_VERIFICACION_P5,
  registrarCapturaP5,
} from "../verificacion-identidad";
import type { DependenciasP5, ImagenesP5 } from "../verificacion-identidad";
import type { RepositorioExpediente } from "../verificacion-canal";

const CONTEXTO = { ip: "200.10.20.30", dispositivo: "vitest", sesionId: "sesion-p5" };
const EXPEDIENTE_ID = "EXP-P5";
const AHORA = "2026-03-15T12:00:00.000Z";

const IMAGENES: ImagenesP5 = {
  frente: new Uint8Array([1, 1, 1, 1]),
  dorso: new Uint8Array([2, 2, 2, 2]),
  selfie: { tipo: "VIDEO", video: new Uint8Array([3, 3, 3, 3]) },
};

const PAIS = "Paraguay";
const ESTADO_CIVIL = "Soltero/a";

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

function expedienteEn(estado: EstadoExpediente): Expediente {
  const secuencia: EstadoExpediente[] = [
    "CANAL_WA_VERIFICADO",
    "PLAN_SELECCIONADO",
    "AUTORIZADO",
    "CANAL_EMAIL_VERIFICADO",
  ];

  let actual = crearExpedienteInicial({ id: EXPEDIENTE_ID, ahora: AHORA });
  for (const siguiente of secuencia) {
    const resultado = transicionarExpediente(actual, siguiente, {}, AHORA);
    if (!resultado.ok) throw new Error(resultado.error);
    actual = resultado.expediente;
    if (siguiente === estado) break;
  }
  return actual;
}

interface Banco {
  readonly deps: DependenciasP5;
  readonly expedientes: ReturnType<typeof crearExpedientesEnMemoria>;
  readonly evidencias: ReturnType<typeof crearEvidenciasEnMemoria>;
}

function crearBanco(
  estadoInicial: EstadoExpediente = "CANAL_EMAIL_VERIFICADO",
  /**
   * Expedientes previos de la misma cédula, para ejercitar la regla de bloqueo
   * de nuevo registro (`docs/CONSOLA_ADMINISTRATIVA.md` §5). Por defecto no hay
   * ninguno: el camino feliz de P5 no está bloqueado por nadie.
   */
  previosDeLaCedula: readonly Expediente[] = [],
): Banco {
  const expedientes = crearExpedientesEnMemoria();
  const evidencias = crearEvidenciasEnMemoria();
  const expediente = expedienteEn(estadoInicial);
  expedientes.todos.set(expediente.id, expediente);

  return {
    expedientes,
    evidencias,
    deps: {
      identidad: crearIdentityProviderMock(),
      expedientes,
      evidencias,
      bloqueos: { buscarPorCedula: async () => previosDeLaCedula, buscarSucesores: async () => [] },
      ahora: () => AHORA,
    },
  };
}

function conEscenario(escenario: EscenarioIdentidadDemo | null) {
  fijarSeleccionDemo({ personaId: "camino-feliz", escenarioIdentidadForzado: escenario });
}

async function confirmar(banco: Banco, cambios: Partial<Parameters<typeof confirmarIdentidadP5>[1]> = {}) {
  return confirmarIdentidadP5(banco.deps, {
    expedienteId: EXPEDIENTE_ID,
    imagenes: IMAGENES,
    paisNacimiento: PAIS,
    estadoCivil: ESTADO_CIVIL,
    autorizacionBiometrica: true,
    contexto: CONTEXTO,
    ...cambios,
  });
}

beforeEach(() => {
  limpiarSesionesIdentidadMock();
  reiniciarSeleccionDemo();
});

describe("P5 · camino feliz", () => {
  it("registra cada captura con su hash y deja evidencia por captura", async () => {
    conEscenario("APROBADO");
    const banco = crearBanco();

    const frente = await registrarCapturaP5(banco.deps, {
      expedienteId: EXPEDIENTE_ID,
      tipo: "FRENTE",
      imagen: IMAGENES.frente,
      contexto: CONTEXTO,
    });
    const selfie = await registrarCapturaP5(banco.deps, {
      expedienteId: EXPEDIENTE_ID,
      tipo: "SELFIE",
      imagen: IMAGENES.selfie,
      contexto: CONTEXTO,
    });

    expect(frente.ok && frente.aprobada).toBe(true);
    expect(frente.ok && frente.hashSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(selfie.ok && selfie.pruebaDeVidaAprobada).toBe(true);

    const capturas = banco.evidencias.registros.filter(
      (registro) => registro.paso === PASO_EVIDENCIA_CAPTURA_P5,
    );
    expect(capturas).toHaveLength(2);
    expect(capturas[0].ip).toBe(CONTEXTO.ip);
    expect(capturas[0].resultado).toBe("EXITOSO");
  });

  it("el análisis devuelve los seis campos de la cédula y la edad calculada del documento", async () => {
    conEscenario("APROBADO");
    const banco = crearBanco();
    const persona = obtenerPersonaDemo("camino-feliz");

    const resultado = await analizarIdentidadP5(banco.deps, {
      expedienteId: EXPEDIENTE_ID,
      imagenes: IMAGENES,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.datos?.fechaNacimiento).toBe(persona?.identidad.fechaNacimiento);
    expect(resultado.datos?.edadEnRango).toBe(true);
    expect(resultado.requisitos.cedulaVigenteYLegible).toBe(true);
    expect(resultado.requisitos.coincidenciaFacial).toBe(true);
    // Todavía no eligió país ni estado civil.
    expect(resultado.requisitos.paisYEstadoCivilCompletos).toBe(false);
    // El análisis no transiciona nada.
    expect(banco.expedientes.todos.get(EXPEDIENTE_ID)?.estado).toBe("CANAL_EMAIL_VERIFICADO");
  });

  it("confirma la identidad, transiciona a IDENTIDAD_VERIFICADA y persiste la Identidad completa", async () => {
    conEscenario("APROBADO");
    const banco = crearBanco();
    const persona = obtenerPersonaDemo("camino-feliz");

    const resultado = await confirmar(banco);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.estado).toBe("IDENTIDAD_VERIFICADA");

    const guardado = banco.expedientes.todos.get(EXPEDIENTE_ID);
    expect(guardado?.estado).toBe("IDENTIDAD_VERIFICADA");
    // Los seis campos vienen del OCR; los dos selectores, de la persona.
    expect(guardado?.identidad?.numeroCedula).toBe(persona?.identidad.numeroCedula);
    expect(guardado?.identidad?.fechaNacimiento).toBe(persona?.identidad.fechaNacimiento);
    expect(guardado?.identidad?.paisNacimiento).toBe(PAIS);
    expect(guardado?.identidad?.estadoCivil).toBe(ESTADO_CIVIL);
    expect(guardado?.identidad?.captura.pruebaDeVidaAprobada).toBe(true);
    expect(guardado?.identidad?.captura.coincidenciaFacialAprobada).toBe(true);
    expect(guardado?.identidad?.captura.hashFrenteCedula).toMatch(/^[0-9a-f]{64}$/);
    // Los tres hashes son distintos porque las tres imágenes lo son.
    const { hashFrenteCedula, hashDorsoCedula, hashSelfie } = guardado!.identidad!.captura;
    expect(new Set([hashFrenteCedula, hashDorsoCedula, hashSelfie]).size).toBe(3);
  });

  it("deja evidencia de la verificación con hashes y resultados, sin datos de la cédula", async () => {
    conEscenario("APROBADO");
    const banco = crearBanco();

    await confirmar(banco);

    const verificacion = banco.evidencias.registros.find(
      (registro) => registro.paso === PASO_EVIDENCIA_VERIFICACION_P5,
    );
    expect(verificacion?.resultado).toBe("EXITOSO");
    expect(verificacion?.detalle).toContain("coincidenciaFacial=true");
    expect(verificacion?.detalle).toContain("hashFrente=");
    // Regla inviolable #7 y checklist de CLAUDE.md: ni la cédula ni el nombre
    // se duplican en el registro probatorio de cada intento.
    const persona = obtenerPersonaDemo("camino-feliz");
    expect(verificacion?.detalle).not.toContain(persona!.identidad.numeroCedula);
    expect(verificacion?.detalle?.toLowerCase()).not.toContain("mónica");
  });
});

describe("P5 · desenlaces que no dejan continuar", () => {
  it("bloquea si la edad calculada de la cédula está fuera del rango 18-64 (regla #8)", async () => {
    conEscenario("EDAD_FUERA_DE_RANGO");
    const banco = crearBanco();

    const resultado = await confirmar(banco);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("EDAD_FUERA_DE_RANGO");
    expect(resultado.datos?.edadEnRango).toBe(false);
    // No deriva a Pantalla A: eso es exclusivo de las declaraciones de P6.
    expect(banco.expedientes.todos.get(EXPEDIENTE_ID)?.estado).toBe("CANAL_EMAIL_VERIFICADO");
  });

  it("bloquea si la cédula ya tiene un expediente terminal sin póliza sin superar", async () => {
    // Regla de bloqueo de nuevo registro (docs/CONSOLA_ADMINISTRATIVA.md §5):
    // mientras exista un expediente DERIVADO_MANUAL / VENCIDO /
    // DEVOLUCION_EN_TRAMITE para esa cédula, el flujo digital no deja empezar
    // uno nuevo. Solo la consola lo levanta, creando un sucesor.
    const derivado: Expediente = {
      ...crearExpedienteInicial({ id: "EXP-VIEJO", ahora: AHORA }),
      estado: "DERIVADO_MANUAL",
      numeroCasoDerivacion: "CASO-2026-000042",
    };
    const banco = crearBanco("CANAL_EMAIL_VERIFICADO", [derivado]);

    const resultado = await confirmar(banco);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("CEDULA_BLOQUEADA");
    // El expediente en curso no avanza, y el viejo no se tocó.
    expect(banco.expedientes.todos.get(EXPEDIENTE_ID)?.estado).toBe("CANAL_EMAIL_VERIFICADO");
  });

  it("deja pasar si el expediente terminal ya fue superado por un sucesor", async () => {
    const derivado: Expediente = {
      ...crearExpedienteInicial({ id: "EXP-VIEJO", ahora: AHORA }),
      estado: "DERIVADO_MANUAL",
    };
    const sucesor = crearExpedienteInicial({
      id: "EXP-SUCESOR",
      ahora: AHORA,
      expedienteAnteriorId: "EXP-VIEJO",
    });
    const banco = crearBanco("CANAL_EMAIL_VERIFICADO", [derivado, sucesor]);

    const resultado = await confirmar(banco);

    expect(resultado.ok).toBe(true);
    expect(banco.expedientes.todos.get(EXPEDIENTE_ID)?.estado).toBe("IDENTIDAD_VERIFICADA");
  });

  it("bloquea cuando la cara no coincide, con el requisito de coincidencia facial pendiente", async () => {
    conEscenario("NO_COINCIDE_CARA");
    const banco = crearBanco();

    const resultado = await confirmar(banco);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("REQUISITOS_INCOMPLETOS");
    expect(resultado.pendientes).toEqual(["coincidenciaFacial"]);
    expect(banco.expedientes.todos.get(EXPEDIENTE_ID)?.estado).toBe("CANAL_EMAIL_VERIFICADO");
  });

  it("rechaza la captura por calidad insuficiente y deja el OCR sin datos", async () => {
    conEscenario("CALIDAD_INSUFICIENTE");
    const banco = crearBanco();

    const captura = await registrarCapturaP5(banco.deps, {
      expedienteId: EXPEDIENTE_ID,
      tipo: "FRENTE",
      imagen: IMAGENES.frente,
      contexto: CONTEXTO,
    });
    const analisis = await analizarIdentidadP5(banco.deps, {
      expedienteId: EXPEDIENTE_ID,
      imagenes: IMAGENES,
      contexto: CONTEXTO,
    });
    const resultado = await confirmar(banco);

    // Una captura rechazada no es un error del paso: es un resultado con motivo.
    expect(captura.ok).toBe(true);
    expect(captura.ok && captura.aprobada).toBe(false);
    expect(captura.ok && captura.motivoRechazo).not.toBeNull();

    expect(analisis.ok && analisis.datos).toBeNull();
    expect(analisis.ok && analisis.requisitos.frenteYDorsoAprobados).toBe(false);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("REQUISITOS_INCOMPLETOS");
    expect(resultado.pendientes).toContain("frenteYDorsoAprobados");
    expect(banco.expedientes.todos.get(EXPEDIENTE_ID)?.estado).toBe("CANAL_EMAIL_VERIFICADO");
  });

  it("exige la autorización biométrica antes de tocar al proveedor", async () => {
    conEscenario("APROBADO");
    const banco = crearBanco();

    const resultado = await confirmar(banco, { autorizacionBiometrica: false });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("AUTORIZACION_BIOMETRICA_REQUERIDA");
    expect(banco.evidencias.registros).toHaveLength(0);
  });

  it("exige país de nacimiento y estado civil del catálogo", async () => {
    conEscenario("APROBADO");
    const banco = crearBanco();

    const sinPais = await confirmar(banco, { paisNacimiento: "" });
    const inventado = await confirmar(banco, { estadoCivil: "Comprometido" });

    expect(sinPais.ok).toBe(false);
    expect(!sinPais.ok && sinPais.motivo).toBe("PAIS_O_ESTADO_CIVIL_INVALIDO");
    expect(inventado.ok).toBe(false);
    expect(!inventado.ok && inventado.motivo).toBe("PAIS_O_ESTADO_CIVIL_INVALIDO");
  });

  it("no opera si el expediente no está en CANAL_EMAIL_VERIFICADO", async () => {
    conEscenario("APROBADO");
    const banco = crearBanco("AUTORIZADO");

    const captura = await registrarCapturaP5(banco.deps, {
      expedienteId: EXPEDIENTE_ID,
      tipo: "FRENTE",
      imagen: IMAGENES.frente,
      contexto: CONTEXTO,
    });
    const resultado = await confirmar(banco);

    expect(captura.ok).toBe(false);
    expect(!captura.ok && captura.motivo).toBe("ESTADO_INVALIDO");
    expect(resultado.ok).toBe(false);
    expect(!resultado.ok && resultado.motivo).toBe("ESTADO_INVALIDO");
    expect(banco.expedientes.todos.get(EXPEDIENTE_ID)?.estado).toBe("AUTORIZADO");
  });
});

describe("P5 · los datos extraídos no se editan a mano", () => {
  it("la confirmación no acepta ningún campo de la cédula: los seis los pone el proveedor", async () => {
    conEscenario("APROBADO");
    const banco = crearBanco();
    const persona = obtenerPersonaDemo("camino-feliz");

    // El tipo de entrada no tiene dónde poner un nombre o una fecha de
    // nacimiento; esto verifica que un objeto con campos de más tampoco los
    // cuele por accidente.
    const conCamposDeMas = Object.assign(
      {
        expedienteId: EXPEDIENTE_ID,
        imagenes: IMAGENES,
        paisNacimiento: PAIS,
        estadoCivil: ESTADO_CIVIL,
        autorizacionBiometrica: true,
        contexto: CONTEXTO,
      },
      { nombres: "Otro Nombre", fechaNacimiento: "1970-01-01" },
    );

    const resultado = await confirmarIdentidadP5(banco.deps, conCamposDeMas);

    expect(resultado.ok).toBe(true);
    const guardado = banco.expedientes.todos.get(EXPEDIENTE_ID);
    expect(guardado?.identidad?.nombres).toBe(persona?.identidad.nombres);
    expect(guardado?.identidad?.fechaNacimiento).toBe(persona?.identidad.fechaNacimiento);
  });
});
