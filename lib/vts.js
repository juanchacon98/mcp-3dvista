// Generador de skins nativos de 3DVista (.vts = ZIP con info + script.js en JSON + imagenes en skin/).
// Formato verificado importando en 3DVista 2026.1.2 (Skin Editor > Biblioteca de skins > Import Skin).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { iconoPng, codificarPng, hexARgb, crc32 } from './png.js';
import { ICONOS } from './iconos.js';
import { generarCodigo } from './codigo.js';

const BASE = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'runtime', 'vts-base.json'), 'utf8'));
const clon = (o) => JSON.parse(JSON.stringify(o));
const colorInt = (hex) => { const [r, g, b] = hexARgb(hex); return (r << 16) | (g << 8) | b; };
const hex = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const nuevoId = (clase) => `${clase}_${hex(4)}_${hex(2)}_${hex(2)}_${hex(2)}_${hex(6)}`;

const COMUNES = {
  minWidth: 1, minHeight: 1, borderSize: 0, borderRadius: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0,
  propagateClick: false, asHotspotVideo: false, visible: true, backgroundOpacity: 0
};

// ---------------- ZIP minimo ----------------
function zip(entradas) {
  const locales = [], central = [];
  let offset = 0;
  for (const { nombre, datos } of entradas) {
    const nom = Buffer.from(nombre, 'utf8');
    const comp = zlib.deflateRawSync(datos, { level: 9 });
    const crc = crc32(datos);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(0, 10); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(datos.length, 22);
    lh.writeUInt16LE(nom.length, 26); lh.writeUInt16LE(0, 28);
    locales.push(lh, nom, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(0, 12); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(datos.length, 24);
    ch.writeUInt16LE(nom.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, nom);
    offset += 30 + nom.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(entradas.length, 8); fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, cd, fin]);
}

/** Lee un .vts y devuelve {info, script, archivos} (para inspeccionar o reutilizar skins). */
export function leerVts(ruta) {
  const buf = fs.readFileSync(ruta);
  const archivos = {};
  let p = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (p < 0) throw new Error('No es un ZIP/.vts valido');
  const n = buf.readUInt16LE(p + 10); let c = buf.readUInt32LE(p + 16);
  for (let k = 0; k < n; k++) {
    const metodo = buf.readUInt16LE(c + 10), tam = buf.readUInt32LE(c + 20), ln = buf.readUInt16LE(c + 28), le = buf.readUInt16LE(c + 30), lc = buf.readUInt16LE(c + 32), off = buf.readUInt32LE(c + 42);
    const nombre = buf.toString('utf8', c + 46, c + 46 + ln);
    const lnl = buf.readUInt16LE(off + 26), lel = buf.readUInt16LE(off + 28);
    const datos = buf.subarray(off + 30 + lnl + lel, off + 30 + lnl + lel + tam);
    if (!nombre.endsWith('/')) archivos[nombre] = metodo === 8 ? zlib.inflateRawSync(datos) : datos;
    c += 46 + ln + le + lc;
  }
  return {
    info: archivos.info ? JSON.parse(archivos.info.toString('utf8')) : null,
    script: archivos['script.js'] ? JSON.parse(archivos['script.js'].toString('utf8')) : null,
    version: archivos.version ? archivos.version.toString('utf8') : null,
    archivos: Object.keys(archivos)
  };
}

// ---------------- Construccion de componentes ----------------
function aplicarPosicion(def, pos = {}) {
  const m = { izquierda: 'left', derecha: 'right', arriba: 'top', abajo: 'bottom' };
  for (const [es, en] of Object.entries(m)) if (pos[es] !== undefined) def[en] = typeof pos[es] === 'number' ? pos[es] : String(pos[es]);
  const tam = (v, px, pc) => {
    if (v === undefined) return;
    if (typeof v === 'string' && v.trim().endsWith('%')) def[pc] = parseFloat(v);
    else def[px] = Number(v);
  };
  tam(pos.ancho, 'width', 'percentWidth');
  tam(pos.alto, 'height', 'percentHeight');
}

const ALINEACION = { izquierda: 'left', centro: 'center', derecha: 'right', arriba: 'top', medio: 'middle', abajo: 'bottom' };
const DISPOSICION = { absoluta: 'absolute', horizontal: 'horizontal', vertical: 'vertical' };

