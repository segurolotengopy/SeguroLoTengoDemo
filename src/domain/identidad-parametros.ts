/**
 * Parámetros de verificación de identidad de P5 — los "niveles" de calidad de
 * imagen, prueba de vida y coincidencia facial, en un solo lugar y versionados.
 *
 * Por qué existe este módulo y no constantes sueltas en el adaptador: la fila
 * 14 de `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` (Res. SEPRELAD
 * 71/19, arts. 25(a-c), 26(1)(a-b) y 29(b)) obliga a verificar identidad con
 * cédula, selfie en vivo y prueba de vida, y la fila 22 (misma resolución, art.
 * 25(a); Ley 6822/21, arts. 43(3) y 66) obliga a vincular esa evidencia al
 * expediente. Un auditor no pregunta "¿aprobó?", pregunta **con qué umbral
 * aprobó y quién lo decidió**. Un número mágico dentro de un adaptador no
 * responde eso; un umbral con versión, sí.
 *
 * De ahí la regla de este módulo: toda decisión biométrica se registra como
 * `DecisionBiometrica` — puntuación cruda + umbral aplicado + versión del
 * modelo del proveedor + versión de esta política. Con esas cuatro cosas la
 * decisión se reproduce años después, y se puede comparar un proveedor contra
 * otro sobre la misma vara.
 *
 * **Escala: 0–100 en todo el módulo.** Es la de Amazon Rekognition
 * (`CompareFaces.Similarity`, `GetFaceLivenessSessionResults.Confidence`,
 * `FaceDetail.Quality.Sharpness/Brightness`). El mock histórico devolvía 0–1 en
 * `ResultadoComparacionFacial.puntuacion`; cualquier adaptador que hable otra
 * escala la normaliza **antes** de llegar acá, porque un 0,97 comparado contra
 * un umbral de 99 aprueba lo que debería rechazar.
 *
 * Este módulo es dominio puro: no importa ningún SDK ni conoce a Rekognition.
 * Solo fija los números y decide con ellos.
 *
 * ---
 *
 * ## Procedencia de cada número
 *
 * Ninguno es inventado. Las fuentes, en orden de autoridad para cada parámetro:
 *
 * - **AWS, «Face and Liveness Verification for Identity Verification with
 *   Amazon Rekognition»** (última actualización 12/03/2024), §3.3.1 y §6.1 —
 *   umbrales de calidad de rostro y de decisión, y la política anti-abuso de
 *   §3.2. Es el proveedor que vamos a usar: manda sobre sus propios umbrales.
 * - **ICAO Doc 9303 Parte 9 (8ª ed., 2021)**, que remite al Anexo D1 de
 *   **ISO/IEC 39794-5:2019** — pose frontal y encuadre del retrato de
 *   referencia. Lo usamos para el `roll`, que AWS no acota pero el retrato de
 *   la cédula sí trae controlado.
 * - **ISO/IEC 30107-3** — vocabulario de ataques de presentación (APCER/BPCER).
 *   No fija umbrales: fija cómo se mide un detector de vida y cómo se compara.
 * - **ISO/IEC 29794-5:2025** — calidad de muestra facial. Es a dónde debería
 *   migrar este módulo cuando haya proveedores que reporten sus componentes;
 *   hoy Rekognition no los expone.
 */

/**
 * Versión de esta política. **Cambiala cada vez que se toque un umbral.**
 *
 * Va a la evidencia junto con cada decisión: sin esto, cambiar un número acá
 * reescribiría retroactivamente el criterio con el que se aprobaron los
 * expedientes viejos, que es exactamente lo que la evidencia append-only
 * (regla inviolable #10) existe para impedir.
 *
 * Formato `IDP-AAAA-MM-DD` con la fecha de la decisión de producto.
 */
export const VERSION_POLITICA_IDENTIDAD = "IDP-2026-08-13";

// ---------------------------------------------------------------------------
// Calidad de la imagen del rostro
// ---------------------------------------------------------------------------

