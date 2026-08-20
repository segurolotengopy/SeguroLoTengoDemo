/**
 * Tests del despachador de entregas (CHG-44, CMP-05, D-18).
 *
 * Lo que se cuida acá, en orden de importancia:
 *
 * - **`ENVIADO` no es `ACUSADO`.** El proveedor acepta un mensaje mucho antes
 *   de que llegue y a veces no llega nunca; colapsar los dos dejaría el acuse
 *   de CMP-05 cumplido de mentira.
 * - **Una falla de entrega no toca el expediente.** Los documentos siguen
 *   descargables y el contrato sigue en pie: la entrega es una consecuencia de
 *   la emisión, no una condición suya.
 * - **No se entrega un archivo que no sea el emitido.** Sin adjuntos
 *   verificados no sale nada.
 * - **La evidencia no lleva el destino completo** ni el mensaje, que tiene el
 *   nombre de la persona (regla inviolable #7).
 */
import { describe, expect, it } from "vitest";
import {
  ESPERAS_REINTENTO_MS,
  MAX_INTENTOS,
  PASO_EVIDENCIA_ENTREGA,
  despacharEntregas,
  mensajeDeEntrega,
  programarEntregas,
} from "../entrega-documentos";
import type {
  DependenciasEntrega,
  EntregaDeDocumentos,
  RepositorioEntregas,
} from "../entrega-documentos";
import type { EvidenceStore } from "../../ports/evidence-store";
import type {
  ConsultaEntrega,
  MessagingProvider,
  ResultadoEntrega,
  SolicitudEntrega,
} from "../../ports/messaging-provider";
import type { Expediente, RegistroEvidencia } from "../tipos";
import type { ContextoPeticion } from "../verificacion-canal";
import { certificadoFixture, expedienteEnPagoConfirmado, expedienteFirmado } from "./fixtures";
import { registrarEmisionP9 } from "../expediente";

const AHORA = "2026-08-09T15:20:00.000Z";

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-entrega",
};

// ---------------------------------------------------------------------------
// Dobles
// ---------------------------------------------------------------------------

function expedienteEmitido(): Expediente {
  const cobrado = expedienteEnPagoConfirmado("EXP-ENTREGA");
  const emitido = registrarEmisionP9(
    cobrado,
    {
      numeroPoliza: cobrado.numeroPropuesta ?? "",
      estado: "EN_PROCESO_DE_EMISION",
      emitidaEn: null,
      estadoFactura: "PENDIENTE",
      referenciaFactura: null,
      solicitadaEn: AHORA,
    },
    AHORA,
  );
  if (!emitido.ok) throw new Error(emitido.error);
  return emitido.expediente;
}

function repositorioEntregas(): RepositorioEntregas & { todas: () => EntregaDeDocumentos[] } {
  const porClave = new Map<string, EntregaDeDocumentos>();
  return {
    async obtenerPorExpediente(expedienteId) {
      return [...porClave.values()].filter((entrega) => entrega.expedienteId === expedienteId);
    },
    async guardar(entrega) {
      porClave.set(`${entrega.expedienteId}:${entrega.canal}`, entrega);
    },
    todas: () => [...porClave.values()],
  };
}

function evidencias(): EvidenceStore & { registros: RegistroEvidencia[] } {
  const registros: RegistroEvidencia[] = [];
  return {
    registros,
    async guardar(registro) {
      registros.push(registro);
    },
    async obtenerHistorial() {
      return registros;
    },
  };
}

interface MensajeriaFalsa extends MessagingProvider {
  readonly enviados: SolicitudEntrega[];
}

function mensajeria(opciones: {
  readonly alEnviar?: (intento: number) => ResultadoEntrega;
  readonly alConsultar?: () => ConsultaEntrega | null;
} = {}): MensajeriaFalsa {
  const enviados: SolicitudEntrega[] = [];
  let intento = 0;
  return {
    enviados,
    async entregarDocumentos(solicitud) {
      enviados.push(solicitud);
      intento += 1;
      return (
        opciones.alEnviar?.(intento) ?? { ok: true, referenciaEnvio: `REF-${intento}` }
      );
    },
    async consultarEntrega() {
      return opciones.alConsultar?.() ?? { estado: "EN_TRANSITO", actualizadoEn: AHORA };
    },
  };
}

