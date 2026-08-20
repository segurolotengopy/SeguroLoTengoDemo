"use client";

import { useMemo, useState } from "react";
import { CapturaConCamara, type ResultadoEnvioCaptura } from "./CapturaConCamara";
import { PanelPruebaDeVida } from "./PanelPruebaDeVida";
import { EnlaceAclaracion } from "@/components/shared";
// Desde `catalogo-identidad` y no desde el caso de uso: este es un componente
// de cliente, e importar `verificacion-identidad.ts` arrastraría `node:crypto`
// al bundle.
import { ESTADOS_CIVILES, PAISES_NACIMIENTO, REQUISITOS_P5 } from "@/domain/catalogo-identidad";
import type { IdRequisitoP5, TipoCapturaP5 } from "@/domain/catalogo-identidad";
import { EDAD_MAXIMA_PERMITIDA, EDAD_MINIMA_PERMITIDA } from "@/domain/tipos";

/**
 * Bloques interactivos de P5 (docs/ESPECIFICACION_PANTALLAS.md → "P5 · Paso 5
 * de 9 — Verificación de identidad"): captura documental y biométrica, datos
 * de identidad, requisitos para continuar y registro de seguridad.
 *
 * No tiene lógica de negocio. Los seis campos de la cédula son de solo
 * lectura porque los llena el servidor con lo que devolvió el OCR: el
 * componente no ofrece —ni podría ofrecer— una forma de editarlos, y tampoco
 * los manda de vuelta al confirmar. El único camino ante una discrepancia es
 * `Repetir captura`.
 *
 * La edad que se muestra viene calculada del servidor a partir de la fecha de
 * nacimiento extraída del documento (regla inviolable #8); acá no se calcula
 * nada ni existe un campo declarado del que pudiera salir.
 *
 * Las tres capturas salen de la **cámara del dispositivo** (`CapturaConCamara`):
 * `CAPTURA_SOLO_DESDE_CAMARA` lo declara como regla del proceso. Lo que cambia
 * entre modos no es de dónde salen los bytes, sino qué hace el proveedor con
 * ellos — el mock los hashea y decide por persona de prueba, el de AWS los
 * analiza de verdad.
 *
 * **Única excepción, y solo con `DEMO_MODE=true`:** el frente y el dorso se
 * pueden subir como archivo (`subidaDeArchivoDisponible`), porque en una
 * demostración a distancia no siempre se tiene la cédula en la mano. La selfie
 * **nunca** — es el ancla biométrica, y un archivo ahí permitiría verificar la
 * identidad con la cara de otra persona. Esta prop solo decide si el botón se
 * dibuja; quien lo impide de verdad es el servidor (`origenCapturaAdmitido`),
 * porque esconder un botón no impide armar la petición a mano.
 *
 * La selfie es el único caso con dos caminos, y lo decide el servidor:
 * `pruebaDeVidaEnVivoDisponible` manda al detector de streaming (prueba de
 * vida real); sin él, va por la misma cámara que el documento.
 */

interface DatosIdentidad {
  readonly numeroCedula: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly fechaNacimiento: string;
  readonly sexo: string;
  readonly nacionalidad: string;
  readonly edad: number;
  readonly edadEnRango: boolean;
}

interface RegistroSeguridad {
  readonly fecha: string;
  readonly ip: string;
  readonly referenciaFrente: string;
  readonly referenciaDorso: string;
  readonly referenciaSelfie: string;
  readonly hashFrenteCedula: string;
  readonly hashDorsoCedula: string;
  readonly hashSelfie: string;
  readonly pruebaDeVidaAprobada: boolean;
  readonly coincidenciaFacialAprobada: boolean;
  readonly puntuacionFacial: number | null;
  readonly resultado: "EXITOSO" | "FALLIDO";
}

interface RespuestaCaptura {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly aprobada?: boolean;
  readonly calidadAprobada?: boolean;
  readonly autenticidadAprobada?: boolean;
  readonly pruebaDeVidaAprobada?: boolean | null;
  readonly motivoRechazo?: string | null;
}

interface RespuestaAnalisis {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly requisitos?: Record<IdRequisitoP5, boolean>;
  readonly datos?: DatosIdentidad | null;
  readonly motivoRechazoCaptura?: string | null;
  readonly registroSeguridad?: RegistroSeguridad;
  readonly estado?: string;
  /**
   * Número de caso si este análisis agotó los intentos y el expediente pasó a
   * asistencia humana. Cuando llega, repetir la captura ya no sirve.
   */
  readonly asistenciaIdentidad?: string | null;
}

