/**
 * Tests del caso de uso de P6.
 *
 * Dos cosas se prueban con más insistencia que el resto, porque son reglas de
 * negocio inviolables y no meras validaciones:
 *
 * - **Regla #5:** una respuesta incompatible en 1, 2, 3 u 8 deriva a
 *   DERIVADO_MANUAL con un número de caso propio, y desde ahí no hay camino a
 *   pago, firma ni emisión.
 * - **Regla #7:** ninguna respuesta médica ni la condición PEP sale del
 *   expediente. Se verifica serializando **todo** lo que el módulo emite
 *   —evidencias y respuesta— y buscando los valores dentro.
 */
import { describe, expect, it } from "vitest";
import type { EvidenceStore } from "../../ports/evidence-store";
import {
  ESTADO_REQUERIDO_P6,
  PASO_EVIDENCIA_P6,
  generarNumeroCaso,
  guardarDatosYDeclaracionesP6,
  leerCasoDerivado,
} from "../declaraciones-p6";
import { esTransicionLegal } from "../expediente";
import type { EstadoExpediente, Expediente, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal";
import {
  avanzarHastaIdentidadVerificada,
  crearExpediente,
  datosComplementariosFixture,
  NUMERO_CASO_FIJO,
} from "./fixtures";

// ---------------------------------------------------------------------------
// Dobles en memoria
// ---------------------------------------------------------------------------

function repositorioFalso(inicial: Expediente): RepositorioExpediente & { actual: () => Expediente } {
  let guardado = inicial;
  return {
    async obtenerPorId(id) {
      return id === guardado.id ? guardado : null;
    },
    async crear(expediente) {
      guardado = expediente;
    },
    async guardar(expediente) {
      guardado = expediente;
    },
    actual: () => guardado,
  };
}

function evidenciasFalsas(): EvidenceStore & { registros: RegistroEvidencia[] } {
  const registros: RegistroEvidencia[] = [];
  return {
    registros,
    async guardar(registro) {
      registros.push(registro);
    },
    async obtenerHistorial(expedienteId) {
      return registros.filter((registro) => registro.expedienteId === expedienteId);
    },
  };
}

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-p6",
};

const AHORA = "2026-08-09T14:00:00.000Z";

/** Bloque 1 tal como llega del formulario: montos como texto con separadores. */
const DATOS_CRUDOS = {
  domicilio: datosComplementariosFixture.domicilio,
  ciudad: datosComplementariosFixture.ciudad,
  situacionLaboral: datosComplementariosFixture.situacionLaboral,
  actividad: datosComplementariosFixture.actividad,
  profesion: datosComplementariosFixture.profesion,
  empresa: datosComplementariosFixture.empresa,
  ingresoMensualDeclaradoGs: "8.000.000",
  beneficiarioTipo: "HEREDEROS_LEGALES",
};

const RESPUESTAS_COMPATIBLES = {
  "1": "SI",
  "2": "NO",
  "3": "NO",
  "4": "SI",
  "5": "SI",
  "6": "SI",
  "7": "SI",
  "8": "NO",
} as const;

function armar(expediente: Expediente) {
  const expedientes = repositorioFalso(expediente);
  const evidencias = evidenciasFalsas();
  return {
    expedientes,
    evidencias,
    deps: {
      expedientes,
      evidencias,
      ahora: () => AHORA,
      nuevoId: () => "evidencia-1",
      nuevoNumeroCaso: () => NUMERO_CASO_FIJO,
    },
  };
}

function enIdentidadVerificada(): Expediente {
  return avanzarHastaIdentidadVerificada(crearExpediente());
}

// ---------------------------------------------------------------------------

