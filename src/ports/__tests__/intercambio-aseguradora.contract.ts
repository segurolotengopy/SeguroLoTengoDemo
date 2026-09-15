/**
 * Suite de contrato de `IntercambioAseguradora` (ítem 36): la cumplen el mock y
 * el adaptador oficial sobre Transfer Family (este último contra un doble del
 * conector y del servidor SFTP).
 *
 * Lo que se verifica es lo que el lote de firma va a dar por sentado:
 *
 * - **Lo devuelto contiene lo enviado como prefijo.** Alianza firma de forma
 *   incremental; si el transporte alterara un byte, el emparejamiento por
 *   prefijo (`DISENO_FIRMA_EN_LOTE.md` §2) no encontraría nada.
 * - **Idempotencia por huella**, y reintento posible solo tras una falla.
 * - **Eventos que solo crecen** (regla inviolable #10).
 * - **Nada a la consola** (regla inviolable #7): los PDF llevan salud y PEP.
 *
 * El proveedor se crea con `CPC` habilitado y `PROP` no. No es una decisión
 * sobre qué firma Alianza (sigue abierto, P1): es la configuración mínima para
 * probar que la lista se respeta.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import type { CarpetaRecepcion } from "../../domain/intercambio-aseguradora";
import type {
  ArchivoRemoto,
  IntercambioAseguradora,
  ResultadoListado,
  SolicitudEnvioDocumento,
} from "../intercambio-aseguradora";

export interface EscenariosIntercambio {
  /**
   * Hace avanzar lo pendiente del otro lado: transferencias, listados y la
   * firma de Alianza. El mock adelanta su reloj; el doble del conector procesa
   * su cola.
   */
  readonly resolverPendientes: () => Promise<void> | void;
}

/** Texto que no puede aparecer en ningún log: simula una declaración de salud. */
export const CENTINELA_SENSIBLE = "DECLARACION-SALUD-CENTINELA-PEP";

export function pdfDePrueba(semilla: string): Uint8Array {
  const cuerpo =
    `%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${CENTINELA_SENSIBLE} ${semilla}\n` +
    `xref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n60\n%%EOF\n`;
  return new TextEncoder().encode(cuerpo);
}

