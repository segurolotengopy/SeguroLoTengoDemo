"use client";

/**
 * El acto de firma INTERNO del cliente en la página del paso 3 (lote F4b;
 * D1 ratificada el 30-ago-2026).
 *
 * Recorrido: resumen del paquete cerrado (`GET /api/p8/resumen`, que además lo
 * genera si el expediente viene de las declaraciones) → aceptación agrupada 3
 * (DI-8) → elección de canal (DI-5) → código de un solo uso → firma del
 * cliente (`FIRMADO_CLIENTE`) → sondeo de las institucionales
 * (`GET /api/p8/estado`, el mismo de siempre) → `FIRMADO` y `onCompletado`.
 *
 * Ninguna parte nombra proveedor: el código lo emite y verifica el portal.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CamposOtp } from "@/components/shared";
import type { CanalFirma } from "@/domain/tipos";
import {
  AVISO_CANAL_FIRMA,
  ESPERANDO_INSTITUCIONALES,
  INTRO_CANAL_FIRMA,
  INTRO_FIRMA,
  ITEMS_ACEPTACION_FIRMA,
  NOTA_QUE_ES_FIPF,
  ROTULO_ACEPTACION_FIRMA,
  ROTULO_QUE_ES_FIPF,
} from "@/domain/textos-pago-firma";
import { ModalVisorPdf } from "../firma/ModalVisorPdf";

interface Resumen {
  estado: string;
  numeroPropuesta: string | null;
  documento: { codigo: string; codigoSeccionFipf: string; version: number; hashSha256: string };
  canalWhatsappEnmascarado: string | null;
  canalEmailEnmascarado: string | null;
  firmadoEn: string | null;
}

const MENSAJES: Readonly<Record<string, string>> = {
  ACEPTACION_REQUERIDA: "Marcá la aceptación de la propuesta para poder firmar.",
  CANAL_NO_VERIFICADO: "Ese canal no está verificado en tu trámite. Elegí el otro.",
  REENVIO_BLOQUEADO: "Esperá un momento antes de pedir otro código.",
  CODIGO_INCORRECTO: "El código no coincide. Revisalo e intentá de nuevo.",
  INTENTOS_AGOTADOS: "Se agotaron los intentos de este código. Pedí un código nuevo.",
  CODIGO_EXPIRADO: "El código venció. Pedí un código nuevo.",
  CODIGO_YA_UTILIZADO: "Ese código ya se usó. Pedí un código nuevo.",
  ESTADO_INVALIDO: "Tu trámite ya no está en este paso. Recargá la página para retomarlo.",
  PAQUETE_NO_CERRADO: "Los documentos todavía no están listos. Esperá unos segundos y recargá.",
};

export function FirmaInternaV3({ onCompletado }: { onCompletado: () => void }) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [aceptada, setAceptada] = useState(false);
  const [verItems, setVerItems] = useState(false);
  const [verFipf, setVerFipf] = useState(false);
  const [verPdf, setVerPdf] = useState(false);
  const [canal, setCanal] = useState<CanalFirma>("WHATSAPP");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [firmadoCliente, setFirmadoCliente] = useState(false);
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completadoRef = useRef(false);

  // El resumen genera el paquete si hace falta (DECLARACIONES_OK → PAQUETE_GENERADO).
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const respuesta = await fetch("/api/p8/resumen");
        const datos = (await respuesta.json()) as { ok?: boolean; resumen?: Resumen };
        if (cancelado) return;
        if (datos.ok && datos.resumen) {
          setResumen(datos.resumen);
          if (datos.resumen.estado === "FIRMADO_CLIENTE") setFirmadoCliente(true);
        } else {
          setError("No pudimos preparar tus documentos. Recargá la página para reintentar.");
        }
      } catch {
        if (!cancelado) setError("No pudimos conectarnos. Revisá tu conexión y recargá.");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // Con la firma del cliente hecha, el sondeo de siempre aplica las
  // institucionales (mock de Code100, cualificadas) y avisa cuando FIRMADO.
  const sondear = useCallback(async () => {
    try {
      const respuesta = await fetch("/api/p8/estado");
      const datos = (await respuesta.json()) as { ok?: boolean; firmado?: boolean };
      if (datos.ok && datos.firmado && !completadoRef.current) {
        completadoRef.current = true;
        onCompletado();
      }
    } catch {
      // El próximo tick reintenta.
    }
  }, [onCompletado]);

  useEffect(() => {
    if (!firmadoCliente) return;
    void sondear();
    const intervalo = setInterval(() => void sondear(), 2000);
    return () => clearInterval(intervalo);
  }, [firmadoCliente, sondear]);

  async function pedirCodigo(canalElegido: CanalFirma) {
    setEnProceso(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/p8/firma-interna/enviar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aceptada, canal: canalElegido }),
      });
      const datos = (await respuesta.json()) as {
        ok?: boolean;
        motivo?: string;
        otpId?: string;
        destinoEnmascarado?: string;
      };
      if (!datos.ok || !datos.otpId) {
        setError((datos.motivo && MENSAJES[datos.motivo]) ?? "No pudimos enviar el código. Intentá de nuevo.");
        return;
      }
      setCanal(canalElegido);
      setOtpId(datos.otpId);
      setDestino(datos.destinoEnmascarado ?? null);
      setCodigo("");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(false);
    }
  }

  async function firmar() {
    if (!otpId) return;
    setEnProceso(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/p8/firma-interna/verificar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ canal, otpId, codigo }),
      });
      const datos = (await respuesta.json()) as { ok?: boolean; motivo?: string };
      if (!datos.ok) {
        setError((datos.motivo && MENSAJES[datos.motivo]) ?? "No pudimos registrar tu firma. Intentá de nuevo.");
        if (
          datos.motivo === "INTENTOS_AGOTADOS" ||
          datos.motivo === "CODIGO_EXPIRADO" ||
          datos.motivo === "CODIGO_YA_UTILIZADO"
        ) {
          setOtpId(null);
          setCodigo("");
        }
        return;
      }
      setFirmadoCliente(true);
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(false);
    }
  }

  if (!resumen) {
    return (
      <p className="text-sm text-cuerpo">
        {error ?? "Preparando la Solicitud y el FIPF — cerramos el documento y registramos su huella…"}
      </p>
    );
  }

  if (firmadoCliente) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-verde-700 dark:text-verde-300">
          Tu firma quedó registrada{destino ? ` (código recibido en ${destino})` : ""}.
        </p>
        <p className="text-sm text-cuerpo">{ESPERANDO_INSTITUCIONALES}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-cuerpo">{INTRO_FIRMA}</p>

      <button
        type="button"
        onClick={() => setVerFipf((v) => !v)}
        className="self-start text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 dark:text-azul-200"
      >
        {verFipf ? "Ocultar el detalle" : ROTULO_QUE_ES_FIPF}
      </button>
      {verFipf ? <p className="rounded-lg bg-fondo p-3 text-xs text-cuerpo">{NOTA_QUE_ES_FIPF}</p> : null}

      <div className="flex flex-col gap-1 rounded-xl border border-borde-sutil p-3">
        <p className="text-sm font-bold text-titulo">
          Propuesta de Interseguros + FIPF · {resumen.documento.codigo}
        </p>
        <p className="text-xs text-etiqueta">
          PDF cerrado · huella SHA-256 registrada · art. 1556 del Código Civil
        </p>
        <button
          type="button"
          onClick={() => setVerPdf(true)}
          className="self-start text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 dark:text-azul-200"
        >
          Ver PDF
        </button>
      </div>

      {/* El canvas la pone dentro de un recuadro destacado con «* TE FALTA
          ESTO» mientras no esté marcada, y el enlace del detalle en la misma
          línea. Suelta, se leía como un click escondido (observación de
          Andres, 01-sep). */}
      <div
        data-falta={aceptada ? undefined : "1"}
        className="flex flex-col gap-2 rounded-xl border border-borde-sutil bg-superficie p-4"
      >
        <label className="flex items-start gap-2.5 text-sm text-cuerpo">
          <input
            type="checkbox"
            checked={aceptada}
            onChange={(evento) => setAceptada(evento.target.checked)}
            disabled={otpId !== null}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span>
            <span className="font-bold text-titulo">{ROTULO_ACEPTACION_FIRMA}</span>{" "}
            <button
              type="button"
              onClick={() => setVerItems((v) => !v)}
              className="font-semibold text-azul-700 underline underline-offset-2 dark:text-azul-300"
            >
              {verItems ? "Ocultar el detalle" : "Ver todo lo que aceptás"}
            </button>
          </span>
        </label>
        {verItems ? (
          <ol className="ml-7 flex list-decimal flex-col gap-1.5 text-xs text-cuerpo">
            {ITEMS_ACEPTACION_FIRMA.map((item) => (
              <li key={item.slice(0, 40)}>{item}</li>
            ))}
          </ol>
        ) : null}
      </div>
      {otpId === null ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-cuerpo">{INTRO_CANAL_FIRMA}</p>
          {/* Apilados y grandes, como el canvas: son la acción principal de
              la pantalla, no dos opciones chicas en una fila. */}
          <div className="flex flex-col gap-2.5">
            {resumen.canalWhatsappEnmascarado ? (
              <button
                type="button"
                disabled={!aceptada || enProceso}
                onClick={() => void pedirCodigo("WHATSAPP")}
                data-cta="Acá abajo pedís el enlace para firmar"
                className="btn btn-primary w-fit"
                style={{ borderRadius: "999px", padding: "14px 24px", fontSize: "15px" }}
              >
                Tocá acá para firmar por WhatsApp · {resumen.canalWhatsappEnmascarado}
              </button>
            ) : null}
            {resumen.canalEmailEnmascarado ? (
              <button
                type="button"
                disabled={!aceptada || enProceso}
                onClick={() => void pedirCodigo("EMAIL")}
                className="btn btn-secondary w-fit"
                style={{ borderRadius: "999px", padding: "14px 24px", fontSize: "15px" }}
              >
                Tocá acá para firmar por correo · {resumen.canalEmailEnmascarado}
              </button>
            ) : null}
          </div>
          <p className="text-xs text-etiqueta">{AVISO_CANAL_FIRMA}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-cuerpo">
            Te enviamos el código de firma{destino ? ` a ${destino}` : ""}. Escribilo para firmar
            el documento.
          </p>
          <CamposOtp
            valor={codigo}
            onChange={setCodigo}
            deshabilitado={enProceso}
            etiqueta="Código de firma"
            idPrefijo="firma-v3-otp"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={enProceso || codigo.replace(/\D/g, "").length < 6}
              onClick={() => void firmar()}
              className="h-11 rounded-lg bg-naranja-600 px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              Firmar el documento
            </button>
            <button
              type="button"
              disabled={enProceso}
              onClick={() => void pedirCodigo(canal)}
              className="self-center text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 dark:text-azul-200"
            >
              Pedir un código nuevo
            </button>
          </div>
        </div>
      )}

      {error ? <p className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">{error}</p> : null}

      {verPdf ? <ModalVisorPdf codigo={resumen.documento.codigo} alCerrar={() => setVerPdf(false)} /> : null}
    </div>
  );
}
