/**
 * Constancia de la firma del cliente — lo que se le muestra a quien firmó.
 *
 * Lo que se prueba son las reglas, no el formato:
 *
 * - **Regla #2** — nunca sale un código de OTP; de él solo viaja su referencia.
 * - **Regla #7** — no salen datos de salud ni la condición PEP.
 * - **D1** — la constancia solo constata la firma **interna**: sobre una firma
 *   de proveedor no existe, porque citaría los artículos de la firma simple
 *   sobre un acto que se produjo de otra manera.
 * - **Res. 210/2025, arts. 4 y 9** — están los tres pilares y los datos que el
 *   art. 9 manda conservar (IP, fecha y hora, códigos de validación).
 */
import { describe, expect, it } from "vitest";
import { proyectarConstanciaFirma } from "../constancia-firma";
import { PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE } from "../firma-cliente";
import { PASO_EVIDENCIA_VERIFICACION_P5 } from "../verificacion-identidad";
import type { Expediente, Firma, RegistroEvidencia } from "../tipos";
import { expedienteFirmado } from "./fixtures";

const OTP_ID = "OTP-FIRMA-TEST-1";

const FIRMA_INTERNA: Firma = {
  origen: "INTERNA",
  referenciaActo: OTP_ID,
  canal: "WHATSAPP",
  firmadoEn: "2026-08-09T15:03:00.000Z",
  hashDocumentoFirmado: "e".repeat(64),
};

function conFirmaInterna(): Expediente {
  return { ...expedienteFirmado(), firma: FIRMA_INTERNA };
}

function evidencia(parcial: Partial<RegistroEvidencia> & { paso: string }): RegistroEvidencia {
  return {
    id: `EV-${parcial.paso}`,
    expedienteId: "EXP-TEST-P7",
    fecha: "2026-08-09T15:03:00.000Z",
    ip: "200.1.2.3",
    dispositivo: "Android · Chrome",
    sesionId: "SES-TEST-1",
    versionTextoAceptado: null,
    textoAceptado: null,
    resultado: "EXITOSO",
    detalle: null,
    ...parcial,
  };
}

const HISTORIAL: readonly RegistroEvidencia[] = [
  evidencia({
    paso: PASO_EVIDENCIA_VERIFICACION_P5,
    fecha: "2026-08-09T14:40:00.000Z",
  }),
  evidencia({
    paso: PASO_EVIDENCIA_ACTO_FIRMA_CLIENTE,
    versionTextoAceptado: "PAGO-FIRMA-ACEPTACION-v1",
    detalle: `canal=WHATSAPP · destino=+5959•••••456 · otpId=${OTP_ID} · hashDocumento=${"a".repeat(64)}`,
  }),
];

describe("constancia de la firma del cliente", () => {
  it("agrupa la evidencia por los tres requisitos del art. 4", () => {
    const constancia = proyectarConstanciaFirma(conFirmaInterna(), HISTORIAL);
    if (!constancia) throw new Error("debería proyectar la constancia");

    expect(constancia.pilares.map((p) => p.requisito)).toEqual([
      "IDENTIFICACION",
      "INTEGRIDAD",
      "TRAZABILIDAD",
    ]);
    expect(constancia.naturaleza.nivel).toBe("SIMPLE_NO_CUALIFICADA");
    expect(constancia.naturaleza.emisor).toBe("SEGUROLOTENGO");
  });

  it("conserva lo que el art. 9 manda: IP, fecha y hora y código de validación", () => {
    const constancia = proyectarConstanciaFirma(conFirmaInterna(), HISTORIAL);
    if (!constancia) throw new Error("debería proyectar la constancia");

    const todos = constancia.pilares.flatMap((p) => p.hechos);
    const valorDe = (etiqueta: string) => todos.find((h) => h.etiqueta === etiqueta)?.valor;

    expect(valorDe("Dirección IP")).toBe("200.1.2.3");
    expect(valorDe("Firmado el")).toBe("2026-08-09T15:03:00.000Z");
    expect(valorDe("Código de validación (referencia)")).toBe(OTP_ID);
    expect(valorDe("Versión del texto aceptado")).toBe("PAGO-FIRMA-ACEPTACION-v1");
    expect(constancia.destinoEnmascarado).toBe("+5959•••••456");
  });

  it("no existe sobre una firma de proveedor: esa se respalda de otra manera", () => {
    // El fixture trae `origen: "PROVEEDOR"` tal como lo dejó el flujo v2.
    expect(proyectarConstanciaFirma(expedienteFirmado(), HISTORIAL)).toBeNull();
  });

  it("no existe sin firma ni sin paquete cerrado: no habría nada que constatar", () => {
    const conFirma = conFirmaInterna();
    expect(proyectarConstanciaFirma({ ...conFirma, firma: null }, HISTORIAL)).toBeNull();
    expect(
      proyectarConstanciaFirma({ ...conFirma, paqueteDocumental: null }, HISTORIAL),
    ).toBeNull();
  });

  it("lista las firmas institucionales aparte, con su certificado", () => {
    const constancia = proyectarConstanciaFirma(conFirmaInterna(), HISTORIAL);
    if (!constancia) throw new Error("debería proyectar la constancia");

    expect(constancia.firmasInstitucionales.length).toBeGreaterThan(0);
    for (const firma of constancia.firmasInstitucionales) {
      expect(firma.nivel).toBe("CUALIFICADA");
      expect(firma.certificado).not.toBe("");
    }
  });

  /**
   * La constancia es la del propio titular: sin su nombre, su cédula y su
   * fecha de nacimiento probaría que *alguien* firmó, no que firmó él. Y la
   * biometría entra por su resultado y la huella de cada captura, porque las
   * imágenes no se guardan (pedido de Andres, 01-sep).
   */
  it("identifica al titular y muestra la biometría que respaldó la firma", () => {
    const constancia = proyectarConstanciaFirma(conFirmaInterna(), HISTORIAL);
    if (!constancia) throw new Error("debería proyectar la constancia");

    const todos = constancia.pilares.flatMap((p) => p.hechos);
    const valorDe = (etiqueta: string) => todos.find((h) => h.etiqueta === etiqueta)?.valor;
    const identidad = expedienteFirmado().identidad!;

    expect(valorDe("Titular")).toBe(`${identidad.nombres} ${identidad.apellidos}`);
    expect(valorDe("Cédula de identidad")).toBe(identidad.numeroCedula);
    expect(valorDe("Fecha de nacimiento")).toBe(identidad.fechaNacimiento);
    expect(valorDe("IP de la verificación de identidad")).toBe("200.1.2.3");
    expect(valorDe("Prueba de vida")).toBe("Aprobada");
    expect(valorDe("Huella de la selfie")).toBe(identidad.captura.hashSelfie);
  });

  it("no filtra el código del OTP ni datos sensibles (reglas #2 y #7)", () => {
    const constancia = proyectarConstanciaFirma(conFirmaInterna(), HISTORIAL);
    const serializada = JSON.stringify(constancia);

    // El detalle de la evidencia trae el identificador, nunca el código; y
    // ningún campo de salud o PEP entra en esta proyección.
    expect(serializada).toContain(OTP_ID);
    for (const prohibido of ['codigo":"1', "declaracion", "pep", "diagnostic", "salud"]) {
      expect(serializada.toLowerCase()).not.toContain(prohibido);
    }
  });
});
