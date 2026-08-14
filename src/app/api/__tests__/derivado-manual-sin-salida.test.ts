/**
 * Regla de negocio inviolable #5, verificada de punta a punta:
 *
 * > Bloqueo automático de elegibilidad: una respuesta incompatible en las
 * > declaraciones 1, 2, 3 u 8 de P6 detiene la emisión automática y deriva a
 * > Pantalla A. Ese estado es **terminal en el flujo digital**: no existe
 * > transición desde ahí hacia pago, firma ni emisión.
 *
 * Y la `Regla del sistema` de la Pantalla A: *"no continuar a pago Bancard,
 * firma Code100 ni emisión mediante SEBAOT"*.
 *
 * No alcanza con probar el grafo de estados: alguien podría agregar mañana un
 * Route Handler que transicione por su cuenta, o un caso de uso que no mire el
 * estado de origen. Este archivo cierra las tres puertas:
 *
 * 1. **Grafo** — `DERIVADO_MANUAL` no tiene ninguna transición legal de salida,
 *    para ninguno de los 14 estados.
 * 2. **Casos de uso** — se toma un expediente realmente derivado (pasando por
 *    P6, no fabricado a mano) y se lo somete a **todos** los casos de uso del
 *    flujo, uno por uno, con dobles en memoria. Cada uno tiene que rechazar, y
 *    el expediente persistido tiene que quedar byte por byte igual.
 * 3. **Inventario de rutas** — se recorre el árbol de `src/app/api` y se
 *    verifica que (a) ningún Route Handler importe `transicionarExpediente`
 *    —la única transición del sistema vive en `src/domain/expediente.ts`— y
 *    (b) todo endpoint que muta esté en la lista cubierta por el punto 2. Si
 *    mañana aparece `POST /api/p7/pago`, este test falla hasta que alguien lo
 *    agregue acá y demuestre que también rechaza un expediente derivado.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { crearIdentityProviderMock } from "@/adapters/mock/identity-provider";
import { limpiarRegistroDemo } from "@/adapters/mock/otp-provider";
import { limpiarSesionesIdentidadMock } from "@/adapters/mock/identity-provider";
import { registrarAutorizacionInicial } from "@/domain/autorizacion-inicial";
import {
  PASO_EVIDENCIA_REINICIO_ADMIN,
  evaluarBloqueoPorCedula,
  expedientesQueBloquean,
  reiniciarExpediente,
} from "@/domain/consola-administrativa";
import { guardarDatosYDeclaracionesP6 } from "@/domain/declaraciones-p6";
import { generarPaqueteDocumental } from "@/documentos";
import type { RepositorioArchivos } from "@/documentos";
import {
  iniciarDevolucionPantallaB,
  registrarDevolucionEjecutadaPantallaB,
} from "@/domain/devolucion-pantalla-b";
import {
  consultarEmisionP9,
  emitirPolizaP9,
  registrarComunicacionesComercialesP9,
} from "@/domain/emision-p9";
import { confirmarFirmaP8, iniciarFirmaP8, vencerPlazoFirmaP8 } from "@/domain/firma-p8";
import { confirmarPagoP7, iniciarPagoP7 } from "@/domain/pago-p7";
import type { PaymentProvider } from "@/ports/payment-provider";
import type { PolicyIssuer } from "@/ports/policy-issuer";
import type { SignatureProvider } from "@/ports/signature-provider";
import { esTransicionLegal, transicionarExpediente, transicionesLegalesDesde } from "@/domain/expediente";
import { seleccionarPlan } from "@/domain/seleccion-plan";
import type { EstadoExpediente, Expediente, RegistroEvidencia } from "@/domain/tipos";
import { analizarIdentidadP5, confirmarIdentidadP5, registrarCapturaP5 } from "@/domain/verificacion-identidad";
import { enviarOtpCorreo, reenviarOtpCorreo, verificarOtpCorreo } from "@/domain/verificacion-canal-correo";
import { enviarOtpWhatsapp, reenviarOtpWhatsapp, verificarOtpWhatsapp } from "@/domain/verificacion-canal-whatsapp";
import type { ContextoPeticion, RepositorioExpediente } from "@/domain/verificacion-canal";
import type { EvidenceStore } from "@/ports/evidence-store";
import type { OtpProvider } from "@/ports/otp-provider";
import {
  avanzarHastaIdentidadVerificada,
  crearExpediente,
  datosComplementariosFixture,
  NUMERO_CASO_FIJO,
} from "@/domain/__tests__/fixtures";

// ---------------------------------------------------------------------------
// Dobles en memoria
// ---------------------------------------------------------------------------

const EXPEDIENTE_ID = "EXP-TEST-1";
const AHORA = "2026-08-09T15:00:00.000Z";

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-derivada",
};

function repositorioFalso(inicial: Expediente) {
  let guardado = inicial;
  const repo: RepositorioExpediente = {
    async obtenerPorId(id) {
      return id === guardado.id ? guardado : null;
    },
    async crear(expediente) {
      guardado = expediente;
    },
    async guardar(expediente) {
      guardado = expediente;
    },
  };
  return { repo, actual: () => guardado };
}

function evidenciasFalsas(): EvidenceStore {
  const registros: RegistroEvidencia[] = [];
  return {
    async guardar(registro) {
      registros.push(registro);
    },
    async obtenerHistorial(expedienteId) {
      return registros.filter((registro) => registro.expedienteId === expedienteId);
    },
  };
}

/**
 * Repositorio de OTP en memoria, suficiente para lo único que este test
 * necesita: que los casos de uso de P1 y P4 lleguen hasta el chequeo de estado
 * sin explotar antes por falta de infraestructura.
 */
