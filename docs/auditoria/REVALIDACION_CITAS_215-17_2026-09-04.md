# Revalidación de las citas «215» de la matriz de cumplimiento contra el texto de la Res. SS.SG. 215/17

**Fecha:** 04-sep-2026 · **Pedido de Andres** · **Fuente leída:**
`docs/normativa/SIS-Res-215-2017-registro-planes-e-instrumentos-de-cobertura.pdf`
(16 p, texto completo), más la **231/2025** (5 p, escaneada, leída página por
página) y la **210/2025** (Anexo I, arts. 1-10) para las filas que resultaron
no ser de la 215.

## 1. Lo que se encontró

Las 35 filas del CSV que citan la 215 son de **tres familias distintas**, y
dos de ellas tenían la numeración corrida o la norma equivocada:

| Familia | Filas | Diagnóstico | Corrección |
| :-- | :-- | :-- | :-- |
| **A.** Parte resolutiva de la 215/17 («punto 7», «9(d)», «punto 14», «punto 8») | 3, 4, 6, 33, 46, 47, 49, 62, 72 | ✅ Coinciden con los arts. 7º, 8º, 9º, 14º del Título III | Ajustes menores (fila 3: «9(a)» → «1 y 7»; fila 33: «2 y 9» → «7 y 9»; fila 6: «numeral» → «punto») |
| **B.** Anexo de la 215/17 con la numeración **corrida en tres** («6.13.x», «6.1-6.6», «6.7-6.8») | 2, 4, 5, 10, 48, 50, 60, 61, 62, 63, 72 | ❌ En el Anexo leído, el **9** es el modelo de póliza (9.1-9.12 y 9.13.1-9.13.22, condiciones particulares); el **6** es un ítem único sobre el orden del índice. Cada «6.13.n» corresponde exactamente a «9.13.n»: 6.13.14 = fecha y hora de inicio de cobertura, 6.13.6 = prima y premio, 6.13.20 = artículos del Código Civil, 6.13.1-22 = las 22 condiciones particulares | «6.x» → «9.x» en todas; «6.12.23» (no existe) → 9.13.19 (código y acto de inscripción); «12.8» y «12.14» (la nota técnica llega a 12.5) → 11.6 y 9.13.8 |
| **C.** «Artículos» que la 215/17 no tiene con ese contenido («art. 1», «art. 4 primer/segundo/tercer párrafo», «art. 5», «art. 8», «art. 10(a)») | 39, 45, 51, 53, 54, 56, 57, 78, 79, 81, 83 | ❌ Son los artículos del **Anexo I de la 231/2025** (art. 4: medio de recepción declarado, copia en papel con código, acuse; art. 5: verificación por QR; art. 6: seguridad, respaldo y recuperación) y del **Anexo I de la 210/2025** (art. 8: responsabilidad por proveedores tecnológicos; art. 10: procedimiento y planes de contingencia). El CSV se armó con un archivo `215_2025.pdf` que contenía la 210/2025 — misma trampa que produjo la errata «215/2025» | Reatribuidas a la 231/2025 o a la 210/2025, conservando el resto de cada cita |
| **D.** Anexo de la 215/17 con numeración correcta («11.14», «11.15», «8.4, 8.5 y 8.9») | 9, 30, 34, 38, 65 | ✅ Coinciden: 11.14 es el texto del art. 1556; 11.15 la firma del corredor o del proponente; 8.4/8.5/8.9 la duración, anulaciones anticipadas y primas no ganadas | Sin cambios |

**Filas débiles, corregidas a lo más cercano y marcadas para Legal:** la 20
(declaraciones médicas: citaba 11.2 y 11.11, denominación del plan y forma de
indemnización patrimonial — se dejó «numeral 11» a secas), la 63 (gastos
médicos: citaba 6.13.8, que es financiamiento del premio — se puso 9.13.9,
suma asegurada) y la 71 (pago hasta 24 h después del vencimiento: citaba
6.13.11 y 12.14 — se dejó 9.13.8, forma de pago; el respaldo real es el Código
Civil arts. 1373-1374 que la fila ya cita).

## 2. Un hallazgo que no es de cita: la fila 46

La fila 46 dice **«Utilizar un número de póliza de 18 dígitos numéricos»** y
cita el punto resolutivo 14. El art. 14º de la 215/17 dice, textual: *«la
numeración de los instrumentos de cobertura emitidos deberá coincidir
exactamente con la reportada a la Central de Información en cuanto a su forma
y cantidad de dígitos (actualmente **10 dígitos numéricos** sin incluir
caracteres alfabéticos, símbolos ni espacios)»*. La Matriz Legal V4 también
dice 10. **El título de la fila contradice la norma que cita.** No se tocó el
título —es de Rodrigo/Legal— pero conviene corregirlo: el sistema hoy no
acuña el número de póliza (lo hace SEBAOT), así que no hay código que cambiar.

## 3. Posibles duplicados con las filas 86-93

Las filas 86-93 se agregaron el 26-ago-2026 con los arts. 4 a 10 de la
210/2025. Al reatribuir las filas 78, 79, 81 y 83 a la 210/2025 (arts. 8 y 10),
pueden solaparse con alguna de esas. Es una decisión de la matriz, no del
código: se deja anotado.

## 4. Fila por fila