function armar(
  opciones: {
    readonly mensajeria?: MensajeriaFalsa;
    readonly adjuntosOk?: boolean;
    readonly ahora?: () => string;
  } = {},
) {
  const repo = repositorioEntregas();
  const evid = evidencias();
  let contador = 0;
  const deps: DependenciasEntrega = {
    mensajeria: opciones.mensajeria ?? mensajeria(),
    entregas: repo,
    evidencias: evid,
    adjuntos: async () =>
      opciones.adjuntosOk === false
        ? { ok: false, detalle: "Todavía no está archivado el paquete." }
        : {
            ok: true,
            adjuntos: [
              {
                codigo: certificadoFixture.codigo,
                nombreArchivo: `${certificadoFixture.codigo}.pdf`,
                contentType: "application/pdf",
                bytes: new Uint8Array([37, 80, 68, 70]),
                hashSha256: certificadoFixture.hashSha256,
              },
            ],
          },
    ahora: opciones.ahora ?? (() => AHORA),
    nuevoId: () => `ev-${(contador += 1)}`,
  };
  return { deps, repo, evidencias: evid };
}

// ---------------------------------------------------------------------------
// Programación
// ---------------------------------------------------------------------------

describe("programación de las entregas", () => {
  it("crea una por canal verificado, con el primer intento inmediato", () => {
    const resultado = programarEntregas(expedienteEmitido(), AHORA);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.entregas.map((entrega) => entrega.canal).sort()).toEqual([
      "EMAIL",
      "WHATSAPP",
    ]);
    for (const entrega of resultado.entregas) {
      expect(entrega.estado).toBe("PENDIENTE");
      expect(entrega.intentos).toBe(0);
      // La persona está mirando la pantalla: el primer intento no espera.
      expect(entrega.proximoIntentoEn).toBe(AHORA);
    }
  });

  /** El destino completo no sale nunca del expediente (regla inviolable #7). */
  it("guarda el destino enmascarado, no el real", () => {
    const expediente = expedienteEmitido();
    const resultado = programarEntregas(expediente, AHORA);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const serializado = JSON.stringify(resultado.entregas);
    expect(serializado).not.toContain(expediente.canalWhatsapp?.valor ?? "@@");
    expect(serializado).not.toContain(expediente.canalEmail?.valor ?? "@@");
    expect(serializado).toContain("•");
  });

  /**
   * Se entregan el certificado y el paquete firmado. El comprobante no: se
   * genera al pedirlo y la persona ya lo tiene en la pantalla. La póliza y la
   * factura las manda Alianza.
   */
  it("entrega el certificado y el paquete firmado, y nada más", () => {
    const resultado = programarEntregas(expedienteEmitido(), AHORA);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const documentos = resultado.entregas[0]?.documentos ?? [];
    expect(documentos).toHaveLength(2);
    expect(documentos[0]).toMatch(/^CPC-/);
    expect(documentos[1]).toMatch(/^PROP-/);
    expect(documentos.some((codigo) => codigo.startsWith("REC-"))).toBe(false);
  });

  it("no programa nada sobre un expediente que todavía no se emitió", () => {
    const resultado = programarEntregas(expedienteFirmado(), AHORA);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("EXPEDIENTE_SIN_EMITIR");
  });
});

// ---------------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------------

