/**
 * Parámetros de verificación de identidad de P5.
 *
 * Lo que se prueba acá no es aritmética: son los **niveles** con los que el
 * sistema decide si una persona es quien dice ser. Cada aserción sobre un
 * número concreto es deliberada — si alguien baja el umbral de coincidencia
 * facial de 99 a 95 para "mejorar la conversión", este archivo se pone en rojo
 * y lo obliga a justificarlo, que es exactamente lo que tiene que pasar.
 *
 * Referencias de los valores: AWS, «Face and Liveness Verification for Identity
 * Verification with Amazon Rekognition» (12/03/2024), §3.3.1 y §6.1.
 */
import { describe, expect, it } from "vitest";
import {
  ANTIABUSO_PRUEBA_DE_VIDA,
  CALIDAD_ROSTRO,
  CONFIANZA_MINIMA_OCR,
  MENSAJE_CALIDAD_ROSTRO,
  RECORTE_ROSTRO_OBLIGATORIO,
  UMBRAL_COINCIDENCIA_FACIAL,
  UMBRAL_PRUEBA_DE_VIDA,
  VERSION_POLITICA_IDENTIDAD,
  decidir,
  decidirCoincidenciaFacial,
  decidirPruebaDeVida,
  detalleEvidencia,
  evaluarCalidadRostro,
} from "../identidad-parametros";
import type { MedicionCalidadRostro, MotivoCalidadRostro } from "../identidad-parametros";

/** Medición que aprueba cómodamente todos los controles. */
const MEDICION_BUENA: MedicionCalidadRostro = {
  yaw: 5,
  pitch: -3,
  roll: 2,
  nitidez: 80,
  brillo: 65,
  anchoRostroPx: 320,
  altoRostroPx: 400,
  rostroOcluido: false,
};

describe("umbrales de decisión", () => {
  it("la coincidencia facial usa 99, el umbral de caso sensible", () => {
    // AWS §6.1: «95 – for regular use cases / 99 – for sensitive use cases».
    // Este flujo firma un contrato de seguro de vida: es sensible.
    expect(UMBRAL_COINCIDENCIA_FACIAL).toBe(99);
  });

  it("a 99 el recorte de rostro es obligatorio", () => {
    // AWS §6.1 condiciona el umbral de 99 al recorte previo con DetectFaces.
    // Si alguien mantiene el 99 y apaga el recorte, el umbral deja de ser el
    // que AWS midió y pasa a rechazar pares legítimos.
    expect(RECORTE_ROSTRO_OBLIGATORIO).toBe(true);
  });

  it("la prueba de vida usa 80, el rango de inyección digital", () => {
    expect(UMBRAL_PRUEBA_DE_VIDA).toBe(80);
  });

  it("el OCR exige 90 de confianza por bloque", () => {
    // Decisión de producto, no de norma: los campos quedan bloqueados y la
    // fecha de nacimiento alimenta el corte de edad (regla inviolable #8).
    expect(CONFIANZA_MINIMA_OCR).toBe(90);
  });

  it("los umbrales biométricos viven en la escala 0-100 del proveedor", () => {
    for (const umbral of [UMBRAL_COINCIDENCIA_FACIAL, UMBRAL_PRUEBA_DE_VIDA, CONFIANZA_MINIMA_OCR]) {
      expect(umbral).toBeGreaterThan(1);
      expect(umbral).toBeLessThanOrEqual(100);
    }
  });
});