/**
 * Umbrales de calidad que debe cumplir un rostro para que valga la pena
 * comparar. Filtrar acá no es cosmético: comparar rostros de mala calidad es
 * lo que sube tanto los falsos rechazos como los falsos aceptes, así que un
 * umbral de coincidencia alto sobre una imagen mala es una garantía falsa.
 *
 * Valores de AWS §3.3.1, salvo `rollMaximoGrados` (ver abajo).
 */
export const CALIDAD_ROSTRO = {
  /** Giro horizontal de la cabeza, en grados. AWS §3.3.1: «Yaw between -30 to 30 degrees». */
  yawMaximoGrados: 30,
  /** Cabeceo vertical, en grados. AWS §3.3.1: «Pitch between -30 to 30 degrees». */
  pitchMaximoGrados: 30,
  /**
   * Inclinación lateral, en grados. **AWS no lo acota**; lo agregamos por el
   * retrato de referencia de ICAO Doc 9303 / ISO/IEC 39794-5 Anexo D1, que
   * exige pose frontal en los tres ejes. Es el eje que más se descontrola
   * cuando alguien fotografía la cédula con el teléfono inclinado.
   */
  rollMaximoGrados: 30,
  /** `FaceDetail.Quality.Sharpness` (0–100). AWS §3.3.1: «Sharpness > 25». */
  nitidezMinima: 25,
  /** `FaceDetail.Quality.Brightness` (0–100). AWS §3.3.1: «Brightness > 25». */
  brilloMinimo: 25,
  /**
   * Lado mínimo del recuadro del rostro, en píxeles. AWS §3.3.1: «Size of the
   * face in an image is > 50x50 pixels». Es un piso muy bajo — sirve para
   * descartar basura, no para garantizar calidad.
   */
  ladoMinimoRostroPx: 50,
} as const;

/**
 * Medición cruda de un rostro, tal como la devuelve un detector facial. Es la
 * entrada de `evaluarCalidadRostro`: el adaptador traduce la respuesta de su
 * proveedor a esta forma y el dominio decide.
 */
export interface MedicionCalidadRostro {
  /** Grados; el signo no importa, se evalúa el valor absoluto. */
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  /** 0–100. */
  readonly nitidez: number;
  /** 0–100. */
  readonly brillo: number;
  readonly anchoRostroPx: number;
  readonly altoRostroPx: number;
  /** `FaceDetail.FaceOccluded`. AWS §3.3.1 exige `false`. */
  readonly rostroOcluido: boolean;
}

/** Cada motivo por el que un rostro puede no alcanzar la calidad mínima. */
export type MotivoCalidadRostro =
  | "POSE_FUERA_DE_RANGO"
  | "IMAGEN_BORROSA"
  | "ILUMINACION_INSUFICIENTE"
  | "ROSTRO_DEMASIADO_CHICO"
  | "ROSTRO_OCLUIDO";

export interface ResultadoCalidadRostro {
  readonly aprobada: boolean;
  /** Vacío si aprobó. Puede traer más de uno: son útiles para guiar al usuario. */
  readonly motivos: readonly MotivoCalidadRostro[];
}

/**
 * Aplica `CALIDAD_ROSTRO` a una medición. Devuelve **todos** los motivos de
 * rechazo, no el primero: si la foto está borrosa y además oscura, decirle a
 * la persona solo "está borrosa" la manda a repetir una captura que va a
 * fallar de nuevo por el otro motivo.
 */
export function evaluarCalidadRostro(medicion: MedicionCalidadRostro): ResultadoCalidadRostro {
  const motivos: MotivoCalidadRostro[] = [];

  const poseFueraDeRango =
    Math.abs(medicion.yaw) > CALIDAD_ROSTRO.yawMaximoGrados ||
    Math.abs(medicion.pitch) > CALIDAD_ROSTRO.pitchMaximoGrados ||
    Math.abs(medicion.roll) > CALIDAD_ROSTRO.rollMaximoGrados;
  if (poseFueraDeRango) motivos.push("POSE_FUERA_DE_RANGO");

  if (medicion.nitidez <= CALIDAD_ROSTRO.nitidezMinima) motivos.push("IMAGEN_BORROSA");
  if (medicion.brillo <= CALIDAD_ROSTRO.brilloMinimo) motivos.push("ILUMINACION_INSUFICIENTE");

  const rostroDemasiadoChico =
    medicion.anchoRostroPx < CALIDAD_ROSTRO.ladoMinimoRostroPx ||
    medicion.altoRostroPx < CALIDAD_ROSTRO.ladoMinimoRostroPx;
  if (rostroDemasiadoChico) motivos.push("ROSTRO_DEMASIADO_CHICO");

  if (medicion.rostroOcluido) motivos.push("ROSTRO_OCLUIDO");

  return { aprobada: motivos.length === 0, motivos };
}

