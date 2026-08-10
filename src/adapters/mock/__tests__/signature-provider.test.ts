/**
 * Tests del adaptador mock de `SignatureProvider` (Code100, P8).
 *
 * Además de la suite de contrato del puerto, acá está el test que la interfaz
 * no puede expresar: **una falla a mitad del sellado no deja ningún documento
 * firmado** (regla de negocio inviolable #3). `ResultadoFirma` hace imposible
 * *representar* una firma parcial; lo que se verifica acá es que la
 * implementación tampoco la *produce* internamente — que no hay un instante en
 * el que la Solicitud tenga huella firmada y el FIPF no.
 *
 * También se cubre el tercer OTP del flujo (regla inviolable #1 y #2): 6
 * dígitos, uso único, 5 minutos, 3 intentos, y nunca expuesto por el puerto.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runSignatureProviderContractTests } from "../../../ports/__tests__/signature-provider.contract";
import { INTENTOS_MAXIMOS_OTP, LONGITUD_CODIGO_OTP, VIGENCIA_OTP_MS } from "../../../domain/reglas-otp";
import type { PaqueteDocumental } from "../../../domain/tipos";
import { ErrorCode100 } from "../../../ports/signature-provider";
import type { SignatureProvider } from "../../../ports/signature-provider";
import {
  VIGENCIA_ENLACE_FIRMA_MS,
  abrirEnlaceDeFirmaMock,
  cerrarSinFirmarMock,
  crearSignatureProviderMock,
  firmarEnCode100Mock,
  limpiarSesionesFirmaMock,
  obtenerCodigoFirmaDemo,
  obtenerSesionFirmaMock,
} from "../signature-provider";

const PAQUETE: PaqueteDocumental = {
  solicitud: {
    codigo: "PROP-00018425",
    version: 1,
    hashSha256: "a".repeat(64),
    cerradoEn: "2026-08-09T15:02:00.000Z",
  },
  fipf: {
    codigo: "FIPF-00018425",
    version: 1,
    hashSha256: "b".repeat(64),
    cerradoEn: "2026-08-09T15:02:00.000Z",
  },
};

const ENTRADA = {
  expedienteId: "EXP-P8-1",
  canal: "WHATSAPP" as const,
  destino: "+595981000456",
  paqueteDocumental: PAQUETE,
};

/** Sin demora de red y reteniendo el código, como si `DEMO_MODE` estuviera on. */
function crearProveedor(ahora?: () => Date): SignatureProvider {
  return crearSignatureProviderMock({ demoraEnvioEnlaceMs: 0, ...(ahora ? { ahora } : {}) });
}

/** Abre el enlace, lee el código del canal de demo y firma. */
function completar(idCode100: string, opciones: { fallarAMitadDelSellado?: boolean } = {}) {
  const apertura = abrirEnlaceDeFirmaMock(idCode100, { retenerCodigoParaPanelDemo: true });
  expect(apertura.ok).toBe(true);
  const codigo = obtenerCodigoFirmaDemo(idCode100)?.codigo;
  if (!codigo) throw new Error("El panel de demo no retuvo el código de firma.");
  return firmarEnCode100Mock(idCode100, codigo, opciones);
}

beforeEach(() => {
  limpiarSesionesFirmaMock();
});

afterEach(() => {
  limpiarSesionesFirmaMock();
});

runSignatureProviderContractTests({
  crearProveedor: () => crearProveedor(),
  completarActoDeFirma: async (_proveedor, idCode100) => {
    const resultado = completar(idCode100);
    expect(resultado.ok).toBe(true);
  },
});

