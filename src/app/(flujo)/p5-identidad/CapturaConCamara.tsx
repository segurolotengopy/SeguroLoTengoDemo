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
 * ## Lo que se ve es lo que se manda
 *
 * El recorte sale de proyectar **el marco guía medido en pantalla** sobre los
 * píxeles del sensor (`geometria-captura.ts`), no de tomar una fracción del
 * cuadro fuente. Ese atajo —"el 88 % del ancho del video"— ignoraba el
 * `object-fit` y mandaba una región que no era la encuadrada: en un celular
 * vertical con cámara horizontal, más del doble de lo que la persona veía.
 *
 * El documento se muestra con `object-contain` y la selfie con `object-cover`.
 * No es una preferencia estética: `cover` descarta los costados del cuadro, y
 * en el documento esos costados son justamente la resolución que el MRZ
 * necesita. Un rostro, en cambio, se lee mejor ocupando la pantalla entera.
 *
 * ## Tres momentos, no uno
 *
 * Encuadrar → revisar → mandar. Antes la foto salía disparada al servidor sin
 * que nadie la viera: si salía movida, la persona se enteraba por un rechazo,
 * ya fuera del visor, y tenía que volver a abrir la cámara. Ahora la ve, decide
 * si sirve, y si el servidor la rechaza el mensaje aparece **acá adentro**, con
 * la cámara todavía abierta.
 *
 * ## El disparo automático asiste, no decide
 *
 * `calidad-captura.ts` mide foco, exposición y reflejo sobre el cuadro en vivo
 * para dar consejos y para apretar el obturador solo cuando todo está en orden.
 * Nada de eso aprueba una captura: quien decide es el proveedor, del otro lado.
 * Por eso **el botón manual está siempre habilitado apenas hay imagen** — si el
 * cuadro nunca llega a estar "apto", la persona dispara igual. Un asistente que
 * se vuelve portero es un callejón sin salida.
 *
 * ## Requiere HTTPS
 *
 * `navigator.mediaDevices` no existe en un origen inseguro. En `localhost` el
 * navegador lo trata como seguro; servido por IP en una red local, no. Por eso
 * la demostración a distancia va por el dominio de Amplify, que es HTTPS.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONSEJO_APTA,
  CONSEJO_RESOLUCION_INSUFICIENTE,
  CUADROS_ESTABLES_PARA_DISPARO,
  INTERVALO_MEDICION_MS,
  LADO_MUESTRA_PX,
  RETARDO_DISPARO_MS,
  RETARDO_REARME_MS,
  evaluarCaptura,
  medirCaptura,
  resolucionSuficiente,
  type TipoTomaCalidad,
} from "@/domain/calidad-captura";
import type { TipoCapturaP5 } from "@/domain/catalogo-identidad";
import {
  ajustarContenido,
  anchoRelativoDelMarco,
  mapearGuiaAFuente,
  type Caja,
  type ModoAjuste,
} from "./geometria-captura";

/**
 * Proporción del marco guía del documento: 85,60 × 53,98 mm, el formato ID-1
 * de ISO/IEC 7810 en el que están tanto la cédula paraguaya como la boliviana.
 * Encuadrar con la proporción correcta es lo que hace que el recorte no corte
 * el MRZ del dorso.
 */
const PROPORCION_DOCUMENTO = 85.6 / 53.98;

/** Cuánto del área visible ocupa el marco guía. Deja aire para encuadrar. */
const OCUPACION_GUIA_DOCUMENTO = 0.92;
const OCUPACION_GUIA_SELFIE = 0.74;

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

const ERROR_SIN_REPRODUCIR =
  "El navegador no dejó iniciar la cámara. Cerrá esta ventana, volvé a abrirla y, si sigue, probá con otro navegador.";
const ERROR_SIN_IMAGEN =
  "La cámara se abrió pero no está entregando imagen. Cerrá esta ventana y volvé a intentar.";
const ERROR_SIN_LIENZO =
  "Este navegador no permite procesar la foto. Probá con Chrome o Safari actualizados.";
const ERROR_SIN_SOPORTE =
  "Este navegador no permite usar la cámara desde esta página. Abrila por HTTPS, o probá con Chrome o Safari actualizados.";

