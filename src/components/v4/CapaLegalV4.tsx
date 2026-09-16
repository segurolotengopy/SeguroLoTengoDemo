"use client";

/**
 * La capa legal del flujo v4: el menú, los cuatro detalles de información
 * legal, el aviso de privacidad y la confirmación de salida.
 *
 * ## Por qué es una capa y no seis modales sueltos
 *
 * Porque son los mismos seis en las quince pantallas. El ☰ de la cabecera y el
 * enlace `Información legal` del pie están en todas, y desde 01E se abre
 * cualquiera de los otros cuatro. Montarlos por pantalla significaba repetir
 * seis textos legales quince veces —y que quince copias divergieran—, que es
 * justamente lo que el handoff pide evitar cuando congela los textos.
 *
 * Quien quiera abrir uno pide `useCapaLegalV4().abrir("contacto")`. Nadie
 * fuera de este archivo conoce cómo están dibujados.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TEXTOS_01A,
  TEXTOS_01B_MENU,
  TEXTOS_01B_SALIDA,
  TEXTOS_01C,
  TEXTOS_01D,
  TEXTOS_01E,
  TEXTOS_AVISO_PRIVACIDAD,
} from "@/domain/v4/textos-portada";
import { CORREO_RETRACTO_Y_DATOS, INTERSEGUROS, WHATSAPP_ATENCION } from "@/domain/entidades";
import { BotonPrincipalV4, BotonSecundarioV4, IconoChevronDerecha } from "./piezas";
import { DialogoV4, HojaV4, PanelLateralV4 } from "./superficies";

export type PanelLegalV4 =
  | "menu"
  | "salida"
  | "legal"
  | "cookies"
  | "responsabilidades"
  | "contacto"
  | "privacidad";

interface CapaLegalContexto {
  readonly abrir: (panel: PanelLegalV4) => void;
  readonly cerrar: () => void;
  readonly abierto: PanelLegalV4 | null;
}

const Contexto = createContext<CapaLegalContexto | null>(null);

export function useCapaLegalV4(): CapaLegalContexto {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useCapaLegalV4 fuera de <CapaLegalV4>. Toda pantalla v4 va dentro del marco.");
  }
  return contexto;
}

/** Tarjeta azul con título en versalitas y cuerpo, la del patrón de modal. */
function TarjetaDetalle({
  titulo,
  children,
  versalitas = true,
  alPulsar,
}: {
  readonly titulo: string;
  readonly children: React.ReactNode;
  readonly versalitas?: boolean;
  readonly alPulsar?: () => void;
}) {
  const contenido = (
    <>
      <p
        className="mb-2 font-bold"
        style={{
          color: "var(--v4-navy)",
          textTransform: versalitas ? "uppercase" : "none",
          fontSize: "1rem",
          letterSpacing: versalitas ? "0.02em" : undefined,
        }}
      >
        {titulo}
      </p>
      <div className="text-[0.9375rem] leading-relaxed" style={{ color: "var(--v4-azul-apagado)" }}>
        {children}
      </div>
    </>
  );

  if (alPulsar) {
    return (
      <button type="button" onClick={alPulsar} className="v4-tarjeta-azul w-full p-4 text-left">
        {contenido}
      </button>
    );
  }
  return <div className="v4-tarjeta-azul p-4 pb-6">{contenido}</div>;
}

