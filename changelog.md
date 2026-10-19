# Changelog

## 1.4.15

- Stronger **project folder** detection (`addedfolder`, file location, fileIndex)
- Auto-loads **app.js / styles.css / …** into chat context for diagnose/check requests
- **Apply** never dumps path-tagged code into the wrong open tab (e.g. app.js → not index.html)
- Apply buttons labeled with target filename

## 1.4.14

- Livelier progress status (IDE-style phrases) while scanning, reading files, web lookup, thinking, streaming
- Status rotates so the UI does not look stuck on only "Looking up context" / "Generating"
- **Delete chat history**: long-press a message → Copy / Delete; 🗑 → Clear this chat or Delete this session; Sessions → Delete session

## 1.4.13

- Chat **auto-reads project files** named in your message (e.g. app.js, styles.css)
- "Check the files" on a small project loads those files into context
- Model is instructed not to claim it cannot access the project filesystem

## 1.4.12

- **Provider dropdown fixed**: options were empty (tiny unusable box); now lists Groq/OpenAI/Anthropic/Gemini/HF/Custom
- Larger, usable provider/model selects in header
- FAB overlay no longer covers Acode settings/prompts (z-index lowered + temporary hide while dialogs open)

## 1.4.11

- Sidebar ✦ adapts: **deep violet on light/white** backgrounds, **bright star on dark**

## 1.4.10

- Sidebar ✦ icon: **white** with purple glow for stronger contrast on the rail

## 1.4.9

- Agent **patch-first**; full write must keep existing features; **blocks short destructive writes**
- Path-tagged replies can **write to disk immediately** (not only ephemeral Apply buttons)
- Chat messages are **text-selectable** (partial copy)
- Readme: FAB **swipe up**, no plugin-replication guide; focus on product capabilities

## 1.4.7

- **Apply** writes to **disk** (active file URI) as well as the editor buffer
- Clearer Apply: project path vs open file (no vague “find it yourself” flow)
- **FAB** opens a **full-screen overlay chat** (works even when `$page` does not)

## 1.4.6

- Agent **`run` action**: suggests shell commands and **copies** them for Acode terminal / Termux
- Scaffold can include **`commands`** (e.g. npm install) offered after project create
- Prompts assume a developer user who can run terminal steps

## 1.4.5

- **Smart Apply**: path-tagged blocks (`\`\`\`js src/app.js` or `// file: …`) write to the right project files
- **Write all N files** when the model returns multiple tagged blocks
- **Long-press** any bubble (yours or the model) to copy; Copy button kept
- Prompts push models to tag paths / use agent actions instead of “paste this yourself”

## 1.4.4

- **Apply fixed for CodeMirror 6** (`dispatch` / session — no more `setValue is not a function`)
- **Copy** on every chat bubble + Copy on code Apply bar
- Agent **write/create** uses robust project FS write and refreshes open editor tab
- FAB mounts on `#app` with higher z-index (sidebar remains primary entry)

## 1.4.3

- Agent understands **JSON and `<tool_call>` XML** (gpt-oss style) and **executes** them
- **delete** action with confirm; multi-round read→write agent loop
- Chat auto-runs agent actions when model emits tool_call blobs
- **FAB** higher z-index + touch handlers (sidebar was the only clickable path)
- **Scaffold** opens new project folder + entry file
- **Fix** = selection (or whole file); **Fix file** = always entire file

## 1.4.2

- **Critical install fix**: sidebar no longer keeps *old* UI after update (always remount)
- Version badge **WIT AI 1.4.2** in chat header so you can verify the build
- Force-clear sidebar container on open

## 1.4.1

- **Fix** button: busy lock (no multi-tap error spam); works from selection or whole file
- **Web** chip is a **toggle** (stays ON for the session — no re-type modal)
- **Attach**: project tree or storage files (not the already-open file); clear attachments
- Stronger **Apply** (strips fences, setValue fallback)
- Agent / Fix / Generate share busy lock; open file always auto-context

## 1.4.0

