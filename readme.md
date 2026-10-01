# WIT AI

![1000506324](https://github.com/user-attachments/assets/ff209dd3-fa7d-4dac-8f59-4e32db50e848)

**WIT AI** is an AI coding assistant plugin for [Acode](https://acode.app).

By [Mikael Kraft](https://github.com/mikaelkraft)

Fix bugs, generate features, chat with code context, run a multi-step agent, call HTTP MCP tools, and scaffold projects — using **Groq**, **Gemini**, **Hugging Face**, or **any OpenAI-compatible** endpoint.

## Features (v1.3.1)

- **Sidebar icon** + **floating chat bubble** for quick access
- **Official settings page** under Plugins → WIT AI
- **Streaming chat** with stop button and persisted history
- **Providers**: Groq · Gemini · Hugging Face · Custom endpoint
- **Endpoint presets**: OpenAI, OpenRouter, DeepSeek, Together, Fireworks, Ollama, Gemini-compat, BrewKeg, custom URL
- **Profiles** — save and switch provider/model/URL setups
- **Live model list** from `/v1/models` when available
- **Multi-step agent** — read / write / create / **patch** / **MCP** (with confirmation)
- **HTTP MCP** servers (URL + optional bearer key)
- **Web lookup** for current docs and standards
- **Token usage** toast when the API reports usage
- Fix selection, generate features, scaffold projects

## Installation

1. Install `plugin.zip` in Acode: **Settings → Plugins → + → Local**
2. Or during development: `npm run dev` and install via **Remote** URL

## How to open WIT AI

1. **Sidebar** — left sidebar → WIT AI / chat icon  
2. **Floating button** — ✦ bubble (bottom-right of the editor)  
3. **Command palette** — search “WIT AI”  
4. **Shortcuts** — `Ctrl/Cmd+Shift+W` (open), `F` (fix), `G` (generate), `A` (agent)

## Setup

1. **Settings → Plugins → WIT AI → Settings**, or chat → ⚙  
2. Pick a **provider** (default: Groq) and **model**  
3. Store API keys (encrypted):
   - Groq: https://console.groq.com/keys  
   - Gemini: https://aistudio.google.com/apikey  
   - Hugging Face: https://huggingface.co/settings/tokens  
   - Custom endpoint: your key + base URL (any OpenAI-compatible host)  
4. Optional: **Profiles** to switch setups quickly  
5. Optional: **MCP / external services** for HTTP MCP servers  

## Notes

- Stdio MCP (local `npx` processes) cannot run inside Acode’s WebView; use **HTTPS MCP** instead.  
- Some MCP hosts require CORS; if `tools/list` fails, the server may be blocking mobile WebView origins.  
- Custom endpoints need both **base URL** and **key** (same pattern as OpenAI).  

## License

**Apache License 2.0** — Copyright 2026 Mikael Kraft / Ivytag World.

 **Ivytag World** ([@ivytag101](https://x.com/ivytag101))

You may use and modify WIT AI, but redistributions must keep the copyright notice, license, and `NOTICE` file, and must indicate significant changes. See `LICENSE` and `NOTICE`.