/**
 * Mensajes para la persona, uno por motivo. Van en la pantalla, así que están
 * en voseo y dicen **qué hacer**, no qué falló técnicamente.
 *
 * Nunca menciones el umbral ni la puntuación acá: el número es para la
 * evidencia y para el auditor, no para quien está sacando la foto.
 */
export const MENSAJE_CALIDAD_ROSTRO: Readonly<Record<MotivoCalidadRostro, string>> = {
  POSE_FUERA_DE_RANGO: "Mirá de frente a la cámara, sin inclinar ni girar la cabeza.",
  IMAGEN_BORROSA: "La imagen salió borrosa. Mantené el teléfono firme y repetí la captura.",
  ILUMINACION_INSUFICIENTE: "Buscá un lugar con más luz, sin contraluz ni reflejos.",
  ROSTRO_DEMASIADO_CHICO: "Acercate un poco: tu rostro tiene que ocupar buena parte del recuadro.",
  ROSTRO_OCLUIDO: "Quitate lentes, barbijo o cualquier cosa que tape parte del rostro.",
};

// ---------------------------------------------------------------------------
// Umbrales de decisión
// ---------------------------------------------------------------------------

/**
 * Umbral de coincidencia facial (selfie ↔ foto de la cédula), escala 0–100.
 *
 * **99, no 95.** AWS §6.1 recomienda «95 – for regular use cases / 99 – for
 * sensitive use cases» y este es un caso sensible sin discusión: de esta
 * comparación cuelga la firma electrónica de un contrato de seguro de vida
 * (Ley 6822/21) y la identificación del cliente ante SEPRELAD (fila 14). Un
 * falso acepte acá no es una molestia de UX, es una póliza firmada por otra
 * persona.
 *
 * El precio de 99 es más falsos rechazos, y por eso importa el ajuste de flujo
 * de la sección 6 de `docs/RECOMENDACIONES_ONBOARDING_IDENTIDAD.md`: quien no
 * pasa tiene que tener una salida a revisión manual, no una pared.
 *
 * AWS agrega una condición para este umbral: «For sensitive cases where a
 * threshold or 99 or higher is required, it is recommended to first crop the
 * face using the DetectFaces API». El adaptador tiene que recortar el rostro
 * antes de comparar — ver `RECORTE_ROSTRO_OBLIGATORIO`.
 */
export const UMBRAL_COINCIDENCIA_FACIAL = 99;

/**
 * A 99 la comparación exige rostro recortado (AWS §6.1). No es una sugerencia
 * de rendimiento: comparar la selfie contra la cédula **entera** mete el fondo
 * y el resto del documento en la imagen, y baja la similitud de un par
 * legítimo por debajo del umbral.
 */
export const RECORTE_ROSTRO_OBLIGATORIO = true;

/**
 * Umbral de confianza de la prueba de vida, escala 0–100.
 *
 * 80 es el valor que AWS §6.1 da para empezar en `GetFaceLivenessSessionResults`.
 * La documentación del servicio ubica 50–60 como suficiente contra ataques de
 * presentación (foto impresa, pantalla) y 80–90 como el rango para ataques de
 * inyección digital sofisticados —deepfakes, video pregrabado—, que es la
 * amenaza real de un onboarding 100% remoto sin nadie del otro lado.
 *
 * Vocabulario y método de medición: ISO/IEC 30107-3 (APCER = ataques aceptados,
 * BPCER = genuinos rechazados). Si algún día se certifica el detector, es
 * contra esa norma y con esos dos números.
 */
export const UMBRAL_PRUEBA_DE_VIDA = 80;

// ---------------------------------------------------------------------------
// Decisión auditable
// ---------------------------------------------------------------------------

