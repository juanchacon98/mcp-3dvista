// Skin HTML (capa sobre el recorrido) + iconos SVG + plan de skin nativo para el Skin Editor.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONOS, svgIcono } from './iconos.js';
import { inyectar, escribirEnExport } from './inyectar.js';
import { generarCodigo } from './codigo.js';

const RUNTIME = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'runtime');
export const leerRuntime = (n) => fs.readFileSync(path.join(RUNTIME, n), 'utf8');

const CARPETA_SKIN = 'skin-3jc';
const BOTONES_VALIDOS = ['escenas', 'anterior', 'siguiente', 'auto', 'audio', 'pantalla', 'compartir', 'info', 'whatsapp', 'telefono', 'correo', 'ubicacion', 'inicio'];

/**
 * Genera el skin HTML. Si ruta_export existe lo instala ahi (archivos + inyeccion en index.htm);
 * si no, lo deja en carpeta_salida para instalarlo despues.
 */
export function crearSkinHtml(cfg) {
  const { ruta_export, carpeta_salida } = cfg;
  const destino = ruta_export || carpeta_salida;
  if (!destino) throw new Error('Indique ruta_export (carpeta del export HTML5) o carpeta_salida.');
  fs.mkdirSync(destino, { recursive: true });

  const marca = { ...(cfg.marca || {}) };
  const avisos = [];
  if (marca.logo) {
    if (/^https?:/i.test(marca.logo)) {
      avisos.push('El logo es una URL externa: no se vera sin internet. Mejor pase la ruta de un archivo local.');
    } else if (fs.existsSync(marca.logo)) {
      const nombre = 'logo' + path.extname(marca.logo).toLowerCase();
      fs.mkdirSync(path.join(destino, CARPETA_SKIN), { recursive: true });
      fs.copyFileSync(marca.logo, path.join(destino, CARPETA_SKIN, nombre));
      marca.logo = `${CARPETA_SKIN}/${nombre}`;
    } else {
      avisos.push(`No se encontro el logo en ${marca.logo}; se omitio.`);
      delete marca.logo;
    }
  }
  if (marca.fuente && /https?:/.test(marca.fuente)) avisos.push('Las fuentes web no cargan sin internet; use fuentes del sistema.');

  const botones = (cfg.botones || ['escenas', 'anterior', 'siguiente', 'auto', 'audio', 'pantalla', 'info']).filter((b) => {
    if (!BOTONES_VALIDOS.includes(b)) { avisos.push(`Boton desconocido "${b}" (validos: ${BOTONES_VALIDOS.join(', ')})`); return false; }
    return true;
  });
  const contacto = cfg.contacto || {};
  for (const [b, k] of [['whatsapp', 'whatsapp'], ['telefono', 'telefono'], ['correo', 'email'], ['ubicacion', 'ubicacion_url']]) {
    if (botones.includes(b) && !contacto[k]) avisos.push(`El boton "${b}" necesita contacto.${k}.`);
  }

  const config = {
    marca, botones, contacto,
    posicion_barra: cfg.posicion_barra || 'abajo',
    info: cfg.info || null,
    info_al_inicio: !!cfg.info_al_inicio,
    escenas: cfg.escenas || null,
    ocultar_componentes_nativos: cfg.ocultar_componentes_nativos || [],
    auto_segundos: cfg.auto_segundos || 15,
    mostrar_titulo_escena: cfg.mostrar_titulo_escena !== false,
    whatsapp_flotante: !!cfg.whatsapp_flotante,
    textos: cfg.textos || {}
  };
  const usados = ['menu', 'cerrar', 'escenas', 'anterior', 'siguiente', 'play', 'pausa', 'audio', 'audio_off', 'pantalla', 'pantalla_salir', 'compartir', 'info', 'whatsapp', 'telefono', 'correo', 'ubicacion', 'inicio'];
  const iconos = Object.fromEntries(usados.map((n) => [n, ICONOS[n]]));
  const configJs = `/* Generado por mcp-3dvista. Edite y vuelva a ejecutar crear_skin_html o modifique aqui. */\nwindow.S3_CONFIG = ${JSON.stringify(config, null, 2)};\nwindow.S3_ICONOS = ${JSON.stringify(iconos)};\n`;

  const archivos = {
    [`${CARPETA_SKIN}/tdv-helper.js`]: leerRuntime('tdv-helper.js'),
    [`${CARPETA_SKIN}/skin-config.js`]: configJs,
    [`${CARPETA_SKIN}/skin-3jc.js`]: leerRuntime('skin-3jc.js'),
    [`${CARPETA_SKIN}/skin-3jc.css`]: leerRuntime('skin-3jc.css') + (cfg.css_extra ? `\n/* css_extra */\n${cfg.css_extra}\n` : '')
  };
  for (const [rel, cont] of Object.entries(archivos)) escribirEnExport(destino, rel, cont);

  const v = Date.now().toString(36);
  const cabeza = `<link rel="stylesheet" href="${CARPETA_SKIN}/skin-3jc.css?v=${v}">`;
  const cuerpo = [
    `<script src="${CARPETA_SKIN}/tdv-helper.js?v=${v}"></script>`,
    `<script src="${CARPETA_SKIN}/skin-config.js?v=${v}"></script>`,
    `<script src="${CARPETA_SKIN}/skin-3jc.js?v=${v}"></script>`
  ].join('\n');

  let instalado = null;
  if (ruta_export) {
    try { instalado = inyectar(ruta_export, 'skin-3jc', { cabeza, cuerpo }); }
    catch (e) { avisos.push(`Archivos creados pero no se inyecto: ${e.message}`); }
  } else {
    fs.writeFileSync(path.join(destino, CARPETA_SKIN, 'PEGAR_EN_INDEX.txt'),
      `Antes de </head>:\n${cabeza}\n\nAntes de </body>:\n${cuerpo}\n\nO use la herramienta instalar_skin_html con la ruta del export.`);
  }
  return { destino, carpeta: path.join(destino, CARPETA_SKIN), archivos: Object.keys(archivos), instalado, avisos, config };
}

