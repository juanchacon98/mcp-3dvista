#!/usr/bin/env node
// Servidor MCP (stdio) para 3DVista — Corporacion 3JC. Sin dependencias externas.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { analizarTour, resumenMarkdown, buscarExternos } from './lib/analizar.js';
import { generarCodigo, listarAcciones, validarJS, ACCIONES } from './lib/codigo.js';
import { crearSkinHtml, instalarSkinDesde, crearIconos, planSkinNativo, modulosDisponibles, leerRuntime } from './lib/skin.js';
import { inyectar, quitarInyeccion, listarInyecciones, escribirEnExport } from './lib/inyectar.js';
import { ICONOS } from './lib/iconos.js';
import { guia, GUIA } from './lib/guia.js';

const VERSION = '1.0.0';
const log = (...a) => process.stderr.write('[mcp-3dvista] ' + a.join(' ') + '\n');

const MARCA_SCHEMA = {
  type: 'object',
  description: 'Identidad visual',
  properties: {
    nombre: { type: 'string' }, subtitulo: { type: 'string' },
    logo: { type: 'string', description: 'Ruta local a PNG/SVG (se copia al export)' },
    url: { type: 'string', description: 'Enlace al hacer clic en el logo' },
    color_primario: { type: 'string' }, color_secundario: { type: 'string' },
    color_fondo: { type: 'string', description: 'Fondo de paneles, p. ej. rgba(15,25,20,.62)' },
    color_texto: { type: 'string' }, fuente: { type: 'string', description: 'font-family CSS (use fuentes del sistema si es offline)' },
    radio: { type: 'number', description: 'Radio de esquinas en px' }
  }
};
const CONTACTO_SCHEMA = {
  type: 'object',
  properties: {
    whatsapp: { type: 'string' }, mensaje_whatsapp: { type: 'string' }, incluir_escena: { type: 'boolean' },
    telefono: { type: 'string' }, email: { type: 'string' }, ubicacion_url: { type: 'string' }
  }
};
const RUTA = { type: 'string', description: 'Carpeta del export HTML5 de 3DVista (donde esta index.htm)' };

