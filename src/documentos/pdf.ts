/**
 * Generador mínimo de PDF, sin dependencias.
 *
 * Escribe PDF 1.7 con las dos fuentes estándar que todo lector trae
 * incorporadas (Helvetica y Helvetica-Bold), texto en WinAnsiEncoding,
 * rectángulos, líneas y la grilla de un código QR. Es exactamente lo que los
 * documentos de `docs/Solicitud.pdf` y `docs/FIPF.pdf` necesitan: son
 * formularios de una carilla, tipografía de palo seco, cajas y filetes.
 *
 * Por qué acá y no una librería: CLAUDE.md pide justificar cualquier librería
 * pesada antes de agregarla, y las de PDF lo son (las de uso corriente rondan
 * los 300 kB a 1 MB por las fuentes embebidas y el soporte de imágenes, y
 * varias emiten metadatos no deterministas). Este módulo hace lo poco que hace
 * falta en menos de 400 líneas y, sobre todo, **es determinista**, que es un
 * requisito y no una preferencia: ver abajo.
 *
 * ## Determinismo (regla de negocio inviolable #4)
 *
 * El mismo contenido y la misma fecha de cierre producen siempre los mismos
 * bytes, y por lo tanto el mismo SHA-256. No hay `/ID` aleatorio, ni
 * `/CreationDate` tomado del reloj, ni compresión con diccionario dependiente
 * del entorno: la fecha del documento entra como dato (`creadoEn`), igual que
 * el resto. Sin esto, "el hash del PDF cerrado" no sería una propiedad del
 * documento sino del momento en que se lo generó, y regenerar el mismo
 * expediente daría una huella distinta sin que nada haya cambiado.
 *
 * ## Coordenadas
 *
 * La API expone el origen **arriba a la izquierda**, con `y` creciendo hacia
 * abajo, que es como se describe un formulario. La inversión al sistema de
 * PDF (origen abajo a la izquierda) ocurre puertas adentro.
 */
import { anchoDeTexto, bytesWinAnsi, escaparTextoPdf, partirEnLineas } from "./tipografia";
import type { Fuente } from "./tipografia";
import type { MatrizQr } from "./qr";

export type { Fuente } from "./tipografia";
export { anchoDeTexto, partirEnLineas } from "./tipografia";

/** Componentes RGB en el rango 0–1, como los usa PDF. */
export type Color = readonly [number, number, number];

export const NEGRO: Color = [0, 0, 0];
export const BLANCO: Color = [1, 1, 1];

export type Alineacion = "izquierda" | "centro" | "derecha";

export interface EstiloTexto {
  readonly fuente?: Fuente;
  readonly tamano?: number;
  readonly color?: Color;
  readonly alineacion?: Alineacion;
  /** Ancho de la caja, necesario para centrar o alinear a la derecha. */
  readonly ancho?: number;
}

export interface EstiloCaja {
  readonly relleno?: Color;
  readonly borde?: Color;
  readonly grosor?: number;
}

export interface EstiloLinea {
  readonly color?: Color;
  readonly grosor?: number;
}

export interface Pagina {
  /** Escribe una línea de texto. `y` es la línea base, medida desde arriba. */
  texto(x: number, y: number, contenido: string, estilo?: EstiloTexto): void;
  /**
   * Escribe un texto ajustado a `ancho`, cortando por palabras. Devuelve la
   * altura ocupada, para que el llamador siga apilando debajo.
   */
  parrafo(x: number, y: number, ancho: number, contenido: string, estilo?: EstiloTexto & { readonly interlineado?: number }): number;
  rectangulo(x: number, y: number, ancho: number, alto: number, estilo?: EstiloCaja): void;
  linea(x1: number, y1: number, x2: number, y2: number, estilo?: EstiloLinea): void;
  /** Dibuja la matriz de un QR con su zona de silencio, ocupando `lado` puntos en total. */
  qr(x: number, y: number, lado: number, matriz: MatrizQr): void;
}

export interface OpcionesDocumento {
  readonly titulo: string;
  readonly autor: string;
  /** Fecha de cierre del documento (ISO 8601). Entra al PDF; nunca se lee el reloj. */
  readonly creadoEn: string;
  readonly ancho?: number;
  readonly alto?: number;
}

export interface DocumentoPdf {
  nuevaPagina(): Pagina;
  construir(): Uint8Array;
}

/** A4 en puntos PostScript (210 × 297 mm). */
export const ANCHO_A4 = 595.28;
export const ALTO_A4 = 841.89;

