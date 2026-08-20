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
 * Desde D-12 el motor produce **dos** documentos: el paquete único (Solicitud
 * + FIPF, que se cierra antes de firmar) y el Certificado de Cobertura
 * Provisional (que se emite con el pago acreditado). Comparten motor,
 * determinismo y QR de verificación; se diferencian en cuándo nacen y en quién
 * los firma (`src/domain/firmantes-documento.ts`).
 */
export {
  CONTENT_TYPE_PDF,
  ESTADO_REQUERIDO_DOCUMENTOS,
  PASO_EVIDENCIA_CERTIFICADO,
  PASO_EVIDENCIA_DOCUMENTOS,
  archivarDocumentosFirmados,
  claveCertificado,
  claveDocumento,
  claveDocumentoFirmado,
  emitirCertificadoCobertura,
  generarPaqueteDocumental,
} from "./servicio";
export type {
  DependenciasArchivadoFirmados,
  DependenciasCertificado,
  DependenciasDocumentos,
  DocumentoGenerado,
  MotivoRechazoCertificado,
  MotivoRechazoDocumentos,
  RepositorioArchivos,
  ResultadoArchivadoFirmados,
  ResultadoEmitirCertificado,
  ResultadoGenerarPaquete,
} from "./servicio";
export { renderizarCertificado, renderizarPaquete } from "./plantillas";
export { generarMatrizQr } from "./qr";
export type { MatrizQr } from "./qr";
