"use client";

/**
 * Widget flotante del asistente conversacional (Terra, ítem 35).
 *
 * Habla SOLO con las rutas propias `/api/asistente/*` (nunca con el servicio
 * ChatbotRAG: la clave del cliente vive en el servidor). El identificador de
 * conversación se genera en el navegador y vive en el estado de React: sin
 * cookie ni `localStorage`, para que la fila 85 (aviso de cookies: «tres
 * cookies necesarias, ninguna de terceros») siga siendo verdad. Recargar la
 * página empieza una conversación nueva, a propósito: menos retención.
 *
 * Reglas que hereda del proyecto:
 *  - Regla #7: no hay dónde escribir cédula, salud, PEP ni tarjeta; si la
 *    persona los escribe igual, el servidor los bloquea antes de la IA y el
 *    widget muestra el aviso.
 *  - Se OCULTA en las pantallas transaccionales (identidad, declaraciones,
 *    pago, firma) para que un asistente informativo no aparezca al lado de un
 *    formulario con datos sensibles.
 *  - El texto del asistente se dibuja como hijo de React (escapado): nunca
 *    `dangerouslySetInnerHTML`, nunca autoenlazado de URLs.
 *  - z-index 70 (debajo de `AvisoCtaFlotante`, que es funcionalidad del flujo);
 *    en móvil sube 56 px para no tapar la píldora de CTA.
 *  - Accesibilidad: botón ≥ 44 px, `role="dialog"`, cierre con Escape, foco al
 *    abrir y al cerrar, `aria-live` en la lista.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PRODUCTOS } from "@/domain/catalogo";

const RUTAS_SIN_ASISTENTE = ["/identidad", "/declaraciones", "/pago", "/firma", "/pago-y-firma", "/whatsapp", "/demo-panel", "/admin-consola"];

interface Burbuja {
  readonly quien: "persona" | "asistente";
  readonly texto: string;
  readonly fuentes?: readonly string[];
}

interface RespuestaRuta {
  ok: boolean;
  motivo?: string;
  texto?: string;
  bloqueado?: boolean;
  respaldo?: ReadonlyArray<{ titulo: string; version: string }>;
}

interface DescripcionRuta {
  ok: boolean;
  nombreAsistente?: string;
  perfilPorDefecto?: string | null;
  perfiles?: ReadonlyArray<{ id: string; nombre: string; bienvenida: string }>;
  bienvenida?: string;
}

function nuevoIdConversacion(): string {
  const aleatorio =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `web_${aleatorio}`.slice(0, 120);
}

export interface ChatFlotanteProps {
  /** Producto inicial; por defecto el disponible. */
  perfilInicial?: string;
}

