/**
 * Medición de calidad de una toma **en el navegador**, antes de mandarla.
 *
 * ## Qué es y, sobre todo, qué no es
 *
 * Esto **no decide nada**. Quien aprueba o rechaza una captura sigue siendo el
 * proveedor a través de `IdentityProvider`, con los umbrales de
 * `identidad-parametros.ts` y su registro de `DecisionBiometrica`. Lo de acá
 * solo sirve para dos cosas de ergonomía:
 *
 * 1. decirle a la persona qué corregir *mientras* encuadra ("hay poca luz",
 *    "movete un poco, está borrosa"), en vez de hacerla esperar un viaje al
 *    servidor para enterarse; y
 * 2. apretar el obturador sola cuando el cuadro se ve bien, que es lo que hace
 *    cualquier aplicación de onboarding decente.
 *
 * Por eso vive en un módulo aparte y no dentro de `identidad-parametros.ts`:
 * aquellos parámetros deciden y quedan sellados en la evidencia con su versión
 * de política; estos asisten y no se registran en ningún lado. Mezclarlos haría
 * que un auditor leyera "calidad aprobada" sin saber cuál de los dos criterios
 * la aprobó.
 *
 * **Ninguna medición de este módulo puede bloquear a la persona.** El botón de
 * disparo manual está siempre habilitado apenas hay imagen: si el cuadro nunca
 * llega a estar "apto" —una cámara mala, una habitación oscura, una cédula muy
 * gastada—, la persona dispara igual y decide el servidor. Un asistente que se
 * convierte en portero es un callejón sin salida, que es exactamente lo que la
 * salida a `ASISTENCIA_IDENTIDAD` existe para evitar.
 *
 * ## Sin respaldo normativo, y sin proveedor
 *
 * No hay fila en `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` que exija
 * medir calidad en el cliente: es una decisión de producto/UX. Tampoco hay
 * proveedor externo — son treinta líneas de aritmética sobre los píxeles que el
 * navegador ya tiene, así que no entra en el catálogo de integraciones.
 *
 * ## Cómo están calibrados los números
 *
 * Todo se mide sobre una muestra en escala de grises reescalada a un ancho
 * fijo (`LADO_MUESTRA_PX`), no sobre el cuadro original: la varianza del
 * laplaciano depende de la resolución, y sin normalizar el mismo umbral sería
 * severo en una cámara de 720p y laxo en una de 4K. Los valores son empíricos
 * —no salen de ninguna norma— y están puestos del lado permisivo a propósito:
 * el costo de un disparo automático de más es un reintento, y el de uno de
 * menos es una persona esperando frente a una cámara que nunca se decide.
 */

/** Las dos tomas se juzgan distinto: el documento exige más foco que un rostro. */
export type TipoTomaCalidad = "DOCUMENTO" | "SELFIE";

/**
 * Muestra en escala de grises: un valor de luminancia 0–255 por píxel, en
 * orden de filas. Sin dependencia del DOM a propósito, para poder probar el
 * cálculo con imágenes sintéticas.
 */
export interface MuestraGris {
  readonly datos: ArrayLike<number>;
  readonly ancho: number;
  readonly alto: number;
}

export interface MetricasCaptura {
  /** Varianza del laplaciano: proxy de foco. Más alto, más nítido. */
  readonly nitidez: number;
  /** Luminancia media 0–255. */
  readonly luminancia: number;
  /** Fracción 0–1 de píxeles quemados; en una cédula plastificada, reflejo. */
  readonly reflejo: number;
}

/** Ancho al que se normaliza la muestra antes de medir. */
export const LADO_MUESTRA_PX = 256;

/** A partir de acá un píxel se considera quemado. */
export const NIVEL_SATURACION = 248;

/**
 * Varianza mínima del laplaciano para considerar la toma enfocada.
 *
 * El documento pide más porque lo que hay que leer es texto chico —el MRZ del
 * dorso es lo más exigente de las tres tomas— y una foto apenas movida lo
 * vuelve ilegible. Un rostro tolera bastante más desenfoque sin que la
 * comparación facial se resienta.
 */
export const NITIDEZ_MINIMA: Readonly<Record<TipoTomaCalidad, number>> = {
  DOCUMENTO: 90,
  SELFIE: 45,
};

/** Franja de exposición aceptable de la luminancia media. */
export const LUMINANCIA_MINIMA = 55;
export const LUMINANCIA_MAXIMA = 210;

/**
 * Reflejo tolerado, como fracción de píxeles quemados.
 *
 * Solo se le aplica al documento: el plástico de la cédula devuelve el brillo
 * de una lámpara justo encima del MRZ o de la fotografía. En una selfie, una
 * ventana de fondo quema píxeles sin que eso estorbe al rostro.
 */
export const REFLEJO_MAXIMO_DOCUMENTO = 0.05;

/**
 * Cuántos píxeles de sensor tiene que abarcar el marco guía para que la toma
 * valga la pena.
 *
 * El caso que motiva el número: una cédula de 85,6 mm de ancho sobre 900 px da
 * ~10,5 px/mm, y los caracteres OCR-B del MRZ miden unos 3 mm — apenas 31 px de
 * alto, el piso de lo que Textract lee con comodidad. Por debajo de eso no hay
 * encuadre que salve la toma: hay que acercar la cámara o girar el teléfono
 * para que el documento ocupe el lado largo.
 */
export const ANCHO_FUENTE_MINIMO_PX: Readonly<Record<TipoTomaCalidad, number>> = {
  DOCUMENTO: 900,
  SELFIE: 420,
};

/** Cada cuánto se mide el cuadro en vivo. */
export const INTERVALO_MEDICION_MS = 140;

