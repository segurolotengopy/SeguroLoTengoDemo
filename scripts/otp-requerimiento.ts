/**
 * Envío de OTP real por WhatsApp usando la plantilla `requerimiento`,
 * en modo **diálogo**.
 *
 * Dispara el mismo camino que la app en `INTEGRATION_OTP=live`: llama al
 * `otp-service` de WhatsApp-Modular (`/v1/otp/request` y `/v1/otp/verify`)
 * reutilizando el cliente oficial del adaptador. No habla con Meta por su
 * cuenta ni reimplementa nada: si este script funciona, la app funciona.
 *
 * ## Por qué hace falta responder "hola" entre envío y envío
 *
 * `requerimiento` es una plantilla de categoría **MARKETING** (fue la única
 * que Meta aprobó sin Business Verification). Meta limita las plantillas de
 * marketing repetidas al mismo destinatario "para mantener un ecosistema
 * sano": a partir del segundo envío seguido, la API **acepta el mensaje,
 * devuelve un `wamid` y HTTP 202 — y el mensaje nunca llega**. El error
 * `131049` aparece después, solo en el webhook.
 *
 * Que el destinatario **responda** rompe esa supresión: convierte el envío
 * unilateral en una conversación con interacción real, que es justo lo que
 * el límite intenta proteger. De paso reabre la ventana de servicio de 24 h.
 *
 * Por eso este script es interactivo: después de cada envío se planta y no
 * deja mandar el siguiente hasta que confirmes que respondiste desde el
 * celular. No es una formalidad — es la diferencia entre que llegue y que no.
 *
 * ## Cómo se usa
 *
 *     npx tsx scripts/otp-requerimiento.ts +59XXXXXXXXX
 *     npx tsx scripts/otp-requerimiento.ts +59XXXXXXXXX --proposito SIGNATURE_P7A
 *
 * Necesita en `.env.local` (nunca en el repo):
 *
 *     WHATSAPP_MODULAR_URL=https://wamodular.duckdns.org
 *     WHATSAPP_MODULAR_TOKEN=<bearer del otp-service>
 *
 * Y del lado del servicio (el `.env` de la VM, no de acá):
 *
 *     WA_OTP_SEND_MODE=template_header
 *     WA_TEMPLATE_OTP=requerimiento
 *
 * Ese modo manda **solo** el componente `header` de la plantilla, que es
 * donde `requerimiento` tiene su variable. Si el servicio está en
 * `session_text` el código igual llega, pero como texto libre y dependiendo
 * de la ventana de 24 h — no es lo que este script quiere ejercitar.
 *
 * ## Manda mensajes de verdad
 *
 * No hay modo seco. Cada corrida es un envío real por el canal oficial de
 * Meta y consume las cuotas de verdad del servicio: 1 por minuto y 5 por
 * hora al mismo número, más el tope diario global. Con el número de prueba
 * de Meta no se factura, pero solo se puede escribir a los 5 destinatarios
 * registrados en el panel.
 *
 * ## Qué NO hace
 *
 * No confirma la ENTREGA. La respuesta 202 solo dice que Meta aceptó el
 * envío; con una plantilla de marketing eso no garantiza nada. La entrega
 * real se ve en los webhooks del servicio:
 *
 *     ssh -i ~/.ssh/id_ed25519_oci_lab ubuntu@150.136.67.75 \
 *       'docker logs --since 10m otp-service 2>&1 | grep -E "estado="'
 *
 * `delivered` es entrega. `failed ... codigoMeta=131049` es la supresión de
 * marketing descrita arriba.
 *
 * ## El código nunca pasa por acá
 *
 * El script no conoce el OTP: lo lee de tu teclado, tal como lo leíste en el
 * celular. El servicio guarda solo el hash. Nada de lo que este script
 * imprime contiene el código ni el teléfono sin enmascarar.
 */
