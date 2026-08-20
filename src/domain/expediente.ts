/**
 * Máquina de estados del Expediente (CLAUDE.md, sección "Máquina de estados
 * del expediente"). Esta es la única función de transición: ningún Route
 * Handler ni componente debe cambiar `estado` directamente.
 *
 *   INICIADO → PLAN_SELECCIONADO → CANAL_WA_VERIFICADO → AUTORIZADO
 *     → IDENTIDAD_VERIFICADA
 *        ├─ DERIVADO_MANUAL (terminal) → Pantalla A
 *        └─ DECLARACIONES_OK → PAQUETE_GENERADO → FIRMADO_CLIENTE → FIRMADO
 *               ├─ VENCIDO (24 h sin pagar; sin cobro, sin devolución)
 *               └─ PAGO_CONFIRMADO → EMITIDO
 *                      └─ DEVOLUCION_EN_TRAMITE → DEVUELTO (a pedido)
 *
 * **Se firma antes de pagar** (D-08, Matriz Legal V4 §7). Es la inversión del
 * orden que tenía el flujo hasta el Lote 4: cobrar antes de la firma dejaba a
 * la persona pagando por un contrato que todavía no había aceptado, y obligaba
 * a devolver el premio cada vez que no firmaba. Con el orden nuevo el
 * vencimiento ocurre **antes** de que haya dinero, así que caducar es gratis y
 * la devolución queda reservada a lo que sí puede pedirse: un cobro con
 * tarjeta ya acreditado (D-02).
 */
