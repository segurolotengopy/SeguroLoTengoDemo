/**
 * Textos de la pantalla 02 (selección de plan) y de sus tres detalles:
 * 02A · coberturas, 02B · exclusiones y 02C · siniestros.
 *
 * Los importes **no están acá**: salen de `catalogo.ts`, que es la oferta
 * versionada y hasheada. Lo que vive en este archivo es lo que no cambia con
 * el plan — los títulos, las carencias, las exclusiones y el procedimiento de
 * siniestros—, transcrito de los artes aprobados y pasado a voseo (D-35) salvo
 * donde es cita del condicionado.
 *
 * Dos correcciones del arte ya aplicadas, ambas listadas en
 * `ANALISIS_VISUAL_PNG.md` §11: **«1 día» lleva tilde** (el arte la omite en
 * dos líneas de 02) y el concepto se llama **«Inicio de cobertura»** en las
 * dos pantallas, no «Inicio de vigencia» en una y «de cobertura» en la otra.
 *
 * Y una decisión: **se dice «premio»**, no «prima» (D-47). Donde el texto es
 * cita literal del condicionado que dice «prima», se conserva.
 */

export const TEXTOS_02 = {
  titulo: "Seguro de Vida",
  tituloAcento: "Oncológico VIVE",
  bajada: "Elegí el plan que mejor se adapte a vos.",
  video: {
    rotulo: "VIDEO INFORMATIVO",
    pie: "Conocé el producto en 60 segundos",
  },
  premioPie: "Premio total anual · IVA incluido",
  planRecomendado: "PLAN RECOMENDADO",
  coberturas: {
    cancer: "Diagnóstico de cáncer",
    fallecimiento: "Fallecimiento",
    renta: "Renta Hospitalaria por Accidente",
    gastos: "Gastos Médicos por Accidente",
  },
  maximoDias: "Máx. 15 días",
  enlaceDetalle: "Ver coberturas, exclusiones y condiciones",
  fichas: [
    { titulo: "EDAD DE INGRESO", lineas: ["18 a 64 años"] },
    {
      titulo: "CARENCIAS",
      lineas: [
        "Cáncer: 90 días",
        "Renta: 1 día",
        "Gastos por accidente: 1 día",
        "Fallecimiento: sin carencia",
      ],
    },
    { titulo: "INICIO DE COBERTURA", lineas: ["Al acreditarse el pago."] },
  ],
  aclaracionRotulo: "ACLARACIÓN:",
  aclaracion: [
    "Continuar con el plan seleccionado no implica, bajo ninguna circunstancia, la contratación del seguro, la firma de documentos, la emisión de la póliza o de la factura, el inicio de la cobertura ni la obligación de pagar el premio.",
    "Sin embargo, al presionar el botón «CONTINUAR» para avanzar a la siguiente pantalla, confirmo que leí y comprendí toda la información presentada en la sección «Coberturas, exclusiones y condiciones».",
  ],
  continuar: "CONTINUAR",
} as const;

/** Las tres pestañas del modal de detalle, en el orden del arte. */
export const PESTANAS_02 = [
  { id: "coberturas", rotulo: "COBERTURAS" },
  { id: "exclusiones", rotulo: "EXCLUSIONES" },
  { id: "siniestros", rotulo: "SINIESTROS" },
] as const;

export type PestanaDetalle02 = (typeof PESTANAS_02)[number]["id"];

export const TITULO_DETALLE_02 = "Coberturas, exclusiones y condiciones";

export const TEXTOS_02A = {
  tablaTitulo: "MISMAS COBERTURAS · DISTINTAS SUMAS",
  notaRenta: "Internación mínima: 24 horas · Máximo: 15 días por vigencia.",
  tarjetas: [
    {
      titulo: "EDAD DE INGRESO Y PERMANENCIA",
      cuerpo:
        "Ingreso: de 18 a 64 años. Permanencia: hasta los 75 años, cuando se hayan cumplido 10 años continuos de cobertura antes de los 65.",
    },
    {
      titulo: "CARENCIAS",
      cuerpo:
        "Cáncer: 90 días · Renta hospitalaria por accidente: 1 día · Gastos médicos por accidente: 1 día · Fallecimiento: sin carencia.",
    },
    {
      titulo: "INICIO DE COBERTURA",
      cuerpo: "La cobertura comienza al acreditarse el pago.",
    },
  ],
} as const;