describe("guardarDatosYDeclaracionesP6 · camino habilitante", () => {
  it("con las ocho respuestas habilitantes pasa a DECLARACIONES_OK y sigue a P7", async () => {
    const { deps, expedientes } = armar(enIdentidadVerificada());

    const resultado = await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-TEST-1",
      datos: DATOS_CRUDOS,
      declaraciones: RESPUESTAS_COMPATIBLES,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.elegibleParaEmisionAutomatica).toBe(true);
    expect(resultado.estado).toBe("DECLARACIONES_OK");
    if (resultado.elegibleParaEmisionAutomatica) {
      expect(resultado.siguientePantalla).toBe("/p7-pago");
    }

    const expediente = expedientes.actual();
    expect(expediente.estado).toBe("DECLARACIONES_OK");
    expect(expediente.numeroCasoDerivacion).toBeNull();
    expect(expediente.datosComplementarios?.ingresoMensualDeclaradoGs).toBe(8_000_000);
    expect(expediente.declaraciones?.condicionPep).toBe("NO");
  });

  it("interpreta el monto con separadores y guarda el beneficiario designado completo", async () => {
    const { deps, expedientes } = armar(enIdentidadVerificada());

    await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-TEST-1",
      datos: {
        ...DATOS_CRUDOS,
        ingresoMensualDeclaradoGs: "Gs. 12 500 000",
        beneficiarioTipo: "PERSONA_DESIGNADA",
        beneficiarioNombreCompleto: "Silvia Raquel Duarte Ocampos",
        beneficiarioParentesco: "Cónyuge",
        beneficiarioDomicilio: "Calle Palma 812, Centro, Asunción",
      },
      declaraciones: RESPUESTAS_COMPATIBLES,
      contexto: CONTEXTO,
    });

    const beneficiario = expedientes.actual().datosComplementarios?.beneficiario;
    expect(expedientes.actual().datosComplementarios?.ingresoMensualDeclaradoGs).toBe(12_500_000);
    expect(beneficiario?.tipo).toBe("PERSONA_DESIGNADA");
    expect(beneficiario?.nombreCompleto).toBe("Silvia Raquel Duarte Ocampos");
    expect(beneficiario?.parentesco).toBe("Cónyuge");
  });

  it("elegir herederos legales borra los datos de una persona designada que se hubiera tipeado antes", async () => {
    const { deps, expedientes } = armar(enIdentidadVerificada());

    await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-TEST-1",
      datos: {
        ...DATOS_CRUDOS,
        beneficiarioTipo: "HEREDEROS_LEGALES",
        beneficiarioNombreCompleto: "Alguien que se tipeó y después se descartó",
        beneficiarioParentesco: "Cónyuge",
        beneficiarioDomicilio: "Un domicilio cualquiera",
      },
      declaraciones: RESPUESTAS_COMPATIBLES,
      contexto: CONTEXTO,
    });

    const beneficiario = expedientes.actual().datosComplementarios?.beneficiario;
    expect(beneficiario?.tipo).toBe("HEREDEROS_LEGALES");
    expect(beneficiario?.nombreCompleto).toBeNull();
    expect(beneficiario?.parentesco).toBeNull();
    expect(beneficiario?.domicilio).toBeNull();
  });
});

