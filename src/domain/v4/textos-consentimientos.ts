/**
 * Textos de 04A (datos y declaraciones) y 04D (consentimientos).
 *
 * Las tres preguntas de salud y los dos textos de consentimiento son **los
 * literales que la persona acepta**: el de 04D se guarda íntegro en la
 * evidencia con su versión, y las tres declaraciones se imprimen en la
 * Solicitud. Cambiar una coma es cambiar lo que alguien firmó, así que cambia
 * también `VERSION_CONSENTIMIENTOS_04D`.
 *
 * Los dos textos con casilla coinciden palabra por palabra con
 * `consents[digital_delivery]` y `consents[coverage_waiting_periods]` de
 * `screens.json`. El tercer bloque —intermediario y canal de atención— es
 * **informativo y sin casilla** (manual, ANALISIS.md §3) y su texto es el del
 * arte, más largo que el del JSON.
 */

export const TEXTOS_04A = {
  titulo: "Datos y ",
  tituloAcento: "declaraciones",
  bajada: "Completá la información requerida para preparar la Solicitud y el FIPF.",

  seccionSalud: "DECLARACIONES DE SALUD",
  preguntas: [
    {
      clave: "estadoDeSalud",
      texto:
        "Declaro que me encuentro en buen estado de salud y que no estoy contratando este seguro para cubrir una enfermedad, diagnóstico o condición médica preexistente.",
    },
    {
      clave: "antecedentesDeContratacion",
      texto:
        "¿Alguna aseguradora rechazó, postergó o condicionó alguna solicitud tuya de seguro de vida, de salud o de características similares?",
    },
    {
      clave: "enfermedadesDiagnosticadas",
      texto:
        "¿Te diagnosticaron o estás actualmente en tratamiento por alguna de las siguientes enfermedades o condiciones médicas: cáncer, enfermedad cardiovascular, insuficiencia renal, diabetes, esclerosis, enfermedad autoinmune, inmunodeficiencia, hepatitis o cirrosis?",
    },
  ],

  seccionBeneficiario: "BENEFICIARIO POR FALLECIMIENTO",
  opciones: {
    herederos: "Herederos legales — 100%",
    designada: "Designar una persona — 100%",
  },
  etiquetas: {
    nombre: "Nombre completo",
    domicilio: "Domicilio completo",
    parentesco: "Parentesco",
    cedula: "N.º de cédula del beneficiario",
  },
  marcadores: {
    nombre: "Ingresá el nombre completo",
    domicilio: "Ingresá el domicilio completo",
    parentesco: "Elegí una opción",
    cedula: "Ingresá el número de cédula",
  },

  avisoEvaluacion:
    "Si alguna respuesta médica o de antecedentes requiere evaluación adicional, la solicitud no se rechaza automáticamente. Se detiene el proceso automático de emisión y el caso se envía por Interseguros a Alianza Garantía para su evaluación manual.",

  continuar: "CONTINUAR",
} as const;

export const TEXTOS_04D = {
  titulo: "Consentimientos",
  bajada: "Revisá la información antes de continuar.",

  entregaDigital: {
    id: "entregaDigital",
    titulo: "ENTREGA DIGITAL",
    texto:
      "Autorizo y acepto recibir por mis canales verificados (WhatsApp y correo electrónico) el Certificado de Cobertura Provisional, la póliza y la factura electrónica, así como la Solicitud de Seguro y el FIPF firmados cuando los requiera.",
  },
  inicioCobertura: {
    id: "inicioCobertura",
    titulo: "INICIO DE COBERTURA Y CARENCIAS",
    texto:
      "Tomo conocimiento y acepto que la cobertura comienza una vez acreditado el pago del premio. Carencias: cáncer, 90 días; renta hospitalaria por accidente, 1 día; gastos médicos por accidente, 1 día; fallecimiento, sin carencia.",
  },
  /** Informativo: **sin casilla**. Se registra al continuar (manual). */
  intermediario: {
    id: "intermediario",
    titulo: "INTERMEDIARIO Y CANAL DE ATENCIÓN",
    texto:
      "Tomo conocimiento de que Interseguros S.A. es el intermediario en la contratación de este seguro y va a ser el canal de atención para todas las gestiones relacionadas con la póliza. Para cualquier consulta, solicitud, cambio, modificación o renovación, tengo que comunicarme con Interseguros S.A. por sus canales oficiales o acudir a sus oficinas.",
  },

  continuar: "CONTINUAR",
} as const;

/**
 * El literal íntegro que queda asentado en la evidencia de 04D.
 *
 * Los tres bloques juntos, en el orden en que la pantalla los muestra —también
 * el informativo, porque también se toma conocimiento de él al continuar—.
 */
export const TEXTO_CONSENTIMIENTOS_04D = [
  `${TEXTOS_04D.entregaDigital.titulo}: ${TEXTOS_04D.entregaDigital.texto}`,
  `${TEXTOS_04D.inicioCobertura.titulo}: ${TEXTOS_04D.inicioCobertura.texto}`,
  `${TEXTOS_04D.intermediario.titulo}: ${TEXTOS_04D.intermediario.texto}`,
].join("\n\n");

/** Sube con cualquier cambio de los textos de arriba. */
export const VERSION_CONSENTIMIENTOS_04D = "V4-04D-2026-09-16";