export const TEXTOS_02B = {
  grupos: [
    {
      titulo: "FALLECIMIENTO",
      puntos: [
        "Enfermedades, lesiones o dolencias preexistentes conocidas o diagnosticadas antes del inicio.",
        "Carreras, competencias hípicas, pruebas de rendimiento o de prototipos.",
        "Operaciones subacuáticas o aéreas, salvo como pasajero de transporte regular.",
        "Guerra y riesgos nucleares.",
        "Suicidio o tentativa de suicidio. Esta exclusión no se aplica cuando ocurre en circunstancias que excluyen la voluntad del asegurado.",
        "Empresa criminal, pena de muerte y uso de motocicletas o similares.",
      ],
    },
    {
      titulo: "DIAGNÓSTICO DE CÁNCER",
      puntos: [
        "Diagnóstico que no sea cáncer o sin respaldo anatomopatológico e histológico.",
        "Cáncer detectado durante la carencia o antes del inicio del seguro.",
        "Contaminación nuclear, actividades o enfermedades ocupacionales.",
        "Enfermedad preexistente conocida.",
        "Cáncer de piel, excepto melanoma maligno.",
        "Carcinoma in situ, estadio 0, lesiones precancerosas o cáncer derivado de guerra.",
      ],
    },
    {
      titulo: "RENTA HOSPITALARIA POR ACCIDENTE",
      puntos: [
        "Aplican las exclusiones de la cobertura principal.",
        "Accidente sin hospitalización, atención solo en urgencias o tratamiento ambulatorio.",
        "Tratamiento por familiares hasta segundo grado.",
        "Accidentes causados por culpa grave del asegurado cuando se encuentre bajo los efectos del alcohol.",
        "Intento de suicidio.",
        "Trastornos mentales, nerviosos, seniles, psiquiátricos o condiciones congénitas.",
        "Tratamientos estéticos, plásticos o reconstructivos, salvo función reparadora por un evento cubierto.",
        "Tratamientos derivados del consumo de alcohol, tabaco o drogas.",
        "Alopecia, obesidad, reducción de peso o corrección refractiva.",
      ],
      recuadro: {
        titulo: "CONDICIÓN ESPECIAL DE RENTA DIARIA",
        cuerpo:
          "Entre hospitalizaciones por accidentes diferentes deberán transcurrir al menos 90 días naturales, siempre que no estén relacionadas con el evento anterior.",
      },
    },
    {
      titulo: "GASTOS MÉDICOS POR ACCIDENTE",
      puntos: [
        "Aplican las exclusiones de la cobertura principal.",
        "Accidentes causados por culpa grave del asegurado cuando se encuentre bajo los efectos del alcohol.",
        "Tratamientos derivados del consumo de alcohol, tabaco o drogas.",
        "Viajes o estadías en centros de reposo, balnearios o convalecencia.",
        "Aparatos ortopédicos, anteojos, medias o fajas de goma.",
        "Prótesis y obturaciones dentales.",
      ],
    },
  ],
  cierre: "Este resumen es informativo y no sustituye el condicionado completo.",
} as const;

export const TEXTOS_02C = {
  grupos: [
    {
      titulo: "AVISO DEL SINIESTRO",
      parrafos: [
        "Regla general: comunicá el siniestro dentro de los 3 días de haber tomado conocimiento.",
        "Para gastos médicos por accidente rige el plazo específico indicado en su sección; no constituye una carencia.",
      ],
    },
    {
      titulo: "FALLECIMIENTO",
      puntos: [
        "Copia legalizada del certificado de defunción.",
        "Certificado de la autoridad sanitaria o declaración del médico tratante.",
        "Declaración del beneficiario en el formulario de la aseguradora.",
        "Antecedentes policiales o judiciales, cuando correspondan, y datos necesarios para verificar el evento.",
      ],
    },
    {
      titulo: "DIAGNÓSTICO DE CÁNCER",
      puntos: [
        "Comunicar el diagnóstico y presentar prueba médica de su inicio y causa.",
        "Informe anatomopatológico e histológico positivo.",
        "Documentación clínica, radiológica o de laboratorio.",
        "Permitir las verificaciones o exámenes solicitados por la aseguradora.",
      ],
    },
    {
      titulo: "RENTA HOSPITALARIA POR ACCIDENTE",
      puntos: [
        "Acreditar que la hospitalización fue ocasionada por el accidente cubierto.",
        "Presentar informe médico y documentación clínica que respalden el ingreso y los días de internación.",
        "Internación mínima: 24 horas. Máximo indemnizable: 15 días por vigencia.",
      ],
    },
    {
      titulo: "GASTOS MÉDICOS POR ACCIDENTE",
      puntos: [
        "Avisar por escrito dentro de los 30 días.",
        "Informe del especialista y documentación clínica, radiológica, histológica o de laboratorio.",
        "Originales de recibos o facturas.",
        "Programa médico y prescripción.",
        "Permitir las verificaciones o exámenes requeridos por la aseguradora.",
      ],
    },
    {
      titulo: "IMPORTANTE",
      parrafos: [
        "La aseguradora podrá solicitar información adicional razonable para verificar el siniestro.",
      ],
    },
  ],
} as const;
