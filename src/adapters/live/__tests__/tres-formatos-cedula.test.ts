/**
 * Los tres formatos de cédula del piloto (ítem 9 de
 * `docs/Tabla de Integraciones externas - Tabla.csv`): formato nuevo, formato
 * anterior y cédula de residente.
 *
 * **Esto no reemplaza al piloto con cédulas reales**, que es el que va a medir
 * tasas de aprobación con fotos de verdad, iluminación de verdad y documentos
 * gastados. Lo que fija este archivo es lo que el código hace **por diseño**
 * con cada formato, que es la mitad de las preguntas del piloto y no necesita
 * ninguna cédula para contestarse.
 *
 * El hallazgo que justifica el archivo: de los tres formatos, **uno no puede
 * completar P5 hoy**, y no por un umbral mal calibrado sino por una decisión
 * deliberada del dominio. Conviene que eso esté escrito y con un test que lo
 * sostenga, no que se descubra con una persona real frustrada en la pantalla.
 */
import { describe, expect, it } from "vitest";
import { crearIdentityProviderAws } from "../identity-provider";

const HOY = new Date("2026-08-14T12:00:00.000Z");

const ROSTRO_BUENO = {
  BoundingBox: { Width: 0.4, Height: 0.5, Left: 0.3, Top: 0.2 },
  Pose: { Yaw: 2, Pitch: 1, Roll: 0 },
  Quality: { Sharpness: 88, Brightness: 70 },
  FaceOccluded: { Value: false },
};

function png(ancho: number, alto: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const escribir = (offset: number, valor: number) => {
    bytes[offset] = (valor >>> 24) & 0xff;
    bytes[offset + 1] = (valor >>> 16) & 0xff;
    bytes[offset + 2] = (valor >>> 8) & 0xff;
    bytes[offset + 3] = valor & 0xff;
  };
  escribir(16, ancho);
  escribir(20, alto);
  return bytes;
}

const IMAGEN = png(1000, 1000);

function bloques(textos: readonly string[], confianza: number) {
  return textos.map((texto) => ({ BlockType: "LINE", Text: texto, Confidence: confianza }));
}

/**
 * Adaptador con Textract simulado: la primera llamada es el frente, la
 * segunda el dorso. El rostro siempre aprueba calidad, para que lo único que
 * varíe entre casos sea el formato del documento.
 */
function adaptadorCon(opciones: {
  readonly frente: readonly string[];
  readonly dorso: readonly string[];
  /** Confianza del OCR del dorso. El MRZ suele venir bajo por la fuente OCR-B. */
  readonly confianzaDorso: number;
}) {
  let llamada = 0;
  return crearIdentityProviderAws({
    rekognition: {
      async send() {
        return { FaceDetails: [ROSTRO_BUENO] };
      },
    } as never,
    textract: {
      async send() {
        llamada += 1;
        return {
          Blocks:
            llamada === 1
              ? bloques(opciones.frente, 99)
              : bloques(opciones.dorso, opciones.confianzaDorso),
        };
      },
    } as never,
    ahora: () => HOY,
  });
}

/** Cédula 9.323.336, nacida el 12/05/1990, vence 12/05/2030. Emisor y nacionalidad PRY. */
const MRZ_FORMATO_NUEVO = [
  "IDPRY9323336<<9<<<<<<<<<<<<<<<",
  "9005123F3005121PRY<<<<<<<<<<<0",
  "GORENA<TAPIA<<MONICA<MARIANA<<",
];

/**
 * Cédula de residente: **la emite Paraguay** (estado emisor `PRY`), y lo
 * extranjero es la *nacionalidad* del titular (`BRA`). Modelarla al revés —con
 * estado emisor extranjero— es el error fácil, y da un falso negativo:
 * `cruzarConMrz` rechaza por `ESTADO_EMISOR_NO_ES_PARAGUAY` un documento que en
 * realidad es válido.
 */
const MRZ_RESIDENTE = [
  "IDPRY4567890<<1<<<<<<<<<<<<<<<",
  "8802107M2903150BRA<<<<<<<<<<<8",
  "SILVA<<JOAO<CARLOS<<<<<<<<<<<<",
];

describe("formato nuevo (con MRZ)", () => {
  it("completa el camino: autenticidad, OCR confiable y datos del MRZ", async () => {
    const adaptador = adaptadorCon({
      frente: ["REPUBLICA DEL PARAGUAY", "9.323.336", "12/05/1990"],
      dorso: MRZ_FORMATO_NUEVO,
      confianzaDorso: 72,
    });

    await adaptador.capturarFrenteCedula("EXP", IMAGEN);
    const dorso = await adaptador.capturarDorsoCedula("EXP", IMAGEN);
    const ocr = await adaptador.extraerDatosCedula("EXP");

    expect(dorso.autenticidadAprobada).toBe(true);
    expect(ocr.confiable).toBe(true);
    expect(ocr.datos.numeroCedula).toBe("9323336");
    expect(ocr.datos.apellidos).toBe("GORENA TAPIA");
    expect(ocr.datos.fechaNacimiento).toBe("1990-05-12");
  });
});

