/**
 * Adaptador oficial de `IdentityProvider` (P5) sobre AWS: Rekognition para
 * biometría y Textract para OCR.
 *
 * Ítems 31 y 32 de `docs/Tabla de Integraciones externas - Tabla.csv`.
 * Reemplaza a Entrust (ítems 7, 8 y 9) para demo y piloto.
 *
 * Compone las capacidades de `rekognition-identidad.ts` y `textract-cedula.ts`
 * —que no saben nada de expedientes ni de cédulas paraguayas— y les pone
 * encima la forma que necesita P5. Toda decisión de aprobar o rechazar sale de
 * `src/domain/identidad-parametros.ts`: acá no hay ningún umbral.
 *
 * **Qué cubre y qué no** (§2 de `docs/RECOMENDACIONES_ONBOARDING_IDENTIDAD.md`):
 * calidad, prueba de vida, coincidencia facial y OCR, sí. **Autenticidad
 * documental, no**: AWS no tiene servicio para eso. Lo que se hace en su lugar
 * es verificar el MRZ TD1 del dorso y cruzarlo contra el frente, que detecta
 * un documento adulterado a mano pero **no** un MRZ inventado con dígitos bien
 * calculados. Es consistencia interna, no existencia. Cerrar esa brecha
 * requiere fuente oficial o proveedor documental especializado.
 *
 * ## Estado entre llamadas
 *
 * El puerto pide que `extraerDatosCedula` y `compararRostro` reciban solo el
 * `expedienteId`: asume que el adaptador mantiene la sesión de captura. Acá esa
 * sesión vive **en memoria del objeto**, no del módulo, así que dura lo que
 * dura el request.
 *
 * Eso alcanza porque el dominio llama a las cinco operaciones dentro de una
 * misma petición (`analizarIdentidadP5` y `confirmarIdentidadP5` reciben las
 * tres capturas juntas y rehacen todo). Es a propósito y está documentado en
 * `verificacion-identidad.ts`: la confirmación no puede confiar en lo que el
 * navegador diga que ya se aprobó.
 *
 * **Consecuencia a tener presente:** guardar estado de módulo sería peor, no
 * mejor. Amplify SSR corre varias instancias y un `Map` global daría resultados
 * distintos según a qué instancia caiga el request — el clásico bug que
 * aparece solo en producción y con carga.
 */
import { createHash } from "node:crypto";
import {
  CONFIANZA_MINIMA_OCR,
  MENSAJE_CALIDAD_ROSTRO,
  VIGENCIA_SESION_PRUEBA_DE_VIDA_SEGUNDOS,
  decidirCoincidenciaFacial,
} from "../../domain/identidad-parametros";
import type { DecisionBiometrica } from "../../domain/identidad-parametros";
import { cruzarConMrz } from "../../domain/mrz";
import type { DatosMrz } from "../../domain/mrz";
import type {
  CapturaSelfie,
  DatosExtraidosCedula,
  IdentityProvider,
  ImagenCapturada,
  MediaCapturada,
  ProveedorSesionPruebaDeVida,
  ResultadoCapturaCedula,
  ResultadoComparacionFacial,
  ResultadoOcrCedula,
  ResultadoSelfie,
  SesionPruebaDeVida,
} from "../../ports/identity-provider";
import { dimensionesDeImagen } from "./dimensiones-imagen";
import {
  compararRostros,
  crearSesionPruebaDeVida,
  detectarYMedirRostro,
  obtenerResultadoPruebaDeVida,
} from "./rekognition-identidad";
import type { ClienteRekognition, TipoDesafioPruebaDeVida } from "./rekognition-identidad";
import {
  buscarMrzTd1,
  elegirFechaNacimiento,
  extraerCamposCedulaParaguaya,
  leerTextoDocumento,
} from "./textract-cedula";
import type { ClienteTextract, LineaReconocida } from "./textract-cedula";

const MOTIVO_SIN_ROSTRO_CEDULA =
  "No encontramos una fotografía de rostro en la cédula. Enfocá el documento completo y repetí la captura.";
const MOTIVO_VARIOS_ROSTROS =
  "Detectamos más de un rostro en la imagen. Tiene que aparecer solo el de la cédula.";
const MOTIVO_FORMATO_DESCONOCIDO =
  "No pudimos leer la imagen. Tomá la fotografía de nuevo con la cámara.";
