/**
 * Contenido del paquete documental: la Solicitud de Seguro y el Formulario de
 * Identificación de Persona Física, proyectados desde el Expediente.
 *
 * Este módulo decide **qué dice** cada documento; `src/documentos/` decide
 * cómo se dibuja y `src/documentos/servicio.ts` lo cierra, lo hashea y lo
 * guarda. La separación importa: lo que se firma es el contenido, y el
 * contenido tiene que poder leerse, testearse y auditarse sin abrir un PDF.
 *
 * ## Fuentes de verdad
 *
 * - `docs/Solicitud.pdf` — los seis bloques de la Solicitud y su orden:
 *   proponente, planes y coberturas, beneficiario, declaración médica,
 *   declaraciones finales/pago/entrega, y aceptación/firma/trazabilidad.
 * - `docs/FIPF.pdf` — los seis bloques del FIPF: datos personales y canales
 *   verificados, datos laborales/económicos/fiscales, condición PEP,
 *   declaraciones y autorizaciones, evidencias digitales vinculadas, y firma
 *   electrónica y trazabilidad.
 * - `docs/ESPECIFICACION_PANTALLAS.md` → P8, que fija los códigos
 *   (`PROP-00018425`, `FIPF-00018425`), la marca `PDF cerrado · hash
 *   registrado` y que ambos comparten correlativo.
 *
 * No se agrega ningún campo que no esté en esos documentos, y los literales de
 * las declaraciones se toman de `textos-p6.ts` y `textos-p7.ts` —los mismos
 * que la persona tuvo a la vista— en vez de reescribirse acá.
 *
 * ## Respaldo normativo
 *
 * Filas de `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`:
 *
 * - 16 — *"Generar el FIPF con datos personales, laborales, económicos y
 *   origen de fondos"*, Res. SEPRELAD 71/19, art. 26(1)(a-j).
 * - 34 — *"El cliente firma electrónicamente la Solicitud de Seguro y el
 *   FIPF"*, Ley 6822/21, arts. 38(1), 42(5) y 67-69.
 * - 35 — *"Cerrar los documentos antes de firmar y conservar sus huellas
 *   digitales"*, Ley 6822/21, arts. 42(5), 61 y 66.
 * - 47 — *"Vincular póliza, Solicitud, FIPF, pago y firmas mediante
 *   correlativos o hashes"*, Res. SS SG. 215/17, punto 14; Ley 6822/21,
 *   arts. 44-46.
 * - 77 — *"Generar un hash individual para Solicitud, FIPF y póliza"*, Ley
 *   6822/21, arts. 42(5), 44 y 66.
 * - 9 — *"Aclarar que la Solicitud de Seguro todavía no constituye una póliza
 *   emitida"*, Código Civil, arts. 1348 y 1355.
 *
 * Módulo sin dependencias de `node:*` a propósito, igual que `catalogo.ts` y
 * `textos-p6.ts`: el contenido lo puede leer tanto el servidor que genera el
 * PDF como la pantalla de P8 que muestra el resumen, sin arrastrar
 * `node:crypto` al bundle del navegador. El hash se calcula en el servicio.
 */
import { ORDEN_PLANES, PLANES, formatearGuaranies } from "./catalogo";
import { enmascararCorreo } from "./correo";
import { enmascararCelular } from "./telefono";
import { firmantesDe } from "./firmantes-documento";
import type { DocumentoFirmable } from "./firmantes-documento";
import {
  TEXTOS_DECLARACIONES_P6,
  TEXTO_ADVERTENCIA_ART_1556,
  TEXTO_DECLARACION_CUENTA_PROPIA,
  TEXTO_DECLARACION_LICITUD_Y_VERACIDAD,
  VERSION_TEXTOS_DECLARACIONES_P6,
} from "./textos-p6";
import { calcularEdadDesde } from "./tipos";
import type { Expediente, RespuestaDeclaracion } from "./tipos";

// ---------------------------------------------------------------------------
// Códigos: un correlativo, dos prefijos
// ---------------------------------------------------------------------------

export const PREFIJO_SOLICITUD = "PROP";
export const PREFIJO_FIPF = "FIPF";

