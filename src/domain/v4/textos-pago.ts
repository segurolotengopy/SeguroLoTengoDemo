/**
 * Textos de 05A (pago). Etapa 5 de 5.
 *
 * ## Sin arte
 *
 * `ANALISIS_VISUAL_PNG.md` §12 lo dice explícito: **05A no tiene arte, ni
 * aprobado ni candidato** ("las tres últimas ni siquiera tienen candidato").
 * Esta pantalla es una extrapolación del sistema visual de las 12 pantallas
 * aprobadas (§0 del mismo documento: paleta, tipografía, componentes de §10) y
 * es **provisional** hasta que Interseguros mande el arte correspondiente.
 *
 * ## Qué se reutiliza y qué es nuevo
 *
 * El contrato de negocio no cambió con v4: sigue siendo el de
 * `src/domain/textos-p7.ts` y `src/domain/pago-p7.ts` (D-08, D-02, D-12).
 * Donde ese archivo ya tiene el literal exacto que el backend espera o que ya
 * se firmó/registró en evidencia (CHG-37, CMP-08), se **reexporta tal cual**
 * en vez de reescribirlo: duplicar `TEXTO_ACEPTACION_CERTIFICADO_P7` con otra
 * redacción crearía dos versiones de un texto que se persiste con su
 * `versionTexto`. Los literales de `TEXTOS_MEDIOS_DE_PAGO_P7` tampoco se
 * tocan: ya están en segunda persona neutra ("tu Solicitud", "el pago se
 * acredita") y valen para voseo sin cambios.
 *
 * Lo nuevo es la copia propia de esta pantalla — título, bajada, plazo de 10
 * minutos (D-32, no las 24 horas de `AVISO_PLAZO_PAGO_P7`) y los mensajes de
 * rechazo — en voseo, siguiendo el patrón de `textos-verificacion.ts`.
 */
import {
  MEDIO_POR_DEFECTO_P7,
  NOTA_DESGLOSE_PROVISIONAL_P7,
  NOTA_DESTINO_DE_FONDOS_P7,
  NOTA_MONEDA_P7,
  TEXTO_ACEPTACION_CERTIFICADO_P7,
  TEXTOS_MEDIOS_DE_PAGO_P7,
  VERSION_ACEPTACION_CERTIFICADO_P7,
} from "../textos-p7";

export {
  MEDIO_POR_DEFECTO_P7,
  NOTA_DESGLOSE_PROVISIONAL_P7,
  NOTA_DESTINO_DE_FONDOS_P7,
  NOTA_MONEDA_P7,
  TEXTO_ACEPTACION_CERTIFICADO_P7,
  TEXTOS_MEDIOS_DE_PAGO_P7,
  VERSION_ACEPTACION_CERTIFICADO_P7,
};

