/**
 * Salida de P5 a asistencia humana cuando la identidad no se puede verificar.
 *
 * El problema que cierra: sin esta salida, alguien con un documento que el
 * sistema no sabe leer —o una cámara mala— repite capturas para siempre. No es
 * un rechazo, es un callejón sin salida.
 *
 * **Es un estado propio y no `DERIVADO_MANUAL`**, y la mitad de este archivo
 * existe para fijar por qué:
 *
 * - `DERIVADO_MANUAL` significa "la elegibilidad se detuvo por salud o PEP"
 *   (regla inviolable #5) y su pantalla muestra `Declaraciones recibidas ✓`.
 *   Quien falla en P5 nunca declaró nada.
 * - `DERIVADO_MANUAL` **bloquea la cédula** (regla inviolable #11). Bloquear a
 *   alguien porque la cámara no daba sería desproporcionado: no hay ningún
 *   indicio en su contra.
 *
 * Decisión de producto: **no hay fila en la matriz de cumplimiento** que exija
 * esta salida. La fila 19 respalda derivar una respuesta PEP a análisis
 * reforzado, que es otra cosa.
 */
import { describe, expect, it } from "vitest";
import { ESTADOS_QUE_BLOQUEAN_REGISTRO, estadoBloqueaRegistro } from "../consola-administrativa";
import { esTransicionLegal, transicionarExpediente, transicionesLegalesDesde } from "../expediente";
import { ESTADOS_TERMINALES, crearExpedienteInicial } from "../tipos";
import type { EstadoExpediente, Expediente, RegistroEvidencia } from "../tipos";
import type { EvidenceStore } from "../../ports/evidence-store";
import type { IdentityProvider } from "../../ports/identity-provider";
import {
  INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA,
  PASO_EVIDENCIA_ASISTENCIA_IDENTIDAD,
  analizarIdentidadP5,
  generarNumeroCasoAsistencia,
} from "../verificacion-identidad";
import type { DependenciasP5, ImagenesP5 } from "../verificacion-identidad";
import type { RepositorioExpediente } from "../verificacion-canal";

const CONTEXTO = { ip: "200.10.20.30", dispositivo: "vitest", sesionId: "sesion-ai" };
const EXPEDIENTE_ID = "EXP-AI";
const AHORA = "2026-03-15T12:00:00.000Z";

const IMAGENES: ImagenesP5 = {
  frente: new Uint8Array([1, 1, 1, 1]),
  dorso: new Uint8Array([2, 2, 2, 2]),
  selfie: { tipo: "VIDEO", video: new Uint8Array([3, 3, 3, 3]) },
};

/** Proveedor que nunca logra verificar: el caso que motiva toda esta salida. */
function identidadQueNuncaVerifica(): IdentityProvider {
  const imagen = { referencia: "REF", hashSha256: "h".repeat(64) };
  return {
    async capturarFrenteCedula() {
      return { calidadAprobada: true, autenticidadAprobada: true, imagen, motivoRechazo: null };
    },
    async capturarDorsoCedula() {
      return { calidadAprobada: true, autenticidadAprobada: true, imagen, motivoRechazo: null };
    },
    async extraerDatosCedula() {
      return {
        datos: {
          numeroCedula: "",
          nombres: "",
          apellidos: "",
          fechaNacimiento: "",
          sexo: "",
          nacionalidad: "",
        },
        confiable: false,
        numeroCedulaSinConfirmar: null,
      };
    },
    async capturarSelfieYPruebaDeVida() {
      return { pruebaDeVidaAprobada: true, imagen, puntuacion: 95 };
    },
    async compararRostro() {
      return { coincidenciaFacialAprobada: false, puntuacion: null };
    },
  };
}