/**
 * `00018425` → `PROP-00018425` / `FIPF-00018425`.
 *
 * **Un solo correlativo para los dos documentos** (CLAUDE.md → "Reglas
 * transversales de integraciones": *"Solicitud y FIPF: mismo correlativo,
 * prefijos distintos"*). El correlativo lo acuña `generarNumeroPropuesta` al
 * cerrarse el paquete (`Expediente.numeroPropuesta`); acá solo se le pone el
 * prefijo. Que
 * sean funciones y no dos campos independientes del expediente es lo que hace
 * imposible que los documentos se separen: no hay ningún lugar donde escribir
 * un código de FIPF que no derive del mismo número que la Solicitud.
 */
export function codigoSolicitud(correlativo: string): string {
  return `${PREFIJO_SOLICITUD}-${correlativo}`;
}

export function codigoFipf(correlativo: string): string {
  return `${PREFIJO_FIPF}-${correlativo}`;
}

/** `PROP-00018425` → `00018425`; `null` si el código no tiene un prefijo conocido. */
export function correlativoDeCodigo(codigo: string): string | null {
  for (const prefijo of [PREFIJO_SOLICITUD, PREFIJO_FIPF]) {
    if (codigo.startsWith(`${prefijo}-`)) return codigo.slice(prefijo.length + 1);
  }
  return null;
}

/** Versión con la que nace un paquete. Una modificación posterior exige subirla (regla #4). */
export const VERSION_INICIAL_PAQUETE = 1;

// ---------------------------------------------------------------------------
// QR de verificación
// ---------------------------------------------------------------------------

/**
 * Base de la URL que codifica el QR impreso en cada documento.
 *
 * **Decisión de producto, no obligación legal.** No hay fila en
 * `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` que exija un QR:
 * la fila 77 exige el hash individual de cada documento y la 47 exige
 * vincularlos por correlativo o hash, cosas que el paquete ya cumple sin el
 * QR. El QR es la manera de que quien tenga el PDF impreso o reenviado pueda
 * llegar a esa verificación sin tipear el código a mano.
 */
export const URL_BASE_VERIFICACION_POR_DEFECTO = "https://segurolotengo.com/verificar";

/**
 * El QR codifica **solo** la URL de verificación, con el código del
 * documento. Deliberadamente no lleva el hash: el QR se dibuja dentro del PDF
 * que después se hashea, así que un hash impreso en el propio documento no
 * podría ser nunca el suyo. La verificación es del otro lado — se busca el
 * código y se compara el hash registrado contra el del archivo que tenga
 * quien consulta.
 *
 * Tampoco lleva ningún dato de la persona: un QR es texto plano para
 * cualquiera que lo escanee, y el código de propuesta no identifica a nadie
 * por sí solo (regla inviolable #7).
 */
export function urlDeVerificacion(codigo: string, base: string = URL_BASE_VERIFICACION_POR_DEFECTO): string {
  return `${base.replace(/\/+$/, "")}/${codigo}`;
}

// ---------------------------------------------------------------------------
// Constantes de los formularios
// ---------------------------------------------------------------------------

/**
 * Campos que los formularios muestran con un valor fijo porque el flujo no
 * los captura y no puede variar:
 *
 * - `PAIS_RESIDENCIA` — `docs/Solicitud.pdf` bloque 1 ("RESIDENCIA: Paraguay")
 *   y `docs/FIPF.pdf` bloque 1 ("PAÍS DE RESIDENCIA"). El producto se
 *   comercializa solo en Paraguay y P5 no pregunta residencia.
 * - `TIPO_DOCUMENTO` — `docs/FIPF.pdf` bloque 1 ("DOCUMENTO: Cédula
 *   paraguaya"). P5 solo admite cédula paraguaya.
 * - `PROPOSITO_OPERACION` — `docs/FIPF.pdf` bloque 2 ("PROPÓSITO"). La única
 *   operación del flujo es pagar el premio de esta póliza.
 */
export const PAIS_RESIDENCIA = "Paraguay";
export const TIPO_DOCUMENTO = "Cédula paraguaya";
export const PROPOSITO_OPERACION = "Pago del premio del seguro";

