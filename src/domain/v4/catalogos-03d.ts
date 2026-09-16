/**
 * Los catálogos de la pantalla 03D, tal como los aprobó Interseguros.
 *
 * **Transcritos, no redactados.** Salen de
 * `data/PANTALLA_03D_ESPECIFICACION_Y_CATALOGOS_APROBADA_FINAL.json` del
 * handoff del 14-sep-2026, que es el único catálogo del paquete que llegó
 * completo y aprobado: los cinco de 03E no vinieron y hubo que armarlos
 * (D-48, `catalogos-03e.ts`).
 *
 * El orden es el `order` del JSON y **no se reordena**: los tres selectores de
 * país están alfabetizados en español, y `Otra ciudad o localidad` va al final
 * de las 44 aunque el arte de `03D_06` la dibuje como séptima fila — el arte
 * la muestra fuera de orden y la lista aprobada la tiene última
 * (`ANALISIS_VISUAL_PNG.md` §6.2).
 *
 * Módulo sin dependencias, ni siquiera `node:*`: lo importa el componente de
 * cliente de la pantalla y el caso de uso del servidor que valida lo que
 * llega, con el mismo criterio que `catalogo-identidad.ts` y `catalogo-p6.ts`.
 */

/** Los dos valores que puede decir una cédula paraguaya. Sin buscador. */
export const SEXOS_V4: readonly string[] = [
  "Femenino",
  "Masculino",
];

/** Sin buscador. */
export const ESTADOS_CIVILES_V4: readonly string[] = [
  "Soltero/a",
  "Casado/a",
  "Unión de hecho",
  "Divorciado/a",
  "Viudo/a",
];

/**
 * Catálogo ISO de países en español, con buscador.
 *
 * Es **la misma lista** para país de nacimiento, nacionalidad y país de
 * residencia: el JSON aprobado trae tres catálogos con idénticas 195 opciones,
 * y el de nacionalidad usa el nombre del país en vez del gentilicio. Se
 * declara una vez y se referencia tres veces, para que no puedan divergir.
 */
export const PAISES_V4: readonly string[] = [
  "Afganistán",
  "Albania",
  "Alemania",
  "Andorra",
  "Angola",
  "Antigua y Barbuda",
  "Arabia Saudita",
  "Argelia",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaiyán",
  "Bahamas",
  "Bangladés",
  "Barbados",
  "Baréin",
  "Bélgica",
  "Belice",
  "Benín",
  "Bielorrusia",
  "Birmania",
  "Bolivia",
  "Bosnia y Herzegovina",
  "Botsuana",
  "Brasil",
  "Brunéi",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Bután",
  "Cabo Verde",
  "Camboya",
  "Camerún",
  "Canadá",
  "Catar",
  "Chad",
  "Chile",
  "China",
  "Chipre",
  "Ciudad del Vaticano",
  "Colombia",
  "Comoras",
  "Corea del Norte",
  "Corea del Sur",
  "Costa de Marfil",
  "Costa Rica",
  "Croacia",
  "Cuba",
  "Dinamarca",
  "Dominica",
  "Ecuador",
  "Egipto",
  "El Salvador",
  "Emiratos Árabes Unidos",
  "Eritrea",
  "Eslovaquia",
  "Eslovenia",
  "España",
  "Estados Unidos",
  "Estonia",
  "Esuatini",
  "Etiopía",
  "Filipinas",
  "Finlandia",
  "Fiyi",
  "Francia",
  "Gabón",
  "Gambia",
  "Georgia",
  "Ghana",
  "Granada",
  "Grecia",
  "Guatemala",
  "Guinea",
  "Guinea-Bisáu",
  "Guinea Ecuatorial",
  "Guyana",
  "Haití",
  "Honduras",
  "Hungría",
  "India",
  "Indonesia",
  "Irak",
  "Irán",
  "Irlanda",
  "Islandia",
  "Islas Marshall",
  "Islas Salomón",
  "Israel",
  "Italia",
  "Jamaica",
  "Japón",
  "Jordania",
  "Kazajistán",
  "Kenia",
  "Kirguistán",
  "Kiribati",
  "Kuwait",
  "Laos",
  "Lesoto",
  "Letonia",
  "Líbano",
  "Liberia",
  "Libia",
  "Liechtenstein",
  "Lituania",
  "Luxemburgo",
  "Macedonia del Norte",
  "Madagascar",
  "Malasia",
  "Malaui",
  "Maldivas",
  "Malí",
  "Malta",
  "Marruecos",
  "Mauricio",
  "Mauritania",
  "México",
  "Micronesia",
  "Moldavia",
  "Mónaco",
  "Mongolia",
  "Montenegro",
  "Mozambique",
  "Namibia",
  "Nauru",
  "Nepal",
  "Nicaragua",
  "Níger",
  "Nigeria",
  "Noruega",
  "Nueva Zelanda",
  "Omán",
  "Países Bajos",
  "Pakistán",
  "Palaos",
  "Palestina",
  "Panamá",
  "Papúa Nueva Guinea",
  "Paraguay",
  "Perú",
  "Polonia",
  "Portugal",
  "Reino Unido",
  "República Centroafricana",
  "República Checa",
  "República del Congo",
  "República Democrática del Congo",
  "República Dominicana",
  "Ruanda",
  "Rumania",
  "Rusia",
  "Samoa",
  "San Cristóbal y Nieves",
  "San Marino",
  "San Vicente y las Granadinas",
  "Santa Lucía",
  "Santo Tomé y Príncipe",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leona",
  "Singapur",
  "Siria",
  "Somalia",
  "Sri Lanka",
  "Sudáfrica",
  "Sudán",
  "Sudán del Sur",
  "Suecia",
  "Suiza",
  "Surinam",
  "Tailandia",
  "Tanzania",
  "Tayikistán",
  "Timor Oriental",
  "Togo",
  "Tonga",
  "Trinidad y Tobago",
  "Túnez",
  "Turkmenistán",
  "Turquía",
  "Tuvalu",
  "Ucrania",
  "Uganda",
  "Uruguay",
  "Uzbekistán",
  "Vanuatu",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Yibuti",
  "Zambia",
  "Zimbabue",
];

