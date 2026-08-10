/**
 * Adaptador mock de `IdentityProvider` (P5 · Verificación de identidad).
 *
 * Simula al proveedor de identidad documental y biométrica (Entrust/Onfido,
 * según `docs/Tabla de Integraciones externas - Tabla.csv`) sin salir a la
 * red: no hay `fetch`, no hay credenciales, no hay modelo de visión. Acepta
 * cualquier imagen de prueba —los bytes que le mande la pantalla— y decide el
 * desenlace según la **persona de prueba activa del panel de demo**
 * (`persona-activa.ts`), no según lo que haya en la imagen.
 *
 * Los cuatro desenlaces (`EscenarioIdentidadDemo`):
 *
 *   - `APROBADO`             → calidad, autenticidad, prueba de vida y
 *                              coincidencia facial aprobadas; el OCR devuelve
 *                              los datos de la persona activa.
 *   - `CALIDAD_INSUFICIENTE` → frente y dorso rechazados por calidad; sin
 *                              capturas aprobadas el OCR no es confiable y la
 *                              comparación facial no puede aprobarse.
 *   - `EDAD_FUERA_DE_RANGO`  → todo aprueba, pero el OCR devuelve una fecha de
 *                              nacimiento de 17 años. Quien bloquea es el
 *                              dominio (regla inviolable #8), no el proveedor.
 *   - `NO_COINCIDE_CARA`     → capturas y prueba de vida aprobadas, pero la
 *                              comparación contra la foto de la cédula falla.
 *
 * Regla de P5 (y del puerto): los campos extraídos por OCR **no se editan a
 * mano**. Este adaptador no expone ninguna forma de corregirlos — ante una
 * discrepancia el único camino es volver a llamar a `capturarFrenteCedula` /
 * `capturarDorsoCedula`, que es exactamente lo que hace el enlace `Repetir
 * captura` de la pantalla.
 *
 * Los hashes son SHA-256 **reales de los bytes recibidos**: son los que van a
 * la evidencia (regla inviolable #10) y los que quedan en `CapturaBiometrica`.
 * Repetir una captura con una imagen distinta cambia el hash, como pasaría con
 * el proveedor oficial.
 *
 * El estado de capturas por expediente vive en memoria del proceso, igual que
 * la sesión que mantendría el proveedor real entre `session-start` y la
 * consulta de resultados: `extraerDatosCedula` y `compararRostro` reciben solo
 * el `expedienteId` porque el puerto asume esa sesión.
 */
import { createHash } from "node:crypto";
import type {
  DatosExtraidosCedula,
  IdentityProvider,
  ImagenCapturada,
  MediaCapturada,
  ResultadoCapturaCedula,
  ResultadoComparacionFacial,
  ResultadoOcrCedula,
  ResultadoSelfie,
} from "../../ports/identity-provider";
import { escenarioIdentidadActivo, personaActiva } from "./persona-activa";
import type { EscenarioIdentidadDemo } from "./persona-activa";
import { estadoCompartidoDemo } from "./estado-compartido";

/** Edad que devuelve el OCR simulado en el escenario `EDAD_FUERA_DE_RANGO`. */
const EDAD_SIMULADA_FUERA_DE_RANGO = 17;

const MOTIVO_CALIDAD =
  "La fotografía no aprobó el control de calidad: se ve borrosa o con reflejos. Repetí la captura.";
const MOTIVO_IMAGEN_VACIA = "No se recibió ninguna imagen.";

interface CapturaMock {
  readonly imagen: ImagenCapturada;
  readonly aprobada: boolean;
}

interface SelfieMock extends CapturaMock {
  readonly pruebaDeVidaAprobada: boolean;
}

interface SesionMock {
  frente?: CapturaMock;
  dorso?: CapturaMock;
  selfie?: SelfieMock;
}

/**
 * Módulo-level a propósito: cada Route Handler construye su propio adaptador
 * por request, y las capturas de `/api/p5/captura` tienen que seguir estando
 * cuando llegue `/api/p5/analisis` dentro del mismo proceso.
 */
const sesiones = estadoCompartidoDemo("identidad.sesiones", () => new Map<string, SesionMock>());

function sesionDe(expedienteId: string): SesionMock {
  const existente = sesiones.get(expedienteId);
  if (existente) return existente;
  const nueva: SesionMock = {};
  sesiones.set(expedienteId, nueva);
  return nueva;
}

function hashDe(imagen: MediaCapturada): string {
  return createHash("sha256").update(imagen).digest("hex");
}

function imagenCapturada(etiqueta: string, imagen: MediaCapturada): ImagenCapturada {
  const hashSha256 = hashDe(imagen);
  return {
    // Formato análogo a la referencia opaca que devolvería el proveedor real;
    // identifica la evidencia almacenada, no contiene datos personales.
    referencia: `MOCK-${etiqueta}-${hashSha256.slice(0, 12)}`,
    hashSha256,
  };
}

/** Fecha de nacimiento (ISO 8601) que produce exactamente `edad` años cumplidos. */
function fechaNacimientoParaEdad(edad: number, referencia: Date): string {
  const anio = referencia.getUTCFullYear() - edad;
  const fecha = new Date(Date.UTC(anio, referencia.getUTCMonth(), referencia.getUTCDate()));
  return fecha.toISOString().slice(0, 10);
}

