// Generador de fragmentos JavaScript para recorridos 3DVista.
import vm from 'node:vm';

const J = (v) => JSON.stringify(v);

// Resolucion del player dentro de la accion "Ejecutar JavaScript" de 3DVista
// (alli `this` suele ser el player) o desde fuera (pagina, web frame).
const RESOLVER = `var P = (this && typeof this.getComponentByName === 'function') ? this
  : (window.TDV && TDV.PlayerAPI && TDV.PlayerAPI.getCurrentPlayer && TDV.PlayerAPI.getCurrentPlayer())
  || (window.tour && window.tour.player);
if (!P) { console.warn('[3DV] Player no disponible'); return; }`;

const RESOLVER_PADRE = `var W = (function(){ try { return window.parent && window.parent.TDV ? window.parent : window; } catch(e) { return window; } })();
var P = (W.TDV && W.TDV.PlayerAPI && W.TDV.PlayerAPI.getCurrentPlayer && W.TDV.PlayerAPI.getCurrentPlayer()) || (W.tour && W.tour.player);
if (!P) { console.warn('[3DV] Player no disponible'); return; }`;

const NORM = `function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim(); }`;
const LISTA = `var pl = P.mainPlayList || (P.get && P.get('mainPlayList')) || (P.getByClassName && P.getByClassName('PlayList')[0]);
if (!pl) { console.warn('[3DV] Lista principal no encontrada'); return; }
var items = pl.get('items') || [];`;
const COMP = (n) => `var c = P.getComponentByName(${J(n)});
if (!c) { console.warn('[3DV] No existe el componente ' + ${J(n)}); return; }`;

function req(p, ...claves) {
  for (const k of claves) if (p[k] === undefined || p[k] === '') throw new Error(`Falta el parametro "${k}"`);
}