describe("evaluarCalidadRostro", () => {
  it("aprueba una medición dentro de todos los rangos", () => {
    expect(evaluarCalidadRostro(MEDICION_BUENA)).toEqual({ aprobada: true, motivos: [] });
  });

  it("rechaza pose fuera de rango en cualquiera de los tres ejes", () => {
    const ejes: readonly (keyof Pick<MedicionCalidadRostro, "yaw" | "pitch" | "roll">)[] = [
      "yaw",
      "pitch",
      "roll",
    ];
    for (const eje of ejes) {
      const excedido = evaluarCalidadRostro({ ...MEDICION_BUENA, [eje]: 31 });
      expect(excedido.motivos).toContain("POSE_FUERA_DE_RANGO");
      // El signo no importa: girar la cabeza a un lado o al otro es igual.
      const negativo = evaluarCalidadRostro({ ...MEDICION_BUENA, [eje]: -31 });
      expect(negativo.motivos).toContain("POSE_FUERA_DE_RANGO");
    }
  });

  it("el borde exacto de la pose (30 grados) todavía aprueba", () => {
    expect(evaluarCalidadRostro({ ...MEDICION_BUENA, yaw: 30, pitch: -30, roll: 30 }).aprobada).toBe(
      true,
    );
  });

  it("nitidez y brillo rechazan en el umbral, no solo por debajo", () => {
    // AWS escribe «Sharpness > 25», no «>= 25»: 25 exacto no alcanza.
    expect(evaluarCalidadRostro({ ...MEDICION_BUENA, nitidez: 25 }).motivos).toContain(
      "IMAGEN_BORROSA",
    );
    expect(evaluarCalidadRostro({ ...MEDICION_BUENA, brillo: 25 }).motivos).toContain(
      "ILUMINACION_INSUFICIENTE",
    );
    expect(evaluarCalidadRostro({ ...MEDICION_BUENA, nitidez: 26, brillo: 26 }).aprobada).toBe(true);
  });

  it("rechaza un rostro con cualquier lado por debajo de 50 px", () => {
    expect(evaluarCalidadRostro({ ...MEDICION_BUENA, anchoRostroPx: 49 }).motivos).toContain(
      "ROSTRO_DEMASIADO_CHICO",
    );
    expect(evaluarCalidadRostro({ ...MEDICION_BUENA, altoRostroPx: 49 }).motivos).toContain(
      "ROSTRO_DEMASIADO_CHICO",
    );
    expect(
      evaluarCalidadRostro({ ...MEDICION_BUENA, anchoRostroPx: 50, altoRostroPx: 50 }).aprobada,
    ).toBe(true);
  });

  it("rechaza un rostro ocluido", () => {
    expect(evaluarCalidadRostro({ ...MEDICION_BUENA, rostroOcluido: true }).motivos).toContain(
      "ROSTRO_OCLUIDO",
    );
  });

  it("acumula todos los motivos en vez de cortar en el primero", () => {
    // Si solo reportara el primero, la persona repetiría la captura una vez
    // por cada defecto en lugar de corregir todo junto.
    const pesima = evaluarCalidadRostro({
      yaw: 45,
      pitch: 0,
      roll: 0,
      nitidez: 10,
      brillo: 5,
      anchoRostroPx: 20,
      altoRostroPx: 20,
      rostroOcluido: true,
    });
    expect(pesima.aprobada).toBe(false);
    expect([...pesima.motivos].sort()).toEqual(
      [
        "ILUMINACION_INSUFICIENTE",
        "IMAGEN_BORROSA",
        "POSE_FUERA_DE_RANGO",
        "ROSTRO_DEMASIADO_CHICO",
        "ROSTRO_OCLUIDO",
      ].sort(),
    );
  });

  it("todo motivo tiene un mensaje para la persona, sin números ni jerga", () => {
    const motivos: readonly MotivoCalidadRostro[] = [
      "POSE_FUERA_DE_RANGO",
      "IMAGEN_BORROSA",
      "ILUMINACION_INSUFICIENTE",
      "ROSTRO_DEMASIADO_CHICO",
      "ROSTRO_OCLUIDO",
    ];
    for (const motivo of motivos) {
      const mensaje = MENSAJE_CALIDAD_ROSTRO[motivo];
      expect(mensaje).toBeTruthy();
      // El umbral es para la evidencia, no para la pantalla.
      expect(mensaje).not.toMatch(/\d/);
      expect(mensaje.toLowerCase()).not.toContain("umbral");
    }
  });
});

describe("decidir", () => {
  it("aprueba en el umbral exacto y rechaza justo por debajo", () => {
    expect(decidir(99, 99, "7.0").aprobada).toBe(true);
    expect(decidir(98.99, 99, "7.0").aprobada).toBe(false);
  });

  it("una puntuación ausente nunca aprueba", () => {
    // Sin similitud devuelta no hay evidencia de coincidencia. Ante ausencia
    // de evidencia se rechaza y se deriva, no se deja pasar.
    const sinPuntuacion = decidir(null, 99, "7.0");
    expect(sinPuntuacion.aprobada).toBe(false);
    expect(sinPuntuacion.puntuacion).toBeNull();
  });

  it("conserva la puntuación cruda, el umbral y las dos versiones", () => {
    // Los cuatro campos juntos son lo que hace reproducible la decisión años
    // después: sin el umbral o sin la versión de modelo, el score no se puede
    // volver a interpretar.
    const decision = decidir(94.5, 99, "6.0");
    expect(decision).toEqual({
      aprobada: false,
      puntuacion: 94.5,
      umbral: 99,
      versionModeloProveedor: "6.0",
      versionPolitica: VERSION_POLITICA_IDENTIDAD,
    });
  });

  it("tolera que el proveedor no informe versión de modelo", () => {
    expect(decidir(99.5, 99, null).versionModeloProveedor).toBeNull();
  });

  it("los atajos aplican cada uno su umbral", () => {
    expect(decidirCoincidenciaFacial(99, "7.0").umbral).toBe(UMBRAL_COINCIDENCIA_FACIAL);
    expect(decidirPruebaDeVida(85, "7.0").umbral).toBe(UMBRAL_PRUEBA_DE_VIDA);

    // Una similitud de 95 aprobaría un caso "regular" pero no este.
    expect(decidirCoincidenciaFacial(95, "7.0").aprobada).toBe(false);
    // Y una confianza de vida de 85 sí alcanza para el umbral de liveness.
    expect(decidirPruebaDeVida(85, "7.0").aprobada).toBe(true);
  });

  it("una puntuación en escala 0-1 no aprueba por accidente", () => {
    // Regresión del error más caro posible en este módulo: si un adaptador
    // olvidara normalizar 0,97 a 97, un 0,97 contra un umbral de 99 tiene que
    // rechazar (que es lo seguro), nunca aprobar.
    expect(decidirCoincidenciaFacial(0.97, "7.0").aprobada).toBe(false);
  });
});