/** Nacionalidad: el JSON aprobado la expresa con el nombre del país. */
export const NACIONALIDADES_V4: readonly string[] = PAISES_V4;

/**
 * Las 44 localidades del catálogo aprobado, por departamento, más la salida
 * de texto libre al final (`allows_other`). Con buscador.
 */
export const CIUDADES_V4: readonly string[] = [
  "Asunción",
  "Concepción",
  "Horqueta",
  "San Lázaro",
  "San Pedro de Ycuamandiyú",
  "Santa Rosa del Aguaray",
  "Caacupé",
  "Tobatí",
  "Piribebuy",
  "Villarrica",
  "Independencia",
  "Caaguazú",
  "Coronel Oviedo",
  "Caazapá",
  "San Juan Nepomuceno",
  "Encarnación",
  "Cambyretá",
  "Hohenau",
  "San Juan Bautista",
  "Ayolas",
  "Paraguarí",
  "Carapeguá",
  "Ciudad del Este",
  "Hernandarias",
  "Presidente Franco",
  "San Lorenzo",
  "Luque",
  "Capiatá",
  "Fernando de la Mora",
  "Lambaré",
  "Mariano Roque Alonso",
  "Villa Hayes",
  "Benjamín Aceval",
  "Pilar",
  "Alberdi",
  "Pedro Juan Caballero",
  "Bella Vista Norte",
  "Salto del Guairá",
  "Curuguaty",
  "Fuerte Olimpo",
  "Carmelo Peralta",
  "Filadelfia",
  "Loma Plata",
  "Otra ciudad o localidad",
];

/** La opción que habilita el texto libre de ciudad. Siempre la última. */
export const CIUDAD_OTRA_V4 = "Otra ciudad o localidad";

/** Cantidad de opciones que declara el pie de cada hoja de selección. */
export const TOTALES_CATALOGOS_03D = {
  sexo: SEXOS_V4.length,
  estadoCivil: ESTADOS_CIVILES_V4.length,
  paises: PAISES_V4.length,
  ciudades: CIUDADES_V4.length,
} as const;

/**
 * Traduce la nacionalidad **como la escribe la cédula** al valor del catálogo.
 *
 * El documento usa el gentilicio (`PARAGUAYA`, `PARAGUAYO`) y el catálogo
 * aprobado de 03D usa el nombre del país (`Paraguay`). Sin esta traducción, el
 * selector arrancaba con un valor que no está en su propia lista: la pantalla
 * mostraba «PARAGUAYA» y el servidor lo rechazaba.
 *
 * Devuelve `null` cuando no reconoce el gentilicio, y entonces **el selector
 * queda vacío**: es preferible que la persona elija a que la pantalla adivine
 * una nacionalidad. La tabla cubre lo que puede leer una cédula paraguaya; no
 * pretende ser un diccionario de gentilicios del mundo.
 */
const GENTILICIOS: Readonly<Record<string, string>> = {
  PARAGUAYA: "Paraguay",
  PARAGUAYO: "Paraguay",
  ARGENTINA: "Argentina",
  ARGENTINO: "Argentina",
  BRASILENA: "Brasil",
  BRASILENO: "Brasil",
  BOLIVIANA: "Bolivia",
  BOLIVIANO: "Bolivia",
  URUGUAYA: "Uruguay",
  URUGUAYO: "Uruguay",
  CHILENA: "Chile",
  CHILENO: "Chile",
};

export function paisDeNacionalidadLeida(valor: string): string | null {
  const limpio = valor
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (limpio === "") return null;
  if (GENTILICIOS[limpio]) return GENTILICIOS[limpio];
  // Algunas lecturas ya vienen con el nombre del país.
  const comoPais = PAISES_V4.find(
    (pais) =>
      pais
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase() === limpio,
  );
  return comoPais ?? null;
}
