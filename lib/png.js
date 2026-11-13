// Rasterizador minimo de los iconos de linea (24x24) a PNG, sin dependencias.
// Soporta <path d>, <circle>, <rect rx>. Comandos de path: M L H V C S Q T A Z (absolutos y relativos).
import zlib from 'node:zlib';
import { ICONOS } from './iconos.js';

// ---------- Geometria: todo se convierte en polilineas ----------
function parsePath(d) {
  const toks = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) || [];
  const polys = [];
  let i = 0, cmd = null, x = 0, y = 0, sx = 0, sy = 0, cur = null, lcx = null, lcy = null, lqx = null, lqy = null;
  const num = () => parseFloat(toks[i++]);
  const nuevo = () => { cur = { pts: [[x, y]], cerrado: false }; polys.push(cur); };
  const lineTo = (nx, ny) => { if (!cur) nuevo(); cur.pts.push([nx, ny]); x = nx; y = ny; };
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    const x0 = x, y0 = y;
    for (let k = 1; k <= 16; k++) {
      const t = k / 16, u = 1 - t;
      lineTo(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
    }
    lcx = x2; lcy = y2;
  };
  const quad = (x1, y1, x2, y2) => {
    const x0 = x, y0 = y;
    for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t; lineTo(u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2); }
    lqx = x1; lqy = y1;
  };
  const arc = (rx, ry, phi, fa, fs, x2, y2) => {
    const x1 = x, y1 = y;
    if (!rx || !ry) return lineTo(x2, y2);
    rx = Math.abs(rx); ry = Math.abs(ry);
    const p = (phi * Math.PI) / 180, cp = Math.cos(p), sp = Math.sin(p);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
    let lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    const num_ = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    let co = Math.sqrt(Math.max(0, num_ / den)); if (fa === fs) co = -co;
    const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
    const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
    const n = Math.max(8, Math.ceil(Math.abs(dt) / (Math.PI / 16)));
    for (let k = 1; k <= n; k++) {
      const t = t1 + (dt * k) / n;
      lineTo(cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp);
    }
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C !== 'C' && C !== 'S') { lcx = lcy = null; }
    if (C !== 'Q' && C !== 'T') { lqx = lqy = null; }
    switch (C) {
      case 'M': x = num() + ox; y = num() + oy; sx = x; sy = y; nuevo(); cmd = rel ? 'l' : 'L'; break;
      case 'L': lineTo(num() + ox, num() + oy); break;
      case 'H': lineTo(num() + ox, y); break;
      case 'V': lineTo(x, num() + oy); break;
      case 'C': { const a = [num() + ox, num() + oy, num() + ox, num() + oy, num() + ox, num() + oy]; cubic(...a); break; }
      case 'S': { const rx1 = lcx == null ? x : 2 * x - lcx, ry1 = lcy == null ? y : 2 * y - lcy; const a = [num() + ox, num() + oy, num() + ox, num() + oy]; cubic(rx1, ry1, ...a); break; }
      case 'Q': { const a = [num() + ox, num() + oy, num() + ox, num() + oy]; quad(...a); break; }
      case 'T': { const qx = lqx == null ? x : 2 * x - lqx, qy = lqy == null ? y : 2 * y - lqy; quad(qx, qy, num() + ox, num() + oy); break; }
      case 'A': { const rx = num(), ry = num(), ph = num(), fa = num(), fs = num(); arc(rx, ry, ph, fa, fs, num() + ox, num() + oy); break; }
      case 'Z': if (cur) { cur.cerrado = true; x = sx; y = sy; cur = null; } break;
      default: i++;
    }
  }
  return polys;
}

function circulo(cx, cy, r) {
  const pts = [];
  for (let k = 0; k <= 48; k++) { const t = (k / 48) * 2 * Math.PI; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  return [{ pts, cerrado: true }];
}
function rectangulo(x, y, w, h, rx) {
  rx = Math.min(rx || 0, w / 2, h / 2);
  if (!rx) return [{ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], cerrado: true }];
  const d = `M${x + rx} ${y}H${x + w - rx}A${rx} ${rx} 0 0 1 ${x + w} ${y + rx}V${y + h - rx}A${rx} ${rx} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${rx} 0 0 1 ${x} ${y + h - rx}V${y + rx}A${rx} ${rx} 0 0 1 ${x + rx} ${y}Z`;
  return parsePath(d);
}

