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
import { NACIONALIDADES_ADMITIDAS, SEXOS_ADMITIDOS, esCampoCorregible } from "@/domain/cotejo-ocr";
import {
  ACTIVIDADES,
  CIUDADES,
  ORIGENES_FONDOS,
  PROFESIONES,
  SITUACIONES_LABORALES,
} from "@/domain/catalogo-p6";
import { rutaSiguienteDe } from "@/domain/rutas-flujo";

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
 * **Única excepción, y solo con `DEMO_MODE=true`:** las tres capturas se pueden
 * subir como archivo (`subidaDeArchivoDisponible`), porque en una demostración
 * a distancia no siempre se tiene la cédula en la mano ni a la persona frente
 * al equipo. Incluida la selfie, que es el ancla biométrica: el porqué de
 * admitirla igual está en `origenCapturaAdmitido`. Esta prop solo decide si el
 * botón se dibuja; quien lo impide de verdad es el servidor,
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
  CORREO_INVALIDO: "Revisá el correo: no parece una dirección válida.",
  // Dice qué hacer, no solo qué pasó: si el dato es realmente otro, el camino
  // es repetir la captura, no seguir escribiendo.
  CORRECCION_NO_COINCIDE:
    "Lo que escribiste no se parece a lo que la lectura automática leyó de tu cédula. Si lo " +
    "escribiste tal como figura en el documento, marcá la confirmación de abajo y volvé a " +
    "validar.",
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

/**
 * Rangos de ingreso del canvas (F5c): la persona elige un rango, no tipea un
 * monto. El valor que viaja es el representante numérico del rango —el mismo
 * campo `ingresoMensualDeclaradoGs` de siempre—, así el dominio y el FIPF no
 * cambian; la etiqueta es lo que la persona ve y elige.
 */
const RANGOS_INGRESO: readonly { readonly etiqueta: string; readonly valor: string }[] = [
  { etiqueta: "Hasta 2.800.000", valor: "2800000" },
  { etiqueta: "De 2.800.001 a 5.000.000", valor: "5000000" },
  { etiqueta: "De 5.000.001 a 10.000.000", valor: "10000000" },
  { etiqueta: "De 10.000.001 a 20.000.000", valor: "20000000" },
  { etiqueta: "Más de 20.000.000", valor: "25000000" },
];

const CAMPOS_BLOQUEADOS: readonly {
  readonly id: keyof DatosIdentidad;
  readonly etiqueta: string;
}[] = [
  { id: "numeroCedula", etiqueta: "Número de cédula" },
  { id: "nombres", etiqueta: "Nombres" },
  { id: "apellidos", etiqueta: "Apellidos" },
  { id: "fechaNacimiento", etiqueta: "Fecha de nacimiento" },
  { id: "nacionalidad", etiqueta: "Nacionalidad" },
];

/*
 * El sexo **no** está en esa lista, y no es un olvido.
 *
 * Hasta el 21-ago-2026 se dibujaba como los demás: lo prellenaba el OCR y se
 * corregía tocando el candado. Andres pidió que deje de completarse solo y se
 * elija. Es el campo donde el prellenado rendía menos y costaba más: son dos
 * valores, elegir uno cuesta un toque, y en cambio una lectura errada pasaba
 * inadvertida justo por venir ya puesta —el candado invita a revisar, no a
 * dudar— hasta aparecer en un documento firmado.
 *
 * Sigue viajando en `correcciones.sexo`, que es el mismo campo que el servidor
 * ya cotejaba contra `SEXOS_ADMITIDOS` (no por distancia, como los nombres:
 * son dos valores conocidos), así que el contrato del endpoint no cambia. Lo
 * que sí cambia es que la pantalla ahora exige elegir antes de continuar, en
 * vez de dejar que el servidor caiga al valor del OCR cuando no viene nada.
 */

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
   * foto de una foto, una cédula ajena o el rostro de otra persona. Esta prop
   * solo decide si el botón se dibuja; quien lo impide de verdad es el servidor.
   */
  readonly subidaDeArchivoDisponible?: boolean;
  /**
   * Al completar la validación, en vez de navegar al paso siguiente (el
   * default, para la página v2). Existe para que la página de inscripción del
   * flujo v3 monte este componente como sección y avance el gating sin
   * recargar (lote F2).
   */
  readonly onCompletado?: () => void;
  /** Ídem para la salida a asistencia humana tras agotar los intentos. */
  readonly onAsistencia?: () => void;
}

