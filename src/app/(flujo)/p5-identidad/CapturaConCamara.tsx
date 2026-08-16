"use client";

/**
 * Captura real con la cámara del dispositivo para las tres tomas de P5:
 * frente de la cédula, dorso y selfie.
 *
 * ## Solo cámara, nunca archivo
 *
 * No hay `<input type="file">` ni camino alternativo, y no es un olvido:
 * `CAPTURA_SOLO_DESDE_CAMARA` (`src/domain/identidad-parametros.ts`) lo declara
 * como regla del proceso. Subir un archivo permitiría mandar la foto de una
 * foto, un PDF de una cédula ajena o una imagen generada — y mientras no haya
 * proveedor documental especializado, exigir la cámara es el control de
 * autenticidad más efectivo que tenemos.
 *
 * ## Qué se manda al servidor
 *
 * El recorte del **marco guía**, no el cuadro entero de la cámara. Dos razones:
 * el fondo de la habitación no aporta nada al OCR y sí ruido a la detección de
 * rostro, y recortar baja el peso del envío. El lado mayor se limita a
 * `LADO_MAXIMO_PX` para no acercarse al tope de 8 MB del endpoint ni al de
 * Textract.
 *
 * ## Requiere HTTPS
 *
 * `navigator.mediaDevices` no existe en un origen inseguro. En `localhost` el
 * navegador lo trata como seguro; servido por IP en una red local, no. Por eso
 * la demostración a distancia va por el dominio de Amplify, que es HTTPS.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { TipoCapturaP5 } from "@/domain/catalogo-identidad";

/**
 * Proporción del marco guía del documento: 85,60 × 53,98 mm, el formato ID-1
 * de ISO/IEC 7810 en el que están tanto la cédula paraguaya como la boliviana.
 * Encuadrar con la proporción correcta es lo que hace que el recorte no corte
 * el MRZ del dorso.
 */
const PROPORCION_DOCUMENTO = 85.6 / 53.98;

/** Cuánto del ancho del cuadro ocupa el marco guía. Deja aire para encuadrar. */
const OCUPACION_GUIA = 0.88;

/**
 * Lado mayor de la imagen enviada, en píxeles. 1600 mantiene legible el texto
 * chico de la cédula (el MRZ es lo más exigente) y deja el JPEG en unos pocos
 * cientos de kB.
 */
const LADO_MAXIMO_PX = 1600;

/** JPEG y no PNG: una foto de cámara en PNG pesa un orden de magnitud más. */
const CALIDAD_JPEG = 0.92;

const TEXTOS: Readonly<
  Record<TipoCapturaP5, { readonly titulo: string; readonly guia: string; readonly boton: string }>
> = {
  FRENTE: {
    titulo: "Frente de la cédula",
    guia: "Encuadrá el documento dentro del marco. Sin reflejos y con las cuatro esquinas a la vista.",
    boton: "Tomar la foto",
  },
  DORSO: {
    titulo: "Dorso de la cédula",
    guia: "Dalo vuelta y encuadralo igual. El código de la parte de abajo tiene que verse completo.",
    boton: "Tomar la foto",
  },
  SELFIE: {
    titulo: "Selfie",
    guia: "Ubicá tu rostro dentro del óvalo, de frente, con buena luz y sin lentes ni gorra.",
    boton: "Tomar la selfie",
  },
};

const MENSAJES_ERROR: Readonly<Record<string, string>> = {
  NotAllowedError:
    "No nos diste permiso para usar la cámara. Habilitala en el candado de la barra de direcciones y volvé a intentar.",
  NotFoundError: "No encontramos ninguna cámara en este dispositivo.",
  NotReadableError: "Otra aplicación está usando la cámara. Cerrala y volvé a intentar.",
  OverconstrainedError: "La cámara de este dispositivo no soporta la resolución necesaria.",
  SecurityError: "El navegador bloqueó la cámara por seguridad. La página tiene que abrirse por HTTPS.",
};

const ERROR_SIN_SOPORTE =
  "Este navegador no permite usar la cámara desde esta página. Abrila por HTTPS, o probá con Chrome o Safari actualizados.";

export interface CapturaConCamaraProps {
  readonly tipo: TipoCapturaP5;
  /** Recibe la imagen recortada como data URL (`data:image/jpeg;base64,…`). */
  readonly alCapturar: (imagen: string) => void;
  readonly alCancelar: () => void;
}

