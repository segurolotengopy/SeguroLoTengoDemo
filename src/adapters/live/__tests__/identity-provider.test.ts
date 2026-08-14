/**
 * Adaptador oficial de `IdentityProvider` sobre Rekognition + Textract.
 *
 * Con dobles de los clientes de AWS: sin red, sin credenciales y sin gasto.
 * Lo que se prueba es la composición —qué se le pide a cada servicio, en qué
 * orden y qué se hace con respuestas incompletas— y sobre todo los rechazos,
 * que son donde un error silencioso se vuelve peligroso.
 */
import { describe, expect, it } from "vitest";
import {
  CONFIANZA_MINIMA_OCR,
  UMBRAL_COINCIDENCIA_FACIAL,
} from "../../../domain/identidad-parametros";
import { crearIdentityProviderAws } from "../identity-provider";

const HOY = new Date("2026-08-14T12:00:00.000Z");

/** PNG de 1000×1000 con cabecera válida: sirve para el lector de dimensiones. */
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

const FRENTE = pngDe(1000, 1000);
const DORSO = pngDe(1000, 600);

const ROSTRO_BUENO = {
  BoundingBox: { Width: 0.4, Height: 0.5, Left: 0.3, Top: 0.2 },
  Pose: { Yaw: 2, Pitch: 1, Roll: 0 },
  Quality: { Sharpness: 88, Brightness: 70 },
  FaceOccluded: { Value: false },
};

/** MRZ TD1 válido de la cédula 9.323.336, nacida el 12/05/1990, vence 12/05/2030. */
const MRZ = [
  "IDPRY9323336<<9<<<<<<<<<<<<<<<",
  "9005123F3005121PRY<<<<<<<<<<<0",
  "GORENA<TAPIA<<MONICA<MARIANA<<",
];

function bloques(textos: readonly string[], confianza = 99) {
  return textos.map((texto) => ({ BlockType: "LINE", Text: texto, Confidence: confianza }));
}

/**
 * Dobles de los clientes. Se enruta por el nombre del comando, que es lo que el
 * adaptador realmente elige; así el test no depende del orden de las llamadas.
 */
interface Respuestas {
  detectFaces?: unknown;
  compareFaces?: unknown;
  createSession?: unknown;
  sessionResults?: unknown;
  textract?: (llamada: number) => unknown;
}

function proveedor(respuestas: Respuestas) {
  let llamadasTextract = 0;
  const comandos: string[] = [];

  const rekognition = {
    async send(comando: { constructor: { name: string } }) {
      const nombre = comando.constructor.name;
      comandos.push(nombre);
      if (nombre === "DetectFacesCommand") return respuestas.detectFaces ?? { FaceDetails: [] };
      if (nombre === "CompareFacesCommand") return respuestas.compareFaces ?? { FaceMatches: [] };
      if (nombre === "CreateFaceLivenessSessionCommand") {
        return respuestas.createSession ?? { SessionId: "sesion-1" };
      }
      return respuestas.sessionResults ?? { Status: "SUCCEEDED", Confidence: 0 };
    },
  };

  const textract = {
    async send() {
      llamadasTextract += 1;
      comandos.push("DetectDocumentTextCommand");
      return (respuestas.textract?.(llamadasTextract) ?? { Blocks: [] }) as never;
    },
  };

  return {
    adaptador: crearIdentityProviderAws({
      rekognition: rekognition as never,
      textract: textract as never,
      ahora: () => HOY,
    }),
    comandos,
  };
}

/** Escenario completo del camino feliz. */
function caminoFeliz() {
  return proveedor({
    detectFaces: { FaceDetails: [ROSTRO_BUENO] },
    compareFaces: { FaceMatches: [{ Similarity: 99.6 }] },
    sessionResults: {
      Status: "SUCCEEDED",
      Confidence: 93,
      ReferenceImage: { Bytes: new Uint8Array([7, 7, 7]) },
      Challenge: { Type: "FaceMovementAndLightChallenge" },
    },
    // Primera llamada: frente. Segunda: dorso con MRZ.
    textract: (llamada) =>
      llamada === 1
        ? { Blocks: bloques(["REPUBLICA DEL PARAGUAY", "9.323.336", "12/05/1990"]) }
        : { Blocks: bloques(MRZ, 72) },
  });
}

