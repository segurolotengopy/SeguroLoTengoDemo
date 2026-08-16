/**
 * Puerto de identidad documental y biométrica (P5): captura de frente y
 * dorso de la cédula, OCR y validación de autenticidad/calidad, selfie con
 * prueba de vida, y comparación facial.
 *
 * Alimenta los campos de `Identidad` y `CapturaBiometrica` de
 * `src/domain/tipos.ts`, y expone por separado los booleanos de aprobación
 * de cada verificación (calidad, autenticidad, prueba de vida, coincidencia
 * facial) para que el dominio pueda evaluar los cinco requisitos de P5.
 *
 * Regla de P5: los campos autocompletados por OCR nunca se editan a mano.
 * Por eso esta interfaz no declara ningún método de "corregir" un dato
 * extraído — ante una discrepancia, el único camino es repetir la captura
 * (volver a llamar `capturarFrenteCedula` / `capturarDorsoCedula`).
 *
 * Regla de negocio inviolable #8: la fecha de nacimiento que alimenta el
 * cálculo de edad viene de acá (OCR de la cédula), nunca de un campo
 * declarado por el usuario.
 */

/** Bytes de la imagen o video capturado; el transporte real (upload, stream) es responsabilidad del adaptador. */
export type MediaCapturada = Uint8Array;

export interface ImagenCapturada {
  /** Referencia opaca a la evidencia almacenada (el guardado en sí lo hace EvidenceStore, no este puerto). */
  readonly referencia: string;
  readonly hashSha256: string;
}

export interface ResultadoCapturaCedula {
  readonly calidadAprobada: boolean;
  readonly autenticidadAprobada: boolean;
  readonly imagen: ImagenCapturada;
  readonly motivoRechazo: string | null;
}

export interface DatosExtraidosCedula {
  readonly numeroCedula: string;
  readonly nombres: string;
  readonly apellidos: string;
  /** ISO 8601 (YYYY-MM-DD). Fuente única y válida para el cálculo de edad (regla #8). */
  readonly fechaNacimiento: string;
  readonly sexo: string;
  readonly nacionalidad: string;
}

export interface ResultadoOcrCedula {
  readonly datos: DatosExtraidosCedula;
  /** Si es false, el dominio debe pedir repetir la captura en vez de aceptar los datos. */
  readonly confiable: boolean;
  /**
   * Número de cédula leído del frente, **incluso cuando `confiable` es false**.
   * `null` si tampoco se pudo leer eso.
   *
   * Existe por la cédula del formato anterior, que no tiene MRZ: ahí el nombre
   * y la fecha de nacimiento no se pueden obtener con garantías —y por eso
   * `confiable` es false— pero el número impreso **sí** se lee sin ambigüedad.
   * Con ese número el dominio puede consultar el registro civil
   * (`RegistroCivilProvider`) y traer los datos de la fuente oficial, que es
   * más fuerte que leerlos del plástico.
   *
   * **No es un dato utilizable por sí solo.** Es una pista para ir a buscar la
   * verdad a otro lado, no un valor para persistir: nada de lo que dependa de
   * este campo puede saltearse la confirmación del registro.
   */
  readonly numeroCedulaSinConfirmar: string | null;
}

/**
 * De dónde sale la selfie con prueba de vida. Es una unión y no `MediaCapturada`
 * a secas porque los dos caminos posibles son genuinamente distintos:
 *
 * - `VIDEO` — el backend recibe los bytes. Es lo que hace el mock del demo, y
 *   lo que haría un proveedor con API de foto simple.
 * - `SESION_LIVENESS` — el video va del navegador **directo al proveedor** por
 *   un canal de streaming, y el backend nunca lo ve: solo recibe la referencia
 *   de la sesión y consulta el resultado. Es cómo funciona AWS Rekognition
 *   Face Liveness, y por eso el puerto no puede asumir bytes.
 *
 * Un adaptador que no soporte una de las dos variantes tiene que rechazarla
 * explícitamente, no ignorarla.
 */
export type CapturaSelfie =
  | { readonly tipo: "VIDEO"; readonly video: MediaCapturada }
  | { readonly tipo: "SESION_LIVENESS"; readonly referenciaSesion: string };

