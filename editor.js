/* El editor de los catálogos: entrar con el código, cambiar productos y guardar.
 *
 * Los cambios quedan en esta página hasta tocar "Guardar cambios": ahí se manda la
 * lista entera al Worker, que la limpia y la guarda. Las fotos se achican acá,
 * antes de subirlas, para que el catálogo abra rápido con datos móviles.
 *
 * Es un módulo para poder usar colores.js, el mismo que usa el panel del curso.
 */
import { DE_LA_CLASE, PALETAS, coloresLegibles, paletaDeFoto } from './colores.js';

(function () {
    var WORKER = window.Catalogo.WORKER;
    var LS_CODIGO = 'catalogos:codigo';
    var $ = function (id) { return document.getElementById(id); };

    var codigo = '';
    var catalogo = null;
    var productos = [];
    var sinGuardar = false;
    var editando = -1;
    var fotoFicha = '';
    var CENTRO = { x: 50, y: 50, zoom: 1 };
    var encuadreFicha = CENTRO;
    var aspecto = null; // cómo se ve: null es el diseño con el que se armó

    function guardarLocal(clave, valor) {
        try {
            if (valor) localStorage.setItem(clave, valor);
            else localStorage.removeItem(clave);
        } catch (e) { /* sin almacenamiento: se vuelve a escribir el código */ }
    }
    function leerLocal(clave) {
        try { return localStorage.getItem(clave) || ''; } catch (e) { return ''; }
    }

    function formatoCodigo(texto) {
        var c = String(texto).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        return c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4) : c;
    }

    /* Igual que en el Worker: "Táza " y "TAZA" son el mismo producto. */
    function claveDe(nombre) {
        return String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toUpperCase().replace(/\s+/g, ' ').trim();
    }

    function pedir(ruta, opciones) {
        return fetch(WORKER + ruta, opciones).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (datos) {
                if (!r.ok) throw new Error(datos.error || 'No se pudo conectar. Probá de nuevo en un rato.');
                return datos;
            });
        });
    }

    /* ---------- Entrar ---------- */
    $('codigo').addEventListener('input', function (e) {
        e.target.value = formatoCodigo(e.target.value);
    });

    function entrar(c, silencioso) {
        $('error-entrar').textContent = '';
        return pedir('/entrar', { method: 'POST', body: JSON.stringify({ codigo: c }) })
            .then(function (cat) {
                codigo = c;
                catalogo = cat;
                productos = cat.productos.map(function (p) { return JSON.parse(JSON.stringify(p)); });
                aspecto = cat.aspecto || null;
                if ($('recordar').checked) guardarLocal(LS_CODIGO, c);
                mostrarEditor();
            })
            .catch(function (error) {
                if (silencioso) guardarLocal(LS_CODIGO, '');
                else $('error-entrar').textContent = error.message;
            });
    }

    $('form-entrar').addEventListener('submit', function (e) {
        e.preventDefault();
        entrar(formatoCodigo($('codigo').value), false);
    });

    $('salir').addEventListener('click', function () {
        if (sinGuardar && !window.confirm('Hay cambios sin guardar. ¿Salir igual?')) return;
        guardarLocal(LS_CODIGO, '');
        location.reload();
    });

    function mostrarEditor() {
        $('entrar').hidden = true;
        $('editor').hidden = false;
        $('barra').hidden = false;
        $('nombre-cat').textContent = catalogo.nombre;
        document.title = catalogo.nombre + ' · Editar';
        if (catalogo.enlace) $('ver').href = catalogo.enlace;
        else $('ver').hidden = true;
        marcar(false);
        pintarLista();
    }

    /* ---------- La lista ---------- */
    function miniatura(p) {
        var caja = document.createElement('span');
        caja.className = 'mini';
        if (p.foto && p.foto.indexOf('w:') === 0) {
            var img = document.createElement('img');
            img.src = window.Catalogo.fotoSrc(p.foto);
            img.alt = '';
            window.Catalogo.aplicarEncuadre(img, p.encuadre);
            caja.appendChild(img);
        } else {
            caja.textContent = p.foto ? '📁' : (p.emoji || '🛍️');
            if (p.foto) caja.title = 'La foto ' + p.foto + ' está en la carpeta fotos/ de tu proyecto';
        }
        return caja;
    }

    function boton(texto, etiqueta, accion) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'flecha';
        b.textContent = texto;
        b.setAttribute('aria-label', etiqueta);
        b.addEventListener('click', function (e) { e.stopPropagation(); accion(); });
        return b;
    }

    function mover(i, paso) {
        var j = i + paso;
        if (j < 0 || j >= productos.length) return;
        var p = productos.splice(i, 1)[0];
        productos.splice(j, 0, p);
        marcar(true);
        pintarLista();
    }

    function pintarLista() {
        var lista = $('lista');
        lista.replaceChildren();
        $('vacio').hidden = productos.length > 0;
        productos.forEach(function (p, i) {
            var li = document.createElement('li');
            var abrir = document.createElement('button');
            abrir.type = 'button';
            abrir.className = 'fila';
            abrir.appendChild(miniatura(p));
            var textos = document.createElement('span');
            textos.className = 'fila-textos';
            var nombre = document.createElement('strong');
            nombre.textContent = p.nombre;
            var precio = document.createElement('span');
            precio.textContent = window.Catalogo.precio(p.precio) || 'Sin precio';
            textos.append(nombre, precio);
            abrir.appendChild(textos);
            abrir.addEventListener('click', function () { abrirFicha(i); });
            li.appendChild(abrir);
            li.appendChild(boton('↑', 'Subir ' + p.nombre, function () { mover(i, -1); }));
            li.appendChild(boton('↓', 'Bajar ' + p.nombre, function () { mover(i, 1); }));
            lista.appendChild(li);
        });
    }

    /* ---------- La ficha de un producto ---------- */
    function filaDato(clave, valor) {
        var fila = document.createElement('div');
        fila.className = 'dato';
        var c = document.createElement('input');
        c.placeholder = 'Material';
        c.maxLength = 30;
        c.value = clave || '';
        c.setAttribute('aria-label', 'Nombre del dato');
        var v = document.createElement('input');
        v.placeholder = 'PLA';
        v.maxLength = 120;
        v.value = valor || '';
        v.setAttribute('aria-label', 'Valor del dato');
        var x = document.createElement('button');
        x.type = 'button';
        x.className = 'flecha';
        x.textContent = '✕';
        x.setAttribute('aria-label', 'Sacar este dato');
        x.addEventListener('click', function () { fila.remove(); });
        fila.append(c, v, x);
        $('f-detalles').appendChild(fila);
    }

    function pintarFoto() {
        var vista = $('f-vista');
        vista.replaceChildren();
        var subida = fotoFicha && fotoFicha.indexOf('w:') === 0;
        if (subida) {
            var img = document.createElement('img');
            img.src = window.Catalogo.fotoSrc(fotoFicha);
            img.alt = '';
            img.draggable = false;
            window.Catalogo.aplicarEncuadre(img, encuadreFicha);
            vista.appendChild(img);
        } else {
            vista.textContent = fotoFicha ? '📁' : ($('f-emoji').value || '🛍️');
        }
        // El encuadre, solo para las fotos subidas acá: las de la carpeta fotos/ no se ven desde el editor
        vista.classList.toggle('movible', Boolean(subida));
        $('f-encuadre').hidden = !subida;
        $('f-zoom').value = encuadreFicha.zoom;
        $('f-sacar-foto').hidden = !fotoFicha;
        $('f-foto-estado').textContent = fotoFicha && fotoFicha.indexOf('w:') !== 0
            ? 'Es la de tu carpeta fotos/: ' + fotoFicha
            : '';
    }

    function abrirFicha(i) {
        editando = i;
        var p = i >= 0 ? productos[i] : { nombre: '', precio: '', descripcion: '', emoji: '', foto: '', detalles: [] };
        $('ficha-titulo').textContent = i >= 0 ? 'Cambiar producto' : 'Producto nuevo';
        $('f-nombre').value = p.nombre;
        $('f-precio').value = p.precio;
        $('f-descripcion').value = p.descripcion;
        $('f-emoji').value = p.emoji;
        fotoFicha = p.foto;
        encuadreFicha = p.encuadre ? { x: p.encuadre.x, y: p.encuadre.y, zoom: p.encuadre.zoom } : CENTRO;
        $('f-detalles').replaceChildren();
        (p.detalles || []).forEach(function (d) { filaDato(d[0], d[1]); });
        $('f-borrar').hidden = i < 0;
        $('f-borrar').textContent = 'Sacar este producto';
        delete $('f-borrar').dataset.seguro;
        $('error-ficha').textContent = '';
        pintarFoto();
        $('ficha').showModal();
        if (i < 0) $('f-nombre').focus();
    }

    $('nuevo').addEventListener('click', function () { abrirFicha(-1); });
    $('f-cancelar').addEventListener('click', function () { $('ficha').close(); });
    $('f-mas-dato').addEventListener('click', function () { filaDato('', ''); });
    $('f-emoji').addEventListener('input', pintarFoto);
    $('f-precio').addEventListener('input', function (e) { e.target.value = e.target.value.replace(/\D/g, ''); });
    $('f-sacar-foto').addEventListener('click', function () { fotoFicha = ''; encuadreFicha = CENTRO; pintarFoto(); });

    /* ---------- El encuadre: arrastrar para mover, la barra para acercar ----------
     * Lo usan la foto de cada producto y la foto de fondo: "leer" da el encuadre de ahora y
     * "poner" recibe el nuevo (ya dentro de los límites) y lo dibuja. */
    function limitarEncuadre(cambio) {
        return {
            x: Math.min(100, Math.max(0, cambio.x)),
            y: Math.min(100, Math.max(0, cambio.y)),
            zoom: Math.min(3, Math.max(1, cambio.zoom)),
        };
    }

    function encuadrable(vistas, barra, centrar, leer, poner) {
        var arrastre = null;
        vistas.forEach(function (vista) {
            vista.addEventListener('pointerdown', function (e) {
                if (!vista.classList.contains('movible')) return;
                e.preventDefault(); // que arrastrar no seleccione texto
                arrastre = { x: e.clientX, y: e.clientY, desde: leer(), vista: vista };
                vista.setPointerCapture(e.pointerId);
            });
            vista.addEventListener('pointermove', function (e) {
                if (!arrastre || arrastre.vista !== vista) return;
                // Arrastrar a la derecha muestra lo que estaba a la izquierda: por eso se resta
                var d = arrastre.desde;
                poner(limitarEncuadre({
                    x: d.x - (e.clientX - arrastre.x) * 100 / vista.clientWidth / d.zoom,
                    y: d.y - (e.clientY - arrastre.y) * 100 / vista.clientHeight / d.zoom,
                    zoom: d.zoom,
                }));
            });
            ['pointerup', 'pointercancel'].forEach(function (tipo) {
                vista.addEventListener(tipo, function () { arrastre = null; });
            });
        });
        barra.addEventListener('input', function () {
            var e = leer();
            poner(limitarEncuadre({ x: e.x, y: e.y, zoom: Number(barra.value) }));
        });
        centrar.addEventListener('click', function () {
            poner(CENTRO);
            barra.value = 1;
        });
    }

    encuadrable([$('f-vista')], $('f-zoom'), $('f-centrar'),
        function () { return encuadreFicha; },
        function (nuevo) {
            encuadreFicha = nuevo;
            var img = $('f-vista').querySelector('img');
            if (img) window.Catalogo.aplicarEncuadre(img, encuadreFicha);
        });

    $('f-borrar').addEventListener('click', function (e) {
        var b = e.target;
        if (!b.dataset.seguro) {
            b.dataset.seguro = '1';
            b.textContent = '¿Seguro? Tocá de nuevo';
            return;
        }
        productos.splice(editando, 1);
        marcar(true);
        pintarLista();
        $('ficha').close();
    });

    $('form-ficha').addEventListener('submit', function (e) {
        e.preventDefault();
        var nombre = $('f-nombre').value.trim();
        if (!nombre) { $('error-ficha').textContent = 'Falta el nombre.'; return; }
        var repetido = productos.some(function (p, j) { return j !== editando && claveDe(p.nombre) === claveDe(nombre); });
        if (repetido) {
            $('error-ficha').textContent = 'Ya hay un producto que se llama así. Para cambiarlo, tocalo en la lista.';
            return;
        }
        var detalles = [];
        $('f-detalles').querySelectorAll('.dato').forEach(function (fila) {
            var campos = fila.querySelectorAll('input');
            var clave = campos[0].value.trim(), valor = campos[1].value.trim();
            if (clave && valor) detalles.push([clave, valor]);
        });
        var producto = {
            id: editando >= 0 ? productos[editando].id : undefined,
            nombre: nombre,
            precio: $('f-precio').value,
            descripcion: $('f-descripcion').value.trim(),
            emoji: $('f-emoji').value.trim(),
            foto: fotoFicha,
            encuadre: fotoFicha ? encuadreFicha : undefined,
            detalles: detalles,
        };
        if (editando >= 0) productos[editando] = producto;
        else productos.push(producto);
        marcar(true);
        pintarLista();
        $('ficha').close();
    });

    /* La foto se achica a 1000 px y se sube apenas se elige; queda en el producto al tocar "Listo". */
    function achicar(archivo, lado) {
        return createImageBitmap(archivo, { imageOrientation: 'from-image' }).then(function (bmp) {
            var escala = Math.min(1, (lado || 1000) / Math.max(bmp.width, bmp.height));
            var lienzo = document.createElement('canvas');
            lienzo.width = Math.round(bmp.width * escala);
            lienzo.height = Math.round(bmp.height * escala);
            lienzo.getContext('2d').drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
            return new Promise(function (ok) { lienzo.toBlob(ok, 'image/jpeg', 0.82); });
        });
    }

    /* Un GIF va tal cual: achicarlo en el lienzo lo dejaría quieto. */
    var MAX_GIF = 2560 * 1024;

    $('f-foto').addEventListener('change', function (e) {
        var archivo = e.target.files[0];
        e.target.value = '';
        if (!archivo) return;
        var esGif = archivo.type === 'image/gif';
        if (esGif && archivo.size > MAX_GIF) {
            $('f-foto-estado').textContent = 'Ese GIF pesa más de 2,5 MB: probá con uno más corto o más chico.';
            return;
        }
        $('f-foto-estado').textContent = esGif ? 'Subiendo el GIF…' : 'Subiendo la foto…';
        $('f-listo').disabled = true;
        (esGif ? Promise.resolve(archivo) : achicar(archivo))
            .then(function (blob) {
                var tipo = esGif ? 'image/gif' : 'image/jpeg';
                return pedir('/foto', { method: 'POST', headers: { 'Content-Type': tipo, 'X-Codigo': codigo }, body: blob });
            })
            .then(function (r) { fotoFicha = r.foto; encuadreFicha = CENTRO; pintarFoto(); })
            .catch(function (error) { $('f-foto-estado').textContent = error.message || 'No se pudo subir la foto.'; })
            .finally(function () { $('f-listo').disabled = false; });
    });

    /* ---------- Importar el productos.csv de la clase ---------- */
    function leerCsv(texto) {
        var filas = [], fila = [], campo = '', comillas = false;
        texto = texto.replace(/^﻿/, '');
        for (var i = 0; i < texto.length; i++) {
            var c = texto[i];
            if (comillas) {
                if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
                else if (c === '"') comillas = false;
                else campo += c;
            } else if (c === '"') comillas = true;
            else if (c === ',' || c === ';') { fila.push(campo); campo = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && texto[i + 1] === '\n') i++;
                fila.push(campo); filas.push(fila); fila = []; campo = '';
            } else campo += c;
        }
        if (campo || fila.length) { fila.push(campo); filas.push(fila); }
        return filas.filter(function (f) { return f.some(function (v) { return v.trim(); }); });
    }

    /* "tiempo_de_entrega" se lee "Tiempo de entrega", como en detalles() de Python. */
    function nombreDeColumna(columna) {
        var t = columna.replace(/_/g, ' ').trim();
        return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    }

    $('importar').addEventListener('change', function (e) {
        var archivo = e.target.files[0];
        e.target.value = '';
        if (!archivo) return;
        archivo.text().then(function (texto) {
            var filas = leerCsv(texto);
            var columnas = (filas.shift() || []).map(function (c) { return c.trim().toLowerCase(); });
            if (columnas.indexOf('nombre') < 0) {
                $('estado').textContent = 'Ese archivo no tiene la columna nombre: ¿es tu productos.csv?';
                return;
            }
            var basicas = ['nombre', 'precio', 'emoji', 'foto', 'descripcion'];
            var sumados = 0;
            filas.forEach(function (f) {
                var dato = {};
                columnas.forEach(function (c, k) { dato[c] = (f[k] || '').trim(); });
                if (!dato.nombre) return;
                var producto = {
                    nombre: dato.nombre,
                    precio: (dato.precio || '').replace(/\D/g, ''),
                    descripcion: dato.descripcion || '',
                    emoji: dato.emoji || '',
                    foto: dato.foto || '',
                    detalles: columnas.filter(function (c) { return basicas.indexOf(c) < 0 && dato[c]; })
                        .map(function (c) { return [nombreDeColumna(c), dato[c]]; }),
                };
                var j = productos.findIndex(function (p) { return claveDe(p.nombre) === claveDe(producto.nombre); });
                if (j >= 0) { producto.id = productos[j].id; productos[j] = producto; }
                else productos.push(producto);
                sumados++;
            });
            marcar(true);
            pintarLista();
            $('estado').textContent = sumados + ' productos importados. Revisalos y tocá Guardar cambios.';
        });
    });

    /* ---------- Cómo se ve: nombre, WhatsApp, colores y foto de fondo (con su encuadre) ----------
     * Lo elegido queda en "aspecto" y se guarda con "Guardar cambios", como los productos. Los
     * colores que no se leen se ajustan solos, igual que en el panel del curso. */
    var MAX_GIF_FONDO = 2560 * 1024;
    var imagenFondo = '';
    var archivoFondo = null;
    var veloFondo = 0.55;
    var encuadreFondo = CENTRO;
    var respetarColores = false;
    var coloresOriginales = null;
    var siguientePaleta = 0;

    function coloresElegidos() {
        return { fondo: $('a-fondo').value, texto: $('a-texto').value, acento: $('a-acento').value };
    }

    function avisoColores(texto, conBoton) {
        $('a-aviso').hidden = !texto;
        $('a-aviso-texto').textContent = texto;
        $('a-mis-colores').hidden = !conBoton;
    }

    function muestras() {
        return Array.prototype.slice.call($('a-pantallas').querySelectorAll('.muestra'));
    }

    /* La foto de fondo en cada pantalla, como la pone estilos.css: cubre todo, corrida al punto
     * elegido y acercada desde ahí. */
    function pintarFotoFondo() {
        var e = encuadreFondo;
        muestras().forEach(function (muestra) {
            var foto = muestra.querySelector('.muestra-foto');
            foto.style.backgroundImage = imagenFondo ? 'url("' + window.Catalogo.fotoSrc(imagenFondo) + '")' : '';
            foto.style.backgroundPosition = e.x + '% ' + e.y + '%';
            foto.style.transformOrigin = e.x + '% ' + e.y + '%';
            foto.style.transform = 'scale(' + e.zoom + ')';
            muestra.querySelector('.muestra-velo').style.opacity = imagenFondo ? veloFondo : 0;
            muestra.classList.toggle('movible', Boolean(imagenFondo));
        });
    }

    function pintarMuestra() {
        var elegidos = coloresElegidos();
        elegidos.respetarColores = respetarColores;
        var c = coloresLegibles(elegidos);
        muestras().forEach(function (muestra) {
            muestra.style.backgroundColor = c.fondo;
            muestra.querySelector('.muestra-velo').style.background = c.fondo;
            var nombre = muestra.querySelector('.muestra-nombre');
            nombre.textContent = $('a-nombre').value || catalogo.nombre;
            nombre.style.color = c.marca;
            muestra.querySelector('.muestra-producto').style.color = c.texto;
            muestra.querySelector('.muestra-precio').style.background = c.acento;
            muestra.querySelector('.muestra-precio').style.color = c.sobreAcento;
            muestra.querySelector('.muestra-boton').style.color = c.acento;
        });
        pintarFotoFondo();
        $('a-encuadre').hidden = !imagenFondo;
        $('a-aclarar').hidden = !imagenFondo;
        $('a-zoom').value = encuadreFondo.zoom;
        $('a-velo').value = veloFondo;
        $('a-sacar-foto').hidden = !imagenFondo;
        $('a-colores-foto').hidden = !archivoFondo;
        return c;
    }

    encuadrable(muestras(), $('a-zoom'), $('a-centrar'),
        function () { return encuadreFondo; },
        function (nuevo) { encuadreFondo = nuevo; pintarFotoFondo(); });

    $('a-velo').addEventListener('input', function (e) {
        veloFondo = Number(e.target.value);
        pintarFotoFondo();
    });

    /* Al soltar un color: si no se lee, se cambia en el selector mismo, y se puede volver atrás. */
    function ajustarColores() {
        if (respetarColores) return;
        var elegidos = coloresElegidos();
        var c = coloresLegibles(elegidos);
        if (!c.avisos.length) return;
        coloresOriginales = elegidos;
        $('a-texto').value = c.texto;
        $('a-acento').value = c.acento;
        avisoColores(c.avisos.join(' ') + ' Ya está cambiado arriba y en la muestra.', true);
        pintarMuestra();
    }

    function ponerColores(p) {
        $('a-fondo').value = p.fondo;
        $('a-texto').value = p.texto;
        $('a-acento').value = p.acento;
        respetarColores = false;
        avisoColores('', false);
        ajustarColores();
        pintarMuestra();
    }

    function abrirAspecto() {
        var a = aspecto || {};
        $('a-nombre').value = a.nombre || catalogo.nombre;
        $('a-whatsapp').value = (a.numero || '').replace(/^549/, '');
        $('a-fondo').value = a.fondo || DE_LA_CLASE.fondo;
        $('a-texto').value = a.texto || DE_LA_CLASE.texto;
        $('a-acento').value = a.acento || DE_LA_CLASE.acento;
        imagenFondo = a.imagen || '';
        veloFondo = a.imagen ? a.velo : 0.55;
        encuadreFondo = a.imagen && a.encuadre ? limitarEncuadre(a.encuadre) : CENTRO;
        archivoFondo = null;
        respetarColores = false;
        coloresOriginales = null;
        $('a-paleta').textContent = '';
        $('a-foto-estado').textContent = '';
        $('error-aspecto').textContent = '';
        avisoColores('', false);
        pintarMuestra();
        $('aspecto').showModal();
    }

    $('abrir-aspecto').addEventListener('click', abrirAspecto);
    $('a-cancelar').addEventListener('click', function () { $('aspecto').close(); });
    $('form-aspecto').addEventListener('input', pintarMuestra);
    ['a-fondo', 'a-texto', 'a-acento'].forEach(function (id) { $(id).addEventListener('change', ajustarColores); });
    $('a-whatsapp').addEventListener('input', function (e) { e.target.value = e.target.value.replace(/\D/g, ''); });

    $('a-sugerir').addEventListener('click', function () {
        var p = PALETAS[siguientePaleta % PALETAS.length];
        ponerColores(p);
        $('a-paleta').textContent = p.nombre + ' · ' + ((siguientePaleta % PALETAS.length) + 1) + ' de ' + PALETAS.length + '. Tocá de nuevo para ver otra.';
        siguientePaleta++;
    });

    $('a-mis-colores').addEventListener('click', function () {
        if (!coloresOriginales) return;
        respetarColores = true;
        $('a-fondo').value = coloresOriginales.fondo;
        $('a-texto').value = coloresOriginales.texto;
        $('a-acento').value = coloresOriginales.acento;
        avisoColores('Van tus colores tal cual: algunas partes van a costar leerse.', false);
        pintarMuestra();
    });

    $('a-foto').addEventListener('change', function (e) {
        var archivo = e.target.files[0];
        e.target.value = '';
        if (!archivo) return;
        var esGif = archivo.type === 'image/gif';
        if (esGif && archivo.size > MAX_GIF_FONDO) {
            $('a-foto-estado').textContent = 'Ese GIF pesa más de 2,5 MB: probá con uno más corto o más chico.';
            return;
        }
        $('a-foto-estado').textContent = 'Subiendo la foto…';
        $('a-listo').disabled = true;
        (esGif ? Promise.resolve(archivo) : achicar(archivo, 1600))
            .then(function (blob) {
                return pedir('/foto', { method: 'POST', headers: { 'Content-Type': esGif ? 'image/gif' : 'image/jpeg', 'X-Codigo': codigo }, body: blob });
            })
            .then(function (r) {
                imagenFondo = r.foto;
                archivoFondo = archivo;
                encuadreFondo = CENTRO;
                $('a-foto-estado').textContent = '';
                pintarMuestra();
            })
            .catch(function (error) { $('a-foto-estado').textContent = error.message || 'No se pudo subir la foto.'; })
            .finally(function () { $('a-listo').disabled = false; });
    });

    $('a-sacar-foto').addEventListener('click', function () {
        imagenFondo = '';
        archivoFondo = null;
        encuadreFondo = CENTRO;
        pintarMuestra();
    });

    $('a-colores-foto').addEventListener('click', function () {
        if (!archivoFondo) return;
        paletaDeFoto(archivoFondo).then(function (p) {
            ponerColores(p);
            $('a-paleta').textContent = 'Colores sacados de tu foto.';
        });
    });

    $('a-original').addEventListener('click', function () {
        aspecto = null;
        marcar(true);
        $('aspecto').close();
        $('estado').textContent = 'Vuelve al diseño con el que se armó. Tocá Guardar cambios.';
    });

    $('form-aspecto').addEventListener('submit', function (e) {
        e.preventDefault();
        var whatsapp = $('a-whatsapp').value;
        if (whatsapp && !/^\d{10}$/.test(whatsapp)) {
            $('error-aspecto').textContent = 'El WhatsApp son 10 números: la característica sin el 0 y el número sin el 15 (2215550000).';
            return;
        }
        var c = pintarMuestra();
        aspecto = {
            nombre: $('a-nombre').value.trim(),
            numero: whatsapp ? '549' + whatsapp : '',
            fondo: c.fondo,
            texto: c.texto,
            acento: c.acento,
            marca: c.marca,
            sobreAcento: c.sobreAcento,
            imagen: imagenFondo,
            velo: imagenFondo ? veloFondo : 0,
            encuadre: imagenFondo ? encuadreFondo : undefined,
        };
        marcar(true);
        $('aspecto').close();
    });

    /* ---------- Guardar ---------- */
    function marcar(cambio) {
        sinGuardar = cambio;
        $('guardar').disabled = !cambio;
        if (cambio) $('estado').textContent = 'Tenés cambios sin guardar.';
    }

    $('guardar').addEventListener('click', function () {
        $('guardar').disabled = true;
        $('estado').textContent = 'Guardando…';
        pedir('/catalogo', { method: 'PUT', body: JSON.stringify({ codigo: codigo, productos: productos, aspecto: aspecto }) })
            .then(function (cat) {
                productos = cat.productos;
                aspecto = cat.aspecto || null;
                marcar(false);
                pintarLista();
                $('estado').textContent = 'Guardado. En un minuto se ve en tu catálogo.';
            })
            .catch(function (error) {
                $('guardar').disabled = false;
                $('estado').textContent = error.message;
            });
    });

    window.addEventListener('beforeunload', function (e) {
        if (sinGuardar) { e.preventDefault(); e.returnValue = ''; }
    });

    var recordado = leerLocal(LS_CODIGO);
    if (recordado) {
        $('codigo').value = recordado;
        entrar(recordado, true);
    }
})();