class Constructor {
  constructor(opciones) {
    this.marca = opciones.marca || {};
    this.defs = [];
    this.porNombre = new Map();
    this.raiz = [];
    this.locales = {};
    this.imagenes = [];
    this.pendientes = [];
    this.avisos = [];
    this.efectos = null;
    this.fuente = opciones.fuente_resuelta || this.marca.fuente || 'Arial';
    this.estiloTooltip = opciones.estiloTooltip || null;
  }
  efecto() {
    if (!this.efectos) {
      const fi = { duration: 300, easing: 'linear', class: 'FadeInEffect', id: nuevoId('effect') };
      const fo = { duration: 300, easing: 'linear', class: 'FadeOutEffect', id: nuevoId('effect') };
      this.defs.push(fi, fo);
      this.efectos = { entrada: `this.${fi.id}`, salida: `this.${fo.id}` };
    }
    return this.efectos;
  }
  texto(id, clave, valor) { this.locales[`${id}.${clave}`] = { value: String(valor), class: 'LocaleValue' }; }
  icono(nombre, est, sufijo) {
    if (!ICONOS[nombre]) { this.avisos.push(`Icono desconocido "${nombre}".`); return null; }
    const ruta = `skin/${nombre}_${sufijo}_${hex(3)}.png`;
    this.imagenes.push({ nombre: ruta, datos: iconoPng(nombre, est) });
    return ruta;
  }

