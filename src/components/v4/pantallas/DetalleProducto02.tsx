"use client";

/**
 * 02A · 02B · 02C — el modal de coberturas, exclusiones y siniestros.
 *
 * Es **una hoja con tres pestañas**, no tres modales: así lo dibuja el arte, y
 * la pestaña activa se pinta navy pleno mientras las otras dos quedan blancas
 * con borde azul. El contenido de exclusiones y siniestros desborda y se
 * desplaza dentro de la hoja, con la barra azul que el arte dibuja a la
 * derecha (`.v4-scroll-azul`).
 */

import { Fragment, useState } from "react";
import {
  PESTANAS_02,
  TEXTOS_02A,
  TEXTOS_02B,
  TEXTOS_02C,
  TITULO_DETALLE_02,
  type PestanaDetalle02,
} from "@/domain/v4/textos-plan";
import { ORDEN_PLANES, PLANES, formatearGuaranies } from "@/domain/catalogo";
import { HojaV4 } from "../superficies";

/** Los millones de la tabla comparativa: `50 M`, `3,5 M`. */
function enMillones(monto: number): string {
  const millones = monto / 1_000_000;
  const texto = Number.isInteger(millones)
    ? String(millones)
    : millones.toFixed(1).replace(".", ",");
  return `${texto} M`;
}

function TarjetaAzul({ titulo, children }: { readonly titulo: string; readonly children: React.ReactNode }) {
  return (
    <div className="v4-tarjeta-azul p-4 pb-6">
      <p className="mb-2 text-[1rem] font-bold uppercase tracking-wide" style={{ color: "var(--v4-navy)" }}>
        {titulo}
      </p>
      <div className="text-[0.9375rem] leading-relaxed" style={{ color: "var(--v4-azul-apagado)" }}>
        {children}
      </div>
    </div>
  );
}

