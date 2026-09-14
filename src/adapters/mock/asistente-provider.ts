/**
 * Adaptador simulado del asistente (Terra) — sin red, sin modelo de lenguaje.
 *
 * Responde SOLO con datos que ya son fuente de verdad en este repositorio
 * (`catalogo.ts`, `textos-aclaraciones.ts`, `textos-plan.ts`): planes y premios,
 * carencias, edades, cómo se contrata, a quién reclamar. Todo lo demás cae al
 * mensaje de «sin respaldo» con la derivación. Es lo que hace posible mostrar el
 * widget en una demo sin desplegar el servicio, y lo que las pruebas usan.
 *
 * NO intenta parecer inteligente: reconoce palabras clave. La inteligencia vive
 * en el servicio ChatbotRAG (adaptador `live`); el mock prueba el recorrido, el
 * contrato y las reglas de la interfaz, no la calidad de las respuestas.
 */
import { ACLARACION_COBERTURAS } from "@/domain/textos-aclaraciones";
import { INFORMACION_RELEVANTE } from "@/domain/textos-plan";
import { formatearGuaranies, ID_VERSION_OFERTA, NOMBRE_PRODUCTO, ORDEN_PLANES, PLANES, PRODUCTOS } from "@/domain/catalogo";
import { CORREO_RETRACTO_Y_DATOS, INTERSEGUROS } from "@/domain/entidades";
import type { AsistenteProvider, DescripcionAsistente, MensajeAsistente, RespuestaAsistente } from "@/ports/asistente-provider";

const NOMBRE_ASISTENTE = "Terra";

export const BIENVENIDA_MOCK =
  `Hola, soy ${NOMBRE_ASISTENTE}, la asistente virtual de SeguroLoTengo. Puedo explicarte planes, coberturas, ` +
  "carencias y cómo funciona la contratación. No necesito ningún dato personal tuyo: ¿en qué te ayudo?";

export const DERIVACION_MOCK =
  `Podés escribir a ${CORREO_RETRACTO_Y_DATOS} o acercarte a las oficinas de ${INTERSEGUROS.razonSocial} ` +
  `(${INTERSEGUROS.domicilio}) en horario hábil, y una persona te atiende.`;

export const SIN_RESPALDO_MOCK = "No cuento con información aprobada para responder eso con precisión, y prefiero no adivinar.";

const RESPALDO_CATALOGO = { fuenteId: "planes-premios", titulo: `Planes y premios — ${NOMBRE_PRODUCTO}`, version: ID_VERSION_OFERTA } as const;
const RESPALDO_COBERTURAS = { fuenteId: "coberturas", titulo: ACLARACION_COBERTURAS.titulo, version: ACLARACION_COBERTURAS.version } as const;
const RESPALDO_PROCESO = { fuenteId: "proceso", titulo: "Cómo se contrata en SeguroLoTengo", version: "v1.1" } as const;
const RESPALDO_CONTACTO = { fuenteId: "consultas-contacto", titulo: "Consultas, reclamos y contacto", version: "v1.1" } as const;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function seccion(titulo: string): readonly string[] {
  return ACLARACION_COBERTURAS.secciones.find((s) => s.titulo === titulo)?.parrafos ?? [];
}

function textoPlanes(): string {
  const lineas = ORDEN_PLANES.map((id) => {
    const p = PLANES[id];
    return `${p.nombre}: ${formatearGuaranies(p.premioAnualGs)} al año (IVA incluido); cáncer ${formatearGuaranies(p.indemnizacionCancerGs)}, fallecimiento ${formatearGuaranies(p.muerteCualquierCausaGs)}.`;
  });
  return `Los tres planes del ${NOMBRE_PRODUCTO} tienen las mismas coberturas y cambian las sumas y el premio. ${lineas.join(" ")}`;
}

function responderProductoNoDisponible(nombre: string): RespuestaAsistente {
  return {
    ok: true,
    texto: `${nombre} está anunciado como «próximamente» y todavía no se contrata en línea; no tiene planes, coberturas ni precios publicados. Podés dejar tu interés con Interseguros o consultar el ${NOMBRE_PRODUCTO}, que sí está disponible.`,
    respaldo: [RESPALDO_CONTACTO],
    avisos: [],
    derivacion: false,
  };
}

