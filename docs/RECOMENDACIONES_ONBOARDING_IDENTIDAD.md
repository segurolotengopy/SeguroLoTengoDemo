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

- **Face Liveness requiere `FaceLivenessDetector` de Amplify UI** en el frontend (streaming, no API de foto simple) y opera en regiones limitadas → ver §7.3, la restricción es más seria de lo que parecía.
- Usar la **audit image de la sesión de liveness** como entrada de CompareFaces: ata criptográficamente prueba de vida y comparación.
- Umbrales: ver §7, que los reemplaza con los valores publicados por AWS. *(Este documento decía antes «≥ 90, 95 para assurance alto» para CompareFaces y «80–85» para liveness; eran estimaciones. Los valores correctos son 99 y 80.)*
- Guardar en el registro de evidencia: **score crudo + umbral vigente + versión de API/modelo** → hace auditable la decisión ante SEPRELAD y permite comparar proveedores después. **Implementado** en `src/domain/identidad-parametros.ts` (`DecisionBiometrica`).
- Activar la **política de opt-out de servicios de IA de AWS** a nivel organización (que las imágenes no se usen para mejorar los servicios): obligatorio de facto con datos biométricos bajo Ley 7593/2025.
- Pre-chequeo de calidad en el cliente (blur/reflejo/encuadre) antes de llamar al backend: ahorra llamadas y mejora conversión.

## 6. Ajuste de flujo sugerido

La regla actual de P5 ("si falla, repetir captura; si persiste, no continúa digitalmente") es correcta para impedir edición manual del OCR, pero deja al cliente con fallo persistente **sin expediente de salida**. Sugerencia: tras N intentos fallidos (p. ej. 3), derivar a un caso de revisión manual tipo Pantalla A (número de caso propio, evidencia conservada, contacto humano). Consistente con la consola administrativa y con la fila 19 de la matriz (derivación sin rechazo automático).

## 7. Parámetros internacionales (agregado 2026-08-13)

Los números de esta sección **no son estimaciones**: salen de la documentación del proveedor y de las normas ISO/ICAO citadas en cada caso. Están implementados y bloqueados por tests en `src/domain/identidad-parametros.ts` — cambiar cualquiera pone la suite en rojo, que es el punto.

### 7.1 Calidad de la imagen del rostro

De AWS, *Face and Liveness Verification for Identity Verification with Amazon Rekognition* (act. 12/03/2024), §3.3.1:

| Parámetro | Valor | Origen |
| :---- | :---- | :---- |
| Yaw (giro horizontal) | −30° a +30° | AWS §3.3.1 |
| Pitch (cabeceo) | −30° a +30° | AWS §3.3.1 |
| **Roll (inclinación lateral)** | **−30° a +30°** | **Agregado nuestro** — AWS no lo acota; ICAO Doc 9303 / ISO/IEC 39794-5 Anexo D1 exigen pose frontal en los tres ejes |
| Sharpness (nitidez) | > 25 | AWS §3.3.1 |
| Brightness (brillo) | > 25 | AWS §3.3.1 |
| `FaceOccluded` | debe ser `false` | AWS §3.3.1 |
| Tamaño del rostro | > 50×50 px | AWS §3.3.1 |

Filtrar por calidad **antes** de comparar no es cosmético: comparar imágenes malas sube falsos rechazos y falsos aceptes a la vez, así que un umbral alto sobre una imagen mala es una garantía falsa.

### 7.2 Umbrales de decisión

