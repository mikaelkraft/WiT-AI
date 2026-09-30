# WIT AI

**WIT AI** is an AI coding assistant plugin for [Acode](https://acode.app) (Android code editor).

Fix bugs, generate features, chat with code context, run a multi-step agent, and scaffold projects — using **Groq**, **Hugging Face**, or any **OpenAI-compatible** API.

## Features (v1.1)

- **Side-panel chat** with streaming responses and stop button
- **Model picker** for Groq / Hugging Face / custom providers
- **Multi-step agent** — plan → read/write/create files (with confirmation)
- **Fix** current file or selection
- **Generate** code / features from a prompt
- **Scaffold** complete new projects
- Secure encrypted API key storage
- Works with local folders, SAF, and GitHub-backed folders

## Installation

1. Install `plugin.zip` in Acode: **Settings → Plugins → + → Local**
2. Or during development: `npm run dev` and install via **Remote** URL

## Setup

1. Open **WIT AI** (Ctrl/Cmd+Shift+W) or command palette → Settings
2. Add your API key(s):
   - **Groq**: https://console.groq.com/keys
   - **Hugging Face**: https://huggingface.co/settings/tokens
   - **OpenAI-compatible**: any provider (OpenRouter, local LLM, etc.) + base URL

## Commands / Shortcuts

| Command | Shortcut | Description |
|---------|----------|-------------|
| Open assistant / chat panel | Ctrl/Cmd+Shift+W | Full chat UI |
| Fix file / selection | Ctrl/Cmd+Shift+F | Quick fix |
| Generate code | Ctrl/Cmd+Shift+G | Generate feature |
| Multi-step agent | Ctrl/Cmd+Shift+A | Agent mode |
| Scaffold new project | — | Create project from description |
| Settings | — | Keys, provider, model |

## Chat panel

- Select **provider** and **model** in the header
- Type a message — current file is attached as context
- Use quick buttons: Fix, Generate, Agent, New project, Attach file
- Streaming responses; press **Stop** to abort

## Agent mode

Describe a task (e.g. “Add a dark-mode toggle to settings”). The agent proposes file reads/writes/creates; you confirm writes. Best used with a project folder open.

## Development

```bash
npm install
npm run dev      # watch + serve plugin.zip on :3000
npm run build    # production plugin.zip
```

## License

MIT