describe("MockSignatureProvider · un solo acto para los dos documentos", () => {
  it("abre UNA sesión con la Solicitud y el FIPF adentro (fila 36 de la matriz)", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    const sesion = obtenerSesionFirmaMock(iniciada.idCode100);
    expect(sesion?.paquete.solicitud.codigo).toBe("PROP-00018425");
    expect(sesion?.paquete.fipf.codigo).toBe("FIPF-00018425");
  });

  it("firmar sella las dos huellas juntas y son distintas de las del PDF sin firmar", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    const resultado = completar(iniciada.idCode100);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.firma.hashSolicitudFirmada).not.toBe(PAQUETE.solicitud.hashSha256);
    expect(resultado.firma.hashFipfFirmado).not.toBe(PAQUETE.fipf.hashSha256);
    expect(resultado.firma.hashSolicitudFirmada).not.toBe(resultado.firma.hashFipfFirmado);
  });

  /**
   * El test que pide la regla inviolable #3: se corta el sellado con la primera
   * huella ya calculada y la segunda no. Lo que tiene que quedar es **nada**.
   */
  it("una falla a mitad del sellado no deja NINGÚN documento firmado", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    const resultado = completar(iniciada.idCode100, { fallarAMitadDelSellado: true });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("FALLA_DEL_PROVEEDOR");

    // Ni la Solicitud ni el FIPF: la sesión no tiene firma en absoluto.
    const sesion = obtenerSesionFirmaMock(iniciada.idCode100);
    expect(sesion?.firma).toBeNull();

    // Y los documentos siguen con su huella original, sin firmar.
    expect(sesion?.paquete.solicitud.hashSha256).toBe(PAQUETE.solicitud.hashSha256);
    expect(sesion?.paquete.fipf.hashSha256).toBe(PAQUETE.fipf.hashSha256);

    // El puerto tampoco reporta nada firmado.
    const consulta = await proveedor.confirmarResultado(iniciada.idCode100);
    expect(consulta.estado).toBe("PENDIENTE");
    expect(JSON.stringify(consulta)).not.toContain("hashSolicitudFirmada");
  });

  it("después de una falla a mitad, el mismo acto se puede completar entero", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    const fallido = completar(iniciada.idCode100, { fallarAMitadDelSellado: true });
    expect(fallido.ok).toBe(false);

    // El OTP no se consumió con el intento fallido: el mismo código sirve.
    const codigo = obtenerCodigoFirmaDemo(iniciada.idCode100)?.codigo ?? "";
    const reintento = firmarEnCode100Mock(iniciada.idCode100, codigo);

    expect(reintento.ok).toBe(true);
    if (!reintento.ok) return;
    expect(reintento.firma.hashSolicitudFirmada.length).toBe(64);
    expect(reintento.firma.hashFipfFirmado.length).toBe(64);
  });

  it("rechaza un paquete con un documento sin huella (regla inviolable #4)", async () => {
    const proveedor = crearProveedor();

    await expect(
      proveedor.iniciarFirma({
        ...ENTRADA,
        paqueteDocumental: {
          ...PAQUETE,
          fipf: { ...PAQUETE.fipf, hashSha256: "" },
        },
      }),
    ).rejects.toBeInstanceOf(ErrorCode100);
  });

  it("rechaza un paquete cuyos documentos tienen versiones distintas", async () => {
    const proveedor = crearProveedor();

    await expect(
      proveedor.iniciarFirma({
        ...ENTRADA,
        paqueteDocumental: { ...PAQUETE, fipf: { ...PAQUETE.fipf, version: 2 } },
      }),
    ).rejects.toBeInstanceOf(ErrorCode100);
  });
});

