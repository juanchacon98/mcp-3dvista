// Guia de referencia que el MCP entrega al asistente (y al usuario).
export const GUIA = {
  flujo: `# Flujo de trabajo recomendado
1. Disenar en 3DVista: panoramas, hotspots y nombres claros de escenas (la etiqueta del panorama es lo que se usa para navegar por codigo).
2. Skin: dos caminos (se pueden combinar):
   a) **Skin nativo** (Skin Editor): \`planificar_skin_nativo\` da el arbol de componentes, nombres y acciones; \`crear_iconos_svg\` genera los iconos con la marca.
      Funciona en todo, incluido el modo VR propio de 3DVista.
   b) **Skin HTML** (capa sobre el export): \`crear_skin_html\` genera e inyecta una interfaz completa (logo, barra, menu de escenas con buscador, info/contacto, WhatsApp, auto-recorrido).
      Se edita como web, no depende del Skin Editor. Solo se ve en modo navegador (no dentro del modo VR inmersivo).
3. Programacion: \`generar_codigo\` produce JavaScript para pegar en **Acciones > Ejecutar JavaScript** de un boton, hotspot o "Al iniciar el recorrido".
4. Exportar HTML5 a la carpeta del paquete (p. ej. \`tour\\\\\`).
5. \`analizar_tour\` para ver escenas, nombres de componentes y verificar.
6. \`auditar_offline\` si el recorrido se usara sin internet.
7. **Cada vez que re-exporte**, 3DVista reescribe index.htm: vuelva a correr \`instalar_skin_html\` (o \`crear_skin_html\`) e \`inyectar_en_export\`.`,

  api: `# API en tiempo de ejecucion (no oficial)
3DVista no publica una API de JavaScript; estas son las llamadas internas estables usadas por la comunidad.
Desde **Ejecutar JavaScript**, \`this\` suele ser el player. Desde fuera: \`TDV.PlayerAPI.getCurrentPlayer()\` (o \`window.tour.player\`).

| Objetivo | Codigo |
|---|---|
| Player | \`var P = TDV.PlayerAPI.getCurrentPlayer();\` |
| Componente del skin | \`P.getComponentByName('Boton_Info')\` → \`.set('visible', true)\`, \`.get('visible')\`, \`.trigger('click')\` |
| Lista principal | \`P.mainPlayList\` (o \`P.getByClassName('PlayList')[0]\`) |
| Escenas | \`pl.get('items')[i].get('media').get('label')\` / \`.get('id')\` |
| Ir a escena | \`pl.set('selectedIndex', i)\` |
| Escena actual | \`pl.get('selectedIndex')\` |
| Buscar por clase | \`P.getByClassName('Panorama')\`, \`'IconButton'\`, \`'Container'\`, \`'HotspotPanoramaOverlay'\` |
| Propiedades | todo objeto TDV usa \`get(nombre)\` / \`set(nombre, valor)\` |
| Audio global | \`P.pauseGlobalAudios()\` / \`P.resumeGlobalAudios()\` (si existen en su version) |

Con el ayudante inyectado (\`window.TDVH\`): \`TDVH.irA('Sala')\`, \`TDVH.mostrar('Panel_Info')\`, \`TDVH.alternar(...)\`, \`TDVH.click(...)\`,
\`TDVH.siguiente()\`, \`TDVH.anterior()\`, \`TDVH.escenas()\`, \`TDVH.actual()\`, \`TDVH.alCambiarEscena(cb)\`, \`TDVH.autoRecorrido(15)\`,
\`TDVH.silenciar()\`, \`TDVH.pantallaCompleta()\`, \`TDVH.idioma('en')\`, \`TDVH.whatsapp(num, msg)\`, \`TDVH.evento(nombre, params)\`, \`TDVH.diagnostico()\`.

Las funciones de script exactas de cada export aparecen en \`analizar_tour\` (seccion "Funciones de script disponibles"). Antes de usar una funcion interna no listada, verifiquela ahi.`,

  nombres: `# Nombres
- Componentes: \`Contenedor_\`, \`Boton_\`, \`Panel_\`, \`Texto_\`, \`Lista_\`, \`Imagen_\` + nombre en PascalCase sin tildes ni espacios.
- Escenas: etiquetas legibles ("Sala principal", "Cocina"); el codigo compara sin tildes ni mayusculas.
- Hotspots: el campo de etiqueta sirve para ubicarlos en \`analizar_tour\`.`,

  depurar: `# Depurar
- Abra el export en Chrome (servidor local, no file://) y la consola (F12).
- \`TDVH.diagnostico()\` muestra si el player, la lista y los componentes estan accesibles.
- \`TDVH.escenas()\` lista etiquetas e indices reales.
- Los fragmentos generados escriben \`[3DV]\` en consola cuando un nombre no existe.
- Use \`validar_javascript\` antes de pegar codigo en 3DVista.`,

  vr_offline: `# VR y uso sin internet
- En visores (Quest / Vision Pro) el recorrido abre en el navegador; el skin 2D/HTML se ve hasta entrar al modo VR. Dentro del VR solo aparece lo configurado en el skin VR de 3DVista y los hotspots.
- Sin internet no funcionan: YouTube/Vimeo, Google Maps, fuentes web, analitica, enlaces externos, WhatsApp/llamadas (en el visor). Corra \`auditar_offline\`.
- El skin HTML de este MCP no usa recursos externos (fuentes del sistema, iconos en linea).`
};

export function guia(tema) {
  if (!tema || tema === 'todo') return Object.values(GUIA).join('\n\n');
  if (!GUIA[tema]) throw new Error(`Tema desconocido. Opciones: ${Object.keys(GUIA).join(', ')}, todo`);
  return GUIA[tema];
}
