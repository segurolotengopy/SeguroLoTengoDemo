/**
 * Textos explicativos de los enlaces de aclaración del flujo (P2, P3, P5 y
 * portada). Cada entrada alimenta el modal `EnlaceAclaracion` de
 * `src/components/shared/AclaracionModal.tsx`, que los muestra sobre la
 * pantalla y permite descargarlos como archivo de texto.
 *
 * Son textos informativos del canal digital, no citas normativas: ninguno
 * cita artículos de ley (regla de trabajo con los documentos de CLAUDE.md).
 * Módulo sin `node:*`: se importa desde componentes de cliente.
 */

export interface SeccionAclaracion {
  readonly titulo?: string;
  readonly parrafos: readonly string[];
}

export interface DocumentoAclaracion {
  readonly id: string;
  readonly titulo: string;
  readonly version: string;
  readonly secciones: readonly SeccionAclaracion[];
}

export const ACLARACION_COBERTURAS: DocumentoAclaracion = {
  id: "coberturas-exclusiones-condiciones",
  titulo: "Coberturas, exclusiones y condiciones — Seguro de Vida Oncológico CONFÍO",
  version: "v1.0",
  secciones: [
    {
      titulo: "Coberturas incluidas",
      parrafos: [
        "Muerte por cualquier causa: se abona a los beneficiarios designados la suma asegurada del plan contratado, en un pago único.",
        "Indemnización por diagnóstico de cáncer: ante el primer diagnóstico confirmado de cáncer durante la vigencia y superado el período de carencia, se abona al titular la suma asegurada del plan en un pago único, independiente de los gastos de tratamiento.",
        "Renta diaria por hospitalización: por cada 24 horas continuas de internación se abona la renta diaria del plan, con un máximo de 15 días acumulables por año de vigencia.",
        "Gastos médicos por accidente: reembolso de gastos médicos derivados de un accidente, contra presentación de facturas y comprobantes originales, hasta la suma asegurada del plan.",
      ],
    },
    {
      titulo: "Períodos de carencia",
      parrafos: [
        "Cáncer: 180 días corridos desde el inicio de la cobertura.",
        "Renta por hospitalización: 30 días corridos desde el inicio de la cobertura.",
        "Demás coberturas: 1 día desde el inicio de la cobertura.",
        "La cobertura comienza 24 horas después del pago confirmado, una vez completada la contratación y la firma del cliente.",
      ],
    },
    {
      titulo: "Exclusiones principales",
      parrafos: [
        "Enfermedades o dolencias preexistentes al inicio de la cobertura, diagnosticadas o con síntomas conocidos por la persona asegurada.",
        "Lesiones autoinfligidas y suicidio durante el primer año de vigencia.",
        "Consecuencias directas de la participación en actos delictivos, guerra, o actividades de riesgo extraordinario no declaradas.",
        "Tratamientos estéticos, experimentales o no reconocidos por la autoridad sanitaria.",
        "El detalle completo de exclusiones figura en las Condiciones Generales y Particulares de la póliza, que se entregan junto con la documentación contractual.",
      ],
    },
    {
      titulo: "Condiciones de edad y renovación",
      parrafos: [
        "Edad de ingreso: entre 18 y 64 años, verificada contra la cédula de identidad.",
        "Permanencia: hasta los 65 años; hasta los 75 años para personas con diez años de cobertura continua antes de cumplir 65.",
        "El diagnóstico confirmado de cáncer impide la renovación; la póliza vigente continúa hasta finalizar el período contratado.",
      ],
    },
    {
      titulo: "Pago de beneficios",
      parrafos: [
        "Indemnización por cáncer: dentro de los 5 días hábiles desde la presentación completa del reclamo.",
        "Gastos por accidente: por reembolso contra facturas y comprobantes, hasta la suma asegurada.",
        "Aseguradora: Alianza Garantía Seguros y Reaseguros S.A. Corredor: Interseguros S.A. Los premios informados son anuales, finales y con IVA incluido.",
      ],
    },
  ],
};

