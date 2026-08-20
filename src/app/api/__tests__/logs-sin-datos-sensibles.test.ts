/**
 * CMP-16 · los registros técnicos no llevan datos sensibles (L6).
 *
 * La regla inviolable #7 dice qué no puede salir hacia analítica, CRM,
 * monitoreo de errores ni servicios de IA: respuestas médicas, condición PEP,
 * cédula, OTP y datos de tarjeta. Hasta ahora eso estaba sostenido por
 * disciplina al escribir cada módulo; este test lo vuelve verificable.
 *
 * ## Qué mira y qué no
 *
 * Mira el **código fuente**, no la ejecución, porque el riesgo es que alguien
 * agregue un `console.log(expediente)` mientras depura y se lo olvide adentro.
 * Un log así no falla ninguna prueba funcional: el flujo sigue andando y el
 * dato se filtra igual, en cada corrida y para siempre en los registros del
 * servidor.
 *
 * No pretende ser un analizador: es una barrera contra el descuido corriente.
 * Un log construido con nombres de variable indirectos se le escapa, y está
 * bien que así sea — lo que atrapa es el caso real, que es el directo.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(process.cwd(), "src");

/** Las cuatro salidas de consola que dejan rastro en el servidor. */
const LLAMADAS_DE_LOG = /console\.(log|error|warn|info|debug)\s*\(([^)]*)\)/g;

/**
 * Nombres que, si aparecen dentro de un `console.*`, son un dato prohibido o
 * el objeto que lo contiene. `expediente` y `identidad` entran porque son los
 * agregados: loguear el objeto entero arrastra cédula, salud y PEP de una vez.
 */
const NOMBRES_PROHIBIDOS = [
  "expediente",
  "identidad",
  "declaraciones",
  "datosComplementarios",
  "beneficiario",
  "cedula",
  "numeroCedula",
  "codigo",
  "otp",
  "pan",
  "cvv",
  "tarjeta",
  "condicionPep",
  "correo",
  "celular",
];

function archivosFuente(directorio: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      // Los tests pueden loguear lo que necesiten: no corren en el servidor.
      if (entrada === "__tests__") continue;
      encontrados.push(...archivosFuente(ruta));
      continue;
    }
    if ([".ts", ".tsx"].includes(extname(entrada))) encontrados.push(ruta);
  }
  return encontrados;
}

describe("CMP-16 · protección de los registros técnicos", () => {
  it("ningún console.* del código de producción nombra un dato sensible", () => {
    const hallazgos: string[] = [];

    for (const ruta of archivosFuente(RAIZ)) {
      const contenido = readFileSync(ruta, "utf8");
      for (const [llamada, , argumentos] of contenido.matchAll(LLAMADAS_DE_LOG)) {
        const enMinusculas = argumentos.toLowerCase();
        const prohibidos = NOMBRES_PROHIBIDOS.filter((nombre) =>
          new RegExp(`\\b${nombre.toLowerCase()}\\b`).test(enMinusculas),
        );
        if (prohibidos.length > 0) {
          hallazgos.push(
            `${relative(process.cwd(), ruta).split(sep).join("/")}: ${llamada.trim()} → ${prohibidos.join(", ")}`,
          );
        }
      }
    }

    expect(hallazgos, hallazgos.join("\n")).toEqual([]);
  });

  it("el resumen que va a la evidencia del pago no tiene por dónde filtrar una tarjeta", async () => {
    // Regla inviolable #6: nunca se persiste PAN ni CVV, "en ninguna capa,
    // incluidos logs y trazas de error". `resumenSeguroP7` es el embudo por el
    // que pasa todo lo que P7 asienta, así que alcanza con mirarlo a él.
    const { resumenSeguroP7 } = await import("@/domain/pago-p7");

    const resumen = resumenSeguroP7({
      medio: "QR_BANCARD",
      montoGs: 522_500,
      referenciaBancard: "BC-84629517",
      estadoPago: "PENDIENTE",
      numeroPropuesta: "00018425",
      idempotencyKey: "idem-1",
    });

    const claves = Object.keys(resumen).join(" ").toLowerCase();
    for (const prohibido of ["pan", "cvv", "tarjeta", "numero", "titular"]) {
      expect(claves, `el resumen expone "${prohibido}"`).not.toContain(prohibido);
    }
  });
});
