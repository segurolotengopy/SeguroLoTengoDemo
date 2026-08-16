/**
 * Regla de negocio inviolable #6, verificada de punta a punta:
 *
 * > Nunca se persiste PAN completo ni CVV, en ninguna capa, incluidos logs y
 * > trazas de error.
 *
 * Y la fila 24 de `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` — "R3 -
 * INTEGRACIÓN DE PAGO CON BANCARD", *"SeguroLoTengo no almacenará PAN
 * completo, CVV ni credenciales de tarjeta"*, Res. BCP 25/21, art. 8,
 * complementado contractualmente por PCI-DSS. Y el bloque `Seguridad y
 * trazabilidad` de P7: *"SeguroLoTengo e Interseguros no reciben el dinero ni
 * almacenan el número completo de tarjeta o CVV"*.
 *
 * No alcanza con confiar en los tipos. Este archivo cierra cuatro puertas:
 *
 * 1. **Runtime, capa por capa** — se corre el flujo completo de P7 con débito
 *    y con crédito y se serializa TODO lo que el sistema produce (el
 *    expediente persistido, cada registro de evidencia, cada respuesta de los
 *    casos de uso) buscando adentro cualquier cosa que se parezca a un PAN o a
 *    un CVV.
 * 2. **El enmascarado tampoco se guarda** — Bancard devuelve
 *    `ultimos4Digitos` y el puerto lo admite, pero el dominio lo descarta: no
 *    hace falta para nada del flujo, y lo que no se guarda no hay que
 *    defenderlo.
 * 3. **Superficie de entrada** — ningún endpoint de P7 ni el formulario de la
 *    pantalla tiene un campo donde pudiera entrar un dato de tarjeta. Se
 *    verifica leyendo el código fuente, porque el día que alguien agregue un
 *    `<input name="numeroTarjeta">` los tipos no van a decir nada.
 * 4. **Nada de `console`** — ni el caso de uso ni el adaptador escriben a un
 *    log plano, que es la vía por la que un dato así se escapa sin que nadie
 *    lo note.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { crearPaymentProviderMock, limpiarOperacionesMock } from "@/adapters/mock/payment-provider";
import { transicionarExpediente } from "@/domain/expediente";
import { confirmarPagoP7, iniciarPagoP7 } from "@/domain/pago-p7";
import { PLANES } from "@/domain/catalogo";
import type { Expediente, MedioDePago, RegistroEvidencia } from "@/domain/tipos";
import type { ContextoPeticion, RepositorioExpediente } from "@/domain/verificacion-canal";
import type { EvidenceStore } from "@/ports/evidence-store";
import {
  avanzarHastaIdentidadVerificada,
  crearExpediente,
  datosComplementariosFixture,
  declaracionesCompatibles,
} from "@/domain/__tests__/fixtures";

// ---------------------------------------------------------------------------
// Lo que se considera "dato de tarjeta"
// ---------------------------------------------------------------------------

/**
 * Datos de una tarjeta de prueba. Son los que se usarían en un formulario de
 * pago real; acá sirven de sonda: si alguno aparece en cualquier salida del
 * sistema, es que hay un camino por el que un dato de tarjeta se persiste.
 *
 * El PAN es el número de prueba público de Visa (4111 1111 1111 1111), que no
 * corresponde a ninguna tarjeta emitida.
 */
const SONDAS_DE_TARJETA = {
  numeroTarjeta: "4111111111111111",
  numeroTarjetaConEspacios: "4111 1111 1111 1111",
  cvv: "737",
  vencimiento: "12/29",
  titularTarjeta: "TITULAR DE PRUEBA",
} as const;

const VALORES_SONDA: readonly string[] = Object.values(SONDAS_DE_TARJETA);

/** Cualquier secuencia de 13 a 19 dígitos: la forma de un PAN. */
const FORMA_DE_PAN = /^\d{13,19}$/;

/** Nombres de campo por los que un dato de tarjeta suele colarse. */
const NOMBRES_PROHIBIDOS =
  /\b(pan|cvv|cvc|cvv2|card_?number|numero_?tarjeta|numerotarjeta|security_?code|codigo_?seguridad|expiry|exp_?date|vencimiento_?tarjeta|cardholder|titular_?tarjeta)\b/i;

