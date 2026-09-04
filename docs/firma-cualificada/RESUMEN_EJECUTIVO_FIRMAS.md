# Firmas electrónicas del Seguro CONFÍO — resumen para aprobación de Gerencia

**Fecha:** 04-sep-2026 · **De:** equipo técnico SeguroLoTengo (AAB1) · **Para:** Gerencia de Interseguros S.A.
**Se pide aprobar:** la secuencia de firmas de abajo y las tres decisiones que la vuelven operativa.

## La secuencia

| # | Acto | Quién firma | Tipo de firma | Cuándo | Norma |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | Solicitud + FIPF (un solo PDF) | **Cliente** | Electrónica simple, con OTP, identidad verificada, hash y evidencia | **Antes de pagar** | Res. SS.SG. 210/2025 arts. 4, 6 y 9 · Res. 215/17 num. 11.15 |
| 2 | Pago del premio | — | Registro de Bancard | Al aprobarse | Código Civil arts. 1573-1574 |
| 3 | Certificado de Cobertura Provisional | **Alianza** (suscriptor autorizado), desde su sistema | Cualificada | Inmediato tras el pago | Res. 231/2025 Anexo I arts. 1-2 · Res. 215/17 art. 7º y num. 10 · CC art. 1573 |
| 4 | Solicitud + FIPF | **Interseguros** (agente autorizado) | Cualificada, token F2 | **Dentro de 24/48 h**, después del pago y antes de la póliza. Plazo operativo, no legal | Res. 210/2025 art. 5 · Ley 827/96 art. 76 · Res. 205/2025 art. 2 · Res. 215/17 num. 11.15 |
| 5 | Póliza y factura | **Alianza** (SEBAOT / SIFEN) | Cualificada | 24/48 h | CC art. 1555 · Res. 231/2025 arts. 2-6 |

**No firman:** Alianza la Solicitud/FIPF; Interseguros y el cliente el CPC. Interseguros figura en el CPC y la póliza identificado como corredor (nombre, matrícula SIS 118, contacto).

## Las tres decisiones

1. **El cobro se habilita con la firma del cliente.** La firma de Interseguros deja de ser previa al pago; se aplica después, en 24/48 h. Saca al firmador del camino crítico de la venta y hace viable firmar con token F2 en equipo propio — el mismo montaje que usa Alianza — sin proveedor de firma en línea.
2. **El CPC lo emite y firma solo Alianza.** SeguroLoTengo deja de generarlo; el cliente recibe de inmediato su comprobante de pago y el CPC llega después por WhatsApp y correo, como la póliza.
3. **Alianza no firma la propuesta.** La norma pide la firma del corredor o del proponente; la Matriz Legal V4 ya lo decía.

## Lo que cambia respecto de lo aprobado el 19-ago-2026

- Se invierte el orden entre pago y firma **institucional**; la del cliente sigue antes del pago.
- El CPC deja de ser un documento del portal (D-12) y Alianza sale de los firmantes de la propuesta (D-13).
- El proveedor de firma cualificada pasa a ser **el certificado**, no un servicio en línea: Interseguros necesita un certificado F2 a nombre de su agente autorizado (Confirma o Code100) y un equipo dedicado con el token. Alianza migró de Code100 a Confirma por la calidad del F2.

## El riesgo que queda abierto

**Firma desatendida con el PIN cargado.** La Ley 6822/2021 (art. 44.1) exige que la clave quede bajo control exclusivo del firmante. Alianza opera así sin dictamen. Antes de producción: dictamen legal y custodia física documentada del token — en la oficina del corredor, no en el piloto de Bolivia.

## Base documental

Las normas citadas de primera mano están en `docs/normativa/` (210/2025, 231/2025, 215/17, Ley 6822/2021). Detalle: `docs/firma-cualificada/CAMBIOS_NECESARIOS.md` §4 y `docs/plan/DECISIONES.md` (D-08, D-12, D-13, enmiendas del 04-sep-2026).