const HERRAMIENTAS = [
  {
    name: 'analizar_tour',
    description: 'Lee un export HTML5 de 3DVista y lista escenas (en orden), componentes del skin con sus nombres exactos, hotspots, idiomas y funciones de script disponibles. Usar SIEMPRE antes de generar codigo que dependa de nombres.',
    inputSchema: { type: 'object', required: ['ruta_export'], properties: {
      ruta_export: RUTA,
      filtro: { type: 'string', description: 'Texto para filtrar escenas/componentes/hotspots' },
      idioma: { type: 'string', description: 'Codigo de idioma para las etiquetas (es, en…)' },
      formato: { type: 'string', enum: ['markdown', 'json'] }
    } },
    run: (a) => {
      const r = analizarTour(a.ruta_export, { idioma: a.idioma });
      return a.formato === 'json' ? JSON.stringify(r, null, 2) : resumenMarkdown(r, a.filtro);
    }
  },
  {
    name: 'generar_codigo',
    description: 'Genera JavaScript para 3DVista (Acciones > "Ejecutar JavaScript" de botones, hotspots o al iniciar). Acciones: ' + Object.keys(ACCIONES).join(', ') + '. Use listar_acciones para ver parametros.',
    inputSchema: { type: 'object', required: ['accion'], properties: {
      accion: { type: 'string', enum: Object.keys(ACCIONES) },
      parametros: { type: 'object', description: 'Parametros de la accion (ver listar_acciones)' },
      modo: { type: 'string', enum: ['accion', 'helper', 'externo'], description: 'accion (defecto): autonomo para 3DVista. helper: usa window.TDVH (requiere instalar_ayudante o skin HTML). externo: desde un Web Frame/pagina.' }
    } },
    run: (a) => {
      const codigo = generarCodigo(a.accion, a.parametros || {}, a.modo || 'accion');
      const v = validarJS(codigo);
      return '```js\n' + codigo + '\n```' + (v.valido ? '' : `\n\n⚠ Error de sintaxis: ${v.errores.join('; ')}`) +
        (v.avisos.length ? '\n\nAvisos:\n' + v.avisos.map((x) => '- ' + x).join('\n') : '') +
        (a.modo === 'helper' ? '\n\nRequiere el ayudante TDVH en el export (instalar_ayudante o crear_skin_html).' : '\n\nPeguelo en: Accion → "Ejecutar JavaScript".');
    }
  },
  {
    name: 'listar_acciones',
    description: 'Lista las acciones que generar_codigo sabe producir, con sus parametros.',
    inputSchema: { type: 'object', properties: {} },
    run: () => listarAcciones()
  },
  {
    name: 'validar_javascript',
    description: 'Revisa la sintaxis de un fragmento JS antes de pegarlo en 3DVista y avisa de problemas comunes (nulls, URLs externas, await).',
    inputSchema: { type: 'object', required: ['codigo'], properties: { codigo: { type: 'string' } } },
    run: (a) => {
      const v = validarJS(a.codigo);
      return (v.valido ? '✔ Sintaxis valida.' : '✖ ' + v.errores.join('\n✖ ')) + (v.avisos.length ? '\n\nAvisos:\n' + v.avisos.map((x) => '- ' + x).join('\n') : '');
    }
  },
  {
    name: 'crear_skin_html',
    description: 'Crea un skin HTML/CSS/JS completo (logo, titulo de escena, barra de botones, menu de escenas con buscador y grupos, panel info/contacto, WhatsApp, auto-recorrido) con la marca del cliente. Sin recursos de internet. Si se da ruta_export lo instala en index.htm.',
    inputSchema: { type: 'object', properties: {
      ruta_export: RUTA,
      carpeta_salida: { type: 'string', description: 'Si aun no hay export: carpeta donde dejar el skin para instalarlo despues' },
      marca: MARCA_SCHEMA,
      botones: { type: 'array', items: { type: 'string', enum: ['escenas', 'anterior', 'siguiente', 'auto', 'audio', 'pantalla', 'compartir', 'info', 'whatsapp', 'telefono', 'correo', 'ubicacion', 'inicio'] }, description: 'Orden de botones en la barra' },
      posicion_barra: { type: 'string', enum: ['abajo', 'izquierda'] },
      contacto: CONTACTO_SCHEMA,
      info: { type: 'object', properties: { titulo: { type: 'string' }, html: { type: 'string', description: 'HTML del cuerpo' } } },
      info_al_inicio: { type: 'boolean' },
      escenas: { type: 'object', properties: {
        grupos: { type: 'array', items: { type: 'object', properties: { titulo: { type: 'string' }, escenas: { type: 'array', items: { type: 'string' } } } } },
        ocultar: { type: 'array', items: { type: 'string' } }
      } },
      ocultar_componentes_nativos: { type: 'array', items: { type: 'string' }, description: 'Componentes del skin de 3DVista a ocultar al cargar' },
      auto_segundos: { type: 'number' },
      mostrar_titulo_escena: { type: 'boolean' },
      whatsapp_flotante: { type: 'boolean' },
      textos: { type: 'object', properties: { escenas: { type: 'string' }, buscar: { type: 'string' } } },
      css_extra: { type: 'string', description: 'CSS adicional para personalizar' }
    } },
    run: (a) => {
      const r = crearSkinHtml(a);
      return [
        `Skin creado en: ${r.carpeta}`,
        `Archivos: ${r.archivos.join(', ')}`,
        r.instalado ? `Inyectado en: ${r.instalado.index}${r.instalado.respaldo ? ` (respaldo original: ${path.basename(r.instalado.respaldo)})` : ''}` : 'No se inyecto (sin ruta_export). Use instalar_skin_html cuando tenga el export.',
        r.avisos.length ? '\nAvisos:\n' + r.avisos.map((x) => '- ' + x).join('\n') : '',
        '\nPara ajustar textos/colores sin regenerar: edite skin-3jc/skin-config.js.'
      ].join('\n');
    }
  },
  {
    name: 'instalar_skin_html',
    description: 'Reinstala un skin HTML ya creado en un export (usar despues de re-exportar desde 3DVista, que reescribe index.htm). Copia la carpeta skin-3jc y la inyecta.',
    inputSchema: { type: 'object', required: ['origen', 'ruta_export'], properties: {
      origen: { type: 'string', description: 'Carpeta que contiene skin-3jc (o la propia skin-3jc)' }, ruta_export: RUTA
    } },
    run: (a) => { const r = instalarSkinDesde(a.origen, a.ruta_export); return `Skin instalado en ${r.index}`; }
  },
  {
    name: 'crear_iconos_svg',
    description: 'Genera un set de iconos SVG con los colores de la marca para usar en Icon Buttons del Skin Editor (incluye variante _activo para hover). Iconos: ' + Object.keys(ICONOS).join(', '),
    inputSchema: { type: 'object', required: ['carpeta_salida'], properties: {
      carpeta_salida: { type: 'string' },
      iconos: { type: 'array', items: { type: 'string', enum: Object.keys(ICONOS) }, description: 'Vacio = todos' },
      estilo: { type: 'string', enum: ['circulo', 'cuadrado', 'linea'] },
      color: { type: 'string', description: 'Color del trazo (defecto #ffffff)' },
      fondo: { type: 'string', description: 'Color de fondo para circulo/cuadrado' },
      tamano: { type: 'number', description: 'px (defecto 128)' },
      grosor: { type: 'number', description: 'Grosor del trazo (defecto 2)' },
      prefijo: { type: 'string' }
    } },
    run: (a) => { const f = crearIconos(a); return `${f.length} archivos en ${a.carpeta_salida}:\n` + f.map((x) => '- ' + path.basename(x)).join('\n'); }
  },
  {
    name: 'planificar_skin_nativo',
    description: 'Produce el plano de un skin para el Skin Editor de 3DVista: arbol de componentes con nombres, tamanos, colores y el codigo de cada accion. Modulos: ' + modulosDisponibles().join(', '),
    inputSchema: { type: 'object', properties: {
      marca: MARCA_SCHEMA, contacto: CONTACTO_SCHEMA,
      modulos: { type: 'array', items: { type: 'string', enum: modulosDisponibles() } },
      idiomas: { type: 'array', items: { type: 'string' } },
      auto_segundos: { type: 'number' },
      guardar_en: { type: 'string', description: 'Ruta .md opcional para guardar el plan' }
    } },
    run: (a) => {
      const md = planSkinNativo(a);
      if (a.guardar_en) { fs.mkdirSync(path.dirname(a.guardar_en), { recursive: true }); fs.writeFileSync(a.guardar_en, md); }
      return md + (a.guardar_en ? `\n\n(Guardado en ${a.guardar_en})` : '');
    }
  },
  {
    name: 'inyectar_en_export',
    description: 'Inserta CSS, JS o HTML propio en el index.htm del export (bloque con nombre, idempotente, con respaldo index.htm.original). Opcionalmente escribe archivos en el export.',
    inputSchema: { type: 'object', required: ['ruta_export', 'nombre_bloque'], properties: {
      ruta_export: RUTA,
      nombre_bloque: { type: 'string', description: 'Identificador (letras, numeros, -, _). Reutilizarlo reemplaza el bloque.' },
      css: { type: 'string', description: 'CSS en linea (va en <head>)' },
      js: { type: 'string', description: 'JS en linea (va antes de </body>)' },
      html: { type: 'string', description: 'HTML extra antes de </body>' },
      archivos: { type: 'object', additionalProperties: { type: 'string' }, description: 'Mapa ruta_relativa → contenido para crear en el export' },
      esperar_tour: { type: 'boolean', description: 'Envuelve el JS para ejecutarse cuando el recorrido este listo (incluye el ayudante TDVH)' }
    } },
    run: (a) => {
      const creados = Object.entries(a.archivos || {}).map(([rel, c]) => escribirEnExport(a.ruta_export, rel, c));
      let cuerpo = a.html || '';
      if (a.js) {
        if (a.esperar_tour) {
          escribirEnExport(a.ruta_export, 'skin-3jc/tdv-helper.js', leerRuntime('tdv-helper.js'));
          cuerpo += `\n<script src="skin-3jc/tdv-helper.js"></script>\n<script>\nTDVH.listo(function (P) {\n${a.js}\n});\n</script>`;
        } else cuerpo += `\n<script>\n${a.js}\n</script>`;
      }
      const r = inyectar(a.ruta_export, a.nombre_bloque, { cabeza: a.css ? `<style>\n${a.css}\n</style>` : '', cuerpo: cuerpo.trim() });
      return `Bloque "${a.nombre_bloque}" inyectado en ${r.index}` + (creados.length ? `\nArchivos: ${creados.join(', ')}` : '') + `\nBloques actuales: ${listarInyecciones(a.ruta_export).join(', ')}`;
    }
  },
  {
    name: 'instalar_ayudante',
    description: 'Instala solo el ayudante window.TDVH en el export para poder usar codigo en modo "helper" y depurar desde la consola (TDVH.diagnostico()).',
    inputSchema: { type: 'object', required: ['ruta_export'], properties: { ruta_export: RUTA } },
    run: (a) => {
      escribirEnExport(a.ruta_export, 'skin-3jc/tdv-helper.js', leerRuntime('tdv-helper.js'));
      const r = inyectar(a.ruta_export, 'tdvh', { cuerpo: '<script src="skin-3jc/tdv-helper.js"></script>' });
      return `Ayudante instalado en ${r.index}. En consola: TDVH.diagnostico(), TDVH.escenas().`;
    }
  },
  {
    name: 'quitar_inyeccion',
    description: 'Quita un bloque inyectado del index.htm (o todos si no se da nombre_bloque).',
    inputSchema: { type: 'object', required: ['ruta_export'], properties: { ruta_export: RUTA, nombre_bloque: { type: 'string' } } },
    run: (a) => { const r = quitarInyeccion(a.ruta_export, a.nombre_bloque); return r.cambio ? `Quitado. Quedan: ${listarInyecciones(a.ruta_export).join(', ') || 'ninguno'}` : 'No habia nada que quitar.'; }
  },
  {
    name: 'auditar_offline',
    description: 'Busca recursos de internet (YouTube, Google Maps, fuentes web, CDNs, enlaces) en el export que fallaran si el recorrido se usa sin conexion.',
    inputSchema: { type: 'object', required: ['ruta_export'], properties: { ruta_export: RUTA } },
    run: (a) => {
      const h = buscarExternos(a.ruta_export);
      if (!h.length) return '✔ No se encontraron referencias a internet en el export.';
      const tipo = (u) => /youtu|vimeo/i.test(u) ? 'VIDEO' : /maps\.google|googleapis\.com\/maps|goo\.gl\/maps/i.test(u) ? 'MAPA' : /fonts\.(googleapis|gstatic)/i.test(u) ? 'FUENTE' : /wa\.me|whatsapp/i.test(u) ? 'WHATSAPP' : /analytics|gtag|facebook\.net|googletagmanager/i.test(u) ? 'ANALITICA' : /cdn|unpkg|jsdelivr/i.test(u) ? 'CDN' : 'ENLACE';
      return `⚠ ${h.length} referencias externas:\n` + h.slice(0, 200).map((x) => `- [${tipo(x.url)}] ${x.url}  ← ${x.archivos.join(', ')}`).join('\n');
    }
  },
  {
    name: 'consultar_guia',
    description: 'Guia de 3DVista: flujo de trabajo, API en tiempo de ejecucion (llamadas internas), convencion de nombres, depuracion, VR y uso sin internet.',
    inputSchema: { type: 'object', properties: { tema: { type: 'string', enum: [...Object.keys(GUIA), 'todo'] } } },
    run: (a) => guia(a.tema)
  },
  {
    name: 'obtener_ayudante',
    description: 'Devuelve el codigo fuente del ayudante TDVH (para revisar o pegar manualmente).',
    inputSchema: { type: 'object', properties: {} },
    run: () => '```js\n' + leerRuntime('tdv-helper.js') + '\n```'
  }
];

