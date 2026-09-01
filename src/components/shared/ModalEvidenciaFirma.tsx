"use client";

/**
 * Panel con la constancia del acto de firma del cliente.
 *
 * **Por qué un panel y no un PDF.** La firma del cliente es no cualificada y
 * la genera el portal (D1): no existe un certificado de prestador que abrir.
 * Lo que la respalda es el registro de evidencia, y esto lo muestra agrupado
 * por lo que cada dato prueba —quién firmó, qué firmó, desde dónde y cuándo—
 * en vez de volcar una lista de registros que no le dice nada a nadie.
 *
 * No muestra el código del OTP (regla inviolable #2, del código solo viaja su
 * referencia) ni ningún dato de salud o PEP (regla inviolable #7). El canal va
 * enmascarado, tal como quedó asentado en la evidencia.
 *
 * Se pide al abrir y no antes: es una lectura que la mayoría de la gente no
 * hace, y traerla en cada carga de la pantalla sería trabajo de servidor por
 * algo que nadie miró.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface Hecho {
  readonly etiqueta: string;
  readonly valor: string;
}

interface Pilar {
  readonly requisito: string;
  readonly titulo: string;
  readonly explicacion: string;
  readonly hechos: readonly Hecho[];
}

interface FirmaInstitucional {
  readonly rol: string;
  readonly nivel: string;
  readonly modalidad: string;
  readonly certificado: string;
  readonly aplicadaEn: string;
}

interface Constancia {
  readonly documento: { readonly codigo: string; readonly version: number };
  readonly naturaleza: { readonly norma: string };
  readonly firmadoEn: string;
  readonly pilares: readonly Pilar[];
  readonly firmasInstitucionales: readonly FirmaInstitucional[];
  readonly registrosDeEvidencia: number;
}

const TITULO = "Constancia de tu firma";

/** Fecha legible sin librería: la constancia es para leer, no para procesar. */
function fecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-PY");
}

/** Los valores que son fechas ISO se muestran legibles; el resto, tal cual. */
function valorLegible(valor: string): string {
  return /^\d{4}-\d{2}-\d{2}T/.test(valor) ? fecha(valor) : valor;
}

const ROLES: Readonly<Record<string, string>> = {
  INTERSEGUROS: "Interseguros S.A.",
  ALIANZA: "Alianza Garantía Seguros y Reaseguros S.A.",
  CLIENTE: "Vos",
};

export function ModalEvidenciaFirma({ alCerrar }: { readonly alCerrar: () => void }) {
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const [constancia, setConstancia] = useState<Constancia | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const respuesta = await fetch("/api/p8/evidencia-firma");
      const datos = (await respuesta.json()) as
        { ok: true; constancia: Constancia } | { ok: false; motivo: string };
      if (!datos.ok) {
        setError(
          datos.motivo === "SIN_FIRMA_INTERNA"
            ? "Todavía no hay una firma registrada en este trámite."
            : "No pudimos traer la constancia. Intentá de nuevo en un momento.",
        );
        return;
      }
      setConstancia(datos.constancia);
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    }
  }, []);

  useEffect(() => {
    cerrarRef.current?.focus();
    void cargar();
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") alCerrar();
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [alCerrar, cargar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={TITULO}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-azul-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="flex h-full w-full max-w-2xl flex-col border border-borde-sutil bg-superficie shadow-2xl sm:h-[92vh] sm:rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-borde-sutil px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
              {TITULO}
            </h2>
            {constancia ? (
              <code className="truncate font-mono text-[11px] text-etiqueta">
                {constancia.documento.codigo} v{constancia.documento.version}
              </code>
            ) : null}
          </div>
          <button
            ref={cerrarRef}
            type="button"
            onClick={alCerrar}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-azul-300 px-4 text-xs font-bold tracking-wide text-azul-800 uppercase transition-colors hover:bg-azul-50 dark:border-azul-600 dark:text-azul-200 dark:hover:bg-azul-950"
          >
            Cerrar
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {error ? (
            <p className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">{error}</p>
          ) : null}
          {!error && !constancia ? (
            <p className="text-sm text-cuerpo">Trayendo la constancia…</p>
          ) : null}

          {constancia ? (
            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-1 rounded-lg border border-borde-sutil bg-superficie-suave p-3">
                <p className="text-sm font-bold text-titulo">
                  Firmaste el {fecha(constancia.firmadoEn)}
                </p>
                <p className="text-xs text-cuerpo">
                  Tu firma es una <strong>firma electrónica simple, no cualificada</strong>,
                  generada por SeguroLoTengo y respaldada por el código de un solo uso que
                  recibiste. Está admitida para este documento por la {constancia.naturaleza.norma}.
                </p>
              </section>

              {constancia.pilares.map((pilar) => (
                <section
                  key={pilar.requisito}
                  className="flex flex-col gap-2 rounded-lg border border-borde-sutil p-3"
                >
                  <h3 className="text-sm font-bold text-titulo">{pilar.titulo}</h3>
                  <p className="text-xs text-cuerpo">{pilar.explicacion}</p>
                  <dl className="flex flex-col gap-1">
                    {pilar.hechos.map((h) => (
                      <div key={h.etiqueta} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                        <dt className="shrink-0 text-xs text-etiqueta sm:w-56">{h.etiqueta}</dt>
                        <dd className="font-mono text-xs break-all text-cuerpo">
                          {valorLegible(h.valor)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}

              {constancia.firmasInstitucionales.length > 0 ? (
                <section className="flex flex-col gap-2 rounded-lg border border-borde-sutil p-3">
                  <h3 className="text-sm font-bold text-titulo">Quiénes más firmaron</h3>
                  <p className="text-xs text-cuerpo">
                    Estas son firmas cualificadas, con certificado propio. Son de otra naturaleza
                    que la tuya y se aplican después de la tuya.
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {constancia.firmasInstitucionales.map((f) => (
                      <li key={`${f.rol}-${f.aplicadaEn}`} className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-titulo">
                          {ROLES[f.rol] ?? f.rol} · {f.nivel.toLowerCase()} ·{" "}
                          {f.modalidad.toLowerCase()}
                        </span>
                        <code className="font-mono text-[11px] break-all text-etiqueta">
                          {f.certificado} · {fecha(f.aplicadaEn)}
                        </code>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <p className="text-xs text-etiqueta">
                Respaldan tu firma {constancia.registrosDeEvidencia} registros de evidencia, que se
                conservan sin sobrescribirse. Si necesitás una copia certificada, pedila por los
                canales de Interseguros.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