function geometriaIcono(nombre) {
  const svg = ICONOS[nombre];
  if (!svg) throw new Error(`Icono desconocido "${nombre}"`);
  const atr = (s, n) => { const m = new RegExp(`\\b${n}="([^"]*)"`).exec(s); return m ? m[1] : null; };
  const polys = [];
  for (const m of svg.matchAll(/<(path|circle|rect)\b([^>]*)\/?>/g)) {
    const [, tag, a] = m;
    if (tag === 'path') polys.push(...parsePath(atr(a, 'd')));
    else if (tag === 'circle') polys.push(...circulo(+atr(a, 'cx'), +atr(a, 'cy'), +atr(a, 'r')));
    else polys.push(...rectangulo(+atr(a, 'x') || 0, +atr(a, 'y') || 0, +atr(a, 'width'), +atr(a, 'height'), +(atr(a, 'rx') || 0)));
  }
  const segs = [];
  for (const p of polys) {
    for (let k = 1; k < p.pts.length; k++) segs.push([...p.pts[k - 1], ...p.pts[k]]);
    if (p.cerrado && p.pts.length > 1) segs.push([...p.pts[p.pts.length - 1], ...p.pts[0]]);
    if (p.pts.length === 1) segs.push([...p.pts[0], ...p.pts[0]]); // punto (p. ej. "v.01")
  }
  return segs;
}

function distSeg(px, py, s) {
  const [ax, ay, bx, by] = s, dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = px - ax - t * dx, ey = py - ay - t * dy;
  return Math.sqrt(ex * ex + ey * ey);
}

export function hexARgb(hex) {
  const h = String(hex).replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}

/**
 * Devuelve un Buffer PNG del icono.
 * estilo: "linea" (fondo transparente) | "circulo" | "cuadrado"
 */
export function iconoPng(nombre, { tamano = 96, color = '#ffffff', fondo = '#1f6f43', estilo = 'linea', grosor = 2 } = {}) {
  const segs = geometriaIcono(nombre);
  const N = tamano, SS = 3;
  const [cr, cg, cb] = hexARgb(color), [fr, fg, fb] = hexARgb(fondo);
  // el icono de 24 unidades ocupa todo (linea) o el 62.5% centrado (con fondo)
  const escala = estilo === 'linea' ? N / 24 : (N * 0.625) / 24;
  const off = estilo === 'linea' ? 0 : N * 0.1875;
  const media = (grosor * escala) / 2;
  // descartar segmentos lejanos por fila acelera el calculo
  const px = new Uint8Array(N * N * 4);
  const radioFondo = N / 2, radioEsq = N * 0.22;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let aT = 0, aF = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const X = x + (sx + 0.5) / SS, Y = y + (sy + 0.5) / SS;
        // fondo
        if (estilo === 'circulo') { if ((X - radioFondo) ** 2 + (Y - radioFondo) ** 2 <= radioFondo ** 2) aF++; }
        else if (estilo === 'cuadrado') {
          const qx = Math.max(Math.abs(X - N / 2) - (N / 2 - radioEsq), 0), qy = Math.max(Math.abs(Y - N / 2) - (N / 2 - radioEsq), 0);
          if (qx * qx + qy * qy <= radioEsq * radioEsq) aF++;
        }
        // trazo
        const ux = (X - off) / escala, uy = (Y - off) / escala;
        let dmin = Infinity;
        for (const s of segs) { const d = distSeg(ux, uy, s); if (d < dmin) dmin = d; if (dmin * escala <= media) break; }
        if (dmin * escala <= media) aT++;
      }
      const at = aT / (SS * SS), af = aF / (SS * SS), o = (y * N + x) * 4;
      // composicion: trazo sobre fondo
      const a = at + af * (1 - at);
      if (a > 0) {
        px[o] = Math.round((cr * at + fr * af * (1 - at)) / a);
        px[o + 1] = Math.round((cg * at + fg * af * (1 - at)) / a);
        px[o + 2] = Math.round((cb * at + fb * af * (1 - at)) / a);
      }
      px[o + 3] = Math.round(a * 255);
    }
  }
  return codificarPng(N, N, px);
}

// ---------- Codificador PNG (RGBA 8 bits) ----------
const TABLA = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(tipo, datos) {
  const len = Buffer.alloc(4); len.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function codificarPng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const filas = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { filas[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(filas, y * (w * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(filas, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
