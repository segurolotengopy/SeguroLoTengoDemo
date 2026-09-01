"use client";

/**
 * Orquestador de las secciones del paso 1 (lote F2).
 *
 * Las secciones se habilitan **en cascada** según el estado del expediente,
 * que baja del server component: completar una llama a `router.refresh()` y
 * la página entera se re-dibuja con el gating nuevo. Los formularios son los
 * componentes existentes de las pantallas v2, montados con `onCompletado` en
 * vez de su navegación propia.
 *
 * Divergencia documentada en la especificación (decisión del 30-ago-2026): el
 * correo y los datos complementarios viven **dentro** de la sección de
 * identidad —es el envío único que el dominio valida— y no como secciones
 * separadas tras el OTP, como dibujaba el canvas.
 *
 * El bloque de T&C de arriba es la **puerta provisional** del flujo mientras
 * la página de inicio no existe (lote F5): cuando exista, ese bloque se muda
 * allá y acá queda solo el gating por estado.
 */
import { useState } from "react";
import { EnlaceAclaracion } from "@/components/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EstadoExpediente } from "@/domain/tipos";
import {
  ITEMS_ACEPTACION_INSCRIPCION,
  NOTA_ACEPTACION_INSCRIPCION,
  ROTULO_ACEPTACION_INSCRIPCION,
} from "@/domain/textos-inscripcion";
import { FormularioVerificacionWhatsapp } from "../whatsapp/FormularioVerificacionWhatsapp";
import { VerificacionIdentidad } from "../identidad/VerificacionIdentidad";

export interface InscripcionProps {
  /** `null` = todavía no hay expediente: se muestra la puerta de T&C. */
  readonly estado: EstadoExpediente | null;
  readonly nombrePila: string | null;
  readonly pruebaDeVidaEnVivoDisponible: boolean;
  readonly subidaDeArchivoDisponible: boolean;
  /** A dónde seguir al aceptar (lo resuelve el servidor: `/seguro`). */
  readonly destinoTrasAceptar: string;
}

type FaseSeccion = "bloqueada" | "activa" | "completa";

function faseDe(estado: EstadoExpediente | null): {
  identidad: FaseSeccion;
  canal: FaseSeccion;
  aceptacion: FaseSeccion;
} {
  switch (estado) {
    case "INICIADO":
    case "CANAL_EMAIL_VERIFICADO":
      return { identidad: "activa", canal: "bloqueada", aceptacion: "bloqueada" };
    case "IDENTIDAD_VERIFICADA":
      return { identidad: "completa", canal: "activa", aceptacion: "bloqueada" };
    case "CANAL_WA_VERIFICADO":
      return { identidad: "completa", canal: "completa", aceptacion: "activa" };
    default:
      return { identidad: "bloqueada", canal: "bloqueada", aceptacion: "bloqueada" };
  }
}

function Seccion(props: {
  readonly numero: string;
  readonly rotulo: string;
  readonly titulo: string;
  readonly fase: FaseSeccion;
  readonly rotuloBloqueo: string;
  readonly resumenCompleta: string;
  readonly children?: React.ReactNode;
}) {
  return (
    <section
      aria-label={props.titulo}
      className={`flex flex-col gap-3 rounded-xl border bg-superficie p-4 sm:p-5 ${
        props.fase === "activa" ? "border-naranja-300" : "border-borde-sutil"
      }`}
    >
      <header className="flex flex-col gap-0.5">
        <p className="text-[11px] font-semibold tracking-wide text-etiqueta uppercase">
          {props.rotulo}
        </p>
        <h2 className="text-lg font-bold text-titulo">{props.titulo}</h2>
      </header>
      {props.fase === "bloqueada" ? (
        <p className="text-sm text-etiqueta">{props.rotuloBloqueo}</p>
      ) : props.fase === "completa" ? (
        <p className="text-sm font-semibold text-verde-700 dark:text-verde-300">
          ✓ {props.resumenCompleta}
        </p>
      ) : (
        props.children
      )}
    </section>
  );
}

