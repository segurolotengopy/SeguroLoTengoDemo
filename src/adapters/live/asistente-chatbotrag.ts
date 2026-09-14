/**
 * Cliente HTTP del servicio ChatbotRAG (ítem 35 de
 * `docs/Tabla de Integraciones externas - Tabla.csv`; repo
 * `segurolotengopy/ChatbotRAG`, servicio en Cloud Run). Único `fetch` hacia el
 * asistente en todo el repositorio.
 *
 * Contrato consumido (`paquetes/canal-web/src/contrato.ts` de ese repo):
 *
 *   GET  /v1/agente                                        → DescripcionAgente
 *   POST /v1/conversaciones/{conversacionId}/mensajes      → RespuestaMensaje
 *        cuerpo { perfilId, texto, canal: "web" }
 *
 * Autenticación: `Authorization: Bearer <clave>`. La clave vive en Secrets
 * Manager (`CHATBOTRAG_TOKEN` dentro de `slt-demo-app-secrets`), igual que la de
 * WhatsApp-Modular, y se resuelve dentro de la llamada asíncrona para que el
 * composition root siga siendo síncrono. El agente que atiende lo decide el
 * servicio a partir de la clave: este cliente no puede elegir otro.
 *
 * Lo que este cliente NO hace: no reintenta (un asistente que responde tarde y
 * dos veces confunde más que uno que dice «no disponible»), no registra el texto
 * en ningún log (regla inviolable #7 y CMP-16) y no decide nada de negocio — el
 * filtro de datos sensibles corre antes, en `src/domain/asistente.ts`.
 */
import type { AsistenteProvider, DescripcionAsistente, MensajeAsistente, RespaldoAsistente, RespuestaAsistente } from "@/ports/asistente-provider";

export interface ConfiguracionClienteChatbotRag {
  /** Origen del servicio, sin barra final. Ej.: `https://chatbotrag-xxxx.a.run.app`. */
  readonly baseUrl: string;
  readonly clave: string | (() => Promise<string>);
  /** Inyectable para tests: nunca se hace red real en la suite. */
  readonly fetchFn?: typeof fetch;
  readonly timeoutMs?: number;
}

interface RespuestaServicio {
  readonly ok: boolean;
  readonly motivo?: string;
  readonly texto?: string;
  readonly respaldo?: ReadonlyArray<{ fuenteId: string; titulo: string; version: string }>;
  readonly avisos?: readonly string[];
  readonly derivacion?: { motivo: string } | null;
}

interface DescripcionServicio {
  readonly ok: boolean;
  readonly agente?: { nombreAsistente: string };
  readonly perfilPorDefecto?: string | null;
  readonly perfiles?: ReadonlyArray<{ id: string; nombre: string; bienvenida: string }>;
  readonly bienvenida?: string;
}

function limpiarRespaldo(lista: RespuestaServicio["respaldo"]): readonly RespaldoAsistente[] {
  return (lista ?? [])
    .filter((r) => typeof r.fuenteId === "string" && typeof r.titulo === "string" && typeof r.version === "string")
    .map((r) => ({ fuenteId: r.fuenteId.slice(0, 80), titulo: r.titulo.slice(0, 160), version: r.version.slice(0, 40) }));
}

export function crearAsistenteChatbotRag(config: ConfiguracionClienteChatbotRag): AsistenteProvider {
  const fetchFn = config.fetchFn ?? fetch;
  const timeoutMs = config.timeoutMs ?? 20_000;
  const base = config.baseUrl.replace(/\/$/, "");

  async function llamar(metodo: "GET" | "POST", ruta: string, cuerpo?: unknown): Promise<{ status: number; json: unknown } | null> {
    const clave = typeof config.clave === "function" ? await config.clave() : config.clave;
    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), timeoutMs);
    try {
      const respuesta = await fetchFn(`${base}${ruta}`, {
        method: metodo,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${clave}`,
          ...(cuerpo === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
        signal: control.signal,
      });
      const json: unknown = await respuesta.json().catch(() => null);
      return { status: respuesta.status, json };
    } catch {
      return null;
    } finally {
      clearTimeout(temporizador);
    }
  }

  return {
    nombre: "ChatbotRAG · real",
    async describir(): Promise<DescripcionAsistente | null> {
      const r = await llamar("GET", "/v1/agente");
      if (!r || r.status !== 200) return null;
      const d = r.json as DescripcionServicio | null;
      if (!d?.ok || !d.agente || !Array.isArray(d.perfiles) || typeof d.bienvenida !== "string") return null;
      return {
        nombreAsistente: d.agente.nombreAsistente,
        perfilPorDefecto: d.perfilPorDefecto ?? null,
        perfiles: d.perfiles.map((p) => ({ id: p.id, nombre: p.nombre, bienvenida: p.bienvenida })),
        bienvenida: d.bienvenida,
      };
    },
    async responder(mensaje: MensajeAsistente): Promise<RespuestaAsistente> {
      const r = await llamar("POST", `/v1/conversaciones/${encodeURIComponent(mensaje.conversacionId)}/mensajes`, {
        perfilId: mensaje.perfilId,
        texto: mensaje.texto,
        canal: "web",
      });
      if (!r) return { ok: false, motivo: "NO_DISPONIBLE" };
      if (r.status === 429) return { ok: false, motivo: "LIMITE" };
      if (r.status === 404) return { ok: false, motivo: "PERFIL_DESCONOCIDO" };
      const j = r.json as RespuestaServicio | null;
      if (r.status !== 200 || !j?.ok || typeof j.texto !== "string") return { ok: false, motivo: r.status >= 500 ? "NO_DISPONIBLE" : "ERROR" };
      return {
        ok: true,
        texto: j.texto.slice(0, 4000),
        respaldo: limpiarRespaldo(j.respaldo),
        avisos: (j.avisos ?? []).filter((a): a is string => typeof a === "string").slice(0, 20),
        derivacion: j.derivacion !== null && j.derivacion !== undefined,
      };
    },
  };
}
