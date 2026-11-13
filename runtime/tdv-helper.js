/*!
 * TDVH - Ayudante de ejecucion para recorridos 3DVista (Corporacion 3JC)
 * Se inyecta en el index.htm del export HTML5. Expone window.TDVH.
 * Sin dependencias y sin internet. Todas las funciones son tolerantes a fallos:
 * si algo no existe en la version de 3DVista, avisan en consola y devuelven false.
 */
(function (w) {
  'use strict';
  if (w.TDVH) return;
  var LOG = '[TDVH]';
  var TDVH = { version: '1.0.0' };

  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  TDVH.normalizar = norm;

  // ---------- Jugador (player) ----------
  function player() {
    try {
      if (w.TDV && w.TDV.PlayerAPI && typeof w.TDV.PlayerAPI.getCurrentPlayer === 'function') {
        var p = w.TDV.PlayerAPI.getCurrentPlayer();
        if (p) return p;
      }
    } catch (e) {}
    try { if (w.tour && w.tour.player) return w.tour.player; } catch (e) {}
    return null;
  }
  TDVH.player = player;

  /** Ejecuta cb(player) cuando el recorrido este listo (espera hasta 60 s). */
  TDVH.listo = function (cb) {
    var n = 0;
    (function intento() {
      var p = player();
      if (p && typeof p.getComponentByName === 'function' && listaPrincipal(p)) {
        try { cb(p); } catch (e) { console.error(LOG, e); }
        return;
      }
      if (++n < 600) setTimeout(intento, 100);
      else console.warn(LOG, 'El recorrido no termino de cargar.');
    })();
  };

  // ---------- Componentes del skin ----------
  TDVH.componente = function (nombre) {
    var p = player();
    if (!p || typeof p.getComponentByName !== 'function') return null;
    var c = p.getComponentByName(nombre);
    if (!c) console.warn(LOG, 'No existe el componente "' + nombre + '". Revise el nombre en el Skin Editor.');
    return c || null;
  };
  TDVH.mostrar = function (nombre, visible) {
    var c = TDVH.componente(nombre);
    if (!c) return false;
    c.set('visible', visible !== false);
    return true;
  };
  TDVH.ocultar = function (nombre) { return TDVH.mostrar(nombre, false); };
  TDVH.alternar = function (nombre) {
    var c = TDVH.componente(nombre);
    if (!c) return false;
    c.set('visible', !c.get('visible'));
    return c.get('visible');
  };
  TDVH.click = function (nombre) {
    var c = TDVH.componente(nombre);
    if (!c) return false;
    if (typeof c.trigger === 'function') { c.trigger('click'); return true; }
    console.warn(LOG, 'El componente no acepta trigger("click").');
    return false;
  };
  TDVH.mostrarTemporal = function (nombre, segundos) {
    if (!TDVH.mostrar(nombre, true)) return false;
    setTimeout(function () { TDVH.mostrar(nombre, false); }, (segundos || 5) * 1000);
    return true;
  };

  // ---------- Escenas / lista de reproduccion ----------
  function listaPrincipal(p) {
    p = p || player();
    if (!p) return null;
    try {
      if (p.mainPlayList) return p.mainPlayList;
      if (typeof p.get === 'function' && p.get('mainPlayList')) return p.get('mainPlayList');
      if (typeof p.getByClassName === 'function') {
        var l = p.getByClassName('PlayList');
        if (l && l.length) return l[0];
      }
    } catch (e) {}
    return null;
  }
  TDVH.lista = listaPrincipal;

  function etiqueta(media) {
    if (!media) return '';
    try {
      var l = media.get('label');
      if (l) return l;
      var d = media.get('data');
      if (d && d.label) return d.label;
      return media.get('id') || '';
    } catch (e) { return ''; }
  }

  TDVH.escenas = function () {
    var pl = listaPrincipal();
    if (!pl) return [];
    var items = pl.get('items') || [];
    return items.map(function (it, i) {
      var m = null;
      try { m = it.get('media'); } catch (e) {}
      return { indice: i, nombre: etiqueta(m), id: m ? m.get('id') : null, clase: m ? m.get('class') : null };
    });
  };

  TDVH.indiceDe = function (objetivo) {
    if (typeof objetivo === 'number') return objetivo;
    var lista = TDVH.escenas(), o = norm(objetivo), i;
    for (i = 0; i < lista.length; i++) if (lista[i].id === objetivo || norm(lista[i].nombre) === o) return i;
    for (i = 0; i < lista.length; i++) if (norm(lista[i].nombre).indexOf(o) >= 0) return i;
    return -1;
  };

  TDVH.irA = function (objetivo) {
    var pl = listaPrincipal();
    if (!pl) { console.warn(LOG, 'No se encontro la lista principal.'); return false; }
    var i = TDVH.indiceDe(objetivo);
    if (i < 0) { console.warn(LOG, 'No se encontro la escena "' + objetivo + '". Use TDVH.escenas() para ver los nombres.'); return false; }
    pl.set('selectedIndex', i);
    return true;
  };
  TDVH.actual = function () {
    var pl = listaPrincipal();
    return pl ? pl.get('selectedIndex') : -1;
  };
  TDVH.siguiente = function () {
    var n = TDVH.escenas().length; if (!n) return false;
    return TDVH.irA((TDVH.actual() + 1) % n);
  };
  TDVH.anterior = function () {
    var n = TDVH.escenas().length; if (!n) return false;
    return TDVH.irA((TDVH.actual() - 1 + n) % n);
  };

  /** cb(indice, escena) cada vez que cambia la escena (sondeo cada 400 ms). */
  TDVH.alCambiarEscena = function (cb) {
    var ultimo = null;
    setInterval(function () {
      var a = TDVH.actual();
      if (a !== ultimo && a >= 0) { ultimo = a; try { cb(a, TDVH.escenas()[a]); } catch (e) { console.error(LOG, e); } }
    }, 400);
  };

  // ---------- Recorrido automatico ----------
  var autoTimer = null;
  TDVH.autoRecorrido = function (segundos, activar) {
    var on = activar === undefined ? !autoTimer : !!activar;
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    if (on) autoTimer = setInterval(TDVH.siguiente, (segundos || 15) * 1000);
    return on;
  };

  // ---------- Pantalla completa / audio ----------
  TDVH.pantallaCompleta = function () {
    var d = document, el = d.documentElement;
    var activo = d.fullscreenElement || d.webkitFullscreenElement;
    try {
      if (activo) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    } catch (e) { console.warn(LOG, 'Pantalla completa no disponible', e); }
    return !activo;
  };

  var silenciado = false;
  TDVH.silenciar = function (estado) {
    silenciado = estado === undefined ? !silenciado : !!estado;
    var p = player();
    try {
      if (p) {
        if (silenciado && typeof p.pauseGlobalAudios === 'function') p.pauseGlobalAudios();
        if (!silenciado && typeof p.resumeGlobalAudios === 'function') p.resumeGlobalAudios();
      }
    } catch (e) {}
    var medios = document.querySelectorAll('audio, video');
    for (var i = 0; i < medios.length; i++) medios[i].muted = silenciado;
    return silenciado;
  };

  // ---------- Idioma ----------
  TDVH.idioma = function (codigo) {
    var p = player();
    try { if (w.tour && w.tour.locManager && w.tour.locManager.setLocale) { w.tour.locManager.setLocale(codigo); return true; } } catch (e) {}
    try { if (p && typeof p.setLocale === 'function') { p.setLocale(codigo); return true; } } catch (e) {}
    console.warn(LOG, 'No se pudo cambiar el idioma a', codigo);
    return false;
  };

  // ---------- Enlaces / contacto ----------
  TDVH.abrir = function (url, destino) { w.open(url, destino || '_blank', 'noopener'); return true; };
  TDVH.whatsapp = function (numero, mensaje) {
    var n = String(numero || '').replace(/[^\d]/g, '');
    return TDVH.abrir('https://wa.me/' + n + (mensaje ? '?text=' + encodeURIComponent(mensaje) : ''));
  };
  TDVH.llamar = function (tel) { w.location.href = 'tel:' + String(tel).replace(/[^\d+]/g, ''); return true; };
  TDVH.correo = function (email, asunto, cuerpo) {
    var q = [];
    if (asunto) q.push('subject=' + encodeURIComponent(asunto));
    if (cuerpo) q.push('body=' + encodeURIComponent(cuerpo));
    w.location.href = 'mailto:' + email + (q.length ? '?' + q.join('&') : '');
    return true;
  };
  TDVH.compartir = function (titulo, texto) {
    var url = w.location.href;
    if (navigator.share) { navigator.share({ title: titulo || document.title, text: texto || '', url: url }).catch(function () {}); return true; }
    if (navigator.clipboard) { navigator.clipboard.writeText(url); TDVH.aviso('Enlace copiado'); return true; }
    w.prompt('Copie el enlace:', url);
    return true;
  };

  // ---------- Analitica (solo si existe gtag/dataLayer/fbq) ----------
  TDVH.evento = function (nombre, params) {
    params = params || {};
    try { if (typeof w.gtag === 'function') w.gtag('event', nombre, params); } catch (e) {}
    try { if (w.dataLayer && w.dataLayer.push) w.dataLayer.push(Object.assign({ event: nombre }, params)); } catch (e) {}
    try { if (typeof w.fbq === 'function') w.fbq('trackCustom', nombre, params); } catch (e) {}
  };

  // ---------- Aviso flotante ----------
  TDVH.aviso = function (texto, ms) {
    var t = document.createElement('div');
    t.textContent = texto;
    t.setAttribute('style', 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;padding:10px 18px;border-radius:20px;font:14px system-ui,sans-serif;z-index:2147483647;pointer-events:none;transition:opacity .4s');
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; }, ms || 2200);
    setTimeout(function () { t.remove(); }, (ms || 2200) + 500);
  };

  /** Diagnostico rapido en consola: TDVH.diagnostico() */
  TDVH.diagnostico = function () {
    var p = player();
    var info = {
      player: !!p,
      getComponentByName: !!(p && p.getComponentByName),
      listaPrincipal: !!listaPrincipal(p),
      escenas: TDVH.escenas().length,
      escenaActual: TDVH.actual(),
      windowTour: !!w.tour
    };
    console.table ? console.table(info) : console.log(LOG, info);
    return info;
  };

  w.TDVH = TDVH;
})(window);