export function Inscripcion(props: InscripcionProps) {
  const router = useRouter();
  const fases = faseDe(props.estado);
  const con = (frase: string) =>
    props.nombrePila ? `${props.nombrePila}, ${frase}` : frase.charAt(0).toUpperCase() + frase.slice(1);

  const [aceptacionMarcada, setAceptacionMarcada] = useState(false);
  const [verItems, setVerItems] = useState(false);
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function postear(url: string): Promise<void> {
    setEnProceso(true);
    setError(null);
    try {
      const respuesta = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aceptada: true }),
      });
      const datos = (await respuesta.json()) as { ok: boolean; motivo?: string };
      if (!datos.ok) {
        setError(
          datos.motivo === "EXPEDIENTE_YA_EXISTE"
            ? "Ya tenés un trámite empezado en esta sesión: recargá la página para retomarlo."
            : "No pudimos registrar la aceptación. Esperá un momento e intentá de nuevo.",
        );
        setEnProceso(false);
        return;
      }
      if (url === "/api/inicio/terminos") {
        router.refresh();
        setEnProceso(false);
      } else {
        window.location.assign(props.destinoTrasAceptar);
      }
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
      setEnProceso(false);
    }
  }

  // ── Sin expediente: los T&C viven en el inicio (mudados en F5) ───────────
  if (props.estado === null) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-4 sm:p-5">
        <p className="text-sm text-cuerpo">
          Para empezar, aceptá los términos y condiciones en la página de inicio: ahí arranca tu
          trámite y volvés acá con todo listo.
        </p>
        <Link
          href="/"
          className="inline-flex h-11 w-fit items-center rounded-lg bg-naranja-600 px-4 text-sm font-bold text-white"
        >
          Ir al inicio →
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Como en el canvas: tarjeta neutra, el rótulo arriba y el botón de
          privacidad a la derecha —no un bloque verde con el texto corrido. */}
      <aside className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-borde-sutil bg-superficie p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-[0.08em] text-naranja-700 uppercase dark:text-naranja-300">
            Importante
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-cuerpo">
            El código de verificación que te pediremos vence en 5 minutos y nadie te lo va a pedir
            por llamada. Las fotos de tu cédula y tu selfie viajan cifradas y tus datos los ven
            únicamente Interseguros y Alianza Garantía.
          </p>
        </div>
        <EnlaceAclaracion documento="avisoPrivacidad" className="btn btn-secondary shrink-0">
          Ver cómo cuidamos tus datos
        </EnlaceAclaracion>
      </aside>

      <Seccion
        numero="1"
        rotulo="Primero · Tu documento"
        titulo={con("empecemos por tu cédula")}
        fase={fases.identidad}
        rotuloBloqueo="Se habilita cuando aceptes los términos y condiciones."
        resumenCompleta="Leímos tu cédula y tu selfie coincide. Tus datos quedaron confirmados."
      >
        <VerificacionIdentidad
          canvas
          pruebaDeVidaEnVivoDisponible={props.pruebaDeVidaEnVivoDisponible}
          subidaDeArchivoDisponible={props.subidaDeArchivoDisponible}
          onCompletado={() => router.refresh()}
          onAsistencia={() => window.location.assign("/asistencia-identidad")}
        />
      </Seccion>

      <Seccion
        numero="2"
        rotulo="Tus canales"
        titulo={con("verificá tu WhatsApp personal")}
        fase={fases.canal}
        rotuloBloqueo="Se habilita cuando confirmes tus datos de identidad."
        resumenCompleta="WhatsApp verificado."
      >
        <p className="text-sm text-cuerpo">
          Por acá recibís la póliza, la factura y el enlace de firma. El código solo verifica tu
          canal: no contrata, no firma y no autoriza ningún cobro.
        </p>
        <FormularioVerificacionWhatsapp onCompletado={() => router.refresh()} />
      </Seccion>

      <Seccion
        numero="3"
        rotulo="Aceptación y continuar"
        titulo="Aceptá lo necesario para inscribirte"
        fase={fases.aceptacion}
        rotuloBloqueo="Se habilita cuando verifiques tu WhatsApp con el código."
        resumenCompleta="Aceptación registrada."
      >
        <label className="flex items-start gap-2 text-sm text-cuerpo">
          <input
            type="checkbox"
            checked={aceptacionMarcada}
            onChange={(evento) => setAceptacionMarcada(evento.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>{ROTULO_ACEPTACION_INSCRIPCION}</span>
        </label>
        <button
          type="button"
          onClick={() => setVerItems((v) => !v)}
          className="self-start text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 dark:text-azul-200"
        >
          {verItems ? "Ocultar el detalle" : "Ver todo lo que aceptás"}
        </button>
        {verItems ? (
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-cuerpo">
            {ITEMS_ACEPTACION_INSCRIPCION.map((item) => (
              <li key={item.slice(0, 40)}>{item}</li>
            ))}
          </ol>
        ) : null}
        <p className="text-xs text-etiqueta">{NOTA_ACEPTACION_INSCRIPCION}</p>
        <button
          type="button"
          disabled={!aceptacionMarcada || enProceso}
          onClick={() => void postear("/api/p3/autorizacion")}
          className="h-11 rounded-lg bg-naranja-600 px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          Tocá acá para continuar al paso 2 →
        </button>
        {error ? <p className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">{error}</p> : null}
      </Seccion>
    </div>
  );
}
