/**
 * Quiénes firman cada documento del expediente, en qué orden, con qué nivel de
 * firma y en qué modalidad (D-13, enmendada el 04-sep-2026 y precisada por
 * D-42 el 15-sep-2026).
 *
 * ## Por qué es un dato y no una constante repartida por el código
 *
 * La lista es **configurable** y no una constante repartida por el código:
 * de acá salen tres cosas a la vez, y esa es la razón de que exista el
 * módulo: el bloque de firmas que se **imprime** en el PDF, el orden en que
 * el adaptador de Code100 **aplica** las firmas, y lo que la consola
 * administrativa **muestra** de cada una. Cuando esos tres vivían separados,
 * el PDF podía decir una cosa y el proveedor hacer otra.
 *
 * ## Lo que la configuración no puede romper
 *
 * Tres invariantes que `firmantes-documento.test.ts` fija, porque no son
 * preferencias sino el contrato de Code100 (CLAUDE.md → "Contrato oficial de
 * `SignatureProvider`") y la regla inviolable #3:
 *
 * - **El cliente firma primero y firma simple.** Su firma es electrónica no
 *   cualificada y ninguna institucional puede precederla en modalidad
 *   `CONJUNTO` ni `DIFERIDO`: firmar antes que el titular invertiría el
 *   sentido del acto.
 * - **Las institucionales son cualificadas.** Una firma institucional simple
 *   no serviría para lo que se la pide (Ley 6822/21, arts. 38(1) y 42(5)).
 * - **`DIFERIDO` nunca precede al cliente.** Por construcción no podría —se
 *   aplica después del pago, que ya exige la firma del cliente— pero el test
 *   lo fija igual, junto con `CONJUNTO`.
 *
 * `PREFIRMADO` es la excepción a lo primero: la firma institucional ya está
 * sobre el documento **antes** de que el cliente lo reciba, así que no compite
 * con la suya — el cliente firma un documento que ya venía firmado por la
 * aseguradora, que es lo que pasa con una póliza modelo. Es el caso del CPC.
 *
 * ## D-08 enmendada (04-sep) y D-42 (15-sep): quién firma el paquete, y cuándo
 *
 * Dos cambios sobre la versión original de D-13:
 *
 * 1. **Alianza no firma la Solicitud ni el FIPF.** La Res. 215/17 num. 11.15
 *    prevé en la propuesta la firma «del Agente / Corredor de Seguros, o del
 *    Proponente», y nada exige la de la aseguradora: la Matriz V4 §7 tenía
 *    razón. `PAQUETE` queda en dos firmantes — cliente e Interseguros — y la
 *    divergencia que registraba ALR-07 **ya no existe**: D-13 se corrigió en
 *    este punto y coincide con la matriz.
 * 2. **La firma cualificada de Interseguros se aplica después del pago**, no
 *    junto con la del cliente (Res. 210/2025 art. 5; Ley 827/96 art. 76): la
 *    latencia del firmador queda fuera del camino crítico de la venta. Por
 *    eso `ModalidadFirma` suma `DIFERIDO`, y `firmantesDiferidos()` es su
 *    lista — el simétrico de `firmantesConjuntos()`, pero para el tramo que
 *    corre en `PAGO_CONFIRMADO → FIRMADO` en vez de
 *    `PAQUETE_GENERADO → FIRMADO_CLIENTE`.
 *
 * El CPC queda igual que antes: solo Alianza, `PREFIRMADO`. D-42 (preliminar)
 * mueve **quién lo genera** y **por dónde llega la firma de Alianza** —el
 * intercambio SFTP, en un lote posterior— pero no toca esta configuración.
 */

/**
 * Versión del bloque de firmas que se imprime en el PDF. Sube cada vez que
 * cambia una leyenda: los documentos ya cerrados conservan la suya (reglas
 * #4 y #10) y el número impreso dice con cuál se cerró cada uno.
 *
 * v2 (04-sep-2026, D-27): la leyenda del cliente deja de describir «un enlace
 * seguro» —el flujo de un proveedor— y pasa a describir el acto que ocurre,
 * con su norma (Res. 210/2025 arts. 4 y 9).
 * v3 (15-sep-2026, D-08 enmendada / D-42): Alianza sale del paquete y la
 * leyenda de Interseguros pasa a decir que su firma se aplica después del
 * pago, no en el mismo acto que la del cliente.
 */
