"use client";

import { useEffect, useRef } from "react";
import { LONGITUD_CODIGO_OTP } from "@/domain/reglas-otp";

/**
 * Seis casillas de un dígito para el código de verificación. Componente
 * compartido: lo usan P1 (WhatsApp), P4 (correo) y el paso de firma, que
 * tienen la misma mecánica de entrada aunque sean tres OTP distintos e
 * independientes (regla inviolable #1).
 *
 * Puramente presentacional y controlado: no valida el código, no habla con
 * la API y no sabe de qué OTP se trata. El valor vive en la pantalla.
 *
 * Nunca muestra el código recibido ni lo autocompleta desde ningún lado: lo
 * único que hay acá es lo que la persona tipea o pega.
 */
export interface CamposOtpProps {
  /** Dígitos ya ingresados, de 0 a `longitud` caracteres. */
  valor: string;
  onChange: (valor: string) => void;
  /** Se dispara al completar la última casilla (para enviar el formulario). */
  onCompleto?: (valor: string) => void;
  deshabilitado?: boolean;
  /** Etiqueta accesible del grupo; cada casilla se numera a partir de ella. */
  etiqueta: string;
  idPrefijo?: string;
  longitud?: number;
  /** Marca las casillas en rojo (código incorrecto, expirado, etc.). */
  conError?: boolean;
  className?: string;
}

export function CamposOtp({
  valor,
  onChange,
  onCompleto,
  deshabilitado = false,
  etiqueta,
  idPrefijo = "otp",
  longitud = LONGITUD_CODIGO_OTP,
  conError = false,
  className = "",
}: CamposOtpProps) {
  const referencias = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    referencias.current = referencias.current.slice(0, longitud);
  }, [longitud]);

  function enfocar(indice: number) {
    referencias.current[Math.max(0, Math.min(longitud - 1, indice))]?.focus();
  }

  function escribir(indice: number, digitos: string) {
    const limpios = digitos.replace(/\D/g, "");
    if (!limpios) return;

    const caracteres = valor.padEnd(longitud, " ").split("");
    for (let i = 0; i < limpios.length && indice + i < longitud; i += 1) {
      caracteres[indice + i] = limpios[i];
    }
    const nuevo = caracteres.join("").trimEnd();
    onChange(nuevo);

    const siguiente = Math.min(indice + limpios.length, longitud - 1);
    enfocar(siguiente);
    if (nuevo.length === longitud) onCompleto?.(nuevo);
  }

  function borrar(indice: number) {
    const caracteres = valor.padEnd(longitud, " ").split("");
    if (caracteres[indice] !== " " && caracteres[indice] !== undefined) {
      caracteres[indice] = " ";
      onChange(caracteres.join("").trimEnd());
      return;
    }
    if (indice > 0) {
      caracteres[indice - 1] = " ";
      onChange(caracteres.join("").trimEnd());
      enfocar(indice - 1);
    }
  }

  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={`flex items-center gap-2 ${className}`}
    >
      {Array.from({ length: longitud }, (_, indice) => (
        <input
          key={indice}
          ref={(nodo) => {
            referencias.current[indice] = nodo;
          }}
          id={`${idPrefijo}-${indice}`}
          // `text` + inputMode numérico: `number` trae flechitas y permite
          // signos y exponentes que acá no tienen sentido.
          type="text"
          inputMode="numeric"
          autoComplete={indice === 0 ? "one-time-code" : "off"}
          maxLength={longitud}
          disabled={deshabilitado}
          aria-label={`${etiqueta}, dígito ${indice + 1} de ${longitud}`}
          value={valor[indice]?.trim() ?? ""}
          onChange={(evento) => escribir(indice, evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Backspace") {
              evento.preventDefault();
              borrar(indice);
            } else if (evento.key === "ArrowLeft") {
              evento.preventDefault();
              enfocar(indice - 1);
            } else if (evento.key === "ArrowRight") {
              evento.preventDefault();
              enfocar(indice + 1);
            }
          }}
          onPaste={(evento) => {
            evento.preventDefault();
            escribir(indice, evento.clipboardData.getData("text"));
          }}
          className={`h-12 w-10 rounded-lg border text-center text-lg font-bold text-titulo tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500 disabled:opacity-50 sm:h-14 sm:w-12 ${
            conError
              ? "border-rojo-500 bg-rojo-50 dark:bg-rojo-950"
              : "border-borde-sutil bg-superficie"
          }`}
        />
      ))}
    </div>
  );
}
