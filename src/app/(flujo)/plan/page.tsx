import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import {
  HeaderInstitucional,
  PieLegal,
  StepperPasos,
  TramiteEnOtroPaso,
} from "@/components/shared";
import { REGISTRO_PRODUCTO, urlVideoInformativo } from "@/domain/catalogo";
import {
  BAJADA_VIDEO_PLAN,
  DETALLE_TRAMITE_EN_OTRO_PASO,
  ENLACE_INFORMACION_LEGAL,
  INFORMACION_RELEVANTE,
  NOTA_LEGAL_PLAN,
  ROTULO_ACLARACION_PLAN,
  ROTULO_PRODUCTO_INSCRITO,
  SUBTITULO_PLAN,
  TITULO_INFORMACION_RELEVANTE,
  TITULO_VIDEO_PLAN,
} from "@/domain/textos-plan";
import { cookies } from "next/headers";
import { COOKIE_EXPEDIENTE } from "@/app/api/_http/contexto-peticion";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import { destinoDelExpediente } from "@/domain/rutas-flujo";
import type { DestinoDelExpediente } from "@/domain/rutas-flujo";
import { puedeElegirPlan } from "@/domain/seleccion-plan";
import { crearExpedienteRepository } from "@/repositories";
import { SelectorDePlanes } from "./SelectorDePlanes";

/**
 * Paso 1 (etapa 1 de 5) · Selección del plan — `/plan`, en el formato del
 * handoff de pantallas v4 (`PANTALLA_02_SELECCION_PLAN_APROBADA_FINAL.png`,
 * manual funcional p. 25-26; D-28).
 *
 * De arriba hacia abajo, como el arte: título de dos líneas (navy / rojo) con
 * subtítulo, la tarjeta del video informativo, la línea del producto
 * inscrito, las tres tarjetas de plan, el enlace único a coberturas, la fila
 * de tres fichas (edad / carencias / inicio de cobertura), la aclaración
 * legal y la CTA roja de continuar.
 *
 * **Lo que no se reprodujo del arte, a propósito:**
 * - La ilustración de los tres escudos (cáncer / fallecimiento / accidente)
 *   no existe como archivo entregado: se deja el espacio libre en vez de
 *   inventarla o dibujarla desde cero.
 * - El ícono de menú hamburguesa: abre la pantalla 01B, fuera de este
 *   alcance (ver `HeaderInstitucional`).
 * - Las pestañas de producto (`PestanasDeProducto`) del formato anterior: el
 *   arte de la pantalla 02 no las dibuja — el catálogo de productos vive en
 *   la portada (01), que también queda fuera de este alcance.
 *
 * Los importes y coberturas NO están acá: viven en la tabla versionada
 * `src/domain/catalogo.ts` (producto VIVE, manual v4 p. 5). Todo lo estático
 * se renderiza en el servidor; lo único con estado es el selector.
 */

export const metadata: Metadata = {
  title: `Elegí tu plan · ${sufijoTitulo()}`,
  description:
    "Paso 1: selección del plan del Seguro de Vida Oncológico VIVE. Todavía no se contrata ni se firma.",
};

/** Íconos de línea del arte. Decorativos: la información va en el texto. */
function Icono({ trazo, className = "h-5 w-5" }: { trazo: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={trazo} />
    </svg>
  );
}

const TRAZOS = {
  persona: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6",
  calendario: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  reloj: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8v.01",
} as const;

/**
 * Botón/tarjeta de video informativo del arte: recuadro con el ícono de play
 * en rojo, título y bajada, y un chevron a la derecha. Es el mismo marcador
 * de demostración de siempre —sin video real detrás—, sin más cambio que la
 * paleta v4.
 */
