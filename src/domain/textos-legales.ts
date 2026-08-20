/**
 * Textos informativos con consecuencia legal (L6 · filas 1, 64, 84 y 85).
 *
 * Son las cuatro obligaciones de la matriz que se cumplen **escribiendo**:
 * identificar el canal, informar el derecho de retracto, informar el
 * tratamiento de datos personales y informar el uso de cookies.
 *
 * ## Por qué están versionados si nadie los acepta
 *
 * A diferencia de los consentimientos de P3, P7 y P8, estos textos no se
 * marcan ni se firman: se leen. Igual llevan versión, y por la misma razón que
 * los otros — el día que haya que probar **qué decía el portal** cuando una
 * persona contrató, la respuesta tiene que ser una versión y no "lo que dice
 * hoy el archivo". La evidencia de cada paso ya guarda la versión de los textos
 * que la persona aceptó; estos se citan en la misma escala.
 *
 * ## Lo que falta y por qué está a la vista
 *
 * Tres datos no los fija la matriz: el plazo del retracto, desde cuándo se
 * cuenta, y los plazos de conservación. **No se inventan.** Van como marcador
 * visible, igual que el código de producto (`CDXXXXX`) mientras Alianza no lo
 * pase: un hueco señalado es honesto, un número inventado es una afirmación
 * jurídica falsa.
 *
 * El criterio es distinto al de D-19 —donde lo que falta se omite— porque acá
 * omitir rompe la frase: "podés retractarte dentro del plazo de …" sin plazo no
 * informa nada, mientras que un contacto ausente simplemente no se muestra.
 *
 * Propuestas completas, con su fila de la matriz y qué necesita decidir cada
 * quien: `docs/plan/PROPUESTAS_TEXTOS_LEGALES_L6.md`.
 */
import { NOMBRE_PRODUCTO } from "./catalogo";
import { ALIANZA, INTERSEGUROS } from "./entidades";

/**
 * Marcador de un dato que la matriz no fija y que Legal tiene que completar.
 * Se muestra tal cual, con su distintivo, para que nadie lo lea como un dato.
 */
export const FALTA_DEFINICION_LEGAL = "[PENDIENTE DE DEFINICIÓN LEGAL]";

// ---------------------------------------------------------------------------
// P-01 · Identificación del canal (fila 1)
// ---------------------------------------------------------------------------

/**
 * Fila 1 · *"Informar que SeguroLoTengo.com es marca y canal digital de
 * Interseguros, no aseguradora"* — Ley 4868/13, arts. 3, 7(a) y 7(d);
 * Ley 827/96, arts. 70-71; Res. SS SG. 223/17, numeral 9(c).
 *
 * Se arma con `entidades.ts` y no con nombres escritos a mano: la razón social
 * y la matrícula tienen una sola fuente en todo el sistema.
 */
export const IDENTIFICACION_CANAL =
  `SeguroLoTengo es la marca y el canal digital de venta electrónica de ${INTERSEGUROS.razonSocial}, ` +
  `corredor de seguros inscripto en la Superintendencia de Seguros bajo Matrícula SIS N° ` +
  `${INTERSEGUROS.matriculaSis}. ${INTERSEGUROS.razonSocial} no es una compañía de seguros: ` +
  `intermedia la contratación. El ${NOMBRE_PRODUCTO} lo emite y lo respalda ` +
  `${ALIANZA.razonSocial}, que es la aseguradora y la única obligada al pago de las ` +
  `indemnizaciones.`;

export const VERSION_IDENTIFICACION_CANAL = "LEGAL-CANAL-v1";

// ---------------------------------------------------------------------------
// P-02 · Derecho de retracto (fila 64)
// ---------------------------------------------------------------------------

export const TITULO_RETRACTO = "Derecho de retracto";

/**
 * Fila 64 · *"Informar el derecho de retracto aplicable a la venta
 * electrónica"* — Ley 4868/13, arts. 30(b) y 26(f); Ley 1334/98, arts. 26-27.
 *
 * El plazo y su cómputo son los dos huecos: la fila manda informar el derecho
 * y no fija ninguno de los dos.
 */
export const PARRAFOS_RETRACTO: readonly string[] = [
  `Por tratarse de una contratación celebrada por medios electrónicos, podés retractarte sin ` +
    `expresar causa y sin penalidad dentro del plazo de ${FALTA_DEFINICION_LEGAL}, contado desde ` +
    `${FALTA_DEFINICION_LEGAL}.`,
  `Para ejercerlo alcanza con comunicarlo desde el correo que declaraste, o desde el WhatsApp que ` +
    `verificaste, indicando el número de tu solicitud. No hace falta ningún formulario.`,
  `Si ya se cobró el premio y no hubo siniestro, la devolución la tramita ${ALIANZA.razonSocial}; ` +
    `SeguroLoTengo asienta el pedido y te informa el estado. Si todavía no se cobró nada, no hay ` +
    `nada que devolver.`,
];

