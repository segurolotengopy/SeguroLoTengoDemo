/**
 * Capacidades biométricas sobre Rekognition.
 *
 * Los tests usan dobles del cliente: no hay red, ni credenciales, ni gasto.
 * Lo que se verifica no es que el SDK funcione —eso es de AWS— sino las tres
 * decisiones que sí son nuestras y que un error silencioso volvería
 * peligrosas: qué se manda en cada comando, cómo se traduce la respuesta al
 * vocabulario del dominio, y **qué pasa cuando la respuesta viene incompleta**.
 */
import { describe, expect, it } from "vitest";
import {
  UMBRAL_COINCIDENCIA_FACIAL,
  UMBRAL_PRUEBA_DE_VIDA,
} from "../../../domain/identidad-parametros";
import {
  DESAFIO_PRUEBA_DE_VIDA_POR_DEFECTO,
  RECORTE_EXIGIDO_POR_LA_POLITICA,
  compararRostros,
  crearSesionPruebaDeVida,
  detectarYMedirRostro,
  obtenerResultadoPruebaDeVida,
  rectanguloDeRecorte,
} from "../rekognition-identidad";
import type { ClienteRekognition } from "../rekognition-identidad";

const IMAGEN = new Uint8Array([1, 2, 3]);
const DIMENSIONES = { ancho: 1000, alto: 1000 };

/**
 * Cliente falso que devuelve una respuesta fija y guarda el comando recibido,
 * para poder afirmar sobre lo que se le mandó a AWS.
 */
function clienteQueDevuelve(respuesta: unknown) {
  const comandos: unknown[] = [];
  const cliente = {
    async send(comando: unknown) {
      comandos.push(comando);
      return respuesta;
    },
  } as unknown as ClienteRekognition;
  return { cliente, comandos };
}

/** Rostro que aprueba todos los controles de calidad. */
const ROSTRO_BUENO = {
  BoundingBox: { Width: 0.4, Height: 0.5, Left: 0.3, Top: 0.2 },
  Pose: { Yaw: 3, Pitch: -2, Roll: 1 },
  Quality: { Sharpness: 90, Brightness: 70 },
  FaceOccluded: { Value: false },
};

describe("detectarYMedirRostro", () => {
  it("traduce la respuesta de DetectFaces a una medición del dominio", async () => {
    const { cliente } = clienteQueDevuelve({ FaceDetails: [ROSTRO_BUENO] });
    const resultado = await detectarYMedirRostro(cliente, IMAGEN, DIMENSIONES);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.calidad.aprobada).toBe(true);
    // El recuadro viene en proporción (0-1) y el umbral de tamaño está en
    // píxeles: sin multiplicar por las dimensiones reales, un rostro de
    // 0,4 × 0,5 se leería como "menor a 50 px" y se rechazaría siempre.
    expect(resultado.medicion.anchoRostroPx).toBe(400);
    expect(resultado.medicion.altoRostroPx).toBe(500);
    expect(resultado.medicion.nitidez).toBe(90);
  });

  it("rechaza una imagen sin rostro", async () => {
    const { cliente } = clienteQueDevuelve({ FaceDetails: [] });
    expect(await detectarYMedirRostro(cliente, IMAGEN, DIMENSIONES)).toEqual({
      ok: false,
      motivo: "SIN_ROSTRO",
    });
  });

  it("rechaza más de un rostro en vez de elegir el más grande", async () => {
    // Una segunda cara en una selfie de onboarding es una anomalía —alguien
    // sosteniendo una foto, una pantalla de fondo—. Elegir "la más grande"
    // sería hacer justo lo que un atacante querría.
    const { cliente } = clienteQueDevuelve({ FaceDetails: [ROSTRO_BUENO, ROSTRO_BUENO] });
    expect(await detectarYMedirRostro(cliente, IMAGEN, DIMENSIONES)).toEqual({
      ok: false,
      motivo: "MAS_DE_UN_ROSTRO",
    });
  });

  it("un rostro sin dato de oclusión se trata como ocluido", async () => {
    // Lado seguro: sin el dato no se puede afirmar que el rostro esté libre.
    const { cliente } = clienteQueDevuelve({
      FaceDetails: [{ ...ROSTRO_BUENO, FaceOccluded: undefined }],
    });
    const resultado = await detectarYMedirRostro(cliente, IMAGEN, DIMENSIONES);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.medicion.rostroOcluido).toBe(true);
    expect(resultado.calidad.motivos).toContain("ROSTRO_OCLUIDO");
  });

  it("una respuesta sin pose ni calidad no aprueba por omisión", async () => {
    // Los valores ausentes caen a 0, y 0 de nitidez y brillo no alcanzan el
    // umbral: una respuesta degradada rechaza, no aprueba.
    const { cliente } = clienteQueDevuelve({
      FaceDetails: [{ BoundingBox: { Width: 0.4, Height: 0.5, Left: 0.3, Top: 0.2 } }],
    });
    const resultado = await detectarYMedirRostro(cliente, IMAGEN, DIMENSIONES);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.calidad.aprobada).toBe(false);
    expect(resultado.calidad.motivos).toContain("IMAGEN_BORROSA");
    expect(resultado.calidad.motivos).toContain("ILUMINACION_INSUFICIENTE");
  });
});

