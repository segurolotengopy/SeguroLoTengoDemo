/**
 * Textos de 03C (identidad y correo) y 03D (datos personales).
 *
 * ## Qué estados de 03C existen y cuáles no
 *
 * El arte dibuja 26. Se implementan los que el sistema **puede disparar**:
 *
 * - Los del recorrido (00 a 13) y los errores que el proveedor o el navegador
 *   sí distinguen: calidad de imagen, archivo no admitido, cámara denegada
 *   —con su variante de selfie—, prueba de vida, coincidencia facial, error
 *   técnico y bloqueo temporal.
 * - **No se implementan** `16 · lado incorrecto`, `17 · documento no
 *   paraguayo` y `18 · cédula vencida`: el puerto `IdentityProvider` no
 *   devuelve esos tres veredictos por separado, y fabricarlos en la pantalla
 *   sería afirmar una verificación que nadie hizo. Sus textos quedan acá, con
 *   su clave, para el día que el proveedor los distinga.
 * - **`19 · posible alteración` no se implementa por decisión** (D-46): no hay
 *   proveedor que detecte alteración documental. Prometerlo en pantalla sería
 *   peor que no tenerlo.
 *
 * Todos los textos van en voseo (D-35).
 */

export const TEXTOS_03C = {
  titulo: "Verificá tu",
  tituloAcento: "identidad",
  bajada:
    "Vas a fotografiar el frente y el dorso de tu cédula de identidad paraguaya vigente y a hacer una selfie. No se admite pasaporte.",

  avisoArchivosTitulo: "ARCHIVOS Y CAPTURA",
  avisoArchivos:
    "Tené en cuenta que para el frente y el dorso podés tomar una fotografía o cargar una imagen JPG, JPEG, PNG o HEIC de hasta 20 MB. No se admite PDF. La selfie se hace únicamente con la cámara.",

  seccionCaptura: "CAPTURA DOCUMENTAL Y BIOMÉTRICA",
  tarjetas: {
    FRENTE: "Frente",
    DORSO: "Dorso",
    SELFIE: "Selfie",
  },
  estados: {
    pendiente: "Pendiente",
    procesando: "PROCESANDO…",
    validado: "✓ VALIDADO",
    revisar: "REVISAR",
  },
  botones: {
    tomarFotografia: "TOMAR FOTOGRAFÍA",
    tomarSelfie: "TOMAR SELFIE",
    cargarArchivo: "CARGAR ARCHIVO",
    validando: "VALIDANDO…",
  },

  avisoBiometria:
    "Las fotografías de la cédula deben ser nítidas y la selfie debe superar la prueba de vida y la validación de coincidencia facial con la fotografía de la cédula.",

  seccionCorreo: "CORREO ELECTRÓNICO",
  avisoCorreo:
    "El correo electrónico se usa para enviarte los documentos del seguro. Es fundamental ingresarlo correctamente.",
  etiquetaCorreo: "Correo electrónico",
  etiquetaCorreoRepetido: "Confirmación del correo",
  correoSeHabilita: "Se habilita después de validar la selfie.",
  errorCorreoInvalido: "Ingresá un correo electrónico válido.",
  errorCorreosNoCoinciden: "Los correos electrónicos no coinciden. Verificá los dos campos.",

  validar: "VALIDAR Y CONTINUAR",
  validando: "VALIDANDO IDENTIDAD…",

  camara: {
    FRENTE: {
      titulo: "Fotografiá el frente",
      bajada: "Alineá la cédula dentro del marco. Asegurate de que se vea completa, enfocada y sin reflejos.",
      rotulo: "FRENTE DE LA CÉDULA",
    },
    DORSO: {
      titulo: "Fotografiá el dorso",
      bajada: "Alineá la cédula dentro del marco. Asegurate de que se vea completa, enfocada y sin reflejos.",
      rotulo: "DORSO DE LA CÉDULA",
    },
    SELFIE: {
      titulo: "Hacé la selfie",
      bajada: "Centrá tu rostro dentro del óvalo y seguí las indicaciones de prueba de vida.",
      rotulo: "Mirá al frente",
    },
  },
  pieCamara: "Pulsá el botón para capturar",
  pieCamaraSelfie: "La captura se hace automáticamente",

  errores: {
    CALIDAD: {
      familia: "ROJO",
      titulo: "NO PUDIMOS VALIDAR LA IMAGEN",
      cuerpo:
        "La imagen está borrosa o tiene reflejos. Sacá o cargá otra imagen donde la cédula se vea completa, nítida y bien iluminada.",
    },
    ARCHIVO_NO_ADMITIDO: {
      familia: "AZUL",
      titulo: "ARCHIVO NO ADMITIDO",
      cuerpo:
        "Elegí una imagen JPG, JPEG, PNG o HEIC de hasta 20 MB. No se admite PDF ni archivos dañados.",
      boton: "SELECCIONAR OTRO ARCHIVO",
    },
    CAMARA_DENEGADA_DOCUMENTO: {
      familia: "AZUL",
      titulo: "PERMITÍ EL ACCESO A LA CÁMARA",
      cuerpo:
        "Para sacar la fotografía tenés que habilitar la cámara del dispositivo. También podés continuar cargando una imagen del frente o del dorso.",
      boton: "HABILITAR CÁMARA",
    },
    CAMARA_DENEGADA_SELFIE: {
      familia: "AZUL",
      titulo: "LA SELFIE NECESITA ACCESO A LA CÁMARA",
      cuerpo:
        "La selfie se hace en vivo. Habilitá la cámara del dispositivo para completar la prueba de vida y la coincidencia facial.",
      boton: "HABILITAR CÁMARA",
    },
    PRUEBA_DE_VIDA: {
      familia: "ROJO",
      titulo: "NO PUDIMOS CONFIRMAR LA PRUEBA DE VIDA",
      cuerpo:
        "Centrá el rostro, mejorá la iluminación y seguí las instrucciones que aparecen en pantalla.",
      boton: "REPETIR SELFIE",
    },
    COINCIDENCIA_FACIAL: {
      familia: "ROJO",
      titulo: "EL ROSTRO NO COINCIDE CON LA CÉDULA",
      cuerpo:
        "No pudimos confirmar la coincidencia facial. La selfie tiene que ser de la persona titular de la cédula.",
      boton: "REPETIR SELFIE",
    },
    ERROR_TECNICO: {
      familia: "AZUL",
      titulo: "NO PUDIMOS PROCESAR LA IMAGEN",
      cuerpo:
        "Comprobá tu conexión e intentá nuevamente. Conservamos temporalmente la captura o el archivo seleccionado.",
      remate: "Este error no consume un intento de validación.",
      boton: "INTENTAR NUEVAMENTE",
    },
    BLOQUEO: {
      familia: "ROJO",
      titulo: "VALIDACIÓN TEMPORALMENTE BLOQUEADA",
      cuerpo:
        "Se alcanzaron 3 intentos fallidos en esta etapa. Las etapas anteriores ya validadas se conservan. El sistema va a habilitar automáticamente nuevos intentos en",
    },
  },

  /**
   * Los tres veredictos que el proveedor todavía no distingue. No se muestran
   * nunca; están acá para no perder el texto aprobado.
   */
  erroresSinDisparador: {
    LADO_INCORRECTO: {
      titulo: "EL LADO NO CORRESPONDE",
      cuerpo:
        "Se esperaba el dorso de la cédula. La imagen cargada corresponde al frente o repite la captura anterior.",
    },
    DOCUMENTO_NO_PARAGUAYO: {
      titulo: "DOCUMENTO NO ADMITIDO",
      cuerpo:
        "Solo se admite una cédula de identidad paraguaya vigente. No se admite pasaporte ni otro documento.",
    },
    CEDULA_VENCIDA: {
      titulo: "CÉDULA VENCIDA",
      cuerpo:
        "La cédula fotografiada está vencida. Para continuar tenés que usar una cédula paraguaya vigente.",
    },
  },

  intento: (numero: number, maximo: number) => `Intento ${numero} de ${maximo}.`,
  volverATomar: "VOLVER A TOMAR",
  cargarOtroArchivo: "CARGAR OTRO ARCHIVO",
  reintentoEn: (reloj: string) => `REINTENTO AUTOMÁTICO EN ${reloj}`,
} as const;