import type {
  ActoDeFirmaEnCurso,
  CertificadoCobertura,
  PolizaDelExpediente,
  DatosComplementariosP6,
  DatosFacturacionP7,
  Declaraciones,
  EstadoExpediente,
  Expediente,
  Firma,
  FirmaInstitucional,
  PaqueteDocumental,
  Pago,
} from "./tipos";
import { ESTADOS_TERMINALES, cobroConfirmadoParaEmision, pagoAcreditado } from "./tipos";
import { codigoFipf, codigoSolicitud } from "./documentos";
import { codigoCertificado } from "./certificado-cobertura";
import { firmantesConjuntos } from "./firmantes-documento";
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
  // D-08 · el expediente elegible cierra su paquete documental y lo firma; el
  // cobro llega después. Ya no hay arista DECLARACIONES_OK → PAGO_CONFIRMADO:
  // el pago dejó de ser alcanzable sin firma, que es exactamente la garantía
  // que pide la Matriz V4 §7 (*el QR de Bancard solo se habilita con firma
  // válida*) y la que el código tiene que hacer imposible de violar.
  DECLARACIONES_OK: ["PAQUETE_GENERADO"],
  // El paquete cerrado sin firmar **no caduca**, y es deliberado: el reloj de
  // D-10 mide un expediente firmado que no pagó, y acá todavía no hay ni firma
  // ni dinero. Un expediente abandonado en este punto no le cuesta nada a
  // nadie ni bloquea la cédula (regla inviolable #11 no lo incluye), así que
  // inventarle un vencimiento sería agregar un estado terminal sin motivo.
  // La caducidad de la *sesión* de firma es otra cosa y la fija Code100 con su
  // `fecha_expiracion` (D-10).
  PAQUETE_GENERADO: ["FIRMADO_CLIENTE"],
  // Entre la firma del cliente y las institucionales. Existe como estado
  // propio para que un sellado a medio hacer sea distinguible de un expediente
  // sin firmar (regla inviolable #3): si Code100 confirma la firma del cliente
  // y las de Interseguros y Alianza fallan, el expediente queda acá y no en
  // FIRMADO, así que el cobro sigue inhabilitado.
  FIRMADO_CLIENTE: ["FIRMADO"],
  // Firmado por todos los intervinientes previstos y esperando el pago. Caduca
  // a las 24 horas (D-10) **sin devolución que tramitar**: bajo este orden el
  // vencimiento ocurre antes del cobro, así que no hay premio que devolver.
  // La fila 30 de la matriz (*"Devolver el premio si el cliente no firma
  // dentro del plazo comunicado"*, Ley 4868/13, arts. 7(f), 17 y 30(b)) queda
  // satisfecha de la única manera que no puede fallar: no cobrando antes.
  FIRMADO: ["PAGO_CONFIRMADO", "VENCIDO"],
  // El pago acreditado habilita la emisión. La salida a devolución existe
  // porque un cobro con tarjeta sí puede devolverse **a pedido** (D-02), que
  // es un hecho distinto del vencimiento.
  PAGO_CONFIRMADO: ["EMITIDO", "DEVOLUCION_EN_TRAMITE"],
  // Bajo el orden nuevo, vencer es gratis: no hubo cobro, así que no hay
  // premio que devolver y el expediente termina acá. La arista hacia
  // DEVOLUCION_EN_TRAMITE **se conserva y queda como legado**, no porque el
  // flujo la use, sino porque hay expedientes que vencieron bajo el orden
  // viejo con el pago hecho y no se los reescribe (regla inviolable #10):
  // sin esta salida quedarían con dinero adentro y sin trámite al que ir.
  // Quien la guarda es `iniciarDevolucionPantallaB`, que exige un pago
  // acreditado — condición que un vencimiento nuevo nunca cumple.
  VENCIDO: ["DEVOLUCION_EN_TRAMITE"],
  // El trámite de devolución termina cuando Alianza devolvió el premio al medio
  // de origen. Es un hecho que ocurre fuera del flujo digital —presencial, en
  // las oficinas de Alianza— pero que el expediente tiene que poder asentar:
  // el pie de la Pantalla B declara el estado final como
  // `VENCIDO · DEVOLUCIÓN EN TRÁMITE / DEVUELTO`.
  DEVOLUCION_EN_TRAMITE: ["DEVUELTO"],
  DEVUELTO: [],
  // La emisión también puede derivar en devolución si el titular la pide
  // (D-02): el dinero ya entró y el trámite lo lleva Alianza fuera del flujo.
  EMITIDO: ["DEVOLUCION_EN_TRAMITE"],
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
      {
        declaraciones,
        datosComplementarios,
        motivoDerivacionManual: null,
        numeroCasoDerivacion: null,
      },
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
 * Asienta el intento de pago **sin mover el estado**: el expediente se queda
 * en FIRMADO hasta que Bancard confirme (D-08).
 *
 * **Ya no acuña el correlativo.** Con el orden invertido lo acuña el cierre
 * del paquete documental, que ahora ocurre antes: acá el número ya existe y
 * este intento solo lo cita. No hay ninguna rama por la que este paso pueda
 * darle a una misma persona un segundo número de propuesta.
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
    readonly facturacion: DatosFacturacionP7;
    readonly pago: Pago;
  },
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (expediente.estado !== "FIRMADO") {
    return {
      ok: false,
      error: `Solo se puede preparar el pago desde FIRMADO; el expediente está en ${expediente.estado}.`,
    };
  }

  if (pagoAcreditado(expediente.pago?.estado ?? "PENDIENTE")) {
    return {
      ok: false,
      error: "El expediente ya tiene un pago acreditado; no se puede abrir otro intento.",
    };
  }

  return {
    ok: true,
    expediente: {
      ...expediente,
      facturacion: intento.facturacion,
      pago: intento.pago,
      actualizadoEn: ahora,
    },
  };
}

