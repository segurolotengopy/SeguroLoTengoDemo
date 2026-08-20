/**
 * Máquina de estados del Expediente (CLAUDE.md, sección "Máquina de estados
 * del expediente"). Esta es la única función de transición: ningún Route
 * Handler ni componente debe cambiar `estado` directamente.
 *
 *   INICIADO → PLAN_SELECCIONADO → CANAL_WA_VERIFICADO → AUTORIZADO
 *     → IDENTIDAD_VERIFICADA
 *        ├─ DERIVADO_MANUAL (terminal) → Pantalla A
 *        └─ DECLARACIONES_OK → PAGO_CONFIRMADO → PAQUETE_GENERADO
 *               ├─ VENCIDO → DEVOLUCION_EN_TRAMITE → DEVUELTO (Pantalla B)
 *               └─ FIRMADO → EMITIDO → P9
 *
 * Con una arista más que el diagrama de CLAUDE.md: PAGO_CONFIRMADO → VENCIDO.
 * El plazo de firma arranca con el pago, no con el cierre del paquete, así que
 * un expediente pagado que nunca llegó a P8 también tiene que poder vencer.
 * La justificación completa está junto a la entrada del grafo.
 */
import type {
  ActoDeFirmaEnCurso,
  PolizaDelExpediente,
  DatosComplementariosP6,
  DatosFacturacionP7,
  Declaraciones,
  EstadoExpediente,
  Expediente,
  Firma,
  PaqueteDocumental,
  Pago,
} from "./tipos";
import { ESTADOS_TERMINALES, cobroConfirmadoParaEmision, pagoAcreditado } from "./tipos";
import { codigoFipf, codigoSolicitud } from "./documentos";
import { evaluarElegibilidad } from "./elegibilidad";

