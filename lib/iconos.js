// Iconos de linea propios (24x24, trazo). Se usan en el skin HTML y para exportar SVG al Skin Editor.
export const ICONOS = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  escenas: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  pantalla: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  pantalla_salir: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  audio: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  audio_off: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  compartir: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  whatsapp: '<path d="M3.5 20.5l1.3-4.3A8.5 8.5 0 1 1 7.9 19.4z"/><path d="M9.2 8.3c-.3 3.4 3 6.8 6.5 6.6l.8-1.5-1.9-1-.9.8a5 5 0 0 1-2.6-2.6l.8-.9-1-1.9z"/>',
  telefono: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  correo: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  mapa: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  ubicacion: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  anterior: '<path d="M15 5l-7 7 7 7"/>',
  siguiente: '<path d="M9 5l7 7-7 7"/>',
  arriba: '<path d="M5 15l7-7 7 7"/>',
  abajo: '<path d="M5 9l7 7 7-7"/>',
  play: '<path d="M7 4.5l12 7.5-12 7.5z"/>',
  pausa: '<path d="M8 5v14M16 5v14"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  idioma: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  vr: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4l-3-3-3 3H5a2 2 0 0 1-2-2z"/><circle cx="8" cy="12" r="1.6"/><circle cx="16" cy="12" r="1.6"/>',
  giroscopio: '<circle cx="12" cy="12" r="9"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="2"/>',
  camara: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  hotspot: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  descargar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
};

/**
 * estilo: "linea" (solo trazo), "circulo" o "cuadrado" (fondo de color + icono contrastado).
 */
export function svgIcono(nombre, { color = '#ffffff', fondo = '#1f6f43', estilo = 'linea', tamano = 64, grosor = 2 } = {}) {
  const cuerpo = ICONOS[nombre];
  if (!cuerpo) throw new Error(`Icono desconocido "${nombre}". Disponibles: ${Object.keys(ICONOS).join(', ')}`);
  const trazo = `fill="none" stroke="${color}" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round"`;
  if (estilo === 'linea') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamano}" height="${tamano}" viewBox="0 0 24 24"><g ${trazo}>${cuerpo}</g></svg>`;
  }
  const bg = estilo === 'circulo'
    ? `<circle cx="16" cy="16" r="16" fill="${fondo}"/>`
    : `<rect width="32" height="32" rx="8" fill="${fondo}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamano}" height="${tamano}" viewBox="0 0 32 32">${bg}<g transform="translate(6 6) scale(.8333)" ${trazo}>${cuerpo}</g></svg>`;
}
