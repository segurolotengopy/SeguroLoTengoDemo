import type {
  DatosComplementariosP6,
  DatosFacturacionP7,
  DeclaracionOrigenLicito,
  Declaraciones,
  EstadoExpediente,
  Expediente,
  Identidad,
  PaqueteDocumental,
  Pago,
} from "../tipos";
import { crearExpedienteInicial } from "../tipos";
import { PLANES } from "../catalogo";
import {
  registrarFirmasInstitucionales,
  registrarPaqueteDocumental,
  transicionarExpediente,
} from "../expediente";
import { PASOS_FLUJO } from "../rutas-flujo";
import { codigoFipf, codigoSolicitud } from "../documentos";
import { TEXTO_DECLARACION_ORIGEN_LICITO, VERSION_DECLARACION_ORIGEN_LICITO } from "../textos-p6";

export const declaracionesCompatibles: Declaraciones = {
  estadoDeSalud: "SI",
  antecedentesDeContratacion: "NO",
  enfermedadesDiagnosticadas: "NO",
  vigenciaYCarencias: "SI",
  veracidad: "SI",
  entregaDigital: "SI",
  corredorDeLaPoliza: "SI",
  condicionPep: "NO",
};

/**
 * Valores tomados de los selectores reales de `catalogo-p6.ts`: si alguien
 * saca una opción de esas listas, este fixture deja de ser un dato que P6
 * pueda aceptar y `catalogo-p6.test.ts` lo marca.
 */
export const datosComplementariosFixture: DatosComplementariosP6 = {
  domicilio: "Avda. España 123",
  ciudad: "Asunción",
  situacionLaboral: "Relación de dependencia",
  actividad: "Servicios financieros",
  profesion: "Contador/a",
  empresa: "Estudio Contable SRL",
  ingresoMensualDeclaradoGs: 8_000_000,
  beneficiario: {
    tipo: "HEREDEROS_LEGALES",
    nombreCompleto: null,
    parentesco: null,
    domicilio: null,
    numeroCedula: null,
  },
};

/**
 * Número de caso fijo para los tests que ejercitan la derivación. En
 * producción lo genera `generarNumeroCaso` con un CSPRNG; acá se fija para que
 * las aserciones no dependan del azar.
 */
export const NUMERO_CASO_FIJO = "CASO-2026-000042";

export function crearExpediente(id = "EXP-TEST-1"): Expediente {
  return crearExpedienteInicial({ id, ahora: "2026-01-01T10:00:00.000Z" });
}

/** Avanza un expediente recién creado hasta IDENTIDAD_VERIFICADA siguiendo el camino feliz. */
export function avanzarHastaIdentidadVerificada(expediente: Expediente): Expediente {
  // El orden es el del flujo nuevo (CHG-01): el plan primero, el WhatsApp
  // después, y sin paso de correo (D-06). Sale de `PASOS_FLUJO`, que es donde
  // vive el orden: si mañana se reordena el wizard, este helper acompaña solo
  // en vez de quedar describiendo un camino que ya no existe.
  const secuencia: EstadoExpediente[] = PASOS_FLUJO.map((paso) => paso.estadoAlCompletar).slice(
    0,
    PASOS_FLUJO.findIndex((paso) => paso.estadoAlCompletar === "IDENTIDAD_VERIFICADA") + 1,
  );

  let actual = expediente;
  for (const estado of secuencia) {
    const resultado = transicionarExpediente(actual, estado);
    if (!resultado.ok) throw new Error(resultado.error);
    actual = resultado.expediente;
  }
  return actual;
}

// ---------------------------------------------------------------------------
// Expediente completo hasta PAGO_CONFIRMADO
// ---------------------------------------------------------------------------

/**
 * Identidad ficticia, con la misma forma que la que P5 obtiene por OCR. Los
 * datos son inventados, igual que en `src/adapters/mock/personas.ts`; los
 * hashes de captura son cadenas fijas para que las aserciones no dependan del
 * azar.
 */
export const identidadFixture: Identidad = {
  numeroCedula: "9.323.336",
  nombres: "Mónica Mariana",
  apellidos: "Gorena Tapia",
  fechaNacimiento: "1990-04-17",
  sexo: "Femenino",
  nacionalidad: "Paraguaya",
  paisNacimiento: "Paraguay",
  estadoCivil: "Soltera",
  captura: {
    hashFrenteCedula: "a".repeat(64),
    hashDorsoCedula: "b".repeat(64),
    hashSelfie: "c".repeat(64),
    pruebaDeVidaAprobada: true,
    coincidenciaFacialAprobada: true,
  },
};

export const NUMERO_PROPUESTA_FIJO = "00018425";
export const REFERENCIA_BANCARD_FIJA = "BCD-DEMO-000018425";

export const facturacionFixture: DatosFacturacionP7 = {
  nombreAFacturar: "Mónica Mariana Gorena Tapia",
  ruc: null,
};

export const declaracionOrigenLicitoFixture: DeclaracionOrigenLicito = {
  aceptadaEn: "2026-08-09T14:45:00.000Z",
  ip: "203.0.113.10",
  dispositivo: "test",
  sesionId: "sesion-test",
  versionTexto: VERSION_DECLARACION_ORIGEN_LICITO,
  textoAceptado: TEXTO_DECLARACION_ORIGEN_LICITO,
};