  /** c: especificacion de componente (ver esquema de la herramienta). Devuelve el id. */
  agregar(c, padreId) {
    const tipos = { contenedor: 'Container', boton: 'Button', boton_icono: 'IconButton', texto: 'Label', parrafo: 'HTMLText', imagen: 'Image' };
    const clase = tipos[c.tipo];
    if (!clase) throw new Error(`Tipo de componente desconocido "${c.tipo}" (use: ${Object.keys(tipos).join(', ')})`);
    if (!c.nombre) throw new Error('Cada componente necesita "nombre"');
    if (this.porNombre.has(c.nombre)) throw new Error(`Nombre repetido: ${c.nombre}`);
    const id = nuevoId(clase);
    const fuente = c.fuente || this.fuente;
    let def;
    if (clase === 'Container') {
      def = Object.assign(clon(BASE.Container), {
        arrangement: DISPOSICION[c.disposicion] || 'absolute',
        horizontalAlign: ALINEACION[c.alineacion_h] || 'left', verticalAlign: ALINEACION[c.alineacion_v] || 'top',
        gap: c.separacion ?? 10, overflow: 'visible', scrollBarVisible: 'rollOver',
        backgroundColor: [colorInt(c.fondo?.color || '#000000'), colorInt(c.fondo?.color2 || c.fondo?.color || '#000000')],
        backgroundColorDirection: c.fondo?.direccion === 'horizontal' ? 'horizontal' : 'vertical',
        backgroundOpacity: c.fondo ? (c.fondo.opacidad ?? 1) : 0, borderRadius: c.radio ?? 0, children: [],
        minWidth: 1, minHeight: 1
      });
    } else if (clase === 'HTMLText') {
      const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const color = c.color_texto || this.marca.color_texto || '#ffffff';
      const alin = { izquierda: 'left', centro: 'center', derecha: 'right' }[c.alineacion_h] || 'left';
      const parrafos = String(c.texto ?? '').split(/\n+/).map((p) =>
        `<P ALIGN="${alin}" LEADING="${c.interlineado || 150}%"><FONT FACE="${esc(fuente)}" SIZE="${c.tamano_fuente || 14}px" COLOR="${color}" LETTERSPACING="0px" KERNING="1">${c.negrita ? '<B>' : ''}${esc(p)}${c.negrita ? '</B>' : ''}</FONT></P>`).join('');
      def = Object.assign(clon(BASE.toolTip), COMUNES, {
        fontSizeUnit: 'px', pixelsPerUnitW: 15.98, pixelsPerUnitH: 9.07,
        scrollBarColor: 0, scrollBarMargin: 2, scrollBarOpacity: 0.5, scrollBarWidth: 6, scrollBarVisible: 'rollOver'
      });
      this.texto(id, 'html', parrafos);
    } else if (clase === 'Button') {
      const fondo = c.fondo?.color || this.marca.color_primario || '#1f6f43';
      def = Object.assign(clon(BASE.Button), {
        backgroundColor: [colorInt(fondo)], backgroundOpacity: c.fondo ? (c.fondo.opacidad ?? 1) : 1,
        rollOverBackgroundColor: [colorInt(c.fondo_hover || fondo)], rollOverBackgroundOpacity: c.fondo_hover ? 1 : 0.85,
        pressedBackgroundColor: [colorInt(c.fondo_hover || fondo)], pressedBackgroundOpacity: 1,
        fontColor: colorInt(c.color_texto || '#ffffff'),
        fontFamily: fuente, fontSize: c.tamano_fuente || 13,
        fontWeight: c.negrita === false ? 'normal' : 'bold', borderRadius: c.radio ?? 999, width: 130, height: 40,
        paddingLeft: 16, paddingRight: 18, gap: 8
      });
      if (c.icono?.nombre) {
        def.iconURL = this.icono(c.icono.nombre, { tamano: 64, estilo: 'linea', color: c.icono.color || c.color_texto || '#ffffff', grosor: c.icono.grosor || 2 }, 'b');
        def.iconWidth = c.icono.tamano || 18; def.iconHeight = c.icono.tamano || 18; def.iconBeforeLabel = true;
      }
      this.texto(id, 'label', c.texto ?? c.nombre);
    } else if (clase === 'IconButton') {
      const ic = c.icono || {};
      const est = {
        tamano: 128, estilo: ic.estilo || 'circulo', color: ic.color || this.marca.color_texto || '#ffffff',
        fondo: ic.fondo || this.marca.color_primario || '#1f6f43', grosor: ic.grosor || 2,
        escala_icono: ic.escala, opacidad_fondo: ic.opacidad_fondo ?? 1
      };
      const estHover = {
        ...est, estilo: ic.estilo_hover || est.estilo, fondo: ic.fondo_hover || this.marca.color_secundario || est.fondo,
        color: ic.color_hover || est.color, opacidad_fondo: ic.opacidad_fondo_hover ?? est.opacidad_fondo
      };
      const normal = this.icono(ic.nombre, est, 'n');
      const hover = this.icono(ic.nombre, estHover, 'h');
      def = Object.assign(clon(BASE.toolTip), COMUNES, {
        mode: 'push', cursor: 'hand', transparencyActive: true, horizontalAlign: 'center', verticalAlign: 'middle',
        iconURL: normal, rollOverIconURL: hover, pressedIconURL: hover, width: c.tamano || 48, height: c.tamano || 48
      });
    } else if (clase === 'Label') {
      def = Object.assign(clon(BASE.toolTip), COMUNES, {
        text: String(c.texto ?? ''), fontFamily: fuente, fontSize: c.tamano_fuente || 14,
        fontWeight: c.negrita ? 'bold' : 'normal', fontStyle: 'normal', textDecoration: 'none',
        fontColor: colorInt(c.color_texto || this.marca.color_texto || '#ffffff'),
        horizontalAlign: ALINEACION[c.alineacion_h] || 'left', verticalAlign: ALINEACION[c.alineacion_v] || 'top'
      });
      this.texto(id, 'text', c.texto ?? '');
    } else if (clase === 'Image') {
      def = Object.assign(clon(BASE.toolTip), COMUNES, { scaleMode: c.escala || 'fit_inside', horizontalAlign: 'center', verticalAlign: 'middle' });
      if (c.imagen && fs.existsSync(c.imagen)) {
        const ruta = `skin/${id}${path.extname(c.imagen).toLowerCase()}`;
        this.imagenes.push({ nombre: ruta, datos: fs.readFileSync(c.imagen) });
        def.url = ruta;
      } else this.avisos.push(`Imagen no encontrada para ${c.nombre}: ${c.imagen}`);
    }
    Object.assign(def, { id, class: clase, name: c.nombre, visible: c.visible !== false });
    if (c.relleno !== undefined) {
      const r = typeof c.relleno === 'number' ? [c.relleno, c.relleno, c.relleno, c.relleno] : c.relleno;
      [def.paddingTop, def.paddingRight, def.paddingBottom, def.paddingLeft] = r;
    }
    // estilo comun: borde, sombra, desenfoque, tooltip con el tema
    if (c.borde) Object.assign(def, { borderSize: c.borde.grosor ?? 1, borderColor: colorInt(c.borde.color || '#ffffff') });
    if (c.sombra) {
      const s = c.sombra === true ? {} : c.sombra;
      Object.assign(def, { shadow: true, shadowBlurRadius: s.desenfoque ?? 24, shadowOpacity: s.opacidad ?? 0.35, shadowDistance: s.distancia ?? 8, shadowAngle: s.angulo ?? 90, shadowColor: colorInt(s.color || '#000000'), shadowSpread: s.expansion ?? 0 });
    }
    if (c.desenfoque) def.backgroundBlur = c.desenfoque;
    if (this.estiloTooltip) Object.assign(def, this.estiloTooltip);
    if (c.tooltip) { def.toolTip = c.tooltip; this.texto(id, 'toolTip', c.tooltip); }
    aplicarPosicion(def, c.posicion);
    if (c.acciones?.length) this.pendientes.push({ def, acciones: c.acciones });
    this.defs.push(def);
    this.porNombre.set(c.nombre, def);
    if (padreId) this.defs.find((d) => d.id === padreId).children.push(`this.${id}`);
    else this.raiz.push(`this.${id}`);
    for (const h of c.hijos || []) {
      if (clase !== 'Container') throw new Error(`${c.nombre}: solo los contenedores pueden tener hijos`);
      this.agregar(h, id);
    }
    return id;
  }

