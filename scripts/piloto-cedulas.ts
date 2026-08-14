/**
 * Medición del piloto de tres formatos de cédula (ítem 9 de
 * `docs/Tabla de Integraciones externas - Tabla.csv`).
 *
 * Toma un directorio con fotos de cédulas **reales**, las hace pasar por el
 * adaptador oficial (Rekognition + Textract, los mismos umbrales que P5) y saca
 * una tabla de tasa de aprobación por formato y por etapa.
 *
 * El criterio de decisión del RFP no es el precio de lista sino **la tasa de
 * aprobación con cédulas reales**; esto es lo que produce ese número.
 *
 * ## Cuesta plata de verdad
 *
 * Cada par frente+dorso son ~4 llamadas facturadas (2 de Textract, 1–2 de
 * Rekognition): del orden de USD 0,005 por muestra. Cien muestras son centavos,
 * pero **son llamadas reales a AWS** con credenciales reales. No hay modo seco:
 * medir el OCR simulado no mediría nada.
 *
 * ## Cómo se usa
 *
 *     AWS_PROFILE=<perfil> npx tsx scripts/piloto-cedulas.ts <directorio>
 *
 * El directorio se organiza por formato, un subdirectorio por cada uno:
 *
 *     muestras/
 *       formato-nuevo/      persona-01-frente.jpg, persona-01-dorso.jpg, …
 *       formato-anterior/   persona-07-frente.jpg, persona-07-dorso.jpg, …
 *       residente/          persona-12-frente.jpg, persona-12-dorso.jpg, …
 *
 * El emparejamiento es por prefijo antes de `-frente` / `-dorso`. Cualquier
 * archivo sin su par se informa y se saltea, en vez de contarse como fallo:
 * un par incompleto es un error de armado de la muestra, no del proveedor.
 *
 * ## Qué NO hace
 *
 * No mide prueba de vida ni coincidencia facial: eso necesita una persona
 * frente a la cámara y no se puede reproducir desde archivos. El piloto de
 * biometría es presencial y va aparte.
 *
 * ## Datos personales
 *
 * Las imágenes son cédulas de personas reales. **No las metas en el repo.**
 * El informe que este script imprime no contiene nombres ni números de cédula
 * —solo agregados y motivos de rechazo— justamente para que se pueda pegar en
 * un documento o un correo sin exponer a nadie.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { TextractClient } from "@aws-sdk/client-textract";
import { crearIdentityProviderAws } from "../src/adapters/live/identity-provider";

type Etapa = "frente" | "dorso" | "ocr";

interface Resultado {
  readonly muestra: string;
  readonly aprobada: boolean;
  /** Primera etapa que no aprobó; `null` si pasó todo. */
  readonly fallaEn: Etapa | null;
  readonly motivo: string | null;
}

interface Par {
  readonly nombre: string;
  readonly frente: string;
  readonly dorso: string;
}

const EXTENSIONES = new Set([".jpg", ".jpeg", ".png"]);

/** Empareja `X-frente.jpg` con `X-dorso.jpg` dentro de un directorio. */
function emparejar(directorio: string): { pares: Par[]; sueltos: string[] } {
  const frentes = new Map<string, string>();
  const dorsos = new Map<string, string>();

  for (const archivo of readdirSync(directorio)) {
    if (!EXTENSIONES.has(extname(archivo).toLowerCase())) continue;
    const sinExtension = basename(archivo, extname(archivo));
    const ruta = join(directorio, archivo);
    if (sinExtension.endsWith("-frente")) frentes.set(sinExtension.slice(0, -7), ruta);
    else if (sinExtension.endsWith("-dorso")) dorsos.set(sinExtension.slice(0, -6), ruta);
  }

  const pares: Par[] = [];
  const sueltos: string[] = [];

  for (const [nombre, frente] of frentes) {
    const dorso = dorsos.get(nombre);
    if (dorso) pares.push({ nombre, frente, dorso });
    else sueltos.push(`${nombre}-frente (falta el dorso)`);
  }
  for (const [nombre] of dorsos) {
    if (!frentes.has(nombre)) sueltos.push(`${nombre}-dorso (falta el frente)`);
  }

  return { pares: pares.sort((a, b) => a.nombre.localeCompare(b.nombre)), sueltos };
}

