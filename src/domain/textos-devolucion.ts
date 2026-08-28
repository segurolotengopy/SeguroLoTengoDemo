/**
 * Rótulos y proyección del trámite de devolución (D-02).
 *
 * Vive aparte de `devolucion.ts` por la misma razón que `documentos.ts` vive
 * aparte del servicio que escribe PDF: **este módulo no importa `node:*`** y
 * por eso lo puede consumir la consola, que es un componente de cliente.
 * `devolucion.ts` usa `node:crypto` para los identificadores de evidencia, así
 * que importarlo desde el navegador arrastraría todo eso al bundle.
 */
import type {
  DevolucionDelExpediente,
  Expediente,
  MedioDePago,
  MotivoDevolucion,
  SolicitanteDevolucion,
} from "./tipos";

/** Rótulos para la consola. El motivo es una categoría, nunca un texto libre. */
export const ROTULO_MOTIVO_DEVOLUCION: Readonly<Record<MotivoDevolucion, string>> = {
  PEDIDO_DEL_TITULAR: "Pedido del titular",
  ERROR_DE_COBRO: "Error de cobro",
  COBRO_DUPLICADO: "Cobro duplicado",
  VENCIMIENTO_LEGADO: "Vencimiento con cobro (orden anterior)",
};

export const ROTULO_SOLICITANTE_DEVOLUCION: Readonly<Record<SolicitanteDevolucion, string>> = {
  TITULAR: "El titular",
  INTERSEGUROS: "Interseguros",
  ALIANZA: "Alianza Garantía",
};

// ---------------------------------------------------------------------------
// Adónde vuelve el dinero y en cuánto tiempo (respuestas B2 y B3 de Bancard)
// ---------------------------------------------------------------------------

/**
 * Qué se le puede decir a la persona sobre su devolución, por medio de pago.
 *
 * Sale de las respuestas B2(a) y B3 de Bancard del 28-ago-2026
 * (`docs/Integraciones/Bancard - Respuestas B1 a B13.md`), y existe porque la
 * fila 65 de `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`
 * —*"Explicar cancelación y metodología de devolución"*, Ley 4868/13, arts.
 * 7(m, p, q) y 30(c); Res. SS SG. 215/15, Anexo 1, numerales 8.4, 8.5 y 8.9—
 * pide explicar el procedimiento, y hasta ahora podíamos describir los pasos
 * pero no el destino exacto ni el tiempo. Decíamos *"al medio o cuenta de
 * origen"* porque era lo único cierto que teníamos.
 *
 * ## Por qué `plazoLoFijaElBanco` es un campo y no una redacción
 *
 * Bancard fija un plazo **solo para crédito**: 48 a 72 horas, y sujeto a dos
 * condiciones suyas (carga correcta del pedido y disponibilidad de saldos a
 * retener). Para débito dijo explícitamente que **no hay SLA establecido**,
 * porque acredita en línea y la devolución depende de cuándo el banco pagador
 * autorice el movimiento en la cuenta.
 *
 * Esa diferencia no es un matiz de redacción: es la diferencia entre un plazo
 * que alguien se comprometió a cumplir y uno que nadie controla. Si fuera solo
 * texto, cualquier retoque de estilo podría convertir "no depende de nosotros"
 * en "unas 48 horas" sin que nada lo impida — y eso sería informarle a la
 * persona un plazo que nadie prometió, que es exactamente lo que la fila 65
 * busca evitar. Como campo, la consola puede además distinguir un trámite
 * atrasado de uno que simplemente no tiene reloj.
 *
 * ## El QR es una inferencia declarada, no una respuesta
 *
 * Bancard confirmó que el QR devuelve **a la cuenta** (lo llama *QR A2A*), pero
 * al dar los plazos remitió a los de tarjeta, y el QR no es ninguno de los dos.
 * Lo tratamos como al débito —sin plazo propio, dependiente del banco— porque
 * es el mismo mecanismo de acreditación en cuenta, y **no le atribuimos a
 * Bancard un plazo que no dio**. Queda pendiente de confirmación en la consulta
 * B3-bis; hasta entonces el texto no promete nada que haya que desdecir.
 */
export interface DevolucionPorMedio {
  /** Adónde vuelve el dinero. Nunca a otro destino (regla del producto). */
  readonly destino: string;
  /** Cuánto demora, en los términos en que el proveedor lo comprometió. */
  readonly plazo: string;
  /**
   * `true` cuando el tiempo depende del banco del cliente y Bancard no fija
   * SLA. La consola lo usa para no marcar como atrasado un trámite sin reloj.
   */
  readonly plazoLoFijaElBanco: boolean;
}

