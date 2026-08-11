/**
 * `POST /api/demo-panel/reiniciar` — botón `Reiniciar expediente` del panel de
 * demo (CLAUDE.md → "Panel de demo": *"reiniciar el expediente"*).
 *
 * **Qué hace y qué NO hace.** Esto olvida el expediente *de esta sesión del
 * navegador*: borra las cookies `slt_expediente` y `slt_otp` para que el
 * siguiente paso por P1 arranque uno nuevo desde `INICIADO`.
 *
 * **No toca el expediente anterior.** No lo borra, no lo transiciona y no le
 * agrega evidencia: sigue en la base exactamente como quedó. Es deliberado y
 * no negociable —regla inviolable #5 (`DERIVADO_MANUAL` es terminal) y #10
 * (evidencia append-only)—: si esto pudiera "revivir" un expediente derivado,
 * el panel de demo sería una puerta trasera a la regla que el resto del
 * sistema hace imposible de violar.
 *
 * Reiniciar **con consecuencia de negocio** —crear un expediente nuevo
 * enlazado al anterior, con justificativo, para levantar el bloqueo por
 * cédula— es otra cosa y vive en la consola administrativa
 * (`POST /api/admin-consola/reinicio`, `docs/CONSOLA_ADMINISTRATIVA.md` §5).
 * El panel de demo no puede hacerlo.
 *
 * Doble candado, igual que el resto del panel: `DEMO_MODE=true` y cookie de
 * sesión firmada con `DEMO_PANEL_KEY`.
 */
import { cookies } from "next/headers";
import { limpiarRegistroDemo } from "@/adapters/mock/otp-provider";
import { limpiarSesionesIdentidadMock } from "@/adapters/mock/identity-provider";
import { reiniciarSeleccionDemo } from "@/adapters/mock/persona-activa";
import {
  COOKIE_EXPEDIENTE,
  COOKIE_OTP,
  respuestaJson,
} from "@/app/api/_http/contexto-peticion";
import { COOKIE_PANEL, esModoDemo, sesionValida } from "@/app/demo-panel/_sesion";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  if (!esModoDemo()) {
    return respuestaJson({ ok: false, motivo: "NO_DISPONIBLE" }, { status: 404 });
  }

  const almacen = await cookies();
  if (!(await sesionValida(almacen.get(COOKIE_PANEL)?.value))) {
    return respuestaJson({ ok: false, motivo: "NO_AUTORIZADO" }, { status: 401 });
  }

  const expedienteOlvidado = almacen.get(COOKIE_EXPEDIENTE)?.value ?? null;

  // Estado en memoria del proceso (no es evidencia ni dato del expediente):
  // códigos OTP retenidos para el panel, sesiones del mock de identidad y la
  // persona de prueba activa vuelven al punto de partida.
  limpiarRegistroDemo();
  limpiarSesionesIdentidadMock();
  reiniciarSeleccionDemo();

  return respuestaJson(
    { ok: true, expedienteOlvidado },
    {
      // `maxAge: 0` borra la cookie; la sesión del panel se conserva para no
      // tener que volver a tipear la clave.
      cookies: [
        { nombre: COOKIE_EXPEDIENTE, valor: "", maxAge: 0 },
        { nombre: COOKIE_OTP, valor: "", maxAge: 0 },
      ],
    },
  );
}