describe("capturarFrenteCedula", () => {
  it("aprueba calidad y guarda el hash real de los bytes", async () => {
    const { adaptador } = caminoFeliz();
    const resultado = await adaptador.capturarFrenteCedula("EXP-1", FRENTE);

    expect(resultado.calidadAprobada).toBe(true);
    expect(resultado.motivoRechazo).toBeNull();
    expect(resultado.imagen.hashSha256).toHaveLength(64);
    // La referencia no puede llevar datos de la persona: va a la consola.
    expect(resultado.imagen.referencia).toMatch(/^AWS-CEDULA-FRENTE-[0-9a-f]{12}$/);
  });

  it("rechaza una imagen cuyo formato no reconoce, sin llamar a AWS", async () => {
    const { adaptador, comandos } = caminoFeliz();
    const resultado = await adaptador.capturarFrenteCedula("EXP-1", new Uint8Array([1, 2, 3, 4]));

    expect(resultado.calidadAprobada).toBe(false);
    expect(resultado.motivoRechazo).toContain("cámara");
    // Sin dimensiones no se puede medir el tamaño del rostro, así que no tiene
    // sentido gastar una llamada facturada.
    expect(comandos).toEqual([]);
  });

  it("rechaza cuando no hay rostro en la cédula", async () => {
    const { adaptador } = proveedor({ detectFaces: { FaceDetails: [] } });
    const resultado = await adaptador.capturarFrenteCedula("EXP-1", FRENTE);

    expect(resultado.calidadAprobada).toBe(false);
    expect(resultado.motivoRechazo).toContain("rostro");
  });

  it("rechaza más de un rostro", async () => {
    const { adaptador } = proveedor({
      detectFaces: { FaceDetails: [ROSTRO_BUENO, ROSTRO_BUENO] },
    });
    const resultado = await adaptador.capturarFrenteCedula("EXP-1", FRENTE);

    expect(resultado.calidadAprobada).toBe(false);
    expect(resultado.motivoRechazo).toContain("más de un rostro");
  });

  it("traduce los motivos de calidad a instrucciones para la persona", async () => {
    const { adaptador } = proveedor({
      detectFaces: {
        FaceDetails: [{ ...ROSTRO_BUENO, Quality: { Sharpness: 5, Brightness: 3 } }],
      },
    });
    const resultado = await adaptador.capturarFrenteCedula("EXP-1", FRENTE);

    expect(resultado.calidadAprobada).toBe(false);
    // Dos defectos, dos instrucciones: no se corta en el primero.
    expect(resultado.motivoRechazo).toContain("borrosa");
    expect(resultado.motivoRechazo).toContain("luz");
    // Nunca el umbral ni la puntuación: eso es para la evidencia.
    expect(resultado.motivoRechazo).not.toMatch(/\d/);
  });
});

describe("capturarDorsoCedula", () => {
  it("acepta un dorso con MRZ válido", async () => {
    const { adaptador } = caminoFeliz();
    await adaptador.capturarFrenteCedula("EXP-1", FRENTE);
    const resultado = await adaptador.capturarDorsoCedula("EXP-1", DORSO);

    expect(resultado.calidadAprobada).toBe(true);
    expect(resultado.autenticidadAprobada).toBe(true);
  });

  it("rechaza autenticidad si el MRZ tiene los verificadores rotos", async () => {
    const roto = [...MRZ];
    roto[1] = roto[1].replace("9005123F", "8005123F");
    const { adaptador } = proveedor({ textract: () => ({ Blocks: bloques(roto, 72) }) });

    const resultado = await adaptador.capturarDorsoCedula("EXP-1", DORSO);

    // Calidad sí (se leyó bien), autenticidad no (los dígitos no cierran).
    expect(resultado.calidadAprobada).toBe(true);
    expect(resultado.autenticidadAprobada).toBe(false);
    expect(resultado.motivoRechazo).toContain("dorso");
  });

  it("un dorso sin MRZ no se rechaza: el formato anterior no lo tiene", async () => {
    const { adaptador } = proveedor({
      textract: () => ({ Blocks: bloques(["REPUBLICA DEL PARAGUAY", "9.323.336"]) }),
    });
    const resultado = await adaptador.capturarDorsoCedula("EXP-1", DORSO);

    expect(resultado.calidadAprobada).toBe(true);
    expect(resultado.autenticidadAprobada).toBe(true);
  });

  it("rechaza un dorso ilegible", async () => {
    const { adaptador } = proveedor({
      textract: () => ({ Blocks: bloques(["algo"], CONFIANZA_MINIMA_OCR - 20) }),
    });
    const resultado = await adaptador.capturarDorsoCedula("EXP-1", DORSO);

    expect(resultado.calidadAprobada).toBe(false);
    expect(resultado.motivoRechazo).toContain("claridad");
  });
});

