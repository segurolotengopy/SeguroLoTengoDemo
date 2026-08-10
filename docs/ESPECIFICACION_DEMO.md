# Especificación del DEMO — SeguroLoTengo

Guion de demostración y catálogo de datos de prueba para mostrar el sistema a la gerencia sin ninguna integración externa contratada.

> **Jerarquía.** Este documento **no** es fuente de verdad de las pantallas. Manda `docs/ESPECIFICACION_PANTALLAS.md` para qué muestra cada pantalla, y `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` para las obligaciones legales. Acá solo se define **con qué datos** se recorre lo que esos documentos ya especifican.

---

## 1. Qué es real y qué está simulado

Esto es lo primero que conviene aclarar en la presentación, para que nadie confunda una demostración con un piloto.

| Capa | Estado en el demo |
| :---- | :---- |
| Pantallas, textos, validaciones y orden de los 9 pasos | **Reales**, según la especificación |
| Máquina de estados del expediente | **Real** — las transiciones ilegales son imposibles, no evitadas |
| Motor de elegibilidad (declaraciones 1, 2, 3, 8) | **Real** |
| Reglas de OTP (6 dígitos, 5 min, 3 intentos, 60 s, solo hash) | **Reales** |
| Registro de evidencia (fecha, hora, IP, canal, resultado) | **Real**, persistido en DynamoDB |
| Persistencia (DynamoDB, S3 con Object Lock) | **Real** |
| Entrega del OTP por WhatsApp (Infobip) | **Simulada** — el código se lee en `/demo-panel` |
| Verificación de identidad y biometría (Entrust/Onfido) | **Simulada** |
| Screening de cumplimiento (ComplyAdvantage) | **Simulado** |
| Pago (Bancard) | **Simulado** — no hay dinero real en ningún momento |
| Firma electrónica (Code100) | **Simulada** |
| Emisión de póliza y factura (SEBAOT) | **Simulada** |

Los siete proveedores viven detrás de interfaces (`src/ports/`). El mock y la implementación oficial comparten **los mismos tests de contrato**, así que reemplazar un simulado por el real no cambia el comportamiento del flujo.

---

## 2. Personas de prueba

Definidas en `src/adapters/mock/personas.ts` y verificadas contra el motor de reglas real en `src/adapters/mock/__tests__/personas.test.ts`. Si alguien cambia una regla de negocio, esos tests fallan antes de que la demostración muestre algo falso.

**Todos los datos son ficticios.** Cédulas, domicilios, empleadores e ingresos son inventados. Los correos usan `example.com`, dominio reservado que no puede pertenecer a nadie.

### 2.1 Resumen

| Persona | Celular (se tipea en P1) | Plan | Termina en | Qué demuestra |
| :---- | :---- | :---- | :---- | :---- |
| **Camino feliz** — Mónica Mariana Gorena Tapia | `981 000 123` | CONFÍO+ | **P9** | El recorrido completo hasta la contratación aceptada |
| **PEP positivo** — Ramón Elías Duarte Villalba | `982 000 456` | CONFÍO TOTAL | **Pantalla A** | Bloqueo por condición PEP + beneficiario designado |
| **Salud incompatible** — Carolina Beatriz Ayala Benítez | `983 000 789` | CONFÍO | **Pantalla A** | Bloqueo por declaraciones 1, 2 y 3 |
| **Biometría rechazada** — Julio César Ramírez Cabral | `984 000 234` | CONFÍO+ | **P5** | Campos OCR bloqueados; solo se puede repetir la captura |
| **Paga y no firma** — Lucía Fernanda Ortiz Meza | `985 000 567` | CONFÍO+ | **Pantalla B** | Vencimiento del plazo de firma y devolución del premio |

### 2.2 Detalle

**Camino feliz** · C.I. 9.323.336 · nac. 17/04/1990 · Asunción · contadora en relación de dependencia · ingreso declarado Gs. 9.500.000 · beneficiario: herederos legales · correo `monica.gorena@example.com` · las 8 declaraciones en su respuesta habilitante · paga con QR Bancard.

**PEP positivo** · C.I. 3.874.512 · nac. 02/11/1978 · Asunción · funcionario público · ingreso declarado Gs. 14.000.000 · beneficiario designado: Silvia Raquel Duarte Ocampos (cónyuge, 100%) · correo `ramon.duarte@example.com` · **declaración 8 en "Sí"**.

