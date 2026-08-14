/**
 * Decodificación de las capturas de P5 que llegan en el cuerpo JSON.
 *
 * La pantalla manda cada imagen en base64 (con o sin el prefijo `data:`), que
 * es lo que produce el `canvas` de la captura simulada. Acá se convierte en
 * los bytes que espera el puerto (`MediaCapturada`), con un tope de tamaño
 * para que un cuerpo enorme no llegue nunca al proveedor.
 *
 * Los bytes no se guardan en este archivo ni se loguean: van directo al
 * `IdentityProvider`, que devuelve el hash y la referencia de evidencia.
 *
 * Archivo con guion bajo: App Router no lo enruta.
 */
import type { CapturaSelfie } from "@/ports/identity-provider";

/** 8 MB por captura: de sobra para una foto de celular, lejos de un abuso. */
export const TAMANIO_MAXIMO_IMAGEN_BYTES = 8 * 1024 * 1024;

export type ResultadoDecodificacion =
  | { readonly ok: true; readonly imagen: Uint8Array }
  | { readonly ok: false; readonly motivo: "IMAGEN_INVALIDA" | "IMAGEN_DEMASIADO_GRANDE" };

const PREFIJO_DATA_URL = /^data:[^;,]*;base64,/;

export function decodificarImagen(valor: unknown): ResultadoDecodificacion {
  if (typeof valor !== "string" || valor.length === 0) {
    return { ok: false, motivo: "IMAGEN_INVALIDA" };
  }

  const base64 = valor.replace(PREFIJO_DATA_URL, "");
  // 4 caracteres de base64 son 3 bytes: se descarta por tamaño antes de
  // reservar memoria para el buffer.
  if ((base64.length * 3) / 4 > TAMANIO_MAXIMO_IMAGEN_BYTES) {
    return { ok: false, motivo: "IMAGEN_DEMASIADO_GRANDE" };
  }

  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) return { ok: false, motivo: "IMAGEN_INVALIDA" };

  return { ok: true, imagen: new Uint8Array(bytes) };
}

/**
 * Decodificación del campo de la selfie, que a diferencia del frente y el
 * dorso puede llegar de dos formas (ver `CapturaSelfie` en el puerto):
 *
 * - `selfie` con base64 → prueba de vida por bytes (el mock del demo).
 * - `selfieSesion` con la referencia de una sesión de prueba de vida en vivo →
 *   el video nunca pasó por acá: fue del navegador directo al proveedor.
 *
 * La referencia de sesión **no es una imagen y no se decodifica**: es un
 * identificador opaco que el adaptador le devuelve al proveedor. Se valida
 * forma y longitud para no reenviar basura, nada más.
 */
export type MotivoSelfieInvalida = "IMAGEN_INVALIDA" | "IMAGEN_DEMASIADO_GRANDE";

export type ResultadoSelfieRecibida =
  | { readonly ok: true; readonly captura: CapturaSelfie }
  | { readonly ok: false; readonly motivo: MotivoSelfieInvalida };

/** Tope generoso para un identificador opaco; corta cualquier cosa que no lo sea. */
const LARGO_MAXIMO_REFERENCIA_SESION = 256;

export function decodificarSelfie(cuerpo: Record<string, unknown>): ResultadoSelfieRecibida {
  const referencia = cuerpo.selfieSesion;
  if (typeof referencia === "string" && referencia.trim() !== "") {
    if (referencia.length > LARGO_MAXIMO_REFERENCIA_SESION) {
      return { ok: false, motivo: "IMAGEN_DEMASIADO_GRANDE" };
    }
    return {
      ok: true,
      captura: { tipo: "SESION_LIVENESS", referenciaSesion: referencia.trim() },
    };
  }

  const bytes = decodificarImagen(cuerpo.selfie);
  if (!bytes.ok) return { ok: false, motivo: bytes.motivo };
  return { ok: true, captura: { tipo: "VIDEO", video: bytes.imagen } };
}
