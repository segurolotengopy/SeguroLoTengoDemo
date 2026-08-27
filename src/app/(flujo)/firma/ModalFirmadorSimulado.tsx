"use client";

/**
 * La ventana del firmador de Code100, simulada dentro de P8.
 *
 * ## Esto no es una pantalla de SeguroLoTengo
 *
 * Y el modal lo dice, con su propia cabecera y su propio color: quien lo mira
 * tiene que entender que cruzó a otro proveedor. En el flujo real, este
 * contenido lo sirve Code100 en su propio dominio, la persona llega ahí por el
 * enlace que le mandaron por WhatsApp o correo, y **el OTP de firma nunca pasa
 * por nuestro servidor** — la aceptación contractual ocurre del otro lado.
 *
 * Existe por una razón de demostración, no de producto: sin esto, el único
 * modo de completar la firma en el demo era abrir `/demo-panel`, o sea
 * mostrarle a quien está del otro lado de la videollamada la consola de trucos
 * justo en el paso más delicado del recorrido. El modal deja la demostración
 * dentro del flujo.
 *
 * ## Lo que no hace
 *
 * - **No muestra el código.** Ni lo pide al servidor, ni lo recibe. El código
 *   está en el WhatsApp de la persona (`INTEGRATION_OTP=live`) o en el panel de
 *   demo. Regla inviolable #2.
 * - **No firma ni transiciona el expediente.** Le pasa el código a la sesión
 *   simulada, que lo verifica con las mismas reglas que los otros dos OTP. El
 *   expediente pasa a FIRMADO recién cuando el sondeo de P8 se lo pregunta al
 *   proveedor, igual que si la firma hubiera ocurrido en la ventana real.
 * - **No existe fuera de `DEMO_MODE`.** Se carga por `next/dynamic` y solo se
 *   monta si el servidor dijo que el modo demo está activo.
 */
import { nombrePortal } from "@/domain/entidades";
import { useCallback, useEffect, useState } from "react";
import { CamposOtp } from "@/components/shared";
import { LONGITUD_CODIGO_OTP } from "@/domain/reglas-otp";

type Paso = "ABRIENDO" | "CODIGO" | "FIRMANDO" | "FIRMADO" | "RECHAZADA";

const MENSAJES: Readonly<Record<string, string>> = {
  CODIGO_INCORRECTO: "El código no es correcto.",
  OTP_EXPIRADO: "El código venció. Cerrá esta ventana y pedí el enlace de nuevo.",
  INTENTOS_AGOTADOS: "Se agotaron los intentos. Cerrá esta ventana y pedí el enlace de nuevo.",
  ENLACE_EXPIRADO: "El enlace de firma venció.",
  ENLACE_NO_ABIERTO: "El acto de firma todavía no está abierto.",
  YA_CERRADA: "Este acto de firma ya se cerró.",
  NO_ENCONTRADA: "No encontramos el acto de firma. Pedí el enlace de nuevo.",
  FALLA_DEL_PROVEEDOR: "El proveedor del código no respondió. Intentá de nuevo en unos segundos.",
  // Faltaba, y era justo el que aparecía cuando el envío del código fallaba:
  // se caía al genérico "No pudimos abrir el firmador", que no dice nada.
  ERROR_ENVIO:
    "No pudimos enviarte el código de firma. Revisá que el WhatsApp del expediente pueda recibir mensajes y volvé a intentar.",
  EXPIRADA: "El enlace de firma venció. Cerrá esta ventana y pedí uno nuevo.",
  PEDIDO_INVALIDO: "No pudimos procesar el pedido. Cerrá esta ventana y volvé a intentar.",
  CODIGO_REQUERIDO: "Ingresá el código de 6 dígitos.",
  FIRMA_NO_INICIADA: "Todavía no pediste el enlace de firma.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a empezar.",
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar.",
  NO_DISPONIBLE: "El firmador simulado no está disponible en este entorno.",
};

interface Respuesta {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly intentosRestantes?: number;
}