| N.º | Título (resumido) | Cita anterior | Cita corregida | Base en el texto |
| :-- | :-- | :-- | :-- | :-- |
| 2 | Identidad y contactos de Alianza e Interseguros | numeral 6(a); Anexo 6.13.20 | punto 9(c) y 9(e); Anexo 9.13.1 y 9.13.21 | 9º.c suscriptores; 9º.e datos del corredor; 9.13.1 razón social/domicilio/web; 9.13.21 datos de agentes y corredores |
| 3 | Solo productos registrados | puntos 7 y 9(a) | puntos 1 y 7 | 1º registro obligatorio; 7º ceñirse al modelo inscripto |
| 4 | Código de registro del plan | 9(d); Anexo 6.12.23 | 9(d); Anexo 9.13.19 | fórmula «inscrito … bajo el Código … según …» |
| 5 | Coberturas, exclusiones, carencias, costos | Anexo 2 y 6.1-6.8 | Anexo 2 y 9.1-9.8 | 2 claridad de coberturas; 9.1 riesgos; 9.4 carencias; 9.5 exclusiones |
| 6 | Consultar póliza y condiciones antes | numeral 9(f) | punto 9(f) | URL del modelo inscripto |
| 9 | La Solicitud no es póliza | 11.14 | = | texto del art. 1556 |
| 10 | Premio con IVA y desglose | 12.8 y 6.13.6 | 11.6 y 9.13.6 | prima y premio en propuesta y en condiciones particulares |
| 20 | Declaraciones médicas | 11.2 y 11.11 | numeral 11 | ⚠ débil |
| 30 | Devolver el premio si no firma | 8.4, 8.5, 8.9 | = | anulaciones anticipadas; primas no ganadas |
| 33 | Referencia Bancard en la póliza | puntos 2 y 9 | puntos 7 y 9 | 7º modelo inscripto; 9º condiciones particulares |
| 34 | Cliente firma Solicitud y FIPF | 11.15 | = | firma del proponente |
| 38 | Interseguros firma como intermediario | 11.15 | = | firma del agente/corredor |
| 39 | Alianza firma la póliza con FEC | 215, art. 1 | **231/2025 Anexo I arts. 1-2**; 215 punto 15 | 231 art. 2 FEC del suscriptor; 215 art. 15º firmas digitales con aprobación de Asamblea |
| 45 | Alianza acepta y emite | 215, arts. 1-2 | 215 puntos 1 y 7; 231/2025 art. 2 | — |
| 46 | Número de póliza de 18 dígitos | punto 14 | = | ⚠ **la norma dice 10 dígitos** (§2) |
| 47 | Vincular por correlativos o hashes | punto 14 | = | numeración coincidente con la Central de Información |
| 48 | Menciones obligatorias de la póliza | 9(a-g); 6.13.1-6.13.22 | 9(a-g); 9.13.1-9.13.22 | las 22 condiciones particulares |
| 49 | No iniciar cobertura antes del contrato | punto 8 | = | 8º vigencias anteriores a la celebración |
| 50 | Cobertura 24 h después del pago | 6.13.14 | 9.13.14 | fecha y hora de inicio y fin |
| 51 | Verificar autenticidad de la póliza | 215, art. 5 | **231/2025 Anexo I art. 5** | QR o equivalente |
| 53 | Cliente declara correo o WhatsApp | 215, art. 4 1.º párr. | **231/2025 art. 4, 1.º párr.** | medio electrónico declarado en la propuesta |
| 54 | Evidencia de envío/recepción | 215, art. 4 3.º párr. | **231/2025 art. 4, 3.º párr.** | acuse según Ley 6822/2021 |
| 56 | Entregar póliza y factura | 215, art. 4 | **231/2025 art. 4** | — |
| 57 | Copia física a pedido | 215, art. 4 2.º párr. | **231/2025 art. 4, 2.º párr.** | copia en papel con código de verificación |
| 60 | Contactos para reclamos y siniestros | 6.7-6.8 | 9.7-9.8 | configuración del siniestro; documentación |
| 61 | Indemnización en 5 días hábiles | 6.1-6.6 | 9.6-9.8 | obligaciones; siniestro; documentación |
| 62 | Renta hospitalaria | 7; 2, 6.1-6.6, 6.13.4-6.13.14 | 7; 2, 9.1-9.6, 9.13.4-9.13.14 | — |
| 63 | Gastos médicos por accidente | 6.1-6.6 y 6.13.8 | 9.1-9.8 y 9.13.9 | ⚠ débil |
| 65 | Cancelación y devolución | 8.4, 8.5, 8.9 | = | — |
| 71 | Pago hasta 24 h después del vencimiento | 6.13.11 y 12.14 | 9.13.8 | ⚠ débil; manda el Código Civil 1373-1374 |
| 72 | Sin renovación con diagnóstico | 7; 6.1-6.6 | 7; 9.1-9.6 | 9.5 exclusiones; 9.6 obligaciones |
| 78 | Infraestructura, respaldos, recuperación | 215, art. 10(a) | **231/2025 art. 6; 210/2025 art. 10** | 231 art. 6 i-iv |
| 79 | Separar ambientes y credenciales | 215, art. 8 | **210/2025 arts. 2(d) y 8** | gobernanza tecnológica; responsabilidad por proveedores |
| 81 | Incidentes y continuidad | 215, art. 10(a) | **210/2025 art. 10; 231/2025 art. 6(iii)** | planes de contingencia; respaldo y recuperación |
| 83 | Roles y registro de acciones | 215, art. 8 | **210/2025 arts. 2(e) y 10; 231/2025 art. 6(ii)** | ciberseguridad; seguridad de la información |

## 5. Qué queda

- Que Rodrigo/Legal miren las tres filas débiles (20, 63, 71) y el título de
  la 46.
- Que la matriz absorba las reatribuciones a la 231/2025 y a la 210/2025,
  revisando solapes con las filas 86-93.
- El test de higiene sigue en verde: ninguna cita nueva está en su lista.
