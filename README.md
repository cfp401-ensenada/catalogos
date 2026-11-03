# Catálogos del CFP 401

Catálogos en internet para emprendimientos de estudiantes del CFP 401, hechos en el curso de
Pensamiento Computacional. Se publican con GitHub Pages en
`https://cfp401-ensenada.github.io/catalogos/`.

## Cómo funciona

| Qué | Dónde |
|---|---|
| Los productos y las fotos de cada catálogo | El Worker `catalogos` de Cloudflare (`worker/catalogos.js` en el repo del curso) |
| La página de cada emprendimiento | Una carpeta por catálogo: `dulces-de-la-isla/index.html` |
| Los estilos y el script que arma las tarjetas | `estilos.css` y `catalogo.js`, compartidos por todas las carpetas |
| Cambiar productos | `editar/`: se entra con el código de cada catálogo |
| Dar de alta y regenerar códigos | `admin/`: pide la clave de administración |

## Dar de alta un emprendimiento

1. En `admin/`, **Dar de alta**: nombre y dirección. Sale el código y el mensaje para mandarle.
2. **Armar la carpeta del catálogo**: abre el panel del curso con los datos cargados. Se eligen el
   WhatsApp, los colores y la foto de fondo, y se descarga la carpeta.
3. Se sube esa carpeta a este repo (**Add file → Upload files**, arrastrando la carpeta entera).
4. En uno o dos minutos está en `https://cfp401-ensenada.github.io/catalogos/<dirección>/`.

## No se editan acá

`estilos.css` y `catalogo.js` salen del repo del curso (`public/proyecto-catalogo/`), porque los
usan también los catálogos de los alumnos. `colores.js` (que los colores se lean, las paletas) sale
de `src/scripts/colores.js`, porque lo usa también el panel del curso. Si cambian, se copian de allá.