/** Grafo de transiciones legales: única fuente de verdad de la máquina de estados. */
const TRANSICIONES_LEGALES: Readonly<Record<EstadoExpediente, readonly EstadoExpediente[]>> = {
  // CHG-01 · el plan se elige primero y el OTP de WhatsApp viene después.
  // Todo lo anterior al OTP es información pública, así que ponerlo delante no
  // protegía nada; puesto acá, el código funciona como elemento disuasivo y da
  // trazabilidad temprana de quién está avanzando.
  INICIADO: ["PLAN_SELECCIONADO"],
  // El autobucle es el enlace `Cambiar plan` de la barra de plan seleccionado:
  // volver al catálogo y elegir otro antes de verificar el canal. No agrega
  // ningún estado alcanzable nuevo —desde acá se sigue saliendo solo a
  // CANAL_WA_VERIFICADO— y cada re-selección queda como una entrada más del
  // historial append-only.
  PLAN_SELECCIONADO: ["PLAN_SELECCIONADO", "CANAL_WA_VERIFICADO"],
  CANAL_WA_VERIFICADO: ["AUTORIZADO"],
  // D-06 · sin OTP de correo, la autorización lleva directo a identidad.
  // `CANAL_EMAIL_VERIFICADO` sobrevive como estado legado —hay expedientes
  // históricos ahí y la consola tiene que seguir leyéndolos (regla #10)—, pero
  // ya nadie entra: quedó sin aristas de entrada.
  AUTORIZADO: ["IDENTIDAD_VERIFICADA", "ASISTENCIA_IDENTIDAD"],
  // La segunda salida es P5 sin poder verificar la identidad tras tres
  // análisis fallidos: en vez de dejar a la persona repitiendo capturas que no
  // van a alcanzar, el caso pasa a asistencia humana. No es la derivación de
  // la regla #5 —esa sigue siendo exclusiva de las declaraciones de P6— y no
  // bloquea la cédula: ver `ASISTENCIA_IDENTIDAD` en `tipos.ts`.
  // Legado (D-06): sin aristas de entrada desde el flujo nuevo. Conserva sus
  // salidas para que un expediente viejo detenido acá pueda terminar.
  CANAL_EMAIL_VERIFICADO: ["IDENTIDAD_VERIFICADA", "ASISTENCIA_IDENTIDAD"],
  // Terminal: desde asistencia no se vuelve al flujo digital de este
  // expediente. La persona no queda bloqueada — puede empezar uno nuevo con la
  // misma cédula, que es justamente lo que la distingue de DERIVADO_MANUAL.
  ASISTENCIA_IDENTIDAD: [],
  IDENTIDAD_VERIFICADA: ["DERIVADO_MANUAL", "DECLARACIONES_OK"],
  // Terminal en el flujo digital (regla de negocio #5): no hay transición
  // posible desde acá hacia pago, firma ni emisión.
  DERIVADO_MANUAL: [],
  DECLARACIONES_OK: ["PAGO_CONFIRMADO"],
  // El diagrama de CLAUDE.md dibuja VENCIDO colgando solo de PAQUETE_GENERADO.
  // Acá PAGO_CONFIRMADO también puede vencer, y es una corrección deliberada:
  // el plazo de 24 horas arranca con el pago confirmado (`plazoFirmaVenceEn` se
  // escribe en esa misma transición), así que un expediente pagado cuya persona
  // nunca abrió P8 —y por lo tanto nunca cerró el paquete documental— tiene el
  // plazo corriendo y, sin esta arista, no habría estado al que ir cuando se
  // cumple. Sería un pago sin vencimiento posible, justo lo contrario de la
  // fila 30 de la matriz de cumplimiento (*"Devolver el premio si el cliente no
  // firma dentro del plazo comunicado"*, Ley 4868/13, arts. 7(f), 17 y 30(b)).
  // No abre ningún camino nuevo hacia adelante: VENCIDO sigue saliendo solo a
  // DEVOLUCION_EN_TRAMITE.
  PAGO_CONFIRMADO: ["PAQUETE_GENERADO", "VENCIDO"],
  PAQUETE_GENERADO: ["VENCIDO", "FIRMADO"],
  VENCIDO: ["DEVOLUCION_EN_TRAMITE"],
  // El trámite de devolución termina cuando Alianza devolvió el premio al medio
  // de origen. Es un hecho que ocurre fuera del flujo digital —presencial, en
  // las oficinas de Alianza— pero que el expediente tiene que poder asentar:
  // el pie de la Pantalla B declara el estado final como
  // `VENCIDO · DEVOLUCIÓN EN TRÁMITE / DEVUELTO`.
  DEVOLUCION_EN_TRAMITE: ["DEVUELTO"],
  DEVUELTO: [],
  FIRMADO: ["EMITIDO"],
  EMITIDO: [],
};

export type ResultadoTransicion =
  | { readonly ok: true; readonly expediente: Expediente }
  | { readonly ok: false; readonly error: string };

export function transicionesLegalesDesde(estado: EstadoExpediente): readonly EstadoExpediente[] {
  return TRANSICIONES_LEGALES[estado];
}

export function esTransicionLegal(desde: EstadoExpediente, hacia: EstadoExpediente): boolean {
  return TRANSICIONES_LEGALES[desde].includes(hacia);
}

export function esEstadoTerminal(estado: EstadoExpediente): boolean {
  return ESTADOS_TERMINALES.includes(estado);
}

type CambiosExpediente = Partial<
  Omit<Expediente, "id" | "estado" | "historial" | "creadoEn" | "actualizadoEn">
>;

/**
 * Única función que puede cambiar el estado de un Expediente. Valida la
 * transición contra el grafo antes de aplicar cualquier cambio; nunca muta
 * el objeto recibido y nunca modifica ni borra entradas previas del
 * historial (regla de negocio #10, append-only).
 */
export function transicionarExpediente(
  expediente: Expediente,
  estadoDestino: EstadoExpediente,
  cambios: CambiosExpediente = {},
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (!esTransicionLegal(expediente.estado, estadoDestino)) {
    return {
      ok: false,
      error: `Transición ilegal: no se puede pasar de ${expediente.estado} a ${estadoDestino}.`,
    };
  }

  return {
    ok: true,
    expediente: {
      ...expediente,
      ...cambios,
      estado: estadoDestino,
      historial: [...expediente.historial, { estado: estadoDestino, en: ahora }],
      actualizadoEn: ahora,
    },
  };
}