const RECURSOS = Object.keys(GUIA).map((k) => ({ uri: `3dvista://guia/${k}`, name: `Guia 3DVista: ${k}`, mimeType: 'text/markdown' }));

// ---------------- Protocolo MCP (JSON-RPC 2.0 por stdio, una linea por mensaje) ----------------
const send = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const ok = (id, result) => send({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function manejar(msg) {
  const { id, method, params = {} } = msg;
  const esNotificacion = id === undefined || id === null;
  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: params.protocolVersion || '2025-06-18',
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: { name: 'mcp-3dvista', version: VERSION },
        instructions: 'Herramientas para recorridos 3DVista (Corporacion 3JC). Empiece con analizar_tour sobre la carpeta del export para conocer nombres reales; use generar_codigo para acciones JS, crear_skin_html o planificar_skin_nativo + crear_iconos_svg para el skin. Tras cada re-export de 3DVista hay que reinstalar el skin/inyecciones.'
      });
    case 'ping': return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: HERRAMIENTAS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const t = HERRAMIENTAS.find((h) => h.name === params.name);
      if (!t) return err(id, -32602, `Herramienta desconocida: ${params.name}`);
      try {
        const texto = await t.run(params.arguments || {});
        return ok(id, { content: [{ type: 'text', text: String(texto) }] });
      } catch (e) {
        log('error en', params.name, e.stack || e.message);
        return ok(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    }
    case 'resources/list': return ok(id, { resources: RECURSOS });
    case 'resources/templates/list': return ok(id, { resourceTemplates: [] });
    case 'resources/read': {
      const k = String(params.uri || '').replace('3dvista://guia/', '');
      if (!GUIA[k]) return err(id, -32602, 'Recurso no encontrado');
      return ok(id, { contents: [{ uri: params.uri, mimeType: 'text/markdown', text: GUIA[k] }] });
    }
    case 'prompts/list': return ok(id, { prompts: [] });
    default:
      if (esNotificacion) return; // notifications/initialized, cancelled, etc.
      return err(id, -32601, `Metodo no soportado: ${method}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (linea) => {
  if (!linea.trim()) return;
  let msg;
  try { msg = JSON.parse(linea); } catch { return err(null, -32700, 'JSON invalido'); }
  const lote = Array.isArray(msg) ? msg : [msg];
  for (const m of lote) manejar(m).catch((e) => { log(e.stack); if (m.id != null) err(m.id, -32603, e.message); });
});
rl.on('close', () => process.exit(0));
log(`v${VERSION} listo (${HERRAMIENTAS.length} herramientas)`);
