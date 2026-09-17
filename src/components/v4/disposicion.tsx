/**
 * Disposición de escritorio del flujo v4 (D-30).
 *
 * Los 103 artes del handoff son de celular (390 px). D-30 decide que la web
 * es **mobile-first y que en anchos de escritorio los componentes van lado a
 * lado**, «sin cambiar orden, textos ni jerarquía». Este módulo es la única
 * forma en que una pantalla v4 se ensancha: cuatro piezas que en celular no
 * hacen nada (apilan en el mismo orden del arte) y desde `lg` (1024 px)
 * reparten el ancho.
 *
 * ## Las reglas de UX que encierra
 *
 * - **Dos columnas, no una columna ancha.** Un formulario estirado a 1 100 px
 *   es peor que uno angosto: el ojo pierde la línea. La columna de contexto
 *   (título, ilustración, plan, avisos que no cambian) va a la izquierda,
 *   fija mientras se hace scroll; la de acción (campos, tarjetas, botón) a la
 *   derecha, con ancho de lectura. El orden del DOM es el del arte, así que
 *   lector de pantalla y celular ven exactamente lo mismo que antes.
 * - **Largo de línea de lectura.** Los párrafos dentro de la columna de
 *   acción se limitan a ~65 caracteres (`max-w-prose`): más largo cansa,
 *   más corto fragmenta.
 * - **Rejillas para lo que es lista de iguales.** Catálogo, planes, capturas,
 *   medios de pago, documentos: tarjetas del mismo peso van en dos o tres
 *   columnas en vez de una pila de un metro.
 * - **Campos en dos columnas solo cuando son cortos y hermanos** (nombre y
 *   apellido, país y ciudad). Los largos (dirección, correo) ocupan la fila
 *   entera: `CamposV4` recibe qué campo se extiende.
 * - **La acción principal no se estira**: en escritorio el botón mantiene un
 *   ancho de botón (no de banner) y queda alineado con la columna de acción,
 *   donde termina la lectura.
 *
 * Nada de esto agrega texto ni cambia un literal: es solo disposición.
 */
import { Children } from "react";
import type { ReactNode } from "react";

/** Punto de quiebre a partir del cual los componentes van lado a lado. */
export const QUIEBRE_ESCRITORIO = "lg";

export interface EncabezadoV4Props {
  /** Primera línea del titular, en navy. */
  readonly titulo: ReactNode;
  /** Segunda línea del titular, en rojo (`<em>` del arte). */
  readonly acento?: ReactNode;
  readonly bajada?: ReactNode;
  /** Ilustración del arte, a la derecha del titular. */
  readonly ilustracion?: ReactNode;
  readonly className?: string;
}

/**
 * El bloque «titular + bajada + ilustración» que abre cada pantalla del arte.
 * Idéntico al que las pantallas escribían a mano; centralizado para que la
 * columna de contexto de escritorio lo reciba sin repetir el markup.
 */
export function EncabezadoV4({ titulo, acento, bajada, ilustracion, className = "" }: EncabezadoV4Props) {
  // Celular: titular e ilustración lado a lado (arte). Escritorio: la columna
  // de contexto mide 20 rem y compartirla con la ilustración partía el titular
  // en cuatro renglones; la ilustración baja debajo del texto y el titular
  // recupera el ancho de la columna. Mismo DOM, mismo orden.
  return (
    <div className={`flex items-start gap-2 lg:flex-col lg:gap-4 ${className}`}>
      <div className="min-w-0 flex-1 lg:w-full">
        <h1 className="v4-titular">
          {titulo}
          {acento ? (
            <>
              <br />
              <em>{acento}</em>
            </>
          ) : null}
        </h1>
        {bajada ? <p className="v4-bajada mt-2">{bajada}</p> : null}
      </div>
      {ilustracion ? <div className="shrink-0">{ilustracion}</div> : null}
    </div>
  );
}

