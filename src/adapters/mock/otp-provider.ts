/**
 * Adaptador mock de `OtpProvider` (P1 · WhatsApp y P4 · correo).
 *
 * Simula al proveedor de mensajería (Infobip, según
 * `docs/Tabla de Integraciones externas - Tabla.csv`) sin salir a la red: no
 * hay `fetch`, no hay credenciales. Toda la lógica de vigencia, intentos,
 * uso único y cooldown la hace `OtpRepository` contra DynamoDB — este
 * adaptador no la reimplementa, así el mock y el futuro adaptador oficial
 * comparten exactamente el mismo comportamiento de negocio y la misma suite
 * de contrato (`src/ports/__tests__/otp-provider.contract.ts`).
 *
 * Regla inviolable #2 — el código en claro:
 *   - Nunca se persiste (el repositorio guarda solo el HMAC).
 *   - Nunca sale por `OtpProvider`: mirá los tipos de `ResultadoEnvioOtp`,
 *     no hay campo donde ponerlo.
 *   - En modo demo se retiene en memoria del proceso y se lee por un canal
 *     aparte (`obtenerEnvioDemo`), que es lo único que el panel de demo usa.
 *     Con `DEMO_MODE` apagado no se retiene nada: `obtenerEnvioDemo`
 *     devuelve `null` incluso para un OTP recién enviado.
 *
 * El registro de demo es memoria del proceso, no base: en un despliegue con
 * varias instancias, el panel solo ve los OTP emitidos por la instancia que
 * lo atiende. Es aceptable porque es una ayuda de demostración, no parte del
 * flujo ni de la evidencia probatoria.
 */
import { randomUUID } from "node:crypto";
import { INTENTOS_MAXIMOS_OTP, VIGENCIA_OTP_MS } from "../../domain/reglas-otp";
import { canalCoherenteConProposito } from "../../ports/otp-provider";
import type {
  OtpProvider,
  ResultadoEnvioOtp,
  ResultadoVerificacionOtp,
  SolicitudEnvioOtp,
  SolicitudVerificacionOtp,
} from "../../ports/otp-provider";
import type { OtpRepository } from "../../repositories/otp-repository";
import { estadoCompartidoDemo } from "./estado-compartido";

/** Lo que el panel de demo puede ver de un envío simulado. */
export interface EnvioDemo {
  readonly otpId: string;
  readonly codigo: string;
  readonly destino: string;
  readonly referenciaEnvio: string;
  readonly enviadoEn: string;
}

/**
 * Módulo-level a propósito: cada Route Handler construye su propio adaptador
 * por request, y el panel de demo (otro handler) tiene que poder leer el
 * código emitido por el handler del flujo dentro del mismo proceso.
 */
const registroDemo = estadoCompartidoDemo("otp.registro-demo", () => new Map<string, EnvioDemo>());

/**
 * Fallo puntual que el panel de demo puede forzar sobre el próximo envío.
 *
 * Ninguno de los dos abre un camino nuevo en el código: los dos producen un
 * OTP **real** en un estado que el repositorio ya sabe rechazar. `EXPIRADO`
 * corre la hora de creación hacia atrás para que nazca vencido;
 * `INTENTOS_AGOTADOS` quema los tres intentos con códigos incorrectos. Así lo
 * que se ve en la demostración es exactamente la misma validación que corre en
 * producción, no una simulación de ella.
 */
export type FallaOtpDemo = "EXPIRADO" | "INTENTOS_AGOTADOS";

export interface OpcionesOtpProviderMock {
  readonly otpRepository: OtpRepository;
  /**
   * Si retener o no el código en claro en memoria para el panel de demo.
   * Default: `DEMO_MODE === "true"`. Los tests lo pasan explícito.
   */
  readonly retenerCodigoParaPanelDemo?: boolean;
  readonly ahora?: () => string;
  /** Falla a forzar en el próximo envío (palanca del panel de demo). */
  readonly fallaForzada?: () => FallaOtpDemo | null;
}

function referenciaDeEnvio(canal: string): string {
  // Formato análogo al message id que devolvería el proveedor real; es un
  // identificador de entrega para la evidencia, nunca el código.
  return `MOCK-${canal}-${randomUUID()}`;
}

