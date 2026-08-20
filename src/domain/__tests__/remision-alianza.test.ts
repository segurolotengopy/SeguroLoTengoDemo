/**
 * Tests de la remisión del caso a Alianza (CHG-47).
 *
 * Dos cosas se cuidan: que la remisión **salga sola** al derivar —que es todo
 * el cambio de CHG-47— y que **no lleve nada de la persona**, porque es una
 * comunicación saliente y la regla inviolable #7 no hace excepción por el
 * destinatario.
 */
import { describe, expect, it } from "vitest";
import {
  DESTINATARIO_CASOS_ALIANZA,
  PASO_EVIDENCIA_REMISION_ALIANZA,
  referenciaDelCaso,
  registrarRemisionFallida,
  remitirCasoAAlianza,
} from "../remision-alianza";
import { codigoSolicitud } from "../documentos";
import type { EvidenceStore } from "../../ports/evidence-store";
import type { Expediente, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion } from "../verificacion-canal";
import { NUMERO_PROPUESTA_FIJO, expedienteFirmado } from "./fixtures";

const AHORA = "2026-08-09T15:30:00.000Z";

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-test",
};

function evidencias(): EvidenceStore & { registros: RegistroEvidencia[] } {
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

function deps(evid: EvidenceStore) {
  let contador = 0;
  return { evidencias: evid, ahora: () => AHORA, nuevoId: () => `ev-${(contador += 1)}` };
}

/** Un expediente derivado, con su número de caso. */
function derivado(): Expediente {
  return {
    ...expedienteFirmado("EXP-DERIV"),
    estado: "DERIVADO_MANUAL",
    numeroCasoDerivacion: "CASO-2026-000123",
    motivoDerivacionManual: [8],
  };
}

describe("referencia del caso", () => {
  /**
   * El número de caso primero: es el que Alianza usa. El correlativo después,
   * para los expedientes que llegaron a tenerlo. Nunca la cédula ni el nombre.
   */
  it("prefiere el número de caso sobre el correlativo", () => {
    expect(referenciaDelCaso(derivado())).toBe("CASO-2026-000123");
  });

  it("usa el correlativo cuando no hay número de caso", () => {
    expect(referenciaDelCaso(expedienteFirmado("EXP-1"))).toBe(
      codigoSolicitud(NUMERO_PROPUESTA_FIJO),
    );
  });

  it("cae al id cuando no hay ni caso ni correlativo", () => {
    const sinNada: Expediente = {
      ...expedienteFirmado("EXP-1"),
      numeroPropuesta: null,
      numeroCasoDerivacion: null,
    };
    expect(referenciaDelCaso(sinNada)).toBe("EXP-1");
  });
});

describe("remisión del caso", () => {
  it("deja evidencia con el destinatario, el asunto y el origen", async () => {
    const evid = evidencias();

    const remision = await remitirCasoAAlianza(deps(evid), {
      expediente: derivado(),
      contexto: CONTEXTO,
      origen: "AUTOMATICA",
    });

    expect(remision.destinatario).toBe(DESTINATARIO_CASOS_ALIANZA);
    expect(remision.asunto).toBe("Caso CASO-2026-000123 · DERIVADO_MANUAL");
    expect(evid.registros).toHaveLength(1);
    const registro = evid.registros[0]!;
    expect(registro.paso).toBe(PASO_EVIDENCIA_REMISION_ALIANZA);
    expect(registro.resultado).toBe("EXITOSO");
    expect(registro.detalle).toContain("origen=AUTOMATICA");
  });

  /**
   * El origen es el dato que CHG-47 agrega: un caso derivado hace tres días
   * cuya única remisión es de ayer y manual cuenta una historia distinta de uno
   * que se remitió al derivarse.
   */
  it("distingue la remisión automática de la que dispara la consola", async () => {
    const evid = evidencias();

    await remitirCasoAAlianza(deps(evid), {
      expediente: derivado(),
      contexto: CONTEXTO,
      origen: "CONSOLA",
    });

    expect(evid.registros[0]?.detalle).toContain("origen=CONSOLA");
  });

  /**
   * Regla inviolable #7. Ni siquiera va el **motivo** de la derivación: saber
   * que un caso es "de salud" ya dice algo de la persona, y no hace falta para
   * que el buzón lo enrute.
   */
  it("no lleva ningún dato de la persona ni el motivo de la derivación", async () => {
    const evid = evidencias();
    const expediente = derivado();

    await remitirCasoAAlianza(deps(evid), {
      expediente,
      contexto: CONTEXTO,
      origen: "AUTOMATICA",
    });

    const serializado = JSON.stringify(evid.registros[0]);
    for (const dato of [
      expediente.identidad?.numeroCedula,
      expediente.identidad?.nombres,
      expediente.identidad?.apellidos,
      expediente.canalWhatsapp?.valor,
      expediente.canalEmail?.valor,
    ]) {
      if (dato) expect(serializado).not.toContain(dato);
    }
    for (const sensible of ["SALUD", "PEP", "condicionPep", "estadoDeSalud"]) {
      expect(serializado).not.toContain(sensible);
    }
  });

  /** Remitir no mueve el expediente: `DERIVADO_MANUAL` sigue siendo terminal. */
  it("no modifica el expediente", async () => {
    const evid = evidencias();
    const expediente = derivado();
    const antes = JSON.stringify(expediente);

    await remitirCasoAAlianza(deps(evid), {
      expediente,
      contexto: CONTEXTO,
      origen: "AUTOMATICA",
    });

    expect(JSON.stringify(expediente)).toBe(antes);
  });
});

describe("remisión fallida", () => {
  /**
   * Que la remisión automática falle tiene que ser **visible**: un caso
   * derivado que nunca llegó a Alianza es exactamente lo que CHG-47 vino a
   * evitar, y la salida es el reenvío manual.
   */
  it("deja evidencia FALLIDA que dice que se puede reenviar desde la consola", async () => {
    const evid = evidencias();

    await registrarRemisionFallida(deps(evid), {
      expediente: derivado(),
      contexto: CONTEXTO,
      detalle: "la base no respondió",
    });

    const registro = evid.registros[0]!;
    expect(registro.paso).toBe(PASO_EVIDENCIA_REMISION_ALIANZA);
    expect(registro.resultado).toBe("FALLIDO");
    expect(registro.detalle).toContain("reenviable desde la consola");
    expect(registro.detalle).toContain("CASO-2026-000123");
  });
});
