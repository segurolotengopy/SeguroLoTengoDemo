# Recomendaciones — Onboarding y verificación de identidad (P5)

**Fecha:** 2026-08-10 · **Contexto:** flujo de onboarding SeguroLoTengo (cédula anverso/reverso, autenticidad, prueba de vida, coincidencia facial). Estrategia: AWS Rekognition inicialmente, dejando abierto un proveedor externo (la documentación indica Entrust — confiable pero caro).

Basado en: `docs/ESPECIFICACION_PANTALLAS.md` (P5), `src/ports/identity-provider.ts`, `docs/Tabla de Integraciones externas - Tabla.csv` (ítems 7, 8, 9, 11), `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` (filas 14, 17, 19, 22).

---

## 1. Preservar la arquitectura actual

El puerto `IdentityProvider` con adapters mock y tests de contrato compartidos es la costura correcta: la decisión "Rekognition vs. Entrust" queda encapsulada en un adapter y el dominio no cambia.

- Mantener los **cinco métodos separados** del puerto (frente, dorso, OCR, selfie/liveness, comparación facial): permiten usar **proveedores distintos por capacidad** (p. ej. Rekognition para liveness/face match + otro solo para autenticidad documental).
- Agregar un factory por variable de entorno: `IDENTITY_PROVIDER=mock|rekognition|externo`.
- Los mismos tests de contrato deben correr contra cada adapter real.

## 2. Qué cubre AWS Rekognition y qué NO

| Requisito P5 | ¿AWS lo resuelve? | Con qué |
|---|---|---|
| Prueba de vida (selfie) | ✅ Sí | Rekognition **Face Liveness** (~US$0,015/chequeo) |
| Coincidencia facial | ✅ Sí | **CompareFaces** (~US$0,001) |
| Calidad de imagen | ⚠️ Parcial | DetectFaces para el rostro; heurística propia para el documento (blur/reflejo) |
| OCR de la cédula | ⚠️ Parcial | Rekognition no hace OCR. **Textract AnalyzeID está entrenado para documentos de EE.UU.** → usar Textract genérico (`DetectDocumentText`) + parsing propio + MRZ del dorso |
| **Autenticidad del documento** | ❌ **No** | AWS no tiene servicio de autenticidad documental (hologramas, tipografía adulterada, foto-de-pantalla, plantillas falsas) |

**La brecha crítica es la autenticidad documental.** El ítem 7 de la tabla de integraciones la exige explícitamente y es lo que un auditor mirará bajo Res. SEPRELAD 71/19, arts. 25–26 y 29(b) (filas 14 y 22 de la matriz). Rekognition solo nunca la cubre.

## 3. Cerrar la brecha de autenticidad — tres niveles

1. **Piloto (solo AWS + código propio):** dígitos verificadores del MRZ (cédula nueva, formato TD1), consistencia cruzada frente ↔ dorso ↔ MRZ, vigencia del documento, captura **exclusivamente desde cámara** (nunca upload de archivo). Defendible para demo/piloto, no para producción plena.
2. **Fuente oficial:** el ítem 9 ya prevé "eventual fuente oficial autorizada". Un convenio con el Dpto. de Identificaciones convertiría la autenticidad en cruce contra registro — la validación más fuerte posible en Paraguay. **Iniciar la gestión ya: es lenta.**
3. **Proveedor especializado solo para el documento:** Regula licencia su SDK de análisis documental (soporta documentos paraguayos) y puede correr **en infraestructura propia AWS** — buen encaje con la evidencia inmutable y la Ley 7593/2025, sin pagar el paquete KYC completo.

## 4. Estrategia de proveedor externo (Entrust vs. alternativas)

