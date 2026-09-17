"use client";

/**
 * 03E2 · 03E2A · 03E2B · 04A1 — revisión manual.
 *
 * **Una sola pantalla para los dos motivos.** Entre el arte de la revisión PEP
 * y el de la evaluación médica cambian tres cosas —el título de la tarjeta, el
 * primer párrafo y la segunda fila del estado— y nada más; dibujarlas por
 * separado garantizaba que se desincronizaran.
 *
 * La etapa del stepper **sí** cambia: 03E2 se dispara al terminar 03E (etapa
 * 3) y 04A1 dentro de 04A (etapa 4). El arte dibuja `4 de 5` en los dos y se
 * corrige, porque una pantalla terminal muestra la etapa en la que el flujo se
 * detuvo (`ANALISIS_VISUAL_PNG.md` §7).
 *
 * No hay ninguna acción hacia firma ni pago, y no porque esta pantalla se
 * abstenga: desde `DERIVADO_MANUAL` no existe transición que lleve ahí.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TEXTOS_REVISION_MANUAL } from "@/domain/v4/textos-actividad";
import type { MotivoRevisionManualV4 } from "@/domain/v4/etapas";
import { MarcoV4 } from "../MarcoV4";
import { BarraPlanV4 } from "../BarraPlanV4";
import { DialogoV4 } from "../superficies";
import {
  AvisoAzulV4,
  BotonPrincipalV4,
  BotonSecundarioV4,
  IconoAlerta,
  IconoCruzGrande,
  IconoReloj,
  IconoTildeDisco,
} from "../piezas";
import { IlustracionRevisionMedica, IlustracionRevisionPep } from "../ilustraciones";

interface CasoDelServidor {
  readonly numeroCaso: string;
  readonly motivo: "SALUD" | "PEP" | "SALUD_Y_PEP";
}

/** Círculo vacío de los hitos que todavía no ocurrieron. */
function CirculoVacio() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="10" fill="none" stroke="var(--v4-gris-deshabilitado)" strokeWidth="1.8" />
    </svg>
  );
}

function FilaEstado({
  concepto,
  estado,
  icono,
}: {
  readonly concepto: string;
  readonly estado: string;
  readonly icono: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
        {concepto}
      </span>
      <span className="flex items-center gap-2 text-[0.9375rem]" style={{ color: "var(--v4-navy)" }}>
        {icono}
        {estado}
      </span>
    </div>
  );
}

