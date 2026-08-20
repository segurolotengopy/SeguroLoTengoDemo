import type {
  DatosComplementariosP6,
  DatosFacturacionP7,
  Declaraciones,
  EstadoExpediente,
  Expediente,
  Identidad,
  PaqueteDocumental,
  Pago,
} from "../tipos";
import { crearExpedienteInicial } from "../tipos";
import { PLANES } from "../catalogo";
import { registrarPaqueteDocumental, transicionarExpediente } from "../expediente";
import { PASOS_FLUJO } from "../rutas-flujo";
import { codigoFipf, codigoSolicitud } from "../documentos";
import { TEXTO_DECLARACION_ORIGEN_LICITO, VERSION_DECLARACION_ORIGEN_LICITO } from "../textos-p7";

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
  declaracionOrigenLicito: {
    aceptadaEn: "2026-08-09T15:00:00.000Z",
    ip: "203.0.113.10",
    dispositivo: "test",
    sesionId: "sesion-test",
    versionTexto: VERSION_DECLARACION_ORIGEN_LICITO,
    textoAceptado: TEXTO_DECLARACION_ORIGEN_LICITO,
  },
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

/**
 * Expediente del camino feliz, listo para que el servicio de generación de
 * documentos lo cierre: en PAGO_CONFIRMADO, con plan, identidad, datos
 * complementarios, declaraciones compatibles, canales verificados,
 * correlativo, facturación y pago acreditado.
 */
export function expedienteEnPagoConfirmado(id = "EXP-TEST-DOCS"): Expediente {
  const confirmado = transicionarExpediente(
    expedienteEnDeclaracionesOk(id),
    "PAGO_CONFIRMADO",
    {
      numeroPropuesta: NUMERO_PROPUESTA_FIJO,
      facturacion: facturacionFixture,
      pago: pagoConfirmadoFixture,
      plazoFirmaVenceEn: "2026-08-10T15:01:00.000Z",
    },
    "2026-08-09T15:01:00.000Z",
  );
  if (!confirmado.ok) throw new Error(confirmado.error);

  return confirmado.expediente;
}

// ---------------------------------------------------------------------------
// Expediente con el paquete documental ya cerrado (entrada de P8)
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

/**
 * Expediente listo para P8: la Solicitud y el FIPF cerrados y hasheados, el
 * pago acreditado y el plazo de 24 horas corriendo.
 */
export function expedienteEnPaqueteGenerado(id = "EXP-TEST-P8"): Expediente {
  const conPaquete = registrarPaqueteDocumental(
    expedienteEnPagoConfirmado(id),
    PAQUETE_FIXTURE,
    "2026-08-09T15:02:00.000Z",
  );
  if (!conPaquete.ok) throw new Error(conPaquete.error);
  return conPaquete.expediente;
}
