/**
 * Tests del caso de uso de P8.
 *
 * Lo que se prueba con más insistencia que el resto, porque son reglas
 * inviolables y controles de la matriz de cumplimiento y no validaciones de
 * formulario:
 *
 * - **Regla #3 (firma atómica)** — con una falla a mitad del sellado, el
 *   expediente no queda firmado, `firma` sigue en `null` y no aparece ninguna
 *   huella firmada en la evidencia. Ni la Solicitud ni el FIPF.
 * - **Regla #1 / #9 (canal verificado)** — el enlace va al canal que verificó
 *   la persona; el destino sale del expediente, nunca de la petición.
 * - **Fila 30 (plazo)** — cumplido el plazo, el expediente vence y no se puede
 *   ni pedir enlace ni firmar.
 * - **Fila 27 (captura)** — la firma del cliente ordena la captura de la
 *   preautorización de crédito, y el vencimiento libera la reserva.
 *
 * El proveedor de firma que se usa acá es el **mock real**
 * (`src/adapters/mock/signature-provider.ts`), no un doble improvisado: así
 * estos tests ejercitan el mismo camino que la demostración.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  abrirEnlaceDeFirmaMock,
  cerrarSinFirmarMock,
  crearSignatureProviderMock,
  firmarEnCode100Mock,
  limpiarSesionesFirmaMock,
  obtenerCodigoFirmaDemo,
  obtenerSesionFirmaMock,
} from "../../adapters/mock/signature-provider";
import type { EvidenceStore } from "../../ports/evidence-store";
import type { EstadoConsultaPago, PaymentProvider } from "../../ports/payment-provider";
import type { SignatureProvider } from "../../ports/signature-provider";
import {
  PASO_EVIDENCIA_ENVIO_ENLACE_P8,
  PASO_EVIDENCIA_FIRMA_P8,
  PASO_EVIDENCIA_VENCIMIENTO_P8,
  RUTA_PANTALLA_B,
  confirmarFirmaP8,
  iniciarFirmaP8,
  leerResumenFirmaP8,
  vencerPlazoFirmaP8,
} from "../firma-p8";
import { registrarFirmaP8 } from "../expediente";
import { VERSION_DECLARACION_FIRMA_P8 } from "../textos-p8";
import type { Expediente, Pago, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion, RepositorioExpediente } from "../verificacion-canal";
import { PAQUETE_FIXTURE, expedienteEnPaqueteGenerado } from "./fixtures";

// ---------------------------------------------------------------------------
// Dobles en memoria
// ---------------------------------------------------------------------------

const AHORA = "2026-08-09T15:05:00.000Z";
const PLAZO_DEL_FIXTURE = "2026-08-10T15:01:00.000Z";

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-p8",
};

function repositorioFalso(inicial: Expediente): RepositorioExpediente & { actual: () => Expediente } {
  let guardado = inicial;
  return {
    async obtenerPorId(id) {
      return id === guardado.id ? guardado : null;
    },
    async crear(expediente) {
      guardado = expediente;
    },
    async guardar(expediente) {
      guardado = expediente;
    },
    actual: () => guardado,
  };
}

function evidenciasFalsas(): EvidenceStore & { registros: RegistroEvidencia[] } {
  const registros: RegistroEvidencia[] = [];
  return {
    registros,
    async guardar(registro) {
      registros.push(registro);
    },
    async obtenerHistorial(expedienteId) {
      return registros.filter((registro) => registro.expedienteId === expedienteId);
    },
  };
}

/** Doble de Bancard que solo hace falta para la captura y la liberación. */
function bancardFalso(pago: Pago | null) {
  const llamadas: string[] = [];
  let estado = pago?.estado ?? "PENDIENTE";

  function proyectar(): EstadoConsultaPago {
    return {
      referenciaBancard: pago?.referenciaBancard ?? "",
      medio: pago?.medio ?? "QR_BANCARD",
      estado,
      montoGs: pago?.montoGs ?? 0,
      ultimos4Digitos: null,
      actualizadoEn: AHORA,
    };
  }

  const provider: PaymentProvider = {
    async iniciarPagoQr() {
      throw new Error("no usado en P8");
    },
    async iniciarPagoTarjetaDebito() {
      throw new Error("no usado en P8");
    },
    async iniciarPagoTarjetaCredito() {
      throw new Error("no usado en P8");
    },
    async consultarEstadoPago() {
      return proyectar();
    },
    async cancelarOLiberarReserva() {
      llamadas.push("liberar");
      estado = "CANCELADO";
      return proyectar();
    },
  };

  return { provider, llamadas };
}

