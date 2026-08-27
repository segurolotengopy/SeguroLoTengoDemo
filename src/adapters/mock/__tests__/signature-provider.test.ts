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
import type { OtpFirmaRemoto } from "../signature-provider";
import {
  VIGENCIA_ENLACE_FIRMA_MS,
  abrirEnlaceDeFirmaMock,
  cerrarSinFirmarMock,
  configurarAlmacenFirmaDemo,
  crearSignatureProviderMock,
  firmarEnCode100Mock,
  limpiarSesionesFirmaMock,
  obtenerCodigoFirmaDemo,
  obtenerSesionFirmaMock,
} from "../signature-provider";

const PAQUETE: PaqueteDocumental = {
  codigo: "PROP-00018425",
  codigoSeccionFipf: "FIPF-00018425",
  version: 1,
  hashSha256: "a".repeat(64),
  cerradoEn: "2026-08-09T15:02:00.000Z",
  tokenVerificacion: `00018425-${"1".repeat(32)}`,
};

const ENTRADA = {
  expedienteId: "EXP-P8-1",
  canal: "WHATSAPP" as const,
  destino: "+595981000456",
  documento: PAQUETE,
};

/** Sin demora de red y reteniendo el código, como si `DEMO_MODE` estuviera on. */
function crearProveedor(ahora?: () => Date): SignatureProvider {
  return crearSignatureProviderMock({ demoraEnvioEnlaceMs: 0, ...(ahora ? { ahora } : {}) });
}

/** Abre el enlace, lee el código del canal de demo y firma. */
async function completar(idCode100: string, opciones: { ahora?: () => Date } = {}) {
  const apertura = await abrirEnlaceDeFirmaMock(idCode100, { retenerCodigoParaPanelDemo: true });
  expect(apertura.ok).toBe(true);
  const codigo = (await obtenerCodigoFirmaDemo(idCode100))?.codigo;
  if (!codigo) throw new Error("El panel de demo no retuvo el código de firma.");
  return await firmarEnCode100Mock(idCode100, codigo, opciones);
}

beforeEach(async () => {
  await limpiarSesionesFirmaMock();
});

afterEach(async () => {
  await limpiarSesionesFirmaMock();
});

runSignatureProviderContractTests({
  crearProveedor: () => crearProveedor(),
  completarActoDeFirma: async (_proveedor, idCode100) => {
    const resultado = await completar(idCode100);
    expect(resultado.ok).toBe(true);
  },
});

describe("MockSignatureProvider · un solo acto sobre un solo documento", () => {
  it("abre UNA sesión con el documento adentro (fila 36 de la matriz)", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    const sesion = await obtenerSesionFirmaMock(iniciada.idCode100);
    expect(sesion?.documento.codigo).toBe("PROP-00018425");
    // La sección FIPF viaja adentro del mismo documento (D-11).
    expect(sesion?.documento.codigoSeccionFipf).toBe("FIPF-00018425");
  });

  it("firmar produce una huella distinta de la del PDF sin firmar", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    const resultado = await completar(iniciada.idCode100);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.firma.hashDocumentoFirmado).toHaveLength(64);
    expect(resultado.firma.hashDocumentoFirmado).not.toBe(PAQUETE.hashSha256);
  });

  /**
   * El test que antes pedía la regla inviolable #3 —cortar el sellado a mitad
   * y verificar que no quedara ningún documento firmado— **desapareció con el
   * problema que probaba**. Con el documento único (D-11) no existe la
   * operación que podría dejar uno firmado y el otro no: hay un archivo y una
   * huella. Lo que queda por fijar es lo contrario: que el tipo no tenga
   * siquiera cómo representar una firma parcial.
   */
  it("no existe forma de representar una firma parcial", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    const resultado = await completar(iniciada.idCode100);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    // Una sola huella firmada, y ningún campo por documento que pueda faltar.
    const claves = Object.keys(resultado.firma).sort();
    expect(claves).toEqual(["canal", "firmadoEn", "hashDocumentoFirmado", "idCode100"]);
  });

  it("rechaza un documento sin huella (regla inviolable #4)", async () => {
    const proveedor = crearProveedor();

    await expect(
      proveedor.iniciarFirma({ ...ENTRADA, documento: { ...PAQUETE, hashSha256: "" } }),
    ).rejects.toBeInstanceOf(ErrorCode100);
  });
});

