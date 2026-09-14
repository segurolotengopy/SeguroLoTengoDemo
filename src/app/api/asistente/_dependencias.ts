/**
 * Composition root de la familia `/api/asistente`.
 *
 * Deliberadamente NO pide repositorios: el asistente no lee ni escribe el
 * expediente, no deja evidencia y no conoce a Bancard, Code100 ni SEBAOT. Lo
 * único que necesita es el puerto del asistente, resuelto por el registro
 * (`INTEGRATION_ASISTENTE`: mock por defecto, live con `CHATBOTRAG_URL`).
 */
import { obtenerAsistenteProvider } from "@/adapters/registro";
import type { DependenciasAsistente } from "@/domain/asistente";

export function dependenciasAsistente(): DependenciasAsistente {
  return { asistente: obtenerAsistenteProvider() };
}