interface Entorno {
  readonly deps: {
    readonly firmas: SignatureProvider;
    readonly pagos: PaymentProvider;
    readonly expedientes: RepositorioExpediente;
    readonly evidencias: EvidenceStore;
    readonly ahora: () => string;
    readonly nuevoId: () => string;
  };
  readonly repositorio: ReturnType<typeof repositorioFalso>;
  readonly evidencias: ReturnType<typeof evidenciasFalsas>;
  readonly bancard: ReturnType<typeof bancardFalso>;
  readonly avanzarReloj: (iso: string) => void;
}

function armar(expediente: Expediente = expedienteEnPaqueteGenerado()): Entorno {
  const repositorio = repositorioFalso(expediente);
  const evidencias = evidenciasFalsas();
  const bancard = bancardFalso(expediente.pago);
  let reloj = AHORA;
  let contador = 0;

  return {
    deps: {
      firmas: crearSignatureProviderMock({
        demoraEnvioEnlaceMs: 0,
        ahora: () => new Date(reloj),
      }),
      pagos: bancard.provider,
      expedientes: repositorio,
      evidencias,
      ahora: () => reloj,
      nuevoId: () => `ev-${(contador += 1)}`,
    },
    repositorio,
    evidencias,
    bancard,
    avanzarReloj: (iso: string) => {
      reloj = iso;
    },
  };
}

/**
 * Abre el enlace en el Code100 simulado y firma con el código emitido.
 * Siempre al reloj del fixture: sin `ahora` los mocks caen al reloj real del
 * sistema, y en cuanto ese reloj supera el vencimiento de la fixture el enlace
 * se ve expirado. Todos los tests firman en AHORA; el que avanza el reloj lo
 * hace después de firmar.
 */
async function firmarEnCode100(idCode100: string, opciones: { fallarAMitadDelSellado?: boolean } = {}) {
  const ahora = () => new Date(AHORA);
  await abrirEnlaceDeFirmaMock(idCode100, { retenerCodigoParaPanelDemo: true, ahora });
  const codigo = ((await obtenerCodigoFirmaDemo(idCode100)))?.codigo ?? "";
  return await firmarEnCode100Mock(idCode100, codigo, { ...opciones, ahora });
}

async function pedirEnlace(entorno: Entorno, canal: unknown = "WHATSAPP") {
  return iniciarFirmaP8(entorno.deps, {
    expedienteId: entorno.repositorio.actual().id,
    canal,
    contexto: CONTEXTO,
  });
}

async function sondear(entorno: Entorno) {
  return confirmarFirmaP8(entorno.deps, {
    expedienteId: entorno.repositorio.actual().id,
    contexto: CONTEXTO,
  });
}

beforeEach(() => {
  limpiarSesionesFirmaMock();
});

afterEach(() => {
  limpiarSesionesFirmaMock();
});

// ---------------------------------------------------------------------------
// Camino feliz
// ---------------------------------------------------------------------------

