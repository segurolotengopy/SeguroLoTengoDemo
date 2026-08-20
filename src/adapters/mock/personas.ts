/**
 * Personas de prueba del demo — catálogo único de datos ficticios.
 *
 * Las cinco personas y sus desenlaces están fijados en CLAUDE.md → "Panel de
 * demo". Este archivo les pone datos completos, tipados contra el dominio
 * real (`src/domain/tipos.ts`), para poder recorrer las 12 pantallas sin
 * ninguna integración externa.
 *
 * Reglas de este archivo:
 *
 * 1. **Todos los datos son ficticios.** Cédulas, domicilios, empleadores e
 *    ingresos son inventados para la demostración; no corresponden a personas
 *    reales. Los correos usan `example.com` (dominio reservado por IANA, no
 *    puede pertenecer a nadie).
 * 2. **No define reglas de negocio.** Las declaraciones de cada persona son
 *    datos de entrada; quien decide el desenlace es `evaluarElegibilidad` en
 *    `src/domain/elegibilidad.ts`. El campo `desenlace` documenta lo que se
 *    espera, y `__tests__/personas.test.ts` verifica que el motor real
 *    efectivamente produzca eso — si alguien cambia una regla, los fixtures
 *    fallan en vez de mentirle a la gerencia en una demostración.
 * 3. **No define importes.** El plan sale de `src/domain/catalogo.ts`.
 *
 * ⚠️ ANTES DE PASAR A INTEGRACIONES REALES: los números de celular de acá son
 * verosímiles y podrían pertenecer a alguien. Cuando exista el adaptador
 * oficial de Infobip, reemplazalos por números propios antes de habilitar
 * cualquier envío real, o vas a mandarle un OTP a un desconocido.
 */
import { createHash } from "node:crypto";
import { normalizarCorreo } from "../../domain/correo";
import type {
  CapturaBiometrica,
  Declaraciones,
  DatosComplementariosP6,
  Identidad,
  MedioDePago,
  PlanId,
} from "../../domain/tipos";

/**
 * Hash simulado y determinista para las evidencias biométricas de P5. En el
 * flujo real esto es el SHA-256 del archivo capturado; acá se deriva de una
 * etiqueta para que el fixture sea estable entre corridas y claramente
 * reconocible como simulado.
 */
function hashSimulado(etiqueta: string): string {
  return createHash("sha256").update(`demo:${etiqueta}`, "utf8").digest("hex");
}

function capturaAprobada(idPersona: string): CapturaBiometrica {
  return {
    hashFrenteCedula: hashSimulado(`${idPersona}:cedula-frente`),
    hashDorsoCedula: hashSimulado(`${idPersona}:cedula-dorso`),
    hashSelfie: hashSimulado(`${idPersona}:selfie`),
    pruebaDeVidaAprobada: true,
    coincidenciaFacialAprobada: true,
  };
}

/** Las ocho respuestas que habilitan la emisión automática (P6, bloque 2). */
const DECLARACIONES_TODAS_COMPATIBLES: Declaraciones = {
  estadoDeSalud: "SI",
  antecedentesDeContratacion: "NO",
  enfermedadesDiagnosticadas: "NO",
  vigenciaYCarencias: "SI",
  veracidad: "SI",
  entregaDigital: "SI",
  corredorDeLaPoliza: "SI",
  condicionPep: "NO",
};

export type IdPersonaDemo =
  | "camino-feliz"
  | "pep-positivo"
  | "salud-incompatible"
  | "biometria-rechazada"
  | "no-firma";

/** Dónde termina el recorrido de esta persona y por qué. */
export interface DesenlaceDemo {
  /** Última pantalla que ve la persona: "P9", "Pantalla A", "Pantalla B", "P5". */
  readonly pantallaFinal: string;
  /** Estado del expediente al terminar (o `null` si el flujo no llega a persistir uno nuevo). */
  readonly estadoFinal: string;
  /** Qué demuestra este recorrido ante la gerencia. */
  readonly queDemuestra: string;
}