/** Instala en un export una carpeta skin-3jc ya generada (p. ej. tras re-exportar desde 3DVista). */
export function instalarSkinDesde(origenSkin, rutaExport) {
  const src = path.basename(origenSkin) === CARPETA_SKIN ? origenSkin : path.join(origenSkin, CARPETA_SKIN);
  if (!fs.existsSync(path.join(src, 'skin-config.js'))) throw new Error(`No hay skin-config.js en ${src}`);
  const dest = path.join(rutaExport, CARPETA_SKIN);
  if (path.resolve(src) !== path.resolve(dest)) fs.cpSync(src, dest, { recursive: true });
  // refresca runtime con la version actual del MCP
  for (const n of ['tdv-helper.js', 'skin-3jc.js', 'skin-3jc.css']) {
    if (n === 'skin-3jc.css' && fs.existsSync(path.join(dest, n)) && fs.readFileSync(path.join(dest, n), 'utf8').includes('/* css_extra */')) continue;
    fs.writeFileSync(path.join(dest, n), leerRuntime(n));
  }
  const v = Date.now().toString(36);
  return inyectar(rutaExport, 'skin-3jc', {
    cabeza: `<link rel="stylesheet" href="${CARPETA_SKIN}/skin-3jc.css?v=${v}">`,
    cuerpo: ['tdv-helper.js', 'skin-config.js', 'skin-3jc.js'].map((n) => `<script src="${CARPETA_SKIN}/${n}?v=${v}"></script>`).join('\n')
  });
}