/**
 * Origen de fondos declarado, derivado de la situación laboral de P6.
 *
 * ⚠️ **Brecha conocida.** `docs/FIPF.pdf` tiene un campo "ORIGEN DE FONDOS"
 * con valor propio ("Ingresos laborales") y la fila 16 de la matriz de
 * cumplimiento lo exige expresamente (Res. SEPRELAD 71/19, art. 26(1)(a-j)),
 * pero **P6 no lo captura como campo**: lo único que el flujo recoge sobre el
 * origen del dinero es la situación laboral, el ingreso mensual declarado y la
 * declaración de origen lícito de P7. Antes que inventar un campo nuevo en P6
 * —que la especificación de pantallas no tiene— se deriva la etiqueta de la
 * situación laboral que la persona sí eligió. La derivación es una decisión de
 * producto; el dato de respaldo es real.
 *
 * Si SEPRELAD o Alianza exigen el origen de fondos como declaración
 * independiente, hay que agregarlo a P6 en `ESPECIFICACION_PANTALLAS.md`
 * primero y recién después acá.
 */
const ORIGEN_DE_FONDOS_POR_SITUACION: Readonly<Record<string, string>> = {
  "Relación de dependencia": "Ingresos laborales en dependencia",
  "Independiente": "Ingresos de trabajo independiente",
  "Funcionario público": "Ingresos del sector público",
  "Empleador/a o socio/a": "Ingresos empresariales/societarios",
  "Jubilado/a": "Haberes jubilatorios",
  "Estudiante": "Otros ingresos declarados",
  "Sin actividad remunerada": "Otros ingresos declarados",
};

export const ORIGEN_DE_FONDOS_POR_DEFECTO = "Otros ingresos declarados";

export function origenDeFondos(situacionLaboral: string): string {
  return ORIGEN_DE_FONDOS_POR_SITUACION[situacionLaboral] ?? ORIGEN_DE_FONDOS_POR_DEFECTO;
}

// ---------------------------------------------------------------------------
// Modelo de contenido
// ---------------------------------------------------------------------------

export interface EncabezadoDocumento {
  /** Identidad del documento único: `PROP-00018425` (D-11). */
  readonly codigo: string;
  /** Código interno de la sección FIPF, impreso en su propia sección. */
  readonly codigoVinculado: string;
  readonly correlativo: string;
  readonly version: number;
  readonly cerradoEn: string;
  readonly titulo: string;
  /**
   * Enlace que codifica el QR de verificación, o `null` en los documentos que
   * **no se verifican**.
   *
   * El comprobante de pago es el único caso: no es un instrumento con huella
   * registrada sino una constancia de una operación que ya está probada por el
   * certificado y por la Solicitud firmada. Dibujarle un QR sugeriría que se
   * puede verificar por sí solo, y no se puede.
   */
  readonly urlVerificacion: string | null;
  /**
   * Fecha de la solicitud con sello de tiempo (CMP-09).
   *
   * Es `cerradoEn` presentado para leer, y va en el encabezado y no en una
   * sección porque aplica al documento entero: es el instante que fija qué
   * decía la propuesta, y del que corre el mes del art. 1556.
   */
  readonly selloDeTiempo: string;
}

export interface CampoDocumento {
  readonly etiqueta: string;
  readonly valor: string;
}

export interface CoberturaDocumento {
  readonly rotulo: string;
  readonly valor: string;
}

export interface PlanDocumento {
  readonly nombre: string;
  readonly premioAnual: string;
  readonly elegido: boolean;
  readonly coberturas: readonly CoberturaDocumento[];
}

export interface DeclaracionDocumento {
  readonly numero: number;
  readonly titulo: string;
  readonly texto: string;
  readonly respuesta: RespuestaDeclaracion;
  /** Respuesta que habilita la emisión automática, para poder marcar cuál se dio. */
  readonly respuestaHabilitante: RespuestaDeclaracion;
}

export interface ContenidoSolicitud {
  /** Bloque 1 — Datos del proponente / asegurado. */
  readonly proponente: readonly CampoDocumento[];
  /** Bloque 2 — Planes y coberturas solicitadas. */
  readonly planes: readonly PlanDocumento[];
  readonly carencias: string;
  readonly notaRentaHospitalaria: string;
  /** Bloque 3 — Beneficiario por fallecimiento. */
  readonly beneficiario: readonly CampoDocumento[];
  /** Bloque 4 — Declaración médica (declaraciones 1, 2 y 3 de P6). */
  readonly declaracionesMedicas: readonly DeclaracionDocumento[];
  readonly advertenciaElegibilidad: string;
  /** Bloque 5 — Declaraciones finales, pago y entrega. */
  readonly declaracionesFinales: readonly string[];
  readonly referencias: readonly CampoDocumento[];
  readonly leyendaNoEsPoliza: string;
}

