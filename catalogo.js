/* catalogo.js: trae del Worker los productos del catálogo y arma las tarjetas.
 *
 * Va al final de index.html, con la dirección del catálogo y el WhatsApp:
 *
 *     <script src="catalogo.js" data-catalogo="dulces-de-la-isla" data-numero="5492215550000"></script>
 *
 * Así, lo que se cambia en el editor aparece solo, sin volver a correr Python ni
 * subir nada. Si el catálogo todavía no tiene productos cargados en el editor, o
 * no hay internet, queda la página tal como la armó Python.
 *
 * Arma las tarjetas igual que tarjeta() de Python, con las mismas clases, así
 * estilos.css les queda bien a las dos. El texto va siempre con textContent:
 * nunca se interpreta como HTML, escriban lo que escriban en el editor.
 *
 * Este archivo es el mismo en el proyecto de la clase y en el repo de los
 * catálogos del CFP. Si cambia, se copia a los dos.
 */
(function () {
    var WORKER = 'https://catalogos.maxinunez434.workers.dev';
    // Para probar con el Worker local (wrangler dev): solo desde localhost, y a propósito.
    // Se activa una vez con ?worker=http://127.0.0.1:8787 en la dirección, y ?worker=no lo apaga.
    try {
        if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
            var pedido = new URLSearchParams(location.search).get('worker');
            if (pedido === 'no') localStorage.removeItem('catalogos:worker');
            else if (pedido) localStorage.setItem('catalogos:worker', pedido);
            if (localStorage.getItem('catalogos:worker')) WORKER = localStorage.getItem('catalogos:worker');
        }
    } catch (e) { /* sin almacenamiento: el Worker de siempre */ }

    function precio(texto) {
        var numero = String(texto || '').replace(/\D/g, '');
        if (!numero) return '';
        return '$' + Number(numero).toLocaleString('es-AR');
    }

    function linkWhatsapp(numero, nombre) {
        return 'https://wa.me/' + numero + '?text=' + encodeURIComponent('Hola, quiero consultar por: ' + nombre);
    }

    /* Una foto del editor ("w:...") vive en el Worker; cualquier otra, en la carpeta fotos/. */
    function fotoSrc(foto) {
        if (!foto) return '';
        if (foto.indexOf('w:') === 0) return WORKER + '/foto/' + foto.slice(2);
        return 'fotos/' + foto;
    }

    /* El encuadre que se eligió en el editor: qué parte de la foto se ve, y cuánto se acerca.
     * Es el mismo en el editor y en el catálogo, así se ve igual en los dos. */
    function aplicarEncuadre(img, encuadre) {
        var e = encuadre || { x: 50, y: 50, zoom: 1 };
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.objectPosition = e.x + '% ' + e.y + '%';
        img.style.transformOrigin = e.x + '% ' + e.y + '%';
        img.style.transform = 'scale(' + e.zoom + ')';
    }

    function elemento(etiqueta, clase, texto) {
        var e = document.createElement(etiqueta);
        if (clase) e.className = clase;
        if (texto) e.textContent = texto;
        return e;
    }

    function tarjeta(producto, numero) {
        var art = elemento('article', 'producto');
        var src = fotoSrc(producto.foto);
        if (src) {
            // La foto va adentro del círculo, para poder moverla y acercarla sin que se salga
            var circulo = elemento('div', 'producto__foto');
            var img = elemento('img', '');
            img.src = src;
            img.alt = producto.nombre;
            img.loading = 'lazy';
            aplicarEncuadre(img, producto.encuadre);
            circulo.appendChild(img);
            art.appendChild(circulo);
        } else {
            art.appendChild(elemento('div', 'producto__foto', producto.emoji || '🛍️'));
        }
        art.appendChild(elemento('h2', '', producto.nombre));
        if (producto.descripcion) art.appendChild(elemento('p', 'descripcion', producto.descripcion));
        if (producto.detalles && producto.detalles.length) {
            var ul = elemento('ul', 'detalles');
            producto.detalles.forEach(function (d) {
                var li = document.createElement('li');
                li.appendChild(elemento('strong', '', d[0] + ':'));
                li.appendChild(document.createTextNode(' ' + d[1]));
                ul.appendChild(li);
            });
            art.appendChild(ul);
        }
        var p = precio(producto.precio);
        if (p) art.appendChild(elemento('p', 'precio', p));
        if (numero) {
            var a = elemento('a', 'consultar', 'Consultar por WhatsApp');
            a.href = linkWhatsapp(numero, producto.nombre);
            a.target = '_blank';
            art.appendChild(a);
        }
        return art;
    }

    /* Cómo se ve, si se eligió en el editor: los colores y la foto de fondo pisan las variables de
     * estilos.css, y el nombre y el WhatsApp, los que puso Python. Sin aspecto, no cambia nada. */
    function aplicarAspecto(a) {
        if (!a) return;
        var raiz = document.documentElement.style;
        var variables = {
            '--fondo': a.fondo, '--texto': a.texto, '--acento': a.acento, '--marca': a.marca,
            '--sobre-acento': a.sobreAcento, '--linea': a.acento,
            '--imagen-de-fondo': a.imagen ? 'url("' + fotoSrc(a.imagen) + '")' : 'none',
            '--velo': a.imagen ? String(a.velo) : '0',
        };
        Object.keys(variables).forEach(function (k) { if (variables[k]) raiz.setProperty(k, variables[k]); });
        if (a.nombre) {
            var h1 = document.querySelector('.encabezado h1');
            if (h1) h1.textContent = a.nombre;
            document.title = a.nombre;
        }
        if (a.numero) {
            document.querySelectorAll('.contacto a.consultar').forEach(function (enlace) {
                if (enlace.href.indexOf('wa.me/') >= 0) enlace.href = 'https://wa.me/' + a.numero;
            });
        }
    }

    function pintar(main, productos, numero) {
        main.replaceChildren.apply(main, productos.map(function (p) { return tarjeta(p, numero); }));
    }

    window.Catalogo = {
        WORKER: WORKER, precio: precio, fotoSrc: fotoSrc, aplicarEncuadre: aplicarEncuadre,
        aplicarAspecto: aplicarAspecto, tarjeta: tarjeta, pintar: pintar,
    };

    var script = document.currentScript;
    var slug = script && script.dataset.catalogo;
    if (!slug) return;
    var numero = script.dataset.numero || '';
    var main = document.querySelector('main.catalogo');
    if (!main) return;

    /* Una página sin productos propios (la de un emprendimiento) dice "Cargando…" mientras espera. */
    function sinProductos(texto) {
        if (main.classList.contains('catalogo--cargando')) main.replaceChildren(elemento('p', 'descripcion', texto));
    }

    fetch(WORKER + '/catalogo/' + encodeURIComponent(slug))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (datos) {
            if (datos && datos.aspecto) {
                aplicarAspecto(datos.aspecto);
                if (datos.aspecto.numero) numero = datos.aspecto.numero;
            }
            if (datos && datos.productos && datos.productos.length) pintar(main, datos.productos, numero);
            else sinProductos('Muy pronto, los productos.');
        })
        .catch(function () { sinProductos('No se pudieron cargar los productos. Probá de nuevo en un rato.'); });
})();
