/**
 * `POST /api/demo-panel/firma` — simula lo que hace la persona del otro lado
 * del enlace de Code100.
 *
 * En una demostración no llega ningún WhatsApp ni ningún correo, así que este
 * endpoint hace de pantalla de Code100: abrir el enlace (que es cuando el
 * proveedor emite el OTP de firma), tipear el código y firmar, o rechazar.
 *
 * Tres cosas que este endpoint **no** es:
 *
 * 1. **No es parte del flujo.** Nada de P0–P9 lo llama, y el flujo no puede:
 *    el código del OTP de firma solo se lee desde el panel (regla inviolable
 *    #2), y el panel exige `DEMO_MODE=true` más su propia cookie.
 * 2. **No firma por su cuenta.** Verifica el código contra el HMAC guardado en
 *    la sesión simulada, con las mismas reglas que los otros dos OTP: 6
 *    dígitos, uso único, 5 minutos, 3 intentos.
 * 3. **No puede dejar una firma a medias.** El sellado de los dos documentos
 *    es una sola escritura. `fallarAMitad` fuerza el corte entre las dos
 *    huellas justamente para demostrar que, cuando eso pasa, no queda ninguna
 *    firmada (regla inviolable #3).
 */
import { leerCookies, leerJson, respuestaJson } from "@/app/api/_http/contexto-peticion";
import { COOKIE_PANEL, esModoDemo, sesionValida } from "@/app/demo-panel/_sesion";
import {
  abrirEnlaceDeFirmaMock,
  cerrarSinFirmarMock,
  firmarEnCode100Mock,
} from "@/adapters/mock/signature-provider";

export const dynamic = "force-dynamic";

const ACCIONES = ["ABRIR", "FIRMAR", "RECHAZAR"] as const;
type Accion = (typeof ACCIONES)[number];

function esAccion(valor: unknown): valor is Accion {
  return ACCIONES.some((accion) => accion === valor);
}

export async function POST(request: Request): Promise<Response> {
  if (!esModoDemo()) {
    return respuestaJson({ ok: false, motivo: "NO_DISPONIBLE" }, { status: 404 });
  }

  const autorizado = await sesionValida(leerCookies(request)[COOKIE_PANEL]);
  if (!autorizado) {
    return respuestaJson({ ok: false, motivo: "SESION_INVALIDA" }, { status: 401 });
  }

  const cuerpo = await leerJson(request);
  const idCode100 = typeof cuerpo?.idCode100 === "string" ? cuerpo.idCode100 : "";
  if (!idCode100 || !esAccion(cuerpo?.accion)) {
    return respuestaJson({ ok: false, motivo: "PEDIDO_INVALIDO" }, { status: 400 });
  }

  if (cuerpo.accion === "ABRIR") {
    const resultado = abrirEnlaceDeFirmaMock(idCode100);
    return resultado.ok
      ? respuestaJson({ ok: true, expiraEn: resultado.expiraEn })
      : respuestaJson({ ok: false, motivo: resultado.motivo }, { status: 409 });
  }

  if (cuerpo.accion === "RECHAZAR") {
    const cerrada = cerrarSinFirmarMock(idCode100, "RECHAZADA", "Rechazada desde el panel de demo.");
    return cerrada
      ? respuestaJson({ ok: true })
      : respuestaJson({ ok: false, motivo: "YA_CERRADA" }, { status: 409 });
  }

  const codigo = typeof cuerpo.codigo === "string" ? cuerpo.codigo.trim() : "";
  if (codigo === "") {
    return respuestaJson({ ok: false, motivo: "CODIGO_REQUERIDO" }, { status: 400 });
  }

  const resultado = firmarEnCode100Mock(idCode100, codigo, {
    fallarAMitadDelSellado: cuerpo.fallarAMitad === true,
  });

  if (!resultado.ok) {
    return respuestaJson(
      {
        ok: false,
        motivo: resultado.motivo,
        ...(resultado.intentosRestantes !== undefined
          ? { intentosRestantes: resultado.intentosRestantes }
          : {}),
      },
      { status: 409 },
    );
  }

  // Se devuelven las dos huellas juntas o ninguna: es lo mismo que garantiza el
  // tipo `Firma`. Acá no vuelve el código del OTP.
  return respuestaJson({
    ok: true,
    firmadoEn: resultado.firma.firmadoEn,
    hashSolicitudFirmada: resultado.firma.hashSolicitudFirmada,
    hashFipfFirmado: resultado.firma.hashFipfFirmado,
  });
}