export function crearAsistenteProviderMock(): AsistenteProvider {
  return {
    nombre: "mock",
    async describir(): Promise<DescripcionAsistente> {
      return {
        nombreAsistente: NOMBRE_ASISTENTE,
        perfilPorDefecto: "VIDA_ONCOLOGICO",
        perfiles: PRODUCTOS.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          bienvenida: p.disponible ? BIENVENIDA_MOCK : `Hola, soy ${NOMBRE_ASISTENTE}. ${p.nombre} todavía no se contrata en línea; puedo contarte cómo dejar tu interés o informarte sobre el ${NOMBRE_PRODUCTO}.`,
        })),
        bienvenida: BIENVENIDA_MOCK,
      };
    },
    async responder(mensaje: MensajeAsistente): Promise<RespuestaAsistente> {
      const producto = PRODUCTOS.find((p) => p.id === (mensaje.perfilId ?? "VIDA_ONCOLOGICO"));
      if (!producto) return { ok: false, motivo: "PERFIL_DESCONOCIDO" };
      const n = normalizar(mensaje.texto);

      if (/\b(asesor|persona|humano|operador|alguien)\b/.test(n) && /\b(hablar|contactar|comunicar|quiero)\b/.test(n)) {
        return { ok: true, texto: `Con gusto. ${DERIVACION_MOCK}`, respaldo: [RESPALDO_CONTACTO], avisos: [], derivacion: true };
      }
      if (/\b(reclam|queja|denunci|superintendencia)\w*/.test(n)) {
        return {
          ok: true,
          texto: `Los reclamos sobre la póliza y la cobertura los atiende Alianza Garantía Seguros y Reaseguros S.A.; la asistencia sobre la contratación, Interseguros S.A. ${DERIVACION_MOCK} Si la respuesta no te satisface, podés recurrir a la Superintendencia de Seguros del Banco Central del Paraguay.`,
          respaldo: [RESPALDO_CONTACTO],
          avisos: [],
          derivacion: false,
        };
      }
      if (!producto.disponible) return responderProductoNoDisponible(producto.nombre);

      if (/\b(precio|premio|cuesta|cuestan|vale|valor|cuanto|planes?|confio)\b/.test(n)) {
        return { ok: true, texto: textoPlanes(), respaldo: [RESPALDO_CATALOGO], avisos: [], derivacion: false };
      }
      if (/\bcarencia/.test(n)) {
        return { ok: true, texto: seccion("Períodos de carencia").join(" "), respaldo: [RESPALDO_COBERTURAS], avisos: [], derivacion: false };
      }
      if (/\bexclu/.test(n)) {
        return { ok: true, texto: seccion("Exclusiones principales").join(" "), respaldo: [RESPALDO_COBERTURAS], avisos: [], derivacion: false };
      }
      if (/\b(edad|anos|años|renovaci)/.test(n)) {
        return { ok: true, texto: seccion("Condiciones de edad y renovación").join(" "), respaldo: [RESPALDO_COBERTURAS], avisos: [], derivacion: false };
      }
      if (/\b(cubre|cobertura|incluye|indemniz|renta|hospital|accidente|fallec|muerte)/.test(n)) {
        return { ok: true, texto: seccion("Coberturas incluidas").join(" "), respaldo: [RESPALDO_COBERTURAS], avisos: [], derivacion: false };
      }
      if (/\b(contrat|proceso|pasos?|firma|pagar|pago|cedula|inscri|como funciona|documentos?)/.test(n)) {
        return {
          ok: true,
          texto:
            "La contratación tiene tres pasos: te inscribís con tu cédula (fotografiás el documento y verificás tu WhatsApp), elegís tu plan y respondés las preguntas de la declaración dentro del sitio, y por último firmás electrónicamente la Solicitud y el FIPF y pagás el premio anual por Bancard. " +
            INFORMACION_RELEVANTE.map((i) => `${i.rotulo}: ${i.detalle}`).join(" "),
          respaldo: [RESPALDO_PROCESO],
          avisos: [],
          derivacion: false,
        };
      }
      return { ok: true, texto: `${SIN_RESPALDO_MOCK} ${DERIVACION_MOCK}`, respaldo: [], avisos: ["sin_respaldo"], derivacion: false };
    },
  };
}