export interface ModalFirmadorSimuladoProps {
  /** Identificador del acto, tal como lo muestra P8. Solo se exhibe. */
  readonly idCode100: string;
  /** Canal y destino enmascarado por los que viajó el código. */
  readonly destino: string;
  /** La firma se completó: P8 deja de mostrar el modal y sigue sondeando. */
  readonly alFirmar: () => void;
  /**
   * La persona rechazó firmar. P8 tiene que enterarse por el sondeo, igual
   * que con la ventana real, para poder ofrecer pedir un enlace nuevo.
   */
  readonly alRechazar: () => void;
  readonly alCerrar: () => void;
}

export default function ModalFirmadorSimulado({
  idCode100,
  destino,
  alFirmar,
  alRechazar,
  alCerrar,
}: ModalFirmadorSimuladoProps) {
  const [paso, setPaso] = useState<Paso>("ABRIENDO");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Palanca de demostración de la regla atómica; se consume en un solo intento. */
  const [cortarSellado, setCortarSellado] = useState(false);

  const pedir = useCallback(async (cuerpo: Record<string, unknown>): Promise<Respuesta> => {
    const respuesta = await fetch("/api/p8/firmador-simulado", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    return (await respuesta.json().catch(() => ({}))) as Respuesta;
  }, []);

  // Abrir el enlace es lo que hace que Code100 emita el OTP de firma: hasta
  // que no se abre, no hay código que tipear. Por eso pasa apenas se monta el
  // modal, que es el equivalente exacto a tocar el enlace del WhatsApp.
  useEffect(() => {
    let cancelado = false;

    void (async () => {
      try {
        const datos = await pedir({ accion: "ABRIR" });
        if (cancelado) return;

        // `YA_CERRADA` acá significa que el enlace ya estaba abierto de antes
        // (por ejemplo, si se cerró y reabrió el modal). No es un error: el
        // código ya se emitió y lo único que falta es tipearlo.
        if (!datos.ok && datos.motivo !== "YA_CERRADA") {
          setError(MENSAJES[datos.motivo ?? ""] ?? "No pudimos abrir el firmador.");
          return;
        }
        setPaso("CODIGO");
      } catch {
        if (!cancelado) setError("No pudimos conectarnos con el firmador.");
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [pedir]);

  async function firmar(valor: string) {
    if (valor.length !== LONGITUD_CODIGO_OTP) return;

    setPaso("FIRMANDO");
    setError(null);
    try {
      const datos = await pedir({
        accion: "FIRMAR",
        codigo: valor,
        ...(cortarSellado ? { fallarAMitad: true } : {}),
      });
      // Se consume en un solo intento, como las palancas del panel: se ve el
      // corte una vez y el reintento firma normal.
      setCortarSellado(false);

      if (!datos.ok) {
        const base = MENSAJES[datos.motivo ?? ""] ?? "No pudimos completar la firma.";
        setError(
          datos.intentosRestantes !== undefined
            ? `${base} Te ${datos.intentosRestantes === 1 ? "queda" : "quedan"} ${datos.intentosRestantes} ${
                datos.intentosRestantes === 1 ? "intento" : "intentos"
              }.`
            : base,
        );
        setCodigo("");
        setPaso("CODIGO");
        return;
      }

      setPaso("FIRMADO");
      alFirmar();
    } catch {
      setError("No pudimos conectarnos con el firmador.");
      setPaso("CODIGO");
    }
  }

  async function rechazar() {
    setError(null);
    try {
      const datos = await pedir({ accion: "RECHAZAR" });
      if (!datos.ok) {
        setError(MENSAJES[datos.motivo ?? ""] ?? "No pudimos registrar el rechazo.");
        return;
      }
      setPaso("RECHAZADA");
      alRechazar();
    } catch {
      setError("No pudimos conectarnos con el firmador.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Firmador electrónico"
      className="fixed inset-0 z-50 flex items-end justify-center bg-azul-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl border border-borde-sutil bg-superficie p-5 shadow-2xl sm:rounded-2xl">
        {/* Cabecera del proveedor: lo primero que se tiene que entender es que
            esta ventana no es la del portal. */}
        <header className="flex flex-col gap-1 border-b border-borde-sutil pb-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
              Firmador electrónico
            </p>
            <span className="rounded-full bg-naranja-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-naranja-900 uppercase dark:bg-naranja-950 dark:text-naranja-200">
              Simulado
            </span>
          </div>
          <p className="text-xs text-cuerpo">
            En el servicio real esta ventana la sirve el proveedor de firma en su propio sitio, y
            se llega por el enlace que te enviamos. El código no pasa por {nombrePortal()}.
          </p>
          <p className="font-mono text-[11px] text-etiqueta">ID {idCode100}</p>
        </header>

        {paso === "ABRIENDO" && !error ? (
          <p role="status" className="text-sm font-semibold text-cuerpo">
            Abriendo el acto de firma…
          </p>
        ) : null}

        {paso === "FIRMADO" ? (
          <p role="status" className="text-sm font-semibold text-verde-700 dark:text-verde-300">
            Firma registrada. Volvé a {nombrePortal()} para ver la confirmación.
          </p>
        ) : null}

        {paso === "RECHAZADA" ? (
          <p role="status" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            Rechazaste la firma. Los documentos quedaron sin firmar y podés pedir un enlace nuevo
            desde {nombrePortal()}.
          </p>
        ) : null}

        {(paso === "CODIGO" || paso === "FIRMANDO") && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-cuerpo">
                Ingresá el código de 6 dígitos que enviamos a{" "}
                <span className="font-semibold text-titulo">{destino}</span> para firmar la
                Solicitud y el FIPF en un solo acto.
              </p>
              <p className="text-xs text-etiqueta">
                Vigencia de 5 minutos, un solo uso y hasta 3 intentos.
              </p>
            </div>

            <CamposOtp
              valor={codigo}
              onChange={setCodigo}
              onCompleto={firmar}
              deshabilitado={paso === "FIRMANDO"}
              etiqueta="Código de firma"
              idPrefijo="p8-firma"
              conError={error !== null}
            />

            <button
              type="button"
              onClick={() => firmar(codigo)}
              disabled={codigo.length !== LONGITUD_CODIGO_OTP || paso === "FIRMANDO"}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:bg-superficie-suave disabled:text-etiqueta"
            >
              {paso === "FIRMANDO" ? "Firmando…" : "Firmar los dos documentos"}
            </button>

            {/* Rechazar sí es una acción real del firmador: la persona abre el
                enlace y decide no firmar. Va acá, con peso visual de acción
                secundaria. */}
            <button
              type="button"
              onClick={rechazar}
              disabled={paso === "FIRMANDO"}
              className="self-center text-sm font-semibold text-rojo-700 underline decoration-rojo-300 underline-offset-2 hover:text-rojo-900 disabled:opacity-50 dark:text-rojo-300 dark:decoration-rojo-600"
            >
              No firmar y rechazar
            </button>

            {/* Esto NO es del firmador: es una palanca de demostración, y por
                eso va separada, rotulada y con borde punteado. Un botón que
                inyecta una falla no puede parecerse a uno que la persona
                usaría. */}
            <label className="flex items-start gap-2.5 rounded-lg border border-dashed border-borde-sutil bg-superficie-suave px-3 py-2.5 text-xs text-cuerpo">
              <input
                type="checkbox"
                checked={cortarSellado}
                onChange={(evento) => setCortarSellado(evento.target.checked)}
                disabled={paso === "FIRMANDO"}
                className="mt-0.5 h-4 w-4 shrink-0 accent-naranja-500"
              />
              <span>
                <span className="block font-bold tracking-wide text-etiqueta uppercase">
                  Solo demostración
                </span>
                Cortar el sellado a la mitad. Sirve para mostrar la regla atómica: la firma falla y
                los <strong>dos</strong> documentos quedan sin firmar, nunca uno solo. Se consume en
                un intento.
              </span>
            </label>
          </div>
        )}

        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={alCerrar}
          className="self-center text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
        >
          Cerrar la ventana del firmador
        </button>
      </div>
    </div>
  );
}
