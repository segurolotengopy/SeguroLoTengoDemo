/**
 * Capacidades de verificación biométrica sobre Amazon Rekognition: calidad de
 * rostro, prueba de vida y comparación facial 1:1.
 *
 * **Esto no es todavía un `IdentityProvider`.** Son las tres capacidades por
 * separado, y es a propósito, por dos razones:
 *
 * 1. **Reutilización.** El puerto `IdentityProvider` tiene la forma que
 *    necesita P5 de SeguroLoTengo (cédula paraguaya, cinco requisitos, un
 *    expediente). Estas funciones no saben nada de eso: reciben bytes y
 *    devuelven `DecisionBiometrica`. Sirven igual en otro producto que
 *    necesite onboarding con prueba de vida.
 * 2. **El puerto no encaja con Face Liveness tal como es.** `IdentityProvider`
 *    declara `capturarSelfieYPruebaDeVida(expedienteId, video: MediaCapturada)`,
 *    es decir, bytes de video llegando al backend. Face Liveness no funciona
 *    así: el video se transmite desde el navegador directo a Rekognition por
 *    el componente de Amplify, y el backend **nunca ve los bytes** — recibe un
 *    `sessionId` y consulta el resultado. Adaptar el puerto es trabajo de la
 *    sesión de P5; mientras tanto, la capacidad real está acá y es honesta.
 *
 * Todos los umbrales salen de `src/domain/identidad-parametros.ts`. Este
 * archivo no decide nada: traduce respuestas de AWS al vocabulario del
 * dominio y deja que el dominio aplique la política.
 */
import {
  CompareFacesCommand,
  CreateFaceLivenessSessionCommand,
  DetectFacesCommand,
  GetFaceLivenessSessionResultsCommand,
} from "@aws-sdk/client-rekognition";
import type {
  BoundingBox,
  CompareFacesCommandOutput,
  CreateFaceLivenessSessionCommandOutput,
  DetectFacesCommandOutput,
  GetFaceLivenessSessionResultsCommandOutput,
} from "@aws-sdk/client-rekognition";
import {
  RECORTE_ROSTRO_OBLIGATORIO,
  UMBRAL_COINCIDENCIA_FACIAL,
  decidirCoincidenciaFacial,
  decidirPruebaDeVida,
  evaluarCalidadRostro,
} from "../../domain/identidad-parametros";
import type {
  DecisionBiometrica,
  MedicionCalidadRostro,
  ResultadoCalidadRostro,
} from "../../domain/identidad-parametros";

/**
 * Lo mínimo que necesitamos de un cliente de Rekognition.
 *
 * Se declara estructuralmente en vez de usar `RekognitionClient` para que los
 * tests puedan pasar un doble sin instanciar el SDK ni tocar credenciales. El
 * cliente real satisface esta forma.
 */
export interface ClienteRekognition {
  send(comando: DetectFacesCommand): Promise<DetectFacesCommandOutput>;
  send(comando: CompareFacesCommand): Promise<CompareFacesCommandOutput>;
  send(comando: CreateFaceLivenessSessionCommand): Promise<CreateFaceLivenessSessionCommandOutput>;
  send(
    comando: GetFaceLivenessSessionResultsCommand,
  ): Promise<GetFaceLivenessSessionResultsCommandOutput>;
}

// ---------------------------------------------------------------------------
// Calidad de rostro (DetectFaces)
// ---------------------------------------------------------------------------

export type MotivoSinRostro = "SIN_ROSTRO" | "MAS_DE_UN_ROSTRO";

export type ResultadoDeteccionRostro =
  | {
      readonly ok: true;
      readonly calidad: ResultadoCalidadRostro;
      readonly medicion: MedicionCalidadRostro;
      /** Recuadro del rostro, para recortarlo antes de comparar. */
      readonly recuadro: BoundingBox;
    }
  | { readonly ok: false; readonly motivo: MotivoSinRostro };

/**
 * Detecta el rostro de una imagen y lo mide contra los umbrales de calidad.
 *
 * **Más de un rostro se rechaza, no se elige el más grande.** En una selfie de
 * onboarding, una segunda cara es una anomalía —alguien sosteniendo una foto,
 * una pantalla de fondo— y elegir "la más grande" es exactamente lo que un
 * atacante querría que hiciéramos.
 *
 * `alto` y `ancho` son los de la imagen completa en píxeles: Rekognition
 * devuelve el recuadro en proporción (0–1), y el umbral de tamaño mínimo está
 * en píxeles, así que sin las dimensiones reales no se puede evaluar.
 */
