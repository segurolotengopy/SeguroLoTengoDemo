# SeguroLoTengo.com — handoff de programación

Versión consolidada: 14 de septiembre de 2026.

Este paquete reúne todas las referencias visuales recuperadas, sus códigos y un contrato funcional independiente de tecnología. No mezcla pantallas candidatas con pantallas aprobadas.

## Archivos principales

- `index.html`: visor HTML responsive y navegable de todas las pantallas.
- `data/screens.json`: contrato técnico maestro con marca, producto, reglas, campos, consentimientos, grupos, estados y pendientes.
- `data/PANTALLA_03D_ESPECIFICACION_Y_CATALOGOS_APROBADA_FINAL.json`: especificación aprobada completa de 03D, incluidos catálogos.
- `data/screen_manifest.csv`: inventario tabular de cada arte, código, estado, ruta y hash SHA-256.
- `assets/screens/aprobadas/`: 81 artefactos visuales APROBADA FINAL.
- `assets/screens/candidatas/`: 22 artefactos visuales candidatos o pendientes.

El visor puede abrirse directamente con `index.html`. No necesita conexión a internet ni dependencias externas.

## Regla obligatoria de implementación

Programar como definitivo únicamente los registros que cumplan simultáneamente:

```text
approval_status = APROBADA_FINAL
approved_for_development = true
```

Los archivos candidatos son solo referencia. No deben liberarse ni utilizarse para cerrar decisiones visuales o funcionales.

## Orden de autoridad

1. La imagen `APROBADA_FINAL` correspondiente al código y estado.
2. La especificación JSON aprobada vinculada.
3. Las reglas globales del archivo `data/screens.json`.

No cambiar estructura, contenido, orden, textos, nombres, campos, logotipo, proporciones ni línea gráfica sin aprobación expresa.

## Estado recuperado

- 81 artefactos APROBADA FINAL.
- 79 vistas aprobadas aptas para desarrollo.
- 2 láminas resumen aprobadas, utilizadas como documentación y no como pantallas de ejecución.
- 22 artefactos candidatos.
- 103 referencias visuales en total.

## Bloqueos antes de considerar completo el flujo

- `03E · Actividad e ingresos`: todos sus estados visuales siguen como candidatos.
- `04E · Revisión y firma final`: punto de reanudación; no existe arte aprobado recuperado.
- `05A · Pago Bancard`: existe la regla funcional, pero no un arte final aprobado recuperado.
- `05B · Confirmación y emisión`: existe la regla funcional, pero no un arte final aprobado recuperado.

El beneficiario quedó integrado en `04A`; no corresponde crear una pantalla `04B` separada salvo una decisión posterior expresamente aprobada.

## Límites del paquete

El HTML es el visor exacto de handoff y el JSON es el contrato funcional. La implementación productiva debe transformar estas referencias en componentes semánticos y conectar, mediante contratos técnicos propios, WhatsApp/SMS, validación de identidad, firma electrónica, Bancard y Alianza/Sebaot.

Las credenciales, endpoints, secretos, certificados y decisiones de infraestructura no forman parte de este archivo visual y funcional.
