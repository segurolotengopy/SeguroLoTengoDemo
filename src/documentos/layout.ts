/**
 * Piezas de maquetación compartidas por la Solicitud y el FIPF.
 *
 * Los dos documentos son el mismo formulario institucional con distinto
 * contenido: misma cabecera de aseguradora/intermediario, misma caja de
 * código con su QR de verificación, mismas secciones numeradas, misma grilla
 * de campos con etiqueta arriba y valor encuadrado, y el mismo bloque de
 * firmas. Igual que los componentes de `src/components/shared` para las
 * pantallas: se define una vez y no se redefine por documento.
 *
 * La referencia visual son `docs/Solicitud.pdf` y `docs/FIPF.pdf`. Lo que se
 * reproduce es la **estructura y el contenido** de esos formularios —bloques,
 * orden, etiquetas—, no su diseño gráfico al píxel: el PDF que firma el
 * cliente tiene que decir lo mismo, no parecerse.
 */
import { ALTO_A4, ANCHO_A4, anchoDeTexto, partirEnLineas } from "./pdf";
import type { Color, DocumentoPdf, Fuente, Pagina, SegmentoCamino } from "./pdf";
import { generarMatrizQr } from "./qr";
import type { EncabezadoDocumento, CampoDocumento } from "../domain/documentos";

// ---------------------------------------------------------------------------
// Paleta y métricas
// ---------------------------------------------------------------------------

/*
 * Paleta de marca de los documentos, alineada con la de las pantallas
 * (src/app/globals.css) y con docs/GUIA_DE_ESTILOS.md: naranja primario del
 * sitio interseguros360.com, azul institucional de Alianza Garantía y los
 * colores exactos de los dos isologos.
 */
export const NARANJA: Color = [0.741, 0.333, 0.059]; // #bd550f — primario Interseguros
export const AZUL: Color = [0.169, 0.353, 0.62]; // #2b5a9e — azul Alianza
export const TINTA: Color = [0.2, 0.2, 0.2]; // #333333 — texto principal
export const ETIQUETA: Color = [0.42, 0.42, 0.42]; // #6b6b6b — rótulos
export const BORDE: Color = [0.878, 0.878, 0.878]; // #e0e0e0 — bordes del sitio
export const FONDO_SUAVE: Color = [0.957, 0.949, 0.937]; // #f4f2ef
export const FONDO_ELEGIDO: Color = [0.992, 0.957, 0.925]; // #fdf4ec — naranja-50
export const VERDE: Color = [0.263, 0.396, 0.098]; // #436519 — verde Alianza para texto
export const FONDO_VERDE: Color = [0.965, 0.98, 0.925]; // #f6faec
export const ROJO: Color = [0.71, 0.11, 0.11];
export const FONDO_ROJO: Color = [0.996, 0.945, 0.945];
export const BLANCO_PURO: Color = [1, 1, 1];

/* Colores exclusivos de los isologos (no se usan para texto). */
export const NARANJA_ISOLOGO: Color = [0.886, 0.4, 0.059]; // #e2660f
export const VERDE_ISOLOGO: Color = [0.553, 0.776, 0.247]; // #8dc63f

export const MARGEN = 34;
export const ANCHO_UTIL = ANCHO_A4 - MARGEN * 2;
/** Última línea base utilizable antes de saltar de página. */
export const LIMITE_INFERIOR = ALTO_A4 - MARGEN - 26;

export const ENTIDAD_ASEGURADORA = "Alianza Garantía Seguros y Reaseguros S.A.";
export const ENTIDAD_INTERMEDIARIO = "Interseguros S.A. - Corredores de Seguros";
export const LEYENDA_DOCUMENTO_ELECTRONICO = "Documento electrónico del proceso SeguroLoTengo.com";

// ---------------------------------------------------------------------------
// Lienzo con salto de página
// ---------------------------------------------------------------------------

