import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import Link from "next/link";
import { obtenerIdentityProvider, paisesDeCedulaAceptados } from "@/adapters/registro";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import { NOMBRE_PAIS } from "@/domain/documento-regional";
import {
  BarraPlanDelExpediente,
  HeaderInstitucional,
  PieLegal,
  StepperPasos,
} from "@/components/shared";
import { soportaSesionPruebaDeVida } from "@/ports/identity-provider";
import { VerificacionIdentidad } from "./VerificacionIdentidad";

/**
 * P5 · Paso 5 de 9 — Verificación de identidad.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P5 · Paso 5 de 9 —
 * Verificación de identidad". Respaldo normativo: fila 14 de la matriz de
 * cumplimiento (Res. SEPRELAD 71/19, arts. 25(a-c), 26(1)(a-b) y 29(b)).
 *
 * Todo lo estático se renderiza en el servidor; lo único que baja como
 * componente de cliente son los bloques interactivos y la barra de plan.
 */

export const metadata: Metadata = {
  title: `Verificá tu identidad · ${sufijoTitulo()}`,
  description:
    "Paso 5 de 9: captura de cédula paraguaya, selfie en vivo con prueba de vida y coincidencia facial.",
};

/**
 * Si el proveedor de identidad configurado tiene prueba de vida por streaming.
 *
 * Se resuelve **en el servidor** y baja como prop: la pantalla no tiene por qué
 * adivinar en qué modo corre el backend, y en modo mock el chunk de Amplify UI
 * no se carga siquiera. Se envuelve en try/catch porque `resolverAdaptador`
 * tira si se pide un modo `live` que no existe para otro puerto — un error de
 * configuración no debería dejar P5 en blanco, sino caer al camino simulado.
 */
/**
 * Cómo se nombran los documentos admitidos en el encabezado.
 *
 * Se deriva de la configuración y no está escrito a mano porque el texto
 * anterior ("cédula paraguaya vigente… no se admite documento extranjero")
 * dejaría de ser cierto en cuanto se habilite otro país, y una pantalla que
 * afirma un requisito que el sistema no aplica es peor que una sin aviso.
 */
function textoDocumentosAceptados(): string {
  const nombres = paisesDeCedulaAceptados().map((pais) => NOMBRE_PAIS[pais]);
  return nombres.length > 1
    ? `cédula de identidad de ${nombres.slice(0, -1).join(", ")} o ${nombres.at(-1)}`
    : `cédula de identidad de ${nombres[0]}`;
}

function pruebaDeVidaEnVivoDisponible(): boolean {
  try {
    return soportaSesionPruebaDeVida(obtenerIdentityProvider());
  } catch {
    return false;
  }
}

export default function PantallaP5Identidad() {
  const enVivo = pruebaDeVidaEnVivoDisponible();

  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/identidad" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <BarraPlanDelExpediente enlaceTexto="Cambiar plan" enlaceHref="/plan" />

        <header className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-4">
          <h1 className="shrink-0 text-xl font-bold text-titulo sm:text-2xl">
            Verificá tu identidad
          </h1>
          <p className="text-sm text-cuerpo">
            Vas a fotografiar tu {textoDocumentosAceptados()} vigente y a hacer una selfie.{" "}
            <span className="font-semibold">
              No se admite pasaporte. Esta pantalla no contiene declaraciones, pago ni firma.
            </span>
          </p>
        </header>

        <VerificacionIdentidad
          pruebaDeVidaEnVivoDisponible={enVivo}
          subidaDeArchivoDisponible={esModoDemo()}
        />

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-3">
          <Link
            href="/preparacion"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a la preparación
          </Link>
        </footer>
      </main>

      <PieLegal />
    </div>
  );
}