  /** Resuelve acciones al final (pueden referirse a componentes declarados despues). */
  resolverAcciones() {
    for (const { def, acciones } of this.pendientes) {
      def.behaviours = acciones.map((a) => {
        const evento = a.evento || 'click';
        const refs = () => (a.componentes || []).map((n) => {
          const d = this.porNombre.get(n);
          if (!d) throw new Error(`${def.name}: la accion se refiere a "${n}", que no existe en el skin`);
          return `this.${d.id}`;
        });
        switch (a.tipo) {
          case 'mostrar': case 'ocultar': case 'alternar': {
            const action = { mostrar: 'showComponents', ocultar: 'hideComponents', alternar: 'showHideComponents' }[a.tipo];
            const b = { tagsLogicalOperation: 'or', class: 'ShowHideBehaviour', componentsToApply: refs(), action, event: evento };
            if (a.efecto !== false) { const e = this.efecto(); if (a.tipo !== 'ocultar') b.effectIn = e.entrada; if (a.tipo !== 'mostrar') b.effectOut = e.salida; }
            return b;
          }
          case 'siguiente': return { event: evento, class: 'NextPlayListBehaviour', action: 'nextMedia' };
          case 'anterior': return { event: evento, class: 'PreviousPlayListBehaviour', action: 'previousMedia' };
          case 'url': return { event: evento, action: 'openURL', method: a.nueva_pestana === false ? '_self' : '_blank', source: a.url, class: 'LinkBehaviour' };
          case 'javascript': return { action: 'executeJavascript', class: 'ExecuteJavascriptBehaviour', event: evento, code: a.codigo };
          case 'codigo_mcp': return { action: 'executeJavascript', class: 'ExecuteJavascriptBehaviour', event: evento, code: generarCodigo(a.accion, a.parametros || {}, 'accion') };
          default: throw new Error(`${def.name}: tipo de accion desconocido "${a.tipo}" (use mostrar, ocultar, alternar, siguiente, anterior, url, javascript, codigo_mcp)`);
        }
      });
    }
  }
}

// ---------------- Plantillas de alto nivel ----------------
const BOTONES = {
  anterior: { icono: 'anterior', tooltip: 'Anterior', accion: { tipo: 'anterior' } },
  siguiente: { icono: 'siguiente', tooltip: 'Siguiente', accion: { tipo: 'siguiente' } },
  inicio: { icono: 'inicio', tooltip: 'Inicio', accion: { tipo: 'codigo_mcp', accion: 'ir_a_escena', parametros: { escena: 0 } } },
  info: { icono: 'info', tooltip: 'Información', accion: { tipo: 'mostrar', componentes: ['Panel_Info'] } },
  auto: { icono: 'play', tooltip: 'Recorrido automático', accion: (o) => ({ tipo: 'codigo_mcp', accion: 'auto_recorrido', parametros: { segundos: o.auto_segundos || 15 } }) },
  audio: { icono: 'audio', tooltip: 'Sonido', accion: { tipo: 'codigo_mcp', accion: 'silenciar' } },
  pantalla: { icono: 'pantalla', tooltip: 'Pantalla completa', accion: { tipo: 'codigo_mcp', accion: 'pantalla_completa' } },
  compartir: { icono: 'compartir', tooltip: 'Compartir', accion: (o) => ({ tipo: 'codigo_mcp', accion: 'compartir', parametros: { titulo: o.titulo || '' } }) },
  whatsapp: { icono: 'whatsapp', tooltip: 'WhatsApp', requiere: 'whatsapp', accion: (o) => ({ tipo: 'codigo_mcp', accion: 'whatsapp', parametros: { numero: o.contacto.whatsapp, mensaje: o.contacto.mensaje_whatsapp || 'Hola, vi el recorrido virtual', incluir_escena: o.contacto.incluir_escena !== false } }) },
  telefono: { icono: 'telefono', tooltip: 'Llamar', requiere: 'telefono', accion: (o) => ({ tipo: 'codigo_mcp', accion: 'llamar', parametros: { telefono: o.contacto.telefono } }) },
  correo: { icono: 'correo', tooltip: 'Correo', requiere: 'email', accion: (o) => ({ tipo: 'codigo_mcp', accion: 'correo', parametros: { email: o.contacto.email, asunto: o.titulo || '' } }) },
  ubicacion: { icono: 'ubicacion', tooltip: 'Ubicación', requiere: 'ubicacion_url', accion: (o) => ({ tipo: 'url', url: o.contacto.ubicacion_url }) }
};
export const BOTONES_VTS = Object.keys(BOTONES);