/**
 * Una decisión biométrica, con todo lo necesario para reproducirla después.
 *
 * Los cuatro campos son obligatorios a propósito. `puntuacion` sola no dice
 * nada (¿94 aprueba?), `umbral` solo tampoco (¿se aplicó?), y sin
 * `versionModeloProveedor` una comparación entre dos expedientes de meses
 * distintos puede estar comparando modelos distintos — AWS §6.2 avisa que las
 * APIs sin estado migran de versión de modelo **solas**, sin que nadie lo pida.
 */
export interface DecisionBiometrica {
  readonly aprobada: boolean;
  /** Puntuación cruda del proveedor, escala 0–100. `null` si no la expuso. */
  readonly puntuacion: number | null;
  /** Umbral efectivamente aplicado para decidir. */
  readonly umbral: number;
  /** Versión del modelo del proveedor (p. ej. `FaceModelVersion` de Rekognition). */
  readonly versionModeloProveedor: string | null;
  /** `VERSION_POLITICA_IDENTIDAD` vigente al momento de decidir. */
  readonly versionPolitica: string;
}

/**
 * Compara una puntuación contra un umbral y arma el registro auditable.
 *
 * Una puntuación ausente (`null`) **nunca aprueba**: si el proveedor no
 * devolvió similitud, no hay evidencia de coincidencia, y ante ausencia de
 * evidencia el criterio es rechazar y derivar, no dejar pasar.
 */
export function decidir(
  puntuacion: number | null,
  umbral: number,
  versionModeloProveedor: string | null,
): DecisionBiometrica {
  return {
    aprobada: puntuacion !== null && puntuacion >= umbral,
    puntuacion,
    umbral,
    versionModeloProveedor,
    versionPolitica: VERSION_POLITICA_IDENTIDAD,
  };
}

/** Decisión de coincidencia facial con el umbral de caso sensible (99). */
export function decidirCoincidenciaFacial(
  similitud: number | null,
  versionModeloProveedor: string | null,
): DecisionBiometrica {
  return decidir(similitud, UMBRAL_COINCIDENCIA_FACIAL, versionModeloProveedor);
}

/** Decisión de prueba de vida con el umbral de inyección digital (80). */
export function decidirPruebaDeVida(
  confianza: number | null,
  versionModeloProveedor: string | null,
): DecisionBiometrica {
  return decidir(confianza, UMBRAL_PRUEBA_DE_VIDA, versionModeloProveedor);
}

/**
 * Texto de una decisión para el campo `detalle` de la evidencia.
 *
 * **No incluye ningún dato personal**: puntuación, umbral y versiones, nada
 * más. Es lo que hace que la evidencia biométrica se pueda leer en la consola
 * administrativa sin exponer al titular.
 */
export function detalleEvidencia(etiqueta: string, decision: DecisionBiometrica): string {
  const puntuacion = decision.puntuacion === null ? "sin-puntuacion" : decision.puntuacion.toFixed(2);
  const modelo = decision.versionModeloProveedor ?? "desconocida";
  return (
    `${etiqueta}=${decision.aprobada ? "APROBADA" : "RECHAZADA"} · ` +
    `puntuacion=${puntuacion} · umbral=${decision.umbral} · ` +
    `modelo=${modelo} · politica=${decision.versionPolitica}`
  );
}

// ---------------------------------------------------------------------------
// Política anti-abuso de la prueba de vida
// ---------------------------------------------------------------------------

/**
 * Límites de reintento de la prueba de vida, de AWS §3.2: «Allow only five
 * failed liveness checks in three minutes from a single device. After five
 * fails, timeout the user for 30–60 minutes. If the pattern is seen 3–5 times
 * repeatedly, block the user device from making additional calls.»
 *
 * Es control de fraude —un atacante prueba deepfakes hasta que uno pase— y
 * también control de costo: cada intento se factura.
 *
 * Ojo con la interacción con la regla inviolable #1: estos límites son de la
 * prueba de vida, **no** de los OTP. Los OTP tienen los suyos (3 intentos,
 * 5 minutos de vigencia, 60 segundos de bloqueo de reenvío) y no se mezclan.
 */