/**
 * Espera a que el video entregue su primer cuadro, con tope.
 *
 * `play()` puede resolver antes de que haya imagen: en ese instante
 * `videoWidth` sigue en 0 y capturar produce un lienzo vacío. El tope evita
 * quedarse esperando para siempre si la cámara nunca entrega nada.
 */
function esperarDimensiones(elemento: HTMLVideoElement, topeMs = 4000): Promise<void> {
  if (elemento.videoWidth > 0) return Promise.resolve();

  return new Promise((resolver) => {
    const listar = () => {
      if (elemento.videoWidth > 0) terminar();
    };
    const terminar = () => {
      clearInterval(temporizador);
      clearTimeout(vencimiento);
      elemento.removeEventListener("loadedmetadata", listar);
      elemento.removeEventListener("playing", listar);
      resolver();
    };

    elemento.addEventListener("loadedmetadata", listar);
    elemento.addEventListener("playing", listar);
    // Sondeo además de los eventos: en algunos navegadores móviles
    // `loadedmetadata` llega antes de que `videoWidth` tenga valor.
    const temporizador = setInterval(listar, 120);
    const vencimiento = setTimeout(terminar, topeMs);
  });
}

function caja(elemento: Element): Caja {
  const rect = elemento.getBoundingClientRect();
  return { izquierda: rect.left, arriba: rect.top, ancho: rect.width, alto: rect.height };
}

export type ResultadoEnvioCaptura =
  | { readonly ok: true }
  | { readonly ok: false; readonly mensaje: string };

export interface CapturaConCamaraProps {
  readonly tipo: TipoCapturaP5;
  /**
   * Manda la imagen recortada (`data:image/jpeg;base64,…`) y devuelve qué dijo
   * el servidor. Con `ok: false` el visor **se queda abierto** mostrando el
   * motivo, para que la persona repita sin volver a atravesar la pantalla.
   * Con `ok: true` se espera que quien monta el visor lo desmonte.
   */
  readonly alCapturar: (imagen: string) => Promise<ResultadoEnvioCaptura>;
  readonly alCancelar: () => void;
}

