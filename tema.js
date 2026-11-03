/* Modo claro u oscuro del editor y de la administración, con el botón de arriba a la derecha.
 *
 * Se carga en el <head>, sin defer: así el tema elegido se aplica antes de pintar y no
 * parpadea. El botón se agrega cuando la página terminó de cargar. Sin elegir nada, sigue
 * el tema del celular o de la compu. Es el mismo botón que el de "Armá tu catálogo". */
(function () {
    var raiz = document.documentElement;
    try {
        var guardado = localStorage.getItem('catalogos:tema');
        if (guardado) raiz.dataset.tema = guardado;
    } catch (e) { /* sin localStorage, sigue el del sistema */ }

    function oscuro() {
        return raiz.dataset.tema ? raiz.dataset.tema === 'oscuro' : matchMedia('(prefers-color-scheme: dark)').matches;
    }

    document.addEventListener('DOMContentLoaded', function () {
        var boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'tema';
        boton.setAttribute('aria-label', 'Cambiar entre modo claro y oscuro');
        function pintar() { boton.textContent = oscuro() ? '☀️' : '🌙'; }
        boton.addEventListener('click', function () {
            raiz.dataset.tema = oscuro() ? 'claro' : 'oscuro';
            try { localStorage.setItem('catalogos:tema', raiz.dataset.tema); } catch (e) { /* nada */ }
            pintar();
        });
        pintar();
        document.body.prepend(boton);
    });
})();