- **Sessions**: New chat + Sessions switcher (history not mixed forever)
- New sessions show **project tree** when a folder is open in Acode
- **Agent from chat**: type task then tap Agent, or `/agent fix the bug`
- Agent prefers **write/patch** over “copy this snippet”
- **Apply to open file** / Insert at cursor on code blocks
- **Fix file** chip — error-oriented fix of current file
- FAB **toggles** chat open/close
- Faster **Thinking…** indicator before network
- Chat always injects **open file + project tree**

## 1.3.9

- Chat markdown: **bold**, lists, `code`, fenced blocks, **clickable highlighted links**
- **Tavily** web search (API key or keyless `X-Tavily-Access-Mode`)
- **Firecrawl** web search (API key or keyless)
- URL extract prefers Tavily `/extract` when available
- Settings: Set Tavily / Firecrawl keys (⚙ + official plugin settings)

## 1.3.8

- Stronger **real-time / web context**: Wikipedia + Wikinews + DuckDuckGo + CORS proxy fallback
- Injects UTC date into system prompt; wider auto-triggers (news/today/latest/…)
- URL paste fetch via proxy when CORS blocks direct page load

## 1.3.7

- Critical: fixed broken toast helper (was recursive / still threw)
- Token usage toast cannot break chat anymore

## 1.3.6

- Fix crash: `acode.toast is not a function` — safe toast/notification fallback

## 1.3.5

- **Keys actually persist**: dual storage (`ctx.setSecret` + `localStorage` fallback) when native ctx is null
- Key prompts no longer use broken password-mode blank fields; save verifies and toasts prefix
- Official settings page includes Gemini / Groq / OpenAI / Anthropic key fields
- Stricter live model filter (no TTS/Live/Whisper/image flood)
- Chat bubbles force light text via inline styles (theme-proof)

## 1.3.4

- Gemini offline fallback includes **gemini-3.7-flash**
- Author contact: mikewillkraft@gmail.com
- Credits link to X (x.com/mikaelkraft, x.com/ivytag101); Ivytag World moved to readme footer

## 1.3.3

- Model picker uses **live models from your API key** only (no giant mixed catalog)
- Filters out TTS / Whisper / image / live / embedding models
- Lean offline fallbacks if key missing or `/models` fails
- Updated current defaults (Gemini 3.8 Flash, Claude Sonnet 5.5, Groq GPT-OSS 20B)

## 1.3.2

- Fix dark-on-dark chat/error text contrast
- Clearer API error tips (503 overload, 404 model access)
- Safer defaults: Groq `llama-3.1-8b-instant`, Gemini `gemini-2.5-flash`

## 1.3.1

- License changed from MIT to **Apache-2.0** (attribution + NOTICE required)

- Multi-provider first: Groq, Gemini, Hugging Face, Custom endpoint (not centered on any one host)
- Endpoint presets: OpenAI, OpenRouter, DeepSeek, Together, Fireworks, Ollama, Gemini-compat, Groq path, BrewKeg, custom
- **Profiles** — save / load provider + model + base URL setups
- **Live model list** via `/v1/models` when the endpoint supports it
- **HTTP MCP**: list tools, call with confirmation; agent can propose `mcp` actions
- Agent **patch** actions (find/replace) plus full-file write/create
- **Token usage** toast after replies when the API returns usage
- **Chat history** persistence across sessions
- Web lookup, test connection, chat chips (MCP / Web)

## 1.3.0

- Gemini provider (3.8 Flash and family)
- Custom OpenAI-compatible endpoints + keys
- Web lookup for current docs / standards

## 1.2.0

- **Sidebar app** icon (chat entry in Acode sidebar)
- **Floating chat bubble** (FAB) on the editor
- **Official plugin settings** page (Plugins → WIT AI → Settings)
- More reliable page show / body mounting
- Author: Mikael Kraft (@mikaelkraft) / Ivytag World (@ivytag101)

## 1.1.0

- Side-panel chat UI with streaming responses
- Multi-step agent (read / write / create files with confirmation)
- Model picker per provider
- OpenAI-compatible custom base URL support
- Stop button for in-progress streams
- Quick actions from chat panel

## 1.0.0

- Initial release of WIT AI
- Groq + Hugging Face support
- Fix / generate / chat / scaffold
- Secure API key storage
