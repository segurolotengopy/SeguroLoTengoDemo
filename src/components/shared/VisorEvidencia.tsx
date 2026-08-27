import {
  ROTULO_INTEGRACION,
  integracionDelPaso,
  resumenPorIntegracion,
} from "@/domain/evidencia";
import type { IntegracionEvidencia } from "@/domain/evidencia";
import type { Firma, PaqueteDocumental, RegistroEvidencia } from "@/domain/tipos";

/**
 * Visor de evidencia de un expediente: la vista que se le muestra al área de
 * cumplimiento. Es el mismo componente en el panel de demo y en la consola
 * administrativa (`docs/CONSOLA_ADMINISTRATIVA.md` §4: "mismo componente que ya
 * se usa en `/demo-panel`, reutilizar").
 *
 * Muestra tres cosas, todas de solo lectura:
 * 1. el resultado de cada integración externa (resumen por puerto),
 * 2. los hashes SHA-256 del paquete documental y de la firma (reglas #3 y #4),
 * 3. la cadena completa de eventos con timestamp, IP, dispositivo y sesión
 *    (regla inviolable #10, append-only).
 *
 * No recibe el `Expediente` entero a propósito: solo los bloques que exhibe.
 * Acá nunca llegan salud, PEP, OTP en claro ni datos de tarjeta — esos campos
 * no existen en `RegistroEvidencia` ni en `PaqueteDocumental`/`Firma`
 * (reglas #2, #6 y #7).
 */

export interface VisorEvidenciaProps {
  readonly expedienteId: string;
  /**
   * Cómo se describe cada integración: proveedor y si la llamada salió de
   * verdad o de un simulador. Lo resuelve el servidor
   * (`describirIntegraciones()` en el composition root) y baja como prop,
   * porque este es un componente de cliente y no puede leer el entorno.
   *
   * Antes acá había un literal fijo, `<proveedor previsto> (mock en demo)`.
   * Con los canales reales habilitados pasó a ser falso: una consola de
   * cumplimiento que rotula "mock" una llamada que salió de verdad se lee al
   * revés, que es peor que no rotular nada.
   */
  readonly descripcionIntegraciones: Record<IntegracionEvidencia, string>;
  readonly evidencias: readonly RegistroEvidencia[];
  readonly paqueteDocumental: PaqueteDocumental | null;
  readonly firma: Firma | null;
}

function fechaLegible(iso: string): string {
  return new Date(iso).toLocaleString("es-PY", { dateStyle: "short", timeStyle: "medium" });
}

function Subtitulo({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-bold tracking-wide text-etiqueta uppercase">{children}</h4>
  );
}

function Hash({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-etiqueta">{rotulo}</span>
      <code className="font-mono text-xs break-all text-titulo">{valor}</code>
    </div>
  );
}

function BadgeResultado({ resultado }: { resultado: RegistroEvidencia["resultado"] }) {
  return (
    <span
      className={`text-xs font-bold ${
        resultado === "EXITOSO"
          ? "text-verde-700 dark:text-verde-300"
          : "text-rojo-700 dark:text-rojo-300"
      }`}
    >
      {resultado}
    </span>
  );
}

