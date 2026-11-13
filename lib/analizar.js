// Analiza un export HTML5 de 3DVista: escenas, componentes del skin, hotspots,
// listas de reproduccion, funciones de script disponibles y recursos externos.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const MEDIA = new Set(['Panorama', 'Video360', 'Video', 'Photo', 'PhotoAlbum', 'Map', 'Model3D', 'VideoPanorama', 'HDRPanorama', 'FramePanorama', 'QuadVideo360']);
const NO_COMPONENTES = /PlayListItem|Camera|Overlay|Hotspot|ImageResource|ResourceLevel|Audio|Effect|Sequence|Movement|Behaviour/;

export function encontrarIndex(dir) {
  for (const n of ['index.htm', 'index.html']) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function validarDir(dir) {
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`La carpeta no existe: ${dir}`);
  }
}

/** Archivos .js del export (raiz y un nivel) que contienen definiciones del recorrido. */
function archivosScript(dir) {
  const out = [];
  const revisar = (d, prof) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory() && prof < 1 && !/^(lib|media|node_modules)$/i.test(e.name)) revisar(p, prof + 1);
      else if (e.isFile() && /\.js$/i.test(e.name) && fs.statSync(p).size < 60 * 1024 * 1024) {
        const txt = fs.readFileSync(p, 'utf8');
        if (txt.includes('"definitions"') || txt.includes('definitions:')) out.push({ archivo: p, texto: txt });
      }
    }
  };
  revisar(dir, 0);
  return out;
}

/** Ejecuta el script en un sandbox con objetos simulados y captura el objeto con "definitions". */
function capturarScript(texto) {
  const capturados = [];
  const revisar = (args) => {
    for (const a of args) if (a && typeof a === 'object' && Array.isArray(a.definitions)) capturados.push(a);
  };
  const crearStub = () => {
    const fn = function () {};
    const prox = new Proxy(fn, {
      get(_t, k) {
        if (k === Symbol.toPrimitive) return () => '';
        if (k === 'toString' || k === 'valueOf') return () => '';
        if (k === 'then') return undefined;
        if (k === 'trans') return (key) => `@@${key}`;
        return prox;
      },
      apply(_t, _th, args) { revisar(args); return prox; },
      construct(_t, args) { revisar(args); return prox; },
      set() { return true; },
      has() { return true; }
    });
    return prox;
  };
  const stub = crearStub();
  const reales = { Object, Array, JSON, Math, String, Number, Boolean, Date, RegExp, Error, Symbol, Promise, parseInt, parseFloat, isNaN, isFinite, undefined, NaN, Infinity, encodeURIComponent, decodeURIComponent, Map, Set };
  const ambito = new Proxy({}, {
    has: () => true,
    get(_t, k) {
      if (k === Symbol.unscopables) return undefined;
      if (k in reales) return reales[k];
      if (k === 'trans') return (key) => `@@${key}`;
      return stub;
    },
    set() { return true; }
  });
  const ctx = vm.createContext({ __ambito: ambito });
  try {
    new vm.Script(`with (__ambito) {\n${texto}\n}`).runInContext(ctx, { timeout: 4000 });
  } catch { /* el script puede fallar al final; nos sirve lo ya capturado */ }
  return capturados.sort((a, b) => b.definitions.length - a.definitions.length)[0] || null;
}