/**
 * Punto único de entrada para el registro de declaraciones de P6. Aplica el
 * motor de elegibilidad y decide la transición: una declaración incompatible
 * en 1, 2, 3 u 8 deriva a DERIVADO_MANUAL en vez de DECLARACIONES_OK (regla
 * de negocio #5). Como DERIVADO_MANUAL no tiene transiciones legales de
 * salida, ningún llamador posterior puede llevar este expediente a pago,
 * firma ni emisión.
 *
 * `numeroCasoDerivacion` se recibe ya generado (el generador vive en
 * `declaraciones-p6.ts`, que sí puede usar `node:crypto`) y **solo se escribe
 * si la derivación efectivamente ocurre**: un expediente elegible no puede
 * quedar con un número de caso colgado, aunque el llamador pase uno. Al revés
 * también está cerrado: derivar sin número de caso es un error de programación
 * y no se persiste.
 */
export function registrarDeclaracionesP6(
  expediente: Expediente,
  declaraciones: Declaraciones,
  datosComplementarios: DatosComplementariosP6,
  numeroCasoDerivacion: string,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  const resultado = evaluarElegibilidad(declaraciones);

  if (resultado.elegibleParaEmisionAutomatica) {
    return transicionarExpediente(
      expediente,
      "DECLARACIONES_OK",
      { declaraciones, datosComplementarios, motivoDerivacionManual: null, numeroCasoDerivacion: null },
      ahora,
    );
  }

  if (numeroCasoDerivacion.trim() === "") {
    return { ok: false, error: "Una derivación a DERIVADO_MANUAL requiere un número de caso." };
  }

  return transicionarExpediente(
    expediente,
    "DERIVADO_MANUAL",
    {
      declaraciones,
      datosComplementarios,
      motivoDerivacionManual: resultado.declaracionesQueBloquean,
      numeroCasoDerivacion,
    },
    ahora,
  );
}

// ---------------------------------------------------------------------------
// P7 · Facturación y garantía de pago
// ---------------------------------------------------------------------------

/**
 * Asienta el intento de pago de P7 **sin mover el estado**: el expediente se
 * queda en DECLARACIONES_OK hasta que Bancard confirme.
 *
 * Existe como función del dominio —y no como un `guardar` armado en el Route
 * Handler— porque lo que se persiste acá es lo que hace idempotente al cobro:
 * la `idempotencyKey` y la `referenciaBancard` del intento en curso. Sin
 * guardarlas, un reintento después de un timeout abriría una operación nueva
 * en Bancard y cobraría dos veces (fila 32 de la matriz de cumplimiento, Ley
 * 6822/21, art. 68(1); Res. BCP 25/21, art. 8).
 *
 * Vuelve a escribirse en cada reintento del mismo intento, y eso está bien:
 * `Pago` es el intento en curso, no un registro histórico. La traza
 * append-only de cada llamada a Bancard vive en `EvidenceStore` (regla
 * inviolable #10), que es donde no se pisa nada.
 */
export function registrarIntentoPagoP7(
  expediente: Expediente,
  intento: {
    readonly numeroPropuesta: string;
    readonly facturacion: DatosFacturacionP7;
    readonly pago: Pago;
  },
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (expediente.estado !== "DECLARACIONES_OK") {
    return {
      ok: false,
      error: `Solo se puede preparar el pago desde DECLARACIONES_OK; el expediente está en ${expediente.estado}.`,
    };
  }

  if (pagoAcreditado(expediente.pago?.estado ?? "PENDIENTE")) {
    return {
      ok: false,
      error: "El expediente ya tiene una garantía de pago vigente; no se puede abrir otro intento.",
    };
  }

  return {
    ok: true,
    expediente: {
      ...expediente,
      // El correlativo se acuña una sola vez: cambiar de medio de pago o
      // reintentar no puede darle a la misma persona dos números de propuesta.
      numeroPropuesta: expediente.numeroPropuesta ?? intento.numeroPropuesta,
      facturacion: intento.facturacion,
      pago: intento.pago,
      actualizadoEn: ahora,
    },
  };
}

