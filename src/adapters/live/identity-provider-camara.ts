/**
 * Adaptador de `IdentityProvider` para **demostración con cámara del
 * navegador**: cédula paraguaya o boliviana fotografiada de verdad, OCR real
 * con Amazon Textract y comparación facial real con Amazon Rekognition — pero
 * **sin prueba de vida**.
 *
 * ## Qué lo diferencia de `identity-provider.ts`
 *
 * `identity-provider.ts` es el adaptador de producción y no acepta bytes de
 * selfie: exige una sesión de Rekognition Face Liveness, porque comparar una
 * foto suelta y llamarla "prueba de vida" es justo lo que ese control existe
 * para impedir. Esa decisión sigue intacta y ese adaptador no se tocó.
 *
 * Este es otro adaptador, con otro nombre, que declara lo que hace y lo que
 * no. Recibe la foto de la selfie, verifica que haya **un** rostro humano
 * nítido en el cuadro (`decidirPresenciaDemo`) y lo compara contra el de la
 * cédula. Presencia, no vida: una fotografía impresa sostenida frente a la
 * cámara pasaría este control. Sirve para una demostración a distancia, **no
 * para el piloto ni para producción**.
 *
 * ## Las tres relajaciones, todas explícitas
 *
 * 1. **Sin prueba de vida** — `decidirPresenciaDemo` en lugar de Face
 *    Liveness. La única de las tres que un atacante podría explotar.
 * 2. **Umbral facial 90 en vez de 99** — `UMBRAL_COINCIDENCIA_FACIAL_DEMO`. El
 *    99 compara contra el retrato digital de la cédula; acá el retrato es una
 *    foto de un plástico con reflejos, y a 99 se rechaza al propio titular.
 * 3. **OCR aproximado sin MRZ** — `cedula-aproximada.ts`. Cuando el dorso
 *    trae MRZ se usa el MRZ, igual que en producción; cuando no, se adivina
 *    con heurísticas de rótulo, que es lo que la regla inviolable #8 no
 *    permite en serio.
 *
 * Las tres quedan selladas en la evidencia con
 * `VERSION_POLITICA_IDENTIDAD_DEMO`, así que un expediente decidido acá jamás
 * se puede confundir con uno decidido con la política de producción.
 *
 * ## Por qué exige `DEMO_MODE`
 *
 * Porque las tres relajaciones de arriba, juntas, permitirían firmar un
 * contrato de seguro de vida con la foto de otra persona. El constructor tira
 * si `DEMO_MODE` no es `"true"`: un despliegue de producción que apuntara acá
 * por error no arranca, en vez de aprobar identidades con criterio de demo.
 * Es la misma lógica con la que el panel de demo no existe fuera del flag.
 *
 * Ítems 31 y 32 de `docs/Tabla de Integraciones externas - Tabla.csv` (mismas
 * APIs de AWS que el adaptador de producción, distinto uso).
 */
import { createHash } from "node:crypto";
import {
  MENSAJE_CALIDAD_ROSTRO,
  decidirCoincidenciaFacialDemo,
  decidirPresenciaDemo,
  evaluarCalidadRetratoDocumento,
} from "../../domain/identidad-parametros";
import {
  NACIONALIDAD_POR_PAIS,
  PAISES_ACEPTADOS_POR_DEFECTO,
  mensajeDocumentoNoReconocido,
  reconocerDocumentoRegional,
} from "../../domain/documento-regional";
import type { PaisDocumento, SenalesDocumento } from "../../domain/documento-regional";
import { cruzarConMrz } from "../../domain/mrz";
import type { CamposMrzVerificados, DatosMrz } from "../../domain/mrz";
import type {
  CapturaSelfie,
  DatosExtraidosCedula,
  IdentityProvider,
  ImagenCapturada,
  MediaCapturada,
  ResultadoCapturaCedula,
  ResultadoComparacionFacial,
  ResultadoOcrCedula,
  ResultadoSelfie,
} from "../../ports/identity-provider";
import { extraerCamposAproximados } from "./cedula-aproximada";
import { dimensionesDeImagen } from "./dimensiones-imagen";
import { compararRostros, detectarYMedirRostro } from "./rekognition-identidad";
import type { ClienteRekognition } from "./rekognition-identidad";
import { buscarMrzTd1, leerTextoDocumento } from "./textract-cedula";
import type { ClienteTextract, LineaReconocida } from "./textract-cedula";

const MOTIVO_FORMATO_DESCONOCIDO =
  "No pudimos leer la imagen. Tomá la fotografía de nuevo con la cámara.";
