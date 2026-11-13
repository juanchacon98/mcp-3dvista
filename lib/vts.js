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
    const tipos = { contenedor: 'Container', boton: 'Button', boton_icono: 'IconButton', texto: 'Label', imagen: 'Image' };
    const clase = tipos[c.tipo];
    if (!clase) throw new Error(`Tipo de componente desconocido "${c.tipo}" (use: ${Object.keys(tipos).join(', ')})`);
    if (!c.nombre) throw new Error('Cada componente necesita "nombre"');
    if (this.porNombre.has(c.nombre)) throw new Error(`Nombre repetido: ${c.nombre}`);
    const id = nuevoId(clase);
    let def;
    if (clase === 'Container') {
      def = Object.assign(clon(BASE.Container), {
        arrangement: DISPOSICION[c.disposicion] || 'absolute',
        horizontalAlign: ALINEACION[c.alineacion_h] || 'left', verticalAlign: ALINEACION[c.alineacion_v] || 'top',
        gap: c.separacion ?? 10, overflow: 'visible', scrollBarVisible: 'rollOver',
        backgroundColor: [colorInt(c.fondo?.color || '#000000'), colorInt(c.fondo?.color || '#000000')],
        backgroundOpacity: c.fondo ? (c.fondo.opacidad ?? 1) : 0, borderRadius: c.radio ?? 0, children: []
      });
    } else if (clase === 'Button') {
      def = Object.assign(clon(BASE.Button), {
        backgroundColor: [colorInt(c.fondo?.color || this.marca.color_primario || '#1f6f43')],
        backgroundOpacity: c.fondo ? (c.fondo.opacidad ?? 1) : 1,
        rollOverBackgroundColor: [colorInt(this.marca.color_secundario || c.fondo?.color || '#2e8b57')],
        pressedBackgroundColor: [colorInt(this.marca.color_secundario || c.fondo?.color || '#2e8b57')],
        fontColor: colorInt(c.color_texto || this.marca.color_texto || '#ffffff'),
        fontFamily: c.fuente || this.marca.fuente || 'Arial', fontSize: c.tamano_fuente || 13,
        fontWeight: c.negrita === false ? 'normal' : 'bold', borderRadius: c.radio ?? 20, width: 130, height: 40
      });
      this.texto(id, 'label', c.texto ?? c.nombre);
    } else if (clase === 'IconButton') {
      const ic = c.icono || {};
      const est = { tamano: 128, estilo: ic.estilo || 'circulo', color: ic.color || this.marca.color_texto || '#ffffff', fondo: ic.fondo || this.marca.color_primario || '#1f6f43' };
      const estHover = { ...est, fondo: ic.fondo_hover || this.marca.color_secundario || est.fondo, color: ic.color_hover || est.color };
      const normal = this.icono(ic.nombre, est, 'n');
      const hover = this.icono(ic.nombre, estHover, 'h');
      def = Object.assign(clon(BASE.toolTip), COMUNES, {
        mode: 'push', cursor: 'hand', transparencyActive: true, horizontalAlign: 'center', verticalAlign: 'middle',
        iconURL: normal, rollOverIconURL: hover, pressedIconURL: hover, width: c.tamano || 48, height: c.tamano || 48
      });
    } else if (clase === 'Label') {
      def = Object.assign(clon(BASE.toolTip), COMUNES, {
        text: String(c.texto ?? ''), fontFamily: c.fuente || this.marca.fuente || 'Arial', fontSize: c.tamano_fuente || 14,
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
    if (c.tooltip) this.texto(id, 'toolTip', c.tooltip);
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

function componentesPlantilla(o, avisos) {
  const lista = [];
  const marca = o.marca || {};
  const tam = o.tamano_boton || 44, sep = 8, rel = 8;
  const botones = (o.botones || ['anterior', 'siguiente', 'info', 'pantalla', 'audio']).filter((b) => {
    const def = BOTONES[b];
    if (!def) { avisos.push(`Boton "${b}" no disponible en skins nativos (validos: ${BOTONES_VTS.join(', ')}).`); return false; }
    if (def.requiere && !o.contacto?.[def.requiere]) { avisos.push(`Boton "${b}" omitido: falta contacto.${def.requiere}.`); return false; }
    return true;
  });
  const lateral = o.plantilla === 'barra_lateral';
  if (botones.length) {
    const largo = botones.length * tam + (botones.length - 1) * sep + rel * 2, corto = tam + rel * 2;
    const barra = {
      tipo: 'contenedor', nombre: 'Contenedor_Barra', disposicion: lateral ? 'vertical' : 'horizontal',
      alineacion_h: 'centro', alineacion_v: 'medio', separacion: sep, relleno: rel,
      fondo: { color: marca.color_fondo || '#0f1914', opacidad: marca.opacidad_fondo ?? 0.65 }, radio: corto / 2,
      posicion: lateral ? { ancho: corto, alto: largo } : { ancho: largo, alto: corto },
      hijos: botones.map((b) => {
        const d = BOTONES[b];
        const acc = typeof d.accion === 'function' ? d.accion(o) : d.accion;
        return { tipo: 'boton_icono', nombre: `Boton_${b[0].toUpperCase()}${b.slice(1)}`, icono: { nombre: d.icono, estilo: o.estilo_iconos || 'circulo' }, tamano: tam, tooltip: d.tooltip, acciones: [acc] };
      })
    };
    // envoltura transparente a todo el ancho/alto para centrar la barra
    lista.push(lateral
      ? { tipo: 'contenedor', nombre: 'Contenedor_BarraLateral', disposicion: 'vertical', alineacion_h: 'izquierda', alineacion_v: 'medio', posicion: { izquierda: 16, arriba: '0%', ancho: corto, alto: '100%' }, hijos: [barra] }
      : { tipo: 'contenedor', nombre: 'Contenedor_BarraInferior', disposicion: 'horizontal', alineacion_h: 'centro', alineacion_v: 'medio', posicion: { izquierda: '0%', abajo: 16, ancho: '100%', alto: corto }, hijos: [barra] });
  }
  if (marca.logo) {
    lista.push({ tipo: 'imagen', nombre: 'Imagen_Logo', imagen: marca.logo, posicion: { izquierda: 16, arriba: 16, ancho: marca.logo_ancho || 160, alto: marca.logo_alto || 64 } });
  }
  if (o.mostrar_nombre !== false && marca.nombre) {
    lista.push({ tipo: 'texto', nombre: 'Texto_Nombre', texto: marca.nombre, tamano_fuente: 20, negrita: true, posicion: { izquierda: marca.logo ? 190 : 16, arriba: 30, ancho: 400, alto: 34 } });
  }
  if (botones.includes('info')) {
    const info = o.info || {};
    lista.push({
      tipo: 'contenedor', nombre: 'Panel_Info', visible: false, disposicion: 'horizontal', alineacion_h: 'centro', alineacion_v: 'medio',
      fondo: { color: '#000000', opacidad: 0.45 }, posicion: { izquierda: '0%', arriba: '0%', ancho: '100%', alto: '100%' },
      hijos: [{
        tipo: 'contenedor', nombre: 'Caja_Info', disposicion: 'vertical', alineacion_h: 'izquierda', alineacion_v: 'arriba', separacion: 12, relleno: 24,
        fondo: { color: marca.color_fondo || '#0f1914', opacidad: 0.95 }, radio: 16, posicion: { ancho: 480, alto: info.alto || 300 },
        hijos: [
          { tipo: 'boton_icono', nombre: 'Boton_CerrarInfo', icono: { nombre: 'cerrar', estilo: 'linea', color: marca.color_texto || '#ffffff' }, tamano: 28, acciones: [{ tipo: 'ocultar', componentes: ['Panel_Info'] }] },
          { tipo: 'texto', nombre: 'Texto_InfoTitulo', texto: info.titulo || marca.nombre || 'Información', tamano_fuente: 22, negrita: true, posicion: { ancho: '100%', alto: 32 } },
          { tipo: 'texto', nombre: 'Texto_InfoCuerpo', texto: info.texto || '', tamano_fuente: 14, posicion: { ancho: '100%', alto: info.alto ? info.alto - 120 : 180 } }
        ]
      }]
    });
  }
  return lista;
}

function miniatura(o) {
  const W = 320, H = 180, px = new Uint8Array(W * H * 4);
  const [r1, g1, b1] = hexARgb('#5a8fd6'), [r2, g2, b2] = hexARgb('#1b4f9c'), [br, bg, bb] = hexARgb(o.marca?.color_primario || '#1f6f43');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = y / H, i = (y * W + x) * 4;
    let c = [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t];
    if (y > H - 34 && y < H - 12 && x > W * 0.3 && x < W * 0.7) c = [br, bg, bb];
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  return codificarPng(W, H, px);
}

/**
 * Crea un archivo .vts importable en 3DVista.
 * o: { archivo_salida, titulo, marca, plantilla, botones, contacto, info, componentes, idiomas, ... }
 */
export function crearSkinVts(o) {
  if (!o.archivo_salida) throw new Error('Falta archivo_salida (ruta del .vts a crear)');
  const salida = /\.vts$/i.test(o.archivo_salida) ? o.archivo_salida : o.archivo_salida + '.vts';
  o = { ...o, contacto: o.contacto || {}, marca: o.marca || {} };
  const k = new Constructor(o);
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
    ...k.imagenes.map((i) => ({ nombre: i.nombre, datos: i.datos }))
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
  return { archivo: path.resolve(salida), arbol, avisos: k.avisos, imagenes: k.imagenes.length };
}