export interface ContenidoFipf {
  /** Código interno de esta sección: `FIPF-<correlativo>` (D-11). */
  readonly codigoSeccion: string;
  readonly leyendaNorma: string;
  /** Bloque 1 — Datos personales y canales verificados. */
  readonly personales: readonly CampoDocumento[];
  /** Bloque 2 — Datos laborales, económicos y fiscales. */
  readonly laborales: readonly CampoDocumento[];
  /** Bloque 3 — Condición PEP. */
  readonly pep: DeclaracionDocumento;
  readonly advertenciaPep: string;
  /** Bloque 4 — Declaraciones y autorizaciones. */
  readonly declaraciones: readonly string[];
  /** Bloque 5 — Evidencias digitales vinculadas. */
  readonly evidencias: readonly string[];
}

/**
 * El documento único (D-11): un encabezado, y las dos secciones adentro.
 *
 * `solicitud` y `fipf` dejaron de ser dos documentos y pasaron a ser dos
 * **secciones** del mismo archivo. Conservan su nombre porque siguen siendo
 * dos formularios con vida normativa propia —Res. SS SG. 215/17 y Res.
 * SEPRELAD 71/19— y cada uno imprime su código interno; lo que ya no tienen es
 * archivo, huella ni acto de firma separados.
 */
export interface ContenidoPaquete {
  readonly encabezado: EncabezadoDocumento;
  readonly correlativo: string;
  readonly version: number;
  readonly cerradoEn: string;
  readonly solicitud: ContenidoSolicitud;
  readonly fipf: ContenidoFipf;
  /** Advertencia del art. 1556 CC (CMP-09), impresa en la sección de la Solicitud. */
  readonly advertenciaArt1556: string;
  /** Bloque de firmas del documento, derivado de `firmantes-documento.ts` (D-13). */
  readonly firmantes: readonly CampoDocumento[];
  readonly leyendaFirma: string;
  /** Versión de los literales de declaraciones que quedaron impresos. */
  readonly versionTextos: string;
}

// ---------------------------------------------------------------------------
// Armado
// ---------------------------------------------------------------------------

export type CampoFaltante =
  | "numeroPropuesta"
  | "plan"
  | "identidad"
  | "datosComplementarios"
  | "beneficiario"
  | "declaraciones"
  | "canalWhatsapp"
  | "canalEmail";

export type ResultadoContenidoPaquete =
  | { readonly ok: true; readonly contenido: ContenidoPaquete }
  | { readonly ok: false; readonly faltantes: readonly CampoFaltante[] };

export interface OpcionesContenido {
  readonly cerradoEn: string;
  readonly version?: number;
  readonly urlBaseVerificacion?: string;
}

/**
 * Literal de una declaración de P6, buscado **por número** y no por posición.
 * Los formularios citan las declaraciones por su número (la 5 de P6 es la
 * casilla 1 del bloque 5 de la Solicitud, por ejemplo), así que indexar el
 * arreglo sería atarse a un orden que no es el que los documentos usan.
 */
function literalDeclaracion(numero: number): { readonly titulo: string; readonly texto: string } {
  const entrada = TEXTOS_DECLARACIONES_P6.find((declaracion) => declaracion.numero === numero);
  if (!entrada) throw new Error(`Falta el literal de la declaración ${numero} en textos-p6.ts.`);
  return entrada;
}

/** `1990-04-15` → `15/04/1990`, como lo muestran los dos formularios. */
export function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : iso;
}

function marca(valor: boolean): string {
  return valor ? "Sí" : "No";
}

/**
 * Arma el contenido de **los dos documentos a la vez**, desde un mismo
 * expediente y con un mismo instante de cierre.
 *
 * Que sea una sola función y no dos es deliberado: la Solicitud y el FIPF se
 * firman en un único acto (regla inviolable #3) y comparten correlativo, así
 * que no debe existir un camino por el que se arme uno sin el otro, ni por el
 * que cada uno tome una foto distinta del expediente.
 *
 * Devuelve la lista de campos faltantes en vez de lanzar: la máquina de
 * estados garantiza que un expediente en PAGO_CONFIRMADO los tiene todos,
 * pero el tipo `Expediente` no lo sabe, y un faltante es un error de
 * programación que conviene poder registrar como evidencia con nombre y
 * apellido.
 */
