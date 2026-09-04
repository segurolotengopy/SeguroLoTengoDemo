/**
 * La constancia del acto de firma del cliente (D-27): se cierra, se hashea,
 * se guarda con su huella en la clave, y es determinista — mismo acto, mismos
 * bytes —, porque su huella es lo que la verificación pública publica.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  VERSION_INICIAL_CONSTANCIA,
  armarContenidoConstancia,
  codigoConstancia,
} from "../../domain/constancia-firma";
import type { ActoDeFirmaCliente } from "../../domain/firma-cliente";
import { codigoSolicitud } from "../../domain/documentos";
import {
  NUMERO_PROPUESTA_FIJO,
  expedienteEnPaqueteGenerado,
} from "../../domain/__tests__/fixtures";
import { claveConstancia, emitirConstanciaFirma } from "../servicio";
import type { RepositorioArchivos } from "../servicio";

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

function acto(expedienteId: string): ActoDeFirmaCliente {
  const paquete = expedienteEnPaqueteGenerado().paqueteDocumental!;
  return {
    expedienteId,
    canal: "WHATSAPP",
    destinoEnmascarado: "+5959•••••456",
    otpId: "OTP-FIRMA-TEST-1",
    firmadoEn: "2026-08-09T15:03:00.000Z",
    codigoDocumento: paquete.codigo,
    codigoFipf: paquete.codigoSeccionFipf,
    versionDocumento: paquete.version,
    hashDocumento: paquete.hashSha256,
    textoAceptado: "Declaro haber revisado la Solicitud y el FIPF y solicito firmarlos.",
    versionTextoAceptado: "PAGO-FIRMA-ACEPTACION-v1",
    ip: "200.10.20.30",
    dispositivo: "Mozilla/5.0 (test)",
    sesionId: "sesion-firma",
  };
}

describe("emisión de la constancia del acto de firma", () => {
  it("cierra el PDF, lo guarda con su huella en la clave y registra la huella real", async () => {
    const archivos = repositorioArchivos();
    const expediente = expedienteEnPaqueteGenerado();
    const resultado = await emitirConstanciaFirma(
      { archivos },
      { expediente, acto: acto(expediente.id), historial: [] },
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const codigo = codigoConstancia(NUMERO_PROPUESTA_FIJO);
    const clave = claveConstancia(
      expediente.id,
      codigo,
      VERSION_INICIAL_CONSTANCIA,
      resultado.constancia.hashSha256,
    );
    expect(resultado.clave).toBe(clave);
    expect(resultado.constancia.codigo).toBe(codigo);
    expect(resultado.constancia.codigoPaquete).toBe(codigoSolicitud(NUMERO_PROPUESTA_FIJO));
    expect(resultado.constancia.emitidaEn).toBe("2026-08-09T15:03:00.000Z");

    const guardado = archivos.archivos.get(clave);
    expect(guardado).toBeDefined();
    expect(createHash("sha256").update(guardado!).digest("hex")).toBe(
      resultado.constancia.hashSha256,
    );
    // Es un PDF de verdad, con el código impreso en su encabezado.
    expect(Buffer.from(guardado!.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
  });

  it("es determinista: el mismo acto produce los mismos bytes", async () => {
    const expediente = expedienteEnPaqueteGenerado();
    const a = await emitirConstanciaFirma(
      { archivos: repositorioArchivos() },
      { expediente, acto: acto(expediente.id), historial: [] },
    );
    const b = await emitirConstanciaFirma(
      { archivos: repositorioArchivos() },
      { expediente, acto: acto(expediente.id), historial: [] },
    );
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.constancia.hashSha256).toBe(b.constancia.hashSha256);
  });

  it("si el repositorio guardó otra cosa, no registra la constancia", async () => {
    const expediente = expedienteEnPaqueteGenerado();
    const archivosCorruptos: RepositorioArchivos = {
      async guardarArchivo(clave) {
        return { clave, hashSha256: "0".repeat(64) };
      },
    };
    const resultado = await emitirConstanciaFirma(
      { archivos: archivosCorruptos },
      { expediente, acto: acto(expediente.id), historial: [] },
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("ALMACENAMIENTO_INCONSISTENTE");
  });

  it("sin identidad o sin paquete no hay nada que constatar", () => {
    const expediente = expedienteEnPaqueteGenerado();
    const sinIdentidad = { ...expediente, identidad: null };
    const resultado = armarContenidoConstancia(
      sinIdentidad,
      {
        firmadoEn: "2026-08-09T15:03:00.000Z",
        referenciaActo: "OTP-1",
        canal: "WHATSAPP",
        destinoEnmascarado: null,
        ip: null,
        dispositivo: null,
        sesionId: null,
        versionTextoAceptado: null,
      },
      [],
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.faltantes).toContain("identidad");
  });

  it("el contenido cita la norma, el canal y la huella del documento firmado", () => {
    const expediente = expedienteEnPaqueteGenerado();
    const a = acto(expediente.id);
    const resultado = armarContenidoConstancia(
      expediente,
      {
        firmadoEn: a.firmadoEn,
        referenciaActo: a.otpId,
        canal: a.canal,
        destinoEnmascarado: a.destinoEnmascarado,
        ip: a.ip,
        dispositivo: a.dispositivo,
        sesionId: a.sesionId,
        versionTextoAceptado: a.versionTextoAceptado,
      },
      [],
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const { contenido } = resultado;
    expect(contenido.encabezado.codigo).toBe(codigoConstancia(NUMERO_PROPUESTA_FIJO));
    expect(contenido.encabezado.urlVerificacion).toContain(codigoConstancia(NUMERO_PROPUESTA_FIJO));
    expect(contenido.naturaleza.map((c) => c.valor).join(" ")).toContain("210/2025");
    // La huella del documento vive en su pilar («Qué firmaste»), a fila entera.
    const integridad = contenido.pilares[1]!.hechos.map((h) => h.valor);
    expect(integridad).toContain(expediente.paqueteDocumental!.hashSha256);
    // Los instantes van formateados en el PDF, no en ISO crudo.
    const todosLosValores = contenido.pilares.flatMap((p) => p.hechos.map((h) => h.valor));
    expect(todosLosValores.some((v) => /^\d{4}-\d{2}-\d{2}T/.test(v))).toBe(false);
    expect(todosLosValores).toContain("09/08/2026 15:03 UTC");
    expect(contenido.pilares.map((p) => p.titulo)).toEqual([
      "Quién firmó",
      "Qué firmaste",
      "Desde dónde y cuándo",
    ]);
    const todos = contenido.pilares.flatMap((p) => p.hechos.map((h) => h.valor)).join(" ");
    expect(todos).toContain("200.10.20.30");
    expect(todos).not.toContain(a.textoAceptado);
  });
});