export function VisorEvidencia({
  expedienteId,
  evidencias,
  paqueteDocumental,
  firma,
  descripcionIntegraciones,
}: VisorEvidenciaProps) {
  const resumen = resumenPorIntegracion(evidencias);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-etiqueta">
        Expediente <code className="font-mono">{expedienteId}</code> · {evidencias.length}{" "}
        {evidencias.length === 1 ? "registro" : "registros"} (append-only: ningún registro se
        sobrescribe ni se borra)
      </p>

      {/* 1. Resultado de cada integración */}
      <section className="flex flex-col gap-2">
        <Subtitulo>Resultado por integración</Subtitulo>
        {resumen.length === 0 ? (
          <p className="text-sm text-cuerpo">Todavía no hay llamadas a integraciones externas.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {resumen.map((fila) => {
              const rotulo = ROTULO_INTEGRACION[fila.integracion];
              return (
                <li
                  key={fila.integracion}
                  className="flex flex-col gap-1 rounded-lg border border-borde-tenue bg-superficie-suave p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-titulo">{rotulo.nombre}</span>
                    <BadgeResultado resultado={fila.ultimoResultado} />
                  </div>
                  <p className="text-xs text-etiqueta">
                    {fila.integracion} · {descripcionIntegraciones[fila.integracion]}
                  </p>
                  <p className="text-xs text-cuerpo tabular-nums">
                    {fila.total} {fila.total === 1 ? "llamada" : "llamadas"} · {fila.exitosos}{" "}
                    exitosas · {fila.fallidos} fallidas · última{" "}
                    {fechaLegible(fila.ultimaFecha)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 2. Hashes del paquete documental y de la firma (reglas #3 y #4) */}
      <section className="flex flex-col gap-2">
        <Subtitulo>Hashes de documentos (SHA-256)</Subtitulo>
        {!paqueteDocumental ? (
          <p className="text-sm text-cuerpo">
            Todavía sin paquete documental cerrado: los hashes se calculan al cerrar la Solicitud
            y el FIPF, antes de habilitar la firma.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-lg border border-borde-tenue bg-superficie-suave p-3 sm:col-span-2">
              <p className="text-sm font-semibold text-titulo">
                Solicitud + FIPF{" "}
                <code className="font-mono text-xs">{paqueteDocumental.codigo}</code> · v
                {paqueteDocumental.version}
              </p>
              <p className="text-xs text-etiqueta">
                Un solo PDF con las dos secciones. La del FIPF conserva su código interno{" "}
                <code className="font-mono">{paqueteDocumental.codigoSeccionFipf}</code>.
              </p>
              <Hash rotulo="Hash al cierre" valor={paqueteDocumental.hashSha256} />
              <p className="text-xs text-etiqueta tabular-nums">
                Cerrado el {fechaLegible(paqueteDocumental.cerradoEn)}
              </p>
            </div>
            {firma ? (
              <div className="flex flex-col gap-2 rounded-lg border border-verde-300 bg-verde-50 p-3 sm:col-span-2 dark:border-verde-800 dark:bg-verde-950">
                <p className="text-sm font-semibold text-verde-900 dark:text-verde-100">
                  Firmado (Code100{" "}
                  <code className="font-mono text-xs">{firma.idCode100}</code>) el{" "}
                  <span className="tabular-nums">{fechaLegible(firma.firmadoEn)}</span> · canal{" "}
                  {firma.canal}
                </p>
                <Hash rotulo="Documento firmado" valor={firma.hashDocumentoFirmado} />
              </div>
            ) : (
              <p className="text-xs text-etiqueta sm:col-span-2">
                Sin firma todavía. La Solicitud y el FIPF no pueden firmarse por separado: son
                secciones del mismo PDF.
              </p>
            )}
          </div>
        )}
      </section>

      {/* 3. Cadena completa de eventos (regla #10) */}
      <section className="flex flex-col gap-2">
        <Subtitulo>Cadena de eventos</Subtitulo>
        {evidencias.length === 0 ? (
          <p className="text-sm text-cuerpo">Todavía sin evidencia registrada.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {evidencias.map((registro) => {
              const integracion = integracionDelPaso(registro.paso);
              return (
                <li
                  key={registro.id}
                  className="flex flex-col gap-0.5 rounded-lg border border-borde-tenue bg-superficie-suave p-3 text-sm"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="font-semibold text-titulo">{registro.paso}</span>
                    {integracion ? (
                      <span className="rounded-full border border-borde-sutil px-2 py-0.5 text-[10px] font-bold tracking-wide text-etiqueta uppercase">
                        {ROTULO_INTEGRACION[integracion].proveedorPrevisto}
                      </span>
                    ) : null}
                    <BadgeResultado resultado={registro.resultado} />
                    <span className="text-xs text-etiqueta tabular-nums">
                      {fechaLegible(registro.fecha)}
                    </span>
                  </div>
                  <p className="text-xs text-cuerpo">
                    IP {registro.ip} · dispositivo{" "}
                    <span className="break-all">{registro.dispositivo}</span>
                  </p>
                  <p className="font-mono text-xs break-all text-etiqueta">
                    sesión {registro.sesionId}
                  </p>
                  {registro.versionTextoAceptado ? (
                    <p className="text-xs text-cuerpo">
                      Texto aceptado: versión {registro.versionTextoAceptado}
                    </p>
                  ) : null}
                  {registro.detalle ? (
                    <p className="font-mono text-xs break-all text-etiqueta">{registro.detalle}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <p className="text-xs text-etiqueta">
        La evidencia nunca contiene códigos OTP en claro, datos de tarjeta, respuestas médicas ni
        condición PEP (reglas inviolables #2, #6 y #7).
      </p>
    </div>
  );
}
