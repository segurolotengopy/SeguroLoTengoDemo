"use client";

import {
  BarraPlanSeleccionado,
  HeaderInstitucional,
  StepperPasos,
} from "@/components/shared";

/**
 * Vista de verificación del sistema de diseño base: no es una pantalla del
 * flujo (P0–P9, Pantalla A, Pantalla B) ni forma parte de la consola
 * administrativa — sirve solo para revisar visualmente los componentes
 * compartidos y sus variantes durante el desarrollo.
 */
export default function DesignSystemPreview() {
  return (
    <div className="flex flex-1 flex-col gap-8 bg-fondo pb-16">
      <HeaderInstitucional indicador={<StepperPasos slug="/identidad" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-10 px-4 sm:px-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            HeaderInstitucional — variantes del indicador
          </h2>
          <div className="flex flex-col gap-3 overflow-hidden rounded-xl border border-borde-sutil bg-superficie">
            <HeaderInstitucional indicador={<StepperPasos variante="p0" />} />
            <HeaderInstitucional indicador={<StepperPasos slug="/plan" />} />
            <HeaderInstitucional indicador={<StepperPasos slug="/confirmacion" />} />
            <HeaderInstitucional
              indicador={<StepperPasos variante="pantalla-a" />}
            />
            <HeaderInstitucional
              indicador={<StepperPasos variante="pantalla-b" />}
            />
            <HeaderInstitucional />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            BarraPlanSeleccionado
          </h2>
          <div className="flex flex-col gap-3">
            <BarraPlanSeleccionado
              planNombre="Seguro de Vida Oncológico · CONFÍO+"
              premioTexto="Gs. 475.000 al año · IVA incluido"
              enlaceTexto="Cambiar plan"
              enlaceHref="#"
            />
            <BarraPlanSeleccionado
              planNombre="Seguro de Vida Oncológico · CONFÍO+"
              premioTexto="Gs. 475.000 · premio anual · IVA incluido"
              enlaceTexto="Volver al pago"
              onEnlaceClick={() => {}}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Tokens semánticos — los que cambian con el tema
          </h2>
          <p className="max-w-2xl text-sm text-cuerpo">
            Usá estos para la estructura de cualquier pantalla nueva: se
            reescriben solos al alternar día/noche con el botón de la cabecera.
            Los colores de marca de más abajo no cambian nunca; para los bloques
            de acento (verde de seguridad, naranja de acción, rojo de bloqueo)
            agregá la variante <code className="font-mono">dark:</code> a mano.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { clase: "bg-fondo", uso: "fondo de la pantalla" },
                { clase: "bg-superficie", uso: "tarjetas y barras" },
                { clase: "bg-superficie-suave", uso: "zonas destacadas" },
                { clase: "bg-borde-sutil", uso: "borde de tarjeta" },
              ] as const
            ).map(({ clase, uso }) => (
              <div
                key={clase}
                className="flex flex-col gap-2 rounded-xl border border-borde-sutil bg-superficie p-3"
              >
                <div
                  className={`h-10 w-full rounded-lg border border-borde-sutil ${clase}`}
                />
                <p className="font-mono text-xs text-titulo">{clase}</p>
                <p className="text-xs text-etiqueta">{uso}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-borde-sutil bg-superficie p-4">
            <p className="text-base text-titulo">
              <span className="font-mono text-xs text-etiqueta">
                text-titulo
              </span>{" "}
              — títulos y datos principales
            </p>
            <p className="text-base text-cuerpo">
              <span className="font-mono text-xs text-etiqueta">
                text-cuerpo
              </span>{" "}
              — párrafos y descripciones
            </p>
            <p className="text-base text-etiqueta">
              <span className="font-mono text-xs text-etiqueta">
                text-etiqueta
              </span>{" "}
              — rótulos, pies y texto secundario
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Paleta de marca (igual en ambos temas)
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {(
              [
                {
                  nombre: "azul",
                  uso: "institucional",
                  clases: [
                    "bg-azul-50",
                    "bg-azul-100",
                    "bg-azul-200",
                    "bg-azul-300",
                    "bg-azul-400",
                    "bg-azul-500",
                    "bg-azul-600",
                    "bg-azul-700",
                    "bg-azul-800",
                    "bg-azul-900",
                    "bg-azul-950",
                  ],
                },
                {
                  nombre: "naranja",
                  uso: "acciones/alertas",
                  clases: [
                    "bg-naranja-50",
                    "bg-naranja-100",
                    "bg-naranja-200",
                    "bg-naranja-300",
                    "bg-naranja-400",
                    "bg-naranja-500",
                    "bg-naranja-600",
                    "bg-naranja-700",
                    "bg-naranja-800",
                    "bg-naranja-900",
                    "bg-naranja-950",
                  ],
                },
                {
                  nombre: "verde",
                  uso: "confirmación/seguridad",
                  clases: [
                    "bg-verde-50",
                    "bg-verde-100",
                    "bg-verde-200",
                    "bg-verde-300",
                    "bg-verde-400",
                    "bg-verde-500",
                    "bg-verde-600",
                    "bg-verde-700",
                    "bg-verde-800",
                    "bg-verde-900",
                    "bg-verde-950",
                  ],
                },
                {
                  nombre: "rojo",
                  uso: "bloqueos",
                  clases: [
                    "bg-rojo-50",
                    "bg-rojo-100",
                    "bg-rojo-200",
                    "bg-rojo-300",
                    "bg-rojo-400",
                    "bg-rojo-500",
                    "bg-rojo-600",
                    "bg-rojo-700",
                    "bg-rojo-800",
                    "bg-rojo-900",
                    "bg-rojo-950",
                  ],
                },
                {
                  nombre: "hueso",
                  uso: "neutros",
                  clases: [
                    "bg-hueso-50",
                    "bg-hueso-100",
                    "bg-hueso-200",
                    "bg-hueso-300",
                    "bg-hueso-400",
                    "bg-hueso-500",
                    "bg-hueso-600",
                    "bg-hueso-700",
                    "bg-hueso-800",
                    "bg-hueso-900",
                    "bg-hueso-950",
                  ],
                },
              ] as const
            ).map(({ nombre, uso, clases }) => (
              <div key={nombre} className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-titulo">
                  {nombre} <span className="text-etiqueta">· {uso}</span>
                </p>
                <div className="flex overflow-hidden rounded-lg border border-borde-sutil">
                  {clases.map((clase) => (
                    <div key={clase} className={`h-8 flex-1 ${clase}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