/** Cuadros buenos consecutivos antes de armar el disparo automático. */
export const CUADROS_ESTABLES_PARA_DISPARO = 6;

/**
 * Pausa entre "el cuadro está bien" y el disparo, para que la persona alcance
 * a leer el aviso y quedarse quieta. Sin esta pausa el disparo automático se
 * siente como un accidente.
 */
export const RETARDO_DISPARO_MS = 600;

/**
 * Después de un "Repetir", el disparo automático espera antes de volver a
 * armarse: si no, dispararía de nuevo sobre el mismo encuadre que la persona
 * acaba de descartar.
 */
export const RETARDO_REARME_MS = 1600;

export type MotivoNoApta = "OSCURA" | "QUEMADA" | "REFLEJO" | "MOVIDA";

export interface VeredictoCaptura {
  /** `true` si el disparo automático puede armarse. Nunca habilita ni bloquea el manual. */
  readonly apta: boolean;
  readonly motivo: MotivoNoApta | null;
  /** Qué mostrarle a la persona, siempre en términos de qué hacer. */
  readonly consejo: string;
}

export const CONSEJO_APTA = "Se ve bien. Quedate quieto un segundo.";

/**
 * Un consejo por motivo, y siempre accionable: qué hacer, no qué pasó. Es la
 * misma regla que el resto de los mensajes del flujo.
 */
export const CONSEJO_POR_MOTIVO: Readonly<Record<MotivoNoApta, string>> = {
  OSCURA: "Falta luz. Buscá un lugar más iluminado o prendé una luz.",
  QUEMADA: "Hay demasiada luz de frente. Alejate de la ventana o de la lámpara.",
  REFLEJO: "El plástico está reflejando. Inclinalo un poco o corrélo de la luz.",
  MOVIDA: "Se ve borrosa. Apoyá los codos y esperá a que enfoque.",
};

/** Consejo fijo cuando el marco abarca muy pocos píxeles de sensor. */
export const CONSEJO_RESOLUCION_INSUFICIENTE =
  "Girá el teléfono o acercá la cámara: así la cédula entra más grande y se lee mejor.";

/**
 * Varianza del laplaciano de 4 vecinos sobre el interior de la muestra.
 *
 * El laplaciano responde a los bordes; una imagen enfocada tiene muchos bordes
 * marcados y por lo tanto una varianza alta, y una movida los tiene lavados.
 * Es el método clásico de detección de desenfoque y no necesita nada más que
 * una pasada por los píxeles.
 */
function varianzaLaplaciano({ datos, ancho, alto }: MuestraGris): number {
  if (ancho < 3 || alto < 3) return 0;

  let suma = 0;
  let sumaCuadrados = 0;
  let cuenta = 0;

  for (let y = 1; y < alto - 1; y += 1) {
    for (let x = 1; x < ancho - 1; x += 1) {
      const centro = y * ancho + x;
      const laplaciano =
        4 * datos[centro] -
        datos[centro - 1] -
        datos[centro + 1] -
        datos[centro - ancho] -
        datos[centro + ancho];
      suma += laplaciano;
      sumaCuadrados += laplaciano * laplaciano;
      cuenta += 1;
    }
  }

  if (cuenta === 0) return 0;
  const media = suma / cuenta;
  return sumaCuadrados / cuenta - media * media;
}

export function medirCaptura(muestra: MuestraGris): MetricasCaptura {
  const total = muestra.ancho * muestra.alto;
  if (total === 0) return { nitidez: 0, luminancia: 0, reflejo: 0 };

  let suma = 0;
  let quemados = 0;
  for (let i = 0; i < total; i += 1) {
    const valor = muestra.datos[i];
    suma += valor;
    if (valor >= NIVEL_SATURACION) quemados += 1;
  }

  return {
    nitidez: varianzaLaplaciano(muestra),
    luminancia: suma / total,
    reflejo: quemados / total,
  };
}

/**
 * Un solo motivo por cuadro, el que conviene corregir primero.
 *
 * El orden importa: con poca luz la nitidez se desploma sola, así que decir
 * "está borrosa" cuando el problema es la oscuridad manda a la persona a
 * corregir lo que no es. Exposición primero, reflejo después, foco al final.
 */
export function evaluarCaptura(
  metricas: MetricasCaptura,
  tipo: TipoTomaCalidad,
): VeredictoCaptura {
  const noApta = (motivo: MotivoNoApta): VeredictoCaptura => ({
    apta: false,
    motivo,
    consejo: CONSEJO_POR_MOTIVO[motivo],
  });

  if (metricas.luminancia < LUMINANCIA_MINIMA) return noApta("OSCURA");
  if (metricas.luminancia > LUMINANCIA_MAXIMA) return noApta("QUEMADA");
  if (tipo === "DOCUMENTO" && metricas.reflejo > REFLEJO_MAXIMO_DOCUMENTO) {
    return noApta("REFLEJO");
  }
  if (metricas.nitidez < NITIDEZ_MINIMA[tipo]) return noApta("MOVIDA");

  return { apta: true, motivo: null, consejo: CONSEJO_APTA };
}

/**
 * Si el marco guía abarca suficientes píxeles del sensor.
 *
 * Es una propiedad de la geometría —tamaño del marco contra resolución de la
 * cámara—, no del cuadro: no cambia entre fotogramas, así que se consulta una
 * vez al abrir y se muestra como aviso fijo, no como consejo intermitente.
 */
export function resolucionSuficiente(anchoFuentePx: number, tipo: TipoTomaCalidad): boolean {
  return anchoFuentePx >= ANCHO_FUENTE_MINIMO_PX[tipo];
}
