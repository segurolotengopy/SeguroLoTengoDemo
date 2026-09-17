/**
 * Caso de uso de **03D · Completá tus datos** (flujo v4).
 *
 * ## Qué decide esta pantalla y qué no
 *
 * Completa la identidad con lo que la persona declara —país de nacimiento,
 * nacionalidad, sexo, estado civil— y guarda su domicilio. **No verifica
 * identidad**: eso ya pasó en 03C. Tampoco cambia el estado del expediente.
 *
 * ## D-31, que es la regla dura de acá
 *
 * El arte y la especificación aprobada declaran **editables** el número de
 * cédula y la fecha de nacimiento. Andres decidió que se dejen editar y que el
 * cambio se registre, pero que **la elegibilidad y el bloqueo se calculen con
 * el valor que el OCR leyó**. Eso es exactamente lo que hace este módulo: los
 * valores declarados que difieren de la lectura **se asientan en la
 * evidencia** y no tocan la `Identidad`, que sigue teniendo los del documento.
 *
 * No es una sutileza: de la fecha de nacimiento cuelga el corte de edad (regla
 * inviolable #8) y de la cédula, el bloqueo por expediente terminal (regla
 * #11). Si un campo editable los moviera, las dos reglas se esquivarían
 * escribiendo otro número.
 *
 * Nombres, apellidos y sexo sí se corrigen —arreglar la lectura, no
 * reemplazarla— y se cotejan con `cotejo-ocr.ts`, igual que en v2. La
 * nacionalidad no: el documento la escribe como gentilicio y el catálogo
 * aprobado como nombre de país, así que se valida contra el catálogo.
 */
import { randomUUID } from "node:crypto";
import type { EvidenceStore } from "../../ports/evidence-store";
import { cotejarCorreccion } from "../cotejo-ocr";
import { registrarDatosPersonalesV4 } from "../expediente";
import type {
  DatosPersonalesV4,
  Expediente,
  Identidad,
  RegistroEvidencia,
} from "../tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal-whatsapp";
import {
  CIUDADES_V4,
  CIUDAD_OTRA_V4,
  ESTADOS_CIVILES_V4,
  NACIONALIDADES_V4,
  PAISES_V4,
  SEXOS_V4,
} from "./catalogos-03d";

export const PASO_EVIDENCIA_DATOS_PERSONALES_V4 = "V4_03D_DATOS_PERSONALES";

export interface DependenciasDatosPersonalesV4 {
  readonly expedientes: RepositorioExpediente;
  readonly evidencias: EvidenceStore;
  readonly ahora?: () => string;
  readonly nuevoId?: () => string;
}

export interface EntradaDatosPersonalesV4 {
  readonly expedienteId: string;
  /** Corrección de lo que leyó el OCR; vacío significa «sin corregir». */
  readonly nombres?: string;
  readonly apellidoPaterno?: string;
  readonly apellidoMaterno?: string;
  /**
   * Declarados y editables (D-31). **No deciden nada**: se registran y se
   * comparan contra la lectura, que es la que gobierna edad y bloqueo.
   */
  readonly numeroCedulaDeclarado?: string;
  readonly fechaNacimientoDeclarada?: string;
  readonly sexo: string;
  readonly estadoCivil: string;
  readonly paisNacimiento: string;
  readonly nacionalidad: string;
  readonly paisResidencia: string;
  readonly domicilio: string;
  readonly ciudad: string;
  readonly barrio: string;
  readonly contexto: ContextoPeticion;
}

export type MotivoRechazoDatosPersonalesV4 =
  | "EXPEDIENTE_NO_ENCONTRADO"
  | "ESTADO_INVALIDO"
  | "IDENTIDAD_FALTANTE"
  | "CAMPOS_INVALIDOS"
  | "CORRECCION_NO_COINCIDE";

export type ResultadoDatosPersonalesV4 =
  | {
      readonly ok: true;
      readonly expedienteId: string;
      readonly identidad: Identidad;
      readonly datosPersonales: DatosPersonalesV4;
      /** `true` si algún dato declarado difiere de lo que leyó el OCR (D-31). */
      readonly hayDatosDeclaradosDistintos: boolean;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoRechazoDatosPersonalesV4;
      /** Qué campos rechazó la validación: la pantalla los marca en rojo. */
      readonly camposInvalidos?: readonly string[];
    };

/** El estado en el que la pantalla 03D tiene sentido. */
const ESTADO_REQUERIDO: Expediente["estado"] = "IDENTIDAD_VERIFICADA";

function formatearDetalle(datos: Readonly<Record<string, string | number | boolean>>): string {
  return Object.entries(datos)
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(" · ");
}

/** Una ciudad del catálogo, o cualquier texto cuando se eligió «otra». */
function ciudadValida(ciudad: string): boolean {
  const limpia = ciudad.trim();
  if (limpia === "") return false;
  return CIUDADES_V4.includes(limpia) || limpia !== CIUDAD_OTRA_V4;
}

