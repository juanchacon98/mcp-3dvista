// Inyeccion idempotente de CSS/JS/HTML en el index.htm del export de 3DVista.
import fs from 'node:fs';
import path from 'node:path';
import { encontrarIndex } from './analizar.js';

const ini = (n, z) => `<!-- 3DV-MCP:${n}:${z}:inicio -->`;
const fin = (n, z) => `<!-- 3DV-MCP:${n}:${z}:fin -->`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function quitarBloque(html, nombre, zona) {
  const re = new RegExp(`\\s*${esc(ini(nombre, zona))}[\\s\\S]*?${esc(fin(nombre, zona))}`, 'g');
  return html.replace(re, '');
}

function obtenerIndex(dirExport) {
  const idx = encontrarIndex(dirExport);
  if (!idx) throw new Error(`No hay index.htm en ${dirExport}. Exporte primero el recorrido en HTML5.`);
  return idx;
}

/**
 * cabeza: HTML a poner antes de </head> (links CSS, estilos)
 * cuerpo: HTML a poner antes de </body> (scripts, contenedores)
 */
export function inyectar(dirExport, nombre, { cabeza = '', cuerpo = '' } = {}) {
  if (!/^[\w-]+$/.test(nombre)) throw new Error('nombre_bloque solo admite letras, numeros, - y _');
  const idx = obtenerIndex(dirExport);
  const respaldo = idx + '.original';
  let html = fs.readFileSync(idx, 'utf8');
  if (!fs.existsSync(respaldo) && !html.includes('3DV-MCP:')) fs.writeFileSync(respaldo, html);
  html = quitarBloque(quitarBloque(html, nombre, 'head'), nombre, 'body');
  if (cabeza) {
    const bloque = `\n${ini(nombre, 'head')}\n${cabeza}\n${fin(nombre, 'head')}\n`;
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${bloque}</head>`) : bloque + html;
  }
  if (cuerpo) {
    const bloque = `\n${ini(nombre, 'body')}\n${cuerpo}\n${fin(nombre, 'body')}\n`;
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${bloque}</body>`) : html + bloque;
  }
  fs.writeFileSync(idx, html);
  return { index: idx, respaldo: fs.existsSync(respaldo) ? respaldo : null };
}

export function quitarInyeccion(dirExport, nombre) {
  const idx = obtenerIndex(dirExport);
  let html = fs.readFileSync(idx, 'utf8');
  const antes = html.length;
  if (nombre) html = quitarBloque(quitarBloque(html, nombre, 'head'), nombre, 'body');
  else html = html.replace(/\s*<!-- 3DV-MCP:([\w-]+):(head|body):inicio -->[\s\S]*?<!-- 3DV-MCP:\1:\2:fin -->/g, '');
  fs.writeFileSync(idx, html);
  return { index: idx, cambio: antes !== html.length };
}

export function listarInyecciones(dirExport) {
  const html = fs.readFileSync(obtenerIndex(dirExport), 'utf8');
  return [...new Set([...html.matchAll(/<!-- 3DV-MCP:([\w-]+):(head|body):inicio -->/g)].map((m) => m[1]))];
}

/** Copia un archivo a la carpeta del export y devuelve la ruta relativa para usar en src/href. */
export function copiarAExport(dirExport, origen, subcarpeta = 'custom') {
  const destDir = path.join(dirExport, subcarpeta);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(origen));
  fs.copyFileSync(origen, dest);
  return `${subcarpeta}/${path.basename(origen)}`.replace(/\\/g, '/');
}

export function escribirEnExport(dirExport, rel, contenido) {
  const dest = path.join(dirExport, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contenido);
  return rel.replace(/\\/g, '/');
}