/** Misma caja que usan los campos de identidad de esta pantalla. */
const CLASE_CAMPO_P5 =
  "h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500";

/** Selector con su rótulo, para los cinco campos de lista del bloque económico. */
function SelectorP5({
  id,
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  opciones: readonly string[];
  onChange: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-etiqueta">
        {etiqueta} *
      </label>
      <select
        id={id}
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        className={CLASE_CAMPO_P5}
      >
        <option value="">Elegí una opción</option>
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    </div>
  );
}

export function VerificacionIdentidad({
  pruebaDeVidaEnVivoDisponible = false,
  subidaDeArchivoDisponible = false,
  onCompletado,
  onAsistencia,
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
  const [paisResidencia, setPaisResidencia] = useState("");
  // Datos laborales y económicos: se mudaron desde la pantalla de
  // declaraciones (maqueta p.4). El servidor los valida enteros.
  const [domicilio, setDomicilio] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [situacionLaboral, setSituacionLaboral] = useState("");
  const [actividad, setActividad] = useState("");
  const [profesion, setProfesion] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [ingreso, setIngreso] = useState("");
  const [origenFondos, setOrigenFondos] = useState("");
  // CHG-14/17 · el correo se declara acá, sin código que lo verifique (D-06).
  // El doble tipeo es lo que reemplaza al OTP como control de tipeo, así que
  // se conserva tal cual estaba en la pantalla que desapareció.
  // CHG-15 · correcciones a lo que leyó el OCR. Solo nombres y apellidos: los
  // otros cuatro campos siguen bloqueados porque de ellos cuelgan el corte de
  // edad y el bloqueo por cédula. Vacío significa "sin corregir".
  const [correcciones, setCorrecciones] = useState<Partial<Record<string, string>>>({});
  const [correo, setCorreo] = useState("");
  const [correoRepetido, setCorreoRepetido] = useState("");
  const [autorizacionBiometrica, setAutorizacionBiometrica] = useState(false);
  // F5d · el cotejo no dio y la persona confirma que escribió lo de su cédula.
  const [pideConfirmacion, setPideConfirmacion] = useState(false);
  const [confirmaCorrecciones, setConfirmaCorrecciones] = useState(false);

  const [enProceso, setEnProceso] = useState<TipoCapturaP5 | "ANALISIS" | "CONFIRMACION" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /** Lo elige la persona; nunca se prellena desde el OCR (ver CAMPOS_BLOQUEADOS). */
  const sexoElegido = correcciones.sexo ?? "";
  const paisYEstadoCivilCompletos =
    paisNacimiento !== "" && paisResidencia !== "" && estadoCivil !== "";
  const complementariosCompletos =
    domicilio.trim() !== "" &&
    ciudad !== "" &&
    situacionLaboral !== "" &&
    actividad !== "" &&
    profesion !== "" &&
    ingreso.trim() !== "" &&
    origenFondos !== "";
  // Comparación laxa a propósito: acá solo se comprueba que las dos
  // escrituras coincidan. Que la dirección sea válida lo decide el dominio,
  // que es quien la normaliza y la guarda.
  const correoCoincide =
    correo.trim() !== "" && correo.trim().toLowerCase() === correoRepetido.trim().toLowerCase();

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
  // El correo entra en la condición de avance: sin él, la persona llegaría a
  // firmar sin una dirección a donde mandarle la póliza, y el error recién se
  // vería cuando el documento no llega.
  const puedeContinuar =
    cumplidos &&
    edadHabilita &&
    autorizacionBiometrica &&
    correoCoincide &&
    complementariosCompletos &&
    sexoElegido !== "" &&
    enProceso === null;

  // F5c · el patrón de faltantes del canvas: una lista que nombra qué falta,
  // con el ancla del primer campo para desplazarse. Reemplaza al párrafo que
  // enumeraba condiciones en abstracto («no se entiende qué falta»).
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false);
  const faltantes: { texto: string; ancla: string | null }[] = [];
  if (!cumplidos) faltantes.push({ texto: "completar y aprobar las tres capturas", ancla: "p5-capturas" });
  if (datos && !edadHabilita) faltantes.push({ texto: "una edad entre 18 y 64 años según la cédula", ancla: null });
  if (!autorizacionBiometrica) faltantes.push({ texto: "marcar la autorización biométrica", ancla: "p5-autorizacion-biometrica" });
  if (sexoElegido === "") faltantes.push({ texto: "elegir tu sexo", ancla: "p5-sexo" });
  if (!paisYEstadoCivilCompletos) faltantes.push({ texto: "completar país y estado civil", ancla: "p5-pais" });
  if (!correoCoincide) faltantes.push({ texto: "escribir tu correo dos veces igual", ancla: "p5-correo" });
  if (!complementariosCompletos) {
    const primerVacio =
      domicilio.trim() === "" ? "p5-domicilio"
      : ciudad === "" ? "p5-ciudad"
      : situacionLaboral === "" ? "p5-situacion-laboral"
      : actividad === "" ? "p5-actividad"
      : profesion === "" ? "p5-profesion"
      : ingreso === "" ? "p5-ingreso"
      : "p5-origen-fondos";
    faltantes.push({ texto: "completar tus datos complementarios", ancla: primerVacio });
  }

  function irAlPrimerFaltante() {
    setMostrarFaltantes(true);
    const ancla = faltantes.find((falta) => falta.ancla !== null)?.ancla;
    if (ancla) {
      document.getElementById(ancla)?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(ancla)?.focus?.();
    }
  }

  /** Botón del canvas «Completar el resto con datos de ejemplo (demo)». */
  function completarConEjemplos() {
    if (sexoElegido === "") setCorrecciones((actuales) => ({ ...actuales, sexo: SEXOS_ADMITIDOS[0] }));
    if (paisNacimiento === "") setPaisNacimiento("Paraguay");
    if (paisResidencia === "") setPaisResidencia("Paraguay");
    if (estadoCivil === "") setEstadoCivil(ESTADOS_CIVILES[0]);
    if (domicilio.trim() === "") setDomicilio("Avda. Mcal. López 1234, Asunción");
    if (ciudad === "") setCiudad(CIUDADES[0]);
    if (situacionLaboral === "") setSituacionLaboral(SITUACIONES_LABORALES[0]);
    if (actividad === "") setActividad(ACTIVIDADES[0]);
    if (profesion === "") setProfesion(PROFESIONES[0]);
    if (empresa.trim() === "") setEmpresa("Ejemplo S.A.");
    if (ingreso === "") setIngreso(RANGOS_INGRESO[1].valor);
    if (origenFondos === "") setOrigenFondos(ORIGENES_FONDOS[0]);
    if (correo.trim() === "") {
      setCorreo("maria.ejemplo@correo.com");
      setCorreoRepetido("maria.ejemplo@correo.com");
    }
    setAutorizacionBiometrica(true);
  }

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
        if (onAsistencia) {
          onAsistencia();
        } else {
          window.location.assign("/asistencia-identidad");
        }
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
   * Solo existe en modo demostración — la guarda de verdad está en el servidor
   * (`origenCapturaAdmitido`), esto es la interfaz.
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
      // Un dato viejo del OCR no puede sobrevivir a una captura nueva, y una
      // corrección tampoco: quedaría corrigiendo una lectura que ya no existe.
      setCorrecciones({});
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
        paisResidencia,
        estadoCivil,
        correo,
        datosComplementarios: {
          domicilio,
          ciudad,
          situacionLaboral,
          actividad,
          profesion,
          empresa,
          ingresoMensualDeclaradoGs: ingreso,
          origenFondos,
        },
        ...correcciones,
        confirmaCorrecciones,
        autorizacionBiometrica,
      });

      if (!respuesta.ok) {
        if (respuesta.requisitos) setRequisitosServidor(respuesta.requisitos);
        if (respuesta.datos) setDatos(respuesta.datos);
        if (respuesta.motivo === "CORRECCION_NO_COINCIDE") setPideConfirmacion(true);
        setError(mensajeDe(respuesta.motivo, "No pudimos validar tu identidad."));
        return;
      }

      setRegistro(respuesta.registroSeguridad ?? null);
      setAviso("Identidad verificada.");
      if (onCompletado) {
        onCompletado();
      } else {
        window.location.assign(rutaSiguienteDe("/identidad") ?? "/declaraciones");
      }
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Maqueta p.4: a la izquierda las tomas y, debajo, los datos que las
          tomas completan; a la derecha el correo, la advertencia y la acción.
          Los bloques informativos van debajo de las dos columnas. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* Columna izquierda: primero las tomas y debajo lo que las tomas
          completan. El orden cuenta la historia de arriba hacia abajo —se
          fotografía, y de ahí salen los datos— y es el de la maqueta
          aprobada (p.4). */}
      <div className="flex flex-col gap-3">
        <section id="p5-capturas" className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Captura documental y biométrica
          </h2>


          <div className="grid gap-3 sm:grid-cols-3">
            {TARJETAS.map((tarjeta) => {
              const { tipo, numero } = tarjeta;
              const enVivo = tipo === "SELFIE" && pruebaDeVidaEnVivoDisponible;
              const { titulo, detalle, boton } = enVivo ? TARJETA_SELFIE_EN_VIVO : tarjeta;
              const captura = capturas[tipo];
              const aprobada = captura?.aprobada === true;
              const rechazada = captura !== undefined && !aprobada;
              // F5d · la calidad puede aprobar y la comparación facial no: si
              // el aviso solo vive junto al botón, la tarjeta en verde miente.
              const noCoincide =
                tipo === "SELFIE" && aprobada && requisitosServidor?.coincidenciaFacial === false;

              return (
                <article
                  key={tipo}
                  className={`flex flex-col gap-2 rounded-lg border p-3 ${
                    aprobada && !noCoincide
                      ? "border-verde-300 bg-verde-50 dark:border-verde-700 dark:bg-verde-950"
                      : rechazada || noCoincide
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
                        aprobada && !noCoincide
                          ? "text-verde-700 dark:text-verde-300"
                          : rechazada || noCoincide
                            ? "text-rojo-700 dark:text-rojo-300"
                            : "text-etiqueta"
                      }`}
                    >
                      {noCoincide
                        ? "No coincide"
                        : aprobada
                          ? "Aprobada"
                          : rechazada
                            ? "Rechazada"
                            : "Pendiente"}
                    </span>
                  </div>

                  <p className="text-xs text-cuerpo">{detalle}</p>
                  {noCoincide ? (
                    <p className="text-xs font-semibold text-rojo-700 dark:text-rojo-300">
                      La selfie no coincide con la fotografía de la cédula. Repetila.
                    </p>
                  ) : null}

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

                  {/* Subir archivo: solo demostración, y desde el 21-ago-2026
                      también para la selfie. Lo que la habilita no es que sea
                      inocua —no lo es, ver `origenCapturaAdmitido`— sino que
                      este camino ya renunció a la prueba de vida, así que
                      exigir la cámara acá no compraba la garantía que parecía
                      comprar. El origen queda sellado en la evidencia. */}
                  {subidaDeArchivoDisponible ? (
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
              id="p5-autorizacion-biometrica"
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
            antes de validar: la lectura automática puede confundir caracteres parecidos. Nombres,
            apellidos y nacionalidad son editables; lo corregido se coteja con tu cédula.
          </p>

          {subidaDeArchivoDisponible ? (
            <button
              type="button"
              onClick={completarConEjemplos}
              className="self-start rounded-lg border border-dashed border-borde-sutil px-3 py-1.5 text-xs font-semibold text-etiqueta hover:text-cuerpo"
            >
              Completar el resto con datos de ejemplo (demo)
            </button>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPOS_BLOQUEADOS.map(({ id, etiqueta }) => {
              // F5c (feedback de Andres con cédulas reales): los tres campos
              // corregibles son EDITABLES directos — el candado-botón parecía
              // decorativo y, con una lectura mala del OCR, dejaba a la
              // persona atrapada mirando "BLI" sin salida visible. El número
              // de cédula y la fecha de nacimiento siguen bloqueados: de
              // ellos cuelgan el bloqueo por cédula y el corte de edad, y
              // ante un error se repite la captura. Lo editado viaja en
              // `correcciones` y el servidor lo coteja contra la cédula
              // (CHG-15), igual que siempre.
              const editable = esCampoCorregible(id);
              const valorMostrado = correcciones[id] ?? valorDelCampo(datos, id);

              // F5d · la nacionalidad es de lista: las cédulas admitidas solo
              // pueden decir estos valores, y un texto libre cotejado contra
              // una lectura mala bloqueaba la corrección legítima.
              if (id === "nacionalidad") {
                const valorSelect = NACIONALIDADES_ADMITIDAS.includes(
                  valorMostrado.trim().toUpperCase(),
                )
                  ? valorMostrado.trim().toUpperCase()
                  : "";
                return (
                  <div key={id} className="flex flex-col gap-1">
                    <label
                      htmlFor={`p5-${id}`}
                      className="flex items-center gap-1.5 text-xs font-semibold text-etiqueta"
                    >
                      <span aria-hidden="true">🔓</span>
                      {etiqueta} · editable
                    </label>
                    <select
                      id={`p5-${id}`}
                      value={valorSelect}
                      onChange={(evento) =>
                        setCorrecciones((actuales) => ({ ...actuales, [id]: evento.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500"
                    >
                      <option value="">Elegí una opción</option>
                      {NACIONALIDADES_ADMITIDAS.map((valor) => (
                        <option key={valor} value={valor}>
                          {valor}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              return (
                <div key={id} className="flex flex-col gap-1">
                  <label
                    htmlFor={`p5-${id}`}
                    className="flex items-center gap-1.5 text-xs font-semibold text-etiqueta"
                  >
                    <span aria-hidden="true">{editable ? "🔓" : "🔒"}</span>
                    {etiqueta}
                    {editable ? " · editable" : " · no editable"}
                  </label>
                  <input
                    id={`p5-${id}`}
                    type="text"
                    readOnly={!editable}
                    aria-readonly={!editable}
                    value={valorMostrado}
                    onChange={(evento) =>
                      setCorrecciones((actuales) => ({ ...actuales, [id]: evento.target.value }))
                    }
                    placeholder="Se completa automáticamente"
                    className={`h-11 w-full rounded-lg border px-3 text-base text-titulo placeholder:text-etiqueta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500 ${
                      editable
                        ? "border-borde-sutil bg-superficie"
                        : "border-borde-sutil bg-superficie-suave"
                    }`}
                  />
                </div>
              );
            })}

            {/* El sexo se elige, no se lee: ver la nota en CAMPOS_BLOQUEADOS.
                Entre los dos valores que puede decir una cédula y nada más —un
                campo libre acá no arreglaría una lectura, abriría la puerta a
                cualquier cadena en un dato que va al documento firmado. */}
            <div className="flex flex-col gap-1">
              <label htmlFor="p5-sexo" className="text-xs font-semibold text-etiqueta">
                Sexo *
              </label>
              <select
                id="p5-sexo"
                value={sexoElegido}
                onChange={(evento) =>
                  setCorrecciones((actuales) => ({ ...actuales, sexo: evento.target.value }))
                }
                className="h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500"
              >
                <option value="">Elegí una opción</option>
                {SEXOS_ADMITIDOS.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            </div>

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
              <label htmlFor="p5-pais-residencia" className="text-xs font-semibold text-etiqueta">
                País de residencia *
              </label>
              <select
                id="p5-pais-residencia"
                value={paisResidencia}
                onChange={(evento) => setPaisResidencia(evento.target.value)}
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

          {/* El error de esta pantalla **ya no se dibuja acá**: vivía a media
              pantalla del botón que lo produce, así que quien apretaba
              "Validar identidad y continuar" no veía por qué no había pasado
              nada. Ahora va debajo del botón. El aviso de éxito sí se queda:
              acompaña a los datos que acaban de completarse, que es lo que
              está mirando la persona cuando aparece. */}
          {aviso ? (
            <p role="status" className="text-sm font-semibold text-verde-700 dark:text-verde-300">
              {aviso}
            </p>
          ) : null}
        </section>
      </div>

      {/* Columna derecha: el correo primero (CHG-14), después la
          advertencia del documento y la acción. */}
      <div className="flex flex-col gap-3">
        <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
              Correo electrónico
            </h2>
            <p className="text-xs text-cuerpo">Escribilo dos veces para evitar errores.</p>
          </div>

          {/* CHG-17 · el aviso de criticidad se conserva palabra por palabra: es
              el único control que queda sobre el correo desde que no lleva
              código, y por ahí llegan la póliza y la factura. */}
          <p className="rounded-lg border border-naranja-300 bg-naranja-50 px-3 py-2 text-xs text-cuerpo dark:border-naranja-700 dark:bg-naranja-950">
            El correo es fundamental para la recepción de documentos y la contratación del seguro.
            Asegurate de que sea el correcto.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="p5-correo" className="text-xs font-semibold text-etiqueta">
                Correo electrónico *
              </label>
              <input
                id="p5-correo"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={correo}
                onChange={(evento) => setCorreo(evento.target.value)}
                placeholder="nombre@ejemplo.com"
                className="h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo placeholder:text-etiqueta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="p5-correo-repetido" className="text-xs font-semibold text-etiqueta">
                Confirmá tu correo *
              </label>
              <input
                id="p5-correo-repetido"
                type="email"
                inputMode="email"
                // Sin autocompletado: si el navegador rellena los dos campos con
                // el mismo valor, el doble tipeo deja de comprobar nada.
                autoComplete="off"
                value={correoRepetido}
                onChange={(evento) => setCorreoRepetido(evento.target.value)}
                placeholder="nombre@ejemplo.com"
                aria-describedby="p5-correo-coincidencia"
                className="h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo placeholder:text-etiqueta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500"
              />
              <p id="p5-correo-coincidencia" className="text-xs text-etiqueta">
                {correoRepetido.trim() === ""
                  ? "Repetí la dirección para confirmarla."
                  : correoCoincide
                    ? "Las dos direcciones coinciden."
                    : "Las dos direcciones no coinciden todavía."}
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Datos complementarios — bloque 2 del FIPF                           */}
        {/* ------------------------------------------------------------------ */}
        {/* Se mudaron desde la pantalla de declaraciones (maqueta p.4): la
            maqueta los pone junto a la identidad, que es donde la persona ya
            está mirando sus propios datos. Los valida el servidor entero, con
            el mismo intérprete de siempre. */}
        <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
              Datos complementarios
            </h2>
            <p className="text-xs text-cuerpo">Los marcados con * son obligatorios.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="p5-domicilio" className="text-xs font-semibold text-etiqueta">
                1. Domicilio *
              </label>
              <input
                id="p5-domicilio"
                type="text"
                value={domicilio}
                onChange={(evento) => setDomicilio(evento.target.value)}
                placeholder="Calle, número y barrio"
                className={CLASE_CAMPO_P5}
              />
            </div>

            <SelectorP5
              id="p5-ciudad"
              etiqueta="2. Ciudad"
              valor={ciudad}
              opciones={CIUDADES}
              onChange={setCiudad}
            />
            <SelectorP5
              id="p5-situacion-laboral"
              etiqueta="3. Situación laboral"
              valor={situacionLaboral}
              opciones={SITUACIONES_LABORALES}
              onChange={setSituacionLaboral}
            />
            <SelectorP5
              id="p5-actividad"
              etiqueta="4. Actividad"
              valor={actividad}
              opciones={ACTIVIDADES}
              onChange={setActividad}
            />
            <SelectorP5
              id="p5-profesion"
              etiqueta="5. Profesión"
              valor={profesion}
              opciones={PROFESIONES}
              onChange={setProfesion}
            />

            <div className="flex flex-col gap-1">
              <label htmlFor="p5-empresa" className="text-xs font-semibold text-etiqueta">
                6. Empresa / empleador
              </label>
              <input
                id="p5-empresa"
                type="text"
                value={empresa}
                onChange={(evento) => setEmpresa(evento.target.value)}
                placeholder="Opcional"
                className={CLASE_CAMPO_P5}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="p5-ingreso" className="text-xs font-semibold text-etiqueta">
                7. Ingreso mensual declarado *
              </label>
              <select
                id="p5-ingreso"
                value={ingreso}
                onChange={(evento) => setIngreso(evento.target.value)}
                className={CLASE_CAMPO_P5}
              >
                <option value="">Elegí un rango</option>
                {RANGOS_INGRESO.map((rango) => (
                  <option key={rango.valor} value={rango.valor}>
                    {rango.etiqueta}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <SelectorP5
                id="p5-origen-fondos"
                etiqueta="8. Origen principal de fondos"
                valor={origenFondos}
                opciones={ORIGENES_FONDOS}
                onChange={setOrigenFondos}
              />
            </div>
          </div>
        </section>

        {/* CHG-19 · restricción del producto. La maqueta la pone en rojo y
            en la columna de la acción, no dentro de la tarjeta de captura:
            es una condición para contratar, no una instrucción de cómo
            fotografiar. */}
        <p className="rounded-lg border border-rojo-300 bg-rojo-50 px-3 py-2 text-xs text-rojo-900 dark:border-rojo-700 dark:bg-rojo-950 dark:text-rojo-100">
          <span className="font-bold">Importante:</span> este seguro solo puede ser contratado
          por personas con cédula de identidad paraguaya.
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              if (!puedeContinuar) {
                irAlPrimerFaltante();
                return;
              }
              void confirmar();
            }}
            aria-disabled={!puedeContinuar}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:bg-superficie-suave disabled:text-etiqueta disabled:opacity-60 sm:w-auto sm:self-start"
          >
            {enProceso === "CONFIRMACION" ? "Validando…" : "Validar identidad y continuar →"}
          </button>
          {pideConfirmacion ? (
            <label className="flex items-start gap-2 rounded-lg border border-naranja-300 bg-naranja-50 p-3 text-sm text-cuerpo dark:border-naranja-700 dark:bg-naranja-950">
              <input
                type="checkbox"
                checked={confirmaCorrecciones}
                onChange={(evento) => setConfirmaCorrecciones(evento.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                Confirmo que escribí mis nombres y apellidos{" "}
                <span className="font-bold">exactamente como figuran en mi cédula</span>. La
                corrección queda registrada.
              </span>
            </label>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-rojo-300 bg-rojo-50 px-3 py-2 text-sm font-semibold text-rojo-800 dark:border-rojo-700 dark:bg-rojo-950 dark:text-rojo-300"
            >
              {error}
            </p>
          ) : null}
          {/* La lista de acá tiene que ser **la misma** que la condición de
              `puedeContinuar`. Cuando no lo era, alguien con los cinco
              requisitos en verde, la biometría tildada, el correo repetido y la
              edad en rango podía quedarse mirando un botón apagado sin nada
              que se lo explicara: le faltaba el sexo, o un campo del bloque
              económico, y el texto le juraba que con lo otro alcanzaba. */}
          {!puedeContinuar && mostrarFaltantes && faltantes.length > 0 ? (
            <p className="text-sm font-semibold text-rojo-700 dark:text-rojo-300" role="alert">
              Te falta: {faltantes.map((falta) => falta.texto).join(", ")}.
            </p>
          ) : null}
          {!puedeContinuar && !mostrarFaltantes ? (
            <button
              type="button"
              onClick={irAlPrimerFaltante}
              className="self-start text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 dark:text-azul-200"
            >
              Mostrame qué me falta
            </button>
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
          Nombres, apellidos, sexo y nacionalidad se corrigen tocando el candado, y lo corregido
          se coteja contra lo que leyó la cédula. El número de cédula y la fecha de nacimiento no
          se editan: si alguno no coincide, hay que volver a fotografiar el documento. Si el error
          persiste, el proceso no va a poder continuar de forma digital.
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
