/**
 * Plantillas de los dos documentos del paquete.
 *
 * Cada una toma el contenido ya armado por `src/domain/documentos.ts` y lo
 * dibuja. No deciden **qué** dice el documento —eso es dominio— sino cómo se
 * distribuye en la hoja. La estructura y el orden de los bloques son los de
 * `docs/Solicitud.pdf` y `docs/FIPF.pdf`.
 *
 * ## Dos pasadas
 *
 * La cabecera imprime `PÁGINA n DE N`, y `N` solo se sabe cuando el documento
 * terminó de fluir. Por eso cada plantilla se renderiza dos veces: la primera
 * para contar carillas, la segunda con el total ya conocido. Es barato
 * (dibujar en memoria) y determinista, que es lo que importa: el mismo
 * contenido da siempre los mismos bytes y, por lo tanto, el mismo SHA-256.
 */
import {
  ANCHO_UTIL,
  AZUL,
  BLANCO_PURO,
  BORDE,
  ETIQUETA,
  FONDO_ELEGIDO,
  FONDO_SUAVE,
  FONDO_VERDE,
  MARGEN,
  NARANJA,
  ROJO,
  TINTA,
  VERDE,
  bloqueDeFirmas,
  crearLienzo,
  dibujarEncabezado,
  franja,
  grillaDeCampos,
  listaDeCasillas,
  pie,
  recortarAlAncho,
  seccion,
} from "./layout";
import type { Lienzo } from "./layout";
import { anchoDeTexto, crearDocumentoPdf, partirEnLineas } from "./pdf";
import type { DocumentoPdf, Pagina } from "./pdf";
import type {
  ContenidoFipf,
  ContenidoSolicitud,
  DeclaracionDocumento,
  EncabezadoDocumento,
  PlanDocumento,
} from "../domain/documentos";

const AUTOR_PDF = "Interseguros S.A. · SeguroLoTengo.com";

// ---------------------------------------------------------------------------
// Piezas propias de estos documentos
// ---------------------------------------------------------------------------

/** Tarjeta de plan del bloque 2 de la Solicitud, con sus cinco coberturas. */
function tarjetaDePlan(pagina: Pagina, plan: PlanDocumento, x: number, y: number, ancho: number): number {
  const alto = 118;
  pagina.rectangulo(x, y, ancho, alto, {
    borde: plan.elegido ? NARANJA : AZUL,
    relleno: plan.elegido ? FONDO_ELEGIDO : BLANCO_PURO,
    grosor: plan.elegido ? 1.2 : 0.6,
  });

  pagina.texto(x + 9, y + 18, plan.nombre, { fuente: "negrita", tamano: 13, color: AZUL });
  if (plan.elegido) {
    pagina.rectangulo(x + ancho - 66, y + 8, 57, 13, { borde: NARANJA, grosor: 0.8 });
    pagina.texto(x + ancho - 66, y + 17, "PLAN ELEGIDO", {
      fuente: "negrita",
      tamano: 6,
      color: NARANJA,
      alineacion: "centro",
      ancho: 57,
    });
  }

  pagina.texto(x + 9, y + 34, "Premio anual · IVA incluido", { fuente: "negrita", tamano: 6.6, color: TINTA });
  pagina.texto(x + 9, y + 34, plan.premioAnual, {
    fuente: "negrita",
    tamano: 9.5,
    color: NARANJA,
    alineacion: "derecha",
    ancho: ancho - 18,
  });
  pagina.linea(x + 9, y + 39, x + ancho - 9, y + 39, { color: BORDE, grosor: 0.4 });

  // El importe manda: se mide primero cuánto ocupa el más ancho de la
  // tarjeta y el rótulo se queda con el resto. Así "Renta hospitalaria · máx.
  // 15 días" entra entero en vez de recortarse contra un espacio fijo.
  const anchoImporte = Math.max(...plan.coberturas.map((c) => anchoDeTexto(c.valor, "negrita", 6.6)));
  const anchoRotulo = ancho - 18 - anchoImporte - 6;

  plan.coberturas.forEach((cobertura, indice) => {
    const linea = y + 52 + indice * 13;
    pagina.texto(x + 9, linea, recortarAlAncho(cobertura.rotulo, anchoRotulo, 5.9, "regular"), {
      tamano: 5.9,
      color: TINTA,
    });
    pagina.texto(x + 9, linea, cobertura.valor, {
      fuente: "negrita",
      tamano: 6.6,
      color: AZUL,
      alineacion: "derecha",
      ancho: ancho - 18,
    });
  });

  return alto;
}

/**
 * Declaración con su respuesta a la derecha. Se marca cuál de las dos se dio
 * y, en verde, cuál es la que habilita la emisión automática: quien lea el
 * documento tiene que poder ver la respuesta, no deducirla.
 */
