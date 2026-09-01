import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { obtenerIdentityProvider } from "@/adapters/registro";
import { COOKIE_EXPEDIENTE } from "@/app/api/_http/contexto-peticion";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import { HeaderInstitucional, PieLegal, StepperPasos, TramiteEnOtroPaso } from "@/components/shared";
import { flujoV3Activo } from "@/domain/flujo-vigente";
import { PANTALLA_POR_ESTADO } from "@/domain/rutas-flujo";
import { DETALLE_INSCRIPCION_COMPLETA } from "@/domain/textos-reencaminado";
import type { EstadoExpediente } from "@/domain/tipos";
import { crearExpedienteRepository } from "@/repositories";
import { soportaSesionPruebaDeVida } from "@/ports/identity-provider";
import { expedienteEnOtroPaso } from "../_reencaminado";
import { Inscripcion } from "./Inscripcion";

/**
 * Paso 1 del flujo v3 · Inscribite — `/inscripcion` (lote F2).
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "Paso 1 · Inscribite"
 * y el Bloque E de docs/plan/DECISIONES.md. Es la primera **página larga con
 * secciones en cascada**: identidad → canal de WhatsApp → aceptación
 * agrupada. Qué sección está activa lo dice el **estado del expediente**, que
 * este server component lee y baja como prop; cada sección completada llama a
 * `router.refresh()` y la página se re-dibuja con el gating nuevo.
 *
 * Solo existe con `FLUJO_V3=true` (guarda de runtime, patrón de
 * `admin-consola`): con el flag apagado nadie la enlaza y responde 404. No
 * lleva `BarraPlanDelExpediente`: en v3 el plan es el paso 2.
 */

export const metadata: Metadata = {
  title: `Inscribite · ${sufijoTitulo()}`,
  description: "Paso 1 de 3: identidad, canales verificados y autorizaciones para inscribirte.",
};

/** Estados que esta página atiende como secciones (el resto se reencamina). */
const ESTADOS_DE_LA_PAGINA: readonly EstadoExpediente[] = [
  "INICIADO",
  "IDENTIDAD_VERIFICADA",
  "CANAL_WA_VERIFICADO",
  // Legado D-06: expedientes históricos retoman por acá (regla #10).
  "CANAL_EMAIL_VERIFICADO",
];

function pruebaDeVidaEnVivoDisponible(): boolean {
  try {
    return soportaSesionPruebaDeVida(obtenerIdentityProvider());
  } catch {
    return false;
  }
}

/**
 * Estado del expediente de la sesión, o `null` si todavía no hay trámite
 * (que acá no es un error: es la puerta de los T&C). Si la consulta falla se
 * sigue de largo con `null`: los Route Handlers validan igual (mismo criterio
 * fail-open de `_reencaminado.ts`).
 */
async function expedienteDeLaSesion(): Promise<{
  estado: EstadoExpediente;
  nombrePila: string | null;
} | null> {
  const expedienteId = (await cookies()).get(COOKIE_EXPEDIENTE)?.value;
  if (!expedienteId) return null;
  try {
    const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
    if (!expediente) return null;
    return {
      estado: expediente.estado,
      nombrePila: expediente.identidad?.nombres.split(" ")[0] ?? null,
    };
  } catch {
    return null;
  }
}

export default async function PantallaInscripcion() {
  if (!flujoV3Activo()) notFound();

  const enOtroPaso = await expedienteEnOtroPaso("/inscripcion");
  const sesion = await expedienteDeLaSesion();
  const estado = sesion && ESTADOS_DE_LA_PAGINA.includes(sesion.estado) ? sesion.estado : null;
  const nombrePila = sesion?.nombrePila ?? null;

  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/inscripcion" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <div className="overflow-hidden border border-borde-sutil bg-superficie" aria-hidden="true">
          {/* Foto del canvas para este paso (lote F5b). */}
          <img
            src="/v3/familia-paso-1.jpg"
            alt="Familia paraguaya reunida"
            className="v3-foto-paso w-full"
            style={{ height: "clamp(140px, 20vw, 210px)" }}
          />
        </div>

        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-titulo sm:text-2xl">
            {nombrePila ? `Inscribite con nosotros, ${nombrePila}` : "Inscribite con nosotros"}
          </h1>
          <p className="text-sm text-cuerpo">
            Acá no se firma nada ni se cobra nada: leemos tu cédula, vos confirmás los datos y
            verificamos tu identidad.
          </p>
        </header>

        {enOtroPaso ? (
          <TramiteEnOtroPaso
            destino={enOtroPaso}
            detalle={DETALLE_INSCRIPCION_COMPLETA}
            modoDemo={esModoDemo()}
          />
        ) : (
          <Inscripcion
            estado={estado}
            nombrePila={nombrePila}
            pruebaDeVidaEnVivoDisponible={pruebaDeVidaEnVivoDisponible()}
            subidaDeArchivoDisponible={esModoDemo()}
            // El destino al completar el paso sale del mapa del servidor: el
            // bundle del cliente resolvería la versión del flujo sin la
            // variable de entorno y contestaría v2.
            destinoTrasAceptar={PANTALLA_POR_ESTADO.AUTORIZADO}
          />
        )}
      </main>

      <PieLegal />
    </div>
  );
}
