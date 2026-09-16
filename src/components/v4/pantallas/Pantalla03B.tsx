"use client";

/**
 * 03B · Prepará lo necesario + aviso de privacidad. Etapa 2 de 5.
 *
 * Artes `03B_00` y `03B_01` (la misma pantalla con la casilla sin marcar y
 * marcada) y `03B_02A`/`03B_02B`, que son **un solo aviso de privacidad**
 * visto arriba del todo y desplazado hasta el fondo — por eso acá hay una sola
 * hoja, la de `CapaLegalV4`.
 *
 * La casilla es el consentimiento del tratamiento de datos personales,
 * biométricos y de salud, y es **obligatoria**: sin ella no se habilita la
 * CTA. Cubre también la biometría de 03C, que por eso no vuelve a pedirla
 * (D-42, conflicto C-13 cerrado).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEXTOS_03B } from "@/domain/v4/textos-verificacion";
import { MarcoV4 } from "../MarcoV4";
import { BarraPlanV4 } from "../BarraPlanV4";
import { useCapaLegalV4 } from "../CapaLegalV4";
import { AvisoRojoV4, BotonPrincipalV4, CasillaConsentimientoV4 } from "../piezas";
import {
  IconoCarnetFrente,
  IconoEntregaDigital,
  IconoSelfie,
  IlustracionPreparacion,
} from "../ilustraciones";

const ICONOS_REQUISITO = [IconoCarnetFrente, IconoSelfie, IconoEntregaDigital, IconoEntregaDigital];

function Requisito({
  numero,
  titulo,
  cuerpo,
  Icono,
}: {
  readonly numero: number;
  readonly titulo: string;
  readonly cuerpo: string;
  readonly Icono: React.ComponentType<{ tamano?: number }>;
}) {
  return (
    <div className="v4-tarjeta flex items-start gap-3 p-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-bold"
        style={{ background: "var(--v4-azul-fondo)", color: "var(--v4-navy)" }}
      >
        {numero}
      </span>
      <span className="shrink-0 pt-0.5">
        <Icono tamano={28} />
      </span>
      <span className="min-w-0">
        <span className="block text-[1rem] font-bold leading-snug" style={{ color: "var(--v4-navy)" }}>
          {titulo}
        </span>
        <span className="mt-1 block text-[0.875rem] leading-snug" style={{ color: "var(--v4-azul-apagado)" }}>
          {cuerpo}
        </span>
      </span>
    </div>
  );
}

function Contenido() {
  const router = useRouter();
  const { abrir } = useCapaLegalV4();
  const [aceptado, setAceptado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continuar() {
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/p3/autorizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aceptada: true }),
      });
      const datos = (await respuesta.json()) as { ok: boolean; destino?: { ruta: string } };
      if (datos.ok) {
        router.push("/identidad");
        return;
      }
      if (datos.destino?.ruta) {
        router.push(datos.destino.ruta);
        return;
      }
      setError("No pudimos registrar tu autorización. Intentá nuevamente.");
    } catch {
      setError("No pudimos registrar tu autorización. Revisá tu conexión e intentá nuevamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="v4-titular">
            {TEXTOS_03B.titulo}
            <br />
            <em>{TEXTOS_03B.tituloAcento}</em>
          </h1>
          <p className="v4-bajada mt-2">{TEXTOS_03B.bajada}</p>
        </div>
        <IlustracionPreparacion tamano={112} className="shrink-0" />
      </div>

      <BarraPlanV4 className="mt-4" />

      <div className="mt-4 space-y-3">
        {TEXTOS_03B.requisitos.map((requisito, indice) => (
          <Requisito
            key={requisito.titulo}
            numero={indice + 1}
            titulo={requisito.titulo}
            cuerpo={requisito.cuerpo}
            Icono={ICONOS_REQUISITO[indice]}
          />
        ))}
      </div>

      <AvisoRojoV4 className="mt-4">
        <strong style={{ color: "var(--v4-rojo)" }}>{TEXTOS_03B.avisoTitulo}</strong> {TEXTOS_03B.aviso}
      </AvisoRojoV4>

      <div className="v4-tarjeta mt-4 p-4">
        <CasillaConsentimientoV4 marcada={aceptado} alCambiar={setAceptado} id="consentimiento-privacidad">
          <span style={{ color: "var(--v4-azul)" }}>
            {TEXTOS_03B.consentimientoAntes}
            <button
              type="button"
              className="v4-enlace"
              onClick={(evento) => {
                evento.preventDefault();
                abrir("privacidad");
              }}
            >
              {TEXTOS_03B.consentimientoEnlace}
            </button>
            {TEXTOS_03B.consentimientoDespues}
          </span>
        </CasillaConsentimientoV4>
      </div>

      {error ? <AvisoRojoV4 className="mt-4">{error}</AvisoRojoV4> : null}

      <div className="mt-5">
        <BotonPrincipalV4 onClick={continuar} disabled={!aceptado} cargando={enviando}>
          {TEXTOS_03B.continuar}
        </BotonPrincipalV4>
      </div>
    </>
  );
}

export function Pantalla03B() {
  return (
    <MarcoV4 codigo="03B">
      <Contenido />
    </MarcoV4>
  );
}
