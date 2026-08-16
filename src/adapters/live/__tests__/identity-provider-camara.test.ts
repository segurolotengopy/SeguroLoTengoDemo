/**
 * Adaptador de demostración con cámara.
 *
 * Lo importante de probar acá no es el camino feliz —ese lo cubre el adaptador
 * de producción— sino las tres cosas que hacen que este adaptador sea seguro a
 * pesar de sus relajaciones: que no exista fuera de `DEMO_MODE`, que rechace
 * lo que no es una cédula, y que la evidencia diga siempre con qué política se
 * decidió.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UMBRAL_COINCIDENCIA_FACIAL,
  UMBRAL_COINCIDENCIA_FACIAL_DEMO,
} from "../../../domain/identidad-parametros";
import { crearIdentityProviderCamaraDemo } from "../identity-provider-camara";

const HOY = new Date("2026-08-16T12:00:00.000Z");

/** PNG con cabecera válida: alcanza para el lector de dimensiones. */
function pngDe(ancho: number, alto: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const escribir32 = (offset: number, valor: number) => {
    bytes[offset] = (valor >>> 24) & 0xff;
    bytes[offset + 1] = (valor >>> 16) & 0xff;
    bytes[offset + 2] = (valor >>> 8) & 0xff;
    bytes[offset + 3] = valor & 0xff;
  };
  escribir32(16, ancho);
  escribir32(20, alto);
  return bytes;
}

const FRENTE = pngDe(1000, 640);
const DORSO = pngDe(1000, 640);
const SELFIE = pngDe(800, 800);

const ROSTRO_BUENO = {
  BoundingBox: { Width: 0.4, Height: 0.5, Left: 0.3, Top: 0.2 },
  Pose: { Yaw: 2, Pitch: 1, Roll: 0 },
  Quality: { Sharpness: 88, Brightness: 70 },
  FaceOccluded: { Value: false },
};

const FRENTE_PY = ["REPUBLICA DEL PARAGUAY", "CEDULA DE IDENTIDAD", "9.323.336", "12/05/1990"];
const DORSO_PY_SIN_MRZ = ["REPUBLICA DEL PARAGUAY", "LUGAR DE NACIMIENTO", "VENCIMIENTO"];

function bloques(textos: readonly string[], confianza = 99) {
  return textos.map((texto) => ({ BlockType: "LINE", Text: texto, Confidence: confianza }));
}

interface Respuestas {
  detectFaces?: unknown;
  compareFaces?: unknown;
  textract?: (llamada: number) => unknown;
  paises?: readonly ("PY" | "BO")[];
}

