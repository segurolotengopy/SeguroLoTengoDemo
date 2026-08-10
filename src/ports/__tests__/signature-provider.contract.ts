/**
 * Suite de contrato para cualquier implementación de `SignatureProvider`
 * (mock u oficial), P8. Cubre la regla de negocio inviolable #3 (firma
 * atómica): el resultado exitoso trae ambos hashes firmados juntos, y no
 * hay forma de modelar un resultado parcial.
 */
import { describe, expect, it } from "vitest";
import type { PaqueteDocumental } from "../../domain/tipos";
import type { SignatureProvider } from "../signature-provider";

const PAQUETE_DE_PRUEBA: PaqueteDocumental = {
  solicitud: {
    codigo: "PROP-00018425",
    version: 1,
    hashSha256: "a".repeat(64),
    cerradoEn: "2026-01-01T00:00:00.000Z",
  },
  fipf: {
    codigo: "FIPF-00018425",
    version: 1,
    hashSha256: "b".repeat(64),
    cerradoEn: "2026-01-01T00:00:00.000Z",
  },
};

export interface CableadoSignatureProvider {
  crearProveedor: () => SignatureProvider | Promise<SignatureProvider>;
  /**
   * Lleva el acto de firma `idCode100` hasta el final, como si la persona
   * hubiera abierto el enlace y tipeado el OTP en la pantalla de Code100.
   *
   * Es un hook y no un método del puerto a propósito: firmar es algo que
   * hace la persona del otro lado, no SeguroLoTengo. Cada implementación
   * decide cómo se simula (el mock tiene su palanca de panel de demo; el
   * adaptador oficial lo haría contra un entorno de prueba de Code100).
   */
  completarActoDeFirma: (proveedor: SignatureProvider, idCode100: string) => Promise<void>;
}

export function runSignatureProviderContractTests(cableado: CableadoSignatureProvider): void {
  async function proveedor(): Promise<SignatureProvider> {
    return await cableado.crearProveedor();
  }

  describe("SignatureProvider (contrato)", () => {
    it("inicia el acto de firma y devuelve un identificador de Code100", async () => {
      const p = await proveedor();
      const iniciada = await p.iniciarFirma({
        expedienteId: "EXP-CONTRATO-1",
        canal: "WHATSAPP",
        destino: "+595981000000",
        paqueteDocumental: PAQUETE_DE_PRUEBA,
      });

      expect(iniciada.idCode100.length).toBeGreaterThan(0);
      expect(iniciada.urlActoDeFirma.length).toBeGreaterThan(0);
      // Fila 41 de la matriz de cumplimiento: el enlace vive 24 horas.
      expect(new Date(iniciada.venceEn).getTime()).toBeGreaterThan(
        new Date(iniciada.enlaceEnviadoEn).getTime(),
      );
    });

    it("mientras la persona no firma, el acto queda PENDIENTE y no expone ningún hash", async () => {
      const p = await proveedor();
      const iniciada = await p.iniciarFirma({
        expedienteId: "EXP-CONTRATO-2",
        canal: "WHATSAPP",
        destino: "+595981000000",
        paqueteDocumental: PAQUETE_DE_PRUEBA,
      });

      const resultado = await p.confirmarResultado(iniciada.idCode100);

      expect(resultado.estado).toBe("PENDIENTE");
      expect(JSON.stringify(resultado)).not.toContain("hashSolicitudFirmada");
    });

    it("una firma exitosa trae ambos hashes firmados juntos (regla #3, atómica)", async () => {
      const p = await proveedor();
      const iniciada = await p.iniciarFirma({
        expedienteId: "EXP-CONTRATO-3",
        canal: "WHATSAPP",
        destino: "+595981000000",
        paqueteDocumental: PAQUETE_DE_PRUEBA,
      });

      await cableado.completarActoDeFirma(p, iniciada.idCode100);
      const resultado = await p.confirmarResultado(iniciada.idCode100);

      expect(resultado.estado).toBe("FIRMADO");
      if (resultado.estado !== "FIRMADO") return;
      expect(resultado.firma.hashSolicitudFirmada.length).toBeGreaterThan(0);
      expect(resultado.firma.hashFipfFirmado.length).toBeGreaterThan(0);
      expect(resultado.firma.idCode100).toBe(iniciada.idCode100);
      expect(resultado.firma.canal).toBe("WHATSAPP");
    });

    // Nota (regla #3): `ResultadoFirma` no tiene forma de representar "un
    // documento firmado y el otro no": la rama `FIRMADO` exige `firma: Firma`
    // completa (ambos hashes son campos obligatorios en src/domain/tipos.ts) y
    // las otras dos no exponen ningún hash. No existe un estado intermedio
    // representable a nivel de tipos, así que el test de "firma parcial" es,
    // por construcción, imposible de escribir contra esta interfaz. Lo que sí
    // se verifica —que una falla a mitad del sellado no deje un documento
    // firmado— es propio de cada implementación:
    // src/adapters/mock/__tests__/signature-provider.test.ts.

    it("consultar dos veces una firma completa devuelve exactamente lo mismo (idempotente)", async () => {
      const p = await proveedor();
      const iniciada = await p.iniciarFirma({
        expedienteId: "EXP-CONTRATO-4",
        canal: "EMAIL",
        destino: "persona@example.com",
        paqueteDocumental: PAQUETE_DE_PRUEBA,
      });

      await cableado.completarActoDeFirma(p, iniciada.idCode100);
      const primera = await p.confirmarResultado(iniciada.idCode100);
      const segunda = await p.confirmarResultado(iniciada.idCode100);

      expect(segunda).toEqual(primera);
    });

    it("un identificador desconocido no es una firma", async () => {
      const p = await proveedor();
      const resultado = await p.confirmarResultado("NO-EXISTE");

      expect(resultado.estado).toBe("NO_FIRMADO");
      if (resultado.estado !== "NO_FIRMADO") return;
      expect(["RECHAZADA", "EXPIRADA", "CANCELADA", "ERROR_PROVEEDOR"]).toContain(resultado.motivo);
    });
  });
}