export function crearOtpProviderMock(opciones: OpcionesOtpProviderMock): OtpProvider {
  const {
    otpRepository,
    retenerCodigoParaPanelDemo = process.env.DEMO_MODE === "true",
    ahora = () => new Date().toISOString(),
    fallaForzada = () => null,
  } = opciones;

  function registrarEnvioDemo(envio: EnvioDemo): void {
    if (!retenerCodigoParaPanelDemo) return;
    registroDemo.set(envio.otpId, envio);
  }

  /**
   * Quema los tres intentos del OTP recién creado, con códigos que no son el
   * suyo. No hace falta saber cuál es el correcto: cualquier código distinto
   * cuenta como intento fallido, y `INTENTOS_AGOTADOS` lo decide el
   * repositorio con la misma regla de siempre.
   */
  async function agotarIntentos(otpId: string, codigoReal: string, instante: string): Promise<void> {
    const incorrecto = codigoReal === "000000" ? "999999" : "000000";
    for (let intento = 0; intento < INTENTOS_MAXIMOS_OTP; intento += 1) {
      await otpRepository.verificarCodigo(otpId, incorrecto, instante);
    }
  }

  return {
    async enviarOtp(solicitud: SolicitudEnvioOtp): Promise<ResultadoEnvioOtp> {
      const { expedienteId, proposito, destino } = solicitud;

      if (!canalCoherenteConProposito(proposito, destino.canal)) {
        return {
          ok: false,
          motivo: "ERROR_ENVIO",
          detalle: `El canal ${destino.canal} no corresponde al propósito ${proposito}.`,
        };
      }

      const enviadoEn = ahora();
      const falla = fallaForzada();

      // Con `EXPIRADO` el OTP se crea con la hora corrida hacia atrás: el
      // repositorio le calcula `expiraEn = creación + 5 minutos`, que ya pasó.
      const creadoEn =
        falla === "EXPIRADO"
          ? new Date(new Date(enviadoEn).getTime() - VIGENCIA_OTP_MS - 1_000).toISOString()
          : enviadoEn;

      const creado = await otpRepository.crear({
        expedienteId,
        proposito,
        canal: destino.canal,
        destino: destino.valor,
        ahora: creadoEn,
      });

      if (falla === "INTENTOS_AGOTADOS") {
        await agotarIntentos(creado.otpId, creado.codigo, enviadoEn);
      }

      const referenciaEnvio = referenciaDeEnvio(destino.canal);
      registrarEnvioDemo({
        otpId: creado.otpId,
        codigo: creado.codigo,
        destino: destino.valor,
        referenciaEnvio,
        enviadoEn,
      });

      // Acá el adaptador oficial haría la llamada al proveedor. El mock da
      // la entrega por exitosa y descarta `creado.codigo` al salir de este
      // scope: no vuelve en el resultado (los tipos no lo permiten) ni se
      // loguea.
      return { ok: true, otpId: creado.otpId, expiraEn: creado.expiraEn, referenciaEnvio };
    },

    async verificarOtp(solicitud: SolicitudVerificacionOtp): Promise<ResultadoVerificacionOtp> {
      const resultado = await otpRepository.verificarCodigo(
        solicitud.otpId,
        solicitud.codigoIngresado,
        ahora(),
      );
      // Consumido: no hay razón para seguir reteniendo el código en claro
      // ni siquiera en modo demo.
      if (resultado.ok) registroDemo.delete(solicitud.otpId);
      return resultado;
    },

    async reenviarOtp(otpId: string): Promise<ResultadoEnvioOtp> {
      const enviadoEn = ahora();
      const rotado = await otpRepository.registrarReenvio(otpId, enviadoEn);

      if (!rotado.ok) {
        if (rotado.motivo === "REENVIO_BLOQUEADO") {
          return { ok: false, motivo: "REENVIO_BLOQUEADO", segundosRestantes: rotado.segundosRestantes };
        }
        return { ok: false, motivo: "ERROR_ENVIO", detalle: "No existe un OTP con ese identificador." };
      }

      const registro = await otpRepository.obtener(otpId);
      const canal = registro?.canal ?? "WHATSAPP";
      const referenciaEnvio = referenciaDeEnvio(canal);
      registrarEnvioDemo({
        otpId,
        codigo: rotado.codigo,
        destino: registro?.destino ?? "",
        referenciaEnvio,
        enviadoEn,
      });

      return { ok: true, otpId, expiraEn: rotado.expiraEn, referenciaEnvio };
    },
  };
}

/**
 * Canal de lectura EXCLUSIVO del panel de demo (`/demo-panel`, protegido por
 * `DEMO_PANEL_KEY`). Ningún Route Handler del flujo P0–P9 puede importar
 * esta función: si el código sale por la API del flujo, se viola la regla
 * inviolable #2. Ver el test
 * `src/app/api/p1/__tests__/no-filtra-codigo-otp.test.ts`.
 */
export function obtenerEnvioDemo(otpId: string): EnvioDemo | null {
  return registroDemo.get(otpId) ?? null;
}

/**
 * Todos los envíos simulados vivos en esta instancia, del más nuevo al más
 * viejo. Mismo canal exclusivo del panel de demo que `obtenerEnvioDemo`.
 */
export function listarEnviosDemo(): readonly EnvioDemo[] {
  return [...registroDemo.values()].sort((a, b) => (a.enviadoEn < b.enviadoEn ? 1 : -1));
}

/** Solo para tests: deja el registro de demo en blanco entre casos. */
export function limpiarRegistroDemo(): void {
  registroDemo.clear();
}