function VideoInformativo() {
  const url = urlVideoInformativo();
  const contenido = (
    <>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-v4-rojo text-sm text-white"
      >
        ▶
      </span>
      <span className="flex-1 leading-tight">
        <span className="block text-[11px] font-bold tracking-wide text-v4-navy uppercase">
          {TITULO_VIDEO_PLAN}
        </span>
        <span className="block text-[11px] text-etiqueta">{BAJADA_VIDEO_PLAN}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-v4-atenuado">
        ›
      </span>
    </>
  );
  const clase =
    "flex items-center gap-2.5 rounded-xl border border-borde-sutil bg-superficie px-3 py-2.5 text-left";

  // Con URL configurada (`NEXT_PUBLIC_VIDEO_INFORMATIVO_URL`) es un enlace a
  // YouTube; sin ella queda como marcador de demo, sin fingir un video.
  return url ? (
    <a href={url} target="_blank" rel="noreferrer noopener" className={`${clase} hover:bg-superficie-suave`}>
      {contenido}
    </a>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

/**
 * ¿El expediente de este navegador todavía puede elegir plan?
 *
 * Devuelve `null` cuando sí —visita nueva, o expediente en `INICIADO` /
 * `PLAN_SELECCIONADO`, que es el enlace `Cambiar plan`— y el destino a donde
 * reencaminar cuando ya no.
 *
 * Se resuelve **en el servidor y antes de dibujar** a propósito: preguntarlo
 * después, cuando la persona ya eligió, es lo que producía el
 * `ESTADO_INVALIDO` sin salida. El costo es que esta pantalla pasa a
 * renderizarse por pedido —leer la cookie desactiva el render estático—; a
 * cambio no hay una llamada extra desde el celular ni un parpadeo de tarjetas
 * que después se reemplazan.
 *
 * Sin cookie no toca la base: quien llega por primera vez —la mayoría del
 * tráfico de esta pantalla— no paga ninguna lectura.
 *
 * Si la consulta falla, se sigue de largo y se dibuja el selector: una caída
 * del repositorio no tiene por qué dejar sin entrada al embudo entero, y el
 * Route Handler valida el estado igual.
 */
async function tramiteQueYaPasoEstePaso(): Promise<DestinoDelExpediente | null> {
  const expedienteId = (await cookies()).get(COOKIE_EXPEDIENTE)?.value;
  if (!expedienteId) return null;

  try {
    const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
    // Cookie sin expediente detrás (purgado, otro ambiente): no es un trámite
    // en curso, así que la pantalla se comporta como con una visita nueva.
    if (!expediente) return null;
    if (puedeElegirPlan(expediente.estado)) return null;
    return destinoDelExpediente(expediente.estado);
  } catch {
    return null;
  }
}

export default async function PantallaSeleccionDePlan() {
  const enOtroPaso = await tramiteQueYaPasoEstePaso();

  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/plan" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-5 px-4 py-5 sm:px-6">
        {/* Título de dos líneas del arte: "Seguro de Vida" en navy,
            "Oncológico VIVE" en rojo. La ilustración de escudos del arte no
            está como archivo entregado: se deja el espacio libre. */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl leading-tight font-bold sm:text-3xl">
            <span className="block text-v4-navy">Seguro de Vida</span>
            <span className="block text-v4-rojo">Oncológico VIVE</span>
          </h1>
          <p className="text-sm font-semibold text-v4-navy">{SUBTITULO_PLAN}</p>
        </div>

        <VideoInformativo />

        {/* CHG-03 · identificación del producto registrado, centrada bajo el
            título como en el arte. Código y acto oficiales desde la Nota
            SS.SG. N.º 397/2026 (D-26); el acto se imprime tal cual, porque es
            una Nota y no una Resolución. */}
        <p className="text-center text-xs text-etiqueta">
          <span className="font-semibold text-cuerpo">{ROTULO_PRODUCTO_INSCRITO}</span>{" "}
          <span className="tabular-nums">{REGISTRO_PRODUCTO.codigo}</span> ·{" "}
          <span className="tabular-nums">{REGISTRO_PRODUCTO.acto}</span>
          {REGISTRO_PRODUCTO.esProvisional ? (
            <span className="ml-2 rounded-full border border-v4-atenuado/40 bg-v4-atenuado/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-v4-atenuado uppercase">
              Pendiente de Alianza
            </span>
          ) : null}
        </p>

        {enOtroPaso ? (
          <TramiteEnOtroPaso
            destino={enOtroPaso}
            detalle={DETALLE_TRAMITE_EN_OTRO_PASO}
            modoDemo={esModoDemo()}
          />
        ) : (
          <SelectorDePlanes
            fichas={
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* El arte no dibuja un título de sección acá (las tres
                    fichas van directo), pero el grupo necesita nombre para
                    quien navega con lector de pantalla. */}
                <h2 className="sr-only">{TITULO_INFORMACION_RELEVANTE}</h2>
                {INFORMACION_RELEVANTE.map(({ rotulo, detalle }, indice) => (
                  <div
                    key={rotulo}
                    className="flex items-start gap-2.5 rounded-xl border border-borde-sutil bg-superficie px-3.5 py-3"
                  >
                    <Icono
                      trazo={[TRAZOS.persona, TRAZOS.calendario, TRAZOS.reloj][indice] ?? TRAZOS.reloj}
                      className="mt-0.5 h-6 w-6 shrink-0 text-v4-navy"
                    />
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[11px] font-bold tracking-wide text-v4-navy uppercase">
                        {rotulo}
                      </p>
                      <p className="text-xs leading-snug text-cuerpo">{detalle}</p>
                    </div>
                  </div>
                ))}
              </div>
            }
            aclaracion={
              <div className="flex items-start gap-2.5 rounded-xl border border-v4-azul/25 bg-v4-azul/5 px-4 py-3">
                <Icono trazo={TRAZOS.info} className="mt-0.5 h-5 w-5 shrink-0 text-v4-azul" />
                <p className="text-xs leading-relaxed text-cuerpo">
                  <span className="font-bold text-v4-navy">{ROTULO_ACLARACION_PLAN}</span>{" "}
                  {NOTA_LEGAL_PLAN}
                </p>
              </div>
            }
          />
        )}

        <p className="text-center">
          <a
            href="/privacidad"
            className="text-xs font-semibold text-v4-azul underline decoration-v4-azul/40 underline-offset-2 hover:opacity-80"
          >
            {ENLACE_INFORMACION_LEGAL}
          </a>
        </p>
      </main>

      <PieLegal />
    </div>
  );
}
