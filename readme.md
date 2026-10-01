# WIT AI

**WIT AI** is an AI coding assistant plugin for [Acode](https://acode.app).

By **Mikael Kraft** ([@mikaelkraft](https://github.com/mikaelkraft)) · **Ivytag World** ([@ivytag101](https://github.com/ivytag101))

Fix bugs, generate features, chat with code context, run a multi-step agent, and scaffold projects — using **Groq**, **Hugging Face**, or any **OpenAI-compatible** API.

## Features (v1.2)

- **Sidebar icon** + **floating chat bubble** for quick access
- **Official settings page** under Plugins → WIT AI
- **Side-panel / sidebar chat** with streaming responses and stop button
- **Model picker** for Groq / Hugging Face / custom providers
- **Multi-step agent** — plan → read/write/create files (with confirmation)
- **Fix** current file or selection
- **Generate** code / features from a prompt
- **Scaffold** complete new projects
- Secure encrypted API key storage

## Installation

1. Install `plugin.zip` in Acode: **Settings → Plugins → + → Local**
2. Or during development: `npm run dev` and install via **Remote** URL

## How to open WIT AI

1. **Sidebar** — open the left sidebar and tap the **WIT AI** / chat icon  
2. **Floating button** — purple ✦ bubble (bottom-right of the editor)  
3. **Command palette** — search “WIT AI”  
4. **Shortcuts** — `Ctrl/Cmd+Shift+W` (open), `F` (fix), `G` (generate), `A` (agent)

## Setup (API keys)

1. **Settings → Plugins → WIT AI → Settings** (gear), **or** open chat → ⚙  
2. Set provider + model  
3. Set API keys via the in-app Settings menu (keys are stored encrypted):
   - Groq: https://console.groq.com/keys  
   - Hugging Face: https://huggingface.co/settings/tokens  
   - OpenAI-compatible: your key + base URL  

## Development

```bash
npm install
npm run dev
npm run build
```

## License

MIT