describe("cédula de residente", () => {
  it("pasa: la emite Paraguay, solo la nacionalidad es extranjera", async () => {
    const adaptador = adaptadorCon({
      frente: ["4.567.890", "10/02/1988"],
      dorso: MRZ_RESIDENTE,
      confianzaDorso: 72,
    });

    await adaptador.capturarFrenteCedula("EXP", IMAGEN);
    const dorso = await adaptador.capturarDorsoCedula("EXP", IMAGEN);
    const ocr = await adaptador.extraerDatosCedula("EXP");

    expect(dorso.autenticidadAprobada).toBe(true);
    expect(ocr.confiable).toBe(true);
    expect(ocr.datos.nacionalidad).toBe("BRA");
    expect(ocr.datos.nombres).toBe("JOAO CARLOS");
    // La regla de P5 es "cédula paraguaya vigente", y esta lo es: la emitió
    // Paraguay. Lo que P5 rechaza es pasaporte y documento extranjero, no a un
    // residente con cédula paraguaya.
  });

  it("un documento emitido por otro estado sí se rechaza", async () => {
    // El contraste que hace válido al caso anterior: lo que se controla es el
    // **emisor**, no la nacionalidad del titular.
    const adaptador = adaptadorCon({
      frente: ["4.567.890", "10/02/1988"],
      dorso: [
        "IDBRA9323336<<9<<<<<<<<<<<<<<<",
        "9005123F3005121BRA<<<<<<<<<<<0",
        "SILVA<<JOAO<<<<<<<<<<<<<<<<<<<",
      ],
      confianzaDorso: 72,
    });

    await adaptador.capturarFrenteCedula("EXP", IMAGEN);
    await adaptador.capturarDorsoCedula("EXP", IMAGEN);

    expect((await adaptador.extraerDatosCedula("EXP")).confiable).toBe(false);
  });
});

describe("formato anterior (sin MRZ) — no puede completar P5 hoy", () => {
  /**
   * Este es el hallazgo del piloto que no hacía falta una cédula real para
   * encontrar, y el más importante de los tres.
   */
  it("las tres capturas aprueban, pero el OCR no es confiable", async () => {
    const adaptador = adaptadorCon({
      frente: ["REPUBLICA DEL PARAGUAY", "9.323.336", "12/05/1990"],
      // Dorso perfectamente legible, sin MRZ: es el formato anterior.
      dorso: ["REPUBLICA DEL PARAGUAY", "DEPARTAMENTO DE IDENTIFICACIONES", "9.323.336"],
      confianzaDorso: 99,
    });

    const frente = await adaptador.capturarFrenteCedula("EXP", IMAGEN);
    const dorso = await adaptador.capturarDorsoCedula("EXP", IMAGEN);
    const ocr = await adaptador.extraerDatosCedula("EXP");

    // Las dos capturas aprueban: la foto está bien, el documento no es falso.
    expect(frente.calidadAprobada).toBe(true);
    expect(dorso.calidadAprobada).toBe(true);
    expect(dorso.autenticidadAprobada).toBe(true);
    expect(dorso.motivoRechazo).toBeNull();

    // Y sin embargo el OCR no es confiable, así que P5 no puede continuar.
    expect(ocr.confiable).toBe(false);
    expect(ocr.datos.fechaNacimiento).toBe("");
  });

  it("no es un umbral mal calibrado: con OCR perfecto sigue sin poder", async () => {
    /**
     * La prueba de que esto no se arregla calibrando: aun con el frente y el
     * dorso leídos con confianza 100, el resultado es el mismo. El problema no
     * es que el OCR lea con poca confianza — es que **no hay estructura que
     * leer**. Sin MRZ no hay de dónde sacar nombres, apellidos ni fecha de
     * nacimiento con garantías, y el frente de la cédula no tiene formato
     * publicado por el Departamento de Identificaciones, así que reconocerlos
     * por posición sería adivinar. La fecha de nacimiento es la que decide el
     * corte de edad 18–64 (regla inviolable #8).
     *
     * Se resuelve con una de estas dos, no bajando un número:
     *
     *  1. Cruzar el número de cédula —que el frente **sí** da de forma
     *     confiable— contra el registro civil, y tomar de ahí nombre y fecha
     *     de nacimiento. Más fuerte que cualquier OCR sobre un documento
     *     gastado. Ver §7.7 del documento de recomendaciones.
     *  2. Derivar a revisión manual con evidencia conservada (§6 del mismo
     *     documento), que es la salida que hoy P5 no tiene.
     */
    const adaptador = adaptadorCon({
      frente: ["REPUBLICA DEL PARAGUAY", "9.323.336", "12/05/1990", "MONICA MARIANA GORENA TAPIA"],
      dorso: ["REPUBLICA DEL PARAGUAY", "DEPARTAMENTO DE IDENTIFICACIONES"],
      confianzaDorso: 100,
    });

    await adaptador.capturarFrenteCedula("EXP", IMAGEN);
    await adaptador.capturarDorsoCedula("EXP", IMAGEN);

    expect((await adaptador.extraerDatosCedula("EXP")).confiable).toBe(false);
  });
});
