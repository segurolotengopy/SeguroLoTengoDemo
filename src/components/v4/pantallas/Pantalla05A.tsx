"use client";

/**
 * 05A · Realizá el pago. Etapa 5 de 5.
 *
 * **Sin arte.** `ANALISIS_VISUAL_PNG.md` §12 es explícito: 05A no tiene arte
 * aprobado ni candidato. Esta pantalla es una extrapolación del sistema
 * visual de las 12 pantallas que sí lo tienen —paleta, tipografía y los 19
 * componentes de §10— y queda **provisional** hasta que Interseguros mande el
 * arte. No inventa campos ni pasos nuevos: reproduce el contrato de negocio
 * que ya existe en `src/domain/pago-p7.ts` (D-08, D-02, D-12) y que hoy sirve
 * `src/app/(flujo)/pago/FormularioPagoP7.tsx` en v2.
 *
 * ## Lo que cambia respecto de v2
 *
 * - **El plazo es de 10 minutos, no 24 horas** (D-32,
 *   `PLAZO_PAGO_V4_MS`/`plazoPagoVenceEn`), así que el aviso de vencimiento no
 *   promete el recordatorio manual por WhatsApp/correo que sí tiene sentido a
 *   escala de un día.
 * - **Un solo medio elegible a la vez y sin preselección**: el arte de 02
 *   arranca sin plan elegido y esta pantalla sigue el mismo criterio en vez
 *   de heredar `MEDIO_POR_DEFECTO_P7` (QR) como hacía v2.
 * - La ventana de Bancard (QR o formulario) se redibuja con los tokens de
 *   v4 en vez de reusar `ModalBancard.tsx`: ese componente depende de
 *   variables CSS de `canvas-v3.css`, todas bajo el selector
 *   `[data-flujo="v3"]`, que no está presente cuando v4 está activo
 *   (`[data-flujo="v4"]`) — quedaría sin estilos. `QrBancard.tsx` y
 *   `VentanaBancardSimulada.tsx` sí se reutilizan tal cual: no dependen de
 *   esas variables, solo de los tokens semánticos globales
 *   (`bg-superficie`, `text-titulo`, etc.) que no están scopeados a ningún
 *   flujo.
 *
 * ## Lo que no cambia
 *
 * Los endpoints, sus contratos y las reglas de negocio: `GET /api/p7/resumen`,
 * `POST /api/p7/pago`, `GET /api/p7/estado`, `POST /api/p7/vencimiento` y (solo
 * en demo) `POST /api/p7/pagado`. La casilla de aceptación del Certificado de
 * Cobertura Provisional (CHG-37) sigue siendo obligatoria para abrir una
 * operación en Bancard — lo exige `iniciarPagoP7`, no esta pantalla — así que
 * se muestra igual que en v2, con el mismo literal ya versionado
 * (`VERSION_ACEPTACION_CERTIFICADO_P7`). Nunca hay un campo de tarjeta acá
 * (regla inviolable #6): para tarjeta, el número y el CVV se tipean dentro de
 * la ventana simulada de Bancard, que no los manda a ningún endpoint.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatearGuaranies } from "@/domain/catalogo";
import { nombrePortal } from "@/domain/entidades";
import type { MedioDePago } from "@/domain/tipos";
import { CODIGOS_RESPUESTA_BANCARD } from "@/ports/payment-provider";
import {
  MENSAJES_P7,
  NOTA_DESGLOSE_PROVISIONAL_P7,
  TEXTO_ACEPTACION_CERTIFICADO_P7,
  TEXTOS_05A,
  TEXTOS_MEDIOS_DE_PAGO_P7,
} from "@/domain/v4/textos-pago";
import { MarcoV4 } from "../MarcoV4";
import { BarraPlanV4 } from "../BarraPlanV4";
import {
  AvisoAzulV4,
  AvisoRojoV4,
  BotonPrincipalV4,
  CasillaConsentimientoV4,
  FranjaVerdeV4,
} from "../piezas";
// `QrBancard` y `VentanaBancardSimulada` son la ventana del proveedor, no una
// pantalla propia (ver CLAUDE.md → "Panel de demo"): se reutilizan del flujo
// v2 sin tocarlas. `ModalBancard.tsx`, en cambio, no se reutiliza: ver el
// comentario de cabecera.
import { QrBancard } from "@/app/(flujo)/pago/QrBancard";
import { VentanaBancardSimulada } from "@/app/(flujo)/pago/VentanaBancardSimulada";

const NAVY = "#071F78";
const ROJO = "#FF1721";

/**
 * Ilustración propia de esta pantalla, con la misma gramática que
 * `src/components/v4/ilustraciones.tsx` (trazo navy de 2 px, sin relleno,
 * acentos rojos, dos destellos, mancha ovalada azul clarísima) — ese archivo
 * no exporta sus piezas internas (`Lienzo`, `Mancha`, `Destellos`) y no se
 * edita para agregarlas, así que se reconstruye acá, solo para esta pantalla.
 * Un teléfono con un QR y un escudo con tilde: pagar y quedar cubierto.
 */
