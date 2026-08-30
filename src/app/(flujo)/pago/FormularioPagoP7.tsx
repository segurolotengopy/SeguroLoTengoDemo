"use client";

import { nombrePortal } from "@/domain/entidades";
import { useRouter } from "next/navigation";
import { CODIGOS_RESPUESTA_BANCARD } from "@/ports/payment-provider";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatearGuaranies } from "@/domain/catalogo";
// Desde `textos-p7`, no desde el caso de uso: este es un componente de cliente
// e importar `pago-p7.ts` arrastraría `node:crypto` al bundle.
import {
  ADVERTENCIA_PAGO_NO_ES_EMISION_P7,
  AVISO_PLAZO_PAGO_P7,
  AVISO_PLAZO_RESTANTE_P7,
  AVISO_PLAZO_VENCIDO_P7,
  BOTON_CONTINUAR_P7,
  BOTON_PAGAR_Y_CONTRATAR_P7,
  TEXTO_ACEPTACION_CERTIFICADO_P7,
  DEPENDENCIA_BANCARD_P7,
  IDENTIFICADOR_BANCARD_PENDIENTE_P7,
  MEDIO_POR_DEFECTO_P7,
  NOTA_DESTINO_DE_FONDOS_P7,
  NOTA_MONEDA_P7,
  NOTA_FACTURA_A_NOMBRE_DEL_ASEGURADO_P7,
  NOTA_IDENTIFICADOR_BANCARD_P7,
  NOTA_MOMENTOS_DISTINTOS_P7,
  NOTA_RUC_VACIO_P7,
  ROTULO_IDENTIFICADOR_BANCARD_P7,
  ROTULO_IVA_P7,
  ROTULO_NOMBRE_A_FACTURAR_P7,
  ROTULO_PREMIO_TOTAL_P7,
  ROTULO_PRIMA_NETA_P7,
  ROTULO_PROPUESTA_P7,
  ROTULO_RUC_P7,
  SEGURIDAD_P7,
  TEXTOS_MEDIOS_DE_PAGO_P7,
  TITULO_BLOQUE_FACTURA_P7,
  TITULO_BLOQUE_MEDIOS_P7,
  TITULO_DEPENDENCIA_BANCARD_P7,
  TITULO_DESPUES_DE_ESTA_PANTALLA_P7,
  TITULO_LIQUIDACION_P7,
  TITULO_PLAZO_PAGO_P7,
  TITULO_REFERENCIAS_P7,
  TITULO_SEGURIDAD_P7,
  NOTA_DESGLOSE_PROVISIONAL_P7,
} from "@/domain/textos-p7";
import type { MedioDePago } from "@/domain/tipos";

/**
 * Bloques interactivos de P7 (docs/ESPECIFICACION_PANTALLAS.md → "P7 · Paso 7
 * de 9 — Facturación y garantía de pago"): datos para la factura, declaración
 * de origen lícito de fondos y elección del medio de pago.
 *
 * **No tiene lógica de negocio.** El importe no se calcula ni se manda: sale
 * del expediente y viaja solo del servidor a la pantalla. La decisión de qué
 * llamada hacerle a Bancard, la clave de idempotencia y la transición del
 * expediente viven en `POST /api/p7/pago` y `GET /api/p7/estado`.
 *
 * **Regla inviolable #6:** este componente no tiene ni un campo de tarjeta.
 * Para débito y crédito lo único que recibe es la URL del formulario seguro de
 * Bancard, que se abre en una pestaña nueva; el número de tarjeta y el CVV se
 * tipean allá y nunca pasan por SeguroLoTengo. Buscá un `input` de tarjeta en
 * este archivo: no existe, y `no-persiste-datos-de-tarjeta.test.ts` falla si
 * alguien agrega uno.
 */

interface Resumen {
  readonly numeroPropuesta: string | null;
  readonly plazoPagoVenceEn: string | null;
  readonly montoGs: number;
  readonly primaNetaGs: number;
  readonly ivaGs: number;
  readonly desgloseProvisional: boolean;
  readonly nombreAFacturar: string;
  readonly identificacionFiscalPorDefecto: string;
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
  /** `response_code` de Bancard cuando el rechazo vino de ahí. */
  readonly codigoRespuesta?: string;
  readonly numeroPropuesta?: string;
  readonly referenciaBancard?: string;
  readonly instruccion?: Instruccion;
}