export async function registrarDatosPersonales(
  deps: DependenciasDatosPersonalesV4,
  entrada: EntradaDatosPersonalesV4,
): Promise<ResultadoDatosPersonalesV4> {
  const ahora = deps.ahora ?? (() => new Date().toISOString());
  const nuevoId = deps.nuevoId ?? (() => randomUUID());
  const fecha = ahora();

  // Validación de catálogos **en el servidor**. Que la pantalla use selectores
  // no alcanza: cualquiera arma la petición a mano, y lo que se guarda termina
  // impreso en la Solicitud y en el FIPF.
  const camposInvalidos: string[] = [];
  if (!SEXOS_V4.includes(entrada.sexo)) camposInvalidos.push("sexo");
  if (!ESTADOS_CIVILES_V4.includes(entrada.estadoCivil)) camposInvalidos.push("estadoCivil");
  if (!PAISES_V4.includes(entrada.paisNacimiento)) camposInvalidos.push("paisNacimiento");
  if (!NACIONALIDADES_V4.includes(entrada.nacionalidad)) camposInvalidos.push("nacionalidad");
  if (!PAISES_V4.includes(entrada.paisResidencia)) camposInvalidos.push("paisResidencia");
  if (entrada.domicilio.trim() === "") camposInvalidos.push("domicilio");
  if (!ciudadValida(entrada.ciudad)) camposInvalidos.push("ciudad");
  if (entrada.barrio.trim() === "") camposInvalidos.push("barrio");

  if (camposInvalidos.length > 0) {
    return { ok: false, motivo: "CAMPOS_INVALIDOS", camposInvalidos };
  }

  const expediente = await deps.expedientes.obtenerPorId(entrada.expedienteId);
  if (!expediente) return { ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" };
  if (expediente.estado !== ESTADO_REQUERIDO) return { ok: false, motivo: "ESTADO_INVALIDO" };
  if (!expediente.identidad) return { ok: false, motivo: "IDENTIDAD_FALTANTE" };

  const leida = expediente.identidad;

  // Nombres y apellidos: el arte los parte en tres campos y el modelo los
  // guarda en dos. Se recompone el apellido antes de cotejar, porque lo que
  // el OCR leyó es una sola cadena.
  const apellidos = [entrada.apellidoPaterno, entrada.apellidoMaterno]
    .map((parte) => (parte ?? "").trim())
    .filter((parte) => parte !== "")
    .join(" ");

  const cotejoNombres = cotejarCorreccion("nombres", leida.nombres, entrada.nombres);
  const cotejoApellidos = cotejarCorreccion("apellidos", leida.apellidos, apellidos);
  const cotejoSexo = cotejarCorreccion("sexo", leida.sexo, entrada.sexo);
  const queNoCotejan = [
    cotejoNombres.ok ? null : "nombres",
    cotejoApellidos.ok ? null : "apellidos",
    cotejoSexo.ok ? null : "sexo",
  ].filter((campo): campo is string => campo !== null);

  if (!cotejoNombres.ok || !cotejoApellidos.ok || !cotejoSexo.ok) {
    return { ok: false, motivo: "CORRECCION_NO_COINCIDE", camposInvalidos: queNoCotejan };
  }

  // D-31 · lo declarado que difiere de lo leído se **registra**, no se aplica.
  const cedulaDeclarada = (entrada.numeroCedulaDeclarado ?? "").trim();
  const fechaDeclarada = (entrada.fechaNacimientoDeclarada ?? "").trim();
  const cedulaDistinta = cedulaDeclarada !== "" && cedulaDeclarada !== leida.numeroCedula;
  const fechaDistinta = fechaDeclarada !== "" && fechaDeclarada !== leida.fechaNacimiento;

  const identidad: Identidad = {
    ...leida,
    nombres: cotejoNombres.valor,
    apellidos: cotejoApellidos.valor,
    sexo: cotejoSexo.valor,
    // **La nacionalidad no se coteja contra el OCR, y es deliberado.** El
    // documento la escribe como gentilicio («PARAGUAYA») y el catálogo
    // aprobado de 03D la expresa como **nombre de país** («Paraguay»): son dos
    // vocabularios distintos, así que compararlos rechazaría la opción
    // correcta. Se valida contra el catálogo, como el país de nacimiento y el
    // de residencia — que tampoco salen del documento.
    nacionalidad: entrada.nacionalidad,
    paisNacimiento: entrada.paisNacimiento,
    paisResidencia: entrada.paisResidencia,
    estadoCivil: entrada.estadoCivil,
  };

  const datosPersonales: DatosPersonalesV4 = {
    domicilio: entrada.domicilio.trim(),
    ciudad: entrada.ciudad.trim(),
    barrio: entrada.barrio.trim(),
  };

  const actualizado = registrarDatosPersonalesV4(
    expediente,
    { identidad, datosPersonales },
    fecha,
  );

  const registro: RegistroEvidencia = {
    id: nuevoId(),
    expedienteId: expediente.id,
    paso: PASO_EVIDENCIA_DATOS_PERSONALES_V4,
    fecha,
    ip: entrada.contexto.ip,
    dispositivo: entrada.contexto.dispositivo,
    sesionId: entrada.contexto.sesionId,
    // 03D no pide aceptar ningún texto: los consentimientos viven en 03B y en
    // 04D, y ahí sí quedan con su versión y su literal.
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado: "EXITOSO",
    // Nunca los valores: los valores viven en el expediente y la evidencia
    // registra el hecho (regla inviolable #7 y criterio de v2).
    detalle: formatearDetalle({
      estado: actualizado.estado,
      corregidos: [
        cotejoNombres.corregido ? "nombres" : null,
        cotejoApellidos.corregido ? "apellidos" : null,
        entrada.nacionalidad !== leida.nacionalidad ? "nacionalidad" : null,
      ]
        .filter((campo) => campo !== null)
        .join(",") || "ninguno",
      // D-31 · queda constancia de que la persona declaró otra cosa, y de que
      // la elegibilidad siguió calculándose con la lectura del documento.
      cedulaDeclaradaDistinta: cedulaDistinta,
      fechaNacimientoDeclaradaDistinta: fechaDistinta,
      elegibilidadCalculadaCon: "OCR",
    }),
  };

  await deps.expedientes.guardar(actualizado, expediente.actualizadoEn);
  await deps.evidencias.guardar(registro);

  return {
    ok: true,
    expedienteId: expediente.id,
    identidad,
    datosPersonales,
    hayDatosDeclaradosDistintos: cedulaDistinta || fechaDistinta,
  };
}