function IlustracionPago({ tamano = 112, className }: { readonly tamano?: number; readonly className?: string }) {
  const trazo = { fill: "none", stroke: NAVY, strokeWidth: 2.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg
      viewBox="0 0 120 110"
      width={tamano}
      height={Math.round((tamano * 110) / 120)}
      className={className}
      role="img"
      aria-label="Pago del seguro"
    >
      <ellipse cx="60" cy="58" rx="55" ry="45" fill="#EAF2FD" />
      <rect x="30" y="20" width="42" height="68" rx="7" {...trazo} />
      <rect x="38" y="30" width="26" height="26" rx="2" fill="none" stroke={NAVY} strokeWidth="2" />
      <rect x="42" y="34" width="6" height="6" fill={NAVY} />
      <rect x="54" y="34" width="6" height="6" fill={NAVY} />
      <rect x="42" y="46" width="6" height="6" fill={NAVY} />
      <rect x="55" y="47" width="4" height="4" fill={NAVY} />
      <path d="M38 66 h26 M38 72 h18" stroke={NAVY} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="90" cy="68" r="16" fill={ROJO} />
      <path d="M82 68 l6 6 l12 -13" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <g stroke={ROJO} strokeWidth="3" strokeLinecap="round">
        <path d="M90 16 l6 -9" />
        <path d="M101 19 l7 -7" />
      </g>
    </svg>
  );
}