export const ANTIABUSO_PRUEBA_DE_VIDA = {
  intentosFallidosMaximos: 5,
  ventanaMinutos: 3,
  /** AWS da un rango de 30–60; tomamos el piso para no castigar de más a un usuario legítimo. */
  bloqueoMinutos: 30,
  /** Cantidad de bloqueos repetidos tras la cual el dispositivo queda vetado. */
  bloqueosAntesDeVetarDispositivo: 3,
} as const;

/**
 * Vigencia de la sesión de prueba de vida, en segundos.
 *
 * Fijada por el proveedor, no por nosotros: `CreateFaceLivenessSession`
 * devuelve un `SessionId` de **un solo uso** y TTL de 3 minutos (AWS §3.2).
 * Está acá para que la pantalla no arme un temporizador con otro número.
 */
export const VIGENCIA_SESION_PRUEBA_DE_VIDA_SEGUNDOS = 180;

// ---------------------------------------------------------------------------
// OCR de la cédula
// ---------------------------------------------------------------------------

/**
 * Confianza mínima por bloque de texto reconocido, escala 0–100.
 *
 * Amazon Textract devuelve `Confidence` por cada `BLOCK`. No hay un valor
 * recomendado por AWS para documentos de identidad —`AnalyzeID`, que sí trae
 * lógica de documento, **está entrenado sobre documentos de EE.UU.** y no
 * sirve para la cédula paraguaya, así que vamos con `DetectDocumentText`
 * genérico más parseo propio.
 *
 * 90 es decisión de producto, no de norma, y es deliberadamente exigente: los
 * campos que salen de acá quedan **bloqueados y no editables** en P5, y la
 * fecha de nacimiento alimenta el corte de edad 18–64 (regla inviolable #8).
 * Un dígito mal leído en la fecha no lo corrige nadie después. Ante un bloque
 * por debajo del umbral el camino es repetir la captura.
 *
 * Este número es candidato número uno a moverse con el piloto de tres formatos
 * (ítem 9 de la tabla de integraciones): el formato anterior sin MRZ es donde
 * el OCR más va a sufrir.
 */
export const CONFIANZA_MINIMA_OCR = 90;

/**
 * Campos que deben salir del OCR **y además** cruzar contra el MRZ del dorso
 * cuando el formato de cédula lo tiene.
 *
 * El cruce es lo que convierte una lectura en una verificación: el MRZ trae
 * dígitos verificadores (ICAO Doc 9303), así que si el número de cédula y la
 * fecha de nacimiento leídos del frente coinciden con un MRZ cuyos dígitos
 * cierran, la probabilidad de un OCR mal leído o de un frente adulterado cae
 * muchísimo. Ver `src/domain/mrz.ts`.
 */
export const CAMPOS_CRUZADOS_CON_MRZ = ["numeroCedula", "fechaNacimiento", "sexo"] as const;

/**
 * La captura se hace **solo desde la cámara**, nunca por carga de archivo.
 *
 * Es el control de autenticidad más barato y más efectivo que tenemos mientras
 * no haya fuente oficial ni proveedor documental especializado: subir un
 * archivo permite mandar una foto de una foto, un PDF de una cédula ajena o
 * una imagen generada. Está declarado acá, y no solo en el `<input>` de la
 * pantalla, porque es una regla del proceso — si mañana aparece otra pantalla
 * o un endpoint que acepte una imagen de cédula, tiene que respetarlo igual.
 */
export const CAPTURA_SOLO_DESDE_CAMARA = true;

// ---------------------------------------------------------------------------
// Política de DEMOSTRACIÓN — no es la de producción
// ---------------------------------------------------------------------------

/**
 * Versión de la política del camino de demostración con cámara del navegador.
 *
 * Existe separada de `VERSION_POLITICA_IDENTIDAD` justamente para que la
 * evidencia diga **con qué política se aprobó cada expediente**. Un expediente
 * decidido acá queda sellado con `IDP-DEMO-…` y nunca se puede confundir con
 * uno decidido con la política de producción, ni en la consola administrativa
 * ni en una auditoría. Eso es lo que hace aceptable tener dos.
 */