export function ChatFlotante({ perfilInicial }: ChatFlotanteProps) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [perfil, setPerfil] = useState<string>(perfilInicial ?? PRODUCTOS.find((p) => p.disponible)?.id ?? "VIDA_ONCOLOGICO");
  const [descripcion, setDescripcion] = useState<DescripcionRuta | null>(null);
  const [burbujas, setBurbujas] = useState<readonly Burbuja[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [conversacionId, setConversacionId] = useState(nuevoIdConversacion);
  const idTitulo = useId();
  const entradaRef = useRef<HTMLInputElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const oculto = RUTAS_SIN_ASISTENTE.some((r) => ruta === r || ruta.startsWith(`${r}/`));

  const bienvenidaDe = useCallback(
    (perfilId: string): string =>
      descripcion?.perfiles?.find((p) => p.id === perfilId)?.bienvenida ?? descripcion?.bienvenida ?? "Hola, soy un asistente virtual con inteligencia artificial. ¿En qué te ayudo?",
    [descripcion],
  );

  useEffect(() => {
    if (!abierto || descripcion) return;
    let cancelado = false;
    fetch("/api/asistente/agente", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? (r.json() as Promise<DescripcionRuta>) : null))
      .then((d) => {
        if (cancelado || !d?.ok) return;
        setDescripcion(d);
        setBurbujas([{ quien: "asistente", texto: d.perfiles?.find((p) => p.id === perfil)?.bienvenida ?? d.bienvenida ?? "" }]);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [abierto, descripcion, perfil]);

  useEffect(() => {
    if (!abierto) return;
    entradaRef.current?.focus();
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAbierto(false);
        botonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
  }, [burbujas]);

  function cambiarPerfil(nuevo: string) {
    setPerfil(nuevo);
    setConversacionId(nuevoIdConversacion());
    setBurbujas([{ quien: "asistente", texto: bienvenidaDe(nuevo) }]);
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    setBurbujas((b) => [...b, { quien: "persona", texto: limpio }]);
    setTexto("");
    try {
      const r = await fetch("/api/asistente/mensaje", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ conversacionId, perfilId: perfil, texto: limpio }),
      });
      const j = (await r.json().catch(() => null)) as RespuestaRuta | null;
      if (r.status === 429) {
        setBurbujas((b) => [...b, { quien: "asistente", texto: "Demasiados mensajes seguidos. Esperá un momento e intentá de nuevo." }]);
      } else if (!r.ok || !j?.ok || typeof j.texto !== "string") {
        setBurbujas((b) => [...b, { quien: "asistente", texto: j?.texto ?? "No pude procesar el mensaje. Intentá de nuevo en unos segundos." }]);
      } else {
        const fuentes = [...new Set((j.respaldo ?? []).map((f) => `${f.titulo} (${f.version})`))];
        setBurbujas((b) => [...b, { quien: "asistente", texto: j.texto ?? "", ...(fuentes.length ? { fuentes } : {}) }]);
      }
    } catch {
      setBurbujas((b) => [...b, { quien: "asistente", texto: "No hay conexión con el asistente en este momento." }]);
    } finally {
      setEnviando(false);
      entradaRef.current?.focus();
    }
  }

  if (oculto) return null;

  const nombre = descripcion?.nombreAsistente ?? "Asistente";

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls={abierto ? idTitulo : undefined}
        onClick={() => setAbierto((v) => !v)}
        className="fixed right-4 bottom-[76px] z-[70] inline-flex min-h-tap min-w-tap items-center gap-2 rounded-full bg-naranja-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-naranja-700 sm:bottom-5 dark:bg-naranja-500 dark:hover:bg-naranja-600"
      >
        <span aria-hidden="true">💬</span>
        {abierto ? "Cerrar" : `Preguntale a ${nombre}`}
      </button>

      {abierto ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby={idTitulo}
          className="fixed right-4 bottom-[132px] z-[90] flex h-[min(560px,calc(100vh-160px))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-borde-sutil bg-superficie shadow-xl sm:bottom-[76px]"
        >
          <header className="flex items-center justify-between gap-2 bg-naranja-600 px-4 py-3 text-white dark:bg-naranja-500">
            <h2 id={idTitulo} className="text-base font-bold">
              {nombre} · asistente virtual
            </h2>
            <button
              type="button"
              aria-label="Cerrar el asistente"
              onClick={() => {
                setAbierto(false);
                botonRef.current?.focus();
              }}
              className="min-h-tap min-w-tap rounded-md text-xl leading-none hover:bg-white/15"
            >
              ×
            </button>
          </header>

          <div className="border-b border-borde-tenue px-3 py-2">
            <label className="flex flex-col gap-1 text-xs text-etiqueta">
              Seguro sobre el que consultás
              <select
                value={perfil}
                onChange={(e) => cambiarPerfil(e.target.value)}
                className="min-h-tap rounded-md border border-borde-sutil bg-superficie px-2 text-sm text-cuerpo"
              >
                {PRODUCTOS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.disponible ? "" : " (próximamente)"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div ref={listaRef} aria-live="polite" className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 text-sm">
            {burbujas.map((b, i) => (
              <div key={i} className={b.quien === "persona" ? "self-end" : "self-start"}>
                <p
                  className={
                    b.quien === "persona"
                      ? "max-w-[85%] whitespace-pre-wrap rounded-xl bg-naranja-600 px-3 py-2 text-white dark:bg-naranja-500"
                      : "max-w-[85%] whitespace-pre-wrap rounded-xl bg-superficie-suave px-3 py-2 text-cuerpo"
                  }
                >
                  {b.texto}
                </p>
                {b.fuentes ? <p className="mt-1 text-xs text-etiqueta">Fuente: {b.fuentes.join(" · ")}</p> : null}
              </div>
            ))}
            {enviando ? <p className="self-start text-xs text-etiqueta">{nombre} está escribiendo…</p> : null}
          </div>

          <form onSubmit={enviar} className="flex gap-2 border-t border-borde-tenue p-2">
            <input
              ref={entradaRef}
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={1500}
              autoComplete="off"
              placeholder="Escribí tu consulta…"
              aria-label="Mensaje para el asistente"
              className="min-h-tap flex-1 rounded-md border border-borde-sutil bg-superficie px-3 text-sm text-cuerpo"
            />
            <button
              type="submit"
              disabled={enviando || texto.trim() === ""}
              className="min-h-tap min-w-tap rounded-md bg-azul-600 px-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-azul-500"
            >
              Enviar
            </button>
          </form>
          <p className="px-3 pb-2 text-[11px] leading-snug text-etiqueta">
            Asistente con inteligencia artificial: responde solo con información aprobada y no reemplaza a un asesor. No compartas cédula, datos de salud, tarjetas ni códigos por este medio.
          </p>
        </section>
      ) : null}
    </>
  );
}
