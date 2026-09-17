/**
 * Textos de 03E (actividad, ingresos y PEP), 03E1 (qué significa PEP) y de la
 * pantalla de revisión manual, que 03E2 y 04A1 comparten.
 *
 * Los 21 artes de 03E son **candidatos** y D-41 dijo que no se implementaban
 * hasta tener arte aprobado. Lo que cambió el 16-sep-2026 es el encargo:
 * *«empezá a implementar TODAS las pantallas con el arte aprobado o
 * pendiente»*. Así que se implementan, y esta es la nota que lo registra: si
 * Interseguros aprueba un arte distinto, esta pantalla se rehace.
 *
 * La pantalla de revisión manual **sí** tiene arte aprobado (03E2, 03E2A,
 * 03E2B y 04A1) y es la misma para los dos motivos: cambian el título de la
 * tarjeta, el primer párrafo y la segunda fila del estado de la solicitud.
 */

export const TEXTOS_03E = {
  titulo: "Actividad e",
  tituloAcento: "ingresos",
  bajada: "Completá tu información laboral y económica.",

  seccionLaboral: "INFORMACIÓN LABORAL",
  seccionEconomica: "INFORMACIÓN ECONÓMICA",
  seccionPep: "CONDICIÓN PEP",

  etiquetas: {
    situacionLaboral: "Situación laboral",
    actividadEconomica: "Actividad económica",
    ocupacion: "Ocupación u oficio",
    profesion: "Profesión",
    empresa: "Empresa o empleador",
    ingreso: "Ingreso mensual declarado",
    origenIngresos: "Origen de ingresos",
  },
  marcadorSeleccione: "Elegí una opción",
  marcadorComplete: "Completá este campo",
  marcadorEmpresaBloqueada: "Se habilita cuando corresponda",
  notaEmpresa: "Obligatorio para Empleado (dependiente) y Propietario/Accionista.",
  notaOrigen: "Elegí un solo origen de ingresos.",

  buscar: {
    actividad: "Buscar actividad",
    ocupacion: "Buscar ocupación u oficio",
    profesion: "Buscar profesión",
  },

  preguntaPep:
    "¿Sos una Persona Expuesta Políticamente (PEP) o mantenés un vínculo con una persona PEP?",
  enlacePep: "¿Qué significa PEP?",

  avisoNeutroTitulo: "INFORMACIÓN IMPORTANTE",
  avisoNeutro:
    "Si respondés «Sí», vas a poder completar esta pantalla y continuar. Interseguros S.A. remite la solicitud a Alianza Garantía para evaluación manual, sin rechazo automático.",
  avisoPepTitulo: "TU SOLICITUD VA A REQUERIR REVISIÓN MANUAL",
  avisoPep:
    "Al seleccionar CONTINUAR, Interseguros S.A. remite tu solicitud a Alianza Garantía para evaluación manual. No se te van a pedir firma ni pago mientras el caso esté pendiente.",

  errores: {
    profesion: {
      titulo: "PROFESIÓN ES OBLIGATORIA.",
      indicacion: "Elegí una opción para poder continuar.",
    },
    empresa: {
      titulo: "EMPRESA O EMPLEADOR ES OBLIGATORIO.",
      indicacion: "Completá el campo para la situación laboral seleccionada.",
    },
    ingreso: {
      titulo: "INGRESO MENSUAL NO VÁLIDO.",
      indicacion: "Declará el monto mensual que corresponda en guaraníes.",
    },
    generico: (campo: string) => ({
      titulo: `${campo.toUpperCase()} ES OBLIGATORIO.`,
      indicacion: "Completá el campo para poder continuar.",
    }),
  },

  continuar: "CONTINUAR",
  validando: "VALIDANDO DATOS…",
  registrandoRevision: "REGISTRANDO REVISIÓN…",
} as const;

export const TEXTOS_03E1 = {
  titulo: "¿Qué significa PEP?",
  bajada: "Información sobre esta declaración.",
  tarjetas: [
    {
      titulo: "PERSONA EXPUESTA POLÍTICAMENTE",
      cuerpo:
        "Es quien desempeña o desempeñó una función pública relevante, o quien mantiene un vínculo comprendido por las reglas aplicables con una persona PEP.",
    },
    {
      titulo: "¿POR QUÉ LO PREGUNTAMOS?",
      cuerpo:
        "Esta información forma parte de las verificaciones requeridas para evaluar la solicitud y aplicar los controles correspondientes a la contratación.",
    },
    {
      titulo: "SI RESPONDÉS «SÍ»",
      cuerpo:
        "Vas a poder completar esta pantalla. Al seleccionar CONTINUAR, Interseguros S.A. remite tu solicitud a Alianza Garantía para evaluación manual. No va a ser rechazada automáticamente y no se te van a pedir firma ni pago mientras el caso esté pendiente.",
    },
  ],
  cierre:
    "Cerrá este panel con la X para volver a Actividad e ingresos. La información que cargaste queda sin cambios.",
} as const;