describe("MockSignatureProvider · el tercer OTP del flujo", () => {
  it("el código se emite al abrir el enlace, con 6 dígitos y 5 minutos de vigencia", async () => {
    const instante = new Date("2026-08-09T15:10:00.000Z");
    const proveedor = crearProveedor(() => instante);
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    // Todavía no se abrió: no hay código.
    expect(await obtenerCodigoFirmaDemo(iniciada.idCode100)).toBeNull();

    const apertura = await abrirEnlaceDeFirmaMock(iniciada.idCode100, {
      ahora: () => instante,
      retenerCodigoParaPanelDemo: true,
    });

    expect(apertura.ok).toBe(true);
    if (!apertura.ok) return;
    expect(new Date(apertura.expiraEn).getTime() - instante.getTime()).toBe(VIGENCIA_OTP_MS);

    const codigo = (await obtenerCodigoFirmaDemo(iniciada.idCode100))?.codigo ?? "";
    expect(codigo).toMatch(new RegExp(`^\\d{${LONGITUD_CODIGO_OTP}}$`));
  });

  it("nunca sale por el puerto ni queda en claro en la sesión (regla inviolable #2)", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    await abrirEnlaceDeFirmaMock(iniciada.idCode100, { retenerCodigoParaPanelDemo: true });

    const codigo = (await obtenerCodigoFirmaDemo(iniciada.idCode100))?.codigo ?? "";
    expect(codigo).not.toBe("");

    // Ni en lo que devuelve el puerto…
    expect(JSON.stringify(iniciada)).not.toContain(codigo);
    expect(JSON.stringify(await proveedor.confirmarResultado(iniciada.idCode100))).not.toContain(codigo);

    // …ni en el estado interno de la sesión, que solo guarda el HMAC.
    const sesion = await obtenerSesionFirmaMock(iniciada.idCode100);
    expect(JSON.stringify(sesion)).not.toContain(codigo);
    expect(sesion?.otp?.tipo).toBe("LOCAL");
    expect(sesion?.otp?.tipo === "LOCAL" ? sesion.otp.hash : "").toMatch(/^[0-9a-f]{64}$/);
  });

  it("con DEMO_MODE apagado no se retiene el código ni para el panel", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    await abrirEnlaceDeFirmaMock(iniciada.idCode100, { retenerCodigoParaPanelDemo: false });

    expect(await obtenerCodigoFirmaDemo(iniciada.idCode100)).toBeNull();
  });

  it("es de uso único: el mismo código no vuelve a firmar", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    const codigo = await (async () => {
      await abrirEnlaceDeFirmaMock(iniciada.idCode100, { retenerCodigoParaPanelDemo: true });
      return (await obtenerCodigoFirmaDemo(iniciada.idCode100))?.codigo ?? "";
    })();

    expect((await firmarEnCode100Mock(iniciada.idCode100, codigo)).ok).toBe(true);

    const segundo = await firmarEnCode100Mock(iniciada.idCode100, codigo);
    expect(segundo.ok).toBe(false);
    if (segundo.ok) return;
    expect(segundo.motivo).toBe("YA_CERRADA");
  });

  it("admite 3 intentos y después se agota", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    await abrirEnlaceDeFirmaMock(iniciada.idCode100, { retenerCodigoParaPanelDemo: true });
    const correcto = (await obtenerCodigoFirmaDemo(iniciada.idCode100))?.codigo ?? "";
    const incorrecto = correcto === "000000" ? "111111" : "000000";

    for (let intento = 1; intento < INTENTOS_MAXIMOS_OTP; intento += 1) {
      const fallido = await firmarEnCode100Mock(iniciada.idCode100, incorrecto);
      expect(fallido.ok).toBe(false);
      if (fallido.ok) return;
      expect(fallido.motivo).toBe("CODIGO_INCORRECTO");
    }

    const ultimo = await firmarEnCode100Mock(iniciada.idCode100, incorrecto);
    expect(ultimo.ok).toBe(false);
    if (ultimo.ok) return;
    expect(ultimo.motivo).toBe("INTENTOS_AGOTADOS");

    // Ni siquiera con el código correcto: los intentos ya se acabaron.
    const conCorrecto = await firmarEnCode100Mock(iniciada.idCode100, correcto);
    expect(conCorrecto.ok).toBe(false);
  });

  it("un código vencido no firma", async () => {
    const emision = new Date("2026-08-09T15:00:00.000Z");
    const proveedor = crearProveedor(() => emision);
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    await abrirEnlaceDeFirmaMock(iniciada.idCode100, {
      ahora: () => emision,
      retenerCodigoParaPanelDemo: true,
    });
    const codigo = (await obtenerCodigoFirmaDemo(iniciada.idCode100))?.codigo ?? "";

    const tarde = new Date(emision.getTime() + VIGENCIA_OTP_MS + 1_000);
    const resultado = await firmarEnCode100Mock(iniciada.idCode100, codigo, { ahora: () => tarde });

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
    expect((await obtenerSesionFirmaMock(iniciada.idCode100))?.firma).toBeNull();
  });

  it("rechazar cierra el acto sin firmar nada", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);

    expect(await cerrarSinFirmarMock(iniciada.idCode100)).toBe(true);

    const resultado = await proveedor.confirmarResultado(iniciada.idCode100);
    expect(resultado.estado).toBe("NO_FIRMADO");
    if (resultado.estado !== "NO_FIRMADO") return;
    expect(resultado.motivo).toBe("RECHAZADA");
    expect((await obtenerSesionFirmaMock(iniciada.idCode100))?.firma).toBeNull();
  });

  it("una falla forzada al abrir el acto no crea ninguna sesión", async () => {
    const proveedor = crearSignatureProviderMock({
      demoraEnvioEnlaceMs: 0,
      fallaForzada: () => "TIMEOUT",
    });

    await expect(proveedor.iniciarFirma(ENTRADA)).rejects.toBeInstanceOf(ErrorCode100);
  });
});

