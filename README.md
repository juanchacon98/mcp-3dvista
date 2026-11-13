# MCP 3DVista

Servidor **MCP (Model Context Protocol)** para que Claude u otro asistente compatible te ayude a **diseñar skins** y **programar** recorridos virtuales hechos con [3DVista Virtual Tour Pro](https://www.3dvista.com/).

- Node.js puro, **sin dependencias**: no necesita `npm install`.
- **No usa internet**: el skin y el código generados funcionan en recorridos offline, por ejemplo en eventos con visores VR sin conexión.
- Antes de generar código lee el **export HTML5 real**, así usa los nombres exactos de tus escenas y componentes.

> *English:* an MCP server that helps AI assistants analyze 3DVista HTML5 exports, generate JavaScript for "Run JavaScript" actions, build branded HTML skins or native Skin Editor blueprints, generate SVG icon sets, and audit tours for offline use. Zero dependencies.

## Instalación

Requiere Node.js 18 o superior.

```bash
git clone https://github.com/juanchacon98/mcp-3dvista.git
```

**Claude Code**

```bash
claude mcp add 3dvista --scope user -- node "/ruta/a/mcp-3dvista/server.js"
```

**Claude Desktop** (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "3dvista": { "command": "node", "args": ["/ruta/a/mcp-3dvista/server.js"] }
  }
}
```

En Windows usa barras dobles en el JSON: `"C:\\ruta\\mcp-3dvista\\server.js"`.

## Herramientas

| Herramienta | Para qué sirve |
|---|---|
| `analizar_tour` | Lee el export HTML5 y lista las escenas en orden, los nombres exactos de los componentes del skin, los hotspots, los idiomas y las funciones de script |
| `generar_codigo` / `listar_acciones` | Genera JavaScript listo para **Acciones → Ejecutar JavaScript**: ir a una escena, mostrar u ocultar componentes, WhatsApp, recorrido automático, idioma, analítica, código al cambiar de escena… |
| `validar_javascript` | Revisa la sintaxis y errores comunes antes de pegar el código en 3DVista |
| `crear_skin_html` | Crea un skin web completo con la marca (logo, barra, menú de escenas con buscador y grupos, panel de info y contacto, WhatsApp) y lo inyecta en el export |
| `instalar_skin_html` | Vuelve a instalar el skin después de re-exportar desde 3DVista |
| `planificar_skin_nativo` | Arma el plano del skin para el **Skin Editor**: árbol de componentes, nombres, colores y el código de cada acción |
| `crear_iconos_svg` | Genera iconos SVG con los colores de la marca, más una variante `_activo` |
| `inyectar_en_export` / `quitar_inyeccion` | Agrega o quita CSS, JS o HTML propio en `index.htm`. Se puede repetir sin duplicar bloques y guarda el original como `index.htm.original` |
| `instalar_ayudante` / `obtener_ayudante` | Instala `window.TDVH`, una API simplificada que incluye `TDVH.diagnostico()` para la consola |
| `auditar_offline` | Detecta lo que fallará sin internet: YouTube, mapas, fuentes web, enlaces… |
| `consultar_guia` | Guía de flujo de trabajo, API interna, nombres, depuración y VR/offline |

## Flujo típico

1. Exporta el recorrido en HTML5.
2. Pídele al asistente: *"analiza el tour en C:\…\tour"*.
3. *"Hazme el skin con estos colores y este logo"* o *"dame el plan del skin nativo"*.
4. *"Genera el código para que el botón Boton_Cocina lleve a la escena Cocina"*.
5. **Cada re-export reescribe `index.htm`.** Después pide *"reinstala el skin"*.

## Ayudante `TDVH` (en el navegador)

```js
TDVH.escenas();            // [{indice, nombre, id}, …]
TDVH.irA('Cocina');        // compara sin tildes ni mayúsculas
TDVH.mostrar('Panel_Info');
TDVH.autoRecorrido(15);
TDVH.diagnostico();
```

## Notas

- 3DVista **no publica una API de JavaScript oficial**. El código usa las llamadas internas conocidas (`getComponentByName`, `mainPlayList`, `get`/`set`) con alternativas y escribe avisos `[3DV]` en la consola cuando algo no existe.
- En visores VR, el skin 2D/HTML se ve en modo navegador. Dentro del modo VR inmersivo manda el skin VR de 3DVista.
- Proyecto independiente, sin relación con 3DVista. "3DVista" es una marca de su propietario.

## Desarrollo

```bash
npm test                         # prueba de extremo a extremo por JSON-RPC (genera test/export-demo)
python -m http.server -d test    # luego abre /vista-previa.html (skin con player simulado)
```

## Licencia

MIT © Corporación 3JC