/**
 * `PaymentProvider` que explota si alguien lo llama. Un expediente derivado no
 * puede llegar a Bancard: si un caso de uso lo intentara, este doble convierte
 * el intento en un fallo ruidoso en vez de dejarlo pasar como una operación
 * simulada más.
 */
function pagosQueFallanSiSeUsan(): PaymentProvider {
  const explotar = (metodo: string) => () => {
    throw new Error(`Se llamó a PaymentProvider.${metodo} con un expediente DERIVADO_MANUAL.`);
  };
  return {
    iniciarPagoQr: explotar("iniciarPagoQr"),
    iniciarPagoTarjetaDebito: explotar("iniciarPagoTarjetaDebito"),
    iniciarPreautorizacionTarjeta: explotar("iniciarPreautorizacionTarjeta"),
    consultarEstadoPago: explotar("consultarEstadoPago"),
    capturarPreautorizacion: explotar("capturarPreautorizacion"),
    cancelarOLiberarReserva: explotar("cancelarOLiberarReserva"),
  };
}

function polizasQueFallanSiSeUsan(): PolicyIssuer {
  const explotar = (metodo: string) => () => {
    throw new Error(`Se llamó a PolicyIssuer.${metodo} con un expediente DERIVADO_MANUAL.`);
  };
  return {
    emitirPoliza: explotar("emitirPoliza"),
    consultarEstadoPoliza: explotar("consultarEstadoPoliza"),
    consultarEstadoFacturaElectronica: explotar("consultarEstadoFacturaElectronica"),
  };
}

function archivosQueFallanSiSeUsan(): RepositorioArchivos {
  return {
    guardarArchivo: () => {
      throw new Error("Se guardó un PDF de un expediente DERIVADO_MANUAL.");
    },
  };
}

function firmasQueFallanSiSeUsan(): SignatureProvider {
  const explotar = (metodo: string) => () => {
    throw new Error(`Se llamó a SignatureProvider.${metodo} con un expediente DERIVADO_MANUAL.`);
  };
  return {
    iniciarFirma: explotar("iniciarFirma"),
    descargarDocumentosFirmados: explotar("descargarDocumentosFirmados"),
    confirmarResultado: explotar("confirmarResultado"),
  };
}

function otpFalso(): { provider: OtpProvider; lector: { obtener: (id: string) => Promise<null> } } {
  const provider: OtpProvider = {
    async enviarOtp() {
      return {
        ok: true,
        otpId: "otp-falso",
        expiraEn: AHORA,
        referenciaEnvio: "MOCK-REF",
      };
    },
    async reenviarOtp() {
      return { ok: true, otpId: "otp-falso", expiraEn: AHORA, referenciaEnvio: "MOCK-REF" };
    },
    async verificarOtp() {
      return { ok: true };
    },
  };
  return { provider, lector: { obtener: async () => null } };
}

const IMAGEN = new Uint8Array([1, 2, 3, 4]);
const IMAGENES = {
  frente: IMAGEN,
  dorso: IMAGEN,
  selfie: { tipo: "VIDEO", video: IMAGEN },
} as const;

/** Un expediente que llegó a DERIVADO_MANUAL por el camino real: P6. */
async function expedienteDerivado(): Promise<Expediente> {
  const { repo, actual } = repositorioFalso(avanzarHastaIdentidadVerificada(crearExpediente(EXPEDIENTE_ID)));

  const resultado = await guardarDatosYDeclaracionesP6(
    {
      expedientes: repo,
      evidencias: evidenciasFalsas(),
      ahora: () => AHORA,
      nuevoId: () => "evidencia-derivacion",
      nuevoNumeroCaso: () => NUMERO_CASO_FIJO,
    },
    {
      expedienteId: EXPEDIENTE_ID,
      datos: {
        domicilio: datosComplementariosFixture.domicilio,
        ciudad: datosComplementariosFixture.ciudad,
        situacionLaboral: datosComplementariosFixture.situacionLaboral,
        actividad: datosComplementariosFixture.actividad,
        profesion: datosComplementariosFixture.profesion,
        empresa: datosComplementariosFixture.empresa,
        ingresoMensualDeclaradoGs: "8000000",
        beneficiarioTipo: "HEREDEROS_LEGALES",
      },
      // Declaración 8 en "Sí": condición PEP.
      declaraciones: { "1": "SI", "2": "NO", "3": "NO", "4": "SI", "5": "SI", "6": "SI", "7": "SI", "8": "SI" },
      contexto: CONTEXTO,
    },
  );

  if (!resultado.ok || resultado.elegibleParaEmisionAutomatica) {
    throw new Error("el fixture no llegó a DERIVADO_MANUAL");
  }
  return actual();
}

// ---------------------------------------------------------------------------
// 1. Grafo de estados
// ---------------------------------------------------------------------------

