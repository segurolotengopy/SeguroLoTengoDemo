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
  PASO_EVIDENCIA_CONFIRMACION_DUPLICADA_P8,
  PASO_EVIDENCIA_ENVIO_ENLACE_P8,
  PASO_EVIDENCIA_FIRMAS_INSTITUCIONALES_P8,
  PASO_EVIDENCIA_FIRMA_P8,
  confirmarFirmaP8,
  iniciarFirmaP8,
  leerResumenFirmaP8,
} from "../firma-p8";
import { esTransicionLegal, registrarFirmaP8 } from "../expediente";
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
async function firmarEnCode100(idCode100: string, opciones: { ahora?: () => Date } = {}) {
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
    expect(registro?.detalle).toContain(PAQUETE_FIXTURE.hashSha256);
    // Los dos códigos internos quedan en la evidencia (D-11, fila 47).
    expect(registro?.detalle).toContain(PAQUETE_FIXTURE.codigo);
    expect(registro?.detalle).toContain(PAQUETE_FIXTURE.codigoSeccionFipf);
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

  it("firma confirmada: PAQUETE_GENERADO → FIRMADO_CLIENTE → FIRMADO, con una sola huella", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");

    expect((await firmarEnCode100(enlace.acto.idCode100)).ok).toBe(true);
    const resultado = await sondear(entorno);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok || !resultado.firmado) return;

    const expediente = entorno.repositorio.actual();
    expect(expediente.estado).toBe("FIRMADO");
    expect(expediente.firma?.hashDocumentoFirmado).toHaveLength(64);
    expect(expediente.firma?.idCode100).toBe(enlace.acto.idCode100);
    // D-08 · firmado el expediente, lo que sigue es pagar.
    expect(resultado.siguientePantalla).toBe("/pago");
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

  it("registra la huella firmada en un solo registro de evidencia", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");
    await firmarEnCode100(enlace.acto.idCode100);

    await sondear(entorno);

    const registro = entorno.evidencias.registros.find(
      (evidencia) => evidencia.paso === PASO_EVIDENCIA_FIRMA_P8 && evidencia.resultado === "EXITOSO",
    );
    expect(registro?.detalle).toContain("hashDocumentoFirmado=");
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

describe("firma · regla inviolable #3, ahora estructural (D-11)", () => {
  /**
   * Los dos tests que había acá cortaban el sellado a mitad y verificaban que
   * no quedara ningún documento firmado — en el proveedor, en el expediente y
   * en la evidencia. **Desaparecieron con el problema que probaban.** Con el
   * PDF unificado no hay dos archivos que puedan separarse, así que "medio
   * firmado" dejó de ser un estado alcanzable.
   *
   * Lo que sí sigue habiendo, y ahora es donde vive el riesgo real, es el
   * tramo entre la firma del cliente y las institucionales: ahí sí puede
   * quedar algo a medias, y para eso está `FIRMADO_CLIENTE` (D-13). Se prueba
   * en el bloque del plazo, más abajo.
   */
  it("el paquete es un solo documento: no hay dos huellas que puedan divergir", () => {
    const expediente = expedienteEnPaqueteGenerado();
    const paquete = expediente.paqueteDocumental!;

    // Una huella, una versión, y los dos códigos internos adentro del mismo
    // documento: no existe el campo por el que la Solicitud y el FIPF podrían
    // tener estados distintos.
    expect(paquete.hashSha256).toHaveLength(64);
    expect(paquete.codigo).toContain("PROP-");
    expect(paquete.codigoSeccionFipf).toContain("FIPF-");
    expect(Object.keys(paquete).sort()).toEqual([
      "cerradoEn",
      "codigo",
      "codigoSeccionFipf",
      "hashSha256",
      "version",
    ]);
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
      hashDocumentoFirmado: "",
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("huella del documento firmado");
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
      hashDocumentoFirmado: "c".repeat(64),
    });

    expect(resultado.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// El plazo de 24 horas ya no vive acá (D-08/D-10)
// ---------------------------------------------------------------------------

describe("firma · las dos vías de confirmación (CHG-33)", () => {
  it("el retorno del navegador confirma igual que el sondeo", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");
    await firmarEnCode100(enlace.acto.idCode100);

    const resultado = await confirmarFirmaP8(entorno.deps, {
      expedienteId: entorno.repositorio.actual().id,
      contexto: CONTEXTO,
      origen: "RETORNO_NAVEGADOR",
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok || !resultado.firmado) return;
    expect(resultado.duplicada).toBe(false);
    expect(entorno.repositorio.actual().estado).toBe("FIRMADO");
  });

  it("la segunda vía llega sobre un expediente ya firmado y se registra como duplicada", async () => {
    // Es el caso normal, no un error: el sondeo corre cada dos segundos
    // mientras la persona firma, y al volver de la ventana el navegador
    // confirma de una. Una de las dos llega segunda.
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");
    await firmarEnCode100(enlace.acto.idCode100);

    const primera = await sondear(entorno);
    const historialTrasPrimera = entorno.repositorio.actual().historial.length;

    const segunda = await confirmarFirmaP8(entorno.deps, {
      expedienteId: entorno.repositorio.actual().id,
      contexto: CONTEXTO,
      origen: "RETORNO_NAVEGADOR",
    });

    expect(primera.ok && primera.firmado).toBe(true);
    expect(segunda.ok).toBe(true);
    if (!segunda.ok || !segunda.firmado) return;

    // Responde lo mismo, marcada como duplicada, y no vuelve a transicionar.
    expect(segunda.duplicada).toBe(true);
    expect(segunda.siguientePantalla).toBe("/pago");
    expect(entorno.repositorio.actual().historial).toHaveLength(historialTrasPrimera);

    // Y queda constancia de por dónde llegó la que perdió la carrera.
    const duplicada = entorno.evidencias.registros.find(
      (evidencia) => evidencia.paso === PASO_EVIDENCIA_CONFIRMACION_DUPLICADA_P8,
    );
    expect(duplicada?.detalle).toContain("origen=RETORNO_NAVEGADOR");
    expect(duplicada?.resultado).toBe("EXITOSO");
  });

  it("el origen queda en la evidencia de las firmas institucionales", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");
    await firmarEnCode100(enlace.acto.idCode100);

    await confirmarFirmaP8(entorno.deps, {
      expedienteId: entorno.repositorio.actual().id,
      contexto: CONTEXTO,
      origen: "RETORNO_NAVEGADOR",
    });

    const registro = entorno.evidencias.registros.find(
      (evidencia) => evidencia.paso === PASO_EVIDENCIA_FIRMAS_INSTITUCIONALES_P8,
    );
    // "¿Por dónde se enteró el sistema de que esto se firmó?" es una pregunta
    // de auditoría, y sin este campo no tiene respuesta.
    expect(registro?.detalle).toContain("origen=RETORNO_NAVEGADOR");
  });
});

describe("firma · el plazo se abre acá y corre en el paso siguiente", () => {
  it("las firmas institucionales dejan el expediente FIRMADO y abren el plazo de pago", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");
    await firmarEnCode100(enlace.acto.idCode100);

    const resultado = await sondear(entorno);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok || !resultado.firmado) return;
    expect(entorno.repositorio.actual().estado).toBe("FIRMADO");
    // El reloj de D-10 arranca acá: sin esto habría un expediente firmado sin
    // vencimiento posible.
    expect(entorno.repositorio.actual().plazoPagoVenceEn).toBe(resultado.plazoPagoVenceEn);
    expect(resultado.plazoPagoVenceEn).not.toBe("");
  });

  it("registra quién firmó, con qué nivel y en qué modalidad (D-13)", async () => {
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");
    await firmarEnCode100(enlace.acto.idCode100);
    await sondear(entorno);

    const firmas = entorno.repositorio.actual().firmasInstitucionales;

    // La consola tiene que poder mostrar esto: un expediente FIRMADO que no
    // dijera quién lo firmó no probaría nada.
    expect(firmas.map((firma) => firma.rol)).toEqual(["INTERSEGUROS", "ALIANZA"]);
    expect(firmas.every((firma) => firma.nivel === "CUALIFICADA")).toBe(true);
    expect(firmas.every((firma) => firma.modalidad === "CONJUNTO")).toBe(true);
    // El certificado es simulado y la referencia lo dice: una evidencia que
    // afirmara un certificado cualificado real no probaría nada.
    expect(firmas.every((firma) => firma.certificado.startsWith("DEMO-CERT-"))).toBe(true);
  });

  it("si las institucionales no llegan, el expediente queda en FIRMADO_CLIENTE", async () => {
    // Es la falla que reemplazó a la de "sellado a la mitad" (D-11 la volvió
    // irrepresentable). Acá sí hay algo a medias: el cliente firmó y el cobro
    // tiene que seguir inhabilitado.
    const entorno = armar();
    const caido = { ...entorno.deps, firmasInstitucionalesCaidas: () => true };
    const enlace = await iniciarFirmaP8(caido, {
      expedienteId: entorno.repositorio.actual().id,
      canal: "WHATSAPP",
      contexto: CONTEXTO,
    });
    if (!enlace.ok) throw new Error("no se abrió el acto");
    await firmarEnCode100(enlace.acto.idCode100);

    const resultado = await confirmarFirmaP8(caido, {
      expedienteId: entorno.repositorio.actual().id,
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("FIRMAS_INSTITUCIONALES_PENDIENTES");

    const expediente = entorno.repositorio.actual();
    expect(expediente.estado).toBe("FIRMADO_CLIENTE");
    // La firma del cliente no se perdió, y el cobro no se habilitó.
    expect(expediente.firma).not.toBeNull();
    expect(expediente.plazoPagoVenceEn).toBeNull();
  });

  it("el tramo institucional se retoma solo si quedó a medias (regla inviolable #3)", async () => {
    // Un expediente detenido en FIRMADO_CLIENTE tiene la firma del cliente
    // registrada y el acto sin cerrar. El sondeo siguiente lo completa sin
    // volver a pedirle nada a Code100: la firma del cliente es un hecho.
    const entorno = armar();
    const enlace = await pedirEnlace(entorno);
    if (!enlace.ok) throw new Error("no se abrió el acto");
    await firmarEnCode100(enlace.acto.idCode100);
    await sondear(entorno);

    const aMedias: Expediente = {
      ...entorno.repositorio.actual(),
      estado: "FIRMADO_CLIENTE",
      plazoPagoVenceEn: null,
    };
    const reintento = armar(aMedias);
    const resultado = await sondear(reintento);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok || !resultado.firmado) return;
    expect(reintento.repositorio.actual().estado).toBe("FIRMADO");
    expect(reintento.repositorio.actual().plazoPagoVenceEn).not.toBeNull();
  });

  it("un expediente sin firmar no puede pagar: el cobro sale de FIRMADO", () => {
    // Es la garantía de la Matriz V4 §7 y la razón de la inversión: el medio
    // de cobro solo se habilita con firma válida.
    expect(esTransicionLegal("DECLARACIONES_OK", "PAGO_CONFIRMADO")).toBe(false);
    expect(esTransicionLegal("PAQUETE_GENERADO", "PAGO_CONFIRMADO")).toBe(false);
    expect(esTransicionLegal("FIRMADO_CLIENTE", "PAGO_CONFIRMADO")).toBe(false);
    expect(esTransicionLegal("FIRMADO", "PAGO_CONFIRMADO")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Lectura para la pantalla
// ---------------------------------------------------------------------------

describe("P8 · resumen para la pantalla", () => {
  it("trae el documento con su huella y los canales enmascarados", () => {
    const expediente = expedienteEnPaqueteGenerado();

    const resumen = leerResumenFirmaP8(expediente);

    expect(resumen?.documento.codigo).toBe(PAQUETE_FIXTURE.codigo);
    expect(resumen?.documento.codigoSeccionFipf).toBe(PAQUETE_FIXTURE.codigoSeccionFipf);
    expect(resumen?.documento.hashSha256).toBe(PAQUETE_FIXTURE.hashSha256);
    expect(resumen?.canalWhatsappEnmascarado).toContain("•");
    expect(resumen?.canalEmailEnmascarado).toContain("•");
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
