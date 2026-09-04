/**
 * Servicio de generación de documentos: cierra la Solicitud y el FIPF, los
 * hashea y los guarda antes de habilitar la firma (regla de negocio
 * inviolable #4).
 *
 * Es un servicio **interno**, no un proveedor externo: por eso vive acá y no
 * detrás de un puerto de `src/ports/`. Los siete puertos modelan integraciones
 * con terceros (Bancard, Code100, Infobip…); generar un PDF propio no lo es, y
 * meterlo detrás de una interfaz de proveedor sugeriría que algún día lo va a
 * hacer otro. Lo que sí pasa por infraestructura —guardar el archivo— entra
 * por `ArchivoRepository`, que ya existía en `src/repositories/` y estaba
 * previsto para esto.
 *
 * Reparto de responsabilidades:
 *
 * - `src/domain/documentos.ts` — qué dice cada documento (dominio).
 * - `plantillas.ts` + `layout.ts` — cómo se distribuye en la hoja.
 * - `pdf.ts` + `tipografia.ts` — cómo se escriben los bytes del PDF.
 * - `qr.ts` — el QR de verificación que va impreso en cada carilla.
 * - `servicio.ts` — cerrar, hashear, guardar, transicionar y dejar evidencia.
 *
 * El motor produce **tres** documentos, y la diferencia entre ellos no es de
 * formato sino de naturaleza:
 *
 * - **El paquete** (Solicitud + FIPF, D-11) se cierra, se hashea y se firma.
 * - **El Certificado de Cobertura Provisional** (D-12) se cierra, se hashea y
 *   lo firma Alianza; nace con el cobro acreditado.
 * - **El comprobante de pago** (D-05) no se cierra, no se hashea y no se
 *   firma: es una constancia de un hecho ya probado por los otros dos, y se
 *   genera al vuelo cada vez que se lo pide.
 *
 * Los tres son deterministas y los dos primeros llevan QR de verificación.
 */
export {
  CONTENT_TYPE_PDF,
  ESTADO_REQUERIDO_DOCUMENTOS,
  PASO_EVIDENCIA_CERTIFICADO,
  PASO_EVIDENCIA_DOCUMENTOS,
  archivarDocumentosFirmados,
  claveCertificado,
  claveConstancia,
  claveDocumento,
  claveDocumentoFirmado,
  emitirCertificadoCobertura,
  emitirConstanciaFirma,
  generarComprobantePago,
  generarPaqueteDocumental,
} from "./servicio";
export type {
  DependenciasArchivadoFirmados,
  DependenciasCertificado,
  DependenciasDocumentos,
  DocumentoGenerado,
  MotivoRechazoCertificado,
  MotivoRechazoConstancia,
  MotivoRechazoDocumentos,
  RepositorioArchivos,
  ResultadoArchivadoFirmados,
  ResultadoComprobantePago,
  ResultadoEmitirCertificado,
  ResultadoEmitirConstancia,
  ResultadoGenerarPaquete,
} from "./servicio";
export {
  renderizarCertificado,
  renderizarComprobante,
  renderizarConstancia,
  renderizarPaquete,
} from "./plantillas";
export { generarMatrizQr } from "./qr";
export type { MatrizQr } from "./qr";
