/**
 * Piezas de P6 que necesitan las dos orillas: el componente de cliente de la
 * pantalla y el caso de uso del servidor (`declaraciones-p6.ts`, que las
 * reexporta). Módulo sin dependencias a propósito —ni siquiera `node:*`— para
 * que la pantalla no arrastre `node:crypto` al bundle, igual que
 * `catalogo-identidad.ts` con P5.
 *
 * Contiene las opciones de los cinco selectores del bloque 1 de P6 y la
 * interpretación/validación de los siete campos complementarios y del bloque
 * de beneficiario (docs/ESPECIFICACION_PANTALLAS.md → "P6 · Paso 6 de 9 —
 * Datos y declaraciones", bloque 1).
 *
 * Que estos campos existan y sean obligatorios lo fijan `docs/FIPF.pdf`
 * (bloque 2, "Datos laborales, económicos y fiscales": situación laboral,
 * actividad, profesión, empresa/empleador, ingreso mensual declarado; bloque
 * 1: domicilio y ciudad) y `docs/Solicitud.pdf` (bloque 1 del proponente y
 * bloque 3 "Beneficiario por fallecimiento"). Respaldo normativo del conjunto:
 * fila 16 de `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` — "R2 -
 * CONSENTIMIENTO, IDENTIFICACIÓN Y REPUDIO", *"Generar el FIPF con datos
 * personales, laborales, económicos y origen de fondos"*, Res. SEPRELAD 71/19,
 * art. 26(1)(a-j).
 *
 * Lo que ningún documento fuente fija es **el contenido concreto de las
 * listas**: ni el FIPF, ni la Solicitud, ni la matriz de cumplimiento
 * enumeran ciudades, situaciones laborales, actividades, profesiones ni
 * parentescos. Esas cinco listas son una decisión de producto/UX, no una
 * obligación legal, y están armadas para cubrir a las personas de prueba de
 * `src/adapters/mock/personas.ts` sin inventar datos nuevos.
 */
import type { DatosComplementariosP6 } from "./tipos";

// ---------------------------------------------------------------------------
// Opciones de los cinco selectores
// ---------------------------------------------------------------------------

export const CIUDADES: readonly string[] = [
  "Asunción",
  "Capiatá",
  "Ciudad del Este",
  "Encarnación",
  "Fernando de la Mora",
  "Lambaré",
  "Limpio",
  "Luque",
  "Mariano Roque Alonso",
  "Ñemby",
  "Pedro Juan Caballero",
  "San Lorenzo",
  "Villa Elisa",
  "Otra",
];

export const SITUACIONES_LABORALES: readonly string[] = [
  "Relación de dependencia",
  "Independiente",
  "Funcionario público",
  "Empleador/a o socio/a",
  "Jubilado/a",
  "Estudiante",
  "Sin actividad remunerada",
];

export const ACTIVIDADES: readonly string[] = [
  "Administración pública",
  "Agricultura y ganadería",
  "Comercio minorista",
  "Comercio mayorista",
  "Construcción e ingeniería",
  "Educación",
  "Industria y manufactura",
  "Salud",
  "Servicios financieros",
  "Servicios profesionales",
  "Tecnología y comunicaciones",
  "Transporte y logística",
  "Turismo y gastronomía",
  "Otra",
];

export const PROFESIONES: readonly string[] = [
  "Abogado/a",
  "Arquitecto/a",
  "Comerciante",
  "Contador/a",
  "Docente",
  "Enfermero/a",
  "Ingeniero/a",
  "Médico/a",
  "Técnico/a en logística",
  "Vendedor/a",
  "Otra",
];

/** Solo se usa cuando el beneficiario es una persona designada. */
export const PARENTESCOS: readonly string[] = [
  "Cónyuge",
  "Concubino/a",
  "Hijo/a",
  "Padre",
  "Madre",
  "Hermano/a",
  "Otro",
];

export function esCiudad(valor: unknown): valor is string {
  return typeof valor === "string" && CIUDADES.includes(valor);
}

export function esSituacionLaboral(valor: unknown): valor is string {
  return typeof valor === "string" && SITUACIONES_LABORALES.includes(valor);
}

export function esActividad(valor: unknown): valor is string {
  return typeof valor === "string" && ACTIVIDADES.includes(valor);
}

export function esProfesion(valor: unknown): valor is string {
  return typeof valor === "string" && PROFESIONES.includes(valor);
}

export function esParentesco(valor: unknown): valor is string {
  return typeof valor === "string" && PARENTESCOS.includes(valor);
}

// ---------------------------------------------------------------------------
// Campos de texto y monto
// ---------------------------------------------------------------------------

export const LARGO_MAXIMO_TEXTO_P6 = 160;

/**
 * Tope del ingreso mensual declarado. No sale de ningún documento fuente: es
 * una cota de sanidad para que un dedazo (o una petición armada a mano) no
 * meta un número absurdo en el FIPF. Decisión de producto, no legal.
 */
export const INGRESO_MENSUAL_MAXIMO_GS = 999_999_999_999;

/** Recorta y colapsa espacios; devuelve `""` si no es un string. */
export function normalizarTextoP6(valor: unknown): string {
  if (typeof valor !== "string") return "";
  return valor.trim().replace(/\s+/g, " ").slice(0, LARGO_MAXIMO_TEXTO_P6);
}

/** Guaraníes: entero positivo, sin decimales (la moneda no los tiene). */
export function esIngresoMensualValido(valor: unknown): valor is number {
  return (
    typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor > 0 &&
    valor <= INGRESO_MENSUAL_MAXIMO_GS
  );
}

