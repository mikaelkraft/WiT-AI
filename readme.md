# WIT AI

**WIT AI** is an AI coding assistant plugin for [Acode](https://acode.app) on Android.

By **Mikael Kraft** ([@mikaelkraft](https://x.com/mikaelkraft)) · [GitHub](https://github.com/mikaelkraft)

Work on real project folders: chat with context, **agent edits on disk**, safe patches, scaffold apps, web lookup, and terminal command hand-off for Acode’s terminal or Termux. Providers: **Groq**, **Gemini**, **OpenAI**, **Anthropic**, **Hugging Face**, or any **OpenAI-compatible** base URL + key.

## Features (v1.4.15)

### Chat
- Sidebar panel and **✦** floating control (**swipe up** on the floating control if a tap is ignored)
- **Sessions** (New chat / switch) so history stays organized
- Streaming replies, markdown, tappable links
- **Select any part of a message** (user or model) to copy; **⧉** icon + long-press also copy
- Open file + **project tree** attached automatically when a folder is open (including repos opened via GitHub/git plugins)

### Real file edits (not “copy this yourself”)
- **Agent** applies **patch / write / create / delete** on disk (with confirm)
- **Patch-first** for small fixes so other features are not wiped
- **Unsafe short write guard** — blocks full-file writes that shrink the file drastically (models often drop code)
- Path-tagged code blocks can be **written into the project** (survives leaving chat)
- Apply updates **editor + disk** when the tab has a saved URI

### Fix / Generate / Scaffold
- **Fix** (selection or file) · **Fix file** (whole file) · **Generate**
- **Scaffold** new apps into a folder, open them, and copy follow-up **terminal commands** (`npm install`, etc.)

### Agent & terminal
- Chip **Agent** or `/agent …` using the task you already typed
- Actions: read, **patch**, write, create, delete, **run**, done
- Parses JSON plans and many `<tool_call>`-style outputs
- **`run`** copies shell commands for **you** to paste in Acode terminal or Termux

### Providers & web
- Live models from your key where supported
- Profiles, custom base URL + key
- **Web** session toggle + Tavily / Firecrawl / Wikipedia-style fallbacks
- Optional HTTP MCP tools

## Installation

1. Uninstall any older WIT AI, force-stop Acode.  
2. **Plugins → + → Local** → install `plugin.zip`.  
3. Confirm header **WIT AI 1.4.15**.

## Open WIT AI

- **Sidebar** — WIT AI / ✦ entry  
- **Floating ✦** — tap, or **swipe up** on the control if needed  
- Command palette — “WIT AI”

## Setup

1. **Plugins → WIT AI → Settings** (or ⚙ in chat)  
2. Provider + model + API key  
3. Optional: custom base URL, web keys, MCP  
4. **Open a project folder** in Acode before Agent / scaffold / path writes  

### Working on GitHub repositories

WIT AI works on whatever folder is open in Acode’s file sidebar — including clones of your GitHub repos.

1. Install an Acode **GitHub / git** plugin from the plugin store (or local zip) that can clone or open repositories.  
2. Clone or open the repo so it appears as a **folder** in Acode (same as any local project).  
3. Open that folder in the sidebar, then use **WIT AI** (chat, Agent, Fix, Scaffold) as usual.  

You do not need a special GitHub mode inside WIT AI: once the repo is a connected project folder, file reads, patches, and writes target those files.

## Good practice

| Intent | Do this |
|--------|---------|
| Small UI/bug fix | Agent: *“Only patch …; do not rewrite the whole file”* |
| Add a feature | Agent with folder open — confirm patch/write dialogs |
| New project | Scaffold → run copied terminal commands → Agent to iterate |
| GitHub repo | Open/clone via a GitHub/git plugin → open folder → WIT AI |
| Shell / npm / pip | Accept **run** / scaffold commands → paste in terminal |

WIT AI is built for developers: it edits the tree and proposes commands; you confirm writes and run the terminal.

## Notes

- Stdio MCP is not available in Acode’s WebView; use HTTPS MCP.  
- Custom endpoints need base URL + key.  
- After updates, uninstall + force-stop if the UI looks stale.  

## License

**Apache License 2.0** — Copyright 2026 Mikael Kraft / Ivytag World.

See `LICENSE` and `NOTICE`.

---

**Ivytag World** — [@ivytag101](https://x.com/ivytag101)  
Contact: mikewillkraft@gmail.com