import { createInterface } from "node:readline/promises";
import { stdin as entrada, stdout as salida } from "node:process";
import { randomUUID } from "node:crypto";
import {
  crearClienteWhatsAppModularDesdeEntorno,
  type ClienteWhatsAppModular,
  type PropositoWhatsAppModular,
} from "../src/adapters/live/whatsapp-modular";

/** Propósitos válidos del servicio. Independientes entre sí (su T9). */
const PROPOSITOS: readonly PropositoWhatsAppModular[] = [
  "PHONE_VERIFICATION",
  "SIGNATURE_P7A",
];

interface Argumentos {
  readonly telefonoE164: string;
  readonly proposito: PropositoWhatsAppModular;
}

function esProposito(valor: string): valor is PropositoWhatsAppModular {
  return (PROPOSITOS as readonly string[]).includes(valor);
}

function leerArgumentos(argv: readonly string[]): Argumentos {
  const libres: string[] = [];
  let proposito: PropositoWhatsAppModular = "PHONE_VERIFICATION";

  for (let i = 0; i < argv.length; i += 1) {
    const actual = argv[i];
    if (actual === "--proposito") {
      const valor = argv[i + 1];
      if (valor === undefined || !esProposito(valor)) {
        throw new Error(
          `--proposito debe ser uno de: ${PROPOSITOS.join(" | ")} (llegó: ${valor ?? "nada"})`,
        );
      }
      proposito = valor;
      i += 1;
      continue;
    }
    if (actual !== undefined) libres.push(actual);
  }

  const telefonoE164 = libres[0];
  if (telefonoE164 === undefined) {
    throw new Error(
      "Falta el teléfono destino.\n\n" +
        "  npx tsx scripts/otp-requerimiento.ts +59XXXXXXXXX [--proposito SIGNATURE_P7A]",
    );
  }
  // El servicio valida el prefijo de país (solo +595/+591) y responde con su
  // propio error; acá solo se ataja la forma, para no gastar una llamada en
  // un typo evidente.
  if (!/^\+\d{10,15}$/.test(telefonoE164)) {
    throw new Error(
      `El teléfono debe venir en E.164 con "+" y solo dígitos (llegó: ${telefonoE164}).`,
    );
  }

  return { telefonoE164, proposito };
}

/**
 * Carga `.env.local` si existe. Un script suelto no pasa por Next.js, que es
 * quien normalmente lo lee; sin esto las variables no estarían definidas.
 */
function cargarEntornoLocal(): void {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Puede no existir (entorno ya exportado a mano). Si de verdad faltan las
    // variables, el cliente falla enseguida nombrando cuál — mejor error que
    // este.
  }
}

const SEPARADOR = "─".repeat(64);

