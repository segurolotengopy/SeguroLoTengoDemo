/**
 * Adaptador mock de `PolicyIssuer` (P9 · Contratación aceptada).
 *
 * Simula a SEBAOT, el sistema con el que Alianza Garantía valida la solicitud y
 * emite la póliza (`docs/Tabla de Integraciones externas - Tabla.csv`). Sin
 * red, sin credenciales, sin póliza real.
 *
 * Reproduce los dos momentos que la pantalla necesita distinguir:
 *
 *   - `emitirPoliza` ≈ SeguroLoTengo remite el expediente y Alianza lo valida
 *     automáticamente: la póliza queda `EN_PROCESO_DE_EMISION`. Es lo que P9
 *     muestra como `Solicitud aceptada ✓` + `Póliza en preparación ⋯`.
 *   - `consultarEstadoPoliza` ≈ el sondeo posterior: pasado el tiempo de
 *     preparación, la póliza pasa a `EMITIDA` con su fecha.
 *
 * ## El número de póliza es el correlativo de la propuesta
 *
 * SEBAOT **no acuña un número propio**: la póliza conserva el correlativo de la
 * Solicitud (P8, leyendas finales: *"la póliza conserva el correlativo de la
 * Solicitud y el identificador de Bancard"*; fila 47 de la matriz de
 * cumplimiento — *"Vincular póliza, Solicitud, FIPF, pago y firmas mediante
 * correlativos o hashes"*, Res. SS SG. 215/17, punto 14; Ley 6822/21, arts.
 * 44-46). Por eso `numeroPoliza` es igual a `propuestaId` y este adaptador no
 * genera ningún identificador nuevo.
 *
 * ## No se genera Nota de Cobertura
 *
 * Ni acá ni en ningún otro lado: no hay método que la produzca, no hay tipo que
 * la represente y P9 lo dice explícitamente (CLAUDE.md → "Qué no hacer"). El
 * único documento que emite Alianza es la póliza, y la factura la emite por
 * SIFEN (fila 40 de la matriz).
 *
 * ## La factura es de Alianza
 *
 * `consultarEstadoFacturaElectronica` devuelve estado y referencia, nada más:
 * SeguroLoTengo no la emite ni la almacena. Arranca `PENDIENTE` y pasa a
 * `EMITIDA` un poco después que la póliza, que es el orden real (primero se
 * emite el contrato, después se factura).
 *
 * ## Cómo simula el paso del tiempo
 *
 * Igual que `payment-provider.ts`: no usa `setTimeout` —cada Route Handler
 * construye su propio adaptador por request y un temporizador se perdería entre
 * llamadas— sino un instante `emitibleDesde` guardado en la emisión, que
 * `consultarEstadoPoliza` compara contra el reloj. Así el sondeo de P9 ve
 * `EN EMISIÓN` unos segundos y después la póliza emitida, y los tests pueden
 * fijar el reloj en vez de esperar.
 */
import { randomUUID } from "node:crypto";
import { estadoCompartidoDemo } from "./estado-compartido";
import type {
  EmitirPolizaInput,
  EstadoFacturaElectronica,
  EstadoPoliza,
  PolicyIssuer,
  ResultadoEmisionPoliza,
  ResultadoFacturaElectronica,
} from "../../ports/policy-issuer";

/**
 * Cuánto tarda Alianza en emitir la póliza una vez aceptada la solicitud.
 * P9 dice *"en breves momentos"*; ocho segundos alcanzan para que la
 * demostración muestre el badge `EN EMISIÓN` y después el cambio.
 */
export const DEMORA_EMISION_MS = 8_000;

/** La factura sale un poco después: primero el contrato, después el comprobante. */
export const DEMORA_FACTURA_MS = 12_000;

export interface PolizaMock {
  readonly numeroPoliza: string;
  readonly expedienteId: string;
  readonly referenciaBancard: string;
  /** Huella del documento firmado que respalda la emisión (D-11). */
  readonly hashDocumentoFirmado: string;
  readonly solicitadaEn: string;
  readonly emitibleDesde: string;
  readonly facturableDesde: string;
  readonly referenciaFactura: string;
  estado: EstadoPoliza;
  emitidaEn: string | null;
  estadoFactura: EstadoFacturaElectronica;
}

/**
 * Módulo-level a propósito: `GET /api/p9/resumen` ordena la emisión y
 * `GET /api/p9/estado` la consulta desde otro handler, en otro adaptador, del
 * mismo proceso.
 */
const polizas = estadoCompartidoDemo("polizas.emitidas", () => new Map<string, PolizaMock>());

export interface OpcionesPolicyIssuerMock {
  readonly ahora?: () => Date;
  readonly demoraEmisionMs?: number;
  readonly demoraFacturaMs?: number;
}