function Coberturas() {
  const planes = ORDEN_PLANES.map((id) => PLANES[id]);
  const filas = [
    { concepto: "Diagnóstico de cáncer", valor: (i: number) => enMillones(planes[i].indemnizacionCancerGs) },
    { concepto: "Fallecimiento", valor: (i: number) => enMillones(planes[i].muerteCualquierCausaGs) },
    {
      concepto: "Renta hospitalaria por accidente",
      valor: (i: number) => `${formatearGuaranies(planes[i].rentaHospitalariaPorDiaGs)}/día`,
      conNota: true,
    },
    { concepto: "Gastos médicos por accidente", valor: (i: number) => enMillones(planes[i].gastosMedicosAccidenteGs) },
  ];

  return (
    <div className="space-y-4">
      <div className="v4-tarjeta-azul overflow-hidden p-4">
        <p className="mb-3 text-[1rem] font-bold uppercase tracking-wide" style={{ color: "var(--v4-navy)" }}>
          {TEXTOS_02A.tablaTitulo}
        </p>
        <table className="w-full table-fixed border-collapse text-[0.8125rem]">
          <thead>
            <tr>
              <th className="w-[34%] p-1" />
              {planes.map((plan) => (
                <th
                  key={plan.id}
                  className="p-1 text-center font-bold"
                  style={{ color: "var(--v4-navy)", borderLeft: "1px solid var(--v4-azul-borde)" }}
                >
                  {plan.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <Fragment key={fila.concepto}>
                <tr style={{ borderTop: "1px solid var(--v4-azul-borde)" }}>
                  <th
                    scope="row"
                    className="p-2 text-left align-top font-bold"
                    style={{ color: "var(--v4-navy)" }}
                  >
                    {fila.concepto}
                  </th>
                  {planes.map((plan, indice) => (
                    <td
                      key={plan.id}
                      className="p-2 text-center align-top"
                      style={{ color: "var(--v4-azul-apagado)", borderLeft: "1px solid var(--v4-azul-borde)" }}
                    >
                      {fila.valor(indice)}
                    </td>
                  ))}
                </tr>
                {fila.conNota ? (
                  <tr style={{ borderTop: "1px solid var(--v4-azul-borde)" }}>
                    <td colSpan={4} className="p-2 text-center text-[0.75rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                      {TEXTOS_02A.notaRenta}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {TEXTOS_02A.tarjetas.map((tarjeta) => (
        <TarjetaAzul key={tarjeta.titulo} titulo={tarjeta.titulo}>
          {tarjeta.cuerpo}
        </TarjetaAzul>
      ))}
    </div>
  );
}

function ListaConVinetas({ puntos }: { readonly puntos: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {puntos.map((punto) => (
        <li key={punto} className="flex gap-2">
          <span
            aria-hidden="true"
            className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: "var(--v4-azul-apagado)" }}
          />
          <span>{punto}</span>
        </li>
      ))}
    </ul>
  );
}

function Exclusiones() {
  return (
    <div className="space-y-4">
      {TEXTOS_02B.grupos.map((grupo) => (
        <TarjetaAzul key={grupo.titulo} titulo={grupo.titulo}>
          <ListaConVinetas puntos={grupo.puntos} />
          {"recuadro" in grupo && grupo.recuadro ? (
            <div className="mt-4 rounded-lg p-3" style={{ background: "#E9EDF4" }}>
              <p className="mb-1 text-[0.875rem] font-bold uppercase" style={{ color: "var(--v4-navy)" }}>
                {grupo.recuadro.titulo}
              </p>
              <p className="text-[0.875rem]">{grupo.recuadro.cuerpo}</p>
            </div>
          ) : null}
        </TarjetaAzul>
      ))}
      {/* El único texto rojo de cuerpo de todo el handoff. */}
      <p className="rounded-lg px-4 py-3 text-[0.9375rem] font-bold" style={{ background: "#F1F4F8", color: "var(--v4-rojo)" }}>
        {TEXTOS_02B.cierre}
      </p>
    </div>
  );
}

function Siniestros() {
  return (
    <div className="space-y-4">
      {TEXTOS_02C.grupos.map((grupo) => (
        <TarjetaAzul key={grupo.titulo} titulo={grupo.titulo}>
          {"parrafos" in grupo && grupo.parrafos ? (
            <div className="space-y-2">
              {grupo.parrafos.map((parrafo) => (
                <p key={parrafo}>{parrafo}</p>
              ))}
            </div>
          ) : null}
          {"puntos" in grupo && grupo.puntos ? <ListaConVinetas puntos={grupo.puntos} /> : null}
        </TarjetaAzul>
      ))}
    </div>
  );
}

export function DetalleProducto02({
  pestanaInicial = "coberturas",
  alCerrar,
}: {
  readonly pestanaInicial?: PestanaDetalle02;
  readonly alCerrar: () => void;
}) {
  const [pestana, setPestana] = useState<PestanaDetalle02>(pestanaInicial);

  return (
    <HojaV4 titulo={TITULO_DETALLE_02} alCerrar={alCerrar}>
      <div className="mb-4 flex gap-2" role="tablist" aria-label={TITULO_DETALLE_02}>
        {PESTANAS_02.map((una) => {
          const activa = una.id === pestana;
          return (
            <button
              key={una.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setPestana(una.id)}
              className="flex-1 rounded-lg border px-2 py-2.5 text-[0.8125rem] font-bold uppercase tracking-wide"
              style={{
                background: activa ? "var(--v4-navy)" : "var(--v4-blanco)",
                borderColor: activa ? "var(--v4-navy)" : "var(--v4-azul-borde)",
                color: activa ? "var(--v4-blanco)" : "var(--v4-navy)",
              }}
            >
              {una.rotulo}
            </button>
          );
        })}
      </div>

      {pestana === "coberturas" ? <Coberturas /> : null}
      {pestana === "exclusiones" ? <Exclusiones /> : null}
      {pestana === "siniestros" ? <Siniestros /> : null}
    </HojaV4>
  );
}