function armar(): {
  readonly deps: DependenciasP5;
  readonly leer: () => Expediente;
  readonly evidencias: readonly RegistroEvidencia[];
} {
  const registros: RegistroEvidencia[] = [];
  const guardados = new Map<string, Expediente>();

  let expediente = crearExpedienteInicial({ id: EXPEDIENTE_ID, ahora: AHORA });
  for (const estado of [
    "PLAN_SELECCIONADO",
    "CANAL_WA_VERIFICADO",
    "AUTORIZADO",
  ] as const) {
    const paso = transicionarExpediente(expediente, estado);
    if (!paso.ok) throw new Error(paso.error);
    expediente = paso.expediente;
  }
  guardados.set(EXPEDIENTE_ID, expediente);

  const expedientes: RepositorioExpediente = {
    async obtenerPorId(id) {
      return guardados.get(id) ?? null;
    },
    async crear(nuevo) {
      guardados.set(nuevo.id, nuevo);
    },
    async guardar(actualizado) {
      guardados.set(actualizado.id, actualizado);
    },
  };

  const evidencias: EvidenceStore = {
    async guardar(registro) {
      registros.push(registro);
    },
    async obtenerHistorial() {
      return registros;
    },
  };

  return {
    deps: {
      identidad: identidadQueNuncaVerifica(),
      expedientes,
      evidencias,
      bloqueos: { buscarPorCedula: async () => [], buscarSucesores: async () => [] },
      ahora: () => AHORA,
      nuevoId: () => "EV-AI",
    },
    leer: () => {
      const actual = guardados.get(EXPEDIENTE_ID);
      if (!actual) throw new Error("el expediente tiene que existir");
      return actual;
    },
    evidencias: registros,
  };
}

async function analizar(deps: DependenciasP5) {
  return analizarIdentidadP5(deps, {
    expedienteId: EXPEDIENTE_ID,
    imagenes: IMAGENES,
    contexto: CONTEXTO,
  });
}

describe("acumulación de intentos", () => {
  it("los dos primeros fallos no derivan: todavía se puede repetir", async () => {
    const { deps, leer } = armar();

    for (let intento = 1; intento < INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA; intento += 1) {
      const resultado = await analizar(deps);
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;

      expect(resultado.asistenciaIdentidad ?? null).toBeNull();
      expect(leer().estado).toBe("AUTORIZADO");
      expect(leer().intentosIdentidadFallidos).toBe(intento);
    }
  });

  it("el tercero deriva a asistencia con número de caso propio", async () => {
    const { deps, leer } = armar();

    let ultimo: string | null = null;
    for (let intento = 0; intento < INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA; intento += 1) {
      const resultado = await analizar(deps);
      if (resultado.ok) ultimo = resultado.asistenciaIdentidad ?? null;
    }

    expect(ultimo).toMatch(/^ASIS-\d{4}-\d{6}$/);
    expect(leer().estado).toBe("ASISTENCIA_IDENTIDAD");
    expect(leer().numeroCasoAsistenciaIdentidad).toBe(ultimo);
  });

  it("un análisis exitoso no acumula intentos", async () => {
    // Solo cuenta lo que agota a la persona: completar las tres capturas y que
    // el análisis igual no alcance.
    const { deps, leer } = armar();
    const conIdentidadBuena: DependenciasP5 = {
      ...deps,
      identidad: {
        ...identidadQueNuncaVerifica(),
        async compararRostro() {
          return { coincidenciaFacialAprobada: true, puntuacion: 99.5 };
        },
        async extraerDatosCedula() {
          return {
            datos: {
              numeroCedula: "9323336",
              nombres: "MONICA",
              apellidos: "GORENA",
              fechaNacimiento: "1990-05-12",
              sexo: "F",
              nacionalidad: "PRY",
            },
            confiable: true,
            numeroCedulaSinConfirmar: "9323336",
          };
        },
      },
    };

    await analizar(conIdentidadBuena);
    expect(leer().intentosIdentidadFallidos).toBe(0);
    expect(leer().estado).toBe("AUTORIZADO");
  });
});

describe("el número de caso de asistencia es su propia cola", () => {
  it("usa un prefijo distinto del de derivación y del de propuesta", () => {
    // Tres colas distintas: propuesta, derivación por elegibilidad y
    // asistencia de identidad. Mezclarlas haría imposible medir cualquiera.
    const numero = generarNumeroCasoAsistencia(new Date(AHORA));
    expect(numero.startsWith("ASIS-")).toBe(true);
    expect(numero.startsWith("CASO-")).toBe(false);
    expect(numero.startsWith("PROP-")).toBe(false);
  });

  it("no es adivinable: dos casos seguidos no son consecutivos", () => {
    const a = generarNumeroCasoAsistencia(new Date(AHORA));
    const b = generarNumeroCasoAsistencia(new Date(AHORA));
    expect(a).not.toBe(b);
  });
});