/** Cada accion: { desc, params, crudo(p) -> codigo usando P, helper(p) -> codigo usando TDVH } */
export const ACCIONES = {
  ir_a_escena: {
    desc: 'Ir a una escena por etiqueta (sin importar tildes/mayusculas), id o indice.',
    params: { escena: 'Etiqueta, id (panorama_XXX) o indice numerico' },
    crudo: (p) => { req(p, 'escena'); return `${NORM}
${LISTA}
var objetivo = ${J(p.escena)}, idx = -1;
if (typeof objetivo === 'number') idx = objetivo;
for (var i = 0; idx < 0 && i < items.length; i++) {
  var m = items[i].get('media');
  if (m.get('id') === objetivo || norm(m.get('label')) === norm(objetivo)) idx = i;
}
if (idx < 0) { console.warn('[3DV] Escena no encontrada: ' + objetivo); return; }
pl.set('selectedIndex', idx);`; },
    helper: (p) => `TDVH.irA(${J(p.escena)});`
  },
  siguiente_escena: {
    desc: 'Avanzar a la siguiente escena (vuelve a la primera al final).', params: {},
    crudo: () => `${LISTA}\npl.set('selectedIndex', (pl.get('selectedIndex') + 1) % items.length);`,
    helper: () => 'TDVH.siguiente();'
  },
  anterior_escena: {
    desc: 'Volver a la escena anterior.', params: {},
    crudo: () => `${LISTA}\npl.set('selectedIndex', (pl.get('selectedIndex') - 1 + items.length) % items.length);`,
    helper: () => 'TDVH.anterior();'
  },
  mostrar_componente: {
    desc: 'Mostrar un componente del skin por su nombre.', params: { componente: 'Nombre en el Skin Editor' },
    crudo: (p) => { req(p, 'componente'); return `${COMP(p.componente)}\nc.set('visible', true);`; },
    helper: (p) => `TDVH.mostrar(${J(p.componente)});`
  },
  ocultar_componente: {
    desc: 'Ocultar un componente del skin.', params: { componente: 'Nombre en el Skin Editor' },
    crudo: (p) => { req(p, 'componente'); return `${COMP(p.componente)}\nc.set('visible', false);`; },
    helper: (p) => `TDVH.ocultar(${J(p.componente)});`
  },
  alternar_componente: {
    desc: 'Mostrar/ocultar (toggle) un componente.', params: { componente: 'Nombre en el Skin Editor' },
    crudo: (p) => { req(p, 'componente'); return `${COMP(p.componente)}\nc.set('visible', !c.get('visible'));`; },
    helper: (p) => `TDVH.alternar(${J(p.componente)});`
  },
  mostrar_varios: {
    desc: 'Mostrar unos componentes y ocultar otros a la vez (p. ej. cambiar de panel).',
    params: { mostrar: 'Lista de nombres a mostrar', ocultar: 'Lista de nombres a ocultar' },
    crudo: (p) => `var mostrar = ${J(p.mostrar || [])}, ocultar = ${J(p.ocultar || [])};
ocultar.forEach(function(n){ var c = P.getComponentByName(n); if (c) c.set('visible', false); else console.warn('[3DV] No existe ' + n); });
mostrar.forEach(function(n){ var c = P.getComponentByName(n); if (c) c.set('visible', true); else console.warn('[3DV] No existe ' + n); });`,
    helper: (p) => `${J(p.ocultar || [])}.forEach(TDVH.ocultar);\n${J(p.mostrar || [])}.forEach(function(n){ TDVH.mostrar(n); });`
  },
  mostrar_temporal: {
    desc: 'Mostrar un componente durante N segundos y ocultarlo.', params: { componente: 'Nombre', segundos: 'Duracion (defecto 5)' },
    crudo: (p) => { req(p, 'componente'); return `${COMP(p.componente)}\nc.set('visible', true);\nsetTimeout(function(){ c.set('visible', false); }, ${(Number(p.segundos) || 5) * 1000});`; },
    helper: (p) => `TDVH.mostrarTemporal(${J(p.componente)}, ${Number(p.segundos) || 5});`
  },
  click_componente: {
    desc: 'Simular clic en un boton/componente (ejecuta sus acciones configuradas).', params: { componente: 'Nombre' },
    crudo: (p) => { req(p, 'componente'); return `${COMP(p.componente)}\nc.trigger('click');`; },
    helper: (p) => `TDVH.click(${J(p.componente)});`
  },
  abrir_url: {
    desc: 'Abrir un enlace.', params: { url: 'URL', nueva_pestana: 'true/false (defecto true)' },
    crudo: (p) => { req(p, 'url'); return `window.open(${J(p.url)}, ${J(p.nueva_pestana === false ? '_self' : '_blank')});`; },
    helper: (p) => `TDVH.abrir(${J(p.url)}, ${J(p.nueva_pestana === false ? '_self' : '_blank')});`
  },
  whatsapp: {
    desc: 'Abrir chat de WhatsApp con mensaje (incluye la escena actual si incluir_escena=true).',
    params: { numero: 'Con indicativo, p. ej. 573001234567', mensaje: 'Texto', incluir_escena: 'true/false' },
    crudo: (p) => { req(p, 'numero'); return `var msg = ${J(p.mensaje || '')};
${p.incluir_escena ? `try { var _pl = P.mainPlayList || P.getByClassName('PlayList')[0]; var _m = _pl.get('items')[_pl.get('selectedIndex')].get('media'); msg += ' (' + _m.get('label') + ')'; } catch(e) {}\n` : ''}window.open('https://wa.me/' + ${J(String(p.numero).replace(/\D/g, ''))} + (msg ? '?text=' + encodeURIComponent(msg) : ''), '_blank');`; },
    helper: (p) => p.incluir_escena
      ? `var e = TDVH.escenas()[TDVH.actual()];\nTDVH.whatsapp(${J(String(p.numero).replace(/\D/g, ''))}, ${J(p.mensaje || '')} + (e ? ' (' + e.nombre + ')' : ''));`
      : `TDVH.whatsapp(${J(String(p.numero).replace(/\D/g, ''))}, ${J(p.mensaje || '')});`
  },
  llamar: {
    desc: 'Iniciar llamada telefonica.', params: { telefono: 'Numero' },
    crudo: (p) => { req(p, 'telefono'); return `window.location.href = 'tel:' + ${J(String(p.telefono).replace(/[^\d+]/g, ''))};`; },
    helper: (p) => `TDVH.llamar(${J(p.telefono)});`
  },
  correo: {
    desc: 'Abrir correo prellenado.', params: { email: 'Destino', asunto: 'Asunto', cuerpo: 'Texto' },
    crudo: (p) => { req(p, 'email'); return `window.location.href = 'mailto:' + ${J(p.email)} + '?subject=' + encodeURIComponent(${J(p.asunto || '')}) + '&body=' + encodeURIComponent(${J(p.cuerpo || '')});`; },
    helper: (p) => `TDVH.correo(${J(p.email)}, ${J(p.asunto || '')}, ${J(p.cuerpo || '')});`
  },
  pantalla_completa: {
    desc: 'Alternar pantalla completa.', params: {},
    crudo: () => `var d = document, el = d.documentElement;
if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);`,
    helper: () => 'TDVH.pantallaCompleta();'
  },
  silenciar: {
    desc: 'Alternar silencio del audio global.', params: {},
    crudo: () => `window.__3dvMute = !window.__3dvMute;
if (window.__3dvMute && P.pauseGlobalAudios) P.pauseGlobalAudios();
if (!window.__3dvMute && P.resumeGlobalAudios) P.resumeGlobalAudios();
document.querySelectorAll('audio,video').forEach(function(m){ m.muted = window.__3dvMute; });`,
    helper: () => 'TDVH.silenciar();'
  },
  auto_recorrido: {
    desc: 'Activar/desactivar avance automatico de escenas cada N segundos.', params: { segundos: 'Defecto 15' },
    crudo: (p) => `${LISTA}
if (window.__3dvAuto) { clearInterval(window.__3dvAuto); window.__3dvAuto = null; return; }
window.__3dvAuto = setInterval(function(){ pl.set('selectedIndex', (pl.get('selectedIndex') + 1) % items.length); }, ${(Number(p.segundos) || 15) * 1000});`,
    helper: (p) => `TDVH.autoRecorrido(${Number(p.segundos) || 15});`
  },
  cambiar_idioma: {
    desc: 'Cambiar idioma del recorrido (debe existir en Idiomas del proyecto).', params: { idioma: 'es, en, fr…' },
    crudo: (p) => { req(p, 'idioma'); return `if (window.tour && tour.locManager && tour.locManager.setLocale) tour.locManager.setLocale(${J(p.idioma)});
else if (P.setLocale) P.setLocale(${J(p.idioma)});
else console.warn('[3DV] No se pudo cambiar idioma');`; },
    helper: (p) => `TDVH.idioma(${J(p.idioma)});`
  },
  compartir: {
    desc: 'Compartir el enlace (menu nativo del movil o copiar al portapapeles).', params: { titulo: 'Titulo' },
    crudo: (p) => `var url = window.location.href;
if (navigator.share) navigator.share({ title: ${J(p.titulo || '')} || document.title, url: url }).catch(function(){});
else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function(){ alert('Enlace copiado'); });
else window.prompt('Copie el enlace:', url);`,
    helper: (p) => `TDVH.compartir(${J(p.titulo || '')});`
  },
  evento_analytics: {
    desc: 'Enviar evento a Google Analytics / GTM / Meta Pixel si estan instalados.', params: { nombre: 'Nombre del evento', parametros: 'Objeto' },
    crudo: (p) => { req(p, 'nombre'); return `var params = ${J(p.parametros || {})};
if (typeof gtag === 'function') gtag('event', ${J(p.nombre)}, params);
if (window.dataLayer) dataLayer.push(Object.assign({ event: ${J(p.nombre)} }, params));
if (typeof fbq === 'function') fbq('trackCustom', ${J(p.nombre)}, params);`; },
    helper: (p) => `TDVH.evento(${J(p.nombre)}, ${J(p.parametros || {})});`
  },
  al_cambiar_escena: {
    desc: 'Ejecutar codigo cada vez que cambia la escena (ideal en "Al iniciar el recorrido"). La variable `escena` = etiqueta actual.',
    params: { codigo: 'Codigo JS a ejecutar; dispone de `indice` y `escena`' },
    crudo: (p) => { req(p, 'codigo'); return `${LISTA}
var ultimo = -1;
setInterval(function(){
  var indice = pl.get('selectedIndex');
  if (indice === ultimo || indice < 0) return;
  ultimo = indice;
  var escena = pl.get('items')[indice].get('media').get('label');
  try {
${indent(p.codigo, 4)}
  } catch (e) { console.error('[3DV]', e); }
}, 400);`; },
    helper: (p) => `TDVH.alCambiarEscena(function(indice, info){\n  var escena = info ? info.nombre : '';\n${indent(p.codigo, 2)}\n});`
  },
  personalizado: {
    desc: 'Envolver codigo propio con la resolucion del player (P) y manejo de errores.', params: { codigo: 'Codigo que usa P' },
    crudo: (p) => { req(p, 'codigo'); return p.codigo; },
    helper: (p) => p.codigo
  }
};

