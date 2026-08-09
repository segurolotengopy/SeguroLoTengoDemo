/**
 * Puerto de verificación de cumplimiento (ComplyAdvantage): consulta de PEP,
 * familiares y asociados, sanciones, listas de vigilancia y noticias
 * adversas, por identidad.
 *
 * Este puerto es de **verificación y auditoría de cumplimiento**, para
 * trazabilidad y evidencia. La decisión de negocio de derivar a Pantalla A
 * por condición PEP (regla de negocio inviolable #5) se toma en
 * `src/domain/` a partir de la declaración autodeclarada del solicitante
 * (P6, declaración 8) — nunca a partir del resultado de esta consulta. No
 * corresponde usar este puerto como gate del flujo.
 *
 * Regla de negocio inviolable #7: el resultado de esta consulta (y los
 * datos de identidad que la originan) no debe salir hacia analítica, CRM,
 * monitoreo de errores ni servicios de IA.
 */
export interface SolicitudConsultaCompliance {
  readonly expedienteId: string;
  readonly numeroCedula: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly fechaNacimiento: string; // ISO 8601
}

export type CategoriaCoincidenciaCompliance = "PEP" | "SANCIONES" | "LISTA_VIGILANCIA" | "NOTICIAS_ADVERSAS";

export interface CoincidenciaCompliance {
  readonly categoria: CategoriaCoincidenciaCompliance;
  readonly descripcion: string;
  readonly fuente: string;
}

export interface ResultadoConsultaCompliance {
  readonly consultaId: string;
  readonly consultadoEn: string; // ISO 8601
  readonly hayCoincidencias: boolean;
  readonly coincidencias: readonly CoincidenciaCompliance[];
}

export interface ComplianceProvider {
  consultarPepYSanciones(solicitud: SolicitudConsultaCompliance): Promise<ResultadoConsultaCompliance>;
}