describe("guardarDatosYDeclaracionesP6 · derivación a Pantalla A (regla inviolable #5)", () => {
  it.each([
    ["1", "NO", 1, "SALUD"],
    ["2", "SI", 2, "SALUD"],
    ["3", "SI", 3, "SALUD"],
    ["8", "SI", 8, "PEP"],
  ])(
    "la declaración %s respondida %s deriva a DERIVADO_MANUAL con motivo %s",
    async (clave, respuesta, numero, motivo) => {
      const { deps, expedientes } = armar(enIdentidadVerificada());

      const resultado = await guardarDatosYDeclaracionesP6(deps, {
        expedienteId: "EXP-TEST-1",
        datos: DATOS_CRUDOS,
        declaraciones: { ...RESPUESTAS_COMPATIBLES, [clave]: respuesta },
        contexto: CONTEXTO,
      });

      expect(resultado.ok).toBe(true);
      if (!resultado.ok || resultado.elegibleParaEmisionAutomatica) {
        throw new Error("se esperaba una derivación");
      }

      expect(resultado.estado).toBe("DERIVADO_MANUAL");
      expect(resultado.numeroCaso).toBe(NUMERO_CASO_FIJO);
      expect(resultado.motivoDerivacion).toBe(motivo);
      expect(resultado.declaracionesQueBloquean).toEqual([numero]);
      expect(resultado.siguientePantalla).toBe("/revision-manual");

      const expediente = expedientes.actual();
      expect(expediente.estado).toBe("DERIVADO_MANUAL");
      expect(expediente.numeroCasoDerivacion).toBe(NUMERO_CASO_FIJO);
      expect(expediente.motivoDerivacionManual).toEqual([numero]);
    },
  );

  it("salud y PEP a la vez se clasifican como SALUD_Y_PEP", async () => {
    const { deps } = armar(enIdentidadVerificada());

    const resultado = await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-TEST-1",
      datos: DATOS_CRUDOS,
      declaraciones: { ...RESPUESTAS_COMPATIBLES, "3": "SI", "8": "SI" },
      contexto: CONTEXTO,
    });

    if (!resultado.ok || resultado.elegibleParaEmisionAutomatica) throw new Error("se esperaba derivación");
    expect(resultado.motivoDerivacion).toBe("SALUD_Y_PEP");
    expect(resultado.declaracionesQueBloquean).toEqual([3, 8]);
  });

  it("las declaraciones 4 a 7 incompatibles NO derivan: no bloquean la emisión automática", async () => {
    for (const clave of ["4", "5", "6", "7"]) {
      const { deps } = armar(enIdentidadVerificada());
      const resultado = await guardarDatosYDeclaracionesP6(deps, {
        expedienteId: "EXP-TEST-1",
        datos: DATOS_CRUDOS,
        declaraciones: { ...RESPUESTAS_COMPATIBLES, [clave]: "NO" },
        contexto: CONTEXTO,
      });

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.elegibleParaEmisionAutomatica).toBe(true);
    }
  });

  it("el número de caso no se parece a un correlativo de propuesta ni de FIPF", () => {
    const numero = generarNumeroCaso(new Date("2026-08-09T00:00:00.000Z"));

    expect(numero).toMatch(/^CASO-2026-\d{6}$/);
    expect(numero.startsWith("PROP-")).toBe(false);
    expect(numero.startsWith("FIPF-")).toBe(false);
  });

  it("desde DERIVADO_MANUAL no hay transición legal hacia pago, firma ni emisión", async () => {
    const { deps, expedientes } = armar(enIdentidadVerificada());

    await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-TEST-1",
      datos: DATOS_CRUDOS,
      declaraciones: { ...RESPUESTAS_COMPATIBLES, "8": "SI" },
      contexto: CONTEXTO,
    });

    const destinos: EstadoExpediente[] = [
      "DECLARACIONES_OK",
      "PAGO_CONFIRMADO",
      "PAQUETE_GENERADO",
      "FIRMADO",
      "EMITIDO",
    ];
    for (const destino of destinos) {
      expect(esTransicionLegal(expedientes.actual().estado, destino)).toBe(false);
    }
  });

  it("un segundo intento sobre el mismo expediente ya derivado se rechaza por estado", async () => {
    const { deps } = armar(enIdentidadVerificada());
    const entrada = {
      expedienteId: "EXP-TEST-1",
      datos: DATOS_CRUDOS,
      contexto: CONTEXTO,
    };

    await guardarDatosYDeclaracionesP6(deps, {
      ...entrada,
      declaraciones: { ...RESPUESTAS_COMPATIBLES, "8": "SI" },
    });
    const segundo = await guardarDatosYDeclaracionesP6(deps, {
      ...entrada,
      declaraciones: RESPUESTAS_COMPATIBLES,
    });

    expect(segundo.ok).toBe(false);
    if (segundo.ok) return;
    expect(segundo.motivo).toBe("ESTADO_INVALIDO");
  });
});

describe("guardarDatosYDeclaracionesP6 · validaciones", () => {
  it("rechaza sin tocar el expediente si falta un dato obligatorio", async () => {
    const { deps, expedientes } = armar(enIdentidadVerificada());

    const resultado = await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-TEST-1",
      datos: { ...DATOS_CRUDOS, domicilio: "   ", ciudad: "Montevideo", ingresoMensualDeclaradoGs: "0" },
      declaraciones: RESPUESTAS_COMPATIBLES,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("DATOS_INCOMPLETOS");
    expect(resultado.camposInvalidos).toEqual([
      "domicilio",
      "ciudad",
      "ingresoMensualDeclaradoGs",
    ]);
    expect(expedientes.actual().estado).toBe(ESTADO_REQUERIDO_P6);
  });

  it("exige las ocho respuestas: el silencio no es aceptación", async () => {
    const { deps, expedientes } = armar(enIdentidadVerificada());
    const incompletas: Record<string, string> = { ...RESPUESTAS_COMPATIBLES };
    delete incompletas["3"];
    delete incompletas["8"];

    const resultado = await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-TEST-1",
      datos: DATOS_CRUDOS,
      declaraciones: incompletas,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("DECLARACIONES_INCOMPLETAS");
    expect(resultado.declaracionesSinResponder).toEqual([3, 8]);
    expect(expedientes.actual().estado).toBe(ESTADO_REQUERIDO_P6);
  });

  it("solo opera desde IDENTIDAD_VERIFICADA", async () => {
    const { deps } = armar(crearExpediente());

    const resultado = await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-TEST-1",
      datos: DATOS_CRUDOS,
      declaraciones: RESPUESTAS_COMPATIBLES,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("ESTADO_INVALIDO");
  });
});