interface RespuestaEstado {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly confirmado?: boolean;
  readonly siguientePantalla?: string;
}

const MENSAJES: Readonly<Record<string, string>> = {
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  ESTADO_INVALIDO: "Este proceso ya no está en el paso de pago.",
  EXPEDIENTE_INCOMPLETO: "Faltan datos del expediente para preparar el pago.",
  MEDIO_INVALIDO: "Elegí uno de los medios de pago disponibles.",
  PLAZO_VENCIDO: AVISO_PLAZO_VENCIDO_P7,
  RUC_INVALIDO: "Revisá el RUC: el formato esperado es 80012345-6.",
  BANCARD_NO_DISPONIBLE: "Bancard no respondió. Volvé a intentar en unos segundos.",
  BANCARD_RECHAZO: "Bancard rechazó la operación. Probá con otro medio de pago.",
  PAGO_NO_INICIADO:
    "Bancard no reconoce esta operación, así que seguir esperando no la va a confirmar. " +
    "Generá el pago de nuevo: no se te cobró nada.",
  PAGO_CANCELADO: "La operación se canceló o venció. Generá una nueva.",
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};

/** `m:ss` para la espera de la acreditación, que se cuenta en minutos, no en horas. */
function formatearEspera(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

function formatearRestante(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const dosDigitos = (n: number) => n.toString().padStart(2, "0");
  return `${dosDigitos(horas)}:${dosDigitos(minutos)}:${dosDigitos(segundos)}`;
}

/** Cada cuánto se le pregunta a Bancard si la operación ya se acreditó. */
const INTERVALO_SONDEO_MS = 2_000;

/**
 * Cuánto dura el contador antes de habilitar el botón *Pagado*, en la
 * demostración.
 *
 * Cinco segundos: lo que tarda alguien en sacar el celular y escanear. No es un
 * plazo del negocio —el del negocio son las 24 horas de D-10— sino el tiempo
 * que hace creíble el recorrido sin hacer esperar a nadie en una reunión.
 */
const ESPERA_ANTES_DE_PAGADO_MS = 5_000;

/**
 * A partir de cuánta espera la pantalla deja de limitarse a decir "esperando".
 *
 * Treinta segundos es bastante más que lo que tarda una acreditación normal
 * —el mock acredita a los seis— y bastante menos que el rato en que alguien
 * empieza a pensar que la pantalla se colgó. Pasado eso aparece qué hacer, que
 * es la regla de los mensajes de este proyecto: decir qué hacer, no qué pasa.
 */
const ESPERA_LARGA_MS = 30_000;

/**
 * Cuántos `PAGO_NO_INICIADO` seguidos se toleran antes de cortar el sondeo.
 *
 * No es un motivo transitorio disfrazado: significa que el proveedor **no
 * conoce** la operación que estamos consultando. Con Bancard de verdad no
 * debería pasar nunca; con el mock pasa por una razón conocida y documentada en
 * `adapters/mock/estado-compartido.ts` — las operaciones simuladas viven en
 * memoria del proceso, y Amplify puede atender el sondeo con **otra instancia
 * de cómputo** que nunca vio esa operación.
 *
 * Antes eso dejaba la pantalla sondeando en silencio para siempre: el motivo no
 * estaba en la lista de terminales, así que cada respuesta se trataba como un
 * tropiezo pasajero y el siguiente sondeo repetía el mismo resultado. Cinco
 * seguidos son diez segundos: suficiente para descartar una carrera entre la
 * apertura de la operación y el primer sondeo, y poco para no hacer esperar al
 * pedo a nadie.
 */
const SONDEOS_SIN_OPERACION_TOLERADOS = 5;

/**
 * Motivos que de verdad no se resuelven esperando: con ellos el sondeo se
 * corta y se muestra el error. Cualquier otro fallo (un 5xx puntual, un cuerpo
 * malformado) se trata como transitorio y el próximo sondeo reintenta — antes
 * un solo tropiezo dejaba la pantalla esperando un pago que ya no consultaba.
 */
const MOTIVOS_TERMINALES_SONDEO: ReadonlySet<string> = new Set([
  "SESION_INVALIDA",
  "EXPEDIENTE_NO_ENCONTRADO",
  "ESTADO_INVALIDO",
  "PAGO_CANCELADO",
]);

const CLASE_CAMPO =
  "h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo placeholder:text-etiqueta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500";

/**
 * Arma el mensaje de un rechazo: **la razón la dice Bancard, qué hacer lo
 * decimos nosotros.**
 *
 * Antes acá había un texto propio para todos los rechazos —"Bancard rechazó la
 * operación. Probá con otro medio de pago."— que servía igual para fondos
 * insuficientes que para una tarjeta inhabilitada, y esas dos cosas mandan a la
 * persona a hacer cosas distintas. La descripción sale del catálogo del puerto
 * (`CODIGOS_RESPUESTA_BANCARD`), que es la tabla del documento del proveedor,
 * así que ni la pantalla ni el servidor la redactan.
 *
 * El código va entre paréntesis a propósito: es lo que la persona le va a decir
 * a quien la atienda, y lo que queda en la evidencia.
 */
function mensajeDeRechazo(motivo: string | undefined, codigoRespuesta: string | undefined): string {
  const base = MENSAJES[motivo ?? ""] ?? MENSAJES.CUERPO_INVALIDO;
  const descripcion = codigoRespuesta ? CODIGOS_RESPUESTA_BANCARD[codigoRespuesta] : undefined;
  if (!descripcion) return base;
  return `${base} Bancard informó: ${descripcion} (código ${codigoRespuesta}).`;
}

/**
 * El mensaje de error, dibujado **donde está la acción que lo produjo**.
 *
 * Se monta tres veces en la pantalla —junto al botón de generar, junto al de
 * *Pagado* y junto al bloque de espera— y cada instancia decide si le toca por
 * el origen. Es más simple que mover un único nodo por el árbol, y hace
 * imposible que el mensaje quede lejos de su botón: si mañana se agrega una
 * acción, o se le pone su instancia o su error no se ve, que es un fallo
 * evidente en vez de uno silencioso.
 */
function MensajeDeError({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-rojo-300 bg-rojo-50 px-3 py-2 text-sm font-semibold text-rojo-800 dark:border-rojo-700 dark:bg-rojo-950 dark:text-rojo-300"
    >
      {texto}
    </p>
  );
}

function Fila({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-sm text-cuerpo">{rotulo}</span>
      <span className="text-right text-sm font-semibold text-titulo tabular-nums">{valor}</span>
    </div>
  );
}

export function FormularioPagoP7({
  /**
   * `DEMO_MODE=true`: aparece el contador y el botón *Pagado*, que es lo que en
   * la realidad hace la persona en la app de su banco. La guarda de verdad está
   * en el servidor —la ruta es una extensión `route.demo.ts` y no se compila
   * siquiera con el flag apagado—; esto solo decide si el botón se dibuja.
   */
  pagoSimuladoDisponible = false,
}: {
  pagoSimuladoDisponible?: boolean;
} = {}) {
  const router = useRouter();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [ruc, setRuc] = useState("");
  // CHG-37 · la única casilla obligatoria del paso (maqueta p.7). Arranca
  // desmarcada: lo que autoriza ocurre después del cobro.
  const [aceptaCertificado, setAceptaCertificado] = useState(false);
  const [medio, setMedio] = useState<MedioDePago>(MEDIO_POR_DEFECTO_P7);

  const [generando, setGenerando] = useState(false);
  const [instruccion, setInstruccion] = useState<Instruccion | null>(null);
  const [referenciaBancard, setReferenciaBancard] = useState<string | null>(null);
  const [numeroPropuesta, setNumeroPropuesta] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [restanteMs, setRestanteMs] = useState<number | null>(null);
  /** Desde cuándo se espera la acreditación; alimenta el contador de la espera. */
  const [esperandoDesde, setEsperandoDesde] = useState<number | null>(null);
  const [esperaMs, setEsperaMs] = useState(0);
  /** `PAGO_NO_INICIADO` consecutivos. Ver SONDEOS_SIN_OPERACION_TOLERADOS. */
  const sondeosSinOperacion = useRef(0);
  /** Botón *Pagado* en vuelo, para no mandar dos veces el mismo pago. */
  const [marcandoPagado, setMarcandoPagado] = useState(false);
  /**
   * Qué acción produjo el error que se está mostrando.
   *
   * Existe para poder dibujarlo **junto al botón que lo disparó** en vez de en
   * un lugar fijo. Esta pantalla tiene tres acciones —generar el pago, marcar
   * *Pagado* y el sondeo que corre solo— y el mensaje vivía al final de la
   * columna, a media pantalla de distancia de cualquiera de ellas: quien
   * apretaba un botón arriba no veía por qué no había pasado nada.
   */
  const [origenError, setOrigenError] = useState<"GENERAR" | "PAGADO" | "SONDEO" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Evita que un sondeo en vuelo escriba estado después de desmontar.
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

  // Cuenta regresiva del plazo para pagar (D-10). Se muestra acá porque acá
  // corre: el expediente ya está firmado y lo que falta es la plata.
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

  // La cuenta llegó a cero: se le pide al servidor que evalúe el plazo. El que
  // decide sigue siendo él, contra su propio reloj — adelantar la hora del
  // navegador no adelanta nada, porque vuelve a mirar la hora real y contesta
  // que todavía no.
  //
  // `enVuelo` impide que se apilen peticiones. El efecto depende de
  // `restanteMs`, que cambia **cada segundo**, así que una vez pasado el cero
  // se dispararía un POST por segundo; si el primero tarda —y este endpoint
  // escribe dos veces en DynamoDB— la cola crece sola y termina de tumbar al
  // servidor que ya estaba lento. Se vio en la corrida completa de la batería
  // E2E: el escenario del vencimiento se quedó sin redirigir y el siguiente
  // heredó un servidor trabado, mientras que aislado pasaba.
  //
  // Lo que **no** hace es cortar el reintento: si el servidor contesta que el
  // plazo todavía no se cumplió, el próximo tick vuelve a preguntar. Solo se
  // impide que haya dos preguntas a la vez.
  const vencimientoEnVuelo = useRef(false);
  useEffect(() => {
    if (restanteMs === null || restanteMs > 0 || confirmado) return;
    if (vencimientoEnVuelo.current) return;

    let cancelado = false;
    vencimientoEnVuelo.current = true;
    void (async () => {
      try {
        const respuesta = await fetch("/api/p7/vencimiento", { method: "POST" });
        const datos = (await respuesta.json().catch(() => ({}))) as {
          ok?: boolean;
          vencio?: boolean;
        };
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

  useEffect(() => {
    void (async () => {
      try {
        const respuesta = await fetch("/api/p7/resumen");
        const datos = (await respuesta.json().catch(() => ({}))) as {
          ok?: boolean;
          resumen?: Resumen;
        };
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

  const sondear = useCallback(async (): Promise<boolean> => {
    const respuesta = await fetch("/api/p7/estado");
    const datos = (await respuesta.json().catch(() => ({}))) as RespuestaEstado;

    if (!datos.ok) {
      if (datos.siguientePantalla === "/solicitud-vencida") {
        irAPantallaB();
        return true;
      }

      // El proveedor no conoce la operación. Repetido, no se arregla esperando.
      if (datos.motivo === "PAGO_NO_INICIADO") {
        sondeosSinOperacion.current += 1;
        if (sondeosSinOperacion.current < SONDEOS_SIN_OPERACION_TOLERADOS) return false;
        if (vigente.current) {
          setOrigenError("SONDEO");
          setError(MENSAJES.PAGO_NO_INICIADO);
        }
        return true;
      }
      sondeosSinOperacion.current = 0;

      const terminal = datos.motivo !== undefined && MOTIVOS_TERMINALES_SONDEO.has(datos.motivo);
      if (terminal && vigente.current) {
        setOrigenError("SONDEO");
        setError(MENSAJES[datos.motivo ?? ""] ?? MENSAJES.CUERPO_INVALIDO);
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

  // Contador de la espera. Va aparte del sondeo porque corre cada segundo y el
  // sondeo cada dos: mezclarlos haría que el número saltara de a dos.
  useEffect(() => {
    if (esperandoDesde === null || confirmado) return;

    const recalcular = () => setEsperaMs(Date.now() - esperandoDesde);
    recalcular();
    const temporizador = setInterval(recalcular, 1_000);
    return () => clearInterval(temporizador);
  }, [esperandoDesde, confirmado]);

  /**
   * Marca el pago como acreditado del lado del proveedor simulado y fuerza un
   * sondeo, para no esperar hasta dos segundos por el intervalo.
   *
   * **No confirma el expediente**: eso lo sigue haciendo `confirmarPagoP7` con
   * todas sus validaciones, desde el sondeo de siempre. Este botón hace lo que
   * hace la app del banco, ni más ni menos.
   */
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
      // El sondeo que sigue ve la operación acreditada y confirma el expediente.
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

  async function generar() {
    if (generando) return;

    setGenerando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/p7/pago", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // El monto no viaja: lo pone el servidor desde el plan del expediente.
        body: JSON.stringify({ medio, ruc, aceptaCertificadoYEntrega: aceptaCertificado }),
      });
      const datos = (await respuesta.json().catch(() => ({}))) as RespuestaInicio;

      if (!datos.ok) {
        setOrigenError("GENERAR");
        setError(mensajeDeRechazo(datos.motivo, datos.codigoRespuesta));
        return;
      }

      setInstruccion(datos.instruccion ?? null);
      setReferenciaBancard(datos.referenciaBancard ?? null);
      setNumeroPropuesta(datos.numeroPropuesta ?? null);
    } catch {
      setOrigenError("GENERAR");
      setError(MENSAJES.BANCARD_NO_DISPONIBLE);
    } finally {
      setGenerando(false);
    }
  }

  const textoMedio = TEXTOS_MEDIOS_DE_PAGO_P7.find((opcion) => opcion.medio === medio);
  const importe = resumen ? formatearGuaranies(resumen.montoGs) : "—";

  return (
    <div className="flex flex-col gap-4">
      {/* En pantallas anchas: factura a la izquierda, medio de pago y botón a
          la derecha; plazo, secuencia y seguridad debajo del botón. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* ------------------------------------------------------------------ */}
      {/* Bloque 1 — Datos para la factura                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_BLOQUE_FACTURA_P7}
          </h2>
          <span className="text-xs text-etiqueta">{NOTA_FACTURA_A_NOMBRE_DEL_ASEGURADO_P7}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="p7-nombre" className="text-xs font-semibold text-etiqueta">
              {ROTULO_NOMBRE_A_FACTURAR_P7}
            </label>
            {/*
              Bloqueado por la misma razón que los campos de OCR de P5: la
              factura es siempre a nombre del asegurado (regla inviolable #9).
              El valor que se usa lo toma el servidor de la identidad
              verificada; este input es solo para que la persona lo vea.
            */}
            <div className="flex items-center gap-2">
              <input
                id="p7-nombre"
                type="text"
                value={resumen?.nombreAFacturar ?? ""}
                readOnly
                aria-describedby="p7-nombre-candado"
                className={`${CLASE_CAMPO} bg-superficie-suave text-cuerpo`}
              />
              <span id="p7-nombre-candado" aria-label="Campo bloqueado" title="Campo bloqueado">
                🔒
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="p7-ruc" className="text-xs font-semibold text-etiqueta">
              {ROTULO_RUC_P7}
            </label>
            <input
              id="p7-ruc"
              type="text"
              inputMode="numeric"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              placeholder="Opcional — ej.: 80012345-6"
              aria-describedby="p7-ruc-ayuda"
              className={CLASE_CAMPO}
            />
            {/* CHG-34 · qué se usa si el RUC queda vacío, dicho en vez de
                dejado implícito: la caída ya existía, pero no se mostraba
                cuál era la identificación que iba a viajar a Alianza. */}
            <p id="p7-ruc-ayuda" className="text-xs text-etiqueta">
              {NOTA_RUC_VACIO_P7}{" "}
              {resumen ? (
                <span className="font-semibold text-cuerpo">
                  {resumen.identificacionFiscalPorDefecto}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Liquidación del premio */}
        <div className="flex flex-col rounded-lg border border-borde-sutil bg-superficie-suave px-4 py-3">
          <h3 className="pb-1 text-[11px] font-bold tracking-wide text-etiqueta uppercase">
            {TITULO_LIQUIDACION_P7}
          </h3>
          <Fila
            rotulo={ROTULO_PRIMA_NETA_P7}
            valor={resumen ? formatearGuaranies(resumen.primaNetaGs) : "—"}
          />
          <Fila rotulo={ROTULO_IVA_P7} valor={resumen ? formatearGuaranies(resumen.ivaGs) : "—"} />
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-borde-tenue pt-2">
            <span className="text-sm font-bold text-titulo">{ROTULO_PREMIO_TOTAL_P7}</span>
            <span className="text-base font-bold text-titulo tabular-nums">{importe}</span>
          </div>
          {/* El desglose se rotula como provisional mientras Alianza no
              mande el oficial (D-04). Un importe con forma de definitivo se
              lee como definitivo, y este va a una factura. */}
          {resumen?.desgloseProvisional ? (
            <p className="pt-1 text-[11px] text-naranja-800 dark:text-naranja-200">
              {NOTA_DESGLOSE_PROVISIONAL_P7}
            </p>
          ) : null}
          <p className="pt-1 text-[11px] text-etiqueta">{NOTA_MONEDA_P7}</p>
          {/* CHG-36 · a quién le llega la plata. */}
          <p className="pt-1 text-[11px] text-cuerpo">{NOTA_DESTINO_DE_FONDOS_P7}</p>
        </div>

        {/* Referencias de la operación */}
        <div className="flex flex-col rounded-lg border border-azul-200 bg-azul-50 px-4 py-3 dark:border-azul-700 dark:bg-azul-950">
          <h3 className="pb-1 text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_REFERENCIAS_P7}
          </h3>
          <Fila rotulo={ROTULO_PROPUESTA_P7} valor={numeroPropuesta ?? "—"} />
          <Fila
            rotulo={ROTULO_IDENTIFICADOR_BANCARD_P7}
            valor={referenciaBancard ?? IDENTIFICADOR_BANCARD_PENDIENTE_P7}
          />
          <p className="pt-1 text-xs text-azul-800 dark:text-azul-200">
            {NOTA_IDENTIFICADOR_BANCARD_P7}
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Bloque 2 — Medio de pago (columna derecha)                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_BLOQUE_MEDIOS_P7}
          </h2>
          <p className="text-xs text-etiqueta">{NOTA_MOMENTOS_DISTINTOS_P7}</p>
        </div>

        <fieldset className="flex flex-col gap-2" disabled={confirmado}>
          <legend className="sr-only">{TITULO_BLOQUE_MEDIOS_P7}</legend>
          {TEXTOS_MEDIOS_DE_PAGO_P7.map((opcion) => (
            <label
              key={opcion.medio}
              className={`flex cursor-pointer flex-col gap-1.5 rounded-lg border-2 p-3 ${
                medio === opcion.medio
                  ? "border-naranja-500 bg-naranja-50 dark:bg-naranja-950"
                  : "border-borde-sutil bg-superficie-suave"
              }`}
            >
              <span className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name="p7-medio"
                  value={opcion.medio}
                  checked={medio === opcion.medio}
                  onChange={() => {
                    setMedio(opcion.medio);
                    // Cambiar de medio abre un intento distinto: lo que se
                    // había generado para el anterior deja de aplicar.
                    setInstruccion(null);
                    setReferenciaBancard(null);
                    setError(null);
                  }}
                  className="mt-1 h-4 w-4 shrink-0 accent-naranja-500"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-bold tracking-wide text-titulo uppercase">
                    {opcion.titulo}
                  </span>
                  <span className="text-xs font-semibold text-etiqueta">{opcion.momento}</span>
                </span>
              </span>
              <ul className="flex list-disc flex-col gap-1 pl-9 text-sm text-cuerpo">
                {opcion.vinetas.map((vineta) => (
                  <li key={vineta}>{vineta}</li>
                ))}
              </ul>
            </label>
          ))}
        </fieldset>

        {medio === "TARJETA_CREDITO" ? (
          <div className="flex flex-col gap-1 rounded-lg border border-borde-sutil bg-superficie-suave px-3 py-2.5">
            <p className="text-[11px] font-bold tracking-wide text-etiqueta uppercase">
              {TITULO_DEPENDENCIA_BANCARD_P7}
            </p>
            <p className="text-xs text-cuerpo">{DEPENDENCIA_BANCARD_P7}</p>
          </div>
        ) : null}

        {/* CHG-37 · autoriza dos cosas que pasan después del cobro: que se
            emita el Certificado de Cobertura Provisional y que la póliza y la
            factura viajen a los canales verificados. Va antes del botón y
            deshabilitado el botón hasta marcarla, porque marcarla es la
            condición para que exista una operación en Bancard. */}
        {!confirmado ? (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-borde-sutil bg-superficie-suave px-3 py-2.5 text-xs text-cuerpo">
            <input
              id="p7-acepta-certificado"
              type="checkbox"
              checked={aceptaCertificado}
              onChange={(evento) => setAceptaCertificado(evento.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-naranja-500"
            />
            {TEXTO_ACEPTACION_CERTIFICADO_P7}
          </label>
        ) : null}

        {/* Acción: generar el QR / abrir el formulario seguro */}
        {!confirmado ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void generar()}
              disabled={generando || !aceptaCertificado}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:bg-superficie-suave disabled:text-etiqueta disabled:opacity-60 sm:w-auto sm:self-start"
            >
              {generando ? "Comunicando con Bancard…" : (textoMedio?.botón ?? "Continuar")}
            </button>
            {/* CHG-38 · lo que el pago hace ahora: contrata. Con el pago antes
                de la firma este texto habría mentido. */}
            <p className="text-xs font-semibold text-cuerpo">{BOTON_PAGAR_Y_CONTRATAR_P7}</p>
            <MensajeDeError texto={origenError === "GENERAR" ? error : null} />
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Resultado de Bancard                                                */}
      {/* ------------------------------------------------------------------ */}
      {instruccion && !confirmado ? (
        <section
          aria-live="polite"
          className="flex flex-col items-start gap-3 rounded-lg border border-borde-sutil bg-superficie p-4"
        >
          {instruccion.tipo === "QR" ? (
            <>
              <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                Escaneá el QR con tu app de banco
              </h2>
              {/*
                La cadena es un `qr_data` **EMVCo de verdad**, con la
                estructura y el CRC que define el documento de Bancard QR: un
                lector de QR la parsea. Se muestra como texto en vez de
                dibujarla porque no hay un pago real detrás; el dibujo lo hace
                Bancard, que en la API real devuelve además la URL del PNG.
              */}
              <p className="w-full overflow-x-auto rounded-lg border border-borde-sutil bg-superficie-suave px-4 py-3 font-mono text-xs break-all text-cuerpo">
                {instruccion.qrPayload}
              </p>
              <p className="text-xs text-etiqueta">
                El QR vence el {new Date(instruccion.expiraEn).toLocaleString("es-PY")}.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                Completá el pago en el formulario seguro de Bancard
              </h2>
              <p className="text-sm text-cuerpo">
                Los datos de tu tarjeta se ingresan en Bancard. {nombrePortal()} no los recibe ni los
                guarda.
              </p>
              <a
                href={instruccion.urlFormularioSeguro}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-naranja-500 px-6 text-sm font-bold tracking-wide text-naranja-700 uppercase hover:bg-naranja-50 dark:text-naranja-300 dark:hover:bg-naranja-950"
              >
                Abrir formulario seguro ↗
              </a>
            </>
          )}
          {/* El contador no es decoración: sin él, treinta segundos y cinco
              minutos se ven exactamente igual, y la persona no tiene con qué
              decidir si esperar o volver a generar el pago. */}
          <p className="text-sm font-semibold text-cuerpo" aria-live="polite">
            Esperando la confirmación de Bancard…{" "}
            <span className="tabular-nums text-etiqueta">{formatearEspera(esperaMs)}</span>
          </p>

          {/* Demostración: el botón hace lo que en la realidad hace la persona
              en la app de su banco. Antes esto ocurría solo, por reloj, y una
              demostración en la que el dinero entra sin que nadie haga nada no
              muestra el paso que más importa. El contador da el momento: cinco
              segundos, lo que tarda alguien en escanear. */}
          {pagoSimuladoDisponible ? (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => void marcarPagado()}
                disabled={esperaMs < ESPERA_ANTES_DE_PAGADO_MS || marcandoPagado}
                className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-verde-600 px-6 text-sm font-bold tracking-wide text-verde-700 uppercase transition-colors hover:bg-verde-50 disabled:cursor-not-allowed disabled:opacity-40 sm:self-start dark:border-verde-400 dark:text-verde-300 dark:hover:bg-verde-950"
              >
                {marcandoPagado ? "Confirmando…" : "Pagado"}
              </button>
              <p className="text-xs text-etiqueta">
                {esperaMs < ESPERA_ANTES_DE_PAGADO_MS
                  ? `Demostración: se habilita en ${Math.ceil((ESPERA_ANTES_DE_PAGADO_MS - esperaMs) / 1000)} s, simulando el tiempo de escanear y pagar.`
                  : "Demostración: equivale a haber pagado el QR desde la app de tu banco."}
              </p>
              <MensajeDeError texto={origenError === "PAGADO" ? error : null} />
            </div>
          ) : null}
          {esperaMs >= ESPERA_LARGA_MS ? (
            <p className="text-xs text-etiqueta">
              Está tardando más de lo habitual. Si ya pagaste, no vuelvas a pagar: esperá acá o
              volvé a esta pantalla más tarde, que la confirmación se registra igual. Si todavía no
              pagaste, podés generar el pago de nuevo.
            </p>
          ) : null}
          <MensajeDeError texto={origenError === "SONDEO" ? error : null} />
        </section>
      ) : null}

      {confirmado ? (
        <section
          aria-live="polite"
          className="flex flex-col gap-3 rounded-lg border border-verde-400 bg-verde-50 p-4 dark:border-verde-600 dark:bg-verde-950"
        >
          <h2 className="text-sm font-bold tracking-wide text-verde-800 uppercase dark:text-verde-200">
            Pago acreditado
          </h2>
          {/* D-02 · los tres medios cobran directo, así que ya no hay dos
              mensajes según si el dinero se movió o quedó reservado. */}
          <p className="text-sm text-verde-900 dark:text-verde-100">
            Bancard acreditó el premio a Alianza Garantía. Tu seguro quedó contratado.
          </p>
          <a
            href="/confirmacion"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 sm:self-start"
          >
            {BOTON_CONTINUAR_P7}
          </a>
        </section>
      ) : null}

      </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Debajo del botón: plazo, secuencia y seguridad                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        {/* Plazo para pagar (D-10) */}
        <div className="flex flex-col gap-1 rounded-lg border border-naranja-300 bg-naranja-50 px-3 py-2.5 dark:border-naranja-700 dark:bg-naranja-950">
          <p className="text-[11px] font-bold tracking-wide text-naranja-800 uppercase dark:text-naranja-200">
            {TITULO_PLAZO_PAGO_P7}
          </p>
          {restanteMs !== null && !confirmado ? (
            <p className="text-sm font-bold text-naranja-900 dark:text-naranja-100">
              {AVISO_PLAZO_RESTANTE_P7}:{" "}
              <span className="tabular-nums">{formatearRestante(restanteMs)}</span>
            </p>
          ) : null}
          <p className="text-xs text-naranja-900 dark:text-naranja-100">
            {AVISO_PLAZO_PAGO_P7}
          </p>
        </div>

        {/* Después de esta pantalla */}
        {textoMedio ? (
          <div className="flex flex-col gap-1 rounded-lg border border-azul-200 bg-azul-50 px-3 py-2.5 dark:border-azul-700 dark:bg-azul-950">
            <p className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
              {TITULO_DESPUES_DE_ESTA_PANTALLA_P7}
            </p>
            <p className="text-xs font-semibold text-azul-900 dark:text-azul-100">
              {textoMedio.secuencia}
            </p>
          </div>
        ) : null}

        {/* Seguridad y trazabilidad */}
        <section
          aria-labelledby="p7-seguridad"
          className="flex flex-col gap-1 rounded-lg border border-verde-300 bg-verde-50 px-3 py-2.5 dark:border-verde-700 dark:bg-verde-950"
        >
          <h2
            id="p7-seguridad"
            className="text-[11px] font-bold uppercase tracking-wide text-verde-800 dark:text-verde-200"
          >
            {TITULO_SEGURIDAD_P7}
          </h2>
          <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-verde-900 dark:text-verde-100">
            {SEGURIDAD_P7.map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </ul>
          <p className="text-xs font-semibold text-verde-900 dark:text-verde-100">
            {ADVERTENCIA_PAGO_NO_ES_EMISION_P7}
          </p>
        </section>
      </div>
    </div>
  );
}