/**
 * DECLARACIONES_OK → PAGO_CONFIRMADO. Es el único punto por el que P7 mueve
 * el estado, y solo lo hace con una garantía de pago efectivamente lista:
 * QR o débito acreditados, o crédito preautorizado.
 *
 * `PAGO_CONFIRMADO` significa *"garantía de pago lista"*, no *"cobrado"* —
 * con crédito todavía no se cobró nada; la captura la ordena la firma en P8
 * (P8, bloque 2: `GARANTÍA DE PAGO LISTA`; filas 26 y 27 de la matriz).
 *
 * `plazoFirmaVenceEn` entra en la misma transición a propósito: el plazo de
 * 24 horas arranca con el pago confirmado, y dejarlo para una escritura
 * posterior abriría una ventana en la que existe un pago sin vencimiento.
 */
export function confirmarGarantiaDePagoP7(
  expediente: Expediente,
  confirmacion: { readonly pago: Pago; readonly plazoFirmaVenceEn: string },
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (!pagoAcreditado(confirmacion.pago.estado)) {
    return {
      ok: false,
      error: `No se puede confirmar la garantía de pago con el pago en estado ${confirmacion.pago.estado}.`,
    };
  }

  return transicionarExpediente(
    expediente,
    "PAGO_CONFIRMADO",
    { pago: confirmacion.pago, plazoFirmaVenceEn: confirmacion.plazoFirmaVenceEn },
    ahora,
  );
}

// ---------------------------------------------------------------------------
// P8 · Paquete documental (Solicitud + FIPF cerrados)
// ---------------------------------------------------------------------------

/**
 * PAGO_CONFIRMADO → PAQUETE_GENERADO: asienta la Solicitud y el FIPF ya
 * cerrados y hasheados, antes de habilitar la firma.
 *
 * Las tres reglas que esta función hace imposibles de violar:
 *
 * **Los documentos entran juntos o no entra ninguno** (regla inviolable #3).
 * `PaqueteDocumental` no tiene campos opcionales y esta es la única escritura
 * de `expediente.paqueteDocumental`, así que no existe un estado en el que la
 * Solicitud esté cerrada y el FIPF no.
 *
 * **Un solo correlativo, dos prefijos.** Los códigos se validan contra
 * `expediente.numeroPropuesta`: un paquete cuyo FIPF no derive del mismo
 * número que la Solicitud se rechaza acá y nunca llega a persistirse
 * (CLAUDE.md → "Reglas transversales de integraciones"; fila 47 de la matriz
 * de cumplimiento, Res. SS SG. 215/15, punto 14; Ley 6822/21, arts. 44-46).
 *
 * **No hay paquete sin garantía de pago.** El único estado de origen legal es
 * PAGO_CONFIRMADO, y encima se verifica el estado del pago: los documentos se
 * cierran después de que Bancard confirmó, nunca antes.
 *
 * No existe transición PAQUETE_GENERADO → PAQUETE_GENERADO, y es a propósito:
 * regenerar un documento ya cerrado exigiría versión y huellas nuevas (regla
 * inviolable #4), así que sería una transición distinta, con su propia
 * validación, y no un autobucle silencioso.
 */
