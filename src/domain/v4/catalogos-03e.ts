/**
 * Los cinco catálogos de la pantalla 03E · Actividad, ingresos y condición PEP.
 *
 * ## De dónde salen
 *
 * **No llegaron completos.** Los 21 artes de 03E son candidatos y muestran
 * solo las primeras 7 u 8 filas de cada lista; el pie declara el total (7, 15,
 * 28, 23 y 10). El manual funcional describe las reglas de la pantalla pero no
 * enumera las opciones, y ningún otro documento fuente lo hace: ni el FIPF, ni
 * la Solicitud, ni la matriz de cumplimiento.
 *
 * Así que estas listas se armaron acá, por **D-48**, con tres reglas:
 *
 * 1. **Las opciones visibles en el arte se conservan, en su orden.** Son lo
 *    único aprobado que existe, y el día que Interseguros mande su catálogo
 *    hay que poder comparar.
 * 2. **Cada lista se completa desde un listado reconocido**, no inventando:
 *    las secciones de la **CIIU Rev. 4** para la actividad económica, los
 *    grandes grupos de la **CIUO-08** para ocupación y profesión, y los
 *    conceptos de origen de fondos que pide el **FIPF** (Res. SEPRELAD 71/19,
 *    art. 26) para el origen de ingresos.
 * 3. **Entre 15 y 20 opciones**, que es el pedido: suficientes para que casi
 *    nadie tenga que elegir «Otra», pocas para que se puedan recorrer en un
 *    celular. La excepción es `Situación laboral`, que queda con **las 7 del
 *    arte** porque esas sí llegaron enteras.
 *
 * ## Qué son y qué no son
 *
 * Son **decisión de producto, no obligación legal**. Que estos campos existan
 * y sean obligatorios lo fija el FIPF; **qué opciones tiene cada uno** no lo
 * fija ninguna norma. Cuando llegue el catálogo aprobado de Interseguros,
 * manda el suyo y este archivo se reemplaza entero.
 *
 * Módulo sin dependencias: lo importan la pantalla (cliente) y la validación
 * del servidor, igual que `catalogos-03d.ts`.
 */

/** Las 7 del arte, completas y en su orden. */
export const SITUACIONES_LABORALES_V4: readonly string[] = [
  "Empleado (dependiente)",
  "Propietario/Accionista",
  "Independiente/Profesional independiente",
  "Jubilado",
  "Estudiante",
  "Desempleado",
  "Trabajador del hogar",
];

/**
 * Las 8 del arte + 7 secciones de la CIIU Rev. 4 agrupadas. Con buscador.
 * El total coincide con el que declara el arte: 15.
 */
export const ACTIVIDADES_ECONOMICAS_V4: readonly string[] = [
  "No aplica",
  "Comercio",
  "Servicios",
  "Industria",
  "Construcción",
  "Agro",
  "Transporte",
  "Salud",
  "Educación",
  "Administración pública",
  "Servicios financieros y seguros",
  "Tecnología y comunicaciones",
  "Turismo, hotelería y gastronomía",
  "Actividades inmobiliarias",
  "Otra actividad",
];

/**
 * Las 8 del arte + 12 de los grandes grupos de la CIUO-08. Con buscador.
 *
 * El arte declara 28; se entregan **20** por D-48. Las cuatro primeras son las
 * que usa el autocompletado por situación laboral, y por eso encabezan.
 */
export const OCUPACIONES_V4: readonly string[] = [
  "Estudiante",
  "Sin ocupación actual",
  "Trabajador del hogar",
  "Jubilado",
  "Empleado administrativo",
  "Gerente",
  "Supervisor",
  "Encargado",
  "Director/a o socio/a",
  "Profesional independiente",
  "Técnico/a",
  "Docente",
  "Personal de salud",
  "Vendedor/a",
  "Cajero/a",
  "Chofer",
  "Operario/a",
  "Personal de seguridad",
  "Agricultor/a o ganadero/a",
  "Otra ocupación",
];

/**
 * Las 8 del arte + 12 profesiones universitarias frecuentes en Paraguay.
 * Con buscador. El arte declara 23; se entregan **20** por D-48.
 *
 * `Sin profesión` no es relleno: `Profesión` es obligatoria en los 21 artes
 * —`03E_16` lo dice con todas las letras— y quien es estudiante, desempleado
 * o trabajador del hogar tiene que poder contestar sin mentir.
 */