/**
 * Lo que devuelve el OCR cuando no hay nada confiable que devolver. Vacío a
 * propósito: si el dominio usara estos datos con `confiable: false`, se vería
 * enseguida que están vacíos en vez de arrastrar los de otra persona.
 */
const DATOS_VACIOS: DatosExtraidosCedula = {
  numeroCedula: "",
  nombres: "",
  apellidos: "",
  fechaNacimiento: "",
  sexo: "",
  nacionalidad: "",
};

export interface OpcionesIdentityProviderMock {
  /** Escenario a simular. Por defecto, el de la persona activa del panel de demo. */
  readonly escenario?: () => EscenarioIdentidadDemo;
  readonly ahora?: () => Date;
}

export function crearIdentityProviderMock(
  opciones: OpcionesIdentityProviderMock = {},
): IdentityProvider {
  const ahora = opciones.ahora ?? (() => new Date());
  const escenario = opciones.escenario ?? (() => escenarioIdentidadActivo(ahora()));

  function capturarCedula(
    expedienteId: string,
    lado: "FRENTE" | "DORSO",
    imagen: MediaCapturada,
  ): ResultadoCapturaCedula {
    const capturada = imagenCapturada(`CEDULA-${lado}`, imagen);
    const sesion = sesionDe(expedienteId);

    if (imagen.length === 0) {
      const rechazada = { imagen: capturada, aprobada: false };
      if (lado === "FRENTE") sesion.frente = rechazada;
      else sesion.dorso = rechazada;
      return {
        calidadAprobada: false,
        autenticidadAprobada: false,
        imagen: capturada,
        motivoRechazo: MOTIVO_IMAGEN_VACIA,
      };
    }

    const calidadAprobada = escenario() !== "CALIDAD_INSUFICIENTE";
    const registro = { imagen: capturada, aprobada: calidadAprobada };
    if (lado === "FRENTE") sesion.frente = registro;
    else sesion.dorso = registro;

    return {
      calidadAprobada,
      // La autenticidad del documento (que sea una cédula paraguaya vigente y
      // no una copia) es independiente de la calidad de la foto: el escenario
      // de calidad insuficiente no dice nada del documento en sí.
      autenticidadAprobada: true,
      imagen: capturada,
      motivoRechazo: calidadAprobada ? null : MOTIVO_CALIDAD,
    };
  }

  return {
    async capturarFrenteCedula(expedienteId, imagen): Promise<ResultadoCapturaCedula> {
      return capturarCedula(expedienteId, "FRENTE", imagen);
    },

    async capturarDorsoCedula(expedienteId, imagen): Promise<ResultadoCapturaCedula> {
      return capturarCedula(expedienteId, "DORSO", imagen);
    },

    async extraerDatosCedula(expedienteId): Promise<ResultadoOcrCedula> {
      const sesion = sesionDe(expedienteId);

      // El puerto exige frente y dorso capturados. Sin las dos caras
      // aprobadas no hay lectura confiable: el dominio tiene que pedir
      // repetir la captura en vez de aceptar datos.
      if (!sesion.frente?.aprobada || !sesion.dorso?.aprobada) {
        return { datos: DATOS_VACIOS, confiable: false };
      }

      const persona = personaActiva();
      const { identidad } = persona;
      const fechaNacimiento =
        escenario() === "EDAD_FUERA_DE_RANGO"
          ? fechaNacimientoParaEdad(EDAD_SIMULADA_FUERA_DE_RANGO, ahora())
          : identidad.fechaNacimiento;

      return {
        datos: {
          numeroCedula: identidad.numeroCedula,
          nombres: identidad.nombres,
          apellidos: identidad.apellidos,
          fechaNacimiento,
          sexo: identidad.sexo,
          nacionalidad: identidad.nacionalidad,
        },
        confiable: true,
      };
    },

    async capturarSelfieYPruebaDeVida(expedienteId, video): Promise<ResultadoSelfie> {
      const capturada = imagenCapturada("SELFIE", video);
      const pruebaDeVidaAprobada = video.length > 0;

      sesionDe(expedienteId).selfie = {
        imagen: capturada,
        aprobada: pruebaDeVidaAprobada,
        pruebaDeVidaAprobada,
      };

      return { pruebaDeVidaAprobada, imagen: capturada };
    },

    async compararRostro(expedienteId): Promise<ResultadoComparacionFacial> {
      const sesion = sesionDe(expedienteId);

      // El puerto exige frente y selfie capturados. Además, no hay forma de
      // comparar contra una cédula que no se pudo leer ni contra una selfie
      // que no aprobó la prueba de vida: el adaptador oficial tampoco debería
      // devolver una coincidencia en ese caso.
      if (!sesion.frente?.aprobada || !sesion.selfie?.pruebaDeVidaAprobada) {
        return { coincidenciaFacialAprobada: false, puntuacion: null };
      }

      if (escenario() === "NO_COINCIDE_CARA") {
        return { coincidenciaFacialAprobada: false, puntuacion: 0.31 };
      }

      return { coincidenciaFacialAprobada: true, puntuacion: 0.97 };
    },
  };
}

/** Solo para tests: borra las sesiones de captura simuladas entre casos. */
export function limpiarSesionesIdentidadMock(): void {
  sesiones.clear();
}