describe("despacho", () => {
  it("el primer despacho envía por los dos canales y los deja ENVIADO", async () => {
    const correo = mensajeria();
    const { deps, repo } = armar({ mensajeria: correo });

    const resultado = await despacharEntregas(deps, {
      expediente: expedienteEmitido(),
      contexto: CONTEXTO,
    });

    expect(resultado.entregas).toHaveLength(2);
    for (const entrega of resultado.entregas) {
      expect(entrega.estado).toBe("ENVIADO");
      expect(entrega.referenciaEnvio).not.toBeNull();
      expect(entrega.intentos).toBe(1);
    }
    expect(correo.enviados).toHaveLength(2);
    expect(repo.todas()).toHaveLength(2);
  });

  /**
   * La distinción que sostiene a CMP-05. Aceptado no es entregado, y mientras
   * el proveedor no confirme, la entrega se queda en `ENVIADO`.
   */
  it("mientras el proveedor no confirme, la entrega no queda acusada", async () => {
    const { deps } = armar();
    const expediente = expedienteEmitido();

    await despacharEntregas(deps, { expediente, contexto: CONTEXTO });
    const segunda = await despacharEntregas(deps, { expediente, contexto: CONTEXTO });

    for (const entrega of segunda.entregas) {
      expect(entrega.estado).toBe("ENVIADO");
      expect(entrega.acusadaEn).toBeNull();
    }
  });

  it("con el acuse del proveedor pasa a ACUSADO, con su instante", async () => {
    const acuse: ConsultaEntrega = { estado: "ENTREGADO", actualizadoEn: "2026-08-09T15:25:00.000Z" };
    const { deps, evidencias: evid } = armar({
      mensajeria: mensajeria({ alConsultar: () => acuse }),
    });
    const expediente = expedienteEmitido();

    await despacharEntregas(deps, { expediente, contexto: CONTEXTO });
    const segunda = await despacharEntregas(deps, { expediente, contexto: CONTEXTO });

    for (const entrega of segunda.entregas) {
      expect(entrega.estado).toBe("ACUSADO");
      expect(entrega.acusadaEn).toBe(acuse.actualizadoEn);
    }
    // CMP-05 · el acuse deja su propia evidencia.
    expect(
      evid.registros.filter((registro) => registro.detalle?.includes("ACUSE_RECIBIDO")),
    ).toHaveLength(2);
  });

  it("una entrega ya acusada no se vuelve a tocar", async () => {
    const proveedor = mensajeria({ alConsultar: () => ({ estado: "ENTREGADO", actualizadoEn: AHORA }) });
    const { deps } = armar({ mensajeria: proveedor });
    const expediente = expedienteEmitido();

    await despacharEntregas(deps, { expediente, contexto: CONTEXTO });
    await despacharEntregas(deps, { expediente, contexto: CONTEXTO });
    const enviadosTrasAcuse = proveedor.enviados.length;
    const tercera = await despacharEntregas(deps, { expediente, contexto: CONTEXTO });

    expect(tercera.avanzadas).toBe(0);
    expect(proveedor.enviados).toHaveLength(enviadosTrasAcuse);
  });
});

// ---------------------------------------------------------------------------
// Reintentos
// ---------------------------------------------------------------------------