describe("compararRostros", () => {
  it("pide la puntuación cruda en vez de dejar que el servicio filtre", async () => {
    const { cliente, comandos } = clienteQueDevuelve({ FaceMatches: [{ Similarity: 99.6 }] });
    await compararRostros(cliente, IMAGEN, IMAGEN);

    // Con el default de Rekognition (80) un 85 legítimo llegaría como "sin
    // coincidencias" y se perdería el número que la evidencia necesita.
    const entrada = (comandos[0] as { input: Record<string, unknown> }).input;
    expect(entrada.SimilarityThreshold).toBe(0);
  });

  it("aplica el umbral del dominio, no el del proveedor", async () => {
    const { cliente } = clienteQueDevuelve({ FaceMatches: [{ Similarity: 99.6 }] });
    const decision = await compararRostros(cliente, IMAGEN, IMAGEN);

    expect(decision.aprobada).toBe(true);
    expect(decision.puntuacion).toBe(99.6);
    expect(decision.umbral).toBe(UMBRAL_COINCIDENCIA_FACIAL);
  });

  it("un 95 no alcanza: el umbral es el de caso sensible", async () => {
    const { cliente } = clienteQueDevuelve({ FaceMatches: [{ Similarity: 95 }] });
    const decision = await compararRostros(cliente, IMAGEN, IMAGEN);

    expect(decision.aprobada).toBe(false);
    // La puntuación se conserva igual: rechazar no es motivo para perder la
    // evidencia de cuánto dio.
    expect(decision.puntuacion).toBe(95);
  });

  it("sin coincidencias no hay puntuación y se rechaza", async () => {
    const { cliente } = clienteQueDevuelve({ FaceMatches: [] });
    const decision = await compararRostros(cliente, IMAGEN, IMAGEN);

    expect(decision.aprobada).toBe(false);
    expect(decision.puntuacion).toBeNull();
  });

  it("toma la mejor de varias coincidencias", async () => {
    const { cliente } = clienteQueDevuelve({
      FaceMatches: [{ Similarity: 62 }, { Similarity: 99.2 }, { Similarity: 81 }],
    });
    expect((await compararRostros(cliente, IMAGEN, IMAGEN)).puntuacion).toBe(99.2);
  });

  it("deja constancia de que CompareFaces no informa versión de modelo", async () => {
    // Limitación real del proveedor, no un pendiente: solo las APIs con
    // colección devuelven FaceModelVersion, y este flujo no las usa a
    // propósito para no persistir vectores faciales en AWS.
    const { cliente } = clienteQueDevuelve({ FaceMatches: [{ Similarity: 99.9 }] });
    const decision = await compararRostros(cliente, IMAGEN, IMAGEN);

    expect(decision.versionModeloProveedor).toBeNull();
    // Lo que sí queda sellado es lo que está bajo nuestro control.
    expect(decision.umbral).toBe(UMBRAL_COINCIDENCIA_FACIAL);
    expect(decision.versionPolitica).toBeTruthy();
  });
});