// ---------------------------------------------------------------------------
// Construcción de la página
// ---------------------------------------------------------------------------

const NOMBRE_FUENTE: Readonly<Record<Fuente, string>> = {
  regular: "F1",
  negrita: "F2",
};

function redondear(valor: number): string {
  // Tres decimales alcanzan de sobra para la resolución de un PDF y evitan
  // que la representación binaria de un flotante se cuele en los bytes (y,
  // con ella, en el hash).
  return (Math.round(valor * 1000) / 1000).toString();
}

function operadorColor(color: Color, relleno: boolean): string {
  const op = relleno ? "rg" : "RG";
  return `${redondear(color[0])} ${redondear(color[1])} ${redondear(color[2])} ${op}`;
}

function crearPagina(alto: number): { pagina: Pagina; contenido: () => string } {
  const ops: string[] = [];
  /** Convierte `y` desde arriba (API) a `y` desde abajo (PDF). */
  const invertirY = (y: number): number => alto - y;

  const pagina: Pagina = {
    texto(x, y, contenido, estilo = {}) {
      if (contenido === "") return;
      const fuente = estilo.fuente ?? "regular";
      const tamano = estilo.tamano ?? 9;
      const color = estilo.color ?? NEGRO;

      let inicio = x;
      if (estilo.alineacion && estilo.alineacion !== "izquierda" && estilo.ancho !== undefined) {
        const sobrante = estilo.ancho - anchoDeTexto(contenido, fuente, tamano);
        inicio = estilo.alineacion === "centro" ? x + sobrante / 2 : x + sobrante;
      }

      ops.push(
        "BT",
        operadorColor(color, true),
        `/${NOMBRE_FUENTE[fuente]} ${redondear(tamano)} Tf`,
        `1 0 0 1 ${redondear(inicio)} ${redondear(invertirY(y))} Tm`,
        `(${escaparTextoPdf(contenido)}) Tj`,
        "ET",
      );
    },

    parrafo(x, y, ancho, contenido, estilo = {}) {
      const fuente = estilo.fuente ?? "regular";
      const tamano = estilo.tamano ?? 9;
      const interlineado = estilo.interlineado ?? tamano * 1.35;
      const lineas = partirEnLineas(contenido, fuente, tamano, ancho);

      lineas.forEach((linea, indice) => {
        pagina.texto(x, y + indice * interlineado, linea, { ...estilo, ancho });
      });

      return lineas.length * interlineado;
    },

    rectangulo(x, y, ancho, alto: number, estilo = {}) {
      const grosor = estilo.grosor ?? 0.6;
      const partes: string[] = [];
      if (estilo.relleno) partes.push(operadorColor(estilo.relleno, true));
      if (estilo.borde) {
        partes.push(operadorColor(estilo.borde, false), `${redondear(grosor)} w`);
      }
      partes.push(`${redondear(x)} ${redondear(invertirY(y + alto))} ${redondear(ancho)} ${redondear(alto)} re`);
      if (estilo.relleno && estilo.borde) partes.push("B");
      else if (estilo.relleno) partes.push("f");
      else if (estilo.borde) partes.push("S");
      else return;
      ops.push(...partes);
    },

    linea(x1, y1, x2, y2, estilo = {}) {
      ops.push(
        operadorColor(estilo.color ?? NEGRO, false),
        `${redondear(estilo.grosor ?? 0.6)} w`,
        `${redondear(x1)} ${redondear(invertirY(y1))} m`,
        `${redondear(x2)} ${redondear(invertirY(y2))} l`,
        "S",
      );
    },

    qr(x, y, lado, matriz) {
      // 4 módulos de zona de silencio a cada lado, como pide la norma: sin
      // ella muchos lectores no enganchan el símbolo.
      const SILENCIO = 4;
      const modulosTotales = matriz.tamano + SILENCIO * 2;
      const paso = lado / modulosTotales;

      pagina.rectangulo(x, y, lado, lado, { relleno: BLANCO });
      ops.push(operadorColor(NEGRO, true));

      for (let fila = 0; fila < matriz.tamano; fila++) {
        let inicio = -1;
        for (let columna = 0; columna <= matriz.tamano; columna++) {
          const oscuro = columna < matriz.tamano && matriz.modulos[fila][columna];
          if (oscuro && inicio === -1) inicio = columna;
          if (!oscuro && inicio !== -1) {
            // Se dibuja la corrida horizontal completa como un solo
            // rectángulo: menos operadores, mismo dibujo.
            const px = x + (SILENCIO + inicio) * paso;
            const py = y + (SILENCIO + fila) * paso;
            ops.push(
              `${redondear(px)} ${redondear(invertirY(py + paso))} ${redondear((columna - inicio) * paso)} ${redondear(paso)} re`,
            );
            inicio = -1;
          }
        }
      }
      ops.push("f");
    },
  };

  return { pagina, contenido: () => ops.join("\n") };
}

