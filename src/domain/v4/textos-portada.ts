/**
 * Textos de la portada (01) y de sus cinco detalles (01A a 01E).
 *
 * **Transcritos de los artes aprobados**, con una sola transformación: el
 * registro. Los artes mezclan usted («Elija», «Conozca», «Si vuelve al
 * inicio») con tú, y D-35 fija **voseo** para todo el desarrollo. Donde el
 * texto es cita legal literal no se toca; donde le habla a la persona, sí.
 *
 * Nada de lo que está acá se escribe en una pantalla: las pantallas importan
 * estas constantes. Es la misma regla que en v2 (`textos-*.ts`) y por el mismo
 * motivo — un texto legal repetido en dos lugares es un texto que va a
 * divergir, y el que firma el proponente tiene que ser exactamente el que leyó.
 */

export const TEXTOS_01 = {
  heroeTitulo: "Tu seguro,",
  heroeTituloAcento: "fácil y rápido",
  heroeBajada: "Elegí tu producto y contratá de forma simple.",
  atributos: [
    { rotulo: "DIGITAL", pie: "Todo en línea." },
    { rotulo: "ÁGIL", pie: "En pocos pasos." },
    { rotulo: "CONFIABLE", pie: "Datos protegidos." },
  ],
  catalogoTitulo: "Seguros para cada necesidad",
  catalogoBajada: "Protegé lo que más te importa.",
  etiquetaDisponible: "Disponible",
  etiquetaProximamente: "Próximamente",
  enlaceLegal: "Información legal",
} as const;

/** El catálogo de la portada: seis productos, uno disponible. */
export const PRODUCTOS_01 = [
  { id: "oncologico", nombre: "Oncológico", disponible: true },
  { id: "vida", nombre: "Vida", disponible: false },
  { id: "accidentes", nombre: "Accidentes", disponible: false },
  { id: "salud", nombre: "Salud", disponible: false },
  { id: "mascotas", nombre: "Mascotas", disponible: false },
  { id: "viaje", nombre: "Viaje", disponible: false },
] as const;

/**
 * Banner de cookies de la portada.
 *
 * **No ofrece rechazar la analítica**, y eso es lo que dice el arte y el
 * manual: es un «he leído y entendido», no un consentimiento con opción de
 * negativa. Queda anotado como punto para Legal en el análisis visual (§1.1);
 * no se le agrega un botón que el arte no tiene.
 */
export const TEXTOS_COOKIES = {
  cuerpo:
    "Usamos cookies necesarias para que el sitio web y su trámite funcionen correctamente. También utilizamos cookies analíticas de Google Analytics para medir el uso del sitio y mejorar su funcionamiento. No utilizamos cookies de publicidad.",
  verDetalle: "VER EL DETALLE",
  aceptar: "HE LEÍDO Y ENTENDIDO",
} as const;

export const TEXTOS_01A = {
  titulo: "Detalle de cookies",
  bajada: "Información clara antes de continuar.",
  tarjetas: [
    {
      titulo: "Cookies necesarias",
      cuerpo:
        "Permiten el funcionamiento del sitio, la seguridad del trámite y la continuidad de la contratación. Permanecen activas porque son indispensables.",
    },
    {
      titulo: "Cookies analíticas",
      cuerpo:
        "Usamos Google Analytics para medir el uso del sitio y mejorar su funcionamiento. No se usan para publicidad ni se envían señales publicitarias. La información analítica se conserva hasta 24 meses.",
    },
  ],
} as const;

export const TEXTOS_01B_MENU = {
  titulo: "Menú",
  opciones: [
    { id: "inicio", rotulo: "INICIO" },
    { id: "responsabilidades", rotulo: "RESPONSABILIDADES" },
    { id: "contacto", rotulo: "CONTACTO" },
  ],
  pie: ["SeguroLoTengo · canal digital de", "Interseguros S.A."],
  enlaceLegal: "Información legal",
} as const;

/**
 * Confirmación de salida (01B · confirmación de salida).
 *
 * El botón destructivo es el **rojo**, que en todo el resto del producto es el
 * de avanzar. Se implementa como está —manda el arte— y queda anotado en el
 * análisis visual §1.4.
 */
export const TEXTOS_01B_SALIDA = {
  titulo: "¿Volver al inicio?",
  cuerpo:
    "Si volvés al inicio, se cerrará la sesión y se descartará todo el avance de esta contratación. Para continuar, vas a tener que empezar de nuevo.",
  continuar: "CONTINUAR CONTRATACIÓN",
  salir: "SALIR Y DESCARTAR",
} as const;