describe("OTP de firma por canal remoto (WhatsApp-Modular, INTEGRATION_OTP=live)", () => {
  interface DelegadoDoble {
    remoto: OtpFirmaRemoto;
    solicitudes: string[];
    verificaciones: { otpId: string; codigo: string }[];
  }

  function delegadoDoble(
    respuestaVerificacion: Awaited<ReturnType<OtpFirmaRemoto["verificar"]>> = { ok: true },
  ): DelegadoDoble {
    const solicitudes: string[] = [];
    const verificaciones: { otpId: string; codigo: string }[] = [];
    return {
      solicitudes,
      verificaciones,
      remoto: {
        async solicitar(destino) {
          solicitudes.push(destino);
          return { ok: true, otpId: "otp-remoto-1", expiraEn: "2099-01-01T00:00:00.000Z" };
        },
        async verificar(otpId, codigo) {
          verificaciones.push({ otpId, codigo });
          return respuestaVerificacion;
        },
      },
    };
  }

  it("abrir el enlace pide el código al delegado con el destino de la sesión y no retiene nada en el panel", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    const delegado = delegadoDoble();

    const apertura = await abrirEnlaceDeFirmaMock(iniciada.idCode100, {
      retenerCodigoParaPanelDemo: true,
      otpRemoto: delegado.remoto,
    });

    expect(apertura.ok).toBe(true);
    expect(delegado.solicitudes).toEqual([ENTRADA.destino]);
    // El código no existe en este proceso: viaja por WhatsApp. Ni siquiera
    // con la retención del panel activada hay algo que mostrar.
    expect(await obtenerCodigoFirmaDemo(iniciada.idCode100)).toBeNull();
    const sesion = await obtenerSesionFirmaMock(iniciada.idCode100);
    expect(sesion?.otp?.tipo).toBe("REMOTO");
  });

  it("firmar verifica contra el delegado y sella las dos huellas juntas", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    const delegado = delegadoDoble({ ok: true });
    await abrirEnlaceDeFirmaMock(iniciada.idCode100, { otpRemoto: delegado.remoto });

    const resultado = await firmarEnCode100Mock(iniciada.idCode100, "123456", {
      otpRemoto: delegado.remoto,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.firma.hashDocumentoFirmado).toMatch(/^[0-9a-f]{64}$/);
    expect(delegado.verificaciones).toEqual([{ otpId: "otp-remoto-1", codigo: "123456" }]);
  });

  it("un código incorrecto informado por el delegado no firma y trae los intentos restantes", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    const delegado = delegadoDoble({ ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes: 2 });
    await abrirEnlaceDeFirmaMock(iniciada.idCode100, { otpRemoto: delegado.remoto });

    const resultado = await firmarEnCode100Mock(iniciada.idCode100, "000000", {
      otpRemoto: delegado.remoto,
    });

    expect(resultado).toEqual({ ok: false, motivo: "CODIGO_INCORRECTO", intentosRestantes: 2 });
    expect((await obtenerSesionFirmaMock(iniciada.idCode100))?.firma).toBeNull();
  });

  it("si el envío remoto falla, la apertura devuelve ERROR_ENVIO y la sesión queda reintetable", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    const remotoRoto: OtpFirmaRemoto = {
      async solicitar() {
        return { ok: false, detalle: "SIN_RESPUESTA: TimeoutError" };
      },
      async verificar() {
        return { ok: false, motivo: "FALLA_DEL_PROVEEDOR" };
      },
    };

    const apertura = await abrirEnlaceDeFirmaMock(iniciada.idCode100, { otpRemoto: remotoRoto });
    expect(apertura).toEqual({ ok: false, motivo: "ERROR_ENVIO" });

    // La sesión sigue viva: con el canal recuperado se puede volver a abrir.
    const delegado = delegadoDoble();
    const reintento = await abrirEnlaceDeFirmaMock(iniciada.idCode100, { otpRemoto: delegado.remoto });
    expect(reintento.ok).toBe(true);
  });

  it("un OTP remoto jamás se verifica sin delegado: sin él, no firma", async () => {
    const proveedor = crearProveedor();
    const iniciada = await proveedor.iniciarFirma(ENTRADA);
    const delegado = delegadoDoble();
    await abrirEnlaceDeFirmaMock(iniciada.idCode100, { otpRemoto: delegado.remoto });

    const resultado = await firmarEnCode100Mock(iniciada.idCode100, "123456");
    expect(resultado).toEqual({ ok: false, motivo: "FALLA_DEL_PROVEEDOR" });
    expect((await obtenerSesionFirmaMock(iniciada.idCode100))?.firma).toBeNull();
  });
});