export function registrarPaqueteDocumental(
  expediente: Expediente,
  paquete: PaqueteDocumental,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (!expediente.numeroPropuesta) {
    return { ok: false, error: "No se puede cerrar el paquete documental sin correlativo de propuesta." };
  }

  if (!pagoAcreditado(expediente.pago?.estado ?? "PENDIENTE")) {
    return {
      ok: false,
      error: "No se puede cerrar el paquete documental sin una garantía de pago lista.",
    };
  }

  const esperados = {
    solicitud: codigoSolicitud(expediente.numeroPropuesta),
    fipf: codigoFipf(expediente.numeroPropuesta),
  };
  if (paquete.solicitud.codigo !== esperados.solicitud || paquete.fipf.codigo !== esperados.fipf) {
    return {
      ok: false,
      error:
        `Los códigos del paquete no derivan del correlativo ${expediente.numeroPropuesta}: ` +
        `se esperaba ${esperados.solicitud} y ${esperados.fipf}, ` +
        `llegó ${paquete.solicitud.codigo} y ${paquete.fipf.codigo}.`,
    };
  }

  if (paquete.solicitud.version !== paquete.fipf.version) {
    return {
      ok: false,
      error: "La Solicitud y el FIPF deben cerrarse con la misma versión: se firman en un solo acto.",
    };
  }

  if (paquete.solicitud.hashSha256 === "" || paquete.fipf.hashSha256 === "") {
    return { ok: false, error: "Ningún documento puede quedar cerrado sin su huella digital SHA-256." };
  }

  return transicionarExpediente(expediente, "PAQUETE_GENERADO", { paqueteDocumental: paquete }, ahora);
}

// ---------------------------------------------------------------------------
// P8 · Acto de firma (Code100)
// ---------------------------------------------------------------------------

/**
 * Asienta el enlace de firma enviado **sin mover el estado**: el expediente se
 * queda en PAQUETE_GENERADO hasta que Code100 confirme la firma.
 *
 * Existe como función del dominio —y no como un `guardar` armado en el Route
 * Handler— porque lo que se persiste acá es lo que permite sondear después de
 * una recarga: el `session_id` de Code100. Sin guardarlo, volver a P8 dejaría
 * un acto de firma vivo del lado del proveedor que el portal ya no sabe mirar.
 *
 * Pedir un enlace nuevo pisa el anterior, y eso está bien: `actoDeFirma` es el
 * acto en curso, no un registro histórico. La traza append-only de cada envío
 * vive en `EvidenceStore` (regla inviolable #10).
 */
export function registrarEnvioEnlaceFirmaP8(
  expediente: Expediente,
  acto: ActoDeFirmaEnCurso,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (expediente.estado !== "PAQUETE_GENERADO") {
    return {
      ok: false,
      error: `Solo se puede enviar el enlace de firma desde PAQUETE_GENERADO; el expediente está en ${expediente.estado}.`,
    };
  }

  if (!expediente.paqueteDocumental) {
    return { ok: false, error: "No se puede firmar sin la Solicitud y el FIPF cerrados y hasheados." };
  }

  return { ok: true, expediente: { ...expediente, actoDeFirma: acto, actualizadoEn: ahora } };
}

/**
 * PAQUETE_GENERADO → FIRMADO. Es la única escritura de `expediente.firma`.
 *
 * Las cuatro cosas que hace imposibles de violar:
 *
 * **Los dos documentos o ninguno** (regla inviolable #3). `Firma` no tiene
 * campos opcionales —`hashSolicitudFirmada` y `hashFipfFirmado` son
 * obligatorios— y esta es una sola escritura, así que no existe un expediente
 * con la Solicitud firmada y el FIPF no. Además se rechaza acá cualquier firma
 * que llegue con una huella vacía: un `""` pasaría el chequeo del tipo pero no
 * probaría nada.
 *
 * **La firma es del acto que este expediente abrió.** El `idCode100` tiene que
 * coincidir con el de `actoDeFirma`: una confirmación de otra sesión —o un
 * callback duplicado de otra propuesta— no puede firmar este expediente
 * (fila 47 de la matriz: vincular Solicitud, FIPF, pago y firmas por
 * correlativos o hashes).
 *
 * **No hay firma sin paquete cerrado** (regla inviolable #4): el único estado
 * de origen legal es PAQUETE_GENERADO, y encima se verifica que el paquete
 * esté.
 *
 * **No hay firma sin garantía de pago** (P7 → P8: la firma se habilita después
 * del QR pagado o de la preautorización).
 */