export interface PersonaDemo {
  readonly id: IdPersonaDemo;
  readonly rotulo: string;
  /** Celular en E.164, el que se tipea en P1 sin el prefijo de país. */
  readonly celular: string;
  /**
   * Dirección que se tipea en P4, ya normalizada (minúsculas, sin espacios):
   * tal cual la va a persistir `normalizarCorreo`, así el fixture y lo que
   * queda en el expediente son el mismo string.
   *
   * Siempre en `example.com`, dominio reservado por IANA: cuando exista el
   * adaptador oficial de Infobip, un envío real a estas direcciones no le
   * llega a nadie. `__tests__/personas.test.ts` verifica las dos cosas.
   */
  readonly correo: string;
  readonly identidad: Identidad;
  readonly planElegido: PlanId;
  readonly datosComplementarios: DatosComplementariosP6;
  readonly declaraciones: Declaraciones;
  readonly medioDePago: MedioDePago;
  readonly desenlace: DesenlaceDemo;
}

// ---------------------------------------------------------------------------
// 1. Camino feliz — recorre las 9 pantallas hasta la contratación aceptada
// ---------------------------------------------------------------------------

const CAMINO_FELIZ: PersonaDemo = {
  id: "camino-feliz",
  rotulo: "Camino feliz",
  celular: "+595981000123",
  correo: "monica.gorena@example.com",
  identidad: {
    numeroCedula: "9323336",
    nombres: "Mónica Mariana",
    apellidos: "Gorena Tapia",
    fechaNacimiento: "1990-04-17",
    sexo: "Femenino",
    nacionalidad: "Paraguaya",
    paisNacimiento: "Paraguay",
    estadoCivil: "Soltera",
    captura: capturaAprobada("camino-feliz"),
  },
  planElegido: "CONFIO_PLUS",
  datosComplementarios: {
    domicilio: "Av. Mariscal López 3450, Barrio Villa Morra",
    ciudad: "Asunción",
    situacionLaboral: "Relación de dependencia",
    actividad: "Servicios financieros",
    profesion: "Contador/a",
    empresa: "Consultora Aurora S.A.",
    ingresoMensualDeclaradoGs: 9_500_000,
    beneficiario: {
      tipo: "HEREDEROS_LEGALES",
      nombreCompleto: null,
      parentesco: null,
      domicilio: null,
    numeroCedula: null,
    },
  },
  declaraciones: DECLARACIONES_TODAS_COMPATIBLES,
  medioDePago: "QR_BANCARD",
  desenlace: {
    pantallaFinal: "P9",
    estadoFinal: "EMITIDO",
    queDemuestra:
      "El recorrido completo: dos OTP independientes, identidad verificada, declaraciones compatibles, " +
      "pago QR antes de la firma, firma atómica de Solicitud + FIPF y solicitud aceptada.",
  },
};

// ---------------------------------------------------------------------------
// 2. PEP positivo — declaración 8 en "Sí" → Pantalla A
// ---------------------------------------------------------------------------

const PEP_POSITIVO: PersonaDemo = {
  id: "pep-positivo",
  rotulo: "PEP positivo",
  celular: "+595982000456",
  correo: "ramon.duarte@example.com",
  identidad: {
    numeroCedula: "3874512",
    nombres: "Ramón Elías",
    apellidos: "Duarte Villalba",
    fechaNacimiento: "1978-11-02",
    sexo: "Masculino",
    nacionalidad: "Paraguaya",
    paisNacimiento: "Paraguay",
    estadoCivil: "Casado",
    captura: capturaAprobada("pep-positivo"),
  },
  planElegido: "CONFIO_TOTAL",
  datosComplementarios: {
    domicilio: "Calle Palma 812, Centro",
    ciudad: "Asunción",
    situacionLaboral: "Funcionario público",
    actividad: "Administración pública",
    profesion: "Abogado/a",
    empresa: "Ministerio de Obras Públicas",
    ingresoMensualDeclaradoGs: 14_000_000,
    beneficiario: {
      tipo: "PERSONA_DESIGNADA",
      nombreCompleto: "Silvia Raquel Duarte Ocampos",
      parentesco: "Cónyuge",
      domicilio: "Calle Palma 812, Centro, Asunción",
      // Sin cédula a propósito: el campo es opcional y la persona de prueba
      // ejercita justamente el caso de que se deje vacío (CMP-21).
      numeroCedula: null,
    },
  },
  declaraciones: { ...DECLARACIONES_TODAS_COMPATIBLES, condicionPep: "SI" },
  medioDePago: "QR_BANCARD",
  desenlace: {
    pantallaFinal: "Pantalla A",
    estadoFinal: "DERIVADO_MANUAL",
    queDemuestra:
      "El bloqueo por condición PEP: se detiene antes del pago, genera un número de caso propio y deriva " +
      "a Interseguros y Alianza. Estado terminal: no hay camino a pago, firma ni emisión. " +
      "Sirve además para mostrar el beneficiario designado (100% a una persona).",
  },
};