export const ACLARACION_DOCUMENTACION_PRECONTRACTUAL: DocumentoAclaracion = {
  id: "documentacion-precontractual",
  titulo: "Documentación precontractual completa",
  version: "v1.1",
  secciones: [
    {
      parrafos: [
        "Antes de la firma vas a poder revisar y descargar todos los documentos que rigen la contratación. Ninguna aceptación se produce por leer esta información: la aceptación contractual se realiza únicamente mediante la firma electrónica, al final del proceso.",
      ],
    },
    {
      titulo: "Documentos que componen la contratación",
      parrafos: [
        "Solicitud de Seguro: recoge tus datos personales, el plan y las coberturas elegidas, la designación de beneficiarios, la declaración médica y las declaraciones finales. Se firma electrónicamente.",
        "Formulario de Identificación de Persona Física (FIPF): formulario de identificación exigido por la normativa de prevención de lavado de activos, con datos personales, laborales y de origen de fondos. Se firma en el mismo acto que la Solicitud.",
        "Condiciones Generales y Particulares de la póliza: describen en detalle coberturas, exclusiones, carencias, cargas y procedimientos de reclamo.",
        "La póliza y la factura las emite y envía Alianza Garantía Seguros y Reaseguros S.A. una vez aceptada la solicitud; conservan el mismo número correlativo de la propuesta.",
      ],
    },
    {
      titulo: "Información relevante",
      parrafos: [
        "El diagnóstico confirmado de cáncer impide la renovación; la póliza continúa hasta finalizar la vigencia contratada.",
        "Los importes publicados son premios anuales finales con IVA incluido; no existen cargos adicionales por la contratación electrónica.",
        "Tenés derecho a solicitar copia de toda la documentación firmada, que además se te entrega automáticamente por correo electrónico al finalizar el proceso.",
      ],
    },
  ],
};

export const ACLARACION_CONSULTAS_RECLAMOS: DocumentoAclaracion = {
  id: "consultas-reclamos",
  titulo: "Consultas y reclamos",
  version: "v1.0",
  secciones: [
    {
      titulo: "Canales de atención",
      parrafos: [
        "Correo electrónico: atencion@segurolotengo.com.py — respuesta dentro de las 48 horas hábiles.",
        "WhatsApp: el mismo número verificado en el proceso recibe también las notificaciones del expediente.",
        "Atención presencial: oficinas de Interseguros S.A., Asunción, en días y horarios hábiles.",
      ],
    },
    {
      titulo: "Cómo presentar un reclamo",
      parrafos: [
        "Indicá tu número de cédula y, si lo tenés, el número de propuesta o de caso que figura en tus comunicaciones.",
        "Describí el motivo del reclamo y adjuntá la documentación de respaldo que consideres pertinente.",
        "Vas a recibir un número de seguimiento y una respuesta formal dentro de los plazos establecidos por la normativa de defensa del consumidor y de la Superintendencia de Seguros.",
      ],
    },
    {
      titulo: "Instancias posteriores",
      parrafos: [
        "Si la respuesta no te resulta satisfactoria, podés recurrir a la Superintendencia de Seguros del Banco Central del Paraguay o a las instancias de defensa del consumidor, sin costo y sin perjuicio de las acciones legales que te correspondan.",
      ],
    },
  ],
};

export const ACLARACION_AVISO_PRIVACIDAD: DocumentoAclaracion = {
  id: "aviso-privacidad",
  titulo: "Aviso de privacidad y tratamiento de datos personales",
  version: "v1.0",
  secciones: [
    {
      titulo: "Responsables del tratamiento",
      parrafos: [
        "Los datos que ingresás en este proceso son tratados por Interseguros S.A. (corredor de seguros) y Alianza Garantía Seguros y Reaseguros S.A. (aseguradora), con AAB1 como operador tecnológico del canal.",
      ],
    },
    {
      titulo: "Finalidad del tratamiento",
      parrafos: [
        "Verificar tu identidad y tu titularidad de los canales de contacto (WhatsApp y correo electrónico).",
        "Evaluar la solicitud del seguro, emitir la póliza y gestionar el contrato durante su vigencia.",
        "Cumplir las obligaciones legales de identificación de clientes y prevención de lavado de activos.",
      ],
    },
    {
      titulo: "Protección de datos sensibles",
      parrafos: [
        "Las respuestas de la declaración médica y la condición de Persona Expuesta Políticamente se usan exclusivamente para evaluar la solicitud y cumplir obligaciones regulatorias. No se comparten con servicios de analítica, publicidad ni sistemas de inteligencia artificial.",
        "Los códigos de verificación no se almacenan en texto claro y los datos de tarjeta son procesados únicamente por Bancard: este sitio nunca guarda el número completo de la tarjeta ni el código de seguridad.",
      ],
    },
    {
      titulo: "Tus derechos",
      parrafos: [
        "Podés solicitar el acceso, la rectificación o la actualización de tus datos personales escribiendo a atencion@segurolotengo.com.py, acreditando tu identidad.",
        "El registro de evidencia del proceso (fechas, resultados y textos aceptados) se conserva por el plazo legal como respaldo de la contratación electrónica y no se altera ni se elimina.",
      ],
    },
  ],
};