export interface ResultadoSelfie {
  readonly pruebaDeVidaAprobada: boolean;
  readonly imagen: ImagenCapturada;
  /**
   * Confianza cruda de la prueba de vida, **escala 0–100**. `null` si el
   * proveedor no la expone o si la sesión no llegó a producir un resultado.
   *
   * Va a la evidencia junto con el umbral aplicado: un `aprobada: true` suelto
   * no permite reconstruir con qué criterio se aprobó
   * (`src/domain/identidad-parametros.ts`).
   */
  readonly puntuacion: number | null;
  /**
   * Qué hacer para que la próxima captura salga bien, en el idioma de la
   * persona. `null` o ausente si aprobó, o si el proveedor no distingue
   * motivos y alcanza con el mensaje genérico del dominio.
   *
   * Es opcional porque los proveedores de prueba de vida por streaming no lo
   * necesitan: ahí el detector guía a la persona en tiempo real y el backend
   * recibe un veredicto ya explicado. Un proveedor que reciba una foto suelta
   * sí sabe por qué la rechazó —no había rostro, había dos, estaba oscura— y
   * ese detalle es lo único que evita que la persona repita la misma captura
   * fallida. Sin este campo, `ResultadoSelfie` era el único resultado del
   * puerto que no podía explicarse, mientras `ResultadoCapturaCedula` sí.
   */
  readonly motivoRechazo?: string | null;
}

export interface ResultadoComparacionFacial {
  readonly coincidenciaFacialAprobada: boolean;
  /**
   * Similitud del proveedor si la expone; no es obligatoria para decidir
   * aprobación. **Escala 0–100**, la de Rekognition: cualquier adaptador que
   * hable otra escala normaliza antes de devolverla, porque un 0,97 comparado
   * contra un umbral de 99 rechazaría lo que debería aprobar.
   */
  readonly puntuacion: number | null;
}

/**
 * Capacidad extra de los proveedores cuya prueba de vida es una sesión de
 * streaming (`SESION_LIVENESS`): abrir la sesión antes de que el navegador
 * empiece a transmitir.
 *
 * Va aparte de `IdentityProvider` porque no todos los proveedores la tienen —
 * el mock del demo no la necesita— y un método opcional en la interfaz
 * principal obligaría a todos a declarar que no lo implementan. Quien la
 * necesite pregunta con `soportaSesionPruebaDeVida`.
 */
export interface SesionPruebaDeVida {
  /** Referencia opaca de la sesión. En Rekognition, el `SessionId`. */
  readonly referenciaSesion: string;
  /** Vigencia declarada por el proveedor, en segundos. Un solo uso. */
  readonly vigenciaSegundos: number;
}

export interface ProveedorSesionPruebaDeVida {
  crearSesionPruebaDeVida(expedienteId: string): Promise<SesionPruebaDeVida>;
}

/** `true` si este proveedor puede abrir sesiones de prueba de vida en vivo. */
export function soportaSesionPruebaDeVida(
  proveedor: IdentityProvider,
): proveedor is IdentityProvider & ProveedorSesionPruebaDeVida {
  return typeof (proveedor as Partial<ProveedorSesionPruebaDeVida>).crearSesionPruebaDeVida === "function";
}

export interface IdentityProvider {
  capturarFrenteCedula(expedienteId: string, imagen: MediaCapturada): Promise<ResultadoCapturaCedula>;

  capturarDorsoCedula(expedienteId: string, imagen: MediaCapturada): Promise<ResultadoCapturaCedula>;

  /** Requiere que frente y dorso ya hayan sido capturados para este expediente. */
  extraerDatosCedula(expedienteId: string): Promise<ResultadoOcrCedula>;

  capturarSelfieYPruebaDeVida(
    expedienteId: string,
    captura: CapturaSelfie,
  ): Promise<ResultadoSelfie>;

  /** Requiere que frente y selfie ya hayan sido capturados para este expediente. */
  compararRostro(expedienteId: string): Promise<ResultadoComparacionFacial>;
}