export const VERSION_POLITICA_IDENTIDAD_DEMO = "IDP-DEMO-2026-08-16";

/**
 * Umbral de coincidencia facial del camino de demostración, escala 0–100.
 *
 * **90, no 99, y solo para demostrar.** El 99 de
 * `UMBRAL_COINCIDENCIA_FACIAL` está calibrado para comparar la selfie contra
 * el **retrato digital** de la cédula, que es lo que devuelve un lector de
 * chip o una fuente oficial. Acá el retrato sale de una **fotografía de un
 * plástico** tomada con la cámara de un celular: reflejos del policarbonato,
 * la trama de seguridad impresa encima de la cara, el ángulo y el enfoque
 * bajan la similitud de un par legítimo a un rango típico de 85–97. Con 99, la
 * persona correcta se rechaza a sí misma, y una demostración que rechaza al
 * titular no demuestra nada.
 *
 * 90 sigue siendo alto: AWS §6.1 da 95 para casos regulares y 99 para casos
 * sensibles, así que esto está por debajo de "regular" y **no es apto para
 * producción**. Ese es el punto — está atado a `DEMO_MODE` en el adaptador que
 * lo usa, y la versión de política de arriba lo deja escrito en cada evidencia.
 *
 * No toca `UMBRAL_COINCIDENCIA_FACIAL`: el número de producción sigue en 99 y
 * sus tests siguen verdes. Bajar *ese* seguiría poniendo la suite en rojo a
 * propósito, como dice CLAUDE.md.
 */
export const UMBRAL_COINCIDENCIA_FACIAL_DEMO = 90;

/**
 * Decisión de coincidencia facial bajo la política de demostración.
 *
 * Sella `versionPolitica` con `VERSION_POLITICA_IDENTIDAD_DEMO`, no con la de
 * producción: sin eso, la evidencia diría que se aprobó con un criterio que no
 * es el que se aplicó.
 */
export function decidirCoincidenciaFacialDemo(
  similitud: number | null,
  versionModeloProveedor: string | null,
): DecisionBiometrica {
  return {
    aprobada: similitud !== null && similitud >= UMBRAL_COINCIDENCIA_FACIAL_DEMO,
    puntuacion: similitud,
    umbral: UMBRAL_COINCIDENCIA_FACIAL_DEMO,
    versionModeloProveedor,
    versionPolitica: VERSION_POLITICA_IDENTIDAD_DEMO,
  };
}

/**
 * Decisión de **presencia** — el sustituto de la prueba de vida en el camino
 * de demostración con cámara.
 *
 * Hay que ser explícito con lo que esto es: **no es una prueba de vida**. Una
 * foto sacada con la cámara del navegador no distingue a una persona de una
 * fotografía impresa sostenida frente al lente. Lo único que verifica es que
 * en el cuadro haya **un** rostro humano, único, nítido, iluminado y sin
 * oclusión — o sea, que alguien haya apuntado la cámara a una cara.
 *
 * Se llama presencia y no vida a propósito, y por eso tiene su propia función
 * en vez de reusar `decidirPruebaDeVida`: si esto devolviera una decisión con
 * el umbral 80 de la prueba de vida real, la evidencia afirmaría haber
 * verificado algo que nadie verificó. La prueba de vida de verdad es
 * Rekognition Face Liveness (`INTEGRATION_IDENTITY=live`), y sigue siendo el
 * único camino apto para el piloto y para producción.
 *
 * `calidadAprobada` viene de `evaluarCalidadRostro`, que ya aplica los
 * umbrales de AWS §3.3.1. No hay puntuación cruda que reportar: la decisión es
 * la conjunción de los cinco controles de calidad, no un número.
 */
export function decidirPresenciaDemo(calidadAprobada: boolean): DecisionBiometrica {
  return {
    aprobada: calidadAprobada,
    puntuacion: null,
    // Sin puntuación no hay umbral numérico que aplicar; 0 lo deja explícito
    // en la evidencia en vez de simular que se comparó contra algo.
    umbral: 0,
    versionModeloProveedor: null,
    versionPolitica: VERSION_POLITICA_IDENTIDAD_DEMO,
  };
}
