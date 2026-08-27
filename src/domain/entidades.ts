/**
 * Datos institucionales de las dos entidades y de la marca del portal.
 *
 * **Fuente única de verdad** de razón social, actividad autorizada, matrícula,
 * domicilio, teléfono, correo y sitio web. Cualquier pantalla que muestre uno
 * de esos datos lo toma de acá: hasta ahora estaban escritos a mano en la
 * cabecera y en el pie de P9, y por eso los wireframes llegaron con datos de
 * contacto provisorios distintos en cada lugar.
 *
 * Procedencia de los datos (Matriz Legal Final V4, §1 "Entidades, roles y
 * datos institucionales", y §5 "Campos legales" → fila *Aseguradora*, estado
 * CERRADO):
 *
 *   Alianza Garantía Seguros y Reaseguros S.A. — Avda. Mariscal López 1044
 *   c/ Mayor Bullo, Asunción · (021) 236 0000 · alianzagarantia.com
 *   Interseguros S.A. — Avda. Aviadores del Chaco 2351, Campos Cervera,
 *   Edificio Plaza Center 7.º piso, Asunción · Matrícula SIS 118 ·
 *   RUC 80133988 · interseguros360.com
 *
 * Lo que todavía no tenemos (D-19 de docs/plan/DECISIONES.md) viaja como
 * `null`, **nunca como un dato inventado**: quien lo consuma decide si lo
 * oculta o lo rotula como pendiente. Un teléfono de fantasía en una pantalla
 * de seguros es un problema regulatorio, no un detalle de maquetado.
 *
 * ## Por qué la marca no se expone sola
 *
 * `MARCA_FANTASIA` es un nombre de fantasía y la Res. SS.SG. N° 190/2025 (con
 * la Circular SS.SG. N° 011/2025) **prohíbe exponerlo públicamente sin
 * autorización expresa previa de la SIS**, que es el pendiente §8.1 de la
 * matriz. Por eso no se lee directo: se pide con `marcaVisible()`, que
 * devuelve `null` mientras el flag esté apagado. El frente público muestra
 * entonces la denominación registrada con el formato de la Circular 011/2025
 * (razón social + actividad + matrícula), que es lo que `IDENTIFICACION_SIS`
 * arma.
 */

/** Datos de una entidad tal como se muestran y se citan. */
export interface Entidad {
  readonly razonSocial: string;
  /** Actividad autorizada, en los términos del registro ante la SIS. */
  readonly actividad: string;
  /** Matrícula ante la Superintendencia de Seguros, si la entidad la tiene. */
  readonly matriculaSis: string | null;
  readonly ruc: string | null;
  readonly domicilio: string;
  /** Sitio oficial, con esquema. Se enlaza desde logo y nombre (TRV-04). */
  readonly sitioWeb: string;
  /** `null` mientras no lo tengamos: no se inventa (D-19). */
  readonly telefono: string | null;
  /** `null` mientras no lo tengamos: no se inventa (D-19). */
  readonly correoAtencion: string | null;
}

export const ALIANZA: Entidad = {
  razonSocial: "Alianza Garantía Seguros y Reaseguros S.A.",
  actividad: "Compañía de seguros",
  matriculaSis: null,
  ruc: null,
  domicilio: "Avda. Mariscal López 1044 c/ Mayor Bullo, Asunción",
  sitioWeb: "https://alianzagarantia.com",
  telefono: "(021) 236 0000",
  correoAtencion: null,
};

export const INTERSEGUROS: Entidad = {
  razonSocial: "Interseguros S.A.",
  actividad: "Corredores de Seguros",
  matriculaSis: "118",
  ruc: "80133988",
  domicilio:
    "Avda. Aviadores del Chaco 2351, Campos Cervera, Edificio Plaza Center 7.º piso, Asunción",
  sitioWeb: "https://interseguros360.com",
  telefono: null,
  correoAtencion: null,
};

/**
 * Correo publicado para el ejercicio del retracto (Ley 1334/1998, art. 26) y
 * de los derechos sobre datos personales — acceso, actualización,
 * rectificación y eliminación.
 *
 * La matriz lo da por CERRADO **solo para esos dos usos**. No es todavía el
 * correo de atención general: ese es parte de D-19 y por eso
 * `INTERSEGUROS.correoAtencion` sigue en `null`.
 */
export const CORREO_RETRACTO_Y_DATOS = "segurolotengo@interseguros360.com";

/**
 * Número de WhatsApp del botón de contacto directo con Interseguros (CHG-45).
 * Pendiente de D-19; hasta tenerlo, el botón no se muestra.
 */
export const WHATSAPP_ATENCION: string | null = null;

// ---------------------------------------------------------------------------
// Datos pendientes de D-19 · parametrizados, nunca inventados
// ---------------------------------------------------------------------------

/**
 * Lo que la matriz todavía no cerró viaja por entorno.
 *
 * D-19 decidió que estos cuatro datos —teléfono y correo de atención de
 * Interseguros, correo de atención de Alianza y el número del botón de
 * WhatsApp— *"quedan parametrizables; Andres/Rodrigo pasan los datos cuando
 * los tengan"*. Parametrizarlos es lo que permite mostrarlos en una
 * demostración sin escribir un teléfono de fantasía en el código, que en una
 * pantalla de seguros es un problema regulatorio.
 *
 * Sin variable definida, cada uno sigue siendo `null` y **la pantalla omite el
 * dato** en vez de mostrar un marcador: un `[datos oficiales]` a la vista de
 * un cliente es peor que no decir nada.
 *
 * `NEXT_PUBLIC_` porque el pie de la confirmación se dibuja en el servidor y
 * el botón de WhatsApp en el cliente: si cada orilla leyera una variable
 * distinta, podrían discrepar.
 *
 * **Cada variable se lee escrita entera y a mano** —`process.env.NEXT_PUBLIC_X`
 * y nunca `process.env[nombre]`—: Next reemplaza esas expresiones por su valor
 * al compilar el bundle del navegador, y una lectura por índice no se
 * reemplaza. Con un helper genérico, el servidor vería el dato y el cliente
 * `undefined`, que es la clase de discordancia que este módulo existe para
 * evitar.
 */