describe("extraerDatosCedula", () => {
  it("toma los datos del MRZ, no del frente", async () => {
    const { adaptador } = caminoFeliz();
    await adaptador.capturarFrenteCedula("EXP-1", FRENTE);
    await adaptador.capturarDorsoCedula("EXP-1", DORSO);

    const resultado = await adaptador.extraerDatosCedula("EXP-1");

    expect(resultado.confiable).toBe(true);
    // El MRZ viene con dígitos verificadores; el frente, no.
    expect(resultado.datos.numeroCedula).toBe("9323336");
    expect(resultado.datos.fechaNacimiento).toBe("1990-05-12");
    expect(resultado.datos.apellidos).toBe("GORENA TAPIA");
    expect(resultado.datos.nombres).toBe("MONICA MARIANA");
    expect(resultado.datos.nacionalidad).toBe("PRY");
  });

  it("no es confiable si falta una de las dos caras", async () => {
    const { adaptador } = caminoFeliz();
    await adaptador.capturarFrenteCedula("EXP-1", FRENTE);

    const resultado = await adaptador.extraerDatosCedula("EXP-1");
    expect(resultado.confiable).toBe(false);
    expect(resultado.datos.fechaNacimiento).toBe("");
  });

  it("sin MRZ no adivina los datos del frente", async () => {
    // Regla inviolable #8: la fecha que decide el corte de edad no puede salir
    // de una heurística sobre un frente sin formato publicado.
    const { adaptador } = proveedor({
      detectFaces: { FaceDetails: [ROSTRO_BUENO] },
      textract: () => ({ Blocks: bloques(["9.323.336", "12/05/1990"]) }),
    });
    await adaptador.capturarFrenteCedula("EXP-1", FRENTE);
    await adaptador.capturarDorsoCedula("EXP-1", DORSO);

    const resultado = await adaptador.extraerDatosCedula("EXP-1");
    expect(resultado.confiable).toBe(false);
  });

  it("no es confiable si el frente contradice al MRZ", async () => {
    const { adaptador } = proveedor({
      detectFaces: { FaceDetails: [ROSTRO_BUENO] },
      textract: (llamada) =>
        llamada === 1
          ? { Blocks: bloques(["1.111.111", "01/01/1985"]) }
          : { Blocks: bloques(MRZ, 72) },
    });
    await adaptador.capturarFrenteCedula("EXP-1", FRENTE);
    await adaptador.capturarDorsoCedula("EXP-1", DORSO);

    const resultado = await adaptador.extraerDatosCedula("EXP-1");
    expect(resultado.confiable).toBe(false);
  });
});