export const ACLARACION_TERMINOS_CONDICIONES: DocumentoAclaracion = {
  id: "terminos-condiciones",
  titulo: "Términos y condiciones del canal digital",
  version: "v1.1",
  secciones: [
    {
      titulo: "Sobre el canal",
      parrafos: [
        "SeguroLoTengo.com es la marca y el canal digital de venta de Interseguros S.A., corredor de seguros inscripto ante la Superintendencia de Seguros. La aseguradora del producto es Alianza Garantía Seguros y Reaseguros S.A.",
        "El canal permite contratar el Seguro de Vida Oncológico CONFÍO íntegramente en línea, con verificación de identidad, pago electrónico y firma electrónica.",
      ],
    },
    {
      titulo: "Condiciones de uso",
      parrafos: [
        "La contratación es personal: solo el titular verificado puede contratar para sí mismo. No se admite la contratación en nombre de terceros.",
        "Los códigos de verificación son de uso único y personal; compartirlos deja sin efecto la garantía de autenticidad del proceso.",
        "El proceso queda registrado paso a paso (fecha, hora, dirección IP, dispositivo y textos aceptados) como evidencia de la contratación electrónica.",
      ],
    },
    {
      titulo: "Perfeccionamiento del contrato",
      parrafos: [
        "Ningún paso previo a la firma constituye aceptación contractual: la selección del plan, la verificación de canales y la autorización inicial solo preparan la solicitud.",
        "La aceptación se produce con la firma electrónica de la Solicitud y del FIPF, en un único acto. La emisión de la póliza corresponde a la aseguradora una vez aceptada la solicitud y confirmado el pago.",
        "El pago se procesa a través de Bancard; la cobertura comienza 24 horas después del pago confirmado, completada la contratación.",
      ],
    },
  ],
};

export const ACLARACION_REQUISITOS_IDENTIDAD: DocumentoAclaracion = {
  id: "requisitos-verificacion-identidad",
  titulo: "Requisitos de la verificación de identidad",
  version: "v1.0",
  secciones: [
    {
      parrafos: [
        "La verificación de identidad protege tu contratación: garantiza que solo vos podés contratar con tu cédula y que los datos de la solicitud salen del documento, no de un formulario tipeado.",
      ],
    },
    {
      titulo: "Qué se verifica",
      parrafos: [
        "Cédula paraguaya vigente: se fotografían el frente y el dorso; los datos se extraen automáticamente del documento y no se pueden editar a mano.",
        "Coincidencia facial: una selfie en vivo se compara con la fotografía de la cédula.",
        "Prueba de vida: se comprueba que la captura es de una persona presente, no de una foto o un video.",
        "Edad permitida: entre 18 y 64 años, calculada con la fecha de nacimiento de la cédula.",
      ],
    },
    {
      titulo: "Recomendaciones para la captura",
      parrafos: [
        "Usá buena iluminación, apoyá la cédula sobre una superficie plana y evitá reflejos sobre el plástico.",
        "Si algún dato extraído no coincide con tu documento, repetí la captura: es el único camino previsto ante una discrepancia.",
        "Si la verificación no aprueba, el caso pasa a revisión manual y se genera un número de caso propio; nadie queda contratado sin identidad verificada.",
      ],
    },
  ],
};

/** Catálogo por id, para resolver el documento desde el componente. */
export const DOCUMENTOS_ACLARACION = {
  coberturas: ACLARACION_COBERTURAS,
  documentacionPrecontractual: ACLARACION_DOCUMENTACION_PRECONTRACTUAL,
  consultasReclamos: ACLARACION_CONSULTAS_RECLAMOS,
  avisoPrivacidad: ACLARACION_AVISO_PRIVACIDAD,
  terminosCondiciones: ACLARACION_TERMINOS_CONDICIONES,
  requisitosIdentidad: ACLARACION_REQUISITOS_IDENTIDAD,
} as const;

export type IdDocumentoAclaracion = keyof typeof DOCUMENTOS_ACLARACION;