async function medirPar(
  crearAdaptador: () => ReturnType<typeof crearIdentityProviderAws>,
  par: Par,
): Promise<Resultado> {
  // Un adaptador por muestra: su estado de sesión es por instancia, así que
  // reusarlo mezclaría las capturas de una persona con las de otra.
  const adaptador = crearAdaptador();
  const id = `PILOTO-${par.nombre}`;

  const frente = await adaptador.capturarFrenteCedula(id, new Uint8Array(readFileSync(par.frente)));
  if (!frente.calidadAprobada || !frente.autenticidadAprobada) {
    return { muestra: par.nombre, aprobada: false, fallaEn: "frente", motivo: frente.motivoRechazo };
  }

  const dorso = await adaptador.capturarDorsoCedula(id, new Uint8Array(readFileSync(par.dorso)));
  if (!dorso.calidadAprobada || !dorso.autenticidadAprobada) {
    return { muestra: par.nombre, aprobada: false, fallaEn: "dorso", motivo: dorso.motivoRechazo };
  }

  const ocr = await adaptador.extraerDatosCedula(id);
  if (!ocr.confiable) {
    return {
      muestra: par.nombre,
      aprobada: false,
      fallaEn: "ocr",
      // Sin MRZ legible no hay datos confiables. Es el motivo que se espera en
      // el formato anterior, y distinguirlo importa: no es un problema de foto.
      motivo: "OCR no confiable (sin MRZ utilizable o discrepancia frente/dorso)",
    };
  }

  return { muestra: par.nombre, aprobada: true, fallaEn: null, motivo: null };
}

function porcentaje(parte: number, total: number): string {
  return total === 0 ? "—" : `${((parte / total) * 100).toFixed(1)} %`;
}

function informe(formato: string, resultados: readonly Resultado[]): void {
  const total = resultados.length;
  const aprobadas = resultados.filter((r) => r.aprobada).length;

  console.log(`\n## ${formato}`);
  console.log(`   muestras: ${total} · aprobadas: ${aprobadas} (${porcentaje(aprobadas, total)})`);

  const etapas: Etapa[] = ["frente", "dorso", "ocr"];
  for (const etapa of etapas) {
    const fallas = resultados.filter((r) => r.fallaEn === etapa);
    if (fallas.length === 0) continue;
    console.log(`   falla en ${etapa}: ${fallas.length} (${porcentaje(fallas.length, total)})`);

    // Motivos agrupados: lo que se quiere saber es qué falla seguido, no el
    // detalle de cada muestra.
    const conteo = new Map<string, number>();
    for (const falla of fallas) {
      const motivo = falla.motivo ?? "(sin motivo)";
      conteo.set(motivo, (conteo.get(motivo) ?? 0) + 1);
    }
    for (const [motivo, veces] of [...conteo].sort((a, b) => b[1] - a[1])) {
      console.log(`      ${veces}× ${motivo}`);
    }
  }
}

async function principal(): Promise<void> {
  const raiz = process.argv[2];
  if (!raiz) {
    console.error("Uso: AWS_PROFILE=<perfil> npx tsx scripts/piloto-cedulas.ts <directorio>");
    process.exit(2);
  }

  const region = process.env.AWS_REGION ?? "us-east-1";
  const crearAdaptador = () =>
    crearIdentityProviderAws({
      rekognition: new RekognitionClient({ region }),
      textract: new TextractClient({ region }),
    });

  const formatos = readdirSync(raiz).filter((entrada) =>
    statSync(join(raiz, entrada)).isDirectory(),
  );

  if (formatos.length === 0) {
    console.error(`No hay subdirectorios por formato en ${raiz}.`);
    process.exit(2);
  }

  console.log(`# Piloto de cédulas · región ${region}`);
  console.log(`Los mismos umbrales que P5 (src/domain/identidad-parametros.ts).`);

  const global: Resultado[] = [];

  for (const formato of formatos.sort()) {
    const { pares, sueltos } = emparejar(join(raiz, formato));

    for (const suelto of sueltos) {
      console.log(`   ⚠ ${formato}: ${suelto} — se saltea`);
    }

    const resultados: Resultado[] = [];
    for (const par of pares) {
      resultados.push(await medirPar(crearAdaptador, par));
    }

    informe(formato, resultados);
    global.push(...resultados);
  }

  const aprobadas = global.filter((r) => r.aprobada).length;
  console.log(`\n## Total`);
  console.log(
    `   ${global.length} muestras · ${aprobadas} aprobadas (${porcentaje(aprobadas, global.length)})`,
  );
  console.log(`   costo aproximado: USD ${(global.length * 0.005).toFixed(2)}\n`);
}

principal().catch((error: unknown) => {
  console.error("\nEl piloto se cortó:", error instanceof Error ? error.message : error);
  process.exit(1);
});