**Salud incompatible** · C.I. 5.612.908 · nac. 23/06/1985 · San Lorenzo · comerciante independiente · ingreso declarado Gs. 5.200.000 · beneficiario: herederos legales · correo `carolina.ayala@example.com` · **declaración 1 en "No", 2 en "Sí", 3 en "Sí"**.

**Biometría rechazada** · C.I. 4.209.336 · nac. 09/01/1992 · Fernando de la Mora · técnico en logística · ingreso declarado Gs. 6.800.000 · correo `julio.ramirez@example.com` · prueba de vida aprobada, **coincidencia facial rechazada**. Sus declaraciones son compatibles a propósito: lo que la frena es la biometría, no la elegibilidad.

**Paga y no firma** · C.I. 6.155.740 · nac. 30/09/1988 · Luque · docente · ingreso declarado Gs. 4.900.000 · beneficiario: herederos legales · correo `lucia.ortiz@example.com` · elegible y paga por QR; deja vencer las 24 horas.

---

## 3. Planes

Valores exactos de la especificación (P2), en `src/domain/planes.ts`. No son datos de prueba: son el producto.

| Cobertura | CONFÍO | CONFÍO+ | CONFÍO TOTAL |
| :---- | :---- | :---- | :---- |
| Muerte por cualquier causa | Gs. 3.500.000 | Gs. 5.000.000 | Gs. 7.000.000 |
| Indemnización por cáncer (pago único) | Gs. 50.000.000 | Gs. 75.000.000 | Gs. 100.000.000 |
| Renta hospitalaria (máx. 15 días) | Gs. 7.500.000 | Gs. 11.250.000 | Gs. 15.000.000 |
| Gastos médicos por accidente | Gs. 7.000.000 | Gs. 10.000.000 | Gs. 14.000.000 |
| **Premio total anual (IVA incluido)** | **Gs. 290.000** | **Gs. 475.000** | **Gs. 660.000** |

---

## 4. Guion de demostración

### 4.1 Recorrido principal (~8 minutos) — Camino feliz

Abrí `/demo-panel` en una segunda pestaña antes de empezar: ahí aparecen los códigos OTP.

| Paso | Qué hacer | Qué señalar a la gerencia |
| :---- | :---- | :---- |
| P0 | Entrar a `/` y presionar `VERIFICAR WHATSAPP Y COTIZAR` | Página informativa: no pide datos médicos ni PEP, no cotiza, no cobra |
| P1 | Número `981 000 123`, marcar la autorización, `ENVIAR CÓDIGO`. Leer el código en el panel y verificar | Tres OTP independientes; en base solo queda el hash; el registro de seguridad muestra IP, número enmascarado y referencia de envío |
| P2 | Elegir CONFÍO+ | Se guarda el ID de versión de la oferta y su hash SHA-256 |
| P3 | `TENGO TODO LISTO` | Autorización inicial versionada: no contrata ni autoriza pago |
| P4 | Correo `monica.gorena@example.com`, código nuevo desde el panel | **Es un código distinto al de P1**, con evidencia separada |
| P5 | Capturas simuladas, completar país y estado civil | Los campos de la cédula están bloqueados; la edad se calcula del documento, no de un campo declarado |
| P6 | Datos complementarios y las 8 declaraciones compatibles | El bloque de elegibilidad y qué respuesta habilita cada una |
| P7 | QR Bancard | No se guarda número de tarjeta ni CVV; el dinero va directo a Alianza; el pago no es firma ni emisión |
| P8 | Enviar el enlace de firma y confirmar | Solicitud y FIPF se firman **en un solo acto**; los PDF están cerrados y hasheados antes de habilitar la firma |
| P9 | Resultado | Póliza y factura las emite y envía Alianza; desde el portal se descargan solo Solicitud y FIPF firmados. **No se genera Nota de Cobertura** |

### 4.2 Recorridos de excepción (~3 minutos cada uno)

**Derivación a Pantalla A (PEP).** Repetir hasta P6 con `982 000 456` y responder "Sí" en la declaración 8. Señalar: se detiene **antes** del pago, genera un número de caso distinto del correlativo de propuesta, y el estado es terminal — desde ahí no existe camino a pago, firma ni emisión. No es un rechazo definitivo.