const DEVOLUCION_SIN_MEDIO_CONOCIDO: DevolucionPorMedio = {
  destino: "Al mismo medio o cuenta desde la que se hizo el pago.",
  plazo: "El plazo depende del medio de pago que se usó.",
  plazoLoFijaElBanco: true,
};

const DEVOLUCION_POR_MEDIO: Readonly<Record<MedioDePago, DevolucionPorMedio>> = {
  TARJETA_CREDITO: {
    destino: "A la misma tarjeta de crédito con la que pagaste.",
    plazo: "Entre 48 y 72 horas desde que Alianza carga el pedido de anulación.",
    plazoLoFijaElBanco: false,
  },
  TARJETA_DEBITO: {
    destino: "A la misma tarjeta de débito con la que pagaste.",
    plazo: "Depende de cuándo tu banco autorice el movimiento en tu cuenta: no hay un plazo fijo.",
    plazoLoFijaElBanco: true,
  },
  QR_BANCARD: {
    destino: "A la cuenta desde la que pagaste el QR.",
    plazo: "Depende de cuándo tu banco acredite el movimiento en tu cuenta: no hay un plazo fijo.",
    plazoLoFijaElBanco: true,
  },
};

export function devolucionPorMedio(medio: MedioDePago | null): DevolucionPorMedio {
  return medio === null ? DEVOLUCION_SIN_MEDIO_CONOCIDO : DEVOLUCION_POR_MEDIO[medio];
}

/**
 * Plazo máximo para pedirle a Bancard una devolución, contado desde la
 * transacción original (respuesta B2(c): **un año**).
 *
 * Se expone como dato y **no se aplica como validación bloqueante**: la
 * decisión de qué hacer con un pedido fuera de plazo es de Alianza, no del
 * portal, y un bloqueo automático impediría asentar un caso que quizá se
 * resuelva por otra vía. Lo que sí corresponde es que quien abre el trámite lo
 * vea.
 */
export const MESES_MAXIMO_PARA_PEDIR_DEVOLUCION = 12;

/**
 * La devolución parcial existe **solo con tarjeta de crédito** (respuesta
 * B2(d)). Hoy no la usamos —CONFÍO cobra un premio único y devuelve el total—,
 * así que esto es un dato para el día que alguien proponga devolver una parte:
 * con débito y con QR no se puede, y conviene que esté escrito antes de que se
 * diseñe una pantalla que lo ofrezca.
 */
export const MEDIOS_CON_DEVOLUCION_PARCIAL: readonly MedioDePago[] = ["TARJETA_CREDITO"];

// ---------------------------------------------------------------------------
// Lectura para la consola
// ---------------------------------------------------------------------------

export interface SeguimientoDevolucion {
  readonly estado: DevolucionDelExpediente["estado"];
  readonly solicitante: string;
  readonly motivo: string;
  readonly solicitadaEn: string;
  readonly acreditadaEn: string | null;
  readonly montoGs: number;
  readonly medio: string;
  readonly referenciaBancard: string | null;
  readonly referenciaReintegro: string | null;
  /** Cuánto lleva abierto el trámite, en horas. Es lo que la consola ordena. */
  readonly horasAbierta: number | null;
}

/**
 * Proyección del trámite para la consola. Devuelve `null` si el expediente no
 * tiene devolución — que es el caso normal.
 */
export function leerSeguimientoDevolucion(
  expediente: Expediente,
  ahora: string = new Date().toISOString(),
): SeguimientoDevolucion | null {
  const devolucion = expediente.devolucion;
  if (!devolucion) return null;

  const cierre = devolucion.acreditadaEn ?? ahora;
  const horas =
    (new Date(cierre).getTime() - new Date(devolucion.solicitadaEn).getTime()) / 3_600_000;

  return {
    estado: devolucion.estado,
    solicitante: ROTULO_SOLICITANTE_DEVOLUCION[devolucion.solicitante],
    motivo: ROTULO_MOTIVO_DEVOLUCION[devolucion.motivo],
    solicitadaEn: devolucion.solicitadaEn,
    acreditadaEn: devolucion.acreditadaEn,
    montoGs: devolucion.montoGs,
    medio: devolucion.medio,
    referenciaBancard: devolucion.referenciaBancard,
    referenciaReintegro: devolucion.referenciaReintegro,
    horasAbierta: Number.isFinite(horas) ? Math.max(Math.round(horas * 10) / 10, 0) : null,
  };
}
