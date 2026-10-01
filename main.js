const plugin = {"$schema": "https://acode.app/schema/plugin/v0.1.0.json", "id": "com.witai.coder", "name": "WIT AI", "main": "main.js", "version": "1.3.1", "readme": "readme.md", "changelogs": "changelog.md", "icon": "icon.png", "files": [], "minVersionCode": 290, "license": "MIT", "keywords": ["ai", "groq", "openai", "anthropic", "gemini", "huggingface", "coder", "assistant"], "price": 0, "permissions": [], "author": {"name": "Mikael Kraft", "email": "mikewillkraft@gmail.com", "github": "mikaelkraft", "url": "https://github.com/mikaelkraft"}};
/**
 * WIT AI v1.3.1 — multi-provider AI coding assistant for Acode
 * Groq · Gemini · Hugging Face · any OpenAI-compatible endpoint
 * Chat, streaming, agent, MCP (HTTP), web lookup, profiles, project scaffold
 */
class WitAI {
  baseUrl = "";
  ctx = null;
  $page = null;
  history = [];
  isStreaming = false;
  abortController = null;
  lastUsage = null;

  MODELS = {
    groq: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
      { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout" },
      { id: "qwen/qwen3-32b", label: "Qwen3 32B" },
    ],
    openai: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-5", label: "GPT-5" },
      { id: "gpt-5-mini", label: "GPT-5 mini" },
      { id: "o3-mini", label: "o3-mini" },
      { id: "custom", label: "Custom model ID…" },
    ],
    anthropic: [
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { id: "claude-opus-4", label: "Claude Opus 4" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet (latest)" },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku (latest)" },
      { id: "custom", label: "Custom model ID…" },
    ],
    gemini: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (latest)" },
      { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
      { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
      { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
    huggingface: [
      { id: "meta-llama/Llama-3.1-70B-Instruct", label: "Llama 3.1 70B Instruct" },
      { id: "meta-llama/Llama-3.1-8B-Instruct", label: "Llama 3.1 8B Instruct" },
      { id: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen2.5 72B" },
      { id: "mistralai/Mixtral-8x7B-Instruct-v0.1", label: "Mixtral 8x7B" },
      { id: "google/gemma-2-27b-it", label: "Gemma 2 27B" },
    ],
    openai_compatible: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "claude-haiku-4.5", label: "Claude Haiku 4.5" },
      { id: "claude-fable-5.1", label: "Claude Fable 5.1" },
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
      { id: "custom", label: "Custom model ID…" },
    ],
  };

  ENDPOINT_PRESETS = [
    { id: "openai", label: "OpenAI", url: "https://api.openai.com/v1" },
    { id: "openrouter", label: "OpenRouter", url: "https://openrouter.ai/api/v1" },
    { id: "groq_compat", label: "Groq (OpenAI path)", url: "https://api.groq.com/openai/v1" },
    { id: "gemini_compat", label: "Gemini OpenAI-compat", url: "https://generativelanguage.googleapis.com/v1beta/openai" },
    { id: "deepseek", label: "DeepSeek", url: "https://api.deepseek.com/v1" },
    { id: "together", label: "Together AI", url: "https://api.together.xyz/v1" },
    { id: "fireworks", label: "Fireworks", url: "https://api.fireworks.ai/inference/v1" },
    { id: "ollama", label: "Ollama (local)", url: "http://127.0.0.1:11434/v1" },
    { id: "brewkeg", label: "BrewKeg", url: "https://brewkeg.dev/v1" },
    { id: "custom", label: "Custom URL…", url: "" },
  ];

  async init($page, _cacheFile, _cacheFileUrl, _firstInit, ctx) {
    this.ctx = ctx;
    this.$page = $page;

    const commands = acode.require("commands");
    const cmds = [
      { name: "witai.open", desc: "WIT AI – Open assistant", key: { win: "Ctrl-Shift-W", mac: "Command-Shift-W" }, fn: () => this.openPanel() },
      { name: "witai.fix", desc: "WIT AI – Fix current file / selection", key: { win: "Ctrl-Shift-F", mac: "Command-Shift-F" }, fn: () => this.quickAction("fix") },
      { name: "witai.generate", desc: "WIT AI – Generate code / feature", key: { win: "Ctrl-Shift-G", mac: "Command-Shift-G" }, fn: () => this.quickAction("generate") },
      { name: "witai.agent", desc: "WIT AI – Multi-step agent", key: { win: "Ctrl-Shift-A", mac: "Command-Shift-A" }, fn: () => this.runAgent() },
      { name: "witai.chat", desc: "WIT AI – Chat panel", fn: () => this.openPanel() },
      { name: "witai.newproject", desc: "WIT AI – Scaffold new project", fn: () => this.newProject() },
      { name: "witai.settings", desc: "WIT AI – Settings / API keys", fn: () => this.openSettings() },
    ];
    for (const c of cmds) {
      commands.addCommand({ name: c.name, description: c.desc, bindKey: c.key, exec: c.fn });
    }

    // Visible entry: sidebar app icon
    try {
      const sideBarApps = acode.require("sidebarApps");
      // Use a built-in-looking icon class; many themes map "chat_bubble" / "robot"
      sideBarApps.add(
        "chat_bubble",
        "witai_sidebar",
        "WIT AI",
        (container) => {
          this.sidebarContainer = container;
          this.renderSidebarChat(container);
        },
        false,
        (container) => {
          // Refresh when selected
          if (container && !container.querySelector(".wit-root")) {
            this.renderSidebarChat(container);
          }
        }
      );
    } catch (e) {
      console.warn("WIT AI: sidebarApps not available", e);
    }

    // Floating chat bubble on the editor
    this.installFab();
    await this.loadHistory();
  }

  async destroy() {
    if (this.abortController) this.abortController.abort();
    const commands = acode.require("commands");
    ["witai.open", "witai.fix", "witai.generate", "witai.agent", "witai.chat", "witai.newproject", "witai.settings"]
      .forEach((n) => commands.removeCommand(n));
    try {
      const sideBarApps = acode.require("sidebarApps");
      sideBarApps.remove("witai_sidebar");
    } catch { /* ignore */ }
    this.removeFab();
  }

  installFab() {
    this.removeFab();
    const btn = document.createElement("button");
    btn.id = "witai-fab";
    btn.title = "WIT AI";
    btn.setAttribute("aria-label", "Open WIT AI");
    btn.innerHTML = "✦";
    Object.assign(btn.style, {
      position: "fixed",
      right: "16px",
      bottom: "72px",
      width: "48px",
      height: "48px",
      borderRadius: "50%",
      border: "none",
      background: "linear-gradient(135deg,#6c5ce7,#a29bfe)",
      color: "#fff",
      fontSize: "22px",
      boxShadow: "0 4px 14px rgba(0,0,0,.35)",
      zIndex: "9999",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });
    btn.onclick = () => this.openPanel();
    document.body.appendChild(btn);
    this.fabEl = btn;
  }

  removeFab() {
    if (this.fabEl && this.fabEl.parentNode) {
      this.fabEl.parentNode.removeChild(this.fabEl);
    }
    this.fabEl = null;
    const existing = document.getElementById("witai-fab");
    if (existing) existing.remove();
  }

  async getKey(provider) {
    if (!this.ctx) return "";
    return this.ctx.getSecret(`${provider}_api_key`, "");
  }
  async setKey(provider, key) {
    if (!this.ctx) return;
    await this.ctx.setSecret(`${provider}_api_key`, key || "");
  }
  async getSetting(key, def = "") {
    if (!this.ctx) return def;
    return this.ctx.getSecret(`setting_${key}`, def);
  }
  async setSetting(key, value) {
    if (!this.ctx) return;
    await this.ctx.setSecret(`setting_${key}`, String(value ?? ""));
  }

  getCurrentContext() {
    try {
      const editor = editorManager.editor;
      const file = editorManager.activeFile;
      const fullText = editor.state.doc.toString();
      const sel = editor.state.selection.main;
      const selection = sel.from !== sel.to ? editor.state.sliceDoc(sel.from, sel.to) : null;
      return {
        filename: file?.filename || "untitled",
        uri: file?.uri || "",
        language: this.guessLanguage(file?.filename),
        fullText,
        selection,
        cursor: sel.head,
        hasSelection: !!selection,
      };
    } catch {
      return { filename: "untitled", uri: "", language: "text", fullText: "", selection: null, cursor: 0, hasSelection: false };
    }
  }

  guessLanguage(filename = "") {
    const ext = (filename.split(".").pop() || "").toLowerCase();
    const map = {
      js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
      py: "python", java: "java", kt: "kotlin", go: "go", rs: "rust", php: "php",
      rb: "ruby", css: "css", scss: "scss", html: "html", htm: "html", json: "json",
      md: "markdown", sh: "bash", bash: "bash", c: "c", cpp: "cpp", h: "c",
      vue: "vue", svelte: "svelte", xml: "xml", yaml: "yaml", yml: "yaml",
    };
    return map[ext] || "text";
  }

  async listDir(url, maxDepth = 2, depth = 0) {
    if (depth > maxDepth) return [];
    const fs = acode.require("fs");
    try {
      const dir = await fs(url);
      const entries = await dir.lsDir();
      const out = [];
      for (const e of entries) {
        if (e.isDirectory) {
          out.push({ name: e.name, type: "dir", url: e.url, children: await this.listDir(e.url, maxDepth, depth + 1) });
        } else {
          out.push({ name: e.name, type: "file", url: e.url });
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  flattenTree(tree, prefix = "") {
    let lines = [];
    for (const n of tree) {
      const p = prefix + n.name + (n.type === "dir" ? "/" : "");
      lines.push(p);
      if (n.children) lines = lines.concat(this.flattenTree(n.children, prefix + n.name + "/"));
    }
    return lines;
  }

  normalizeChatUrl(base) {
    let u = String(base || "").trim();
    if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    u = u.replace(/\/+$/, "");
    if (!/\/chat\/completions$/i.test(u)) {
      if (!/\/v1$/i.test(u) && !/\/openai$/i.test(u) && !/\/v1beta\/openai$/i.test(u)) {
        u += "/v1";
      }
      u += "/chat/completions";
    }
    return u;
  }

  async resolveEndpoint() {
    const provider = await this.getSetting("provider", "groq");
    let model = await this.getSetting("model", "");
    const baseUrl = await this.getSetting("base_url", "");
    if (!model || model === "custom") {
      model = provider === "groq" ? "llama-3.3-70b-versatile"
        : provider === "openai" ? "gpt-4o-mini"
        : provider === "anthropic" ? "claude-sonnet-4-5"
        : provider === "gemini" ? "gemini-3.8-flash"
        : provider === "huggingface" ? "meta-llama/Llama-3.1-8B-Instruct"
        : "gpt-4o-mini";
    }
    let url, keyProvider;
    if (provider === "groq") {
      url = "https://api.groq.com/openai/v1/chat/completions";
      keyProvider = "groq";
    } else if (provider === "openai") {
      url = "https://api.openai.com/v1/chat/completions";
      keyProvider = "openai";
    } else if (provider === "anthropic") {
      // Anthropic OpenAI-compat layer (chat completions)
      url = "https://api.anthropic.com/v1/chat/completions";
      keyProvider = "anthropic";
    } else if (provider === "gemini") {
      url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      keyProvider = "gemini";
    } else if (provider === "huggingface") {
      url = "https://router.huggingface.co/v1/chat/completions";
      keyProvider = "huggingface";
    } else {
      url = this.normalizeChatUrl(baseUrl || "https://api.openai.com/v1");
      keyProvider = "openai_compatible";
    }
    const key = await this.getKey(keyProvider);
    return { provider, model, url, key, keyProvider };
  }

  authHeaders(key, provider) {
    const h = { "Content-Type": "application/json" };
    if (key) h.Authorization = `Bearer ${key}`;
    // Anthropic OpenAI-compat often wants version header too
    if (provider === "anthropic") h["anthropic-version"] = "2023-06-01";
    return h;
  }

  async fetchRemoteModels() {
    try {
      const { url, key, provider } = await this.resolveEndpoint();
      const modelsUrl = url.replace(/\/chat\/completions\/?$/, "/models");
      const headers = this.authHeaders(key, provider);
      delete headers["Content-Type"];
      const res = await fetch(modelsUrl, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      const list = data.data || data.models || [];
      return list
        .map((m) => {
          const id = m.id || m.name || m;
          if (typeof id !== "string") return null;
          return { id, label: id };
        })
        .filter(Boolean)
        .slice(0, 80);
    } catch {
      return [];
    }
  }

  async getProfiles() {
    try {
      const raw = await this.getSetting("profiles_json", "");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async saveProfiles(list) {
    await this.setSetting("profiles_json", JSON.stringify(list || []));
  }

  async manageProfiles() {
    const profiles = await this.getProfiles();
    const choice = await acode.select("Profiles", [
      "Save current as profile",
      "Load profile",
      "Delete profile",
      "Back",
    ]);
    if (choice === "Save current as profile") {
      const name = await acode.prompt("Profile name", "My setup");
      if (!name) return;
      const snap = {
        name: name.trim(),
        provider: await this.getSetting("provider", "groq"),
        model: await this.getSetting("model", ""),
        base_url: await this.getSetting("base_url", ""),
      };
      const next = profiles.filter((p) => p.name !== snap.name).concat([snap]);
      await this.saveProfiles(next);
      acode.toast("Profile saved: " + snap.name);
    } else if (choice === "Load profile") {
      if (!profiles.length) return acode.toast("No profiles");
      const name = await acode.select("Load", profiles.map((p) => p.name));
      const p = profiles.find((x) => x.name === name);
      if (!p) return;
      await this.setSetting("provider", p.provider || "groq");
      await this.setSetting("model", p.model || "");
      await this.setSetting("base_url", p.base_url || "");
      acode.toast("Loaded " + p.name);
    } else if (choice === "Delete profile") {
      if (!profiles.length) return;
      const name = await acode.select("Delete", profiles.map((p) => p.name));
      if (!name) return;
      await this.saveProfiles(profiles.filter((p) => p.name !== name));
      acode.toast("Deleted " + name);
    }
  }

  async persistHistory() {
    try {
      const slim = this.history.slice(-40).map((m) => ({
        role: m.role,
        content: String(m.content || "").slice(0, 8000),
      }));
      await this.setSetting("chat_history_json", JSON.stringify(slim));
    } catch { /* ignore */ }
  }

  async loadHistory() {
    try {
      const raw = await this.getSetting("chat_history_json", "");
      if (!raw) return;
      const list = JSON.parse(raw);
      if (Array.isArray(list)) this.history = list;
    } catch { /* ignore */ }
  }

  toastUsage(usage) {
    if (!usage) return;
    const p = usage.prompt_tokens ?? usage.input_tokens;
    const c = usage.completion_tokens ?? usage.output_tokens;
    const t = usage.total_tokens;
    if (p != null || c != null || t != null) {
      acode.toast(`Tokens: ${p ?? "?"} in / ${c ?? "?"} out` + (t != null ? ` (${t} total)` : ""));
    }
  }

  stripHtml(html) {
    return String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  async fetchUrlText(url) {
    const res = await fetch(url, { headers: { Accept: "text/html,application/json,text/plain" } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const ct = res.headers.get("content-type") || "";
    const raw = await res.text();
    if (ct.includes("application/json")) {
      try { return JSON.stringify(JSON.parse(raw)).slice(0, 6000); } catch { return raw.slice(0, 6000); }
    }
    return this.stripHtml(raw).slice(0, 6000);
  }

  async webSearch(query) {
    const q = encodeURIComponent(query);
    const endpoints = [
      `https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`,
    ];
    let text = "";
    try {
      const res = await fetch(endpoints[0]);
      if (res.ok) {
        const data = await res.json();
        const parts = [];
        if (data.AbstractText) parts.push(data.AbstractText);
        if (data.Heading) parts.push("Topic: " + data.Heading);
        if (Array.isArray(data.RelatedTopics)) {
          for (const t of data.RelatedTopics.slice(0, 6)) {
            if (t.Text) parts.push("- " + t.Text);
            else if (t.Topics) {
              for (const s of t.Topics.slice(0, 3)) if (s.Text) parts.push("- " + s.Text);
            }
          }
        }
        if (data.AbstractURL) parts.push("Source: " + data.AbstractURL);
        text = parts.join("\n");
      }
    } catch { /* ignore */ }

    if (!text) {
      try {
        const html = await (await fetch(`https://html.duckduckgo.com/html/?q=${q}`)).text();
        text = this.stripHtml(html).slice(0, 4000);
      } catch { /* ignore */ }
    }
    return text || "(no web results)";
  }

  async maybeWebContext(userText) {
    const enabled = await this.getSetting("web_enabled", "1");
    if (enabled === "0" || enabled === "false") return "";
    const looksCurrent = /\b(latest|current|202[4-9]|standard|docs?|mdn|spec|RFC|how to|official)\b/i.test(userText)
      || /^https?:\/\//i.test(userText);
    if (!looksCurrent && enabled !== "always") return "";
    try {
      const urlMatch = userText.match(/https?:\/\/[^\s)]+/);
      if (urlMatch) {
        const body = await this.fetchUrlText(urlMatch[0]);
        return `\n\nWeb page (${urlMatch[0]}):\n${body}`;
      }
      const body = await this.webSearch(userText.slice(0, 200));
      return `\n\nLive web context:\n${body}`;
    } catch (e) {
      return `\n\n(Web lookup failed: ${e.message})`;
    }
  }

  async getMcpConfig() {
    const raw = await this.getSetting("mcp_json", "");
    if (!raw) return { servers: [] };
    try { return JSON.parse(raw); } catch { return { servers: [] }; }
  }

  async saveMcpConfig(cfg) {
    await this.setSetting("mcp_json", JSON.stringify(cfg || { servers: [] }));
  }

  async mcpRpc(server, method, params = {}, id = 1) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (server.key) headers.Authorization = `Bearer ${server.key}`;
    const res = await fetch(server.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`MCP ${res.status}: ${text.slice(0, 240)}`);
    // streamable HTTP may return SSE
    if (text.startsWith("event:") || text.includes("data:")) {
      const lines = text.split("\n").filter((l) => l.startsWith("data:"));
      const last = lines.pop();
      if (last) return JSON.parse(last.slice(5).trim());
    }
    return JSON.parse(text);
  }

  async mcpInitialize(server) {
    const init = await this.mcpRpc(server, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "WIT AI", version: "1.3.1" },
    });
    try { await this.mcpRpc(server, "notifications/initialized", {}, null); } catch { /* optional */ }
    return init;
  }

  async mcpListTools(server) {
    await this.mcpInitialize(server);
    const out = await this.mcpRpc(server, "tools/list", {}, 2);
    return out?.result?.tools || out?.tools || [];
  }

  async mcpCallTool(server, name, args = {}) {
    await this.mcpInitialize(server);
    const out = await this.mcpRpc(server, "tools/call", { name, arguments: args }, 3);
    const result = out?.result || out;
    const content = result?.content;
    if (Array.isArray(content)) {
      return content.map((c) => c.text || JSON.stringify(c)).join("\n");
    }
    return JSON.stringify(result).slice(0, 8000);
  }

  async configureMcp() {
    const cfg = await this.getMcpConfig();
    const choice = await acode.select("MCP / services", [
      "Add HTTP MCP server",
      "List saved servers",
      "Test server (tools/list)",
      "Call a tool",
      "Remove a server",
      "Back",
    ]);
    if (choice === "Add HTTP MCP server") {
      const name = await acode.prompt("Server name", "my-mcp");
      if (!name) return;
      const url = await acode.prompt("MCP URL (HTTPS JSON-RPC)", "https://example.com/mcp");
      if (!url) return;
      const key = await acode.prompt("Bearer token (optional)", "", true);
      cfg.servers = cfg.servers.filter((s) => s.name !== name);
      cfg.servers.push({ name: name.trim(), url: url.trim(), key: (key || "").trim() });
      await this.saveMcpConfig(cfg);
      acode.toast("MCP server saved");
    } else if (choice === "List saved servers") {
      const names = (cfg.servers || []).map((s) => `${s.name}\n${s.url}`);
      acode.alert("MCP servers", names.join("\n\n") || "(none)");
    } else if (choice === "Test server (tools/list)") {
      if (!cfg.servers?.length) return acode.toast("No MCP servers");
      const picked = await acode.select("Server", cfg.servers.map((s) => s.name));
      const server = cfg.servers.find((s) => s.name === picked);
      if (!server) return;
      try {
        acode.loader?.show?.("Listing MCP tools…");
        const tools = await this.mcpListTools(server);
        acode.loader?.hide?.();
        acode.alert(
          server.name,
          tools.length
            ? tools.map((t) => `• ${t.name}\n  ${t.description || ""}`).join("\n\n")
            : "Connected, but no tools advertised."
        );
      } catch (e) {
        acode.loader?.hide?.();
        acode.alert("MCP error", e.message + "\n\nHTTP MCP servers need CORS + JSON-RPC. Stdio MCP cannot run inside Acode.");
      }
    } else if (choice === "Call a tool") {
      if (!cfg.servers?.length) return acode.toast("No MCP servers");
      const picked = await acode.select("Server", cfg.servers.map((s) => s.name));
      const server = cfg.servers.find((s) => s.name === picked);
      if (!server) return;
      try {
        acode.loader?.show?.("Loading tools…");
        const tools = await this.mcpListTools(server);
        acode.loader?.hide?.();
        if (!tools.length) return acode.toast("No tools");
        const tname = await acode.select("Tool", tools.map((t) => t.name));
        if (!tname) return;
        const argsRaw = await acode.prompt("Arguments JSON", "{}");
        let args = {};
        try { args = JSON.parse(argsRaw || "{}"); } catch { return acode.alert("WIT AI", "Invalid JSON"); }
        const ok = await acode.confirm(`Call ${tname} on ${server.name}?`);
        if (!ok) return;
        acode.loader?.show?.("Calling tool…");
        const result = await this.mcpCallTool(server, tname, args);
        acode.loader?.hide?.();
        this.history.push({ role: "user", content: `MCP ${server.name}.${tname} →\n${result}` });
        acode.alert("MCP result", String(result).slice(0, 3000));
      } catch (e) {
        acode.loader?.hide?.();
        acode.alert("MCP error", e.message);
      }
    } else if (choice === "Remove a server") {
      if (!cfg.servers?.length) return;
      const picked = await acode.select("Remove", cfg.servers.map((s) => s.name));
      if (!picked) return;
      cfg.servers = cfg.servers.filter((s) => s.name !== picked);
      await this.saveMcpConfig(cfg);
      acode.toast("Removed " + picked);
    }
  }

  async callLLM(messages, options = {}) {
    const { model, url, key, provider } = await this.resolveEndpoint();
    if (!key) {
      acode.alert("WIT AI", "No API key set for the current provider.\nOpen Settings to add one.");
      return null;
    }
    const body = {
      model: options.model || model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 8192,
      stream: false,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: this.authHeaders(key, provider),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error (${res.status}): ${errText.slice(0, 400)}`);
    }
    const data = await res.json();
    this.lastUsage = data.usage || null;
    this.toastUsage(this.lastUsage);
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  async callLLMStream(messages, onChunk, options = {}) {
    const { model, url, key, provider } = await this.resolveEndpoint();
    if (!key) {
      acode.alert("WIT AI", "No API key set for the current provider.\nOpen Settings to add one.");
      return null;
    }
    this.abortController = new AbortController();
    this.isStreaming = true;
    const body = {
      model: options.model || model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 8192,
      stream: true,
    };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.authHeaders(key, provider),
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API error (${res.status}): ${errText.slice(0, 400)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let full = "";
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.usage) this.lastUsage = parsed.usage;
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (delta) {
              full += delta;
              if (onChunk) onChunk(delta, full);
            }
          } catch { /* ignore */ }
        }
      }
      this.toastUsage(this.lastUsage);
      return full.trim();
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  }

  stopStream() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.isStreaming = false;
    }
  }

  async applyResult(result, ctx) {
    if (!result) return;
    const action = await acode.select("WIT AI – Apply", [
      "Replace selection / whole file",
      "Insert at cursor",
      "Open in new tab",
      "Copy to clipboard",
      "Cancel",
    ]);
    if (!action || action === "Cancel") return;
    const editor = editorManager.editor;
    if (action === "Replace selection / whole file") {
      const from = ctx.hasSelection ? editor.state.selection.main.from : 0;
      const to = ctx.hasSelection ? editor.state.selection.main.to : editor.state.doc.length;
      editor.dispatch({ changes: { from, to, insert: result } });
      acode.toast("Replaced");
    } else if (action === "Insert at cursor") {
      editor.dispatch({ changes: { from: ctx.cursor, insert: "\n" + result + "\n" } });
      acode.toast("Inserted");
    } else if (action === "Open in new tab") {
      const EditorFile = acode.require("editorFile");
      const ext = ctx.filename.includes(".") ? ctx.filename.split(".").pop() : "txt";
      new EditorFile(`wit-ai-${Date.now()}.${ext}`, { text: result, render: true });
    } else if (action === "Copy to clipboard") {
      try {
        await navigator.clipboard.writeText(result);
        acode.toast("Copied");
      } catch {
        acode.alert("WIT AI", result.slice(0, 2000));
      }
    }
  }

  async quickAction(type) {
    const ctx = this.getCurrentContext();
    const system = `You are WIT AI, an expert coding assistant inside the Acode mobile editor.
Prefer clean, production-ready code. Match existing style. Minimal explanations unless asked.`;
    let userContent = "";
    if (type === "fix") {
      const code = ctx.selection || ctx.fullText;
      if (!code.trim()) { acode.toast("No code to fix"); return; }
      userContent = `Fix bugs and improve the following code. Keep functionality and style.

File: ${ctx.filename} (${ctx.language})

\`\`\`${ctx.language}
${code}
\`\`\`

Return only the fixed code.`;
    } else {
      const feature = await acode.prompt("What do you want to generate / add?", "");
      if (!feature) return;
      userContent = `Generate code for: ${feature}

Current file (${ctx.filename}):
\`\`\`${ctx.language}
${ctx.fullText.slice(0, 12000)}
\`\`\`

Return ready-to-paste code.`;
    }
    const messages = [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ];
    try {
      acode.loader?.show?.("WIT AI is thinking…");
      const result = await this.callLLM(messages);
      acode.loader?.hide?.();
      if (result) await this.applyResult(result, ctx);
    } catch (e) {
      acode.loader?.hide?.();
      acode.alert("WIT AI Error", e.message || String(e));
    }
  }

  async runAgent() {
    const task = await acode.prompt(
      "Agent task (e.g. 'Add dark mode toggle', 'Fix TypeScript errors in src/')",
      ""
    );
    if (!task) return;

    const ctx = this.getCurrentContext();
    let folderUrl = ctx.uri ? ctx.uri.replace(/\/[^/]+$/, "") : "";
    try {
      if (window.addedFolder?.[0]?.url) folderUrl = window.addedFolder[0].url;
    } catch { /* ignore */ }

    let fileTreeSummary = "(no folder open)";
    if (folderUrl) {
      const tree = await this.listDir(folderUrl, 2);
      const flat = this.flattenTree(tree).slice(0, 80);
      fileTreeSummary = flat.join("\n") || "(empty)";
    }

    const system = `You are WIT AI Agent. Solve coding tasks by proposing concrete file operations.
Respond ONLY with a JSON array of actions (no markdown fences):
[
  {"action": "read", "path": "relative/path"},
  {"action": "write", "path": "path", "content": "full file content"},
  {"action": "create", "path": "path", "content": "full file content"},
  {"action": "patch", "path": "path", "find": "exact old text", "replace": "new text"},
  {"action": "mcp", "server": "server-name", "tool": "tool-name", "args": {}},
  {"action": "done", "summary": "what was done"}
]
Prefer few focused actions. Use patch for small edits. Always end with "done".`;

    const messages = [
      { role: "system", content: system },
      {
        role: "user",
        content: `Task: ${task}

Current file: ${ctx.filename}
Project tree (partial):
${fileTreeSummary}

Current file content (truncated):
\`\`\`${ctx.language}
${(ctx.selection || ctx.fullText).slice(0, 6000)}
\`\`\``,
      },
    ];

    try {
      acode.loader?.show?.("Agent planning…");
      const raw = await this.callLLM(messages, { max_tokens: 8192 });
      acode.loader?.hide?.();
      if (!raw) return;

      let actions;
      try {
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        actions = JSON.parse(cleaned);
      } catch {
        acode.alert("WIT AI Agent", "Could not parse agent plan.\n\n" + raw.slice(0, 1200));
        return;
      }
      if (!Array.isArray(actions)) {
        acode.alert("WIT AI Agent", "Agent did not return an action list.");
        return;
      }

      const fs = acode.require("fs");
      const results = [];

      for (const act of actions) {
        if (!act || !act.action) continue;
        if (act.action === "done") {
          results.push("✓ " + (act.summary || "Done"));
          break;
        }
        if (act.action === "read") {
          try {
            const url = act.path.startsWith("file:") || act.path.startsWith("content:")
              ? act.path
              : (folderUrl ? `${folderUrl.replace(/\/$/, "")}/${act.path.replace(/^\//, "")}` : act.path);
            const content = await (await fs(url)).readFile("utf-8");
            results.push(`Read ${act.path} (${content.length} chars)`);
            messages.push({ role: "assistant", content: JSON.stringify([act]) });
            messages.push({ role: "user", content: `File content of ${act.path}:\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\`` });
          } catch (e) {
            results.push(`Failed read ${act.path}: ${e.message}`);
          }
        }
        if (act.action === "write" || act.action === "create") {
          const confirm = await acode.confirm(`Agent wants to ${act.action}:\n${act.path}\n\nProceed?`);
          if (!confirm) {
            results.push(`Skipped ${act.action} ${act.path}`);
            continue;
          }
          try {
            const url = act.path.startsWith("file:") || act.path.startsWith("content:")
              ? act.path
              : (folderUrl ? `${folderUrl.replace(/\/$/, "")}/${act.path.replace(/^\//, "")}` : act.path);
            if (act.action === "create") {
              const parts = act.path.replace(/\\/g, "/").split("/").filter(Boolean);
              let parent = folderUrl;
              for (let i = 0; i < parts.length - 1; i++) {
                try {
                  parent = await (await fs(parent)).createDirectory(parts[i]);
                } catch {
                  parent = `${parent.replace(/\/$/, "")}/${parts[i]}`;
                }
              }
              await (await fs(parent)).createFile(parts[parts.length - 1], act.content || "");
            } else {
              await (await fs(url)).writeFile(act.content || "");
            }
            results.push(`✓ ${act.action} ${act.path}`);
          } catch (e) {
            results.push(`Failed ${act.action} ${act.path}: ${e.message}`);
          }
        }
        if (act.action === "patch") {
          const confirm = await acode.confirm(`Agent patch:\n${act.path}\n\nProceed?`);
          if (!confirm) {
            results.push(`Skipped patch ${act.path}`);
            continue;
          }
          try {
            const url = act.path.startsWith("file:") || act.path.startsWith("content:")
              ? act.path
              : (folderUrl ? `${folderUrl.replace(/\/$/, "")}/${act.path.replace(/^\//, "")}` : act.path);
            const file = await fs(url);
            let content = await file.readFile("utf-8");
            if (!act.find || !content.includes(act.find)) {
              results.push(`Patch miss ${act.path}: find text not found`);
            } else {
              content = content.replace(act.find, act.replace ?? "");
              await file.writeFile(content);
              results.push(`✓ patch ${act.path}`);
            }
          } catch (e) {
            results.push(`Failed patch ${act.path}: ${e.message}`);
          }
        }
        if (act.action === "mcp") {
          const cfg = await this.getMcpConfig();
          const server = (cfg.servers || []).find((s) => s.name === act.server);
          if (!server) {
            results.push(`MCP server not found: ${act.server}`);
            continue;
          }
          const confirm = await acode.confirm(`Call MCP ${act.server}.${act.tool}?`);
          if (!confirm) {
            results.push(`Skipped MCP ${act.tool}`);
            continue;
          }
          try {
            const out = await this.mcpCallTool(server, act.tool, act.args || {});
            results.push(`MCP ${act.tool}: ${String(out).slice(0, 400)}`);
            messages.push({ role: "user", content: `MCP result ${act.server}.${act.tool}:\n${String(out).slice(0, 6000)}` });
          } catch (e) {
            results.push(`MCP failed: ${e.message}`);
          }
        }
      }
      acode.alert("WIT AI Agent", results.join("\n") || "No actions executed.");
    } catch (e) {
      acode.loader?.hide?.();
      acode.alert("WIT AI Agent Error", e.message || String(e));
    }
  }

  async newProject() {
    const description = await acode.prompt(
      "Describe the project (stack + features)",
      "Simple HTML/CSS/JS todo app"
    );
    if (!description) return;
    let folder;
    try {
      folder = await acode.require("fileBrowser")("folder", "Choose parent folder for the new project");
    } catch {
      acode.toast("Cancelled");
      return;
    }
    if (!folder?.url) return;

    const messages = [
      {
        role: "system",
        content: `You are a project scaffolder. Output ONLY valid JSON (no markdown):
{
  "name": "project-folder-name",
  "files": [
    {"path": "index.html", "content": "..."},
    {"path": "src/main.js", "content": "..."}
  ]
}
Include a short README.md. Keep files reasonably sized.`,
      },
      { role: "user", content: description },
    ];

    try {
      acode.loader?.show?.("Scaffolding project…");
      const raw = await this.callLLM(messages, { max_tokens: 8192 });
      acode.loader?.hide?.();
      if (!raw) return;
      let json;
      try {
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        json = JSON.parse(cleaned);
      } catch {
        acode.alert("WIT AI", "Could not parse project JSON.\n\n" + raw.slice(0, 800));
        return;
      }
      if (!json.name || !Array.isArray(json.files)) {
        acode.alert("WIT AI", "Invalid project structure returned.");
        return;
      }
      const fs = acode.require("fs");
      const root = await fs(folder.url);
      const projectUrl = await root.createDirectory(json.name);
      for (const f of json.files) {
        if (!f.path || typeof f.content !== "string") continue;
        const parts = f.path.replace(/\\/g, "/").split("/").filter(Boolean);
        let currentUrl = projectUrl;
        for (let i = 0; i < parts.length - 1; i++) {
          try {
            currentUrl = await (await fs(currentUrl)).createDirectory(parts[i]);
          } catch {
            currentUrl = `${currentUrl.replace(/\/$/, "")}/${parts[i]}`;
          }
        }
        await (await fs(currentUrl)).createFile(parts[parts.length - 1], f.content);
      }
      acode.alert("WIT AI", `Project "${json.name}" created successfully!`);
    } catch (e) {
      acode.loader?.hide?.();
      acode.alert("WIT AI Error", e.message || String(e));
    }
  }

  /** Build chat UI into a container (page body or sidebar). Returns root element. */
  async mountChatUI(host) {
    const provider = await this.getSetting("provider", "groq");
    host.innerHTML = "";

    if (!document.getElementById("wit-ai-styles")) {
      const style = document.createElement("style");
      style.id = "wit-ai-styles";
      style.textContent = `
        .wit-root { display:flex; flex-direction:column; height:100%; min-height:280px; background:var(--secondary-color,#1e1e1e); color:var(--primary-text-color,#eee); font-family:system-ui,sans-serif; }
        .wit-header { padding:10px 12px; border-bottom:1px solid #333; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .wit-header select, .wit-header button { background:#2d2d2d; color:#eee; border:1px solid #444; border-radius:6px; padding:6px 10px; font-size:13px; }
        .wit-header button { cursor:pointer; }
        .wit-header button:active { background:#3d3d3d; }
        .wit-messages { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:10px; max-height:50vh; }
        .wit-msg { max-width:92%; padding:10px 12px; border-radius:10px; line-height:1.45; font-size:14px; white-space:pre-wrap; word-break:break-word; }
        .wit-msg.user { align-self:flex-end; background:#0d6efd; color:#fff; }
        .wit-msg.assistant { align-self:flex-start; background:#2a2a2a; border:1px solid #3a3a3a; }
        .wit-msg.system { align-self:center; background:transparent; color:#888; font-size:12px; }
        .wit-msg pre { background:#111; padding:8px; border-radius:6px; overflow-x:auto; margin:6px 0; }
        .wit-input-row { display:flex; gap:8px; padding:10px; border-top:1px solid #333; }
        .wit-input-row textarea { flex:1; min-height:44px; max-height:120px; resize:vertical; background:#2d2d2d; color:#eee; border:1px solid #444; border-radius:8px; padding:10px; font-size:14px; }
        .wit-input-row button { background:#0d6efd; color:#fff; border:none; border-radius:8px; padding:0 16px; font-weight:600; cursor:pointer; }
        .wit-input-row button.stop { background:#dc3545; }
        .wit-input-row button:disabled { opacity:0.5; }
        .wit-quick { display:flex; gap:6px; padding:0 10px 8px; flex-wrap:wrap; }
        .wit-quick button { background:#333; color:#ccc; border:1px solid #444; border-radius:16px; padding:4px 10px; font-size:12px; cursor:pointer; }
      `;
      document.head.appendChild(style);
    }

    const root = document.createElement("div");
    root.className = "wit-root";

    const header = document.createElement("div");
    header.className = "wit-header";
    header.innerHTML = `
      <select id="wit-provider">
        <option value="groq">Groq</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="gemini">Gemini</option>
        <option value="huggingface">Hugging Face</option>
        <option value="openai_compatible">Custom / inference</option>
      </select>
      <select id="wit-model"></select>
      <button type="button" id="wit-settings-btn" title="Settings">⚙</button>
      <button type="button" id="wit-clear-btn" title="Clear chat">🗑</button>
    `;
    root.appendChild(header);

    const messagesEl = document.createElement("div");
    messagesEl.className = "wit-messages scroll";
    messagesEl.style.overflowY = "auto";
    root.appendChild(messagesEl);

    const quick = document.createElement("div");
    quick.className = "wit-quick";
    quick.innerHTML = `
      <button type="button" data-q="fix">Fix file</button>
      <button type="button" data-q="generate">Generate</button>
      <button type="button" data-q="agent">Agent</button>
      <button type="button" data-q="project">New project</button>
      <button type="button" data-q="context">Attach file</button>
      <button type="button" data-q="web">Web lookup</button>
      <button type="button" data-q="mcp">MCP</button>
    `;
    root.appendChild(quick);

    const inputRow = document.createElement("div");
    inputRow.className = "wit-input-row";
    inputRow.innerHTML = `
      <textarea id="wit-input" placeholder="Ask WIT AI… (current file is context)" rows="2"></textarea>
      <button type="button" id="wit-send">Send</button>
    `;
    root.appendChild(inputRow);

    host.appendChild(root);
    await this.bindChatUI(root, header, messagesEl, quick, inputRow, provider);
    return root;
  }

  async bindChatUI(root, header, messagesEl, quick, inputRow, provider) {
    const providerSel = header.querySelector("#wit-provider");
    const modelSel = header.querySelector("#wit-model");
    providerSel.value = provider;

    const fillModels = async () => {
      const p = providerSel.value;
      modelSel.innerHTML = "";
      let list = this.MODELS[p] || [];
      const saved = await this.getSetting("model", "");
      // Try live /v1/models for custom + known OpenAI-compatible hosts
      if (p === "openai_compatible" || p === "groq" || p === "gemini" || p === "openai" || p === "anthropic") {
        try {
          const remote = await this.fetchRemoteModels();
          if (remote.length) {
            const staticIds = new Set(list.map((m) => m.id));
            list = list.concat(remote.filter((m) => !staticIds.has(m.id)));
          }
        } catch { /* keep static */ }
      }
      for (const m of list) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.label;
        if (m.id === saved) opt.selected = true;
        modelSel.appendChild(opt);
      }
      if (saved && ![...modelSel.options].some((o) => o.value === saved)) {
        const opt = document.createElement("option");
        opt.value = saved;
        opt.textContent = saved;
        opt.selected = true;
        modelSel.appendChild(opt);
      }
      if (list.length && !saved) modelSel.value = list[0].id;
    };
    await fillModels();

    providerSel.onchange = async () => {
      await this.setSetting("provider", providerSel.value);
      await fillModels();
      await this.setSetting("model", modelSel.value);
    };
    modelSel.onchange = async () => {
      if (modelSel.value === "custom") {
        const custom = await acode.prompt("Custom model ID", await this.getSetting("model", ""));
        if (custom) {
          await this.setSetting("model", custom.trim());
          const opt = document.createElement("option");
          opt.value = custom.trim();
          opt.textContent = custom.trim();
          opt.selected = true;
          modelSel.appendChild(opt);
        }
      } else {
        await this.setSetting("model", modelSel.value);
      }
    };

    header.querySelector("#wit-settings-btn").onclick = () => this.openSettings();
    header.querySelector("#wit-clear-btn").onclick = () => {
      this.history = [];
      this.persistHistory();
      messagesEl.innerHTML = "";
      addSystem("Chat cleared");
    };

    const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const addMsg = (role, text) => {
      const div = document.createElement("div");
      div.className = `wit-msg ${role}`;
      let html = escapeHtml(text);
      html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => `<pre>${escapeHtml(code)}</pre>`);
      div.innerHTML = html;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    };
    const addSystem = (t) => addMsg("system", t);

    if (this.history.length) {
      for (const m of this.history) addMsg(m.role === "user" ? "user" : "assistant", m.content);
    } else {
      addSystem("WIT AI ready. Open sidebar icon or FAB. Set API keys via ⚙ or Plugins → WIT AI → Settings.");
    }

    quick.querySelectorAll("button").forEach((btn) => {
      btn.onclick = async () => {
        const q = btn.dataset.q;
        if (q === "fix") return this.quickAction("fix");
        if (q === "generate") return this.quickAction("generate");
        if (q === "agent") return this.runAgent();
        if (q === "project") return this.newProject();
        if (q === "context") {
          const ctx = this.getCurrentContext();
          addSystem(`Attached: ${ctx.filename} (${ctx.fullText.length} chars)`);
        }
        if (q === "mcp") return this.configureMcp();
        if (q === "web") {
          const qtext = await acode.prompt("Search the web / paste a docs URL", "");
          if (!qtext) return;
          addSystem("Looking up: " + qtext);
          try {
            const extra = await this.maybeWebContext(qtext + " latest official docs");
            this.history.push({ role: "user", content: "Web lookup: " + qtext + extra });
            addSystem((extra || "").slice(0, 800) || "No results");
          } catch (e) {
            addSystem("Web error: " + e.message);
          }
        }
      };
    });

    const input = inputRow.querySelector("#wit-input");
    const sendBtn = inputRow.querySelector("#wit-send");

    const send = async () => {
      const text = input.value.trim();
      if (!text || this.isStreaming) return;
      input.value = "";
      addMsg("user", text);
      this.history.push({ role: "user", content: text });

      const ctx = this.getCurrentContext();
      const codeCtx = (ctx.selection || ctx.fullText).slice(0, 10000);

      const apiMessages = [
        {
          role: "system",
          content: `You are WIT AI, a coding assistant inside Acode. Be concise. Current file: ${ctx.filename} (${ctx.language}).`,
        },
        ...this.history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      ];
      const web = await this.maybeWebContext(text);
      apiMessages[apiMessages.length - 1] = {
        role: "user",
        content: `File context (${ctx.filename}):\n\`\`\`${ctx.language}\n${codeCtx}\n\`\`\`${web}\n\n${text}\n\nUse current official standards when coding. Prefer latest stable APIs.`,
      };

      const assistantEl = addMsg("assistant", "…");
      sendBtn.textContent = "Stop";
      sendBtn.classList.add("stop");

      try {
        let full = "";
        await this.callLLMStream(apiMessages, (_delta, soFar) => {
          full = soFar;
          assistantEl.textContent = soFar;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        });
        if (full) {
          this.history.push({ role: "assistant", content: full });
          await this.persistHistory();
          let html = escapeHtml(full);
          html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _l, code) => `<pre>${escapeHtml(code)}</pre>`);
          assistantEl.innerHTML = html;
        } else {
          assistantEl.textContent = "(empty response)";
        }
      } catch (e) {
        if (e.name === "AbortError") {
          assistantEl.textContent = (assistantEl.textContent || "") + "\n[stopped]";
        } else {
          assistantEl.textContent = "Error: " + (e.message || String(e));
        }
      } finally {
        sendBtn.textContent = "Send";
        sendBtn.classList.remove("stop");
      }
    };

    sendBtn.onclick = () => {
      if (this.isStreaming) this.stopStream();
      else send();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

  renderSidebarChat(container) {
    this.mountChatUI(container).catch((e) => {
      container.innerHTML = `<p style="padding:12px;color:#f66">WIT AI error: ${e.message}</p>`;
    });
  }

  async openPanel() {
    const page = this.$page;
    if (!page) return this.openMainMenuFallback();

    try {
      if (typeof page.settitle === "function") page.settitle("WIT AI");
      else if (typeof page.setTitle === "function") page.setTitle("WIT AI");
    } catch { /* ignore */ }

    // Prefer body container if available
    let host = page;
    try {
      if (typeof page.body === "object" && page.body) host = page.body;
      else if (page.querySelector?.(".page-body")) host = page.querySelector(".page-body");
    } catch { /* use page */ }

    if (host === page) {
      page.innerHTML = "";
    } else {
      host.innerHTML = "";
    }

    await this.mountChatUI(host);

    try {
      page.show();
    } catch (e) {
      try {
        const actionStack = acode.require("actionStack");
        actionStack.push({ id: "witai-page", action: () => page.hide?.() });
        (document.getElementById("app") || document.body).appendChild(page);
      } catch {
        console.warn("WIT AI: could not show page", e);
        this.openMainMenuFallback();
      }
    }
  }

  openMainMenuFallback() {
    acode.select("WIT AI", [
      "Open chat panel",
      "Fix current file",
      "Generate code",
      "Multi-step agent",
      "Scaffold project",
      "Settings",
    ]).then((c) => {
      if (c === "Open chat panel") this.openPanel();
      else if (c === "Fix current file") this.quickAction("fix");
      else if (c === "Generate code") this.quickAction("generate");
      else if (c === "Multi-step agent") this.runAgent();
      else if (c === "Scaffold project") this.newProject();
      else if (c === "Settings") this.openSettings();
    });
  }

  async openSettings() {
    const currentProvider = await this.getSetting("provider", "groq");
    const currentModel = await this.getSetting("model", "");
    const currentBase = await this.getSetting("base_url", "");

    const webOn = await this.getSetting("web_enabled", "1");
    const choice = await acode.select("WIT AI Settings", [
      `Provider: ${currentProvider}`,
      `Model: ${currentModel || "(default)"}`,
      "Profiles (save / load setups)",
      "Set Groq API Key",
      "Set OpenAI API Key",
      "Set Anthropic API Key",
      "Set Gemini API Key",
      "Set Hugging Face Token",
      "Set Custom / inference key",
      "Custom / inference URL",
      "Refresh remote models",
      "MCP / external services",
      `Web lookup: ${webOn === "0" ? "off" : webOn === "always" ? "always" : "auto"}`,
      "Test current provider",
      "Clear all keys",
      "Back",
    ]);

    if (choice?.startsWith("Provider:")) {
      const p = await acode.select("Default provider", [
        "groq", "openai", "anthropic", "gemini", "huggingface", "openai_compatible",
      ]);
      if (p) {
        await this.setSetting("provider", p);
        acode.toast(`Provider → ${p}`);
      }
    } else if (choice?.startsWith("Model:")) {
      const p = await this.getSetting("provider", "groq");
      let list = this.MODELS[p] || [];
      try {
        const remote = await this.fetchRemoteModels();
        if (remote.length) {
          const ids = new Set(list.map((m) => m.id));
          list = list.concat(remote.filter((m) => !ids.has(m.id)));
        }
      } catch { /* static only */ }
      if (list.length) {
        const labels = list.map((m) => m.label).slice(0, 40);
        const picked = await acode.select("Model", labels);
        if (picked) {
          const m = list.find((x) => x.label === picked);
          if (m) {
            if (m.id === "custom") {
              const custom = await acode.prompt("Custom model ID", currentModel || "");
              if (custom) await this.setSetting("model", custom.trim());
            } else {
              await this.setSetting("model", m.id);
            }
            acode.toast("Model saved");
          }
        }
      } else {
        const model = await acode.prompt("Model id", currentModel || "");
        if (model) await this.setSetting("model", model.trim());
      }
    } else if (choice === "Profiles (save / load setups)") {
      await this.manageProfiles();
    } else if (choice === "Set Groq API Key") {
      const key = await acode.prompt("Groq API Key (gsk_…)", "", true);
      if (key !== null) {
        await this.setKey("groq", key.trim());
        acode.toast(key ? "Groq key saved" : "Cleared");
      }
    } else if (choice === "Set OpenAI API Key") {
      const key = await acode.prompt("OpenAI API Key (sk-…)", "", true);
      if (key !== null) {
        await this.setKey("openai", key.trim());
        acode.toast(key ? "OpenAI key saved" : "Cleared");
      }
    } else if (choice === "Set Anthropic API Key") {
      const key = await acode.prompt("Anthropic API Key (sk-ant-…)", "", true);
      if (key !== null) {
        await this.setKey("anthropic", key.trim());
        acode.toast(key ? "Anthropic key saved" : "Cleared");
      }
    } else if (choice === "Set Gemini API Key") {
      const key = await acode.prompt("Gemini API Key (from Google AI Studio)", "", true);
      if (key !== null) {
        await this.setKey("gemini", key.trim());
        acode.toast(key ? "Gemini key saved" : "Cleared");
      }
    } else if (choice === "Set Hugging Face Token") {
      const key = await acode.prompt("Hugging Face Token (hf_…)", "", true);
      if (key !== null) {
        await this.setKey("huggingface", key.trim());
        acode.toast(key ? "HF token saved" : "Cleared");
      }
    } else if (choice === "Set Custom / inference key") {
      const key = await acode.prompt("API key (BrewKeg, OpenRouter, Together, …)", "", true);
      if (key !== null) {
        await this.setKey("openai_compatible", key.trim());
        acode.toast(key ? "Inference key saved" : "Cleared");
      }
    } else if (choice === "Custom / inference URL") {
      const labels = this.ENDPOINT_PRESETS.map((p) => p.label);
      const picked = await acode.select("Endpoint preset", labels);
      if (picked) {
        const preset = this.ENDPOINT_PRESETS.find((p) => p.label === picked);
        if (preset?.id === "custom" || !preset?.url) {
          const url = await acode.prompt(
            "Base URL (e.g. https://api.openai.com/v1)",
            currentBase || "https://api.openai.com/v1"
          );
          if (url !== null) {
            await this.setSetting("base_url", url.trim());
            await this.setSetting("provider", "openai_compatible");
            acode.toast("Custom URL saved");
          }
        } else {
          await this.setSetting("base_url", preset.url);
          await this.setSetting("provider", "openai_compatible");
          acode.toast("Endpoint → " + preset.label);
        }
      }
    } else if (choice === "Refresh remote models") {
      try {
        acode.loader?.show?.("Fetching models…");
        const remote = await this.fetchRemoteModels();
        acode.loader?.hide?.();
        acode.alert("Remote models", remote.length
          ? remote.slice(0, 30).map((m) => m.id).join("\n")
          : "None returned (endpoint may not support /v1/models)");
      } catch (e) {
        acode.loader?.hide?.();
        acode.alert("Models", e.message);
      }
    } else if (choice === "MCP / external services") {
      await this.configureMcp();
    } else if (choice === "Test current provider") {
      try {
        acode.loader?.show?.("Testing connection…");
        const reply = await this.callLLM([
          { role: "user", content: "Reply with exactly: WIT AI connected" },
        ], { max_tokens: 32 });
        acode.loader?.hide?.();
        acode.alert("Connection", reply || "(empty — check key + base URL)");
      } catch (e) {
        acode.loader?.hide?.();
        acode.alert("Connection failed", e.message);
      }
    } else if (choice?.startsWith("Web lookup:")) {
      const mode = await acode.select("Web lookup", ["auto", "always", "off"]);
      if (mode) {
        await this.setSetting("web_enabled", mode === "off" ? "0" : mode);
        acode.toast("Web lookup → " + mode);
      }
    } else if (choice === "Clear all keys") {
      await this.setKey("groq", "");
      await this.setKey("openai", "");
      await this.setKey("anthropic", "");
      await this.setKey("gemini", "");
      await this.setKey("huggingface", "");
      await this.setKey("openai_compatible", "");
      acode.toast("Keys cleared");
    }
  }
}

if (window.acode) {
  const wit = new WitAI();

  // Official plugin settings page (Plugins → WIT AI → Settings gear)
  const pluginSettings = {
    list: [
      {
        key: "provider",
        text: "AI Provider",
        info: "Groq, Gemini, Hugging Face, or any OpenAI-compatible endpoint",
        select: [
          ["groq", "Groq"],
          ["openai", "OpenAI"],
          ["anthropic", "Anthropic"],
          ["gemini", "Gemini"],
          ["huggingface", "Hugging Face"],
          ["openai_compatible", "Custom / inference"],
        ],
        value: "groq",
      },
      {
        key: "model",
        text: "Model ID",
        info: "e.g. llama-3.3-70b-versatile, gemini-3.8-flash",
        prompt: "Model ID",
        promptType: "text",
        value: "llama-3.3-70b-versatile",
      },
      {
        key: "base_url",
        text: "Custom base URL",
        info: "Used when provider is Custom endpoint (OpenAI, OpenRouter, DeepSeek, Ollama, BrewKeg, …)",
        prompt: "Base URL",
        promptType: "text",
        value: "https://api.openai.com/v1",
      },
      {
        key: "web_enabled",
        text: "Web lookup",
        info: "Fetch live docs when the prompt needs current standards",
        select: [
          ["1", "Auto"],
          ["always", "Always"],
          ["0", "Off"],
        ],
        value: "1",
      },
      {
        key: "open_chat",
        text: "Open WIT AI chat",
        info: "Opens the chat panel",
        value: true,
        valueText: () => "Tap to open",
        checkbox: false,
      },
    ],
    cb(key, value) {
      if (key === "provider" || key === "model" || key === "base_url") {
        wit.setSetting(key, value);
      }
      if (key === "open_chat") {
        wit.openPanel();
      }
    },
  };

  acode.setPluginInit(
    plugin.id,
    async (baseUrl, $page, { cacheFile, cacheFileUrl, firstInit, ctx }) => {
      wit.baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      await wit.init($page, cacheFile, cacheFileUrl, firstInit, ctx);
      // Sync settings page values from secrets when possible
      try {
        const p = await wit.getSetting("provider", "groq");
        const m = await wit.getSetting("model", "llama-3.3-70b-versatile");
        const b = await wit.getSetting("base_url", "https://api.openai.com/v1");
        const item = (k) => pluginSettings.list.find((x) => x.key === k);
        if (item("provider")) item("provider").value = p;
        if (item("model")) item("model").value = m;
        if (item("base_url")) item("base_url").value = b;
      } catch { /* ignore */ }
    },
    pluginSettings
  );

  acode.setPluginUnmount(plugin.id, () => {
    wit.destroy();
  });
}