describe("P8 · enviar el enlace de firma", () => {
  it("abre el acto sin mover el estado y lo persiste para poder sondear después", async () => {
    const entorno = armar();

    const resultado = await pedirEnlace(entorno);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const expediente = entorno.repositorio.actual();
    // Pedir el enlace no firma nada ni avanza el expediente.
    expect(expediente.estado).toBe("PAQUETE_GENERADO");
    expect(expediente.firma).toBeNull();
    expect(expediente.actoDeFirma?.idCode100).toBe(resultado.acto.idCode100);
  });

  it("manda el enlace al canal verificado y solo enmascarado sale de acá", async () => {
    const entorno = armar();

    const resultado = await pedirEnlace(entorno, "WHATSAPP");

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    // El destino real está en la sesión de Code100 y sale del expediente…
    const sesion = await obtenerSesionFirmaMock(resultado.acto.idCode100);
    expect(sesion?.destino).toBe(entorno.repositorio.actual().canalWhatsapp?.valor);
    // …y lo que vuelve a la pantalla está enmascarado.
    expect(resultado.acto.destinoEnmascarado).not.toBe(sesion?.destino);
    expect(resultado.acto.destinoEnmascarado).toContain("•");
  });

  it("con canal EMAIL usa el correo verificado de P4", async () => {
    const entorno = armar();

    const resultado = await pedirEnlace(entorno, "EMAIL");

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect((await obtenerSesionFirmaMock(resultado.acto.idCode100))?.destino).toBe(
      entorno.repositorio.actual().canalEmail?.valor,
    );
  });

  it("rechaza un canal que no es ninguno de los dos verificados", async () => {
    const entorno = armar();

    const resultado = await pedirEnlace(entorno, "SMS");

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("CANAL_INVALIDO");
  });

  it("rechaza un canal sin verificar en este expediente", async () => {
    const base = expedienteEnPaqueteGenerado();
    const entorno = armar({ ...base, canalEmail: null });

    const resultado = await pedirEnlace(entorno, "EMAIL");

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("CANAL_NO_VERIFICADO");
  });

  it("pedirlo dos veces no abre dos actos de firma sobre el mismo paquete", async () => {
    const entorno = armar();

    const primero = await pedirEnlace(entorno);
    const segundo = await pedirEnlace(entorno);

    expect(primero.ok && segundo.ok).toBe(true);
    if (!primero.ok || !segundo.ok) return;
    expect(segundo.acto.idCode100).toBe(primero.acto.idCode100);
  });

  it("después de un rechazo sí se puede pedir un enlace nuevo", async () => {
    const entorno = armar();
    const primero = await pedirEnlace(entorno);
    if (!primero.ok) throw new Error("no se abrió el primer acto");

    cerrarSinFirmarMock(primero.acto.idCode100);
    const segundo = await pedirEnlace(entorno);

    expect(segundo.ok).toBe(true);
    if (!segundo.ok) return;
    expect(segundo.acto.idCode100).not.toBe(primero.acto.idCode100);
  });

  it("deja evidencia con el canal, el ID de Code100 y las dos huellas del paquete", async () => {
    const entorno = armar();

    await pedirEnlace(entorno);

    const registro = entorno.evidencias.registros.find(
      (evidencia) => evidencia.paso === PASO_EVIDENCIA_ENVIO_ENLACE_P8,
    );
    expect(registro?.resultado).toBe("EXITOSO");
    expect(registro?.detalle).toContain(PAQUETE_FIXTURE.solicitud.hashSha256);
    expect(registro?.detalle).toContain(PAQUETE_FIXTURE.fipf.hashSha256);
    expect(registro?.versionTextoAceptado).toBe(VERSION_DECLARACION_FIRMA_P8);
    expect(registro?.ip).toBe(CONTEXTO.ip);
  });
});