/**
 * FIRMADO → PAGO_CONFIRMADO. Es el único punto por el que el paso de pago
 * mueve el estado, y ahora ocurre **después** de la firma (D-08).
 *
 * `PAGO_CONFIRMADO` significa *"el dinero entró"*, sin matices: los tres
 * medios de Bancard cobran directo desde que se retiró la preautorización
 * (D-02), así que la distinción entre garantía y cobro dejó de existir.
 *
 * **No hay cobro sin firma.** El único estado de origen legal es FIRMADO, al
 * que solo se llega con el paquete cerrado, la firma del cliente y las
 * institucionales aplicadas. Es la garantía que pide la Matriz Legal V4 §7 —
 * el medio de cobro solo se habilita con firma válida— y la razón por la que
 * ya no existe la arista DECLARACIONES_OK → PAGO_CONFIRMADO.
 *
 * El vencimiento no entra acá: bajo el orden nuevo el plazo se abre al firmar
 * (`abrirPlazoDePago`, D-10) y lo que hace esta transición es cerrarlo.
 *
 * **El Certificado de Cobertura Provisional entra en esta misma transición**
 * (D-12), y es obligatorio: no existe la forma de asentar un cobro sin la
 * constancia de desde cuándo corre la cobertura que ese cobro compró. Es la
 * atomicidad que pide CMP-07 hecha estructura — una sola escritura lleva el
 * estado y el documento, así que ninguna de las dos mitades puede quedar sin
 * la otra. El certificado ya viene cerrado y hasheado desde
 * `src/documentos/servicio.ts`; acá solo se lo valida contra el correlativo y
 * se lo asienta.
 */
export function registrarPagoConfirmadoP7(
  expediente: Expediente,
  confirmacion: { readonly pago: Pago; readonly certificado: CertificadoCobertura },
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (!pagoAcreditado(confirmacion.pago.estado)) {
    return {
      ok: false,
      error: `No se puede confirmar el pago con la operación en estado ${confirmacion.pago.estado}.`,
    };
  }

  // Mismo control que en el cierre del paquete: los códigos del certificado
  // tienen que derivar del correlativo del expediente. Un CPC que citara otro
  // número rompería el vínculo de la fila 47 (Res. SS SG. 215/15, punto 14).
  const correlativo = expediente.numeroPropuesta;
  if (!correlativo) {
    return { ok: false, error: "No se puede confirmar el pago sin correlativo de propuesta." };
  }
  const certificado = confirmacion.certificado;
  if (certificado.codigo !== codigoCertificado(correlativo)) {
    return {
      ok: false,
      error: `El certificado ${certificado.codigo} no deriva del correlativo ${correlativo}.`,
    };
  }
  if (certificado.codigoPaquete !== codigoSolicitud(correlativo)) {
    return {
      ok: false,
      error: `El certificado ${certificado.codigo} no cuelga del paquete ${codigoSolicitud(correlativo)}.`,
    };
  }

  return transicionarExpediente(
    expediente,
    "PAGO_CONFIRMADO",
    { pago: confirmacion.pago, certificadoCobertura: certificado },
    ahora,
  );
}

// ---------------------------------------------------------------------------
// P8 · Paquete documental (Solicitud + FIPF cerrados)
// ---------------------------------------------------------------------------

