import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CabeceraV4, IndicadorFueraDeFlujoV4, PieV4 } from "@/components/v4/MarcoV4";
import { CapaLegalV4 } from "@/components/v4/CapaLegalV4";
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
  title: `Consola administrativa · ${sufijoTitulo()}`,
  robots: { index: false, follow: false },
};

export default async function ConsolaAdministrativa() {
  if (!consolaHabilitada()) notFound();

  const almacen = await cookies();
  const autorizado = await sesionConsolaValida(almacen.get(COOKIE_CONSOLA)?.value);

  if (!autorizado) {
    return (
      <CapaLegalV4>
        <div className="flex flex-1 flex-col bg-fondo">
          <CabeceraV4 marcas={3} />
          <main className="mx-auto flex w-full max-w-pantalla flex-1 flex-col items-center justify-center px-4 py-10">
            <FormularioClaveConsola />
          </main>
          <div className="mx-auto w-full max-w-pantalla px-4">
            <PieV4 />
          </div>
        </div>
      </CapaLegalV4>
    );
  }

  return (
    <CapaLegalV4>
      <div className="flex flex-1 flex-col bg-fondo">
        <CabeceraV4 marcas={3} />
        <IndicadorFueraDeFlujoV4 titulo="CONSOLA ADMIN" detalle="Herramienta interna" tono="neutral" />

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

        <div className="w-full px-4 sm:px-6">
          <PieV4 />
        </div>
      </div>
    </CapaLegalV4>
  );
}