export function solicitudDePrueba(parcial: Partial<SolicitudEnvioDocumento> = {}): SolicitudEnvioDocumento {
  const bytes = parcial.bytes ?? pdfDePrueba("base");
  return {
    tipo: "CPC",
    codigo: "CPC-00018425",
    correlativo: "00018425",
    version: 1,
    bytes,
    hashSha256: createHash("sha256").update(bytes).digest("hex"),
    ...parcial,
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function runIntercambioAseguradoraContractTests(
  crearProveedor: () => IntercambioAseguradora | Promise<IntercambioAseguradora>,
  escenarios: EscenariosIntercambio,
): void {
  async function proveedor(): Promise<IntercambioAseguradora> {
    return await crearProveedor();
  }

  async function listar(p: IntercambioAseguradora, carpeta: CarpetaRecepcion): Promise<ResultadoListado> {
    const pedido = await p.solicitarListado(carpeta);
    if (!pedido.ok) throw new Error(`listado no pedido: ${pedido.motivo}`);
    let resultado = await p.obtenerListado(pedido.referencia);
    for (let vuelta = 0; vuelta < 3 && resultado?.estado === "EN_CURSO"; vuelta += 1) {
      await escenarios.resolverPendientes();
      resultado = await p.obtenerListado(pedido.referencia);
    }
    if (!resultado) throw new Error("listado inexistente");
    return resultado;
  }

  /** Envía, deja que se publique y que Alianza firme; devuelve lo que quedó en firmados. */
  async function enviarYEsperarFirma(
    p: IntercambioAseguradora,
    solicitud: SolicitudEnvioDocumento,
  ): Promise<ArchivoRemoto> {
    const envio = await p.enviarDocumento(solicitud);
    if (!envio.ok) throw new Error(`envío rechazado: ${envio.motivo}`);
    await escenarios.resolverPendientes();
    expect((await p.consultarTransferencia(envio.referencia))?.estado).toBe("COMPLETADA");
    await escenarios.resolverPendientes();

    const listado = await listar(p, "DOCUMENTOS_FIRMADOS");
    if (listado.estado !== "COMPLETADO") throw new Error("listado no completado");
    const firmado = listado.archivos.find((a) => a.nombre === envio.nombreRemoto);
    if (!firmado) throw new Error(`no apareció ${envio.nombreRemoto} en firmados`);
    return firmado;
  }

  async function recibir(p: IntercambioAseguradora, archivo: ArchivoRemoto) {
    const pedido = await p.solicitarRecepcion("DOCUMENTOS_FIRMADOS", archivo);
    if (!pedido.ok) throw new Error(`recepción no pedida: ${pedido.motivo}`);
    let recibido = await p.obtenerRecibido(pedido.referencia);
    for (let vuelta = 0; vuelta < 3 && recibido?.estado === "EN_CURSO"; vuelta += 1) {
      await escenarios.resolverPendientes();
      recibido = await p.obtenerRecibido(pedido.referencia);
    }
    return { referencia: pedido.referencia, recibido };
  }

  describe("IntercambioAseguradora (contrato)", () => {
    let espias: MockInstance[] = [];

    beforeEach(() => {
      espias = (["log", "info", "warn", "error", "debug"] as const).map((metodo) =>
        vi.spyOn(console, metodo).mockImplementation(() => undefined),
      );
    });

    afterEach(() => {
      // Regla #7: ningún camino del adaptador escribe en consola.
      for (const espia of espias) {
        expect(espia).not.toHaveBeenCalled();
        espia.mockRestore();
      }
    });

    it("un envío arranca en curso y se completa al publicarse", async () => {
      const p = await proveedor();
      const envio = await p.enviarDocumento(solicitudDePrueba());
      expect(envio.ok).toBe(true);
      if (!envio.ok) return;
      expect(envio.duplicado).toBe(false);
      expect(envio.nombreRemoto).toBe("CPC-00018425-v1.pdf");

      const antes = await p.consultarTransferencia(envio.referencia);
      expect(antes?.estado).toBe("EN_CURSO");
      expect(antes?.direccion).toBe("ENVIO");

      await escenarios.resolverPendientes();
      const despues = await p.consultarTransferencia(envio.referencia);
      expect(despues?.estado).toBe("COMPLETADA");
      expect(despues?.eventos.map((e) => e.tipo)).toEqual(["SOLICITADA", "TRANSFERIDA", "PUBLICADA"]);
    });

    it("los eventos solo crecen: una consulta posterior empieza con los de una anterior", async () => {
      const p = await proveedor();
      const envio = await p.enviarDocumento(solicitudDePrueba({ bytes: pdfDePrueba("append-only") }));
      if (!envio.ok) throw new Error("envío rechazado");
      const primera = (await p.consultarTransferencia(envio.referencia))?.eventos ?? [];
      await escenarios.resolverPendientes();
      const segunda = (await p.consultarTransferencia(envio.referencia))?.eventos ?? [];
      expect(segunda.length).toBeGreaterThan(primera.length);
      expect(segunda.slice(0, primera.length)).toEqual(primera);
    });

    it("la misma huella es el mismo envío; otra versión es otro", async () => {
      const p = await proveedor();
      const solicitud = solicitudDePrueba({ bytes: pdfDePrueba("idempotente") });
      const a = await p.enviarDocumento(solicitud);
      const b = await p.enviarDocumento(solicitud);
      expect(a.ok && b.ok).toBe(true);
      if (!a.ok || !b.ok) return;
      expect(b.referencia).toBe(a.referencia);
      expect(b.duplicado).toBe(true);

      const otra = await p.enviarDocumento(solicitudDePrueba({ bytes: pdfDePrueba("idempotente-v2"), version: 2 }));
      expect(otra.ok).toBe(true);
      if (!otra.ok) return;
      expect(otra.referencia).not.toBe(a.referencia);
      expect(otra.nombreRemoto).toBe("CPC-00018425-v2.pdf");
    });

    it("no manda un tipo que no está en la lista configurada", async () => {
      const p = await proveedor();
      const resultado = await p.enviarDocumento(
        solicitudDePrueba({ tipo: "PROP", codigo: "PROP-00018425", bytes: pdfDePrueba("prop") }),
      );
      expect(resultado).toMatchObject({ ok: false, motivo: "TIPO_NO_HABILITADO" });
    });

    it("no manda bytes cuya huella no es la declarada", async () => {
      const p = await proveedor();
      const resultado = await p.enviarDocumento(solicitudDePrueba({ hashSha256: "f".repeat(64) }));
      expect(resultado).toMatchObject({ ok: false, motivo: "HUELLA_NO_COINCIDE" });
    });

    it("no manda un documento cuyo código no corresponde a su tipo y correlativo", async () => {
      const p = await proveedor();
      expect(await p.enviarDocumento(solicitudDePrueba({ codigo: "CPC-Perez-Gomez" }))).toMatchObject({
        ok: false,
        motivo: "CODIGO_NO_CORRESPONDE_AL_TIPO",
      });
      expect(await p.enviarDocumento(solicitudDePrueba({ correlativo: "00000001" }))).toMatchObject({
        ok: false,
        motivo: "CORRELATIVO_NO_CORRESPONDE",
      });
    });

    /**
     * La propiedad de la que depende el lote de firma: Alianza devuelve el
     * mismo PDF con una revisión agregada, y lo enviado es su prefijo exacto.
     */
    it("lo firmado que devuelve la aseguradora contiene lo enviado como prefijo", async () => {
      const p = await proveedor();
      const solicitud = solicitudDePrueba({ bytes: pdfDePrueba("firma") });
      const firmado = await enviarYEsperarFirma(p, solicitud);
      const { recibido } = await recibir(p, firmado);

      expect(recibido?.estado).toBe("COMPLETADA");
      if (recibido?.estado !== "COMPLETADA") return;
      expect(recibido.bytes.length).toBeGreaterThan(solicitud.bytes.length);
      expect(sha256(recibido.bytes.subarray(0, solicitud.bytes.length))).toBe(solicitud.hashSha256);
      expect(recibido.hashSha256).toBe(sha256(recibido.bytes));
      const cola = new TextDecoder("latin1").decode(recibido.bytes.subarray(solicitud.bytes.length));
      expect(cola).toMatch(/\/Type \/Sig/);
      expect(cola.trimEnd().endsWith("%%EOF")).toBe(true);
    });

    it("pedir dos veces la misma entrada del listado es la misma recepción", async () => {
      const p = await proveedor();
      const firmado = await enviarYEsperarFirma(p, solicitudDePrueba({ bytes: pdfDePrueba("recepcion-doble") }));
      const a = await p.solicitarRecepcion("DOCUMENTOS_FIRMADOS", firmado);
      const b = await p.solicitarRecepcion("DOCUMENTOS_FIRMADOS", firmado);
      expect(a.ok && b.ok).toBe(true);
      if (!a.ok || !b.ok) return;
      expect(b.referencia).toBe(a.referencia);
      expect(b.duplicado).toBe(true);
    });

    it("lo archivado deja de listarse y archivar dos veces no falla", async () => {
      const p = await proveedor();
      const firmado = await enviarYEsperarFirma(p, solicitudDePrueba({ bytes: pdfDePrueba("archivar") }));
      const { referencia, recibido } = await recibir(p, firmado);
      expect(recibido?.estado).toBe("COMPLETADA");

      expect(await p.archivarRecibido(referencia)).toEqual({ ok: true });
      expect(await p.archivarRecibido(referencia)).toEqual({ ok: true });
      await escenarios.resolverPendientes();

      const listado = await listar(p, "DOCUMENTOS_FIRMADOS");
      expect(listado.estado).toBe("COMPLETADO");
      if (listado.estado !== "COMPLETADO") return;
      expect(listado.archivos.map((a) => a.nombre)).not.toContain(firmado.nombre);
      expect((await p.consultarTransferencia(referencia))?.eventos.at(-1)?.tipo).toBe("ARCHIVADA");
    });

    it("no archiva lo que no es una recepción completada", async () => {
      const p = await proveedor();
      expect(await p.archivarRecibido("rec-inexistente")).toMatchObject({ ok: false, motivo: "NO_ENCONTRADA" });
    });

    it("la carpeta de respuestas se lista aunque esté vacía", async () => {
      const p = await proveedor();
      const listado = await listar(p, "RESPUESTAS");
      expect(listado.estado).toBe("COMPLETADO");
    });

    it("rechaza nombres remotos que podrían escapar de la carpeta", async () => {
      const p = await proveedor();
      for (const nombre of ["../../etc/passwd", "sub/archivo.pdf", "CPC-1.pdf.tmp"]) {
        expect(
          await p.solicitarRecepcion("DOCUMENTOS_FIRMADOS", { nombre, tamanoBytes: 1, modificadoEn: null }),
        ).toMatchObject({ ok: false, motivo: "NOMBRE_INVALIDO" });
      }
    });

    it("referencias que no existen se distinguen de una falla", async () => {
      const p = await proveedor();
      expect(await p.consultarTransferencia("env-no-existe-1")).toBeNull();
      expect(await p.obtenerListado("lst-no-existe")).toBeNull();
      expect(await p.obtenerRecibido("rec-no-existe-1")).toBeNull();
    });
  });
}