export function registrarFirmaP8(
  expediente: Expediente,
  firma: Firma,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (!expediente.paqueteDocumental) {
    return { ok: false, error: "No se puede registrar una firma sin paquete documental cerrado." };
  }

  if (!pagoAcreditado(expediente.pago?.estado ?? "PENDIENTE")) {
    return { ok: false, error: "No se puede registrar una firma sin una garantía de pago lista." };
  }

  if (!expediente.actoDeFirma) {
    return { ok: false, error: "No hay ningún acto de firma abierto para este expediente." };
  }

  if (expediente.actoDeFirma.idCode100 !== firma.idCode100) {
    return {
      ok: false,
      error:
        `La firma llegó con el identificador ${firma.idCode100}, ` +
        `pero el acto abierto de este expediente es ${expediente.actoDeFirma.idCode100}.`,
    };
  }

  if (firma.hashSolicitudFirmada.trim() === "" || firma.hashFipfFirmado.trim() === "") {
    return {
      ok: false,
      error: "La firma tiene que traer la huella de los dos documentos firmados: se firman en un solo acto.",
    };
  }

  return transicionarExpediente(expediente, "FIRMADO", { firma }, ahora);
}

/**
 * Vencimiento del plazo para firmar → VENCIDO, de ahí a Pantalla B.
 *
 * No hay ningún proceso en segundo plano que dispare esto: el plazo se evalúa
 * contra `plazoFirmaVenceEn` cada vez que alguien toca el expediente (el sondeo
 * de P8, la consola administrativa). Es lo que corresponde en una app sin
 * demonios propios, y además hace que el vencimiento sea una consecuencia del
 * reloj y no de que un job haya corrido.
 *
 * Devuelve el expediente **sin cambios** —no un error— si el plazo todavía no
 * se cumplió o si el expediente ya no está esperando una firma: quien llama
 * puede aplicarlo siempre y quedarse con lo que salga.
 */
export function vencerPlazoFirmaSiCorresponde(
  expediente: Expediente,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  const esperandoFirma = expediente.estado === "PAGO_CONFIRMADO" || expediente.estado === "PAQUETE_GENERADO";
  if (!esperandoFirma) return { ok: true, expediente };

  if (!expediente.plazoFirmaVenceEn || ahora < expediente.plazoFirmaVenceEn) {
    return { ok: true, expediente };
  }

  return transicionarExpediente(expediente, "VENCIDO", {}, ahora);
}

/**
 * Actualiza el `Pago` **sin mover el estado**: la captura de la
 * preautorización que ordena la firma del cliente (fila 27 de la matriz —
 * *"Ordenar la captura definitiva inmediatamente después de la firma del
 * cliente"*, Código Civil, arts. 1348, 1373 y 1374) y la liberación de la
 * reserva cuando el plazo vence sin firma.
 *
 * Solo admite avanzar el `Pago` dentro de la misma operación: no puede cambiar
 * el medio, ni el importe, ni la referencia de Bancard. Cambiar cualquiera de
 * esas tres sería otro cobro, no una actualización de este.
 */
export function registrarEstadoDePagoP8(
  expediente: Expediente,
  pago: Pago,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  const anterior = expediente.pago;
  if (!anterior) {
    return { ok: false, error: "No hay ningún pago sobre el que registrar un cambio de estado." };
  }

  const mismaOperacion =
    anterior.medio === pago.medio &&
    anterior.montoGs === pago.montoGs &&
    anterior.referenciaBancard === pago.referenciaBancard &&
    anterior.idempotencyKey === pago.idempotencyKey;

  if (!mismaOperacion) {
    return {
      ok: false,
      error: "El pago recibido no es la misma operación de Bancard que tiene el expediente.",
    };
  }

  return { ok: true, expediente: { ...expediente, pago, actualizadoEn: ahora } };
}

