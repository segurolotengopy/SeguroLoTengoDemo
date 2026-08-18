/**
 * De lo que la persona ve a lo que se recorta.
 *
 * ## El problema que resuelve
 *
 * El visor dibuja un marco guía sobre un `<video>` que se ajusta al contenedor
 * con `object-fit`. Ese ajuste **descarta o agrega borde**: con `cover`, parte
 * del cuadro de la cámara queda fuera de la pantalla; con `contain`, sobra
 * fondo alrededor. Calcular el recorte como una fracción del cuadro fuente —
 * "el 88 % del ancho del video"— da un resultado que no tiene nada que ver con
 * el rectángulo que la persona encuadró.
 *
 * Cuánto se despega no es un detalle. Contenedor vertical de 375×500 con una
 * cámara de 1920×1080 y `cover`: el marco de 330 px de pantalla equivale a 713
 * px de sensor, mientras que "el 88 % del ancho" recorta 1690. La foto que se
 * manda no es la que se vio, y la cédula termina ocupando una fracción del
 * cuadro — justo lo que arruina el OCR del MRZ.
 *
 * Por eso el recorte se calcula **midiendo las dos cajas reales** (la del
 * elemento de video y la del marco, tal como el navegador las posicionó) y
 * proyectando la segunda sobre los píxeles del sensor. Si mañana cambia el CSS
 * del marco, el recorte lo sigue solo.
 *
 * Supone `object-position: center`, que es el valor por omisión y el que usa el
 * visor. Con cualquier otro habría que pasar el desplazamiento.
 */

/** Rectángulo en coordenadas de pantalla, como los devuelve `getBoundingClientRect`. */
export interface Caja {
  readonly izquierda: number;
  readonly arriba: number;
  readonly ancho: number;
  readonly alto: number;
}

/** Región en píxeles del cuadro de la cámara, lista para `drawImage`. */
export interface Recorte {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

export type ModoAjuste = "cover" | "contain";

function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo);
}

/**
 * Proyecta el marco guía sobre los píxeles del cuadro de la cámara.
 *
 * `espejo` es para la selfie: la vista previa se muestra invertida porque mirar
 * una imagen no espejada de uno mismo es desconcertante, pero lo que se manda a
 * comparar tiene que ser la imagen tal cual la ve la cámara. Con un marco
 * centrado el reflejo no cambia nada; con uno desplazado, sí — y la corrección
 * está acá para que no dependa de que el marco siga estando centrado.
 *
 * Devuelve un recorte vacío (ancho o alto en 0) si todavía no hay cuadro o si
 * las cajas no se solapan; quien llama tiene que tratarlo como "no hay nada que
 * capturar" en vez de dibujar un lienzo en blanco.
 */
export function mapearGuiaAFuente(
  cajaVideo: Caja,
  cajaGuia: Caja,
  fuenteAncho: number,
  fuenteAlto: number,
  modo: ModoAjuste,
  espejo = false,
): Recorte {
  const vacio: Recorte = { x: 0, y: 0, ancho: 0, alto: 0 };
  if (fuenteAncho <= 0 || fuenteAlto <= 0) return vacio;
  if (cajaVideo.ancho <= 0 || cajaVideo.alto <= 0) return vacio;

  const escalaX = cajaVideo.ancho / fuenteAncho;
  const escalaY = cajaVideo.alto / fuenteAlto;
  const escala = modo === "cover" ? Math.max(escalaX, escalaY) : Math.min(escalaX, escalaY);
  if (!Number.isFinite(escala) || escala <= 0) return vacio;

  // Dónde quedó, en pantalla, el cuadro completo de la cámara una vez ajustado.
  // Con `cover` es más grande que el contenedor y se sale por dos lados; con
  // `contain` es más chico y deja franjas.
  const mostradoAncho = fuenteAncho * escala;
  const mostradoAlto = fuenteAlto * escala;
  const origenX = cajaVideo.izquierda + (cajaVideo.ancho - mostradoAncho) / 2;
  const origenY = cajaVideo.arriba + (cajaVideo.alto - mostradoAlto) / 2;

  const x = acotar((cajaGuia.izquierda - origenX) / escala, 0, fuenteAncho);
  const y = acotar((cajaGuia.arriba - origenY) / escala, 0, fuenteAlto);
  const ancho = acotar(cajaGuia.ancho / escala, 0, fuenteAncho - x);
  const alto = acotar(cajaGuia.alto / escala, 0, fuenteAlto - y);

  return { x: espejo ? fuenteAncho - x - ancho : x, y, ancho, alto };
}

/**
 * Tamaño del recuadro que contiene el cuadro entero de la cámara, ajustado
 * dentro del área disponible sin deformarlo (`contain`).
 *
 * Se calcula en píxeles y se aplica a **los dos** lados. Dejar que lo haga el
 * CSS con `width: 100%` + `max-height` + `aspect-ratio` no funciona: cuando el
 * alto es el que limita, el navegador recorta el alto y **deja el ancho como
 * estaba**, así que el recuadro queda más ancho que la imagen y el marco guía
 * se sale de ella. Está medido en el visor: con un área de 1185 × 456 el marco
 * salía 1090 × 687 en vez de 420 × 265.
 */
export function ajustarContenido(
  areaAncho: number,
  areaAlto: number,
  fuenteAncho: number,
  fuenteAlto: number,
): { readonly ancho: number; readonly alto: number } {
  if (areaAncho <= 0 || areaAlto <= 0 || fuenteAncho <= 0 || fuenteAlto <= 0) {
    return { ancho: 0, alto: 0 };
  }
  const escala = Math.min(areaAncho / fuenteAncho, areaAlto / fuenteAlto);
  return { ancho: fuenteAncho * escala, alto: fuenteAlto * escala };
}

/**
 * Qué fracción del ancho del recuadro ocupa el marco guía.
 *
 * El marco tiene su propia proporción (1,586 el documento por el formato ID-1;
 * 1 la selfie, que es un círculo) y el recuadro tiene la del cuadro de la
 * cámara. Cuando el marco es *más apaisado* que el recuadro, el ancho manda y
 * ocupa lo pedido; cuando es más cuadrado, quien limita es el alto y hay que
 * achicar el ancho en la misma proporción.
 *
 * Se calcula acá, y no con un `max-height` en el CSS, porque esa propiedad
 * recorta el alto sin tocar el ancho: deforma el marco en vez de achicarlo, y
 * un marco deformado produce un recorte deformado.
 */
export function anchoRelativoDelMarco(
  ocupacion: number,
  proporcionMarco: number,
  proporcionRecuadro: number,
): number {
  if (proporcionRecuadro <= 0) return ocupacion;
  return Math.min(ocupacion, (ocupacion * proporcionMarco) / proporcionRecuadro);
}
