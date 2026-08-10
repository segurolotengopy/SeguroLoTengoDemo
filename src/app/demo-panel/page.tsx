import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { listarEnviosDemo } from "@/adapters/mock/otp-provider";
import { PERSONAS_DEMO } from "@/adapters/mock/personas";
import {
  escenarioIdentidadDe,
  ESCENARIOS_IDENTIDAD_DEMO,
  obtenerSeleccionDemo,
  ROTULO_ESCENARIO_IDENTIDAD,
} from "@/adapters/mock/persona-activa";
import {
  DESCRIPCION_FALLA_DEMO,
  FALLAS_DEMO,
  fallasArmadasDemo,
} from "@/adapters/mock/fallas-demo";
import { PLAZOS_FIRMA_DEMO, plazoFirmaMs } from "@/adapters/mock/plazo-firma-demo";
import {
  listarSesionesFirmaMock,
  obtenerCodigoFirmaDemo,
} from "@/adapters/mock/signature-provider";
import { HeaderInstitucional } from "@/components/shared";
import { enmascararCorreo } from "@/domain/correo";
import { enmascararCelular } from "@/domain/telefono";
import { crearEvidenceStore, crearExpedienteRepository } from "@/repositories";
import { COOKIE_EXPEDIENTE } from "@/app/api/_http/contexto-peticion";
import { COOKIE_PANEL, esModoDemo, sesionValida } from "./_sesion";
import { BotonDevolucionEjecutada } from "./BotonDevolucionEjecutada";
import { BotonReiniciar } from "./BotonReiniciar";
import { ControlFirmaCode100 } from "./ControlFirmaCode100";
import type { SesionFirmaVisible } from "./ControlFirmaCode100";
import { FormularioClave } from "./FormularioClave";
import { SelectorFallas } from "./SelectorFallas";
import { SelectorPersona } from "./SelectorPersona";
import { SelectorPlazoFirma } from "./SelectorPlazoFirma";

/**
 * Panel de control del demo (CLAUDE.md → "Panel de demo"). NO es una de las
 * 12 pantallas del flujo ni entra en el contador de 9 pasos.
 *
 * Es el único lugar del sistema donde el código de un OTP puede verse
 * (regla inviolable #2: "En modo demo el código se expone únicamente a través
 * del panel de demo, nunca por la API del flujo"). Los códigos que muestra
 * salen del registro en memoria del adaptador mock, no de la base: en
 * DynamoDB solo está el HMAC.
 *
 * Doble candado: `DEMO_MODE=true` y `DEMO_PANEL_KEY`. Sin lo primero, 404.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel de demo · SeguroLoTengo",
  // El panel no debe aparecer en buscadores aunque quede accesible.
  robots: { index: false, follow: false },
};

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-5">
      <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/**
 * El panel puede mostrar el código (es su razón de existir), pero no tiene
 * por qué mostrar el destino completo: el celular ya se enmascaraba y desde
 * P4 el correo también, con la misma función que usa el flujo.
 */
function destinoLegible(destino: string): string {
  if (destino.startsWith("+595")) return enmascararCelular(destino);
  if (destino.includes("@")) return enmascararCorreo(destino);
  return destino;
}

