# Evidencia — opt-out de servicios de IA de AWS

Registro de que las imágenes de rostro y de cédula que P5 envía a Amazon Rekognition y a Amazon Textract **no pueden ser usadas ni almacenadas por AWS para mejorar sus servicios**.

| | |
| :---- | :---- |
| **Cuenta** | `120005938663` (Seguro Lo Tengo) |
| **Política efectiva vigente desde** | 2026-08-14 10:48:07 (UTC−4) |
| **Evidencia obtenida** | 2026-08-14 |
| **Aplicado con** | `infra/aplicar-opt-out-ia.sh`, credenciales de administración |
| **Documento de origen** | `infra/politica-opt-out-ia.json` (versionado en este repo) |

## Comando y salida

```bash
aws organizations describe-effective-policy \
  --policy-type AISERVICES_OPT_OUT_POLICY \
  --target-id 120005938663
```

```json
{
    "EffectivePolicy": {
        "PolicyContent": "{\"services\":{\"default\":{\"opt_out_policy\":\"optOut\"}}}",
        "LastUpdatedTimestamp": "2026-08-14T10:48:07.617000-04:00",
        "TargetId": "120005938663",
        "PolicyType": "AISERVICES_OPT_OUT_POLICY"
    }
}
```

Desanidando `PolicyContent`:

```json
{ "services": { "default": { "opt_out_policy": "optOut" } } }
```

## Qué prueba

`default` es el comodín de AWS para **todos** los servicios de IA, incluidos los que AWS agregue en el futuro. Que la política *efectiva* —no la de origen, sino la que AWS calcula tras resolver toda la herencia— lo tenga en `optOut` significa que la cuenta está fuera del uso de contenido para mejora de servicio en Rekognition, Textract y cualquier otro servicio de IA, sin excepciones.

El documento de origen bloquea además cualquier excepción futura con `@@operators_allowed_for_child_policies: ["@@none"]` en los tres niveles: ninguna política hija puede optar por entrar en un servicio individual.

Vale la pena mirar la **fecha**: `LastUpdatedTimestamp` es el momento en que la política efectiva quedó vigente, y es anterior a cualquier procesamiento de imágenes reales, porque a esa fecha el demo seguía 100 % mock (`INTEGRATION_IDENTITY` sin `live`). Nunca hubo una imagen de una persona real bajo el régimen anterior.

## Qué NO prueba

- **No dice nada sobre la transferencia internacional.** Face Liveness no existe en ninguna región sudamericana, así que las selfies salen del continente igual. Eso es una declaración del aviso de privacidad, no algo que esta política resuelva.
- **No cubre a otros proveedores.** Vale para servicios de IA de AWS. Code100, Bancard, Infobip y cualquier otro tienen sus propios términos.
- **No es una fila de la matriz de cumplimiento.** `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` no tiene ninguna fila que exija esto: la matriz cubre SEPRELAD, firma electrónica y seguros, no protección de datos personales. El respaldo es la **Ley 7593/2025**, que la matriz cargada no alcanza. Dicho de otra forma: es una obligación legal real, pero **no trazable a la matriz del proyecto**, y conviene no presentarla como si lo fuera.

## Sobre la forma de la respuesta

En esta cuenta la política efectiva conservó la clave `default`. El ejemplo de la documentación de AWS muestra en cambio `default` **expandido en cada servicio individual** (`comprehend`, `rekognition`, …). Las dos formas son válidas y significan lo mismo; `infra/aplicar-opt-out-ia.sh` verifica que ningún servicio quede fuera de `optOut`, así que acepta ambas.

Ojo al comparar contra `politica-opt-out-ia.json`: la política **efectiva** trae `"opt_out_policy": "optOut"` (string), mientras que la de **origen** trae `"opt_out_policy": { "@@assign": "optOut" }`. AWS ya resolvió los operadores de herencia. No son el mismo documento y no se pueden copiar de una a otra.

## Efecto irreversible, ya asumido

Al optar por salir, los servicios de IA **borran el contenido histórico** que hubieran almacenado con fines de mejora. Era el objetivo, y no tuvo costo: a la fecha de aplicación el demo nunca había procesado una imagen real.

## Cuándo volver a verificar

Regenerar esta evidencia —y actualizar este archivo— cuando:

- se agregue una cuenta a la organización (la política está adjunta al **root**, así que debería alcanzarla sola, pero conviene comprobarlo en vez de suponerlo);
- se cambie `infra/politica-opt-out-ia.json`;
- antes de cada auditoría o revisión de cumplimiento;
- antes de encender `INTEGRATION_IDENTITY=live` en un entorno nuevo.

El script es idempotente: correrlo de nuevo verifica sin romper nada.
