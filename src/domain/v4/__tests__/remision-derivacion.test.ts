/**
 * CHG-47 en el flujo v4: **toda derivación remite el caso a Alianza en el
 * mismo acto**, sin esperar a que alguien lo empuje desde la consola.
 *
 * En v2 lo hacía `registrarDeclaracionesP6`, que era la única puerta a
 * `DERIVADO_MANUAL`. v4 abrió dos puertas nuevas —03E (PEP) y 04A (salud)— y
 * las dos tienen que remitir igual. Este test existe porque la batería E2E
 * (`02-pep-bloqueo`) encontró que la de 03E no lo hacía.
 *
 * La remisión es *best-effort*: si falla, la derivación queda igual (regla
 * inviolable #5) y lo que se asienta es la evidencia del fallo.
 */
import { describe, expect, it } from "vitest";
import { registrarActividad } from "@/domain/v4/actividad";
import { registrarDeclaracionesSalud } from "@/domain/v4/declaraciones";
import { PASO_EVIDENCIA_REMISION_ALIANZA } from "@/domain/remision-alianza";
import type { ContextoPeticion, RepositorioExpediente } from "@/domain/verificacion-canal";
import type { Expediente, RegistroEvidencia } from "@/domain/tipos";
import type { EvidenceStore } from "@/ports/evidence-store";
import { avanzarHastaIdentidadVerificada, crearExpediente } from "@/domain/__tests__/fixtures";

const EXPEDIENTE_ID = "EXP-REMISION-1";

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-test",
};

function repositorioFalso(inicial: Expediente) {
  let guardado = inicial;
  const repo: RepositorioExpediente = {
    async obtenerPorId(id) {
      return id === guardado.id ? guardado : null;
    },
    async crear(expediente) {
      guardado = expediente;
    },
    async guardar(expediente) {
      guardado = expediente;
    },
  };
  return { repo, actual: () => guardado };
}

function evidenciasEnMemoria(opciones: { fallarRemision?: boolean } = {}) {
  const registros: RegistroEvidencia[] = [];
  const store: EvidenceStore = {
    async guardar(registro) {
      // Falla solo el asiento de la remisión exitosa: el del fallo (mismo
      // paso, resultado FALLIDO) tiene que poder escribirse para que quede
      // constancia de qué pasó.
      if (
        opciones.fallarRemision &&
        registro.paso === PASO_EVIDENCIA_REMISION_ALIANZA &&
        registro.resultado === "EXITOSO"
      ) {
        throw new Error("Alianza no responde");
      }
      registros.push(registro);
    },
    async obtenerHistorial(expedienteId) {
      return registros.filter((registro) => registro.expedienteId === expedienteId);
    },
  };
  return { store, registros };
}

function expedienteListoPara03E(): Expediente {
  return {
    ...avanzarHastaIdentidadVerificada(crearExpediente(EXPEDIENTE_ID)),
    datosPersonales: { domicilio: "Avda. España 123", ciudad: "Asunción", barrio: "Villa Morra" },
  };
}

const ACTIVIDAD_BASE = {
  expedienteId: EXPEDIENTE_ID,
  situacionLaboral: "Empleado (dependiente)",
  actividadEconomica: "Servicios",
  ocupacion: "Empleado administrativo",
  profesion: "Administrador",
  empresa: "Interseguros S.A.",
  ingresoMensualDeclarado: "9.500.000",
  origenIngresos: "Salario",
  contexto: CONTEXTO,
} as const;

describe("CHG-47 · la derivación en v4 remite el caso a Alianza sola", () => {
  it("03E · PEP = Sí deriva y remite en el mismo acto, con origen AUTOMATICA", async () => {
    const { repo, actual } = repositorioFalso(expedienteListoPara03E());
    const { store, registros } = evidenciasEnMemoria();

    const resultado = await registrarActividad(
      { expedientes: repo, evidencias: store, nuevoNumeroCaso: () => "CAS-00012345" },
      { ...ACTIVIDAD_BASE, esPep: true },
    );

    expect(resultado.ok).toBe(true);
    expect(actual().estado).toBe("DERIVADO_MANUAL");

    const remision = registros.find((r) => r.paso === PASO_EVIDENCIA_REMISION_ALIANZA);
    expect(remision, "la derivación tiene que dejar la evidencia de la remisión").toBeDefined();
    expect(remision?.resultado).toBe("EXITOSO");
    expect(remision?.detalle).toContain("origen=AUTOMATICA");
    expect(remision?.detalle).toContain("CAS-00012345");
    // Regla inviolable #7: la comunicación saliente no lleva el motivo.
    expect(remision?.detalle?.toLowerCase()).not.toContain("pep");
  });

  it("03E · PEP = No no deriva ni remite nada", async () => {
    const { repo, actual } = repositorioFalso(expedienteListoPara03E());
    const { store, registros } = evidenciasEnMemoria();

    const resultado = await registrarActividad(
      { expedientes: repo, evidencias: store },
      { ...ACTIVIDAD_BASE, esPep: false },
    );

    expect(resultado.ok).toBe(true);
    expect(actual().estado).toBe("IDENTIDAD_VERIFICADA");
    expect(registros.some((r) => r.paso === PASO_EVIDENCIA_REMISION_ALIANZA)).toBe(false);
  });

  it("04A · una declaración de salud incompatible deriva y remite en el mismo acto", async () => {
    const { repo, actual } = repositorioFalso(expedienteListoPara03E());
    const { store, registros } = evidenciasEnMemoria();

    const resultado = await registrarDeclaracionesSalud(
      { expedientes: repo, evidencias: store, nuevoNumeroCaso: () => "CAS-00054321" },
      {
        expedienteId: EXPEDIENTE_ID,
        // La 1 es habilitante con «SI» (goza de buena salud): un «NO» bloquea.
        respuestas: {
          estadoDeSalud: "NO",
          antecedentesDeContratacion: "NO",
          enfermedadesDiagnosticadas: "NO",
        },
        beneficiario: { beneficiarioTipo: "HEREDEROS_LEGALES" },
        contexto: CONTEXTO,
      },
    );

    expect(resultado.ok).toBe(true);
    expect(actual().estado).toBe("DERIVADO_MANUAL");

    const remision = registros.find((r) => r.paso === PASO_EVIDENCIA_REMISION_ALIANZA);
    expect(remision).toBeDefined();
    expect(remision?.resultado).toBe("EXITOSO");
    expect(remision?.detalle).toContain("origen=AUTOMATICA");
    expect(remision?.detalle).toContain("CAS-00054321");
    expect(remision?.detalle?.toLowerCase()).not.toContain("salud");
  });

  it("si la remisión falla, la derivación queda igual y se asienta el fallo", async () => {
    const { repo, actual } = repositorioFalso(expedienteListoPara03E());
    const { store, registros } = evidenciasEnMemoria({ fallarRemision: true });

    const resultado = await registrarActividad(
      { expedientes: repo, evidencias: store, nuevoNumeroCaso: () => "CAS-00099999" },
      { ...ACTIVIDAD_BASE, esPep: true },
    );

    // La respuesta al cliente sigue siendo correcta: el caso está derivado.
    expect(resultado.ok).toBe(true);
    expect(actual().estado).toBe("DERIVADO_MANUAL");

    const fallida = registros.find((r) => r.resultado === "FALLIDO");
    expect(fallida, "tiene que quedar evidencia del fallo de remisión").toBeDefined();
    expect(fallida?.detalle).toContain("Alianza no responde");
  });
});