describe("crearSesionPruebaDeVida", () => {
  it("usa el desafío de máxima precisión por defecto", async () => {
    const { cliente, comandos } = clienteQueDevuelve({ SessionId: "sesion-1" });
    const sesion = await crearSesionPruebaDeVida(cliente);

    expect(sesion.sessionId).toBe("sesion-1");
    const entrada = (comandos[0] as { input: { Settings?: Record<string, unknown> } }).input;
    expect(entrada.Settings?.ChallengePreferences).toEqual([
      { Type: DESAFIO_PRUEBA_DE_VIDA_POR_DEFECTO },
    ]);
    expect(DESAFIO_PRUEBA_DE_VIDA_POR_DEFECTO).toBe("FaceMovementAndLightChallenge");
  });

  it("permite el desafío sin destellos para personas fotosensibles", async () => {
    const { cliente, comandos } = clienteQueDevuelve({ SessionId: "sesion-2" });
    await crearSesionPruebaDeVida(cliente, { desafio: "FaceMovementChallenge" });

    const entrada = (comandos[0] as { input: { Settings?: Record<string, unknown> } }).input;
    expect(entrada.Settings?.ChallengePreferences).toEqual([{ Type: "FaceMovementChallenge" }]);
  });

  it("pide la imagen de auditoría, que es la que ata vida y comparación", async () => {
    // Sin usar la imagen de la propia sesión, alguien podría pasar la prueba
    // de vida con su cara y mandar otra foto a comparar.
    const { cliente, comandos } = clienteQueDevuelve({ SessionId: "sesion-3" });
    await crearSesionPruebaDeVida(cliente);

    const entrada = (comandos[0] as { input: { Settings?: Record<string, unknown> } }).input;
    expect(entrada.Settings?.AuditImagesLimit).toBe(1);
  });

  it("falla si Rekognition no devuelve SessionId", async () => {
    const { cliente } = clienteQueDevuelve({});
    await expect(crearSesionPruebaDeVida(cliente)).rejects.toThrow(/SessionId/);
  });
});

describe("obtenerResultadoPruebaDeVida", () => {
  it("aprueba una sesión completa por encima del umbral", async () => {
    const { cliente } = clienteQueDevuelve({
      Status: "SUCCEEDED",
      Confidence: 92.5,
      ReferenceImage: { Bytes: new Uint8Array([9, 9]) },
      Challenge: { Type: "FaceMovementAndLightChallenge" },
    });
    const resultado = await obtenerResultadoPruebaDeVida(cliente, "sesion-1");

    expect(resultado.decision.aprobada).toBe(true);
    expect(resultado.decision.umbral).toBe(UMBRAL_PRUEBA_DE_VIDA);
    expect(resultado.imagenReferencia).toEqual(new Uint8Array([9, 9]));
    expect(resultado.desafioUsado).toBe("FaceMovementAndLightChallenge");
  });

  it("una sesión que no terminó nunca aprueba, aunque traiga confianza alta", async () => {
    // Este es el error que el módulo existe para impedir: tomar el
    // `Confidence` suelto de una sesión expirada o a medio hacer aprobaría
    // una prueba de vida que nunca ocurrió.
    for (const estado of ["EXPIRED", "FAILED", "IN_PROGRESS", "CREATED"]) {
      const { cliente } = clienteQueDevuelve({ Status: estado, Confidence: 99.9 });
      const resultado = await obtenerResultadoPruebaDeVida(cliente, "sesion-x");

      expect(resultado.decision.aprobada).toBe(false);
      expect(resultado.decision.puntuacion).toBeNull();
    }
  });

  it("rechaza una sesión completa por debajo del umbral y conserva el número", async () => {
    const { cliente } = clienteQueDevuelve({ Status: "SUCCEEDED", Confidence: 61 });
    const resultado = await obtenerResultadoPruebaDeVida(cliente, "sesion-1");

    expect(resultado.decision.aprobada).toBe(false);
    expect(resultado.decision.puntuacion).toBe(61);
    expect(resultado.imagenReferencia).toBeNull();
  });
});

describe("rectanguloDeRecorte", () => {
  it("agrega margen alrededor del recuadro del rostro", () => {
    // Recortar exacto al recuadro corta frente y mentón, y a Rekognition le
    // va mejor con algo de contexto.
    const recorte = rectanguloDeRecorte(
      { Width: 0.4, Height: 0.5, Left: 0.3, Top: 0.2 },
      DIMENSIONES,
    );
    expect(recorte.ancho).toBeGreaterThan(400);
    expect(recorte.alto).toBeGreaterThan(500);
    expect(recorte.x).toBeLessThan(300);
    expect(recorte.y).toBeLessThan(200);
  });

  it("no se sale de los bordes de la imagen", () => {
    const recorte = rectanguloDeRecorte({ Width: 1, Height: 1, Left: 0, Top: 0 }, DIMENSIONES);

    expect(recorte.x).toBe(0);
    expect(recorte.y).toBe(0);
    expect(recorte.x + recorte.ancho).toBeLessThanOrEqual(DIMENSIONES.ancho);
    expect(recorte.y + recorte.alto).toBeLessThanOrEqual(DIMENSIONES.alto);
  });

  it("el recorte sigue siendo exigible con la política vigente", () => {
    // Si alguien bajara el umbral por debajo de 99 esto cambiaría; con 99 y
    // recorte obligatorio tiene que dar true.
    expect(RECORTE_EXIGIDO_POR_LA_POLITICA).toBe(true);
  });
});