| Decisión | Umbral | Justificación |
| :---- | :---- | :---- |
| Coincidencia facial (`CompareFaces.Similarity`) | **99** | AWS §6.1: «95 – regular use cases / 99 – **sensitive** use cases». De esta comparación cuelga la firma de un contrato de seguro de vida y la identificación ante SEPRELAD (fila 14): es sensible. |
| Prueba de vida (`GetFaceLivenessSessionResults.Confidence`) | **80** | AWS §6.1. La doc del servicio ubica 50–60 contra ataques de presentación (foto, pantalla) y 80–90 contra inyección digital (deepfake, video pregrabado) — la amenaza real de un onboarding remoto sin nadie del otro lado. |
| Confianza mínima de OCR por bloque (Textract) | **90** | **Decisión de producto, no de norma.** Los campos quedan bloqueados y no editables, y la fecha de nacimiento alimenta el corte 18–64 (regla inviolable #8). |

Dos condiciones que vienen pegadas al 99 y que es fácil pasar por alto:

1. **AWS exige recortar el rostro con `DetectFaces` antes de comparar** cuando el umbral es ≥ 99. Sin recorte, el fondo y el resto del documento entran en la imagen y bajan la similitud de un par legítimo por debajo del umbral. Está como `RECORTE_ROSTRO_OBLIGATORIO`.
2. **Escala 0–100, no 0–1.** El mock histórico devolvía `0.97`. Un 0,97 comparado contra un umbral de 99 rechaza — que es el lado seguro del error, pero hay que normalizar en el adaptador igual. Hay un test de regresión para esto.

**Anti-abuso de la prueba de vida** (AWS §3.2): máximo 5 chequeos fallidos en 3 minutos desde un mismo dispositivo → bloqueo de 30–60 minutos → tras 3–5 bloqueos repetidos, veto del dispositivo. Es control de fraude (el atacante prueba deepfakes hasta que uno pase) y de costo (cada intento se factura). **No confundir con los límites de OTP de la regla inviolable #1** (3 intentos): son controles distintos sobre canales distintos.

La sesión de liveness (`CreateFaceLivenessSession`) es de **un solo uso y TTL de 3 minutos**, fijado por el proveedor.

### 7.3 Restricción de región — más seria de lo previsto

**Face Liveness solo existe en cinco regiones: `us-east-1`, `us-west-2`, `eu-west-1`, `ap-northeast-1`, `ap-south-1`.** No hay región sudamericana: `sa-east-1` (São Paulo) **no** lo tiene.

Consecuencias, en orden de importancia:

1. **Toda selfie con prueba de vida de un cliente paraguayo sale del continente.** Es transferencia internacional de datos biométricos y hay que declararla en el aviso de privacidad bajo la Ley 7593/2025. No es un detalle de arquitectura, es un texto que el cliente tiene que leer y aceptar en P3 o P5.
2. La **política de opt-out de servicios de IA de AWS** (que las imágenes no se usen para mejorar los servicios) deja de ser recomendable y pasa a ser condición de entrada. Se configura a nivel de AWS Organizations, no de cuenta.
3. Textract sí está en más regiones, pero **tampoco en São Paulo** — misma conversación.

### 7.4 Nueva opción de challenge (julio 2025)

`CreateFaceLivenessSession` acepta desde julio de 2025 dos tipos de desafío:

- **`FaceMovementAndLightChallenge`** — el original: acercar el rostro y quedarse quieto durante destellos de luz. **Máxima precisión**, es el recomendado.
- **`FaceMovementChallenge`** — sin destellos, **3 segundos más rápido**, admite cámara trasera. Prioriza velocidad sobre precisión.

**Recomendación: `FaceMovementAndLightChallenge` como camino principal** (es la decisión de precisión y este es un caso sensible), **con `FaceMovementChallenge` como alternativa ofrecida explícitamente a personas fotosensibles**. Esto además cubre el punto de AWS §3.2 de «ofrecer un camino alternativo a usuarios fotosensibles», que con un solo challenge con destellos quedaba sin resolver. No hay fila en la matriz de cumplimiento que lo exija; es accesibilidad y decisión de producto.

### 7.5 Costo real por verificación

| Servicio | Precio unitario | Por expediente |
| :---- | :---- | :---- |
| Face Liveness | USD 0,015 / chequeo (primeros 500 mil/mes) | 1 chequeo |
| CompareFaces | ~USD 0,001 | 1 comparación |
| DetectFaces (calidad + recorte) | ~USD 0,001 × 2 | frente + selfie |
| Textract `DetectDocumentText` | USD 0,0015 / página | 2 páginas (frente y dorso) |

**≈ USD 0,021 por expediente completo**, sin mínimos ni contrato. Contra USD 2–3 de Entrust y USD 1–1,35 de Sumsub. Con crédito de AWS, el costo del demo es efectivamente cero: mil verificaciones completas son ~USD 21.

### 7.6 MRZ de la cédula — implementado

`src/domain/mrz.ts` lee el formato **TD1 de ICAO Doc 9303** (tres líneas de 30 caracteres) y verifica sus cuatro dígitos verificadores, incluido el compuesto que ata las dos primeras líneas entre sí. El algoritmo está anclado con el **especimen canónico publicado en el Doc 9303 Parte 5** (`ERIKSSON`/`UTO`): si nuestros dígitos coinciden con los de la norma, los pesos y el rango del compuesto son los correctos. Sin ese anclaje, los tests solo probarían que el código coincide consigo mismo.

Encima, `cruzarConMrz` compara lo leído en el frente contra el dorso (número de cédula, fecha de nacimiento, sexo) y verifica vigencia y estado emisor `PRY`. Un frente adulterado sin recalcular dos dígitos verificadores no pasa.

**Límite honesto, que conviene decir en voz alta:** esto verifica *consistencia interna*, no existencia. Un MRZ inventado con dígitos bien calculados pasa. Lo único que supera eso es cruzar contra el registro civil.

### 7.7 Hallazgo nuevo: validación contra el registro civil paraguayo

**Didit expone un servicio `pry_cedula` que valida nombre y número de cédula contra el Departamento de Identificaciones, a USD 0,20 por consulta concluyente**, con latencia de un par de segundos.

Esto cambia el planteo de la §3 de este documento. La brecha de autenticidad documental tenía tres salidas: piloto con código propio (defendible pero flojo), convenio con Identificaciones (la más fuerte, pero lenta) y proveedor documental especializado (Regula). Aparece una cuarta: **cruzar contra la fuente oficial por API, hoy, sin convenio propio y a un costo que no mueve la aguja** — USD 0,20 sobre un expediente de ~USD 0,021 sigue siendo dos órdenes de magnitud menos que Entrust.

No reemplaza al análisis documental (no dice si el plástico es genuino, dice si esa persona con ese número existe en el registro), pero ataca el fraude que más importa acá: contratar con la identidad de otro. **Recomendación: sumarlo al RFP y probarlo en el piloto de tres formatos.** Queda registrado como ítem 33 de `docs/Tabla de Integraciones externas - Tabla.csv`, en estado ALTERNATIVA - A EVALUAR. Conviene verificar de primera mano la fuente y la base legal de esa consulta antes de comprometerlo: es un dato que el proveedor declara, no algo que hayamos confirmado con Identificaciones.

### 7.8 Medición del bundle de Amplify UI (hecha, con resultado)

Face Liveness solo funciona con el componente `FaceLivenessDetector` de Amplify UI — AWS no soporta implementaciones propias del streaming. Se midió antes de adoptarlo:

| Métrica | Resultado |
| :---- | :---- |
| Peso del chunk de liveness | **1,07 MB crudo · 289 kB gzip** |
| Impacto en el First Load JS de P5 | **+1 kB** (124 kB → 125 kB) |
| Impacto en el bundle compartido | +0,17 kB |
| Impacto en las otras once pantallas | ninguno |

**El chunk queda aislado y diferido.** Con `next/dynamic` + `ssr: false`, el megabyte se descarga recién cuando la persona toca `INICIAR VERIFICACIÓN`, no al abrir P5. Es el lugar correcto para un spinner: el usuario ya sabe que va a arrancar una verificación.

**Conclusión: aceptable, con una condición.** El componente entra solo por importación dinámica en la ruta de P5. Si alguien lo importa estáticamente, esos 289 kB pasan al First Load de un producto mobile-first en Paraguay y la medición deja de valer.

**Costo oculto que apareció al medir:** instalar `aws-amplify` **rompe el build**. Arrastra `@smithy/protocol-http@3.3.0`, que depende de `@smithy/types@2.12.0`, y esa segunda copia crea dos identidades de tipo incompatibles que hacen fallar el tipado del SDK de DynamoDB ya instalado (`PutCommand` deja de ser asignable). Se resuelve con un `overrides` en `package.json` fijando `@smithy/types` a una sola versión (`4.17.0` al momento de medir). **No es opcional y hay que dejarlo anotado**, porque el síntoma —un error de tipos en `evidencia-repository.ts`, un archivo que nadie tocó— no se parece en nada a la causa.

La dependencia todavía **no está instalada**: se agrega en la sesión que construya el frontend de P5, junto con el `overrides`.

### 7.9 Lo que no se pudo fijar

- **Especificación oficial del MRZ de la cédula paraguaya.** El Departamento de Identificaciones no publica la especificación técnica. Que la cédula nueva (chip, desde julio de 2023) sea TD1 está inferido de que los lectores comerciales de MRZ la listan como compatible con ICAO 9303, no confirmado contra documentación oficial. **El piloto de tres formatos del ítem 9 tiene que confirmarlo con cédulas reales antes de que esto sea producción.** El código está escrito para que un MRZ ausente o ilegible sea un caso previsto, no una excepción.
- **El formato anterior sin MRZ** no tiene verificación de autenticidad posible con código propio: ahí el cruce contra registro civil (§7.7) deja de ser una mejora y pasa a ser la única defensa.
- **Ni `CompareFaces` ni Face Liveness informan la versión del modelo.** Solo la devuelven las APIs con colección (`IndexFaces`, `SearchFaces`), que este flujo no usa a propósito para no persistir vectores faciales en AWS. La evidencia queda entonces con `versionModeloProveedor: null`, y AWS §6.2 avisa que las APIs sin estado migran de modelo solas: dos expedientes de meses distintos pueden haberse decidido con modelos distintos sin que quede registro. Lo que sí queda sellado es el umbral y la versión de nuestra política. **Es una limitación del proveedor, no un pendiente nuestro**, y conviene tenerla escrita antes de que la pregunte un auditor.

## 8. El puerto `IdentityProvider` no encaja con Face Liveness

Hallazgo de implementación, y hay que resolverlo antes de cablear P5.

El puerto declara `capturarSelfieYPruebaDeVida(expedienteId, video: MediaCapturada)` — bytes de video llegando al backend. **Face Liveness no funciona así:** el video va del navegador directo a Rekognition por el componente de Amplify, y el backend nunca ve los bytes; recibe un `sessionId` y consulta el resultado.

Por eso el trabajo de este tramo quedó como **capacidades componibles** (`src/adapters/live/rekognition-identidad.ts` y `textract-cedula.ts`) y no como un `IdentityProvider` completo: un adaptador que fingiera recibir video sería mentira, y uno que tirara excepción en ese método sería medio adaptador.

Ese reparto además sirve al pedido de **reutilizar el módulo de onboarding en otros proyectos**: las capacidades reciben bytes y devuelven `DecisionBiometrica`, sin saber nada de expedientes ni de cédulas paraguayas. Lo específico de Paraguay está aislado en una sola función (`extraerCamposCedulaParaguaya`).

**Resuelto (2026-08-14).** El puerto acepta `CapturaSelfie`, unión de `{ tipo: "VIDEO", video }` y `{ tipo: "SESION_LIVENESS", referenciaSesion }`. Cada adaptador rechaza explícitamente la variante que no sabe atender —el mock, la sesión; el de AWS, los bytes— en vez de degradar en silencio: comparar una foto suelta y llamarla "prueba de vida" es exactamente lo que este control existe para impedir.

Sobre eso se armó `src/adapters/live/identity-provider.ts`, la pantalla con `FaceLivenessDetector` y `POST /api/p5/liveness-sesion`. La pantalla elige el camino con `soportaSesionPruebaDeVida`, resuelto en el servidor: en modo mock el chunk de Amplify UI no se carga.

Dos cosas que aparecieron al implementarlo y que no eran obvias:

- **Un dorso con MRZ válido es legible por definición**, sin importar la confianza que declare Textract. La fuente OCR-B le baja la confianza al OCR, así que exigir el umbral de 90 en el dorso rechazaba justo los documentos que **sí** traen MRZ. Los dígitos verificadores son prueba más fuerte que un umbral estadístico; el umbral solo decide cuando no hay MRZ (formato anterior).
- **Hace falta leer las dimensiones de la imagen** (`src/adapters/live/dimensiones-imagen.ts`): Rekognition devuelve el recuadro del rostro en proporción 0–1 y el umbral de tamaño mínimo está en píxeles. Sin las dimensiones reales, un rostro que ocupa media foto se leería como "menor a 50 px" y se rechazaría siempre.

---

## 9. Piloto de tres formatos de cédula (2026-08-14)

El ítem 9 de la tabla de integraciones pide un piloto con formato nuevo, formato anterior y cédula de residente antes de contratar. **La mitad de ese piloto no necesitaba cédulas reales**: alcanzaba con preguntarle al código qué hace con cada formato. Eso ya está hecho y fijado con tests en `src/adapters/live/__tests__/tres-formatos-cedula.test.ts`.

### Resultado por formato

| Formato | Resultado | Por qué |
| :---- | :---- | :---- |
| **Nuevo** (MRZ TD1, emisor PRY) | **Pasa** | El MRZ da número, nombres y fecha de nacimiento con dígitos verificadores |
| **Residente** (emisor PRY, nacionalidad extranjera) | **Pasa** | La emite Paraguay; lo extranjero es solo la nacionalidad del titular |
| **Anterior** (sin MRZ) | **No puede completar P5** | Sin MRZ no hay fuente confiable de nombre ni de fecha de nacimiento |

Sobre el **residente**, una advertencia que costó un falso hallazgo durante este trabajo: es fácil modelarlo con estado emisor extranjero, y así `cruzarConMrz` lo rechaza por `ESTADO_EMISOR_NO_ES_PARAGUAY`. Está mal modelado — **la cédula de residente la emite Paraguay**. Lo que P5 rechaza es pasaporte y documento extranjero, no a un residente con cédula paraguaya. Hay un test para cada lado de esa distinción.

### El formato anterior es el hallazgo que importa

Y no es un umbral mal calibrado. Con el frente y el dorso leídos **con confianza 100**, el resultado es el mismo: `extraerDatosCedula` devuelve `confiable: false`. El problema no es que el OCR lea con poca confianza, es que **no hay estructura que leer** — el frente de la cédula no tiene formato publicado, así que reconocer nombre y fecha por posición sería adivinar, y esa fecha decide el corte de edad 18–64 (regla inviolable #8). Hay un test que fija exactamente esto, para que nadie intente "arreglarlo" bajando `CONFIANZA_MINIMA_OCR`.

Lo grave no es el rechazo, es **la forma del rechazo**: las tres capturas le aprueban a la persona —foto buena, documento no falso, sin motivo de rechazo— y recién en el análisis se le pide repetir una captura que nunca va a alcanzar. Es el callejón sin salida que anticipaba §6, ahora confirmado y con nombre.

**Dos salidas, y conviene la primera:**

1. **Cruzar contra el registro civil.** El frente del formato anterior **sí** da el número de cédula de forma confiable; con eso, una consulta al Departamento de Identificaciones (§7.7, Didit a USD 0,20) devuelve nombre y fecha de nacimiento desde la fuente oficial. Es *más fuerte* que cualquier OCR sobre un documento de treinta años, no un parche. Convierte el peor formato en el mejor validado. **Implementado — ver §10.**
2. **Derivar a revisión manual** con evidencia conservada (§6), que hace falta igual para cualquier fallo persistente. **Implementado — ver §11.**

No son excluyentes: la 2 es la red de seguridad, la 1 es la solución.

### Lo que el piloto con cédulas reales todavía tiene que medir

Queda lo que ningún test puede contestar: **tasa de aprobación con fotos de verdad**, sacadas por personas de verdad, con documentos gastados y luz de casa. Para eso está `scripts/piloto-cedulas.ts`:

```bash
AWS_PROFILE=<perfil> npm run piloto:cedulas -- <directorio>
```

Recorre un directorio organizado por formato (`formato-nuevo/`, `formato-anterior/`, `residente/`), con pares `<nombre>-frente.jpg` y `<nombre>-dorso.jpg`, los pasa por el adaptador oficial con los mismos umbrales que P5, e informa tasa de aprobación por formato y por etapa, con los motivos de rechazo agrupados.

- **Usa AWS de verdad**: ~USD 0,005 por muestra. Cien muestras son medio dólar. No hay modo seco, porque medir un OCR simulado no mediría nada.
- **El informe no contiene nombres ni números de cédula** — solo agregados y motivos— para que se pueda pegar en un correo sin exponer a nadie.
- **Las imágenes no van al repo.** Son cédulas de personas reales.
- No mide prueba de vida ni coincidencia facial: eso necesita a la persona frente a la cámara y es un piloto presencial aparte.

**Tamaño de muestra sugerido:** al menos 30 pares por formato. Con 30, una tasa de aprobación observada tiene un margen de error de ~±9 puntos, que alcanza para distinguir "funciona" de "no funciona" pero no para afinar un umbral. Si el formato anterior se va a atacar con registro civil, su muestra puede ser menor: lo que hay que medir ahí es la legibilidad del **número de cédula** en el frente, no el expediente completo.

**Criterio de aceptación propuesto** (decisión de producto, sin fila en la matriz de cumplimiento): formato nuevo y residente por encima del 90 % de aprobación en primer intento. Por debajo de eso, el problema es de captura —guía en pantalla, encuadre, iluminación— antes que de proveedor, y cambiar de proveedor no lo va a arreglar.

## 10. Cruce contra el registro civil (2026-08-14)

Octavo puerto del sistema: `RegistroCivilProvider` (`src/ports/registro-civil.ts`), ítem 33 de la tabla de integraciones. Nació del piloto: es lo único que le da salida a la cédula del formato anterior.

**Cómo funciona.** Cuando el OCR no es confiable pero el frente dejó legible el número de cédula, el dominio consulta al registro. Si encuentra, los datos de identidad —nombre, apellido, fecha de nacimiento, sexo, nacionalidad— salen de ahí y P5 continúa. El puerto recibe **solo el número de cédula**: el proveedor no necesita saber a qué producto ni a qué trámite corresponde la consulta.

**Tres estados, no dos.** `ENCONTRADO`, `NO_ENCONTRADO` (el registro contestó y no existe) y `NO_DISPONIBLE` (no contestó). Colapsarlos sería caro en las dos direcciones: tratar `NO_DISPONIBLE` como `NO_ENCONTRADO` rechaza gente legítima cada vez que Identificaciones se cae; tratarlo como `ENCONTRADO` deja pasar a cualquiera justo en el momento que un atacante elegiría. Hoy los dos negativos impiden continuar, pero **quedan distinguidos en la evidencia**, que es lo que permitirá derivar solo el caso que corresponde cuando exista esa salida.

**Consecuencia sobre la regla inviolable #8, que conviene decir en voz alta.** La regla dice que la edad se verifica *"contra la fecha de nacimiento extraída de la cédula, no contra un campo declarado"*. Cuando se usa este camino, la fecha viene **del registro civil**, no del documento. Es una lectura por el espíritu de la regla —nada declarado por la persona, y una fuente más autoritativa que el plástico— y no por su letra. Por eso cada consulta deja evidencia propia (`P5_CONSULTA_REGISTRO_CIVIL`) con su referencia, fecha, IP y resultado: un auditor tiene que poder ver de dónde salió esa fecha. **No tiene fila propia en la matriz de cumplimiento**; la fila 17 exige el cálculo automático de la edad, no la fuente del dato.

**No hay adaptador oficial, y no se puede escribir todavía.** Falta el contrato de API del proveedor —convenio con Identificaciones o intermediario tipo Didit— e inventar endpoints es exactamente lo que las reglas del proyecto prohíben. Misma situación que Code100 y Bancard: puerto, mock y tests de contrato listos; el adaptador `live/` espera el documento del proveedor.

**Qué NO resuelve.** No es autenticidad documental: dice que existe una persona con ese número y esos datos, no que el plástico sea genuino. Un impostor con el número ajeno pasa la consulta — lo que no pasa es la comparación facial contra la foto del documento, que sigue siendo obligatoria.

## 11. Salida de P5 a asistencia humana (2026-08-14)

Cierra §6. Tras **tres** análisis fallidos el expediente pasa a `ASISTENCIA_IDENTIDAD`, con número de caso propio (`ASIS-…`) y pantalla propia.

**Por qué un estado nuevo y no `DERIVADO_MANUAL`.** Reusarlo parecía lo barato y era lo equivocado, por dos razones que se descubren leyendo la especificación:

1. La Pantalla A muestra `Declaraciones recibidas ✓` y su motivo es `[Salud / PEP / vínculo PEP]`. Quien falla en P5 **nunca llegó a P6**: la pantalla afirmaría algo falso sobre esa persona.
2. `DERIVADO_MANUAL` **bloquea la cédula** (regla inviolable #11). Bloquear a alguien porque la cámara del teléfono no daba es desproporcionado — no hay ningún indicio en su contra, a diferencia de una derivación por salud o PEP. `ASISTENCIA_IDENTIDAD` está deliberadamente fuera de esa lista, con test.

La regla #5 queda intacta: la derivación por elegibilidad sigue siendo exclusiva de P6, y la arista nueva sale de `CANAL_EMAIL_VERIFICADO`.

**Corrección a §6 de este documento.** Ahí escribí que la derivación era *"consistente con la fila 19 de la matriz"*. Releída, la fila 19 es específicamente *"Derivar una respuesta PEP a análisis reforzado, sin rechazo automático"* (Res. SEPRELAD 50/20, art. 7). **No respalda una derivación por fallo de identidad.** Esta salida es decisión de producto, no obligación legal, y conviene no presentarla como si lo fuera.

**Tres intentos**, igual que los de OTP de la regla #1: un número que el producto ya usa. Se cuentan análisis fallidos, no capturas rechazadas — una foto borrosa se repite sin drama; lo que agota es completar las tres capturas y que el análisis igual no alcance.

**Lo que la pantalla tiene que decir y la Pantalla A no:** que la cédula **no** quedó bloqueada. Sin ese bloque la persona se va creyendo que quedó vetada, y perdimos una venta por un problema de iluminación.

## 12. Camino de demostración con cámara, sin prueba de vida (2026-08-16)

Nace de una necesidad concreta: mostrarle el recorrido a la gerencia, que está en otra ciudad, con **cédulas reales fotografiadas en el momento**. El camino de producción no sirve para eso — Face Liveness necesita el componente de streaming de Amplify y una calibración que no se resuelve en una videollamada — y el mock tampoco, porque aprueba cualquier imagen y no demuestra nada.

Se agregó un **segundo** adaptador de AWS (`src/adapters/live/identity-provider-camara.ts`), no una opción del existente. La distinción importa: el adaptador de producción rechaza el camino de bytes a propósito, porque comparar una foto suelta y llamarla prueba de vida es justo lo que ese control existe para impedir. Meterle un flag lo habría convertido en un adaptador que a veces miente sobre lo que verificó.

### Las tres relajaciones, y cuál es peligrosa

| Relajación | Qué se pierde | Riesgo real |
| :---- | :---- | :---- |
| Presencia en lugar de prueba de vida | Detección de ataque de presentación | **Alto.** Una foto impresa frente a la cámara pasa. Es la única de las tres explotable por un atacante. |
| Umbral facial 90 en vez de 99 | Margen contra falso acepte | Medio. 90 sigue rechazando pares distintos; está por debajo del 95 que AWS llama "caso regular". |
| OCR aproximado sin MRZ | Verificación con dígitos verificadores | Bajo para el fraude, medio para la corrección: puede leer mal una fecha y equivocar el corte de edad. |

El umbral 90 **no es negociable hacia abajo y no es un ajuste de conversión**: existe porque el retrato contra el que se compara es una fotografía de un plástico con reflejos y trama de seguridad impresa sobre la cara, no el retrato digital para el que AWS calibró el 99. La similitud típica de un par legítimo en esas condiciones cae a 85–97; con 99, la demostración rechazaría al titular correcto delante de la cámara, que es la peor cosa que puede pasar en una demostración.

### Qué lo mantiene contenido

- **`DEMO_MODE=true` o no arranca.** El constructor tira. Las tres relajaciones juntas permitirían firmar un seguro de vida con la foto de otra persona; un flag mal puesto no puede terminar en producción silenciosamente.
- **Política propia versionada** (`VERSION_POLITICA_IDENTIDAD_DEMO`). Cada decisión queda sellada con ella, así que ningún expediente resuelto acá se puede confundir después con uno resuelto con la política de producción — que es la condición para que tener dos políticas sea aceptable y no un agujero (regla inviolable #10).
- **Referencias de evidencia con prefijo `DEMO-`**, visibles en la consola administrativa sin tener que leer la versión de política.
- **`UMBRAL_COINCIDENCIA_FACIAL` sigue en 99**, con sus tests intactos.

### Reconocimiento de documento paraguayo y boliviano

`src/domain/documento-regional.ts`. Vive en el dominio porque **qué documentos acepta el producto es regla de negocio**, no un detalle de Textract.

Lo que hace es modesto y conviene no venderlo de más: busca marcadores impresos —el nombre del país, el tipo de documento, el organismo emisor, el código de país del MRZ— y exige **dos** para dar por reconocido el país. Eso alcanza para que la fotografía de un vaso o de una pared no pase por cédula, que era el objetivo declarado. **No detecta una cédula falsificada ni adulterada**: la brecha de §2 y §3 de este documento sigue abierta y solo la cierra fuente oficial o proveedor documental especializado.

Dos marcadores y no cuatro porque el error caro acá es el falso rechazo: el OCR de una foto de celular con reflejos pierde líneas con facilidad, y una cédula buena rechazada es una venta perdida, mientras que un falso positivo todavía tiene por delante el rostro en el documento, la comparación facial y el corte de edad.

**Aceptar cédula boliviana es decisión de demostración.** No hay fila en la matriz de cumplimiento que la respalde y contradice a `ESPECIFICACION_PANTALLAS.md`, que para P5 dice "No se admite pasaporte ni documento extranjero". Por eso el default del código es solo Paraguay y Bolivia hay que pedirla explícitamente (`IDENTITY_PAISES_CEDULA=PY,BO`).

### Qué falta para el piloto

Sacar `INTEGRATION_IDENTITY_SELFIE` del entorno. Sin esa variable, P5 vuelve sola a Face Liveness y a los umbrales de producción — no hay que revertir código.

## Resumen ejecutivo

1. Rekognition + Textract + MRZ propio para demo/piloto: costo despreciable, control total, el puerto ya lo soporta. **Implementado.**
2. Gestión temprana del convenio con fuente oficial (Identificaciones). Sube de prioridad tras el piloto (§9): el cruce contra registro civil dejó de ser solo el nivel más fuerte de autenticidad y pasó a ser **la forma de que el formato anterior de cédula pueda contratar**.
3. RFP corto Sumsub vs. Entrust vs. Regula para producción, decidido por tasa de aprobación real con los tres formatos de cédula. El instrumental de medición está listo (`scripts/piloto-cedulas.ts`); faltan las cédulas reales.
4. La autenticidad documental es la brecha que ningún plan puede ignorar: AWS no la resuelve — hace falta fuente oficial o proveedor especializado.
5. **El formato anterior de cédula no puede completar P5 hoy** (§9), y no es un problema de calibración. Es lo primero a resolver de esta lista, porque hoy esas personas quedan en un callejón sin salida dentro de la pantalla.

---

### Fuentes

- [AWS · Face and Liveness Verification for Identity Verification with Amazon Rekognition](https://d1.awsstatic.com/rekognition/identity-verification-whitepaper-2024.pdf) — §3.2, §3.3.1 y §6.1: umbrales de calidad, umbrales de decisión y política anti-abuso
- [ICAO Doc 9303 · Machine Readable Travel Documents](https://www.icao.int/sites/default/files/publications/DocSeries/9303_p3_cons_en.pdf) — MRZ, dígitos verificadores y especimen TD1
- [ICAO · Technical Report: Portrait Quality (Reference Facial Images for MRTD)](https://www.icao.int/sites/default/files/TRIP/Publications/TR-Portrait-Quality-v1.0.pdf)
- [ISO/IEC 29794-5:2025 · Biometric sample quality — Face image data](https://www.iso.org/standard/81005.html) — a dónde migrar cuando los proveedores expongan componentes de calidad
- [iBeta · ISO 30107-3 Presentation Attack Detection](https://www.ibeta.com/iso-30107-3-presentation-attack-detection-confirmation-letters/) — niveles L1/L2 y métricas APCER/BPCER
- [AWS · Face Liveness: mejoras de precisión y nuevo challenge (julio 2025)](https://aws.amazon.com/about-aws/whats-new/2025/07/amazon-rekognition-face-liveness-accuracy-improvements-challenge-setting/)
- [Didit · validación de cédula paraguaya contra registro civil](https://didit.me/es/blog/paraguay-cedula-database-validation/)
- [Amazon Rekognition pricing](https://aws.amazon.com/rekognition/pricing/)
- [Amazon Rekognition Face Liveness — AI Service Card](https://aws.amazon.com/ai/responsible-ai/resources/rekognition-face-liveness/)
- [Textract AnalyzeID — documentos soportados](https://docs.aws.amazon.com/textract/latest/dg/how-it-works-identity.html)
- [Comparativa de precios Sumsub / Onfido / Jumio / Veriff](https://tech-insider.org/igt-sumsub-vs-onfido-vs-jumio-vs-veriff-for-igaming-kyc-202-en-d169/)
- [Didit — soporte Paraguay](https://didit.me/solutions/countries/paraguay/)
- [Ley 7593/2025 de Protección de Datos Personales](https://www.bacn.gov.py/leyes-paraguayas/12924/ley-n-7593-2025-de-protecci-n-de-datos-personales-en-la-rep-blica-del-paraguay)
