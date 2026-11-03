/* Los colores de un catálogo: que se lean, paletas listas y una paleta sacada de una foto.
 *
 * Lo usan el panel que arma el catálogo (src/scripts/armar-catalogo.ts) y el editor de los
 * catálogos (repo cfp401-ensenada/catalogos, que tiene una copia de este archivo). Si cambia,
 * se copia allá, como catalogo.js.
 *
 * El contraste es la cuenta de las pautas de accesibilidad (WCAG): de 1 (iguales) a 21 (negro
 * sobre blanco). Para leer texto común hace falta 4,5; para letras grandes o en negrita, 3.
 */

function rgb(color) {
    return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
}

function hex(c) {
    return '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function luminancia(color) {
    const [r, g, b] = rgb(color).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
    const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
    return (claro + 0.05) / (oscuro + 0.05);
}

/* Lleva el color hacia el negro (o el blanco, sobre un fondo oscuro) de a poco, hasta que se lea. */
function legible(color, fondo, minimo) {
    if (contraste(color, fondo) >= minimo) return color;
    const destino = luminancia(fondo) > 0.18 ? [0, 0, 0] : [255, 255, 255];
    const origen = rgb(color);
    for (let t = 0.05; t <= 1; t += 0.05) {
        const mezcla = hex(origen.map((v, i) => v + (destino[i] - v) * t));
        if (contraste(mezcla, fondo) >= minimo) return mezcla;
    }
    return hex(destino);
}

/* El acento es el color de las letras del botón, sobre el fondo de la página: tiene que leerse como
 * cualquier texto. Las letras del precio, que van encima del acento, son blancas si se leen; si no,
 * del color del fondo, que ya se lee seguro (es justo el par que se acaba de ajustar). */
function acentoLegible(acento, fondo) {
    return legible(acento, fondo, 4.5);
}

function sobreAcento(acento, fondo) {
    return contraste('#ffffff', acento) >= 4.5 ? '#ffffff' : fondo;
}

/* Los de estilos.css: el diseño de la clase, que queda tal cual si nadie los cambia. */
export const DE_LA_CLASE = { fondo: '#d3cac8', texto: '#5b6844', acento: '#5f6f45' };

/* De { fondo, texto, acento } elegidos a los que se usan: ajustados para que se lean, salvo que se
 * pida respetarColores. Devuelve también la marca, las letras sobre el acento y los avisos. */
export function coloresLegibles(d) {
    const sinTocar = d.fondo === DE_LA_CLASE.fondo && d.texto === DE_LA_CLASE.texto && d.acento === DE_LA_CLASE.acento;
    if (sinTocar) return { ...DE_LA_CLASE, marca: '#ffffff', sobreAcento: '#ffffff', avisos: [] };
    const blancoSeLee = contraste('#ffffff', d.fondo) >= 3;
    if (d.respetarColores) {
        const marca = blancoSeLee ? '#ffffff' : d.acento;
        return { fondo: d.fondo, texto: d.texto, acento: d.acento, marca, sobreAcento: '#ffffff', avisos: [] };
    }
    const texto = legible(d.texto, d.fondo, 4.5);
    const acento = acentoLegible(d.acento, d.fondo);
    // Sobre un fondo claro el nombre va del color de los botones: con su color, y ya ajustado para que se lea
    const marca = blancoSeLee ? '#ffffff' : acento;
    const avisos = [];
    if (texto !== d.texto) {
        avisos.push(`Las letras casi no se leían sobre ese fondo: las ${luminancia(d.fondo) > 0.18 ? 'oscurecí' : 'aclaré'} un poco.`);
    }
    if (acento !== d.acento) avisos.push('El color de los botones y el precio no se distinguía bien: lo ajusté para que se lean.');
    return { fondo: d.fondo, texto, acento, marca, sobreAcento: sobreAcento(acento, d.fondo), avisos };
}

/* Los arreglos de un botón: las letras que se leen sobre ese fondo, o el fondo sobre el que se leen esas letras. */
export function arreglarLetras(fondo, texto) {
    return legible(texto, fondo, 4.5);
}

export function arreglarFondo(fondo, texto) {
    return legible(fondo, texto, 4.5);
}

/* Paletas listas, para quien no sabe qué elegir. Las cinco primeras son las de los catálogos del CFP. */
export const PALETAS = [
    { nombre: 'Natural', fondo: '#d3cac8', texto: '#4d583a', acento: '#4c5937' },
    { nombre: 'Dulce', fondo: '#f6dfe4', texto: '#6d2c3f', acento: '#a8324f' },
    { nombre: 'Mar', fondo: '#d8ecf3', texto: '#1f4e63', acento: '#1f6f8b' },
    { nombre: 'Elegante', fondo: '#1f1f1f', texto: '#e8e2d0', acento: '#9d8343' },
    { nombre: 'Alegre', fondo: '#fff1d6', texto: '#7a3e00', acento: '#af4d09' },
    { nombre: 'Lavanda', fondo: '#ece6f6', texto: '#3f2d63', acento: '#6a4c9c' },
    { nombre: 'Terracota', fondo: '#f4e3d7', texto: '#5a2e1c', acento: '#a8492a' },
    { nombre: 'Bosque', fondo: '#1e2b22', texto: '#e3eadf', acento: '#779e80' },
    { nombre: 'Café', fondo: '#efe4d6', texto: '#4b3426', acento: '#7b4b2a' },
    { nombre: 'Noche', fondo: '#18202f', texto: '#e6e9f0', acento: '#6f89c5' },
    { nombre: 'Chicle', fondo: '#ffe3ef', texto: '#6b1d3d', acento: '#b82e67' },
    { nombre: 'Menta', fondo: '#e2f4ec', texto: '#1d4a3a', acento: '#2a7a5c' },
];

/* Una paleta a partir de una foto: el color promedio, aclarado para el fondo y oscurecido para el resto. */
export async function paletaDeFoto(archivo) {
    const bmp = await createImageBitmap(archivo);
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 24;
    const ctx = lienzo.getContext('2d');
    ctx.drawImage(bmp, 0, 0, 24, 24);
    const px = ctx.getImageData(0, 0, 24, 24).data;
    const suma = [0, 0, 0];
    for (let i = 0; i < px.length; i += 4) for (let k = 0; k < 3; k++) suma[k] += px[i + k];
    const promedio = suma.map((v) => v / (px.length / 4));
    const hacia = (destino, t) => hex(promedio.map((v) => v + (destino - v) * t));
    const fondo = hacia(255, 0.78);
    return { nombre: 'De tu foto', fondo, texto: legible(hacia(0, 0.7), fondo, 4.5), acento: acentoLegible(hacia(0, 0.35), fondo) };
}