interface EstadoCaptura {
  /**
   * Base64 de la imagen capturada, salvo en la selfie con prueba de vida en
   * vivo: ahí es la **referencia de la sesión** del proveedor. El navegador la
   * trata igual —una cadena opaca que devuelve al servidor— y `enVivo`
   * distingue cuál de las dos cosas es.
   */
  readonly imagen: string;
  readonly aprobada: boolean;
  readonly pruebaDeVidaAprobada: boolean | null;
  readonly motivoRechazo: string | null;
  /** `true` si `imagen` es una referencia de sesión y no bytes. */
  readonly enVivo?: boolean;
}

type Capturas = Partial<Record<TipoCapturaP5, EstadoCaptura>>;

const MENSAJES: Readonly<Record<string, string>> = {
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  ESTADO_INVALIDO: "Este proceso ya no está en el paso de verificación de identidad.",
  CAPTURAS_INCOMPLETAS: "Faltan capturas. Tomá el frente, el dorso y la selfie.",
  IMAGEN_INVALIDA: "No pudimos leer la imagen. Repetí la captura.",
  IMAGEN_DEMASIADO_GRANDE: "La imagen es demasiado grande. Repetí la captura.",
  AUTORIZACION_BIOMETRICA_REQUERIDA:
    "Necesitamos tu autorización para comparar tu imagen facial con la de la cédula.",
  PAIS_O_ESTADO_CIVIL_INVALIDO: "Elegí tu país de nacimiento y tu estado civil.",
  REQUISITOS_INCOMPLETOS:
    "Todavía faltan requisitos. Revisá las capturas: el único camino es repetirlas.",
  EDAD_FUERA_DE_RANGO: `Según la cédula, la edad no está entre ${EDAD_MINIMA_PERMITIDA} y ${EDAD_MAXIMA_PERMITIDA} años, así que el proceso no puede continuar.`,
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};

const TARJETAS: readonly {
  readonly tipo: TipoCapturaP5;
  readonly numero: number;
  readonly titulo: string;
  readonly detalle: string;
  readonly boton: string;
}[] = [
  {
    tipo: "FRENTE",
    numero: 1,
    titulo: "Frente",
    detalle: "Documento completo, enfocado y legible.",
    boton: "Tomar fotografía",
  },
  {
    tipo: "DORSO",
    numero: 2,
    titulo: "Dorso",
    detalle: "Documento completo, enfocado y legible.",
    boton: "Tomar fotografía",
  },
  {
    tipo: "SELFIE",
    numero: 3,
    titulo: "Selfie",
    // El detalle y el botón dependen del camino: con prueba de vida en vivo
    // hay movimientos que seguir; con la cámara, solo hay que encuadrarse.
    detalle: "Tu rostro dentro del óvalo, de frente y con buena luz.",
    boton: "Tomar selfie",
  },
];

/** Textos de la tarjeta de selfie cuando el proveedor tiene prueba de vida en vivo. */
const TARJETA_SELFIE_EN_VIVO = {
  titulo: "Selfie en vivo",
  detalle: "Seguí los movimientos para la prueba de vida.",
  boton: "Iniciar verificación",
} as const;

const CAMPOS_BLOQUEADOS: readonly {
  readonly id: keyof DatosIdentidad;
  readonly etiqueta: string;
}[] = [
  { id: "numeroCedula", etiqueta: "Número de cédula" },
  { id: "nombres", etiqueta: "Nombres" },
  { id: "apellidos", etiqueta: "Apellidos" },
  { id: "fechaNacimiento", etiqueta: "Fecha de nacimiento" },
  { id: "sexo", etiqueta: "Sexo" },
  { id: "nacionalidad", etiqueta: "Nacionalidad" },
];

/** `1990-04-17` → `17/04/1990`, sin pasar por `Date` (no hay zona horaria que corra el día). */
function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso;
}

function valorDelCampo(datos: DatosIdentidad | null, id: keyof DatosIdentidad): string {
  if (!datos) return "";
  const valor = datos[id];
  if (id === "fechaNacimiento" && typeof valor === "string") return formatearFecha(valor);
  return typeof valor === "boolean" ? "" : String(valor);
}