export interface Lienzo {
  readonly pagina: Pagina;
  /** Cursor vertical, medido desde el borde superior de la hoja. */
  y: number;
  readonly numeroPagina: number;
  /** Salta de página si `alto` no entra en lo que queda de la actual. */
  asegurarEspacio(alto: number): void;
  /**
   * Abre una carilla nueva sí o sí. Lo usa el documento único (D-11) para
   * empezar la sección del FIPF en hoja propia: son dos formularios con
   * códigos internos distintos dentro del mismo archivo, y arrancar uno a
   * mitad de la carilla del otro los haría ver como un mismo bloque.
   */
  saltarPagina(): void;
}

export function crearLienzo(
  documento: DocumentoPdf,
  dibujarEncabezado: (pagina: Pagina, numeroPagina: number) => number,
): Lienzo {
  let numeroPagina = 0;
  let pagina = documento.nuevaPagina();
  let y = 0;

  const abrirPagina = (): void => {
    numeroPagina += 1;
    y = dibujarEncabezado(pagina, numeroPagina);
  };
  abrirPagina();

  return {
    get pagina() {
      return pagina;
    },
    get y() {
      return y;
    },
    set y(valor: number) {
      y = valor;
    },
    get numeroPagina() {
      return numeroPagina;
    },
    asegurarEspacio(alto: number) {
      if (y + alto > LIMITE_INFERIOR) {
        pagina = documento.nuevaPagina();
        abrirPagina();
      }
    },
    saltarPagina() {
      pagina = documento.nuevaPagina();
      abrirPagina();
    },
  };
}

// ---------------------------------------------------------------------------
// Isologos
// ---------------------------------------------------------------------------

/*
 * Los isologos se dibujan como vectores del propio PDF —la misma geometría de
 * los SVG de `public/marca/`, en un lienzo de diseño de 100×100— y no como
 * imágenes embebidas: el generador no incrusta mapas de bits, y un camino
 * vectorial produce siempre los mismos operadores, así que el determinismo
 * (regla inviolable #4) queda intacto.
 */

/** Traslada y escala un camino diseñado en el lienzo 100×100. */
function escalarCamino(
  segmentos: readonly SegmentoCamino[],
  x: number,
  y: number,
  lado: number,
): SegmentoCamino[] {
  const esc = lado / 100;
  return segmentos.map((segmento): SegmentoCamino => {
    if (segmento[0] === "z") return segmento;
    if (segmento[0] === "c") {
      return [
        "c",
        x + segmento[1] * esc,
        y + segmento[2] * esc,
        x + segmento[3] * esc,
        y + segmento[4] * esc,
        x + segmento[5] * esc,
        y + segmento[6] * esc,
      ];
    }
    return [segmento[0], x + segmento[1] * esc, y + segmento[2] * esc];
  });
}

/* Cápsula del isologo de Interseguros (versión 2026-08-12): esquinas de
   radio 15 salvo la inferior derecha, de radio 42 (Bézier con κ = 0,5523). */
const CAPSULA_INTERSEGUROS: readonly SegmentoCamino[] = [
  ["m", 19, 4],
  ["l", 81, 4],
  ["c", 89.28, 4, 96, 10.72, 96, 19],
  ["l", 96, 54],
  ["c", 96, 77.2, 77.2, 96, 54, 96],
  ["l", 19, 96],
  ["c", 10.72, 96, 4, 89.28, 4, 81],
  ["l", 4, 19],
  ["c", 4, 10.72, 10.72, 4, 19, 4],
  ["z"],
];

/* Barra central calada: rectángulo redondeado de 20×60 con radio 6. En el
   documento (fondo blanco) el calado se materializa pintándola de blanco. */
const BARRA_INTERSEGUROS: readonly SegmentoCamino[] = [
  ["m", 46, 20],
  ["l", 54, 20],
  ["c", 57.31, 20, 60, 22.69, 60, 26],
  ["l", 60, 74],
  ["c", 60, 77.31, 57.31, 80, 54, 80],
  ["l", 46, 80],
  ["c", 42.69, 80, 40, 77.31, 40, 74],
  ["l", 40, 26],
  ["c", 40, 22.69, 42.69, 20, 46, 20],
  ["z"],
];