/**
 * DECLARACIONES_OK → PAQUETE_GENERADO: asienta la Solicitud y el FIPF ya
 * cerrados y hasheados, antes de habilitar la firma.
 *
 * Las tres reglas que esta función hace imposibles de violar:
 *
 * **Los documentos entran juntos porque son uno** (regla inviolable #3, ahora
 * estructural). Desde D-11 el paquete es un solo PDF con la Solicitud y el
 * FIPF como secciones: no hay dos cosas que puedan separarse, así que la regla
 * dejó de necesitar una validación que la vigile.
 *
 * **Un solo correlativo, dos códigos internos.** Los dos se validan contra
 * `expediente.numeroPropuesta`: un paquete cuya sección FIPF no derive del
 * mismo número que la Solicitud se rechaza acá y nunca llega a persistirse
 * (CLAUDE.md → "Reglas transversales de integraciones"; fila 47 de la matriz
 * de cumplimiento, Res. SS SG. 215/15, punto 14; Ley 6822/21, arts. 44-46).
 *
 * **Ya no exige ninguna garantía de pago** (D-08). Esa condición tenía sentido
 * cuando se cobraba antes de firmar: el paquete se cerraba con el pago hecho.
 * Con el orden invertido el documento se cierra justamente para poder
 * firmarlo, y el cobro llega después — exigirlo acá haría imposible llegar a
 * la firma. Lo que sí sigue exigiendo es lo que hace válido al paquete:
 * correlativo, códigos derivados de él, misma versión y huella en los dos.
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

  const esperados = {
    solicitud: codigoSolicitud(expediente.numeroPropuesta),
    fipf: codigoFipf(expediente.numeroPropuesta),
  };
  if (paquete.codigo !== esperados.solicitud || paquete.codigoSeccionFipf !== esperados.fipf) {
    return {
      ok: false,
      error:
        `Los códigos del paquete no derivan del correlativo ${expediente.numeroPropuesta}: ` +
        `se esperaba ${esperados.solicitud} y ${esperados.fipf}, ` +
        `llegó ${paquete.codigo} y ${paquete.codigoSeccionFipf}.`,
    };
  }

  if (paquete.hashSha256 === "") {
    return { ok: false, error: "El documento no puede quedar cerrado sin su huella digital SHA-256." };
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
 * PAQUETE_GENERADO → FIRMADO_CLIENTE. Es la única escritura de
 * `expediente.firma`.
 *
 * Las cuatro cosas que hace imposibles de violar:
 *
 * **Un documento, una huella** (regla inviolable #3, ahora estructural). Con
 * el PDF único (D-11) no existe un expediente con la Solicitud firmada y el
 * FIPF no, porque no existen dos archivos. Lo que sí se sigue rechazando acá
 * es una firma que llegue con la huella vacía: un `""` pasaría el chequeo del
 * tipo pero no probaría nada.
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
 * **Ya no exige garantía de pago** (D-08). Esa condición era del orden viejo,
 * donde se cobraba antes de firmar; ahora el cobro llega después y exigirlo
 * acá haría imposible llegar a firmar.
 *
 * **Deja el expediente en `FIRMADO_CLIENTE`, no en `FIRMADO`**: faltan las
 * firmas institucionales (D-13). Que sean dos estados y no uno es lo que
 * permite distinguir un sellado a medio hacer de un expediente sin firmar, y
 * lo que mantiene el cobro inhabilitado mientras el acto no cerró.
 */