async function postear(ruta: string, cuerpo: unknown): Promise<RespuestaAnalisis & RespuestaCaptura> {
  const respuesta = await fetch(ruta, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  return (await respuesta.json().catch(() => ({}))) as RespuestaAnalisis & RespuestaCaptura;
}

export interface VerificacionIdentidadProps {
  /**
   * `true` si el backend tiene prueba de vida por streaming (AWS Rekognition
   * Face Liveness). Lo decide el servidor y baja como prop: la pantalla no
   * tiene por qué adivinar en qué modo corre el backend, y en modo mock el
   * componente de Amplify no se carga siquiera.
   */
  readonly pruebaDeVidaEnVivoDisponible?: boolean;
  /**
   * `true` con `DEMO_MODE=true`: habilita subir el frente y el dorso como
   * archivo en vez de fotografiarlos.
   *
   * Es **comodidad de demostración**, no una capacidad del producto: la regla
   * del proceso es `CAPTURA_SOLO_DESDE_CAMARA`, porque un archivo puede ser la
   * foto de una foto o una cédula ajena. Esta prop solo decide si el botón se
   * dibuja; quien lo impide de verdad es el servidor.
   */
  readonly subidaDeArchivoDisponible?: boolean;
}

export function VerificacionIdentidad({
  pruebaDeVidaEnVivoDisponible = false,
  subidaDeArchivoDisponible = false,
}: VerificacionIdentidadProps = {}) {
  const [capturas, setCapturas] = useState<Capturas>({});
  /** Toma de cámara abierta; mientras exista, el visor ocupa la pantalla. */
  const [camaraAbierta, setCamaraAbierta] = useState<TipoCapturaP5 | null>(null);
  /** Sesión de prueba de vida abierta; mientras exista, el detector toma la pantalla. */
  const [sesionEnVivo, setSesionEnVivo] = useState<{
    readonly referencia: string;
    readonly region: string;
  } | null>(null);
  const [datos, setDatos] = useState<DatosIdentidad | null>(null);
  const [requisitosServidor, setRequisitosServidor] = useState<Record<IdRequisitoP5, boolean> | null>(
    null,
  );
  const [registro, setRegistro] = useState<RegistroSeguridad | null>(null);

  const [paisNacimiento, setPaisNacimiento] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [autorizacionBiometrica, setAutorizacionBiometrica] = useState(false);

  const [enProceso, setEnProceso] = useState<TipoCapturaP5 | "ANALISIS" | "CONFIRMACION" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const paisYEstadoCivilCompletos = paisNacimiento !== "" && estadoCivil !== "";

  const requisitos: Record<IdRequisitoP5, boolean> = useMemo(
    () => ({
      // Los dos que dependen del análisis (OCR y comparación facial) se marcan
      // cuando el servidor responde; los otros dos, apenas aprueba la captura.
      cedulaVigenteYLegible: requisitosServidor?.cedulaVigenteYLegible ?? false,
      frenteYDorsoAprobados: Boolean(capturas.FRENTE?.aprobada && capturas.DORSO?.aprobada),
      pruebaDeVidaAprobada: capturas.SELFIE?.pruebaDeVidaAprobada === true,
      coincidenciaFacial: requisitosServidor?.coincidenciaFacial ?? false,
      paisYEstadoCivilCompletos,
    }),
    [capturas, requisitosServidor, paisYEstadoCivilCompletos],
  );

  const cumplidos = REQUISITOS_P5.every(({ id }) => requisitos[id]);
  const edadHabilita = datos?.edadEnRango === true;
  const puedeContinuar = cumplidos && edadHabilita && autorizacionBiometrica && enProceso === null;

  function mensajeDe(motivo: string | undefined, porDefecto: string): string {
    return (motivo && MENSAJES[motivo]) ?? porDefecto;
  }

  /**
   * Cómo viaja la selfie al servidor.
   *
   * Con prueba de vida en vivo lo que se manda es la **referencia de la
   * sesión**, no una imagen: el video fue del navegador directo a Rekognition y
   * el navegador nunca tuvo los bytes. El servidor consulta el resultado por
   * esa referencia, que es lo único confiable — un cliente podría afirmar que
   * aprobó sin haber hecho nada.
   */
  function cuerpoSelfie(actuales: Capturas): Record<string, string> | null {
    const selfie = actuales.SELFIE;
    if (!selfie?.imagen) return null;
    return selfie.enVivo === true
      ? { selfieSesion: selfie.imagen }
      : { selfie: selfie.imagen };
  }

  async function analizar(actuales: Capturas) {
    const frente = actuales.FRENTE?.imagen;
    const dorso = actuales.DORSO?.imagen;
    const selfie = cuerpoSelfie(actuales);
    if (!frente || !dorso || !selfie) return;

    setEnProceso("ANALISIS");
    try {
      const datosRespuesta = await postear("/api/p5/analisis", { frente, dorso, ...selfie });

      // Se agotaron los intentos: el caso pasó a asistencia humana y el
      // expediente ya no está en P5. Repetir la captura acá no llevaría a
      // ningún lado, así que la pantalla cede el paso.
      if (datosRespuesta.asistenciaIdentidad) {
        window.location.assign("/asistencia-identidad");
        return;
      }

      if (!datosRespuesta.ok) {
        setError(mensajeDe(datosRespuesta.motivo, "No pudimos analizar las capturas."));
        return;
      }

      setDatos(datosRespuesta.datos ?? null);
      setRequisitosServidor(datosRespuesta.requisitos ?? null);
      setRegistro(datosRespuesta.registroSeguridad ?? null);

      if (!datosRespuesta.datos) {
        setError("No pudimos leer los datos de la cédula. Repetí la captura del documento.");
        return;
      }
      if (!datosRespuesta.datos.edadEnRango) {
        setError(MENSAJES.EDAD_FUERA_DE_RANGO);
        return;
      }
      if (!datosRespuesta.requisitos?.coincidenciaFacial) {
        setError(
          "La selfie no coincide con la fotografía de la cédula. Los datos no se editan a mano: repetí la captura.",
        );
        return;
      }
      setAviso("Datos extraídos de la cédula y confirmados con la selfie en vivo.");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(null);
    }
  }

  /** Abre la sesión de prueba de vida; el detector se monta cuando responde. */
  async function iniciarPruebaDeVidaEnVivo() {
    setEnProceso("SELFIE");
    setError(null);
    setAviso(null);
    try {
      const respuesta = await fetch("/api/p5/liveness-sesion", { method: "POST" });
      const datos = (await respuesta.json().catch(() => ({}))) as {
        ok?: boolean;
        referenciaSesion?: string;
        region?: string;
        motivo?: string;
      };

      if (!datos.ok || !datos.referenciaSesion || !datos.region) {
        setError(
          datos.motivo === "PROVEEDOR_NO_DISPONIBLE"
            ? "El servicio de verificación no está disponible ahora. Intentá de nuevo en unos minutos."
            : "No pudimos iniciar la prueba de vida. Intentá de nuevo.",
        );
        return;
      }

      setSesionEnVivo({ referencia: datos.referenciaSesion, region: datos.region });
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(null);
    }
  }

  /**
   * La sesión terminó: se le pide al servidor el veredicto por referencia.
   * **No se manda ninguna puntuación desde el navegador**, a propósito.
   */
  async function registrarResultadoEnVivo(referenciaSesion: string) {
    setSesionEnVivo(null);
    setEnProceso("SELFIE");
    setError(null);
    try {
      const respuesta = await postear("/api/p5/captura", {
        tipo: "SELFIE",
        selfieSesion: referenciaSesion,
      });

      if (!respuesta.ok) {
        setError(mensajeDe(respuesta.motivo, "No pudimos registrar la prueba de vida."));
        return;
      }

      const siguientes: Capturas = {
        ...capturas,
        SELFIE: {
          imagen: referenciaSesion,
          enVivo: true,
          aprobada: respuesta.aprobada === true,
          pruebaDeVidaAprobada: respuesta.pruebaDeVidaAprobada ?? null,
          motivoRechazo: respuesta.motivoRechazo ?? null,
        },
      };
      setCapturas(siguientes);
      setDatos(null);
      setRequisitosServidor(null);

      if (respuesta.aprobada !== true) {
        setError(
          respuesta.motivoRechazo ??
            "La prueba de vida no aprobó. Buscá mejor luz y volvé a intentar.",
        );
        return;
      }

      const completas = TARJETAS.every(({ tipo }) => siguientes[tipo]?.aprobada);
      if (completas) await analizar(siguientes);
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso((actual) => (actual === "SELFIE" ? null : actual));
    }
  }

  /**
   * Registra una captura ya tomada con la cámara. La imagen llega en base64
   * desde `CapturaConCamara`; acá no se genera ninguna.
   */
  /**
   * Lee un archivo elegido y lo manda como si fuera una captura.
   *
   * Solo existe en modo demostración y solo para el documento — la guarda de
   * verdad está en el servidor (`origenCapturaAdmitido`), esto es la interfaz.
   */
  function elegirArchivo(tipo: TipoCapturaP5) {
    const entrada = document.createElement("input");
    entrada.type = "file";
    entrada.accept = "image/jpeg,image/png";
    entrada.onchange = () => {
      const archivo = entrada.files?.[0];
      if (!archivo) return;
      const lector = new FileReader();
      lector.onload = () => {
        const leido = typeof lector.result === "string" ? lector.result : "";
        if (!leido) return;
        // Sin visor abierto no hay dónde mostrar el motivo: lo toma la pantalla.
        void capturar(tipo, leido, "ARCHIVO").then((resultado) => {
          if (!resultado.ok) setError(resultado.mensaje);
        });
      };
      lector.onerror = () => setError("No pudimos leer el archivo. Probá con otro.");
      lector.readAsDataURL(archivo);
    };
    entrada.click();
  }

  /**
   * Manda una captura y **devuelve** qué pasó, en vez de escribirlo en la
   * pantalla.
   *
   * El motivo de rechazo tiene que aparecer donde está la persona: adentro del
   * visor, con la cámara abierta, lista para repetir. Antes el visor se cerraba
   * antes de postear y el mensaje quedaba en una tarjeta detrás, así que había
   * que volver a abrir la cámara para reintentar.
   *
   * Por eso el visor solo se cierra en el camino que aprueba.
   */
  async function capturar(
    tipo: TipoCapturaP5,
    imagen: string,
    origen: "CAMARA" | "ARCHIVO" = "CAMARA",
  ): Promise<ResultadoEnvioCaptura> {
    setEnProceso(tipo);
    setError(null);
    setAviso(null);
    try {
      const respuesta = await postear("/api/p5/captura", { tipo, imagen, origen });

      if (!respuesta.ok) {
        return {
          ok: false,
          mensaje: mensajeDe(respuesta.motivo, "No pudimos registrar la captura."),
        };
      }

      const siguientes: Capturas = {
        ...capturas,
        [tipo]: {
          imagen,
          aprobada: respuesta.aprobada === true,
          pruebaDeVidaAprobada: respuesta.pruebaDeVidaAprobada ?? null,
          motivoRechazo: respuesta.motivoRechazo ?? null,
        },
      };
      setCapturas(siguientes);
      // Un dato viejo del OCR no puede sobrevivir a una captura nueva.
      setDatos(null);
      setRequisitosServidor(null);

      if (respuesta.aprobada !== true) {
        return {
          ok: false,
          mensaje: respuesta.motivoRechazo ?? "La captura no aprobó los controles. Repetila.",
        };
      }

      setCamaraAbierta(null);

      const completas = TARJETAS.every(({ tipo: t }) => siguientes[t]?.aprobada);
      if (completas) await analizar(siguientes);
      return { ok: true };
    } catch {
      return { ok: false, mensaje: "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo." };
    } finally {
      setEnProceso((actual) => (actual === tipo ? null : actual));
    }
  }

  function repetirCaptura() {
    setCapturas({});
    setDatos(null);
    setRequisitosServidor(null);
    setRegistro(null);
    setError(null);
    setAviso("Empezá de nuevo por el frente de la cédula.");
  }

  async function confirmar() {
    setEnProceso("CONFIRMACION");
    setError(null);
    setAviso(null);
    try {
      const respuesta = await postear("/api/p5/identidad", {
        frente: capturas.FRENTE?.imagen,
        dorso: capturas.DORSO?.imagen,
        ...(cuerpoSelfie(capturas) ?? {}),
        paisNacimiento,
        estadoCivil,
        autorizacionBiometrica,
      });

      if (!respuesta.ok) {
        if (respuesta.requisitos) setRequisitosServidor(respuesta.requisitos);
        if (respuesta.datos) setDatos(respuesta.datos);
        setError(mensajeDe(respuesta.motivo, "No pudimos validar tu identidad."));
        return;
      }

      setRegistro(respuesta.registroSeguridad ?? null);
      setAviso("Identidad verificada.");
      window.location.assign("/p6-declaraciones");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* En pantallas anchas: captura a la izquierda, datos y botón a la
          derecha; los bloques informativos van debajo del botón. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* ------------------------------------------------------------------ */}
      {/* Bloque 1 — Captura documental y biométrica                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          Captura documental y biométrica
        </h2>

        {/* CHG-19 · restricción del producto, junto a la captura y no en una
            pantalla anterior: es acá donde la persona saca el documento, y es
            acá donde enterarse tarde cuesta el trámite entero. */}
        <p className="rounded-lg border border-azul-200 bg-azul-50 px-3 py-2 text-xs text-cuerpo dark:border-azul-700 dark:bg-azul-950">
          <span className="font-bold text-azul-800 dark:text-azul-200">Importante:</span> este
          seguro solo puede ser contratado por personas con cédula de identidad paraguaya.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {TARJETAS.map((tarjeta) => {
            const { tipo, numero } = tarjeta;
            const enVivo = tipo === "SELFIE" && pruebaDeVidaEnVivoDisponible;
            const { titulo, detalle, boton } = enVivo ? TARJETA_SELFIE_EN_VIVO : tarjeta;
            const captura = capturas[tipo];
            const aprobada = captura?.aprobada === true;
            const rechazada = captura !== undefined && !aprobada;

            return (
              <article
                key={tipo}
                className={`flex flex-col gap-2 rounded-lg border p-3 ${
                  aprobada
                    ? "border-verde-300 bg-verde-50 dark:border-verde-700 dark:bg-verde-950"
                    : rechazada
                      ? "border-rojo-300 bg-rojo-50 dark:border-rojo-700 dark:bg-rojo-950"
                      : "border-borde-sutil bg-superficie-suave"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-titulo">
                    {numero}. {titulo}
                  </p>
                  <span
                    className={`text-[11px] font-bold tracking-wide uppercase ${
                      aprobada
                        ? "text-verde-700 dark:text-verde-300"
                        : rechazada
                          ? "text-rojo-700 dark:text-rojo-300"
                          : "text-etiqueta"
                    }`}
                  >
                    {aprobada ? "Aprobada" : rechazada ? "Rechazada" : "Pendiente"}
                  </span>
                </div>

                <p className="text-xs text-cuerpo">{detalle}</p>

                {captura?.motivoRechazo ? (
                  <p className="text-xs font-semibold text-rojo-700 dark:text-rojo-300">
                    {captura.motivoRechazo}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAviso(null);
                    // La selfie tiene dos caminos según el proveedor: sesión de
                    // prueba de vida en vivo, o foto de la cámara. El frente y
                    // el dorso siempre son foto.
                    if (tipo === "SELFIE" && pruebaDeVidaEnVivoDisponible) {
                      void iniciarPruebaDeVidaEnVivo();
                      return;
                    }
                    setCamaraAbierta(tipo);
                  }}
                  disabled={enProceso !== null || sesionEnVivo !== null || camaraAbierta !== null}
                  className="mt-auto inline-flex h-10 items-center justify-center rounded-lg border-2 border-verde-600 px-3 text-xs font-bold tracking-wide text-verde-700 uppercase transition-colors hover:bg-verde-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-verde-400 dark:text-verde-300 dark:hover:bg-verde-950"
                >
                  {enProceso === tipo ? "Capturando…" : aprobada ? "Repetir" : boton}
                </button>

                {/* Subir archivo: solo demostración, solo el documento. La
                    selfie no lo ofrece nunca — es el ancla biométrica, y un
                    archivo ahí permitiría verificar con la cara de otro. */}
                {subidaDeArchivoDisponible && tipo !== "SELFIE" ? (
                  <button
                    type="button"
                    onClick={() => elegirArchivo(tipo)}
                    disabled={enProceso !== null || sesionEnVivo !== null || camaraAbierta !== null}
                    className="inline-flex items-center justify-center rounded-lg border border-dashed border-borde-sutil px-2 py-1 text-[11px] font-semibold text-etiqueta transition-colors hover:bg-superficie-suave disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Solo demo · subir archivo
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>

        {camaraAbierta ? (
          <CapturaConCamara
            tipo={camaraAbierta}
            alCapturar={(imagen) => capturar(camaraAbierta, imagen)}
            alCancelar={() => setCamaraAbierta(null)}
          />
        ) : null}

        {sesionEnVivo ? (
          <PanelPruebaDeVida
            referenciaSesion={sesionEnVivo.referencia}
            region={sesionEnVivo.region}
            alTerminar={() => registrarResultadoEnVivo(sesionEnVivo.referencia)}
            alFallar={(mensaje) => {
              setSesionEnVivo(null);
              setError(mensaje);
            }}
            alCancelar={() => {
              setSesionEnVivo(null);
              setAviso("Cancelaste la prueba de vida. Podés volver a intentarlo.");
            }}
          />
        ) : null}

        <label className="flex items-start gap-2.5 text-sm text-cuerpo">
          <input
            type="checkbox"
            checked={autorizacionBiometrica}
            onChange={(evento) => setAutorizacionBiometrica(evento.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-naranja-500"
          />
          <span>
            Autorizo la captura y comparación de mi imagen facial con la fotografía de mi cédula y
            la realización de la prueba de vida.
          </span>
        </label>
        <p className="text-xs text-etiqueta">
          La autorización inicial de tratamiento de datos sigue vigente; esta confirmación es
          específica para la biometría.
        </p>

        <p className="rounded-lg border border-azul-200 bg-azul-50 px-3 py-2 text-sm text-azul-900 dark:border-azul-700 dark:bg-azul-950 dark:text-azul-100">
          Las tres capturas deben aprobar calidad, prueba de vida y coincidencia facial.
        </p>

        {enProceso === "ANALISIS" ? (
          <p role="status" className="text-sm font-semibold text-azul-700 dark:text-azul-200">
            Analizando el documento y comparando con la selfie…
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Bloque 2 — Datos de identidad (columna derecha) + botón             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Datos de identidad
          </h2>
          <p className="text-xs text-cuerpo">
            Los datos se extraen de la cédula y se confirman con la selfie en vivo.
          </p>
        </div>

        {/* CHG-16 · leyenda de revisión antes de validar (reunión 00:15:51).
            El OCR confunde caracteres —una O por un 0, una letra de más— y
            quien no mira los campos se entera del error cuando ya firmó un
            documento con su nombre mal escrito. Va acá arriba, antes de los
            campos, y no junto al botón: pedir que revise después de haber
            bajado toda la columna llega tarde. */}
        <p className="rounded-lg border border-naranja-300 bg-naranja-50 px-3 py-2 text-xs text-cuerpo dark:border-naranja-700 dark:bg-naranja-950">
          <span className="font-bold text-naranja-800 dark:text-naranja-200">Revisá tus datos</span>{" "}
          antes de validar: la lectura automática puede confundir caracteres parecidos.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {CAMPOS_BLOQUEADOS.map(({ id, etiqueta }) => (
            <div key={id} className="flex flex-col gap-1">
              <label
                htmlFor={`p5-${id}`}
                className="flex items-center gap-1.5 text-xs font-semibold text-etiqueta"
              >
                <span aria-hidden="true">🔒</span>
                {etiqueta}
              </label>
              <input
                id={`p5-${id}`}
                type="text"
                readOnly
                // Bloqueado por regla de P5: el valor lo pone el OCR y no
                // existe forma de editarlo desde acá.
                aria-readonly="true"
                value={valorDelCampo(datos, id)}
                placeholder="Se completa automáticamente"
                className="h-11 w-full rounded-lg border border-borde-sutil bg-superficie-suave px-3 text-base text-titulo placeholder:text-etiqueta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500"
              />
            </div>
          ))}

          <div className="flex flex-col gap-1">
            <label htmlFor="p5-pais" className="text-xs font-semibold text-etiqueta">
              País de nacimiento *
            </label>
            <select
              id="p5-pais"
              value={paisNacimiento}
              onChange={(evento) => setPaisNacimiento(evento.target.value)}
              className="h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500"
            >
              <option value="">Elegí una opción</option>
              {PAISES_NACIMIENTO.map((pais) => (
                <option key={pais} value={pais}>
                  {pais}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="p5-estado-civil" className="text-xs font-semibold text-etiqueta">
              Estado civil *
            </label>
            <select
              id="p5-estado-civil"
              value={estadoCivil}
              onChange={(evento) => setEstadoCivil(evento.target.value)}
              className="h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500"
            >
              <option value="">Elegí una opción</option>
              {ESTADOS_CIVILES.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
          </p>
        ) : null}
        {aviso ? (
          <p role="status" className="text-sm font-semibold text-verde-700 dark:text-verde-300">
            {aviso}
          </p>
        ) : null}
      </section>

      {/* Validar identidad y continuar — a la vista, sin scroll */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={!puedeContinuar}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:bg-superficie-suave disabled:text-etiqueta disabled:opacity-60 sm:w-auto sm:self-start"
        >
          {enProceso === "CONFIRMACION" ? "Validando…" : "Validar identidad y continuar →"}
        </button>
        {!puedeContinuar ? (
          <p className="text-xs text-etiqueta">
            Se habilita con los cinco requisitos cumplidos, la autorización biométrica marcada y
            una edad entre {EDAD_MINIMA_PERMITIDA} y {EDAD_MAXIMA_PERMITIDA} años según la cédula.
          </p>
        ) : null}
      </div>
      </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Debajo del botón: edad, datos que no coinciden y requisitos          */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">

      {/* Edad calculada automáticamente */}
      <div
        className={`flex flex-col gap-1 rounded-lg border px-3 py-2.5 ${
          datos && !datos.edadEnRango
            ? "border-rojo-300 bg-rojo-50 dark:border-rojo-700 dark:bg-rojo-950"
            : "border-azul-200 bg-azul-50 dark:border-azul-700 dark:bg-azul-950"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Edad calculada automáticamente
          </p>
          <p className="text-lg font-bold text-titulo tabular-nums">
            {datos ? `${datos.edad} años` : "—"}
          </p>
        </div>
        <p className="text-xs text-cuerpo">
          Se calcula desde la fecha de nacimiento de la cédula y se incorpora al FIPF. Debe estar
          entre {EDAD_MINIMA_PERMITIDA} y {EDAD_MAXIMA_PERMITIDA} años.
        </p>
      </div>

      {/* ¿Los datos no coinciden? */}
      <div className="flex flex-col gap-1 rounded-lg border border-rojo-200 bg-rojo-50 px-3 py-2.5 dark:border-rojo-800 dark:bg-rojo-950">
        <p className="text-[11px] font-bold tracking-wide text-rojo-800 uppercase dark:text-rojo-200">
          ¿Los datos no coinciden?
        </p>
        <p className="text-xs text-rojo-900 dark:text-rojo-100">
          Los campos extraídos de la cédula no se editan manualmente. Si algo no coincide, hay
          que volver a fotografiar el documento. Si el error persiste, el proceso no va a poder
          continuar de forma digital.
        </p>
        <button
          type="button"
          onClick={repetirCaptura}
          disabled={enProceso !== null}
          className="self-start text-sm font-semibold text-rojo-800 underline decoration-rojo-300 underline-offset-2 hover:text-rojo-900 disabled:opacity-50 dark:text-rojo-200 dark:decoration-rojo-600"
        >
          Repetir captura
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Requisitos para continuar                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie px-3 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Requisitos para continuar
          </h2>
          <EnlaceAclaracion
            documento="requisitosIdentidad"
            className="text-xs font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            Ver detalle
          </EnlaceAclaracion>
        </div>
        <ul className="flex flex-col gap-1">
          {REQUISITOS_P5.map(({ id, rotulo }) => {
            const cumplido = requisitos[id];
            return (
              <li key={id} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    cumplido
                      ? "bg-verde-600 text-white dark:bg-verde-500"
                      : "border border-borde-sutil bg-superficie-suave text-etiqueta"
                  }`}
                >
                  {cumplido ? "✓" : "○"}
                </span>
                <span className={cumplido ? "font-semibold text-titulo" : "text-cuerpo"}>
                  {rotulo}
                </span>
                <span className="sr-only">{cumplido ? "cumplido" : "pendiente"}</span>
              </li>
            );
          })}
        </ul>
      </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Registro de seguridad                                               */}
      {/* ------------------------------------------------------------------ */}
      {registro ? (
        <section className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-4">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Registro de seguridad
          </h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-etiqueta">Fecha y hora</dt>
              <dd className="text-titulo tabular-nums">
                {new Date(registro.fecha).toLocaleString("es-PY")}
              </dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-etiqueta">IP</dt>
              <dd className="text-titulo tabular-nums">{registro.ip}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-etiqueta">Prueba de vida</dt>
              <dd
                className={`font-semibold ${
                  registro.pruebaDeVidaAprobada
                    ? "text-verde-700 dark:text-verde-300"
                    : "text-rojo-700 dark:text-rojo-300"
                }`}
              >
                {registro.pruebaDeVidaAprobada ? "Aprobada" : "No aprobada"}
              </dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-etiqueta">Coincidencia biométrica</dt>
              <dd
                className={`font-semibold ${
                  registro.coincidenciaFacialAprobada
                    ? "text-verde-700 dark:text-verde-300"
                    : "text-rojo-700 dark:text-rojo-300"
                }`}
              >
                {registro.coincidenciaFacialAprobada ? "Aprobada" : "No aprobada"}
              </dd>
            </div>
          </dl>

          <dl className="flex flex-col gap-1 text-xs">
            {(
              [
                ["Frente", registro.referenciaFrente, registro.hashFrenteCedula],
                ["Dorso", registro.referenciaDorso, registro.hashDorsoCedula],
                ["Selfie", registro.referenciaSelfie, registro.hashSelfie],
              ] as const
            ).map(([rotulo, referencia, hash]) => (
              <div key={rotulo} className="flex flex-col">
                <dt className="text-etiqueta">
                  {rotulo} · {referencia}
                </dt>
                <dd className="font-mono break-all text-etiqueta">SHA-256 {hash}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