function bloqueDeclaracion(lienzo: Lienzo, declaracion: DeclaracionDocumento): void {
  const anchoTexto = ANCHO_UTIL - 100;
  const lineas = partirEnLineas(declaracion.texto, "regular", 7.2, anchoTexto);
  const alto = Math.max(38, lineas.length * 9.5 + 26);

  lienzo.asegurarEspacio(alto + 5);
  const y = lienzo.y;
  const pagina = lienzo.pagina;

  pagina.rectangulo(MARGEN, y - 8, ANCHO_UTIL, alto, { borde: NARANJA, relleno: FONDO_SUAVE, grosor: 0.5 });
  pagina.texto(MARGEN + 9, y + 3, `${declaracion.numero}. ${declaracion.titulo.toUpperCase()}`, {
    fuente: "negrita",
    tamano: 7,
    color: NARANJA,
  });
  pagina.parrafo(MARGEN + 9, y + 16, anchoTexto, declaracion.texto, {
    tamano: 7.2,
    color: TINTA,
    interlineado: 9.5,
  });

  // Marcadores Sí / No, a la derecha del bloque.
  const xMarcadores = MARGEN + ANCHO_UTIL - 84;
  (["SI", "NO"] as const).forEach((opcion, indice) => {
    const x = xMarcadores + indice * 40;
    const elegida = declaracion.respuesta === opcion;
    const habilitante = declaracion.respuestaHabilitante === opcion;
    const color = elegida && habilitante ? VERDE : elegida ? ROJO : ETIQUETA;

    pagina.texto(x, y + 10, opcion === "SI" ? "Sí" : "NO", { fuente: "negrita", tamano: 8, color });
    pagina.rectangulo(x + 17, y + 3, 8, 8, {
      borde: color,
      relleno: elegida ? color : BLANCO_PURO,
      grosor: 0.8,
    });
  });

  lienzo.y = y + alto + 5;
}

/** Bloque de referencias de la operación, sobre fondo verde. */
function bloqueReferencias(lienzo: Lienzo, titulo: string, campos: readonly { etiqueta: string; valor: string }[]): void {
  const alto = 34;
  lienzo.asegurarEspacio(alto + 6);
  const y = lienzo.y;
  const pagina = lienzo.pagina;

  pagina.rectangulo(MARGEN, y - 8, ANCHO_UTIL, alto, { relleno: FONDO_VERDE, borde: VERDE, grosor: 0.5 });
  pagina.texto(MARGEN + 9, y + 2, titulo.toUpperCase(), { fuente: "negrita", tamano: 6.2, color: VERDE });
  pagina.texto(
    MARGEN + 9,
    y + 15,
    campos.map((campo) => `${campo.etiqueta}: ${campo.valor}`).join("  ·  "),
    { fuente: "negrita", tamano: 7.4, color: TINTA },
  );

  lienzo.y = y + alto + 6;
}

// ---------------------------------------------------------------------------
// Solicitud de Seguro
// ---------------------------------------------------------------------------

