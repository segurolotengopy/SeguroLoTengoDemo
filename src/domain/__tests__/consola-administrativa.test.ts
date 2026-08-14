/**
 * Enmascarado y filtro del listado de búsqueda de la consola administrativa
 * (`docs/CONSOLA_ADMINISTRATIVA.md` §3: *"titular (enmascarado salvo que se
 * abra el detalle)"*).
 *
 * Era el pendiente anotado en la auditoría de reglas inviolables del
 * 2026-08-10: `armarResultados` y `filtrarPorNombre` solo quedaban cubiertos
 * de forma indirecta por la suite de bloqueo. Lo que importa acá es que el
 * listado nunca exponga nombre ni cédula completos — el dato completo solo
 * vive en la vista de detalle.
 */
import { describe, expect, it } from "vitest";
import type { EvidenceStore } from "../../ports/evidence-store";
import {
  DESTINATARIO_CASOS_ALIANZA,
  PASO_EVIDENCIA_ENVIO_ALIANZA,
  armarResultados,
  enviarCasoAAlianza,
  filtrarPorNombre,
} from "../consola-administrativa";
import { ESTADOS_EXPEDIENTE, esEstadoExpediente } from "../tipos";
import type { Expediente, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal";
import {
  NUMERO_CASO_FIJO,
  NUMERO_PROPUESTA_FIJO,
  crearExpediente,
  declaracionesCompatibles,
  expedienteEnDeclaracionesOk,
  identidadFixture,
} from "./fixtures";

/** Expediente con identidad completa (la de Mónica, `identidadFixture`). */
function expedienteConIdentidad(id: string): Expediente {
  return expedienteEnDeclaracionesOk(id);
}

describe("armarResultados", () => {
  it("enmascara nombre y documento: inicial + bullets, nunca el valor completo", () => {
    const [fila] = armarResultados([expedienteConIdentidad("EXP-A")]);

    // "Mónica Mariana Gorena Tapia" → primera palabra de nombre y apellido.
    expect(fila.titularEnmascarado).toBe("M••••• G•••••");
    // "9.323.336" → dos primeros caracteres y bullets.
    expect(fila.documentoEnmascarado).toBe("9.•••••••");

    // Ni el nombre ni la cédula completos pueden aparecer en ningún campo de
    // la fila serializada.
    const serializada = JSON.stringify(fila);
    expect(serializada).not.toContain(identidadFixture.nombres);
    expect(serializada).not.toContain(identidadFixture.apellidos);
    expect(serializada).not.toContain(identidadFixture.numeroCedula);
  });

  it("sin identidad todavía (antes de P5) no hay nada que enmascarar", () => {
    const [fila] = armarResultados([crearExpediente("EXP-SIN-ID")]);
    expect(fila.titularEnmascarado).toBeNull();
    expect(fila.documentoEnmascarado).toBeNull();
  });

  it("copia los campos operativos que el listado sí muestra", () => {
    const expediente = expedienteConIdentidad("EXP-B");
    const [fila] = armarResultados([expediente]);

    expect(fila.id).toBe("EXP-B");
    expect(fila.estado).toBe(expediente.estado);
    expect(fila.actualizadoEn).toBe(expediente.actualizadoEn);
    expect(fila.bloqueaRegistro).toBe(false);
  });
});

describe("filtrarPorNombre", () => {
  const conIdentidad = expedienteConIdentidad("EXP-FILTRO");
  const sinIdentidad = crearExpediente("EXP-FILTRO-SIN-ID");

  it("busca por fragmento sobre nombre y apellido, sin distinguir mayúsculas", () => {
    expect(filtrarPorNombre([conIdentidad], "gorena")).toHaveLength(1);
    expect(filtrarPorNombre([conIdentidad], "MÓNICA")).toHaveLength(1);
    // Fragmento que cruza nombre y apellido: "…Mariana Gorena…".
    expect(filtrarPorNombre([conIdentidad], "mariana gorena")).toHaveLength(1);
    expect(filtrarPorNombre([conIdentidad], "lopez")).toHaveLength(0);
  });

  it("fragmento vacío o de espacios devuelve todo sin filtrar", () => {
    expect(filtrarPorNombre([conIdentidad, sinIdentidad], "")).toHaveLength(2);
    expect(filtrarPorNombre([conIdentidad, sinIdentidad], "   ")).toHaveLength(2);
  });

  it("un expediente sin identidad nunca coincide con un fragmento", () => {
    expect(filtrarPorNombre([sinIdentidad], "gorena")).toHaveLength(0);
  });
});

describe("enviarCasoAAlianza", () => {
  const CONTEXTO: ContextoPeticion = {
    ip: "200.10.20.30",
    dispositivo: "Mozilla/5.0 (test)",
    sesionId: "sesion-consola",
  };

  /**
   * Doble del repositorio que además **registra si alguien escribió**. El
   * envío es una lectura pura del expediente: si mañana alguien le agrega una
   * transición o un flag "yaEnviado", este test lo marca.
   */
  function repositorioFalso(inicial: Expediente | null) {
    const escrituras: Expediente[] = [];
    const repositorio: RepositorioExpediente = {
      async obtenerPorId(id) {
        return inicial && id === inicial.id ? inicial : null;
      },
      async crear(expediente) {
        escrituras.push(expediente);
      },
      async guardar(expediente) {
        escrituras.push(expediente);
      },
    };
    return { repositorio, escrituras };
  }

  function evidenciasFalsas() {
    const registros: RegistroEvidencia[] = [];
    const evidencias: EvidenceStore = {
      async guardar(registro) {
        registros.push(registro);
      },
      async obtenerHistorial(expedienteId) {
        return registros.filter((registro) => registro.expedienteId === expedienteId);
      },
    };
    return { evidencias, registros };
  }

  function deps(expediente: Expediente | null) {
    const { repositorio, escrituras } = repositorioFalso(expediente);
    const { evidencias, registros } = evidenciasFalsas();
    return {
      deps: {
        expedientes: repositorio,
        evidencias,
        ahora: () => "2026-08-13T12:00:00.000Z",
        nuevoId: () => "EV-ENVIO-1",
      },
      escrituras,
      registros,
    };
  }

  it("deja evidencia append-only del envío y no toca el expediente", async () => {
    const expediente = expedienteConIdentidad("EXP-ENVIO");
    const { deps: dependencias, escrituras, registros } = deps(expediente);

    const resultado = await enviarCasoAAlianza(dependencias, {
      expedienteId: "EXP-ENVIO",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    // Ninguna escritura sobre el expediente: el envío no transiciona ni edita.
    expect(escrituras).toHaveLength(0);

    expect(registros).toHaveLength(1);
    const [evidencia] = registros;
    expect(evidencia.paso).toBe(PASO_EVIDENCIA_ENVIO_ALIANZA);
    expect(evidencia.resultado).toBe("EXITOSO");
    expect(evidencia.expedienteId).toBe("EXP-ENVIO");
    expect(evidencia.fecha).toBe("2026-08-13T12:00:00.000Z");
    expect(evidencia.ip).toBe(CONTEXTO.ip);
    expect(evidencia.dispositivo).toBe(CONTEXTO.dispositivo);
    expect(evidencia.sesionId).toBe(CONTEXTO.sesionId);
  });

  it("regla #7: ni las respuestas médicas ni la condición PEP viajan en el envío", async () => {
    // Expediente con declaraciones y datos complementarios cargados: es el
    // peor caso, porque el dominio los tiene a mano.
    const expediente = expedienteConIdentidad("EXP-SENSIBLE");
    expect(expediente.declaraciones).not.toBeNull();

    const { deps: dependencias, registros } = deps(expediente);
    const resultado = await enviarCasoAAlianza(dependencias, {
      expedienteId: "EXP-SENSIBLE",
      contexto: CONTEXTO,
    });

    // Ni el asunto que se devuelve al cliente ni el detalle de la evidencia
    // pueden nombrar una declaración médica o la condición PEP.
    const superficie = JSON.stringify(resultado) + JSON.stringify(registros);
    for (const campo of Object.keys(declaracionesCompatibles)) {
      expect(superficie).not.toContain(campo);
    }
    expect(superficie.toLowerCase()).not.toContain("pep");
    // Tampoco la cédula ni el nombre completo del titular.
    expect(superficie).not.toContain(identidadFixture.numeroCedula);
    expect(superficie).not.toContain(identidadFixture.nombres);
  });

  it("el asunto referencia el caso de derivación cuando existe", async () => {
    const derivado: Expediente = {
      ...expedienteConIdentidad("EXP-DERIVADO"),
      estado: "DERIVADO_MANUAL",
      numeroCasoDerivacion: NUMERO_CASO_FIJO,
    };
    const { deps: dependencias } = deps(derivado);

    const resultado = await enviarCasoAAlianza(dependencias, {
      expedienteId: "EXP-DERIVADO",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.asunto).toBe(`Caso ${NUMERO_CASO_FIJO} · DERIVADO_MANUAL`);
    expect(resultado.destinatario).toBe(DESTINATARIO_CASOS_ALIANZA);
    expect(resultado.enviadoEn).toBe("2026-08-13T12:00:00.000Z");
  });

  it("sin caso de derivación cae al correlativo de la propuesta", async () => {
    const conPropuesta: Expediente = {
      ...expedienteConIdentidad("EXP-PROP"),
      numeroPropuesta: NUMERO_PROPUESTA_FIJO,
      numeroCasoDerivacion: null,
    };
    const { deps: dependencias } = deps(conPropuesta);

    const resultado = await enviarCasoAAlianza(dependencias, {
      expedienteId: "EXP-PROP",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.asunto).toContain(`PROP-${NUMERO_PROPUESTA_FIJO}`);
  });

  it("expediente inexistente: rechaza y no deja evidencia", async () => {
    const { deps: dependencias, registros } = deps(null);

    const resultado = await enviarCasoAAlianza(dependencias, {
      expedienteId: "EXP-QUE-NO-EXISTE",
      contexto: CONTEXTO,
    });

    expect(resultado).toEqual({ ok: false, motivo: "EXPEDIENTE_NO_ENCONTRADO" });
    expect(registros).toHaveLength(0);
  });
});

describe("cola de asistencia de identidad en la consola", () => {
  it("todos los estados del tipo son buscables, sin listas escritas a mano", () => {
    // Este test existe por un error real: `ASISTENCIA_IDENTIDAD` se agregó al
    // tipo y quedó fuera del selector de la consola, que era una copia a mano.
    // Había expedientes en ese estado y el staff no podía listarlos.
    expect(ESTADOS_EXPEDIENTE).toContain("ASISTENCIA_IDENTIDAD");
    expect(ESTADOS_EXPEDIENTE).toContain("DERIVADO_MANUAL");
    // 16 estados: si alguien agrega uno, esta cuenta obliga a mirar el resto.
    expect(ESTADOS_EXPEDIENTE).toHaveLength(16);
  });

  it("el reconocedor de estados acepta los del tipo y rechaza el resto", () => {
    expect(esEstadoExpediente("ASISTENCIA_IDENTIDAD")).toBe(true);
    expect(esEstadoExpediente("INVENTADO")).toBe(false);
    expect(esEstadoExpediente(null)).toBe(false);
  });

  it("la fila expone el caso de asistencia por separado del de derivación", () => {
    // Son dos colas distintas: análisis de riesgo de Alianza contra soporte de
    // captura. Mezclarlas en un solo campo haría imposible medir cualquiera.
    const enAsistencia: Expediente = {
      ...crearExpediente("EXP-ASIS"),
      estado: "ASISTENCIA_IDENTIDAD",
      numeroCasoAsistenciaIdentidad: "ASIS-2026-000123",
    };
    const [fila] = armarResultados([enAsistencia]);

    expect(fila.numeroCasoAsistenciaIdentidad).toBe("ASIS-2026-000123");
    expect(fila.numeroCasoDerivacion).toBeNull();
  });

  it("un expediente en asistencia NO aparece como bloqueante", () => {
    // La diferencia central con DERIVADO_MANUAL: la persona puede reintentar,
    // así que la consola no debe mostrarlo como si la cédula estuviera trabada.
    const enAsistencia: Expediente = {
      ...crearExpediente("EXP-ASIS-2"),
      estado: "ASISTENCIA_IDENTIDAD",
      numeroCasoAsistenciaIdentidad: "ASIS-2026-000124",
    };
    const [fila] = armarResultados([enAsistencia]);

    expect(fila.bloqueaRegistro).toBe(false);
  });
});
