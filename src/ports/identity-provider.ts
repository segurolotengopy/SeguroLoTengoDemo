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
}

export interface ResultadoSelfie {
  readonly pruebaDeVidaAprobada: boolean;
  readonly imagen: ImagenCapturada;
}

export interface ResultadoComparacionFacial {
  readonly coincidenciaFacialAprobada: boolean;
  /** Puntuación del proveedor si la expone; no es obligatoria para decidir aprobación. */
  readonly puntuacion: number | null;
}

export interface IdentityProvider {
  capturarFrenteCedula(expedienteId: string, imagen: MediaCapturada): Promise<ResultadoCapturaCedula>;

  capturarDorsoCedula(expedienteId: string, imagen: MediaCapturada): Promise<ResultadoCapturaCedula>;

  /** Requiere que frente y dorso ya hayan sido capturados para este expediente. */
  extraerDatosCedula(expedienteId: string): Promise<ResultadoOcrCedula>;

  capturarSelfieYPruebaDeVida(expedienteId: string, video: MediaCapturada): Promise<ResultadoSelfie>;

  /** Requiere que frente y selfie ya hayan sido capturados para este expediente. */
  compararRostro(expedienteId: string): Promise<ResultadoComparacionFacial>;
}