export function CapaLegalV4({ children }: { readonly children: React.ReactNode }) {
  const [abierto, setAbierto] = useState<PanelLegalV4 | null>(null);
  const router = useRouter();

  const abrir = useCallback((panel: PanelLegalV4) => setAbierto(panel), []);
  const cerrar = useCallback(() => setAbierto(null), []);
  const valor = useMemo(() => ({ abrir, cerrar, abierto }), [abrir, cerrar, abierto]);

  /**
   * Salir y descartar: cierra la sesión del trámite y vuelve a la portada.
   *
   * Se pide al servidor y no se limpia en el navegador, porque lo que hay que
   * descartar es la cookie de sesión del expediente, no un estado de React.
   */
  async function salirYDescartar() {
    try {
      await fetch("/api/flujo/cerrar", { method: "POST" });
    } finally {
      cerrar();
      router.push("/");
      router.refresh();
    }
  }

  return (
    <Contexto.Provider value={valor}>
      {children}

      {abierto === "menu" ? (
        <PanelLateralV4 titulo={TEXTOS_01B_MENU.titulo} alCerrar={cerrar}>
          <ul>
            {TEXTOS_01B_MENU.opciones.map((opcion) => (
              <li key={opcion.id}>
                <button
                  type="button"
                  onClick={() =>
                    opcion.id === "inicio" ? setAbierto("salida") : setAbierto(opcion.id as PanelLegalV4)
                  }
                  className="flex w-full items-center justify-between border-b px-5 py-5 text-left"
                  style={{ borderColor: "var(--v4-gris-borde)" }}
                >
                  <span className="text-[0.9375rem] font-bold uppercase tracking-wide" style={{ color: "var(--v4-navy)" }}>
                    {opcion.rotulo}
                  </span>
                  <IconoChevronDerecha />
                </button>
              </li>
            ))}
          </ul>
          <div className="px-5 py-8 text-[0.8125rem]" style={{ color: "var(--v4-azul-apagado)" }}>
            {TEXTOS_01B_MENU.pie.map((linea) => (
              <p key={linea}>{linea}</p>
            ))}
            <button type="button" onClick={() => setAbierto("legal")} className="v4-enlace mt-3 block">
              {TEXTOS_01B_MENU.enlaceLegal}
            </button>
          </div>
        </PanelLateralV4>
      ) : null}

      {abierto === "salida" ? (
        <DialogoV4 titulo={TEXTOS_01B_SALIDA.titulo} alCerrar={cerrar}>
          <p className="mt-3 text-center text-[0.9375rem] leading-relaxed" style={{ color: "var(--v4-azul-apagado)" }}>
            {TEXTOS_01B_SALIDA.cuerpo}
          </p>
          <div className="mt-6 space-y-3">
            <BotonSecundarioV4 onClick={cerrar}>{TEXTOS_01B_SALIDA.continuar}</BotonSecundarioV4>
            <BotonPrincipalV4 onClick={salirYDescartar}>{TEXTOS_01B_SALIDA.salir}</BotonPrincipalV4>
          </div>
        </DialogoV4>
      ) : null}

      {abierto === "legal" ? (
        <HojaV4 titulo={TEXTOS_01E.titulo} bajada={TEXTOS_01E.bajada} alCerrar={cerrar}>
          <div className="space-y-3">
            {TEXTOS_01E.tarjetas.map((tarjeta) => (
              <TarjetaDetalle
                key={tarjeta.id}
                titulo={tarjeta.titulo}
                versalitas={false}
                alPulsar={() => setAbierto(tarjeta.id as PanelLegalV4)}
              >
                {tarjeta.cuerpo}
              </TarjetaDetalle>
            ))}
          </div>
        </HojaV4>
      ) : null}

      {abierto === "cookies" ? (
        <HojaV4 titulo={TEXTOS_01A.titulo} bajada={TEXTOS_01A.bajada} alCerrar={cerrar}>
          <div className="space-y-4">
            {TEXTOS_01A.tarjetas.map((tarjeta) => (
              <TarjetaDetalle key={tarjeta.titulo} titulo={tarjeta.titulo} versalitas={false}>
                {tarjeta.cuerpo}
              </TarjetaDetalle>
            ))}
          </div>
        </HojaV4>
      ) : null}

      {abierto === "responsabilidades" ? (
        <HojaV4 titulo={TEXTOS_01C.titulo} bajada={TEXTOS_01C.bajada} alCerrar={cerrar}>
          <div className="space-y-4">
            {TEXTOS_01C.tarjetas.map((tarjeta) => (
              <TarjetaDetalle key={tarjeta.titulo} titulo={tarjeta.titulo}>
                {tarjeta.cuerpo}
              </TarjetaDetalle>
            ))}
          </div>
        </HojaV4>
      ) : null}

      {abierto === "contacto" ? (
        <HojaV4 titulo={TEXTOS_01D.titulo} bajada={TEXTOS_01D.bajada} alCerrar={cerrar}>
          <div className="space-y-4">
            <TarjetaDetalle titulo={TEXTOS_01D.canalesTitulo} versalitas={false}>
              {TEXTOS_01D.canalesCuerpo}
            </TarjetaDetalle>
            <div className="v4-tarjeta-azul p-4 pb-6">
              <p className="font-bold uppercase" style={{ color: "var(--v4-navy)" }}>
                {INTERSEGUROS.razonSocial}
              </p>
              <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                {INTERSEGUROS.actividad} · Matrícula SIS N.º {INTERSEGUROS.matriculaSis}
              </p>

              {/* Los datos que todavía no cerró D-19 **se omiten**: una pantalla
                  de seguros con un teléfono de fantasía es un problema
                  regulatorio, no una imperfección de maqueta. */}
              {WHATSAPP_ATENCION ? (
                <div className="mt-4">
                  <p className="text-[0.875rem] font-bold" style={{ color: "var(--v4-navy)" }}>
                    {TEXTOS_01D.etiquetas.whatsapp}
                  </p>
                  <p className="text-[1.125rem] font-bold" style={{ color: "var(--v4-navy)" }}>
                    {WHATSAPP_ATENCION}
                  </p>
                </div>
              ) : null}

              <div className="mt-4">
                <p className="text-[0.875rem] font-bold" style={{ color: "var(--v4-navy)" }}>
                  {TEXTOS_01D.etiquetas.correo}
                </p>
                <p style={{ color: "var(--v4-navy)" }}>{CORREO_RETRACTO_Y_DATOS}</p>
              </div>

              <div className="mt-4">
                <p className="text-[0.875rem] font-bold" style={{ color: "var(--v4-navy)" }}>
                  {TEXTOS_01D.etiquetas.oficinas}
                </p>
                <p className="text-[0.9375rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                  {INTERSEGUROS.domicilio}
                </p>
              </div>

              <a
                href={INTERSEGUROS.sitioWeb ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="v4-enlace mt-4 inline-block"
              >
                {INTERSEGUROS.sitioWeb?.replace(/^https?:\/\//, "")}
              </a>
            </div>
          </div>
        </HojaV4>
      ) : null}

      {abierto === "privacidad" ? (
        <HojaV4
          titulo={TEXTOS_AVISO_PRIVACIDAD.titulo}
          bajada={TEXTOS_AVISO_PRIVACIDAD.bajada}
          alCerrar={cerrar}
        >
          <p className="mb-3 flex items-center justify-center gap-2 text-[0.9375rem] font-bold" style={{ color: "var(--v4-navy)" }}>
            {TEXTOS_AVISO_PRIVACIDAD.indicacionDeslizar}
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M12 5 v13 M6.5 12.5 L12 18.5 L17.5 12.5" fill="none" stroke="var(--v4-rojo)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </p>
          <div className="space-y-4">
            {TEXTOS_AVISO_PRIVACIDAD.tarjetas.map((tarjeta) => (
              <TarjetaDetalle key={tarjeta.titulo} titulo={tarjeta.titulo}>
                {tarjeta.cuerpo}
              </TarjetaDetalle>
            ))}
          </div>
        </HojaV4>
      ) : null}
    </Contexto.Provider>
  );
}
