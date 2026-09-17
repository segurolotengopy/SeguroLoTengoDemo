"use client";

/**
 * 03C · Identidad y correo. Etapa 2 de 5.
 *
 * Cubre los estados alcanzables de los 26 del arte (§5.2 del análisis visual).
 * Los tres veredictos documentales que el proveedor no distingue —lado
 * incorrecto, documento no paraguayo, cédula vencida— y el de alteración
 * (D-46) **no se dibujan**: sus textos quedan en `textos-identidad.ts` con la
 * explicación.
 *
 * La cámara la maneja `CapturaConCamara`, el visor que ya existe: tiene
 * disparo automático, control de calidad y recorte, y rehacerlo para v4 habría
 * sido tirar lo único de esta pantalla que es difícil. Lo que falta portar es
 * su **piel**: sigue con el dibujo de v2 y el arte v4 la quiere en azul marino
 * con el marco punteado.
 *
 * **La carga de archivo del frente y del dorso es de producción** (D-46), no
 * una comodidad de demostración. La selfie sigue siendo solo cámara: es el
 * ancla biométrica y el único control que queda contra la suplantación.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { CapturaConCamara } from "@/app/(flujo)/identidad/CapturaConCamara";
// Desde `catalogo-identidad`, no desde `verificacion-identidad`: ese módulo
// importa `node:crypto` y arrastrarlo a una pantalla rompe el build del
// cliente. Es la razón por la que ese catálogo existe.
import type { TipoCapturaP5 } from "@/domain/catalogo-identidad";
import { INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA } from "@/domain/catalogo-identidad";
import { TEXTOS_03C } from "@/domain/v4/textos-identidad";
import { MarcoV4 } from "../MarcoV4";
import { BarraPlanV4 } from "../BarraPlanV4";
import { AccionesV4, CamposV4, DisposicionV4, EncabezadoV4 } from "../disposicion";
import {
  AvisoAzulV4,
  AvisoRojoV4,
  BotonPrincipalV4,
  BotonSecundarioV4,
  CampoTextoV4,
  ErrorDeCampoV4,
} from "../piezas";
import {
  IconoCarnetDorso,
  IconoCarnetFrente,
  IconoSelfie,
  IlustracionIdentidad,
} from "../ilustraciones";

/** El panel de prueba de vida arrastra ~289 kB: solo se carga si se usa. */
const PanelPruebaDeVida = dynamic(
  () => import("@/app/(flujo)/identidad/PanelPruebaDeVida").then((m) => m.PanelPruebaDeVida),
  { ssr: false },
);

const TIPOS: readonly TipoCapturaP5[] = ["FRENTE", "DORSO", "SELFIE"];
const ICONOS = { FRENTE: IconoCarnetFrente, DORSO: IconoCarnetDorso, SELFIE: IconoSelfie } as const;
const MAXIMO_ARCHIVO_BYTES = 20 * 1024 * 1024;
const TIPOS_ARCHIVO = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"];
const BLOQUEO_SEGUNDOS = 300;

type EstadoTarjeta = "PENDIENTE" | "PROCESANDO" | "VALIDADO" | "REVISAR";

type ClaveError = keyof typeof TEXTOS_03C.errores;

interface ErrorVisible {
  readonly clave: ClaveError;
  readonly tipo: TipoCapturaP5 | null;
  /** Texto que agregó el proveedor, cuando lo hay. */
  readonly detalle?: string | null;
  readonly intento?: number;
}