export const TEXTOS_05A = {
  titulo: "Realizá",
  tituloAcento: "el pago",
  // Literal de `SUBTITULO_P7`: ya está en voseo ("firmaste") y sigue siendo
  // cierto bajo v4 — el orden firma-antes-que-pago (D-08) no cambió.
  bajada: "Ya firmaste tu Solicitud: falta el pago para contratar el seguro.",

  tituloPlazo: "Plazo para pagar",
  // D-32 · 10 minutos en v4, no las 24 horas de `AVISO_PLAZO_PAGO_P7`. A esa
  // escala no hay margen para el aviso manual por WhatsApp/correo que sí tiene
  // sentido en 24 horas: por eso el texto no promete un aviso posterior.
  avisoPlazo:
    "Si el pago no se completa en este plazo, la solicitud vence y no se te cobra nada. Vas a poder iniciar una solicitud nueva.",
  plazoVencido: "Se cumplió el plazo para pagar. Tu solicitud venció; no se te cobró nada.",

  tituloResumen: "Resumen del cobro",
  rotuloPremio: "Premio total anual · IVA incluido",
  rotuloPrimaNeta: "Prima neta anual",
  rotuloIva: "IVA",
  rotuloPropuesta: "Propuesta / futura póliza",

  tituloMedios: "ELEGÍ EL MEDIO DE PAGO",
  notaMedios: "Los tres medios cobran el premio total en el momento; cambia por dónde entra el dinero.",

  avisoImportanteTitulo: "IMPORTANTE",
  // Primer párrafo: literal de `TEXTOS_AVISO_PRIVACIDAD.tarjetas` (tarjeta
  // "PAGO CON TARJETA", `src/domain/v4/textos-portada.ts`) — es el mismo aviso
  // de privacidad que ya se mostró y aceptó en 03B, repetido acá porque es
  // donde más importa. Segundo párrafo: registro de la operación (literal de
  // `SEGURIDAD_P7`). Tercero: la cobertura (CHG-41).
  avisoImportante: [
    "Bancard procesa el pago. Interseguros S.A. no recibe ni administra los fondos y no almacena los datos completos de la tarjeta.",
    "Se registran referencia, importe, estado, fecha, hora, respuesta e identificador Bancard.",
    "El pago no equivale a la emisión de la póliza. La cobertura empieza 24 horas exactas después de acreditarse este pago.",
  ],

  pagoAcreditadoTitulo: "Pago acreditado",
  pagoAcreditado: "Bancard acreditó el premio a Alianza Garantía. Tu seguro quedó contratado.",
  continuando: "Continuando...",

  ventanaTitulo: "Ventana segura de Bancard",
  ventanaComercio: "Comercio: Alianza Garantía Seguros y Reaseguros S.A.",
  qrTitulo: "Escaneá el QR con tu app de banco",
  qrVence: (fecha: string) => `El QR vence el ${fecha}.`,
  tarjetaTitulo: "Completá el pago en el formulario seguro de Bancard",
  tarjetaAclaracion: (portal: string) =>
    `Los datos de tu tarjeta se ingresan en Bancard. ${portal} no los recibe ni los guarda.`,
  esperando: (reloj: string) => `Esperando la confirmación de Bancard… ${reloj}`,
  esperaLarga:
    "Está tardando más de lo habitual. Si ya pagaste, no cierres ni volvás a pagar: esperá acá, la confirmación se registra igual. Si todavía no pagaste, podés generar el pago de nuevo.",
  botonPagadoDemo: "PAGADO",
  botonPagadoDemoEnEspera: (segundos: number) =>
    `Demostración: se habilita en ${segundos} s, simulando el tiempo de escanear y pagar.`,
  botonPagadoDemoListo: "Demostración: equivale a haber pagado el QR desde la app de tu banco.",

  intentosAgotados: (intentos: number) =>
    `Bancard no está respondiendo y ya lo intentamos ${intentos} veces. No es algo que hayas hecho mal y no se te cobró nada. Volvé a esta pantalla en unos minutos: tenés 10 minutos desde que firmaste para completar el pago.`,
} as const;

/**
 * Mensajes por motivo de rechazo, en voseo.
 *
 * Mismo criterio que `FormularioPagoP7.tsx`: un mapa de texto plano, sin
 * importar el tipo `MotivoRechazoP7` de `@/domain/pago-p7` (arrastraría
 * `node:crypto` al bundle del cliente). Los motivos sin entrada específica
 * caen en `CUERPO_INVALIDO`, igual que en v2 — son los que el flujo de esta
 * pantalla no puede producir porque la CTA ya los impide (p. ej.
 * `ACEPTACION_CERTIFICADO_REQUERIDA`, imposible mientras la casilla
 * deshabilita el botón) o porque el sondeo los trata como transitorios y
 * nunca llegan a mostrarse (`CERTIFICADO_NO_EMITIDO`, `CONFLICTO_CONCURRENCIA`).
 */
export const MENSAJES_P7: Readonly<Record<string, string>> = {
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  ESTADO_INVALIDO: "Este proceso ya no está en el paso de pago.",
  EXPEDIENTE_INCOMPLETO: "Faltan datos del expediente para preparar el pago.",
  MEDIO_INVALIDO: "Elegí uno de los medios de pago disponibles.",
  ACEPTACION_CERTIFICADO_REQUERIDA: "Marcá la autorización para poder continuar.",
  PLAZO_VENCIDO: "Se cumplió el plazo para pagar. Tu solicitud venció; no se te cobró nada.",
  BANCARD_NO_DISPONIBLE: "Bancard no respondió. Volvé a intentar en unos segundos.",
  BANCARD_RECHAZO:
    "Bancard rechazó el pago. Podés intentar de nuevo con otra tarjeta o elegir otro medio: no se te cobró nada.",
  PAGO_NO_INICIADO:
    "Bancard no reconoce esta operación, así que seguir esperando no la va a confirmar. Generá el pago de nuevo: no se te cobró nada.",
  PAGO_CANCELADO: "La operación se canceló o venció. Generá una nueva.",
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};
