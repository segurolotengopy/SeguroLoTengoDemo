import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { HeaderInstitucional } from "@/components/shared";
import { describirIntegraciones } from "@/adapters/registro";
import { JUSTIFICATIVOS_REINICIO } from "@/domain/consola-administrativa";
import { COOKIE_CONSOLA, consolaHabilitada, sesionConsolaValida } from "./_sesion";
import { Consola } from "./Consola";
import { FormularioClaveConsola } from "./FormularioClaveConsola";

/**
 * Consola administrativa (`docs/CONSOLA_ADMINISTRATIVA.md`).
 *
 * **No es una de las 12 pantallas** del flujo B2C ni lleva stepper "Paso N de
 * 9": es una herramienta interna para staff de AAB1 / Interseguros / Alianza.
 *
 * Doble candado, igual que el panel de demo pero con flag y clave propios:
 * `ADMIN_CONSOLE_ENABLED=true` y `ADMIN_CONSOLE_KEY`. Sin lo primero, 404.
 *
 * Sin roles todavía (§2): quien entra puede consultar y también autorizar
 * reinicios. El control granular queda diferido a producción.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Consola administrativa · SeguroLoTengo",
  robots: { index: false, follow: false },
};

export default async function ConsolaAdministrativa() {
  if (!consolaHabilitada()) notFound();

  const almacen = await cookies();
  const autorizado = await sesionConsolaValida(almacen.get(COOKIE_CONSOLA)?.value);

  if (!autorizado) {
    return (
      <div className="flex flex-1 flex-col bg-fondo">
        <HeaderInstitucional />
        <main className="mx-auto flex w-full max-w-pantalla flex-1 flex-col items-center justify-center px-4 py-10">
          <FormularioClaveConsola />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional
        indicador={
          <div className="text-right leading-tight">
            <p className="text-sm font-bold text-azul-700 dark:text-azul-200">CONSOLA ADMIN</p>
            <p className="text-[11px] font-semibold tracking-wide text-etiqueta uppercase">
              Herramienta interna
            </p>
          </div>
        }
      />

      {/* Ancho completo: la consola es una herramienta de escritorio y usa
          toda la pantalla, con el panel de búsqueda a la izquierda. */}
      <main className="flex w-full flex-col gap-4 px-4 py-4 sm:px-6">
        <header className="flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:gap-4">
          <h1 className="shrink-0 text-xl font-bold text-titulo">Consola administrativa</h1>
          <p className="text-sm text-cuerpo">
            Auditoría de expedientes: estado, evidencias, derivaciones y vencimientos. Los datos son
            de solo lectura — desde acá no se edita ningún expediente.
          </p>
        </header>

        <Consola
          justificativos={JUSTIFICATIVOS_REINICIO.map((j) => ({ ...j }))}
          descripcionIntegraciones={describirIntegraciones()}
        />
      </main>
    </div>
  );
}