export function armarContenidoPaquete(
  expediente: Expediente,
  opciones: OpcionesContenido,
): ResultadoContenidoPaquete {
  const {
    numeroPropuesta,
    plan,
    identidad,
    datosComplementarios: datos,
    beneficiario,
    declaraciones,
    canalWhatsapp,
    canalEmail,
  } = expediente;

  const faltantes: CampoFaltante[] = [];
  if (!numeroPropuesta) faltantes.push("numeroPropuesta");
  if (!plan) faltantes.push("plan");
  if (!identidad) faltantes.push("identidad");
  if (!datos) faltantes.push("datosComplementarios");
  if (!beneficiario) faltantes.push("beneficiario");
  if (!declaraciones) faltantes.push("declaraciones");
  if (!canalWhatsapp) faltantes.push("canalWhatsapp");
  if (!canalEmail) faltantes.push("canalEmail");

  if (
    !numeroPropuesta ||
    !plan ||
    !identidad ||
    !datos ||
    !beneficiario ||
    !declaraciones ||
    !canalWhatsapp ||
    !canalEmail
  ) {
    return { ok: false, faltantes };
  }

  const correlativo = numeroPropuesta;
  const version = opciones.version ?? VERSION_INICIAL_PAQUETE;
  const cerradoEn = opciones.cerradoEn;
  const base = opciones.urlBaseVerificacion;

  const codigoProp = codigoSolicitud(correlativo);
  const codigoFip = codigoFipf(correlativo);

  const whatsapp = enmascararCelular(canalWhatsapp.valor);
  const correo = enmascararCorreo(canalEmail.valor);
  // Regla inviolable #8: la edad se calcula contra la fecha de nacimiento
  // extraída de la cédula, nunca contra un campo declarado.
  const edad = calcularEdadDesde(identidad.fechaNacimiento, new Date(cerradoEn));

  const declaracionPorNumero = (
    numero: number,
    respuesta: RespuestaDeclaracion,
    habilitante: RespuestaDeclaracion,
  ): DeclaracionDocumento => {
    const entrada = literalDeclaracion(numero);
    return {
      numero,
      titulo: entrada.titulo,
      texto: entrada.texto,
      respuesta,
      respuestaHabilitante: habilitante,
    };
  };

  // --- Solicitud -----------------------------------------------------------

  const solicitud: ContenidoSolicitud = {
    proponente: [
      { etiqueta: "Nombres", valor: identidad.nombres },
      { etiqueta: "Apellidos", valor: identidad.apellidos },
      { etiqueta: "Cédula", valor: identidad.numeroCedula },
      { etiqueta: "Fecha de nacimiento", valor: formatearFecha(identidad.fechaNacimiento) },
      { etiqueta: "Edad", valor: `${edad} años` },
      { etiqueta: "País de nacimiento", valor: identidad.paisNacimiento },
      { etiqueta: "Sexo", valor: identidad.sexo },
      { etiqueta: "Estado civil", valor: identidad.estadoCivil },
      { etiqueta: "Nacionalidad", valor: identidad.nacionalidad },
      { etiqueta: "Residencia", valor: PAIS_RESIDENCIA },
      { etiqueta: "Domicilio y ciudad", valor: `${datos.domicilio} · ${datos.ciudad}` },
      { etiqueta: "WhatsApp verificado", valor: whatsapp },
      { etiqueta: "Correo verificado", valor: correo },
      { etiqueta: "Situación laboral", valor: datos.situacionLaboral },
      { etiqueta: "Actividad", valor: datos.actividad },
      { etiqueta: "Profesión", valor: datos.profesion },
      {
        etiqueta: "Empresa / ingreso mensual",
        valor: `${datos.empresa ?? "—"} · ${formatearGuaranies(datos.ingresoMensualDeclaradoGs)}`,
      },
    ],
    planes: ORDEN_PLANES.map((id) => {
      const p = PLANES[id];
      return {
        nombre: p.nombre,
        premioAnual: formatearGuaranies(p.premioAnualGs),
        elegido: id === plan.planId,
        coberturas: [
          { rotulo: "Diagnóstico de cáncer", valor: formatearGuaranies(p.indemnizacionCancerGs) },
          { rotulo: "Fallecimiento", valor: formatearGuaranies(p.muerteCualquierCausaGs) },
          { rotulo: "Renta hospitalaria · máx. 15 días", valor: formatearGuaranies(p.rentaHospitalariaTotalGs) },
          { rotulo: "Valor diario", valor: `${formatearGuaranies(p.rentaHospitalariaPorDiaGs)}/día` },
          { rotulo: "Gastos médicos por accidente", valor: formatearGuaranies(p.gastosMedicosAccidenteGs) },
        ],
      };
    }),
    carencias: "Carencias: cáncer 180 días · renta hospitalaria 30 días · demás coberturas 1 día.",
    notaRentaHospitalaria:
      "Renta fija por cada 24 horas continuas; 15 días acumulables entre hospitalizaciones por año de vigencia.",
    beneficiario:
      beneficiario.tipo === "HEREDEROS_LEGALES"
        ? [{ etiqueta: "Beneficiario", valor: "Herederos legales — 100%" }]
        : [
            { etiqueta: "Beneficiario", valor: "Una persona designada — 100%" },
            { etiqueta: "Nombre completo", valor: beneficiario.nombreCompleto ?? "" },
            {
              etiqueta: "Parentesco y domicilio",
              valor: `${beneficiario.parentesco ?? ""} · ${beneficiario.domicilio ?? ""}`,
            },
          ],
    declaracionesMedicas: [
      declaracionPorNumero(1, declaraciones.estadoDeSalud, "SI"),
      declaracionPorNumero(2, declaraciones.antecedentesDeContratacion, "NO"),
      declaracionPorNumero(3, declaraciones.enfermedadesDiagnosticadas, "NO"),
    ],
    advertenciaElegibilidad:
      "Una respuesta incompatible deriva el caso a análisis y detiene pago, firma y emisión automática.",
    // Bloque 5 de `docs/Solicitud.pdf` más las declaraciones que la Matriz V4
    // §4 manda integrar al documento en vez de pedirlas como casilla
    // ("no casilla adicional"): licitud y veracidad, y cuenta propia (CMP-20).
    declaracionesFinales: [
      literalDeclaracion(5).texto,
      literalDeclaracion(4).texto,
      literalDeclaracion(6).texto,
      TEXTO_DECLARACION_LICITUD_Y_VERACIDAD,
      TEXTO_DECLARACION_CUENTA_PROPIA,
    ],
    // D-08 · el documento se cierra **antes** de que exista ninguna operación
    // de pago, así que no puede citar una referencia de Bancard ni un medio:
    // todavía no se eligieron. Lo que sí se imprime es el premio, que es el
    // importe que la persona está aceptando pagar al firmar.
    referencias: [
      { etiqueta: "Correlativo / futura póliza", valor: correlativo },
      { etiqueta: "Premio final", valor: formatearGuaranies(plan.premioAnualGs) },
    ],
    leyendaNoEsPoliza:
      "La presente Solicitud no constituye póliza emitida. Alianza Garantía emitirá la póliza mediante SEBAOT.",
  };

  // --- FIPF ----------------------------------------------------------------

  const fipf: ContenidoFipf = {
    codigoSeccion: codigoFip,
    leyendaNorma: "En base a la Resolución N.º 71/19 de la SEPRELAD",
    personales: [
      { etiqueta: "Nombres", valor: identidad.nombres },
      { etiqueta: "Apellidos", valor: identidad.apellidos },
      { etiqueta: "Cédula", valor: identidad.numeroCedula },
      { etiqueta: "Fecha de nacimiento", valor: formatearFecha(identidad.fechaNacimiento) },
      { etiqueta: "Edad", valor: `${edad} años` },
      { etiqueta: "País de nacimiento", valor: identidad.paisNacimiento },
      { etiqueta: "Sexo", valor: identidad.sexo },
      { etiqueta: "Estado civil", valor: identidad.estadoCivil },
      { etiqueta: "Nacionalidad", valor: identidad.nacionalidad },
      { etiqueta: "País de residencia", valor: PAIS_RESIDENCIA },
      { etiqueta: "Domicilio", valor: datos.domicilio },
      { etiqueta: "Ciudad", valor: datos.ciudad },
      { etiqueta: "Documento", valor: TIPO_DOCUMENTO },
      { etiqueta: "WhatsApp verificado", valor: whatsapp },
      { etiqueta: "Correo verificado", valor: correo },
    ],
    laborales: [
      { etiqueta: "Situación laboral", valor: datos.situacionLaboral },
      { etiqueta: "Actividad", valor: datos.actividad },
      { etiqueta: "Profesión", valor: datos.profesion },
      { etiqueta: "Empresa / empleador", valor: datos.empresa ?? "—" },
      { etiqueta: "Ingreso mensual declarado", valor: formatearGuaranies(datos.ingresoMensualDeclaradoGs) },
      { etiqueta: "Origen de fondos", valor: origenDeFondos(datos.situacionLaboral) },
      { etiqueta: "Propósito", valor: PROPOSITO_OPERACION },
    ],
    pep: declaracionPorNumero(8, declaraciones.condicionPep, "NO"),
    advertenciaPep:
      "Una respuesta afirmativa genera un número de caso diferente y deriva el expediente a análisis; no produce emisión automática.",
    // Los cinco literales del bloque 4 de `docs/FIPF.pdf`. Los tres primeros y
    // el quinto son las declaraciones 5, 3 y 7 de P6 más la de origen lícito
    // de P7; la autorización de verificación y conservación es la del bloque.
    declaraciones: [
      literalDeclaracion(5).texto,
      "Declaro que el WhatsApp y el correo verificados son de mi propiedad y están bajo mi control.",
      TEXTO_DECLARACION_LICITUD_Y_VERACIDAD,
      "Autorizo a Alianza Garantía e Interseguros a verificar la información y conservar las evidencias del proceso.",
      literalDeclaracion(7).texto,
    ],
    evidencias: [
      "Cédula paraguaya: frente y dorso",
      "Selfie en vivo, prueba de vida y coincidencia biométrica",
      "Verificación independiente de WhatsApp",
      "Verificación independiente de correo electrónico",
      "Fecha, hora, IP, sesión, versión, PDF y huellas digitales",
      `Prueba de vida: ${marca(identidad.captura.pruebaDeVidaAprobada)} · Coincidencia facial: ${marca(identidad.captura.coincidenciaFacialAprobada)}`,
    ],
  };

  return {
    ok: true,
    contenido: {
      encabezado: {
        codigo: codigoProp,
        codigoVinculado: codigoFip,
        correlativo,
        version,
        cerradoEn,
        titulo: "Solicitud de Seguro de Vida Oncológico y FIPF",
        urlVerificacion: urlDeVerificacion(codigoProp, base),
        selloDeTiempo: formatearSelloDeTiempo(cerradoEn),
      },
      correlativo,
      version,
      cerradoEn,
      solicitud,
      fipf,
      advertenciaArt1556: TEXTO_ADVERTENCIA_ART_1556,
      firmantes: bloqueDeFirmantes("PAQUETE"),
      leyendaFirma:
        "Un solo acto de firma cubre este documento completo: la Solicitud y el FIPF ya no son " +
        "dos archivos que puedan firmarse por separado. No se genera Nota de Cobertura.",
      versionTextos: VERSION_TEXTOS_DECLARACIONES_P6,
    },
  };
}

