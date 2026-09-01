"use client";

/**
 * La ventana del entorno de Bancard, simulada — el equivalente al modal del
 * canvas («Ventana simulada del entorno de Bancard para esta demostración»).
 *
 * **Por qué existe.** Antes de esto, con tarjeta la pantalla ofrecía un enlace
 * «Abrir formulario seguro ↗» que llevaba a otra pestaña: en una demostración
 * eso saca a la persona del recorrido y no muestra el paso que más importa,
 * que es el cobro ocurriendo. El canvas lo resuelve al revés — el formulario
 * aparece solo, dentro de la pantalla, con sus campos, el botón de completar
 * con datos de ejemplo y el de pagar.
 *
 * **Regla inviolable #6, dicha en código.** Los valores de la tarjeta viven
 * únicamente en el estado de este componente: no se mandan a ningún endpoint,
 * no se persisten y no se registran. `alPagar` no los recibe — avisa que la
 * persona apretó pagar, nada más. En producción esta ventana no existe: el
 * formulario es el de Bancard y los datos nunca pasan por acá.
 */
import { useState } from "react";

const TARJETA_DE_EJEMPLO = {
  numero: "4509 8765 1234 0987",
  vencimiento: "09/29",
  cvv: "123",
} as const;

function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function VentanaBancardSimulada({
  importeFormateado,
  titularSugerido,
  procesando,
  alPagar,
  datosDeEjemploDisponibles,
}: {
  readonly importeFormateado: string;
  readonly titularSugerido: string;
  readonly procesando: boolean;
  readonly alPagar: () => void;
  /** El botón de datos de ejemplo es de demostración, como en el canvas. */
  readonly datosDeEjemploDisponibles: boolean;
}) {
  const [numero, setNumero] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [cvv, setCvv] = useState("");
  const [titular, setTitular] = useState("");
  const [mostrarFaltantes, setMostrarFaltantes] = useState(false);

  const faltan: string[] = [];
  if (soloDigitos(numero).length < 15) faltan.push("el número de la tarjeta");
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(vencimiento.trim())) faltan.push("el vencimiento (MM/AA)");
  if (soloDigitos(cvv).length < 3) faltan.push("el código de seguridad");
  if (titular.trim().split(/\s+/).length < 2) faltan.push("el nombre del titular");
  const completa = faltan.length === 0;

  const campo =
    "h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-sm text-cuerpo";
  const etiqueta = "text-xs font-semibold text-etiqueta";

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-azul-300 bg-superficie-suave p-4 dark:border-azul-700">
      <header className="flex flex-col gap-0.5">
        <p className="text-[11px] font-bold tracking-wide text-etiqueta uppercase">
          Entorno seguro de Bancard
        </p>
        <h3 className="text-sm font-bold text-titulo">Pagá {importeFormateado} con tu tarjeta</h3>
      </header>

      <div className="v3-rejilla" style={{ ["--v3-min" as string]: "200px" }}>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Número de la tarjeta</span>
          <input
            className={campo}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0000 0000 0000 0000"
            value={numero}
            onChange={(evento) => setNumero(evento.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Vencimiento</span>
          <input
            className={campo}
            placeholder="MM/AA"
            maxLength={5}
            autoComplete="off"
            value={vencimiento}
            onChange={(evento) => setVencimiento(evento.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Código de seguridad</span>
          <input
            className={campo}
            placeholder="CVV"
            maxLength={4}
            autoComplete="off"
            value={cvv}
            onChange={(evento) => setCvv(evento.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiqueta}>Nombre y apellido como figura en la tarjeta</span>
          <input
            className={campo}
            autoComplete="off"
            value={titular}
            onChange={(evento) => setTitular(evento.target.value)}
          />
        </label>
      </div>

      {datosDeEjemploDisponibles ? (
        <button
          type="button"
          onClick={() => {
            setNumero(TARJETA_DE_EJEMPLO.numero);
            setVencimiento(TARJETA_DE_EJEMPLO.vencimiento);
            setCvv(TARJETA_DE_EJEMPLO.cvv);
            setTitular(titularSugerido);
            setMostrarFaltantes(false);
          }}
          className="w-fit text-xs font-semibold text-azul-700 underline underline-offset-2 dark:text-azul-300"
        >
          Completar con datos de ejemplo (demo)
        </button>
      ) : null}

      {mostrarFaltantes && !completa ? (
        <p className="rounded-lg border border-naranja-300 bg-naranja-50 px-3 py-2 text-sm text-cuerpo dark:border-naranja-700 dark:bg-naranja-950">
          Te falta {faltan.join(", ")}.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (!completa) {
            setMostrarFaltantes(true);
            return;
          }
          alPagar();
        }}
        aria-disabled={!completa || procesando}
        className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:opacity-60"
      >
        {procesando ? "Autorizando el cobro…" : `Pagar ${importeFormateado}`}
      </button>

      <p className="text-xs text-etiqueta">
        Ventana simulada del entorno de Bancard para esta demostración. En producción se abre el
        formulario real de Bancard: los datos de tu tarjeta no pasan por SeguroLoTengo ni por
        Interseguros, y acá tampoco salen de tu navegador.
      </p>
    </div>
  );
}