const MOTIVO_SIN_ROSTRO_CEDULA =
  "No encontramos una fotografía de rostro en la cédula. Enfocá el documento completo y repetí la captura.";
const MOTIVO_VARIOS_ROSTROS_CEDULA =
  "Detectamos más de un rostro en la imagen. Tiene que aparecer solo el de la cédula.";
const MOTIVO_SIN_ROSTRO_SELFIE =
  "No detectamos tu rostro. Ubicate dentro del óvalo, de frente y con buena luz.";
const MOTIVO_VARIOS_ROSTROS_SELFIE =
  "Detectamos más de un rostro. Tenés que estar solo vos en el cuadro.";
const MOTIVO_MRZ_INVALIDO =
  "El código del dorso no es consistente. Verificá que sea una cédula vigente y repetí la captura.";

interface CapturaGuardada {
  readonly imagen: ImagenCapturada;
  readonly bytes: Uint8Array;
  readonly aprobada: boolean;
  readonly lineas: readonly LineaReconocida[];
  /** Las que alcanzan el umbral de confianza; las únicas que se leen como datos. */
  readonly lineasConfiables: readonly LineaReconocida[];
  readonly senales: SenalesDocumento;
}

interface SesionCaptura {
  frente?: CapturaGuardada;
  dorso?: CapturaGuardada;
  mrz?: DatosMrz | null;
  /**
   * Campos del MRZ que verificaron con su propio dígito cuando la banda no
   * validó entera. La fecha de acá le gana a la del frente.
   */
  mrzVerificados?: CamposMrzVerificados | null;
  selfie?: { readonly bytes: Uint8Array; readonly aprobada: boolean };
}

