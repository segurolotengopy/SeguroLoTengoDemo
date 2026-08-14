/**
 * Cédula del formato anterior (sin MRZ) resuelta con el cruce al registro
 * civil — §9 de `docs/RECOMENDACIONES_ONBOARDING_IDENTIDAD.md`.
 *
 * El problema que esto cierra: sin MRZ no hay de dónde sacar nombre ni fecha
 * de nacimiento con garantías, así que esas personas aprobaban las tres
 * capturas y después chocaban contra un "repetí la captura" que nunca iba a
 * alcanzar. Con el número —que el frente sí da— se le pregunta a la fuente
 * oficial.
 *
 * Lo que se prueba acá es el **caso de uso completo**, con dobles en memoria:
 * qué pasa cuando el registro encuentra, cuando no encuentra, cuando no
 * contesta y cuando no hay proveedor configurado. Los cuatro desenlaces son
 * distintos y ninguno puede confundirse con otro.
 */
import { describe, expect, it } from "vitest";
import type { EvidenceStore } from "../../ports/evidence-store";
import type {
  IdentityProvider,
  ResultadoOcrCedula,
} from "../../ports/identity-provider";
import type { RegistroCivilProvider } from "../../ports/registro-civil";
import { crearExpedienteInicial } from "../tipos";
import type { Expediente, RegistroEvidencia } from "../tipos";
import { transicionarExpediente } from "../expediente";
import { analizarIdentidadP5, PASO_EVIDENCIA_REGISTRO_CIVIL_P5 } from "../verificacion-identidad";
import type { DependenciasP5, ImagenesP5 } from "../verificacion-identidad";
import type { RepositorioExpediente } from "../verificacion-canal";

const CONTEXTO = { ip: "200.10.20.30", dispositivo: "vitest", sesionId: "sesion-rc" };
const EXPEDIENTE_ID = "EXP-RC";
const AHORA = "2026-03-15T12:00:00.000Z";

const IMAGENES: ImagenesP5 = {
  frente: new Uint8Array([1, 1, 1, 1]),
  dorso: new Uint8Array([2, 2, 2, 2]),
  selfie: { tipo: "VIDEO", video: new Uint8Array([3, 3, 3, 3]) },
};

/** Datos que devolvería el registro para la cédula del formato anterior. */
const DATOS_REGISTRO = {
  numeroCedula: "3874512",
  nombres: "RAMONA",
  apellidos: "BENITEZ",
  fechaNacimiento: "1975-09-08",
  sexo: "F",
  nacionalidad: "PARAGUAYA",
};

/**
 * `IdentityProvider` que simula una cédula del formato anterior: todo aprueba,
 * pero el OCR no es confiable y solo puede ofrecer el número del frente.
 */
function identidadFormatoAnterior(numeroLegible: string | null): IdentityProvider {
  const imagen = { referencia: "REF", hashSha256: "h".repeat(64) };
  const ocr: ResultadoOcrCedula = {
    datos: {
      numeroCedula: "",
      nombres: "",
      apellidos: "",
      fechaNacimiento: "",
      sexo: "",
      nacionalidad: "",
    },
    confiable: false,
    numeroCedulaSinConfirmar: numeroLegible,
  };

  return {
    async capturarFrenteCedula() {
      return { calidadAprobada: true, autenticidadAprobada: true, imagen, motivoRechazo: null };
    },
    async capturarDorsoCedula() {
      return { calidadAprobada: true, autenticidadAprobada: true, imagen, motivoRechazo: null };
    },
    async extraerDatosCedula() {
      return ocr;
    },
    async capturarSelfieYPruebaDeVida() {
      return { pruebaDeVidaAprobada: true, imagen, puntuacion: 95 };
    },
    async compararRostro() {
      return { coincidenciaFacialAprobada: true, puntuacion: 99.4 };
    },
  };
}