function proveedor(respuestas: Respuestas = {}) {
  vi.stubEnv("DEMO_MODE", "true");
  let llamadasTextract = 0;

  const rekognition = {
    async send(comando: { constructor: { name: string } }) {
      if (comando.constructor.name === "DetectFacesCommand") {
        return respuestas.detectFaces ?? { FaceDetails: [ROSTRO_BUENO] };
      }
      return respuestas.compareFaces ?? { FaceMatches: [] };
    },
  };

  const textract = {
    async send() {
      llamadasTextract += 1;
      return (respuestas.textract?.(llamadasTextract) ?? { Blocks: [] }) as never;
    },
  };

  return crearIdentityProviderCamaraDemo({
    rekognition: rekognition as never,
    textract: textract as never,
    paisesAceptados: respuestas.paises ?? ["PY", "BO"],
    ahora: () => HOY,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("puerta de DEMO_MODE", () => {
  it("no se puede construir sin DEMO_MODE=true", () => {
    // Es la garantía que sostiene todo lo demás: sin prueba de vida y con
    // umbral 90, este adaptador no puede terminar sirviendo producción por un
    // flag mal puesto.
    vi.stubEnv("DEMO_MODE", "false");

    expect(() =>
      crearIdentityProviderCamaraDemo({ rekognition: {} as never, textract: {} as never }),
    ).toThrow(/DEMO_MODE/);
  });

  it("tampoco con la variable ausente", () => {
    vi.stubEnv("DEMO_MODE", "");

    expect(() =>
      crearIdentityProviderCamaraDemo({ rekognition: {} as never, textract: {} as never }),
    ).toThrow(/DEMO_MODE/);
  });
});

describe("capturarFrenteCedula", () => {
  it("rechaza por autenticidad la fotografía de algo que no es una cédula", () => {
    const adaptador = proveedor({
      textract: () => ({ Blocks: bloques(["VASO", "500 ML"]) }),
    });

    return adaptador.capturarFrenteCedula("exp-1", FRENTE).then((resultado) => {
      expect(resultado.autenticidadAprobada).toBe(false);
      expect(resultado.calidadAprobada).toBe(false);
      expect(resultado.motivoRechazo).toContain("cédula de identidad");
    });
  });

  it("no llega a preguntar por el rostro si el documento no se reconoció", async () => {
    // El orden importa para el mensaje: preguntar primero por el rostro haría
    // que la foto de un vaso dijera "no encontramos una fotografía de rostro
    // en la cédula", que sugiere un problema de encuadre que no existe.
    let detectFaces = 0;
    vi.stubEnv("DEMO_MODE", "true");

    const adaptador = crearIdentityProviderCamaraDemo({
      rekognition: {
        async send() {
          detectFaces += 1;
          return { FaceDetails: [ROSTRO_BUENO] };
        },
      } as never,
      textract: { async send() {
        return { Blocks: bloques(["VASO"]) } as never;
      } } as never,
      paisesAceptados: ["PY"],
    });

    await adaptador.capturarFrenteCedula("exp-1", FRENTE);
    expect(detectFaces).toBe(0);
  });

  it("acepta un frente paraguayo con rostro de buena calidad", async () => {
    const adaptador = proveedor({ textract: () => ({ Blocks: bloques(FRENTE_PY) }) });

    const resultado = await adaptador.capturarFrenteCedula("exp-1", FRENTE);

    expect(resultado.calidadAprobada).toBe(true);
    expect(resultado.autenticidadAprobada).toBe(true);
    expect(resultado.imagen.referencia).toMatch(/^DEMO-CEDULA-FRENTE-/);
  });

  it("marca la referencia de evidencia como DEMO para distinguirla en la consola", async () => {
    const adaptador = proveedor({ textract: () => ({ Blocks: bloques(FRENTE_PY) }) });

    const resultado = await adaptador.capturarFrenteCedula("exp-1", FRENTE);

    // Un expediente verificado con criterio de demostración tiene que ser
    // reconocible de un vistazo, no solo por la versión de política.
    expect(resultado.imagen.referencia.startsWith("DEMO-")).toBe(true);
  });

  it("rechaza si la cédula tiene más de un rostro", async () => {
    const adaptador = proveedor({
      textract: () => ({ Blocks: bloques(FRENTE_PY) }),
      detectFaces: { FaceDetails: [ROSTRO_BUENO, ROSTRO_BUENO] },
    });

    const resultado = await adaptador.capturarFrenteCedula("exp-1", FRENTE);

    expect(resultado.calidadAprobada).toBe(false);
    expect(resultado.motivoRechazo).toContain("más de un rostro");
  });
});

describe("capturarSelfieYPruebaDeVida", () => {
  it("rechaza el camino de sesión: este adaptador no abre Face Liveness", async () => {
    const adaptador = proveedor();

    await expect(
      adaptador.capturarSelfieYPruebaDeVida("exp-1", {
        tipo: "SESION_LIVENESS",
        referenciaSesion: "sesion-1",
      }),
    ).rejects.toThrow(/Face Liveness/);
  });

  it("aprueba presencia con un rostro único y de buena calidad", async () => {
    const adaptador = proveedor();

    const resultado = await adaptador.capturarSelfieYPruebaDeVida("exp-1", {
      tipo: "VIDEO",
      video: SELFIE,
    });

    expect(resultado.pruebaDeVidaAprobada).toBe(true);
    // No hay puntuación porque no se comparó contra ningún umbral numérico:
    // la presencia es la conjunción de los controles de calidad.
    expect(resultado.puntuacion).toBeNull();
  });

  it("explica por qué rechazó, en vez de dejar a la persona repitiendo a ciegas", async () => {
    const adaptador = proveedor({ detectFaces: { FaceDetails: [] } });

    const resultado = await adaptador.capturarSelfieYPruebaDeVida("exp-1", {
      tipo: "VIDEO",
      video: SELFIE,
    });

    expect(resultado.pruebaDeVidaAprobada).toBe(false);
    expect(resultado.motivoRechazo).toContain("No detectamos tu rostro");
  });

  it("rechaza si hay más de una persona en el cuadro", async () => {
    const adaptador = proveedor({ detectFaces: { FaceDetails: [ROSTRO_BUENO, ROSTRO_BUENO] } });

    const resultado = await adaptador.capturarSelfieYPruebaDeVida("exp-1", {
      tipo: "VIDEO",
      video: SELFIE,
    });

    expect(resultado.pruebaDeVidaAprobada).toBe(false);
    expect(resultado.motivoRechazo).toContain("más de un rostro");
  });
});

describe("compararRostro", () => {
  /** Deja el expediente con frente y selfie aprobadas, listo para comparar. */
  async function conCapturasAprobadas(similitud: number) {
    const adaptador = proveedor({
      textract: (llamada) =>
        llamada === 1 ? { Blocks: bloques(FRENTE_PY) } : { Blocks: bloques(DORSO_PY_SIN_MRZ) },
      compareFaces: { FaceMatches: [{ Similarity: similitud }] },
    });

    await adaptador.capturarFrenteCedula("exp-1", FRENTE);
    await adaptador.capturarDorsoCedula("exp-1", DORSO);
    await adaptador.capturarSelfieYPruebaDeVida("exp-1", { tipo: "VIDEO", video: SELFIE });
    return adaptador;
  }

  it("aprueba con una similitud que producción rechazaría", async () => {
    // Es la relajación #2 en acción: una foto de un plástico con reflejos no
    // llega a 99 ni con el titular correcto delante.
    const similitud = 94;
    expect(similitud).toBeLessThan(UMBRAL_COINCIDENCIA_FACIAL);
    expect(similitud).toBeGreaterThanOrEqual(UMBRAL_COINCIDENCIA_FACIAL_DEMO);

    const adaptador = await conCapturasAprobadas(similitud);
    const resultado = await adaptador.compararRostro("exp-1");

    expect(resultado.coincidenciaFacialAprobada).toBe(true);
    expect(resultado.puntuacion).toBe(similitud);
  });

  it("sigue rechazando por debajo del umbral de demostración", async () => {
    const adaptador = await conCapturasAprobadas(UMBRAL_COINCIDENCIA_FACIAL_DEMO - 1);

    expect((await adaptador.compararRostro("exp-1")).coincidenciaFacialAprobada).toBe(false);
  });

  it("no compara si la cédula no se reconoció", async () => {
    const adaptador = proveedor({
      textract: () => ({ Blocks: bloques(["VASO"]) }),
      compareFaces: { FaceMatches: [{ Similarity: 99.9 }] },
    });

    await adaptador.capturarFrenteCedula("exp-1", FRENTE);
    await adaptador.capturarSelfieYPruebaDeVida("exp-1", { tipo: "VIDEO", video: SELFIE });

    // Una coincidencia perfecta contra una imagen que no es una cédula no
    // prueba nada, así que no se le da valor.
    const resultado = await adaptador.compararRostro("exp-1");
    expect(resultado.coincidenciaFacialAprobada).toBe(false);
    expect(resultado.puntuacion).toBeNull();
  });
});

describe("extraerDatosCedula", () => {
  it("lee datos aproximados de un frente sin MRZ", async () => {
    const adaptador = proveedor({
      textract: (llamada) =>
        llamada === 1
          ? {
              Blocks: bloques([
                "REPUBLICA DEL PARAGUAY",
                "CEDULA DE IDENTIDAD",
                "9.323.336",
                "NOMBRES",
                "MONICA MARIANA",
                "APELLIDOS",
                "GORENA TAPIA",
                "FECHA DE NACIMIENTO",
                "12/05/1990",
                "VENCIMIENTO 12/05/2030",
              ]),
            }
          : { Blocks: bloques(DORSO_PY_SIN_MRZ) },
    });

    await adaptador.capturarFrenteCedula("exp-1", FRENTE);
    await adaptador.capturarDorsoCedula("exp-1", DORSO);

    const ocr = await adaptador.extraerDatosCedula("exp-1");

    expect(ocr.confiable).toBe(true);
    expect(ocr.datos.numeroCedula).toBe("9323336");
    expect(ocr.datos.fechaNacimiento).toBe("1990-05-12");
    expect(ocr.datos.nombres).toBe("MONICA MARIANA");
    expect(ocr.datos.nacionalidad).toBe("PARAGUAYA");
  });

  it("no devuelve datos si falta la fecha de nacimiento", async () => {
    // Sin fecha no hay corte de edad posible, y devolver el resto como
    // confiable dejaría que el flujo siguiera con un dato que decide la
    // elegibilidad y que nadie leyó.
    const adaptador = proveedor({
      textract: (llamada) =>
        llamada === 1
          ? { Blocks: bloques(["REPUBLICA DEL PARAGUAY", "CEDULA DE IDENTIDAD", "9.323.336"]) }
          : { Blocks: bloques(DORSO_PY_SIN_MRZ) },
    });

    await adaptador.capturarFrenteCedula("exp-1", FRENTE);
    await adaptador.capturarDorsoCedula("exp-1", DORSO);

    const ocr = await adaptador.extraerDatosCedula("exp-1");

    expect(ocr.confiable).toBe(false);
    expect(ocr.datos.fechaNacimiento).toBe("");
    // El número sí sobrevive: es la pista con la que se puede ir al registro civil.
    expect(ocr.numeroCedulaSinConfirmar).toBe("9323336");
  });

  it("no devuelve nada si las capturas no aprobaron", async () => {
    const adaptador = proveedor({ textract: () => ({ Blocks: bloques(["VASO"]) }) });

    await adaptador.capturarFrenteCedula("exp-1", FRENTE);

    expect((await adaptador.extraerDatosCedula("exp-1")).confiable).toBe(false);
  });
});