export function crearIconos({ carpeta_salida, iconos, color = '#ffffff', fondo = '#1f6f43', estilo = 'circulo', tamano = 128, grosor = 2, prefijo = 'icono_' }) {
  if (!carpeta_salida) throw new Error('Falta carpeta_salida');
  fs.mkdirSync(carpeta_salida, { recursive: true });
  const lista = iconos && iconos.length ? iconos : Object.keys(ICONOS);
  const hechos = [];
  for (const n of lista) {
    const svg = svgIcono(n, { color, fondo, estilo, tamano, grosor });
    const archivo = path.join(carpeta_salida, `${prefijo}${n}.svg`);
    fs.writeFileSync(archivo, svg);
    hechos.push(archivo);
    if (estilo !== 'linea') {
      // variante "hover/activo" con colores invertidos
      const alt = path.join(carpeta_salida, `${prefijo}${n}_activo.svg`);
      fs.writeFileSync(alt, svgIcono(n, { color: fondo, fondo: color, estilo, tamano, grosor }));
      hechos.push(alt);
    }
  }
  return hechos;
}

// ---------------- Plan de skin nativo (Skin Editor de 3DVista) ----------------

const MODULOS = {
  barra: (m) => ({
    titulo: 'Barra de controles inferior',
    arbol: [
      'Contenedor_Barra  (Container, horizontal, centrado abajo, margen inferior 20 px, alto 56, relleno 6, radio 28, fondo ' + m.fondo + ' opacidad 0.6, espacio 4)',
      '├─ Boton_Escenas      (Icon Button 44x44, icono icono_escenas.svg / _activo.svg al pasar)',
      '├─ Boton_Anterior     (Icon Button, icono_anterior.svg)',
      '├─ Boton_Siguiente    (Icon Button, icono_siguiente.svg)',
      '├─ Boton_Auto         (Icon Button, icono_play.svg)',
      '├─ Boton_Audio        (Icon Button, icono_audio.svg)',
      '├─ Boton_Pantalla     (Icon Button, icono_pantalla.svg)',
      '└─ Boton_Info         (Icon Button, icono_info.svg)'
    ],
    acciones: [
      ['Boton_Escenas', 'Al hacer clic', 'Mostrar/Ocultar componente → Panel_Escenas (alternar). Alternativa JS:', generarCodigo('alternar_componente', { componente: 'Panel_Escenas' })],
      ['Boton_Anterior', 'Al hacer clic', 'Accion nativa "Media anterior" o JS:', generarCodigo('anterior_escena')],
      ['Boton_Siguiente', 'Al hacer clic', 'Accion nativa "Media siguiente" o JS:', generarCodigo('siguiente_escena')],
      ['Boton_Auto', 'Al hacer clic', 'Ejecutar JavaScript:', generarCodigo('auto_recorrido', { segundos: m.auto })],
      ['Boton_Audio', 'Al hacer clic', 'Use el componente nativo "Toggle Button" de audio, o JS:', generarCodigo('silenciar')],
      ['Boton_Pantalla', 'Al hacer clic', 'Use "Fullscreen Toggle Button" nativo, o JS:', generarCodigo('pantalla_completa')],
      ['Boton_Info', 'Al hacer clic', 'Mostrar componente → Panel_Info (efecto Fade In 300 ms)', null]
    ]
  }),
  escenas: (m) => ({
    titulo: 'Menu de escenas (miniaturas)',
    arbol: [
      'Panel_Escenas  (Container vertical, anclado a la izquierda, ancho 320, alto 100%, fondo ' + m.fondo + ' 0.75, OCULTO al inicio)',
      '├─ Fila_TituloEscenas (Container horizontal)',
      '│   ├─ Texto_TituloEscenas (Label "Escenas", ' + m.fuente + ' 18 negrita, color ' + m.texto + ')',
      '│   └─ Boton_CerrarEscenas (Icon Button, icono_cerrar.svg)',
      '└─ Lista_Escenas (Thumbnail List vertical, lista: Main PlayList, miniatura 120x68, etiqueta visible, color seleccion ' + m.primario + ')'
    ],
    acciones: [
      ['Boton_CerrarEscenas', 'Al hacer clic', 'Ocultar componente → Panel_Escenas', null],
      ['Lista_Escenas', 'Al seleccionar', '(Opcional) Ocultar Panel_Escenas en moviles: JS', generarCodigo('personalizado', { codigo: "if (window.innerWidth < 900) { var c = P.getComponentByName('Panel_Escenas'); if (c) c.set('visible', false); }" })]
    ]
  }),
  logo: (m) => ({
    titulo: 'Logo y nombre',
    arbol: [
      'Contenedor_Logo (Container horizontal, arriba-izquierda, margen 14, relleno 8, radio 16, fondo ' + m.fondo + ' 0.6)',
      '├─ Imagen_Logo (Image, alto 44, proporcional, archivo del logo en PNG/SVG)',
      '└─ Texto_Nombre (Label "' + m.nombre + '", ' + m.fuente + ' 16 negrita)'
    ],
    acciones: m.url ? [['Contenedor_Logo', 'Al hacer clic', 'Abrir URL:', generarCodigo('abrir_url', { url: m.url })]] : []
  }),
  info: (m) => ({
    titulo: 'Panel de informacion / contacto',
    arbol: [
      'Panel_Info (Container centrado, 520x auto, relleno 24, radio 16, fondo ' + m.fondo + ' 0.85, OCULTO al inicio)',
      '├─ Boton_CerrarInfo (Icon Button arriba-derecha, icono_cerrar.svg)',
      '├─ Texto_InfoTitulo (Label, 22 negrita)',
      '├─ Texto_InfoCuerpo (HTML Text / Label multilinea)',
      '└─ Fila_Contacto (Container horizontal)',
      '    ├─ Boton_WhatsApp (Button con icono_whatsapp.svg, fondo #25D366)',
      '    ├─ Boton_Llamar   (Button con icono_telefono.svg, fondo ' + m.primario + ')',
      '    └─ Boton_Correo   (Button con icono_correo.svg, fondo ' + m.primario + ')'
    ],
    acciones: [
      ['Boton_CerrarInfo', 'Al hacer clic', 'Ocultar componente → Panel_Info', null],
      ['Boton_WhatsApp', 'Al hacer clic', 'Ejecutar JavaScript:', generarCodigo('whatsapp', { numero: m.whatsapp || '57XXXXXXXXXX', mensaje: 'Hola, vi el recorrido virtual', incluir_escena: true })],
      ['Boton_Llamar', 'Al hacer clic', 'Ejecutar JavaScript:', generarCodigo('llamar', { telefono: m.telefono || '+57XXXXXXXXXX' })],
      ['Boton_Correo', 'Al hacer clic', 'Ejecutar JavaScript:', generarCodigo('correo', { email: m.email || 'correo@empresa.com', asunto: 'Consulta recorrido ' + m.nombre })]
    ]
  }),
  titulo_escena: () => ({
    titulo: 'Titulo de la escena actual',
    arbol: ['Texto_Escena (Label centrado arriba, texto = "Media Title" / etiqueta del panorama activo, fondo pastilla radio 999)'],
    acciones: [['Texto_Escena', '—', 'En el Skin Editor enlace el texto a la etiqueta de la escena actual (opcion "Title of the current media").', null]]
  }),
  whatsapp_flotante: (m) => ({
    titulo: 'Boton flotante de WhatsApp',
    arbol: ['Boton_WhatsAppFlotante (Icon Button 56x56, abajo-derecha margen 18, icono_whatsapp.svg con fondo #25D366)'],
    acciones: [['Boton_WhatsAppFlotante', 'Al hacer clic', 'Ejecutar JavaScript:', generarCodigo('whatsapp', { numero: m.whatsapp || '57XXXXXXXXXX', mensaje: 'Hola, quiero mas informacion', incluir_escena: true })]]
  }),
  idiomas: (m) => ({
    titulo: 'Selector de idioma',
    arbol: ['Contenedor_Idiomas (Container horizontal arriba-derecha)', ...m.idiomas.map((i, k, a) => `${k === a.length - 1 ? '└' : '├'}─ Boton_Idioma_${i.toUpperCase()} (Button texto "${i.toUpperCase()}")`)],
    acciones: m.idiomas.map((i) => [`Boton_Idioma_${i.toUpperCase()}`, 'Al hacer clic', 'Accion nativa "Cambiar idioma" o JS:', generarCodigo('cambiar_idioma', { idioma: i })])
  }),
  bienvenida: () => ({
    titulo: 'Pantalla de bienvenida',
    arbol: [
      'Panel_Bienvenida (Container a pantalla completa, fondo negro 0.55, VISIBLE al inicio)',
      '└─ Caja_Bienvenida (Container centrado, logo + titulo + Boton_Comenzar)'
    ],
    acciones: [['Boton_Comenzar', 'Al hacer clic', 'Ocultar Panel_Bienvenida (Fade Out) y, si quiere, reproducir audio de fondo.', generarCodigo('mostrar_varios', { mostrar: ['Contenedor_Barra'], ocultar: ['Panel_Bienvenida'] })]]
  })
};