/**
 * Bloque de firmas del PDF, derivado de la configuración de D-13.
 *
 * No es una lista escrita a mano: sale de `firmantes-documento.ts`, que es la
 * misma fuente de la que salen el orden en que el adaptador aplica las firmas
 * y lo que la consola muestra de cada una. Cuando eran tres listas separadas,
 * el PDF podía anunciar un firmante que el proveedor no aplicaba.
 */
function bloqueDeFirmantes(documento: DocumentoFirmable): readonly CampoDocumento[] {
  return firmantesDe(documento).map((firmante) => ({
    etiqueta: firmante.rotulo,
    valor:
      firmante.modalidad === "PREFIRMADO"
        ? `${firmante.leyenda} Aplicada antes de la entrega al cliente.`
        : firmante.leyenda,
  }));
}

/**
 * Sello de tiempo del documento (CMP-09): la fecha de la solicitud, presentada
 * para leer y con la hora, porque del instante exacto cuelga el plazo del art.
 * 1556 y el orden respecto de la firma.
 */
function formatearSelloDeTiempo(iso: string): string {
  const fecha = new Date(iso);
  const dosDigitos = (n: number) => String(n).padStart(2, "0");
  return (
    `${dosDigitos(fecha.getUTCDate())}/${dosDigitos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()} ` +
    `${dosDigitos(fecha.getUTCHours())}:${dosDigitos(fecha.getUTCMinutes())} UTC`
  );
}