- **Entrust (ex Onfido):** ~US$2–3+ por verificación con mínimos anuales. Confiable, pero caro frente a ~US$0,02–0,05 por intento con Rekognition+Textract (sin mínimos).
- **Sumsub** ya figura como ALTERNATIVA (ítem 11) a ~US$1–1,35/chequeo y unifica KYC + screening PEP/sanciones → podría reemplazar también a ComplyAdvantage (ítem 10) y reducir dos contratos a uno. Probablemente mejor relación confiabilidad/precio que Entrust para producción.
- **Didit** declara soporte de documentos paraguayos con precios agresivos — candidato para el RFP, verificando madurez.
- **Criterio de decisión:** no el precio de lista sino la **tasa de aprobación con cédulas reales** — el piloto del ítem 9 (formato nuevo, formato anterior y cédula de residente). El formato anterior sin MRZ es donde el OCR propio más sufrirá.

**Recomendación:** Rekognition para demo y piloto; RFP corto Sumsub vs. Entrust vs. Regula para producción, decidido por el piloto de tres formatos.

## 5. Notas técnicas para el adapter Rekognition

- **Face Liveness requiere `FaceLivenessDetector` de Amplify UI** en el frontend (streaming, no API de foto simple) y opera en regiones limitadas (típicamente `us-east-1`) → declarar transferencia internacional de datos biométricos en el aviso de privacidad.
- Usar la **audit image de la sesión de liveness** como entrada de CompareFaces: ata criptográficamente prueba de vida y comparación.
- Umbrales sugeridos: similitud CompareFaces ≥ 90 (95 para assurance alto); confianza de liveness ≥ 80–85.
- Guardar en el registro de evidencia: **score crudo + umbral vigente + versión de API/modelo** → hace auditable la decisión ante SEPRELAD y permite comparar proveedores después.
- Activar la **política de opt-out de servicios de IA de AWS** a nivel organización (que las imágenes no se usen para mejorar los servicios): obligatorio de facto con datos biométricos bajo Ley 7593/2025.
- Pre-chequeo de calidad en el cliente (blur/reflejo/encuadre) antes de llamar al backend: ahorra llamadas y mejora conversión.

## 6. Ajuste de flujo sugerido

La regla actual de P5 ("si falla, repetir captura; si persiste, no continúa digitalmente") es correcta para impedir edición manual del OCR, pero deja al cliente con fallo persistente **sin expediente de salida**. Sugerencia: tras N intentos fallidos (p. ej. 3), derivar a un caso de revisión manual tipo Pantalla A (número de caso propio, evidencia conservada, contacto humano). Consistente con la consola administrativa y con la fila 19 de la matriz (derivación sin rechazo automático).

## Resumen ejecutivo

1. Rekognition + Textract + MRZ propio para demo/piloto: costo despreciable, control total, el puerto ya lo soporta.
2. Gestión temprana del convenio con fuente oficial (Identificaciones).
3. RFP corto Sumsub vs. Entrust vs. Regula para producción, decidido por tasa de aprobación real con los tres formatos de cédula.
4. La autenticidad documental es la brecha que ningún plan puede ignorar: AWS no la resuelve — hace falta fuente oficial o proveedor especializado.

---

### Fuentes

- [Amazon Rekognition pricing](https://aws.amazon.com/rekognition/pricing/)
- [Amazon Rekognition Face Liveness — AI Service Card](https://aws.amazon.com/ai/responsible-ai/resources/rekognition-face-liveness/)
- [Textract AnalyzeID — documentos soportados](https://docs.aws.amazon.com/textract/latest/dg/how-it-works-identity.html)
- [Comparativa de precios Sumsub / Onfido / Jumio / Veriff](https://tech-insider.org/igt-sumsub-vs-onfido-vs-jumio-vs-veriff-for-igaming-kyc-202-en-d169/)
- [Didit — soporte Paraguay](https://didit.me/solutions/countries/paraguay/)
- [Ley 7593/2025 de Protección de Datos Personales](https://www.bacn.gov.py/leyes-paraguayas/12924/ley-n-7593-2025-de-protecci-n-de-datos-personales-en-la-rep-blica-del-paraguay)