export const PROFESIONES_V4: readonly string[] = [
  "Médico",
  "Odontólogo",
  "Farmacéutico",
  "Bioquímico",
  "Psicólogo",
  "Ingeniero",
  "Arquitecto",
  "Economista",
  "Abogado",
  "Contador",
  "Administrador",
  "Licenciado en Marketing",
  "Analista de sistemas",
  "Docente",
  "Enfermero",
  "Nutricionista",
  "Veterinario",
  "Comunicador",
  "Sin profesión",
  "Otra profesión",
];

/**
 * Las 8 del arte + 7 conceptos del FIPF. **Se elige uno solo**, como dicen el
 * arte y el manual. Sin buscador: entra entero en la hoja.
 *
 * El arte declara 10; se entregan **15** por D-48, porque es el campo donde
 * quedarse corto obliga a la persona a declarar un origen que no es el suyo, y
 * eso ensucia justamente el dato que SEPRELAD pide.
 */
export const ORIGENES_INGRESOS_V4: readonly string[] = [
  "Apoyo familiar/manutención",
  "Salario",
  "Honorarios/servicios",
  "Utilidades/empresa",
  "Comisiones",
  "Alquileres",
  "Pensión/jubilación",
  "Herencia/donación",
  "Actividad agropecuaria",
  "Venta de bienes",
  "Intereses o rendimientos financieros",
  "Remesas del exterior",
  "Beca o subsidio",
  "Indemnización",
  "Otro origen",
];

// ---------------------------------------------------------------------------
// Reglas de la pantalla
// ---------------------------------------------------------------------------

/**
 * Las dos situaciones laborales que **exigen** empresa o empleador.
 *
 * Sale del manual y del propio arte, que lo imprime bajo el campo:
 * «Obligatorio para Empleado (dependiente) y Propietario/Accionista.»
 */
export const SITUACIONES_CON_EMPRESA_V4: readonly string[] = [
  "Empleado (dependiente)",
  "Propietario/Accionista",
];

/** Valor que toman los campos que no aplican a una situación laboral. */
export const NO_APLICA_V4 = "No aplica";

export interface AutocompletadoLaboralV4 {
  readonly actividadEconomica: string;
  readonly ocupacion: string;
  /** `null` cuando la empresa no aplica y el campo queda bloqueado. */
  readonly empresa: string | null;
}

/**
 * Qué se autocompleta al elegir cada situación laboral (artes 03E_02 a 03E_07).
 *
 * Las cuatro situaciones sin empleador dejan los tres campos resueltos y
 * bloqueados; las dos con empleador solo **habilitan** el campo de empresa, y
 * por eso no aparecen acá. `Independiente/Profesional independiente` tampoco:
 * el arte no le dibuja autocompletado y la persona elige actividad y ocupación
 * por su cuenta.
 *
 * `Profesión` **nunca** se autocompleta: en los cuatro artes queda vacía y
 * editable, que es lo correcto — un jubilado puede ser médico jubilado.
 */
export const AUTOCOMPLETADO_LABORAL_V4: Readonly<Record<string, AutocompletadoLaboralV4>> = {
  Estudiante: {
    actividadEconomica: NO_APLICA_V4,
    ocupacion: "Estudiante",
    empresa: NO_APLICA_V4,
  },
  Desempleado: {
    actividadEconomica: NO_APLICA_V4,
    ocupacion: "Sin ocupación actual",
    empresa: NO_APLICA_V4,
  },
  "Trabajador del hogar": {
    actividadEconomica: NO_APLICA_V4,
    ocupacion: "Trabajador del hogar",
    empresa: NO_APLICA_V4,
  },
  Jubilado: {
    actividadEconomica: NO_APLICA_V4,
    ocupacion: "Jubilado",
    empresa: NO_APLICA_V4,
  },
};

/** `true` si esa situación laboral exige declarar empresa o empleador. */
export function exigeEmpresaV4(situacionLaboral: string): boolean {
  return SITUACIONES_CON_EMPRESA_V4.includes(situacionLaboral);
}

/** Cantidad de opciones que declara el pie de cada hoja de selección. */
export const TOTALES_CATALOGOS_03E = {
  situacionLaboral: SITUACIONES_LABORALES_V4.length,
  actividadEconomica: ACTIVIDADES_ECONOMICAS_V4.length,
  ocupacion: OCUPACIONES_V4.length,
  profesion: PROFESIONES_V4.length,
  origenIngresos: ORIGENES_INGRESOS_V4.length,
} as const;