export function PantallaRevisionManual() {
  const router = useRouter();
  const [caso, setCaso] = useState<CasoDelServidor | null>(null);
  const [fallo, setFallo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const respuesta = await fetch("/api/expediente/caso");
        const datos = (await respuesta.json()) as { ok: boolean; caso?: CasoDelServidor };
        if (!vigente) return;
        // 03E2B · el caso no quedó registrado. La pantalla cambia de identidad:
        // no hay estado que mostrar porque no hay caso.
        if (!datos.ok || !datos.caso) {
          setFallo(true);
          return;
        }
        setCaso(datos.caso);
      } catch {
        if (vigente) setFallo(true);
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  async function cerrarSesion() {
    await fetch("/api/flujo/cerrar", { method: "POST" });
    router.push("/");
  }

  // 03E2B · error al registrar la revisión.
  if (fallo) {
    const error = TEXTOS_REVISION_MANUAL.error;
    return (
      <MarcoV4 codigo="03E2">
        <h1 className="text-[1.75rem] font-bold" style={{ color: "var(--v4-navy)" }}>
          {error.titulo}
        </h1>
        <p className="v4-bajada mt-2">{error.bajada}</p>

        <BarraPlanV4 className="mt-4" />

        <div className="v4-tarjeta mt-4 flex flex-col items-center px-4 py-10 text-center">
          <IconoCruzGrande />
          <p className="mt-6 text-[1.375rem] font-bold leading-tight" style={{ color: "var(--v4-rojo)" }}>
            {error.tarjetaTitulo}
          </p>
          {error.cuerpo.map((linea) => (
            <p key={linea} className="mt-2 text-[1rem]" style={{ color: "var(--v4-navy)" }}>
              {linea}
            </p>
          ))}
          <p className="mt-4 text-[1rem] font-bold" style={{ color: "var(--v4-navy)" }}>
            {error.remate}
          </p>
        </div>

        <AvisoAzulV4 className="mt-4">{error.aviso}</AvisoAzulV4>

        <div className="mt-5">
          <BotonPrincipalV4 onClick={cerrarSesion}>{error.boton}</BotonPrincipalV4>
        </div>
      </MarcoV4>
    );
  }

  // `SALUD_Y_PEP` se muestra como PEP: es el control de cumplimiento el que
  // manda cuando los dos concurren, y es el que fija la etapa del stepper.
  const motivo: MotivoRevisionManualV4 = caso?.motivo === "SALUD" ? "SALUD" : "PEP";
  const textos = TEXTOS_REVISION_MANUAL.porMotivo[motivo];
  const Ilustracion = motivo === "PEP" ? IlustracionRevisionPep : IlustracionRevisionMedica;

  return (
    <MarcoV4 codigo={motivo === "PEP" ? "03E2" : "04A1"}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="v4-titular">
            {TEXTOS_REVISION_MANUAL.titulo}
            <br />
            <em>{TEXTOS_REVISION_MANUAL.tituloAcento}</em>
          </h1>
          <p className="v4-bajada mt-2">{TEXTOS_REVISION_MANUAL.bajada}</p>
        </div>
        <Ilustracion tamano={112} className="shrink-0" />
      </div>

      <BarraPlanV4 className="mt-4" />

      <section className="v4-tarjeta mt-4 p-4">
        <div className="flex items-center gap-3">
          <IconoAlerta tamano={24} />
          <h2 className="text-[1.25rem] font-bold" style={{ color: "var(--v4-navy)" }}>
            {textos.tarjetaTitulo}
          </h2>
        </div>
        <div className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed" style={{ color: "var(--v4-azul-apagado)" }}>
          <p>{textos.primerParrafo}</p>
          <p>{textos.segundoParrafo}</p>
          <p>{TEXTOS_REVISION_MANUAL.tercerParrafo}</p>
        </div>
      </section>

      <section className="v4-tarjeta mt-4 p-4">
        <h2 className="text-[1.125rem] font-bold uppercase" style={{ color: "var(--v4-navy)" }}>
          {TEXTOS_REVISION_MANUAL.estadoTitulo}
        </h2>
        <div className="mt-2">
          <FilaEstado
            concepto={TEXTOS_REVISION_MANUAL.filas.datos.concepto}
            estado={TEXTOS_REVISION_MANUAL.filas.datos.estado}
            icono={<IconoTildeDisco tamano={22} />}
          />
          <FilaEstado
            concepto={textos.filaEstado}
            estado={TEXTOS_REVISION_MANUAL.enRevision}
            icono={<IconoReloj />}
          />
          <FilaEstado
            concepto={TEXTOS_REVISION_MANUAL.filas.firma.concepto}
            estado={TEXTOS_REVISION_MANUAL.filas.firma.estado}
            icono={<CirculoVacio />}
          />
          <FilaEstado
            concepto={TEXTOS_REVISION_MANUAL.filas.pago.concepto}
            estado={TEXTOS_REVISION_MANUAL.filas.pago.estado}
            icono={<CirculoVacio />}
          />
          <FilaEstado
            concepto={TEXTOS_REVISION_MANUAL.filas.cobertura.concepto}
            estado={TEXTOS_REVISION_MANUAL.filas.cobertura.estado}
            icono={<CirculoVacio />}
          />
        </div>
        <div className="mt-3 h-px" style={{ background: "var(--v4-gris-borde)" }} />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
            {TEXTOS_REVISION_MANUAL.etiquetaCaso}
          </span>
          <span className="text-[0.9375rem] font-bold" style={{ color: "var(--v4-navy)" }}>
            {caso?.numeroCaso ?? "—"}
          </span>
        </div>
      </section>

      <AvisoAzulV4 className="mt-4">{TEXTOS_REVISION_MANUAL.avisoCanales}</AvisoAzulV4>

      <div className="mt-5">
        <BotonPrincipalV4 onClick={() => setConfirmando(true)}>
          {TEXTOS_REVISION_MANUAL.cerrarSesion}
        </BotonPrincipalV4>
      </div>

      {confirmando ? (
        <DialogoV4
          titulo={TEXTOS_REVISION_MANUAL.confirmacion.titulo}
          alCerrar={() => setConfirmando(false)}
        >
          <p className="mt-3 text-center text-[0.9375rem] leading-relaxed" style={{ color: "var(--v4-azul-apagado)" }}>
            {TEXTOS_REVISION_MANUAL.confirmacion.cuerpo}
          </p>
          <div className="mt-6 space-y-3">
            <BotonSecundarioV4 onClick={() => setConfirmando(false)}>
              {TEXTOS_REVISION_MANUAL.confirmacion.seguirViendo}
            </BotonSecundarioV4>
            <BotonPrincipalV4 onClick={cerrarSesion}>
              {TEXTOS_REVISION_MANUAL.cerrarSesion}
            </BotonPrincipalV4>
          </div>
        </DialogoV4>
      ) : null}
    </MarcoV4>
  );
}