async function enviarYVerificar(
  cliente: ClienteWhatsAppModular,
  args: Argumentos,
  consola: ReturnType<typeof createInterface>,
  numeroDeEnvio: number,
): Promise<void> {
  console.log(`\n${SEPARADOR}\nEnvío #${numeroDeEnvio} · ${args.proposito}`);

  const solicitud = await cliente.solicitarOtp({
    telefonoE164: args.telefonoE164,
    proposito: args.proposito,
    // Clave nueva por envío: repetirla devolvería el MISMO envío desde la
    // caché de idempotencia del servicio (1 h) en vez de mandar otro.
    idempotencyKey: randomUUID(),
  });

  if (!solicitud.ok) {
    if (solicitud.motivo === "COOLDOWN") {
      console.error(
        `⏳ El servicio rechazó el envío por cooldown de reenvío: faltan ${solicitud.segundosRestantes} s.\n` +
          "   Es la política de OTP funcionando (1 envío por minuto al mismo número), no una falla.",
      );
      return;
    }
    console.error(`❌ El envío falló: ${solicitud.detalle}`);
    return;
  }

  console.log(`✅ Aceptado por Meta · destino ${solicitud.destinoEnmascarado}`);
  console.log(`   otpId: ${solicitud.otpId}`);
  console.log(`   vence: ${solicitud.expiraEn}`);
  console.log(
    "\n   ⚠️  Aceptado NO es entregado. Con la plantilla de marketing, un\n" +
      "      envío suprimido se ve igual de exitoso desde acá. Si no llega,\n" +
      "      mirá el webhook: un codigoMeta=131049 confirma la supresión.",
  );

  console.log(
    `\n📱 EN EL CELULAR, AHORA:\n` +
      `   1. Abrí el mensaje y copiá el código.\n` +
      `   2. Respondé "hola" en ese mismo chat  ← IMPRESCINDIBLE para el próximo envío.`,
  );

  const codigo = (
    await consola.question(
      "\n   Código recibido (Enter vacío para saltar la verificación): ",
    )
  ).trim();

  if (codigo === "") {
    console.log("   (verificación salteada)");
    return;
  }

  const verificacion = await cliente.verificarOtp({
    otpId: solicitud.otpId,
    codigo,
  });

  if (verificacion.ok) {
    console.log(
      "   ✅ Código verificado. El OTP quedó consumido: no se puede reusar.",
    );
    return;
  }

  switch (verificacion.motivo) {
    case "CODIGO_INCORRECTO":
      console.log(
        `   ❌ Código incorrecto. Intentos restantes: ${verificacion.intentosRestantes}.`,
      );
      break;
    case "INTENTOS_AGOTADOS":
      console.log(
        "   ❌ Se agotaron los intentos: el OTP quedó INVALIDADO, no solo rechazado.",
      );
      break;
    case "EXPIRADO":
      console.log(
        "   ❌ El OTP venció (o nunca existió: el servicio no los distingue a propósito).",
      );
      break;
    default:
      console.log(`   ❌ No se pudo verificar: ${verificacion.detalle}`);
  }
}

async function principal(): Promise<void> {
  const args = leerArgumentos(process.argv.slice(2));
  cargarEntornoLocal();

  const cliente = crearClienteWhatsAppModularDesdeEntorno();
  const consola = createInterface({ input: entrada, output: salida });

  console.log(
    `${SEPARADOR}\n` +
      "OTP real por WhatsApp · plantilla `requerimiento` (MARKETING)\n" +
      `${SEPARADOR}\n` +
      "Cada envío es real y consume las cuotas del servicio.\n" +
      'Entre un envío y el siguiente TENÉS que responder "hola" desde el celular,\n' +
      "o Meta suprime la entrega en silencio (131049).",
  );

  try {
    let numeroDeEnvio = 1;
    for (;;) {
      await enviarYVerificar(cliente, args, consola, numeroDeEnvio);

      const otra = (
        await consola.question("\n¿Otro envío al mismo número? [s/N]: ")
      )
        .trim()
        .toLowerCase();
      if (otra !== "s" && otra !== "si" && otra !== "sí") break;

      const respondio = (
        await consola.question(
          '¿Ya respondiste "hola" desde el celular? [s/N]: ',
        )
      )
        .trim()
        .toLowerCase();
      if (respondio !== "s" && respondio !== "si" && respondio !== "sí") {
        console.log(
          "\n   Respondé primero y volvé a correr el script. Sin esa respuesta el\n" +
            "   próximo envío se acepta pero probablemente no llegue.",
        );
        break;
      }
      numeroDeEnvio += 1;
    }
  } finally {
    consola.close();
  }

  console.log(
    `\n${SEPARADOR}\n` +
      "Para confirmar la ENTREGA real (no solo la aceptación):\n\n" +
      "  ssh -i ~/.ssh/id_ed25519_oci_lab ubuntu@150.136.67.75 \\\n" +
      "    'docker logs --since 10m otp-service 2>&1 | grep -E \"estado=\"'\n",
  );
}

principal().catch((error: unknown) => {
  console.error(
    `\n❌ ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
