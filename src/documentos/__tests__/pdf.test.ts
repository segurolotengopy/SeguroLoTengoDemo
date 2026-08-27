/**
 * Tests del generador de PDF y de la maquetación de los dos documentos.
 *
 * El test que más importa acá es el de **determinismo**. La regla de negocio
 * inviolable #4 dice que el PDF se cierra y se hashea; para que ese hash sea
 * una propiedad del documento y no del momento en que se lo generó, los mismos
 * datos tienen que producir siempre los mismos bytes. Un `/CreationDate` sacado
 * del reloj o un `/ID` aleatorio —lo que hacen varias librerías de PDF— rompe
 * esa propiedad sin que nadie se entere hasta que una auditoría no puede
 * reproducir la huella.
 *
 * Lo demás verifica que el archivo sea un PDF de verdad y no un montón de
 * bytes que abre por casualidad: tabla `xref` con los desplazamientos
 * correctos, tráiler, y el texto legible con sus acentos.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { armarContenidoPaquete } from "../../domain/documentos";
import type { ContenidoPaquete } from "../../domain/documentos";
import {
  TOKEN_PAQUETE_FIXTURE,
  expedienteEnPaqueteGenerado,
} from "../../domain/__tests__/fixtures";
import { ANCHO_A4, anchoDeTexto, crearDocumentoPdf, partirEnLineas } from "../pdf";
import { renderizarPaquete } from "../plantillas";
import { bytesWinAnsi, escaparTextoPdf } from "../tipografia";

const CERRADO_EN = "2026-08-09T15:05:00.000Z";

function contenido(cerradoEn = CERRADO_EN): ContenidoPaquete {
  const resultado = armarContenidoPaquete(expedienteEnPaqueteGenerado(), {
    cerradoEn,
    tokenVerificacion: TOKEN_PAQUETE_FIXTURE,
  });
  if (!resultado.ok) throw new Error(`faltantes: ${resultado.faltantes.join(",")}`);
  return resultado.contenido;
}

const comoTexto = (bytes: Uint8Array): string => Buffer.from(bytes).toString("latin1");
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

// ---------------------------------------------------------------------------
// Determinismo
// ---------------------------------------------------------------------------

describe("determinismo (regla inviolable #4)", () => {
  it("el mismo contenido y la misma fecha de cierre producen los mismos bytes", () => {
    const primera = renderizarPaquete(contenido());
    const segunda = renderizarPaquete(contenido());

    expect(sha256(segunda)).toBe(sha256(primera));
    expect(Buffer.from(segunda).equals(Buffer.from(primera))).toBe(true);
  });

  it("cambiar la fecha de cierre cambia la huella: es un documento distinto", () => {
    const original = renderizarPaquete(contenido());
    const otroDia = renderizarPaquete(contenido("2026-08-10T09:00:00.000Z"));

    expect(sha256(otroDia)).not.toBe(sha256(original));
  });

  it("la Solicitud y el FIPF viajan en el mismo archivo, con una sola huella (D-11)", () => {
    // Antes este test verificaba que los dos documentos nunca compartieran
    // huella. Con el PDF unificado la afirmación se invirtió: hay un archivo,
    // y adentro tienen que estar los códigos de las dos secciones.
    const paquete = contenido();
    const texto = comoTexto(renderizarPaquete(paquete));

    expect(texto).toContain(paquete.encabezado.codigo);
    expect(texto).toContain(paquete.fipf.codigoSeccion);
  });

  it("no filtra el reloj del sistema en los metadatos", () => {
    const texto = comoTexto(renderizarPaquete(contenido()));
    // La única fecha del archivo es la de cierre, en formato PDF.
    expect(texto).toContain("/CreationDate (D:20260809150500Z)");
    expect(texto).toContain("/ModDate (D:20260809150500Z)");
    expect(texto).not.toContain("/ID");
  });
});

// ---------------------------------------------------------------------------
// Estructura del archivo
// ---------------------------------------------------------------------------

describe("estructura del PDF", () => {
  const bytes = renderizarPaquete(contenido());
  const texto = comoTexto(bytes);

  it("abre con la cabecera y cierra con el tráiler", () => {
    expect(texto.startsWith("%PDF-1.7\n")).toBe(true);
    expect(texto.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(texto).toContain("/Type /Catalog");
    expect(texto).toContain("/Type /Pages");
    expect(texto).toContain("/Type /Page ");
  });

  it("la tabla xref apunta al comienzo real de cada objeto", () => {
    const inicioXref = Number(/startxref\n(\d+)/.exec(texto)?.[1]);
    expect(Number.isFinite(inicioXref)).toBe(true);
    expect(texto.slice(inicioXref, inicioXref + 4)).toBe("xref");

    const tabla = /xref\n0 (\d+)\n([\s\S]*?)trailer/.exec(texto);
    if (!tabla) throw new Error("no se encontró la tabla xref");
    const total = Number(tabla[1]);
    const entradas = tabla[2].trimEnd().split("\n");
    expect(entradas).toHaveLength(total);

    // La entrada 0 es la libre; de la 1 en adelante, cada desplazamiento tiene
    // que caer exactamente sobre "N 0 obj".
    expect(entradas[0]).toMatch(/^0000000000 65535 f $/);
    entradas.slice(1).forEach((entrada, indice) => {
      const desplazamiento = Number(entrada.slice(0, 10));
      expect(texto.slice(desplazamiento, desplazamiento + 20)).toContain(`${indice + 1} 0 obj`);
    });
  });

  it("declara las dos fuentes estándar en WinAnsiEncoding", () => {
    expect(texto).toContain("/BaseFont /Helvetica /Encoding /WinAnsiEncoding");
    expect(texto).toContain("/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding");
  });

  it("cada flujo de contenido declara su largo real en bytes", () => {
    const flujos = [...texto.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)];
    expect(flujos.length).toBeGreaterThan(0);
    for (const flujo of flujos) {
      expect(bytesWinAnsi(flujo[2]).length).toBe(Number(flujo[1]));
    }
  });

  it("usa la hoja A4", () => {
    expect(texto).toContain(`/MediaBox [0 0 ${ANCHO_A4} 841.89]`);
  });

  it("rechaza construir un documento sin páginas", () => {
    const vacio = crearDocumentoPdf({ titulo: "x", autor: "y", creadoEn: CERRADO_EN });
    expect(() => vacio.construir()).toThrow(/ninguna página/);
  });

  it("rechaza una fecha de cierre inválida en vez de inventar una", () => {
    const documento = crearDocumentoPdf({ titulo: "x", autor: "y", creadoEn: "no es una fecha" });
    documento.nuevaPagina();
    expect(() => documento.construir()).toThrow(/Fecha de creación inválida/);
  });
});

// ---------------------------------------------------------------------------
// Contenido impreso
// ---------------------------------------------------------------------------

describe("contenido impreso", () => {
  it("la Solicitud imprime plan, coberturas, premio, beneficiario y declaraciones médicas", () => {
    const texto = comoTexto(renderizarPaquete(contenido()));

    expect(texto).toContain("PROP-00018425");
    expect(texto).toContain("FIPF-00018425"); // documento vinculado
    expect(texto).toContain("CONFÍO+");
    expect(texto).toContain("PLAN ELEGIDO");
    expect(texto).toContain("Gs. 522.500");
    expect(texto).toContain("Diagn"); // "Diagnóstico de cáncer"
    expect(texto).toContain("Herederos legales");
    expect(texto).toContain("DECLARACIÓN MÉDICA");
    expect(texto).toContain("REFERENCIAS DE LA OPERACIÓN");
    expect(texto).toContain("ACEPTACIÓN, FIRMA Y TRAZABILIDAD");
  });

  it("la sección FIPF imprime datos personales, laborales, PEP, origen de fondos y evidencias", () => {
    const texto = comoTexto(renderizarPaquete(contenido()));

    expect(texto).toContain("FIPF-00018425");
    expect(texto).toContain("PROP-00018425");
    expect(texto).toContain("DATOS PERSONALES Y CANALES VERIFICADOS");
    expect(texto).toContain("DATOS LABORALES, ECONÓMICOS Y FISCALES");
    expect(texto).toContain("CONDICIÓN PEP");
    expect(texto).toContain("ORIGEN DE FONDOS");
    expect(texto).toContain("EVIDENCIAS DIGITALES VINCULADAS");
  });

  it("lleva impreso el enlace de verificación del QR, uno solo (D-11)", () => {
    const texto = comoTexto(renderizarPaquete(contenido()));
    expect(texto).toContain(`https://segurolotengo.com/verificar/${TOKEN_PAQUETE_FIXTURE}`);
  });

  /**
   * El enlace impreso —el mismo que codifica el QR— lleva el token y no el
   * código. Si volviera a llevar el código, la dirección del documento sería
   * deducible de su correlativo y la página pública quedaría enumerable.
   */
  it("el enlace del QR lleva el token, no el código del documento", () => {
    const texto = comoTexto(renderizarPaquete(contenido()));
    expect(texto).not.toContain("verificar/PROP-00018425");
    // El código sigue impreso en la caja del encabezado y en el pie, para
    // quien prefiera tipearlo.
    expect(texto).toContain("PROP-00018425");
  });

  it("imprime la advertencia del art. 1556 y el sello de tiempo (CMP-09)", () => {
    const texto = comoTexto(renderizarPaquete(contenido()));

    // Literal de la Matriz V4 §4, marcado como inclusión obligatoria.
    expect(texto).toContain("Art. 1556 del Código Civil Paraguayo");
    expect(texto).toContain("Fecha de la solicitud:");
  });

  it("imprime las declaraciones de licitud/veracidad y de cuenta propia (Matriz §4)", () => {
    const texto = comoTexto(renderizarPaquete(contenido()));

    expect(texto).toContain("provienen de actividades lícitas");
    expect(texto).toContain("actúo por cuenta propia");
  });

  it("no imprime el número de celular ni el correo sin enmascarar", () => {
    const texto = comoTexto(renderizarPaquete(contenido()));
    expect(texto).not.toContain("+595981000456");
    expect(texto).not.toContain("monica.gorena@example.com");
  });
});

