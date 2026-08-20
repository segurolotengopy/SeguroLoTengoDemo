import type { Metadata } from "next";
import Link from "next/link";
import { sufijoTitulo } from "@/domain/entidades";
import {
  interpretarCodigo,
  verificarDocumento,
} from "@/domain/verificacion-documento";
import type { DocumentoVerificado, ResultadoVerificacion } from "@/domain/verificacion-documento";
import {
  ALCANCE_VERIFICACION,
  AVISO_SIN_DATOS_PERSONALES,
  LEYENDA_FIRMA_PENDIENTE,
  LEYENDA_VIGENCIA_DECLARADA,
  MOTIVOS_NO_VERIFICABLE,
  ROTULO_CODIGO,
  ROTULO_CORRELATIVO,
  ROTULO_FIN_VIGENCIA,
  ROTULO_HUELLA,
  ROTULO_INICIO_VIGENCIA,
  ROTULO_MODALIDAD_FIRMA,
  ROTULO_NIVEL_FIRMA,
  ROTULO_SELLO_DE_TIEMPO,
  ROTULO_TIPO_DOCUMENTO,
  ROTULO_VERSION,
  ROTULO_VINCULADO,
  ROTULO_VOLVER_AL_INICIO,
  TITULO_DOCUMENTO_VERIFICADO,
  TITULO_FIRMANTES,
  TITULO_NO_VERIFICADO,
  TITULO_VERIFICACION,
  TITULO_VIGENCIA,
} from "@/domain/textos-verificacion";
import { crearExpedienteRepository } from "@/repositories";
import { BuscadorDeCodigo } from "../BuscadorDeCodigo";
import { ComparadorDeHuella } from "../ComparadorDeHuella";

/**
 * `/verificar/<código>` — el destino del QR de cada documento (CMP-06).
 *
 * **Pública, sin sesión y sin ningún dato de la persona.** El código va impreso
 * en un PDF que se reenvía, así que cualquiera que lo tenga abre esta página;
 * lo que se responde son hechos del documento —huella, versión, sello de
 * tiempo, firmantes— y nunca de su titular (regla inviolable #7). El criterio
 * completo está en el encabezado de `src/domain/verificacion-documento.ts`.
 *
 * **No deja evidencia por ahora, y es deliberado.** Cada visita a una URL
 * pública sería una escritura no autenticada sobre la partición del
 * expediente, amplificable por cualquiera que tenga el código; la matriz pide
 * verificación de autenticidad (CMP-06), no registro de cada consulta. Cuando
 * L6 traiga el rate limiting conviene reevaluarlo.
 *
 * `force-dynamic` porque el resultado depende del estado del expediente en ese
 * momento: un paquete cerrado hoy y firmado mañana verifica distinto.
 */

export const dynamic = "force-dynamic";

interface Props {
  readonly params: Promise<{ readonly codigo: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  const interpretado = interpretarCodigo(decodeURIComponent(codigo));
  return {
    title: `${interpretado?.codigo ?? TITULO_VERIFICACION} · ${sufijoTitulo()}`,
    // Es la verificación de un documento concreto, no una página de catálogo.
    robots: { index: false, follow: false },
  };
}

async function resolver(codigoCrudo: string): Promise<ResultadoVerificacion> {
  const interpretado = interpretarCodigo(codigoCrudo);
  if (!interpretado) {
    return { ok: false, motivo: "CODIGO_INVALIDO", codigo: codigoCrudo.trim().toUpperCase() };
  }
  // El comprobante no se busca: no tiene huella registrada (D-05) y el dominio
  // responde sin tocar la base.
  if (interpretado.tipo === "COMPROBANTE") return verificarDocumento(null, interpretado);

  const encontrados = await crearExpedienteRepository().buscarPorNumeroPropuesta(
    interpretado.correlativo,
  );
  return verificarDocumento(encontrados[0] ?? null, interpretado);
}

function Dato({ rotulo, valor, mono = false }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-bold tracking-wide text-etiqueta uppercase">{rotulo}</dt>
      <dd
        className={`text-sm font-semibold text-titulo ${mono ? "font-mono text-xs break-all" : ""}`}
      >
        {valor}
      </dd>
    </div>
  );
}

