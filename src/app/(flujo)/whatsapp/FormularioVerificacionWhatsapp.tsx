"use client";

import { useState } from "react";
import { FormularioVerificacionCanal } from "@/components/shared";
import { rutaSiguienteDe } from "@/domain/rutas-flujo";
import { normalizarCelularRegional, paisPorIso, PAISES_CELULAR } from "@/domain/telefono";
// Desde `textos-p1` y no desde el caso de uso: este es un componente de
// cliente, e importar el caso de uso arrastraría `node:crypto` al bundle.
import { TEXTO_AUTORIZACION_P1 } from "@/domain/textos-p1";

/**
 * Formulario de P1 (docs/ESPECIFICACION_PANTALLAS.md → "P1 · Paso 1 de 9").
 *
 * La mecánica es la de `FormularioVerificacionCanal`, compartida con P4; acá
 * viven solo los textos y las rutas de P1, más el selector de país y el
 * checkbox de autorización, que P4 no tiene.
 *
 * El selector ofrece los países de la región desde el 2026-08-14 (decisión de
 * producto para el demo — la especificación original contemplaba solo
 * Paraguay, y su sección de P1 quedó anotada). El número viaja al servidor
 * con el prefijo del país elegido; la validación fina es del dominio
 * (`normalizarCelularRegional`). Envío real hoy: solo +595 y +591
 * (prefijos habilitados de WhatsApp-Modular); el resto funciona en mock.
 */

function SelectorPais(props: { iso: string; onCambio: (iso: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="p1-pais" className="text-xs font-semibold text-etiqueta">
        País
      </label>
      <select
        id="p1-pais"
        value={props.iso}
        onChange={(evento) => props.onCambio(evento.target.value)}
        className="h-11 rounded-lg border border-borde-sutil bg-superficie px-3 text-sm font-semibold text-titulo"
      >
        {PAISES_CELULAR.map((pais) => (
          <option key={pais.iso} value={pais.iso}>
            {pais.nombre} {pais.prefijo}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FormularioVerificacionWhatsapp(props: {
  /**
   * Número de pruebas de Meta al que la persona debe escribir ANTES de pedir
   * el código, o `null` fuera del canal real. Lo resuelve el servidor
   * (page.tsx) según `INTEGRATION_OTP` y `WHATSAPP_NUMERO_PRUEBA`: es una
   * condición operativa de la fase de pruebas (modo interino
   * `template_header` + destinatarios registrados), no parte de la
   * especificación de P1 — desaparece sola cuando el flag se apaga.
   */
  numeroPruebaWhatsApp?: string | null;
}) {
  const [isoPais, setIsoPais] = useState("PY");
  const pais = paisPorIso(isoPais) ?? PAISES_CELULAR[0];

  const avisoPaso1 = props.numeroPruebaWhatsApp ? (
    <div className="rounded-lg border border-azul-200 bg-azul-50 p-3 text-sm text-cuerpo dark:border-azul-700 dark:bg-azul-950">
      <p className="font-semibold text-azul-800 dark:text-azul-200">
        Fase de pruebas: primero iniciá vos la conversación.
      </p>
      <p>
        Antes de pedir el código, mandá un mensaje por WhatsApp (un «hola» alcanza) al número de
        pruebas <span className="font-bold whitespace-nowrap">{props.numeroPruebaWhatsApp}</span>.
        Así el código te llega sin demoras. Solo reciben códigos los celulares registrados como
        destinatarios de prueba.
      </p>
    </div>
  ) : null;

  const mensajes: Readonly<Record<string, string>> = {
    AUTORIZACION_REQUERIDA: "Necesitás autorizar el uso del número para continuar.",
    DESTINO_INVALIDO: `Revisá el número: tiene que ser un celular válido de ${pais.nombre}, por ejemplo ${pais.ejemplo}.`,
    PROPOSITO_INCORRECTO: "Ese código no sirve para verificar el WhatsApp.",
    // Dice qué hacer, no qué pasó: el botón de reencaminado aparece debajo con
    // el paso exacto donde quedó el trámite.
    ESTADO_INVALIDO: "Ya empezaste este trámite y avanzaste más allá de este paso. Podés seguir desde donde quedaste.",
    SESION_INVALIDA: "Se perdió la sesión. Volvé a ingresar tu número.",
  };

  return (
    <FormularioVerificacionCanal
      idPrefijo="p1"
      rutas={{
        enviar: "/api/p1/otp/enviar",
        reenviar: "/api/p1/otp/reenviar",
        verificar: "/api/p1/otp/verificar",
      }}
      campoDestino="numero"
      paso1Titulo="Paso 1 — Ingresá tu número"
      etiquetaDestino="Número de WhatsApp"
      placeholderDestino={`Ej.: ${pais.ejemplo}`}
      tipoCampo="tel"
      autoCompleteCampo="tel-national"
      prefijoCampo={<SelectorPais iso={isoPais} onCambio={setIsoPais} />}
      avisoPaso1={avisoPaso1}
      textoAutorizacion={TEXTO_AUTORIZACION_P1}
      botonEnviar="Enviar código"
      paso2Titulo="Paso 2 — Ingresá el código recibido"
      etiquetaCodigo="Código de verificación de WhatsApp"
      botonVerificar="Verificar WhatsApp"
      enlaceEditar="Editar número"
      leyendaEnviado={(destino) => `Código enviado al número ${destino}`}
      avisoEnviado="Te enviamos un código por WhatsApp."
      avisoReenviado="Te enviamos un código nuevo. El anterior dejó de servir."
      avisoVerificado="WhatsApp verificado."
      mensajes={mensajes}
      validarDestino={(valor) => normalizarCelularRegional(`${pais.prefijo} ${valor}`).ok}
      componerDestino={(valor) => `${pais.prefijo} ${valor}`}
      // CHG-09 · advertencia de seguridad reforzada (reunión 18-ago-2026,
      // 00:08:16). Las dos precisiones nuevas nacen de un susto real: al
      // recibir el código de la prueba, Rodrigo pudo leerlo como un intento de
      // secuestro de su cuenta. Decir que nadie te va a llamar no alcanza si
      // la persona cree que el mensaje es de WhatsApp y no nuestro.
      advertencias={
        <>
          <p className="font-semibold text-titulo">Nunca compartas este código con terceros.</p>
          <p>
            Ni Interseguros ni Alianza te van a llamar para pedírtelo. Si alguien te lo pide por
            teléfono, cortá: no somos nosotros.
          </p>
          <p>
            <span className="font-semibold text-titulo">
              Este código no es el de seguridad de WhatsApp.
            </span>{" "}
            No sirve para acceder a tu cuenta ni a tus conversaciones: solo confirma que este
            número es tuyo. Si el código es incorrecto o deja de ser válido, te mostramos el
            motivo y podés pedir otro.
          </p>
        </>
      }
      hrefContinuar={rutaSiguienteDe("/whatsapp") ?? "/preparacion"}
      textoContinuar="Continuar →"
      notaContinuar="Se habilita únicamente después de verificar el WhatsApp."
    />
  );
}