// ---------------- Temas visuales ----------------
const TEMAS = {
  oscuro: { vidrio: '#0e1311', opVidrio: 0.55, tarjeta: '#121816', opTarjeta: 0.88, borde: '#3b4541', texto: '#ffffff', suave: '#c3cdc8', icono: '#ffffff', velo: 0.5, hoverIcono: '#ffffff', tooltip: '#0b0f0d', tooltipTexto: '#ffffff' },
  claro: { vidrio: '#ffffff', opVidrio: 0.78, tarjeta: '#ffffff', opTarjeta: 0.96, borde: '#e2e7e4', texto: '#14201a', suave: '#56655d', icono: '#14201a', velo: 0.35, hoverIcono: '#ffffff', tooltip: '#14201a', tooltipTexto: '#ffffff' }
};

function estiloTooltip(t, fuente) {
  return {
    toolTipBackgroundColor: colorInt(t.tooltip), toolTipFontColor: colorInt(t.tooltipTexto), toolTipFontFamily: fuente, toolTipFontSize: 12,
    toolTipFontWeight: 'normal', toolTipBorderSize: 0, toolTipBorderRadius: 8, toolTipPaddingTop: 6, toolTipPaddingBottom: 6,
    toolTipPaddingLeft: 10, toolTipPaddingRight: 10, toolTipShadowOpacity: 0.25, toolTipShadowBlurRadius: 12, toolTipShadowDistance: 4, toolTipOpacity: 0.95
  };
}