**Derivación a Pantalla A (salud).** Igual con `983 000 789`. Señalar que el motivo se registra por número de declaración y que los datos médicos no salen hacia analítica, CRM ni monitoreo de errores.

**Biometría rechazada.** Con `984 000 234`, y **eligiendo "Biometría rechazada" en el panel** antes de llegar a P5: el proveedor de identidad simulado responde según la persona activa del panel, no según el número tipeado en P1. Señalar que los campos extraídos no se editan a mano: el único camino es repetir la captura.

**Pantalla B.** Con `985 000 567`, **fijar primero el plazo corto en el panel** (el vencimiento se congela al confirmarse el pago, así que hay que elegirlo antes), pagar el QR en P7 y no firmar. Al vencer, P8 lleva sola a `/solicitud-vencida`. Señalar los recordatorios a 1, 5 y 12 horas —que los hace Interseguros a mano, no el sistema— y que la devolución va únicamente al medio de origen. Para cerrar el recorrido, el botón *Alianza ejecutó la devolución* del panel deja el expediente en `DEVUELTO`.

Con tarjeta de crédito el desenlace es otro y la pantalla lo dice distinto: no hubo cobro, así que no hay premio que devolver sino una reserva que se libera. Es la misma divergencia declarada de P7 (`MedioDePago` en `src/domain/tipos.ts`).

---

## 5. El panel de demo

`/demo-panel`, protegido por `DEMO_PANEL_KEY` y disponible solo con `DEMO_MODE=true`.

Es **el único lugar del sistema donde el código de un OTP puede verse**. La API del flujo nunca lo devuelve, y en base solo está el HMAC — verificado por `src/app/api/p1/__tests__/no-filtra-codigo-otp.test.ts`.

Funciones (ver CLAUDE.md → "Panel de demo"): elegir persona, ver los OTP generados, acelerar el plazo de firma, forzar fallos puntuales (OTP expirado, intentos agotados, timeout de Bancard, rechazo de Code100), completar el acto de firma de Code100, reiniciar el expediente y ver el registro de evidencia.

**Fallos forzados.** Las cuatro palancas se arman para **un solo intento**: se ve el error una vez y el reintento funciona, así la demostración sigue sin volver al panel. Ninguna inventa un camino: el OTP expirado nace con la hora corrida hacia atrás y lo rechaza la validación de vigencia de siempre; los intentos agotados se queman contra el repositorio real; el timeout de Bancard y el rechazo de Code100 entran por el `fallaForzada` que los adaptadores mock ya exponían.

**Plazo de firma.** El selector cambia el plazo que se le asigna a los **próximos** pagos confirmados: un expediente que ya pagó tiene su vencimiento congelado desde ese momento. Para mostrar la Pantalla B hay que elegir el plazo corto **antes** de pagar el QR en P7. Nunca se puede alargar más allá de las 24 horas, y con `DEMO_MODE` apagado rigen las 24 horas aunque quede otra cosa elegida.

**Acto de firma de Code100.** En una demostración no llega ningún WhatsApp ni ningún correo con el enlace, así que el panel hace de pantalla del proveedor: abrir el enlace (ahí se emite el tercer OTP), tipear el código y firmar, o rechazar. El botón *Firmar con falla a mitad* corta el sellado entre la Solicitud y el FIPF: es la demostración en vivo de la regla inviolable #3 — después de apretarlo, las dos huellas de abajo siguen diciendo "sin firmar".

**Persona de prueba activa.** El selector del panel decide a quién simula el adaptador de identidad en P5: de ahí salen los datos que devuelve el OCR y si la verificación aprueba. Cada persona trae su propio desenlace, derivado de su fixture (la coincidencia facial y la fecha de nacimiento de `personas.ts`), y al lado hay un selector para **forzar** uno de los cuatro: aprobado, calidad insuficiente, edad fuera del rango 18-64 o no coincide la cara. El forzado sirve para mostrar los dos desenlaces que ninguna de las cinco personas produce por sí sola, sin inventar personas nuevas. La selección vive en memoria del proceso, igual que los códigos OTP.