describe("P8 · confirmar la firma", () => {
  it("mientras Code100 no confirma, el expediente no se mueve", async () => {
    const entorno = armar();
    await pedirEnlace(entorno);

    const resultado = await sondear(entorno);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok || resultado.firmado) return;
    expect(resultado.firmado).toBe(false);
    expect(entorno.repositorio.actual().estado).toBe("PAQUETE_GENERADO");
  });

  it("firma confirmada: PAQUETE_GENERADO → FIRMADO con las dos huellas juntas", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");

    expect((await firmarEnCode100(enlace.acto.idCode100)).ok).toBe(true);
    const resultado = await sondear(entorno);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok || !resultado.firmado) return;

    const expediente = entorno.repositorio.actual();
    expect(expediente.estado).toBe("FIRMADO");
    expect(expediente.firma?.hashSolicitudFirmada).toHaveLength(64);
    expect(expediente.firma?.hashFipfFirmado).toHaveLength(64);
    expect(expediente.firma?.idCode100).toBe(enlace.acto.idCode100);
    expect(resultado.siguientePantalla).toBe("/confirmacion");
  });

  it("es idempotente: sondear de nuevo devuelve lo mismo sin volver a transicionar", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");
    await firmarEnCode100(enlace.acto.idCode100);

    const primera = await sondear(entorno);
    const historialTrasPrimera = entorno.repositorio.actual().historial.length;
    const segunda = await sondear(entorno);

    expect(primera.ok && segunda.ok).toBe(true);
    if (!primera.ok || !segunda.ok || !primera.firmado || !segunda.firmado) return;
    expect(segunda.firmadoEn).toBe(primera.firmadoEn);
    expect(entorno.repositorio.actual().historial.length).toBe(historialTrasPrimera);
  });

  it("un rechazo de Code100 no firma nada y deja el expediente reintentable", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");

    cerrarSinFirmarMock(enlace.acto.idCode100);
    const resultado = await sondear(entorno);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("FIRMA_NO_COMPLETADA");

    const expediente = entorno.repositorio.actual();
    expect(expediente.estado).toBe("PAQUETE_GENERADO");
    expect(expediente.firma).toBeNull();
  });

  it("registra las dos huellas firmadas en un solo registro de evidencia", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");
    await firmarEnCode100(enlace.acto.idCode100);

    await sondear(entorno);

    const registro = entorno.evidencias.registros.find(
      (evidencia) => evidencia.paso === PASO_EVIDENCIA_FIRMA_P8 && evidencia.resultado === "EXITOSO",
    );
    expect(registro?.detalle).toContain("hashSolicitudFirmada=");
    expect(registro?.detalle).toContain("hashFipfFirmado=");
    expect(registro?.detalle).toContain("firmante=CLIENTE");
  });

  it("la evidencia de P8 no contiene el código del OTP de firma", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");

    const ahora = () => new Date(AHORA);
    await abrirEnlaceDeFirmaMock(enlace.acto.idCode100, { retenerCodigoParaPanelDemo: true, ahora });
    const codigo = ((await obtenerCodigoFirmaDemo(enlace.acto.idCode100)))?.codigo ?? "";
    await firmarEnCode100Mock(enlace.acto.idCode100, codigo, { ahora });
    await sondear(entorno);

    expect(codigo).not.toBe("");
    expect(JSON.stringify(entorno.evidencias.registros)).not.toContain(codigo);
  });
});

// ---------------------------------------------------------------------------
// Regla inviolable #3 — la firma atómica
// ---------------------------------------------------------------------------

