"use client";

/**
 * Las seis casillas del código, con el dibujo del handoff v4.
 *
 * Cuadradas, de borde gris cuando no hay código vivo y **azul cuando sí**, con
 * halo de foco en la que espera el próximo dígito. El código **nunca se
 * muestra fuera de estas casillas** y no viaja a ningún log (regla inviolable
 * #2); acá solo vive en el estado del componente hasta que se envía.
 *
 * Pegar el código completo funciona: es lo primero que hace cualquiera que lo
 * recibe por WhatsApp en el mismo teléfono.
 */

import { useEffect, useRef } from "react";

export function CamposOtpV4({
  valor,
  alCambiar,
  activo,
  deshabilitado = false,
  atenuado = false,
  alCompletar,
}: {
  readonly valor: string;
  readonly alCambiar: (valor: string) => void;
  /** `true` cuando hay un código vigente: las casillas van con borde azul. */
  readonly activo: boolean;
  readonly deshabilitado?: boolean;
  /** Durante la verificación los dígitos se atenúan, como en el arte 03A_05. */
  readonly atenuado?: boolean;
  readonly alCompletar?: (codigo: string) => void;
}) {
  const referencias = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (valor.length === 6) alCompletar?.(valor);
    // `alCompletar` cambia en cada render del padre; incluirlo dispararía el
    // envío en bucle. Lo que importa es que el código llegó a seis dígitos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  function escribir(indice: number, entrada: string) {
    const digitos = entrada.replace(/\D/g, "");
    if (!digitos) return;

    const siguiente = (valor.slice(0, indice) + digitos + valor.slice(indice + digitos.length))
      .slice(0, 6);
    alCambiar(siguiente);

    const destino = Math.min(indice + digitos.length, 5);
    referencias.current[destino]?.focus();
  }

  function retroceder(indice: number, evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== "Backspace") return;
    evento.preventDefault();
    if (valor[indice]) {
      alCambiar(valor.slice(0, indice) + valor.slice(indice + 1));
      return;
    }
    if (indice > 0) {
      alCambiar(valor.slice(0, indice - 1) + valor.slice(indice));
      referencias.current[indice - 1]?.focus();
    }
  }

  return (
    <div className="flex gap-2">
      {[0, 1, 2, 3, 4, 5].map((indice) => (
        <input
          key={indice}
          ref={(elemento) => {
            referencias.current[indice] = elemento;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={indice === 0 ? "one-time-code" : "off"}
          maxLength={6}
          value={valor[indice] ?? ""}
          disabled={deshabilitado}
          aria-label={`Dígito ${indice + 1} de 6`}
          onChange={(evento) => escribir(indice, evento.target.value)}
          onKeyDown={(evento) => retroceder(indice, evento)}
          className={`v4-otp ${activo && !deshabilitado ? "v4-otp-activo" : ""}`}
          style={atenuado ? { color: "var(--v4-gris-texto)" } : undefined}
        />
      ))}
    </div>
  );
}
