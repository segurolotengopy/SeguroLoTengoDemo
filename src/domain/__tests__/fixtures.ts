import type { DatosComplementariosP6, Declaraciones, EstadoExpediente, Expediente } from "../tipos";
import { crearExpedienteInicial } from "../tipos";
import { transicionarExpediente } from "../expediente";

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

export const datosComplementariosFixture: DatosComplementariosP6 = {
  domicilio: "Avda. España 123",
  ciudad: "Asunción",
  situacionLaboral: "Dependiente",
  actividad: "Administración",
  profesion: "Contadora",
  empresa: "Estudio Contable SRL",
  ingresoMensualDeclaradoGs: 8_000_000,
  beneficiario: { tipo: "HEREDEROS_LEGALES", nombreCompleto: null, parentesco: null, domicilio: null },
};

export function crearExpediente(id = "EXP-TEST-1"): Expediente {
  return crearExpedienteInicial({ id, ahora: "2026-01-01T10:00:00.000Z" });
}

/** Avanza un expediente recién creado hasta IDENTIDAD_VERIFICADA siguiendo el camino feliz. */
export function avanzarHastaIdentidadVerificada(expediente: Expediente): Expediente {
  const secuencia: EstadoExpediente[] = [
    "CANAL_WA_VERIFICADO",
    "PLAN_SELECCIONADO",
    "AUTORIZADO",
    "CANAL_EMAIL_VERIFICADO",
    "IDENTIDAD_VERIFICADA",
  ];

  let actual = expediente;
  for (const estado of secuencia) {
    const resultado = transicionarExpediente(actual, estado);
    if (!resultado.ok) throw new Error(resultado.error);
    actual = resultado.expediente;
  }
  return actual;
}