describe("capturarSelfieYPruebaDeVida", () => {
  it("consulta el resultado de la sesión y aprueba por encima del umbral", async () => {
    const { adaptador } = caminoFeliz();
    const resultado = await adaptador.capturarSelfieYPruebaDeVida("EXP-1", {
      tipo: "SESION_LIVENESS",
      referenciaSesion: "sesion-1",
    });

    expect(resultado.pruebaDeVidaAprobada).toBe(true);
    expect(resultado.puntuacion).toBe(93);
    // El hash es de la imagen de referencia que devolvió AWS, no de un placeholder.
    expect(resultado.imagen.hashSha256).toHaveLength(64);
  });

  it("rechaza el camino de bytes en vez de fingir una prueba de vida", async () => {
    // Comparar una foto suelta y llamarlo "prueba de vida" es exactamente lo
    // que este control existe para impedir.
    const { adaptador } = caminoFeliz();
    await expect(
      adaptador.capturarSelfieYPruebaDeVida("EXP-1", {
        tipo: "VIDEO",
        video: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toThrow(/Face Liveness/);
  });

  it("una sesión sin imagen de referencia no inventa un hash", async () => {
    // Un hash de bytes vacíos sería constante e idéntico entre expedientes:
    // peor que ninguno, porque parecería evidencia.
    const { adaptador } = proveedor({
      sessionResults: { Status: "SUCCEEDED", Confidence: 95 },
    });
    const resultado = await adaptador.capturarSelfieYPruebaDeVida("EXP-1", {
      tipo: "SESION_LIVENESS",
      referenciaSesion: "sesion-1",
    });

    expect(resultado.imagen.hashSha256).toBe("");
  });

  it("una sesión que no terminó no aprueba", async () => {
    const { adaptador } = proveedor({
      sessionResults: { Status: "EXPIRED", Confidence: 99.9 },
    });
    const resultado = await adaptador.capturarSelfieYPruebaDeVida("EXP-1", {
      tipo: "SESION_LIVENESS",
      referenciaSesion: "sesion-1",
    });

    expect(resultado.pruebaDeVidaAprobada).toBe(false);
    expect(resultado.puntuacion).toBeNull();
  });
});

describe("compararRostro", () => {
  it("aprueba el camino feliz con el umbral de caso sensible", async () => {
    const { adaptador } = caminoFeliz();
    await adaptador.capturarFrenteCedula("EXP-1", FRENTE);
    await adaptador.capturarSelfieYPruebaDeVida("EXP-1", {
      tipo: "SESION_LIVENESS",
      referenciaSesion: "sesion-1",
    });

    const resultado = await adaptador.compararRostro("EXP-1");
    expect(resultado.coincidenciaFacialAprobada).toBe(true);
    expect(resultado.puntuacion).toBe(99.6);
  });

  it("un 95 no alcanza", async () => {
    expect(UMBRAL_COINCIDENCIA_FACIAL).toBe(99);
    const { adaptador } = proveedor({
      detectFaces: { FaceDetails: [ROSTRO_BUENO] },
      compareFaces: { FaceMatches: [{ Similarity: 95 }] },
      sessionResults: {
        Status: "SUCCEEDED",
        Confidence: 93,
        ReferenceImage: { Bytes: new Uint8Array([7]) },
      },
      textract: () => ({ Blocks: bloques(["x"]) }),
    });
    await adaptador.capturarFrenteCedula("EXP-1", FRENTE);
    await adaptador.capturarSelfieYPruebaDeVida("EXP-1", {
      tipo: "SESION_LIVENESS",
      referenciaSesion: "sesion-1",
    });

    const resultado = await adaptador.compararRostro("EXP-1");
    expect(resultado.coincidenciaFacialAprobada).toBe(false);
    expect(resultado.puntuacion).toBe(95);
  });

  it("no compara si la prueba de vida no aprobó", async () => {
    // Una coincidencia sin prueba de vida no prueba presencia: podría ser una
    // foto. Además ahorra una llamada facturada.
    const { adaptador, comandos } = proveedor({
      detectFaces: { FaceDetails: [ROSTRO_BUENO] },
      sessionResults: { Status: "FAILED", Confidence: 10 },
      textract: () => ({ Blocks: bloques(["x"]) }),
    });
    await adaptador.capturarFrenteCedula("EXP-1", FRENTE);
    await adaptador.capturarSelfieYPruebaDeVida("EXP-1", {
      tipo: "SESION_LIVENESS",
      referenciaSesion: "sesion-1",
    });

    const resultado = await adaptador.compararRostro("EXP-1");
    expect(resultado.coincidenciaFacialAprobada).toBe(false);
    expect(resultado.puntuacion).toBeNull();
    expect(comandos).not.toContain("CompareFacesCommand");
  });

  it("no compara si el frente no aprobó calidad", async () => {
    const { adaptador, comandos } = proveedor({
      detectFaces: { FaceDetails: [{ ...ROSTRO_BUENO, Quality: { Sharpness: 2, Brightness: 2 } }] },
      sessionResults: {
        Status: "SUCCEEDED",
        Confidence: 95,
        ReferenceImage: { Bytes: new Uint8Array([7]) },
      },
      textract: () => ({ Blocks: bloques(["x"]) }),
    });
    await adaptador.capturarFrenteCedula("EXP-1", FRENTE);
    await adaptador.capturarSelfieYPruebaDeVida("EXP-1", {
      tipo: "SESION_LIVENESS",
      referenciaSesion: "sesion-1",
    });

    expect((await adaptador.compararRostro("EXP-1")).coincidenciaFacialAprobada).toBe(false);
    expect(comandos).not.toContain("CompareFacesCommand");
  });
});

describe("crearSesionPruebaDeVida", () => {
  it("devuelve la referencia y la vigencia del proveedor", async () => {
    const { adaptador } = caminoFeliz();
    const sesion = await adaptador.crearSesionPruebaDeVida("EXP-1");

    expect(sesion.referenciaSesion).toBe("sesion-1");
    // 3 minutos, fijados por Rekognition; un solo uso.
    expect(sesion.vigenciaSegundos).toBe(180);
  });
});

describe("aislamiento entre expedientes", () => {
  it("las capturas de un expediente no alcanzan a otro", async () => {
    const { adaptador } = caminoFeliz();
    await adaptador.capturarFrenteCedula("EXP-A", FRENTE);
    await adaptador.capturarDorsoCedula("EXP-A", DORSO);

    // EXP-B no capturó nada: no puede heredar el OCR de EXP-A.
    expect((await adaptador.extraerDatosCedula("EXP-B")).confiable).toBe(false);
    expect((await adaptador.compararRostro("EXP-B")).coincidenciaFacialAprobada).toBe(false);
  });
});
