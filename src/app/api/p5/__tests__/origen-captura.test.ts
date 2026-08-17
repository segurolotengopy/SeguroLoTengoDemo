/**
 * La guarda de origen de `/api/p5/captura`.
 *
 * `CAPTURA_SOLO_DESDE_CAMARA` es una regla del proceso, y la pantalla solo
 * dibuja u oculta un botón — eso es cosmético, porque cualquiera puede armar
 * la petición a mano. **Lo único que hace cumplir la regla es este handler**,
 * así que es lo que se prueba acá.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registrarCaptura = vi.fn();

vi.mock("@/app/api/p5/_dependencias", () => ({ dependenciasP5: () => ({}) }));

vi.mock("@/domain/verificacion-identidad", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/domain/verificacion-identidad")>();
  return { ...original, registrarCapturaP5: (...args: unknown[]) => registrarCaptura(...args) };
});

import { POST } from "@/app/api/p5/captura/route";

/** PNG mínimo en base64; alcanza para pasar la decodificación. */
const IMAGEN = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]).toString("base64")}`;

function peticion(cuerpo: unknown): Request {
  return new Request("https://segurolotengo.test/api/p5/captura", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "slt_sesion=sesion-de-prueba; slt_expediente=exp-de-prueba",
    },
    body: JSON.stringify(cuerpo),
  });
}

beforeEach(() => {
  registrarCaptura.mockReset().mockResolvedValue({
    ok: true,
    tipo: "FRENTE",
    aprobada: true,
    calidadAprobada: true,
    autenticidadAprobada: true,
    pruebaDeVidaAprobada: null,
    referencia: "DEMO-CEDULA-FRENTE-abc",
    hashSha256: "a".repeat(64),
    motivoRechazo: null,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fuera del modo demostración", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_MODE", "false");
  });

  it("rechaza un archivo aunque el cuerpo esté perfecto", async () => {
    // El caso que importa: un despliegue de producción no tiene forma de
    // aceptar un archivo por ninguna vía, ni con la petición armada a mano.
    const respuesta = await POST(peticion({ tipo: "FRENTE", imagen: IMAGEN, origen: "ARCHIVO" }));
    const cuerpo = (await respuesta.json()) as { motivo?: string };

    expect(respuesta.status).toBe(400);
    expect(cuerpo.motivo).toBe("ORIGEN_NO_ADMITIDO");
    expect(registrarCaptura).not.toHaveBeenCalled();
  });

  it("sigue aceptando la cámara", async () => {
    const respuesta = await POST(peticion({ tipo: "FRENTE", imagen: IMAGEN, origen: "CAMARA" }));

    expect(respuesta.status).toBe(200);
    expect(registrarCaptura).toHaveBeenCalled();
  });
});

describe("en modo demostración", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_MODE", "true");
  });

  it("acepta un archivo para el frente y lo marca como tal", async () => {
    const respuesta = await POST(peticion({ tipo: "FRENTE", imagen: IMAGEN, origen: "ARCHIVO" }));

    expect(respuesta.status).toBe(200);
    // El origen viaja al dominio, que lo escribe en la evidencia: un documento
    // subido no puede quedar registrado como fotografiado en vivo.
    expect(registrarCaptura).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tipo: "FRENTE", origen: "ARCHIVO" }),
    );
  });

  it("acepta un archivo para el dorso", async () => {
    const respuesta = await POST(peticion({ tipo: "DORSO", imagen: IMAGEN, origen: "ARCHIVO" }));
    expect(respuesta.status).toBe(200);
  });

  it("NO acepta un archivo para la selfie", async () => {
    // La selfie es el ancla biométrica: un archivo acá permitiría verificar la
    // identidad con la fotografía de otra persona. No hay modo que lo habilite.
    // Cuerpo bien formado para una selfie (`selfie`, no `imagen`), para que
    // el rechazo sea por origen y no por decodificación.
    const respuesta = await POST(peticion({ tipo: "SELFIE", selfie: IMAGEN, origen: "ARCHIVO" }));
    const cuerpo = (await respuesta.json()) as { motivo?: string };

    expect(respuesta.status).toBe(400);
    expect(cuerpo.motivo).toBe("ORIGEN_NO_ADMITIDO");
    expect(registrarCaptura).not.toHaveBeenCalled();
  });
});

describe("valor por omisión", () => {
  it("un cuerpo sin `origen` se trata como cámara, no como archivo", async () => {
    // Un campo ausente no puede convertirse en una subida silenciosa: el
    // default tiene que ser el lado restrictivo.
    vi.stubEnv("DEMO_MODE", "false");

    const respuesta = await POST(peticion({ tipo: "FRENTE", imagen: IMAGEN }));

    expect(respuesta.status).toBe(200);
    expect(registrarCaptura).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ origen: "CAMARA" }),
    );
  });

  it("un `origen` desconocido tampoco habilita el archivo", async () => {
    vi.stubEnv("DEMO_MODE", "false");

    const respuesta = await POST(peticion({ tipo: "FRENTE", imagen: IMAGEN, origen: "CUALQUIERA" }));

    expect(respuesta.status).toBe(200);
    expect(registrarCaptura).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ origen: "CAMARA" }),
    );
  });
});