/**
 * La sesión de firma tiene que sobrevivir a que la próxima petición caiga en
 * otra instancia de cómputo.
 *
 * Se simula con dos almacenes: uno "por instancia" (memoria propia) y uno
 * compartido. Con el primero, abrir el firmador falla con `NO_ENCONTRADA` —
 * que es exactamente lo que pasó desplegado en Amplify: el enlace se enviaba y
 * siete segundos después el proveedor "no conocía" el acto de firma.
 */
describe("persistencia entre instancias de cómputo", () => {
  function almacenEnMemoria() {
    const datos = new Map<string, Map<string, unknown>>();
    const coleccionDe = (n: string) => {
      const e = datos.get(n);
      if (e) return e;
      const nueva = new Map<string, unknown>();
      datos.set(n, nueva);
      return nueva;
    };
    return {
      async obtener<T>(c: string, k: string) {
        return (coleccionDe(c).get(k) as T | undefined) ?? null;
      },
      async guardar(c: string, k: string, v: unknown) {
        coleccionDe(c).set(k, v);
      },
      async listar<T>(c: string) {
        return [...coleccionDe(c).values()] as T[];
      },
      async borrar(c: string, k: string) {
        coleccionDe(c).delete(k);
      },
    };
  }

  afterEach(() => {
    configurarAlmacenFirmaDemo(null);
  });

  it("se pierde si cada instancia tiene su propio almacén", async () => {
    const instanciaA = almacenEnMemoria();
    configurarAlmacenFirmaDemo(instanciaA);
    const iniciada = await crearProveedor().iniciarFirma(ENTRADA);

    // La petición siguiente cae en otra instancia, con su propia memoria.
    configurarAlmacenFirmaDemo(almacenEnMemoria());
    const abierta = await abrirEnlaceDeFirmaMock(iniciada.idCode100);

    expect(abierta).toEqual({ ok: false, motivo: "NO_ENCONTRADA" });
  });

  it("sobrevive con un almacén compartido, que es el arreglo", async () => {
    const compartido = almacenEnMemoria();
    configurarAlmacenFirmaDemo(compartido);
    const iniciada = await crearProveedor().iniciarFirma(ENTRADA);

    // Otra instancia, mismo almacén persistente detrás.
    configurarAlmacenFirmaDemo(compartido);
    const abierta = await abrirEnlaceDeFirmaMock(iniciada.idCode100);

    expect(abierta.ok).toBe(true);
    expect((await obtenerSesionFirmaMock(iniciada.idCode100))?.otp).not.toBeNull();
  });
});
