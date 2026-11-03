/* El editor de los catálogos: entrar con el código, cambiar productos y guardar.
 *
 * Los cambios quedan en esta página hasta tocar "Guardar cambios": ahí se manda la
 * lista entera al Worker, que la limpia y la guarda. Las fotos se achican acá,
 * antes de subirlas, para que el catálogo abra rápido con datos móviles.
 */
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
        if (fotoFicha && fotoFicha.indexOf('w:') === 0) {
            var img = document.createElement('img');
            img.src = window.Catalogo.fotoSrc(fotoFicha);
            img.alt = '';
            vista.appendChild(img);
        } else {
            vista.textContent = fotoFicha ? '📁' : ($('f-emoji').value || '🛍️');
        }
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
    $('f-sacar-foto').addEventListener('click', function () { fotoFicha = ''; pintarFoto(); });

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
            detalles: detalles,
        };
        if (editando >= 0) productos[editando] = producto;
        else productos.push(producto);
        marcar(true);
        pintarLista();
        $('ficha').close();
    });

    /* La foto se achica a 1000 px y se sube apenas se elige; queda en el producto al tocar "Listo". */
    function achicar(archivo) {
        return createImageBitmap(archivo, { imageOrientation: 'from-image' }).then(function (bmp) {
            var escala = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
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
            .then(function (r) { fotoFicha = r.foto; pintarFoto(); })
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

    /* ---------- Guardar ---------- */
    function marcar(cambio) {
        sinGuardar = cambio;
        $('guardar').disabled = !cambio;
        if (cambio) $('estado').textContent = 'Tenés cambios sin guardar.';
    }

    $('guardar').addEventListener('click', function () {
        $('guardar').disabled = true;
        $('estado').textContent = 'Guardando…';
        pedir('/catalogo', { method: 'PUT', body: JSON.stringify({ codigo: codigo, productos: productos }) })
            .then(function (cat) {
                productos = cat.productos;
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