function dependencias(opciones: {
  readonly numeroLegible?: string | null;
  readonly registroCivil?: RegistroCivilProvider;
  readonly evidencias?: EvidenceStore;
}): DependenciasP5 {
  const registros: RegistroEvidencia[] = [];
  const expedientes = new Map<string, Expediente>();

  let expediente = crearExpedienteInicial({ id: EXPEDIENTE_ID, ahora: AHORA });
  for (const estado of [
    "CANAL_WA_VERIFICADO",
    "PLAN_SELECCIONADO",
    "AUTORIZADO",
    "CANAL_EMAIL_VERIFICADO",
  ] as const) {
    const paso = transicionarExpediente(expediente, estado);
    if (!paso.ok) throw new Error(paso.error);
    expediente = paso.expediente;
  }
  expedientes.set(EXPEDIENTE_ID, expediente);

  const repositorio: RepositorioExpediente = {
    async obtenerPorId(id) {
      return expedientes.get(id) ?? null;
    },
    async crear(nuevo) {
      expedientes.set(nuevo.id, nuevo);
    },
    async guardar(actualizado) {
      expedientes.set(actualizado.id, actualizado);
    },
  };

  const evidencias: EvidenceStore = {
    async guardar(registro) {
      registros.push(registro);
    },
    async obtenerHistorial(id) {
      return registros.filter((registro) => registro.expedienteId === id);
    },
  };

  return {
    identidad: identidadFormatoAnterior(
      opciones.numeroLegible === undefined ? "3874512" : opciones.numeroLegible,
    ),
    expedientes: repositorio,
    evidencias: opciones.evidencias ?? evidencias,
    bloqueos: { buscarPorCedula: async () => [], buscarSucesores: async () => [] },
    registroCivil: opciones.registroCivil,
    ahora: () => AHORA,
    nuevoId: () => "EV-RC",
  };
}

/** Registro que responde siempre lo mismo. */
function registroQueResponde(
  respuesta: Awaited<ReturnType<RegistroCivilProvider["consultarPorCedula"]>>,
): RegistroCivilProvider & { readonly consultas: string[] } {
  const consultas: string[] = [];
  return {
    consultas,
    async consultarPorCedula(numeroCedula) {
      consultas.push(numeroCedula);
      return respuesta;
    },
  };
}

async function analizar(deps: DependenciasP5) {
  return analizarIdentidadP5(deps, {
    expedienteId: EXPEDIENTE_ID,
    imagenes: IMAGENES,
    contexto: CONTEXTO,
  });
}

describe("formato anterior + registro civil: ENCONTRADO", () => {
  it("los datos salen del registro y P5 puede continuar", async () => {
    const registro = registroQueResponde({
      estado: "ENCONTRADO",
      datos: DATOS_REGISTRO,
      referenciaConsulta: "RC-001",
    });
    const deps = dependencias({ registroCivil: registro });

    const resultado = await analizar(deps);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    // Los datos vienen del registro, no del documento.
    expect(resultado.datos?.nombres).toBe("RAMONA");
    expect(resultado.datos?.apellidos).toBe("BENITEZ");
    expect(resultado.datos?.fechaNacimiento).toBe("1975-09-08");
    expect(resultado.datos?.numeroCedula).toBe("3874512");

    // Y el requisito de cédula legible ahora se cumple, que es lo que
    // desbloquea el paso.
    expect(resultado.requisitos.cedulaVigenteYLegible).toBe(true);
  });

  it("la edad se calcula desde la fecha del registro (regla inviolable #8)", async () => {
    const registro = registroQueResponde({
      estado: "ENCONTRADO",
      datos: DATOS_REGISTRO,
      referenciaConsulta: "RC-001",
    });
    const resultado = await analizar(dependencias({ registroCivil: registro }));

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    // Nacida en 1975, analizada en marzo de 2026: 50 años.
    expect(resultado.datos?.edad).toBe(50);
    expect(resultado.datos?.edadEnRango).toBe(true);
  });

  it("solo se le manda el número de cédula al registro, nada más", async () => {
    // Minimización: el proveedor no necesita saber a qué producto ni a qué
    // trámite corresponde la consulta.
    const registro = registroQueResponde({
      estado: "ENCONTRADO",
      datos: DATOS_REGISTRO,
      referenciaConsulta: "RC-001",
    });
    await analizar(dependencias({ registroCivil: registro }));

    expect(registro.consultas).toEqual(["3874512"]);
  });
});