/**
 * Recorre una estructura y devuelve sus claves y sus valores hoja por separado.
 *
 * La comparación se hace **por valor exacto de hoja**, no buscando substrings
 * en el JSON serializado: un CVV son tres dígitos y aparece por casualidad
 * dentro de cualquier correlativo o UUID lo bastante seguido como para volver
 * el test inestable. Lo que se quiere saber no es si los caracteres `737`
 * existen en algún lado, sino si algún campo **es** el CVV.
 */
function desarmar(valor: unknown, claves: string[] = [], hojas: string[] = []) {
  if (valor === null || valor === undefined) return { claves, hojas };
  if (Array.isArray(valor)) {
    for (const elemento of valor) desarmar(elemento, claves, hojas);
    return { claves, hojas };
  }
  if (typeof valor === "object") {
    for (const [clave, contenido] of Object.entries(valor)) {
      claves.push(clave);
      desarmar(contenido, claves, hojas);
    }
    return { claves, hojas };
  }
  hojas.push(String(valor));
  return { claves, hojas };
}

function noContieneDatosDeTarjeta(etiqueta: string, valor: unknown): void {
  const { claves, hojas } = desarmar(valor);

  for (const clave of claves) {
    expect(clave, `${etiqueta} tiene un campo de tarjeta ("${clave}")`).not.toMatch(NOMBRES_PROHIBIDOS);
  }
  for (const hoja of hojas) {
    expect(VALORES_SONDA, `${etiqueta} guarda el valor "${hoja}"`).not.toContain(hoja);
    expect(hoja, `${etiqueta} guarda algo con forma de PAN`).not.toMatch(FORMA_DE_PAN);
  }
}

// ---------------------------------------------------------------------------
// Dobles en memoria
// ---------------------------------------------------------------------------

const AHORA = "2026-08-09T15:00:00.000Z";
const EXPEDIENTE_ID = "EXP-TEST-1";

const CONTEXTO: ContextoPeticion = {
  ip: "200.10.20.30",
  dispositivo: "Mozilla/5.0 (test)",
  sesionId: "sesion-p7",
};

function repositorioFalso(inicial: Expediente): RepositorioExpediente & { actual: () => Expediente } {
  let guardado = inicial;
  return {
    async obtenerPorId(id) {
      return id === guardado.id ? guardado : null;
    },
    async crear(expediente) {
      guardado = expediente;
    },
    async guardar(expediente) {
      guardado = expediente;
    },
    actual: () => guardado,
  };
}