function limpiar(valor: string | undefined): string | null {
  return valor && valor.trim() !== "" ? valor.trim() : null;
}

export interface ContactoInstitucional {
  readonly entidad: Entidad;
  /** Qué resuelve esta entidad, para que la persona sepa a quién escribirle. */
  readonly rol: string;
  readonly telefono: string | null;
  readonly correo: string | null;
}

/**
 * Los dos contactos de la pantalla de confirmación (CHG-45), con lo que se
 * sabe y sin lo que no.
 */
export function contactosInstitucionales(): readonly ContactoInstitucional[] {
  return [
    {
      entidad: ALIANZA,
      rol: "Emisión de la póliza, cobertura y reclamos",
      telefono: limpiar(process.env.NEXT_PUBLIC_ALIANZA_TELEFONO) ?? ALIANZA.telefono,
      correo: limpiar(process.env.NEXT_PUBLIC_ALIANZA_CORREO) ?? ALIANZA.correoAtencion,
    },
    {
      entidad: INTERSEGUROS,
      rol: "Asistencia y seguimiento de tu contratación",
      telefono: limpiar(process.env.NEXT_PUBLIC_INTERSEGUROS_TELEFONO) ?? INTERSEGUROS.telefono,
      // El correo de retracto y datos está CERRADO en la matriz solo para esos
      // dos usos; como correo de atención general sigue pendiente, así que acá
      // no se lo reusa (ver `CORREO_RETRACTO_Y_DATOS`).
      correo: limpiar(process.env.NEXT_PUBLIC_INTERSEGUROS_CORREO) ?? INTERSEGUROS.correoAtencion,
    },
  ];
}

/**
 * Número del botón de WhatsApp de la pantalla de confirmación (D-17).
 *
 * D-17 lo decidió **solo para esa pantalla**, con un flag para extenderlo:
 * `NEXT_PUBLIC_WHATSAPP_EN_TODO_EL_FLUJO=true`. Mientras no exista número, no
 * hay botón — no se enlaza un WhatsApp inventado.
 */
export function whatsappAtencion(): string | null {
  return limpiar(process.env.NEXT_PUBLIC_WHATSAPP_ATENCION) ?? WHATSAPP_ATENCION;
}

/** D-17 · el botón vive en la confirmación salvo que se lo extienda por flag. */
export function whatsappHabilitadoEn(pantalla: "CONFIRMACION" | "OTRA"): boolean {
  if (whatsappAtencion() === null) return false;
  if (pantalla === "CONFIRMACION") return true;
  return process.env.NEXT_PUBLIC_WHATSAPP_EN_TODO_EL_FLUJO === "true";
}

/**
 * El número en el formato que espera `wa.me`: solo dígitos, sin `+` ni
 * separadores.
 */
export function enlaceWhatsapp(numero: string, mensaje: string): string {
  const digitos = numero.replace(/\D/g, "");
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}

/** Nombre comercial del portal. Ver `marcaVisible()` antes de mostrarlo. */
export const MARCA_FANTASIA = "Seguro Lo Tengo";

/**
 * Identificación regulatoria permanente, con el formato de exposición de la
 * Circular SS.SG. N° 011/2025: razón social + actividad + matrícula.
 *
 * Va visible, legible y permanente en todas las pantallas (Res. 190/2025).
 */
export const IDENTIFICACION_SIS = `${INTERSEGUROS.razonSocial} · ${INTERSEGUROS.actividad} · Matrícula SIS N° ${INTERSEGUROS.matriculaSis}`;

/**
 * La marca comercial solo si la SIS ya la autorizó.
 *
 * Devuelve `null` por defecto: mientras el nombre de fantasía no esté
 * registrado (DINAPI + SIS, pendiente §8.1 de la matriz), exponerlo en el
 * frente público incumple la Res. 190/2025. El flag se enciende recién con la
 * autorización en mano, y aun entonces la identificación registrada sigue
 * visible: la marca la acompaña, no la reemplaza.
 */
export function marcaVisible(): string | null {
  // `NEXT_PUBLIC_` a propósito: esto se consulta tanto en el servidor como en
  // componentes de cliente, y si cada lado leyera una variable distinta el
  // servidor podría pintar la marca y el navegador la razón social, o al
  // revés. Un mismo valor en las dos orillas evita esa discordancia.
  return process.env.NEXT_PUBLIC_MARCA_FANTASIA_AUTORIZADA === "true" ? MARCA_FANTASIA : null;
}

/**
 * Cómo nombrar al portal en un texto corrido.
 *
 * Con la marca autorizada devuelve la marca; sin autorización devuelve la
 * denominación registrada, que es lo que la Res. 190/2025 permite exponer.
 * Se usa en frases como "el código no pasa por …", donde hace falta un sujeto
 * y no se puede dejar un hueco.
 */
export function nombrePortal(): string {
  return marcaVisible() ?? INTERSEGUROS.razonSocial;
}

/**
 * Sufijo de los títulos de pestaña: `Prepará lo necesario · <portal>`.
 *
 * Los títulos también son exposición pública —quedan en el historial del
 * navegador y en las capturas—, así que siguen la misma regla que el resto.
 */
export function sufijoTitulo(): string {
  return nombrePortal();
}