export interface DisposicionV4Props {
  /**
   * Columna de contexto: encabezado, barra del plan y los avisos que no
   * cambian con lo que la persona hace. En celular va primero, como en el
   * arte; en escritorio queda a la izquierda y **fija** al hacer scroll.
   */
  readonly contexto: ReactNode;
  /** Columna de acción: campos, tarjetas, errores y el botón de continuar. */
  readonly children: ReactNode;
  /**
   * Proporción de la columna de contexto en escritorio. `angosta` para
   * pantallas de formulario (el contexto es solo el título); `media` cuando
   * el contexto lleva avisos largos (04E, 05A) y merece más ancho.
   */
  readonly contexto_ancho?: "angosta" | "media";
  readonly className?: string;
}

/**
 * Dos columnas desde `lg`; una pila en celular. La columna de contexto es
 * `sticky` para que el título y el plan sigan a la vista mientras se
 * completa un formulario largo — es el mismo motivo por el que el arte los
 * pone arriba de todo.
 */
export function DisposicionV4({ contexto, children, contexto_ancho = "angosta", className = "" }: DisposicionV4Props) {
  const columnas =
    contexto_ancho === "media"
      ? "lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]"
      : "lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]";
  return (
    <div className={`lg:grid lg:items-start lg:gap-x-10 xl:gap-x-14 ${columnas} ${className}`}>
      <div className="lg:sticky lg:top-6">{contexto}</div>
      {/* 48 rem: lo que queda del lienzo de 72 rem tras la columna de contexto
          y el espacio entre columnas. Tres tarjetas en una fila caben con
          ~15 rem cada una; el texto corrido se acota aparte con `ProsaV4`. */}
      <div className="min-w-0 lg:max-w-[48rem]">{children}</div>
    </div>
  );
}

export interface RejillaV4Props {
  /** Columnas en escritorio (`lg`). En `sm` siempre son dos; en celular, una. */
  readonly columnas?: 2 | 3;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Lista de tarjetas iguales (catálogo, planes, capturas, medios de pago,
 * documentos): una columna en celular —como el arte—, dos desde `sm` y las
 * que se pidan desde `lg`. `items-stretch` para que las tarjetas de una fila
 * midan lo mismo aunque una tenga una línea más.
 */
export function RejillaV4({ columnas = 3, children, className = "" }: RejillaV4Props) {
  const enEscritorio = columnas === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";
  return <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${enEscritorio} ${className}`}>{children}</div>;
}

export interface CamposV4Props {
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Rejilla de campos de formulario: una columna en celular, dos desde `md`.
 * Un campo largo se extiende a la fila entera envolviéndolo en
 * `<CampoAnchoV4>`; los cortos y hermanos (nombres / apellidos, país / ciudad)
 * quedan lado a lado. El orden de tabulación es el del DOM, que es el del
 * arte.
 */
export function CamposV4({ children, className = "" }: CamposV4Props) {
  return <div className={`grid grid-cols-1 gap-x-4 md:grid-cols-2 ${className}`}>{children}</div>;
}

/** Un campo que ocupa la fila entera dentro de `CamposV4`. */
export function CampoAnchoV4({ children, className = "" }: CamposV4Props) {
  return <div className={`md:col-span-2 ${className}`}>{children}</div>;
}

export interface AccionesV4Props {
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Fila del botón de continuar (y, si hay, el secundario al lado). En celular
 * el botón ocupa todo el ancho, como en el arte; en escritorio conserva un
 * ancho de botón y se alinea al final de la columna de acción, que es donde
 * termina la lectura.
 */
export function AccionesV4({ children, className = "" }: AccionesV4Props) {
  // Cada acción va en un envoltorio propio: el botón v4 mide el 100 % de su
  // contenedor, así que el ancho «de botón» de escritorio se le da al
  // envoltorio (auto, con un mínimo), no al botón.
  return (
    <div className={`flex flex-col gap-3 lg:flex-row-reverse lg:items-center lg:justify-start ${className}`}>
      {Children.map(children, (hijo) =>
        hijo === null || hijo === undefined || hijo === false ? null : (
          <div className="w-full lg:w-auto lg:min-w-[16rem]">{hijo}</div>
        ),
      )}
    </div>
  );
}

/** Contenedor de texto corrido con largo de línea de lectura (~65 caracteres). */
export function ProsaV4({ children, className = "" }: AccionesV4Props) {
  return <div className={`max-w-prose ${className}`}>{children}</div>;
}