/** Segundos → `MM:SS`. Mismo formato que 03A, para el mismo tipo de reloj. */
function reloj(segundos: number): string {
  const minutos = Math.floor(Math.max(segundos, 0) / 60);
  const resto = Math.max(segundos, 0) % 60;
  return `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

/** `m:ss` para el contador de espera de la acreditación (no el del plazo). */
function formatearEspera(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

interface Resumen {
  readonly numeroPropuesta: string | null;
  readonly plazoPagoVenceEn: string | null;
  readonly montoGs: number;
  readonly primaNetaGs: number;
  readonly ivaGs: number;
  readonly desgloseProvisional: boolean;
  readonly nombreAFacturar: string;
  readonly medio: MedioDePago | null;
  readonly referenciaBancard: string | null;
  readonly cobrado: boolean;
}

type Instruccion =
  | { readonly tipo: "QR"; readonly qrPayload: string; readonly expiraEn: string }
  | { readonly tipo: "FORMULARIO_SEGURO"; readonly urlFormularioSeguro: string };

interface RespuestaInicio {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly codigoRespuesta?: string;
  readonly numeroPropuesta?: string;
  readonly referenciaBancard?: string;
  readonly instruccion?: Instruccion;
}

interface RespuestaEstado {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly codigoRespuesta?: string;
  readonly confirmado?: boolean;
  readonly siguientePantalla?: string;
}

/** Cada cuánto se sondea `/api/p7/estado` mientras hay una operación abierta. */
const INTERVALO_SONDEO_MS = 2_000;
/** Habilita el botón *Pagado* de demostración: lo que tarda alguien en escanear. */
const ESPERA_ANTES_DE_PAGADO_MS = 5_000;
/** A partir de acá, la pantalla deja de decir solo "esperando". */
const ESPERA_LARGA_MS = 30_000;
/** Reintentos consecutivos sin respuesta de Bancard antes de dejar de invitar a reintentar. */
const INTENTOS_MAXIMOS_SIN_RESPUESTA = 3;
/** `PAGO_NO_INICIADO` seguidos tolerados: ver `FormularioPagoP7.tsx` para la razón (carrera entre instancias de cómputo del mock). */
const SONDEOS_SIN_OPERACION_TOLERADOS = 5;

/**
 * Motivos que no se resuelven esperando: el sondeo se corta y se muestra el
 * error. Cualquier otro (un 5xx puntual, `CERTIFICADO_NO_EMITIDO`,
 * `CONFLICTO_CONCURRENCIA`) se trata como transitorio y el próximo sondeo
 * reintenta — mismo criterio que `FormularioPagoP7.tsx`.
 */
const MOTIVOS_TERMINALES_SONDEO: ReadonlySet<string> = new Set([
  "SESION_INVALIDA",
  "EXPEDIENTE_NO_ENCONTRADO",
  "ESTADO_INVALIDO",
  "PAGO_CANCELADO",
  "BANCARD_RECHAZO",
]);

/** Motivos tras los cuales se suelta la operación y se vuelve a dejar pagar. */
const MOTIVOS_QUE_HABILITAN_OTRO_INTENTO: ReadonlySet<string> = new Set(["BANCARD_RECHAZO"]);

function mensajeDeRechazo(motivo: string | undefined, codigoRespuesta: string | undefined): string {
  const base = MENSAJES_P7[motivo ?? ""] ?? MENSAJES_P7.CUERPO_INVALIDO;
  const descripcion = codigoRespuesta ? CODIGOS_RESPUESTA_BANCARD[codigoRespuesta] : undefined;
  if (!descripcion) return base;
  return `${base} Bancard informó: ${descripcion} (código ${codigoRespuesta}).`;
}

/** Fila navy/azul-apagado de la tarjeta "Resumen del cobro". */
function FilaResumen({ rotulo, valor }: { readonly rotulo: string; readonly valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t py-1.5" style={{ borderColor: "var(--v4-gris-borde)" }}>
      <span className="text-[0.875rem]" style={{ color: "var(--v4-azul-apagado)" }}>
        {rotulo}
      </span>
      <span className="text-[0.9375rem] font-bold" style={{ color: "var(--v4-navy)" }}>
        {valor}
      </span>
    </div>
  );
}

/**
 * Tarjeta seleccionable de medio de pago, mismo patrón que `TarjetaPlan` de
 * `Pantalla02.tsx`: radio a la derecha, tarjeta entera clicable.
 */
function TarjetaMedio({
  medio,
  elegido,
  deshabilitado,
  alElegir,
}: {
  readonly medio: (typeof TEXTOS_MEDIOS_DE_PAGO_P7)[number];
  readonly elegido: boolean;
  readonly deshabilitado: boolean;
  readonly alElegir: () => void;
}) {
  return (
    <label
      className="block cursor-pointer rounded-xl border p-3.5 transition-colors"
      style={{
        borderColor: elegido ? "var(--v4-azul)" : "var(--v4-azul-borde)",
        background: elegido ? "var(--v4-azul-fondo)" : "var(--v4-blanco)",
        boxShadow: elegido ? "0 0 0 1px var(--v4-azul)" : undefined,
        opacity: deshabilitado ? 0.6 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <span className="block text-[1.0625rem] font-bold" style={{ color: "var(--v4-navy)" }}>
            {medio.titulo}
          </span>
          <span className="mt-0.5 block text-[0.8125rem]" style={{ color: "var(--v4-azul-apagado)" }}>
            {medio.momento}
          </span>
        </div>
        <input
          type="radio"
          name="medio-de-pago"
          checked={elegido}
          disabled={deshabilitado}
          onChange={alElegir}
          aria-label={`Elegir ${medio.titulo}`}
          className="mt-1 h-7 w-7 shrink-0 cursor-pointer"
          style={{ accentColor: "var(--v4-azul)" }}
        />
      </div>
      <ul className="mt-2 space-y-0.5">
        {medio.vinetas.map((vineta) => (
          <li key={vineta} className="text-[0.8125rem] leading-snug" style={{ color: "var(--v4-azul-apagado)" }}>
            · {vineta}
          </li>
        ))}
      </ul>
    </label>
  );
}

/**
 * La ventana del proveedor, redibujada con tokens de v4.
 *
 * **No lleva botón de cerrar**, a propósito: mientras Bancard no conteste,
 * cerrarla dejaría a la persona creyendo que puede volver a intentar cuando
 * del otro lado ya hay una operación abierta (mismo criterio que
 * `ModalBancard.tsx` con `alCerrar={null}`). Se desmonta sola cuando el
 * sondeo trae un resultado terminal: confirmado, o un rechazo que suelta la
 * operación (`instruccion` vuelve a `null`).
 */
function VentanaBancardV4({ children }: { readonly children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={TEXTOS_05A.ventanaTitulo}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ background: "rgba(7, 31, 120, 0.45)" }}
    >
      <div className="relative mt-6 w-full max-w-[26rem] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="v4-filete-rojo" />
        <div className="px-5 pt-4">
          <p className="text-[0.75rem] font-bold uppercase tracking-wide" style={{ color: "var(--v4-azul-apagado)" }}>
            {TEXTOS_05A.ventanaTitulo}
          </p>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--v4-azul-apagado)" }}>
            {TEXTOS_05A.ventanaComercio}
          </p>
        </div>
        <div className="mt-3 border-t px-5 py-4" style={{ borderColor: "var(--v4-gris-borde)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Pantalla05A({
  /**
   * `DEMO_MODE=true`, resuelto en el servidor (`esModoDemo()`,
   * `src/app/(flujo)/pago/page.tsx`). Igual que en v2: solo decide si se
   * dibuja el botón *Pagado*; la guarda real está en `/api/p7/pagado`
   * (`route.demo.ts`), que ni siquiera se compila con el flag apagado.
   */
  pagoSimuladoDisponible = false,
}: {
  readonly pagoSimuladoDisponible?: boolean;
} = {}) {
  const router = useRouter();

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [medio, setMedio] = useState<MedioDePago | null>(null);
  const [aceptaCertificado, setAceptaCertificado] = useState(false);

  const [generando, setGenerando] = useState(false);
  const [intentosSinRespuesta, setIntentosSinRespuesta] = useState(0);
  const [instruccion, setInstruccion] = useState<Instruccion | null>(null);
  const [referenciaBancard, setReferenciaBancard] = useState<string | null>(null);
  const [numeroPropuesta, setNumeroPropuesta] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [restanteMs, setRestanteMs] = useState<number | null>(null);
  const [esperandoDesde, setEsperandoDesde] = useState<number | null>(null);
  const [esperaMs, setEsperaMs] = useState(0);
  const sondeosSinOperacion = useRef(0);
  const [marcandoPagado, setMarcandoPagado] = useState(false);
  const [origenError, setOrigenError] = useState<"GENERAR" | "PAGADO" | "SONDEO" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vigente = useRef(true);
  useEffect(() => {
    vigente.current = true;
    return () => {
      vigente.current = false;
    };
  }, []);

  const irAPantallaB = useCallback(() => {
    router.push("/solicitud-vencida");
  }, [router]);

  // Resumen inicial.
  useEffect(() => {
    void (async () => {
      try {
        const respuesta = await fetch("/api/p7/resumen");
        const datos = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; resumen?: Resumen };
        if (!vigente.current || !datos.ok || !datos.resumen) return;
        setResumen(datos.resumen);
        setNumeroPropuesta(datos.resumen.numeroPropuesta);
        setReferenciaBancard(datos.resumen.referenciaBancard);
        if (datos.resumen.medio) setMedio(datos.resumen.medio);
        if (datos.resumen.cobrado) setConfirmado(true);
      } catch {
        // Sin resumen la pantalla no puede operar; el error se ve al enviar.
      }
    })();
  }, []);

  // Cuenta regresiva del plazo (D-32 · 10 minutos). Vive acá porque acá corre:
  // el expediente ya está firmado y lo que falta es la plata.
  useEffect(() => {
    const vence = resumen?.plazoPagoVenceEn;
    if (!vence || confirmado) return;
    let cancelado = false;
    const recalcular = () => {
      if (cancelado) return;
      setRestanteMs(new Date(vence).getTime() - Date.now());
    };
    recalcular();
    const temporizador = setInterval(recalcular, 1_000);
    return () => {
      cancelado = true;
      clearInterval(temporizador);
    };
  }, [resumen?.plazoPagoVenceEn, confirmado]);

  // La cuenta llega a cero: se le pide al servidor que evalúe el vencimiento,
  // contra su propio reloj (adelantar el del navegador no adelanta nada).
  const vencimientoEnVuelo = useRef(false);
  useEffect(() => {
    if (restanteMs === null || restanteMs > 0 || confirmado) return;
    if (vencimientoEnVuelo.current) return;
    let cancelado = false;
    vencimientoEnVuelo.current = true;
    void (async () => {
      try {
        const respuesta = await fetch("/api/p7/vencimiento", { method: "POST" });
        const datos = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; vencio?: boolean };
        if (cancelado || !vigente.current) return;
        if (datos.ok && datos.vencio) irAPantallaB();
      } catch {
        // Se reintenta con el próximo tick del contador.
      } finally {
        vencimientoEnVuelo.current = false;
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [restanteMs, confirmado, irAPantallaB]);

  const sondear = useCallback(async (): Promise<boolean> => {
    const respuesta = await fetch("/api/p7/estado");
    const datos = (await respuesta.json().catch(() => ({}))) as RespuestaEstado;

    if (!datos.ok) {
      if (datos.siguientePantalla === "/solicitud-vencida") {
        irAPantallaB();
        return true;
      }
      if (datos.motivo === "PAGO_NO_INICIADO") {
        sondeosSinOperacion.current += 1;
        if (sondeosSinOperacion.current < SONDEOS_SIN_OPERACION_TOLERADOS) return false;
        if (vigente.current) {
          setOrigenError("SONDEO");
          setError(MENSAJES_P7.PAGO_NO_INICIADO);
        }
        return true;
      }
      sondeosSinOperacion.current = 0;

      const terminal = datos.motivo !== undefined && MOTIVOS_TERMINALES_SONDEO.has(datos.motivo);
      if (terminal && vigente.current) {
        const habilitaOtroIntento = datos.motivo !== undefined && MOTIVOS_QUE_HABILITAN_OTRO_INTENTO.has(datos.motivo);
        setOrigenError(habilitaOtroIntento ? "GENERAR" : "SONDEO");
        setError(mensajeDeRechazo(datos.motivo, datos.codigoRespuesta));
        if (habilitaOtroIntento) {
          setInstruccion(null);
          setReferenciaBancard(null);
          setEsperandoDesde(null);
        }
      }
      return terminal;
    }
    sondeosSinOperacion.current = 0;
    if (!datos.confirmado) return false;

    if (vigente.current) {
      setConfirmado(true);
      setError(null);
    }
    return true;
  }, [irAPantallaB]);

  // Contador de espera de la acreditación, aparte del sondeo (cada segundo, no cada dos).
  useEffect(() => {
    if (esperandoDesde === null || confirmado) return;
    const recalcular = () => setEsperaMs(Date.now() - esperandoDesde);
    recalcular();
    const temporizador = setInterval(recalcular, 1_000);
    return () => clearInterval(temporizador);
  }, [esperandoDesde, confirmado]);

  async function marcarPagado() {
    setMarcandoPagado(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/p7/pagado", { method: "POST" });
      const datos = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; motivo?: string };
      if (!datos.ok) {
        setOrigenError("PAGADO");
        setError(mensajeDeRechazo(datos.motivo, undefined));
        return;
      }
      sondeosSinOperacion.current = 0;
      await sondear();
    } catch {
      setOrigenError("PAGADO");
      setError("No pudimos confirmar el pago. Revisá tu conexión e intentá de nuevo.");
    } finally {
      if (vigente.current) setMarcandoPagado(false);
    }
  }

  // Sondeo mientras hay una operación abierta y sin confirmar.
  useEffect(() => {
    if (!referenciaBancard || confirmado) return;
    setEsperandoDesde((actual) => actual ?? Date.now());
    let cancelado = false;
    const temporizador = setInterval(() => {
      void (async () => {
        if (cancelado) return;
        try {
          const terminado = await sondear();
          if (terminado) clearInterval(temporizador);
        } catch {
          // Un sondeo perdido no es un error de la pantalla: sigue el próximo.
        }
      })();
    }, INTERVALO_SONDEO_MS);
    return () => {
      cancelado = true;
      clearInterval(temporizador);
    };
  }, [referenciaBancard, confirmado, sondear]);

  // Confirmado: franja verde y, tras un instante, a la confirmación (05B).
  useEffect(() => {
    if (!confirmado) return;
    const temporizador = setTimeout(() => router.push("/confirmacion"), 900);
    return () => clearTimeout(temporizador);
  }, [confirmado, router]);

  const esperandoAlBanco = instruccion !== null && !confirmado;

  async function generar() {
    if (!medio || generando || esperandoAlBanco || !aceptaCertificado) return;
    if (intentosSinRespuesta >= INTENTOS_MAXIMOS_SIN_RESPUESTA) return;

    setGenerando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/p7/pago", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Sin RUC: si queda vacío, el servidor factura a nombre y cédula del
        // asegurado (`NOTA_RUC_VACIO_P7`). Sin campo de tarjeta acá ni en
        // ningún lado de esta pantalla (regla inviolable #6).
        body: JSON.stringify({ medio, ruc: "", aceptaCertificadoYEntrega: aceptaCertificado }),
      });
      const datos = (await respuesta.json().catch(() => ({}))) as RespuestaInicio;

      if (!datos.ok) {
        setOrigenError("GENERAR");
        setError(mensajeDeRechazo(datos.motivo, datos.codigoRespuesta));
        if (datos.motivo === "BANCARD_NO_DISPONIBLE") {
          setIntentosSinRespuesta((previo) => previo + 1);
        }
        return;
      }

      setIntentosSinRespuesta(0);
      setInstruccion(datos.instruccion ?? null);
      setReferenciaBancard(datos.referenciaBancard ?? null);
      setNumeroPropuesta(datos.numeroPropuesta ?? null);
    } catch {
      setOrigenError("GENERAR");
      setError(MENSAJES_P7.BANCARD_NO_DISPONIBLE);
      setIntentosSinRespuesta((previo) => previo + 1);
    } finally {
      setGenerando(false);
    }
  }

  function elegirMedio(nuevoMedio: MedioDePago) {
    if (esperandoAlBanco || confirmado) return;
    setMedio(nuevoMedio);
    // Cambiar de medio abre un intento distinto: lo que se había generado
    // para el anterior deja de aplicar. El servidor reversa la operación
    // abandonada en Bancard al abrir la siguiente (`iniciarPagoP7`,
    // "INTENTO_REEMPLAZADO") — la pantalla solo permite volver a elegir.
    setInstruccion(null);
    setReferenciaBancard(null);
    setError(null);
  }

  const textoMedio = TEXTOS_MEDIOS_DE_PAGO_P7.find((opcion) => opcion.medio === medio);
  const importe = resumen ? formatearGuaranies(resumen.montoGs) : "—";

  return (
    <MarcoV4 codigo="05A">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="v4-titular">
            {TEXTOS_05A.titulo}
            <br />
            <em>{TEXTOS_05A.tituloAcento}</em>
          </h1>
          <p className="v4-bajada mt-2">{TEXTOS_05A.bajada}</p>
        </div>
        <IlustracionPago tamano={104} className="shrink-0" />
      </div>

      <BarraPlanV4 className="mt-4" />

      {/* Plazo para pagar (D-32 · 10 minutos), navy mientras corre y rojo al llegar a cero. */}
      {restanteMs !== null && !confirmado ? (
        <div className="v4-tarjeta mt-4 p-4 text-center">
          <p className="text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: "var(--v4-azul-apagado)" }}>
            {TEXTOS_05A.tituloPlazo}
          </p>
          <p
            className="mt-1 text-[1.75rem] font-bold tabular-nums"
            style={{ color: restanteMs <= 0 ? "var(--v4-rojo)" : "var(--v4-navy)" }}
          >
            {reloj(Math.floor(Math.max(restanteMs, 0) / 1000))}
          </p>
          <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--v4-azul-apagado)" }}>
            {restanteMs <= 0 ? TEXTOS_05A.plazoVencido : TEXTOS_05A.avisoPlazo}
          </p>
        </div>
      ) : null}

      {/* Resumen del cobro */}
      <section className="v4-tarjeta mt-4 p-4" aria-labelledby="resumen-cobro">
        <h2 id="resumen-cobro" className="v4-rotulo">
          {TEXTOS_05A.tituloResumen}
        </h2>
        <div className="mt-2">
          <FilaResumen rotulo={TEXTOS_05A.rotuloPremio} valor={importe} />
          {resumen?.desgloseProvisional ? (
            <>
              <FilaResumen rotulo={TEXTOS_05A.rotuloPrimaNeta} valor={formatearGuaranies(resumen.primaNetaGs)} />
              <FilaResumen rotulo={TEXTOS_05A.rotuloIva} valor={formatearGuaranies(resumen.ivaGs)} />
            </>
          ) : null}
          <FilaResumen rotulo={TEXTOS_05A.rotuloPropuesta} valor={numeroPropuesta ?? "—"} />
        </div>
        {resumen?.desgloseProvisional ? (
          <p className="mt-2 text-[0.75rem]" style={{ color: "var(--v4-azul-apagado)" }}>
            {NOTA_DESGLOSE_PROVISIONAL_P7}
          </p>
        ) : null}
      </section>

      {confirmado ? (
        <FranjaVerdeV4>
          <span className="block">{TEXTOS_05A.pagoAcreditadoTitulo}</span>
          <span className="mt-0.5 block text-[0.875rem] font-normal">{TEXTOS_05A.pagoAcreditado}</span>
          <span className="mt-0.5 block text-[0.8125rem] font-normal">{TEXTOS_05A.continuando}</span>
        </FranjaVerdeV4>
      ) : (
        <>
          {/* Medio de pago */}
          <section className="mt-4" aria-labelledby="medios-de-pago">
            <h2 id="medios-de-pago" className="v4-rotulo">
              {TEXTOS_05A.tituloMedios}
            </h2>
            <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--v4-azul-apagado)" }}>
              {TEXTOS_05A.notaMedios}
            </p>
            <div className="mt-3 space-y-3">
              {TEXTOS_MEDIOS_DE_PAGO_P7.map((opcion) => (
                <TarjetaMedio
                  key={opcion.medio}
                  medio={opcion}
                  elegido={medio === opcion.medio}
                  deshabilitado={esperandoAlBanco}
                  alElegir={() => elegirMedio(opcion.medio)}
                />
              ))}
            </div>
          </section>

          {/* CHG-37 · autoriza lo que ocurre después del cobro: la emisión del
              Certificado de Cobertura Provisional y el envío de la póliza y
              la factura a los canales verificados. Literal y versión sin
              cambios respecto de v2 (`TEXTO_ACEPTACION_CERTIFICADO_P7`). */}
          <div className="v4-tarjeta mt-4 p-4">
            <CasillaConsentimientoV4
              marcada={aceptaCertificado}
              alCambiar={setAceptaCertificado}
              id="acepta-certificado"
            >
              {TEXTO_ACEPTACION_CERTIFICADO_P7}
            </CasillaConsentimientoV4>
          </div>

          {error && origenError === "GENERAR" ? <AvisoRojoV4 className="mt-3">{error}</AvisoRojoV4> : null}

          {intentosSinRespuesta >= INTENTOS_MAXIMOS_SIN_RESPUESTA ? (
            <AvisoRojoV4 className="mt-3">{TEXTOS_05A.intentosAgotados(INTENTOS_MAXIMOS_SIN_RESPUESTA)}</AvisoRojoV4>
          ) : null}

          <div className="mt-4">
            <BotonPrincipalV4
              onClick={generar}
              disabled={!medio || !aceptaCertificado || esperandoAlBanco || intentosSinRespuesta >= INTENTOS_MAXIMOS_SIN_RESPUESTA}
              cargando={generando}
            >
              {textoMedio?.botón ?? "ELEGÍ UN MEDIO DE PAGO"}
            </BotonPrincipalV4>
          </div>
        </>
      )}

      <AvisoAzulV4 className="mt-4" titulo={TEXTOS_05A.avisoImportanteTitulo}>
        {TEXTOS_05A.avisoImportante.map((parrafo) => (
          <p key={parrafo} className="mt-1 first:mt-0">
            {parrafo}
          </p>
        ))}
      </AvisoAzulV4>

      {instruccion && !confirmado ? (
        <VentanaBancardV4>
          {instruccion.tipo === "QR" ? (
            <div className="flex flex-col items-start gap-3">
              <h3 className="v4-rotulo text-[1rem]">{TEXTOS_05A.qrTitulo}</h3>
              <QrBancard payload={instruccion.qrPayload} />
              <p className="text-[0.8125rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                {TEXTOS_05A.qrVence(new Date(instruccion.expiraEn).toLocaleString("es-PY"))}
              </p>

              <p className="text-[0.9375rem] font-bold" style={{ color: "var(--v4-navy)" }} aria-live="polite">
                {TEXTOS_05A.esperando(formatearEspera(esperaMs))}
              </p>

              {pagoSimuladoDisponible ? (
                <div className="flex w-full flex-col gap-1.5">
                  <BotonPrincipalV4
                    onClick={() => void marcarPagado()}
                    disabled={esperaMs < ESPERA_ANTES_DE_PAGADO_MS || marcandoPagado}
                    cargando={marcandoPagado}
                  >
                    {TEXTOS_05A.botonPagadoDemo}
                  </BotonPrincipalV4>
                  <p className="text-[0.75rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                    {esperaMs < ESPERA_ANTES_DE_PAGADO_MS
                      ? TEXTOS_05A.botonPagadoDemoEnEspera(Math.ceil((ESPERA_ANTES_DE_PAGADO_MS - esperaMs) / 1000))
                      : TEXTOS_05A.botonPagadoDemoListo}
                  </p>
                  {error && origenError === "PAGADO" ? <AvisoRojoV4>{error}</AvisoRojoV4> : null}
                </div>
              ) : null}

              {esperaMs >= ESPERA_LARGA_MS ? (
                <p className="text-[0.75rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                  {TEXTOS_05A.esperaLarga}
                </p>
              ) : null}
              {error && origenError === "SONDEO" ? <AvisoRojoV4>{error}</AvisoRojoV4> : null}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <h3 className="v4-rotulo text-[1rem]">{TEXTOS_05A.tarjetaTitulo}</h3>
              <p className="text-[0.875rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                {TEXTOS_05A.tarjetaAclaracion(nombrePortal())}
              </p>
              <VentanaBancardSimulada
                importeFormateado={importe}
                titularSugerido={resumen?.nombreAFacturar ?? ""}
                procesando={marcandoPagado}
                datosDeEjemploDisponibles={pagoSimuladoDisponible}
                alPagar={() => void marcarPagado()}
              />
              <p className="text-[0.9375rem] font-bold" style={{ color: "var(--v4-navy)" }} aria-live="polite">
                {TEXTOS_05A.esperando(formatearEspera(esperaMs))}
              </p>
              {esperaMs >= ESPERA_LARGA_MS ? (
                <p className="text-[0.75rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                  {TEXTOS_05A.esperaLarga}
                </p>
              ) : null}
              {error && origenError === "SONDEO" ? <AvisoRojoV4>{error}</AvisoRojoV4> : null}
            </div>
          )}
        </VentanaBancardV4>
      ) : null}
    </MarcoV4>
  );
}
