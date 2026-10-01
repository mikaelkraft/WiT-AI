# Changelog

## 1.3.9

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
