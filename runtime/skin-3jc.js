/*!
 * Skin HTML 3JC para 3DVista. Requiere tdv-helper.js (window.TDVH) y skin-config.js (window.S3_CONFIG, window.S3_ICONOS).
 */
(function (w, d) {
  'use strict';
  var C = w.S3_CONFIG || {}, I = w.S3_ICONOS || {}, T = w.TDVH;
  if (!T) { console.error('[Skin3JC] Falta tdv-helper.js'); return; }
  var marca = C.marca || {}, contacto = C.contacto || {};

  function icono(n) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[n] || '') + '</svg>';
  }
  function el(tag, attrs, html) {
    var e = d.createElement(tag);
    for (var k in attrs || {}) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function txt(s) { var e = d.createElement('div'); e.textContent = s == null ? '' : s; return e.innerHTML; }

  var raiz = el('div', { id: 's3' });
  var vars = {
    '--s3-primario': marca.color_primario, '--s3-secundario': marca.color_secundario,
    '--s3-fondo': marca.color_fondo, '--s3-texto': marca.color_texto,
    '--s3-fuente': marca.fuente, '--s3-radio': marca.radio != null ? marca.radio + 'px' : null
  };
  for (var v in vars) if (vars[v]) raiz.style.setProperty(v, vars[v]);

  // ---- Cabecera ----
  if (marca.nombre || marca.logo) {
    var cab = el('div', { class: 's3-cabecera s3-vidrio' });
    if (marca.logo) cab.appendChild(el('img', { src: marca.logo, alt: marca.nombre || 'Logo' }));
    if (marca.nombre) cab.appendChild(el('div', null, '<div class="s3-nombre">' + txt(marca.nombre) + '</div>' + (marca.subtitulo ? '<div class="s3-sub">' + txt(marca.subtitulo) + '</div>' : '')));
    if (marca.url) { cab.style.cursor = 'pointer'; cab.onclick = function () { T.abrir(marca.url); }; }
    raiz.appendChild(cab);
  }
  var titulo = null;
  if (C.mostrar_titulo_escena !== false) { titulo = el('div', { class: 's3-titulo-escena s3-vidrio' }); titulo.style.opacity = 0; raiz.appendChild(titulo); }

  // ---- Panel de escenas ----
  var panel = el('aside', { class: 's3-panel s3-vidrio', 'aria-label': 'Escenas' });
  panel.innerHTML = '<header><span>' + txt(C.textos && C.textos.escenas || 'Escenas') + '</span><button class="s3-btn" data-a="cerrar-panel" aria-label="Cerrar">' + icono('cerrar') + '</button></header>' +
    '<input class="s3-buscar" type="search" placeholder="' + txt(C.textos && C.textos.buscar || 'Buscar…') + '">' + '<div class="s3-lista"></div>';
  raiz.appendChild(panel);
  var lista = panel.querySelector('.s3-lista'), buscador = panel.querySelector('.s3-buscar');

  function pintarEscenas() {
    var todas = T.escenas(), filtro = T.normalizar(buscador.value), ocultas = (C.escenas && C.escenas.ocultar || []).map(T.normalizar);
    var grupos = (C.escenas && C.escenas.grupos && C.escenas.grupos.length) ? C.escenas.grupos : [{ titulo: '', escenas: null }];
    var actual = T.actual(), html = '', usadas = {};
    grupos.forEach(function (g) {
      var items = g.escenas ? g.escenas.map(function (n) { var i = T.indiceDe(n); return i >= 0 ? todas[i] : null; }).filter(Boolean) : todas;
      items = items.filter(function (e) {
        var n = T.normalizar(e.nombre);
        return ocultas.indexOf(n) < 0 && (!filtro || n.indexOf(filtro) >= 0);
      });
      if (!items.length) return;
      if (g.titulo) html += '<div class="s3-grupo">' + txt(g.titulo) + '</div>';
      items.forEach(function (e) {
        usadas[e.indice] = 1;
        html += '<button class="s3-item' + (e.indice === actual ? ' s3-actual' : '') + '" data-i="' + e.indice + '"><span class="s3-num">' + (e.indice + 1) + '</span><span>' + txt(e.nombre) + '</span></button>';
      });
    });
    lista.innerHTML = html || '<div class="s3-grupo">Sin resultados</div>';
  }
  buscador.addEventListener('input', pintarEscenas);
  lista.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-i]');
    if (!b) return;
    T.irA(Number(b.getAttribute('data-i')));
    if (w.innerWidth < 900) panel.classList.remove('s3-abierto');
  });

  // ---- Modal de informacion ----
  var fondo = el('div', { class: 's3-modal-fondo' });
  var info = C.info || {};
  var acciones = '';
  if (contacto.whatsapp) acciones += '<button class="s3-accion" data-a="whatsapp">' + icono('whatsapp') + 'WhatsApp</button>';
  if (contacto.telefono) acciones += '<button class="s3-accion" data-a="telefono">' + icono('telefono') + txt(contacto.telefono) + '</button>';
  if (contacto.email) acciones += '<button class="s3-accion" data-a="correo">' + icono('correo') + txt(contacto.email) + '</button>';
  if (contacto.ubicacion_url) acciones += '<button class="s3-accion" data-a="ubicacion">' + icono('ubicacion') + 'Ubicación</button>';
  fondo.innerHTML = '<div class="s3-modal s3-vidrio" role="dialog" aria-modal="true"><button class="s3-btn s3-cerrar" data-a="cerrar-modal" aria-label="Cerrar">' + icono('cerrar') + '</button>' +
    '<h2>' + txt(info.titulo || marca.nombre || 'Información') + '</h2><div class="s3-contenido">' + (info.html || '') + '</div>' +
    (acciones ? '<div class="s3-acciones">' + acciones + '</div>' : '') + '</div>';
  fondo.addEventListener('click', function (ev) { if (ev.target === fondo) fondo.classList.remove('s3-abierto'); });
  raiz.appendChild(fondo);

  // ---- Barra ----
  var DEF = {
    escenas: ['escenas', 'Escenas'], anterior: ['anterior', 'Anterior'], siguiente: ['siguiente', 'Siguiente'],
    auto: ['play', 'Recorrido automático'], audio: ['audio', 'Sonido'], pantalla: ['pantalla', 'Pantalla completa'],
    compartir: ['compartir', 'Compartir'], info: ['info', 'Información'], whatsapp: ['whatsapp', 'WhatsApp'],
    telefono: ['telefono', 'Llamar'], correo: ['correo', 'Correo'], ubicacion: ['ubicacion', 'Ubicación'], inicio: ['inicio', 'Inicio']
  };
  var botones = C.botones || ['escenas', 'anterior', 'siguiente', 'auto', 'audio', 'pantalla', 'info'];
  var barra = el('nav', { class: 's3-barra s3-vidrio' + (C.posicion_barra === 'izquierda' ? ' s3-izquierda' : ''), 'aria-label': 'Controles' });
  botones.forEach(function (b) {
    var def = DEF[b]; if (!def) return;
    barra.appendChild(el('button', { class: 's3-btn', 'data-a': b, 'data-tip': def[1], 'aria-label': def[1] }, icono(def[0])));
  });
  raiz.appendChild(barra);
  if (C.whatsapp_flotante && contacto.whatsapp) raiz.appendChild(el('button', { class: 's3-flotante', 'data-a': 'whatsapp', 'aria-label': 'WhatsApp' }, icono('whatsapp')));

  // ---- Acciones ----
  function accion(a, btn) {
    T.evento('skin_click', { boton: a });
    switch (a) {
      case 'escenas': panel.classList.toggle('s3-abierto'); pintarEscenas(); break;
      case 'cerrar-panel': panel.classList.remove('s3-abierto'); break;
      case 'anterior': T.anterior(); break;
      case 'siguiente': T.siguiente(); break;
      case 'inicio': T.irA(0); break;
      case 'auto':
        var on = T.autoRecorrido(C.auto_segundos || 15);
        btn.classList.toggle('s3-activo', on); btn.innerHTML = icono(on ? 'pausa' : 'play'); break;
      case 'audio':
        var m = T.silenciar(); btn.innerHTML = icono(m ? 'audio_off' : 'audio'); break;
      case 'pantalla':
        var f = T.pantallaCompleta(); btn.innerHTML = icono(f ? 'pantalla_salir' : 'pantalla'); break;
      case 'compartir': T.compartir(marca.nombre); break;
      case 'info': fondo.classList.add('s3-abierto'); break;
      case 'cerrar-modal': fondo.classList.remove('s3-abierto'); break;
      case 'whatsapp':
        var e = T.escenas()[T.actual()];
        T.whatsapp(contacto.whatsapp, (contacto.mensaje_whatsapp || 'Hola, vi el recorrido virtual') + (e && contacto.incluir_escena !== false ? ' (' + e.nombre + ')' : ''));
        break;
      case 'telefono': T.llamar(contacto.telefono); break;
      case 'correo': T.correo(contacto.email, marca.nombre || ''); break;
      case 'ubicacion': T.abrir(contacto.ubicacion_url); break;
    }
  }
  raiz.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-a]');
    if (b && raiz.contains(b)) accion(b.getAttribute('data-a'), b);
  });
  d.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { fondo.classList.remove('s3-abierto'); panel.classList.remove('s3-abierto'); }
  });

  function iniciar() {
    d.body.appendChild(raiz);
    T.listo(function () {
      (C.ocultar_componentes_nativos || []).forEach(function (n) { T.ocultar(n); });
      T.alCambiarEscena(function (i, e) {
        if (titulo && e) { titulo.textContent = e.nombre; titulo.style.opacity = 1; }
        if (panel.classList.contains('s3-abierto')) pintarEscenas();
      });
      if (C.info_al_inicio) fondo.classList.add('s3-abierto');
    });
  }
  if (d.body) iniciar(); else d.addEventListener('DOMContentLoaded', iniciar);
})(window, document);
