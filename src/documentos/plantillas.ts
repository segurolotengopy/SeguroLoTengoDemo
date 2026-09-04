/**
 * Plantilla del documento único del expediente (D-11).
 *
 * Toma el contenido ya armado por `src/domain/documentos.ts` y lo dibuja. No
 * decide **qué** dice el documento —eso es dominio— sino cómo se distribuye en
 * la hoja. La estructura y el orden de los bloques son los de
 * `docs/Solicitud.pdf` y `docs/FIPF.pdf`, ahora como dos secciones seguidas de
 * un mismo archivo: primero los seis bloques de la Solicitud, después los
 * cinco del FIPF, y el bloque de firmas una sola vez al final porque **una
 * sola firma cubre todo** (regla inviolable #3, ahora estructural).
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
  CampoDocumento,
  ContenidoFipf,
  ContenidoPaquete,
  ContenidoSolicitud,
  DeclaracionDocumento,
  EncabezadoDocumento,
  PlanDocumento,
} from "../domain/documentos";
import type { ContenidoCertificado, CoberturaCertificado } from "../domain/certificado-cobertura";
import type { ContenidoComprobante } from "../domain/comprobante-pago";
import type { ContenidoConstancia } from "../domain/constancia-firma";

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

function dibujarSeccionSolicitud(lienzo: Lienzo, contenido: ContenidoSolicitud): void {
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

  lienzo.pagina.texto(MARGEN, lienzo.y + 4, contenido.leyendaNoEsPoliza, {
    fuente: "negrita",
    tamano: 6.8,
    color: ROJO,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.y += 18;
}

// ---------------------------------------------------------------------------
// FIPF
// ---------------------------------------------------------------------------

function dibujarSeccionFipf(lienzo: Lienzo, contenido: ContenidoFipf): void {
  lienzo.pagina.texto(MARGEN, lienzo.y - 4, contenido.leyendaNorma, {
    fuente: "negrita",
    tamano: 7.5,
    color: AZUL,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.y += 12;

  seccion(lienzo, 7, "Datos personales y canales verificados");
  grillaDeCampos(lienzo, contenido.personales, 4);

  seccion(lienzo, 8, "Datos laborales, económicos y fiscales");
  grillaDeCampos(lienzo, contenido.laborales, 3);

  seccion(lienzo, 9, "Condición PEP");
  bloqueDeclaracion(lienzo, contenido.pep);
  franja(lienzo, contenido.advertenciaPep, "rojo");

  seccion(lienzo, 10, "Declaraciones y autorizaciones");
  listaDeCasillas(lienzo, contenido.declaraciones);

  seccion(lienzo, 11, "Evidencias digitales vinculadas");
  listaDeCasillas(lienzo, contenido.evidencias);
}

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

/**
 * Dibuja el documento completo: encabezado, sección de Solicitud, sección de
 * FIPF, y el bloque de firmas una sola vez al final.
 *
 * Que las firmas vayan **al final y una sola vez** es lo que hace visible la
 * decisión D-11: mientras eran dos archivos, cada uno cerraba con su propio
 * bloque de firmantes y había que confiar en que se firmaran juntos. Acá no
 * hay dos bloques que puedan divergir.
 */