**Límite conocido.** Los códigos viven en memoria del proceso que atendió el envío, porque la regla inviolable #2 prohíbe persistirlos. En un despliegue con varias instancias, el panel puede no ver un código emitido por otra. Con el tráfico de una demostración suele haber una sola instancia caliente, pero conviene saberlo antes de estar frente a la gerencia: si el código no aparece, recargá y repetí el envío.

**Exclusión del bundle.** Con `DEMO_MODE` apagado el panel no existe en el build: sus archivos de ruta usan la extensión `page.demo.tsx` / `route.demo.ts`, y `next.config.ts` solo incluye esas extensiones en `pageExtensions` cuando el flag está prendido en tiempo de build. Un despliegue sin el flag no contiene el código de `/demo-panel` ni de `/api/demo-panel/*`. Las guardas de runtime (`esModoDemo()`) se conservan como defensa en profundidad para un build hecho con el flag prendido pero servido con el flag apagado. *(Era el pendiente de la auditoría del 2026-08-10; resuelto ese mismo día.)*

---

## 6. Antes de una demostración

1. `npm run verify` en verde.
2. `DEMO_MODE=true` y la clave del panel a mano (secret `slt-demo-app-secrets`, campo `DEMO_PANEL_KEY`).
3. Panel abierto en una segunda pestaña.
4. Expediente reiniciado, para arrancar desde `INICIADO`.
5. Si vas a mostrar el tema oscuro, dejalo definido antes: el botón está en la cabecera de todas las pantallas.

---

## 7. Estado de implementación

| Pantalla | Estado |
| :---- | :---- |
| P0 · Información | Implementada |
| P1 · Verificación de WhatsApp | Implementada, con OTP de punta a punta |
| P2 · Planes, P3 · Preparación, P4 · Verificación de correo | Implementadas |
| P5 · Verificación de identidad | Implementada, con el `IdentityProvider` mock de punta a punta |
| P6 · Datos y declaraciones | Implementada, con el motor de elegibilidad y la derivación a Pantalla A de punta a punta |
| Pantalla A · Emisión no automática | Implementada. Los datos de contacto de Alianza e Interseguros son marcadores: el PDF de referencia tampoco los trae |
| P7 · Facturación y garantía de pago | Implementada, con el `PaymentProvider` mock de punta a punta: QR, débito y crédito, declaración de origen lícito bloqueante e idempotencia del intento de pago |
| Servicio de generación de documentos | Implementado en `src/documentos/`: cierra `PROP-…` y `FIPF-…` con el mismo correlativo, calcula el SHA-256 de cada PDF y estampa el QR de verificación. Lo consume `GET /api/p8/resumen`, que es donde el paquete se cierra al entrar a P8 |
| P8 · Revisión y firma final | Implementada, con el `SignatureProvider` mock de punta a punta: un solo acto de firma para la Solicitud y el FIPF, tercer OTP del lado de Code100, descarga de los PDF con verificación de huella y vencimiento del plazo de 24 horas |
| Pantalla B · Solicitud vencida | Implementada en `/solicitud-vencida`: seguimiento de firma (1, 5, 12 y 24 horas), resumen del caso, procedimiento de devolución en cuatro pasos, actores y evidencia conservada. Abre el trámite de devolución al entrar y llega hasta `DEVUELTO` |
| P9 · Contratación aceptada | Implementada, con el `PolicyIssuer` mock de punta a punta: SEBAOT simulado remite y emite (`EN EMISIÓN` → `EMITIDA`), la factura la sigue por SIFEN, y se descargan la Solicitud y el FIPF **firmados**, verificando su huella. No se genera Nota de Cobertura |
| Panel de demo | Implementado: clave, códigos OTP, registro de evidencia, selección de persona (con desenlace de identidad forzable), acelerador del plazo de firma, los cuatro fallos forzados, el acto de firma de Code100 simulado, la devolución ejecutada por Alianza y reinicio de expediente |
| Las 12 pantallas | **Completas.** P0–P9, Pantalla A y Pantalla B |
| Consola administrativa | Implementada en `/admin-consola`: búsqueda, detalle, evidencia y reinicio con justificativo. Falta la vista de envíos/respuestas a proveedores |

Las 12 pantallas están construidas. Cada pantalla nueva consume los fixtures de `personas.ts` y no debería necesitar datos propios: si una pantalla pide un dato que no está en el catálogo, es señal de que el catálogo quedó corto y hay que ampliarlo acá, no inventarlo en la pantalla.