// ---------------------------------------------------------------------------
// P9 · Emisión de la póliza (Alianza mediante SEBAOT)
// ---------------------------------------------------------------------------

/**
 * FIRMADO → EMITIDO: SeguroLoTengo remitió el expediente y Alianza aceptó la
 * solicitud. Es la única escritura de `expediente.poliza`.
 *
 * **EMITIDO significa "solicitud aceptada y emisión ordenada", no "póliza en
 * mano".** P9 lo muestra exactamente así: `Solicitud aceptada ✓` junto a
 * `Póliza en preparación ⋯`. El estado del documento en sí vive en
 * `poliza.estado` y lo mueve Alianza a su ritmo — por eso son dos cosas
 * distintas y no un solo campo.
 *
 * Las tres cosas que hace imposibles de violar:
 *
 * **No hay emisión sin firma completa** (regla inviolable #3): el único estado
 * de origen legal es FIRMADO, al que solo se llega con los dos documentos
 * firmados en un mismo acto, y encima se verifica que `firma` esté.
 *
 * **No hay emisión sin cobro efectivo** (fila 44 de la matriz: *"Si falla el
 * cobro, no solicitar la emisión automática"*, Código Civil, art. 1373; Ley
 * 4868/13, arts. 7(e) y 7(p)). Ojo con la diferencia respecto de P8: para
 * *firmar* alcanza con la garantía lista —una preautorización de crédito
 * sirve—, pero para *emitir* hace falta que el dinero haya entrado. Con crédito
 * eso significa CAPTURADO, no PREAUTORIZADO: la captura la ordena la firma del
 * cliente, y si no se completó no hay cobro que respalde la emisión. Es el
 * orden que fija la fila 43 (firma → cobro → envío a Alianza → validación →
 * emisión) y el que describe el bloque `DESPUÉS DE LA FIRMA DEL CLIENTE` de P8.
 *
 * **La póliza conserva el correlativo de la propuesta**: se valida que
 * `numeroPoliza` sea el mismo `numeroPropuesta` del expediente. Una póliza con
 * numeración propia rompería el vínculo que exige la fila 47.
 */
export function registrarEmisionP9(
  expediente: Expediente,
  poliza: PolizaDelExpediente,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (!expediente.firma) {
    return { ok: false, error: "No se puede emitir una póliza sin la Solicitud y el FIPF firmados." };
  }

  const pago = expediente.pago;
  if (!pago || !cobroConfirmadoParaEmision(pago)) {
    return {
      ok: false,
      error:
        `No se puede solicitar la emisión sin el cobro confirmado: el pago está en ` +
        `${pago?.estado ?? "(sin pago)"} con medio ${pago?.medio ?? "(sin medio)"}.`,
    };
  }

  if (!expediente.numeroPropuesta || poliza.numeroPoliza !== expediente.numeroPropuesta) {
    return {
      ok: false,
      error:
        `La póliza tiene que conservar el correlativo de la propuesta: se esperaba ` +
        `${expediente.numeroPropuesta ?? "(sin correlativo)"} y llegó ${poliza.numeroPoliza}.`,
    };
  }

  return transicionarExpediente(expediente, "EMITIDO", { poliza }, ahora);
}

/**
 * Actualiza el estado de la póliza y de la factura **sin mover el estado del
 * expediente**: EMITIDO ya se alcanzó al aceptarse la solicitud, y lo que
 * cambia después es el avance de Alianza.
 *
 * No admite cambiar el número de póliza: sería otra póliza, no una
 * actualización de esta.
 */
export function actualizarEstadoPolizaP9(
  expediente: Expediente,
  poliza: PolizaDelExpediente,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  const anterior = expediente.poliza;
  if (!anterior) return { ok: false, error: "El expediente no tiene ninguna póliza que actualizar." };

  if (anterior.numeroPoliza !== poliza.numeroPoliza) {
    return { ok: false, error: "El número de póliza no puede cambiar: sería otra póliza." };
  }

  return { ok: true, expediente: { ...expediente, poliza, actualizadoEn: ahora } };
}
