/**
 * Qué campos exige cada producto (CHG-18).
 *
 * ## El pedido, y por qué no es lo que parece
 *
 * En la reunión (00:16:57) Rodrigo defendió tener todos los campos aunque hoy
 * no se usen: *"es peor tener que volver a aumentar campos que cortarlos… si
 * hacemos un producto que no tenga que tener esas cosas, lo bloqueamos en el
 * producto y no se tiene que llenar"*.
 *
 * Suena a permiso para pedir de más, y es lo contrario: el modelo de datos
 * conserva los campos —agregarlos después obliga a migrar expedientes y a
 * rehacer documentos— pero **lo que se le pide a la persona** lo decide el
 * producto. Es la diferencia entre lo que el sistema sabe representar y lo que
 * el trámite exige completar.
 *
 * ## La línea que no se mueve
 *
 * Los campos que pide la debida diligencia —actividad, domicilio, perfil
 * económico, origen de fondos, condición PEP— **no son configurables**. La
 * Matriz V4 los marca como bloque OBLIGATORIO y aclara que "los campos
 * impuestos por norma se incorporan directamente y no se someten a decisión
 * comercial" (Res. SEPRELAD 71/2019 y 50/2019, Ley 1015/97). Ponerlos acá,
 * aunque fuera con el valor `REQUERIDO`, invitaría a que alguien los apagara
 * en el futuro con un cambio de una línea y sin discusión.
 *
 * Por eso este módulo solo gobierna los campos donde la exigencia es de
 * producto y no de norma. Si mañana hace falta apagar uno normativo, el camino
 * es documentar la excepción en la matriz, no agregar una clave a este objeto.
 */
import type { PlanId } from "./tipos";

/**
 * Exigencia de un campo en un producto.
 *
 * - `REQUERIDO`: se pide y bloquea el avance.
 * - `OPCIONAL`: se muestra y no bloquea.
 * - `OCULTO`: no se muestra ni se pide. El campo sigue existiendo en el modelo
 *   y se guarda vacío, que es exactamente lo que Rodrigo quería preservar.
 */
export type ExigenciaCampo = "REQUERIDO" | "OPCIONAL" | "OCULTO";

/** Campos cuya exigencia decide el producto y no la norma. */
export type CampoConfigurable =
  | "empresa"
  | "beneficiarioParentesco"
  | "beneficiarioCedula";

export type ConfiguracionCampos = Readonly<Record<CampoConfigurable, ExigenciaCampo>>;

/**
 * Configuración del Seguro de Vida Oncológico CONFÍO, en sus tres planes.
 *
 * Los tres comparten configuración porque son el mismo producto con distintas
 * sumas aseguradas: lo que cambia entre CONFÍO y CONFÍO TOTAL es cuánto paga,
 * no qué datos pide.
 */
const CONFIO: ConfiguracionCampos = {
  // Depende de la situación laboral, no del producto: quien declara ser
  // independiente no tiene empleador que informar.
  empresa: "OPCIONAL",
  beneficiarioParentesco: "REQUERIDO",
  // CHG-24 / CMP-21: la norma pide nombre y domicilio del beneficiario
  // designado, no su cédula.
  beneficiarioCedula: "OPCIONAL",
};

const POR_PLAN: Readonly<Record<PlanId, ConfiguracionCampos>> = {
  CONFIO,
  CONFIO_PLUS: CONFIO,
  CONFIO_TOTAL: CONFIO,
};

export function configuracionDe(planId: PlanId): ConfiguracionCampos {
  return POR_PLAN[planId];
}

/** Si el campo bloquea el avance en ese producto. */
export function esRequerido(planId: PlanId, campo: CampoConfigurable): boolean {
  return configuracionDe(planId)[campo] === "REQUERIDO";
}

/** Si el campo se muestra en la pantalla. */
export function esVisible(planId: PlanId, campo: CampoConfigurable): boolean {
  return configuracionDe(planId)[campo] !== "OCULTO";
}