export function registrarFirmaP8(
  expediente: Expediente,
  firma: Firma,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (!expediente.paqueteDocumental) {
    return { ok: false, error: "No se puede registrar una firma sin paquete documental cerrado." };
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

  if (firma.hashDocumentoFirmado.trim() === "") {
    return { ok: false, error: "La firma tiene que traer la huella del documento firmado." };
  }

  return transicionarExpediente(expediente, "FIRMADO_CLIENTE", { firma }, ahora);
}

/**
 * FIRMADO_CLIENTE → FIRMADO: las firmas institucionales sobre el mismo
 * documento que ya firmó el cliente (D-13).
 *
 * Interseguros y Alianza firman con certificado cualificado, y recién con eso
 * el expediente queda `FIRMADO` — que es lo único que habilita el cobro. En el
 * demo las aplica el adaptador simulado apenas vuelve la firma del cliente;
 * el orden de firmantes, sus certificados y la modalidad (`PREFIRMADO` o
 * `CONJUNTO`) se vuelven configurables en L4c.
 *
 * **Abre el plazo de pago en la misma transición** (D-10): el reloj de 24
 * horas arranca cuando el expediente queda firmado y esperando plata, y
 * dejarlo para una escritura posterior abriría una ventana en la que existe un
 * expediente firmado sin vencimiento posible. Es la misma razón por la que el
 * plazo entraba antes junto al pago, aplicada al hito que ahora corresponde.
 */
export function registrarFirmasInstitucionales(
  expediente: Expediente,
  firmas: readonly FirmaInstitucional[],
  plazoPagoVenceEn: string,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (!expediente.firma) {
    return { ok: false, error: "No hay firma del cliente sobre la que aplicar las institucionales." };
  }

  // La lista tiene que traer exactamente los firmantes que la configuración
  // declara como `CONJUNTO` para este documento (D-13). Si falta uno, el acto
  // no está completo y el expediente no puede quedar habilitado para el cobro.
  const esperados = firmantesConjuntos("PAQUETE").map((firmante) => firmante.rol);
  const aplicados = firmas.map((firma) => firma.rol);
  const faltantes = esperados.filter((rol) => !aplicados.includes(rol));
  if (faltantes.length > 0) {
    return {
      ok: false,
      error: `Faltan firmas institucionales previstas para este documento: ${faltantes.join(", ")}.`,
    };
  }

  return transicionarExpediente(
    expediente,
    "FIRMADO",
    { firmasInstitucionales: firmas, plazoPagoVenceEn },
    ahora,
  );
}

/**
 * Vencimiento del plazo para pagar → VENCIDO (D-10).
 *
 * Bajo el orden nuevo lo que caduca es un expediente **firmado y no pagado**:
 * el reloj arranca con las firmas institucionales y se apaga con el cobro. La
 * consecuencia es que vencer ya no cuesta plata — no hubo cobro, así que no
 * hay premio que devolver— y por eso VENCIDO es terminal en el flujo nuevo.
 *
 * Solo caduca `FIRMADO`. Un expediente que cerró su paquete y nunca firmó no
 * vence: no hay firma ni dinero de por medio, no bloquea la cédula y ponerle
 * un estado terminal no protegería nada. La caducidad de la *sesión* de firma
 * es un hecho distinto y lo fija Code100 con su `fecha_expiracion` (D-10).
 *
 * No hay ningún proceso en segundo plano que dispare esto: el plazo se evalúa
 * contra `plazoPagoVenceEn` cada vez que alguien toca el expediente (el sondeo
 * de la pantalla de pago, la consola administrativa). Es lo que corresponde en
 * una app sin demonios propios, y además hace que el vencimiento sea una
 * consecuencia del reloj y no de que un job haya corrido.
 *
 * Devuelve el expediente **sin cambios** —no un error— si el plazo todavía no
 * se cumplió o si el expediente ya no está en la ventana que puede caducar:
 * quien llama puede aplicarlo siempre y quedarse con lo que salga.
 */
export function vencerPlazoSiCorresponde(
  expediente: Expediente,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (expediente.estado !== "FIRMADO") return { ok: true, expediente };

  if (!expediente.plazoPagoVenceEn || ahora < expediente.plazoPagoVenceEn) {
    return { ok: true, expediente };
  }

  return transicionarExpediente(expediente, "VENCIDO", {}, ahora);
}

// ---------------------------------------------------------------------------
// P9 · Emisión de la póliza (Alianza mediante SEBAOT)
// ---------------------------------------------------------------------------

/**
 * PAGO_CONFIRMADO → EMITIDO: SeguroLoTengo remitió el expediente y Alianza
 * aceptó la solicitud. Es la única escritura de `expediente.poliza`.
 *
 * **EMITIDO significa "solicitud aceptada y emisión ordenada", no "póliza en
 * mano".** P9 lo muestra exactamente así: `Solicitud aceptada ✓` junto a
 * `Póliza en preparación ⋯`. El estado del documento en sí vive en
 * `poliza.estado` y lo mueve Alianza a su ritmo — por eso son dos cosas
 * distintas y no un solo campo.
 *
 * Las tres cosas que hace imposibles de violar:
 *
 * **No hay emisión sin firma completa** (regla inviolable #3): se verifica que
 * `firma` esté, y llegar a PAGO_CONFIRMADO ya exigió pasar por FIRMADO, al que
 * solo se llega con los dos documentos firmados en un mismo acto y con las
 * firmas institucionales aplicadas.
 *
 * **No hay emisión sin cobro efectivo** (fila 44 de la matriz: *"Si falla el
 * cobro, no solicitar la emisión automática"*, Código Civil, art. 1373; Ley
 * 4868/13, arts. 7(e) y 7(p)). Con la firma adelantada, el único estado de
 * origen legal es PAGO_CONFIRMADO, que ya significa *"el dinero entró"*: la
 * comprobación explícita del `Pago` queda igual porque una condición de la
 * que depende una obligación legal no se sostiene sola en el grafo. Es el
 * orden de la fila 43 —firma → cobro → envío a Alianza → validación →
 * emisión—, que con D-08 pasó a ser también el orden de las pantallas.
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
