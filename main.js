const plugin = {"$schema": "https://acode.app/schema/plugin/v0.1.0.json", "id": "com.witai.coder", "name": "WIT AI", "main": "main.js", "version": "1.2.0", "readme": "readme.md", "changelogs": "changelog.md", "icon": "icon.png", "files": [], "minVersionCode": 290, "license": "MIT", "keywords": ["ai", "groq", "huggingface", "coder", "assistant", "generate", "fix", "agent", "streaming"], "price": 0, "permissions": [], "author": {"name": "Mikael Kraft", "email": "", "github": "mikaelkraft", "url": "https://github.com/mikaelkraft"}};
/**
 * WIT AI v1.1 — AI coding assistant for Acode
 * Groq + Hugging Face + OpenAI-compatible providers
 * Features: side-panel chat, streaming, multi-step agent, model picker,
 *           fix / generate / scaffold projects
 */
class WitAI {
  baseUrl = "";
  ctx = null;
  $page = null;
  history = [];
  isStreaming = false;
  abortController = null;

  MODELS = {
    groq: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout" },
      { id: "qwen/qwen3-32b", label: "Qwen3 32B" },
    ],
    huggingface: [
      { id: "meta-llama/Llama-3.1-8B-Instruct", label: "Llama 3.1 8B Instruct" },
      { id: "meta-llama/Llama-3.1-70B-Instruct", label: "Llama 3.1 70B Instruct" },
      { id: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen2.5 72B" },
      { id: "mistralai/Mixtral-8x7B-Instruct-v0.1", label: "Mixtral 8x7B" },
      { id: "google/gemma-2-27b-it", label: "Gemma 2 27B" },
    ],
    openai_compatible: [
      { id: "custom", label: "Custom (set in settings)" },
    ],
  };

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

  async resolveEndpoint() {
    const provider = await this.getSetting("provider", "groq");
    let model = await this.getSetting("model", "");
    const baseUrl = await this.getSetting("base_url", "");
    if (!model) {
      model = provider === "groq" ? "llama-3.3-70b-versatile"
        : provider === "huggingface" ? "meta-llama/Llama-3.1-8B-Instruct"
        : "gpt-4o-mini";
    }
    let url, keyProvider;
    if (provider === "groq") {
      url = "https://api.groq.com/openai/v1/chat/completions";
      keyProvider = "groq";
    } else if (provider === "huggingface") {
      url = "https://router.huggingface.co/v1/chat/completions";
      keyProvider = "huggingface";
    } else {
      url = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "") + "/chat/completions";
      keyProvider = "openai_compatible";
    }
    const key = await this.getKey(keyProvider);
    return { provider, model, url, key, keyProvider };
  }

  async callLLM(messages, options = {}) {
    const { model, url, key } = await this.resolveEndpoint();
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
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error (${res.status}): ${errText.slice(0, 400)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  async callLLMStream(messages, onChunk, options = {}) {
    const { model, url, key } = await this.resolveEndpoint();
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
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
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
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (delta) {
              full += delta;
              if (onChunk) onChunk(delta, full);
            }
          } catch { /* ignore */ }
        }
      }
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
  {"action": "done", "summary": "what was done"}
]
Prefer few focused actions. Always end with "done".`;

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
        <option value="huggingface">Hugging Face</option>
        <option value="openai_compatible">OpenAI-compatible</option>
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
      const list = this.MODELS[p] || [];
      const saved = await this.getSetting("model", "");
      for (const m of list) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.label;
        if (m.id === saved) opt.selected = true;
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
      await this.setSetting("model", modelSel.value);
    };

    header.querySelector("#wit-settings-btn").onclick = () => this.openSettings();
    header.querySelector("#wit-clear-btn").onclick = () => {
      this.history = [];
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
      apiMessages[apiMessages.length - 1] = {
        role: "user",
        content: `File context (${ctx.filename}):\n\`\`\`${ctx.language}\n${codeCtx}\n\`\`\`\n\n${text}`,
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

    const choice = await acode.select("WIT AI Settings", [
      `Provider: ${currentProvider}`,
      `Model: ${currentModel || "(default)"}`,
      "Set Groq API Key",
      "Set Hugging Face Token",
      "Set OpenAI-compatible Key",
      "Set OpenAI-compatible Base URL",
      "Clear all keys",
      "Back",
    ]);

    if (choice?.startsWith("Provider:")) {
      const p = await acode.select("Default provider", ["groq", "huggingface", "openai_compatible"]);
      if (p) {
        await this.setSetting("provider", p);
        acode.toast(`Provider → ${p}`);
      }
    } else if (choice?.startsWith("Model:")) {
      const p = await this.getSetting("provider", "groq");
      const list = this.MODELS[p] || [];
      if (list.length) {
        const labels = list.map((m) => m.label);
        const picked = await acode.select("Model", labels);
        if (picked) {
          const m = list.find((x) => x.label === picked);
          if (m) {
            await this.setSetting("model", m.id);
            acode.toast("Model saved");
          }
        }
      } else {
        const model = await acode.prompt("Model id", currentModel || "");
        if (model) await this.setSetting("model", model.trim());
      }
    } else if (choice === "Set Groq API Key") {
      const key = await acode.prompt("Groq API Key (gsk_…)", "", true);
      if (key !== null) {
        await this.setKey("groq", key.trim());
        acode.toast(key ? "Groq key saved" : "Cleared");
      }
    } else if (choice === "Set Hugging Face Token") {
      const key = await acode.prompt("Hugging Face Token (hf_…)", "", true);
      if (key !== null) {
        await this.setKey("huggingface", key.trim());
        acode.toast(key ? "HF token saved" : "Cleared");
      }
    } else if (choice === "Set OpenAI-compatible Key") {
      const key = await acode.prompt("API Key", "", true);
      if (key !== null) {
        await this.setKey("openai_compatible", key.trim());
        acode.toast(key ? "Key saved" : "Cleared");
      }
    } else if (choice === "Set OpenAI-compatible Base URL") {
      const url = await acode.prompt("Base URL (e.g. https://api.openai.com/v1)", currentBase || "https://api.openai.com/v1");
      if (url !== null) {
        await this.setSetting("base_url", url.trim());
        acode.toast("Base URL saved");
      }
    } else if (choice === "Clear all keys") {
      await this.setKey("groq", "");
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
        info: "Groq, Hugging Face, or OpenAI-compatible",
        select: [
          ["groq", "Groq"],
          ["huggingface", "Hugging Face"],
          ["openai_compatible", "OpenAI-compatible"],
        ],
        value: "groq",
      },
      {
        key: "model",
        text: "Model ID",
        info: "e.g. llama-3.3-70b-versatile",
        prompt: "Model ID",
        promptType: "text",
        value: "llama-3.3-70b-versatile",
      },
      {
        key: "base_url",
        text: "OpenAI-compatible Base URL",
        info: "Only for OpenAI-compatible provider",
        prompt: "Base URL",
        promptType: "text",
        value: "https://api.openai.com/v1",
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