function referenciaDeFactura(): string {
  // Formato análogo a un CDC de SIFEN: identifica el comprobante, no contiene
  // ningún dato de la persona.
  return `MOCK-SIFEN-${randomUUID().slice(0, 13).toUpperCase()}`;
}

export function crearPolicyIssuerMock(opciones: OpcionesPolicyIssuerMock = {}): PolicyIssuer {
  const ahora = opciones.ahora ?? (() => new Date());
  const demoraEmisionMs = opciones.demoraEmisionMs ?? DEMORA_EMISION_MS;
  const demoraFacturaMs = opciones.demoraFacturaMs ?? DEMORA_FACTURA_MS;

  /** Avanza la póliza y la factura cuando el reloj alcanzó sus instantes. */
  function avanzarSiCorresponde(poliza: PolizaMock): PolizaMock {
    const instante = ahora().toISOString();

    if (poliza.estado === "EN_PROCESO_DE_EMISION" && instante >= poliza.emitibleDesde) {
      poliza.estado = "EMITIDA";
      poliza.emitidaEn = instante;
    }
    // La factura nunca se adelanta a la póliza: si el contrato todavía no
    // existe, no hay nada que facturar.
    if (poliza.estado === "EMITIDA" && poliza.estadoFactura === "PENDIENTE" && instante >= poliza.facturableDesde) {
      poliza.estadoFactura = "EMITIDA";
    }
    return poliza;
  }

  function proyectar(poliza: PolizaMock): ResultadoEmisionPoliza {
    return {
      numeroPoliza: poliza.numeroPoliza,
      estado: poliza.estado,
      emitidaEn: poliza.emitidaEn,
    };
  }

  return {
    async emitirPoliza(input: EmitirPolizaInput): Promise<ResultadoEmisionPoliza> {
      // Idempotente por número de póliza: remitir dos veces el mismo expediente
      // no emite dos pólizas ni reinicia el reloj de emisión. Es la garantía que
      // pide CLAUDE.md para los callbacks de proveedores, aplicada acá porque
      // P9 puede recargarse mientras la póliza se prepara.
      const existente = polizas.get(input.propuestaId);
      if (existente) return proyectar(avanzarSiCorresponde(existente));

      const solicitada = ahora();
      const poliza: PolizaMock = {
        // Sin número nuevo: la póliza conserva el correlativo de la Solicitud.
        numeroPoliza: input.propuestaId,
        expedienteId: input.expedienteId,
        referenciaBancard: input.referenciaBancard,
        // Un documento, una huella (D-11): no hay forma de pedir una emisión
        // con parte del instrumento sin firmar.
        hashDocumentoFirmado: input.firma.hashDocumentoFirmado,
        solicitadaEn: solicitada.toISOString(),
        emitibleDesde: new Date(solicitada.getTime() + demoraEmisionMs).toISOString(),
        facturableDesde: new Date(solicitada.getTime() + demoraFacturaMs).toISOString(),
        referenciaFactura: referenciaDeFactura(),
        estado: "EN_PROCESO_DE_EMISION",
        emitidaEn: null,
        estadoFactura: "PENDIENTE",
      };

      polizas.set(poliza.numeroPoliza, poliza);
      return proyectar(avanzarSiCorresponde(poliza));
    },

    async consultarEstadoPoliza(numeroPoliza: string): Promise<ResultadoEmisionPoliza> {
      const poliza = polizas.get(numeroPoliza);
      if (!poliza) {
        // El puerto no admite `null` acá: una consulta sobre una póliza que
        // SEBAOT no conoce se responde como no emitida, no como emitida sin
        // fecha, que sería peor.
        return { numeroPoliza, estado: "EN_PROCESO_DE_EMISION", emitidaEn: null };
      }
      return proyectar(avanzarSiCorresponde(poliza));
    },

    async consultarEstadoFacturaElectronica(numeroPoliza: string): Promise<ResultadoFacturaElectronica> {
      const poliza = polizas.get(numeroPoliza);
      if (!poliza) return { referencia: null, estado: "PENDIENTE" };

      avanzarSiCorresponde(poliza);
      return {
        // La referencia solo existe cuando el comprobante existe.
        referencia: poliza.estadoFactura === "EMITIDA" ? poliza.referenciaFactura : null,
        estado: poliza.estadoFactura,
      };
    },
  };
}

/**
 * Canal de lectura EXCLUSIVO del panel de demo y de los tests. Ningún Route
 * Handler del flujo P0–P9 debe importar esto — el flujo consulta por el puerto.
 */
export function listarPolizasMock(): readonly Readonly<PolizaMock>[] {
  return [...polizas.values()].sort((a, b) => (a.solicitadaEn < b.solicitadaEn ? 1 : -1));
}

/** Solo para tests: deja el registro de pólizas simuladas en blanco. */
export function limpiarPolizasMock(): void {
  polizas.clear();
}
