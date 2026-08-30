"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CamposOtp } from "@/components/shared";

/**
 * El acto de firma, pedido **en esta pantalla** con un código de un solo uso.
 *
 * ## Por qué reemplazó al enlace
 *
 * Hasta el 21-ago-2026 el paso 6 mandaba un enlace al canal verificado y la
 * persona firmaba del otro lado. Eso tenía dos problemas, y el segundo es el
 * que lo condenó:
 *
 * 1. **El enlace no se enviaba.** El proveedor de firma es un mock y su
 *    `iniciarFirma` no hace una sola llamada de red. La pantalla anunciaba un
 *    envío que no ocurría, y alguien esperó ese correo dos veces.
 * 2. **El canal quedaba clavado.** Apenas se pedía el enlace, los radios se
 *    deshabilitaban y no había forma de descartar el acto: para cambiar de
 *    canal había que rechazar la firma desde el panel de demostración o esperar
 *    24 horas a que el enlace venciera.
 *
 * Andres decidió quitar ese botón y pedir directamente el código, que **sí**
 * llega de verdad por WhatsApp. Con eso el problema 2 desaparece por
 * construcción: no queda ningún acto abierto esperando a que alguien vuelva de
 * otro lado.
 *
 * ## Lo que no cambió
 *
 * El código lo sigue emitiendo y validando el proveedor simulado, con las
 * mismas reglas que los otros OTP del flujo: 6 dígitos, uso único, cinco
 * minutos, tres intentos. **Esta pantalla nunca lo ve** (regla inviolable #2):
 * lo recibe tipeado y lo manda a verificar. Y no firma por su cuenta — quien
 * confirma la firma es el proveedor, y el sondeo de la pantalla padre es el que
 * se entera.
 *
 * ## Solo demostración
 *
 * Pedir el código dentro del portal es una simplificación del demo: en el
 * servicio real el tercer OTP no pasa por SeguroLoTengo. Por eso este bloque
 * solo se monta con `DEMO_MODE`, y el endpoint que usa es una extensión
 * `route.demo.ts` que ni siquiera se compila con el flag apagado.
 */

/**
 * Los motivos son **los que el servidor devuelve de verdad**, no los que uno
 * supondría.
 *
 * La primera versión de este mapa inventó nombres razonables —`CODIGO_INVALIDO`,
 * `CODIGO_EXPIRADO`— y de los ocho que existen solo acertó dos: todo lo demás
 * caía en el genérico *"No pudimos procesar el pedido"*, que no le dice a nadie
 * qué hacer. Salieron de `ResultadoFirmaDemo` y `ResultadoAperturaDemo` en
 * `adapters/mock/signature-provider.ts`, más los que agrega el propio Route
 * Handler.
 *
 * Todos terminan diciendo **qué hacer**, y en los casos que se arreglan pidiendo
 * otro código lo dicen con esas palabras, porque el botón está ahí al lado.
 */
const MENSAJES: Readonly<Record<string, string>> = {
  // --- Al pedir el código (ABRIR) ---
  NO_ENCONTRADA: "No encontramos tu acto de firma. Recargá la pantalla para empezarlo de nuevo.",
  EXPIRADA: "El acto de firma venció. Recargá la pantalla para empezar uno nuevo.",
  ERROR_ENVIO: "No pudimos enviarte el código. Probá pedir uno nuevo en unos segundos.",

  // --- Al firmar (FIRMAR) ---
  CODIGO_INCORRECTO: "El código no coincide. Revisalo y volvé a escribirlo.",
  OTP_EXPIRADO: "El código venció: dura cinco minutos. Pedí uno nuevo con el botón de acá abajo.",
  INTENTOS_AGOTADOS: "Se agotaron los intentos con ese código. Pedí uno nuevo para seguir.",
  ENLACE_NO_ABIERTO: "Todavía no hay un código emitido. Pedí uno nuevo con el botón de acá abajo.",
  ENLACE_EXPIRADO: "El acto de firma venció. Recargá la pantalla para empezar uno nuevo.",
  YA_CERRADA: "Este acto de firma ya se cerró. Recargá la pantalla para ver cómo quedó.",
  FALLA_DEL_PROVEEDOR: "El servicio de firma no respondió. Pedí un código nuevo e intentá otra vez.",

  // --- Del Route Handler ---
  FIRMA_NO_INICIADA: "Todavía no hay un acto de firma abierto. Recargá la pantalla.",
  CODIGO_REQUERIDO: "Escribí los seis dígitos del código.",
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  EXPEDIENTE_NO_ENCONTRADO:
    "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  PEDIDO_INVALIDO: "No pudimos procesar el pedido. Pedí un código nuevo e intentá otra vez.",
  NO_DISPONIBLE: "Esta acción no está disponible en este entorno.",
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};

interface RespuestaFirmador {
  readonly ok?: boolean;
  readonly motivo?: string;
  /** Lo manda el servidor con `CODIGO_INCORRECTO`; saberlo cambia qué hacer. */
  readonly intentosRestantes?: number;
}

