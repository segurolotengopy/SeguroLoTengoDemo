/**
 * La aceptación agrupada del paso 1 del flujo v3 (`ACEPTACIÓN Y CONTINUAR`),
 * tal como figura en docs/ESPECIFICACION_PANTALLAS.md → "Paso 1 · Inscribite"
 * y decidió DI-8 (Bloque E de docs/plan/DECISIONES.md): **una casilla** con un
 * expandible «Ver todo lo que aceptás» que muestra los siete ítems.
 *
 * Mismo criterio que `textos-p3.ts`: módulo sin ninguna dependencia porque lo
 * consumen las dos orillas — la pantalla muestra los ítems por separado, el
 * servidor persiste el literal completo. **Al cambiar una sola palabra hay que
 * subir la versión**: la evidencia guardada apunta a la versión vieja con su
 * texto y no se reescribe nunca.
 *
 * En v3 este literal reemplaza al de P3 como texto de la autorización inicial
 * (la aceptación agrupada ES la autorización que transiciona a AUTORIZADO);
 * en v2 sigue rigiendo `textos-p3.ts`. La selección vive en
 * `autorizacion-inicial.ts`, por flag, igual que las constantes del lote F1.
 *
 * El ítem 1 excluye la publicidad a propósito: el consentimiento comercial es
 * separado, opcional y no premarcado (D-01, fila 12 de la matriz — Ley
 * 4868/13, arts. 20, 23 y 30(a)) y vive en la pantalla de confirmación.
 */

/** Rótulo de la casilla única (DI-8). */
export const ROTULO_ACEPTACION_INSCRIPCION =
  "Marcá acá para aceptar todo lo necesario para inscribirte — autorizaciones de datos, " +
  "biometría y firma electrónica, en un solo paso.";

/**
 * Los siete ítems del expandible, en el orden del canvas. La pantalla los
 * dibuja como lista; lo que se persiste es su concatenación exacta.
 */
export const ITEMS_ACEPTACION_INSCRIPCION: readonly string[] = [
  "Autorizo usar mi número y mi correo para verificar mis canales, recibir mis documentos y " +
    "continuar el proceso. Sobre la publicidad y ofertas se confirma aparte, es opcional y te " +
    "la pedimos al final, en la pantalla de aceptación.",
  "Autorizo a Interseguros S.A. y Alianza Garantía a tratar y compartir mis datos personales, " +
    "de identificación, biométricos, médicos y de condición PEP para validar mi identidad, " +
    "evaluar el riesgo, gestionar la solicitud y cumplir obligaciones regulatorias.",
  "Autorizo la lectura automática de mi cédula, la captura de mi imagen facial y su " +
    "comparación con la fotografía del documento, junto con la prueba de vida.",
  "Declaro que los datos extraídos de mi cédula que confirmé y los que completé son " +
    "verdaderos y están vigentes.",
  "Acepto quedar registrado para firmar electrónicamente mediante el proveedor de firma " +
    "electrónica que utilice Interseguros (firma electrónica simple autenticada por código de " +
    "un solo uso).",
  "Si la emisión automática no es posible, autorizo el envío del caso a Interseguros y " +
    "Alianza para su análisis y que puedan contactarme.",
  "Declaro que contrato este seguro únicamente para mí y que el WhatsApp y el correo " +
    "declarados son míos y están bajo mi control.",
];

/** Nota bajo la casilla, tal como la escribe la especificación. */
export const NOTA_ACEPTACION_INSCRIPCION =
  "Esto no contrata ni autoriza un pago. Se registran fecha, hora, IP y la versión del texto " +
  "aceptado.";

/**
 * El literal que se persiste en el expediente y en la evidencia: los siete
 * ítems en el orden en que se muestran, más la nota. Partirlos para maquetar
 * no cambia ni un carácter de lo aceptado.
 */
export const TEXTO_ACEPTACION_INSCRIPCION = `${ITEMS_ACEPTACION_INSCRIPCION.join(" ")} ${NOTA_ACEPTACION_INSCRIPCION}`;

export const VERSION_ACEPTACION_INSCRIPCION = "INSCRIPCION-ACEPTACION-v1";