export async function detectarYMedirRostro(
  cliente: ClienteRekognition,
  imagen: Uint8Array,
  dimensiones: { readonly ancho: number; readonly alto: number },
): Promise<ResultadoDeteccionRostro> {
  const respuesta = await cliente.send(
    new DetectFacesCommand({ Image: { Bytes: imagen }, Attributes: ["ALL"] }),
  );

  const rostros = respuesta.FaceDetails ?? [];
  if (rostros.length === 0) return { ok: false, motivo: "SIN_ROSTRO" };
  if (rostros.length > 1) return { ok: false, motivo: "MAS_DE_UN_ROSTRO" };

  const rostro = rostros[0];
  const recuadro = rostro.BoundingBox ?? {};

  const medicion: MedicionCalidadRostro = {
    yaw: rostro.Pose?.Yaw ?? 0,
    pitch: rostro.Pose?.Pitch ?? 0,
    roll: rostro.Pose?.Roll ?? 0,
    nitidez: rostro.Quality?.Sharpness ?? 0,
    brillo: rostro.Quality?.Brightness ?? 0,
    anchoRostroPx: Math.round((recuadro.Width ?? 0) * dimensiones.ancho),
    altoRostroPx: Math.round((recuadro.Height ?? 0) * dimensiones.alto),
    // `FaceOccluded` puede no venir; ausente se trata como **ocluido**, que es
    // el lado seguro: sin el dato no se puede afirmar que el rostro esté libre.
    rostroOcluido: rostro.FaceOccluded?.Value ?? true,
  };

  return { ok: true, calidad: evaluarCalidadRostro(medicion), medicion, recuadro };
}

// ---------------------------------------------------------------------------
// Comparación facial 1:1 (CompareFaces)
// ---------------------------------------------------------------------------

/**
 * Compara la selfie contra el retrato de la cédula y devuelve la decisión
 * auditable.
 *
 * `SimilarityThreshold` va en el comando además del umbral del dominio: sin
 * él, Rekognition filtra por su default (80) y **no devuelve** los pares por
 * debajo, con lo que un 85 legítimo llegaría como "sin coincidencias" y se
 * perdería la puntuación cruda que la evidencia necesita. Se manda un piso
 * bajo para recibir siempre el número, y quien decide es el dominio.
 */
export async function compararRostros(
  cliente: ClienteRekognition,
  selfie: Uint8Array,
  retratoCedula: Uint8Array,
): Promise<DecisionBiometrica> {
  const respuesta = await cliente.send(
    new CompareFacesCommand({
      SourceImage: { Bytes: selfie },
      TargetImage: { Bytes: retratoCedula },
      // Piso deliberadamente bajo: queremos la puntuación cruda para la
      // evidencia, no que el servicio decida por nosotros.
      SimilarityThreshold: 0,
      QualityFilter: "NONE",
    }),
  );

  const similitudes = (respuesta.FaceMatches ?? [])
    .map((par) => par.Similarity)
    .filter((valor): valor is number => typeof valor === "number");

  // Sin coincidencias no hay puntuación: `decidir` rechaza ante `null`.
  const mejor = similitudes.length > 0 ? Math.max(...similitudes) : null;

  // `CompareFacesResponse` **no trae `FaceModelVersion`** — solo lo devuelven
  // las APIs con colección (`IndexFaces`, `SearchFaces`), que este flujo no
  // usa a propósito para no persistir vectores faciales en AWS.
  //
  // Es una limitación real del proveedor, no un pendiente: la evidencia queda
  // con `versionModeloProveedor: null` y AWS §6.2 avisa que las APIs sin
  // estado migran de versión de modelo solas. Consecuencia práctica: dos
  // expedientes de meses distintos pueden haberse decidido con modelos
  // distintos sin que quede registro. Lo que sí queda sellado es el umbral y
  // la versión de nuestra política, que es lo que está bajo nuestro control.
  return decidirCoincidenciaFacial(mejor, null);
}

/**
 * Recorta el rostro de una imagen a partir del recuadro de Rekognition.
 *
 * Existe porque `UMBRAL_COINCIDENCIA_FACIAL` es 99 y AWS condiciona ese umbral
 * a comparar rostros recortados. Devuelve el rectángulo en píxeles; el recorte
 * de bytes lo hace quien tenga el decodificador de imagen —el navegador, con
 * un canvas— porque hacerlo en el servidor obligaría a sumar una librería de
 * imágenes para algo que el cliente ya sabe hacer.
 *
 * El margen del 10 % no es capricho: recortar exacto al recuadro corta frente
 * y mentón, y a Rekognition le va mejor con algo de contexto alrededor.
 */
export function rectanguloDeRecorte(
  recuadro: BoundingBox,
  dimensiones: { readonly ancho: number; readonly alto: number },
  margen = 0.1,
): { readonly x: number; readonly y: number; readonly ancho: number; readonly alto: number } {
  const anchoBase = (recuadro.Width ?? 0) * dimensiones.ancho;
  const altoBase = (recuadro.Height ?? 0) * dimensiones.alto;
  const holguraX = anchoBase * margen;
  const holguraY = altoBase * margen;

  const x = Math.max(0, Math.round((recuadro.Left ?? 0) * dimensiones.ancho - holguraX));
  const y = Math.max(0, Math.round((recuadro.Top ?? 0) * dimensiones.alto - holguraY));

  return {
    x,
    y,
    ancho: Math.min(dimensiones.ancho - x, Math.round(anchoBase + holguraX * 2)),
    alto: Math.min(dimensiones.alto - y, Math.round(altoBase + holguraY * 2)),
  };
}