function componentesPlantilla(o, avisos) {
  const lista = [];
  const marca = o.marca || {};
  const t = { ...TEMAS[o.tema === 'claro' ? 'claro' : 'oscuro'] };
  if (marca.color_fondo) t.vidrio = t.tarjeta = marca.color_fondo;
  if (marca.color_texto) t.texto = t.icono = marca.color_texto;
  const acento = marca.color_primario || '#1f6f43';
  const vidrio = (op = t.opVidrio) => ({ fondo: { color: t.vidrio, opacidad: marca.opacidad_fondo ?? op }, desenfoque: 18, borde: { grosor: 1, color: t.borde }, sombra: { desenfoque: 28, opacidad: 0.28, distancia: 10 } });
  const tam = o.tamano_boton || 44, sep = 2, rel = 6;
  const estiloIcono = o.estilo_iconos || 'moderno';
  const iconoBarra = (nombre) => estiloIcono === 'moderno'
    ? { nombre, estilo: 'linea', escala: 0.46, color: t.icono, grosor: 1.8, estilo_hover: 'circulo', fondo_hover: acento, color_hover: t.hoverIcono, opacidad_fondo_hover: 1 }
    : { nombre, estilo: estiloIcono, color: '#ffffff', fondo: acento };

  const botones = (o.botones || ['anterior', 'siguiente', 'info', 'pantalla', 'audio']).filter((b) => {
    const def = BOTONES[b];
    if (!def) { avisos.push(`Boton "${b}" no disponible en skins nativos (validos: ${BOTONES_VTS.join(', ')}).`); return false; }
    if (def.requiere && !o.contacto?.[def.requiere]) { avisos.push(`Boton "${b}" omitido: falta contacto.${def.requiere}.`); return false; }
    return true;
  });
  // en la barra, los contactos se agrupan en la tarjeta de info si existe
  const lateral = o.plantilla === 'barra_lateral';
  if (botones.length) {
    const largo = botones.length * tam + (botones.length - 1) * sep + rel * 2, corto = tam + rel * 2;
    const barra = {
      tipo: 'contenedor', nombre: 'Contenedor_Barra', disposicion: lateral ? 'vertical' : 'horizontal',
      alineacion_h: 'centro', alineacion_v: 'medio', separacion: sep, relleno: rel, radio: corto / 2, ...vidrio(),
      posicion: lateral ? { ancho: corto, alto: largo } : { ancho: largo, alto: corto },
      hijos: botones.map((b) => {
        const d = BOTONES[b];
        const acc = typeof d.accion === 'function' ? d.accion(o) : d.accion;
        return { tipo: 'boton_icono', nombre: `Boton_${b[0].toUpperCase()}${b.slice(1)}`, icono: iconoBarra(d.icono), tamano: tam, tooltip: d.tooltip, acciones: [acc] };
      })
    };
    lista.push(lateral
      ? { tipo: 'contenedor', nombre: 'Contenedor_BarraLateral', disposicion: 'vertical', alineacion_h: 'izquierda', alineacion_v: 'medio', posicion: { izquierda: 20, arriba: '0%', ancho: corto + 20, alto: '100%' }, hijos: [barra] }
      : { tipo: 'contenedor', nombre: 'Contenedor_BarraInferior', disposicion: 'horizontal', alineacion_h: 'centro', alineacion_v: 'medio', posicion: { izquierda: '0%', abajo: 24, ancho: '100%', alto: corto + 24 }, hijos: [barra] });
  }

  // Tarjeta de marca (logo + nombre + subtitulo) arriba a la izquierda
  if (o.mostrar_nombre !== false && (marca.nombre || marca.logo)) {
    const anchoTexto = Math.max((marca.nombre || '').length * 9.5, (marca.subtitulo || '').length * 6.6, 60);
    const conLogo = !!marca.logo, alto = marca.subtitulo || conLogo ? 60 : 46;
    const hijos = [];
    if (conLogo) hijos.push({ tipo: 'imagen', nombre: 'Imagen_Logo', imagen: marca.logo, posicion: { ancho: alto - 16, alto: alto - 16 } });
    const textos = [];
    if (marca.nombre) textos.push({ tipo: 'texto', nombre: 'Texto_Nombre', texto: marca.nombre, tamano_fuente: 16, negrita: true, color_texto: t.texto, posicion: { ancho: anchoTexto, alto: 20 } });
    if (marca.subtitulo) textos.push({ tipo: 'texto', nombre: 'Texto_Subtitulo', texto: marca.subtitulo, tamano_fuente: 11, color_texto: t.suave, posicion: { ancho: anchoTexto, alto: 15 } });
    if (textos.length) hijos.push({ tipo: 'contenedor', nombre: 'Contenedor_MarcaTextos', disposicion: 'vertical', alineacion_v: 'medio', separacion: 2, posicion: { ancho: anchoTexto, alto: alto - 16 }, hijos: textos });
    lista.push({
      tipo: 'contenedor', nombre: 'Contenedor_Marca', disposicion: 'horizontal', alineacion_v: 'medio', separacion: 12,
      relleno: [8, 20, 8, conLogo ? 8 : 20], radio: 16, ...vidrio(),
      posicion: { izquierda: 20, arriba: 20, ancho: (conLogo ? alto - 16 + 12 : 0) + anchoTexto + (conLogo ? 28 : 40), alto },
      ...(marca.url ? { acciones: [{ tipo: 'url', url: marca.url }] } : {}),
      hijos
    });
  }

  // Tarjeta de informacion con velo, encabezado, acento, cuerpo y botones de contacto
  if (botones.includes('info')) {
    const info = o.info || {}, W = info.ancho || 460;
    const contactos = [];
    if (o.contacto?.whatsapp) contactos.push({ n: 'WhatsApp', ic: 'whatsapp', bg: '#25d366', acc: BOTONES.whatsapp.accion(o) });
    if (o.contacto?.telefono) contactos.push({ n: 'Llamar', ic: 'telefono', bg: acento, acc: BOTONES.telefono.accion(o) });
    if (o.contacto?.email) contactos.push({ n: 'Correo', ic: 'correo', bg: acento, acc: BOTONES.correo.accion(o) });
    if (o.contacto?.ubicacion_url) contactos.push({ n: 'Ubicación', ic: 'ubicacion', bg: acento, acc: BOTONES.ubicacion.accion(o) });
    const altoCuerpo = info.alto_texto || Math.max(60, Math.ceil(((info.texto || '').length * 7.2) / (W - 56)) * 22);
    const H = 112 + altoCuerpo + (contactos.length ? 72 : 28);
    const hijos = [
      { tipo: 'texto', nombre: 'Texto_InfoEtiqueta', texto: (info.etiqueta || 'INFORMACIÓN').toUpperCase(), tamano_fuente: 11, negrita: true, color_texto: acento, posicion: { izquierda: 28, arriba: 28, ancho: W - 100, alto: 16 } },
      { tipo: 'texto', nombre: 'Texto_InfoTitulo', texto: info.titulo || marca.nombre || 'Bienvenidos', tamano_fuente: 24, negrita: true, color_texto: t.texto, posicion: { izquierda: 28, arriba: 48, ancho: W - 100, alto: 32 } },
      { tipo: 'boton_icono', nombre: 'Boton_CerrarInfo', tamano: 36, tooltip: 'Cerrar', posicion: { derecha: 18, arriba: 18 },
        icono: { nombre: 'cerrar', estilo: 'linea', escala: 0.42, color: t.suave, grosor: 1.8, estilo_hover: 'circulo', fondo_hover: t.texto, opacidad_fondo_hover: 0.12, color_hover: t.texto },
        acciones: [{ tipo: 'ocultar', componentes: ['Panel_Info'] }] },
      { tipo: 'contenedor', nombre: 'Linea_InfoAcento', fondo: { color: acento, opacidad: 1 }, radio: 2, posicion: { izquierda: 28, arriba: 90, ancho: 36, alto: 3 } },
      { tipo: 'parrafo', nombre: 'Texto_InfoCuerpo', texto: info.texto || '', tamano_fuente: 14, color_texto: t.suave, posicion: { izquierda: 28, arriba: 108, ancho: W - 56, alto: altoCuerpo } }
    ];
    if (contactos.length) {
      hijos.push({
        tipo: 'contenedor', nombre: 'Contenedor_InfoContacto', disposicion: 'horizontal', alineacion_v: 'medio', separacion: 10,
        posicion: { izquierda: 28, abajo: 26, ancho: W - 56, alto: 40 },
        hijos: contactos.map((c) => ({ tipo: 'boton', nombre: `Boton_Info${c.n.normalize('NFD').replace(/[̀-ͯ]/g, '')}`, texto: c.n, icono: { nombre: c.ic }, fondo: { color: c.bg }, tamano_fuente: 13, posicion: { ancho: 40 + c.n.length * 8.5 + 30, alto: 40 }, acciones: [c.acc] }))
      });
    }
    lista.push({
      tipo: 'contenedor', nombre: 'Panel_Info', visible: false, disposicion: 'horizontal', alineacion_h: 'centro', alineacion_v: 'medio',
      fondo: { color: '#000000', opacidad: t.velo }, desenfoque: 6, posicion: { izquierda: '0%', arriba: '0%', ancho: '100%', alto: '100%' },
      hijos: [{ tipo: 'contenedor', nombre: 'Caja_Info', disposicion: 'absoluta', radio: 22, ...vidrio(t.opTarjeta), fondo: { color: t.tarjeta, opacidad: t.opTarjeta }, sombra: { desenfoque: 48, opacidad: 0.4, distancia: 18 }, posicion: { ancho: W, alto: H }, hijos }]
    });
  }
  return lista;
}