describe("MockSignatureProvider · el tercer OTP del flujo", () => {
  it("el código se emite al abrir el enlace, con 6 dígitos y 5 minutos de vigencia", async () => {
    const instante = new Date("2026-08-09T15:10:00.000Z");
    const proveedor = crearProveedor(() => instante);
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    // Todavía no se abrió: no hay código.
    expect(obtenerCodigoFirmaDemo(iniciada.idCode100)).toBeNull();

    const apertura = abrirEnlaceDeFirmaMock(iniciada.idCode100, {
      ahora: () => instante,
      retenerCodigoParaPanelDemo: true,
    });

    expect(apertura.ok).toBe(true);
    if (!apertura.ok) return;
    expect(new Date(apertura.expiraEn).getTime() - instante.getTime()).toBe(VIGENCIA_OTP_MS);

    const codigo = obtenerCodigoFirmaDemo(iniciada.idCode100)?.codigo ?? "";
    expect(codigo).toMatch(new RegExp(`^\\d{${LONGITUD_CODIGO_OTP}}$`));
  });

  it("nunca sale por el puerto ni queda en claro en la sesión (regla inviolable #2)", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    abrirEnlaceDeFirmaMock(iniciada.idCode100, { retenerCodigoParaPanelDemo: true });

    const codigo = obtenerCodigoFirmaDemo(iniciada.idCode100)?.codigo ?? "";
    expect(codigo).not.toBe("");

    // Ni en lo que devuelve el puerto…
    expect(JSON.stringify(iniciada)).not.toContain(codigo);
    expect(JSON.stringify(await proveedor.confirmarResultado(iniciada.idCode100))).not.toContain(codigo);

    // …ni en el estado interno de la sesión, que solo guarda el HMAC.
    const sesion = obtenerSesionFirmaMock(iniciada.idCode100);
    expect(JSON.stringify(sesion)).not.toContain(codigo);
    expect(sesion?.otp?.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("con DEMO_MODE apagado no se retiene el código ni para el panel", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    abrirEnlaceDeFirmaMock(iniciada.idCode100, { retenerCodigoParaPanelDemo: false });

    expect(obtenerCodigoFirmaDemo(iniciada.idCode100)).toBeNull();
  });

  it("es de uso único: el mismo código no vuelve a firmar", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    const codigo = (() => {
      abrirEnlaceDeFirmaMock(iniciada.idCode100, { retenerCodigoParaPanelDemo: true });
      return obtenerCodigoFirmaDemo(iniciada.idCode100)?.codigo ?? "";
    })();

    expect(firmarEnCode100Mock(iniciada.idCode100, codigo).ok).toBe(true);

    const segundo = firmarEnCode100Mock(iniciada.idCode100, codigo);
    expect(segundo.ok).toBe(false);
    if (segundo.ok) return;
    expect(segundo.motivo).toBe("YA_CERRADA");
  });

  it("admite 3 intentos y después se agota", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    abrirEnlaceDeFirmaMock(iniciada.idCode100, { retenerCodigoParaPanelDemo: true });
    const correcto = obtenerCodigoFirmaDemo(iniciada.idCode100)?.codigo ?? "";
    const incorrecto = correcto === "000000" ? "111111" : "000000";

    for (let intento = 1; intento < INTENTOS_MAXIMOS_OTP; intento += 1) {
      const fallido = firmarEnCode100Mock(iniciada.idCode100, incorrecto);
      expect(fallido.ok).toBe(false);
      if (fallido.ok) return;
      expect(fallido.motivo).toBe("CODIGO_INCORRECTO");
    }

    const ultimo = firmarEnCode100Mock(iniciada.idCode100, incorrecto);
    expect(ultimo.ok).toBe(false);
    if (ultimo.ok) return;
    expect(ultimo.motivo).toBe("INTENTOS_AGOTADOS");

    // Ni siquiera con el código correcto: los intentos ya se acabaron.
    const conCorrecto = firmarEnCode100Mock(iniciada.idCode100, correcto);
    expect(conCorrecto.ok).toBe(false);
  });

  it("un código vencido no firma", async () => {
    const emision = new Date("2026-08-09T15:00:00.000Z");
    const proveedor = crearProveedor(() => emision);
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    abrirEnlaceDeFirmaMock(iniciada.idCode100, {
      ahora: () => emision,
      retenerCodigoParaPanelDemo: true,
    });
    const codigo = obtenerCodigoFirmaDemo(iniciada.idCode100)?.codigo ?? "";

    const tarde = new Date(emision.getTime() + VIGENCIA_OTP_MS + 1_000);
    const resultado = firmarEnCode100Mock(iniciada.idCode100, codigo, { ahora: () => tarde });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("OTP_EXPIRADO");
  });
});

describe("MockSignatureProvider · vigencia del enlace y cierres", () => {
  it("el enlace vive 24 horas por defecto (fila 41 de la matriz)", async () => {
    const instante = new Date("2026-08-09T15:00:00.000Z");
    const proveedor = crearProveedor(() => instante);

    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    expect(new Date(iniciada.venceEn).getTime() - instante.getTime()).toBe(VIGENCIA_ENLACE_FIRMA_MS);
  });

  it("pasadas las 24 horas el acto queda EXPIRADA y sin ninguna huella firmada", async () => {
    let reloj = new Date("2026-08-09T15:00:00.000Z");
    const proveedor = crearProveedor(() => reloj);
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    reloj = new Date(reloj.getTime() + VIGENCIA_ENLACE_FIRMA_MS + 1_000);
    const resultado = await proveedor.confirmarResultado(iniciada.idCode100);

    expect(resultado.estado).toBe("NO_FIRMADO");
    if (resultado.estado !== "NO_FIRMADO") return;
    expect(resultado.motivo).toBe("EXPIRADA");
    expect(obtenerSesionFirmaMock(iniciada.idCode100)?.firma).toBeNull();
  });

  it("rechazar cierra el acto sin firmar nada", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    expect(cerrarSinFirmarMock(iniciada.idCode100)).toBe(true);

    const resultado = await proveedor.confirmarResultado(iniciada.idCode100);
    expect(resultado.estado).toBe("NO_FIRMADO");
    if (resultado.estado !== "NO_FIRMADO") return;
    expect(resultado.motivo).toBe("RECHAZADA");
    expect(obtenerSesionFirmaMock(iniciada.idCode100)?.firma).toBeNull();
  });

  it("una falla forzada al abrir el acto no crea ninguna sesión", async () => {
    const proveedor = crearSignatureProviderMock({
      demoraEnvioEnlaceMs: 0,
      fallaForzada: () => "TIMEOUT",
    });

    await expect(proveedor.iniciarFirma(ENTRADA)).rejects.toBeInstanceOf(ErrorCode100);
  });
});