describe("formato anterior + registro civil: los casos negativos", () => {
  it("NO_ENCONTRADO no habilita el paso", async () => {
    const registro = registroQueResponde({
      estado: "NO_ENCONTRADO",
      referenciaConsulta: "RC-002",
    });
    const resultado = await analizar(dependencias({ registroCivil: registro }));

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.datos).toBeNull();
    expect(resultado.requisitos.cedulaVigenteYLegible).toBe(false);
  });

  it("NO_DISPONIBLE tampoco habilita, pero queda distinguido en la evidencia", async () => {
    // Las dos consecuencias son iguales hoy; lo que cambia es qué se puede
    // decir después. Derivar a revisión manual a alguien porque el registro se
    // cayó tiene sentido; derivar a alguien cuya cédula no existe, no.
    const registro = registroQueResponde({
      estado: "NO_DISPONIBLE",
      motivo: "timeout",
    });
    const deps = dependencias({ registroCivil: registro });
    const resultado = await analizar(deps);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.requisitos.cedulaVigenteYLegible).toBe(false);
  });

  it("sin proveedor de registro, el formato anterior queda como estaba", async () => {
    // Un despliegue sin proveedor tiene que seguir funcionando para el
    // formato nuevo, no romperse entero.
    const resultado = await analizar(dependencias({ registroCivil: undefined }));

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.datos).toBeNull();
  });

  it("sin número legible en el frente no se consulta nada", async () => {
    const registro = registroQueResponde({
      estado: "ENCONTRADO",
      datos: DATOS_REGISTRO,
      referenciaConsulta: "RC-003",
    });
    await analizar(dependencias({ numeroLegible: null, registroCivil: registro }));

    // Consultar con un número que no se pudo leer sería preguntar por
    // cualquiera, y gastar una consulta facturada en el intento.
    expect(registro.consultas).toEqual([]);
  });
});

describe("evidencia de la consulta", () => {
  async function evidenciasDe(
    respuesta: Awaited<ReturnType<RegistroCivilProvider["consultarPorCedula"]>>,
  ): Promise<readonly RegistroEvidencia[]> {
    const registros: RegistroEvidencia[] = [];
    await analizar(
      dependencias({
        registroCivil: registroQueResponde(respuesta),
        evidencias: {
          async guardar(r) {
            registros.push(r);
          },
          async obtenerHistorial() {
            return registros;
          },
        },
      }),
    );
    return registros.filter((r) => r.paso === PASO_EVIDENCIA_REGISTRO_CIVIL_P5);
  }

  it("deja constancia del hallazgo con su referencia de consulta", async () => {
    const evidencias = await evidenciasDe({
      estado: "ENCONTRADO",
      datos: DATOS_REGISTRO,
      referenciaConsulta: "RC-001",
    });

    expect(evidencias).toHaveLength(1);
    expect(evidencias[0].resultado).toBe("EXITOSO");
    expect(evidencias[0].detalle).toContain("RC-001");
  });

  it("no filtra ningún dato personal devuelto por el registro", async () => {
    // El nombre y la fecha ya quedan en el expediente; repetirlos en la
    // evidencia sería exponerlos una vez más sin necesidad.
    const evidencias = await evidenciasDe({
      estado: "ENCONTRADO",
      datos: DATOS_REGISTRO,
      referenciaConsulta: "RC-001",
    });

    const serializada = JSON.stringify(evidencias);
    expect(serializada).not.toContain(DATOS_REGISTRO.nombres);
    expect(serializada).not.toContain(DATOS_REGISTRO.apellidos);
    expect(serializada).not.toContain(DATOS_REGISTRO.fechaNacimiento);
  });

  it("distingue en la evidencia un 'no existe' de un 'no contestó'", async () => {
    const noEncontrado = await evidenciasDe({
      estado: "NO_ENCONTRADO",
      referenciaConsulta: "RC-002",
    });
    const noDisponible = await evidenciasDe({ estado: "NO_DISPONIBLE", motivo: "timeout" });

    expect(noEncontrado[0].detalle).toContain("NO_ENCONTRADO");
    expect(noDisponible[0].detalle).toContain("NO_DISPONIBLE");
    // Es la distinción que hace accionable la evidencia.
    expect(noEncontrado[0].detalle).not.toBe(noDisponible[0].detalle);
  });

  it("no registra evidencia cuando no hubo consulta", async () => {
    const registros: RegistroEvidencia[] = [];
    await analizar(
      dependencias({
        registroCivil: undefined,
        evidencias: {
          async guardar(r) {
            registros.push(r);
          },
          async obtenerHistorial() {
            return registros;
          },
        },
      }),
    );

    expect(registros.filter((r) => r.paso === PASO_EVIDENCIA_REGISTRO_CIVIL_P5)).toHaveLength(0);
  });
});
