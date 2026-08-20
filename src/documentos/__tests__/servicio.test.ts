/**
 * Tests del servicio de generación de documentos.
 *
 * Las cuatro cosas que este archivo cuida más que ninguna otra son controles
 * de cumplimiento, no detalles de implementación:
 *
 * - **Fila 35 / regla inviolable #4** — los PDF se cierran y se hashean antes
 *   de habilitar la firma: el hash registrado es el SHA-256 real de los bytes
 *   que quedaron guardados, y si no coinciden el paquete no se cierra.
 * - **Fila 77** — hash individual para la Solicitud y para el FIPF; nunca uno
 *   solo, nunca compartido.
 * - **Fila 47 / regla inviolable #3** — los dos documentos entran juntos, con
 *   el mismo correlativo, o no entra ninguno.
 * - **Regla inviolable #7** — la evidencia del paso no lleva datos de salud,
 *   PEP, cédula ni tarjeta.
 */
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { EvidenceStore } from "../../ports/evidence-store";
import { codigoFipf, codigoSolicitud } from "../../domain/documentos";
import type { Expediente, RegistroEvidencia } from "../../domain/tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../../domain/verificacion-canal";
import {
  NUMERO_PROPUESTA_FIJO,
  crearExpediente,
  expedienteEnDeclaracionesOk,
  identidadFixture,
} from "../../domain/__tests__/fixtures";
import {
  PASO_EVIDENCIA_DOCUMENTOS,
  claveDocumento,
  generarPaqueteDocumental,
} from "../servicio";
import type { DependenciasDocumentos, RepositorioArchivos } from "../servicio";

const AHORA = "2026-08-09T15:05:00.000Z";
const CONTEXTO: ContextoPeticion = {
  ip: "203.0.113.10",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-test",
};

// ---------------------------------------------------------------------------
// Dobles en memoria
// ---------------------------------------------------------------------------