export const VERSION_RETRACTO = "LEGAL-RETRACTO-v1";

// ---------------------------------------------------------------------------
// P-03 · Datos personales (fila 84)
// ---------------------------------------------------------------------------

export const TITULO_PRIVACIDAD = "Tus datos personales";

export interface BloqueLegal {
  readonly titulo: string;
  readonly texto: string;
}

/**
 * Fila 84 · *"Aplicar privacidad desde el diseño y minimización de datos"* —
 * Ley 4868/13, arts. 6(a) y 7(b); Constitución Nacional, arts. 33 y 36.
 *
 * Los cuatro primeros bloques describen lo que el sistema hace y se pueden
 * demostrar; el quinto tiene el hueco de los plazos de conservación.
 */
export const BLOQUES_PRIVACIDAD: readonly BloqueLegal[] = [
  {
    titulo: "Qué datos pedimos y para qué",
    texto:
      "Para contratar este seguro pedimos: tu número de WhatsApp y tu correo, para verificarlos y " +
      "entregarte los documentos; las fotografías de tu cédula y una selfie en vivo, para " +
      "verificar que sos vos; los datos que figuran en tu cédula; tus datos de domicilio, " +
      "laborales y económicos, que exige el formulario de identificación de persona física; tus " +
      "declaraciones de salud y tu condición de Persona Expuesta Políticamente, que determinan si " +
      "la emisión puede ser automática; y los datos de facturación. No pedimos ningún dato que no " +
      "se use para alguna de esas cosas.",
  },
  {
    titulo: "Quién los trata",
    texto:
      `${INTERSEGUROS.razonSocial} como corredor y ${ALIANZA.razonSocial} como aseguradora, y los ` +
      "proveedores que hacen falta para ejecutar la contratación: verificación de identidad, " +
      "firma electrónica, procesamiento del pago y entrega de los documentos.",
  },
  {
    titulo: "Qué no hacemos",
    texto:
      "Tus respuestas de salud y tu condición PEP no salen hacia analítica, publicidad, gestión " +
      "comercial ni servicios de inteligencia artificial. El número completo de tu tarjeta y su " +
      "código de seguridad no se almacenan en ningún momento: los procesa Bancard.",
  },
  {
    titulo: "Tus derechos",
    texto:
      "Podés pedir acceso, actualización, rectificación y eliminación de tus datos escribiendo al " +
      "correo publicado más abajo. La eliminación tiene el límite de los plazos de conservación " +
      "que la normativa de seguros y de prevención de lavado impone a los documentos de una " +
      "contratación.",
  },
  {
    titulo: "Cuánto los conservamos",
    texto: `${FALTA_DEFINICION_LEGAL}.`,
  },
];

export const VERSION_PRIVACIDAD = "LEGAL-PRIVACIDAD-v1";

// ---------------------------------------------------------------------------
// P-04 · Cookies (fila 85)
// ---------------------------------------------------------------------------

export const TITULO_COOKIES = "Cookies";

/**
 * Fila 85 · *"Informar el uso de cookies y permitir rechazar las no
 * necesarias"* — Ley 4868/13, art. 30(c).
 *
 * **No hay panel de opciones, y es deliberado.** Las tres cookies del portal
 * son estrictamente necesarias para sostener el trámite y no hay ninguna de
 * analítica, publicidad ni de terceros: no existe una "no necesaria" que se
 * pueda rechazar. Ofrecer un panel con una sola opción imposible de desmarcar
 * sería teatro de consentimiento.
 *
 * El día que se incorpore analítica —PostHog está previsto post-piloto—, el
 * panel tiene que existir **antes** de que cargue nada.
 */
export const PARRAFOS_COOKIES: readonly string[] = [
  "Este portal usa tres cookies propias y estrictamente necesarias para sostener tu trámite: " +
    "mantienen tu sesión, recuerdan en qué solicitud estás y vinculan el código de verificación " +
    "que te enviamos. Sin ellas el trámite no puede continuar. Duran ocho horas, no son " +
    "accesibles desde el navegador y no se comparten con terceros.",
  "No usamos cookies de analítica, de publicidad ni de terceros, así que no hay ninguna que " +
    "puedas rechazar sin impedir la contratación. Si en el futuro incorporáramos alguna, te la " +
    "vamos a pedir antes de instalarla.",
];

export const VERSION_COOKIES = "LEGAL-COOKIES-v1";

/** Rótulo del aviso que aparece al entrar, antes de desplegar el detalle. */
export const AVISO_COOKIES_BREVE =
  "Usamos tres cookies necesarias para sostener tu trámite. No hay analítica ni publicidad.";

export const BOTON_ENTENDIDO_COOKIES = "Entendido";