export const TEXTOS_01C = {
  titulo: "Responsabilidades",
  bajada: "Quién interviene y qué función cumple.",
  tarjetas: [
    {
      titulo: "SEGUROLOTENGO",
      cuerpo:
        "Es la marca y el canal digital de Interseguros S.A. mediante el cual se completa el proceso de contratación.",
    },
    {
      titulo: "INTERSEGUROS S.A.",
      cuerpo:
        "Es el corredor de seguros - Matrícula SIS N.º 118 - y el intermediario en la contratación. Brinda asistencia y seguimiento antes, durante y después de la emisión de la póliza.",
    },
    {
      titulo: "ALIANZA GARANTÍA SEGUROS Y REASEGUROS S.A.",
      cuerpo:
        "Es la aseguradora que emite la póliza, asume el riesgo, brinda la cobertura y paga las indemnizaciones cuando corresponde, conforme a las condiciones del seguro.",
    },
  ],
} as const;

export const TEXTOS_01D = {
  titulo: "Contacto",
  bajada: "Atención del intermediario.",
  canalesTitulo: "Canales oficiales",
  canalesCuerpo:
    "Para consultas, solicitudes, cambios, modificaciones o renovaciones de la póliza, comunicate con Interseguros S.A.",
  etiquetas: {
    whatsapp: "WhatsApp oficial",
    correo: "Correo electrónico",
    oficinas: "Oficinas",
  },
} as const;

export const TEXTOS_01E = {
  titulo: "Información legal",
  bajada: "Todos los documentos y avisos en un solo lugar.",
  tarjetas: [
    {
      id: "privacidad",
      titulo: "Aviso de privacidad",
      cuerpo: "Conocé cómo se usan y protegen tus datos personales.",
    },
    {
      id: "cookies",
      titulo: "Cookies",
      cuerpo:
        "Consultá el detalle de las cookies necesarias y analíticas utilizadas por el sitio.",
    },
    {
      id: "responsabilidades",
      titulo: "Responsabilidades",
      cuerpo:
        "Identificá las funciones de SeguroLoTengo, Interseguros y Alianza Garantía.",
    },
    {
      id: "contacto",
      titulo: "Contacto",
      cuerpo: "Accedé a los canales oficiales de Interseguros S.A.",
    },
  ],
} as const;

/**
 * El aviso de privacidad unificado (03B · 02A y 02B), que también se abre
 * desde 01E. Es **una sola hoja larga**: los dos artes son el mismo modal
 * arriba del todo y desplazado hasta el fondo.
 */
export const TEXTOS_AVISO_PRIVACIDAD = {
  titulo: "Aviso de privacidad",
  bajada: "Consultá cómo utilizamos y protegemos tus datos.",
  indicacionDeslizar: "Deslizá para consultar todo el aviso",
  tarjetas: [
    {
      titulo: "QUIÉNES INTERVIENEN",
      cuerpo:
        "Interseguros S.A. gestiona el canal digital y la intermediación de la contratación. Alianza Garantía Seguros y Reaseguros S.A. utiliza la información necesaria para evaluar el riesgo, emitir la póliza y administrar la cobertura.",
    },
    {
      titulo: "PARA QUÉ USAMOS TUS DATOS",
      cuerpo:
        "Para verificar tu identidad y tus canales de contacto; validar tu cédula, fotografías, datos biométricos y prueba de vida; evaluar requisitos, declaraciones de salud y condición PEP; preparar la Solicitud de Seguro y el FIPF; gestionar la contratación, emisión y administración de la póliza; y cumplir las obligaciones legales y regulatorias aplicables.",
    },
    {
      titulo: "DATOS QUE PODEMOS TRATAR",
      cuerpo:
        "Datos de identidad y contacto; cédula; fotografías, datos biométricos y prueba de vida; información laboral, económica y financiera; declaraciones de salud; condición PEP; datos del beneficiario; y registros necesarios para acreditar las decisiones y aceptaciones realizadas durante el proceso.",
    },
    {
      titulo: "PAGO CON TARJETA",
      cuerpo:
        "Bancard procesa el pago. Interseguros S.A. no recibe ni administra los fondos y no almacena los datos completos de la tarjeta.",
    },
    {
      titulo: "ANALÍTICA DEL SITIO",
      cuerpo:
        "Google Analytics se utiliza para medir el uso del sitio y mejorar su funcionamiento. No se utiliza con fines publicitarios ni se envían señales de publicidad. La información analítica se conserva hasta 24 meses.",
    },
    {
      titulo: "CONSERVACIÓN",
      cuerpo:
        "Los registros de la contratación y sus respaldos se conservan durante los plazos legales aplicables.",
    },
    {
      titulo: "TUS DERECHOS Y CONTACTO",
      cuerpo:
        "Podés solicitar información sobre tus datos personales, pedir su corrección o actualización o retirar las autorizaciones voluntarias escribiendo a segurolotengo@interseguros360.com.",
    },
  ],
} as const;