export function planSkinNativo(cfg = {}) {
  const marca = cfg.marca || {};
  const m = {
    nombre: marca.nombre || 'Proyecto', url: marca.url,
    primario: marca.color_primario || '#1f6f43', fondo: marca.color_fondo || '#0f1914', texto: marca.color_texto || '#ffffff',
    fuente: marca.fuente || 'Montserrat/Arial', auto: cfg.auto_segundos || 15,
    whatsapp: cfg.contacto?.whatsapp, telefono: cfg.contacto?.telefono, email: cfg.contacto?.email,
    idiomas: cfg.idiomas || ['es', 'en']
  };
  const mods = cfg.modulos && cfg.modulos.length ? cfg.modulos : ['logo', 'titulo_escena', 'barra', 'escenas', 'info', 'whatsapp_flotante'];
  const L = [
    `# Plan de skin nativo — ${m.nombre}`,
    '',
    'Construya esto en **3DVista > Skin Editor**. Los nombres de componente son importantes: el codigo JavaScript los busca con `getComponentByName`. ',
    'En cada componente, el nombre se escribe en el campo **Nombre** de sus propiedades.',
    '',
    '## Paleta',
    `- Primario: ${m.primario} · Fondo paneles: ${m.fondo} · Texto: ${m.texto} · Fuente: ${m.fuente}`,
    '- Iconos: genere el set con la herramienta `crear_iconos_svg` (estilo circulo o linea) e importe los SVG/PNG en cada Icon Button.',
    '',
    '## Convencion de nombres',
    '`Contenedor_*` agrupadores · `Boton_*` botones · `Panel_*` ventanas que se muestran/ocultan · `Texto_*` etiquetas · `Lista_*` miniaturas · `Imagen_*` imagenes.',
    ''
  ];
  for (const k of mods) {
    const f = MODULOS[k];
    if (!f) { L.push(`> Modulo desconocido: ${k} (disponibles: ${Object.keys(MODULOS).join(', ')})`, ''); continue; }
    const mod = f(m);
    L.push(`## ${mod.titulo}`, '```', ...mod.arbol, '```');
    if (mod.acciones.length) {
      L.push('**Acciones**');
      for (const [comp, ev, desc, code] of mod.acciones) {
        L.push(`- **${comp}** · ${ev}: ${desc}`);
        if (code) L.push('```js', code, '```');
      }
    }
    L.push('');
  }
  L.push('## Consejos', '- Para VR inmersivo (Quest / Vision Pro en modo VR) 3DVista usa su propio skin VR; los componentes 2D y el skin HTML solo se ven en modo navegador.',
    '- Marque "Ocultar al inicio" en todos los `Panel_*`.',
    '- Tras exportar, ejecute `analizar_tour` para confirmar que los nombres quedaron bien escritos.');
  return L.join('\n');
}

export const modulosDisponibles = () => Object.keys(MODULOS);