/** Isologo de Interseguros: cápsula naranja con la "I" calada. */
export function dibujarIsologoInterseguros(pagina: Pagina, x: number, y: number, lado: number): void {
  pagina.camino(escalarCamino(CAPSULA_INTERSEGUROS, x, y, lado), { relleno: NARANJA_ISOLOGO });
  pagina.camino(escalarCamino(BARRA_INTERSEGUROS, x, y, lado), { relleno: BLANCO_PURO });
}

/** Isologo de Alianza Garantía: chevrón azul con triángulo verde. */
export function dibujarIsologoAlianza(pagina: Pagina, x: number, y: number, lado: number): void {
  const esc = lado / 100;
  pagina.camino(
    escalarCamino(
      [
        ["m", 12, 82],
        ["l", 50, 18],
        ["l", 88, 82],
      ],
      x,
      y,
      lado,
    ),
    { borde: AZUL, grosor: 17 * esc, redondeado: true },
  );
  pagina.camino(
    escalarCamino(
      [
        ["m", 50, 48],
        ["l", 30, 83],
        ["l", 70, 83],
        ["z"],
      ],
      x,
      y,
      lado,
    ),
    { relleno: VERDE_ISOLOGO, borde: VERDE_ISOLOGO, grosor: 7 * esc, redondeado: true },
  );
}

// ---------------------------------------------------------------------------
// Cabecera
// ---------------------------------------------------------------------------

/** Ancho de la caja de código y lado del QR de verificación, en puntos. */
const ANCHO_CAJA_CODIGO = 124;
const LADO_QR = 56;

/**
 * Cabecera institucional: aseguradora, intermediario, caja de código con el
 * documento vinculado y la paginación, y el QR de verificación.
 *
 * Devuelve la coordenada `y` donde el cuerpo puede empezar a escribir.
 */