function hashDe(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Referencia de evidencia. Deriva del hash y **no contiene ningún dato de la
 * persona**. El prefijo dice `DEMO` a propósito: en la consola administrativa
 * se tiene que ver de un vistazo que ese expediente se verificó con el camino
 * de demostración y no con el de producción.
 */
function imagenCapturada(etiqueta: string, bytes: Uint8Array): ImagenCapturada {
  const hashSha256 = hashDe(bytes);
  return { referencia: `DEMO-${etiqueta}-${hashSha256.slice(0, 12)}`, hashSha256 };
}

const DATOS_VACIOS: DatosExtraidosCedula = {
  numeroCedula: "",
  nombres: "",
  apellidos: "",
  fechaNacimiento: "",
  sexo: "",
  nacionalidad: "",
};

export interface OpcionesIdentityProviderCamaraDemo {
  readonly rekognition: ClienteRekognition;
  readonly textract: ClienteTextract;
  /**
   * Países cuyo documento se acepta, en orden de preferencia ante empate de
   * marcadores. Por defecto solo Paraguay, que es lo que dice la
   * especificación de P5; sumar Bolivia es una decisión explícita de quien
   * arma el adaptador.
   */
  readonly paisesAceptados?: readonly PaisDocumento[];
  readonly ahora?: () => Date;
}

/**
 * Crea el adaptador de demostración. Tira si `DEMO_MODE` no está en `"true"`.
 *
 * Los clientes de AWS se inyectan para que los tests corran con dobles: sin
 * red, sin credenciales y sin gasto.
 */
export function crearIdentityProviderCamaraDemo(
  opciones: OpcionesIdentityProviderCamaraDemo,
): IdentityProvider {
  if (process.env.DEMO_MODE !== "true") {
    throw new Error(
      "crearIdentityProviderCamaraDemo exige DEMO_MODE=true: sustituye la prueba de vida por una " +
        "verificación de presencia y baja el umbral facial a 90. No es apto para producción — " +
        "usá crearIdentityProviderAws (INTEGRATION_IDENTITY=live).",
    );
  }

  const { rekognition, textract } = opciones;
  const ahora = opciones.ahora ?? (() => new Date());
  const paisesAceptados = opciones.paisesAceptados ?? PAISES_ACEPTADOS_POR_DEFECTO;

  // Sesión por instancia y no por módulo, por la misma razón que en el
  // adaptador de producción: Amplify SSR corre varias instancias y un `Map`
  // global daría resultados distintos según a qué instancia caiga el request.
  const sesiones = new Map<string, SesionCaptura>();

  function sesionDe(expedienteId: string): SesionCaptura {
    const existente = sesiones.get(expedienteId);
    if (existente) return existente;
    const nueva: SesionCaptura = {};
    sesiones.set(expedienteId, nueva);
    return nueva;
  }

  /**
   * Frente: primero se decide **si esto es una cédula**, y recién después se
   * mira el rostro.
   *
   * El orden importa para el mensaje. Una fotografía de un vaso no tiene ni
   * marcadores ni rostro; si se preguntara primero por el rostro, la persona
   * leería "no encontramos una fotografía de rostro en la cédula", que sugiere
   * que el problema es el encuadre. Preguntando primero por el documento, el
   * mensaje dice lo que realmente pasa.
   */
  async function capturarFrente(
    expedienteId: string,
    bytes: MediaCapturada,
  ): Promise<ResultadoCapturaCedula> {
    const imagen = imagenCapturada("CEDULA-FRENTE", bytes);
    const sesion = sesionDe(expedienteId);
    const senalesVacias: SenalesDocumento = {
      pais: null,
      marcadoresEncontrados: [],
      numeroDetectado: null,
    };

    function rechazo(motivo: string, autenticidad: boolean): ResultadoCapturaCedula {
      sesion.frente = { imagen, bytes, aprobada: false, lineas: [], lineasConfiables: [], senales: senalesVacias };
      return { calidadAprobada: false, autenticidadAprobada: autenticidad, imagen, motivoRechazo: motivo };
    }

    const dimensiones = dimensionesDeImagen(bytes);
    if (!dimensiones) return rechazo(MOTIVO_FORMATO_DESCONOCIDO, false);

    const ocr = await leerTextoDocumento(textract, bytes);
    const senales = reconocerDocumentoRegional(
      ocr.lineas.map((linea) => linea.texto),
      "FRENTE",
      paisesAceptados,
    );

    // Acá es donde se cae la foto del vaso: sin marcadores del documento no
    // hay nada que verificar. Es un rechazo de **autenticidad**, no de
    // calidad: la foto puede estar nítida y aun así no ser una cédula.
    if (senales.pais === null) {
      return rechazo(mensajeDocumentoNoReconocido(paisesAceptados), false);
    }

    const rostro = await detectarYMedirRostro(rekognition, bytes, dimensiones);
    if (!rostro.ok) {
      return rechazo(
        rostro.motivo === "SIN_ROSTRO" ? MOTIVO_SIN_ROSTRO_CEDULA : MOTIVO_VARIOS_ROSTROS_CEDULA,
        true,
      );
    }

    // `detectarYMedirRostro` ya evaluó con los umbrales de selfie
    // (`CALIDAD_ROSTRO`); acá se vuelve a decidir sobre la misma medición con
    // los del retrato impreso. Son dos objetos distintos a propósito: el
    // retrato de una cédula fotografiada nunca alcanza la nitidez de una
    // selfie, y exigírsela rechaza documentos perfectamente legibles.
    const calidad = evaluarCalidadRetratoDocumento(rostro.medicion);
    sesion.frente = { imagen, bytes, aprobada: calidad.aprobada, lineas: ocr.lineas, lineasConfiables: ocr.lineasConfiables, senales };

    return {
      calidadAprobada: calidad.aprobada,
      autenticidadAprobada: true,
      imagen,
      motivoRechazo: calidad.aprobada
        ? null
        : calidad.motivos.map((motivo) => MENSAJE_CALIDAD_ROSTRO[motivo]).join(" "),
    };
  }

  /**
   * Dorso: MRZ si lo hay, marcadores si no.
   *
   * Un MRZ presente cuyos dígitos verificadores no cierran es un rechazo; un
   * dorso **sin** MRZ no lo es, porque el formato anterior de cédula no lo
   * trae. Ahí el respaldo son los marcadores impresos.
   */
  async function capturarDorso(
    expedienteId: string,
    bytes: MediaCapturada,
  ): Promise<ResultadoCapturaCedula> {
    const imagen = imagenCapturada("CEDULA-DORSO", bytes);
    const sesion = sesionDe(expedienteId);

    const ocr = await leerTextoDocumento(textract, bytes);
    const senales = reconocerDocumentoRegional(
      ocr.lineas.map((linea) => linea.texto),
      "DORSO",
      paisesAceptados,
    );
    const mrz = buscarMrzTd1(ocr.lineas, ahora());

    // Un MRZ cuyo único verificador roto es el compuesto no es un documento
    // adulterado: es el OCR comiéndose relleno. El compuesto abarca casi toda
    // la banda —incluido el relleno—, así que un carácter perdido lo rompe sin
    // tocar la fecha de nacimiento ni el número, que tienen su propio dígito.
    // Rechazar ahí obligaría a repetir una captura correcta.
    //
    // Los campos que sí verificaron se conservan: la fecha de nacimiento de la
    // banda decide el corte de edad 18–64 (regla inviolable #8) y viene de un
    // verificador, no de una heurística de posición del frente.
    const soloCompuesto =
      !mrz.encontrado &&
      mrz.motivo === "MRZ_INVALIDO" &&
      mrz.verificados?.fechaNacimiento != null;

    if (!mrz.encontrado && mrz.motivo === "MRZ_INVALIDO" && !soloCompuesto) {
      sesion.dorso = { imagen, bytes, aprobada: false, lineas: ocr.lineas, lineasConfiables: ocr.lineasConfiables, senales };
      sesion.mrz = null;
      return {
        calidadAprobada: true,
        autenticidadAprobada: false,
        imagen,
        motivoRechazo: MOTIVO_MRZ_INVALIDO,
      };
    }

    // Un MRZ válido hace reconocible al dorso por definición: sus dígitos
    // verificadores son una prueba más fuerte que cualquier marcador impreso.
    const reconocido = mrz.encontrado || senales.pais !== null;
    sesion.dorso = { imagen, bytes, aprobada: reconocido, lineas: ocr.lineas, lineasConfiables: ocr.lineasConfiables, senales };
    sesion.mrz = mrz.encontrado ? mrz.datos : null;
    sesion.mrzVerificados = mrz.encontrado ? null : (mrz.verificados ?? null);

    return {
      calidadAprobada: reconocido,
      autenticidadAprobada: true,
      imagen,
      motivoRechazo: reconocido ? null : mensajeDocumentoNoReconocido(paisesAceptados),
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

      if (!sesion.frente?.aprobada || !sesion.dorso?.aprobada) {
        return { datos: DATOS_VACIOS, confiable: false, numeroCedulaSinConfirmar: null };
      }

      const pais = sesion.frente.senales.pais ?? sesion.dorso.senales.pais;
      if (pais === null) {
        return { datos: DATOS_VACIOS, confiable: false, numeroCedulaSinConfirmar: null };
      }

      const mrz = sesion.mrz;

      // Camino bueno: hay MRZ, así que se lee de ahí y se cruza contra el
      // frente. Es idéntico al de producción — la relajación de este
      // adaptador no toca este caso.
      if (mrz) {
        const cruce = cruzarConMrz(
          {
            numeroCedula: sesion.frente.senales.numeroDetectado ?? "",
            fechaNacimiento: mrz.fechaNacimiento,
            sexo: mrz.sexo,
          },
          mrz,
          ahora(),
        );

        if (!cruce.coincide) {
          return { datos: DATOS_VACIOS, confiable: false, numeroCedulaSinConfirmar: null };
        }

        return {
          numeroCedulaSinConfirmar: mrz.numeroDocumento,
          datos: {
            numeroCedula: mrz.numeroDocumento,
            nombres: mrz.nombres,
            apellidos: mrz.apellidos,
            fechaNacimiento: mrz.fechaNacimiento,
            sexo: mrz.sexo,
            nacionalidad: mrz.nacionalidad,
          },
          confiable: true,
        };
      }

      // Camino de demostración: sin MRZ, se adivina con heurísticas de rótulo.
      // Producción devuelve vacío acá (regla inviolable #8); esto es lo que
      // hace que este adaptador no sea el de producción.
      // Solo lo leído con confianza: la lectura del frente devolvía fragmentos
      // sueltos —«BLI» con 30 %, «R'P» con 14 %— que competían con los valores
      // reales. El MRZ del dorso se busca aparte y sobre todas las líneas,
      // porque su validación son sus propios dígitos verificadores.
      const campos = extraerCamposAproximados(
        [...sesion.frente.lineasConfiables, ...sesion.dorso.lineasConfiables],
        pais,
      );
      const numeroCedula = sesion.frente.senales.numeroDetectado;

      // **La fecha que decide el corte de edad sale del MRZ siempre que su
      // dígito verificador haya cerrado** (decisión de Andres, 01-sep-2026).
      // La del frente es una heurística de posición —«la más antigua de las
      // fechas leídas»—; la de la banda está protegida por un verificador.
      // Para una regla inviolable (#8: la edad se comprueba contra la fecha
      // del documento, no contra una declarada), gana la verificada.
      const fechaVerificada = sesion.mrzVerificados?.fechaNacimiento ?? null;
      const fechaNacimiento = fechaVerificada ?? campos.fechaNacimiento;

      // El número y la fecha son los dos únicos campos sin los cuales el
      // flujo no puede seguir: uno identifica y el otro decide el corte de
      // edad. Nombre y sexo pueden faltar sin romper nada.
      if (!numeroCedula || !fechaNacimiento) {
        return { datos: DATOS_VACIOS, confiable: false, numeroCedulaSinConfirmar: numeroCedula };
      }

      return {
        numeroCedulaSinConfirmar: numeroCedula,
        datos: {
          numeroCedula,
          nombres: campos.nombres ?? "",
          apellidos: campos.apellidos ?? "",
          fechaNacimiento,
          sexo: campos.sexo ?? "",
          nacionalidad: NACIONALIDAD_POR_PAIS[pais],
        },
        confiable: true,
      };
    },

    /**
     * Selfie por bytes: **presencia, no prueba de vida**.
     *
     * Rechaza el camino de sesión de forma explícita, igual que el adaptador
     * de producción rechaza el de bytes. Cada uno declara lo que no sabe
     * hacer; un adaptador que aceptara los dos no diría nada sobre qué
     * verificó realmente.
     */
    async capturarSelfieYPruebaDeVida(
      expedienteId,
      captura: CapturaSelfie,
    ): Promise<ResultadoSelfie> {
      if (captura.tipo === "SESION_LIVENESS") {
        throw new Error(
          "El adaptador de demostración con cámara no abre sesiones de Face Liveness: recibe la " +
            "foto de la selfie. Para prueba de vida real usá INTEGRATION_IDENTITY=live.",
        );
      }

      const bytes = captura.video;
      const imagen = imagenCapturada("SELFIE", bytes);
      const sesion = sesionDe(expedienteId);

      const dimensiones = dimensionesDeImagen(bytes);
      if (!dimensiones) {
        sesion.selfie = { bytes, aprobada: false };
        return {
          pruebaDeVidaAprobada: false,
          imagen,
          puntuacion: null,
          motivoRechazo: MOTIVO_FORMATO_DESCONOCIDO,
        };
      }

      const rostro = await detectarYMedirRostro(rekognition, bytes, dimensiones);
      if (!rostro.ok) {
        sesion.selfie = { bytes, aprobada: false };
        return {
          pruebaDeVidaAprobada: false,
          imagen,
          puntuacion: null,
          motivoRechazo:
            rostro.motivo === "SIN_ROSTRO" ? MOTIVO_SIN_ROSTRO_SELFIE : MOTIVO_VARIOS_ROSTROS_SELFIE,
        };
      }

      const decision = decidirPresenciaDemo(rostro.calidad.aprobada);
      sesion.selfie = { bytes, aprobada: decision.aprobada };

      return {
        pruebaDeVidaAprobada: decision.aprobada,
        imagen,
        puntuacion: decision.puntuacion,
        // Los motivos de calidad de AWS traducidos: son accionables ("buscá
        // más luz", "sacate los lentes") y evitan que la persona repita la
        // misma captura fallida.
        motivoRechazo: decision.aprobada
          ? null
          : rostro.calidad.motivos.map((motivo) => MENSAJE_CALIDAD_ROSTRO[motivo]).join(" "),
      };
    },

    async compararRostro(expedienteId): Promise<ResultadoComparacionFacial> {
      const sesion = sesionDe(expedienteId);

      // Comparar contra una cédula que no se reconoció, o contra una selfie
      // sin rostro utilizable, sería darle valor a una coincidencia que no
      // prueba nada.
      if (!sesion.frente?.aprobada || !sesion.selfie?.aprobada) {
        const rechazada = decidirCoincidenciaFacialDemo(null, null);
        return {
          coincidenciaFacialAprobada: rechazada.aprobada,
          puntuacion: rechazada.puntuacion,
        };
      }

      // `compararRostros` decide con el umbral de producción (99); acá hace
      // falta la puntuación cruda para volver a decidirla con el de
      // demostración. Es el mismo número del proveedor, otra vara.
      const deProduccion = await compararRostros(
        rekognition,
        sesion.selfie.bytes,
        sesion.frente.bytes,
      );
      const decision = decidirCoincidenciaFacialDemo(
        deProduccion.puntuacion,
        deProduccion.versionModeloProveedor,
      );

      return {
        coincidenciaFacialAprobada: decision.aprobada,
        puntuacion: decision.puntuacion,
      };
    },
  };
}
