"use client";

/**
 * 03A · Verificación del número de WhatsApp. Etapa 2 de 5.
 *
 * Cubre **16 de los 18 artes** del grupo. Los dos que faltan son
 * `03A_10 · SMS disponible` y `03A_11 · Código SMS enviado`, que no se
 * implementan porque **no hay SMS** (D-44): la cadena es WhatsApp → reenvío
 * por WhatsApp → bloqueo temporal de 5 minutos, y no se le ofrece a nadie un
 * canal que no existe.
 *
 * El otro arte que no tiene disparador es `03A_14 · Número sin WhatsApp`: el
 * puerto `OtpProvider` no distingue «no tiene WhatsApp» de «no pudimos
 * enviar», así que ese caso cae en el error de envío. Inventar la distinción
 * sería afirmar algo que el proveedor no nos dice.
 *
 * Los tiempos salen del servidor, nunca de acá: `expiraEn` del envío y
 * `segundosRestantes` del rechazo por reenvío bloqueado. Un contador que
 * corriera solo en el navegador diría una cosa y el servidor otra.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TEXTOS_03A } from "@/domain/v4/textos-verificacion";
import { MarcoV4 } from "../MarcoV4";
import { CamposOtpV4 } from "../CamposOtpV4";
import { BarraPlanV4 } from "../BarraPlanV4";
import {
  AvisoAzulV4,
  AvisoRojoV4,
  BotonPrincipalV4,
  CasillaConsentimientoV4,
  ErrorDeCampoV4,
  FranjaVerdeV4,
  IconoTildeDisco,
  IconoWhatsApp,
} from "../piezas";
import { IlustracionWhatsApp } from "../ilustraciones";

/** Segundos → `MM:SS`. */
function reloj(segundos: number): string {
  const minutos = Math.floor(Math.max(segundos, 0) / 60);
  const resto = Math.max(segundos, 0) % 60;
  return `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

/** Cuenta atrás en segundos hacia un instante, o `null` si no hay ninguno. */
function useCuentaAtras(hasta: number | null): number | null {
  const [restante, setRestante] = useState<number | null>(null);

  useEffect(() => {
    if (hasta === null) {
      setRestante(null);
      return;
    }
    function tic() {
      setRestante(Math.max(0, Math.ceil((hasta! - Date.now()) / 1000)));
    }
    tic();
    const intervalo = setInterval(tic, 1000);
    return () => clearInterval(intervalo);
  }, [hasta]);

  return restante;
}

type ErrorOtp =
  | { readonly tipo: "NUMERO"; readonly texto: string }
  | { readonly tipo: "ENVIO"; readonly texto: string }
  | { readonly tipo: "CODIGO"; readonly texto: string }
  | { readonly tipo: "BLOQUEO"; readonly texto: string };

interface RespuestaOtp {
  readonly ok: boolean;
  readonly motivo?: string;
  readonly destinoEnmascarado?: string;
  readonly expiraEn?: string;
  readonly intentosRestantes?: number;
  readonly segundosRestantes?: number;
  readonly destino?: { readonly ruta: string };
}

export function Pantalla03A() {
  const router = useRouter();

  const [numero, setNumero] = useState("");
  const [autorizado, setAutorizado] = useState(false);
  const [codigo, setCodigo] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [verificado, setVerificado] = useState(false);

  const [destinoEnmascarado, setDestinoEnmascarado] = useState<string | null>(null);
  const [reenviado, setReenviado] = useState(false);
  const [expiraEn, setExpiraEn] = useState<number | null>(null);
  const [reenvioHasta, setReenvioHasta] = useState<number | null>(null);
  const [bloqueoHasta, setBloqueoHasta] = useState<number | null>(null);
  const [error, setError] = useState<ErrorOtp | null>(null);
  const [codigoMuerto, setCodigoMuerto] = useState(false);

  const segundosVencimiento = useCuentaAtras(expiraEn);
  const segundosReenvio = useCuentaAtras(reenvioHasta);
  const segundosBloqueo = useCuentaAtras(bloqueoHasta);

  const codigoVivo = expiraEn !== null && !codigoMuerto && (segundosVencimiento ?? 0) > 0;
  const bloqueado = (segundosBloqueo ?? 0) > 0;

  // El vencimiento del código es un hecho del servidor, pero la pantalla tiene
  // que dejar de aceptar dígitos en el mismo instante en que llega a cero.
  const vencido = expiraEn !== null && segundosVencimiento === 0 && !verificado;

  const numeroNormalizado = numero.replace(/\D/g, "");
  const puedeEnviar = numeroNormalizado.length === 9 && autorizado && !bloqueado;

  function guardarRechazo(datos: RespuestaOtp, contexto: "envio" | "verificacion") {
    switch (datos.motivo) {
      case "DESTINO_INVALIDO":
        setError({ tipo: "NUMERO", texto: TEXTOS_03A.errorNumeroInvalido });
        return;
      case "DEMASIADOS_INTENTOS":
        setBloqueoHasta(Date.now() + (datos.segundosRestantes ?? 300) * 1000);
        setError({ tipo: "BLOQUEO", texto: "" });
        return;
      case "REENVIO_BLOQUEADO":
        setReenvioHasta(Date.now() + (datos.segundosRestantes ?? 60) * 1000);
        return;
      case "CODIGO_INCORRECTO":
        setCodigo("");
        setError({
          tipo: "CODIGO",
          texto: TEXTOS_03A.errorCodigoIncorrecto(datos.intentosRestantes ?? 0),
        });
        return;
      case "INTENTOS_AGOTADOS":
        setCodigo("");
        setCodigoMuerto(true);
        setError({ tipo: "CODIGO", texto: TEXTOS_03A.errorIntentosAgotados });
        return;
      case "EXPIRADO":
        setCodigo("");
        setCodigoMuerto(true);
        setError({ tipo: "CODIGO", texto: TEXTOS_03A.errorVencido });
        return;
      case "ESTADO_INVALIDO":
        // El expediente ya avanzó: se lo lleva, no se le explica.
        if (datos.destino?.ruta) router.push(datos.destino.ruta);
        return;
      default:
        setError({
          tipo: contexto === "envio" ? "ENVIO" : "CODIGO",
          texto: TEXTOS_03A.errorEnvio,
        });
    }
  }

  async function enviar() {
    if (!puedeEnviar) return;
    setEnviando(true);
    setError(null);
    setCodigoMuerto(false);
    try {
      const respuesta = await fetch("/api/p1/otp/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: numeroNormalizado, autorizacionAceptada: autorizado }),
      });
      const datos = (await respuesta.json()) as RespuestaOtp;
      if (!datos.ok) {
        guardarRechazo(datos, "envio");
        return;
      }
      setDestinoEnmascarado(datos.destinoEnmascarado ?? null);
      setExpiraEn(datos.expiraEn ? Date.parse(datos.expiraEn) : null);
      setReenvioHasta(Date.now() + 60_000);
      setReenviado(false);
      setCodigo("");
    } catch {
      setError({ tipo: "ENVIO", texto: TEXTOS_03A.errorEnvio });
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    setError(null);
    setCodigoMuerto(false);
    try {
      const respuesta = await fetch("/api/p1/otp/reenviar", { method: "POST" });
      const datos = (await respuesta.json()) as RespuestaOtp;
      if (!datos.ok) {
        guardarRechazo(datos, "envio");
        return;
      }
      setDestinoEnmascarado(datos.destinoEnmascarado ?? destinoEnmascarado);
      setExpiraEn(datos.expiraEn ? Date.parse(datos.expiraEn) : null);
      setReenvioHasta(Date.now() + 60_000);
      setReenviado(true);
      setCodigo("");
    } catch {
      setError({ tipo: "ENVIO", texto: TEXTOS_03A.errorEnvio });
    }
  }

  const verificar = useCallback(
    async function verificar(codigoIngresado: string) {
      if (codigoIngresado.length !== 6 || verificando) return;
      setVerificando(true);
      setError(null);
      try {
        const respuesta = await fetch("/api/p1/otp/verificar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo: codigoIngresado }),
        });
        const datos = (await respuesta.json()) as RespuestaOtp;
        if (!datos.ok) {
          guardarRechazo(datos, "verificacion");
          return;
        }
        setVerificado(true);
        setTimeout(() => router.push("/preparacion"), 900);
      } catch {
        setError({ tipo: "CODIGO", texto: TEXTOS_03A.errorEnvio });
      } finally {
        setVerificando(false);
      }
    },
    // `guardarRechazo` y `router` son estables dentro de la vida de la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verificando],
  );

  // Editar el número vuelve al estado inicial del bloque 2, como en el arte:
  // el código que había deja de servir.
  const editarNumero = useRef<HTMLInputElement | null>(null);
  function volverAEditar() {
    setExpiraEn(null);
    setReenvioHasta(null);
    setCodigo("");
    setCodigoMuerto(false);
    setReenviado(false);
    setDestinoEnmascarado(null);
    setError(null);
    editarNumero.current?.focus();
  }

  return (
    <MarcoV4 codigo="03A">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="v4-titular">
            {TEXTOS_03A.titulo}
            <br />
            <em>{TEXTOS_03A.tituloAcento}</em>
          </h1>
          <p className="v4-bajada mt-2">{TEXTOS_03A.bajada}</p>
        </div>
        <IlustracionWhatsApp tamano={112} className="shrink-0" />
      </div>

      <BarraPlanV4 className="mt-4" />

      {/* Bloque 1 · el número y la autorización */}
      <section className="v4-tarjeta mt-4 p-4" aria-labelledby="bloque-numero">
        <h2 id="bloque-numero" className="text-[1.25rem] font-bold" style={{ color: "var(--v4-navy)" }}>
          {TEXTOS_03A.bloque1Titulo}
        </h2>

        <div className="mt-3 flex gap-3">
          <div className="w-[43%]">
            <span className="v4-etiqueta">{TEXTOS_03A.etiquetaPais}</span>
            <div className="v4-campo v4-campo-bloqueado flex items-center gap-2" style={{ paddingRight: "0.75rem" }}>
              <span aria-hidden="true">🇵🇾</span>
              <span className="truncate text-[0.9375rem]">{TEXTOS_03A.valorPais}</span>
            </div>
          </div>
          <div className="flex-1">
            <label htmlFor="numero-whatsapp" className="v4-etiqueta">
              {TEXTOS_03A.etiquetaNumero}
            </label>
            <input
              id="numero-whatsapp"
              ref={editarNumero}
              value={numero}
              onChange={(evento) => {
                setNumero(evento.target.value);
                if (error?.tipo === "NUMERO") setError(null);
              }}
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={11}
              placeholder={TEXTOS_03A.marcadorNumero}
              disabled={codigoVivo || verificado}
              aria-invalid={error?.tipo === "NUMERO" ? true : undefined}
              className={`v4-campo ${error?.tipo === "NUMERO" ? "v4-campo-error" : ""}`}
              style={{ paddingRight: "0.75rem" }}
            />
          </div>
        </div>
        {error?.tipo === "NUMERO" ? <ErrorDeCampoV4>{error.texto}</ErrorDeCampoV4> : null}

        <div className="mt-4">
          <CasillaConsentimientoV4
            marcada={autorizado}
            alCambiar={setAutorizado}
            id="autorizacion-whatsapp"
          >
            {TEXTOS_03A.consentimiento}
          </CasillaConsentimientoV4>
        </div>

        {/* Con el código ya enviado, el botón se reemplaza por la franja verde
            que confirma a qué número salió — y no se puede volver a enviar sin
            editar el número, que es lo que hace el arte. */}
        {codigoVivo && destinoEnmascarado ? (
          <div className="mt-4">
            <FranjaVerdeV4>
              {reenviado
                ? TEXTOS_03A.codigoReenviado(destinoEnmascarado)
                : TEXTOS_03A.codigoEnviado(destinoEnmascarado)}
            </FranjaVerdeV4>
          </div>
        ) : (
          <div className="mt-4">
            <BotonPrincipalV4
              onClick={enviar}
              disabled={!puedeEnviar || verificado}
              cargando={enviando}
              icono={<IconoWhatsApp />}
            >
              {enviando ? TEXTOS_03A.botonEnviando : TEXTOS_03A.botonEnviar}
            </BotonPrincipalV4>
          </div>
        )}

        {error?.tipo === "ENVIO" ? (
          <AvisoRojoV4 className="mt-3">{error.texto}</AvisoRojoV4>
        ) : null}
      </section>

      {/* Bloque 2 · el código */}
      <section className="v4-tarjeta mt-4 p-4" aria-labelledby="bloque-codigo">
        <h2 id="bloque-codigo" className="text-[1.25rem] font-bold" style={{ color: "var(--v4-navy)" }}>
          {TEXTOS_03A.bloque2Titulo}
        </h2>

        {verificado ? (
          <div className="v4-aviso-verde mt-4 flex flex-col items-center gap-2 px-4 py-8" role="status">
            <IconoTildeDisco tamano={44} />
            <p className="text-[1.25rem] font-bold">{TEXTOS_03A.verificado}</p>
            <p className="text-[1rem]">{TEXTOS_03A.continuando}</p>
          </div>
        ) : (
          <>
            {bloqueado ? (
              <AvisoRojoV4 className="mt-3">
                {TEXTOS_03A.errorBloqueo(reloj(segundosBloqueo ?? 0))}
              </AvisoRojoV4>
            ) : null}

            {codigoVivo && segundosVencimiento !== null ? (
              <p
                className="mt-3 text-[0.9375rem] font-bold"
                style={{ color: segundosVencimiento === 0 ? "var(--v4-rojo)" : "var(--v4-navy)" }}
              >
                {TEXTOS_03A.venceEn(reloj(segundosVencimiento))}
              </p>
            ) : null}
            {vencido ? (
              <p className="mt-3 text-[0.9375rem] font-bold" style={{ color: "var(--v4-rojo)" }}>
                {TEXTOS_03A.venceEn("00:00")}
              </p>
            ) : null}

            <div className="mt-3">
              <CamposOtpV4
                valor={codigo}
                alCambiar={setCodigo}
                activo={codigoVivo && !bloqueado}
                deshabilitado={!codigoVivo || bloqueado || verificando}
                atenuado={verificando}
                alCompletar={verificar}
              />
            </div>

            {error?.tipo === "CODIGO" ? (
              <p className="v4-error-campo mt-2" role="alert">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="shrink-0">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="var(--v4-rojo)" strokeWidth="1.8" />
                  <path d="M6.5 17.5 L17.5 6.5" stroke="var(--v4-rojo)" strokeWidth="1.8" />
                </svg>
                {error.texto}
              </p>
            ) : null}

            <div className="mt-4">
              <BotonPrincipalV4
                onClick={() => verificar(codigo)}
                disabled={codigo.length !== 6 || !codigoVivo || bloqueado}
                cargando={verificando}
              >
                {verificando ? TEXTOS_03A.botonVerificando : TEXTOS_03A.botonVerificar}
              </BotonPrincipalV4>
            </div>

            <div className="mt-4 flex items-center justify-center gap-4 text-[0.9375rem]">
              {(segundosReenvio ?? 0) > 0 ? (
                <span style={{ color: "var(--v4-gris-texto)" }}>
                  {TEXTOS_03A.reenviarEn(reloj(segundosReenvio ?? 0))}
                </span>
              ) : expiraEn !== null && !bloqueado ? (
                <button type="button" onClick={reenviar} className="v4-enlace">
                  {TEXTOS_03A.reenviar}
                </button>
              ) : (
                <span style={{ color: "var(--v4-gris-texto)" }}>{TEXTOS_03A.reenviar}</span>
              )}

              <span aria-hidden="true" className="h-4 w-px" style={{ background: "var(--v4-gris-borde)" }} />

              {expiraEn !== null && !bloqueado ? (
                <button type="button" onClick={volverAEditar} className="v4-enlace">
                  {TEXTOS_03A.editarNumero}
                </button>
              ) : (
                <span style={{ color: "var(--v4-gris-texto)" }}>{TEXTOS_03A.editarNumero}</span>
              )}
            </div>
          </>
        )}
      </section>

      <AvisoRojoV4 className="mt-4" titulo={TEXTOS_03A.avisoCodigoTitulo}>
        {TEXTOS_03A.avisoCodigo}
      </AvisoRojoV4>

      <AvisoAzulV4 className="mt-3" titulo={TEXTOS_03A.avisoImportanteTitulo}>
        {TEXTOS_03A.avisoImportante}
      </AvisoAzulV4>
    </MarcoV4>
  );
}