export function BloqueOtpFirma({
  idCode100,
  destino,
  alFirmar,
}: {
  readonly idCode100: string;
  /** Canal y destino enmascarado, para decir a dónde fue el código. */
  readonly destino: string;
  /** La firma quedó registrada del lado del proveedor. */
  readonly alFirmar: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [emitiendo, setEmitiendo] = useState(true);
  const [firmando, setFirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vigente = useRef(true);

  useEffect(() => {
    vigente.current = true;
    return () => {
      vigente.current = false;
    };
  }, []);

  const pedir = useCallback(
    async (accion: "ABRIR" | "FIRMAR", codigoTipeado?: string): Promise<RespuestaFirmador> => {
      const respuesta = await fetch("/api/p8/firmador-simulado", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // No viaja `idCode100`: el servidor lo saca del expediente de la
        // sesión. Es lo que hace que un pedido solo pueda afectar al trámite
        // de quien lo manda.
        body: JSON.stringify({ accion, ...(codigoTipeado ? { codigo: codigoTipeado } : {}) }),
      });
      return (await respuesta.json().catch(() => ({}))) as RespuestaFirmador;
    },
    [],
  );

  /** Emite el código apenas el acto existe, y al pedir uno nuevo. */
  const emitir = useCallback(async () => {
    setEmitiendo(true);
    setError(null);
    setCodigo("");
    try {
      const datos = await pedir("ABRIR");
      if (!vigente.current) return;
      if (!datos.ok) setError(MENSAJES[datos.motivo ?? ""] ?? MENSAJES.CUERPO_INVALIDO);
    } catch {
      if (vigente.current) setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      if (vigente.current) setEmitiendo(false);
    }
  }, [pedir]);

  useEffect(() => {
    void emitir();
  }, [emitir, idCode100]);

  /**
   * `codigoTipeado` entra por parámetro y no se lee del estado a propósito.
   *
   * `onCompleto` de `CamposOtp` se dispara en el mismo tick en que se escribe
   * el sexto dígito, así que el `codigo` del estado todavía tiene cinco: leerlo
   * de ahí hacía que la firma por autocompletado no hiciera **nada**, sin
   * mensaje —la guarda de longitud cortaba en silencio—. Con el botón sí
   * andaba, que es lo que hacía al síntoma confuso.
   */
  async function firmar(codigoTipeado: string) {
    if (codigoTipeado.length !== 6 || firmando) return;
    setFirmando(true);
    setError(null);
    try {
      const datos = await pedir("FIRMAR", codigoTipeado);
      if (!vigente.current) return;
      if (!datos.ok) {
        const base = MENSAJES[datos.motivo ?? ""] ?? MENSAJES.CUERPO_INVALIDO;
        // Cuántos intentos quedan es la diferencia entre volver a probar con
        // calma y quedarse sin código sin haberlo visto venir.
        const restantes =
          datos.intentosRestantes !== undefined && datos.intentosRestantes > 0
            ? ` Te ${datos.intentosRestantes === 1 ? "queda 1 intento" : `quedan ${datos.intentosRestantes} intentos`}.`
            : "";
        setError(`${base}${restantes}`);
        setCodigo("");
        return;
      }
      alFirmar();
    } catch {
      if (vigente.current) setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      if (vigente.current) setFirmando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-naranja-400 bg-naranja-50 px-4 py-3.5 dark:border-naranja-600 dark:bg-naranja-950">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[11px] font-bold tracking-wide text-naranja-900 uppercase dark:text-naranja-200">
          Código para firmar
        </h3>
        <p className="text-sm text-naranja-900 dark:text-naranja-100">
          {emitiendo
            ? "Generando el código…"
            : `Te enviamos un código de 6 dígitos a ${destino}. Escribilo acá para firmar.`}
        </p>
      </div>

      <CamposOtp
        valor={codigo}
        onChange={setCodigo}
        onCompleto={(valor) => void firmar(valor)}
        deshabilitado={emitiendo || firmando}
        etiqueta="Código para firmar"
        idPrefijo="p8-otp"
        conError={error !== null}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void firmar(codigo)}
          disabled={codigo.length !== 6 || emitiendo || firmando}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {firmando ? "Firmando…" : "Firmar"}
        </button>
        <button
          type="button"
          onClick={() => void emitir()}
          disabled={emitiendo || firmando}
          className="text-xs font-semibold text-azul-700 underline underline-offset-2 disabled:opacity-40 dark:text-azul-300"
        >
          Pedir un código nuevo
        </button>
      </div>

      {/* El mensaje va acá, pegado a los campos y al botón que lo produce: es
          la regla de esta pantalla y de todas — el error aparece donde está la
          acción, no al final de la columna. */}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rojo-300 bg-rojo-50 px-3 py-2 text-sm font-semibold text-rojo-800 dark:border-rojo-700 dark:bg-rojo-950 dark:text-rojo-300"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