function dibujarPaquete(
  documento: DocumentoPdf,
  contenido: ContenidoPaquete,
  totalPaginas: number,
): number {
  const lienzo = crearLienzo(documento, (pagina, numeroPagina) =>
    dibujarEncabezado(pagina, contenido.encabezado, numeroPagina, totalPaginas),
  );

  // Sello de tiempo de la solicitud (CMP-09): el instante del que cuelga el
  // plazo del art. 1556, arriba de todo y no escondido en el pie.
  lienzo.pagina.texto(MARGEN, lienzo.y - 14, `Fecha de la solicitud: ${contenido.encabezado.selloDeTiempo}`, {
    fuente: "negrita",
    tamano: 7,
    color: ETIQUETA,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });

  dibujarSeccionSolicitud(lienzo, contenido.solicitud);

  // Advertencia del art. 1556 CC (CMP-09), destacada: la Matriz V4 §4 la marca
  // como inclusión obligatoria en la Solicitud.
  franja(lienzo, contenido.advertenciaArt1556, "neutro");

  // Separador de sección: el FIPF empieza en carilla nueva para que su código
  // interno y su leyenda normativa se lean como lo que son, un formulario
  // propio dentro del mismo archivo.
  lienzo.saltarPagina();
  lienzo.pagina.texto(MARGEN, lienzo.y - 4, `Sección FIPF · ${contenido.fipf.codigoSeccion}`, {
    fuente: "negrita",
    tamano: 8,
    color: AZUL,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.y += 12;

  dibujarSeccionFipf(lienzo, contenido.fipf);

  seccion(lienzo, 12, "Aceptación, firma y trazabilidad");
  bloqueDeFirmas(lienzo, contenido.firmantes);
  lienzo.pagina.texto(MARGEN, lienzo.y + 4, contenido.leyendaFirma, {
    fuente: "negrita",
    tamano: 6.8,
    color: VERDE,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.y += 18;

  pie(lienzo, contenido.encabezado);
  return lienzo.numeroPagina;
}

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

/**
 * El documento único del expediente —Solicitud + FIPF— cerrado y listo para
 * hashear (D-11). Un solo archivo, un solo SHA-256, un solo acto de firma.
 */
export function renderizarPaquete(contenido: ContenidoPaquete): Uint8Array {
  return renderizarEnDosPasadas(contenido.encabezado, (documento, total) =>
    dibujarPaquete(documento, contenido, total),
  );
}

// ---------------------------------------------------------------------------
// Certificado de Cobertura Provisional (D-12)
// ---------------------------------------------------------------------------

/**
 * Tabla de coberturas del certificado: suma asegurada y carencia, una fila por
 * cobertura.
 *
 * La carencia va **al lado de cada suma** y no en una frase al pie, que es
 * como la lleva la Solicitud. Es el mismo dato dicho de dos formas distintas a
 * propósito: quien lee la Solicitud está contratando y quien lee el
 * certificado está por usar la cobertura, y esa persona busca "¿esto ya está
 * cubierto?" cobertura por cobertura.
 */
function tablaDeCoberturas(lienzo: Lienzo, coberturas: readonly CoberturaCertificado[]): void {
  const altoFila = 20;
  const anchoCarencia = 90;
  const anchoSuma = 150;
  const anchoRotulo = ANCHO_UTIL - anchoSuma - anchoCarencia;

  lienzo.asegurarEspacio(altoFila * (coberturas.length + 1) + 6);
  let y = lienzo.y;

  // Encabezado de la tabla.
  lienzo.pagina.rectangulo(MARGEN, y - 8, ANCHO_UTIL, altoFila, { relleno: FONDO_SUAVE, borde: BORDE });
  lienzo.pagina.texto(MARGEN + 8, y + 3, "COBERTURA", { fuente: "negrita", tamano: 6.2, color: ETIQUETA });
  lienzo.pagina.texto(MARGEN + anchoRotulo, y + 3, "SUMA ASEGURADA", {
    fuente: "negrita",
    tamano: 6.2,
    color: ETIQUETA,
  });
  lienzo.pagina.texto(MARGEN + anchoRotulo + anchoSuma, y + 3, "CARENCIA", {
    fuente: "negrita",
    tamano: 6.2,
    color: ETIQUETA,
  });
  y += altoFila;

  coberturas.forEach((cobertura) => {
    lienzo.pagina.rectangulo(MARGEN, y - 8, ANCHO_UTIL, altoFila, { borde: BORDE, relleno: BLANCO_PURO });
    lienzo.pagina.texto(MARGEN + 8, y + 4, recortarAlAncho(cobertura.rotulo, anchoRotulo - 16, 7.4), {
      tamano: 7.4,
      color: TINTA,
    });
    lienzo.pagina.texto(
      MARGEN + anchoRotulo,
      y + 4,
      recortarAlAncho(cobertura.sumaAsegurada, anchoSuma - 8, 7.4),
      { fuente: "negrita", tamano: 7.4, color: AZUL },
    );
    lienzo.pagina.texto(MARGEN + anchoRotulo + anchoSuma, y + 4, cobertura.carencia, {
      fuente: "negrita",
      tamano: 7.4,
      color: NARANJA,
    });
    y += altoFila;
  });

  lienzo.y = y + 6;
}

/**
 * Bloque de firma del certificado.
 *
 * No reusa `bloqueDeFirmas` a propósito: aquel dibuja una línea con
 * `Firma y aclaración` debajo, que es lo correcto para un documento que
 * alguien va a firmar. El CPC llega **prefirmado** (D-13) —el suscriptor de
 * Alianza ya lo firmó cuando el cliente lo recibe—, así que una línea en
 * blanco invitaría a firmar algo que no hay que firmar, y de paso ocuparía
 * media carilla para no decir nada.
 */
function bloqueFirmaAplicada(lienzo: Lienzo, firmantes: readonly CampoDocumento[]): void {
  const alto = 38;
  lienzo.asegurarEspacio(alto + 6);
  const y = lienzo.y;

  const separacion = 8;
  const ancho = (ANCHO_UTIL - separacion * (firmantes.length - 1)) / firmantes.length;

  firmantes.forEach((firmante, posicion) => {
    const x = MARGEN + posicion * (ancho + separacion);
    lienzo.pagina.rectangulo(x, y - 8, ancho, alto, { borde: AZUL, relleno: FONDO_SUAVE, grosor: 0.8 });
    lienzo.pagina.texto(x + 8, y + 3, firmante.etiqueta.toUpperCase(), {
      fuente: "negrita",
      tamano: 7.5,
      color: AZUL,
    });
    lienzo.pagina.parrafo(x + 8, y + 16, ancho - 16, firmante.valor, {
      tamano: 6.6,
      color: TINTA,
      interlineado: 8.4,
    });
    lienzo.pagina.texto(x + 8, y + 28, "FIRMA ELECTRÓNICA YA APLICADA SOBRE ESTE DOCUMENTO", {
      fuente: "negrita",
      tamano: 5.8,
      color: VERDE,
    });
  });

  lienzo.y = y + alto + 6;
}

/**
 * Alto del bloque de cierre: encabezado de sección, caja de firma, leyenda y
 * pie. Se reserva de una sola vez (ver `dibujarCertificado`).
 */
const ALTO_CIERRE_CERTIFICADO = 22 + 44 + 20 + 28;

/**
 * Dibuja el certificado completo.
 *
 * El orden de los bloques responde a lo que alguien busca con este documento
 * en la mano y en ese orden: quién está cubierto, desde cuándo, por cuánto, qué
 * lo pagó y qué lo respalda. La vigencia va segunda y destacada porque es el
 * único dato que este documento aporta y la póliza todavía no.
 *
 * La advertencia de que esto **no es la póliza** va pegada a la vigencia y no
 * al final, que es donde la habría puesto la costumbre: la confusión nace
 * justamente al leer "tu cobertura empieza tal día", así que la aclaración
 * tiene que estar ahí y no tres bloques después.
 */
function dibujarCertificado(
  documento: DocumentoPdf,
  contenido: ContenidoCertificado,
  totalPaginas: number,
): number {
  const lienzo = crearLienzo(documento, (pagina, numeroPagina) =>
    dibujarEncabezado(pagina, contenido.encabezado, numeroPagina, totalPaginas),
  );

  lienzo.pagina.texto(MARGEN, lienzo.y - 4, `Emitido el ${contenido.encabezado.selloDeTiempo}`, {
    fuente: "negrita",
    tamano: 7,
    color: ETIQUETA,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.y += 8;

  // El rótulo de modelo provisional va arriba de todo y no en letra chica al
  // pie: es lo primero que un supervisor de la SIS tiene que ver
  // (compuerta de producción §8.E.3).
  franja(lienzo, contenido.leyendaProvisional, "neutro");

  seccion(lienzo, 1, "Asegurado");
  grillaDeCampos(lienzo, contenido.asegurado, 3);

  seccion(lienzo, 2, "Vigencia de la cobertura");
  grillaDeCampos(lienzo, contenido.vigencia, 3);
  franja(lienzo, contenido.leyendaInicioCobertura, "verde");
  franja(lienzo, contenido.leyendaNoEsPoliza, "rojo");

  seccion(lienzo, 3, `Coberturas contratadas · Plan ${contenido.plan}`);
  tablaDeCoberturas(lienzo, contenido.coberturas);

  // El cobro y el documento firmado van bajo un mismo encabezado porque son
  // las dos caras de la misma pregunta —qué respalda esta cobertura— y porque
  // así el certificado entra en una sola carilla, que es como se lo va a
  // mirar: en el teléfono, sin desplazarse.
  seccion(lienzo, 4, "Pago acreditado y documento que lo respalda");
  grillaDeCampos(lienzo, contenido.pago, 2);
  grillaDeCampos(lienzo, contenido.respaldo, 3);
  // La huella ocupa la fila entera: en media columna se recortaría, y un hash
  // recortado no se puede comparar contra nada.
  grillaDeCampos(lienzo, [contenido.huellaDocumentoFirmado], 1);

  // El cierre —firma, leyenda y pie— se reserva entero antes de dibujarlo.
  // Sin esto, un certificado que se pasa por unos pocos puntos manda a la
  // carilla siguiente **solo el pie**, y una segunda página con nada más que
  // el pie parece un documento roto. Reservado junto, o entra todo en la
  // primera carilla o baja todo junto a la segunda.
  lienzo.asegurarEspacio(ALTO_CIERRE_CERTIFICADO);
  seccion(lienzo, 5, "Firma de la aseguradora");
  bloqueFirmaAplicada(lienzo, contenido.firmantes);
  lienzo.pagina.parrafo(MARGEN, lienzo.y, ANCHO_UTIL, contenido.leyendaFirma, {
    tamano: 6.6,
    color: TINTA,
    interlineado: 8.6,
  });
  lienzo.y += 20;

  // La URL de verificación no se repite acá: el pie ya la imprime en todas
  // las carillas, y decirla dos veces en la misma no la hace más verificable.
  pie(lienzo, contenido.encabezado);
  return lienzo.numeroPagina;
}

/**
 * El Certificado de Cobertura Provisional cerrado y listo para hashear.
 *
 * Mismo motor determinista que el paquete —dos pasadas, sin `/ID` aleatorio ni
 * fecha del reloj— porque la exigencia es la misma: mismo contenido y mismo
 * instante de emisión ⇒ mismos bytes ⇒ mismo SHA-256, que es lo que hace
 * verificable el QR (CMP-06).
 */
export function renderizarCertificado(contenido: ContenidoCertificado): Uint8Array {
  return renderizarEnDosPasadas(contenido.encabezado, (documento, total) =>
    dibujarCertificado(documento, contenido, total),
  );
}


// ---------------------------------------------------------------------------
// Comprobante de pago del premio (D-05)
// ---------------------------------------------------------------------------

/**
 * Lista de hechos, con viñeta.
 *
 * No usa `listaDeCasillas` a propósito: una casilla marcada, en este producto,
 * significa *"la persona aceptó esto"* —así se imprimen las declaraciones de
 * la Solicitud—. Lo que este bloque enumera son consecuencias del pago, cosas
 * que ocurrieron. Marcarlas con un tilde de aceptación las convertiría en algo
 * que nadie aceptó.
 */
function listaDeHechos(lienzo: Lienzo, textos: readonly string[]): void {
  const anchoTexto = ANCHO_UTIL - 16;

  for (const texto of textos) {
    const lineas = partirEnLineas(texto, "regular", 7.8, anchoTexto);
    const alto = lineas.length * 10 + 4;
    lienzo.asegurarEspacio(alto);
    const y = lienzo.y;

    lienzo.pagina.texto(MARGEN + 2, y, "·", { fuente: "negrita", tamano: 9, color: NARANJA });
    lienzo.pagina.parrafo(MARGEN + 16, y, anchoTexto, texto, {
      tamano: 7.8,
      color: TINTA,
      interlineado: 10,
    });

    lienzo.y = y + alto;
  }
}

/**
 * Dibuja el comprobante del pago.
 *
 * Es el más simple de los tres documentos y a propósito: constata un hecho que
 * ya ocurrió. Sin bloque de firmas —nadie lo firma—, sin QR —no se verifica
 * por sí solo, ver `comprobante-pago.ts`— y con las dos advertencias que
 * evitan que se lo confunda con lo que no es: no es la factura, y no puede
 * contener datos de tarjeta.
 */
function dibujarComprobante(
  documento: DocumentoPdf,
  contenido: ContenidoComprobante,
  totalPaginas: number,
): number {
  const lienzo = crearLienzo(documento, (pagina, numeroPagina) =>
    dibujarEncabezado(pagina, contenido.encabezado, numeroPagina, totalPaginas),
  );

  lienzo.pagina.texto(MARGEN, lienzo.y - 4, `Cobro acreditado el ${contenido.encabezado.selloDeTiempo}`, {
    fuente: "negrita",
    tamano: 7,
    color: ETIQUETA,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.y += 8;

  seccion(lienzo, 1, "Asegurado y facturación");
  grillaDeCampos(lienzo, contenido.pagador, 2);

  seccion(lienzo, 2, "Operación");
  grillaDeCampos(lienzo, contenido.operacion, 2);

  seccion(lienzo, 3, "Importe");
  grillaDeCampos(lienzo, contenido.desglose, 3);
  franja(lienzo, contenido.leyendaDesgloseProvisional, "neutro");

  seccion(lienzo, 4, "Qué habilitó este pago");
  listaDeHechos(lienzo, contenido.consecuencias);

  // Las dos aclaraciones que este documento existe para no provocar. La de la
  // factura va en rojo porque es la confusión cara: alguien podría presentar
  // esto como comprobante fiscal.
  franja(lienzo, contenido.leyendaNoEsFactura, "rojo");
  franja(lienzo, contenido.leyendaSinDatosDeTarjeta, "verde");

  pie(lienzo, contenido.encabezado);
  return lienzo.numeroPagina;
}

/**
 * El comprobante de pago, listo para servir.
 *
 * Determinista como los otros dos, aunque acá no haya hash que preservar:
 * descargarlo dos veces tiene que dar el mismo archivo, porque si no la
 * persona tendría dos comprobantes distintos del mismo pago.
 */
export function renderizarComprobante(contenido: ContenidoComprobante): Uint8Array {
  return renderizarEnDosPasadas(contenido.encabezado, (documento, total) =>
    dibujarComprobante(documento, contenido, total),
  );
}

// ---------------------------------------------------------------------------
// Constancia del acto de firma del cliente (D-27)
// ---------------------------------------------------------------------------

/** Valores que no entran en media columna: huellas, dispositivo, sesión. */
function esValorLargo(campo: CampoDocumento): boolean {
  return campo.valor.length > 40;
}

/**
 * Un pilar de la constancia: su explicación y sus hechos. Los hechos cortos
 * van a dos columnas; los largos —huellas de 64 caracteres, el agente de
 * usuario— ocupan la fila entera, porque una huella recortada no se puede
 * comparar contra nada.
 */
function bloquePilar(lienzo: Lienzo, numero: number, pilar: ContenidoConstancia["pilares"][number]): void {
  // El título reserva espacio para la explicación y la primera fila de hechos:
  // un encabezado solo al pie de la carilla parece una sección vacía.
  seccion(lienzo, numero, pilar.titulo, 64);
  lienzo.pagina.parrafo(MARGEN, lienzo.y, ANCHO_UTIL, pilar.explicacion, {
    tamano: 7.4,
    color: TINTA,
    interlineado: 9.4,
  });
  lienzo.y += partirEnLineas(pilar.explicacion, "regular", 7.4, ANCHO_UTIL).length * 9.4 + 6;

  const cortos = pilar.hechos.filter((h) => !esValorLargo(h));
  const largos = pilar.hechos.filter(esValorLargo);
  if (cortos.length > 0) grillaDeCampos(lienzo, cortos, 2);
  for (const largo of largos) grillaDeCampos(lienzo, [largo], 1);
}

/**
 * Dibuja la constancia completa.
 *
 * El orden es el de la pregunta que se le hace a este documento: qué firma es
 * y bajo qué norma, y después los tres requisitos del art. 4 en el orden en
 * que la norma los nombra —identificación, integridad, trazabilidad—, cada
 * uno con la evidencia que lo satisface. Las dos
 * advertencias de qué **no** es van al final, en rojo, porque la confusión
 * cara es tomar esto por un certificado de prestador.
 */
function dibujarConstancia(
  documento: DocumentoPdf,
  contenido: ContenidoConstancia,
  totalPaginas: number,
): number {
  const lienzo = crearLienzo(documento, (pagina, numeroPagina) =>
    dibujarEncabezado(pagina, contenido.encabezado, numeroPagina, totalPaginas),
  );

  lienzo.pagina.texto(MARGEN, lienzo.y - 4, `Acto de firma del ${contenido.encabezado.selloDeTiempo}`, {
    fuente: "negrita",
    tamano: 7,
    color: ETIQUETA,
    alineacion: "centro",
    ancho: ANCHO_UTIL,
  });
  lienzo.y += 8;

  franja(lienzo, contenido.leyendaQueEs, "verde");

  seccion(lienzo, 1, "Naturaleza de la firma");
  grillaDeCampos(lienzo, contenido.naturaleza, 2);

  // Los tres requisitos del art. 4, en el orden en que la norma los nombra. El
  // documento firmado y su huella van dentro de «Qué firmaste», que es su
  // pilar: imprimirlos también aparte los decía dos veces.
  contenido.pilares.forEach((pilar, indice) => bloquePilar(lienzo, 2 + indice, pilar));

  seccion(lienzo, 2 + contenido.pilares.length, "Respaldo normativo");
  lienzo.pagina.parrafo(MARGEN, lienzo.y, ANCHO_UTIL, contenido.leyendaNorma, {
    tamano: 7,
    color: TINTA,
    interlineado: 9,
  });
  lienzo.y += partirEnLineas(contenido.leyendaNorma, "regular", 7, ANCHO_UTIL).length * 9 + 8;

  franja(lienzo, contenido.leyendaNoEsCertificado, "rojo");
  franja(lienzo, contenido.leyendaVerificacion, "neutro");

  pie(lienzo, contenido.encabezado);
  return lienzo.numeroPagina;
}

/**
 * La constancia cerrada y lista para hashear: mismo motor determinista que los
 * otros documentos, porque su huella es lo que la verificación pública publica.
 */
export function renderizarConstancia(contenido: ContenidoConstancia): Uint8Array {
  return renderizarEnDosPasadas(contenido.encabezado, (documento, total) =>
    dibujarConstancia(documento, contenido, total),
  );
}