const MOTIVO_ILEGIBLE =
  "No pudimos leer el documento con suficiente claridad. Buscá mejor luz y repetí la captura.";
const MOTIVO_MRZ_INVALIDO =
  "El código del dorso no es consistente. Verificá que sea una cédula vigente y repetí la captura.";

interface CapturaGuardada {
  readonly imagen: ImagenCapturada;
  readonly bytes: Uint8Array;
  readonly aprobada: boolean;
  readonly lineas: readonly LineaReconocida[];
}

interface SesionCaptura {
  frente?: CapturaGuardada;
  dorso?: CapturaGuardada;
  mrz?: DatosMrz | null;
  selfie?: { readonly bytes: Uint8Array | null; readonly aprobada: boolean };
}

function hashDe(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Referencia de evidencia. Deriva del hash y **no contiene ningún dato de la
 * persona**: es lo que se muestra en el registro de seguridad de P5 y en la
 * consola administrativa.
 */
function referenciaDe(etiqueta: string, hash: string): string {
  return `AWS-${etiqueta}-${hash.slice(0, 12)}`;
}

function imagenCapturada(etiqueta: string, bytes: Uint8Array): ImagenCapturada {
  const hashSha256 = hashDe(bytes);
  return { referencia: referenciaDe(etiqueta, hashSha256), hashSha256 };
}

/**
 * `DecisionBiometrica` → forma del puerto.
 *
 * El puerto se queda con la aprobación y la puntuación cruda; el umbral y las
 * versiones de modelo y política los sigue conservando la decisión del dominio,
 * que es la que va al registro de evidencia. Traducir acá evita que el puerto
 * —que también implementa el mock— tenga que conocer `DecisionBiometrica`.
 */
function comoResultadoFacial(decision: DecisionBiometrica): ResultadoComparacionFacial {
  return {
    coincidenciaFacialAprobada: decision.aprobada,
    puntuacion: decision.puntuacion,
  };
}

export interface OpcionesIdentityProviderAws {
  readonly rekognition: ClienteRekognition;
  readonly textract: ClienteTextract;
  /** Desafío de prueba de vida. Por defecto, el de máxima precisión. */
  readonly desafioPruebaDeVida?: TipoDesafioPruebaDeVida;
  readonly ahora?: () => Date;
}

/**
 * Crea el adaptador. Los clientes de AWS se inyectan para que los tests corran
 * con dobles: sin red, sin credenciales y sin gasto.
 */
export function crearIdentityProviderAws(
  opciones: OpcionesIdentityProviderAws,
): IdentityProvider & ProveedorSesionPruebaDeVida {
  const { rekognition, textract } = opciones;
  const ahora = opciones.ahora ?? (() => new Date());

  // Sesión por instancia, no por módulo: ver la nota de cabecera.
  const sesiones = new Map<string, SesionCaptura>();

  function sesionDe(expedienteId: string): SesionCaptura {
    const existente = sesiones.get(expedienteId);
    if (existente) return existente;
    const nueva: SesionCaptura = {};
    sesiones.set(expedienteId, nueva);
    return nueva;
  }

  /**
   * Frente de la cédula: calidad del **retrato impreso** más OCR del texto.
   *
   * Se mide el rostro de la foto del documento, no el del titular: es el que
   * después se compara contra la selfie, así que si está borroso o cortado la
   * comparación va a fallar por una razón que acá se puede explicar mejor.
   */
  async function capturarFrente(
    expedienteId: string,
    bytes: MediaCapturada,
  ): Promise<ResultadoCapturaCedula> {
    const imagen = imagenCapturada("CEDULA-FRENTE", bytes);
    const sesion = sesionDe(expedienteId);

    const dimensiones = dimensionesDeImagen(bytes);
    if (!dimensiones) {
      sesion.frente = { imagen, bytes, aprobada: false, lineas: [] };
      return {
        calidadAprobada: false,
        autenticidadAprobada: false,
        imagen,
        motivoRechazo: MOTIVO_FORMATO_DESCONOCIDO,
      };
    }

    const rostro = await detectarYMedirRostro(rekognition, bytes, dimensiones);
    if (!rostro.ok) {
      sesion.frente = { imagen, bytes, aprobada: false, lineas: [] };
      return {
        calidadAprobada: false,
        autenticidadAprobada: false,
        imagen,
        motivoRechazo:
          rostro.motivo === "SIN_ROSTRO" ? MOTIVO_SIN_ROSTRO_CEDULA : MOTIVO_VARIOS_ROSTROS,
      };
    }

    const ocr = await leerTextoDocumento(textract, bytes);
    const calidadAprobada = rostro.calidad.aprobada;
    sesion.frente = { imagen, bytes, aprobada: calidadAprobada, lineas: ocr.lineas };

    return {
      calidadAprobada,
      // La autenticidad del documento no se decide con una sola cara: depende
      // del MRZ del dorso y de su cruce con el frente, y eso se evalúa en
      // `extraerDatosCedula`, cuando ya están las dos.
      autenticidadAprobada: true,
      imagen,
      motivoRechazo: calidadAprobada
        ? null
        : rostro.calidad.motivos.map((motivo) => MENSAJE_CALIDAD_ROSTRO[motivo]).join(" "),
    };
  }

  /**
   * Dorso: OCR y lectura del MRZ TD1.
   *
   * La autenticidad se resuelve acá porque el MRZ es lo único verificable que
   * tenemos. Un MRZ presente cuyos dígitos verificadores no cierran es un
   * rechazo; **un dorso sin MRZ no lo es** — el formato anterior de cédula no
   * lo tiene, y rechazarlo dejaría afuera a personas con documento válido.
   */
  async function capturarDorso(
    expedienteId: string,
    bytes: MediaCapturada,
  ): Promise<ResultadoCapturaCedula> {
    const imagen = imagenCapturada("CEDULA-DORSO", bytes);
    const sesion = sesionDe(expedienteId);

    const ocr = await leerTextoDocumento(textract, bytes);
    const mrz = buscarMrzTd1(ocr.lineas, ahora());

    if (!mrz.encontrado && mrz.motivo === "MRZ_INVALIDO") {
      sesion.dorso = { imagen, bytes, aprobada: false, lineas: ocr.lineas };
      sesion.mrz = null;
      return {
        calidadAprobada: true,
        autenticidadAprobada: false,
        imagen,
        motivoRechazo: MOTIVO_MRZ_INVALIDO,
      };
    }

    // **Un MRZ válido hace legible al dorso por definición**, sin importar qué
    // confianza declaró Textract: sus dígitos verificadores son una prueba más
    // fuerte que un umbral estadístico. Exigir líneas confiables acá rechazaría
    // justo los documentos que sí traen MRZ, porque la fuente OCR-B le baja la
    // confianza al OCR. El umbral solo decide cuando no hay MRZ del que
    // agarrarse (formato anterior de cédula).
    const legible = mrz.encontrado || ocr.lineasConfiables.length > 0;
    sesion.dorso = { imagen, bytes, aprobada: legible, lineas: ocr.lineas };
    sesion.mrz = mrz.encontrado ? mrz.datos : null;

    return {
      calidadAprobada: legible,
      autenticidadAprobada: true,
      imagen,
      motivoRechazo: legible ? null : MOTIVO_ILEGIBLE,
    };
  }

  return {
    async capturarFrenteCedula(expedienteId, imagen) {
      return capturarFrente(expedienteId, imagen);
    },

    async capturarDorsoCedula(expedienteId, imagen) {
      return capturarDorso(expedienteId, imagen);
    },

    async extraerDatosCedula(expedienteId): Promise<ResultadoOcrCedula> {
      const sesion = sesionDe(expedienteId);
      const vacio: DatosExtraidosCedula = {
        numeroCedula: "",
        nombres: "",
        apellidos: "",
        fechaNacimiento: "",
        sexo: "",
        nacionalidad: "",
      };

      if (!sesion.frente?.aprobada || !sesion.dorso?.aprobada) {
        return { datos: vacio, confiable: false, numeroCedulaSinConfirmar: null };
      }

      const mrz = sesion.mrz;
      const campos = extraerCamposCedulaParaguaya(
        sesion.frente.lineas.filter((linea) => linea.confianza >= CONFIANZA_MINIMA_OCR),
      );

      // Sin MRZ no hay de dónde sacar nombres, apellidos ni una fecha de
      // nacimiento confiable. El frente no tiene formato publicado, así que
      // reconocerlos por posición sería adivinar — y la fecha alimenta el corte
      // de edad (regla inviolable #8).
      //
      // Pero el **número** sí se lee sin ambigüedad, y con él el dominio puede
      // ir a buscar los datos al registro civil, que es la fuente más fuerte
      // que existe. Es el camino de la cédula del formato anterior: por eso
      // acá se devuelve `confiable: false` **con** el número, y no vacío.
      if (!mrz) {
        return {
          datos: vacio,
          confiable: false,
          numeroCedulaSinConfirmar: campos.numeroCedula,
        };
      }

      const fechaNacimiento = elegirFechaNacimiento(campos, mrz);
      const cruce = cruzarConMrz(
        {
          numeroCedula: campos.numeroCedula ?? "",
          fechaNacimiento: fechaNacimiento ?? "",
          sexo: mrz.sexo,
        },
        mrz,
        ahora(),
      );

      if (!cruce.coincide || fechaNacimiento === null) {
        // Frente y dorso se contradicen: acá el número del frente **no** es
        // una pista utilizable, justamente porque es uno de los datos que no
        // coinciden. Ir al registro con él sería confirmar el dato equivocado.
        return { datos: vacio, confiable: false, numeroCedulaSinConfirmar: null };
      }

      return {
        numeroCedulaSinConfirmar: mrz.numeroDocumento,
        datos: {
          // El MRZ es la fuente: viene con dígitos verificadores, el frente no.
          numeroCedula: mrz.numeroDocumento,
          nombres: mrz.nombres,
          apellidos: mrz.apellidos,
          fechaNacimiento,
          sexo: mrz.sexo,
          nacionalidad: mrz.nacionalidad,
        },
        confiable: true,
      };
    },

    async capturarSelfieYPruebaDeVida(
      expedienteId,
      captura: CapturaSelfie,
    ): Promise<ResultadoSelfie> {
      const sesion = sesionDe(expedienteId);

      // Face Liveness es una sesión de streaming: el camino de bytes no existe
      // en este proveedor. Rechazar es más honesto que hacer una comparación
      // facial suelta y llamarla "prueba de vida", que es justo lo que este
      // control tiene que impedir.
      if (captura.tipo === "VIDEO") {
        throw new Error(
          "El adaptador de AWS no acepta bytes de video: la prueba de vida es una sesión de " +
            "Rekognition Face Liveness. Pedí una sesión con crearSesionPruebaDeVida y mandá su referencia.",
        );
      }

      const resultado = await obtenerResultadoPruebaDeVida(
        rekognition,
        captura.referenciaSesion,
      );

      const bytes = resultado.imagenReferencia;
      // Sin imagen de referencia no hay nada que hashear ni con qué comparar
      // después. El hash de una referencia vacía sería un hash constante,
      // idéntico entre expedientes: peor que ninguno, porque parecería
      // evidencia.
      const imagen = bytes
        ? imagenCapturada("SELFIE", bytes)
        : { referencia: `AWS-SELFIE-SIN-IMAGEN`, hashSha256: "" };

      sesion.selfie = { bytes, aprobada: resultado.decision.aprobada };

      return {
        pruebaDeVidaAprobada: resultado.decision.aprobada,
        imagen,
        puntuacion: resultado.decision.puntuacion,
      };
    },

    async compararRostro(expedienteId): Promise<ResultadoComparacionFacial> {
      const sesion = sesionDe(expedienteId);

      // Comparar contra una cédula que no se pudo leer, o contra una selfie que
      // no aprobó la prueba de vida, sería darle valor a una coincidencia que
      // no prueba presencia.
      if (!sesion.frente?.aprobada || !sesion.selfie?.aprobada || !sesion.selfie.bytes) {
        return comoResultadoFacial(decidirCoincidenciaFacial(null, null));
      }

      return comoResultadoFacial(
        await compararRostros(rekognition, sesion.selfie.bytes, sesion.frente.bytes),
      );
    },

    async crearSesionPruebaDeVida(): Promise<SesionPruebaDeVida> {
      const sesion = await crearSesionPruebaDeVida(rekognition, {
        desafio: opciones.desafioPruebaDeVida,
      });
      return {
        referenciaSesion: sesion.sessionId,
        // Fijada por el proveedor: la sesión es de un solo uso y dura 3 minutos.
        vigenciaSegundos: VIGENCIA_SESION_PRUEBA_DE_VIDA_SEGUNDOS,
      };
    },
  };
}