/**
 * `"9.500.000"`, `"9500000"`, `"Gs. 9 500 000"` → `9500000`. Devuelve `null`
 * si no queda ningún dígito. La pantalla deja escribir con separadores; el
 * dominio guarda un número.
 */
export function interpretarMontoGuaranies(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? Math.trunc(valor) : null;
  if (typeof valor !== "string") return null;
  const digitos = valor.replace(/\D/g, "");
  if (digitos === "") return null;
  const numero = Number(digitos);
  return Number.isSafeInteger(numero) ? numero : null;
}

// ---------------------------------------------------------------------------
// Interpretación y validación del bloque 1 completo
// ---------------------------------------------------------------------------

/**
 * Identificadores de los campos que la pantalla puede marcar en rojo. Los
 * cinco primeros y `ingresoMensualDeclaradoGs` son los obligatorios del bloque
 * 1; `empresa` no está porque es opcional según la especificación.
 */
export type CampoP6 =
  | "domicilio"
  | "ciudad"
  | "situacionLaboral"
  | "actividad"
  | "profesion"
  | "ingresoMensualDeclaradoGs"
  | "beneficiarioTipo"
  | "beneficiarioNombreCompleto"
  | "beneficiarioParentesco"
  | "beneficiarioDomicilio";

export type ResultadoDatosComplementariosP6 =
  | { readonly ok: true; readonly datos: DatosComplementariosP6 }
  | { readonly ok: false; readonly camposInvalidos: readonly CampoP6[] };

/**
 * Toma el cuerpo crudo de la petición (o el estado del formulario) y devuelve
 * los datos ya tipados, o la lista de campos que faltan. Vive en el dominio y
 * no en el Route Handler para que la pantalla y el servidor apliquen
 * exactamente la misma regla de "cuándo se habilita el botón".
 *
 * El beneficiario es excluyente: `HEREDEROS_LEGALES` (por defecto) fuerza los
 * tres campos de la persona designada a `null`, así no puede quedar en el
 * expediente un nombre huérfano de una opción que después se cambió.
 */
export function interpretarDatosComplementariosP6(
  bruto: Readonly<Record<string, unknown>>,
): ResultadoDatosComplementariosP6 {
  const camposInvalidos: CampoP6[] = [];

  const domicilio = normalizarTextoP6(bruto.domicilio);
  if (domicilio === "") camposInvalidos.push("domicilio");

  const ciudad = normalizarTextoP6(bruto.ciudad);
  if (!esCiudad(ciudad)) camposInvalidos.push("ciudad");

  const situacionLaboral = normalizarTextoP6(bruto.situacionLaboral);
  if (!esSituacionLaboral(situacionLaboral)) camposInvalidos.push("situacionLaboral");

  const actividad = normalizarTextoP6(bruto.actividad);
  if (!esActividad(actividad)) camposInvalidos.push("actividad");

  const profesion = normalizarTextoP6(bruto.profesion);
  if (!esProfesion(profesion)) camposInvalidos.push("profesion");

  // Único campo opcional del bloque 1: vacío se persiste como `null`.
  const empresaTexto = normalizarTextoP6(bruto.empresa);
  const empresa = empresaTexto === "" ? null : empresaTexto;

  const ingresoMensualDeclaradoGs = interpretarMontoGuaranies(bruto.ingresoMensualDeclaradoGs);
  if (!esIngresoMensualValido(ingresoMensualDeclaradoGs)) {
    camposInvalidos.push("ingresoMensualDeclaradoGs");
  }

  const tipo = bruto.beneficiarioTipo;
  const esDesignada = tipo === "PERSONA_DESIGNADA";
  if (tipo !== "HEREDEROS_LEGALES" && !esDesignada) camposInvalidos.push("beneficiarioTipo");

  let nombreCompleto: string | null = null;
  let parentesco: string | null = null;
  let domicilioBeneficiario: string | null = null;
  let cedulaBeneficiario: string | null = null;

  if (esDesignada) {
    nombreCompleto = normalizarTextoP6(bruto.beneficiarioNombreCompleto);
    if (nombreCompleto === "") camposInvalidos.push("beneficiarioNombreCompleto");

    const parentescoTexto = normalizarTextoP6(bruto.beneficiarioParentesco);
    if (!esParentesco(parentescoTexto)) camposInvalidos.push("beneficiarioParentesco");
    parentesco = parentescoTexto;

    domicilioBeneficiario = normalizarTextoP6(bruto.beneficiarioDomicilio);
    if (domicilioBeneficiario === "") camposInvalidos.push("beneficiarioDomicilio");

    // CHG-24 · la cédula del beneficiario es opcional y **no bloqueante**: si
    // viene vacía se guarda como ausente y el trámite sigue. No se valida el
    // formato por la misma razón — exigir una forma a un dato que la norma no
    // pide sería inventar un requisito (CMP-21).
    const cedulaTexto = normalizarTextoP6(bruto.beneficiarioCedula);
    cedulaBeneficiario = cedulaTexto === "" ? null : cedulaTexto;
  }

  if (camposInvalidos.length > 0 || ingresoMensualDeclaradoGs === null) {
    return { ok: false, camposInvalidos };
  }

  return {
    ok: true,
    datos: {
      domicilio,
      ciudad,
      situacionLaboral,
      actividad,
      profesion,
      empresa,
      ingresoMensualDeclaradoGs,
      beneficiario: esDesignada
        ? {
            tipo: "PERSONA_DESIGNADA",
            nombreCompleto,
            parentesco,
            domicilio: domicilioBeneficiario,
            numeroCedula: cedulaBeneficiario,
          }
        : {
            tipo: "HEREDEROS_LEGALES",
            nombreCompleto: null,
            parentesco: null,
            domicilio: null,
            numeroCedula: null,
          },
    },
  };
}
