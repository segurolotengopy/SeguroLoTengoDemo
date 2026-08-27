"use client";

/**
 * Prueba de vida real con `FaceLivenessDetector` de AWS Amplify UI
 * (tarjeta 3 de P5, botón `INICIAR VERIFICACIÓN`).
 *
 * **Este archivo es el único que importa Amplify UI, y se carga sólo por
 * `next/dynamic`** desde `SelfieEnVivo.tsx`. No es un detalle de estilo: el
 * chunk pesa ~1,07 MB (289 kB gzip) y, importado estáticamente, entraría en el
 * First Load JS de un producto mobile-first. Diferido, se descarga recién
 * cuando la persona toca el botón —el lugar correcto para una espera— y el
 * First Load de P5 sube 1 kB. La medición está en §7.8 de
 * `docs/RECOMENDACIONES_ONBOARDING_IDENTIDAD.md`.
 *
 * Cómo funciona el flujo, que es distinto al de una foto:
 *
 * 1. El servidor abre la sesión (`POST /api/p5/liveness-sesion`) y devuelve un
 *    `SessionId` de un solo uso y 3 minutos de vigencia.
 * 2. Este componente transmite el video **del navegador directo a Rekognition**.
 *    Los bytes nunca pasan por nuestro backend.
 * 3. Al terminar, avisa con `onAnalysisComplete`. El resultado no lo trae el
 *    componente: lo consulta el servidor por `SessionId`, que es lo único
 *    confiable — un cliente podría decir "aprobé" sin haber hecho nada.
 *
 * Por eso `onAnalysisComplete` no recibe ni pasa ninguna puntuación: solo
 * informa que la sesión terminó y hay que ir a buscar el veredicto.
 */
import { FaceLivenessDetector } from "@aws-amplify/ui-react-liveness";
import { Amplify } from "aws-amplify";
import { useEffect, useState } from "react";

export interface PruebaDeVidaEnVivoProps {
  readonly referenciaSesion: string;
  readonly region: string;
  /** La sesión terminó: el servidor tiene que consultar el resultado. */
  readonly alTerminar: () => void;
  readonly alFallar: (mensaje: string) => void;
  readonly alCancelar: () => void;
}

/**
 * Textos del componente, en voseo, reemplazando los de Amplify (que vienen en
 * inglés). No se traducen todos: solo los que la persona ve durante el chequeo.
 */
const TEXTOS = {
  instructionsHeaderHeadingText: "Prueba de vida",
  instructionsHeaderBodyText:
    "Vas a ver destellos de luz y te vamos a pedir que acerques el rostro. Dura unos segundos.",
  photosensitivityWarningHeadingText: "Aviso de fotosensibilidad",
  photosensitivityWarningBodyText:
    "Esta verificación muestra luces de colores. Tené cuidado si sos fotosensible.",
  goodFitCaptionText: "Bien",
  tooFarCaptionText: "Muy lejos",
  hintCenterFaceText: "Centrá tu rostro",
  hintTooManyFacesText: "Tiene que aparecer un solo rostro",
  hintFaceDetectedText: "Rostro detectado",
  hintCanNotIdentifyText: "Movete al centro de la pantalla",
  hintTooCloseText: "Alejate un poco",
  hintTooFarText: "Acercate",
  hintConnectingText: "Conectando…",
  hintVerifyingText: "Verificando…",
  hintIlluminationTooBrightText: "Buscá un lugar con menos luz",
  hintIlluminationTooDarkText: "Buscá un lugar con más luz",
  hintIlluminationNormalText: "Iluminación correcta",
  hintHoldFaceForFreshnessText: "Quedate quieto",
  startScreenBeginCheckText: "Comenzar la verificación",
  cameraNotFoundHeadingText: "No encontramos la cámara",
  cameraNotFoundMessageText:
    "Revisá que el navegador tenga permiso para usar la cámara y volvé a intentar.",
  retryCameraPermissionsText: "Volver a intentar",
  cancelLivenessCheckText: "Cancelar",
  waitingCameraPermissionText: "Esperando el permiso de la cámara",
} as const;

export default function PruebaDeVidaEnVivo({
  referenciaSesion,
  region,
  alTerminar,
  alFallar,
  alCancelar,
}: PruebaDeVidaEnVivoProps) {
  const [listo, setListo] = useState(false);

  /**
   * Amplify necesita estar configurado antes de montar el detector, y se
   * configura acá y no en el layout raíz por la misma razón por la que el
   * componente se importa en diferido: en modo mock nada de esto se carga.
   *
   * No hay Cognito ni identity pool: la sesión ya viene creada y firmada por
   * nuestro backend, así que el navegador no necesita credenciales de AWS.
   */
  useEffect(() => {
    Amplify.configure({});
    setListo(true);
  }, []);

  if (!listo) {
    return (
      <p className="text-sm text-etiqueta" role="status">
        Preparando la verificación…
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-borde-sutil bg-superficie">
      <FaceLivenessDetector
        sessionId={referenciaSesion}
        region={region}
        onAnalysisComplete={async () => {
          alTerminar();
        }}
        onError={(error) => {
          // El detalle técnico va a la consola del navegador, no a la pantalla:
          // a la persona se le dice qué hacer, no qué falló adentro de AWS.
          console.error("Face Liveness", error);
          alFallar(
            "No pudimos completar la prueba de vida. Revisá la luz y el permiso de la cámara, y volvé a intentar.",
          );
        }}
        onUserCancel={alCancelar}
        displayText={TEXTOS}
      />
    </div>
  );
}