export const VERSION_BLOQUE_FIRMAS = "FIRMAS-v3";

/** Quién firma. No es un nombre: es el rol, que es lo que no cambia. */
export type RolFirmante = "CLIENTE" | "INTERSEGUROS" | "ALIANZA";

/**
 * Nivel de la firma electrónica (Ley 6822/21). `SIMPLE` es la no cualificada
 * del cliente mediante Code100; `CUALIFICADA` es la institucional, con
 * certificado.
 */
export type NivelFirma = "SIMPLE" | "CUALIFICADA";

/**
 * Cuándo se aplica la firma institucional (D-13, D-42).
 *
 * - `PREFIRMADO`: ya está sobre el documento cuando el cliente lo recibe.
 * - `CONJUNTO`: se aplica en el mismo acto que la del cliente, después de ella.
 *   Hoy ningún firmante institucional está en esta modalidad —quedó de la
 *   versión anterior a D-08 enmendada— pero se conserva porque `PREFIRMADO`
 *   y `CONJUNTO` siguen siendo modalidades válidas del modelo, y un documento
 *   futuro puede volver a usarla.
 * - `DIFERIDO`: se aplica **después del pago** (D-38, D-42), no en el acto de
 *   firma del cliente. Es la modalidad de Interseguros sobre el paquete: la
 *   firma cualificada llega en 24/48 h operativas, por fuera del camino
 *   crítico de la venta.
 */
export type ModalidadFirma = "PREFIRMADO" | "CONJUNTO" | "DIFERIDO";

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
 * Configuración vigente (D-08 enmendada, D-42).
 *
 * `PAQUETE` es el PDF único de Solicitud + FIPF (D-11): un solo acto de firma
 * lo cubre entero, que es la regla inviolable #3 vuelta estructural — ya no
 * hay dos documentos que puedan separarse. Dos firmantes, no tres: el cliente
 * (simple, en el acto) e Interseguros (cualificada, diferida al pago). Alianza
 * no firma la propuesta.
 *
 * `CPC` lo firma solo Alianza, y prefirmado: el Certificado de Cobertura
 * Provisional se emite con el pago confirmado y el cliente no lo firma (Matriz
 * §2, pantalla 6: *"Cliente e Interseguros no firman el CPC por defecto"*).
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
        "Firma electrónica no cualificada del proponente, con autenticación previa por código de " +
        "un solo uso enviado a su canal verificado (Res. SS.SG. 210/2025, art. 4). Un solo acto " +
        "cubre la Solicitud y el FIPF de este documento; la evidencia del acto se conserva conforme " +
        "al art. 9.",
    },
    {
      rol: "INTERSEGUROS",
      rotulo: "Interseguros S.A. · Corredores de Seguros",
      nivel: "CUALIFICADA",
      modalidad: "DIFERIDO",
      leyenda: "Firma electrónica cualificada, aplicada después del pago.",
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
 * Firmantes institucionales que hay que aplicar **después** de la del cliente
 * pero en el mismo acto, en orden. Los `PREFIRMADO` no salen acá: ya están
 * sobre el documento. Los `DIFERIDO` tampoco: esos van por
 * `firmantesDiferidos`, porque se aplican en otro momento del flujo.
 */
export function firmantesConjuntos(documento: DocumentoFirmable): readonly FirmanteDocumento[] {
  return firmantesDe(documento).filter(
    (firmante) => firmante.rol !== "CLIENTE" && firmante.modalidad === "CONJUNTO",
  );
}

/**
 * Firmantes institucionales que se aplican **después del pago** (D-38, D-42):
 * apenas se confirma el cobro, cuando el adaptador de firma puede hacerlo en
 * línea, o por el lote externo cuando no. Es el simétrico de
 * `firmantesConjuntos`, para el tramo `PAGO_CONFIRMADO → FIRMADO`.
 */
export function firmantesDiferidos(documento: DocumentoFirmable): readonly FirmanteDocumento[] {
  return firmantesDe(documento).filter(
    (firmante) => firmante.rol !== "CLIENTE" && firmante.modalidad === "DIFERIDO",
  );
}
