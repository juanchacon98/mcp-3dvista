<div align="center">

# MCP 3DVista

**Let AI build skins and write the code for your 3DVista virtual tours.**
**Deja que la IA diseñe los skins y programe tus recorridos virtuales de 3DVista.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-blue)
![MCP](https://img.shields.io/badge/MCP-stdio-purple)
![Works offline](https://img.shields.io/badge/offline-ready-orange)

[**🇬🇧 English**](#-english) · [**🇪🇸 Español**](#-español)

</div>

---

## 🇬🇧 English

### Table of contents

- [What is this?](#what-is-this)
- [Why use it? Benefits](#why-use-it-benefits)
- [How it helps you work with AI](#how-it-helps-you-work-with-ai)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Example prompts](#example-prompts)
- [Tools reference](#tools-reference)
- [HTML skin vs. native skin](#html-skin-vs-native-skin)
- [The `TDVH` browser helper](#the-tdvh-browser-helper)
- [Recommended workflow](#recommended-workflow)
- [VR headsets and offline tours](#vr-headsets-and-offline-tours)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Project structure and development](#project-structure-and-development)
- [Disclaimer and license](#disclaimer-and-license)

### What is this?

**MCP 3DVista** is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for people who build virtual tours with **3DVista Virtual Tour Pro**.

MCP is an open standard that lets AI assistants such as **Claude** (Claude Code or Claude Desktop), **Cursor** or **VS Code Copilot** use external tools. Once you install this server, your assistant can:

- **read your real tour export**: scenes, skin component names, hotspots, languages;
- **write JavaScript** for 3DVista's *Run JavaScript* action, using your real names;
- **design and install a full branded HTML skin** on top of your tour;
- **plan a native skin** for the 3DVista *Skin Editor*, step by step;
- **generate SVG icon sets** in your brand colors;
- **inject custom CSS/JS/HTML** into the exported `index.htm`, safely and repeatably;
- **audit your tour for offline use**, for events or VR headsets without internet.

You talk to the assistant in plain language. It calls these tools and gives you finished files and code.

### Why use it? Benefits

| Problem | How MCP 3DVista solves it |
|---|---|
| 3DVista has **no official JavaScript API**, so custom code means guesswork and searching forums | Generates code from internal player calls the community already uses (`getComponentByName`, `mainPlayList`, `get`/`set`), with fallbacks and clear `[3DV]` console warnings |
| AI assistants **make up** component and scene names | `analizar_tour` reads your export first, so the AI uses the exact names in your project |
| Building a skin by hand in the Skin Editor takes hours | Get a ready-made branded HTML skin in seconds, or a detailed blueprint for the native editor |
| **Every re-export overwrites `index.htm`** and wipes your customizations | Injections use named blocks you can repeat, plus `instalar_skin_html` to reinstall with one request |
| Tours shown at events or in VR headsets **without internet** break silently | `auditar_offline` lists every YouTube video, map, web font and link that would fail |
| Icons that don't match the client's brand | `crear_iconos_svg` generates 32 icons in the client's colors, with hover variants |

Also:

- **Zero dependencies.** Pure Node.js, no `npm install`, nothing to keep updated.
- **Nothing leaves your computer.** The server works on local files only and never calls the internet.
- **Safe edits.** The first time it changes `index.htm`, it saves the original as `index.htm.original`.
- **Bilingual friendly.** Tool names and messages are in Spanish; the assistant understands requests in any language.

### How it helps you work with AI

Without this server, an AI assistant only knows 3DVista from its general training. It can't see your project, so it guesses the names of buttons and scenes. Code like that usually fails without any error message.

With MCP 3DVista, the AI gets three things:

1. **Context.** It reads the real export, so it knows your scene "Sala principal" is index 0, that your info panel is called `Panel_Info`, and which internal functions your 3DVista version includes.
2. **Proven tools.** Instead of writing code from scratch each time, the AI calls templates that have been tested and checks syntax with `validar_javascript`.
3. **Direct action.** The AI can write the skin files, inject them into your export and remove them again. You don't have to copy and paste between windows.

The result: you describe what you want (*"add a WhatsApp button that sends the current scene name"*) and get working code, made for your tour.

### Requirements

- **Node.js 18 or newer** ([download](https://nodejs.org)). Check it with `node --version`.
- An MCP-compatible client: Claude Code, Claude Desktop, Cursor, VS Code (Copilot agent mode) or similar.
- **3DVista Virtual Tour Pro** and a tour exported as **HTML5**. The skin and code tools also work before you have an export.

### Installation

**1. Download the server**

```bash
git clone https://github.com/juanchacon98/mcp-3dvista.git
```

Or click **Code → Download ZIP** on GitHub and unzip it. Note the full path to `server.js`, for example `C:\tools\mcp-3dvista\server.js` or `/Users/you/mcp-3dvista/server.js`.

**2. Connect it to your AI client**

<details open>
<summary><b>Claude Code</b> (CLI, desktop app or IDE extension)</summary>

```bash
claude mcp add 3dvista --scope user -- node "/full/path/to/mcp-3dvista/server.js"
```

Check it with `claude mcp get 3dvista` (it should say **Connected**). Start a new session to load the tools.
</details>

<details>
<summary><b>Claude Desktop</b> (chat app)</summary>

Edit `claude_desktop_config.json`:

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "3dvista": {
      "command": "node",
      "args": ["/full/path/to/mcp-3dvista/server.js"]
    }
  }
}
```

On Windows, use double backslashes: `"C:\\tools\\mcp-3dvista\\server.js"`. Restart Claude Desktop.
</details>

<details>
<summary><b>Cursor</b></summary>

Create `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project):

```json
{
  "mcpServers": {
    "3dvista": { "command": "node", "args": ["/full/path/to/mcp-3dvista/server.js"] }
  }
}
```
</details>

<details>
<summary><b>VS Code</b> (Copilot agent mode)</summary>

Create `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "3dvista": { "type": "stdio", "command": "node", "args": ["/full/path/to/mcp-3dvista/server.js"] }
  }
}
```
</details>

**3. Try it**

Ask your assistant: *"Use the 3dvista tools to show me the guide."* It should call `consultar_guia`.

### Quick start

1. In 3DVista, export your tour as **HTML5** to a folder, for example `C:\tours\my-hotel\`.
2. Ask: *"Analyze the 3DVista tour in C:\tours\my-hotel"*. You'll get every scene, skin component and hotspot.
3. Ask: *"Create an HTML skin for it, primary color #1f6f43, logo C:\brand\logo.png, buttons: scenes, previous, next, autoplay, fullscreen, info, WhatsApp +57 300 123 4567"*.
4. Open the tour through a local web server (not `file://`) and check it.
5. After each re-export from 3DVista, ask: *"Reinstall the skin in C:\tours\my-hotel"*.

### Example prompts

**Analysis**
- *"List all the scenes and buttons in my tour at D:\export."*
- *"Which components in my skin contain the word 'Panel'?"*

**Code for 3DVista actions**
- *"Give me the code so that clicking a hotspot goes to the scene 'Kitchen'."*
- *"I need a button that shows `Panel_Info` and hides `Panel_Map` at the same time."*
- *"When the tour changes scene, log a Google Analytics event with the scene name."*
- *"Make an autoplay button that moves to the next scene every 20 seconds."*
- *"Check this code before I paste it into 3DVista: …"*

**Skins**
- *"Design a minimal skin: logo top left, a vertical button bar on the left, scenes grouped into 'Exterior' and 'Interior'."*
- *"Give me a native Skin Editor plan with a bottom bar, a scene menu and a contact panel, in navy blue."*
- *"Generate white-on-orange circle icons for info, WhatsApp, fullscreen and audio in C:\brand\icons."*

**Delivery**
- *"This tour will run without internet on Meta Quest headsets. What will break?"*
- *"Add this CSS to the export to hide the 3DVista loading logo."*

### Tools reference

| Tool | What it does | Main parameters |
|---|---|---|
| `analizar_tour` | Reads an HTML5 export: scenes in playlist order, skin components with exact names, hotspots, languages, internal script functions | `ruta_export`, `filtro`, `idioma`, `formato` (`markdown`/`json`) |
| `generar_codigo` | Generates JavaScript for 3DVista's *Run JavaScript* action | `accion`, `parametros`, `modo` (`accion`/`helper`/`externo`) |
| `listar_acciones` | Lists every action `generar_codigo` can produce and its parameters | — |
| `validar_javascript` | Checks syntax and common mistakes (unchecked nulls, external URLs, stray `await`) | `codigo` |
| `crear_skin_html` | Builds a complete branded HTML/CSS/JS skin and installs it in the export | `ruta_export` or `carpeta_salida`, `marca`, `botones`, `contacto`, `info`, `escenas`, `posicion_barra`, `css_extra`… |
| `instalar_skin_html` | Reinstalls an existing skin after re-exporting | `origen`, `ruta_export` |
| `planificar_skin_nativo` | Blueprint for the Skin Editor: component tree, names, sizes, colors and the code for each action | `marca`, `contacto`, `modulos`, `idiomas`, `guardar_en` |
| `crear_iconos_svg` | SVG icon set in brand colors, with `_activo` (hover) variants | `carpeta_salida`, `iconos`, `estilo` (`circulo`/`cuadrado`/`linea`), `color`, `fondo`, `tamano` |
| `inyectar_en_export` | Adds named, repeatable CSS/JS/HTML blocks to `index.htm` | `ruta_export`, `nombre_bloque`, `css`, `js`, `html`, `archivos`, `esperar_tour` |
| `quitar_inyeccion` | Removes one injected block, or all of them | `ruta_export`, `nombre_bloque` |
| `instalar_ayudante` | Installs only the `window.TDVH` helper | `ruta_export` |
| `obtener_ayudante` | Returns the helper source code | — |
| `auditar_offline` | Lists internet resources (video, maps, fonts, CDNs, analytics, links) | `ruta_export` |
| `consultar_guia` | Built-in guide: `flujo`, `api`, `nombres`, `depurar`, `vr_offline`, `todo` | `tema` |

**Actions available in `generar_codigo`:** `ir_a_escena`, `siguiente_escena`, `anterior_escena`, `mostrar_componente`, `ocultar_componente`, `alternar_componente`, `mostrar_varios`, `mostrar_temporal`, `click_componente`, `abrir_url`, `whatsapp`, `llamar`, `correo`, `pantalla_completa`, `silenciar`, `auto_recorrido`, `cambiar_idioma`, `compartir`, `evento_analytics`, `al_cambiar_escena`, `personalizado`.

**Code modes:**
- `accion` (default): self-contained code to paste into **Action → Run JavaScript** inside 3DVista.
- `helper`: short code that uses `window.TDVH`. Needs the helper installed in the export.
- `externo`: for pages or Web Frames outside the player; it looks for the player in `window.parent`.

### HTML skin vs. native skin

| | **HTML skin** (`crear_skin_html`) | **Native skin** (`planificar_skin_nativo`) |
|---|---|---|
| Built with | Generated web files, injected after export | 3DVista's Skin Editor, following the blueprint |
| Speed | Seconds | Manual, but guided |
| Customization | Anything CSS/JS can do; edit `skin-config.js` | Limited to Skin Editor components |
| Inside immersive VR mode | ❌ Not visible (browser mode only) | ✅ Works with 3DVista's VR skin |
| Survives re-export | Needs `instalar_skin_html` | ✅ Yes, it's part of the project |

You can combine both: keep a simple native skin for VR and add the HTML skin for desktop and mobile.

**HTML skin features:** logo and name, current scene title, button bar (bottom or left), slide-in scene menu with search and groups, info and contact modal, floating WhatsApp button, autoplay, mute, fullscreen, share, keyboard support (`Esc`) and a responsive mobile layout. It uses no web fonts and no CDNs.

### The `TDVH` browser helper

`crear_skin_html` and `instalar_ayudante` add `window.TDVH`, a simple and safe API you can use from the console or your own code:

```js
TDVH.diagnostico();            // check the player, playlist and components
TDVH.escenas();                // [{indice, nombre, id, clase}, …]
TDVH.irA('Kitchen');           // by label (ignores accents/case), id or index
TDVH.siguiente(); TDVH.anterior();
TDVH.mostrar('Panel_Info');  TDVH.ocultar('Panel_Info');  TDVH.alternar('Panel_Info');
TDVH.click('Boton_Info');
TDVH.alCambiarEscena(function (i, escena) { console.log(escena.nombre); });
TDVH.autoRecorrido(15);        // toggle autoplay every 15 s
TDVH.silenciar(); TDVH.pantallaCompleta(); TDVH.idioma('en');
TDVH.whatsapp('573001234567', 'Hello!');
TDVH.evento('cta_click', { boton: 'whatsapp' });   // gtag / dataLayer / fbq, if present
```

If a name doesn't exist, it returns `false` and prints a `[TDVH]` warning in the console instead of breaking the tour.

### Recommended workflow

```text
Design in 3DVista ─► Export HTML5 ─► analizar_tour ─► generar_codigo / crear_skin_html
       ▲                                                        │
       └──── paste code into actions, re-export ◄── test in browser
                         │
                         └─► instalar_skin_html (after every re-export) ─► auditar_offline ─► deliver
```

**Naming tips:** give skin components clear names such as `Boton_Info`, `Panel_Escenas` or `Contenedor_Barra` (no spaces or accents), and give scenes readable labels. The generated code finds them by those names.

### VR headsets and offline tours

- On Meta Quest or Apple Vision Pro, the tour first opens in the browser, where the HTML skin works. **Inside immersive VR mode**, only 3DVista's VR skin and hotspots are shown.
- Without internet, these don't work: YouTube/Vimeo, Google Maps, web fonts, analytics, external links, and WhatsApp or phone calls from the headset. Run `auditar_offline` before delivery.
- The HTML skin uses only system fonts and inline icons.

### Troubleshooting

| Symptom | Fix |
|---|---|
| The tools don't appear in the assistant | Restart the client or open a new session. Run `node server.js` by hand: it should print `listo (14 herramientas)` on stderr. Check that the path is absolute. |
| `analizar_tour` says there's no `script.js` | Point it to the folder that contains `index.htm` (the HTML5 export), not the `.vtp` project. |
| The skin doesn't appear | Open the tour with a local web server, not `file://`. Press F12 and look for errors. Make sure `index.htm` still has the `3DV-MCP:skin-3jc` block (re-exporting removes it). |
| `[3DV] No existe el componente …` | The name doesn't match the Skin Editor. Run `analizar_tour` with `filtro`. |
| Code doesn't work inside 3DVista's preview but works after export | Code in `helper` mode needs `TDVH`, which only exists in the export. Use `accion` mode. |
| Want to undo everything | `quitar_inyeccion` with no block name, or restore `index.htm.original`. |

### FAQ

**Does it modify my `.vtp` project?** No. It only reads and writes the **HTML5 export** folder.

**Does it send my tour anywhere?** No. The server runs on your computer, reads local files and makes no network requests. Your AI client still sends your prompts and the tool results to its model provider, as usual.

**Which 3DVista versions are supported?** The analysis runs the export script in a sandbox and falls back to text parsing. It has been designed for current HTML5 exports. Because 3DVista's internals aren't documented, always test generated code. If something fails, please open an issue.

**Do I need to know JavaScript?** No. Describe what you want and the assistant writes and checks the code. Knowing a little helps you adjust it.

**Can I use it commercially for client projects?** Yes, it's MIT-licensed.

### Project structure and development

```text
server.js            MCP server (JSON-RPC 2.0 over stdio, no SDK)
lib/analizar.js      export analysis + offline audit
lib/codigo.js        code templates + JS validation
lib/skin.js          HTML skin, native skin blueprint, icon export
lib/inyectar.js      safe, repeatable index.htm injection
lib/iconos.js        icon set (24×24 line icons)
lib/guia.js          built-in guide
runtime/             files copied into the tour (tdv-helper.js, skin-3jc.js, skin-3jc.css)
test/                end-to-end test + fake export + skin preview
```

```bash
npm test                         # end-to-end JSON-RPC test (creates test/export-demo)
python -m http.server -d test    # then open http://localhost:8000/vista-previa.html
```

Contributions are welcome: new `generar_codigo` actions, skin modules, icons and translations. Open an issue or a pull request.

### Disclaimer and license

This is an independent community project, **not affiliated with or endorsed by 3DVista**. "3DVista" is a trademark of its owner. Released under the [MIT License](LICENSE) © Corporación 3JC.

<p align="right"><a href="#mcp-3dvista">⬆ Back to top</a></p>

---

## 🇪🇸 Español

### Contenido

- [¿Qué es?](#qué-es)
- [¿Por qué usarlo? Ventajas](#por-qué-usarlo-ventajas)
- [Cómo te ayuda a trabajar con IA](#cómo-te-ayuda-a-trabajar-con-ia)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Inicio rápido](#inicio-rápido)
- [Ejemplos de lo que puedes pedir](#ejemplos-de-lo-que-puedes-pedir)
- [Referencia de herramientas](#referencia-de-herramientas)
- [Skin HTML vs. skin nativo](#skin-html-vs-skin-nativo)
- [El ayudante `TDVH` en el navegador](#el-ayudante-tdvh-en-el-navegador)
- [Flujo de trabajo recomendado](#flujo-de-trabajo-recomendado)
- [Visores VR y recorridos sin internet](#visores-vr-y-recorridos-sin-internet)
- [Solución de problemas](#solución-de-problemas)
- [Preguntas frecuentes](#preguntas-frecuentes)
- [Estructura del proyecto y desarrollo](#estructura-del-proyecto-y-desarrollo)
- [Aviso legal y licencia](#aviso-legal-y-licencia)

### ¿Qué es?

**MCP 3DVista** es un servidor [Model Context Protocol](https://modelcontextprotocol.io) (MCP) para quienes crean recorridos virtuales con **3DVista Virtual Tour Pro**.

MCP es un estándar abierto que permite a asistentes de IA como **Claude** (Claude Code o Claude Desktop), **Cursor** o **VS Code Copilot** usar herramientas externas. Con este servidor instalado, tu asistente puede:

- **leer el export real de tu recorrido**: escenas, nombres de componentes del skin, hotspots, idiomas;
- **escribir JavaScript** para la acción *Ejecutar JavaScript* de 3DVista, con tus nombres reales;
- **diseñar e instalar un skin HTML completo** con la marca del cliente sobre el recorrido;
- **planificar un skin nativo** para el *Skin Editor* de 3DVista, paso a paso;
- **generar sets de iconos SVG** con los colores de la marca;
- **inyectar CSS/JS/HTML propio** en el `index.htm` exportado, de forma segura y repetible;
- **auditar el recorrido para uso sin internet**, para eventos o visores VR sin conexión.

Le hablas al asistente en lenguaje normal. Él usa estas herramientas y te entrega archivos y código terminados.

### ¿Por qué usarlo? Ventajas

| Problema | Cómo lo resuelve MCP 3DVista |
|---|---|
| 3DVista **no tiene API de JavaScript oficial**: programar algo a medida es prueba y error y buscar en foros | Genera código con las llamadas internas que ya usa la comunidad (`getComponentByName`, `mainPlayList`, `get`/`set`), con alternativas y avisos `[3DV]` claros en la consola |
| Las IA **inventan** nombres de componentes y escenas | `analizar_tour` lee primero tu export, así la IA usa los nombres exactos de tu proyecto |
| Armar un skin a mano en el Skin Editor toma horas | En segundos tienes un skin HTML con la marca listo, o un plano detallado para el editor nativo |
| **Cada re-export sobrescribe `index.htm`** y borra lo que personalizaste | Las inyecciones usan bloques con nombre que se pueden repetir, y `instalar_skin_html` reinstala todo con una sola petición |
| Los recorridos para eventos o visores VR **sin internet** fallan sin avisar | `auditar_offline` lista cada video de YouTube, mapa, fuente web y enlace que fallaría |
| Iconos que no combinan con la marca del cliente | `crear_iconos_svg` genera 32 iconos con los colores del cliente y variantes para hover |

Además:

- **Cero dependencias.** Node.js puro, sin `npm install`, nada que mantener actualizado.
- **Nada sale de tu computador.** El servidor solo trabaja con archivos locales y nunca se conecta a internet.
- **Cambios seguros.** La primera vez que modifica `index.htm`, guarda el original como `index.htm.original`.
- **En español.** Los nombres de las herramientas y los mensajes están en español; el asistente entiende peticiones en cualquier idioma.

### Cómo te ayuda a trabajar con IA

Sin este servidor, un asistente de IA solo conoce 3DVista por su entrenamiento general. No ve tu proyecto, así que adivina los nombres de los botones y escenas. Ese código casi siempre falla sin mostrar ningún error.

Con MCP 3DVista, la IA obtiene tres cosas:

1. **Contexto.** Lee el export real, así sabe que tu escena "Sala principal" es el índice 0, que tu panel de información se llama `Panel_Info` y qué funciones internas incluye tu versión de 3DVista.
2. **Herramientas probadas.** En vez de escribir código desde cero cada vez, usa plantillas ya probadas y revisa la sintaxis con `validar_javascript`.
3. **Acción directa.** La IA puede escribir los archivos del skin, inyectarlos en el export y quitarlos de nuevo. No tienes que copiar y pegar entre ventanas.

El resultado: describes lo que quieres (*"agrega un botón de WhatsApp que envíe el nombre de la escena actual"*) y recibes código que funciona, hecho para tu recorrido.

### Requisitos

- **Node.js 18 o superior** ([descargar](https://nodejs.org)). Compruébalo con `node --version`.
- Un cliente compatible con MCP: Claude Code, Claude Desktop, Cursor, VS Code (modo agente de Copilot) u otro similar.
- **3DVista Virtual Tour Pro** y un recorrido exportado en **HTML5**. Las herramientas de skin y código también sirven antes de tener el export.

### Instalación

**1. Descarga el servidor**

```bash
git clone https://github.com/juanchacon98/mcp-3dvista.git
```

O en GitHub haz clic en **Code → Download ZIP** y descomprímelo. Anota la ruta completa de `server.js`, por ejemplo `C:\herramientas\mcp-3dvista\server.js` o `/Users/tu-usuario/mcp-3dvista/server.js`.

**2. Conéctalo a tu cliente de IA**

<details open>
<summary><b>Claude Code</b> (terminal, app de escritorio o extensión del IDE)</summary>

```bash
claude mcp add 3dvista --scope user -- node "/ruta/completa/a/mcp-3dvista/server.js"
```

Compruébalo con `claude mcp get 3dvista` (debe decir **Connected**). Abre una sesión nueva para cargar las herramientas.
</details>

<details>
<summary><b>Claude Desktop</b> (app de chat)</summary>

Edita `claude_desktop_config.json`:

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "3dvista": {
      "command": "node",
      "args": ["/ruta/completa/a/mcp-3dvista/server.js"]
    }
  }
}
```

En Windows usa barras invertidas dobles: `"C:\\herramientas\\mcp-3dvista\\server.js"`. Reinicia Claude Desktop.
</details>

<details>
<summary><b>Cursor</b></summary>

Crea `~/.cursor/mcp.json` (global) o `.cursor/mcp.json` (por proyecto):

```json
{
  "mcpServers": {
    "3dvista": { "command": "node", "args": ["/ruta/completa/a/mcp-3dvista/server.js"] }
  }
}
```
</details>

<details>
<summary><b>VS Code</b> (modo agente de Copilot)</summary>

Crea `.vscode/mcp.json` en tu espacio de trabajo:

```json
{
  "servers": {
    "3dvista": { "type": "stdio", "command": "node", "args": ["/ruta/completa/a/mcp-3dvista/server.js"] }
  }
}
```
</details>

**3. Pruébalo**

Pídele a tu asistente: *"Usa las herramientas de 3dvista para mostrarme la guía."* Debería llamar a `consultar_guia`.

### Inicio rápido

1. En 3DVista, exporta el recorrido en **HTML5** a una carpeta, por ejemplo `C:\recorridos\hotel\`.
2. Pide: *"Analiza el recorrido 3DVista en C:\recorridos\hotel"*. Verás todas las escenas, componentes del skin y hotspots.
3. Pide: *"Créale un skin HTML, color principal #1f6f43, logo C:\marca\logo.png, botones: escenas, anterior, siguiente, automático, pantalla completa, info, WhatsApp +57 300 123 4567"*.
4. Abre el recorrido con un servidor web local (no con `file://`) y revísalo.
5. Después de cada re-export desde 3DVista, pide: *"Reinstala el skin en C:\recorridos\hotel"*.

### Ejemplos de lo que puedes pedir

**Análisis**
- *"Lista todas las escenas y botones del recorrido en D:\export."*
- *"¿Qué componentes de mi skin tienen la palabra 'Panel'?"*

**Código para acciones de 3DVista**
- *"Dame el código para que al hacer clic en un hotspot vaya a la escena 'Cocina'."*
- *"Necesito un botón que muestre `Panel_Info` y oculte `Panel_Mapa` al mismo tiempo."*
- *"Cuando el recorrido cambie de escena, envía un evento a Google Analytics con el nombre de la escena."*
- *"Haz un botón de recorrido automático que avance de escena cada 20 segundos."*
- *"Revisa este código antes de pegarlo en 3DVista: …"*

**Skins**
- *"Diseña un skin minimalista: logo arriba a la izquierda, barra de botones vertical a la izquierda, escenas agrupadas en 'Exterior' e 'Interior'."*
- *"Dame un plan de skin nativo para el Skin Editor con barra inferior, menú de escenas y panel de contacto, en azul marino."*
- *"Genera iconos de círculo naranja con trazo blanco para info, WhatsApp, pantalla completa y audio en C:\marca\iconos."*

**Entrega**
- *"Este recorrido va a funcionar sin internet en visores Meta Quest. ¿Qué va a fallar?"*
- *"Agrega este CSS al export para ocultar el logo de carga de 3DVista."*

### Referencia de herramientas

| Herramienta | Qué hace | Parámetros principales |
|---|---|---|
| `analizar_tour` | Lee un export HTML5: escenas en el orden de la lista, componentes del skin con sus nombres exactos, hotspots, idiomas y funciones internas de script | `ruta_export`, `filtro`, `idioma`, `formato` (`markdown`/`json`) |
| `generar_codigo` | Genera JavaScript para la acción *Ejecutar JavaScript* de 3DVista | `accion`, `parametros`, `modo` (`accion`/`helper`/`externo`) |
| `listar_acciones` | Lista todas las acciones que `generar_codigo` sabe producir y sus parámetros | — |
| `validar_javascript` | Revisa la sintaxis y errores comunes (nulls sin comprobar, URLs externas, `await` fuera de lugar) | `codigo` |
| `crear_skin_html` | Crea un skin HTML/CSS/JS completo con la marca y lo instala en el export | `ruta_export` o `carpeta_salida`, `marca`, `botones`, `contacto`, `info`, `escenas`, `posicion_barra`, `css_extra`… |
| `instalar_skin_html` | Vuelve a instalar un skin existente después de re-exportar | `origen`, `ruta_export` |
| `planificar_skin_nativo` | Plano para el Skin Editor: árbol de componentes, nombres, tamaños, colores y el código de cada acción | `marca`, `contacto`, `modulos`, `idiomas`, `guardar_en` |
| `crear_iconos_svg` | Set de iconos SVG con los colores de la marca, con variantes `_activo` (hover) | `carpeta_salida`, `iconos`, `estilo` (`circulo`/`cuadrado`/`linea`), `color`, `fondo`, `tamano` |
| `inyectar_en_export` | Agrega bloques de CSS/JS/HTML con nombre en `index.htm`, sin duplicarlos | `ruta_export`, `nombre_bloque`, `css`, `js`, `html`, `archivos`, `esperar_tour` |
| `quitar_inyeccion` | Quita un bloque inyectado, o todos | `ruta_export`, `nombre_bloque` |
| `instalar_ayudante` | Instala solo el ayudante `window.TDVH` | `ruta_export` |
| `obtener_ayudante` | Devuelve el código fuente del ayudante | — |
| `auditar_offline` | Lista los recursos de internet (videos, mapas, fuentes, CDNs, analítica, enlaces) | `ruta_export` |
| `consultar_guia` | Guía incluida: `flujo`, `api`, `nombres`, `depurar`, `vr_offline`, `todo` | `tema` |

**Acciones disponibles en `generar_codigo`:** `ir_a_escena`, `siguiente_escena`, `anterior_escena`, `mostrar_componente`, `ocultar_componente`, `alternar_componente`, `mostrar_varios`, `mostrar_temporal`, `click_componente`, `abrir_url`, `whatsapp`, `llamar`, `correo`, `pantalla_completa`, `silenciar`, `auto_recorrido`, `cambiar_idioma`, `compartir`, `evento_analytics`, `al_cambiar_escena`, `personalizado`.

**Modos de código:**
- `accion` (por defecto): código autónomo para pegar en **Acción → Ejecutar JavaScript** dentro de 3DVista.
- `helper`: código corto que usa `window.TDVH`. Requiere tener el ayudante instalado en el export.
- `externo`: para páginas o Web Frames fuera del player; busca el player en `window.parent`.

### Skin HTML vs. skin nativo

| | **Skin HTML** (`crear_skin_html`) | **Skin nativo** (`planificar_skin_nativo`) |
|---|---|---|
| Cómo se hace | Archivos web generados que se inyectan después de exportar | En el Skin Editor de 3DVista, siguiendo el plano |
| Rapidez | Segundos | Manual, pero guiado |
| Personalización | Todo lo que permitan CSS y JS; se edita en `skin-config.js` | Limitada a los componentes del Skin Editor |
| Dentro del modo VR inmersivo | ❌ No se ve (solo en modo navegador) | ✅ Funciona con el skin VR de 3DVista |
| Sobrevive al re-export | Hay que correr `instalar_skin_html` | ✅ Sí, es parte del proyecto |

Puedes combinarlos: un skin nativo sencillo para VR y el skin HTML para escritorio y celular.

**Qué trae el skin HTML:** logo y nombre, título de la escena actual, barra de botones (abajo o a la izquierda), menú lateral de escenas con buscador y grupos, ventana de información y contacto, botón flotante de WhatsApp, recorrido automático, silencio, pantalla completa, compartir, soporte de teclado (`Esc`) y diseño adaptado a celulares. No usa fuentes web ni CDNs.

### El ayudante `TDVH` en el navegador

`crear_skin_html` e `instalar_ayudante` agregan `window.TDVH`, una API sencilla y segura que puedes usar desde la consola o desde tu propio código:

```js
TDVH.diagnostico();            // revisa el player, la lista y los componentes
TDVH.escenas();                // [{indice, nombre, id, clase}, …]
TDVH.irA('Cocina');            // por etiqueta (sin importar tildes/mayúsculas), id o índice
TDVH.siguiente(); TDVH.anterior();
TDVH.mostrar('Panel_Info');  TDVH.ocultar('Panel_Info');  TDVH.alternar('Panel_Info');
TDVH.click('Boton_Info');
TDVH.alCambiarEscena(function (i, escena) { console.log(escena.nombre); });
TDVH.autoRecorrido(15);        // activa/desactiva el avance cada 15 s
TDVH.silenciar(); TDVH.pantallaCompleta(); TDVH.idioma('en');
TDVH.whatsapp('573001234567', '¡Hola!');
TDVH.evento('cta_click', { boton: 'whatsapp' });   // gtag / dataLayer / fbq, si existen
```

Si un nombre no existe, devuelve `false` y escribe un aviso `[TDVH]` en la consola, sin romper el recorrido.

### Flujo de trabajo recomendado

```text
Diseñar en 3DVista ─► Exportar HTML5 ─► analizar_tour ─► generar_codigo / crear_skin_html
        ▲                                                         │
        └──── pegar código en acciones, re-exportar ◄── probar en el navegador
                          │
                          └─► instalar_skin_html (después de cada re-export) ─► auditar_offline ─► entregar
```

**Consejos de nombres:** ponle a los componentes del skin nombres claros como `Boton_Info`, `Panel_Escenas` o `Contenedor_Barra` (sin espacios ni tildes), y a las escenas etiquetas legibles. El código generado los busca por esos nombres.

### Visores VR y recorridos sin internet

- En Meta Quest o Apple Vision Pro, el recorrido abre primero en el navegador, donde el skin HTML funciona. **Dentro del modo VR inmersivo** solo se ven el skin VR de 3DVista y los hotspots.
- Sin internet no funcionan: YouTube/Vimeo, Google Maps, fuentes web, analítica, enlaces externos, ni WhatsApp o llamadas desde el visor. Corre `auditar_offline` antes de entregar.
- El skin HTML solo usa fuentes del sistema e iconos incluidos en el código.

### Solución de problemas

| Síntoma | Solución |
|---|---|
| Las herramientas no aparecen en el asistente | Reinicia el cliente o abre una sesión nueva. Ejecuta `node server.js` a mano: debe mostrar `listo (14 herramientas)` en stderr. Revisa que la ruta sea absoluta. |
| `analizar_tour` dice que no hay `script.js` | Indica la carpeta que contiene `index.htm` (el export HTML5), no el proyecto `.vtp`. |
| El skin no aparece | Abre el recorrido con un servidor web local, no con `file://`. Presiona F12 y busca errores. Revisa que `index.htm` todavía tenga el bloque `3DV-MCP:skin-3jc` (el re-export lo borra). |
| `[3DV] No existe el componente …` | El nombre no coincide con el del Skin Editor. Corre `analizar_tour` con `filtro`. |
| El código no funciona en la vista previa de 3DVista pero sí después de exportar | El código en modo `helper` necesita `TDVH`, que solo existe en el export. Usa el modo `accion`. |
| Quiero deshacer todo | `quitar_inyeccion` sin nombre de bloque, o restaura `index.htm.original`. |

### Preguntas frecuentes

**¿Modifica mi proyecto `.vtp`?** No. Solo lee y escribe en la carpeta del **export HTML5**.

**¿Envía mi recorrido a algún lado?** No. El servidor corre en tu computador, lee archivos locales y no hace conexiones de red. Tu cliente de IA sí envía tus mensajes y los resultados de las herramientas a su proveedor del modelo, como siempre.

**¿Qué versiones de 3DVista soporta?** El análisis ejecuta el script del export en un entorno aislado y, si falla, lee el texto directamente. Está diseñado para los exports HTML5 actuales. Como 3DVista no documenta su funcionamiento interno, prueba siempre el código generado. Si algo falla, abre un issue.

**¿Necesito saber JavaScript?** No. Describe lo que quieres y el asistente escribe y revisa el código. Saber un poco te ayuda a ajustarlo.

**¿Puedo usarlo en proyectos comerciales para clientes?** Sí, tiene licencia MIT.

### Estructura del proyecto y desarrollo

```text
server.js            servidor MCP (JSON-RPC 2.0 por stdio, sin SDK)
lib/analizar.js      análisis del export + auditoría offline
lib/codigo.js        plantillas de código + validación JS
lib/skin.js          skin HTML, plano del skin nativo, exportación de iconos
lib/inyectar.js      inyección segura y repetible en index.htm
lib/iconos.js        set de iconos (línea 24×24)
lib/guia.js          guía incluida
runtime/             archivos que se copian al recorrido (tdv-helper.js, skin-3jc.js, skin-3jc.css)
test/                prueba de extremo a extremo + export simulado + vista previa del skin
```

```bash
npm test                         # prueba de extremo a extremo por JSON-RPC (crea test/export-demo)
python -m http.server -d test    # luego abre http://localhost:8000/vista-previa.html
```

Las contribuciones son bienvenidas: nuevas acciones para `generar_codigo`, módulos de skin, iconos y traducciones. Abre un issue o un pull request.

### Aviso legal y licencia

Proyecto comunitario independiente, **sin relación ni respaldo de 3DVista**. "3DVista" es una marca registrada de su propietario. Publicado bajo la [licencia MIT](LICENSE) © Corporación 3JC.

<p align="right"><a href="#mcp-3dvista">⬆ Volver arriba</a></p>