// ---------------------------------------------------------------------------
// Prueba de vida (Face Liveness)
// ---------------------------------------------------------------------------

/**
 * Tipo de desafío de la sesión de prueba de vida.
 *
 * - `FaceMovementAndLightChallenge` — el original, con destellos de luz. Es el
 *   de **máxima precisión** y el camino principal.
 * - `FaceMovementChallenge` — sin destellos, 3 segundos más rápido. Se ofrece
 *   como **alternativa explícita para personas fotosensibles**, que es un
 *   punto que AWS pide cubrir y que con un solo desafío quedaba sin resolver.
 *
 * Disponible desde julio de 2025. La elección es de accesibilidad y de
 * producto: no hay fila en la matriz de cumplimiento que la gobierne.
 */
export type TipoDesafioPruebaDeVida = "FaceMovementAndLightChallenge" | "FaceMovementChallenge";

export const DESAFIO_PRUEBA_DE_VIDA_POR_DEFECTO: TipoDesafioPruebaDeVida =
  "FaceMovementAndLightChallenge";

export interface SesionPruebaDeVida {
  readonly sessionId: string;
}

/**
 * Crea una sesión de prueba de vida. El `sessionId` es de **un solo uso** y
 * vive 3 minutos (`VIGENCIA_SESION_PRUEBA_DE_VIDA_SEGUNDOS`).
 *
 * `AuditImagesLimit: 1` pide la imagen de auditoría de la sesión: es la que
 * después se compara contra la cédula, y usarla —en vez de una selfie
 * cualquiera— es lo que ata la prueba de vida a la comparación facial. Sin
 * eso, alguien podría pasar la prueba de vida con su cara y mandar otra foto
 * a comparar.
 */
export async function crearSesionPruebaDeVida(
  cliente: ClienteRekognition,
  opciones: { readonly desafio?: TipoDesafioPruebaDeVida } = {},
): Promise<SesionPruebaDeVida> {
  const desafio = opciones.desafio ?? DESAFIO_PRUEBA_DE_VIDA_POR_DEFECTO;

  const respuesta = await cliente.send(
    new CreateFaceLivenessSessionCommand({
      Settings: {
        AuditImagesLimit: 1,
        ChallengePreferences: [{ Type: desafio }],
      },
    }),
  );

  const sessionId = respuesta.SessionId;
  if (!sessionId) throw new Error("Rekognition no devolvió SessionId para la prueba de vida");
  return { sessionId };
}

export interface ResultadoPruebaDeVida {
  readonly decision: DecisionBiometrica;
  /**
   * Imagen de referencia de la sesión (la que hay que comparar contra la
   * cédula). `null` si la sesión no llegó a producirla.
   */
  readonly imagenReferencia: Uint8Array | null;
  /**
   * Desafío que la sesión usó realmente. Va a la evidencia: no es lo mismo
   * haber aprobado con destellos que sin ellos, y si mañana se compara la
   * tasa de aprobación entre los dos, este es el dato que lo permite.
   */
  readonly desafioUsado: string | null;
}

/**
 * Consulta el resultado de una sesión de prueba de vida y arma la decisión
 * auditable con el umbral del dominio.
 *
 * Devuelve además la imagen de referencia para encadenar con `compararRostros`.
 *
 * **Solo una sesión `SUCCEEDED` puede aprobar.** Una sesión `EXPIRED`,
 * `FAILED` o todavía `IN_PROGRESS` puede traer un `Confidence` que, tomado
 * suelto, superaría el umbral; aprobar con eso sería aprobar una prueba de
 * vida que nunca terminó.
 */
export async function obtenerResultadoPruebaDeVida(
  cliente: ClienteRekognition,
  sessionId: string,
): Promise<ResultadoPruebaDeVida> {
  const respuesta = await cliente.send(
    new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }),
  );

  const sesionCompleta = respuesta.Status === "SUCCEEDED";
  const confianza =
    sesionCompleta && typeof respuesta.Confidence === "number" ? respuesta.Confidence : null;
  const bytes = respuesta.ReferenceImage?.Bytes ?? null;

  return {
    // Face Liveness tampoco expone versión de modelo; ver el comentario de
    // `compararRostros`.
    decision: decidirPruebaDeVida(confianza, null),
    imagenReferencia: bytes ? new Uint8Array(bytes) : null,
    desafioUsado: respuesta.Challenge?.Type ?? null,
  };
}

/**
 * Comprobación de coherencia entre la política y este adaptador.
 *
 * Si alguien baja `UMBRAL_COINCIDENCIA_FACIAL` por debajo de 99, el recorte
 * previo deja de ser exigible y este módulo puede simplificarse. Al revés —
 * umbral 99 con recorte apagado— es un error silencioso que rechazaría pares
 * legítimos, así que se deja anotado dónde mirar.
 */
export const RECORTE_EXIGIDO_POR_LA_POLITICA =
  RECORTE_ROSTRO_OBLIGATORIO && UMBRAL_COINCIDENCIA_FACIAL >= 99;
