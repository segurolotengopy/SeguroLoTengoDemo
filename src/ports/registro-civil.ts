/**
 * Puerto de consulta al registro civil paraguayo (Departamento de
 * Identificaciones de la Policía Nacional).
 *
 * Ítem 33 de `docs/Tabla de Integraciones externas - Tabla.csv`. Es el octavo
 * puerto del sistema, y nace de un problema concreto del piloto de tres
 * formatos (§9 de `docs/RECOMENDACIONES_ONBOARDING_IDENTIDAD.md`): **la cédula
 * del formato anterior no tiene MRZ**, así que no hay de dónde sacar nombre ni
 * fecha de nacimiento con garantías, y esas personas quedan sin poder
 * contratar.
 *
 * El frente de esa cédula **sí** da el número de forma confiable. Con el
 * número, la fuente oficial devuelve nombre y fecha de nacimiento. Eso es más
 * fuerte que leer por OCR un documento de treinta años, no un parche: cambia
 * "lo que dice el plástico" por "lo que dice el registro".
 *
 * ## Por qué es un puerto y no una función
 *
 * Detrás puede haber un convenio directo con Identificaciones o un
 * intermediario comercial (Didit declara el servicio a ~USD 0,20 por consulta
 * concluyente). Esa decisión no debe filtrarse al dominio, igual que pasa con
 * Bancard o Code100.
 *
 * ## Lo que este puerto NO es
 *
 * **No es autenticidad documental.** Dice que existe una persona con ese
 * número y esos datos en el registro; no dice que el plástico que la persona
 * fotografió sea genuino. Un impostor con el número de cédula ajeno pasa esta
 * consulta — lo que no pasa es la comparación facial contra la foto del
 * documento, que sigue siendo obligatoria.
 *
 * **No reemplaza al MRZ donde el MRZ existe.** Para el formato nuevo, el MRZ
 * ya trae dígitos verificadores y no hace falta gastar una consulta.
 */

/**
 * Lo que devuelve el registro. Deliberadamente **mínimo**: solo los campos que
 * P5 necesita y que la cédula misma mostraría.
 *
 * No se piden ni se aceptan domicilio, filiación, estado civil ni nada que el
 * flujo no use. Minimización de datos: cada campo de más es un dato personal
 * que hay que custodiar, justificar y borrar.
 */
export interface DatosRegistroCivil {
  readonly numeroCedula: string;
  readonly nombres: string;
  readonly apellidos: string;
  /** ISO 8601 (AAAA-MM-DD). Es la que alimenta el corte de edad 18–64. */
  readonly fechaNacimiento: string;
  readonly sexo: string;
  /**
   * Nacionalidad del titular. El registro la conoce —también inscribe
   * residentes— y P5 la muestra entre los campos bloqueados, así que sin ella
   * habría que dejar un campo vacío en pantalla.
   */
  readonly nacionalidad: string;
}

/**
 * Resultado de la consulta. Los tres estados son **genuinamente distintos** y
 * mezclarlos sería un error caro:
 *
 * - `ENCONTRADO` — hay una persona con ese número; vienen sus datos.
 * - `NO_ENCONTRADO` — el registro respondió y **no existe** ese número. Es una
 *   respuesta concluyente, y mala señal.
 * - `NO_DISPONIBLE` — el registro no pudo contestar (caído, timeout, cuota).
 *   **No dice nada sobre la persona.**
 *
 * Tratar `NO_DISPONIBLE` como `NO_ENCONTRADO` rechazaría a personas legítimas
 * por una falla de infraestructura ajena. Tratarlo como `ENCONTRADO` dejaría
 * pasar a cualquiera cuando el servicio se cae — que es exactamente el momento
 * que un atacante elegiría. Por eso son tres y no dos.
 *
 * **Hoy los dos estados negativos tienen la misma consecuencia** —la persona
 * no puede continuar— pero quedan distinguidos en la evidencia. Esa distinción
 * es lo que va a permitir derivar a revisión manual solo el caso que
 * corresponde, cuando esa salida exista (§6 del documento de recomendaciones):
 * derivar a alguien porque el registro se cayó tiene sentido; derivar a alguien
 * cuya cédula no existe, no.
 */
export type ResultadoConsultaRegistroCivil =
  | {
      readonly estado: "ENCONTRADO";
      readonly datos: DatosRegistroCivil;
      /** Identificador opaco de la consulta, para la evidencia. */
      readonly referenciaConsulta: string;
    }
  | { readonly estado: "NO_ENCONTRADO"; readonly referenciaConsulta: string }
  | { readonly estado: "NO_DISPONIBLE"; readonly motivo: string };

export interface RegistroCivilProvider {
  /**
   * Consulta por número de cédula.
   *
   * **Solo recibe el número.** No se le manda nombre, foto, ni ningún otro
   * dato del expediente: el proveedor no necesita saber a qué producto ni a
   * qué trámite corresponde la consulta, y cuanto menos sepa, menos hay que
   * justificar ante un auditor.
   */
  consultarPorCedula(numeroCedula: string): Promise<ResultadoConsultaRegistroCivil>;
}
