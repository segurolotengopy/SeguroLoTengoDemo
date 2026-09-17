#!/usr/bin/env python3
"""Arma los PDF de pantallas a partir de las capturas de Playwright.

Las capturas las genera `e2e/98-capturas-gerencia.spec.ts`:

    CAPTURAS_GERENCIA=1 npx playwright test e2e/98-capturas-gerencia.spec.ts
    CAPTURAS_GERENCIA=1 CAPTURAS_MOVIL=1 npx playwright test e2e/98-capturas-gerencia.spec.ts

y quedan en `pantallas/capturas` (escritorio, 1456 px) y `pantallas/capturas-movil`
(celular, 390 px a densidad 2x). Este script las junta en un PDF por formato.

## Las dos decisiones que tiene adentro

**Escritorio: una pantalla, una página.** Las capturas son de página completa y
miden entre 900 y 1610 px de alto; todas las páginas del PDF salen con el alto
de la más alta, así el zoom del lector no salta en cada vuelta de hoja.

**Celular: una pantalla, varias páginas.** Ahí las capturas llegan a 6870 px de
alto —una pantalla de celular es un rollo largo— y meterlas en una sola página
daría una hoja imposible de leer o un texto microscópico. Se cortan en tajadas
del alto de un viewport real, con superposición, para que ninguna línea quede
partida entre dos hojas. Cada tajada dice de qué pantalla es y cuál de cuántas.

Requiere Pillow (`pip install pillow`). No es dependencia del proyecto: esto es
una herramienta de entrega, no parte de la aplicación.

Uso:  python3 scripts/armar-pdf-pantallas.py
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
# La fecha va en la portada: gerencia recibe una prueba de funcionamiento con
# fecha, no una maqueta sin tiempo.
FECHA_CORRIDA = date.today().strftime("%d-%m-%Y")
FUENTE_NEGRITA = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FUENTE_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Paleta v4 de `docs/GUIA_DE_ESTILOS.md` §8 (navy, rojo, azul apagado), para
# que la portada y las bandas no desentonen con lo que muestran.
NARANJA = (255, 23, 33)  # rojo v4 (#FF1721): el acento del arte
AZUL = (7, 31, 120)  # navy v4 (#071F78)
TINTA = (51, 51, 51)
ETIQUETA = (85, 112, 157)  # azul apagado v4 (#55709D)
BLANCO = (255, 255, 255)
BORDE = (224, 224, 224)

# Cómo se llama cada captura en el PDF. La clave es el nombre del archivo que
# escribe `98-capturas-gerencia.spec.ts` (doce pantallas v4 + las dos
# derivadas). El orden alfabético de los archivos es el orden del recorrido.
NOMBRES: dict[str, str] = {
    "01-portada": "01 · Portada y catálogo de productos",
    "02-plan": "02 · Elegí tu plan (etapa 1 de 5)",
    "03a-whatsapp": "03A · Verificá tu WhatsApp (etapa 2 de 5)",
    "03b-preparacion": "03B · Prepará lo necesario (etapa 2 de 5)",
    "03c-identidad": "03C · Verificá tu identidad (etapa 2 de 5)",
    "03d-datos": "03D · Completá tus datos (etapa 2 de 5)",
    "03e-actividad": "03E · Actividad e ingresos (etapa 3 de 5)",
    "04a-declaraciones": "04A · Declaraciones de salud (etapa 4 de 5)",
    "04d-consentimientos": "04D · Consentimientos (etapa 4 de 5)",
    "04e-firma": "04E · Revisá, aceptá y firmá (etapa 4 de 5)",
    "05a-pago": "05A · Realizá el pago (etapa 5 de 5)",
    "05b-confirmacion": "05B · Contratación confirmada (etapa 5 de 5)",
    "pantalla-a-revision-manual": "Pantalla A · Derivación a revisión manual",
    "pantalla-b-solicitud-vencida": "Pantalla B · Solicitud vencida",
}

ALTO_BANDA = 64
MARGEN = 24


def fuente(ruta: str, tamano: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(ruta, tamano)
    except OSError:
        return ImageFont.load_default()


def banda(pagina: Image.Image, titulo: str, subtitulo: str) -> None:
    """Franja superior con el nombre de la pantalla."""
    dibujo = ImageDraw.Draw(pagina)
    ancho = pagina.size[0]
    dibujo.rectangle([0, 0, ancho, ALTO_BANDA], fill=BLANCO)
    dibujo.line([0, ALTO_BANDA - 1, ancho, ALTO_BANDA - 1], fill=BORDE, width=2)
    dibujo.text((MARGEN, 18), titulo, font=fuente(FUENTE_NEGRITA, 26), fill=AZUL)
    if subtitulo:
        derecha = ancho - MARGEN
        texto = fuente(FUENTE_REGULAR, 20)
        largo = dibujo.textlength(subtitulo, font=texto)
        dibujo.text((derecha - largo, 22), subtitulo, font=texto, fill=ETIQUETA)


def portada(ancho: int, alto: int, formato: str) -> Image.Image:
    pagina = Image.new("RGB", (ancho, alto), BLANCO)
    dibujo = ImageDraw.Draw(pagina)
    y = alto // 3
    dibujo.text((MARGEN * 2, y), "SeguroLoTengo", font=fuente(FUENTE_NEGRITA, 64), fill=NARANJA)
    dibujo.text(
        (MARGEN * 2, y + 84),
        "Camino feliz · las doce pantallas del flujo v4 y las dos derivadas",
        font=fuente(FUENTE_NEGRITA, 34),
        fill=TINTA,
    )
    dibujo.text(
        (MARGEN * 2, y + 136),
        formato,
        font=fuente(FUENTE_REGULAR, 28),
        fill=ETIQUETA,
    )
    dibujo.text(
        (MARGEN * 2, y + 200),
        "Prueba de funcionamiento: corrida automatizada de punta a punta (Playwright)",
        font=fuente(FUENTE_REGULAR, 22),
        fill=ETIQUETA,
    )
    dibujo.text(
        (MARGEN * 2, y + 230),
        "sobre el sistema real, con integraciones simuladas y datos ficticios.",
        font=fuente(FUENTE_REGULAR, 22),
        fill=ETIQUETA,
    )
    dibujo.text(
        (MARGEN * 2, y + 276),
        f"Seguro de Vida Oncológico VIVE · corrida del {FECHA_CORRIDA}",
        font=fuente(FUENTE_REGULAR, 24),
        fill=ETIQUETA,
    )
    dibujo.text(
        (MARGEN * 2, y + 312),
        "Interseguros S.A. · Corredores de Seguros · Matrícula SIS N° 118",
        font=fuente(FUENTE_REGULAR, 24),
        fill=ETIQUETA,
    )
    return pagina


def capturas(carpeta: Path) -> list[tuple[str, Path]]:
    archivos = sorted(carpeta.glob("*.jpg"))
    if not archivos:
        raise SystemExit(f"No hay capturas en {carpeta}. Corré primero el spec de capturas.")
    return [(a.stem, a) for a in archivos]


def paginas_escritorio(carpeta: Path) -> list[Image.Image]:
    """Una pantalla, una página. Todas del mismo alto para que el zoom no salte."""
    entradas = capturas(carpeta)
    imagenes = [(clave, Image.open(ruta).convert("RGB")) for clave, ruta in entradas]
    ancho = max(im.size[0] for _, im in imagenes)
    alto = max(im.size[1] for _, im in imagenes) + ALTO_BANDA

    paginas = [portada(ancho, alto, "Formato escritorio · 1456 px de ancho")]
    for clave, imagen in imagenes:
        pagina = Image.new("RGB", (ancho, alto), BLANCO)
        pagina.paste(imagen, ((ancho - imagen.size[0]) // 2, ALTO_BANDA))
        banda(pagina, NOMBRES.get(clave, clave), "")
        paginas.append(pagina)
        imagen.close()
    return paginas


def paginas_movil(carpeta: Path, alto_viewport: int = 1688, superposicion: int = 140) -> list[Image.Image]:
    """Una pantalla, varias páginas: tajadas del alto de un viewport, con solape."""
    entradas = capturas(carpeta)
    ancho = 0
    for _, ruta in entradas:
        with Image.open(ruta) as im:
            ancho = max(ancho, im.size[0])
    alto = alto_viewport + ALTO_BANDA

    paginas = [portada(ancho, alto, "Formato celular · 390 px de ancho (densidad 2x)")]
    for clave, ruta in entradas:
        with Image.open(ruta) as imagen:
            imagen = imagen.convert("RGB")
            avance = alto_viewport - superposicion
            cortes = list(range(0, max(imagen.size[1] - superposicion, 1), avance))
            for indice, arriba in enumerate(cortes, start=1):
                tajada = imagen.crop((0, arriba, imagen.size[0], min(arriba + alto_viewport, imagen.size[1])))
                pagina = Image.new("RGB", (ancho, alto), BLANCO)
                pagina.paste(tajada, ((ancho - tajada.size[0]) // 2, ALTO_BANDA))
                banda(
                    pagina,
                    NOMBRES.get(clave, clave),
                    f"{indice} de {len(cortes)}" if len(cortes) > 1 else "",
                )
                paginas.append(pagina)
    return paginas


def guardar(paginas: list[Image.Image], destino: Path, dpi: int) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    paginas[0].save(
        destino,
        "PDF",
        save_all=True,
        append_images=paginas[1:],
        resolution=dpi,
        quality=85,
    )
    print(f"{destino}  ·  {len(paginas)} páginas  ·  {destino.stat().st_size // 1024} kB")


def main() -> int:
    guardar(
        paginas_escritorio(RAIZ / "pantallas" / "capturas"),
        RAIZ / "pantallas" / "SeguroLoTengo-camino-feliz-web.pdf",
        dpi=150,
    )
    guardar(
        paginas_movil(RAIZ / "pantallas" / "capturas-movil"),
        RAIZ / "pantallas" / "SeguroLoTengo-camino-feliz-movil.pdf",
        dpi=200,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
