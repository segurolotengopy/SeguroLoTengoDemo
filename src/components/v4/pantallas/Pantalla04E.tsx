"use client";

/**
 * 04E · Revisá, aceptá y firmá. Etapa 4 de 5.
 *
 * **Sin arte aprobado ni candidato** (handoff v4, 14-sep-2026): el manual
 * funcional la deja pendiente. Este componente es una extrapolación
 * provisional del sistema de las pantallas aprobadas —el patrón de código de
 * un solo uso de 03A, la estructura de aviso/sección de 04D— y se reemplaza
 * en cuanto Interseguros mande el arte definitivo.
 *
 * Reproduce, sobre las piezas de v4, la misma lógica que ya construyó el
 * flujo v3 en `FirmaInternaV3.tsx`: el paquete se cierra al pedir el resumen
 * (`GET /api/p8/resumen`, que transiciona `DECLARACIONES_OK → PAQUETE_GENERADO`
 * si hace falta) y el cliente firma con un código de un solo uso enviado a un
 * canal ya verificado (`src/domain/firma-cliente.ts`, D1). Con eso el
 * expediente queda en `FIRMADO_CLIENTE`, que **ya habilita el pago** (D-08
 * enmendada el 04-sep-2026, D-38): la firma cualificada de Interseguros se
 * aplica después del cobro, dentro de 24/48 h operativas, y Alianza no firma
 * la propuesta (D-42). Por eso esta pantalla no sondea ninguna firma
 * institucional: firmado el cliente, sigue el pago.
 *
 * El código **nunca** se muestra ni se registra en un log del cliente (regla
 * inviolable #2): vive únicamente en el estado de `CamposOtpV4` hasta que se
 * envía a verificar.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CanalFirma } from "@/domain/tipos";
import { TEXTOS_04E, huellaAbreviada, relojFirma } from "@/domain/v4/textos-firma";
import { MarcoV4 } from "../MarcoV4";
import { CamposOtpV4 } from "../CamposOtpV4";
import { BarraPlanV4 } from "../BarraPlanV4";
import {
  AvisoAzulV4,
  AvisoRojoV4,
  BotonPrincipalV4,
  BotonSecundarioV4,
  ErrorDeCampoV4,
  FranjaVerdeV4,
  IconoTildeDisco,
  IconoWhatsApp,
} from "../piezas";

// ---------------------------------------------------------------------------
// Ilustración propia (04E no tiene arte: ver cabecera del archivo)
// ---------------------------------------------------------------------------

const NAVY = "#071F78";
const ROJO = "#FF1721";

/**
 * Documento con una firma manuscrita roja y un sello con tilde.
 *
 * Misma gramática que el resto del set (`ilustraciones.tsx`): trazo navy de
 * 2,4 px sin relleno, acentos rojos, mancha ovalada azul clarísima de fondo y
 * un par de destellos. No se importa nada de `ilustraciones.tsx` porque sus
 * piezas (`Lienzo`, `Destellos`, `trazo`) son privadas de ese módulo.
 */
function Ilustracion04E({ tamano = 112, className }: { readonly tamano?: number; readonly className?: string }) {
  const trazo = { fill: "none", stroke: NAVY, strokeWidth: 2.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg
      viewBox="0 0 120 110"
      width={tamano}
      height={Math.round((tamano * 110) / 120)}
      className={className}
      role="img"
      aria-label="Revisá y firmá tu propuesta"
    >
      <ellipse cx="60" cy="58" rx="55" ry="45" fill="#EAF2FD" />
      <rect x="18" y="16" width="54" height="68" rx="5" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.4" />
      <path d="M28 30 h30 M28 40 h30 M28 50 h18" {...trazo} />
      <path
        d="M25 66 q5 -11 10 0 q5 11 10 0 q5 -11 10 0 q4 8 8 2"
        fill="none"
        stroke={ROJO}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M84 40 l16 5 v14 c0 10 -6 17 -16 21 c-10 -4 -16 -11 -16 -21 v-14 z" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M76 60 l5 5 l11 -11" fill="none" stroke={ROJO} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <g stroke={ROJO} strokeWidth="3" strokeLinecap="round">
        <path d="M92 14 l6 -9" />
        <path d="M103 17 l7 -7" />
      </g>
    </svg>
  );
}

