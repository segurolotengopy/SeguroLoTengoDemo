/**
 * Clasificación de la evidencia por integración externa, para el visor de
 * evidencia compartido entre el panel de demo y la consola administrativa
 * (`docs/CONSOLA_ADMINISTRATIVA.md` §4: el registro de evidencia es el mismo
 * componente en ambos lados).
 *
 * Cada `RegistroEvidencia.paso` pertenece al ciclo de a lo sumo un puerto de
 * `src/ports/`. La correspondencia vive acá —y no en el componente— porque es
 * una regla del dominio, no de presentación: decide qué llamada se le imputa a
 * qué proveedor cuando cumplimiento audita el expediente.
 *
 * Dos ausencias deliberadas:
 * - `ComplianceProvider` no aparece: P6 decide con la respuesta autodeclarada,
 *   nunca con una consulta externa (documentado en
 *   `src/ports/compliance-provider.ts` y en `src/app/api/p6/_dependencias.ts`).
 * - `EvidenceStore` no aparece: es el registro mismo, no un paso registrado.
 *
 * Los pasos sin integración (P2, P3, P6, paquete documental, vencimiento,
 * Pantalla B, consola administrativa) devuelven `null`: son actos del dominio
 * que quedan en evidencia pero no imputan a ningún proveedor.
 */
import type { RegistroEvidencia } from "./tipos";

export type IntegracionEvidencia =
  | "OtpProvider"
  | "IdentityProvider"
  | "PaymentProvider"
  | "SignatureProvider"
  | "PolicyIssuer";

/**
 * Cómo se muestra cada integración: el puerto y el proveedor previsto para el
 * adaptador oficial según `docs/Tabla de Integraciones externas - Tabla.csv`.
 * En el modo demo actual todos son mocks; el rótulo lo dice.
 */
export const ROTULO_INTEGRACION: Record<
  IntegracionEvidencia,
  { readonly nombre: string; readonly proveedorPrevisto: string }
> = {
  OtpProvider: { nombre: "OTP de canal", proveedorPrevisto: "Infobip" },
  IdentityProvider: { nombre: "Verificación de identidad", proveedorPrevisto: "Entrust/Onfido" },
  PaymentProvider: { nombre: "Pago", proveedorPrevisto: "Bancard" },
  SignatureProvider: { nombre: "Firma electrónica", proveedorPrevisto: "Code100" },
  PolicyIssuer: { nombre: "Emisión de póliza", proveedorPrevisto: "SEBAOT (Alianza)" },
};

/**
 * Un paso por fila, sin comodines por prefijo: `P8_*` mezcla firma (Code100),
 * captura (Bancard) y actos del dominio, así que un prefijo imputaría mal.
 *
 * La verificación de un OTP se resuelve localmente contra el hash (regla
 * inviolable #2), pero forma parte del ciclo de la integración de OTP: para la
 * auditoría, envío y verificación son el mismo trámite con el proveedor.
 */
const INTEGRACION_POR_PASO: Readonly<Record<string, IntegracionEvidencia>> = {
  P1_OTP_WHATSAPP_ENVIO: "OtpProvider",
  P1_OTP_WHATSAPP_REENVIO: "OtpProvider",
  P1_OTP_WHATSAPP_VERIFICACION: "OtpProvider",
  P4_OTP_CORREO_ENVIO: "OtpProvider",
  P4_OTP_CORREO_REENVIO: "OtpProvider",
  P4_OTP_CORREO_VERIFICACION: "OtpProvider",
  P5_CAPTURA_IDENTIDAD: "IdentityProvider",
  P5_ANALISIS_IDENTIDAD: "IdentityProvider",
  P5_VERIFICACION_IDENTIDAD: "IdentityProvider",
  P7_INICIO_PAGO: "PaymentProvider",
  P7_CONFIRMACION_PAGO: "PaymentProvider",
  P8_CAPTURA_PAGO: "PaymentProvider",
  P8_ENVIO_ENLACE_FIRMA: "SignatureProvider",
  P8_FIRMA: "SignatureProvider",
  P9_EMISION_POLIZA: "PolicyIssuer",
  P9_ESTADO_POLIZA: "PolicyIssuer",
};

/** Orden fijo de presentación: el del recorrido del flujo. */
const ORDEN_INTEGRACIONES: readonly IntegracionEvidencia[] = [
  "OtpProvider",
  "IdentityProvider",
  "PaymentProvider",
  "SignatureProvider",
  "PolicyIssuer",
];

export function integracionDelPaso(paso: string): IntegracionEvidencia | null {
  return INTEGRACION_POR_PASO[paso] ?? null;
}

export interface ResumenIntegracion {
  readonly integracion: IntegracionEvidencia;
  readonly total: number;
  readonly exitosos: number;
  readonly fallidos: number;
  /** Resultado del registro más reciente de la integración. */
  readonly ultimoResultado: "EXITOSO" | "FALLIDO";
  readonly ultimaFecha: string;
}

/**
 * Resume la cadena de evidencia por integración, en el orden del flujo.
 * Solo incluye las integraciones que tienen al menos un registro: una
 * integración sin filas no falló ni funcionó — no participó todavía.
 */
export function resumenPorIntegracion(
  evidencias: readonly RegistroEvidencia[],
): readonly ResumenIntegracion[] {
  const porIntegracion = new Map<IntegracionEvidencia, RegistroEvidencia[]>();
  for (const registro of evidencias) {
    const integracion = integracionDelPaso(registro.paso);
    if (!integracion) continue;
    const lista = porIntegracion.get(integracion) ?? [];
    lista.push(registro);
    porIntegracion.set(integracion, lista);
  }

  return ORDEN_INTEGRACIONES.flatMap((integracion) => {
    const registros = porIntegracion.get(integracion);
    if (!registros || registros.length === 0) return [];
    // El historial llega en orden de guardado (contrato de `EvidenceStore`),
    // así que el último de la lista es el más reciente.
    const ultimo = registros[registros.length - 1];
    return [
      {
        integracion,
        total: registros.length,
        exitosos: registros.filter((r) => r.resultado === "EXITOSO").length,
        fallidos: registros.filter((r) => r.resultado === "FALLIDO").length,
        ultimoResultado: ultimo.resultado,
        ultimaFecha: ultimo.fecha,
      },
    ];
  });
}