// ---------------------------------------------------------------------------
// Tipografía
// ---------------------------------------------------------------------------

describe("tipografía", () => {
  it("mide el ancho de un texto proporcionalmente al cuerpo", () => {
    expect(anchoDeTexto("MMMM", "regular", 10)).toBeCloseTo(33.32, 2); // 4 × 833/1000 × 10
    expect(anchoDeTexto("iiii", "regular", 10)).toBeCloseTo(8.88, 2); // 4 × 222/1000 × 10
    expect(anchoDeTexto("Hola", "negrita", 10)).toBeGreaterThan(anchoDeTexto("Hola", "regular", 10));
  });

  it("le da a una letra acentuada el mismo avance que a su letra base", () => {
    expect(anchoDeTexto("á", "regular", 10)).toBe(anchoDeTexto("a", "regular", 10));
    expect(anchoDeTexto("ñ", "negrita", 10)).toBe(anchoDeTexto("n", "negrita", 10));
    expect(anchoDeTexto("Ó", "regular", 10)).toBe(anchoDeTexto("O", "regular", 10));
  });

  it("corta por palabras sin partir una palabra larga", () => {
    const lineas = partirEnLineas("uno dos tres cuatro cinco", "regular", 9, 40);
    expect(lineas.length).toBeGreaterThan(1);
    expect(lineas.join(" ")).toBe("uno dos tres cuatro cinco");

    // Un código o un hash no se parte: prefiere sobresalir antes que quedar ilegible.
    expect(partirEnLineas("PROP-00018425", "regular", 9, 5)).toEqual(["PROP-00018425"]);
  });

  it("codifica en WinAnsi los signos que la especificación usa", () => {
    expect([...bytesWinAnsi("á")]).toEqual([0xe1]);
    expect([...bytesWinAnsi("ñ")]).toEqual([0xf1]);
    expect([...bytesWinAnsi("·")]).toEqual([0xb7]);
    expect([...bytesWinAnsi("—")]).toEqual([0x97]);
    expect([...bytesWinAnsi("•")]).toEqual([0x95]);
    expect([...bytesWinAnsi("¿")]).toEqual([0xbf]);
    // Lo que no se puede representar se degrada, no rompe la generación.
    expect([...bytesWinAnsi("漢")]).toEqual([0x3f]);
  });

  it("escapa los caracteres que romperían un literal de PDF", () => {
    expect(escaparTextoPdf("Gs. (475.000)")).toBe("Gs. \\(475.000\\)");
    expect(escaparTextoPdf("c:\\ruta")).toBe("c:\\\\ruta");
  });
});
