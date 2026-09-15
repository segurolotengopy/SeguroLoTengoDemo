# Nota para programación

## Criterio de aceptación

Una vista implementada cumple cuando:

1. conserva el código del arte aprobado;
2. reproduce la jerarquía, distribución, tipografía, colores, proporciones y logotipos del PNG correspondiente;
3. respeta campos, obligatoriedad, validaciones, estados y transiciones del JSON;
4. es responsive, priorizando la experiencia móvil aprobada;
5. registra los cambios de datos extraídos cuando corresponda;
6. no permite avanzar si falta un consentimiento o campo obligatorio;
7. no convierte una evaluación manual en rechazo automático;
8. no solicita firma ni pago cuando el caso está en revisión manual;
9. no inicia cobertura antes de que el pago esté acreditado;
10. mantiene separados los estados de error, procesamiento y éxito.

## Reglas de interfaz congeladas

- Fuente principal: Nimbus Sans.
- Paleta: `#071F78`, `#FF1721`, `#0876F9`, `#55709D` y blanco.
- Cinco macroetapas visibles durante la contratación.
- CTA principal roja y situada de forma consistente.
- Dos marcas en portada y tres marcas a partir de la contratación.
- Usar el nuevo logotipo SeguroLoTengo respetando exactamente sus proporciones.
- No agregar sombra naranja, diagonal roja ni líneas decorativas no aprobadas.
- Todo campo visible se considera obligatorio salvo regla expresa distinta en el JSON aprobado.

## Regla de trazabilidad

Cada componente, historia o caso de prueba debe conservar como referencia:

```text
screen_code + state_code + original_filename
```

El hash SHA-256 del manifiesto permite comprobar que el PNG de referencia no fue sustituido ni modificado.