describe("detalleEvidencia", () => {
  it("arma una línea con puntuación, umbral y versiones", () => {
    const detalle = detalleEvidencia("coincidencia-facial", decidirCoincidenciaFacial(99.4, "7.0"));
    expect(detalle).toContain("coincidencia-facial=APROBADA");
    expect(detalle).toContain("puntuacion=99.40");
    expect(detalle).toContain("umbral=99");
    expect(detalle).toContain("modelo=7.0");
    expect(detalle).toContain(`politica=${VERSION_POLITICA_IDENTIDAD}`);
  });

  it("marca explícitamente la ausencia de puntuación y de modelo", () => {
    const detalle = detalleEvidencia("prueba-de-vida", decidirPruebaDeVida(null, null));
    expect(detalle).toContain("prueba-de-vida=RECHAZADA");
    expect(detalle).toContain("puntuacion=sin-puntuacion");
    expect(detalle).toContain("modelo=desconocida");
  });
});

describe("política anti-abuso de la prueba de vida", () => {
  it("respeta los límites de AWS: 5 fallos en 3 minutos, bloqueo de 30", () => {
    expect(ANTIABUSO_PRUEBA_DE_VIDA.intentosFallidosMaximos).toBe(5);
    expect(ANTIABUSO_PRUEBA_DE_VIDA.ventanaMinutos).toBe(3);
    // AWS da un rango de 30-60 minutos; se toma el piso.
    expect(ANTIABUSO_PRUEBA_DE_VIDA.bloqueoMinutos).toBeGreaterThanOrEqual(30);
    expect(ANTIABUSO_PRUEBA_DE_VIDA.bloqueoMinutos).toBeLessThanOrEqual(60);
  });

  it("no se confunde con los límites de OTP de la regla inviolable #1", () => {
    // Los OTP son 3 intentos; la prueba de vida, 5. Son controles distintos
    // sobre canales distintos y no deben unificarse.
    expect(ANTIABUSO_PRUEBA_DE_VIDA.intentosFallidosMaximos).not.toBe(3);
  });
});

describe("versionado de la política", () => {
  it("la versión tiene el formato IDP-AAAA-MM-DD", () => {
    expect(VERSION_POLITICA_IDENTIDAD).toMatch(/^IDP-\d{4}-\d{2}-\d{2}$/);
  });

  it("toda decisión sella la versión vigente", () => {
    // Sin esto, cambiar un umbral reescribiría el criterio de los expedientes
    // ya resueltos — lo contrario de la evidencia append-only (regla #10).
    expect(decidirPruebaDeVida(90, "7.0").versionPolitica).toBe(VERSION_POLITICA_IDENTIDAD);
  });
});

describe("umbrales de calidad, contra la tabla de AWS §3.3.1", () => {
  it("coinciden con los valores publicados", () => {
    expect(CALIDAD_ROSTRO.yawMaximoGrados).toBe(30);
    expect(CALIDAD_ROSTRO.pitchMaximoGrados).toBe(30);
    expect(CALIDAD_ROSTRO.nitidezMinima).toBe(25);
    expect(CALIDAD_ROSTRO.brilloMinimo).toBe(25);
    expect(CALIDAD_ROSTRO.ladoMinimoRostroPx).toBe(50);
  });

  it("el roll es agregado nuestro, por ICAO Doc 9303 / ISO 39794-5", () => {
    // AWS no acota este eje; lo controlamos igual porque el retrato de
    // referencia de la cédula sí exige pose frontal en los tres ejes.
    expect(CALIDAD_ROSTRO.rollMaximoGrados).toBe(30);
  });
});
