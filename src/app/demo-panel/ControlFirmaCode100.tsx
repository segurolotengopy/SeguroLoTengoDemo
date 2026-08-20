"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Pantalla de Code100 simulada, dentro del panel de demo.
 *
 * En una demostración no llega ningún WhatsApp ni ningún correo con el enlace
 * de firma, así que esto hace de "otro lado": abrir el enlace (ahí Code100
 * emite el OTP de firma), tipear el código y firmar, o rechazar.
 *
 * Es **el único lugar** donde el código del OTP de firma puede verse, igual que
 * los de P1 y P4: en la sesión simulada solo queda su HMAC, y ningún método de
 * `SignatureProvider` lo devuelve (regla inviolable #2).
 *
 * El botón "Firmar con falla a mitad" es la demostración de la regla inviolable
 * #3: corta el sellado entre las dos huellas. Lo que hay que mirar después es
 * que **ninguno** de los dos documentos quedó firmado y que el acto se puede
 * reintentar.
 */

export interface SesionFirmaVisible {
  readonly idCode100: string;
  readonly expedienteId: string;
  readonly canal: string;
  readonly destino: string;
  readonly enlaceEnviadoEn: string;
  readonly venceEn: string;
  readonly estado: "ESPERANDO_APERTURA" | "ESPERANDO_CODIGO" | "FIRMADA" | "CERRADA";
  readonly detalleEstado: string;
  readonly codigo: string | null;
  readonly hashSolicitudFirmada: string | null;
  readonly hashFipfFirmado: string | null;
}

export interface ControlFirmaCode100Props {
  sesiones: readonly SesionFirmaVisible[];
}

const MENSAJES: Readonly<Record<string, string>> = {
  NO_ENCONTRADA: "Code100 no conoce ese acto de firma.",
  YA_CERRADA: "Ese acto de firma ya se cerró.",
  EXPIRADA: "El enlace venció.",
  ENLACE_EXPIRADO: "El enlace venció.",
  ENLACE_NO_ABIERTO: "Abrí el enlace primero: el código se emite ahí.",
  CODIGO_REQUERIDO: "Escribí el código de 6 dígitos.",
  CODIGO_INCORRECTO: "Código incorrecto.",
  INTENTOS_AGOTADOS: "Se agotaron los 3 intentos.",
  OTP_EXPIRADO: "El código venció (5 minutos).",
  FALLA_DEL_PROVEEDOR:
    "Falla simulada a mitad del sellado. Mirá abajo: ninguno de los dos documentos quedó firmado.",
  SESION_INVALIDA: "Se venció la sesión del panel. Volvé a ingresar la clave.",
  PEDIDO_INVALIDO: "No pudimos procesar el pedido.",
};

function Tarjeta({ sesion }: { sesion: SesionFirmaVisible }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [enProceso, setEnProceso] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accionar(cuerpo: Record<string, unknown>) {
    setEnProceso(true);
    setError(null);
    setAviso(null);
    try {
      const respuesta = await fetch("/api/demo-panel/firma", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idCode100: sesion.idCode100, ...cuerpo }),
      });
      const datos = (await respuesta.json().catch(() => ({}))) as {
        ok?: boolean;
        motivo?: string;
        intentosRestantes?: number;
      };
      if (!datos.ok) {
        const base = MENSAJES[datos.motivo ?? ""] ?? "No pudimos completar la acción.";
        setError(
          datos.intentosRestantes !== undefined
            ? `${base} Te quedan ${datos.intentosRestantes} intentos.`
            : base,
        );
        router.refresh();
        return;
      }
      setCodigo("");
      setAviso("Listo.");
      router.refresh();
    } catch {
      setError("No pudimos conectarnos.");
    } finally {
      setEnProceso(false);
    }
  }

  const cerrada = sesion.estado === "FIRMADA" || sesion.estado === "CERRADA";

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-borde-tenue bg-superficie-suave p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <code className="font-mono text-xs font-semibold text-titulo">{sesion.idCode100}</code>
        <span
          className={`text-xs font-bold ${
            sesion.estado === "FIRMADA"
              ? "text-verde-700 dark:text-verde-300"
              : sesion.estado === "CERRADA"
                ? "text-rojo-700 dark:text-rojo-300"
                : "text-naranja-700 dark:text-naranja-300"
          }`}
        >
          {sesion.detalleEstado}
        </span>
        <span className="text-xs text-etiqueta">
          {sesion.canal} {sesion.destino} · vence{" "}
          {new Date(sesion.venceEn).toLocaleTimeString("es-PY")}
        </span>
      </div>

      {sesion.codigo ? (
        <p className="font-mono text-2xl font-bold tracking-widest text-titulo">{sesion.codigo}</p>
      ) : null}

      {!cerrada ? (
        <div className="flex flex-wrap items-center gap-2">
          {sesion.estado === "ESPERANDO_APERTURA" ? (
            <button
              type="button"
              disabled={enProceso}
              onClick={() => void accionar({ accion: "ABRIR" })}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-azul-700 px-4 text-xs font-bold tracking-wide text-white uppercase transition-colors hover:bg-azul-600 disabled:opacity-40"
            >
              Abrir enlace
            </button>
          ) : (
            <>
              <label htmlFor={`codigo-${sesion.idCode100}`} className="sr-only">
                Código de firma
              </label>
              <input
                id={`codigo-${sesion.idCode100}`}
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={codigo}
                onChange={(evento) => setCodigo(evento.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="h-10 w-28 rounded-lg border border-borde-sutil bg-superficie px-3 text-center font-mono text-base tracking-widest text-titulo"
              />
              <button
                type="button"
                disabled={enProceso || codigo.length !== 6}
                onClick={() => void accionar({ accion: "FIRMAR", codigo })}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-verde-700 px-4 text-xs font-bold tracking-wide text-white uppercase transition-colors hover:bg-verde-600 disabled:opacity-40"
              >
                Firmar
              </button>
              <button
                type="button"
                disabled={enProceso || codigo.length !== 6}
                onClick={() => void accionar({ accion: "FIRMAR", codigo, fallarAMitad: true })}
                title="Corta el sellado entre la Solicitud y el FIPF"
                className="inline-flex h-10 items-center justify-center rounded-lg border-2 border-naranja-500 px-4 text-xs font-bold tracking-wide text-naranja-700 uppercase transition-colors hover:bg-naranja-50 disabled:opacity-40 dark:text-naranja-300 dark:hover:bg-naranja-950"
              >
                Firmar con falla a mitad
              </button>
            </>
          )}
          <button
            type="button"
            disabled={enProceso}
            onClick={() => void accionar({ accion: "RECHAZAR" })}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-rojo-400 px-4 text-xs font-bold tracking-wide text-rojo-700 uppercase transition-colors hover:bg-rojo-50 disabled:opacity-40 dark:text-rojo-300 dark:hover:bg-rojo-950"
          >
            Rechazar
          </button>
        </div>
      ) : null}

      <dl className="flex flex-col gap-0.5 border-t border-borde-tenue pt-2 font-mono text-[11px] break-all text-etiqueta">
        <div>
          <dt className="inline font-sans font-semibold">Solicitud firmada: </dt>
          <dd className="inline">{sesion.hashSolicitudFirmada ?? "— sin firmar —"}</dd>
        </div>
        <div>
          <dt className="inline font-sans font-semibold">FIPF firmado: </dt>
          <dd className="inline">{sesion.hashFipfFirmado ?? "— sin firmar —"}</dd>
        </div>
      </dl>

      {aviso ? (
        <p role="status" className="text-sm font-semibold text-verde-700 dark:text-verde-300">
          {aviso}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function ControlFirmaCode100({ sesiones }: ControlFirmaCode100Props) {
  if (sesiones.length === 0) {
    return (
      <p className="text-sm text-cuerpo">
        Todavía no se abrió ningún acto de firma en esta instancia. Llegá a{" "}
        <code className="font-mono">/firma</code> y presioná{" "}
        <strong>ENVIAR ENLACE SEGURO DE FIRMA</strong>.
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {sesiones.map((sesion) => (
          <Tarjeta key={sesion.idCode100} sesion={sesion} />
        ))}
      </ul>
      <p className="text-xs text-etiqueta">
        Las dos huellas de abajo aparecen juntas o no aparece ninguna: la Solicitud y el FIPF se
        sellan en una sola escritura (regla inviolable #3).
      </p>
    </>
  );
}