export const TEXTOS_03D = {
  titulo: "Completá tus ",
  tituloAcento: "datos",
  bajada: "Revisá la información y completá los campos restantes.",
  identidadVerificada:
    "Identidad verificada con la cédula, la prueba de vida y la coincidencia facial.",

  seccionIdentidad: "DATOS DE IDENTIDAD",
  avisoCampos:
    "Todos los campos son obligatorios. Podés editar los datos extraídos de tu cédula; el tipo de documento queda bloqueado.",
  seccionDomicilio: "DOMICILIO",

  etiquetas: {
    tipoDocumento: "Tipo de documento",
    numeroCedula: "Número de cédula",
    nombres: "Nombres",
    apellidoPaterno: "Apellido paterno",
    apellidoMaterno: "Apellido materno",
    fechaNacimiento: "Fecha de nacimiento",
    sexo: "Sexo",
    estadoCivil: "Estado civil",
    paisNacimiento: "País de nacimiento",
    nacionalidad: "Nacionalidad",
    paisResidencia: "País de residencia",
    direccion: "Dirección",
    ciudad: "Ciudad",
    barrio: "Barrio o zona",
  },
  valorTipoDocumento: "Cédula de identidad",
  marcadorSeleccione: "Elegí una opción",
  marcadorComplete: "Completá este campo",
  buscar: {
    pais: "Buscar país",
    nacionalidad: "Buscar nacionalidad",
    ciudad: "Buscar ciudad",
  },

  fichaNoCoinciden: {
    titulo: "¿LOS DATOS NO COINCIDEN?",
    cuerpo:
      "Podés corregir los datos extraídos antes de continuar. Las modificaciones quedan registradas.",
  },
  fichaModificacion: {
    titulo: "MODIFICACIÓN REGISTRADA",
    cuerpo: "El cambio se guardó y queda registrado para la contratación.",
  },
  fichaEdad: {
    titulo: (edad: number) => `EDAD CALCULADA: ${edad} AÑOS`,
    cuerpo: "Para contratar el seguro tenés que tener entre 18 y 64 años.",
  },
  marcaEditado: "Editado",

  errorObligatorio: (campo: string) => ({
    titulo: `${campo.toUpperCase()} ES OBLIGATORIO.`,
    indicacion: "Completá el campo para poder continuar.",
  }),
  errorFecha: {
    titulo: "FECHA DE NACIMIENTO NO VÁLIDA.",
    indicacion: "Revisá el día, el mes y el año ingresados.",
  },
  continuar: "CONTINUAR",
  validando: "VALIDANDO DATOS…",

  noElegible: {
    encabezado: "Resultado de la validación",
    titulo: "NO ES POSIBLE CONTINUAR",
    cuerpo:
      "La edad calculada está fuera del rango permitido para contratar este seguro: de 18 a 64 años.",
    aviso:
      "Si la fecha de nacimiento no es correcta, cerrá esta pantalla y corregila. Si no, seleccioná FINALIZAR.",
    boton: "FINALIZAR",
    pie: "FINALIZAR cierra la sesión y vuelve al inicio.",
  },
} as const;
