/**
 * Máquina de estados del Expediente (CLAUDE.md, sección "Máquina de estados
 * del expediente"). Esta es la única función de transición: ningún Route
 * Handler ni componente debe cambiar `estado` directamente.
 *
 *   INICIADO → PLAN_SELECCIONADO → CANAL_WA_VERIFICADO → AUTORIZADO
 *     → IDENTIDAD_VERIFICADA
 *        ├─ DERIVADO_MANUAL (terminal) → Pantalla A
 *        └─ DECLARACIONES_OK → PAQUETE_GENERADO → FIRMADO_CLIENTE
 *               ├─ VENCIDO (10 min sin pagar; sin cobro, sin devolución)
 *               └─ PAGO_CONFIRMADO → FIRMADO → EMITIDO
 *                      └─ DEVOLUCION_EN_TRAMITE → DEVUELTO (a pedido)
 *
 * **Se firma antes de pagar, y la firma cualificada de Interseguros llega
 * después** (D-08, enmendada el 04-sep-2026; Res. 210/2025 arts. 4-5). La
 * firma del cliente sigue antes del pago; la cualificada del corredor —antes
 * aplicada en el mismo acto— se mueve a después del cobro, dentro de 24/48 h
 * operativas (D-38), para sacar su latencia del camino crítico de la venta.
 * `FIRMADO_CLIENTE` es, desde la enmienda, el estado que habilita el cobro —no
 * `FIRMADO`, que pasó a describir el momento **posterior** al pago en el que
 * ya se aplicó también la institucional. El plazo de 10 minutos para pagar
 * (D-32) se abre con la firma del cliente y no con la institucional: es el
 * hito que corresponde, porque ya no hay que esperar a la segunda para saber
 * que hay algo que puede vencer.
 *
 * Con el orden nuevo el vencimiento ocurre **antes** de que haya dinero, así
 * que caducar es gratis y la devolución queda reservada a lo que sí puede
 * pedirse: un cobro con tarjeta ya acreditado (D-02), sin importar si para ese
 * momento la institucional ya se aplicó (`PAGO_CONFIRMADO`) o no (`FIRMADO`).
 */
import type {
  ActividadEconomicaV4,
  ActoDeFirmaEnCurso,
  CertificadoCobertura,
  PolizaDelExpediente,
  Beneficiario,
  DatosComplementariosP6,
  DatosFacturacionP7,
  DatosPersonalesV4,
  Declaraciones,
  EstadoExpediente,
  Expediente,
  DeclaracionesMedicasV4,
  Firma,
  FirmaInstitucional,
  Identidad,
  RespuestaDeclaracion,
  PaqueteDocumental,
  Pago,
  ConstanciaFirmaEmitida,
} from "./tipos";
import { ESTADOS_TERMINALES, cobroConfirmadoParaEmision, pagoAcreditado } from "./tipos";
import { codigoFipf, codigoSolicitud, codigoConstancia } from "./documentos";
import { codigoCertificado } from "./certificado-cobertura";
import { firmantesDiferidos } from "./firmantes-documento";
import type { PropositoOtp } from "../ports/otp-provider";
import { evaluarElegibilidad } from "./elegibilidad";
import { flujoV3Activo } from "./flujo-vigente";