export function CapturaConCamara({ tipo, alCapturar, alCancelar }: CapturaConCamaraProps) {
  const video = useRef<HTMLVideoElement | null>(null);
  const marco = useRef<HTMLDivElement | null>(null);
  /** Área entre la cabecera y el pie; su alto cambia cuando aparece un consejo. */
  const area = useRef<HTMLDivElement | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const montado = useRef(true);
  /** Cuadros buenos seguidos; el disparo automático se arma con suficientes. */
  const estables = useRef(0);
  /** Hasta cuándo el disparo automático queda desarmado tras un "Repetir". */
  const rearmeHasta = useRef(0);
  const cuentaRegresiva = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Foto congelada esperando confirmación; mientras exista, se revisa. */
  const [foto, setFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);
  const [consejo, setConsejo] = useState<string | null>(null);
  const [porDisparar, setPorDisparar] = useState(false);
  const [disparoAutomatico, setDisparoAutomatico] = useState(true);
  const [resolucionCorta, setResolucionCorta] = useState(false);
  /** Tamaño intrínseco del cuadro. Da la proporción del recuadro del visor. */
  const [fuente, setFuente] = useState<{ readonly ancho: number; readonly alto: number } | null>(
    null,
  );
  /** Recuadro del visor, en píxeles: el cuadro entero ajustado al área. */
  const [recuadro, setRecuadro] = useState<{ readonly ancho: number; readonly alto: number } | null>(
    null,
  );

  const esSelfie = tipo === "SELFIE";
  const textos = TEXTOS[tipo];
  // `contain` para las tres tomas, también la selfie. Con `cover` el recuadro
  // no tiene la proporción del cuadro y no hay forma de encajar el marco sin
  // medir el contenedor; con `contain` la proporción se conoce de antemano y el
  // encaje sale de una cuenta. El costo es una franja negra al costado en una
  // pantalla ancha, y la contrapartida es que se ve todo lo que la cámara ve.
  const modo: ModoAjuste = "contain";
  const tipoCalidad: TipoTomaCalidad = esSelfie ? "SELFIE" : "DOCUMENTO";

  const detener = useCallback(() => {
    flujo.current?.getTracks().forEach((pista) => pista.stop());
    flujo.current = null;
  }, []);

  const desarmarDisparo = useCallback(() => {
    if (cuentaRegresiva.current) clearTimeout(cuentaRegresiva.current);
    cuentaRegresiva.current = null;
    estables.current = 0;
    setPorDisparar(false);
  }, []);

  /** Recorte del marco, en píxeles del sensor. Vacío si todavía no hay cuadro. */
  const recorteDelMarco = useCallback(() => {
    const elemento = video.current;
    const guia = marco.current;
    if (!elemento || !guia) return null;
    if (elemento.videoWidth === 0 || elemento.videoHeight === 0) return null;

    // El espejo se compensa acá y no al dibujar: lo que se manda a comparar
    // tiene que ser la imagen tal cual la ve la cámara, no la que se le muestra
    // a la persona dada vuelta.
    return mapearGuiaAFuente(
      caja(elemento),
      caja(guia),
      elemento.videoWidth,
      elemento.videoHeight,
      modo,
      esSelfie,
    );
  }, [modo, esSelfie]);

  const tomarFoto = useCallback(() => {
    const elemento = video.current;
    if (!elemento) return;

    // Los `return` mudos son el peor modo de falla posible acá: dejan a la
    // persona apretando un botón que no hace nada. Cada salida dice qué pasó.
    const recorte = recorteDelMarco();
    if (!recorte || recorte.ancho === 0 || recorte.alto === 0) {
      setError(ERROR_SIN_IMAGEN);
      return;
    }

    const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(recorte.ancho, recorte.alto));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(recorte.ancho * escala);
    lienzo.height = Math.round(recorte.alto * escala);

    const contexto = lienzo.getContext("2d");
    if (!contexto) {
      setError(ERROR_SIN_LIENZO);
      return;
    }

    contexto.drawImage(
      elemento,
      recorte.x,
      recorte.y,
      recorte.ancho,
      recorte.alto,
      0,
      0,
      lienzo.width,
      lienzo.height,
    );

    const imagen = lienzo.toDataURL("image/jpeg", CALIDAD_JPEG);
    // Un data URL de pocos bytes significa que el lienzo salió vacío; mandarlo
    // haría que el servidor rechace por "imagen inválida" sin que se entienda
    // por qué.
    if (imagen.length < 1000) {
      setError(ERROR_SIN_IMAGEN);
      return;
    }

    desarmarDisparo();
    setConsejo(null);
    setFoto(imagen);
  }, [recorteDelMarco, desarmarDisparo]);

  // ---------------------------------------------------------------------
  // Abrir la cámara
  // ---------------------------------------------------------------------
  useEffect(() => {
    montado.current = true;
    let cancelado = false;

    async function abrir() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError(ERROR_SIN_SOPORTE);
        return;
      }

      // Resolución pedida según cómo está la pantalla: en un teléfono vertical,
      // pedir 1920×1080 devuelve un cuadro horizontal del que se aprovecha una
      // franja. Pidiéndolo vertical, el sensor se usa entero.
      const vertical = typeof window !== "undefined" && window.innerHeight > window.innerWidth;
      const ladoLargo = { ideal: 1920 };
      const ladoCorto = { ideal: 1080 };

      try {
        const obtenido = await navigator.mediaDevices.getUserMedia({
          video: {
            // `environment` es la cámara trasera, que en un celular es la
            // buena y la que enfoca de cerca; `user` es la frontal. Es
            // `ideal` y no `exact` para que una notebook con una sola cámara
            // no falle en vez de usar la que tiene.
            facingMode: { ideal: esSelfie ? "user" : "environment" },
            width: vertical ? ladoCorto : ladoLargo,
            height: vertical ? ladoLargo : ladoCorto,
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
        const elemento = video.current;
        if (!elemento) return;

        elemento.srcObject = obtenido;

        // `play()` puede rechazar (iOS bloquea el autoplay en varios
        // escenarios). Si se tragara el error, el botón quedaría habilitado
        // sobre un video que nunca arrancó.
        try {
          await elemento.play();
        } catch {
          if (!cancelado) setError(ERROR_SIN_REPRODUCIR);
          return;
        }

        // **No alcanza con que `play()` resuelva**: hasta que no llega el
        // primer cuadro, `videoWidth` es 0 y no hay nada que capturar.
        await esperarDimensiones(elemento);
        if (cancelado) return;

        if (elemento.videoWidth === 0 || elemento.videoHeight === 0) {
          setError(ERROR_SIN_IMAGEN);
          return;
        }
        setFuente({ ancho: elemento.videoWidth, alto: elemento.videoHeight });
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
      montado.current = false;
      if (cuentaRegresiva.current) clearTimeout(cuentaRegresiva.current);
      detener();
    };
  }, [esSelfie, detener]);

  // ---------------------------------------------------------------------
  // Tamaño del recuadro: el cuadro entero, ajustado al área disponible
  // ---------------------------------------------------------------------
  useEffect(() => {
    const elemento = video.current;
    const contenedor = area.current;
    if (!elemento || !contenedor || !listo) return;

    const medir = () => {
      const caja = contenedor.getBoundingClientRect();
      setFuente({ ancho: elemento.videoWidth, alto: elemento.videoHeight });
      setRecuadro(
        ajustarContenido(caja.width, caja.height, elemento.videoWidth, elemento.videoHeight),
      );
    };

    medir();

    // Tres disparadores, porque el área cambia de tres maneras distintas:
    // el pie crece al aparecer un consejo (sin que la ventana se mueva), la
    // ventana cambia de tamaño, y algunas cámaras suben de resolución después
    // de arrancar (`resize` del propio `<video>`).
    const observador = new ResizeObserver(medir);
    observador.observe(contenedor);
    elemento.addEventListener("resize", medir);
    window.addEventListener("resize", medir);
    window.addEventListener("orientationchange", medir);
    return () => {
      observador.disconnect();
      elemento.removeEventListener("resize", medir);
      window.removeEventListener("resize", medir);
      window.removeEventListener("orientationchange", medir);
    };
  }, [listo]);

  // ---------------------------------------------------------------------
  // Medir el cuadro en vivo: consejos y disparo automático
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!listo || error || foto) return;

    const lienzo = document.createElement("canvas");
    const contexto = lienzo.getContext("2d", { willReadFrequently: true });
    if (!contexto) return;

    const medir = () => {
      const elemento = video.current;
      const recorte = recorteDelMarco();
      if (!elemento || !recorte || recorte.ancho === 0 || recorte.alto === 0) return;

      setResolucionCorta(!resolucionSuficiente(recorte.ancho, tipoCalidad));

      const escala = LADO_MUESTRA_PX / recorte.ancho;
      lienzo.width = LADO_MUESTRA_PX;
      lienzo.height = Math.max(3, Math.round(recorte.alto * escala));
      contexto.drawImage(
        elemento,
        recorte.x,
        recorte.y,
        recorte.ancho,
        recorte.alto,
        0,
        0,
        lienzo.width,
        lienzo.height,
      );

      let pixeles: Uint8ClampedArray;
      try {
        pixeles = contexto.getImageData(0, 0, lienzo.width, lienzo.height).data;
      } catch {
        // Un lienzo contaminado no debería pasar acá (el video es del propio
        // dispositivo), pero si pasa, el visor sigue funcionando sin consejos.
        return;
      }

      const gris = new Uint8ClampedArray(lienzo.width * lienzo.height);
      for (let i = 0; i < gris.length; i += 1) {
        const p = i * 4;
        // Luminancia perceptual (Rec. 601), la misma que usa cualquier
        // conversión a escala de grises.
        gris[i] = 0.299 * pixeles[p] + 0.587 * pixeles[p + 1] + 0.114 * pixeles[p + 2];
      }

      const veredicto = evaluarCaptura(
        medirCaptura({ datos: gris, ancho: lienzo.width, alto: lienzo.height }),
        tipoCalidad,
      );
      setConsejo(veredicto.consejo);

      if (!veredicto.apta) {
        if (cuentaRegresiva.current) clearTimeout(cuentaRegresiva.current);
        cuentaRegresiva.current = null;
        estables.current = 0;
        setPorDisparar(false);
        return;
      }

      estables.current += 1;
      const puedeArmar =
        disparoAutomatico &&
        cuentaRegresiva.current === null &&
        estables.current >= CUADROS_ESTABLES_PARA_DISPARO &&
        Date.now() >= rearmeHasta.current;

      if (puedeArmar) {
        setPorDisparar(true);
        cuentaRegresiva.current = setTimeout(() => {
          cuentaRegresiva.current = null;
          setPorDisparar(false);
          tomarFoto();
        }, RETARDO_DISPARO_MS);
      }
    };

    const temporizador = setInterval(medir, INTERVALO_MEDICION_MS);
    medir();
    return () => {
      clearInterval(temporizador);
      if (cuentaRegresiva.current) clearTimeout(cuentaRegresiva.current);
      cuentaRegresiva.current = null;
      setPorDisparar(false);
    };
  }, [listo, error, foto, disparoAutomatico, recorteDelMarco, tomarFoto, tipoCalidad]);

  function repetir() {
    setFoto(null);
    setRechazo(null);
    setConsejo(null);
    estables.current = 0;
    // Sin esta pausa, el disparo automático volvería a saltar sobre el mismo
    // encuadre que la persona acaba de descartar.
    rearmeHasta.current = Date.now() + RETARDO_REARME_MS;
  }

  async function usarFoto() {
    if (!foto) return;
    setEnviando(true);
    setRechazo(null);
    try {
      const resultado = await alCapturar(foto);
      if (!montado.current) return;
      // Con `ok: true` quien monta el visor lo desmonta; no hay nada más que
      // hacer acá. Con `ok: false` el motivo se muestra sin cerrar la cámara.
      if (!resultado.ok) setRechazo(resultado.mensaje);
    } finally {
      if (montado.current) setEnviando(false);
    }
  }

  /**
   * Tamaño del marco guía, en porcentaje del recuadro.
   *
   * **No se usa `max-height`.** Con un ancho definido y `aspect-ratio`, el
   * navegador recorta el alto sin tocar el ancho: el marco se deforma en vez de
   * achicarse —medido, 3,66 de proporción donde tiene que haber 1,59— y con él
   * se deforma el recorte, que es exactamente lo que este visor promete no
   * hacer. Como el recuadro tiene la proporción del cuadro de la cámara, el
   * ancho que entra por los dos lados sale de una cuenta: el marco ocupa
   * `ocupacion` del ancho, o menos si por alto no entra.
   */
  const proporcionMarco = esSelfie ? 1 : PROPORCION_DOCUMENTO;
  const anchoMarco = anchoRelativoDelMarco(
    esSelfie ? OCUPACION_GUIA_SELFIE : OCUPACION_GUIA_DOCUMENTO,
    proporcionMarco,
    fuente ? fuente.ancho / fuente.alto : 1,
  );
  const estiloMarco = {
    width: `${(anchoMarco * 100).toFixed(3)}%`,
    aspectRatio: `${proporcionMarco}`,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={textos.titulo}
      className="fixed inset-0 z-50 flex flex-col bg-azul-950/95 backdrop-blur-sm"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-bold tracking-wide text-white uppercase">
          {textos.titulo}
          {foto ? " · revisá la foto" : ""}
        </p>
        <button
          type="button"
          onClick={() => {
            detener();
            alCancelar();
          }}
          disabled={enviando}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-azul-100 underline decoration-azul-400 underline-offset-2 hover:text-white disabled:opacity-50"
        >
          Cancelar
        </button>
      </header>

      <div
        ref={area}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
      >
        {/*
          El recuadro tiene **exactamente el tamaño del cuadro de la cámara
          ajustado al área**, con los dos lados en píxeles. Así el elemento de
          video coincide con la imagen que se ve y el marco guía no puede quedar
          fuera de ella.

          Los dos lados, y no `max-height` con `aspect-ratio`: cuando el alto es
          el que limita, el navegador recorta el alto y deja el ancho como
          estaba. Medido acá adentro, eso ponía el marco en 1090 × 687 sobre una
          imagen de 456 × 456.

          La contracara es que hay que medir, y una medición se puede quedar
          vieja: el pie crece al aparecer un consejo sin que la ventana se
          mueva. De ahí el `ResizeObserver` sobre el área, además de los eventos
          de ventana.

          Y si aun así quedara vieja, lo que se rompe es la estética y no la
          promesa: el recuadro se recorta contra el borde del área, pero el
          recorte se calcula midiendo las cajas reales en el momento del
          disparo, así que sigue siendo exactamente lo encuadrado.
        */}
        <div
          className="relative flex items-center justify-center"
          style={
            recuadro && recuadro.ancho > 0
              ? { width: recuadro.ancho, height: recuadro.alto }
              : { width: "100%", height: "100%" }
          }
        >
          <video
            ref={video}
            playsInline
            muted
            // `playsInline` evita que iOS abra el video a pantalla completa y se
            // coma la interfaz; sin eso, en iPhone no se ve el marco guía.
            className={`h-full w-full object-contain ${esSelfie ? "-scale-x-100" : ""} ${
              foto ? "invisible" : ""
            }`}
          />

          {/* Revisión: la foto congelada, tal cual se va a mandar. */}
          {foto ? (
            /* eslint-disable-next-line @next/next/no-img-element --
               `next/image` optimiza recursos servidos; esto es un data URL que
               el propio navegador acaba de generar y que nunca sale a la red.
               Pasarlo por el optimizador no ahorraría un byte y agregaría un
               viaje al servidor con la foto de una cédula adentro. */
            <img
              src={foto}
              alt={`Vista previa de la captura: ${textos.titulo.toLowerCase()}`}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : null}

          {listo && !error && !foto ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                ref={marco}
                style={estiloMarco}
                className={`border-4 shadow-[0_0_0_100vmax_rgba(9,20,33,0.55)] transition-colors ${
                  porDisparar ? "border-verde-400" : "border-naranja-500"
                } ${esSelfie ? "rounded-full" : "rounded-xl"}`}
              />
            </div>
          ) : null}

          {!listo && !error ? (
            <p role="status" className="absolute text-sm font-semibold text-white">
              Abriendo la cámara…
            </p>
          ) : null}
        </div>
      </div>

      <footer className="flex flex-col gap-3 px-4 py-4">
        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-200">
            {error}
          </p>
        ) : foto ? (
          <div className="flex flex-col gap-2">
            {rechazo ? (
              <p role="alert" className="text-sm font-semibold text-rojo-200">
                {rechazo}
              </p>
            ) : (
              <p className="text-sm text-azul-100">
                ¿Se lee bien y entra completa? Si no, repetila: los datos no se corrigen a mano
                después.
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={usarFoto}
                disabled={enviando}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:bg-azul-800 disabled:text-azul-400"
              >
                {enviando ? "Enviando…" : rechazo ? "Volver a enviar" : "Usar esta foto"}
              </button>
              <button
                type="button"
                onClick={repetir}
                disabled={enviando}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-lg border-2 border-azul-300 px-6 text-sm font-bold tracking-wide text-azul-100 uppercase transition-colors hover:bg-azul-900 disabled:opacity-50"
              >
                Repetir
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-azul-100">{textos.guia}</p>

            {resolucionCorta ? (
              <p role="status" className="text-sm font-semibold text-naranja-200">
                {CONSEJO_RESOLUCION_INSUFICIENTE}
              </p>
            ) : null}

            {consejo ? (
              <p
                role="status"
                className={`text-sm font-semibold ${
                  consejo === CONSEJO_APTA ? "text-verde-300" : "text-naranja-200"
                }`}
              >
                {porDisparar ? "Listo. Sacando la foto…" : consejo}
              </p>
            ) : null}

            <button
              type="button"
              onClick={tomarFoto}
              disabled={!listo}
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:bg-azul-800 disabled:text-azul-400"
            >
              {textos.boton}
            </button>

            {/* El automático se puede apagar: en una cédula muy gastada o con
                poca luz puede no decidirse nunca, y el botón de arriba tiene
                que seguir siendo el camino principal, no el de emergencia. */}
            <label className="flex items-center gap-2 text-xs text-azul-200">
              <input
                type="checkbox"
                checked={disparoAutomatico}
                onChange={(evento) => {
                  setDisparoAutomatico(evento.target.checked);
                  if (!evento.target.checked) desarmarDisparo();
                }}
                className="h-4 w-4 accent-naranja-500"
              />
              Sacar la foto sola cuando se vea bien
            </label>
          </div>
        )}
      </footer>
    </div>
  );
}