describe("aislamiento de salud y PEP (regla inviolable #7)", () => {
  /**
   * Las respuestas médicas y la PEP existen en el expediente y en ningún otro
   * lado. Se serializa todo lo que el módulo emite hacia afuera —evidencias y
   * respuesta de la API— y se busca cualquier rastro de las claves y de los
   * literales de las declaraciones.
   */
  const CLAVES_SENSIBLES = [
    "estadoDeSalud",
    "antecedentesDeContratacion",
    "enfermedadesDiagnosticadas",
    "condicionPep",
    // Ni un fragmento del literal de las declaraciones médicas.
    "cáncer",
    "diabetes",
    "preexistente",
  ];

  it("la evidencia registra el resultado del motor, nunca las respuestas", async () => {
    const { deps, evidencias } = armar(enIdentidadVerificada());

    await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-TEST-1",
      datos: DATOS_CRUDOS,
      declaraciones: { ...RESPUESTAS_COMPATIBLES, "3": "SI" },
      contexto: CONTEXTO,
    });

    expect(evidencias.registros).toHaveLength(1);
    const registro = evidencias.registros[0]!;
    expect(registro.paso).toBe(PASO_EVIDENCIA_P6);
    expect(registro.resultado).toBe("EXITOSO");
    expect(registro.versionTextoAceptado).toBe("P6-DECLARACIONES-v1");
    expect(registro.textoAceptado).toBeNull();

    // Lo que sí registra: la decisión y por cuál pregunta se frenó.
    expect(registro.detalle).toContain("estado=DERIVADO_MANUAL");
    expect(registro.detalle).toContain("elegible=false");
    expect(registro.detalle).toContain("declaracionesQueBloquean=3");
    expect(registro.detalle).toContain(`numeroCaso=${NUMERO_CASO_FIJO}`);

    const serializado = JSON.stringify(registro);
    for (const clave of CLAVES_SENSIBLES) {
      expect(serializado, `la evidencia menciona "${clave}"`).not.toContain(clave);
    }
    // Tampoco los datos económicos y de domicilio, que van al FIPF y no acá.
    expect(serializado).not.toContain(datosComplementariosFixture.domicilio);
    expect(serializado).not.toContain("8000000");
    // Y ninguna respuesta suelta: en `detalle` no hay ningún `=SI` / `=NO`.
    expect(registro.detalle).not.toMatch(/=(SI|NO)(\s|$|·)/);
  });

  it("la respuesta del caso de uso no devuelve ninguna respuesta de declaración", async () => {
    const { deps } = armar(enIdentidadVerificada());

    const resultado = await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-TEST-1",
      datos: DATOS_CRUDOS,
      declaraciones: { ...RESPUESTAS_COMPATIBLES, "1": "NO", "8": "SI" },
      contexto: CONTEXTO,
    });

    const serializado = JSON.stringify(resultado);
    for (const clave of ["estadoDeSalud", "antecedentesDeContratacion", "condicionPep"]) {
      expect(serializado, `la respuesta menciona "${clave}"`).not.toContain(clave);
    }
    // El motivo que viaja es la categoría gruesa, no el detalle de la pregunta.
    expect(serializado).toContain("SALUD_Y_PEP");
  });

  it("las respuestas sí quedan en el expediente: es su único destino", async () => {
    const { deps, expedientes } = armar(enIdentidadVerificada());

    await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-TEST-1",
      datos: DATOS_CRUDOS,
      declaraciones: { ...RESPUESTAS_COMPATIBLES, "8": "SI" },
      contexto: CONTEXTO,
    });

    // De acá salen a la Solicitud y al FIPF en P8, y a ningún otro lado.
    expect(expedientes.actual().declaraciones?.condicionPep).toBe("SI");
    expect(expedientes.actual().declaraciones?.estadoDeSalud).toBe("SI");
  });
});

describe("leerCasoDerivado", () => {
  it("devuelve número, motivo y fecha de un expediente derivado", async () => {
    const { deps, expedientes } = armar(enIdentidadVerificada());

    await guardarDatosYDeclaracionesP6(deps, {
      expedienteId: "EXP-TEST-1",
      datos: DATOS_CRUDOS,
      declaraciones: { ...RESPUESTAS_COMPATIBLES, "8": "SI" },
      contexto: CONTEXTO,
    });

    const caso = leerCasoDerivado(expedientes.actual());
    expect(caso).toEqual({ numeroCaso: NUMERO_CASO_FIJO, motivo: "PEP", derivadoEn: AHORA });
  });

  it("devuelve null si el expediente no está derivado", () => {
    expect(leerCasoDerivado(enIdentidadVerificada())).toBeNull();
  });
});