/**
 * La pantalla de revisión manual, compartida por 03E2 (PEP) y 04A1 (salud).
 *
 * Lo único que cambia entre los dos artes es lo que dice acá `porMotivo`: el
 * título de la tarjeta, el primer párrafo y la segunda fila de la lista de
 * estado. El resto —el titular, la lista, el número de caso, el aviso y el
 * botón— es idéntico, y por eso es una sola pantalla.
 */
export const TEXTOS_REVISION_MANUAL = {
  titulo: "Tu solicitud requiere",
  tituloAcento: "revisión",
  bajada: "Recibimos correctamente tu información.",

  porMotivo: {
    PEP: {
      tarjetaTitulo: "REVISIÓN POR CONDICIÓN PEP",
      primerParrafo:
        "Tu declaración sobre la condición PEP requiere evaluación adicional por parte de la compañía de seguros. Por este motivo, el proceso automático de emisión se detuvo y el caso va a ser enviado por Interseguros S.A. a Alianza Garantía Seguros y Reaseguros S.A. para su evaluación manual.",
      segundoParrafo:
        "Esto no significa que tu solicitud haya sido rechazada. No se te van a pedir firma ni pago mientras el caso esté pendiente. Si hiciera falta, te vamos a pedir información adicional por los canales declarados.",
      filaEstado: "Revisión de cumplimiento",
    },
    SALUD: {
      tarjetaTitulo: "EVALUACIÓN MANUAL",
      primerParrafo:
        "Alguna respuesta médica o de antecedentes requiere evaluación adicional por parte de la compañía de seguros. Por este motivo, el proceso automático de emisión se detuvo y el caso va a ser enviado por Interseguros S.A. a Alianza Garantía Seguros y Reaseguros S.A. para su evaluación manual.",
      segundoParrafo:
        "Esto no significa que tu solicitud haya sido rechazada automáticamente. Todos los antecedentes van a ser revisados con mayor detalle y, si hiciera falta, te vamos a pedir información adicional por los canales declarados.",
      filaEstado: "Evaluación de asegurabilidad",
    },
  },

  tercerParrafo:
    "Este procedimiento no implica la contratación del seguro, la firma de documentos, la emisión de la póliza o de la factura, el inicio de la cobertura ni la obligación de pagar el premio.",

  estadoTitulo: "ESTADO DE LA SOLICITUD",
  filas: {
    datos: { concepto: "Datos recibidos", estado: "Confirmado" },
    firma: { concepto: "Firma de documentos", estado: "Pendiente" },
    pago: { concepto: "Pago", estado: "No realizado" },
    cobertura: { concepto: "Cobertura", estado: "No iniciada" },
  },
  enRevision: "En revisión",
  etiquetaCaso: "N.º de caso",

  avisoCanales:
    "Tu solicitud está en etapa de revisión. Cualquier comunicación adicional se hace únicamente por los canales oficiales declarados.",
  cerrarSesion: "CERRAR SESIÓN",

  confirmacion: {
    titulo: "¿Cerrar sesión?",
    cuerpo:
      "Tu solicitud ya quedó registrada y continúa en revisión. Al cerrar la sesión volvés a la pantalla de inicio.",
    // El arte no dibuja una salida que no sea cerrar. Se agrega, porque un
    // diálogo de confirmación sin negativa visible es una trampa de un solo
    // camino (`ANALISIS_VISUAL_PNG.md` §7.2).
    seguirViendo: "SEGUIR VIENDO EL ESTADO",
  },

  error: {
    titulo: "Revisión manual",
    bajada: "Registro de la solicitud.",
    tarjetaTitulo: "NO PUDIMOS ENVIAR TU SOLICITUD A REVISIÓN",
    cuerpo: ["La solicitud no fue registrada.", "La información ingresada no pudo guardarse."],
    remate: "No se generó un número de caso, firma ni cobro.",
    aviso:
      "Al seleccionar INICIAR NUEVA CONTRATACIÓN volvés al inicio y vas a tener que completar nuevamente todos los pasos.",
    boton: "INICIAR NUEVA CONTRATACIÓN",
  },
} as const;