export function CapturaConCamara({ tipo, alCapturar, alCancelar }: CapturaConCamaraProps) {
  const video = useRef<HTMLVideoElement | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esSelfie = tipo === "SELFIE";
  const textos = TEXTOS[tipo];

  const detener = useCallback(() => {
    flujo.current?.getTracks().forEach((pista) => pista.stop());
    flujo.current = null;
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function abrir() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError(ERROR_SIN_SOPORTE);
        return;
      }

      try {
        const obtenido = await navigator.mediaDevices.getUserMedia({
          video: {
            // `environment` es la cámara trasera, que en un celular es la
            // buena y la que enfoca de cerca; `user` es la frontal. Es
            // `ideal` y no `exact` para que una notebook con una sola cámara
            // no falle en vez de usar la que tiene.
            facingMode: { ideal: esSelfie ? "user" : "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        // La persona pudo cerrar el panel mientras el navegador pedía
        // permiso; sin esto quedaría la cámara prendida y sin dueño.
        if (cancelado) {
          obtenido.getTracks().forEach((pista) => pista.stop());
          return;
        }

        flujo.current = obtenido;
        if (video.current) {
          video.current.srcObject = obtenido;
          await video.current.play().catch(() => undefined);
        }
        setListo(true);
      } catch (fallo) {
        if (cancelado) return;
        const nombre = fallo instanceof Error ? fallo.name : "";
        setError(MENSAJES_ERROR[nombre] ?? "No pudimos abrir la cámara. Volvé a intentar.");
      }
    }

    void abrir();

    return () => {
      cancelado = true;
      detener();
    };
  }, [esSelfie, detener]);

  function capturar() {
    const elemento = video.current;
    if (!elemento || !listo) return;

    const anchoFuente = elemento.videoWidth;
    const altoFuente = elemento.videoHeight;
    if (anchoFuente === 0 || altoFuente === 0) return;

    // Mismo cálculo que el marco que la persona ve en pantalla: lo que quedó
    // dentro del marco es exactamente lo que se recorta.
    const anchoGuia = anchoFuente * OCUPACION_GUIA;
    const altoGuia = esSelfie ? anchoGuia : anchoGuia / PROPORCION_DOCUMENTO;
    const recorte = {
      ancho: Math.min(anchoGuia, anchoFuente),
      alto: Math.min(altoGuia, altoFuente),
    };
    const origenX = (anchoFuente - recorte.ancho) / 2;
    const origenY = (altoFuente - recorte.alto) / 2;

    const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(recorte.ancho, recorte.alto));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(recorte.ancho * escala);
    lienzo.height = Math.round(recorte.alto * escala);

    const contexto = lienzo.getContext("2d");
    if (!contexto) return;

    // La selfie se dibuja **sin espejar**, aunque la vista previa sí lo esté:
    // el espejo es una comodidad visual, y lo que se manda a comparar tiene
    // que ser la imagen tal cual la ve la cámara.
    contexto.drawImage(
      elemento,
      origenX,
      origenY,
      recorte.ancho,
      recorte.alto,
      0,
      0,
      lienzo.width,
      lienzo.height,
    );

    const imagen = lienzo.toDataURL("image/jpeg", CALIDAD_JPEG);
    detener();
    alCapturar(imagen);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={textos.titulo}
      className="fixed inset-0 z-50 flex flex-col bg-azul-950/95 backdrop-blur-sm"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-bold tracking-wide text-white uppercase">{textos.titulo}</p>
        <button
          type="button"
          onClick={() => {
            detener();
            alCancelar();
          }}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-azul-100 underline decoration-azul-400 underline-offset-2 hover:text-white"
        >
          Cancelar
        </button>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={video}
          playsInline
          muted
          // `playsInline` evita que iOS abra el video a pantalla completa y se
          // coma la interfaz; sin eso, en iPhone no se ve el marco guía.
          className={`h-full w-full object-cover ${esSelfie ? "-scale-x-100" : ""}`}
        />

        {/* Marco guía. `pointer-events-none` para que no se coma el botón. */}
        {listo && !error ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              style={
                esSelfie
                  ? { width: `${OCUPACION_GUIA * 100}%`, aspectRatio: "1 / 1" }
                  : { width: `${OCUPACION_GUIA * 100}%`, aspectRatio: `${PROPORCION_DOCUMENTO}` }
              }
              className={`border-4 border-naranja-500 shadow-[0_0_0_100vmax_rgba(9,20,33,0.55)] ${
                esSelfie ? "rounded-full" : "rounded-xl"
              }`}
            />
          </div>
        ) : null}

        {!listo && !error ? (
          <p role="status" className="absolute text-sm font-semibold text-white">
            Abriendo la cámara…
          </p>
        ) : null}
      </div>

      <footer className="flex flex-col gap-3 px-4 py-4">
        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-200">
            {error}
          </p>
        ) : (
          <p className="text-sm text-azul-100">{textos.guia}</p>
        )}

        <button
          type="button"
          onClick={capturar}
          disabled={!listo || error !== null}
          className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:bg-azul-800 disabled:text-azul-400"
        >
          {textos.boton}
        </button>
      </footer>
    </div>
  );
}