function Verificado({ documento }: { documento: DocumentoVerificado }) {
  return (
    <>
      <header className="flex flex-col gap-2 rounded-lg border border-verde-300 bg-verde-50 p-4 dark:border-verde-700 dark:bg-verde-950">
        <h1 className="text-xl font-bold text-verde-900 sm:text-2xl dark:text-verde-100">
          ✓ {TITULO_DOCUMENTO_VERIFICADO}
        </h1>
        <p className="text-sm text-verde-900 dark:text-verde-100">{documento.titulo}</p>
        <p className="text-sm text-verde-900 dark:text-verde-100">{ALCANCE_VERIFICACION}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Dato rotulo={ROTULO_CODIGO} valor={documento.codigo} mono />
          <Dato rotulo={ROTULO_TIPO_DOCUMENTO} valor={documento.titulo} />
          <Dato rotulo={ROTULO_CORRELATIVO} valor={documento.correlativo} mono />
          <Dato rotulo={ROTULO_VERSION} valor={String(documento.version)} />
          <Dato rotulo={ROTULO_SELLO_DE_TIEMPO} valor={documento.selloDeTiempo} />
          <Dato rotulo={ROTULO_VINCULADO} valor={documento.codigoVinculado} mono />
        </dl>
        <div className="border-t border-borde-tenue pt-3">
          <Dato rotulo={ROTULO_HUELLA} valor={documento.hashSha256} mono />
        </div>
      </section>

      {documento.vigencia ? (
        <section
          aria-labelledby="verificar-vigencia"
          className="flex flex-col gap-2 rounded-lg border border-naranja-300 bg-naranja-50 p-4 dark:border-naranja-700 dark:bg-naranja-950"
        >
          <h2
            id="verificar-vigencia"
            className="text-xs font-bold tracking-wide text-naranja-900 uppercase dark:text-naranja-100"
          >
            {TITULO_VIGENCIA}
          </h2>
          <p className="text-sm font-bold text-naranja-900 tabular-nums dark:text-naranja-100">
            {ROTULO_INICIO_VIGENCIA} {documento.vigencia.inicio} · {ROTULO_FIN_VIGENCIA}{" "}
            {documento.vigencia.fin}
          </p>
          {/* Que el certificado sea auténtico no dice que la cobertura esté
              vigente hoy: son dos preguntas distintas y esta página responde
              una sola. */}
          <p className="text-xs text-naranja-900 dark:text-naranja-100">
            {LEYENDA_VIGENCIA_DECLARADA}
          </p>
        </section>
      ) : null}

      <section
        aria-labelledby="verificar-firmas"
        className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-4"
      >
        <h2
          id="verificar-firmas"
          className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
        >
          {TITULO_FIRMANTES}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {documento.firmantes.map((firmante) => (
            <li
              key={firmante.rol}
              className="flex flex-col gap-0.5 rounded-lg border border-borde-tenue bg-superficie-suave p-3"
            >
              <span className="text-sm font-bold text-titulo">{firmante.rotulo}</span>
              <span className="text-xs text-cuerpo">
                {ROTULO_NIVEL_FIRMA[firmante.nivel] ?? firmante.nivel} ·{" "}
                {ROTULO_MODALIDAD_FIRMA[firmante.modalidad] ?? firmante.modalidad}
              </span>
              <span className="text-xs text-etiqueta tabular-nums">
                {firmante.aplicadaEn ?? LEYENDA_FIRMA_PENDIENTE}
              </span>
              {firmante.certificado ? (
                <span className="font-mono text-[11px] break-all text-etiqueta">
                  {firmante.certificado}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <ComparadorDeHuella huellaEsperada={documento.hashSha256} />
    </>
  );
}

function NoVerificado({ motivo, codigo }: { motivo: string; codigo: string }) {
  return (
    <>
      <header className="flex flex-col gap-2 rounded-lg border border-naranja-300 bg-naranja-50 p-4 dark:border-naranja-700 dark:bg-naranja-950">
        <h1 className="text-xl font-bold text-naranja-900 sm:text-2xl dark:text-naranja-100">
          {TITULO_NO_VERIFICADO}
        </h1>
        <p className="font-mono text-sm text-naranja-900 dark:text-naranja-100">{codigo}</p>
        <p className="text-sm text-naranja-900 dark:text-naranja-100">
          {MOTIVOS_NO_VERIFICABLE[motivo] ?? MOTIVOS_NO_VERIFICABLE.CODIGO_INVALIDO}
        </p>
      </header>

      {/* El buscador vuelve a aparecer con el código a la vista: quien se
          equivocó al tipear lo corrige acá, sin volver atrás. */}
      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <BuscadorDeCodigo inicial={codigo} />
      </section>
    </>
  );
}

export default async function PantallaVerificacionDeCodigo({ params }: Props) {
  const { codigo } = await params;
  const resultado = await resolver(decodeURIComponent(codigo));

  return (
    <>
      {resultado.ok ? (
        <Verificado documento={resultado.documento} />
      ) : (
        <NoVerificado motivo={resultado.motivo} codigo={resultado.codigo} />
      )}

      <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-3">
        <p className="text-xs text-etiqueta">{AVISO_SIN_DATOS_PERSONALES}</p>
        <Link
          href="/"
          className="w-fit text-sm font-semibold text-azul-700 underline underline-offset-2 dark:text-azul-300"
        >
          {ROTULO_VOLVER_AL_INICIO}
        </Link>
      </footer>
    </>
  );
}
