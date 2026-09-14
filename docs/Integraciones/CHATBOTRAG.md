# ChatbotRAG — asistente conversacional (Terra) · ítem 35

Servicio propio de AAB1 (repositorio `segurolotengopy/ChatbotRAG`), agnóstico de nube y de canal, que atiende al asistente informativo del sitio. Este documento describe **lo que este repositorio consume**; la arquitectura del servicio está en `docs/ARQUITECTURA.md` de aquel repo.

## Qué hace y qué no

| Sí responde (con respaldo documental) | No responde ni procesa |
| :-- | :-- |
| Planes, premios, coberturas y sumas aseguradas del producto elegido | Elegibilidad, aceptación o cobertura de un caso particular |
| Carencias, exclusiones, edades, beneficiarios | Diagnósticos, pronósticos o interpretación médica |
| Cómo funciona la contratación, el pago, la firma y la entrega documental | Promesas de indemnización o decisiones de siniestros |
| Procedimiento de consultas y reclamos, canales de atención | Cédula, salud, PEP, tarjetas, códigos de verificación (se bloquean antes del modelo) |
| Orientación general sobre qué plan mirar primero (regla configurada, no el modelo) | Contratar, cobrar, firmar, emitir o modificar pólizas |

Sin respaldo documental suficiente el servicio **no inventa**: responde el mensaje fijo de «sin respaldo» y deriva a Interseguros.

## Contrato consumido

```
GET  /v1/agente                                    → { ok, agente:{nombreAsistente…}, perfilPorDefecto, perfiles:[{id,nombre,bienvenida}], bienvenida }
POST /v1/conversaciones/{conversacionId}/mensajes  → { ok, texto, respaldo:[{fuenteId,titulo,version,puntaje}], avisos:[…], derivacion, recomendacion, uso }
      cuerpo: { perfilId, texto, canal:"web" }
```

Autenticación `Authorization: Bearer <clave>`; el agente que atiende lo decide el servicio a partir de la clave. Errores: 400 forma, 401 clave, 404 perfil, 413 texto largo, 429 límite, 5xx no disponible.

El `perfilId` es el `id` del producto en `PRODUCTOS` (`src/domain/catalogo.ts`): `VIDA_ONCOLOGICO`, `VIDA`, `ACCIDENTES_PERSONALES`, `RESPONSABILIDAD_CIVIL`. En el servicio cada perfil tiene su corpus, su alcance y su orientación (`configuraciones/segurolotengo.json` de aquel repo).

## Dónde vive en este repositorio

| Pieza | Archivo |
| :-- | :-- |
| Puerto | `src/ports/asistente-provider.ts` |
| Caso de uso y filtro local de datos sensibles (regla #7) | `src/domain/asistente.ts` |
| Adaptador simulado (responde desde `catalogo.ts`) | `src/adapters/mock/asistente-provider.ts` |
| Adaptador oficial (cliente HTTP) | `src/adapters/live/asistente-chatbotrag.ts` |
| Selección mock/live | `obtenerAsistenteProvider()` en `src/adapters/registro.ts` (`INTEGRATION_ASISTENTE`) |
| Rutas | `src/app/api/asistente/agente/route.ts`, `src/app/api/asistente/mensaje/route.ts` |
| Límite por IP | `LIMITE_ASISTENTE` (30 mensajes / 10 min) en `src/domain/rate-limit.ts` |
| Widget | `src/components/shared/ChatFlotante.tsx`, montado en `src/app/layout.tsx` |
| Contrato compartido mock/live | `src/ports/__tests__/asistente-provider.contract.ts` |

## Variables y secretos

| Nombre | Dónde | Efecto |
| :-- | :-- | :-- |
| `ASISTENTE_ENABLED` | entorno (Amplify) | `"true"` monta el widget y abre las rutas; ausente → 404 |
| `INTEGRATION_ASISTENTE` | entorno | `mock` (por defecto) o `live` |
| `CHATBOTRAG_URL` | entorno | origen del servicio (no es credencial) |
| `CHATBOTRAG_TOKEN` | Secrets Manager `slt-demo-app-secrets` | bearer del cliente `segurolotengo-web` del servicio |

## Corpus aprobado

El corpus del perfil `VIDA_ONCOLOGICO` se derivó de los textos versionados de este repositorio: `catalogo.ts` (OFERTA-CONFIO-v2), `ACLARACION_COBERTURAS` v1.0, `ACLARACION_TERMINOS_CONDICIONES` v1.1, `ACLARACION_DOCUMENTACION_PRECONTRACTUAL` v1.1, `aclaracionConsultasReclamos` v1.1, `entidades.ts` y `textos-legales.ts`. **Cuando uno de esos textos cambie de versión, hay que actualizar el archivo correspondiente en `configuraciones/corpus/segurolotengo/` del servicio**: el asistente cita la versión que tiene cargada.

## Lo que el widget no hace

No usa cookies ni `localStorage` (el aviso de cookies sigue siendo verdad), no se muestra en `/identidad`, `/declaraciones`, `/pago`, `/firma`, `/pago-y-firma` ni `/whatsapp`, y no escribe evidencia: la conversación no es un hecho del expediente.
