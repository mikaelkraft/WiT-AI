# Changelog

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