const TODOS_LOS_ESTADOS: readonly EstadoExpediente[] = [
  "INICIADO",
  "CANAL_WA_VERIFICADO",
  "PLAN_SELECCIONADO",
  "AUTORIZADO",
  "CANAL_EMAIL_VERIFICADO",
  "IDENTIDAD_VERIFICADA",
  "DERIVADO_MANUAL",
  "DECLARACIONES_OK",
  "PAGO_CONFIRMADO",
  "PAQUETE_GENERADO",
  "VENCIDO",
  "DEVOLUCION_EN_TRAMITE",
  "FIRMADO",
  "EMITIDO",
];

/** Los estados que representan pago, firma o emisión: los prohibidos. */
const ESTADOS_DE_PAGO_FIRMA_O_EMISION: readonly EstadoExpediente[] = [
  "PAGO_CONFIRMADO",
  "PAQUETE_GENERADO",
  "FIRMADO",
  "EMITIDO",
];

describe("1. Grafo de estados: DERIVADO_MANUAL no tiene salida", () => {
  it("no declara ninguna transición legal", () => {
    expect(transicionesLegalesDesde("DERIVADO_MANUAL")).toEqual([]);
  });

  it.each(TODOS_LOS_ESTADOS)("no se puede pasar de DERIVADO_MANUAL a %s", (destino) => {
    expect(esTransicionLegal("DERIVADO_MANUAL", destino)).toBe(false);
  });

  it("transicionarExpediente rechaza explícitamente pago, firma y emisión", async () => {
    const derivado = await expedienteDerivado();
    for (const destino of ESTADOS_DE_PAGO_FIRMA_O_EMISION) {
      const intento = transicionarExpediente(derivado, destino);
      expect(intento.ok, `se pudo pasar a ${destino}`).toBe(false);
    }
  });

  it("ningún estado alcanzable desde DERIVADO_MANUAL llega a pago, firma o emisión", () => {
    // Cierre transitivo: no basta con que no haya un salto directo; tampoco
    // puede haber un camino de dos o más pasos que termine en un estado de
    // pago, firma o emisión.
    const alcanzables = new Set<EstadoExpediente>();
    const pendientes: EstadoExpediente[] = [...transicionesLegalesDesde("DERIVADO_MANUAL")];

    while (pendientes.length > 0) {
      const estado = pendientes.pop();
      if (!estado || alcanzables.has(estado)) continue;
      alcanzables.add(estado);
      pendientes.push(...transicionesLegalesDesde(estado));
    }

    expect([...alcanzables]).toEqual([]);
    for (const prohibido of ESTADOS_DE_PAGO_FIRMA_O_EMISION) {
      expect(alcanzables.has(prohibido)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Casos de uso
// ---------------------------------------------------------------------------

describe("2. Casos de uso: todos rechazan un expediente derivado", () => {
  beforeEach(() => {
    limpiarRegistroDemo();
    limpiarSesionesIdentidadMock();
  });

  /**
   * Cada entrada es un endpoint del flujo que muta el expediente. La lista se
   * contrasta contra el árbol de rutas en el bloque 3: si aparece un endpoint
   * nuevo y no está acá, el test falla.
   */
  const CASOS: readonly {
    readonly ruta: string;
    readonly ejecutar: (repo: RepositorioExpediente) => Promise<{ ok: boolean }>;
  }[] = [
    {
      ruta: "p1/otp/enviar",
      ejecutar: async (repo) => {
        const { provider, lector } = otpFalso();
        return enviarOtpWhatsapp(
          { otpProvider: provider, lectorOtp: lector, expedientes: repo, evidencias: evidenciasFalsas() },
          {
            expedienteId: EXPEDIENTE_ID,
            otpIdPrevio: null,
            numeroIngresado: "981000123",
            autorizacionAceptada: true,
            contexto: CONTEXTO,
          },
        );
      },
    },
    {
      ruta: "p1/otp/reenviar",
      ejecutar: async (repo) => {
        const { provider, lector } = otpFalso();
        return reenviarOtpWhatsapp(
          { otpProvider: provider, lectorOtp: lector, expedientes: repo, evidencias: evidenciasFalsas() },
          { expedienteId: EXPEDIENTE_ID, otpId: "otp-falso", contexto: CONTEXTO },
        );
      },
    },
    {
      ruta: "p1/otp/verificar",
      ejecutar: async (repo) => {
        const { provider, lector } = otpFalso();
        return verificarOtpWhatsapp(
          { otpProvider: provider, lectorOtp: lector, expedientes: repo, evidencias: evidenciasFalsas() },
          { expedienteId: EXPEDIENTE_ID, otpId: "otp-falso", codigoIngresado: "123456", contexto: CONTEXTO },
        );
      },
    },
    {
      ruta: "p2/plan",
      ejecutar: async (repo) =>
        seleccionarPlan(
          { expedientes: repo, evidencias: evidenciasFalsas() },
          { expedienteId: EXPEDIENTE_ID, planId: "CONFIO_PLUS", contexto: CONTEXTO },
        ),
    },
    {
      ruta: "p3/autorizacion",
      ejecutar: async (repo) =>
        registrarAutorizacionInicial(
          { expedientes: repo, evidencias: evidenciasFalsas() },
          { expedienteId: EXPEDIENTE_ID, aceptada: true, contexto: CONTEXTO },
        ),
    },
    {
      ruta: "p4/otp/enviar",
      ejecutar: async (repo) => {
        const { provider, lector } = otpFalso();
        return enviarOtpCorreo(
          { otpProvider: provider, lectorOtp: lector, expedientes: repo, evidencias: evidenciasFalsas() },
          {
            expedienteId: EXPEDIENTE_ID,
            otpIdPrevio: null,
            correoIngresado: "alguien@example.com",
            contexto: CONTEXTO,
          },
        );
      },
    },
    {
      ruta: "p4/otp/reenviar",
      ejecutar: async (repo) => {
        const { provider, lector } = otpFalso();
        return reenviarOtpCorreo(
          { otpProvider: provider, lectorOtp: lector, expedientes: repo, evidencias: evidenciasFalsas() },
          { expedienteId: EXPEDIENTE_ID, otpId: "otp-falso", contexto: CONTEXTO },
        );
      },
    },
    {
      ruta: "p4/otp/verificar",
      ejecutar: async (repo) => {
        const { provider, lector } = otpFalso();
        return verificarOtpCorreo(
          { otpProvider: provider, lectorOtp: lector, expedientes: repo, evidencias: evidenciasFalsas() },
          { expedienteId: EXPEDIENTE_ID, otpId: "otp-falso", codigoIngresado: "123456", contexto: CONTEXTO },
        );
      },
    },
    {
      ruta: "p5/captura",
      ejecutar: async (repo) =>
        registrarCapturaP5(
          {
            identidad: crearIdentityProviderMock(),
            expedientes: repo,
            evidencias: evidenciasFalsas(),
            bloqueos: { buscarPorCedula: async () => [], buscarSucesores: async () => [] },
          },
          { expedienteId: EXPEDIENTE_ID, tipo: "FRENTE", imagen: IMAGEN, contexto: CONTEXTO },
        ),
    },
    {
      ruta: "p5/analisis",
      ejecutar: async (repo) =>
        analizarIdentidadP5(
          {
            identidad: crearIdentityProviderMock(),
            expedientes: repo,
            evidencias: evidenciasFalsas(),
            bloqueos: { buscarPorCedula: async () => [], buscarSucesores: async () => [] },
          },
          { expedienteId: EXPEDIENTE_ID, imagenes: IMAGENES, contexto: CONTEXTO },
        ),
    },
    {
      ruta: "p5/identidad",
      ejecutar: async (repo) =>
        confirmarIdentidadP5(
          {
            identidad: crearIdentityProviderMock(),
            expedientes: repo,
            evidencias: evidenciasFalsas(),
            bloqueos: { buscarPorCedula: async () => [], buscarSucesores: async () => [] },
          },
          {
            expedienteId: EXPEDIENTE_ID,
            imagenes: IMAGENES,
            paisNacimiento: "Paraguay",
            estadoCivil: "Soltero/a",
            autorizacionBiometrica: true,
            contexto: CONTEXTO,
          },
        ),
    },
    {
      ruta: "p6/declaraciones",
      ejecutar: async (repo) =>
        guardarDatosYDeclaracionesP6(
          { expedientes: repo, evidencias: evidenciasFalsas(), nuevoNumeroCaso: () => "CASO-2026-999999" },
          {
            expedienteId: EXPEDIENTE_ID,
            datos: {
              domicilio: datosComplementariosFixture.domicilio,
              ciudad: datosComplementariosFixture.ciudad,
              situacionLaboral: datosComplementariosFixture.situacionLaboral,
              actividad: datosComplementariosFixture.actividad,
              profesion: datosComplementariosFixture.profesion,
              empresa: datosComplementariosFixture.empresa,
              ingresoMensualDeclaradoGs: "8000000",
              beneficiarioTipo: "HEREDEROS_LEGALES",
            },
            declaraciones: {
              "1": "SI", "2": "NO", "3": "NO", "4": "SI",
              "5": "SI", "6": "SI", "7": "SI", "8": "NO",
            },
            contexto: CONTEXTO,
          },
        ),
    },
    /**
     * P7 es el primer endpoint que podría mover dinero, así que es donde la
     * `Regla del sistema` de la Pantalla A —*"no continuar a pago Bancard"*—
     * se juega de verdad. Los dos casos rechazan **antes** de llamar al
     * proveedor: `iniciarPagoP7` mira el estado antes de abrir la operación, y
     * `confirmarPagoP7` corta porque un expediente derivado no tiene `pago`.
     */
    {
      ruta: "p7/pago",
      ejecutar: async (repo) =>
        iniciarPagoP7(
          {
            pagos: pagosQueFallanSiSeUsan(),
            expedientes: repo,
            evidencias: evidenciasFalsas(),
          },
          {
            expedienteId: EXPEDIENTE_ID,
            medio: "QR_BANCARD",
            ruc: "",
            origenLicitoDeFondos: true,
            contexto: CONTEXTO,
          },
        ),
    },
    {
      ruta: "p7/estado",
      ejecutar: async (repo) =>
        confirmarPagoP7(
          {
            pagos: pagosQueFallanSiSeUsan(),
            expedientes: repo,
            evidencias: evidenciasFalsas(),
          },
          { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO },
        ),
    },
    /**
     * P8 es donde se juega la otra mitad de la `Regla del sistema` de la
     * Pantalla A: *"no continuar a … firma Code100 ni emisión mediante
     * SEBAOT"*. Los dos casos cortan **antes** de tocar al proveedor —
     * `iniciarFirmaP8` mira el estado, y `confirmarFirmaP8` corta porque un
     * expediente derivado no tiene acto de firma abierto.
     */
    {
      ruta: "p8/firma",
      ejecutar: async (repo) =>
        iniciarFirmaP8(
          {
            firmas: firmasQueFallanSiSeUsan(),
            pagos: pagosQueFallanSiSeUsan(),
            expedientes: repo,
            evidencias: evidenciasFalsas(),
          },
          { expedienteId: EXPEDIENTE_ID, canal: "WHATSAPP", contexto: CONTEXTO },
        ),
    },
    {
      ruta: "p8/estado",
      ejecutar: async (repo) =>
        confirmarFirmaP8(
          {
            firmas: firmasQueFallanSiSeUsan(),
            pagos: pagosQueFallanSiSeUsan(),
            expedientes: repo,
            evidencias: evidenciasFalsas(),
          },
          { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO },
        ),
    },
    /**
     * La Pantalla B es el desenlace del vencimiento del plazo de firma, no de
     * la derivación: un expediente DERIVADO_MANUAL nunca pagó nada, así que no
     * hay trámite de devolución que abrir ni premio que devolver.
     */
    {
      ruta: "pantalla-b/caso",
      ejecutar: async (repo) =>
        iniciarDevolucionPantallaB(
          { expedientes: repo, evidencias: evidenciasFalsas() },
          { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO },
        ),
    },
    {
      ruta: "demo-panel/devolucion",
      ejecutar: async (repo) =>
        registrarDevolucionEjecutadaPantallaB(
          { expedientes: repo, evidencias: evidenciasFalsas() },
          { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO },
        ),
    },
    /**
     * P9 cierra la `Regla del sistema` de la Pantalla A: *"no continuar a pago
     * Bancard, firma Code100 ni emisión mediante SEBAOT"*. Los tres cortan
     * antes de tocar al proveedor, porque un expediente derivado no está en
     * FIRMADO ni en EMITIDO.
     */
    {
      ruta: "p9/resumen",
      ejecutar: async (repo) =>
        emitirPolizaP9(
          {
            polizas: polizasQueFallanSiSeUsan(),
            expedientes: repo,
            evidencias: evidenciasFalsas(),
          },
          { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO },
        ),
    },
    {
      ruta: "p9/estado",
      ejecutar: async (repo) =>
        consultarEmisionP9(
          {
            polizas: polizasQueFallanSiSeUsan(),
            expedientes: repo,
            evidencias: evidenciasFalsas(),
          },
          { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO },
        ),
    },
    {
      ruta: "p9/comunicaciones",
      ejecutar: async (repo) =>
        registrarComunicacionesComercialesP9(
          {
            polizas: polizasQueFallanSiSeUsan(),
            expedientes: repo,
            evidencias: evidenciasFalsas(),
          },
          { expedienteId: EXPEDIENTE_ID, acepta: true, contexto: CONTEXTO },
        ),
    },
    {
      ruta: "p8/resumen",
      ejecutar: async (repo) =>
        generarPaqueteDocumental(
          {
            expedientes: repo,
            archivos: archivosQueFallanSiSeUsan(),
            evidencias: evidenciasFalsas(),
          },
          { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO },
        ),
    },
  ];

  it.each(CASOS.map((caso) => [caso.ruta, caso] as const))(
    "POST /api/%s rechaza y deja el expediente intacto",
    async (_ruta, caso) => {
      const derivado = await expedienteDerivado();
      const { repo, actual } = repositorioFalso(derivado);

      const resultado = await caso.ejecutar(repo);

      expect(resultado.ok, `${caso.ruta} no rechazó un expediente DERIVADO_MANUAL`).toBe(false);
      // Ni el estado ni ningún otro campo pudo moverse.
      expect(actual()).toEqual(derivado);
      expect(actual().estado).toBe("DERIVADO_MANUAL");
      expect(actual().pago).toBeNull();
      expect(actual().paqueteDocumental).toBeNull();
      expect(actual().firma).toBeNull();
    },
  );

  it("el expediente derivado nunca tuvo pago, paquete ni firma", async () => {
    const derivado = await expedienteDerivado();

    expect(derivado.pago).toBeNull();
    expect(derivado.paqueteDocumental).toBeNull();
    expect(derivado.firma).toBeNull();
    expect(derivado.numeroCasoDerivacion).toBe(NUMERO_CASO_FIJO);
    // Y su historial no pasó por ningún estado de pago, firma o emisión.
    for (const entrada of derivado.historial) {
      expect(ESTADOS_DE_PAGO_FIRMA_O_EMISION).not.toContain(entrada.estado);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Inventario de rutas
// ---------------------------------------------------------------------------

const RAIZ_API = join(process.cwd(), "src", "app", "api");

function rutasDeApi(directorio: string = RAIZ_API): readonly string[] {
  const encontradas: string[] = [];
  for (const entrada of readdirSync(directorio)) {
    const camino = join(directorio, entrada);
    if (statSync(camino).isDirectory()) {
      encontradas.push(...rutasDeApi(camino));
    } else if (entrada === "route.ts") {
      encontradas.push(relative(RAIZ_API, directorio).split(sep).join("/"));
    }
  }
  return encontradas.sort();
}

/**
 * Quita comentarios de bloque y de línea. Los handlers **documentan** en prosa
 * que la transición la ejecuta `transicionarExpediente` en el dominio; lo que
 * este test tiene que mirar es el código, no lo que dicen los comentarios.
 */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("3. Inventario de rutas de la API", () => {
  const rutas = rutasDeApi();

  it("encuentra los Route Handlers del flujo", () => {
    expect(rutas.length).toBeGreaterThan(0);
  });

  it.each(rutas)("%s no transiciona el expediente por su cuenta", (ruta) => {
    const codigo = soloCodigo(readFileSync(join(RAIZ_API, ruta, "route.ts"), "utf8"));

    // La única transición del sistema vive en `src/domain/expediente.ts`. Un
    // handler que lo importe podría saltearse la validación de estado de su
    // caso de uso y mover un expediente derivado.
    expect(codigo).not.toMatch(/from\s+["']@\/domain\/expediente["']/);
    expect(codigo).not.toMatch(/\btransicionarExpediente\s*\(/);
    expect(codigo).not.toMatch(/\bregistrarDeclaracionesP6\s*\(/);
    // Tampoco puede escribir en el repositorio del expediente por su cuenta:
    // persistir es responsabilidad del caso de uso, después de validar.
    expect(codigo).not.toMatch(/\.guardar\s*\(/);
    expect(codigo).not.toMatch(/\bcrearExpedienteRepository\(\)\.(guardar|crear)\b/);
  });

  it("todo endpoint que muta el expediente está cubierto por el bloque 2", () => {
    /**
     * Endpoints de solo lectura o ajenos al expediente: no pueden moverlo de
     * estado, así que no necesitan una prueba de rechazo. Cualquier ruta nueva
     * que no esté acá ni en `CASOS` hace fallar este test a propósito — es el
     * trinquete que va a saltar cuando se implemente P7 (pago), P8 (firma) o
     * P9 (emisión).
     */
    const SOLO_LECTURA: readonly string[] = [
      // La consola administrativa consulta y autentica; no transiciona nada.
      "admin-consola/buscar",
      "admin-consola/expediente",
      "admin-consola/sesion",
      // Remite el caso a Alianza (simulado): solo agrega evidencia
      // append-only al expediente, nunca lo transiciona ni lo edita.
      "admin-consola/enviar-alianza",
      "demo-panel/persona",
      // Actúan sobre el estado en memoria del Code100 simulado y sobre el
      // plazo que se le va a poner a los próximos pagos: no leen ni escriben
      // ningún expediente. Ambas exigen DEMO_MODE=true y la clave del panel.
      "demo-panel/fallas",
      "demo-panel/firma",
      "demo-panel/plazo-firma",
      // Solo borra cookies del navegador: no toca el expediente en la base.
      "demo-panel/reiniciar",
      "demo-panel/sesion",
      "expediente/canales",
      "expediente/caso",
      "expediente/plan",
      // Abre una sesión de prueba de vida contra el proveedor (AWS Rekognition
      // Face Liveness). No lee ni escribe ningún expediente: solo necesita el
      // id de sesión de la cookie para no abrir sesiones sin contexto. El
      // veredicto se registra después, por `p5/captura`, que sí está en CASOS.
      "p5/liveness-sesion",
      // Proyecta el bloque 1 de P7 desde el expediente; `leerResumenPagoP7`
      // devuelve null si no está en DECLARACIONES_OK o PAGO_CONFIRMADO.
      "p7/resumen",
      // Sirve los PDF ya cerrados del propio expediente. Un derivado no tiene
      // `paqueteDocumental`, así que responde 409 sin leer nada de S3.
      "p8/documento",
    ];

    /**
     * Escriben en la base, pero **creando un expediente nuevo**: nunca mueven
     * el original. Cada uno tiene su prueba dedicada en el bloque 4.
     */
    const CREAN_SIN_TOCAR_EL_ORIGINAL: readonly string[] = ["admin-consola/reinicio"];

    const CUBIERTAS: readonly string[] = [
      "p1/otp/enviar",
      "p1/otp/reenviar",
      "p1/otp/verificar",
      "p2/plan",
      "p3/autorizacion",
      "p4/otp/enviar",
      "p4/otp/reenviar",
      "p4/otp/verificar",
      "p5/analisis",
      "p5/captura",
      "p5/identidad",
      "p6/declaraciones",
      "p7/estado",
      "p7/pago",
      "p8/estado",
      "p8/firma",
      "p8/resumen",
      "pantalla-b/caso",
      "demo-panel/devolucion",
      "p9/comunicaciones",
      "p9/estado",
      "p9/resumen",
    ];

    /**
     * Puede escribir, pero no sobre un expediente derivado: el vencimiento del
     * plazo de firma solo alcanza a PAGO_CONFIRMADO y PAQUETE_GENERADO, y
     * devuelve `ok: true` sin tocar nada en cualquier otro estado — por eso no
     * entra en `CASOS`, que exige un rechazo. Su prueba es la de abajo.
     */
    const INMUTABLES_SOBRE_UN_DERIVADO: readonly string[] = ["p8/vencimiento"];

    const conocidas = new Set([
      ...SOLO_LECTURA,
      ...CUBIERTAS,
      ...CREAN_SIN_TOCAR_EL_ORIGINAL,
      ...INMUTABLES_SOBRE_UN_DERIVADO,
    ]);
    const desconocidas = rutas.filter((ruta) => !conocidas.has(ruta));

    expect(
      desconocidas,
      "Hay endpoints nuevos sin prueba de que rechacen un expediente DERIVADO_MANUAL. " +
        "Agregalos a CASOS (si mutan el expediente) o a SOLO_LECTURA.",
    ).toEqual([]);
  });

  it("POST /api/p8/vencimiento deja intacto un expediente derivado", async () => {
    const derivado = await expedienteDerivado();
    const { repo, actual } = repositorioFalso(derivado);

    const resultado = await vencerPlazoFirmaP8(
      {
        firmas: firmasQueFallanSiSeUsan(),
        pagos: pagosQueFallanSiSeUsan(),
        expedientes: repo,
        evidencias: evidenciasFalsas(),
      },
      { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO },
    );

    expect(resultado.ok && resultado.vencio).toBe(false);
    expect(actual()).toEqual(derivado);
    expect(actual().estado).toBe("DERIVADO_MANUAL");
  });
});

// ---------------------------------------------------------------------------
// 4. La consola administrativa tampoco es una salida
// ---------------------------------------------------------------------------

/**
 * `POST /api/admin-consola/reinicio` es el único endpoint del sistema
 * autorizado a escribir cuando hay un expediente derivado de por medio. La
 * especificación de la consola (`docs/CONSOLA_ADMINISTRATIVA.md` §5.1) es
 * tajante: *"El expediente original nunca cambia de estado — DERIVADO_MANUAL
 * sigue siendo terminal en el flujo digital [...]. Esto es innegociable, no se
 * toca aunque sea vía consola."*
 *
 * Estos tests lo verifican sobre el mismo expediente derivado del bloque 2.
 */
describe("4. La consola administrativa no reactiva un expediente derivado", () => {
  function bancoConsola(original: Expediente) {
    const todos = new Map<string, Expediente>([[original.id, original]]);
    const registros: RegistroEvidencia[] = [];
    let contador = 0;

    const expedientes: RepositorioExpediente = {
      async obtenerPorId(id) {
        return todos.get(id) ?? null;
      },
      async crear(expediente) {
        todos.set(expediente.id, expediente);
      },
      async guardar(expediente) {
        todos.set(expediente.id, expediente);
      },
    };

    return {
      todos,
      registros,
      deps: {
        expedientes,
        evidencias: {
          async guardar(registro: RegistroEvidencia) {
            registros.push(registro);
          },
          async obtenerHistorial(expedienteId: string) {
            return registros.filter((registro) => registro.expedienteId === expedienteId);
          },
        },
        sucesores: {
          buscarSucesores: async (id: string) =>
            [...todos.values()].filter((e) => e.expedienteAnteriorId === id),
        },
        ahora: () => AHORA,
        nuevoId: () => `nuevo-${++contador}`,
      },
    };
  }

  it("crea un expediente nuevo en INICIADO y deja el derivado exactamente igual", async () => {
    const original = await expedienteDerivado();
    const banco = bancoConsola(original);

    const resultado = await reiniciarExpediente(banco.deps, {
      expedienteId: original.id,
      justificativo: "SOLICITUD_CLIENTE",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    // El original, byte por byte, como estaba.
    expect(banco.todos.get(original.id)).toEqual(original);
    expect(banco.todos.get(original.id)?.estado).toBe("DERIVADO_MANUAL");

    // El nuevo arranca de cero y enlazado.
    const nuevo = banco.todos.get(resultado.expedienteNuevoId);
    expect(nuevo?.estado).toBe("INICIADO");
    expect(nuevo?.expedienteAnteriorId).toBe(original.id);
    expect(nuevo?.pago).toBeNull();
    expect(nuevo?.paqueteDocumental).toBeNull();
    expect(nuevo?.firma).toBeNull();
    // Y no hereda nada del derivado: ni declaraciones ni número de caso.
    expect(nuevo?.declaraciones).toBeNull();
    expect(nuevo?.numeroCasoDerivacion).toBeNull();
  });

  it("el expediente nuevo tampoco puede saltar a pago, firma o emisión", async () => {
    const original = await expedienteDerivado();
    const banco = bancoConsola(original);

    const resultado = await reiniciarExpediente(banco.deps, {
      expedienteId: original.id,
      justificativo: "ERROR_INGRESO",
      contexto: CONTEXTO,
    });
    if (!resultado.ok) throw new Error("se esperaba un reinicio exitoso");

    const nuevo = banco.todos.get(resultado.expedienteNuevoId);
    if (!nuevo) throw new Error("no se creó el expediente nuevo");

    // Empieza en INICIADO: tiene que recorrer P1–P6 otra vez como cualquiera.
    for (const destino of ESTADOS_DE_PAGO_FIRMA_O_EMISION) {
      expect(transicionarExpediente(nuevo, destino).ok).toBe(false);
    }
  });

  it("deja evidencia del reinicio en el expediente viejo, sin borrar la anterior", async () => {
    const original = await expedienteDerivado();
    const banco = bancoConsola(original);

    await reiniciarExpediente(banco.deps, {
      expedienteId: original.id,
      justificativo: "OTRO",
      detalleLibre: "El proveedor devolvió un dato equivocado.",
      contexto: CONTEXTO,
    });

    const enOriginal = banco.registros.filter((r) => r.expedienteId === original.id);
    expect(enOriginal).toHaveLength(1);
    expect(enOriginal[0]?.paso).toBe(PASO_EVIDENCIA_REINICIO_ADMIN);
    expect(enOriginal[0]?.detalle).toContain("justificativo=OTRO");
    expect(enOriginal[0]?.detalle).toContain("estadoOriginal=DERIVADO_MANUAL");
  });

  it("rechaza el reinicio si el expediente no está en un estado terminal sin póliza", async () => {
    const enCurso = avanzarHastaIdentidadVerificada(crearExpediente(EXPEDIENTE_ID));
    const banco = bancoConsola(enCurso);

    const resultado = await reiniciarExpediente(banco.deps, {
      expedienteId: enCurso.id,
      justificativo: "SOLICITUD_CLIENTE",
      contexto: CONTEXTO,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toBe("ESTADO_NO_REINICIABLE");
  });

  it("no permite dos reinicios del mismo expediente", async () => {
    const original = await expedienteDerivado();
    const banco = bancoConsola(original);
    const entrada = {
      expedienteId: original.id,
      justificativo: "SOLICITUD_CLIENTE",
      contexto: CONTEXTO,
    };

    expect((await reiniciarExpediente(banco.deps, entrada)).ok).toBe(true);
    const segundo = await reiniciarExpediente(banco.deps, entrada);

    expect(segundo.ok).toBe(false);
    if (segundo.ok) return;
    expect(segundo.motivo).toBe("YA_REINICIADO");
  });

  it("exige justificativo, y explicación libre cuando es «Otro»", async () => {
    const original = await expedienteDerivado();
    const banco = bancoConsola(original);

    const sinJustificativo = await reiniciarExpediente(banco.deps, {
      expedienteId: original.id,
      justificativo: "",
      contexto: CONTEXTO,
    });
    expect(sinJustificativo.ok).toBe(false);

    const otroSinDetalle = await reiniciarExpediente(banco.deps, {
      expedienteId: original.id,
      justificativo: "OTRO",
      detalleLibre: "   ",
      contexto: CONTEXTO,
    });
    expect(otroSinDetalle.ok).toBe(false);
    if (otroSinDetalle.ok) return;
    expect(otroSinDetalle.motivo).toBe("DETALLE_REQUERIDO");
  });
});

// ---------------------------------------------------------------------------
// 5. El bloqueo por cédula que levanta el reinicio
// ---------------------------------------------------------------------------

describe("5. Bloqueo de nuevo registro por cédula", () => {
  it("un expediente derivado sin sucesor bloquea", async () => {
    const derivado = await expedienteDerivado();
    expect(expedientesQueBloquean([derivado]).map((e) => e.id)).toEqual([derivado.id]);
  });

  it("deja de bloquear cuando existe un sucesor que lo declara como anterior", async () => {
    const derivado = await expedienteDerivado();
    const sucesor = { ...crearExpediente("EXP-NUEVO"), expedienteAnteriorId: derivado.id };

    expect(expedientesQueBloquean([derivado, sucesor])).toEqual([]);
  });

  it("P5 rechaza una cédula bloqueada, y el bloqueo no depende de un flag editable", async () => {
    const derivado = await expedienteDerivado();
    const bloqueo = await evaluarBloqueoPorCedula(
      { buscarPorCedula: async () => [derivado], buscarSucesores: async () => [] },
      "9323336",
    );

    expect(bloqueo.bloqueada).toBe(true);
    // Lo que sale del bloqueo es id, estado y número de caso: nunca una
    // respuesta médica ni la condición PEP (regla inviolable #7).
    expect(JSON.stringify(bloqueo)).not.toContain("condicionPep");
    expect(JSON.stringify(bloqueo)).not.toContain("estadoDeSalud");
  });

  it("el sucesor levanta el bloqueo aunque no aparezca en la lista por cédula", async () => {
    // El sucesor de un reinicio nace `INICIADO`, sin cédula: `buscarPorCedula`
    // no lo devuelve. La superación tiene que verse igual, por el enlace de
    // sucesión — si no, el reinicio de la consola no serviría para nada.
    const derivado = await expedienteDerivado();
    const sucesor = { ...crearExpediente("EXP-NUEVO"), expedienteAnteriorId: derivado.id };

    const bloqueo = await evaluarBloqueoPorCedula(
      {
        buscarPorCedula: async () => [derivado],
        buscarSucesores: async (id) => (id === derivado.id ? [sucesor] : []),
      },
      "9323336",
    );

    expect(bloqueo.bloqueada).toBe(false);
    expect(bloqueo.expedientesQueBloquean).toEqual([]);
  });
});