function miniatura(o) {
  const W = 320, H = 180, px = new Uint8Array(W * H * 4);
  const [r1, g1, b1] = hexARgb('#6f8fa8'), [r2, g2, b2] = hexARgb('#2b3a44');
  const t = TEMAS[o.tema === 'claro' ? 'claro' : 'oscuro'], [vr, vg, vb] = hexARgb(t.vidrio), [ar, ag, ab] = hexARgb(o.marca?.color_primario || '#1f6f43');
  const enPildora = (x, y, x0, y0, w, h) => { const r = h / 2, cx = Math.min(Math.max(x, x0 + r), x0 + w - r); return (x - cx) ** 2 + (y - (y0 + r)) ** 2 <= r * r; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y / H, i = (y * W + x) * 4;
    let c = [r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k];
    if (enPildora(x, y, 104, 146, 112, 22)) c = c.map((v, j) => v * 0.4 + [vr, vg, vb][j] * 0.6);
    if (enPildora(x, y, 12, 12, 90, 20)) c = c.map((v, j) => v * 0.4 + [vr, vg, vb][j] * 0.6);
    if (enPildora(x, y, 152, 150, 16, 14)) c = [ar, ag, ab];
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  return codificarPng(W, H, px);
}

/** Fuentes a incrustar: [{familia, archivo, estilo: Regular|Bold}] -> entradas fonts/ */
function fuentesIncrustadas(lista, avisos) {
  const info = [], entradas = [];
  for (const f of lista || []) {
    if (!f.archivo || !fs.existsSync(f.archivo)) { avisos.push(`Fuente no encontrada: ${f.archivo}`); continue; }
    const base = path.basename(f.archivo);
    if (!/\.(ttf|otf)$/i.test(base)) { avisos.push(`Fuente ${base}: use .ttf u .otf`); continue; }
    entradas.push({ nombre: `fonts/${base}`, datos: fs.readFileSync(f.archivo) });
    info.push({ class: 'FontInfo', family: f.familia, name: `${f.familia}${f.estilo === 'Bold' ? ' Bold' : ''}`, style: f.estilo === 'Bold' ? 'Bold' : 'Regular', path: base });
  }
  if (info.length) entradas.push({ nombre: 'fonts/fonts.data', datos: Buffer.from(JSON.stringify(info)) });
  return { entradas, familia: info[0]?.family };
}

/**
 * Crea un archivo .vts importable en 3DVista.
 * o: { archivo_salida, titulo, tema, marca, plantilla, botones, contacto, info, componentes, fuentes, idiomas, ... }
 */
export function crearSkinVts(o) {
  if (!o.archivo_salida) throw new Error('Falta archivo_salida (ruta del .vts a crear)');
  const salida = /\.vts$/i.test(o.archivo_salida) ? o.archivo_salida : o.archivo_salida + '.vts';
  o = { ...o, contacto: o.contacto || {}, marca: o.marca || {} };
  const avisosFuentes = [];
  const fuentes = fuentesIncrustadas(o.fuentes, avisosFuentes);
  const fuente = o.marca.fuente || fuentes.familia || 'Arial';
  const tema = TEMAS[o.tema === 'claro' ? 'claro' : 'oscuro'];
  const k = new Constructor({ ...o, fuente_resuelta: fuente, estiloTooltip: estiloTooltip(tema, fuente) });
  k.avisos.push(...avisosFuentes);
  if (!fuentes.familia && !o.marca.fuente) k.avisos.push('Sin fuente incrustada se usa Arial. Para un look mas moderno pase "fuentes" con archivos .ttf/.otf (p. ej. Montserrat o Inter, licencia OFL).');
  const viewer = clon(BASE.viewer);
  k.defs.push(viewer);
  const especificacion = [
    ...(o.plantilla === 'ninguna' ? [] : componentesPlantilla(o, k.avisos)),
    ...(o.componentes || [])
  ];
  for (const c of especificacion) k.agregar(c);
  k.resolverAcciones();

  const player = clon(BASE.player);
  player.name = 'Player_MCP3DV';
  player.definitions = k.defs;
  player.device2Children = { general: ['this.MainViewer', ...k.raiz] };
  const idiomas = o.idiomas && o.idiomas.length ? o.idiomas : ['es', 'en'];
  player.data = { locales: idiomas.map((l) => ({ data: clon(k.locales), class: 'Locale', language: l })), initialScale: 0.5 };

  const info = { isAdaptableSize: true, class: 'SkinInfo', title: o.titulo || o.marca.nombre || 'Skin MCP 3DVista' };
  const entradas = [
    { nombre: 'info', datos: Buffer.from(JSON.stringify(info, null, 4)) },
    { nombre: 'script.js', datos: Buffer.from(JSON.stringify(player)) },
    { nombre: 'thumbnail.jpg', datos: miniatura(o) },
    { nombre: 'version', datos: Buffer.from(BASE.version) },
    ...k.imagenes.map((i) => ({ nombre: i.nombre, datos: i.datos })),
    ...fuentes.entradas
  ];
  fs.mkdirSync(path.dirname(path.resolve(salida)), { recursive: true });
  fs.writeFileSync(salida, zip(entradas));
  const arbol = [];
  const pintar = (ref, prof) => {
    const d = k.defs.find((x) => `this.${x.id}` === ref);
    if (!d) return;
    const acc = (d.behaviours || []).map((b) => b.action).join(', ');
    arbol.push(`${'  '.repeat(prof)}- ${d.name} (${d.class}${d.visible === false ? ', oculto' : ''})${acc ? ` → ${acc}` : ''}`);
    for (const h of d.children || []) pintar(h, prof + 1);
  };
  k.raiz.forEach((r) => pintar(r, 0));
  return { archivo: path.resolve(salida), arbol, avisos: k.avisos, imagenes: k.imagenes.length, fuente };
}