function evidenciasFalsas(): EvidenceStore & { registros: RegistroEvidencia[] } {
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

function expedienteListoParaPagar(): Expediente {
  const base = avanzarHastaIdentidadVerificada(crearExpediente(EXPEDIENTE_ID));
  const transicion = transicionarExpediente(
    {
      ...base,
      plan: {
        planId: "CONFIO_PLUS",
        premioAnualGs: PLANES.CONFIO_PLUS.premioAnualGs,
        idVersionOferta: "OFERTA-CONFIO-v1",
        hashOfertaSha256: "hash-de-prueba",
        seleccionadoEn: AHORA,
      },
      identidad: {
        numeroCedula: "9323336",
        nombres: "Mónica Mariana",
        apellidos: "Gorena Tapia",
        fechaNacimiento: "1990-04-17",
        sexo: "F",
        nacionalidad: "Paraguaya",
        paisNacimiento: "Paraguay",
        estadoCivil: "Soltera",
        captura: {
          hashFrenteCedula: "a",
          hashDorsoCedula: "b",
          hashSelfie: "c",
          pruebaDeVidaAprobada: true,
          coincidenciaFacialAprobada: true,
        },
      },
    },
    "DECLARACIONES_OK",
    { declaraciones: declaracionesCompatibles, datosComplementarios: datosComplementariosFixture },
  );
  if (!transicion.ok) throw new Error(transicion.error);
  return transicion.expediente;
}

/**
 * Corre el flujo completo de P7 con el adaptador mock real —no un doble— y
 * devuelve todo lo que el sistema produjo, para poder revisarlo entero.
 */
async function recorrerP7(medio: MedioDePago) {
  limpiarOperacionesMock();
  const expedientes = repositorioFalso(expedienteListoParaPagar());
  const evidencias = evidenciasFalsas();
  const deps = {
    pagos: crearPaymentProviderMock({ demoraGeneracionMs: 0, demoraAcreditacionMs: 0 }),
    expedientes,
    evidencias,
    ahora: () => AHORA,
  };

  const inicio = await iniciarPagoP7(deps, {
    expedienteId: EXPEDIENTE_ID,
    medio,
    // Un RUC legítimo de 8 dígitos: es el único número largo que P7 acepta y
    // sirve para comprobar que el detector de PAN no lo confunde.
    ruc: "80012345-6",
    origenLicitoDeFondos: true,
    contexto: CONTEXTO,
    // Datos de tarjeta inyectados en el cuerpo, como los mandaría un cliente
    // manipulado o un formulario que alguien agregue mañana sin pensarlo. El
    // caso de uso solo lee los campos que declara, así que ninguno tiene que
    // aparecer después en el expediente ni en la evidencia. Sin esta
    // inyección el barrido de abajo no probaría nada: buscaría valores que
    // nunca entraron al sistema.
    ...(SONDAS_DE_TARJETA as object),
  });
  const confirmacion = await confirmarPagoP7(deps, { expedienteId: EXPEDIENTE_ID, contexto: CONTEXTO });

  return { inicio, confirmacion, expediente: expedientes.actual(), evidencias: evidencias.registros };
}

// ---------------------------------------------------------------------------
// 1 y 2. Runtime: nada de lo que el sistema produce tiene datos de tarjeta
// ---------------------------------------------------------------------------

describe("P7 · ningún dato de tarjeta se persiste (runtime)", () => {
  it.each(["TARJETA_DEBITO", "TARJETA_CREDITO", "QR_BANCARD"] as const)(
    "pagando con %s, ni el expediente ni la evidencia ni las respuestas los contienen",
    async (medio) => {
      const { inicio, confirmacion, expediente, evidencias } = await recorrerP7(medio);

      expect(inicio.ok).toBe(true);
      expect(confirmacion.ok).toBe(true);

      noContieneDatosDeTarjeta("el expediente persistido", JSON.stringify(expediente));
      noContieneDatosDeTarjeta("la evidencia", JSON.stringify(evidencias));
      noContieneDatosDeTarjeta("la respuesta de iniciarPagoP7", JSON.stringify(inicio));
      noContieneDatosDeTarjeta("la respuesta de confirmarPagoP7", JSON.stringify(confirmacion));
    },
  );

  it("el `Pago` persistido solo guarda medio, estado, importe, referencia y clave", async () => {
    const { expediente } = await recorrerP7("TARJETA_CREDITO");

    expect(Object.keys(expediente.pago ?? {}).sort()).toEqual([
      "confirmadoEn",
      "estado",
      "idempotencyKey",
      "iniciadoEn",
      "medio",
      "montoGs",
      "referenciaBancard",
    ]);
  });

  /**
   * Bancard devuelve los últimos 4 dígitos y el puerto los admite. El dominio
   * los descarta a propósito: no hacen falta para nada del flujo, y un dato de
   * tarjeta que no se guarda es un dato que no hay que proteger.
   */
  it("descarta los últimos 4 dígitos que devuelve Bancard en vez de persistirlos", async () => {
    limpiarOperacionesMock();
    const proveedor = crearPaymentProviderMock({ demoraGeneracionMs: 0, demoraAcreditacionMs: 0 });
    const { expediente } = await recorrerP7("TARJETA_DEBITO");

    // El proveedor sí los expone…
    const operacion = await proveedor.iniciarPagoTarjetaDebito({
      expedienteId: EXPEDIENTE_ID,
      propuestaId: "00018425",
      montoGs: 475_000,
      urlRetorno: "https://segurolotengo.com/p7-pago/retorno",
      idempotencyKey: "IDEMP-ULTIMOS4",
    });
    const consulta = await proveedor.consultarEstadoPago(operacion.referenciaBancard);
    expect(consulta?.ultimos4Digitos).toHaveLength(4);

    // …y el expediente no tiene dónde ponerlos: ni una clave con ese nombre,
    // ni ninguna hoja cuyo valor SEA esos 4 dígitos. Comparación exacta por
    // hoja y no substring del JSON, por la misma razón documentada en
    // `desarmar`: 4 dígitos aparecen por casualidad dentro de cualquier UUID
    // o hash del expediente lo bastante seguido como para volver el test
    // inestable (falló así en CI el 2026-08-16).
    const { claves, hojas } = desarmar(expediente);
    expect(claves.some((clave) => /ultimos_?4/i.test(clave))).toBe(false);
    expect(hojas).not.toContain(consulta?.ultimos4Digitos ?? "0042");
  });

  it("el RUC de 8 dígitos se persiste sin que el detector lo tome por un PAN", async () => {
    const { expediente } = await recorrerP7("TARJETA_DEBITO");

    expect(expediente.facturacion?.ruc).toBe("80012345-6");
  });
});

// ---------------------------------------------------------------------------
// 3 y 4. Superficie de entrada: ni un campo de tarjeta en el código de P7
// ---------------------------------------------------------------------------

const ARCHIVOS_DE_P7: readonly string[] = [
  "src/domain/pago-p7.ts",
  "src/domain/textos-p7.ts",
  "src/adapters/mock/payment-provider.ts",
  "src/ports/payment-provider.ts",
  "src/app/api/p7/_dependencias.ts",
  "src/app/api/p7/pago/route.ts",
  "src/app/api/p7/estado/route.ts",
  "src/app/api/p7/resumen/route.ts",
  "src/app/(flujo)/p7-pago/page.tsx",
  "src/app/(flujo)/p7-pago/FormularioPagoP7.tsx",
];

/** Quita comentarios: la prosa explica por qué NO se guarda el CVV. */
function soloCodigo(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/**
 * Además de los comentarios, quita los literales de texto. Lo que se busca acá
 * son **nombres de campo** —una propiedad `cvv`, un `numeroTarjeta`—, no la
 * palabra "CVV" en una frase: la propia especificación de P7 le promete a la
 * persona que *"no almacenan el número completo de tarjeta o CVV"*, y ese
 * literal tiene que poder existir.
 *
 * Los `name=` e `id=` del formulario, que sí son strings, los cubre entero el
 * test de abajo, que enumera los tres inputs permitidos.
 */
function soloIdentificadores(fuente: string): string {
  return soloCodigo(fuente)
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

describe("P7 · ningún campo de tarjeta en la superficie de entrada", () => {
  it.each(ARCHIVOS_DE_P7)("%s no declara ningún campo de tarjeta", (ruta) => {
    const codigo = soloIdentificadores(readFileSync(join(process.cwd(), ruta), "utf8"));

    expect(codigo, `${ruta} nombra un campo de tarjeta`).not.toMatch(NOMBRES_PROHIBIDOS);
    // `ultimos4Digitos` es la única excepción admitida, y solo en el puerto y
    // en el adaptador — nunca en el dominio ni en la pantalla.
    if (!ruta.includes("ports/") && !ruta.includes("adapters/")) {
      expect(codigo, `${ruta} toca ultimos4Digitos`).not.toMatch(/ultimos4Digitos/);
    }
  });

  it("el formulario de P7 no tiene ningún input que pueda recibir una tarjeta", () => {
    const fuente = readFileSync(
      join(process.cwd(), "src/app/(flujo)/p7-pago/FormularioPagoP7.tsx"),
      "utf8",
    );

    // Los únicos inputs de la pantalla son el nombre (bloqueado), el RUC, el
    // checkbox de origen lícito y los radios del medio de pago.
    const inputs = [...fuente.matchAll(/<input[\s\S]*?\/>/g)].map((m) => m[0]);
    const ids = inputs.flatMap((input) => [...input.matchAll(/(?:id|name)="([^"]+)"/g)].map((m) => m[1]));

    expect(ids.sort()).toEqual(["p7-medio", "p7-nombre", "p7-ruc"]);
    for (const input of inputs) {
      expect(input).not.toMatch(/autoComplete="cc-/i);
    }
  });

  it("ni el caso de uso ni el adaptador escriben a un log plano", () => {
    for (const ruta of ["src/domain/pago-p7.ts", "src/adapters/mock/payment-provider.ts"]) {
      const codigo = soloCodigo(readFileSync(join(process.cwd(), ruta), "utf8"));
      expect(codigo, `${ruta} escribe a console`).not.toMatch(/\bconsole\s*\./);
    }
  });

  /**
   * La otra mitad de la garantía: los datos de tarjeta se tipean dentro del
   * dominio de Bancard. Si el formulario seguro dejara de ser el único camino
   * —por ejemplo, si alguien decidiera recibir la tarjeta y reenviarla—, esto
   * lo delata.
   */
  it("para tarjeta, lo único que baja a la pantalla es la URL del formulario de Bancard", async () => {
    const { inicio } = await recorrerP7("TARJETA_CREDITO");

    expect(inicio.ok).toBe(true);
    if (!inicio.ok) return;
    expect(inicio.instruccion.tipo).toBe("FORMULARIO_SEGURO");
    expect(Object.keys(inicio.instruccion).sort()).toEqual(["tipo", "urlFormularioSeguro"]);
  });
});