function reloj(segundos: number): string {
  const minutos = Math.floor(Math.max(segundos, 0) / 60);
  const resto = Math.max(segundos, 0) % 60;
  return `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

async function aBase64(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error("No se pudo leer el archivo"));
    lector.readAsDataURL(archivo);
  });
}

export function Pantalla03C({
  pruebaDeVidaEnVivoDisponible = false,
}: {
  readonly pruebaDeVidaEnVivoDisponible?: boolean;
}) {
  const router = useRouter();

  const [capturas, setCapturas] = useState<Partial<Record<TipoCapturaP5, string>>>({});
  const [estados, setEstados] = useState<Record<TipoCapturaP5, EstadoTarjeta>>({
    FRENTE: "PENDIENTE",
    DORSO: "PENDIENTE",
    SELFIE: "PENDIENTE",
  });
  const [intentos, setIntentos] = useState<Record<TipoCapturaP5, number>>({
    FRENTE: 0,
    DORSO: 0,
    SELFIE: 0,
  });

  const [camaraAbierta, setCamaraAbierta] = useState<TipoCapturaP5 | null>(null);
  const [sesionEnVivo, setSesionEnVivo] = useState<{ referencia: string; region: string } | null>(null);
  const [error, setError] = useState<ErrorVisible | null>(null);
  const [bloqueoHasta, setBloqueoHasta] = useState<number | null>(null);
  const [segundosBloqueo, setSegundosBloqueo] = useState(0);

  const [correo, setCorreo] = useState("");
  const [correoRepetido, setCorreoRepetido] = useState("");
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);

  const archivoFrente = useRef<HTMLInputElement | null>(null);
  const archivoDorso = useRef<HTMLInputElement | null>(null);

  const todasValidadas = TIPOS.every((tipo) => estados[tipo] === "VALIDADO");
  const bloqueado = segundosBloqueo > 0;

  useEffect(() => {
    if (bloqueoHasta === null) return;
    function tic() {
      const restante = Math.max(0, Math.ceil((bloqueoHasta! - Date.now()) / 1000));
      setSegundosBloqueo(restante);
      if (restante === 0) {
        setBloqueoHasta(null);
        setError(null);
        setIntentos({ FRENTE: 0, DORSO: 0, SELFIE: 0 });
      }
    }
    tic();
    const intervalo = setInterval(tic, 1000);
    return () => clearInterval(intervalo);
  }, [bloqueoHasta]);

  /** La tarjeta activa: la primera que todavía no está validada. */
  const tipoActivo = TIPOS.find((tipo) => estados[tipo] !== "VALIDADO") ?? null;

  function sumarIntento(tipo: TipoCapturaP5): number {
    const siguiente = intentos[tipo] + 1;
    setIntentos((previos) => ({ ...previos, [tipo]: siguiente }));
    if (siguiente >= INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA) {
      setBloqueoHasta(Date.now() + BLOQUEO_SEGUNDOS * 1000);
    }
    return siguiente;
  }

  async function enviarCaptura(
    tipo: TipoCapturaP5,
    imagen: string,
    origen: "CAMARA" | "ARCHIVO",
  ): Promise<{ ok: boolean; mensaje?: string }> {
    setEstados((previos) => ({ ...previos, [tipo]: "PROCESANDO" }));
    setError(null);
    try {
      const respuesta = await fetch("/api/p5/captura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, imagen, origen }),
      });
      const datos = (await respuesta.json()) as {
        ok: boolean;
        aprobada?: boolean;
        motivoRechazo?: string | null;
        pruebaDeVidaAprobada?: boolean | null;
        motivo?: string;
      };

      if (!datos.ok || datos.aprobada !== true) {
        const esSelfie = tipo === "SELFIE";
        const falloPruebaDeVida = esSelfie && datos.pruebaDeVidaAprobada === false;
        setEstados((previos) => ({ ...previos, [tipo]: "REVISAR" }));
        const intento = sumarIntento(tipo);
        setError({
          clave: falloPruebaDeVida ? "PRUEBA_DE_VIDA" : "CALIDAD",
          tipo,
          detalle: datos.motivoRechazo ?? null,
          intento,
        });
        return { ok: false, mensaje: datos.motivoRechazo ?? undefined };
      }

      setCapturas((previas) => ({ ...previas, [tipo]: imagen }));
      setEstados((previos) => ({ ...previos, [tipo]: "VALIDADO" }));
      return { ok: true };
    } catch {
      // Un fallo de red **no consume intento**: lo dice el propio arte 03C_24.
      setEstados((previos) => ({ ...previos, [tipo]: "PENDIENTE" }));
      setError({ clave: "ERROR_TECNICO", tipo });
      return { ok: false };
    }
  }

  async function elegirArchivo(tipo: TipoCapturaP5, archivo: File | undefined) {
    if (!archivo) return;
    if (!TIPOS_ARCHIVO.includes(archivo.type) || archivo.size > MAXIMO_ARCHIVO_BYTES) {
      // No consume intento: el archivo nunca llegó a analizarse.
      setError({ clave: "ARCHIVO_NO_ADMITIDO", tipo });
      return;
    }
    const imagen = await aBase64(archivo);
    await enviarCaptura(tipo, imagen, "ARCHIVO");
  }

  async function abrirCamara(tipo: TipoCapturaP5) {
    if (bloqueado) return;
    if (tipo === "SELFIE" && pruebaDeVidaEnVivoDisponible) {
      try {
        const respuesta = await fetch("/api/p5/liveness-sesion", { method: "POST" });
        const datos = (await respuesta.json()) as {
          ok: boolean;
          referencia?: string;
          region?: string;
        };
        if (datos.ok && datos.referencia && datos.region) {
          setSesionEnVivo({ referencia: datos.referencia, region: datos.region });
          return;
        }
        setError({ clave: "ERROR_TECNICO", tipo });
        return;
      } catch {
        setError({ clave: "ERROR_TECNICO", tipo });
        return;
      }
    }
    setCamaraAbierta(tipo);
  }

  async function registrarSesionEnVivo(referencia: string) {
    setSesionEnVivo(null);
    setEstados((previos) => ({ ...previos, SELFIE: "PROCESANDO" }));
    try {
      const respuesta = await fetch("/api/p5/captura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "SELFIE", selfieSesion: referencia }),
      });
      const datos = (await respuesta.json()) as {
        ok: boolean;
        aprobada?: boolean;
        pruebaDeVidaAprobada?: boolean | null;
      };
      if (!datos.ok || datos.aprobada !== true) {
        setEstados((previos) => ({ ...previos, SELFIE: "REVISAR" }));
        const intento = sumarIntento("SELFIE");
        setError({ clave: "PRUEBA_DE_VIDA", tipo: "SELFIE", intento });
        return;
      }
      setCapturas((previas) => ({ ...previas, SELFIE: referencia }));
      setEstados((previos) => ({ ...previos, SELFIE: "VALIDADO" }));
    } catch {
      setEstados((previos) => ({ ...previos, SELFIE: "PENDIENTE" }));
      setError({ clave: "ERROR_TECNICO", tipo: "SELFIE" });
    }
  }

  const correoCoincide =
    correo.trim() !== "" && correo.trim().toLowerCase() === correoRepetido.trim().toLowerCase();
  const correoParece = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
  const puedeValidar = todasValidadas && correoParece && correoCoincide && !bloqueado;

  async function validar() {
    setErrorCorreo(null);
    if (!correoParece) {
      setErrorCorreo(TEXTOS_03C.errorCorreoInvalido);
      return;
    }
    if (!correoCoincide) {
      setErrorCorreo(TEXTOS_03C.errorCorreosNoCoinciden);
      return;
    }
    setValidando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/v4/identidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frente: capturas.FRENTE,
          dorso: capturas.DORSO,
          ...(pruebaDeVidaEnVivoDisponible
            ? { selfieSesion: capturas.SELFIE }
            : { selfie: capturas.SELFIE }),
          correo: correo.trim(),
          autorizacionBiometrica: true,
        }),
      });
      const datos = (await respuesta.json()) as {
        ok: boolean;
        motivo?: string;
        requisitos?: Record<string, boolean>;
      };
      if (datos.ok) {
        router.push("/datos");
        return;
      }
      if (datos.motivo === "CORREO_INVALIDO") {
        setErrorCorreo(TEXTOS_03C.errorCorreoInvalido);
        return;
      }
      if (datos.requisitos?.coincidenciaFacial === false) {
        setEstados((previos) => ({ ...previos, SELFIE: "REVISAR" }));
        const intento = sumarIntento("SELFIE");
        setError({ clave: "COINCIDENCIA_FACIAL", tipo: "SELFIE", intento });
        return;
      }
      setError({ clave: "ERROR_TECNICO", tipo: null });
    } catch {
      setError({ clave: "ERROR_TECNICO", tipo: null });
    } finally {
      setValidando(false);
    }
  }

  function TarjetaCaptura({ tipo }: { readonly tipo: TipoCapturaP5 }) {
    const Icono = ICONOS[tipo];
    const estado = estados[tipo];
    const activa = tipoActivo === tipo && !bloqueado;
    const esSelfie = tipo === "SELFIE";

    const pildora =
      estado === "VALIDADO"
        ? { texto: TEXTOS_03C.estados.validado, fondo: "var(--v4-azul-fondo)", color: "var(--v4-navy)" }
        : estado === "PROCESANDO"
          ? { texto: TEXTOS_03C.estados.procesando, fondo: "var(--v4-azul-fondo)", color: "var(--v4-navy)" }
          : estado === "REVISAR"
            ? { texto: TEXTOS_03C.estados.revisar, fondo: "var(--v4-rojo-fondo)", color: "var(--v4-rojo)" }
            : { texto: TEXTOS_03C.estados.pendiente, fondo: "var(--v4-gris-fondo)", color: "var(--v4-gris-texto)" };

    return (
      <div
        className="flex flex-col items-center gap-2 rounded-xl border p-3"
        style={{
          borderColor: activa ? "var(--v4-azul)" : "var(--v4-gris-borde)",
          background: "var(--v4-blanco)",
        }}
      >
        <Icono tamano={44} />
        <span className="text-[1rem] font-bold" style={{ color: "var(--v4-navy)" }}>
          {TEXTOS_03C.tarjetas[tipo]}
        </span>
        <span
          className="w-full rounded-full py-1 text-center text-[0.75rem] font-bold uppercase tracking-wide"
          style={{ background: pildora.fondo, color: pildora.color }}
        >
          {pildora.texto}
        </span>

        <button
          type="button"
          onClick={() => abrirCamara(tipo)}
          disabled={!activa || estado === "PROCESANDO"}
          className="w-full rounded-lg px-2 py-2 text-[0.75rem] font-bold uppercase leading-tight"
          style={
            activa && estado !== "PROCESANDO"
              ? { background: "var(--v4-rojo)", color: "var(--v4-blanco)" }
              : { background: "var(--v4-gris-fondo)", color: "var(--v4-gris-texto)" }
          }
        >
          {estado === "PROCESANDO"
            ? TEXTOS_03C.botones.validando
            : esSelfie
              ? TEXTOS_03C.botones.tomarSelfie
              : TEXTOS_03C.botones.tomarFotografia}
        </button>

        {/* Solo el documento admite archivo (D-46); la selfie nunca. */}
        {!esSelfie ? (
          <>
            <button
              type="button"
              onClick={() => (tipo === "FRENTE" ? archivoFrente : archivoDorso).current?.click()}
              disabled={!activa || estado === "PROCESANDO"}
              className="w-full rounded-lg border px-2 py-2 text-[0.75rem] font-bold uppercase leading-tight"
              style={
                activa && estado !== "PROCESANDO"
                  ? { borderColor: "var(--v4-navy)", color: "var(--v4-navy)", background: "var(--v4-blanco)" }
                  : { borderColor: "var(--v4-gris-borde)", color: "var(--v4-gris-texto)", background: "var(--v4-gris-fondo)" }
              }
            >
              {TEXTOS_03C.botones.cargarArchivo}
            </button>
            <input
              ref={tipo === "FRENTE" ? archivoFrente : archivoDorso}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif"
              className="hidden"
              onChange={(evento) => elegirArchivo(tipo, evento.target.files?.[0])}
            />
          </>
        ) : null}
      </div>
    );
  }

  function TarjetaError() {
    if (!error) return null;
    if (bloqueado) {
      const bloqueo = TEXTOS_03C.errores.BLOQUEO;
      return (
        <div className="v4-aviso-rojo mt-4 p-4" role="alert">
          <p className="font-bold uppercase" style={{ color: "var(--v4-rojo)" }}>
            {bloqueo.titulo}
          </p>
          <p className="mt-2 text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
            {bloqueo.cuerpo} {reloj(segundosBloqueo)}.
          </p>
          <div
            className="mt-6 rounded-lg py-3 text-center text-[0.875rem] font-bold uppercase"
            style={{ background: "var(--v4-gris-deshabilitado)", color: "var(--v4-blanco)" }}
          >
            {TEXTOS_03C.reintentoEn(reloj(segundosBloqueo))}
          </div>
        </div>
      );
    }

    const definicion = TEXTOS_03C.errores[error.clave];
    const roja = definicion.familia === "ROJO";
    const Contenedor = roja ? AvisoRojoV4 : AvisoAzulV4;

    return (
      <Contenedor className="mt-4" titulo={definicion.titulo}>
        <p>
          {definicion.cuerpo}
          {error.intento
            ? ` ${TEXTOS_03C.intento(error.intento, INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA)}`
            : ""}
        </p>
        {"remate" in definicion && definicion.remate ? (
          <p className="mt-2 font-bold" style={{ color: "var(--v4-navy)" }}>
            {definicion.remate}
          </p>
        ) : null}
        <div className="mt-4 flex gap-3">
          {roja && error.tipo ? (
            <>
              <BotonPrincipalV4 onClick={() => abrirCamara(error.tipo!)} className="v4-boton-compacto">
                {error.clave === "PRUEBA_DE_VIDA" || error.clave === "COINCIDENCIA_FACIAL"
                  ? TEXTOS_03C.errores.PRUEBA_DE_VIDA.boton
                  : TEXTOS_03C.volverATomar}
              </BotonPrincipalV4>
              {error.tipo !== "SELFIE" ? (
                <BotonSecundarioV4
                  onClick={() => (error.tipo === "FRENTE" ? archivoFrente : archivoDorso).current?.click()}
                  className="v4-boton-compacto"
                >
                  {TEXTOS_03C.cargarOtroArchivo}
                </BotonSecundarioV4>
              ) : null}
            </>
          ) : (
            <BotonPrincipalV4
              onClick={() => {
                setError(null);
                if (error.tipo && error.clave !== "ARCHIVO_NO_ADMITIDO") abrirCamara(error.tipo);
                if (error.clave === "ARCHIVO_NO_ADMITIDO" && error.tipo) {
                  (error.tipo === "FRENTE" ? archivoFrente : archivoDorso).current?.click();
                }
              }}
              className="v4-boton-compacto"
            >
              {"boton" in definicion && definicion.boton ? definicion.boton : TEXTOS_03C.volverATomar}
            </BotonPrincipalV4>
          )}
        </div>
      </Contenedor>
    );
  }

  return (
    <MarcoV4 codigo="03C">
      <DisposicionV4
        contexto={
          <>
            <EncabezadoV4
              titulo={TEXTOS_03C.titulo}
              acento={TEXTOS_03C.tituloAcento}
              bajada={TEXTOS_03C.bajada}
              ilustracion={<IlustracionIdentidad tamano={112} className="shrink-0" />}
            />
            <BarraPlanV4 className="mt-4" />
          </>
        }
      >
        <AvisoAzulV4 className="mt-4 lg:mt-0" titulo={TEXTOS_03C.avisoArchivosTitulo}>
          {TEXTOS_03C.avisoArchivos}
        </AvisoAzulV4>

        <h2 className="v4-rotulo mt-5">{TEXTOS_03C.seccionCaptura}</h2>

        {/* Las tres tarjetas ya van lado a lado en el arte incluso en celular
            (ANALISIS_VISUAL_PNG.md §5.1: «Tres tarjetas en fila»): `RejillaV4`
            apila a una columna por debajo de `sm`, así que usarla acá rompería
            el aspecto de 390 px que exige D-30. Se mantiene el `grid-cols-3`
            fijo del arte, que ya reparte el ancho lado a lado en cualquier
            tamaño de pantalla. */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {TIPOS.map((tipo) => (
            <TarjetaCaptura key={tipo} tipo={tipo} />
          ))}
        </div>

        <TarjetaError />

        <AvisoAzulV4 className="mt-4">{TEXTOS_03C.avisoBiometria}</AvisoAzulV4>

        <h2 className="v4-rotulo mt-5">{TEXTOS_03C.seccionCorreo}</h2>
        <AvisoAzulV4 className="mt-3">{TEXTOS_03C.avisoCorreo}</AvisoAzulV4>

        <CamposV4 className="mt-3 gap-y-3">
          <CampoTextoV4
            etiqueta={TEXTOS_03C.etiquetaCorreo}
            valor={correo}
            alCambiar={todasValidadas ? setCorreo : undefined}
            deshabilitado={!todasValidadas}
            inputMode="email"
            autoComplete="email"
            error={errorCorreo === TEXTOS_03C.errorCorreoInvalido ? errorCorreo : null}
          />
          <CampoTextoV4
            etiqueta={TEXTOS_03C.etiquetaCorreoRepetido}
            valor={correoRepetido}
            alCambiar={todasValidadas ? setCorreoRepetido : undefined}
            deshabilitado={!todasValidadas}
            inputMode="email"
            autoComplete="off"
            error={errorCorreo === TEXTOS_03C.errorCorreosNoCoinciden ? errorCorreo : null}
          />
        </CamposV4>
        {!todasValidadas ? (
          <p className="mt-2 text-center text-[0.875rem]" style={{ color: "var(--v4-gris-texto)" }}>
            {TEXTOS_03C.correoSeHabilita}
          </p>
        ) : null}
        {errorCorreo && errorCorreo !== TEXTOS_03C.errorCorreoInvalido && errorCorreo !== TEXTOS_03C.errorCorreosNoCoinciden ? (
          <ErrorDeCampoV4>{errorCorreo}</ErrorDeCampoV4>
        ) : null}

        <AccionesV4 className="mt-5">
          <BotonPrincipalV4
            onClick={validar}
            disabled={!puedeValidar}
            cargando={validando}
            anilloALaDerecha
          >
            {validando ? TEXTOS_03C.validando : TEXTOS_03C.validar}
          </BotonPrincipalV4>
        </AccionesV4>
      </DisposicionV4>

      {camaraAbierta ? (
        <CapturaConCamara
          tipo={camaraAbierta}
          piel="v4"
          alCancelar={() => setCamaraAbierta(null)}
          alCapturar={async (imagen) => {
            const resultado = await enviarCaptura(camaraAbierta, imagen, "CAMARA");
            if (resultado.ok) setCamaraAbierta(null);
            return resultado.ok
              ? { ok: true as const }
              : { ok: false as const, mensaje: resultado.mensaje ?? TEXTOS_03C.errores.CALIDAD.cuerpo };
          }}
        />
      ) : null}

      {sesionEnVivo ? (
        <PanelPruebaDeVida
          referenciaSesion={sesionEnVivo.referencia}
          region={sesionEnVivo.region}
          // El navegador avisa que terminó; **el veredicto lo pide el
          // servidor por referencia**. Nunca llega una puntuación desde acá.
          alTerminar={() => void registrarSesionEnVivo(sesionEnVivo.referencia)}
          alFallar={() => {
            setSesionEnVivo(null);
            setEstados((previos) => ({ ...previos, SELFIE: "REVISAR" }));
            const intento = sumarIntento("SELFIE");
            setError({ clave: "PRUEBA_DE_VIDA", tipo: "SELFIE", intento });
          }}
          alCancelar={() => setSesionEnVivo(null)}
        />
      ) : null}
    </MarcoV4>
  );
}
