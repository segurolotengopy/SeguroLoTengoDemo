/**
 * Suite de contrato para cualquier implementación de `SignatureProvider`
 * (mock u oficial). Con el documento único (D-11) la firma atómica de la regla
 * inviolable #3 dejó de ser algo que este contrato defienda: hay un documento
 * y una huella, así que un resultado parcial no es representable.
 */
import { describe, expect, it } from "vitest";
import type { PaqueteDocumental } from "../../domain/tipos";
import type { SignatureProvider } from "../signature-provider";

const PAQUETE_DE_PRUEBA: PaqueteDocumental = {
  codigo: "PROP-00018425",
  codigoSeccionFipf: "FIPF-00018425",
  version: 1,
  hashSha256: "a".repeat(64),
  cerradoEn: "2026-01-01T00:00:00.000Z",
  tokenVerificacion: `00018425-${"1".repeat(32)}`,
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
        documento: PAQUETE_DE_PRUEBA,
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
        documento: PAQUETE_DE_PRUEBA,
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
        documento: PAQUETE_DE_PRUEBA,
      });

      await cableado.completarActoDeFirma(p, iniciada.idCode100);
      const resultado = await p.confirmarResultado(iniciada.idCode100);

      expect(resultado.estado).toBe("FIRMADO");
      if (resultado.estado !== "FIRMADO") return;
      expect(resultado.firma.hashDocumentoFirmado.length).toBeGreaterThan(0);
      expect(resultado.firma.idCode100).toBe(iniciada.idCode100);
      expect(resultado.firma.canal).toBe("WHATSAPP");
    });

    // Nota (regla #3): con el documento único (D-11) la regla dejó de ser algo
    // que este contrato tenga que defender. La Solicitud y el FIPF son
    // secciones del mismo PDF y este puerto recibe un `DocumentoCerrado`: no
    // existe la operación que podría firmar uno y no el otro. Antes había acá
    // una nota explicando por qué el test de "firma parcial" era imposible de
    // escribir; ahora es imposible de *pensar*, que es lo que buscaba D-11.
    // Lo propio de cada implementación sigue siendo:
    // src/adapters/mock/__tests__/signature-provider.test.ts.

    it("consultar dos veces una firma completa devuelve exactamente lo mismo (idempotente)", async () => {
      const p = await proveedor();
      const iniciada = await p.iniciarFirma({
        expedienteId: "EXP-CONTRATO-4",
        canal: "EMAIL",
        destino: "persona@example.com",
        documento: PAQUETE_DE_PRUEBA,
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