export default async function PanelDeDemo() {
  // Con el flag apagado la ruta no existe.
  if (!esModoDemo()) notFound();

  const almacenCookies = await cookies();
  const autorizado = await sesionValida(almacenCookies.get(COOKIE_PANEL)?.value);

  if (!autorizado) {
    return (
      <div className="flex flex-1 flex-col bg-fondo">
        <HeaderInstitucional />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-10">
          <FormularioClave />
        </main>
      </div>
    );
  }

  const envios = listarEnviosDemo();
  const seleccion = obtenerSeleccionDemo();
  const personas = PERSONAS_DEMO.map((persona) => ({
    id: persona.id,
    rotulo: persona.rotulo,
    escenarioPropio: ROTULO_ESCENARIO_IDENTIDAD[escenarioIdentidadDe(persona)],
    pantallaFinal: persona.desenlace.pantallaFinal,
  }));
  const escenarios = ESCENARIOS_IDENTIDAD_DEMO.map((escenario) => ({
    id: escenario,
    rotulo: ROTULO_ESCENARIO_IDENTIDAD[escenario],
  }));
  // Estado de los actos de firma simulados. El código en claro sale del
  // registro en memoria del adaptador mock, igual que los OTP de P1 y P4: en la
  // sesión simulada solo queda su HMAC (regla inviolable #2).
  const sesionesFirma: readonly SesionFirmaVisible[] = listarSesionesFirmaMock().map((sesion) => {
    const codigo = obtenerCodigoFirmaDemo(sesion.idCode100);
    const estado: SesionFirmaVisible["estado"] = sesion.firma
      ? "FIRMADA"
      : sesion.fallo
        ? "CERRADA"
        : sesion.otp
          ? "ESPERANDO_CODIGO"
          : "ESPERANDO_APERTURA";

    return {
      idCode100: sesion.idCode100,
      expedienteId: sesion.expedienteId,
      canal: sesion.canal,
      destino: destinoLegible(sesion.destino),
      enlaceEnviadoEn: sesion.enlaceEnviadoEn,
      venceEn: sesion.venceEn,
      estado,
      detalleEstado: sesion.firma
        ? "FIRMADA"
        : sesion.fallo
          ? `SIN FIRMAR · ${sesion.fallo.motivo}`
          : sesion.otp
            ? "ENLACE ABIERTO · ESPERANDO CÓDIGO"
            : "ENLACE ENVIADO",
      codigo: codigo?.codigo ?? null,
      hashSolicitudFirmada: sesion.firma?.hashSolicitudFirmada ?? null,
      hashFipfFirmado: sesion.firma?.hashFipfFirmado ?? null,
    };
  });

  const armadas = new Set(fallasArmadasDemo());
  const fallas = FALLAS_DEMO.map((falla) => ({
    id: falla,
    ...DESCRIPCION_FALLA_DEMO[falla],
    armada: armadas.has(falla),
  }));

  const expedienteId = almacenCookies.get(COOKIE_EXPEDIENTE)?.value ?? null;
  const evidencias = expedienteId
    ? await crearEvidenceStore().obtenerHistorial(expedienteId)
    : [];
  const estadoDelExpediente = expedienteId
    ? ((await crearExpedienteRepository().obtenerPorId(expedienteId))?.estado ?? null)
    : null;

  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional
        indicador={
          <div className="text-right leading-tight">
            <p className="text-sm font-bold text-naranja-600 dark:text-naranja-300">
              PANEL DE DEMO
            </p>
            <p className="text-[11px] font-semibold tracking-wide text-etiqueta uppercase">
              Fuera del flujo
            </p>
          </div>
        }
      />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-titulo">Panel de demo</h1>
          <p className="text-sm text-cuerpo">
            Herramienta de demostración. Los códigos de acá salen del adaptador mock en memoria;
            en base solo se guarda el hash.
          </p>
        </header>

        <Tarjeta titulo="Persona de prueba activa">
          <SelectorPersona
            personas={personas}
            escenarios={escenarios}
            personaSeleccionada={seleccion.personaId}
            escenarioForzado={seleccion.escenarioIdentidadForzado ?? ""}
          />
        </Tarjeta>

        <Tarjeta titulo="Forzar fallos puntuales">
          <SelectorFallas fallas={fallas} />
        </Tarjeta>

        <Tarjeta titulo="Plazo para firmar (P7 → P8)">
          <SelectorPlazoFirma opciones={PLAZOS_FIRMA_DEMO} plazoActualMs={plazoFirmaMs()} />
        </Tarjeta>

        <Tarjeta titulo="Acto de firma Code100 simulado">
          <ControlFirmaCode100 sesiones={sesionesFirma} />
        </Tarjeta>

        <Tarjeta titulo="Devolución de Pantalla B">
          <BotonDevolucionEjecutada estado={estadoDelExpediente} />
        </Tarjeta>

        <Tarjeta titulo="Reiniciar expediente">
          <BotonReiniciar expedienteId={expedienteId} />
        </Tarjeta>

        <Tarjeta titulo="Códigos OTP simulados">
          {envios.length === 0 ? (
            <p className="text-sm text-cuerpo">
              Todavía no se envió ningún código en esta instancia. Andá a{" "}
              <code className="font-mono">/p1-whatsapp</code>, ingresá un número y pedí el código.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="text-[11px] tracking-wide text-etiqueta uppercase">
                    <th className="py-2 pr-4 font-semibold">Código</th>
                    <th className="py-2 pr-4 font-semibold">Destino</th>
                    <th className="py-2 pr-4 font-semibold">Enviado</th>
                    <th className="py-2 font-semibold">Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {envios.map((envio) => (
                    <tr key={envio.otpId} className="border-t border-borde-tenue">
                      <td className="py-2 pr-4 font-mono text-lg font-bold tracking-widest text-titulo">
                        {envio.codigo}
                      </td>
                      <td className="py-2 pr-4 text-cuerpo tabular-nums">
                        {destinoLegible(envio.destino)}
                      </td>
                      <td className="py-2 pr-4 text-cuerpo tabular-nums">
                        {new Date(envio.enviadoEn).toLocaleTimeString("es-PY")}
                      </td>
                      <td className="max-w-[14rem] truncate py-2 font-mono text-xs text-etiqueta">
                        {envio.referenciaEnvio}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-etiqueta">
            Un código desaparece de esta lista apenas se usa: al verificarse, deja de retenerse.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Registro de evidencia del expediente en curso">
          {!expedienteId ? (
            <p className="text-sm text-cuerpo">
              No hay expediente en esta sesión del navegador. Empezá P1 y volvé.
            </p>
          ) : evidencias.length === 0 ? (
            <p className="text-sm text-cuerpo">
              Expediente <code className="font-mono">{expedienteId}</code>, todavía sin evidencia.
            </p>
          ) : (
            <>
              <p className="text-xs text-etiqueta">
                Expediente <code className="font-mono">{expedienteId}</code> ·{" "}
                {evidencias.length} registros (append-only)
              </p>
              <ol className="flex flex-col gap-2">
                {evidencias.map((registro) => (
                  <li
                    key={registro.id}
                    className="flex flex-col gap-0.5 rounded-lg border border-borde-tenue bg-superficie-suave p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-semibold text-titulo">{registro.paso}</span>
                      <span
                        className={`text-xs font-bold ${
                          registro.resultado === "EXITOSO"
                            ? "text-verde-700 dark:text-verde-300"
                            : "text-rojo-700 dark:text-rojo-300"
                        }`}
                      >
                        {registro.resultado}
                      </span>
                      <span className="text-xs text-etiqueta tabular-nums">
                        {new Date(registro.fecha).toLocaleString("es-PY")}
                      </span>
                    </div>
                    <p className="text-xs text-cuerpo">
                      IP {registro.ip} · sesión {registro.sesionId.slice(0, 8)}…
                    </p>
                    {registro.detalle ? (
                      <p className="font-mono text-xs break-all text-etiqueta">{registro.detalle}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </>
          )}
        </Tarjeta>

        <p className="rounded-xl border border-naranja-200 bg-naranja-50 px-4 py-3 text-sm text-naranja-900 dark:border-naranja-800 dark:bg-naranja-950 dark:text-naranja-200">
          Los códigos viven en memoria del proceso que atendió el envío. En un despliegue con
          varias instancias, el panel puede no ver un código emitido por otra instancia: recargá o
          repetí el envío.
        </p>
      </main>
    </div>
  );
}