function indent(s, n) { const pad = ' '.repeat(n); return String(s).split('\n').map((l) => pad + l).join('\n'); }

/**
 * modo:
 *  - "accion"  (defecto): para pegar en Acciones > "Ejecutar JavaScript" dentro de 3DVista. Autonomo.
 *  - "helper":  usa window.TDVH (requiere inyectar el ayudante en el export). Mas corto.
 *  - "externo": para paginas/Web Frames fuera del player (busca window.parent).
 */
export function generarCodigo(accion, params = {}, modo = 'accion') {
  const a = ACCIONES[accion];
  if (!a) throw new Error(`Accion desconocida "${accion}". Disponibles: ${Object.keys(ACCIONES).join(', ')}`);
  if (modo === 'helper') return a.helper(params);
  const cuerpo = a.crudo(params);
  const resolver = modo === 'externo' ? RESOLVER_PADRE : RESOLVER;
  return `(function(){\n${indent(resolver, 2)}\n  try {\n${indent(cuerpo, 4)}\n  } catch (e) { console.error('[3DV] ${accion}', e); }\n}).call(this);`;
}

export function listarAcciones() {
  return Object.entries(ACCIONES).map(([k, v]) => {
    const ps = Object.entries(v.params).map(([pk, pv]) => `    - ${pk}: ${pv}`).join('\n');
    return `- **${k}** — ${v.desc}${ps ? '\n' + ps : ''}`;
  }).join('\n');
}

export function validarJS(codigo) {
  const errores = [];
  try { new vm.Script(`(function(){\n${codigo}\n})`, { filename: 'fragmento.js' }); }
  catch (e) {
    const linea = /fragmento\.js:(\d+)/.exec(e.stack || '');
    errores.push(`${e.name}: ${e.message}${linea ? ` (linea ${Number(linea[1]) - 1})` : ''}`);
  }
  const avisos = [];
  if (/\bimport\s|\bexport\s/.test(codigo)) avisos.push('import/export no funcionan dentro de "Ejecutar JavaScript".');
  if (/https?:\/\//.test(codigo)) avisos.push('Usa URLs externas: no funcionaran si el recorrido se usa sin internet.');
  if (/getComponentByName\(\s*['"][^'"]+['"]\s*\)\s*\./.test(codigo)) avisos.push('Llama metodos sobre getComponentByName(...) sin comprobar null: si el nombre esta mal fallara.');
  if (/\bawait\b/.test(codigo) && !/async/.test(codigo)) avisos.push('Usa await fuera de una funcion async.');
  return { valido: errores.length === 0, errores, avisos };
}
