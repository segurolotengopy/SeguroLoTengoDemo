/**
 * Quiénes firman cada documento del expediente, en qué orden, con qué nivel de
 * firma y en qué modalidad (D-13).
 *
 * ## Por qué es un dato y no una constante repartida por el código
 *
 * La decisión D-13 no fija una lista: fija que la lista sea **configurable**.
 * Alianza firma los tres documentos —Solicitud, FIPF (que viajan como un PDF
 * único, D-11) y el Certificado de Cobertura Provisional— *ya sea prefirmados
 * o junto con el cliente*, y las dos modalidades son válidas. Cambiar de una a
 * otra tiene que ser configuración, no reescritura, porque quien decide es
 * Alianza y puede decidir distinto por producto o por documento.
 *
 * De acá salen tres cosas a la vez, y esa es la razón de que exista el módulo:
 * el bloque de firmas que se **imprime** en el PDF, el orden en que el
 * adaptador de Code100 **aplica** las firmas, y lo que la consola
 * administrativa **muestra** de cada una. Cuando esos tres vivían separados,
 * el PDF podía decir una cosa y el proveedor hacer otra.
 *
 * ## Lo que la configuración no puede romper
 *
 * Dos invariantes que `firmantes-documento.test.ts` fija, porque no son
 * preferencias sino el contrato de Code100 (CLAUDE.md → "Contrato oficial de
 * `SignatureProvider`") y la regla inviolable #3:
 *
 * - **El cliente firma primero y firma simple.** Su firma es electrónica no
 *   cualificada y ninguna institucional puede precederla en modalidad
 *   `CONJUNTO`: firmar antes que el titular invertiría el sentido del acto.
 * - **Las institucionales son cualificadas.** Una firma institucional simple
 *   no serviría para lo que se la pide (Ley 6822/21, arts. 38(1) y 42(5)).
 *
 * `PREFIRMADO` es la excepción ordenada a lo primero: la firma institucional
 * ya está sobre el documento **antes** de que el cliente lo reciba, así que no
 * compite con la suya — el cliente firma un documento que ya venía firmado por
 * la aseguradora, que es lo que pasa con una póliza modelo.
 *
 * ## Divergencia declarada con la Matriz V4
 *
 * La Matriz §2 dice hoy que *"Alianza no firma la propuesta salvo exigencia
 * del modelo"*. D-13 establece lo contrario y **manda D-13**: es una decisión
 * de Andres, posterior y explícita. `ALR-07` en `docs/plan/DECISIONES.md`
 * registra que Rodrigo y Legal tienen que actualizar la matriz y contrastarla
 * con el modelo registrado (compuerta de producción 6). No bloquea la
 * implementación; sí queda anotado para que nadie lo lea como un descuido.
 */

/** Quién firma. No es un nombre: es el rol, que es lo que no cambia. */
export type RolFirmante = "CLIENTE" | "INTERSEGUROS" | "ALIANZA";

/**
 * Nivel de la firma electrónica (Ley 6822/21). `SIMPLE` es la no cualificada
 * del cliente mediante Code100; `CUALIFICADA` es la institucional, con
 * certificado.
 */
export type NivelFirma = "SIMPLE" | "CUALIFICADA";

/**
 * Cuándo se aplica la firma institucional (D-13).
 *
 * - `PREFIRMADO`: ya está sobre el documento cuando el cliente lo recibe.
 * - `CONJUNTO`: se aplica en el mismo acto que la del cliente, después de ella.
 */
export type ModalidadFirma = "PREFIRMADO" | "CONJUNTO";

/** Documentos del expediente que llevan firma. */
export type DocumentoFirmable = "PAQUETE" | "CPC";

export interface FirmanteDocumento {
  readonly rol: RolFirmante;
  /** Cómo se lo nombra en el bloque de firmas del PDF y en la consola. */
  readonly rotulo: string;
  readonly nivel: NivelFirma;
  readonly modalidad: ModalidadFirma;
  /** Qué dice el PDF sobre esta firma, debajo del rótulo. */
  readonly leyenda: string;
}

/**
 * Configuración vigente.
 *
 * `PAQUETE` es el PDF único de Solicitud + FIPF (D-11): un solo acto de firma
 * lo cubre entero, que es la regla inviolable #3 vuelta estructural — ya no
 * hay dos documentos que puedan separarse.
 *
 * `CPC` lo firma solo Alianza, y prefirmado: el Certificado de Cobertura
 * Provisional se emite con el pago confirmado y el cliente no lo firma (Matriz
 * §2, pantalla 6: *"Cliente e Interseguros no firman el CPC por defecto"*). El
 * documento todavía no existe —es L5— pero su fila vive acá desde ahora para
 * que cuando se implemente no haya que decidir esto de nuevo en otro lado.
 */
export const FIRMANTES_POR_DOCUMENTO: Readonly<
  Record<DocumentoFirmable, readonly FirmanteDocumento[]>
> = {
  PAQUETE: [
    {
      rol: "CLIENTE",
      rotulo: "Proponente / asegurado",
      nivel: "SIMPLE",
      modalidad: "CONJUNTO",
      leyenda:
        "Firma electrónica no cualificada mediante enlace seguro de Code100; " +
        "un solo acto cubre la Solicitud y el FIPF de este documento.",
    },
    {
      rol: "INTERSEGUROS",
      rotulo: "Interseguros S.A. · Corredores de Seguros",
      nivel: "CUALIFICADA",
      modalidad: "CONJUNTO",
      leyenda: "Firma electrónica cualificada, aplicada tras la firma del cliente.",
    },
    {
      rol: "ALIANZA",
      rotulo: "Alianza Garantía Seguros y Reaseguros S.A.",
      nivel: "CUALIFICADA",
      modalidad: "CONJUNTO",
      leyenda: "Firma electrónica cualificada, aplicada tras la firma del cliente.",
    },
  ],
  CPC: [
    {
      rol: "ALIANZA",
      rotulo: "Alianza Garantía Seguros y Reaseguros S.A.",
      nivel: "CUALIFICADA",
      modalidad: "PREFIRMADO",
      leyenda: "Suscriptor autorizado de Alianza Garantía; firma electrónica cualificada.",
    },
  ],
};

export function firmantesDe(documento: DocumentoFirmable): readonly FirmanteDocumento[] {
  return FIRMANTES_POR_DOCUMENTO[documento];
}

/**
 * Firmantes institucionales que hay que aplicar **después** de la del cliente,
 * en orden. Los `PREFIRMADO` no salen acá: ya están sobre el documento.
 */
export function firmantesConjuntos(documento: DocumentoFirmable): readonly FirmanteDocumento[] {
  return firmantesDe(documento).filter(
    (firmante) => firmante.rol !== "CLIENTE" && firmante.modalidad === "CONJUNTO",
  );
}