describe("reintentos", () => {
  it("una falla transitoria programa otro intento con espera creciente", async () => {
    const { deps } = armar({
      mensajeria: mensajeria({
        alEnviar: () => ({ ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE" }),
      }),
    });

    const resultado = await despacharEntregas(deps, {
      expediente: expedienteEmitido(),
      contexto: CONTEXTO,
    });

    for (const entrega of resultado.entregas) {
      expect(entrega.estado).toBe("PENDIENTE");
      expect(entrega.intentos).toBe(1);
      expect(entrega.proximoIntentoEn).toBe(
        new Date(new Date(AHORA).getTime() + ESPERAS_REINTENTO_MS[0]).toISOString(),
      );
    }
  });

  it("no reintenta antes de que venza la espera", async () => {
    const proveedor = mensajeria({
      alEnviar: () => ({ ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE" }),
    });
    const { deps } = armar({ mensajeria: proveedor });
    const expediente = expedienteEmitido();

    await despacharEntregas(deps, { expediente, contexto: CONTEXTO });
    const enviadosTrasPrimera = proveedor.enviados.length;
    await despacharEntregas(deps, { expediente, contexto: CONTEXTO });

    expect(proveedor.enviados).toHaveLength(enviadosTrasPrimera);
  });

  /**
   * `DESTINO_INVALIDO` no se arregla reintentando: el destino es el que la
   * persona verificó y no va a cambiar solo. Gastar cinco intentos en él sería
   * demorar una hora el aviso de que hay que hacer algo.
   */
  it("un destino inválido falla de una y no consume reintentos", async () => {
    const { deps } = armar({
      mensajeria: mensajeria({ alEnviar: () => ({ ok: false, motivo: "DESTINO_INVALIDO" }) }),
    });

    const resultado = await despacharEntregas(deps, {
      expediente: expedienteEmitido(),
      contexto: CONTEXTO,
    });

    for (const entrega of resultado.entregas) {
      expect(entrega.estado).toBe("FALLIDO");
      expect(entrega.intentos).toBe(1);
    }
  });

  it("agotados los intentos, la entrega queda FALLIDA", async () => {
    let reloj = new Date(AHORA).getTime();
    const { deps } = armar({
      mensajeria: mensajeria({ alEnviar: () => ({ ok: false, motivo: "PROVEEDOR_NO_DISPONIBLE" }) }),
      ahora: () => new Date(reloj).toISOString(),
    });
    const expediente = expedienteEmitido();

    // Una pasada por intento, adelantando el reloj más allá de cada espera.
    for (let i = 0; i < MAX_INTENTOS; i += 1) {
      await despacharEntregas(deps, { expediente, contexto: CONTEXTO });
      reloj += 24 * 60 * 60 * 1000;
    }

    const final = await despacharEntregas(deps, { expediente, contexto: CONTEXTO });
    for (const entrega of final.entregas) {
      expect(entrega.estado).toBe("FALLIDO");
      expect(entrega.intentos).toBe(MAX_INTENTOS);
    }
  });

  /**
   * El caso que hace que `ENVIADO` y `ACUSADO` tengan que ser dos estados: el
   * proveedor acepta y después reporta que no entregó. Vuelve a la cola.
   */
  it("un envío aceptado que el proveedor después reporta fallido vuelve a la cola", async () => {
    const { deps } = armar({
      mensajeria: mensajeria({
        alConsultar: () => ({ estado: "FALLIDO", actualizadoEn: AHORA, detalle: "no llegó" }),
      }),
    });
    const expediente = expedienteEmitido();

    await despacharEntregas(deps, { expediente, contexto: CONTEXTO });
    const segunda = await despacharEntregas(deps, { expediente, contexto: CONTEXTO });

    for (const entrega of segunda.entregas) {
      expect(entrega.estado).toBe("PENDIENTE");
      expect(entrega.referenciaEnvio).toBeNull();
      expect(entrega.ultimoError).toBe("no llegó");
    }
  });

  /**
   * Sin adjuntos verificados no sale nada: entregar un PDF que no sea el
   * emitido rompería el vínculo de la fila 47.
   */
  it("sin documentos verificados no llama al proveedor", async () => {
    const proveedor = mensajeria();
    const { deps } = armar({ mensajeria: proveedor, adjuntosOk: false });

    const resultado = await despacharEntregas(deps, {
      expediente: expedienteEmitido(),
      contexto: CONTEXTO,
    });

    expect(proveedor.enviados).toHaveLength(0);
    for (const entrega of resultado.entregas) expect(entrega.estado).toBe("PENDIENTE");
  });
});

// ---------------------------------------------------------------------------
// Evidencia y mensaje
// ---------------------------------------------------------------------------

describe("evidencia de la entrega (CMP-05)", () => {
  it("registra canal, destino enmascarado, documentos e intento, y nada más", async () => {
    const { deps, evidencias: evid } = armar();
    const expediente = expedienteEmitido();

    await despacharEntregas(deps, { expediente, contexto: CONTEXTO });

    const registros = evid.registros.filter((registro) => registro.paso === PASO_EVIDENCIA_ENTREGA);
    expect(registros).toHaveLength(2);

    const texto = registros.map((registro) => registro.detalle ?? "").join(" ");
    expect(texto).toContain("canal=WHATSAPP");
    expect(texto).toContain("canal=EMAIL");
    expect(texto).toContain(certificadoFixture.codigo);

    // Ni el destino real, ni el mensaje —que lleva el nombre de la persona—,
    // ni la cédula (regla inviolable #7).
    for (const dato of [
      expediente.canalWhatsapp?.valor,
      expediente.canalEmail?.valor,
      expediente.identidad?.numeroCedula,
      expediente.identidad?.nombres,
    ]) {
      if (dato) expect(texto).not.toContain(dato);
    }
  });
});

describe("mensaje que acompaña los documentos (D-18)", () => {
  it("es la redacción adoptada, con la fecha de inicio de cobertura", () => {
    const mensaje = mensajeDeEntrega({
      nombre: "Mónica",
      plan: "CONFÍO+",
      inicioCobertura: "2026-08-10T15:01:00.000Z",
    });

    expect(mensaje).toContain("¡Hola, Mónica!");
    expect(mensaje).toContain("Tu seguro CONFÍO+ ya está en marcha.");
    expect(mensaje).toContain("Certificado de Cobertura Provisional");
    expect(mensaje).toContain("comienza el 10/08/2026 a las 15:01");
    expect(mensaje).toContain("24 horas después de tu pago");
    // Las 48 horas son las de la póliza, no las de la cobertura: son plazos
    // distintos y el mensaje dice los dos.
    expect(mensaje).toContain("próximas 48 horas");
    expect(mensaje).toContain("— Interseguros S.A., Corredores de Seguros");
  });
});