describe("P8 · regla atómica de firma (regla inviolable #3)", () => {
  /**
   * El test que pide la regla: se corta el proceso a mitad del sellado, con la
   * huella de la Solicitud ya calculada y la del FIPF no. Lo que tiene que
   * quedar es **nada firmado**, en las tres capas: el proveedor, el expediente
   * y la evidencia.
   */
  it("una falla a mitad del sellado no deja NINGUNO de los dos documentos firmado", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");

    const fallido = await firmarEnCode100(enlace.acto.idCode100, { fallarAMitadDelSellado: true });
    expect(fallido.ok).toBe(false);

    const resultado = await sondear(entorno);

    // 1. El proveedor no reporta ninguna firma.
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.firmado).toBe(false);
    expect((await obtenerSesionFirmaMock(enlace.acto.idCode100))?.firma).toBeNull();

    // 2. El expediente sigue sin firma y sin haber avanzado.
    const expediente = entorno.repositorio.actual();
    expect(expediente.estado).toBe("PAQUETE_GENERADO");
    expect(expediente.firma).toBeNull();

    // 3. No hay ninguna huella firmada en la evidencia — ni de la Solicitud ni
    //    del FIPF. Lo único que hay del paquete son las huellas *sin* firmar.
    const evidencia = JSON.stringify(entorno.evidencias.registros);
    expect(evidencia).not.toContain("hashSolicitudFirmada");
    expect(evidencia).not.toContain("hashFipfFirmado");

    // 4. Y los documentos cerrados quedaron intactos: nada se modificó.
    expect(expediente.paqueteDocumental?.solicitud.hashSha256).toBe(
      PAQUETE_FIXTURE.solicitud.hashSha256,
    );
    expect(expediente.paqueteDocumental?.fipf.hashSha256).toBe(PAQUETE_FIXTURE.fipf.hashSha256);
  });

  it("después de la falla, completar el acto firma los dos y recién ahí avanza", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");

    await firmarEnCode100(enlace.acto.idCode100, { fallarAMitadDelSellado: true });
    await sondear(entorno);
    expect(entorno.repositorio.actual().estado).toBe("PAQUETE_GENERADO");

    const codigo = ((await obtenerCodigoFirmaDemo(enlace.acto.idCode100)))?.codigo ?? "";
    const reintento = await firmarEnCode100Mock(enlace.acto.idCode100, codigo, {
      ahora: () => new Date(AHORA),
    });
    expect(reintento.ok).toBe(true);
    await sondear(entorno);

    const expediente = entorno.repositorio.actual();
    expect(expediente.estado).toBe("FIRMADO");
    expect(expediente.firma?.hashSolicitudFirmada).toHaveLength(64);
    expect(expediente.firma?.hashFipfFirmado).toHaveLength(64);
  });

  it("la máquina de estados rechaza una firma con una huella vacía", () => {
    const expediente = expedienteEnPaqueteGenerado();
    const conActo: Expediente = {
      ...expediente,
      actoDeFirma: {
        idCode100: "MOCK-CODE100-X",
        canal: "WHATSAPP",
        destinoEnmascarado: "+595 ••• ••• 456",
        enlaceEnviadoEn: AHORA,
        venceEn: PLAZO_DEL_FIXTURE,
      },
    };

    const resultado = registrarFirmaP8(conActo, {
      canal: "WHATSAPP",
      idCode100: "MOCK-CODE100-X",
      firmadoEn: AHORA,
      hashSolicitudFirmada: "c".repeat(64),
      hashFipfFirmado: "",
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("los dos documentos");
  });

  it("la máquina de estados rechaza una firma de otro acto de Code100", () => {
    const expediente = expedienteEnPaqueteGenerado();
    const conActo: Expediente = {
      ...expediente,
      actoDeFirma: {
        idCode100: "MOCK-CODE100-PROPIO",
        canal: "WHATSAPP",
        destinoEnmascarado: "+595 ••• ••• 456",
        enlaceEnviadoEn: AHORA,
        venceEn: PLAZO_DEL_FIXTURE,
      },
    };

    const resultado = registrarFirmaP8(conActo, {
      canal: "WHATSAPP",
      idCode100: "MOCK-CODE100-AJENO",
      firmadoEn: AHORA,
      hashSolicitudFirmada: "c".repeat(64),
      hashFipfFirmado: "d".repeat(64),
    });

    expect(resultado.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// El plazo de 24 horas
// ---------------------------------------------------------------------------

describe("P8 · plazo para firmar", () => {
  it("cumplido el plazo, el expediente vence y manda a Pantalla B", async () => {
    const entorno = armar();
    entorno.avanzarReloj("2026-08-10T15:01:00.001Z");

    const resultado = await vencerPlazoFirmaP8(entorno.deps, {
      expedienteId: entorno.repositorio.actual().id,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.vencio).toBe(true);
    expect(entorno.repositorio.actual().estado).toBe("VENCIDO");
  });

  it("antes del plazo no vence nada", async () => {
    const entorno = armar();

    const resultado = await vencerPlazoFirmaP8(entorno.deps, {
      expedienteId: entorno.repositorio.actual().id,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.vencio).toBe(false);
    expect(entorno.repositorio.actual().estado).toBe("PAQUETE_GENERADO");
  });

  it("un expediente pagado que nunca llegó a P8 también vence", async () => {
    // PAGO_CONFIRMADO, sin paquete documental: el plazo corre desde el pago.
    const enPago = expedienteEnPaqueteGenerado();
    const sinPaquete: Expediente = {
      ...enPago,
      estado: "PAGO_CONFIRMADO",
      paqueteDocumental: null,
    };
    const entorno = armar(sinPaquete);
    entorno.avanzarReloj("2026-08-10T15:01:00.001Z");

    const resultado = await vencerPlazoFirmaP8(entorno.deps, {
      expedienteId: sinPaquete.id,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.vencio).toBe(true);
    expect(entorno.repositorio.actual().estado).toBe("VENCIDO");
  });

  it("vencido no se puede pedir un enlace de firma", async () => {
    const entorno = armar();
    entorno.avanzarReloj("2026-08-10T15:01:00.001Z");

    const resultado = await pedirEnlace(entorno);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("PLAZO_VENCIDO");
    expect(resultado.siguientePantalla).toBe(RUTA_PANTALLA_B);
  });

  it("vencido no se puede confirmar una firma pendiente", async () => {
    const entorno = armar();
    await pedirEnlace(entorno);
    entorno.avanzarReloj("2026-08-10T15:01:00.001Z");

    const resultado = await sondear(entorno);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("PLAZO_VENCIDO");
    expect(entorno.repositorio.actual().firma).toBeNull();
  });

  it("una firma ya registrada no se pierde porque después venza el reloj", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");
    await firmarEnCode100(enlace.acto.idCode100);
    await sondear(entorno);

    entorno.avanzarReloj("2026-08-11T00:00:00.000Z");
    const resultado = await sondear(entorno);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok || !resultado.firmado) return;
    expect(entorno.repositorio.actual().estado).toBe("FIRMADO");
  });

  it("deja evidencia del vencimiento y de que no hubo cobro que deshacer", async () => {
    const entorno = armar();
    entorno.avanzarReloj("2026-08-10T15:01:00.001Z");

    await vencerPlazoFirmaP8(entorno.deps, {
      expedienteId: entorno.repositorio.actual().id,
      contexto: CONTEXTO,
    });

    const registro = entorno.evidencias.registros.find(
      (evidencia) => evidencia.paso === PASO_EVIDENCIA_VENCIMIENTO_P8,
    );
    expect(registro?.resultado).toBe("FALLIDO");
    // Antes la consecuencia dependía del medio: con QR o débito había que
    // devolver, con crédito alcanzaba con liberar la reserva. Sin
    // preautorización (D-02) y con el pago después de la firma (D-08) el
    // expediente vence sin haber cobrado nunca, así que simplemente caduca.
    expect(registro?.detalle).toContain("consecuencia=CADUCIDAD_SIN_COBRO");
  });
});

// ---------------------------------------------------------------------------
// Crédito: captura tras la firma, liberación al vencer (filas 26 y 27)
// ---------------------------------------------------------------------------


describe("P8 · garantía de pago con tarjeta de crédito", () => {
});

// ---------------------------------------------------------------------------
// Lectura para la pantalla
// ---------------------------------------------------------------------------

describe("P8 · resumen para la pantalla", () => {
  it("trae los dos documentos con su huella y los canales enmascarados", () => {
    const expediente = expedienteEnPaqueteGenerado();

    const resumen = leerResumenFirmaP8(expediente);

    expect(resumen?.solicitud.codigo).toBe(PAQUETE_FIXTURE.solicitud.codigo);
    expect(resumen?.fipf.codigo).toBe(PAQUETE_FIXTURE.fipf.codigo);
    expect(resumen?.solicitud.hashSha256).toBe(PAQUETE_FIXTURE.solicitud.hashSha256);
    expect(resumen?.canalWhatsappEnmascarado).toContain("•");
    expect(resumen?.canalEmailEnmascarado).toContain("•");
    // Ya no se informa ninguna garantía de pago: al firmar todavía no se pagó
    // (D-08), y el resumen de la firma habla de documentos, no de dinero.
    expect(resumen?.garantia).toBeNull();
  });

  it("no expone el valor completo de ningún canal verificado", () => {
    const expediente = expedienteEnPaqueteGenerado();

    const resumen = JSON.stringify(leerResumenFirmaP8(expediente));

    expect(resumen).not.toContain(expediente.canalWhatsapp?.valor ?? "@@");
    expect(resumen).not.toContain(expediente.canalEmail?.valor ?? "@@");
  });

  it("no hay resumen antes de que el paquete esté cerrado", () => {
    const expediente = expedienteEnPaqueteGenerado();

    expect(leerResumenFirmaP8({ ...expediente, paqueteDocumental: null })).toBeNull();
  });
});
