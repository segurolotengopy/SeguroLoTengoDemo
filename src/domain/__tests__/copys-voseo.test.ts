/**
 * Lint de copys (TRV-05): el portal habla en voseo, y de forma coherente.
 *
 * Nace de un pedido concreto de la reunión del 18-ago-2026 (00:24:06). Rodrigo
 * leyó en la pantalla de firma un "Recibí el enlace" junto a un "regresarás
 * automáticamente" y señaló la mezcla; Andres respondió que la coherencia "no
 * es menor porque tiene que ser coherente en todas las pantallas". Un pedido
 * así se cumple una vez a mano y se rompe sola la próxima vez que alguien
 * escriba "Confirma tus datos". De ahí este test: la coherencia deja de
 * depender de que quien edite se acuerde.
 *
 * ## Qué vigila, y qué no
 *
 * Detecta **imperativos en tuteo** dirigidos a la persona (`Revisa`,
 * `Confirma`, `Ingresa`…) y sus formas verbales (`quieres`, `tienes`,
 * `puedes`), que en voseo serían `Revisá`, `Confirmá`, `Ingresá`, `querés`,
 * `tenés`, `podés`.
 *
 * No intenta ser un analizador morfológico: es una lista de las formas que
 * realmente aparecen en un portal de contratación. Prefiere no marcar nada
 * antes que marcar de más, porque un lint de idioma con falsos positivos se
 * termina desactivando — y entonces no vigila nada.
 *
 * **El tuteo no está prohibido en todas partes.** Muchas terceras personas del
 * singular se escriben igual que un imperativo en tuteo (`el sistema *envía*`,
 * `Bancard *confirma*`, `la cobertura *comienza*`), y esas son correctas. Por
 * eso solo se marcan las formas al **inicio de una oración**, que es donde un
 * imperativo vive, y se exceptúan explícitamente las que aparecen como verbo
 * conjugado dentro de una frase.
 */
import { describe, expect, it } from "vitest";
import * as textosP1 from "../textos-p1";
import * as textosP3 from "../textos-p3";
import * as textosP6 from "../textos-p6";
import * as textosP7 from "../textos-p7";
import * as textosP8 from "../textos-p8";
import * as textosP9 from "../textos-p9";
import * as textosPantallaA from "../textos-pantalla-a";
import * as textosPantallaB from "../textos-pantalla-b";

/**
 * Imperativos de tuteo y su forma correcta en voseo. La clave es la forma
 * incorrecta; el valor, la que corresponde. Se buscan solo al principio de una
 * oración: `Revisa tus datos` es un imperativo, pero `quien revisa los datos`
 * no lo es.
 */
const IMPERATIVOS_TUTEO: Readonly<Record<string, string>> = {
  revisa: "revisá",
  confirma: "confirmá",
  ingresa: "ingresá",
  completa: "completá",
  acepta: "aceptá",
  firma: "firmá",
  prepara: "prepará",
  selecciona: "seleccioná",
  elige: "elegí",
  verifica: "verificá",
  descarga: "descargá",
  guarda: "guardá",
  toma: "tomá",
  espera: "esperá",
  vuelve: "volvé",
  continua: "continuá",
  asegurate: "asegurate", // igual en ambas; se deja fuera del reporte
};

/** Formas verbales de tuteo que en voseo cambian, en cualquier posición. */
const FORMAS_TUTEO: Readonly<Record<string, string>> = {
  quieres: "querés",
  tienes: "tenés",
  puedes: "podés",
  debes: "debés",
  necesitas: "necesitás",
  eres: "sos",
  estás: "estás", // igual en ambas
  tuyo: "tuyo",
};

/** Formas de voseo mal escritas que a veces se cuelan. */
const VOSEO_MAL_ESCRITO: readonly string[] = [
  "revisas tú",
  "vos revisás tú",
];

/**
 * Copys exentos, con su razón. Existen porque el español escribe igual la
 * tercera persona del singular y el imperativo en tuteo: `Interseguros
 * **verifica** la firma` describe a un tercero, no le habla a nadie.
 *
 * La exención es por copy exacto y no por módulo a propósito: obliga a
 * justificar cada caso, y si mañana ese texto cambia y sí pasa a hablarle a la
 * persona, la exención ya no coincide y el lint vuelve a mirarlo.
 */
const EXENTOS: Readonly<Record<string, string>> = {
  "textos-pantalla-b.ACTORES_PANTALLA_B[1].rol":
    "Tercera persona: describe qué hace Interseguros, no le pide nada a la persona.",
  "textos-p9.HITOS_CONTRATACION[0].titulo":
    'Sustantivo, no imperativo: "Firma electrónica confirmada" nombra el hito (la firma), no le pide a nadie que firme.',
};