function dibujarSolicitud(documento: DocumentoPdf, contenido: ContenidoSolicitud, totalPaginas: number): number {
  const lienzo = crearLienzo(documento, (pagina, numeroPagina) =>
    dibujarEncabezado(pagina, contenido.encabezado, numeroPagina, totalPaginas),
  );

  lienzo.pagina.texto(MARGEN, lienzo.y - 4, "Producto CONFÍO · Contratación exclusivamente para el titular identificado.", {
    fuente: "negrita",
    tamano: 7.5,
    color: AZUL,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.y += 12;

  // Bloque 1 — Datos del proponente.
  seccion(lienzo, 1, "Datos del proponente / asegurado");
  grillaDeCampos(lienzo, contenido.proponente, 4);

  // Bloque 2 — Planes y coberturas.
  seccion(lienzo, 2, "Planes y coberturas solicitadas");
  lienzo.asegurarEspacio(124);
  {
    const separacion = 8;
    const ancho = (ANCHO_UTIL - separacion * (contenido.planes.length - 1)) / contenido.planes.length;
    const alturas = contenido.planes.map((plan, indice) =>
      tarjetaDePlan(lienzo.pagina, plan, MARGEN + indice * (ancho + separacion), lienzo.y - 8, ancho),
    );
    lienzo.y += Math.max(...alturas) - 2;
  }
  lienzo.pagina.texto(MARGEN, lienzo.y, contenido.carencias, {
    fuente: "negrita",
    tamano: 7,
    color: VERDE,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.pagina.texto(MARGEN, lienzo.y + 11, contenido.notaRentaHospitalaria, {
    tamano: 6.4,
    color: ETIQUETA,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.y += 26;

  // Bloque 3 — Beneficiario.
  seccion(lienzo, 3, "Beneficiario por fallecimiento");
  grillaDeCampos(lienzo, contenido.beneficiario, Math.min(3, contenido.beneficiario.length));

  // Bloque 4 — Declaración médica.
  seccion(lienzo, 4, "Declaración médica");
  for (const declaracion of contenido.declaracionesMedicas) bloqueDeclaracion(lienzo, declaracion);
  franja(lienzo, contenido.advertenciaElegibilidad, "rojo");

  // Bloque 5 — Declaraciones finales, pago y entrega.
  seccion(lienzo, 5, "Declaraciones finales, pago y entrega");
  listaDeCasillas(lienzo, contenido.declaracionesFinales);
  bloqueReferencias(lienzo, "Referencias de la operación", contenido.referencias);

  // Bloque 6 — Aceptación, firma y trazabilidad.
  seccion(lienzo, 6, "Aceptación, firma y trazabilidad");
  bloqueDeFirmas(lienzo, contenido.firmantes);
  lienzo.pagina.texto(MARGEN, lienzo.y + 4, contenido.leyendaFirma, {
    fuente: "negrita",
    tamano: 6.8,
    color: VERDE,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.pagina.texto(MARGEN, lienzo.y + 16, contenido.leyendaNoEsPoliza, {
    fuente: "negrita",
    tamano: 6.8,
    color: ROJO,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.y += 30;

  pie(lienzo, contenido.encabezado);
  return lienzo.numeroPagina;
}

// ---------------------------------------------------------------------------
// FIPF
// ---------------------------------------------------------------------------

function dibujarFipf(documento: DocumentoPdf, contenido: ContenidoFipf, totalPaginas: number): number {
  const lienzo = crearLienzo(documento, (pagina, numeroPagina) =>
    dibujarEncabezado(pagina, contenido.encabezado, numeroPagina, totalPaginas),
  );

  lienzo.pagina.texto(MARGEN, lienzo.y - 4, contenido.leyendaNorma, {
    fuente: "negrita",
    tamano: 7.5,
    color: AZUL,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.y += 12;

  seccion(lienzo, 1, "Datos personales y canales verificados");
  grillaDeCampos(lienzo, contenido.personales, 4);

  seccion(lienzo, 2, "Datos laborales, económicos y fiscales");
  grillaDeCampos(lienzo, contenido.laborales, 3);

  seccion(lienzo, 3, "Condición PEP");
  bloqueDeclaracion(lienzo, contenido.pep);
  franja(lienzo, contenido.advertenciaPep, "rojo");

  seccion(lienzo, 4, "Declaraciones y autorizaciones");
  listaDeCasillas(lienzo, contenido.declaraciones);

  seccion(lienzo, 5, "Evidencias digitales vinculadas");
  listaDeCasillas(lienzo, contenido.evidencias);

  seccion(lienzo, 6, "Firma electrónica y trazabilidad");
  bloqueDeFirmas(lienzo, contenido.firmantes);
  franja(lienzo, contenido.leyendaFirma, "neutro");

  pie(lienzo, contenido.encabezado);
  return lienzo.numeroPagina;
}

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

function renderizarEnDosPasadas(
  encabezado: EncabezadoDocumento,
  dibujar: (documento: DocumentoPdf, totalPaginas: number) => number,
): Uint8Array {
  const nuevoDocumento = (): DocumentoPdf =>
    crearDocumentoPdf({
      titulo: `${encabezado.titulo} · ${encabezado.codigo}`,
      autor: AUTOR_PDF,
      creadoEn: encabezado.cerradoEn,
    });

  // Pasada 1: solo para contar carillas; el documento se descarta.
  const totalPaginas = dibujar(nuevoDocumento(), 1);
  // Pasada 2: la definitiva, ya con `PÁGINA n DE N` correcto.
  const documento = nuevoDocumento();
  dibujar(documento, totalPaginas);
  return documento.construir();
}

/** Solicitud de Seguro de Vida Oncológico, cerrada y lista para hashear. */
export function renderizarSolicitud(contenido: ContenidoSolicitud): Uint8Array {
  return renderizarEnDosPasadas(contenido.encabezado, (documento, total) =>
    dibujarSolicitud(documento, contenido, total),
  );
}

/** Formulario de Identificación de Persona Física, cerrado y listo para hashear. */
export function renderizarFipf(contenido: ContenidoFipf): Uint8Array {
  return renderizarEnDosPasadas(contenido.encabezado, (documento, total) =>
    dibujarFipf(documento, contenido, total),
  );
}
