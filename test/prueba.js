// Prueba de extremo a extremo: lanza el servidor y llama herramientas por JSON-RPC.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const exp = path.join(dir, 'export-demo');
fs.rmSync(exp, { recursive: true, force: true });
fs.cpSync(path.join(dir, 'export-demo.base'), exp, { recursive: true });

const srv = spawn(process.execPath, [path.join(dir, '..', 'server.js')], { stdio: ['pipe', 'pipe', 'inherit'] });
let buf = '', id = 0; const pend = new Map();
srv.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); const m = JSON.parse(l); pend.get(m.id)?.(m); } });
const rpc = (method, params) => new Promise((r) => { const n = ++id; pend.set(n, r); srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
const tool = async (name, args) => { const r = await rpc('tools/call', { name, arguments: args }); const t = r.result.content[0].text; console.log(`\n===== ${name} ${r.result.isError ? '(ERROR)' : ''}\n${t.slice(0, 1800)}`); return r.result; };
let fallos = 0; const check = (c, m) => { if (!c) { fallos++; console.log('✖ FALLO:', m); } else console.log('✔', m); };

const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } });
check(init.result.serverInfo.name === 'mcp-3dvista', 'initialize');
srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
const tl = await rpc('tools/list', {}); check(tl.result.tools.length >= 14, `tools/list (${tl.result.tools.length})`);

let r = await tool('analizar_tour', { ruta_export: exp, formato: 'json' });
const a = JSON.parse(r.content[0].text);
check(a.metodo === 'sandbox', 'metodo sandbox');
check(a.escenas.map((e) => e.etiqueta).join('|') === 'Sala principal|Cocina|Recorrido dron', 'escenas en orden con etiquetas traducidas');
check(a.componentes.some((c) => c.nombre === 'Boton_Info') && a.componentes.some((c) => c.nombre === 'Web_Formulario') && a.componentes.some((c) => c.nombre === 'Main Viewer'), 'componentes');
check(a.hotspots.some((h) => h.etiqueta === 'Ir a cocina'), 'hotspots');
check(a.funcionesScript.includes('setComponentVisibility'), 'funciones de script');
await tool('analizar_tour', { ruta_export: exp, filtro: 'cocina' });

for (const [acc, p] of [['ir_a_escena', { escena: 'cocina' }], ['whatsapp', { numero: '+57 300 123 4567', mensaje: 'Hola', incluir_escena: true }], ['al_cambiar_escena', { codigo: "console.log(escena);" }], ['mostrar_varios', { mostrar: ['A'], ocultar: ['B'] }]]) {
  for (const modo of ['accion', 'helper', 'externo']) {
    r = await rpc('tools/call', { name: 'generar_codigo', arguments: { accion: acc, parametros: p, modo } });
    check(!r.result.isError && !r.result.content[0].text.includes('Error de sintaxis'), `generar_codigo ${acc}/${modo}`);
  }
}
await tool('generar_codigo', { accion: 'ir_a_escena', parametros: { escena: 'Cocina' } });
r = await tool('validar_javascript', { codigo: 'var x = ;' }); check(r.content[0].text.includes('✖'), 'validar detecta error');
r = await tool('crear_skin_html', { ruta_export: exp, marca: { nombre: 'Demo Tour', color_primario: '#1f6f43' }, botones: ['escenas', 'info', 'whatsapp', 'pantalla'], contacto: { whatsapp: '573001234567' }, info: { titulo: 'Demo Tour', html: '<p>Hola</p>' } });
const html = fs.readFileSync(path.join(exp, 'index.htm'), 'utf8');
check(html.includes('skin-3jc/skin-3jc.js') && fs.existsSync(path.join(exp, 'index.htm.original')), 'skin inyectado + respaldo');
await tool('crear_skin_html', { ruta_export: exp, marca: { nombre: 'Demo Tour 2' } });
const html2 = fs.readFileSync(path.join(exp, 'index.htm'), 'utf8');
check((html2.match(/skin-3jc\.js/g) || []).length === 1, 'reinyeccion idempotente');
await tool('inyectar_en_export', { ruta_export: exp, nombre_bloque: 'extra', css: 'body{}', js: "TDVH.irA('Cocina');", esperar_tour: true });
await tool('auditar_offline', { ruta_export: exp });
r = await tool('crear_iconos_svg', { carpeta_salida: path.join(dir, 'iconos-demo'), iconos: ['info', 'whatsapp'], fondo: '#1f6f43' });
check(fs.existsSync(path.join(dir, 'iconos-demo', 'icono_info_activo.svg')), 'iconos');
r = await tool('planificar_skin_nativo', { marca: { nombre: 'Demo Tour' }, modulos: ['barra', 'info'] });
await tool('quitar_inyeccion', { ruta_export: exp, nombre_bloque: 'extra' });
r = await tool('consultar_guia', { tema: 'api' }); check(r.content[0].text.includes('getComponentByName'), 'guia');
const rl = await rpc('resources/list', {}); check(rl.result.resources.length > 0, 'resources/list');
srv.stdin.end();
console.log(`\n${fallos ? '✖ ' + fallos + ' fallos' : '✔ Todo OK'}`);
process.exit(fallos ? 1 : 0);
