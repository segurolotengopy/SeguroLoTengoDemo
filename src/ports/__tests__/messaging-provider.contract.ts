/**
 * Suite de contrato de `MessagingProvider` (CHG-44, CMP-05): la cumple tanto
 * el mock del demo como cualquier adaptador oficial que exista algún día.
 *
 * Lo que se verifica no es que el mensaje llegue —eso depende del proveedor—
 * sino **las dos disciplinas de las que depende CMP-05**:
 *
 * - **Aceptar no es entregar.** Un adaptador que devolviera `ENTREGADO` apenas
 *   acepta el envío dejaría el acuse cumplido de mentira, y la pantalla le
 *   diría a la persona que recibió algo que quizá no recibió.
 * - **Idempotencia por intento.** Un reintento por timeout de red no puede
 *   hacer que a la persona le llegue el mismo mensaje dos veces.
 */
import { describe, expect, it } from "vitest";
import type { MessagingProvider, SolicitudEntrega } from "../messaging-provider";

export interface EscenariosMessaging {
  /** Destino válido para el canal de WhatsApp, en E.164. */
  readonly destinoWhatsapp: string;
  /** Destino válido de correo. */
  readonly destinoCorreo: string;
  /**
   * Empuja el reloj del proveedor hasta que un envío aceptado quede resuelto.
   * El mock adelanta su tiempo simulado; un adaptador real esperaría al
   * webhook del proveedor.
   */
  readonly resolverEntregas: () => Promise<void> | void;
}

function solicitud(parcial: Partial<SolicitudEntrega> = {}): SolicitudEntrega {
  return {
    expedienteId: "EXP-CONTRATO",
    canal: "WHATSAPP",
    destino: "+595981000000",
    mensaje: "Mensaje de contrato.",
    adjuntos: [
      {
        codigo: "CPC-00000001",
        nombreArchivo: "CPC-00000001.pdf",
        contentType: "application/pdf",
        bytes: new Uint8Array([37, 80, 68, 70, 45]),
        hashSha256: "a".repeat(64),
      },
    ],
    idempotencyKey: "EXP-CONTRATO:WHATSAPP:1",
    ...parcial,
  };
}

export function runMessagingProviderContractTests(
  crearProveedor: () => MessagingProvider | Promise<MessagingProvider>,
  escenarios: EscenariosMessaging,
): void {
  async function proveedor(): Promise<MessagingProvider> {
    return await crearProveedor();
  }

  describe("MessagingProvider (contrato)", () => {
    it("acepta un envío y devuelve una referencia", async () => {
      const p = await proveedor();
      const resultado = await p.entregarDocumentos(
        solicitud({ destino: escenarios.destinoWhatsapp }),
      );

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.referenciaEnvio.length).toBeGreaterThan(0);
    });

    /**
     * La distinción que sostiene a CMP-05: aceptado ≠ entregado. Si un
     * adaptador colapsara los dos, el acuse no probaría nada.
     */
    it("un envío recién aceptado no está entregado todavía", async () => {
      const p = await proveedor();
      const envio = await p.entregarDocumentos(
        solicitud({ destino: escenarios.destinoWhatsapp, idempotencyKey: "contrato:transito" }),
      );
      expect(envio.ok).toBe(true);
      if (!envio.ok) return;

      const consulta = await p.consultarEntrega(envio.referenciaEnvio);
      expect(consulta?.estado).toBe("EN_TRANSITO");
    });

    it("resuelto el envío, lo reporta como entregado con su instante", async () => {
      const p = await proveedor();
      const envio = await p.entregarDocumentos(
        solicitud({ destino: escenarios.destinoWhatsapp, idempotencyKey: "contrato:entregado" }),
      );
      expect(envio.ok).toBe(true);
      if (!envio.ok) return;

      await escenarios.resolverEntregas();

      const consulta = await p.consultarEntrega(envio.referenciaEnvio);
      expect(consulta?.estado).toBe("ENTREGADO");
      expect(consulta?.actualizadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("repetir la misma clave de idempotencia devuelve la misma referencia", async () => {
      const p = await proveedor();
      const entrada = solicitud({
        destino: escenarios.destinoWhatsapp,
        idempotencyKey: "contrato:idempotente",
      });

      const primera = await p.entregarDocumentos(entrada);
      const segunda = await p.entregarDocumentos(entrada);

      expect(primera.ok && segunda.ok).toBe(true);
      if (!primera.ok || !segunda.ok) return;
      expect(segunda.referenciaEnvio).toBe(primera.referenciaEnvio);
    });

    it("una clave distinta es un envío distinto", async () => {
      const p = await proveedor();
      const a = await p.entregarDocumentos(
        solicitud({ destino: escenarios.destinoWhatsapp, idempotencyKey: "contrato:a" }),
      );
      const b = await p.entregarDocumentos(
        solicitud({ destino: escenarios.destinoWhatsapp, idempotencyKey: "contrato:b" }),
      );

      expect(a.ok && b.ok).toBe(true);
      if (!a.ok || !b.ok) return;
      expect(b.referenciaEnvio).not.toBe(a.referenciaEnvio);
    });

    it("atiende también el canal de correo", async () => {
      const p = await proveedor();
      const resultado = await p.entregarDocumentos(
        solicitud({
          canal: "EMAIL",
          destino: escenarios.destinoCorreo,
          idempotencyKey: "contrato:correo",
        }),
      );
      expect(resultado.ok).toBe(true);
    });

    /**
     * Un destino que no es del canal es un error de programación —el canal ya
     * fue verificado— y tiene que distinguirse de una caída: reintentar no lo
     * arregla, y el despachador usa esa diferencia para no gastar intentos.
     */
    it("distingue un destino inválido de una falla transitoria", async () => {
      const p = await proveedor();
      const resultado = await p.entregarDocumentos(
        solicitud({
          canal: "WHATSAPP",
          destino: escenarios.destinoCorreo,
          idempotencyKey: "contrato:destino-invalido",
        }),
      );

      expect(resultado.ok).toBe(false);
      if (resultado.ok) return;
      expect(resultado.motivo).toBe("DESTINO_INVALIDO");
    });

    it("una referencia que no existe se distingue de un envío fallido", async () => {
      const p = await proveedor();
      expect(await p.consultarEntrega("REFERENCIA-QUE-NO-EXISTE")).toBeNull();
    });

    it("no entrega un mensaje sin documentos", async () => {
      const p = await proveedor();
      const resultado = await p.entregarDocumentos(
        solicitud({
          destino: escenarios.destinoWhatsapp,
          adjuntos: [],
          idempotencyKey: "contrato:sin-adjuntos",
        }),
      );
      expect(resultado.ok).toBe(false);
    });
  });
}