/** Grafo del flujo de 8 pasos, vigente mientras `FLUJO_V3` esté apagado. */
export const TRANSICIONES_V2: Readonly<Record<EstadoExpediente, readonly EstadoExpediente[]>> = {
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
  // D-32 mide un expediente firmado por el cliente que no pagó, y acá todavía
  // no hay ni firma ni dinero. Un expediente abandonado en este punto no le
  // cuesta nada a nadie ni bloquea la cédula (regla inviolable #11 no lo
  // incluye), así que inventarle un vencimiento sería agregar un estado
  // terminal sin motivo. La caducidad de la *sesión* de firma es otra cosa y
  // la fija Code100 con su `fecha_expiracion` (D-10).
  PAQUETE_GENERADO: ["FIRMADO_CLIENTE"],
  // Firmado por el cliente: desde la enmienda del 04-sep-2026 a D-08, este es
  // el estado que habilita el cobro — ya no hace falta esperar a la
  // institucional, que se movió a después del pago (D-38). Caduca a los 10
  // minutos (D-32) **sin devolución que tramitar**: bajo este orden el
  // vencimiento ocurre antes del cobro, así que no hay premio que devolver.
  // La fila 30 de la matriz (*"Devolver el premio si el cliente no firma
  // dentro del plazo comunicado"*, Ley 4868/13, arts. 7(f), 17 y 30(b)) queda
  // satisfecha de la única manera que no puede fallar: no cobrando antes.
  //
  // La arista hacia FIRMADO **se conserva como legado**: hasta la enmienda del
  // 04-sep era el camino normal —el cliente firmaba y, en la misma operación,
  // también las institucionales—, y todavía la usan los expedientes que
  // llegaron a `FIRMADO_CLIENTE` bajo ese código y no se reescriben (regla
  // inviolable #10). Ningún caso de uso nuevo la produce: `registrarFirmaP8` y
  // `registrarFirmaClienteInterna` dejan el expediente en `FIRMADO_CLIENTE`, y
  // de ahí en más el pago es lo único que sigue.
  FIRMADO_CLIENTE: ["PAGO_CONFIRMADO", "VENCIDO", "FIRMADO"],
  // Cobrado y esperando la firma institucional diferida de Interseguros
  // (D-38, D-42), que `aplicarFirmasDiferidas` aplica —en línea, si el
  // adaptador puede, o por el lote externo cuando no— para dejarlo FIRMADO.
  // La salida a EMITIDO **se conserva pero queda guardada**: solo la toman los
  // expedientes legados que ya traen `firmasInstitucionales` aplicadas desde
  // antes de esta arista (`registrarEmisionP9` lo hace cumplir). La salida a
  // devolución existe porque un cobro con tarjeta sí puede devolverse **a
  // pedido** (D-02), sin esperar a que la institucional llegue.
  PAGO_CONFIRMADO: ["FIRMADO", "EMITIDO", "DEVOLUCION_EN_TRAMITE"],
  // Cobrado y con la firma institucional ya aplicada: lo único que falta es
  // remitir el expediente a Alianza. La salida a devolución es la misma que
  // desde PAGO_CONFIRMADO: un cobro con tarjeta puede devolverse a pedido,
  // haya llegado o no la institucional.
  //
  // Las salidas a PAGO_CONFIRMADO y a VENCIDO **se conservan como legado**:
  // eran el camino normal antes de la enmienda del 04-sep, cuando `FIRMADO`
  // era el estado que habilitaba el cobro (con el cliente y las
  // institucionales ya aplicadas en el mismo acto) y podía vencer sin haberse
  // pagado. Los expedientes que llegaron a `FIRMADO` bajo ese orden y no se
  // reescriben (regla inviolable #10) siguen teniendo a dónde ir.
  FIRMADO: ["EMITIDO", "DEVOLUCION_EN_TRAMITE", "PAGO_CONFIRMADO", "VENCIDO"],
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

/**
 * Grafo del flujo de 3 pasos (DI-2, Bloque E de `docs/plan/DECISIONES.md`).
 *
 * El orden nuevo —identidad primero, plan después— se logra **recableando
 * aristas entre los mismos estados**: no hay estados nuevos, así que los
 * expedientes históricos siguen siendo legibles y los terminales y legados
 * quedan idénticos. El tramo desde `DECLARACIONES_OK` hasta el final es el
 * mismo del v2, copiado a propósito y con test que lo verifica: la inversión
 * firma→pago (D-08) y la regla 6-bis no se renegocian con este rediseño.
 */
export const TRANSICIONES_V3: Readonly<Record<EstadoExpediente, readonly EstadoExpediente[]>> = {
  // Paso 1 · la cédula se conoce al comienzo: el bloqueo por cédula (regla
  // inviolable #11) se evalúa antes de que la persona invierta tiempo en el
  // flujo, y la salida a asistencia humana (tres análisis fallidos) sale de
  // acá y ya no de AUTORIZADO.
  INICIADO: ["IDENTIDAD_VERIFICADA", "ASISTENCIA_IDENTIDAD"],
  IDENTIDAD_VERIFICADA: ["CANAL_WA_VERIFICADO"],
  CANAL_WA_VERIFICADO: ["AUTORIZADO"],
  // La aceptación agrupada del paso 1 (DI-8) es la autorización: cierra la
  // inscripción y habilita el paso 2.
  AUTORIZADO: ["PLAN_SELECCIONADO"],
  // El autobucle sigue siendo el enlace `cambiar plan`. Las declaraciones
  // viven ahora en el mismo paso que el plan, así que la derivación a análisis
  // (regla inviolable #5) sale de acá.
  PLAN_SELECCIONADO: ["PLAN_SELECCIONADO", "DECLARACIONES_OK", "DERIVADO_MANUAL"],

  // Legado (D-06): sin aristas de entrada; conserva sus salidas v2 para que
  // un expediente histórico detenido acá pueda terminar su trámite.
  CANAL_EMAIL_VERIFICADO: ["IDENTIDAD_VERIFICADA", "ASISTENCIA_IDENTIDAD"],
  ASISTENCIA_IDENTIDAD: [],
  DERIVADO_MANUAL: [],

  // Paso 3 en adelante: idéntico al v2, aristas copiadas sin cambios.
  DECLARACIONES_OK: ["PAQUETE_GENERADO"],
  PAQUETE_GENERADO: ["FIRMADO_CLIENTE"],
  FIRMADO_CLIENTE: ["PAGO_CONFIRMADO", "VENCIDO", "FIRMADO"],
  PAGO_CONFIRMADO: ["FIRMADO", "EMITIDO", "DEVOLUCION_EN_TRAMITE"],
  FIRMADO: ["EMITIDO", "DEVOLUCION_EN_TRAMITE", "PAGO_CONFIRMADO", "VENCIDO"],
  VENCIDO: ["DEVOLUCION_EN_TRAMITE"],
  DEVOLUCION_EN_TRAMITE: ["DEVUELTO"],
  DEVUELTO: [],
  EMITIDO: ["DEVOLUCION_EN_TRAMITE"],
};

/** Grafo vigente en este despliegue: única fuente de verdad de la máquina de estados. */
const TRANSICIONES_LEGALES: Readonly<Record<EstadoExpediente, readonly EstadoExpediente[]>> =
  flujoV3Activo() ? TRANSICIONES_V3 : TRANSICIONES_V2;

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
  beneficiario: Beneficiario,
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
        beneficiario,
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
      beneficiario,
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
 * en FIRMADO_CLIENTE hasta que Bancard confirme (D-08 enmendada).
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
  if (expediente.estado !== "FIRMADO_CLIENTE") {
    return {
      ok: false,
      error:
        `Solo se puede preparar el pago desde FIRMADO_CLIENTE; el expediente está en ${expediente.estado}.`,
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
 * FIRMADO_CLIENTE → PAGO_CONFIRMADO. Es el único punto por el que el paso de
 * pago mueve el estado, y ahora ocurre **después** de la firma del cliente
 * (D-08 enmendada el 04-sep-2026).
 *
 * `PAGO_CONFIRMADO` significa *"el dinero entró"*, sin matices: los tres
 * medios de Bancard cobran directo desde que se retiró la preautorización
 * (D-02), así que la distinción entre garantía y cobro dejó de existir.
 *
 * **No hay cobro sin firma.** El único estado de origen legal es
 * FIRMADO_CLIENTE, al que solo se llega con el paquete cerrado y la firma del
 * cliente registrada — la institucional de Interseguros ya **no** es
 * condición: se aplica después, sobre el expediente cobrado (D-38). Es la
 * garantía que pide la Matriz Legal V4 §7 — el medio de cobro solo se habilita
 * con firma válida— y la razón por la que ya no existe la arista
 * DECLARACIONES_OK → PAGO_CONFIRMADO.
 *
 * El vencimiento no entra acá: bajo el orden nuevo el plazo se abre al firmar
 * el cliente (D-32) y lo que hace esta transición es cerrarlo.
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
  // número rompería el vínculo de la fila 47 (Res. SS SG. 215/17, punto 14).
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
 * de cumplimiento, Res. SS SG. 215/17, punto 14; Ley 6822/21, arts. 44-46).
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
// OTP vigente por propósito (manual funcional v4, 03A)
// ---------------------------------------------------------------------------

/**
 * Asienta `otpId` como el OTP vigente de `proposito` **sin mover el estado**.
 * Desde esta escritura cualquier otro `otpId` de ese propósito queda
 * reemplazado: *"Un nuevo OTP invalida el anterior"*. Ver
 * `OtpVigentePorProposito` en `tipos.ts`.
 */
export function registrarOtpVigente(
  expediente: Expediente,
  proposito: PropositoOtp,
  otpId: string,
  ahora: string = new Date().toISOString(),
): Expediente {
  return {
    ...expediente,
    otpVigente: { ...expediente.otpVigente, [proposito]: otpId },
    actualizadoEn: ahora,
  };
}

// ---------------------------------------------------------------------------
// v4 · datos personales (03D) y actividad e ingresos (03E)
// ---------------------------------------------------------------------------

/**
 * 03D · completa la identidad con lo que la persona declara y guarda su
 * domicilio. **No cambia el estado**: el expediente ya está en
 * `IDENTIDAD_VERIFICADA` desde 03C y sigue ahí hasta que 04D cierre las
 * declaraciones.
 *
 * Que no haya transición no lo vuelve un detalle de presentación: lo que se
 * escribe acá —país de nacimiento, nacionalidad, sexo, estado civil,
 * domicilio— termina impreso en la Solicitud y en el FIPF, y por eso pasa por
 * el dominio y deja evidencia, como cualquier otro dato del expediente.
 *
 * La cédula y la fecha de nacimiento **no se tocan**: siguen siendo las que
 * leyó el OCR, aunque la persona las haya editado en pantalla (D-31). Lo
 * editado viaja como dato declarado y la elegibilidad se calcula con lo leído.
 */
export function registrarDatosPersonalesV4(
  expediente: Expediente,
  cambios: {
    readonly identidad: Identidad;
    readonly datosPersonales: DatosPersonalesV4;
  },
  ahora: string = new Date().toISOString(),
): Expediente {
  return {
    ...expediente,
    identidad: cambios.identidad,
    datosPersonales: cambios.datosPersonales,
    actualizadoEn: ahora,
  };
}

/**
 * 03E · actividad, ingresos y condición PEP.
 *
 * Dos desenlaces, y la diferencia es la única regla dura de la pantalla:
 *
 * - **PEP `false`**: se guarda la actividad y el expediente **sigue** en
 *   `IDENTIDAD_VERIFICADA`, camino a las declaraciones.
 * - **PEP `true`**: el expediente pasa a `DERIVADO_MANUAL` con su número de
 *   caso. No es un rechazo —el manual y el propio arte lo dicen con todas las
 *   letras— sino el fin del camino automático: desde `DERIVADO_MANUAL` no hay
 *   transición a firma, pago ni emisión, así que la garantía es estructural y
 *   no depende de que nadie se acuerde de comprobarla.
 *
 * `datosComplementarios` se compone acá con las dos mitades —el domicilio de
 * 03D y la actividad de 03E— porque es el bloque que leen el FIPF, la consola
 * y los documentos. Sin esto, partir la pantalla en dos habría obligado a
 * cambiar todo lo que ya lee ese bloque.
 */
export function registrarActividadV4(
  expediente: Expediente,
  entrada: {
    readonly actividad: ActividadEconomicaV4;
    /** Obligatorio cuando `esPep` es `true`; ignorado cuando no lo es. */
    readonly numeroCasoDerivacion?: string;
  },
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  const domicilio = expediente.datosPersonales;
  if (!domicilio) {
    return {
      ok: false,
      error: "Falta el domicilio de 03D: la actividad no se puede registrar sin él.",
    };
  }

  const datosComplementarios: DatosComplementariosP6 = {
    domicilio: domicilio.domicilio,
    ciudad: domicilio.ciudad,
    situacionLaboral: entrada.actividad.situacionLaboral,
    actividad: entrada.actividad.actividadEconomica,
    profesion: entrada.actividad.profesion,
    empresa: entrada.actividad.empresa,
    ingresoMensualDeclaradoGs: entrada.actividad.ingresoMensualDeclaradoGs,
    origenFondos: entrada.actividad.origenIngresos,
  };

  if (!entrada.actividad.esPep) {
    return {
      ok: true,
      expediente: {
        ...expediente,
        actividadEconomica: entrada.actividad,
        datosComplementarios,
        actualizadoEn: ahora,
      },
    };
  }

  if (!entrada.numeroCasoDerivacion) {
    return {
      ok: false,
      error: "Derivar por condición PEP exige un número de caso.",
    };
  }

  return transicionarExpediente(
    expediente,
    "DERIVADO_MANUAL",
    {
      actividadEconomica: entrada.actividad,
      datosComplementarios,
      numeroCasoDerivacion: entrada.numeroCasoDerivacion,
      // La condición PEP dejó de ser una pregunta de la pantalla de
      // declaraciones y pasó a 03E (D-33), pero **sigue siendo la misma
      // categoría de bloqueo**: la número 8 del motor de elegibilidad, cuya
      // `categoriaBloqueo` es `PEP`. Se asienta ese número y no una lista
      // vacía porque de él sale el motivo que muestran la Pantalla A, la
      // consola y la remisión a Alianza — y porque decir «derivado sin motivo»
      // sería falso. Nunca se asienta una declaración de salud: eso lo hace
      // la pantalla 04A, con las suyas.
      motivoDerivacionManual: [8],
    },
    ahora,
  );
}

/**
 * 04A · las tres declaraciones de salud y el beneficiario (flujo v4).
 *
 * Es el momento en que la **evaluación médica** puede detener el proceso, y
 * por eso tiene dos desenlaces como 03E:
 *
 * - **Compatibles**: se guardan las tres y el beneficiario, y el expediente
 *   **sigue** en `IDENTIDAD_VERIFICADA`. Las declaraciones completas se
 *   escriben en 04D, que es donde se aceptan las que faltan.
 * - **Alguna incompatible**: `DERIVADO_MANUAL` con su número de caso. Es la
 *   regla inviolable #5, que no cambia con v4: lo que cambió es que ahora son
 *   **tres** preguntas en esta pantalla y la PEP se declara en 03E.
 *
 * La evaluación usa el mismo motor de siempre. Las cinco declaraciones que
 * todavía no se contestaron entran como su **respuesta habilitante**, que es
 * lo único honesto: no se está afirmando que la persona las aceptó —para eso
 * están 04D y la firma—, se está diciendo que **no son las que bloquean**.
 * Ninguna de las cinco es de las que bloquean, salvo la PEP, que se toma del
 * dato ya declarado en 03E.
 */
export function registrarDeclaracionesMedicasV4(
  expediente: Expediente,
  entrada: {
    readonly declaracionesMedicas: DeclaracionesMedicasV4;
    readonly beneficiario: Beneficiario;
    /** Obligatorio solo si alguna respuesta bloquea. */
    readonly numeroCasoDerivacion?: string;
  },
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  const pep: RespuestaDeclaracion = expediente.actividadEconomica?.esPep ? "SI" : "NO";

  const paraEvaluar: Declaraciones = {
    ...entrada.declaracionesMedicas,
    vigenciaYCarencias: "SI",
    veracidad: "SI",
    entregaDigital: "SI",
    corredorDeLaPoliza: "SI",
    condicionPep: pep,
  };

  const resultado = evaluarElegibilidad(paraEvaluar);

  if (resultado.elegibleParaEmisionAutomatica) {
    return {
      ok: true,
      expediente: {
        ...expediente,
        declaracionesMedicas: entrada.declaracionesMedicas,
        beneficiario: entrada.beneficiario,
        actualizadoEn: ahora,
      },
    };
  }

  if (!entrada.numeroCasoDerivacion || entrada.numeroCasoDerivacion.trim() === "") {
    return { ok: false, error: "Una derivación a DERIVADO_MANUAL requiere un número de caso." };
  }

  return transicionarExpediente(
    expediente,
    "DERIVADO_MANUAL",
    {
      declaracionesMedicas: entrada.declaracionesMedicas,
      beneficiario: entrada.beneficiario,
      motivoDerivacionManual: resultado.declaracionesQueBloquean,
      numeroCasoDerivacion: entrada.numeroCasoDerivacion,
    },
    ahora,
  );
}

/**
 * 04D · los consentimientos, y con ellos el cierre de las declaraciones (v4).
 *
 * Es la **única** puerta a `DECLARACIONES_OK` en v4. Compone el
 * `Declaraciones` completo con las tres médicas de 04A, la condición PEP de
 * 03E y los consentimientos de esta pantalla, y delega en
 * `registrarDeclaracionesP6`: el mismo motor, la misma derivación y la misma
 * garantía de que un expediente derivado no puede seguir.
 *
 * La declaración 5 —veracidad— entra en `SI` porque es lo que la persona firma
 * a continuación, integrada al PDF por la Matriz Legal V4 §4 y no como una
 * casilla aparte.
 */
export function registrarConsentimientosV4(
  expediente: Expediente,
  entrada: {
    readonly aceptaInicioDeCoberturaYCarencias: boolean;
    readonly aceptaEntregaDigital: boolean;
    readonly numeroCasoDerivacion: string;
  },
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  const medicas = expediente.declaracionesMedicas;
  if (!medicas) {
    return { ok: false, error: "Faltan las declaraciones de salud de 04A." };
  }
  if (!expediente.beneficiario) {
    return { ok: false, error: "Falta el beneficiario de 04A." };
  }
  if (!entrada.aceptaInicioDeCoberturaYCarencias || !entrada.aceptaEntregaDigital) {
    return { ok: false, error: "Los dos consentimientos de 04D son obligatorios." };
  }

  const declaraciones: Declaraciones = {
    ...medicas,
    vigenciaYCarencias: entrada.aceptaInicioDeCoberturaYCarencias ? "SI" : "NO",
    veracidad: "SI",
    entregaDigital: entrada.aceptaEntregaDigital ? "SI" : "NO",
    // El tercer bloque de 04D es **informativo y sin casilla**: el manual lo
    // fija así y se registra al continuar (ANALISIS.md §3).
    corredorDeLaPoliza: "SI",
    condicionPep: expediente.actividadEconomica?.esPep ? "SI" : "NO",
  };

  return registrarDeclaracionesP6(
    expediente,
    declaraciones,
    expediente.beneficiario,
    entrada.numeroCasoDerivacion,
    ahora,
  );
}

/**
 * El `otpId` vigente de `proposito` cuando `otpId` **no** es él; `null` si
 * `otpId` es el vigente o si el propósito no tiene ninguno asentado.
 */
export function otpVigenteQueLoReemplaza(
  expediente: Expediente,
  proposito: PropositoOtp,
  otpId: string,
): string | null {
  const vigente = expediente.otpVigente[proposito];
  return vigente !== undefined && vigente !== otpId ? vigente : null;
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
 * Las cinco cosas que hace imposibles de violar:
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
 * **Abre el plazo de pago en la misma transición** (D-32: 10 minutos). Desde
 * la enmienda del 04-sep-2026 a D-08 este es el estado que habilita el cobro
 * —no hace falta esperar a la firma institucional de Interseguros, que se
 * aplica después (D-38)—, así que es acá donde corresponde arrancar el reloj:
 * dejarlo para una escritura posterior abriría una ventana en la que existe un
 * expediente firmado sin vencimiento posible.
 */
export function registrarFirmaP8(
  expediente: Expediente,
  firma: Firma,
  plazoPagoVenceEn: string,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (!expediente.paqueteDocumental) {
    return { ok: false, error: "No se puede registrar una firma sin paquete documental cerrado." };
  }

  if (!expediente.actoDeFirma) {
    return { ok: false, error: "No hay ningún acto de firma abierto para este expediente." };
  }

  if (firma.origen === "PROVEEDOR" && expediente.actoDeFirma.idCode100 !== firma.referenciaActo) {
    return {
      ok: false,
      error:
        `La firma llegó con el identificador ${firma.referenciaActo}, ` +
        `pero el acto abierto de este expediente es ${expediente.actoDeFirma.idCode100}.`,
    };
  }

  if (firma.hashDocumentoFirmado.trim() === "") {
    return { ok: false, error: "La firma tiene que traer la huella del documento firmado." };
  }

  return transicionarExpediente(expediente, "FIRMADO_CLIENTE", { firma, plazoPagoVenceEn }, ahora);
}

/**
 * PAQUETE_GENERADO → FIRMADO_CLIENTE con la **firma interna** del cliente
 * (`origen: "INTERNA"`), la que genera SeguroLoTengo con su propio OTP en vez
 * de delegarla en un prestador (Res. SS.SG. 210/2025, art. 4).
 *
 * Es una arista propia y no un parámetro más de `registrarFirmaP8` por una
 * razón concreta: aquella exige un `actoDeFirma` abierto y compara su
 * `idCode100`, y acá **no hay sesión de nadie que comparar**. Meter la firma
 * interna por ese camino obligaría a inventarle al acto un identificador de
 * proveedor que no existe, que es exactamente la mentira que el campo
 * `referenciaActo` vino a evitar.
 *
 * Lo que sí se sigue haciendo cumplir es lo mismo de siempre: no hay firma sin
 * paquete cerrado (regla inviolable #4), la huella no puede venir vacía, y el
 * plazo de pago se abre en la misma transición (D-32), igual que en
 * `registrarFirmaP8`: desde la enmienda del 04-sep a D-08, `FIRMADO_CLIENTE`
 * ya habilita el cobro sin esperar a la institucional (D-38).
 *
 * **Sobre la huella mientras no haya sellado.** Con la variante de evidencia
 * (`docs/VALIDACION_LEGAL_FIRMA_INTERNA.md` §1), firmar no modifica el PDF: la
 * huella del documento firmado es la del documento cerrado, y lo que prueba la
 * firma es el registro de evidencia. Si el dictamen legal elige la variante
 * criptográfica, el sellado producirá bytes nuevos y esta huella dejará de
 * coincidir con la del cierre — por eso se recibe como dato y no se deriva.
 */
export function registrarFirmaClienteInterna(
  expediente: Expediente,
  acto: { readonly firma: Firma; readonly constancia: ConstanciaFirmaEmitida },
  plazoPagoVenceEn: string,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  const { firma, constancia } = acto;
  if (firma.origen !== "INTERNA") {
    return {
      ok: false,
      error: "Esta transición es para la firma interna; una firma de proveedor va por registrarFirmaP8.",
    };
  }

  if (!expediente.paqueteDocumental) {
    return { ok: false, error: "No se puede registrar una firma sin paquete documental cerrado." };
  }

  if (firma.referenciaActo.trim() === "") {
    return {
      ok: false,
      error: "La firma interna tiene que traer la referencia del acto que la produjo.",
    };
  }

  if (firma.hashDocumentoFirmado.trim() === "") {
    return { ok: false, error: "La firma tiene que traer la huella del documento firmado." };
  }

  // D-27 · la constancia del acto entra en la misma escritura que la firma,
  // como el certificado entra con el cobro: un expediente firmado sin su
  // constancia sería un estado imposible. Y sus códigos tienen que derivar del
  // correlativo, o el vínculo de la fila 47 se rompe.
  const correlativo = expediente.numeroPropuesta;
  if (!correlativo) {
    return { ok: false, error: "No se puede registrar la firma sin correlativo de propuesta." };
  }
  if (constancia.codigo !== codigoConstancia(correlativo)) {
    return {
      ok: false,
      error: `La constancia ${constancia.codigo} no deriva del correlativo ${correlativo}.`,
    };
  }
  if (constancia.codigoPaquete !== expediente.paqueteDocumental.codigo) {
    return {
      ok: false,
      error: `La constancia ${constancia.codigo} no cuelga del paquete ${expediente.paqueteDocumental.codigo}.`,
    };
  }
  if (constancia.hashSha256.trim() === "") {
    return { ok: false, error: "La constancia tiene que traer la huella de su PDF cerrado." };
  }

  return transicionarExpediente(
    expediente,
    "FIRMADO_CLIENTE",
    { firma, constanciaFirma: constancia, plazoPagoVenceEn },
    ahora,
  );
}

/**
 * PAGO_CONFIRMADO → FIRMADO: la firma institucional de Interseguros sobre el
 * mismo documento que ya firmó el cliente, aplicada **después del pago**
 * (D-38, D-42).
 *
 * Hasta la enmienda del 04-sep-2026 a D-08, esta transición era
 * `FIRMADO_CLIENTE → FIRMADO` y abría acá el plazo de pago. Las dos cosas se
 * movieron: el origen pasó a `PAGO_CONFIRMADO` —el cobro ya no depende de
 * esta firma— y el plazo se abre antes, con la firma del cliente (D-32). Lo
 * que esta transición sigue haciendo es cerrar el tramo: quiénes firman y con
 * qué modalidad sale de la configuración (`firmantesDiferidos`, D-42), no de
 * una lista escrita acá, y sin la lista completa el expediente no puede
 * quedar habilitado para la emisión.
 *
 * **Solo desde `PAGO_CONFIRMADO`.** El grafo también admite legalmente
 * `FIRMADO_CLIENTE → FIRMADO` (legado, ver `TRANSICIONES_V2`), pero esta
 * función lo rechaza explícitamente: aplicar la institucional antes de cobrar
 * volvería a acoplar el cobro a una firma que D-38 sacó del camino crítico.
 * La arista legada existe para expedientes históricos que llegaron a
 * `FIRMADO` por el camino viejo, no para que este caso de uso la reabra.
 */
export function registrarFirmasInstitucionales(
  expediente: Expediente,
  firmas: readonly FirmaInstitucional[],
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (expediente.estado !== "PAGO_CONFIRMADO") {
    return {
      ok: false,
      error:
        `Las firmas institucionales diferidas solo se aplican desde PAGO_CONFIRMADO; ` +
        `el expediente está en ${expediente.estado}.`,
    };
  }

  if (!expediente.firma) {
    return { ok: false, error: "No hay firma del cliente sobre la que aplicar las institucionales." };
  }

  // La lista tiene que traer exactamente los firmantes que la configuración
  // declara como `DIFERIDO` para este documento (D-42). Si falta uno, el acto
  // no está completo y el expediente no puede quedar habilitado para la
  // emisión.
  const esperados = firmantesDiferidos("PAQUETE").map((firmante) => firmante.rol);
  const aplicados = firmas.map((firma) => firma.rol);
  const faltantes = esperados.filter((rol) => !aplicados.includes(rol));
  if (faltantes.length > 0) {
    return {
      ok: false,
      error: `Faltan firmas institucionales previstas para este documento: ${faltantes.join(", ")}.`,
    };
  }

  return transicionarExpediente(expediente, "FIRMADO", { firmasInstitucionales: firmas }, ahora);
}

/**
 * Vencimiento del plazo para pagar → VENCIDO (D-10, D-32).
 *
 * Bajo el orden nuevo lo que caduca es un expediente **firmado por el cliente
 * y no pagado**: el reloj arranca con esa firma (D-32) y se apaga con el
 * cobro. La consecuencia es que vencer ya no cuesta plata — no hubo cobro, así
 * que no hay premio que devolver— y por eso VENCIDO es terminal en el flujo
 * nuevo.
 *
 * Vence desde `FIRMADO_CLIENTE` y, como legado, también desde `FIRMADO`: los
 * expedientes que llegaron a `FIRMADO` por el camino anterior a la enmienda
 * del 04-sep (cliente e institucional firmando en el mismo acto) ya traen su
 * `plazoPagoVenceEn` calculado ahí, y este chequeo lo sigue respetando sin
 * reescribirlos (regla inviolable #10).
 *
 * **`FIRMADO` con cobro acreditado nunca vence.** Desde la enmienda, `FIRMADO`
 * también es el estado de un expediente *ya cobrado* al que se le aplicó la
 * firma institucional diferida, y ese expediente conserva el
 * `plazoPagoVenceEn` que se abrió con la firma del cliente. Sin esta guarda,
 * pasados esos 10 minutos cualquier lectura (la consola, un sondeo) lo movería
 * a `VENCIDO` por la arista legada: un expediente pagado declarado vencido. Con
 * la firma de Interseguros en lote (D-38) puede quedar horas en `FIRMADO`, así
 * que no es un caso de borde.
 *
 * Un expediente que cerró su paquete y nunca firmó no vence: no hay firma ni
 * dinero de por medio, no bloquea la cédula y ponerle un estado terminal no
 * protegería nada. La caducidad de la *sesión* de firma es un hecho distinto y
 * lo fija Code100 con su `fecha_expiracion` (D-10).
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
const ESTADOS_QUE_VENCEN: readonly EstadoExpediente[] = ["FIRMADO_CLIENTE", "FIRMADO"];

export function vencerPlazoSiCorresponde(
  expediente: Expediente,
  ahora: string = new Date().toISOString(),
): ResultadoTransicion {
  if (!ESTADOS_QUE_VENCEN.includes(expediente.estado)) return { ok: true, expediente };

  // Lo que caduca es un expediente firmado y **no pagado**. Un cobro acreditado
  // apaga el reloj, sea cual sea el estado desde el que se lo mire.
  if (expediente.pago && pagoAcreditado(expediente.pago.estado)) return { ok: true, expediente };

  if (!expediente.plazoPagoVenceEn || ahora < expediente.plazoPagoVenceEn) {
    return { ok: true, expediente };
  }

  return transicionarExpediente(expediente, "VENCIDO", {}, ahora);
}

// ---------------------------------------------------------------------------
// P9 · Emisión de la póliza (Alianza mediante SEBAOT)
// ---------------------------------------------------------------------------

/**
 * PAGO_CONFIRMADO o FIRMADO → EMITIDO: SeguroLoTengo remitió el expediente y
 * Alianza aceptó la solicitud. Es la única escritura de `expediente.poliza`.
 *
 * **EMITIDO significa "solicitud aceptada y emisión ordenada", no "póliza en
 * mano".** P9 lo muestra exactamente así: `Solicitud aceptada ✓` junto a
 * `Póliza en preparación ⋯`. El estado del documento en sí vive en
 * `poliza.estado` y lo mueve Alianza a su ritmo — por eso son dos cosas
 * distintas y no un solo campo.
 *
 * Las cuatro cosas que hace imposibles de violar:
 *
 * **No hay emisión sin firma completa** (regla inviolable #3): se verifica que
 * `firma` esté.
 *
 * **No hay emisión sin la firma institucional aplicada** (D-38, D-42). El
 * grafo admite legalmente `PAGO_CONFIRMADO → EMITIDO` —es la arista que
 * conservan los expedientes legados que ya cobraron y firmaron todo en el
 * mismo acto, bajo el código anterior a la enmienda del 04-sep—, pero un
 * expediente **nuevo** que llega a `PAGO_CONFIRMADO` todavía no tiene la
 * institucional: la aplica `aplicarFirmasDiferidas`, que lo deja `FIRMADO`.
 * Exigir `firmasInstitucionales` no vacío, sin importar el estado exacto de
 * origen, es lo que distingue un expediente legado (ya las trae) de uno nuevo
 * a medio camino (todavía no): sin esta guarda, la arista legada quedaría
 * abierta para cualquier expediente nuevo que SEBAOT alcanzara a procesar
 * antes de que la institucional llegara.
 *
 * **No hay emisión sin cobro efectivo** (fila 44 de la matriz: *"Si falla el
 * cobro, no solicitar la emisión automática"*, Código Civil, art. 1373; Ley
 * 4868/13, arts. 7(e) y 7(p)). Los dos estados de origen legales ya significan
 * *"el dinero entró"*: la comprobación explícita del `Pago` queda igual porque
 * una condición de la que depende una obligación legal no se sostiene sola en
 * el grafo. Es el orden de la fila 43 —firma → cobro → envío a Alianza →
 * validación → emisión—, que con D-08 pasó a ser también el orden de las
 * pantallas.
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

  // D-38/D-42 · sin la institucional aplicada no hay emisión, sea cual sea el
  // estado exacto de origen. `FIRMADO` siempre la trae (`registrarFirmasInstitucionales`
  // la exige); `PAGO_CONFIRMADO` solo la trae en expedientes legados.
  if (expediente.firmasInstitucionales.length === 0) {
    return {
      ok: false,
      error:
        "No se puede emitir sin la firma institucional diferida aplicada (D-38/D-42): " +
        "el expediente está en PAGO_CONFIRMADO sin firmasInstitucionales.",
    };
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