export const pagoConfirmadoFixture: Pago = {
  medio: "QR_BANCARD",
  estado: "CONFIRMADO",
  montoGs: PLANES.CONFIO_PLUS.premioAnualGs,
  referenciaBancard: REFERENCIA_BANCARD_FIJA,
  idempotencyKey: "idem-test-1",
  iniciadoEn: "2026-08-09T15:00:00.000Z",
  confirmadoEn: "2026-08-09T15:01:00.000Z",
};

/**
 * Expediente del camino feliz al salir de P6: en DECLARACIONES_OK, con plan,
 * identidad, datos complementarios, declaraciones compatibles y canales
 * verificados. Es la entrada de P7.
 */
export function expedienteEnDeclaracionesOk(id = "EXP-TEST-P7"): Expediente {
  const base = avanzarHastaIdentidadVerificada(crearExpediente(id));

  const conDatos = transicionarExpediente(base, "DECLARACIONES_OK", {
    declaraciones: declaracionesCompatibles,
    datosComplementarios: datosComplementariosFixture,
    declaracionOrigenLicito: declaracionOrigenLicitoFixture,
    identidad: identidadFixture,
    canalWhatsapp: { valor: "+595981000456", verificadoEn: "2026-08-09T14:00:00.000Z" },
    canalEmail: { valor: "monica.gorena@example.com", verificadoEn: "2026-08-09T14:30:00.000Z" },
    plan: {
      planId: "CONFIO_PLUS",
      premioAnualGs: PLANES.CONFIO_PLUS.premioAnualGs,
      idVersionOferta: "OFERTA-CONFIO-v1",
      hashOfertaSha256: "d".repeat(64),
      seleccionadoEn: "2026-08-09T13:00:00.000Z",
    },
  });
  if (!conDatos.ok) throw new Error(conDatos.error);
  return conDatos.expediente;
}

// ---------------------------------------------------------------------------
// Expediente con el paquete documental ya cerrado (entrada de la firma)
// ---------------------------------------------------------------------------

export const PAQUETE_FIXTURE: PaqueteDocumental = {
  solicitud: {
    codigo: codigoSolicitud(NUMERO_PROPUESTA_FIJO),
    version: 1,
    hashSha256: "a".repeat(64),
    cerradoEn: "2026-08-09T15:02:00.000Z",
  },
  fipf: {
    codigo: codigoFipf(NUMERO_PROPUESTA_FIJO),
    version: 1,
    hashSha256: "b".repeat(64),
    cerradoEn: "2026-08-09T15:02:00.000Z",
  },
};

export const PLAZO_PAGO_FIJO = "2026-08-10T15:03:00.000Z";

/**
 * Expediente listo para firmar: la Solicitud y el FIPF cerrados y hasheados.
 *
 * **Sin pago** (D-08): con el orden invertido el paquete se cierra antes de
 * que exista ninguna operación de cobro, y exigir uno acá haría imposible
 * llegar a la firma.
 */
export function expedienteEnPaqueteGenerado(id = "EXP-TEST-P8"): Expediente {
  const conCorrelativo = {
    ...expedienteEnDeclaracionesOk(id),
    numeroPropuesta: NUMERO_PROPUESTA_FIJO,
  };
  const conPaquete = registrarPaqueteDocumental(
    conCorrelativo,
    PAQUETE_FIXTURE,
    "2026-08-09T15:02:00.000Z",
  );
  if (!conPaquete.ok) throw new Error(conPaquete.error);
  return conPaquete.expediente;
}

export const firmaFixture = {
  idCode100: "C100-TEST-1",
  canal: "WHATSAPP" as const,
  firmadoEn: "2026-08-09T15:03:00.000Z",
  hashSolicitudFirmada: "e".repeat(64),
  hashFipfFirmado: "f".repeat(64),
};

/**
 * Expediente firmado por todos los intervinientes y esperando el pago: la
 * entrada del paso de pago bajo el orden nuevo (D-08), con el plazo de 24
 * horas ya corriendo (D-10).
 */
export function expedienteFirmado(id = "EXP-TEST-P7"): Expediente {
  const conActo = {
    ...expedienteEnPaqueteGenerado(id),
    actoDeFirma: {
      idCode100: firmaFixture.idCode100,
      canal: firmaFixture.canal,
      destinoEnmascarado: "+5959•••••456",
      enlaceEnviadoEn: "2026-08-09T15:02:30.000Z",
      venceEn: PLAZO_PAGO_FIJO,
    },
  };
  const firmado = transicionarExpediente(
    conActo,
    "FIRMADO_CLIENTE",
    { firma: firmaFixture },
    "2026-08-09T15:03:00.000Z",
  );
  if (!firmado.ok) throw new Error(firmado.error);

  const institucionales = registrarFirmasInstitucionales(
    firmado.expediente,
    PLAZO_PAGO_FIJO,
    "2026-08-09T15:03:00.000Z",
  );
  if (!institucionales.ok) throw new Error(institucionales.error);
  return institucionales.expediente;
}

/**
 * Expediente con el cobro acreditado: la entrada de la emisión. Con el orden
 * nuevo llega firmado y con facturación, que se captura al pagar.
 */
export function expedienteEnPagoConfirmado(id = "EXP-TEST-DOCS"): Expediente {
  const confirmado = transicionarExpediente(
    expedienteFirmado(id),
    "PAGO_CONFIRMADO",
    { facturacion: facturacionFixture, pago: pagoConfirmadoFixture },
    "2026-08-09T15:04:00.000Z",
  );
  if (!confirmado.ok) throw new Error(confirmado.error);
  return confirmado.expediente;
}