// ---------------------------------------------------------------------------
// Ensamblado del archivo
// ---------------------------------------------------------------------------

/** `2026-08-09T15:00:00.000Z` → `D:20260809150000Z`, el formato de fecha de PDF. */
function fechaPdf(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    throw new Error(`Fecha de creación inválida para el PDF: "${iso}".`);
  }
  const dosDigitos = (valor: number): string => String(valor).padStart(2, "0");
  return (
    `D:${fecha.getUTCFullYear()}${dosDigitos(fecha.getUTCMonth() + 1)}${dosDigitos(fecha.getUTCDate())}` +
    `${dosDigitos(fecha.getUTCHours())}${dosDigitos(fecha.getUTCMinutes())}${dosDigitos(fecha.getUTCSeconds())}Z`
  );
}

export function crearDocumentoPdf(opciones: OpcionesDocumento): DocumentoPdf {
  const ancho = opciones.ancho ?? ANCHO_A4;
  const alto = opciones.alto ?? ALTO_A4;
  const paginas: { pagina: Pagina; contenido: () => string }[] = [];

  return {
    nuevaPagina(): Pagina {
      const nueva = crearPagina(alto);
      paginas.push(nueva);
      return nueva.pagina;
    },

    construir(): Uint8Array {
      if (paginas.length === 0) throw new Error("El documento no tiene ninguna página.");

      // Numeración: 1 catálogo, 2 árbol de páginas, 3 y 4 las fuentes, 5 la
      // información del documento, y de ahí en adelante un par
      // (contenido, página) por cada carilla.
      const PRIMER_OBJETO_DE_PAGINA = 6;
      const idPagina = (indice: number): number => PRIMER_OBJETO_DE_PAGINA + indice * 2;
      const idContenido = (indice: number): number => PRIMER_OBJETO_DE_PAGINA + indice * 2 + 1;

      const cuerpos: string[] = [];
      const agregar = (numero: number, cuerpo: string): void => {
        cuerpos[numero - 1] = cuerpo;
      };

      const hijos = paginas.map((_, indice) => `${idPagina(indice)} 0 R`).join(" ");

      agregar(1, "<< /Type /Catalog /Pages 2 0 R >>");
      agregar(2, `<< /Type /Pages /Kids [${hijos}] /Count ${paginas.length} >>`);
      agregar(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
      agregar(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
      agregar(
        5,
        `<< /Title (${escaparTextoPdf(opciones.titulo)}) /Author (${escaparTextoPdf(opciones.autor)}) ` +
          `/Producer (SeguroLoTengo) /CreationDate (${fechaPdf(opciones.creadoEn)}) ` +
          `/ModDate (${fechaPdf(opciones.creadoEn)}) >>`,
      );

      paginas.forEach((entrada, indice) => {
        const contenido = entrada.contenido();
        agregar(
          idPagina(indice),
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${redondear(ancho)} ${redondear(alto)}] ` +
            `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idContenido(indice)} 0 R >>`,
        );
        agregar(
          idContenido(indice),
          `<< /Length ${bytesWinAnsi(contenido).length} >>\nstream\n${contenido}\nendstream`,
        );
      });

      let archivo = "%PDF-1.7\n";
      // Comentario binario que marca el archivo como no-ASCII, según la
      // recomendación de la especificación para que los transportes no lo
      // traten como texto.
      archivo += "%âãÏÓ\n";

      const posiciones: number[] = [];
      cuerpos.forEach((cuerpo, indice) => {
        posiciones[indice] = bytesWinAnsi(archivo).length;
        archivo += `${indice + 1} 0 obj\n${cuerpo}\nendobj\n`;
      });

      const inicioXref = bytesWinAnsi(archivo).length;
      const total = cuerpos.length + 1;
      archivo += `xref\n0 ${total}\n0000000000 65535 f \n`;
      for (const posicion of posiciones) {
        archivo += `${String(posicion).padStart(10, "0")} 00000 n \n`;
      }
      archivo += `trailer\n<< /Size ${total} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

      return bytesWinAnsi(archivo);
    },
  };
}