function leerLocales(dir) {
  const ldir = path.join(dir, 'locale');
  const locales = {};
  if (!fs.existsSync(ldir)) return locales;
  for (const f of fs.readdirSync(ldir)) {
    if (!/\.txt$/i.test(f)) continue;
    const mapa = {};
    for (const linea of fs.readFileSync(path.join(ldir, f), 'utf8').split(/\r?\n/)) {
      const m = linea.match(/^\s*([^=#]+?)\s*=\s*(.*)$/);
      if (m) mapa[m[1]] = m[2].replace(/\\n/g, ' ').trim();
    }
    locales[f.replace(/\.txt$/i, '')] = mapa;
  }
  return locales;
}

function recorrer(nodo, visit, prof = 0, vistos = new Set()) {
  if (!nodo || typeof nodo !== 'object' || prof > 40 || vistos.has(nodo)) return;
  vistos.add(nodo);
  if (Array.isArray(nodo)) { for (const x of nodo) recorrer(x, visit, prof + 1, vistos); return; }
  if (typeof nodo.class === 'string') visit(nodo);
  for (const k of Object.keys(nodo)) {
    const v = nodo[k];
    if (v && typeof v === 'object') recorrer(v, visit, prof + 1, vistos);
  }
}

function refId(v) {
  if (typeof v !== 'string') return null;
  const m = v.match(/^this\.([\w$]+)/);
  return m ? m[1] : v;
}

/** Plan B si el sandbox no pudo capturar el script: extraccion por expresiones regulares. */
function analisisRegex(texto) {
  const clases = {};
  for (const m of texto.matchAll(/"class"\s*:\s*"(\w+)"/g)) clases[m[1]] = (clases[m[1]] || 0) + 1;
  const nombres = [...new Set([...texto.matchAll(/"data"\s*:\s*\{[^{}]*?"name"\s*:\s*"([^"]+)"/g)].map((m) => m[1]))];
  const ids = [...new Set([...texto.matchAll(/"id"\s*:\s*"((?:panorama|video|photo|album|map|model3d)_[\w]+)"/gi)].map((m) => m[1]))];
  return { clases, nombresComponentes: nombres, idsMedios: ids };
}

/** URLs externas (rompen el uso sin internet). */
export function buscarExternos(dir) {
  const hallazgos = [];
  const ignorar = /(w3\.org|xmlns|schemas\.|3dvista\.com\/?["'\s]|example\.com|localhost)/i;
  const revisar = (d, prof) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (prof < 3 && !/^media$/i.test(e.name)) revisar(p, prof + 1); continue; }
      if (!/\.(html?|js|css|txt|json|xml)$/i.test(e.name) || fs.statSync(p).size > 60 * 1024 * 1024) continue;
      if (/[\\/]lib[\\/]/i.test(p) && /\.js$/i.test(p)) continue; // libreria del reproductor
      if (/^(tdv-helper|skin-3jc)\.js$/i.test(e.name)) continue; // runtime de este MCP
      const txt = fs.readFileSync(p, 'utf8');
      for (const m of txt.matchAll(/https?:\/\/[^\s"'<>)\\]+/g)) {
        if (ignorar.test(m[0])) continue;
        hallazgos.push({ archivo: path.relative(dir, p), url: m[0].slice(0, 200) });
      }
    }
  };
  revisar(dir, 0);
  const porUrl = new Map();
  for (const h of hallazgos) {
    const k = h.url;
    if (!porUrl.has(k)) porUrl.set(k, { url: k, archivos: new Set() });
    porUrl.get(k).archivos.add(h.archivo);
  }
  return [...porUrl.values()].map((x) => ({ url: x.url, archivos: [...x.archivos] }));
}

export function analizarTour(dir, opciones = {}) {
  validarDir(dir);
  const index = encontrarIndex(dir);
  const scripts = archivosScript(dir);
  const locales = leerLocales(dir);
  const idiomas = Object.keys(locales);
  const idioma = opciones.idioma && locales[opciones.idioma] ? opciones.idioma : (locales.es ? 'es' : idiomas[0]);
  const loc = idioma ? locales[idioma] : {};
  const traducir = (v) => {
    if (typeof v !== 'string') return v;
    if (v.startsWith('@@')) { const k = v.slice(2); return loc[k] ?? k; }
    return v;
  };

  const res = {
    carpeta: dir,
    index: index ? path.basename(index) : null,
    archivosScript: scripts.map((s) => path.relative(dir, s.archivo)),
    idiomas,
    idiomaUsado: idioma || null,
    metodo: null,
    escenas: [],
    medios: [],
    componentes: [],
    hotspots: [],
    listas: [],
    funcionesScript: [],
    clases: {},
    avisos: []
  };

  if (!index) res.avisos.push('No hay index.htm en la carpeta: ¿es la carpeta correcta del export HTML5?');
  if (!scripts.length) {
    res.avisos.push('No se encontro script.js con "definitions". Exporte el recorrido como HTML5 y vuelva a intentar.');
    return res;
  }

  const principal = scripts.sort((a, b) => b.texto.length - a.texto.length)[0];
  const capturado = capturarScript(principal.texto);

  if (!capturado) {
    res.metodo = 'regex';
    const r = analisisRegex(principal.texto);
    res.clases = r.clases;
    res.componentes = r.nombresComponentes.map((n) => ({ nombre: n }));
    res.medios = r.idsMedios.map((id) => ({ id }));
    res.avisos.push('Analisis parcial (por texto). Los nombres de componentes son confiables; las etiquetas de escenas pueden faltar.');
    return res;
  }

  res.metodo = 'sandbox';
  if (capturado.scripts && typeof capturado.scripts === 'object') res.funcionesScript = Object.keys(capturado.scripts).sort();

  const porId = new Map();
  recorrer(capturado, (n) => {
    res.clases[n.class] = (res.clases[n.class] || 0) + 1;
    if (n.id) porId.set(n.id, n);
  });

  for (const n of porId.values()) {
    const data = n.data && typeof n.data === 'object' ? n.data : {};
    const etiqueta = traducir(n.label) || traducir(data.label) || null;
    if (MEDIA.has(n.class)) {
      res.medios.push({ id: n.id, clase: n.class, etiqueta });
    } else if (/Hotspot|Overlay/.test(n.class) && n.class !== 'ViewerArea') {
      res.hotspots.push({ id: n.id, clase: n.class, etiqueta: etiqueta || traducir(data.label) || null });
    } else if (n.class === 'PlayList') {
      const items = (Array.isArray(n.items) ? n.items : []).map((it) => refId(it && it.media)).filter(Boolean);
      res.listas.push({ id: n.id, items });
    } else if (data.name && !NO_COMPONENTES.test(n.class)) {
      res.componentes.push({ nombre: data.name, clase: n.class, id: n.id, visible: n.visible !== false });
    }
  }

  // Escenas en orden de la lista principal (la mas larga)
  const medPorId = new Map(res.medios.map((m) => [m.id, m]));
  const lista = [...res.listas].sort((a, b) => b.items.length - a.items.length)[0];
  if (lista) {
    lista.items.forEach((id, i) => {
      const m = medPorId.get(id);
      res.escenas.push({ indice: i, id, clase: m?.clase || null, etiqueta: m?.etiqueta || null });
    });
  } else {
    res.escenas = res.medios.map((m, i) => ({ indice: i, ...m }));
  }
  res.componentes.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return res;
}

export function resumenMarkdown(r, filtro) {
  const f = filtro ? filtro.toLowerCase() : null;
  const pasa = (...vals) => !f || vals.some((v) => v && String(v).toLowerCase().includes(f));
  const L = [];
  L.push(`# Analisis del recorrido`, `Carpeta: ${r.carpeta}`, `Index: ${r.index || '— no encontrado —'} | Scripts: ${r.archivosScript.join(', ') || '—'} | Metodo: ${r.metodo || '—'}`);
  if (r.idiomas.length) L.push(`Idiomas: ${r.idiomas.join(', ')} (etiquetas en: ${r.idiomaUsado})`);
  if (r.avisos.length) L.push('', '## Avisos', ...r.avisos.map((a) => `- ${a}`));

  const esc = r.escenas.filter((e) => pasa(e.etiqueta, e.id));
  L.push('', `## Escenas en la lista principal (${esc.length})`, '| # | Etiqueta | Id | Tipo |', '|---|---|---|---|');
  for (const e of esc) L.push(`| ${e.indice} | ${e.etiqueta ?? '—'} | ${e.id} | ${e.clase ?? '—'} |`);

  const comp = r.componentes.filter((c) => pasa(c.nombre, c.clase));
  L.push('', `## Componentes del skin (${comp.length}) — use estos nombres en el codigo`, '| Nombre | Clase | Visible al inicio |', '|---|---|---|');
  for (const c of comp.slice(0, 300)) L.push(`| ${c.nombre} | ${c.clase ?? '—'} | ${c.visible === false ? 'no' : 'si'} |`);
  if (comp.length > 300) L.push(`… y ${comp.length - 300} mas (use el filtro).`);

  const hs = r.hotspots.filter((h) => pasa(h.etiqueta, h.id));
  if (hs.length) {
    L.push('', `## Hotspots / overlays (${hs.length})`);
    for (const h of hs.slice(0, 150)) L.push(`- ${h.etiqueta ?? '(sin etiqueta)'} — ${h.clase} \`${h.id}\``);
    if (hs.length > 150) L.push(`… y ${hs.length - 150} mas.`);
  }
  if (r.funcionesScript.length && !f) L.push('', `## Funciones de script disponibles en este export (${r.funcionesScript.length})`, r.funcionesScript.join(', '));
  if (!f) {
    const top = Object.entries(r.clases).sort((a, b) => b[1] - a[1]).slice(0, 25);
    L.push('', '## Clases encontradas', top.map(([k, v]) => `${k}: ${v}`).join(' · '));
  }
  return L.join('\n');
}