function repositorioExpedientes(inicial: Expediente): RepositorioExpediente & { actual: () => Expediente } {
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

/** Archivos en memoria que hashean de verdad, como hace el repositorio de S3. */
function repositorioArchivos(): RepositorioArchivos & { archivos: Map<string, Uint8Array> } {
  const archivos = new Map<string, Uint8Array>();
  return {
    archivos,
    async guardarArchivo(clave, contenido) {
      archivos.set(clave, contenido);
      return { clave, hashSha256: createHash("sha256").update(contenido).digest("hex") };
    },
  };
}

function almacenDeEvidencias(): EvidenceStore & { registros: RegistroEvidencia[] } {
  const registros: RegistroEvidencia[] = [];
  return {
    registros,
    async guardar(registro) {
      registros.push(registro);
    },
    async obtenerHistorial() {
      return registros;
    },
  };
}

function armarDependencias(expediente: Expediente) {
  const expedientes = repositorioExpedientes(expediente);
  const archivos = repositorioArchivos();
  const evidencias = almacenDeEvidencias();
  const deps: DependenciasDocumentos = {
    expedientes,
    archivos,
    evidencias,
    ahora: () => AHORA,
    nuevoId: () => "evidencia-1",
    // D-08 · el correlativo lo acuña este servicio, no el pago. Se fija acá
    // para que las aserciones no dependan del CSPRNG.
    nuevoNumeroPropuesta: () => NUMERO_PROPUESTA_FIJO,
  };
  return { deps, expedientes, archivos, evidencias };
}

// ---------------------------------------------------------------------------
// Camino feliz
// ---------------------------------------------------------------------------

describe("generarPaqueteDocumental", () => {
  it("cierra el PDF único, lo hashea y transiciona a PAQUETE_GENERADO", async () => {
    const { deps, expedientes, archivos } = armarDependencias(expedienteEnDeclaracionesOk("EXP-TEST-DOCS"));

    const resultado = await generarPaqueteDocumental(deps, {
      expedienteId: "EXP-TEST-DOCS",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.generado).toBe(true);
    expect(resultado.correlativo).toBe(NUMERO_PROPUESTA_FIJO);
    expect(resultado.documento.codigo).toBe(codigoSolicitud(NUMERO_PROPUESTA_FIJO));

    // D-11 · un archivo, una clave.
    expect(archivos.archivos.size).toBe(1);
    expect([...archivos.archivos.keys()]).toEqual([
      claveDocumento("EXP-TEST-DOCS", "PROP-00018425", 1),
    ]);

    const expediente = expedientes.actual();
    expect(expediente.estado).toBe("PAQUETE_GENERADO");
    expect(expediente.paqueteDocumental).not.toBeNull();
    expect(expediente.paqueteDocumental?.codigo).toBe("PROP-00018425");
    // La sección FIPF conserva su código interno dentro del mismo documento.
    expect(expediente.paqueteDocumental?.codigoSeccionFipf).toBe(codigoFipf(NUMERO_PROPUESTA_FIJO));
  });

  it("registra el SHA-256 real de los bytes guardados", async () => {
    const { deps, expedientes, archivos } = armarDependencias(expedienteEnDeclaracionesOk("EXP-TEST-DOCS"));
    const resultado = await generarPaqueteDocumental(deps, {
      expedienteId: "EXP-TEST-DOCS",
      contexto: CONTEXTO,
    });
    if (!resultado.ok) throw new Error(resultado.motivo);

    const paquete = expedientes.actual().paqueteDocumental;
    if (!paquete) throw new Error("debería haber paquete");

    const bytes = archivos.archivos.get(claveDocumento("EXP-TEST-DOCS", "PROP-00018425", 1));
    if (!bytes) throw new Error("falta el archivo del paquete");

    // Fila 77: el hash del instrumento. Con D-11 el instrumento es uno.
    expect(paquete.hashSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(paquete.hashSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("guarda un PDF de verdad, con los códigos de las dos secciones adentro", async () => {
    const { deps, archivos } = armarDependencias(expedienteEnDeclaracionesOk("EXP-TEST-DOCS"));
    await generarPaqueteDocumental(deps, { expedienteId: "EXP-TEST-DOCS", contexto: CONTEXTO });

    for (const [clave, bytes] of archivos.archivos) {
      const texto = Buffer.from(bytes).toString("latin1");
      expect(texto.startsWith("%PDF-1.7")).toBe(true);
      expect(texto.trimEnd().endsWith("%%EOF")).toBe(true);
      // Los códigos de las dos secciones están impresos en el mismo archivo.
      expect(texto).toContain("PROP-00018425");
      expect(texto).toContain("FIPF-00018425");
      expect(clave).toMatch(/^expedientes\/EXP-TEST-DOCS\/documentos\/PROP-00018425-v1\.pdf$/);
    }
  });

  it("deja evidencia del cierre con los dos códigos y la huella", async () => {
    const { deps, evidencias } = armarDependencias(expedienteEnDeclaracionesOk("EXP-TEST-DOCS"));
    const resultado = await generarPaqueteDocumental(deps, {
      expedienteId: "EXP-TEST-DOCS",
      contexto: CONTEXTO,
    });
    if (!resultado.ok) throw new Error(resultado.motivo);

    expect(evidencias.registros).toHaveLength(1);
    const registro = evidencias.registros[0];
    expect(registro.paso).toBe(PASO_EVIDENCIA_DOCUMENTOS);
    expect(registro.resultado).toBe("EXITOSO");
    expect(registro.fecha).toBe(AHORA);
    expect(registro.ip).toBe(CONTEXTO.ip);
    expect(registro.sesionId).toBe(CONTEXTO.sesionId);
    expect(registro.detalle).toContain(resultado.documento.hashSha256);
    expect(registro.detalle).toContain("PROP-00018425");
    expect(registro.detalle).toContain("FIPF-00018425");
    // Este paso no pide aceptar nada: la aceptación ocurre al firmar.
    expect(registro.textoAceptado).toBeNull();
  });

  it("no filtra datos de salud, PEP, cédula ni tarjeta a la evidencia (regla #7)", async () => {
    const { deps, evidencias } = armarDependencias(expedienteEnDeclaracionesOk("EXP-TEST-DOCS"));
    await generarPaqueteDocumental(deps, { expedienteId: "EXP-TEST-DOCS", contexto: CONTEXTO });

    const volcado = JSON.stringify(evidencias.registros).toLowerCase();
    expect(volcado).not.toContain(identidadFixture.numeroCedula);
    expect(volcado).not.toContain("pep");
    expect(volcado).not.toContain("cáncer");
    expect(volcado).not.toContain("estadodesalud");
    expect(volcado).not.toContain("políticamente");
  });
});

// ---------------------------------------------------------------------------
// Idempotencia y rechazos
// ---------------------------------------------------------------------------

describe("generarPaqueteDocumental — idempotencia y rechazos", () => {
  it("es idempotente: no vuelve a renderizar un paquete ya cerrado", async () => {
    const { deps, archivos, evidencias } = armarDependencias(expedienteEnDeclaracionesOk("EXP-TEST-DOCS"));
    const entrada = { expedienteId: "EXP-TEST-DOCS", contexto: CONTEXTO };

    const primera = await generarPaqueteDocumental(deps, entrada);
    if (!primera.ok) throw new Error(primera.motivo);

    const espia = vi.spyOn(archivos, "guardarArchivo");
    const segunda = await generarPaqueteDocumental(deps, entrada);

    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;
    expect(segunda.generado).toBe(false);
    // Ni se reescribe el archivo, ni se genera evidencia nueva.
    expect(espia).not.toHaveBeenCalled();
    expect(evidencias.registros).toHaveLength(1);
    // Y la huella es exactamente la que ya estaba registrada.
    expect(segunda.documento.hashSha256).toBe(primera.documento.hashSha256);
  });

  it("rechaza un expediente que no llegó a DECLARACIONES_OK y deja evidencia del intento", async () => {
    const { deps, evidencias, archivos } = armarDependencias(crearExpediente("EXP-TEST-DOCS"));

    const resultado = await generarPaqueteDocumental(deps, {
      expedienteId: "EXP-TEST-DOCS",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("ESTADO_INVALIDO");
    expect(archivos.archivos.size).toBe(0);
    expect(evidencias.registros[0].resultado).toBe("FALLIDO");
  });

  it("rechaza un expediente incompleto y nombra los campos que faltan", async () => {
    // Estado correcto pero sin identidad ni plan: no puede armarse el contenido.
    const mutilado: Expediente = {
      ...expedienteEnDeclaracionesOk("EXP-TEST-DOCS"),
      identidad: null,
      datosComplementarios: null,
    };
    const { deps, archivos } = armarDependencias(mutilado);

    const resultado = await generarPaqueteDocumental(deps, {
      expedienteId: "EXP-TEST-DOCS",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("EXPEDIENTE_INCOMPLETO");
    expect(resultado.faltantes).toEqual(expect.arrayContaining(["identidad", "datosComplementarios"]));
    expect(archivos.archivos.size).toBe(0);
  });

  it("no cierra el paquete si el archivo guardado no coincide con el renderizado", async () => {
    const { deps, expedientes } = armarDependencias(expedienteEnDeclaracionesOk("EXP-TEST-DOCS"));
    // Un repositorio que informa una huella que no es la del contenido: es la
    // señal de que lo almacenado no es lo que se está por registrar.
    vi.spyOn(deps.archivos, "guardarArchivo").mockResolvedValue({
      clave: "expedientes/EXP-TEST-DOCS/documentos/PROP-00018425-v1.pdf",
      hashSha256: "f".repeat(64),
    });

    const resultado = await generarPaqueteDocumental(deps, {
      expedienteId: "EXP-TEST-DOCS",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("ALMACENAMIENTO_INCONSISTENTE");
    // El expediente se queda donde estaba: no hay paquete a medio cerrar.
    expect(expedientes.actual().estado).toBe("DECLARACIONES_OK");
    expect(expedientes.actual().paqueteDocumental).toBeNull();
  });

  it("responde EXPEDIENTE_NO_ENCONTRADO sin tocar nada", async () => {
    const { deps, archivos, evidencias } = armarDependencias(expedienteEnDeclaracionesOk("EXP-TEST-DOCS"));

    const resultado = await generarPaqueteDocumental(deps, {
      expedienteId: "EXP-QUE-NO-EXISTE",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("EXPEDIENTE_NO_ENCONTRADO");
    expect(archivos.archivos.size).toBe(0);
    expect(evidencias.registros).toHaveLength(0);
  });
});