describe("ASISTENCIA_IDENTIDAD frente a DERIVADO_MANUAL", () => {
  it("NO bloquea la cédula: la persona puede volver a intentar", () => {
    // El punto central de que sea un estado propio. Bloquear a alguien porque
    // la cámara del teléfono no daba sería desproporcionado — no hay ningún
    // indicio en su contra, a diferencia de una derivación por salud o PEP.
    expect(estadoBloqueaRegistro("ASISTENCIA_IDENTIDAD")).toBe(false);
    expect(ESTADOS_QUE_BLOQUEAN_REGISTRO).not.toContain("ASISTENCIA_IDENTIDAD");

    // Y el contraste, para que se lea la diferencia.
    expect(estadoBloqueaRegistro("DERIVADO_MANUAL")).toBe(true);
  });

  it("es terminal: no se vuelve al flujo digital de ese expediente", () => {
    expect(ESTADOS_TERMINALES).toContain("ASISTENCIA_IDENTIDAD");
    expect(transicionesLegalesDesde("ASISTENCIA_IDENTIDAD")).toEqual([]);
  });

  it("no abre ningún camino a pago, firma ni emisión", () => {
    const prohibidos: readonly EstadoExpediente[] = [
      "DECLARACIONES_OK",
      "PAGO_CONFIRMADO",
      "PAQUETE_GENERADO",
      "FIRMADO",
      "EMITIDO",
    ];
    for (const destino of prohibidos) {
      expect(esTransicionLegal("ASISTENCIA_IDENTIDAD", destino)).toBe(false);
    }
  });

  it("solo se llega desde P5, no desde el estado de las declaraciones", () => {
    // La derivación de la regla #5 sigue siendo exclusiva de P6, y esta salida
    // no la toca: son dos aristas distintas desde dos estados distintos.
    expect(esTransicionLegal("CANAL_EMAIL_VERIFICADO", "ASISTENCIA_IDENTIDAD")).toBe(true);
    expect(esTransicionLegal("IDENTIDAD_VERIFICADA", "ASISTENCIA_IDENTIDAD")).toBe(false);
    expect(esTransicionLegal("CANAL_EMAIL_VERIFICADO", "DERIVADO_MANUAL")).toBe(false);
  });
});

describe("evidencia de la derivación", () => {
  it("deja constancia con el número de caso y sin datos personales", async () => {
    const { deps, evidencias } = armar();
    for (let intento = 0; intento < INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA; intento += 1) {
      await analizar(deps);
    }

    const derivaciones = evidencias.filter(
      (registro) => registro.paso === PASO_EVIDENCIA_ASISTENCIA_IDENTIDAD,
    );
    expect(derivaciones).toHaveLength(1);
    expect(derivaciones[0].detalle).toContain("ASIS-");
    expect(derivaciones[0].detalle).toContain("IDENTIDAD_NO_VERIFICABLE");
    expect(derivaciones[0].ip).toBe(CONTEXTO.ip);
  });

  it("no se deriva dos veces si el análisis se repite después", async () => {
    // Ya en ASISTENCIA_IDENTIDAD, el expediente no está en el estado que P5
    // exige, así que un análisis nuevo se rechaza antes de tocar nada.
    const { deps, evidencias, leer } = armar();
    for (let intento = 0; intento < INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA; intento += 1) {
      await analizar(deps);
    }

    const resultado = await analizar(deps);
    expect(resultado.ok).toBe(false);
    expect(leer().numeroCasoAsistenciaIdentidad).not.toBeNull();

    const derivaciones = evidencias.filter(
      (registro) => registro.paso === PASO_EVIDENCIA_ASISTENCIA_IDENTIDAD,
    );
    expect(derivaciones).toHaveLength(1);
  });
});