export function dibujarEncabezado(
  pagina: Pagina,
  encabezado: EncabezadoDocumento,
  numeroPagina: number,
  totalPaginas: number,
): number {
  // Sin QR, la caja de código se corre hasta el borde: el hueco reservado para
  // el QR sería un vacío inexplicable en un documento que no se verifica.
  const conQr = encabezado.urlVerificacion !== null;
  const derechaCaja = MARGEN + ANCHO_UTIL - (conQr ? LADO_QR + 6 : 0);
  const izquierdaCaja = derechaCaja - ANCHO_CAJA_CODIGO;

  // Isologos institucionales a la izquierda de cada entidad (ver
  // docs/GUIA_DE_ESTILOS.md: los documentos hacia el cliente llevan las dos
  // marcas, igual que la cabecera de las pantallas).
  const ISOLOGO = 16;
  dibujarIsologoAlianza(pagina, MARGEN, 35, ISOLOGO);
  dibujarIsologoInterseguros(pagina, MARGEN, 61, ISOLOGO);
  const X_ENTIDAD = MARGEN + ISOLOGO + 6;

  pagina.texto(X_ENTIDAD, 40, "ASEGURADORA", { fuente: "negrita", tamano: 6.5, color: ETIQUETA });
  pagina.texto(X_ENTIDAD, 51, ENTIDAD_ASEGURADORA, { fuente: "negrita", tamano: 8.5, color: AZUL });
  pagina.texto(X_ENTIDAD, 66, "INTERMEDIARIO", { fuente: "negrita", tamano: 6.5, color: ETIQUETA });
  pagina.texto(X_ENTIDAD, 77, ENTIDAD_INTERMEDIARIO, { fuente: "negrita", tamano: 8.5, color: AZUL });

  // Caja de código: el vínculo entre los dos documentos del mismo acto de
  // firma queda impreso en los dos (fila 47 de la matriz de cumplimiento).
  pagina.rectangulo(izquierdaCaja, 30, ANCHO_CAJA_CODIGO, 62, { borde: BORDE, relleno: FONDO_SUAVE });
  pagina.texto(izquierdaCaja + 8, 41, "CÓDIGO", { tamano: 6, color: ETIQUETA, fuente: "negrita" });
  pagina.texto(izquierdaCaja + 8, 53, encabezado.codigo, { fuente: "negrita", tamano: 10.5, color: TINTA });
  pagina.texto(izquierdaCaja + 8, 65, "VINCULADO", { tamano: 6, color: ETIQUETA, fuente: "negrita" });
  pagina.texto(izquierdaCaja + 8, 75, encabezado.codigoVinculado, { fuente: "negrita", tamano: 8.5, color: AZUL });
  pagina.texto(izquierdaCaja + 8, 87, `VERSIÓN ${encabezado.version} · PÁGINA ${numeroPagina} DE ${totalPaginas}`, {
    tamano: 5.8,
    color: ETIQUETA,
  });

  // QR de verificación: solo la URL con el código del documento.
  if (encabezado.urlVerificacion !== null) {
    pagina.rectangulo(derechaCaja + 6, 30, LADO_QR, LADO_QR, { borde: BORDE });
    pagina.qr(derechaCaja + 6, 30, LADO_QR, generarMatrizQr(encabezado.urlVerificacion));
    pagina.texto(derechaCaja + 6, 95, "VERIFICACIÓN", {
      tamano: 5.5,
      color: ETIQUETA,
      alineacion: "centro",
      ancho: LADO_QR,
    });
  }

  pagina.texto(MARGEN, 116, encabezado.titulo.toUpperCase(), {
    fuente: "negrita",
    tamano: 15,
    color: TINTA,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  pagina.texto(MARGEN, 129, LEYENDA_DOCUMENTO_ELECTRONICO, {
    fuente: "negrita",
    tamano: 7.5,
    color: AZUL,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });

  pagina.linea(MARGEN, 136, MARGEN + ANCHO_UTIL, 136, { color: TINTA, grosor: 1.2 });
  return 152;
}

// ---------------------------------------------------------------------------
// Secciones y campos
// ---------------------------------------------------------------------------

/**
 * Encabezado de sección: número en un cuadro naranja, título y filete.
 *
 * `altoDelPrimerBloque` es lo que hay que reservar **además** del encabezado:
 * sin eso, un título puede quedar solo al pie de una carilla y su contenido
 * arrancar en la siguiente. En un documento que se firma, un bloque cuyo
 * título quedó en otra página es una ambigüedad evitable.
 */
export function seccion(lienzo: Lienzo, numero: number, titulo: string, altoDelPrimerBloque = 40): void {
  lienzo.asegurarEspacio(30 + altoDelPrimerBloque);
  const y = lienzo.y;
  lienzo.pagina.rectangulo(MARGEN, y - 8, 13, 13, { relleno: NARANJA });
  lienzo.pagina.texto(MARGEN, y + 1.5, String(numero), {
    fuente: "negrita",
    tamano: 8.5,
    color: BLANCO_PURO,
    alineacion: "centro",
    ancho: 13,
  });
  lienzo.pagina.texto(MARGEN + 19, y + 1.5, titulo.toUpperCase(), {
    fuente: "negrita",
    tamano: 10,
    color: NARANJA,
  });
  lienzo.pagina.linea(MARGEN, y + 9, MARGEN + ANCHO_UTIL, y + 9, { color: NARANJA, grosor: 0.8 });
  lienzo.y = y + 22;
}

export const ALTO_CAMPO = 30;

/**
 * Grilla de campos con etiqueta arriba y valor dentro de una caja, en
 * `columnas` columnas. Es la forma en que los dos formularios presentan todos
 * sus datos.
 */
export function grillaDeCampos(lienzo: Lienzo, campos: readonly CampoDocumento[], columnas: number): void {
  const separacion = 8;

  for (let indice = 0; indice < campos.length; indice += columnas) {
    lienzo.asegurarEspacio(ALTO_CAMPO);
    const fila = campos.slice(indice, indice + columnas);
    const y = lienzo.y;
    // La última fila puede venir incompleta: sus campos se reparten el ancho
    // entero en vez de dejar un hueco. Es lo que evita que un valor largo
    // —"Empresa / ingreso mensual", por ejemplo— quede recortado al lado de
    // media carilla en blanco.
    const ancho = (ANCHO_UTIL - separacion * (fila.length - 1)) / fila.length;

    fila.forEach((campo, posicion) => {
      const x = MARGEN + posicion * (ancho + separacion);
      lienzo.pagina.texto(x, y, campo.etiqueta.toUpperCase(), {
        fuente: "negrita",
        tamano: 5.8,
        color: ETIQUETA,
      });
      lienzo.pagina.rectangulo(x, y + 4, ancho, 16, { borde: BORDE, relleno: BLANCO_PURO });
      lienzo.pagina.texto(x + 5, y + 15, recortarAlAncho(campo.valor, ancho - 10), {
        fuente: "negrita",
        tamano: 8,
        color: AZUL,
      });
    });

    lienzo.y = y + ALTO_CAMPO;
  }
}

/**
 * Recorta con puntos suspensivos un valor que no entra en su caja. Preferimos
 * recortar antes que desbordar: un valor que se sale de la caja y se pisa con
 * el de al lado hace ilegible un documento que después se firma.
 */
export function recortarAlAncho(valor: string, ancho: number, tamano = 8, fuente: Fuente = "negrita"): string {
  if (anchoDeTexto(valor, fuente, tamano) <= ancho) return valor;
  let recortado = valor;
  while (recortado.length > 1 && anchoDeTexto(`${recortado}…`, fuente, tamano) > ancho) {
    recortado = recortado.slice(0, -1);
  }
  return `${recortado}…`;
}

/**
 * Casilla marcada de 9×9. El tilde se dibuja con dos trazos y no con un
 * carácter: Helvetica no tiene glifo de tilde, y embeber una segunda fuente
 * solo para eso sería agrandar el archivo para dibujar dos rayas.
 */
export function casillaMarcada(pagina: Pagina, x: number, y: number): void {
  const lado = 9;
  pagina.rectangulo(x, y, lado, lado, { borde: AZUL, relleno: BLANCO_PURO, grosor: 0.7 });
  pagina.linea(x + 1.9, y + 4.7, x + 3.6, y + 6.7, { color: AZUL, grosor: 1.1 });
  pagina.linea(x + 3.6, y + 6.7, x + 7.1, y + 2.2, { color: AZUL, grosor: 1.1 });
}

/** Lista de declaraciones con su casilla marcada a la izquierda. */
export function listaDeCasillas(lienzo: Lienzo, textos: readonly string[]): void {
  const anchoTexto = ANCHO_UTIL - 22;

  textos.forEach((texto, indice) => {
    const lineas = partirEnLineas(`${indice + 1}. ${texto}`, "regular", 7.8, anchoTexto);
    const alto = lineas.length * 10 + 6;
    lienzo.asegurarEspacio(alto);
    const y = lienzo.y;

    casillaMarcada(lienzo.pagina, MARGEN, y - 7);
    lienzo.pagina.parrafo(MARGEN + 22, y, anchoTexto, lineas.join(" "), {
      tamano: 7.8,
      color: TINTA,
      interlineado: 10,
    });

    lienzo.y = y + alto;
  });
}

/** Franja de aviso, en verde (informativa) o rojo (bloqueante). */
export function franja(lienzo: Lienzo, texto: string, tono: "verde" | "rojo" | "neutro"): void {
  const relleno = tono === "verde" ? FONDO_VERDE : tono === "rojo" ? FONDO_ROJO : FONDO_SUAVE;
  const color = tono === "verde" ? VERDE : tono === "rojo" ? ROJO : ETIQUETA;
  const lineas = partirEnLineas(texto, "negrita", 7.5, ANCHO_UTIL - 16);
  const alto = lineas.length * 10 + 10;

  lienzo.asegurarEspacio(alto + 6);
  const y = lienzo.y;
  lienzo.pagina.rectangulo(MARGEN, y - 8, ANCHO_UTIL, alto, { relleno, borde: color, grosor: 0.5 });
  lienzo.pagina.parrafo(MARGEN + 8, y + 1, ANCHO_UTIL - 16, lineas.join(" "), {
    fuente: "negrita",
    tamano: 7.5,
    color,
    interlineado: 10,
  });
  lienzo.y = y + alto + 6;
}

/**
 * Bloque de firmas: una caja por firmante con su descripción y la línea de
 * firma. El orden es el del acto de Code100 —cliente primero— y se imprime
 * igual en los dos documentos, porque es el mismo acto.
 */
export function bloqueDeFirmas(lienzo: Lienzo, firmantes: readonly CampoDocumento[]): void {
  const separacion = 8;
  const ancho = (ANCHO_UTIL - separacion * (firmantes.length - 1)) / firmantes.length;
  const alto = 70;

  lienzo.asegurarEspacio(alto + 6);
  const y = lienzo.y;

  firmantes.forEach((firmante, posicion) => {
    const x = MARGEN + posicion * (ancho + separacion);
    const esCliente = posicion === 0;
    lienzo.pagina.rectangulo(x, y - 8, ancho, alto, {
      borde: esCliente ? NARANJA : AZUL,
      relleno: BLANCO_PURO,
      grosor: 0.8,
    });
    lienzo.pagina.texto(x + 8, y + 4, firmante.etiqueta.toUpperCase(), {
      fuente: "negrita",
      tamano: 7.5,
      color: esCliente ? NARANJA : AZUL,
    });
    lienzo.pagina.parrafo(x + 8, y + 18, ancho - 16, firmante.valor, {
      tamano: 6.6,
      color: TINTA,
      interlineado: 8.4,
    });
    lienzo.pagina.linea(x + 8, y + 52, x + ancho - 8, y + 52, { color: TINTA, grosor: 0.6 });
    lienzo.pagina.texto(x + 8, y + 60, "Firma y aclaración", {
      tamano: 6,
      color: ETIQUETA,
      alineacion: "centro",
      ancho: ancho - 16,
    });
  });

  lienzo.y = y + alto + 6;
}

/**
 * Pie de página con las huellas digitales del paquete.
 *
 * El hash del propio documento **no** se imprime acá: el archivo se hashea
 * después de cerrarse, así que un PDF no puede contener su propia huella. Lo
 * que se imprime es lo que sí es estable —el correlativo, la versión y la
 * fecha de cierre— más el aviso de que las huellas quedan registradas.
 */
export function pie(lienzo: Lienzo, encabezado: EncabezadoDocumento): void {
  lienzo.asegurarEspacio(28);
  const y = lienzo.y;
  lienzo.pagina.linea(MARGEN, y - 6, MARGEN + ANCHO_UTIL, y - 6, { color: BORDE, grosor: 0.5 });
  lienzo.pagina.texto(
    MARGEN,
    y + 5,
    `${encabezado.codigo} · vinculado a ${encabezado.codigoVinculado} · versión ${encabezado.version} · cerrado el ${encabezado.cerradoEn}`,
    { tamano: 6, color: ETIQUETA },
  );
  lienzo.pagina.texto(
    MARGEN,
    y + 14,
    encabezado.urlVerificacion === null
      ? "Documento generado por SeguroLoTengo.com · Constancia de la operación; su respaldo probatorio son el certificado y la Solicitud firmada."
      : `Documento generado por SeguroLoTengo.com · PDF cerrado, huella digital SHA-256 registrada · Verificación: ${encabezado.urlVerificacion}`,
    { tamano: 6, color: ETIQUETA },
  );
  lienzo.y = y + 24;
}