function IconoCorreo({ tamano = 22 }: { readonly tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" className="shrink-0">
      <rect x="3" y="5.5" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 7 L12 13 L20 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tipos de la respuesta de los tres endpoints que consume esta pantalla
// ---------------------------------------------------------------------------

interface ResumenFirma {
  readonly estado: string;
  readonly numeroPropuesta: string | null;
  readonly documento: { readonly codigo: string; readonly version: number; readonly hashSha256: string };
  readonly canalWhatsappEnmascarado: string | null;
  readonly canalEmailEnmascarado: string | null;
}

interface RespuestaOtpFirma {
  readonly ok: boolean;
  readonly motivo?: string;
  readonly otpId?: string;
  readonly expiraEn?: string;
  readonly destinoEnmascarado?: string;
  readonly segundosRestantes?: number;
  readonly intentosRestantes?: number;
}

type ErrorFirma =
  | { readonly tipo: "ENVIO"; readonly texto: string }
  | { readonly tipo: "CODIGO"; readonly texto: string };

/** Cuenta atrás en segundos hacia un instante, o `null` si no hay ninguno. Igual criterio que 03A. */
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

export function Pantalla04E() {
  const router = useRouter();

  const [resumen, setResumen] = useState<ResumenFirma | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);

  const [canal, setCanal] = useState<CanalFirma | null>(null);
  const [otpId, setOtpId] = useState<string | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [expiraEn, setExpiraEn] = useState<number | null>(null);
  const [reenvioHasta, setReenvioHasta] = useState<number | null>(null);
  const [reenviado, setReenviado] = useState(false);
  const [codigoMuerto, setCodigoMuerto] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [error, setError] = useState<ErrorFirma | null>(null);

  const [firmadoCliente, setFirmadoCliente] = useState(false);
  const completadoRef = useRef(false);

  const segundosVencimiento = useCuentaAtras(expiraEn);
  const segundosReenvio = useCuentaAtras(reenvioHasta);
  const codigoVivo = expiraEn !== null && !codigoMuerto && (segundosVencimiento ?? 0) > 0;
  const vencido = expiraEn !== null && segundosVencimiento === 0 && !firmadoCliente;

  const cargarResumen = useCallback(async () => {
    setCargandoResumen(true);
    setErrorCarga(null);
    try {
      const respuesta = await fetch("/api/p8/resumen");
      const datos = (await respuesta.json()) as { ok?: boolean; resumen?: ResumenFirma };
      if (datos.ok && datos.resumen) {
        setResumen(datos.resumen);
      } else {
        setErrorCarga(TEXTOS_04E.errorEstadoInvalido);
      }
    } catch {
      setErrorCarga(TEXTOS_04E.errorConexion);
    } finally {
      setCargandoResumen(false);
    }
  }, []);

  useEffect(() => {
    void cargarResumen();
  }, [cargarResumen]);

  // El expediente ya avanzó más allá de esta pantalla: con la firma del
  // cliente registrada (`FIRMADO_CLIENTE`) el paso siguiente es el pago
  // (D-08 enmendada); `FIRMADO`, `PAGO_CONFIRMADO` y `EMITIDO` son momentos
  // posteriores al cobro. En ninguno hay nada que firmar acá.
  useEffect(() => {
    if (
      resumen &&
      ["FIRMADO_CLIENTE", "FIRMADO", "PAGO_CONFIRMADO", "EMITIDO"].includes(resumen.estado)
    ) {
      if (completadoRef.current) return;
      completadoRef.current = true;
      router.push("/pago");
    }
  }, [resumen, router]);

  function volverAElegirCanal() {
    setCanal(null);
    setOtpId(null);
    setDestino(null);
    setCodigo("");
    setExpiraEn(null);
    setReenvioHasta(null);
    setReenviado(false);
    setCodigoMuerto(false);
    setError(null);
  }

  async function enviarCodigo(canalElegido: CanalFirma) {
    const esReenvio = otpId !== null && canal === canalElegido;
    setEnviando(true);
    setError(null);
    setCodigoMuerto(false);
    try {
      const respuesta = await fetch("/api/p8/firma-interna/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aceptada: true, canal: canalElegido }),
      });
      const datos = (await respuesta.json()) as RespuestaOtpFirma;
      if (!datos.ok || !datos.otpId) {
        switch (datos.motivo) {
          case "REENVIO_BLOQUEADO":
            setReenvioHasta(Date.now() + (datos.segundosRestantes ?? 60) * 1000);
            return;
          case "CANAL_NO_VERIFICADO":
            setError({ tipo: "ENVIO", texto: TEXTOS_04E.errorCanalNoVerificado });
            return;
          case "PAQUETE_NO_CERRADO":
            setError({ tipo: "ENVIO", texto: TEXTOS_04E.errorPaqueteNoCerrado });
            return;
          case "ESTADO_INVALIDO":
            setError({ tipo: "ENVIO", texto: TEXTOS_04E.errorEstadoInvalido });
            return;
          default:
            setError({ tipo: "ENVIO", texto: TEXTOS_04E.errorEnvio });
            return;
        }
      }
      setCanal(canalElegido);
      setOtpId(datos.otpId);
      setDestino(datos.destinoEnmascarado ?? null);
      setExpiraEn(datos.expiraEn ? Date.parse(datos.expiraEn) : null);
      setReenvioHasta(Date.now() + 60_000);
      setReenviado(esReenvio);
      setCodigo("");
    } catch {
      setError({ tipo: "ENVIO", texto: TEXTOS_04E.errorConexion });
    } finally {
      setEnviando(false);
    }
  }

  const firmar = useCallback(
    async function firmar(codigoIngresado: string) {
      if (!otpId || !canal || codigoIngresado.length !== 6 || firmando) return;
      setFirmando(true);
      setError(null);
      try {
        const respuesta = await fetch("/api/p8/firma-interna/verificar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canal, otpId, codigo: codigoIngresado }),
        });
        const datos = (await respuesta.json()) as RespuestaOtpFirma;
        if (!datos.ok) {
          switch (datos.motivo) {
            case "CODIGO_INCORRECTO":
              setCodigo("");
              setError({
                tipo: "CODIGO",
                texto: TEXTOS_04E.errorCodigoIncorrecto(datos.intentosRestantes ?? 0),
              });
              return;
            case "INTENTOS_AGOTADOS":
              setCodigo("");
              setCodigoMuerto(true);
              setError({ tipo: "CODIGO", texto: TEXTOS_04E.errorIntentosAgotados });
              return;
            case "CODIGO_EXPIRADO":
              setCodigo("");
              setCodigoMuerto(true);
              setError({ tipo: "CODIGO", texto: TEXTOS_04E.errorVencido });
              return;
            case "CODIGO_YA_UTILIZADO":
            case "OTP_REEMPLAZADO":
            case "OTP_AJENO_AL_ACTO":
            case "OTP_NO_ENCONTRADO":
              setCodigo("");
              setCodigoMuerto(true);
              setError({ tipo: "CODIGO", texto: TEXTOS_04E.errorReemplazado });
              return;
            case "CANAL_NO_VERIFICADO":
              setError({ tipo: "ENVIO", texto: TEXTOS_04E.errorCanalNoVerificado });
              return;
            case "PAQUETE_NO_CERRADO":
              setError({ tipo: "ENVIO", texto: TEXTOS_04E.errorPaqueteNoCerrado });
              return;
            case "CONSTANCIA_NO_EMITIDA":
              setCodigo("");
              setCodigoMuerto(true);
              setError({ tipo: "CODIGO", texto: TEXTOS_04E.errorConstanciaNoEmitida });
              return;
            default:
              setError({ tipo: "ENVIO", texto: TEXTOS_04E.errorEstadoInvalido });
              return;
          }
        }
        // D-08 enmendada / D-38 (main #120): `FIRMADO_CLIENTE` ya habilita el
        // cobro. La firma cualificada de Interseguros se aplica **después**
        // del pago, así que no hay nada que esperar acá: se sigue al pago.
        if (completadoRef.current) return;
        completadoRef.current = true;
        setFirmadoCliente(true);
        router.push("/pago");
      } catch {
        setError({ tipo: "CODIGO", texto: TEXTOS_04E.errorConexion });
      } finally {
        setFirmando(false);
      }
    },
    [otpId, canal, firmando, router],
  );

  return (
    <MarcoV4 codigo="04E">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="v4-titular">
            {TEXTOS_04E.titulo}
            <br />
            <em>{TEXTOS_04E.tituloAcento}</em>
          </h1>
          <p className="v4-bajada mt-2">{TEXTOS_04E.bajada}</p>
        </div>
        <Ilustracion04E tamano={104} className="shrink-0" />
      </div>

      <BarraPlanV4 className="mt-4" />

      {!resumen ? (
        <div className="v4-tarjeta mt-4 p-4">
          {errorCarga ? (
            <>
              <AvisoRojoV4>{errorCarga}</AvisoRojoV4>
              <div className="mt-3">
                <BotonSecundarioV4 onClick={() => void cargarResumen()} disabled={cargandoResumen}>
                  {TEXTOS_04E.botonReintentar}
                </BotonSecundarioV4>
              </div>
            </>
          ) : (
            <p className="text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
              {TEXTOS_04E.preparandoDocumento}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Qué vas a firmar */}
          <section className="v4-tarjeta mt-4 p-4" aria-labelledby="bloque-documento">
            <h2
              id="bloque-documento"
              className="text-[1.0625rem] font-bold uppercase tracking-wide"
              style={{ color: "var(--v4-navy)" }}
            >
              {TEXTOS_04E.seccionDocumentoTitulo}
            </h2>
            <p className="mt-2 text-[0.9375rem] font-bold" style={{ color: "var(--v4-navy)" }}>
              {TEXTOS_04E.documentoNombre(resumen.documento.codigo)}
            </p>
            <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--v4-azul-apagado)" }}>
              {TEXTOS_04E.documentoDetalle(resumen.documento.version, huellaAbreviada(resumen.documento.hashSha256))}
            </p>
            <a
              href={`/api/p8/documento?codigo=${encodeURIComponent(resumen.documento.codigo)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="v4-enlace mt-2 inline-block text-[0.9375rem] font-bold uppercase"
            >
              {TEXTOS_04E.verPdf}
            </a>
          </section>

          <AvisoAzulV4 className="mt-3" titulo={TEXTOS_04E.avisoLegalidadTitulo}>
            {TEXTOS_04E.avisoLegalidad}
          </AvisoAzulV4>

          {firmadoCliente ? (
            <section className="mt-4">
              <div className="v4-aviso-verde flex flex-col items-center gap-2 px-4 py-8" role="status">
                <IconoTildeDisco tamano={44} />
                <p className="text-[1.125rem] font-bold">{TEXTOS_04E.firmadoTitulo}</p>
                <p className="text-[0.9375rem]">{TEXTOS_04E.firmadoSiguiente}</p>
              </div>
            </section>
          ) : (
            <>
              {/* Bloque 1 · canal */}
              <section className="v4-tarjeta mt-4 p-4" aria-labelledby="bloque-canal">
                <h2 id="bloque-canal" className="text-[1.25rem] font-bold" style={{ color: "var(--v4-navy)" }}>
                  {TEXTOS_04E.bloque1Titulo}
                </h2>

                {codigoVivo && destino ? (
                  <div className="mt-3">
                    <FranjaVerdeV4>
                      {reenviado ? TEXTOS_04E.codigoReenviado(destino) : TEXTOS_04E.codigoEnviado(destino)}
                    </FranjaVerdeV4>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-2.5">
                    {resumen.canalWhatsappEnmascarado ? (
                      <BotonPrincipalV4
                        onClick={() => void enviarCodigo("WHATSAPP")}
                        disabled={enviando}
                        cargando={enviando && canal === "WHATSAPP"}
                        icono={<IconoWhatsApp />}
                      >
                        {enviando && canal === "WHATSAPP"
                          ? TEXTOS_04E.botonEnviando
                          : TEXTOS_04E.botonEnviarWhatsapp(resumen.canalWhatsappEnmascarado)}
                      </BotonPrincipalV4>
                    ) : null}
                    {resumen.canalEmailEnmascarado ? (
                      <BotonSecundarioV4
                        onClick={() => void enviarCodigo("EMAIL")}
                        disabled={enviando}
                      >
                        <span className="flex items-center justify-center gap-2.5">
                          <IconoCorreo />
                          {enviando && canal === "EMAIL"
                            ? TEXTOS_04E.botonEnviando
                            : TEXTOS_04E.botonEnviarCorreo(resumen.canalEmailEnmascarado)}
                        </span>
                      </BotonSecundarioV4>
                    ) : null}
                  </div>
                )}

                {error?.tipo === "ENVIO" ? <AvisoRojoV4 className="mt-3">{error.texto}</AvisoRojoV4> : null}
              </section>

              {/* Bloque 2 · código */}
              {codigoVivo || codigoMuerto ? (
                <section className="v4-tarjeta mt-4 p-4" aria-labelledby="bloque-codigo">
                  <h2 id="bloque-codigo" className="text-[1.25rem] font-bold" style={{ color: "var(--v4-navy)" }}>
                    {TEXTOS_04E.bloque2Titulo}
                  </h2>

                  {codigoVivo && segundosVencimiento !== null ? (
                    <p
                      className="mt-3 text-[0.9375rem] font-bold"
                      style={{ color: segundosVencimiento === 0 ? "var(--v4-rojo)" : "var(--v4-navy)" }}
                    >
                      {TEXTOS_04E.venceEn(relojFirma(segundosVencimiento))}
                    </p>
                  ) : null}
                  {vencido ? (
                    <p className="mt-3 text-[0.9375rem] font-bold" style={{ color: "var(--v4-rojo)" }}>
                      {TEXTOS_04E.venceEn("00:00")}
                    </p>
                  ) : null}

                  <div className="mt-3">
                    <CamposOtpV4
                      valor={codigo}
                      alCambiar={setCodigo}
                      activo={codigoVivo}
                      deshabilitado={!codigoVivo || firmando}
                      atenuado={firmando}
                      alCompletar={firmar}
                    />
                  </div>

                  {error?.tipo === "CODIGO" ? <ErrorDeCampoV4>{error.texto}</ErrorDeCampoV4> : null}

                  <div className="mt-4">
                    <BotonPrincipalV4
                      onClick={() => void firmar(codigo)}
                      disabled={codigo.length !== 6 || !codigoVivo}
                      cargando={firmando}
                    >
                      {firmando ? TEXTOS_04E.botonFirmando : TEXTOS_04E.botonFirmar}
                    </BotonPrincipalV4>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-4 text-[0.9375rem]">
                    {(segundosReenvio ?? 0) > 0 ? (
                      <span style={{ color: "var(--v4-gris-texto)" }}>
                        {TEXTOS_04E.reenviarEn(relojFirma(segundosReenvio ?? 0))}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => canal && void enviarCodigo(canal)}
                        className="v4-enlace"
                      >
                        {TEXTOS_04E.reenviar}
                      </button>
                    )}

                    <span aria-hidden="true" className="h-4 w-px" style={{ background: "var(--v4-gris-borde)" }} />

                    <button type="button" onClick={volverAElegirCanal} className="v4-enlace">
                      {TEXTOS_04E.elegirOtroCanal}
                    </button>
                  </div>
                </section>
              ) : null}
            </>
          )}

          <AvisoRojoV4 className="mt-4" titulo={TEXTOS_04E.avisoCodigoTitulo}>
            {TEXTOS_04E.avisoCodigo}
          </AvisoRojoV4>

          <AvisoAzulV4 className="mt-3" titulo={TEXTOS_04E.avisoImportanteTitulo}>
            {TEXTOS_04E.avisoImportante}
          </AvisoAzulV4>
        </>
      )}
    </MarcoV4>
  );
}