// ---------------------------------------------------------------------------
// 3. Salud incompatible — declaraciones 1, 2 y 3 → Pantalla A
// ---------------------------------------------------------------------------

const SALUD_INCOMPATIBLE: PersonaDemo = {
  id: "salud-incompatible",
  rotulo: "Salud incompatible",
  celular: "+595983000789",
  correo: "carolina.ayala@example.com",
  identidad: {
    numeroCedula: "5612908",
    nombres: "Carolina Beatriz",
    apellidos: "Ayala Benítez",
    fechaNacimiento: "1985-06-23",
    sexo: "Femenino",
    nacionalidad: "Paraguaya",
    paisNacimiento: "Paraguay",
    estadoCivil: "Divorciada",
    captura: capturaAprobada("salud-incompatible"),
  },
  planElegido: "CONFIO",
  datosComplementarios: {
    domicilio: "Ruta Mcal. Estigarribia km 12, Barrio San Miguel",
    ciudad: "San Lorenzo",
    situacionLaboral: "Independiente",
    actividad: "Comercio minorista",
    profesion: "Comerciante",
    empresa: null,
    ingresoMensualDeclaradoGs: 5_200_000,
    beneficiario: {
      tipo: "HEREDEROS_LEGALES",
      nombreCompleto: null,
      parentesco: null,
      domicilio: null,
    numeroCedula: null,
    },
  },
  declaraciones: {
    ...DECLARACIONES_TODAS_COMPATIBLES,
    estadoDeSalud: "NO",
    antecedentesDeContratacion: "SI",
    enfermedadesDiagnosticadas: "SI",
  },
  medioDePago: "QR_BANCARD",
  desenlace: {
    pantallaFinal: "Pantalla A",
    estadoFinal: "DERIVADO_MANUAL",
    queDemuestra:
      "El bloqueo por salud: tres declaraciones incompatibles a la vez (1, 2 y 3). Muestra que el motivo " +
      "de derivación se registra por número de declaración, sin exponer datos médicos fuera del expediente.",
  },
};

// ---------------------------------------------------------------------------
// 4. Biometría rechazada — P5 no aprueba la coincidencia facial
// ---------------------------------------------------------------------------

const BIOMETRIA_RECHAZADA: PersonaDemo = {
  id: "biometria-rechazada",
  rotulo: "Biometría rechazada",
  celular: "+595984000234",
  correo: "julio.ramirez@example.com",
  identidad: {
    numeroCedula: "4209336",
    nombres: "Julio César",
    apellidos: "Ramírez Cabral",
    fechaNacimiento: "1992-01-09",
    sexo: "Masculino",
    nacionalidad: "Paraguaya",
    paisNacimiento: "Paraguay",
    estadoCivil: "Soltero",
    captura: {
      hashFrenteCedula: hashSimulado("biometria-rechazada:cedula-frente"),
      hashDorsoCedula: hashSimulado("biometria-rechazada:cedula-dorso"),
      hashSelfie: hashSimulado("biometria-rechazada:selfie"),
      // Prueba de vida OK, pero la cara no coincide con la de la cédula: el
      // único camino que ofrece P5 es repetir la captura, nunca editar los
      // campos a mano.
      pruebaDeVidaAprobada: true,
      coincidenciaFacialAprobada: false,
    },
  },
  planElegido: "CONFIO_PLUS",
  datosComplementarios: {
    domicilio: "Av. San Martín 1290",
    ciudad: "Fernando de la Mora",
    situacionLaboral: "Relación de dependencia",
    actividad: "Transporte y logística",
    profesion: "Técnico/a en logística",
    empresa: "Logística del Este S.R.L.",
    ingresoMensualDeclaradoGs: 6_800_000,
    beneficiario: {
      tipo: "HEREDEROS_LEGALES",
      nombreCompleto: null,
      parentesco: null,
      domicilio: null,
    numeroCedula: null,
    },
  },
  // Nunca llega a responderlas: el recorrido se detiene en P5.
  declaraciones: DECLARACIONES_TODAS_COMPATIBLES,
  medioDePago: "QR_BANCARD",
  desenlace: {
    pantallaFinal: "P5",
    estadoFinal: "AUTORIZADO",
    queDemuestra:
      "Que los campos extraídos por OCR están bloqueados y que ante una discrepancia el único camino es " +
      "repetir la captura. El expediente no avanza a IDENTIDAD_VERIFICADA.",
  },
};

