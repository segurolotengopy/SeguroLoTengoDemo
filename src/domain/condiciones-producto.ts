/**
 * Condiciones del producto que **pide el modelo oficial del Certificado de
 * Cobertura** de Alianza (`docs/MODELO_CERTIFICADO_COBERTURA_ALIANZA.docx`,
 * recibido el 18-sep-2026; brecha en `docs/ANALISIS_MODELO_CPC_ALIANZA.md`).
 *
 * ## Por qué existe este módulo y no están sueltas en el certificado
 *
 * Son datos **del producto**, no del expediente: el mismo valor para todos los
 * certificados. Puestas acá se llenan en un solo lugar el día que Alianza las
 * confirme, sin volver a tocar la plantilla ni el armado del PDF, que es
 * exactamente lo que se buscaba al adelantarlas antes de tener las respuestas.
 *
 * ## `null` significa «Alianza todavía no lo dijo», y no se imprime
 *
 * Ocho de estos valores no figuran en ningún documento del producto —ni en la
 * Solicitud, ni en el catálogo, ni en la matriz de cumplimiento— y **no se
 * inventan** (es la regla de trabajo con los documentos). Mientras estén en
 * `null`, el certificado los **omite**: un casillero vacío en un documento que
 * respalda una cobertura es peor que la ausencia del renglón, porque parece un
 * dato perdido en vez de uno que todavía no se acordó.
 *
 * Las preguntas salieron en el punto 6 del Correo 7
 * (`docs/correos/Correo 7 - Alianza - sesion tecnica, prueba de firma y SEBAOT.md`),
 * enviado por Andres el 18-sep-2026.
 */

export interface CondicionesProducto {
  /**
   * Nomenclatura de ramo de Alianza. ⬜ Pendiente: es de ellos, no nuestra.
   */
  readonly seccionSubSeccion: string | null;
  /**
   * Redacción exacta del objeto del seguro. ⬜ Pendiente.
   *
   * No se compone con el nombre comercial del plan por las nuestras: el modelo
   * lo trae como campo propio y la denominación registrada del producto tiene
   * consecuencias de registro (Res. SS.SG. 215/17).
   */
  readonly objetoDelSeguro: string | null;
  /** Edad de permanencia, distinta de la máxima de ingreso. ⬜ Pendiente. */
  readonly edadLimite: string | null;
  /** ⬜ Pendiente: no figura en ningún documento del producto. */
  readonly limitePadecimientos: string | null;
  /** ⬜ Pendiente, y además ambiguo: ¿pago del premio o de un siniestro? */
  readonly plazoMaximoPago: string | null;
  /**
   * ⬜ Pendiente. El modelo pide **un** período de espera y **uno** de
   * carencia; el producto declara carencias **por cobertura** (180 días para
   * cáncer, 30 para renta hospitalaria, 1 día para el resto). Cómo se expresa
   * en un solo renglón lo decide Alianza; las de cada cobertura siguen
   * imprimiéndose en la tabla, que es donde alguien las busca.
   */
  readonly periodoEspera: string | null;
  readonly periodoCarencia: string | null;
  /** ⬜ Pendiente: el producto no declara ninguno. */
  readonly deducible: string | null;
}

/**
 * Los ocho valores que faltan. **Se llenan acá cuando Alianza conteste**, y el
 * certificado los imprime sin ningún otro cambio.
 */
export const CONDICIONES_PRODUCTO: CondicionesProducto = {
  seccionSubSeccion: null,
  objetoDelSeguro: null,
  edadLimite: null,
  limitePadecimientos: null,
  plazoMaximoPago: null,
  periodoEspera: null,
  periodoCarencia: null,
  deducible: null,
};

/**
 * Proporción del beneficiario cuando hay uno solo, que es el único caso que el
 * flujo admite: o herederos legales, o **una** persona designada.
 *
 * No es un pendiente como los de arriba —con un beneficiario único es
 * aritmética, y la Solicitud que la persona firma ya dice «100%»—, así que se
 * imprime. Confirmarlo con Alianza es prolijidad, no un bloqueo.
 */
export const PROPORCION_BENEFICIARIO_UNICO = "100 %";

/**
 * Descarta los campos sin valor y devuelve los que sí se pueden imprimir.
 *
 * Existe como función y no como un `filter` suelto en el certificado para que
 * la regla —lo que Alianza no confirmó **no aparece**— tenga un solo lugar y
 * un test propio.
 */
export function camposDefinidos<T extends { readonly valor: string | null }>(
  campos: readonly T[],
): readonly (T & { readonly valor: string })[] {
  return campos.filter((campo): campo is T & { readonly valor: string } => {
    return campo.valor !== null && campo.valor.trim() !== "";
  });
}