interface Copy {
  readonly origen: string;
  readonly texto: string;
}

/** Aplana un módulo de textos a la lista de literales que contiene. */
function copysDe(nombre: string, modulo: Record<string, unknown>): Copy[] {
  const copys: Copy[] = [];

  const visitar = (clave: string, valor: unknown): void => {
    if (typeof valor === "string") {
      copys.push({ origen: `${nombre}.${clave}`, texto: valor });
      return;
    }
    if (Array.isArray(valor)) {
      valor.forEach((elemento, indice) => visitar(`${clave}[${indice}]`, elemento));
      return;
    }
    if (valor && typeof valor === "object") {
      for (const [subclave, subvalor] of Object.entries(valor)) {
        visitar(`${clave}.${subclave}`, subvalor);
      }
    }
  };

  for (const [clave, valor] of Object.entries(modulo)) {
    // Las funciones exportadas (por ejemplo `guiaHabilitacionVisible`) no son
    // copys; sus literales se revisan a través de quien los expone.
    if (typeof valor === "function") continue;
    visitar(clave, valor);
  }

  return copys;
}

const TODOS_LOS_COPYS: readonly Copy[] = [
  ...copysDe("textos-p1", textosP1),
  ...copysDe("textos-p3", textosP3),
  ...copysDe("textos-p6", textosP6),
  ...copysDe("textos-p7", textosP7),
  ...copysDe("textos-p8", textosP8),
  ...copysDe("textos-p9", textosP9),
  ...copysDe("textos-pantalla-a", textosPantallaA),
  ...copysDe("textos-pantalla-b", textosPantallaB),
];

/** Palabras al inicio de oración: tras un punto, un salto o el comienzo. */
function palabrasIniciales(texto: string): string[] {
  return [...texto.matchAll(/(?:^|[.!?]\s+|\n\s*)([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/g)].map((coincidencia) =>
    (coincidencia[1] ?? "").toLowerCase(),
  );
}

describe("lint de copys · voseo coherente (TRV-05)", () => {
  it("no usa imperativos en tuteo al dirigirse a la persona", () => {
    const infracciones: string[] = [];

    for (const { origen, texto } of TODOS_LOS_COPYS) {
      if (EXENTOS[origen]) continue;
      for (const palabra of palabrasIniciales(texto)) {
        const correcta = IMPERATIVOS_TUTEO[palabra];
        if (correcta && correcta !== palabra) {
          infracciones.push(`${origen}: "${palabra}…" debería ser "${correcta}…"`);
        }
      }
    }

    expect(infracciones, `Copys en tuteo:\n${infracciones.join("\n")}`).toEqual([]);
  });

  it("no usa formas verbales de tuteo", () => {
    const infracciones: string[] = [];

    for (const { origen, texto } of TODOS_LOS_COPYS) {
      for (const [tuteo, voseo] of Object.entries(FORMAS_TUTEO)) {
        if (tuteo === voseo) continue;
        // `\b` no reconoce acentos como límite en JS, así que se delimita a mano.
        const patron = new RegExp(`(?:^|[^A-Za-zÁÉÍÓÚÑáéíóúñ])${tuteo}(?![A-Za-zÁÉÍÓÚÑáéíóúñ])`, "i");
        if (patron.test(texto)) {
          infracciones.push(`${origen}: "${tuteo}" debería ser "${voseo}"`);
        }
      }
    }

    expect(infracciones, `Copys en tuteo:\n${infracciones.join("\n")}`).toEqual([]);
  });

  it("no mezcla voseo y tuteo en la misma frase", () => {
    const infracciones: string[] = [];

    for (const { origen, texto } of TODOS_LOS_COPYS) {
      for (const mezcla of VOSEO_MAL_ESCRITO) {
        if (texto.toLowerCase().includes(mezcla)) {
          infracciones.push(`${origen}: "${mezcla}"`);
        }
      }
    }

    expect(infracciones, `Mezclas:\n${infracciones.join("\n")}`).toEqual([]);
  });

  it("revisa una cantidad de copys que hace verosímil el resultado", () => {
    // Sin esto, un error en `copysDe` que devolviera una lista vacía dejaría
    // los tres tests anteriores en verde sin haber mirado un solo texto.
    expect(TODOS_LOS_COPYS.length).toBeGreaterThan(50);
  });
});
