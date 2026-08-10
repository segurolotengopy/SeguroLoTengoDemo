/**
 * Saneo previo de la corrida: deja las cédulas de las personas de prueba sin
 * bloqueo de registro (regla inviolable #11).
 *
 * Por qué hace falta: la tabla `slt-demo-expedientes` es real y compartida, y
 * los escenarios 2 (PEP), 3 (salud) y 6 (vencimiento) terminan **por diseño**
 * en estados bloqueantes (`DERIVADO_MANUAL`, `VENCIDO`/`DEVOLUCION_EN_TRAMITE`).
 * Sin este saneo, la segunda corrida de la batería fallaría en P5 con
 * `CEDULA_BLOQUEADA` — no por un bug, sino porque la regla #11 hace exactamente
 * lo que debe.
 *
 * Cómo lo hace: por el único camino legítimo — el reinicio de la consola
 * administrativa (`POST /api/admin-consola/reinicio`), que crea un expediente
 * sucesor enlazado por `expedienteAnteriorId`. Nunca toca la base directamente
 * ni "revive" el expediente viejo, que sigue terminal.
 */
import { PERSONAS_DEMO } from "@/adapters/mock/personas";
import { obtenerClaveConsola } from "./secreto-panel";

const BASE_URL = "http://127.0.0.1:3100";

interface FilaBusqueda {
  readonly id: string;
  readonly estado: string;
  readonly bloqueaRegistro: boolean;
}

function esFilaBusqueda(valor: unknown): valor is FilaBusqueda {
  if (typeof valor !== "object" || valor === null) return false;
  const registro = valor as Record<string, unknown>;
  return typeof registro.id === "string" && typeof registro.bloqueaRegistro === "boolean";
}

export async function liberarCedulasDePrueba(): Promise<void> {
  const clave = await obtenerClaveConsola();

  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request -- webServer local de Playwright en loopback (127.0.0.1); la clave nunca sale de la máquina.
  const sesion = await fetch(`${BASE_URL}/api/admin-consola/sesion`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clave }),
  });
  if (!sesion.ok) {
    throw new Error(
      `No se pudo abrir sesión en la consola administrativa (HTTP ${sesion.status}). ` +
        "¿El webServer corre con ADMIN_CONSOLE_ENABLED=true?",
    );
  }
  const cookie = sesion.headers.get("set-cookie")?.split(";")[0] ?? "";

  for (const persona of PERSONAS_DEMO) {
    const cedula = persona.identidad.numeroCedula;
    const busqueda = await fetch(
      `${BASE_URL}/api/admin-consola/buscar?criterio=cedula&valor=${cedula}`,
      { headers: { cookie } },
    );
    if (!busqueda.ok) {
      throw new Error(`La búsqueda por cédula ${cedula} falló (HTTP ${busqueda.status}).`);
    }
    const datos = (await busqueda.json()) as { resultados?: unknown };
    const filas = Array.isArray(datos.resultados) ? datos.resultados.filter(esFilaBusqueda) : [];

    for (const fila of filas.filter((candidata) => candidata.bloqueaRegistro)) {
      // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request -- webServer local de Playwright en loopback (127.0.0.1).
      const reinicio = await fetch(`${BASE_URL}/api/admin-consola/reinicio`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          expedienteId: fila.id,
          justificativo: "OTRO",
          detalleLibre:
            "Saneo automático previo a la corrida E2E: el escenario anterior dejó esta cédula " +
            "de prueba en estado bloqueante, como corresponde por la regla #11.",
        }),
      });
      // `YA_REINICIADO` (409) puede pasar si dos corridas compitieron por el
      // mismo expediente; el bloqueo ya está levantado y no es un error.
      if (!reinicio.ok && reinicio.status !== 409) {
        throw new Error(
          `El reinicio del expediente ${fila.id} (cédula ${cedula}) falló (HTTP ${reinicio.status}).`,
        );
      }
    }
  }
}
