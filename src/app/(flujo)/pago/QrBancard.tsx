"use client";

/**
 * El QR de Bancard, dibujado como imagen.
 *
 * **Por qué existía como texto.** El `qr_data` de Bancard es una cadena EMVCo
 * y la pantalla la mostraba tal cual, con la excusa de que un lector la
 * parsea. Es cierto y es inútil: nadie escanea un párrafo de texto con la
 * cámara del banco (observación de Andres, 01-sep-2026).
 *
 * Se dibuja con el generador propio del proyecto (`src/documentos/qr.ts`), el
 * mismo que imprime el QR de verificación en los PDF: no hace falta una
 * librería nueva, y el módulo es puro —sin `node:*`— así que corre igual en el
 * navegador.
 *
 * Se dibuja en SVG y no en `<canvas>` porque el QR es un dibujo de rectángulos
 * exactos: en SVG escala sin perder nitidez y no depende de que el canvas haya
 * pintado antes de que alguien saque una captura de pantalla.
 */
import { generarMatrizQr, LARGO_MAXIMO_QR } from "@/documentos/qr";

/** Módulos en blanco alrededor del símbolo, como exige la norma. */
const MARGEN_MODULOS = 4;

export function QrBancard({ payload, lado = 200 }: { readonly payload: string; readonly lado?: number }) {
  if (payload.length > LARGO_MAXIMO_QR) {
    // No se dibuja un QR incompleto: sería un código que no lleva a ningún
    // lado y que la persona intentaría escanear igual.
    return (
      <p className="text-xs text-etiqueta">
        El código no se puede dibujar acá. Usá el importe y la referencia para pagar desde tu banco.
      </p>
    );
  }

  const { tamano, modulos } = generarMatrizQr(payload);
  const total = tamano + MARGEN_MODULOS * 2;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={lado}
      height={lado}
      role="img"
      aria-label="Código QR para pagar con tu app de banco"
      style={{ background: "#fff", flex: "none", borderRadius: "12px" }}
    >
      {modulos.map((fila, y) =>
        fila.map((oscuro, x) =>
          oscuro ? (
            <rect
              key={`${x}-${y}`}
              x={x + MARGEN_MODULOS}
              y={y + MARGEN_MODULOS}
              width={1}
              height={1}
              fill="#000"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