// ---------------------------------------------------------------------------
// 5. No paga — firma y deja vencer las 24 horas → Pantalla B
//
// D-08 invirtió este recorrido: antes pagaba y no firmaba, y había premio que
// devolver. Ahora firma y no paga, así que el expediente caduca sin que se
// haya movido un guaraní — que era exactamente el punto de invertir el orden.
// ---------------------------------------------------------------------------

const NO_FIRMA: PersonaDemo = {
  id: "no-firma",
  rotulo: "Firma y no paga",
  celular: "+595985000567",
  correo: "lucia.ortiz@example.com",
  identidad: {
    numeroCedula: "6155740",
    nombres: "Lucía Fernanda",
    apellidos: "Ortiz Meza",
    fechaNacimiento: "1988-09-30",
    sexo: "Femenino",
    nacionalidad: "Paraguaya",
    paisNacimiento: "Paraguay",
    estadoCivil: "Casada",
    captura: capturaAprobada("no-firma"),
  },
  planElegido: "CONFIO_PLUS",
  datosComplementarios: {
    domicilio: "Barrio Santa Ana, Manzana 14 Casa 7",
    ciudad: "Luque",
    situacionLaboral: "Relación de dependencia",
    actividad: "Educación",
    profesion: "Docente",
    empresa: "Colegio Nacional Santa Ana",
    ingresoMensualDeclaradoGs: 4_900_000,
    beneficiario: {
      tipo: "HEREDEROS_LEGALES",
      nombreCompleto: null,
      parentesco: null,
      domicilio: null,
    numeroCedula: null,
    },
  },
  declaraciones: DECLARACIONES_TODAS_COMPATIBLES,
  medioDePago: "QR_BANCARD",
  desenlace: {
    pantallaFinal: "Pantalla B",
    estadoFinal: "VENCIDO",
    queDemuestra:
      "La caducidad del plazo de 24 horas para pagar un expediente ya firmado: recordatorios a 1, 5 y 12 " +
      "horas y vencimiento a las 24. No hubo cobro, así que no hay premio que devolver — no hay póliza " +
      "ni cobertura, y la persona puede volver a empezar.",
  },
};

export const PERSONAS_DEMO: readonly PersonaDemo[] = [
  CAMINO_FELIZ,
  PEP_POSITIVO,
  SALUD_INCOMPATIBLE,
  BIOMETRIA_RECHAZADA,
  NO_FIRMA,
];

export function obtenerPersonaDemo(id: IdPersonaDemo): PersonaDemo | null {
  return PERSONAS_DEMO.find((persona) => persona.id === id) ?? null;
}

/** Busca por el celular que se tipea en P1, para que el panel sepa quién entró. */
export function personaPorCelular(e164: string): PersonaDemo | null {
  return PERSONAS_DEMO.find((persona) => persona.celular === e164) ?? null;
}

/**
 * Busca por el correo que se tipea en P4. Gemelo de `personaPorCelular`: el
 * panel de demo necesita reconocer a la persona por cualquiera de sus dos
 * canales, porque en P4 el celular ya no se vuelve a pedir.
 *
 * Normaliza antes de comparar, con la misma función que usa P4
 * (`domain/correo.ts`): quien tipee `Monica.Gorena@Example.com ` tiene que
 * caer en la misma persona que quedó registrada en el expediente.
 */
export function personaPorCorreo(correo: string): PersonaDemo | null {
  const normalizado = normalizarCorreo(correo);
  if (!normalizado.ok) return null;
  return PERSONAS_DEMO.find((persona) => persona.correo === normalizado.correo) ?? null;
}
